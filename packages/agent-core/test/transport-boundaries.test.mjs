/*
 * Transport boundary contracts for the Support layer (支援层): the SSE writer and the
 * OpenAI-compatible provider.
 *
 * The file lives beside the other `dist/esm` tests because it exercises the published
 * Support entry points, not the internal modules. Every case drives the transport through
 * its public port (`ports.request`, `ports.writer`) and asserts the boundary rules:
 * cancellation must stop the transport instead of hanging it, late responses must be
 * discarded rather than consumed, and response cleanup must never replace the HTTP
 * classification of the failure.
 *
 * Main exports: none. The file only registers `node:test` cases.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Support } from '../dist/esm/index.js';

// Placeholder endpoint and credentials; the fixture never reaches the network because
// every case replaces the request port.
const config = { baseUrl: 'https://fixture.invalid', apiKey: 'fixture', model: 'fixture' };
/**
 * A promise plus its resolver, so a test can release a stalled operation on demand.
 *
 * @returns The pending promise and the function that settles it.
 */
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
/** Yield to the event loop so already-queued microtasks and immediates can run. */
const tick = () => new Promise((resolve) => setImmediate(resolve));
/**
 * Await a pending operation under a short watchdog.
 *
 * The watchdog turns a hang into a failure instead of blocking the whole test run, and the
 * timer is always cleared so the process can exit.
 *
 * @param pending The promise under observation.
 * @returns The promise's value.
 * @throws The watchdog error `Operation hung` when the operation does not settle in time.
 */
async function promptly(pending) {
  let timer;
  try {
    return await Promise.race([
      pending,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error('Operation hung')), 250);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

test('SSE backpressure stops waiting on cancellation and does not enter a cancelled drain', async () => {
  // Two cancellation points: during `write` and while the drain wait is pending.
  for (const atWrite of [false, true]) {
    const control = new AbortController(),
      reason = Error('socket closed'),
      entered = deferred(),
      gate = deferred();
    let drains = 0;
    const pending = Support.writeSseFrame(
      {
        frame: 'data: x\n\n',
        writer: {
          write() {
            // Aborting inside `write` means the signal is already set when the
            // writer reports backpressure, so the drain wait must not start.
            if (atWrite) control.abort(reason);
            return false;
          },
          waitForDrain() {
            drains++;
            entered.resolve();
            return gate.promise;
          },
        },
      },
      { signal: control.signal },
    );
    if (!atWrite) {
      // Cancel only after the drain wait actually started.
      await entered.promise;
      control.abort(reason);
    }
    try {
      // The abort reason itself must surface, not a generic cancellation error.
      await assert.rejects(promptly(pending), (error) => error === reason);
    } finally {
      // Release the stalled drain so the pending frame can settle.
      gate.resolve();
      await pending.catch(() => {});
    }
    // A drain that was never entered must not be counted as a wait.
    assert.equal(drains, atWrite ? 0 : 1);
  }
});

test('a directly used Provider refuses pre-cancelled requests before HTTP dispatch', async () => {
  const control = new AbortController(),
    reason = Error('before request');
  control.abort(reason);
  let requests = 0;
  const provider = new Support.CompatibleModelProvider({
    config,
    ports: {
      async request() {
        requests++;
        throw Error('unexpected request');
      },
    },
  });
  await assert.rejects(
    Array.fromAsync(provider.stream([], { signal: control.signal })),
    (error) => error === reason,
  );
  // An already aborted signal must stop the call before any HTTP dispatch happens.
  assert.equal(requests, 0);
});

test('a direct Provider request ignores a stalled request port after cancellation and discards its late response', async () => {
  const control = new AbortController(),
    reason = Error('cancel request'),
    gate = deferred(),
    entered = deferred();
  let discarded = 0;
  const provider = new Support.CompatibleModelProvider({
    config,
    ports: {
      request() {
        entered.resolve();
        return gate.promise;
      },
    },
  });
  const pending = Array.fromAsync(provider.stream([], { signal: control.signal }));
  await entered.promise;
  control.abort(reason);
  try {
    await assert.rejects(promptly(pending), (error) => error === reason);
  } finally {
    // The request port answers only after the caller was cancelled.
    gate.resolve({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
      body: {
        cancel() {
          discarded++;
          return Promise.resolve();
        },
        getReader() {
          throw Error('late response was consumed');
        },
      },
    });
    await pending.catch(() => {});
    await tick();
  }
  // A late response must be discarded, never streamed into the cancelled run.
  assert.equal(discarded, 1);
});

test('direct Provider cancellation releases a pending SSE body read even if body cancellation stalls', async () => {
  const control = new AbortController(),
    reason = Error('cancel body'),
    // The body never yields and its cancellation never settles, so only the
    // provider's own cancellation path can release the reader.
    response = new Response(new ReadableStream({ cancel: () => new Promise(() => {}) }), {
      headers: { 'content-type': 'text/event-stream' },
    });
  const entered = deferred();
  const provider = new Support.CompatibleModelProvider({
    config,
    observe: {
      provider: {
        write(event) {
          // The response event marks the point where the SSE body read begins.
          if (event.event === 'provider.response') entered.resolve();
        },
      },
    },
    ports: { request: async () => response },
  });
  const pending = Array.fromAsync(provider.stream([], { signal: control.signal }));
  await entered.promise;
  await tick();
  control.abort(reason);
  await assert.rejects(promptly(pending), (error) => error === reason);
  // An unlocked body proves the reader was released rather than left pending.
  assert.equal(response.body.locked, false);
});

for (const status of [500, 200])
  test(`response cleanup cannot hang or replace HTTP ${status} classification`, async () => {
    // Cleanup failures come in two flavours: a throwing cancel and a never
    // settling cancel. Neither may change or delay the classified failure.
    for (const cleanup of ['throw', 'stall']) {
      const original = Error('cleanup failed');
      const provider = new Support.CompatibleModelProvider({
        config,
        ports: {
          request: async () => ({
            ok: status === 200,
            status,
            headers: new Headers(),
            body: {
              cancel() {
                if (cleanup === 'throw') throw original;
                return new Promise(() => {});
              },
            },
          }),
        },
      });
      await assert.rejects(
        promptly(Array.fromAsync(provider.stream([], { signal: new AbortController().signal }))),
        (error) => error.code === (status === 500 ? 'MODEL_UPSTREAM' : 'MODEL_FORMAT'),
      );
    }
  });

test('provider request observation cannot cancel and still trigger HTTP dispatch', async () => {
  const control = new AbortController(),
    reason = Error('observer cancelled');
  let requests = 0;
  const provider = new Support.CompatibleModelProvider({
    config,
    observe: {
      provider: {
        write(event) {
          // Cancelling from inside the observer must stop the dispatch as well.
          if (event.event === 'provider.request') control.abort(reason);
        },
      },
    },
    ports: {
      async request() {
        requests++;
        throw Error('unexpected request');
      },
    },
  });
  await assert.rejects(
    Array.fromAsync(provider.stream([], { signal: control.signal })),
    (error) => error === reason,
  );
  assert.equal(requests, 0);
});

test('diagnostic error-body capture releases its reader after HTTP classification', async () => {
  const response = new Response('private failure', { status: 500 });
  const provider = new Support.CompatibleModelProvider({
    config,
    observe: { provider: { write() {} } },
    ports: { request: async () => response },
  });
  await assert.rejects(
    Array.fromAsync(provider.stream([], { signal: new AbortController().signal })),
    (error) => error.code === 'MODEL_UPSTREAM',
  );
  // The diagnostic capture must release the reader, otherwise the body stays locked.
  assert.equal(response.body.locked, false);
});

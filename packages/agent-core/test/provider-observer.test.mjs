/**
 * Locks down Support-level provider observation: payloads stay lazy until an observer
 * accepts them, observer failures are isolated, and unobserved upstream failures cancel
 * the response body without reading it. Also proves Core ignores Support event names.
 * Runs under node --test over the built dist/esm output with fixture transports.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiagnostics, Support } from '@jangts/agent-core';
import { providerObservation } from '../dist/esm/support/model/observer.js';

test('Support observations are lazy, reject unknown events and isolate synchronous/asynchronous observer failures', async () => {
  let constructed = 0;
  const payload = () => {
    constructed++;
    return { data: 'private' };
  };
  providerObservation(undefined, {}).emit('provider.frame', payload);
  providerObservation(
    {
      accepts: () => false,
      write() {
        assert.fail('rejected observer ran');
      },
    },
    {},
  ).emit('provider.frame', payload);
  providerObservation(
    {
      accepts() {
        throw new Error('observer');
      },
      write() {
        assert.fail('failed acceptance wrote');
      },
    },
    {},
  ).emit('provider.frame', payload);
  providerObservation(
    {
      write() {
        assert.fail('unknown event wrote');
      },
    },
    {},
  ).emit('unknown', payload);
  // Rejected, throwing or unknown observers never construct the payload thunk.
  assert.equal(constructed, 0);
  // Sync and async observer failures must be swallowed; each accepted emit builds once.
  for (const write of [
    () => {
      throw new Error('write');
    },
    async () => {
      throw new Error('async write');
    },
  ]) {
    assert.doesNotThrow(() => providerObservation({ write }, {}).emit('provider.frame', payload));
  }
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(constructed, 2);
});

test('unobserved HTTP failures cancel the response without opening an error-body reader', async () => {
  for (const observer of [
    undefined,
    {
      accepts: () => false,
      write() {
        assert.fail('disabled');
      },
    },
  ]) {
    let cancellations = 0;
    const provider = new Support.CompatibleModelProvider({
      config: () => ({
        baseUrl: 'https://fixture.invalid',
        apiKey: 'fixture',
        model: 'fixture',
        maxOutputTokens: 1,
      }),
      observe: { provider: observer },
      ports: {
        request: async () => ({
          ok: false,
          status: 500,
          headers: new Headers(),
          body: {
            cancel: async () => {
              cancellations++;
            },
            getReader() {
              assert.fail('unobserved error-body read');
            },
          },
        }),
      },
    });
    await assert.rejects(
      Array.fromAsync(provider.stream([], { signal: new AbortController().signal })),
      /MODEL_UPSTREAM/,
    );
    // The error body is cancelled once and its reader is never opened.
    assert.equal(cancellations, 1);
  }
});

test('Core ignores Support event names while explicit Support observation preserves successful provider output', async () => {
  const coreEvents = [],
    supportEvents = [];
  const diagnostics = createDiagnostics({ output: { write: (value) => coreEvents.push(value) } });
  let constructed = 0;
  diagnostics.emit('provider.request', () => {
    constructed++;
    return {};
  });
  const provider = new Support.CompatibleModelProvider({
    config: () => ({
      baseUrl: 'https://fixture.invalid',
      apiKey: 'fixture',
      model: 'fixture',
      maxOutputTokens: 1,
    }),
    observe: {
      provider: {
        write(event) {
          supportEvents.push(event);
        },
      },
    },
    ports: {
      request: async () =>
        new Response(
          'data: {"choices":[{"index":0,"delta":{"content":"ok"}}]}\n\ndata: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
          { headers: { 'content-type': 'text/event-stream' } },
        ),
    },
  });
  assert.deepEqual(
    await Array.fromAsync(
      provider.stream([], { signal: new AbortController().signal, diagnostics }),
    ),
    ['ok'],
  );
  assert.equal(constructed, 0);
  assert.deepEqual(coreEvents, []);
  // Support names are only visible through the explicit Support observer, not Core.
  assert.ok(supportEvents.some((event) => event.event === 'provider.request'));
  assert.equal(supportEvents.at(-1).payload.complete, true);
});

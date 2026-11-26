// Locks error-inspection resilience: hostile getters, revoked proxies and broken string conversion
// on thrown values must never replace the original error, its cause, or the recorded context.
// Covers `getErrorInfo`, `diagnosticError`, `recordErrorContext`, `ModelRunner`,
// `CompatibleModelProvider` and `AgentCoreEngine`; `node --test` against dist/esm.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AgentCoreEngine,
  ModelRunner,
  CompatibleModelProvider,
  diagnosticError,
  getErrorInfo,
  createDiagnostics,
} from '../dist/esm/index.js';
import { recordErrorContext } from '../dist/esm/errors.js';

// Every metadata read throws, so inspection must degrade instead of propagating.
const metadataFailure = () => {
  throw Error('metadata access must not replace the original error');
};

test('error inspection retains the cause and trusted context when external metadata cannot be read', () => {
  // Each field is its own hostile shape; one unreadable field must not poison the others.
  for (const field of ['issues', 'errors', 'code', 'name', 'isRetryable']) {
    const original = {};
    Object.defineProperty(original, field, { get: metadataFailure });
    const info = getErrorInfo(original);
    assert.equal(info.cause, original);
    assert.equal(info.code, 'UNKNOWN_ERROR');
    assert.deepEqual(info.issues, []);
    recordErrorContext(original, { stageId: 'stage', codes: ['UPSTREAM'], isRetryable: false });
    const classified = getErrorInfo(original);
    assert.equal(classified.code, 'UPSTREAM');
    assert.equal(classified.stageId, 'stage');
    assert.equal(classified.isRetryable, false);
  }
  const issue = {};
  Object.defineProperty(issue, 'code', { get: metadataFailure });
  const original = { issues: [issue] };
  assert.equal(getErrorInfo(original).cause, original);
  assert.equal(getErrorInfo(original).code, 'UNKNOWN_ERROR');
});

test('error inspection snapshots top-level getters once and ignores unused alternate issue lists', () => {
  const counts = {};
  const original = {};
  for (const [key, value] of Object.entries({
    issues: [{ code: 'BAD', message: 'bad' }],
    code: 'EXPLICIT',
    isRetryable: true,
  })) {
    Object.defineProperty(original, key, {
      get() {
        counts[key] = (counts[key] ?? 0) + 1;
        return value;
      },
    });
  }
  Object.defineProperty(original, 'errors', { get: metadataFailure });
  assert.equal(getErrorInfo(original).code, 'BAD');
  // Getters are read once; `errors` is an unused alternate list and must stay untouched.
  assert.deepEqual(counts, { issues: 1, code: 1, isRetryable: 1 });
});

test('diagnostic error views tolerate hostile Error fields, string conversion and revoked proxies', () => {
  for (const field of ['name', 'message', 'stack', 'code']) {
    const original = Error('original');
    // V8's lazy stack preparation can read name/message; materialize it first.
    void original.stack;
    Object.defineProperty(original, field, { get: metadataFailure });
    const result = diagnosticError(original);
    assert.equal(result.name, 'UninspectableError');
    assert.equal(result.message, 'Error details unavailable');
  }
  const original = { toString: metadataFailure };
  assert.equal(diagnosticError(original).name, 'UninspectableError');
  const classified = { toString: metadataFailure };
  recordErrorContext(classified, { codes: ['CLASSIFIED'] });
  assert.equal(diagnosticError(classified).code, 'CLASSIFIED');
  const { proxy, revoke } = Proxy.revocable({}, {});
  revoke();
  assert.equal(getErrorInfo(proxy).cause, proxy);
  assert.equal(diagnosticError(proxy).name, 'UninspectableError');
});

test('model, provider and loop boundaries preserve the original thrown object with hostile metadata', async () => {
  const original = Error('original');
  Object.defineProperty(original, 'issues', { get: metadataFailure });
  const events = [];
  const runner = new ModelRunner({ execution: {},
    provider: {
      async *stream() {
        throw original;
      },
    },
    sink: {
      output: (event) => {
        events.push(event);
      },
    },
  });
  await assert.rejects(runner.invoke('question'), (error) => error === original);
  // The sink still reports the original message even though `issues` is unreadable.
  assert.equal(events.at(-1).payload.error.message, 'original');
  assert.equal(runner.lastCall.status, 'error');
  assert.equal(getErrorInfo(original).stageId, 'model');
  const provider = new CompatibleModelProvider({
    config: { baseUrl: 'https://mock.invalid', model: 'mock', apiKey: 'mock' },
    ports: {
      request: async () => {
        throw original;
      },
    },
  });
  await assert.rejects(
    Array.fromAsync(provider.stream([], { signal: new AbortController().signal })),
    (error) => error === original,
  );
  const diagnostics = createDiagnostics({
    output: {
      write: (event) => {
        events.push(event);
      },
    },
  });
  await assert.rejects(
    new AgentCoreEngine({ execution: { diagnostics } }).run(() => {
      throw original;
    }),
    (error) => error === original,
  );
  assert.equal(events.at(-1).payload.type, 'error');
});

test('issue metadata is captured once before validation and cannot change its type between reads', () => {
  const counts = {},
    issue = {};
  for (const [key, value] of Object.entries({
    code: 'CODE',
    message: 'message',
    path: ['field', 0],
    checkId: 'check',
  })) {
    Object.defineProperty(issue, key, {
      get() {
        counts[key] = (counts[key] ?? 0) + 1;
        return counts[key] === 1 ? value : false;
      },
    });
  }
  // A second read would flip value/type, so the snapshot must capture the first read only.
  const info = getErrorInfo({ issues: [issue] });
  assert.deepEqual(info.issues, [
    { code: 'CODE', message: 'message', path: ['field', 0], checkId: 'check' },
  ]);
  assert.deepEqual(counts, { code: 1, message: 1, path: 1, checkId: 1 });
});

test('invocation failures survive receipt formatting and journal acknowledgement failures', async () => {
  const { executeInvocation } = await import('../dist/esm/index.js');
  const original = Error('invocation failed');
  // Either the receipt formatter or the journal acknowledgement may fail; both are secondary.
  for (const receiptFailure of [false, true]) {
    const calls = [];
    const journal = {
      beginTool: () => 'call',
      finishTool(value) {
        calls.push(value);
        throw Error('journal unavailable');
      },
    };
    assert.throws(
      () =>
        executeInvocation(
          {
            id: 'read',
            call() {
              throw original;
            },
          },
          {},
          {},
          {
            journal: () => journal,
            receiptError() {
              if (receiptFailure) throw Error('receipt unavailable');
              return { code: 'FAILED' };
            },
          },
        ),
      (error) => error === original,
    );
    assert.equal(calls.length, receiptFailure ? 0 : 1);
  }
});

test('revoked proxies and hostile cancellation reasons cannot replace the thrown value', async () => {
  const { isTimeoutReason } = await import('../dist/esm/utils/cancellation.js');
  // A revoked proxy throws on every trap, including plain type checks.
  const { proxy, revoke } = Proxy.revocable({}, {});
  revoke();
  // Only an object whose name is exactly TimeoutError is a timeout; hostile getters are not.
  for (const value of [undefined, null, false, proxy]) assert.equal(isTimeoutReason(value), false);
  assert.equal(isTimeoutReason({ name: 'TimeoutError' }), true);
  const badName = {};
  Object.defineProperty(badName, 'name', { get: metadataFailure });
  assert.equal(isTimeoutReason(badName), false);
  await new ModelRunner({ execution: {},
    provider: {
      async *stream() {
        throw proxy;
      },
    },
  })
    .invoke('question')
    .then(
      () => assert.fail(),
      (error) => assert.ok(error === proxy),
    );
  for (const active of [false, true]) {
    const controller = new AbortController();
    const runner = new ModelRunner({
      provider: {
        async *stream() {
          controller.abort(proxy);
          throw proxy;
        },
      },
      execution: { signal: controller.signal },
    });
    if (!active) controller.abort(proxy);
    await runner.invoke('question').then(
      () => assert.fail(),
      (error) => assert.ok(error === proxy),
    );
    assert.equal(getErrorInfo(proxy).code, 'CANCELLED');
    await new AgentCoreEngine({ execution: { signal: controller.signal } })
      .run(() => {
        assert.fail();
      })
      .then(
        () => assert.fail(),
        (error) => assert.ok(error === proxy),
      );
  }
});

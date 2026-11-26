/**
 * Locks down model-runner settings and error reporting: limit accounting, constructor-time
 * configuration validation, provider status mapping, validation issue snapshots, timeout
 * versus cancellation, and stage attribution during context compression. Runs under
 * node --test with fixture providers and the shared context-workflow fixture.
 */
import { contextRunner } from './context-workflow.fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ModelRunner,
  Support,
  BudgetError,
  ValidationError,
  getErrorInfo,
  diagnosticError,
} from '../dist/esm/index.js';
const signal = () => new AbortController().signal;
const input = [{ role: 'user', content: 'hello' }];
const settings = () => ({
  provider: {
    async *stream() {
      yield 'ok';
    },
  },
  execution: { signal: signal() },
  maxCalls: 1,
  callTimeoutMs: 1000,
  maxInputChars: 100,
  maxOutputChars: 20,
  transports: [Support.createTextTransport({ id: 'text' })],
});
const invoke = (model) =>
  model.invoke({ stageId: 'reply', input, maxOutputTokens: 10, transport: 'text' });

test('named settings preserve limits, accounting and original budget errors', async () => {
  {
    const options = settings();
    const model = new ModelRunner(options);
    assert.equal((await invoke(model)).value, 'ok');
    await assert.rejects(invoke(model), (error) => {
      // The second call exceeds maxCalls: the budget error keeps its own identity as cause,
      // the stage that ran out, and the original call count (no extra retry).
      assert.ok(error instanceof BudgetError);
      assert.equal(getErrorInfo(error).cause, error);
      assert.equal(getErrorInfo(error).code, 'BUDGET');
      assert.equal(getErrorInfo(error).stageId, 'reply');
      assert.equal(getErrorInfo(error).isRetryable, false);
      return true;
    });
    assert.equal(model.callCount, 1);
  }
});
test('conflicting settings and invalid units reject at construction without provider execution', () => {
  const options = settings();
  const mutations = [
    // Nested config/ports shapes conflict with the flat named settings above.
    { config: { maxCalls: 1, callTimeoutMs: 1000 } },
    { ports: { maxSchemaChars: 1000 } },
    { ports: { tokenBudget: {} } },
    { maxCalls: -1 },
    { callTimeoutMs: 0 },
    // 2^31 is outside the range of a 32-bit timer and must be rejected.
    { callTimeoutMs: 2147483648 },
    { maxInputChars: NaN },
    { maxOutputChars: -1 },
    { maxSchemaChars: 0 },
  ];
  for (const change of mutations)
    assert.throws(
      () => new ModelRunner({ execution: {}, ...options, ...change }),
      (error) => {
        assert.equal(getErrorInfo(error).code, 'MODEL_CONFIG');
        return true;
      },
    );
  // A zero call count and an unbounded input ceiling are legal "no work allowed" settings.
  assert.doesNotThrow(() => new ModelRunner({ execution: {}, ...options, maxCalls: 0, maxInputChars: Infinity }));
});
test('frozen mapped provider errors keep identity, code, stage and HTTP retryability with one attempt', async () => {
  // Auth failures are terminal; rate limits and upstream faults are retryable. The mapped
  // error is the caller-supplied frozen object, so identity must survive mapping.
  for (const [status, code, isRetryable] of [
    [401, 'MODEL_AUTH', false],
    [429, 'MODEL_BUSY', true],
    [503, 'MODEL_UPSTREAM', true],
  ]) {
    const original = Object.freeze(new Error('App-safe message'));
    let attempts = 0;
    const provider = new Support.CompatibleModelProvider({
      config: () => ({
        baseUrl: 'https://model.invalid',
        apiKey: 'fixture',
        model: 'fixture',
        maxOutputTokens: 20,
      }),
      errors: { failure: () => original },
      ports: {
        request: async () => {
          attempts++;
          return new Response('', { status });
        },
      },
    });
    const model = new ModelRunner({ execution: {}, ...settings(), provider });
    await assert.rejects(invoke(model), (error) => {
      assert.equal(error, original);
      const info = getErrorInfo(error);
      assert.equal(info.code, code);
      assert.equal(info.stageId, 'reply');
      assert.equal(info.isRetryable, isRetryable);
      assert.equal(diagnosticError(error).stageId, 'reply');
      return true;
    });
    assert.equal(attempts, 1);
    assert.deepEqual(model.lastCall.codes, [code]);
  }
});
test('validation snapshots retain issue order and unknown failures never invent retryability', () => {
  // Issues are copied in declared order and frozen, so a reader cannot forge or reorder them.
  const error = new ValidationError([
    { code: 'A', message: 'first' },
    { code: 'B', message: 'second' },
  ]);
  const info = getErrorInfo(error);
  assert.deepEqual(info.codes, ['A', 'B']);
  assert.equal(info.isRetryable, false);
  assert.throws(() => info.issues.push({ code: 'forged', message: '' }));
  assert.throws(() => {
    info.issues[0].code = 'forged';
  });
  assert.equal(error.issues[0].code, 'A');
  // A plain Error carries no retryability decision, unlike validation and budget errors.
  assert.equal(getErrorInfo(new Error('unknown')).isRetryable, undefined);
  assert.equal(getErrorInfo('primitive').cause, 'primitive');
});
test('call timeout and parent cancellation remain distinguishable without replacing AbortSignal reasons', async (t) => {
  const keepAlive = setTimeout(() => {}, 1000);
  t.after(() => clearTimeout(keepAlive));
  const stalled = {
    async *stream() {
      await new Promise(() => {});
    },
  };
  const model = new ModelRunner({ execution: {}, ...settings(), provider: stalled, callTimeoutMs: 10 });
  await assert.rejects(
    invoke(model),
    (error) => getErrorInfo(error).code === 'CALL_TIMEOUT' && error.name === 'TimeoutError',
  );
  const control = new AbortController();
  const reason = new Error('stopped');
  const cancelled = new ModelRunner({
    ...settings(),
    execution: { signal: control.signal },
    provider: stalled,
  });
  const task = invoke(cancelled);
  control.abort(reason);
  // A parent abort must surface the exact AbortSignal reason while still mapping to
  // CANCELLED, which distinguishes it from the timeout's TimeoutError above.
  await assert.rejects(
    task,
    (error) => error === reason && getErrorInfo(error).code === 'CANCELLED',
  );
});

test('compression failures retain their originating stage when rethrown through context processing', async () => {
  const original = Object.freeze(new Error('compression failed'));
  const model = contextRunner({
    ...settings(),
    maxInputChars: 1000,
    provider: {
      async *stream() {
        throw original;
      },
    },
    transports: [Support.createTextTransport({ id: 'text' })],
    contextPolicy: {
      mode: 'reduce',
      steps: [
        {
          id: 'summary',
          kind: 'compress',
          fragmentId: 'history',
          handlerId: 'summary',
          targetChars: 10,
        },
      ],
    },
    contextCompressors: [
      Support.createContextCompressor({
        id: 'summary',
        instruction: 'Summarize',
        transport: 'text',
        maxOutputTokens: 10,
        parse: (value) => ({ history: value }),
      }),
    ],
  });
  await assert.rejects(
    model.invoke({
      stageId: 'reply',
      transport: 'text',
      maxOutputTokens: 10,
      input: {
        maxInputChars: 50,
        fragments: [
          {
            id: 'history',
            sourceId: 'test',
            trust: 'user',
            role: 'user',
            lifetime: 'turn',
            maxChars: 1000,
            value: { history: 'x'.repeat(200) },
          },
        ],
      },
    }),
    (error) => {
      assert.equal(error, original);
      // The stage path keeps the compression handler that failed, not just the reply stage.
      assert.equal(getErrorInfo(error).stageId, 'reply:compress:summary');
      return true;
    },
  );
});

test('runner observers retain prototype callbacks with private state', async () => {
  class Ports {
    #completed = [];
    get transports() {
      return [Support.createTextTransport({ id: 'text' })];
    }
    get completed() {
      return this.#completed.length;
    }
    event(fact) {
      if (fact.type === 'model.end') this.#completed.push(fact.payload.state);
    }
  }
  const ports = new Ports();
  const model = new ModelRunner({
    ...settings(),
    transports: ports.transports,
    execution: { observe: ports },
  });
  assert.equal((await invoke(model)).value, 'ok');
  assert.equal(ports.completed, 1);
});

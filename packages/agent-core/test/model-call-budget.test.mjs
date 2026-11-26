// Locks `ModelCalls` attempt accounting: one binding invocation costs one attempt regardless of
// batch size, invalid or cancelled calls cost nothing, and concurrent callers share one budget.
// Covers `ModelCalls` (kits/inference) and `AttemptBudget`; `node --test` against dist/esm.
import test from 'node:test';
import assert from 'node:assert/strict';
import { AttemptBudget, createDiagnostics, ModelRunner, CompatibleModelProvider, BudgetError } from '../dist/esm/index.js';
import { ModelCalls } from '../dist/esm/kits/inference.js';
// Fixed model id and timeout; only the input varies per case.
const request = (input) => ({ modelId: 'embedding', input, timeoutMs: 1000 });

test('external binding calls consume their explicit request attempts before I/O, including failure and concurrent calls', async () => {
  let calls = 0;
  const models = new ModelCalls([
    {
      id: 'embedding',
      identity: 'fixture',
      async invoke(input) {
        calls++;
        if (input === 'fail') throw new Error('upstream');
        return input;
      },
    },
  ]);
  const attemptBudget = new AttemptBudget(2),
    context = { signal: new AbortController().signal, attemptBudget };
  assert.equal((await models.invoke(request(['batch', 'of', 'three']), context)).value.length, 3);
  assert.equal(attemptBudget.used, 1, 'the unit is a binding invocation, not vector items');
  await assert.rejects(models.invoke(request('fail'), context), /upstream/);
  assert.equal(attemptBudget.used, 2);
  await assert.rejects(
    models.invoke(request('blocked'), context),
    (error) => error.code === 'BUDGET',
  );
  assert.equal(calls, 2);
  // Two concurrent invocations race for the same single attempt.
  const shared = { ...context, attemptBudget: new AttemptBudget(1) };
  const results = await Promise.allSettled([
    models.invoke(request('one'), shared),
    models.invoke(request('two'), shared),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(shared.attemptBudget.used, 1);
  assert.equal(calls, 3);
});

test('invalid input and prior cancellation do not charge attempts, and budget receivers retain private state', async () => {
  let calls = 0;
  // A custom budget with a private counter proves Core uses the supplied receiver.
  class Budget {
    #used = 0;
    take() {
      if (this.#used) return false;
      this.#used++;
      return true;
    }
    get used() {
      return this.#used;
    }
  }
  const attemptBudget = new Budget(),
    control = new AbortController(),
    records = [];
  const models = new ModelCalls([
    {
      id: 'embedding',
      identity: 'fixture',
      assertInput(input) {
        if (!input) throw new Error('input');
      },
      invoke: () => {
        calls++;
        return 'ok';
      },
    },
  ]);
  const context = {
    signal: control.signal,
    attemptBudget,
    diagnostics: createDiagnostics({ output: { write: (event) => records.push(event) } }),
  };
  await assert.rejects(models.invoke(request(''), context), /input/);
  assert.equal(attemptBudget.used, 0);
  assert.equal((await models.invoke(request('valid'), context)).value, 'ok');
  assert.equal(attemptBudget.used, 1);
  control.abort();
  await assert.rejects(models.invoke(request('cancelled'), context), { name: 'AbortError' });
  assert.equal(calls, 1);
  // Only the charged call emits a running record; rejected calls never start.
  assert.equal(records.filter((event) => event.payload.status === 'running').length, 1);
});


test('same and different credential runners keep independent ledgers, streams and failures', async () => {
  const { MockGPT, responses } = await import('../dist/esm/mock.js');
  for (const keys of [['fixture-a', 'fixture-a'], ['fixture-a', 'fixture-b']]) {
    const mock = new MockGPT({ rules: [
      { prompt: 'left', generator: responses.httpError(429) },
      { prompt: 'right', generator: 'right-result' },
    ] });
    const observed = [];
    const runners = keys.map((apiKey, index) => new ModelRunner({
      provider: new CompatibleModelProvider({
        config: { apiKey, model: 'demo', baseUrl: 'https://mock.invalid/v1' },
        ports: { request: async (input, init) => {
          observed.push({ index, credentialMatched: new Headers(init.headers).get('authorization') === `Bearer ${apiKey}` });
          return mock.fetch(input, init);
        } },
      }),
      maxCalls: 1,
      execution: { signal: new AbortController().signal },
    }));
    const results = await Promise.allSettled([runners[0].invoke('left'), runners[1].invoke('right')]);
    assert.equal(results[0].status, 'rejected');
    assert.equal(results[0].reason.code, 'MODEL_BUSY');
    assert.equal(results[1].status, 'fulfilled');
    assert.equal(results[1].value.value, 'right-result');
    assert.deepEqual(runners.map(r => r.totalCallCount), [1, 1]);
    assert.ok(observed.every(row => row.credentialMatched));
    assert.deepEqual(observed.map(row => row.index).sort(), [0, 1]);
    for (const runner of runners) await assert.rejects(runner.invoke('blocked'), BudgetError);
    assert.equal(mock.records.length, 2);
    assert.equal(mock.activeRequests, 0);
  }
});

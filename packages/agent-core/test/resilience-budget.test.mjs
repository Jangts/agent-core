import test from 'node:test';
import assert from 'node:assert/strict';
import { ModelRunner, AgentCoreEngine, defineWorkflow, route, Support } from '../dist/esm/index.js';
import { defineCompletionChecks } from '../dist/esm/kits/completion.js';
const signal = () => new AbortController().signal;
const provider = { async *stream() { yield 'answer'; } };
const runner = (extra = {}) => new ModelRunner({ provider, maxCalls: 1, maxTotalCalls: 4, execution: { signal: signal() }, ...extra });

test('dynamic allowance preserves charged attempts, snapshots and authorization ceiling', async () => {
  const model = runner();
  await model.invoke({ input: 'question' });
  const before = model.callBudget;
  const result = model.adjustCallBudget({ limit: 3, reason: 'Necessary evidence and delivery' });
  assert.equal(result.used, 1);
  assert.equal(result.remaining, 2);
  assert.equal(before.limit, 1);
  assert.equal(result.revisions[0].previous, 1);
  await model.invoke({ input: 'continue' });
  assert.equal(model.totalCallCount, 2);
  for (const limit of [1, 5, NaN, 2.5, -1])
    assert.throws(() => model.adjustCallBudget({ limit, reason: 'invalid' }));
  assert.throws(() => model.adjustCallBudget({ limit: 3, reason: ' ' }));
});

test('fixed budgets stay fixed by default; child expansion cannot grant parent calls', async () => {
  const fixed = runner({ maxTotalCalls: undefined });
  assert.throws(() => fixed.adjustCallBudget({ limit: 2, reason: 'not authorized' }));
  const parent = runner({ maxCalls: 2 });
  const child = parent.createChild({ id: 'research', maxCalls: 3, reserveCalls: 1, timeoutMs: 1000 });
  await child.invoke({ input: 'read' });
  assert.equal(child.remainingCalls, 0);
  child.adjustCallBudget({ limit: 3, reason: 'local allocation' });
  assert.equal(child.remainingCalls, 0);
  parent.adjustCallBudget({ limit: 4, reason: 'More necessary evidence' });
  assert.equal(child.remainingCalls, 2);
  await child.invoke({ input: 'read again' });
  assert.equal(parent.totalCallCount, 2);
});

test('adjustments stay request-local and cannot bypass cancellation', () => {
  const shared = new ModelRunner({ provider, maxCalls: 1, maxTotalCalls: 3 });
  const first = shared.bind({ signal: signal() });
  const second = shared.bind({ signal: signal() });
  first.adjustCallBudget({ limit: 2, reason: 'first task' });
  assert.equal(second.callBudget.limit, 1);
  assert.throws(() => shared.adjustCallBudget({ limit: 2, reason: 'unbound' }));
  const controller = new AbortController();
  const cancelled = runner({ execution: { signal: controller.signal } });
  controller.abort();
  assert.throws(() => cancelled.adjustCallBudget({ limit: 2, reason: 'too late' }));
});

test('ordinary workflow nodes can assess and adjust the same model runtime', async () => {
  const model = runner();
  const engine = new AgentCoreEngine().bindModelRuntime(model);
  const workflow = defineWorkflow({ id: 'dynamic-budget', entryNodeId: 'work', nodes: [{
    id: 'work', description: 'Perform necessary work', async run(_state, { model }) {
      assert.equal(model.callBudget.limit, 1);
      model.adjustCallBudget({ limit: 2, reason: 'two necessary stages' });
      await model.invoke({ input: 'one' });
      const result = await model.invoke({ input: 'two' });
      return { answer: result.value };
    }, routes: [{ id: 'done', complete: state => state.answer }],
  }] });
  assert.equal(await engine.bindWorkflow(workflow, {}).run({}), 'answer');
  assert.equal(model.callBudget.used, 2);
});

const assessment = (extra = {}) => Support.assessModelBudget({
  budget: { limit: 2, ceiling: 8, used: 1, remaining: 1, revisions: [] },
  work: { execution: 2, review: 1, delivery: 1, recovery: 1 }, ...extra,
});
test('assessment prefers compression or replanning to quotas, and expands useful work', () => {
  assert.equal(assessment().suggestedLimit, 6);
  assert.equal(assessment({ contextPressure: true, canReduceContext: true }).action, 'reduce-context');
  assert.equal(assessment({ stalled: true }).action, 'replan');
  assert.equal(assessment({ complete: true }).action, 'deliver');
  assert.equal(assessment({ needsUser: true }).action, 'clarify');
  assert.equal(assessment({ blocked: true }).action, 'partial');
  const budget = { limit: 2, ceiling: 2, used: 1, remaining: 1, revisions: [] };
  assert.equal(assessment({ budget }).action, 'replan');
  assert.equal(assessment({ budget, alternativesExhausted: true }).action, 'partial');
  assert.throws(() => assessment({ work: { execution: -1, review: 0, delivery: 0, recovery: 0 } }));
});

test('request recovery never reruns work and local fallback survives model recovery failure', async () => {
  let attempts = 0;
  const work = { artifacts: [] };
  const execute = Support.createRequestRecovery({
    async execute(record) { attempts++; record.artifacts.push('verified report'); throw new Error('provider unavailable'); },
    async recover() { throw new Error('recovery model unavailable'); },
    fallback(record, errors) { assert.equal(errors.length, 2); return record.artifacts.join(','); },
  });
  const result = await execute(work, signal());
  assert.equal(attempts, 1);
  assert.equal(result.source, 'fallback');
  assert.equal(result.value, 'verified report');
  assert.equal(result.errors.length, 2);
});

test('cancellation does not enter recovery or local fallback', async () => {
  const controller = new AbortController();
  let recovered = false;
  const execute = Support.createRequestRecovery({
    async execute() { controller.abort(); throw new Error('cancelled'); },
    fallback() { recovered = true; return 'wrong'; },
  });
  await assert.rejects(execute({}, controller.signal));
  assert.equal(recovered, false);
});

test('completion separates local repair from optional failure; required faults remain visible', async () => {
  const checks = defineCompletionChecks([
    { id: 'memory', required: false, check() { throw new Error('storage'); } },
    { id: 'format', required: true, check: () => ({ kind: 'repair', target: 'format', reason: 'repair bubbles only' }) },
    { id: 'not-reached', required: true, check() { assert.fail('must not run'); } },
  ]);
  const result = await checks.run({}, signal());
  assert.equal(result.observations.length, 2);
  assert.equal(result.decision.target, 'format');
  const optional = defineCompletionChecks([{ id: 'interest', required: false, check: () => ({ kind: 'partial', reason: 'not stored' }) }]);
  assert.equal((await optional.run({}, signal())).decision.kind, 'ready');
  const required = defineCompletionChecks([{ id: 'fact', required: true, check() { throw new Error('evidence'); } }]);
  await assert.rejects(required.run({}, signal()), /evidence/);
});


test('CommonJS exposes the same budget, recovery and completion contracts', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const cjs = require('../dist/cjs/index.js');
  const { defineCompletionChecks: checks } = require('../dist/cjs/kits/completion.js');
  const model = new cjs.ModelRunner({ provider, maxCalls: 0, maxTotalCalls: 1, execution: { signal: signal() } });
  model.adjustCallBudget({ limit: 1, reason: 'one necessary reply' });
  assert.equal((await model.invoke('request')).value, 'answer');
  assert.equal((await checks([]).run({}, signal())).decision.kind, 'ready');
  assert.equal(typeof cjs.Support.createRequestRecovery, 'function');
});

test('a hanging completion handler cannot prevent cancellation', async () => {
  const controller = new AbortController();
  const checks = defineCompletionChecks([{ id: 'blocked', required: false, check: () => new Promise(() => {}) }]);
  const pending = checks.run({}, controller.signal);
  controller.abort(new Error('stop now'));
  await assert.rejects(pending, /stop now/);
});


test('initial allowance getters are read once and fallback cannot hide asynchronous model work', async () => {
  let reads = 0;
  const model = new ModelRunner({ provider, get maxCalls() { reads++; return reads === 1 ? 2 : 0; }, execution: { signal: signal() } });
  assert.equal(reads, 1);
  assert.equal(model.callBudget.ceiling, 2);
  const run = Support.createRequestRecovery({ async execute() { throw new Error('failed'); }, async fallback() { return 'not local'; } });
  await assert.rejects(run({}, signal()), /synchronous/);
});


test('completion declarations preserve inherited metadata and private method receivers', async () => {
  class Check {
    #text = 'ready';
    get id() { return 'inherited'; }
    get required() { return true; }
    check() { return { kind: this.#text }; }
  }
  const result = await defineCompletionChecks([new Check()]).run({}, signal());
  assert.equal(result.decision.kind, 'ready');
  assert.equal(result.observations[0].id, 'inherited');
});

test('budget assessment respects protected inputs and rejects impossible accounting', () => {
  assert.equal(assessment({ contextPressure: true }).action, 'replan');
  assert.equal(assessment({ contextPressure: true, alternativesExhausted: true }).action, 'partial');
  assert.equal(assessment({ work: { execution: 0, review: 0, delivery: 1, recovery: 0 } }).action, 'continue');
  assert.throws(() => assessment({ budget: { used: 2, limit: 2, ceiling: 2, remaining: 1 } }), /Invalid request budget accounting/);
});

test('recovery reports an ordinary completed result and a separate successful recovery', async () => {
  const initial = { input: 'one' };
  const direct = Support.createRequestRecovery({
    async execute(value) { assert.equal(value, initial); return 'completed'; },
    fallback() { assert.fail('successful work used fallback'); },
  });
  assert.deepEqual(await direct(initial, signal()), { source: 'execution', value: 'completed', errors: [] });
  const reason = Error('provider unavailable');
  const recovered = Support.createRequestRecovery({
    async execute() { throw reason; },
    async recover(value, error) { assert.equal(value, initial); assert.equal(error, reason); return 'from evidence'; },
    fallback() { assert.fail('successful recovery used fallback'); },
  });
  assert.deepEqual(await recovered(initial, signal()), { source: 'recovery', value: 'from evidence', errors: [reason] });
});

test('completion policy rejects invalid configuration and malformed required decisions', async () => {
  const base = { id: 'content', required: true, check: () => ({ kind: 'ready' }) };
  assert.throws(() => defineCompletionChecks([base, base]), /unique IDs/);
  assert.throws(() => defineCompletionChecks([{ ...base, required: 'true' }]), /explicit required flags/);
  const invalid = defineCompletionChecks([{ ...base, check: () => ({ kind: 'repair', target: 'unknown', reason: 'fix' }) }]);
  await assert.rejects(invalid.run({}, signal()), /Invalid completion decision/);
});

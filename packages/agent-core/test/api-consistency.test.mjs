/*
 * Cross-cutting API contract for `AgentCoreEngine`, `ModelRunner` and the
 * `Support` helpers: how dependencies are bound, forked and inherited.
 *
 * These cases guard consistency between call sites rather than the behaviour of
 * a single module: a tool runtime binds once and with one receiver, a fork must
 * re-supply tools explicitly instead of silently losing them, conditional
 * routes accept the same dot paths everywhere, and child models start from a
 * clean transport set. All runs are in-process against `dist/esm`, with inline
 * fake runtimes and providers instead of real transports.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentCoreEngine, defineWorkflow, route, ModelRunner, Support } from '../dist/esm/index.js';

const workflow = defineWorkflow({
  id: 'bound-tools',
  nodes: [
    {
      id: 'lookup',
      description: 'Look up',
      async run(_, { tools }) {
        return { answer: (await tools.invoke({ toolId: 'read', input: {} })).value };
      },
      routes: [route.deliver('answer')],
    },
  ],
});
class Runtime {
  #answer = 'ready';
  async invoke() {
    return { value: this.#answer, invocation: {} };
  }
}

test('tools bind at construction or later with the same receiver and one-time semantics', async () => {
  for (const agent of [
    new AgentCoreEngine({ workflow, tools: new Runtime() }),
    new AgentCoreEngine({ workflow }).bindToolRuntime(new Runtime()),
  ]) {
    assert.equal(await agent.run({}), 'ready');
    assert.throws(() => agent.bindToolRuntime(new Runtime()), /already/);
  }
  for (const tools of [null, {}, { invoke: true }, { invokeAsync: false }]) {
    assert.throws(() => new AgentCoreEngine({ tools }), /invoke method/);
  }
});

test('fork requires explicit restoration of goals instead of silently dropping them', async () => {
  const parent = new AgentCoreEngine({ workflow, tools: new Runtime() });
  const at = parent.checkpoint({});
  // Dropping tools on fork would make the child fail later, far from the cause;
  // the fork must demand an explicit restoration callback up front.
  assert.throws(() => parent.fork({ at }), /restored tool runtime/);
  const child = parent.fork({ at, resume: () => ({ tools: new Runtime() }) });
  assert.equal(await child.run(at.read()), 'ready');
  assert.equal(child.branch.parentBranchId, parent.branch.branchId);
});

test('conditional field routes share dot paths, including numeric array segments', () => {
  // Numeric segments address array items, so `0` must mean "first element"
  // rather than an object key, and a non-array value must fail the predicate.
  const filled = { groups: [{ items: [0], error: null }] };
  const exists = route.toIfDefined('failure', 'groups.0.error');
  const error = route.toIfError('failure', { errorKey: 'groups.0.error' });
  const nonempty = route.toIfNotEmpty('candidate', 'groups.0.items');
  assert.equal(exists.when(filled), true);
  assert.equal(error.when(filled), true);
  assert.equal(nonempty.when(filled), true);
  for (const state of [{}, { groups: [] }, { groups: [{}] }, { groups: [{ items: [] }] }]) {
    assert.equal(exists.when(state), false);
    assert.equal(error.when(state), false);
    assert.equal(nonempty.when(state), false);
  }
  assert.equal(nonempty.when({ groups: [{ items: 'not-an-array' }] }), false);
});

test('child model omits transports without inheriting the parent custom transport', async () => {
  const provider = {
    async *stream() {
      yield 'done';
    },
  };
  const parent = new ModelRunner({ execution: {},
    provider,
    maxCalls: 3,
    transports: [Support.createTextTransport({ id: 'parent-only' })],
  });
  // A child starts from the base transport set: inheriting a parent's custom
  // transport would silently widen the child's network surface.
  const child = parent.createChild({ id: 'child', maxCalls: 1, reserveCalls: 1, timeoutMs: 1000 });
  assert.equal((await child.invoke('hello')).value, 'done');
  await assert.rejects(child.invoke({ input: 'hello', transport: 'parent-only' }));
  // The one successful child call is reflected in the parent total; the rejected
  // transport lookup never reaches the provider and adds nothing.
  assert.equal(parent.totalCallCount, 1);
});

test('capability catalogs expose one canonical definition list', () => {
  const catalog = Support.defineCapabilityCatalog([{ id: 'read', description: 'Read', tools: [] }]);
  assert.equal(catalog.definitions[0], catalog.require('read'));
  assert.equal('modules' in catalog, false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentCoreEngine, defineWorkflow } from '@jangts/agent-core';

const signal = () => new AbortController().signal;
const flow = (run) => defineWorkflow({ id: 'cache', nodes: [
  { id: 'a', description: 'a', run, routes: [{ targetNodeId: 'b' }] },
  { id: 'b', description: 'b', run: (state, ctx) => {
    assert.equal(ctx.cache.has('key'), false);
    assert.equal(ctx.cache.get('key', { nodeId: 'a' }), state.value);
    ctx.cache.set('key', 'b');
    ctx.cache.clear();
    assert.equal(ctx.cache.get('key', { nodeId: 'a' }), state.value);
  }, routes: [{ complete: (state) => state.value }] },
] });

test('Engine memory spans runs; namespaces, undefined values, clear and fork remain distinct', async () => {
  let count = 0;
  const workflow = flow((state, ctx) => {
    assert.equal(ctx.cache.get('visits') ?? 0, count++);
    ctx.cache.set('visits', count);
    ctx.cache.set('undefined', undefined);
    assert.equal(ctx.cache.has('undefined'), true);
    ctx.cache.set('key', state.value);
    assert.equal(ctx.agentCache, undefined);
  });
  const engine = new AgentCoreEngine({ workflow });
  await engine.run({ value: 'first' });
  await engine.run({ value: 'second' });
  count = 0;
  const fork = engine.fork({ at: engine.checkpoint({}) });
  await fork.run({ value: 'fork' });
  assert.equal(count, 1);
  assert.throws(() => new AgentCoreEngine({ cache: { maxEntries: 0 } }), /bounds/);
});

test('LRU capacity and write TTL are enforced without background work', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 100 });
  const engine = new AgentCoreEngine({ cache: { maxEntries: 2, ttlMs: 20 } });
  await engine.run((_, { cache }) => {
    cache.set('a', 1); cache.set('b', 2); cache.get('a'); cache.set('c', 3);
    assert.equal(cache.has('b'), false);
    assert.equal(cache.delete('absent'), false);
    t.mock.timers.tick(20);
    assert.equal(cache.has('a'), false);
    assert.equal(cache.get('c'), undefined);
    return { type: 'complete', value: true };
  });
});

function storage() {
  const values = new Map();
  const id = (a) => JSON.stringify([a.persistence, a.nodeId, a.key]);
  return {
    supportsPersistence: true,
    async get(a) { return values.get(id(a)); },
    async has(a) { return values.has(id(a)); },
    async set(a, v) { values.set(id(a), v); },
    async delete(a) { return values.delete(id(a)); },
    async clear(a) {
      for (const key of values.keys()) {
        const [persistent, node] = JSON.parse(key);
        if (persistent === a.persistence && node === a.nodeId) values.delete(key);
      }
    },
  };
}

test('App port spans Engines, keeps persistence spaces separate and binds private receiver', async () => {
  const port = storage();
  const visit = async (stage) => {
    const engine = new AgentCoreEngine({ agentCache: port });
    return engine.run(async (_, { agentCache, cache }) => {
      assert.equal(cache.has('key'), false);
      if (stage === 0) {
        await agentCache.set('key', 'volatile');
        await agentCache.set('key', 'persistent', { persistence: true });
        await assert.rejects(agentCache.set('x', 'bad', { nodeId: 'other' }), /options/);
      } else {
        assert.equal(await agentCache.get('key'), 'volatile');
        assert.equal(await agentCache.get('key', { persistence: true }), 'persistent');
        await agentCache.clear();
        assert.equal(await agentCache.has('key'), false);
        assert.equal(await agentCache.has('key', { persistence: true }), true);
        assert.equal(await agentCache.delete('key', { persistence: true }), true);
      }
      return { type: 'complete', value: stage };
    });
  };
  await visit(0); await visit(1);
  const unsupported = { ...storage(), supportsPersistence: false };
  await new AgentCoreEngine({ agentCache: unsupported }).run(async (_, { agentCache }) => {
    await assert.rejects(agentCache.get('x', { persistence: true }), /unsupported/);
    return { type: 'complete', value: true };
  });
});

test('concurrent nodes capture their own partitions and cancellation stops late read acceptance', async () => {
  const port = storage();
  let started;
  const ready = new Promise((resolve) => { started = resolve; });
  let finish;
  const delayed = { ...port, get: async () => { started(); return new Promise((resolve) => { finish = resolve; }); } };
  const controller = new AbortController();
  const pending = new AgentCoreEngine({ agentCache: delayed, execution: { signal: controller.signal } })
    .run(async (_, { agentCache }) => ({ type: 'complete', value: await agentCache.get('key') }));
  await ready; controller.abort(new Error('stop read')); finish('late');
  await assert.rejects(pending, /stop read/);
  const names = ['one', 'two'];
  await Promise.all(names.map((id) => new AgentCoreEngine({ agentCache: port, workflow: defineWorkflow({ id, nodes: [{
    id, description: id, async run(_, { agentCache }) {
      await agentCache.set('key', id);
      await Promise.resolve();
      assert.equal(await agentCache.get('key'), id);
    }, routes: [{ complete: () => id }],
  }] }) }).run({})));
});

test('a write prunes expired entries before LRU eviction and rejects empty keys', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 0 });
  const agent = new AgentCoreEngine({ cache: { ttlMs: 10, maxEntries: 2 } });
  await agent.run((_, { cache }) => {
    cache.set('expired', 1);
    t.mock.timers.tick(5);
    cache.set('current', 2);
    assert.equal(cache.get('expired'), 1);
    t.mock.timers.tick(5);
    cache.set('new', 3);
    assert.equal(cache.get('expired'), undefined);
    assert.equal(cache.get('current'), 2);
    assert.equal(cache.get('new'), 3);
    assert.throws(() => cache.set('', 4), /nonempty strings/);
    return { type: 'complete', value: true };
  });
});

test('Agent cache rejects missing handlers, invalid partitions and unexpected port results', async () => {
  assert.throws(() => new AgentCoreEngine({ agentCache: { get() {} } }), /Invalid Agent cache port/);
  const invalid = {
    ...storage(),
    has: () => 1, set: () => true, delete: () => 0, clear: () => true,
  };
  await new AgentCoreEngine({ agentCache: invalid }).run(async (_, { agentCache }) => {
    await assert.rejects(agentCache.get('key', { persistence: 'yes' }), /Invalid cache persistence/);
    await assert.rejects(agentCache.has('key'), /has must return boolean/);
    await assert.rejects(agentCache.set('key', 1), /set must return void/);
    await assert.rejects(agentCache.delete('key'), /delete must return boolean/);
    await assert.rejects(agentCache.clear(), /clear must return void/);
    return { type: 'complete', value: true };
  });
});

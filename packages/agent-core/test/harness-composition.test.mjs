import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AgentCoreEngine, ModelRunner, createDiagnostics, defineWorkflow, route } from '../dist/esm/index.js';
import { runMinimal, runComposition, createComposition } from '../development/examples/harness-composition.mjs';

test('public offline composition exports preserve the R0/R1 probe', async () => {
  assert.equal(await runMinimal(), 'hello');
  const result = await runComposition();
  assert.equal(result.allowed.totalCalls, 4);
  assert.equal(result.allowed.saves, 1);
  assert.equal(result.denied.saves, 0);
});

test('a shared request observer receives each native parent/child fact once', async () => {
  const facts = [];
  const app = createComposition({
    observe: {
      accepts: ({ content }) => content === 'metadata',
      event(fact) { facts.push(fact); },
    },
  });
  await app.parent.run({});
  assert.equal(facts.filter(fact => fact.type === 'model.start').length, 4);
  assert.equal(facts.filter(fact => fact.type === 'tool.call').length, 1);
  assert.equal(new Set(facts.map(fact => fact.eventId)).size, facts.length);
  assert.equal(new Set(facts.map(fact => fact.runId)).size, 1);
  const childCalls = facts.filter(fact => fact.type === 'model.start' && fact.workflowNodeId === 'decide');
  assert.equal(childCalls.length, 2);
  assert.ok(childCalls.every(fact => fact.parentSpanId && fact.spanId.startsWith(fact.parentSpanId + '/')));
});

test('observer identity preserves private receivers and the first subscribed method snapshot', async () => {
  class Observer {
    #facts = [];
    event(fact) { this.#facts.push(fact); }
    get facts() { return this.#facts; }
  }
  const observer = new Observer();
  const execution = { signal: new AbortController().signal, observe: observer };
  const runner = new ModelRunner({ provider: { async *stream() { yield 'ok'; } }, execution, maxCalls: 1 });
  let laterCalls = 0;
  observer.event = () => { laterCalls++; };
  const workflow = defineWorkflow({ id: 'observer-snapshot', nodes: [{
    id: 'reply', description: 'Invoke the already bound model',
    async run(_state, context) { return { answer: (await context.model.invoke({ input: 'hello' })).value }; },
    routes: [route.deliver('answer')],
  }] });
  const engine = new AgentCoreEngine({ execution }).bindWorkflow(workflow).bindModelRuntime(runner);
  assert.equal(await engine.run({}), 'ok');
  assert.equal(observer.facts.filter(fact => fact.type === 'model.start').length, 1);
  assert.equal(laterCalls, 0);
});

test('distinct observers sharing a callback remain distinct subscriptions', () => {
  function event() { this.calls++; }
  const first = { calls: 0, event }, second = { calls: 0, event };
  const scope = createDiagnostics({ observe: first }).withObserver(second).withObserver(first);
  scope.emit('loop.event', () => ({ eventId: 'one-fact', type: 'enter', roundIndex: 0 }));
  assert.equal(first.calls, 1);
  assert.equal(second.calls, 1);
});

test('diagnostic construction snapshots an observer getter once before subscribing', () => {
  let reads = 0, calls = 0;
  const observer = { event() { calls++; } };
  const scope = createDiagnostics({
    get observe() {
      reads++;
      return reads === 1 ? observer : undefined;
    },
  });
  scope.emit('loop.event', () => ({ eventId: 'getter-fact', type: 'enter', roundIndex: 0 }));
  assert.equal(reads, 1);
  assert.equal(calls, 1);
});

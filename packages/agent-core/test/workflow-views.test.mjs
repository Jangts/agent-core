import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as esm from '../dist/esm/index.js';
const require = createRequire(import.meta.url);
for (const [format, api] of [['esm', esm], ['cjs', require('../dist/cjs/index.js')]]) {
  const workflow = (extra = {}) => api.defineWorkflow({ id: 'w', nodes: [
    { id: 'a', description: 'A', routes: [{ id: 'first', when: () => true, targetNodeId: 'b' }, { id: 'second', targetNodeId: 'b' }], onErrorNodeId: 'b', onErrorRouteId: 'recover' },
    { id: 'b', description: 'B', routes: [{ complete: () => 'done' }] },
  ], ...extra });
  const event = (sequence, span, node, type, extra = {}, envelope = {}) => ({
    version: 2, eventId: `e${sequence}`, producerSequence: sequence, occurredAtMs: sequence,
    type: 'workflow.event', runId: 'r', spanId: span, nodeId: node, nodeRole: 'workflow-node', definitionId: 'w', workflowInvocationId: 'i',
    payload: { event: { eventId: `e${sequence}`, workflowId: 'w', workflowInvocationId: 'i', nodeId: node, roundIndex: 0, type, ...extra } }, ...envelope,
  });
  const source = events => async () => ({ events, coverage: { complete: true, content: 'included', issues: [] } });
  test(`${format}: snapshot routes once, collapse edges and preserve route identity`, () => {
    let reads = 0, calls = 0;
    const w = workflow({ nodes: [
      { id: 'a', description: 'A', get routes() { reads++; return [{ when() { calls++; return true; }, targetNodeId: 'b' }, { targetNodeId: 'b' }]; }, onErrorNodeId: 'b' },
      { id: 'b', description: 'B', routes: [{ complete: () => 'done' }] },
    ] });
    const graph = w.toGraph();
    assert.equal(reads, 1); assert.equal(calls, 0);
    assert.equal(graph.edges.length, 3);
    assert.deepEqual(graph.edges[0].routeOrders, [0, 1]);
    assert.equal(graph.nodes[1].incomingEdgeIds.length, 2);
    assert.equal(graph.nodes[0].routes[0].edgeId, graph.nodes[0].routes[1].edgeId);
    assert.equal(graph.edges[2].targetNodeId, undefined);
    assert.throws(() => graph.nodes.push({}));
    assert.deepEqual(JSON.parse(JSON.stringify(graph)).nodes[0].requires, []);
  });
  test(`${format}: historical visits, recovery, repeated nodes, explicit handoffs and raw fixes`, async () => {
    const steps = [
      { origin: 'reported', stepId: 's1', name: 'own process', kind: 'custom', type: 'custom.type', sequence: 1, revision: 1, createdAtMs: 2, operation: 'write', status: 'running' },
      { origin: 'reported', stepId: 's2', name: 'own process', kind: 'custom', type: 'custom.type', sequence: 2, revision: 2, createdAtMs: 3, operation: 'fix', targetStepId: 's1', status: 'success' },
    ];
    const events = [event(1, 'v1', 'old-node', 'enter'), event(2, 'v1', 'old-node', 'error', { errorCode: 'BROKEN' }),
      event(3, 'v1', 'old-node', 'transition', { targetNodeId: 'a', targetSpanId: 'v2', errorEventId: 'e2' }, { subSteps: steps }),
      event(4, 'v2', 'a', 'enter'), event(5, 'v2', 'a', 'complete')];
    const w = workflow({ chainSource: source(events.toReversed().concat(events[2])) });
    const chain = await w.toChain('r');
    assert.deepEqual(chain.nodes.map(n => n.nodeId), ['old-node', 'a']);
    assert.equal(chain.nodes[0].status, 'error');
    assert.equal(chain.nodes[0].name, undefined);
    assert.deepEqual(chain.nodes[0].subflow.map(s => s.stepId), ['s1', 's2']);
    assert.equal(chain.nodes[0].subflow[0].subnodeId, undefined);
    assert.equal(chain.nodes[0].subflow[0].producerSequence, undefined);
    assert.equal(chain.transitions[0].targetSpanId, 'v2');
    assert.equal(chain.coverage.complete, true);
    assert.equal(chain.nodes[0].subflow[0].status, 'running');
    assert.throws(() => chain.nodes[0].subflow.pop());
    assert.equal((await w.add({nodes: []}).toChain('r')).nodes.length, 2);
  });
  test(`${format}: error handoffs use explicit recovery targets without inventing adjacency`, async () => {
    const chain = await workflow().toChain('r', source([
      event(1, 'v1', 'a', 'enter'),
      event(2, 'v1', 'a', 'error', { targetNodeId: 'b', targetSpanId: 'v2', routeId: 'recovery', errorCode: 'BROKEN' }),
      event(3, 'v2', 'b', 'enter', { errorEventId: 'e2' }),
      event(4, 'v2', 'b', 'complete'),
    ]));
    assert.equal(chain.transitions.length, 2);
    assert.equal(chain.transitions[0].errorEventId, 'e2');
    assert.equal(chain.transitions[0].eventId, 'e2');
    assert.equal(chain.transitions[0].targetSpanId, 'v2');
    assert.equal(chain.nodes[0].status, 'error');
    assert.equal(chain.coverage.complete, true);
  });
  test(`${format}: live vs missing exits, missing entry and reader failures remain visible`, async () => {
    await assert.rejects(workflow().toChain('r'), /chainSource/);
    await assert.rejects(workflow().toChain('r', async () => { throw Error('denied'); }), /denied/);
    await assert.rejects(workflow().toChain('r', source([])), /No captured/);
    const chain = await workflow().toChain('r', source([event(1,'a1','a','enter'), event(2,'a2','a','complete')]));
    assert.equal(chain.nodes.length, 2);
    assert.equal(chain.nodes[0].status, 'unknown');
    assert.equal(chain.coverage.complete, false);
    assert.deepEqual(chain.coverage.issues.map(i => i.code), ['missing-exit', 'missing-enter']);
    const live = await workflow().toChain('r', async () => ({ events: [event(1,'a','a','enter')], coverage: { complete: false, content: 'omitted', issues: [] } }));
    assert.equal(live.nodes[0].status, 'running');
  });
  test(`${format}: progress snapshots deduplicate records and preserve emission provenance`, async () => {
    const step = { origin: 'reported', stepId:'s',name:'task',kind:'custom',sequence:1,operation:'write',createdAtMs:2,revision:1,subnodeId:'custom' };
    const progress = { ...event(2,'v','a','enter'), type:'node.progress',subSteps:[step],payload:{subStep:{stepId:'s',sequence:1,operation:'write',revision:1,createdAtMs:2,status:'running'}} };
    const chain = await workflow().toChain('r', source([event(1,'v','a','enter'),progress,event(3,'v','a','complete',{}, {subSteps:[step]})]));
    assert.equal(chain.nodes[0].subflow.length,1);
    assert.equal(chain.nodes[0].subflow[0].sourceEventId,'e2');
    assert.equal(chain.nodes[0].events.length,2);
    assert.equal(chain.coverage.complete,true);
  });
  test(`${format}: malformed workflow facts are isolated from a valid visit`, async () => {
    const malformed = [
      event(2, 'invalid', 'a', 'complete', {}, { payload: null }),
      event(3, 'invalid', 'a', 'complete', { route: -1 }),
      event(4, 'invalid', 'a', 'complete', { durationMs: -1 }),
      event(5, 'invalid', 'a', 'complete', { spanId: 'elsewhere' }),
      event(6, 'invalid', 'a', 'complete', { runId: 'elsewhere' }),
    ];
    const entry = event(1, 'v', 'a', 'enter', {}, { workflowInvocationId: undefined });
    const chain = await workflow().toChain('r', source([
      entry,
      ...malformed,
      event(7, 'foreign', 'a', 'enter', { workflowId: 'foreign' }, { definitionId: 'foreign' }),
      event(8, 'no-node', undefined, 'enter'),
      event(9, 'v', 'b', 'enter'),
      { ...entry, occurredAtMs: 10 },
      event(11, 'v', 'a', 'error', { errorCode: 'TIMEOUT' }, { workflowInvocationId: undefined }),
    ]));
    assert.equal(chain.nodes.length, 1);
    assert.equal(chain.nodes[0].workflowInvocationId, 'i');
    assert.equal(chain.nodes[0].status, 'cancelled');
    assert.deepEqual(chain.nodes[0].events.map(x => x.eventId), ['e1', 'e11']);
    assert.deepEqual(chain.coverage.issues, [
      { code: 'conflicting-event', spanId: 'v', eventId: 'e1' },
      ...malformed.map(({spanId,eventId}) => ({code:'invalid-workflow-event',spanId,eventId})),
      { code: 'missing-node-id', spanId: 'no-node', eventId: 'e8' },
      { code: 'conflicting-span', spanId: 'v', eventId: 'e9' },
    ]);
  });
  test(`${format}: standalone progress, truncated ledgers and absent targets retain their evidence`, async () => {
    const step = { stepId: 'partial', sequence: 2, operation: 'write', revision: 1, createdAtMs: 2, status: 'running' };
    const historical = { origin: 'reported', stepId: 'old', name: 'task', kind: 'custom', sequence: 1 };
    const chain = await workflow().toChain('r', source([
      event(1, 'v', 'a', 'enter', {}, { subSteps: [historical] }),
      event(2, 'v', 'a', 'enter', {}, { type: 'node.progress', payload: { subStep: step }, usedModel: true }),
      event(3, 'v', 'a', 'enter', {}, { type: 'node.progress', payload: { payload: 'working' }, subStepsDropped: 1 }),
      event(4, 'v', 'a', 'transition', { targetSpanId: 'absent', targetNodeId: 'b', route: 0, durationMs: 4 }, {
        subSteps: [{ ...historical, name: 'different record' }],
      }),
      event(5, 'v', 'a', 'enter', {}, { type: 'model.start', payload: {} }),
    ]));
    assert.equal(chain.nodes[0].usedModel, true);
    assert.deepEqual(chain.nodes[0].subflow.map(({stepId}) => stepId), ['old', 'partial']);
    assert.equal(chain.nodes[0].subflow[0].name, 'task');
    assert.equal(chain.nodes[0].subflow[1].sourceEventId, 'e2');
    assert.equal(chain.nodes[0].events[1].type, 'progress');
    assert.equal(chain.nodes[0].events[1].payload, 'working');
    assert.deepEqual(chain.coverage.issues.map(i => i.code), [
      'subflow-truncated', 'conflicting-subflow', 'historical-subflow-fields', 'missing-target-enter',
    ]);
    await assert.rejects(workflow().toChain(' ', source([])), /runId is required/);
  });
}

/** Offline examples exercising an authorized lookup and its recovery path through the same graph. */
import assert from 'node:assert/strict';
import { AgentCoreEngine, Support, defineWorkflow } from '@jangts/agent-core';

const tools = Support.defineToolCatalog([
  {
    id: 'lookup',
    kind: 'read',
    description: 'Read status from the fixture',
    inputSchema: { jsonSchema: { type: 'object' }, parse: (value) => value },
    authorize(_input, { app }) {
      if (!app.allowed) throw new Error('Lookup denied');
    },
    execute: () => ({ status: 'ready' }),
    parseOutput: (value) => value,
  },
]);

const workflow = defineWorkflow({
  id: 'offline-status',
  nodes: [
    {
      id: 'read',
      description: 'Look up status',
      startsRound: true,
      onErrorNodeId: 'denied',
      routes: [{ id: 'answer-from-status', targetNodeId: 'answer' }],
      async run(_state, { tools }) {
        const { value } = await tools.invoke({ toolId: 'lookup', input: {} });
        return { value };
      },
    },
    {
      id: 'answer',
      description: 'Format the result',
      async run(state, { model }) {
        const { value } = await model.invoke({ input: 'Describe status ' + state.value.status });
        return { answer: value };
      },
      routes: [{ complete: ({ answer, value }) => ({ answer, ...value }) }],
    },
    {
      id: 'denied',
      description: 'Report that the lookup was denied',
      routes: [{ complete: () => ({ status: 'denied' }) }],
    },
  ],
});

export const inspection = {
  workflow,
  toolCatalog: tools,
  nodeCapabilities: [{ nodeId: 'read', tools: [{ toolId: tools.require('lookup').id }] }],
};

function setup(allowed) {
  return ({ execution, provider }) => ({
    agent: new AgentCoreEngine({
      workflow,
      execution,
      model: { provider, maxCalls: 1 },
    }).bindToolRuntime(tools.bind({ app: { allowed } })),
    state: {},
  });
}
const visits = (events) =>
  events.filter(({ type }) => type === 'enter').map(({ nodeId }) => nodeId);

export const scenarios = [
  {
    id: 'authorized',
    replies: ['The service is ready.'],
    setup: setup(true),
    verify({ result, events, modelCalls }) {
      assert.deepEqual(result, { answer: 'The service is ready.', status: 'ready' });
      assert.equal(modelCalls, 1);
      assert.deepEqual(visits(events), ['read', 'answer']);
      assert.ok(events.some(({ routeId }) => routeId === 'answer-from-status'));
    },
  },
  {
    id: 'denied',
    setup: setup(false),
    verify({ result, events, modelCalls }) {
      assert.deepEqual(result, { status: 'denied' });
      assert.equal(modelCalls, 0);
      assert.deepEqual(visits(events), ['read', 'denied']);
      assert.ok(
        events.some(({ type, targetNodeId }) => type === 'error' && targetNodeId === 'denied'),
      );
    },
  },
];

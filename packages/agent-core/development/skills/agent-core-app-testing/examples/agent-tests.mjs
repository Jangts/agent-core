/** Runnable, business-neutral examples of feature, node, and tool test registration. */
import assert from 'node:assert/strict';
import { AgentCoreEngine, Support, defineWorkflow, route } from '@jangts/agent-core';
import { scenarios } from '../../../examples/workflow-scenarios.mjs';

const countNode = {
  id: 'count',
  description: 'Count inputs and choose the delivery path',
  run: ({ inputs }) => ({ count: inputs.length }),
  routes: [
    { id: 'non-empty', when: ({ count }) => count > 0, targetNodeId: 'deliver-count' },
    { id: 'empty', targetNodeId: 'deliver-empty' },
  ],
};
const countWorkflow = defineWorkflow({
  id: 'count-node-test',
  nodes: [
    countNode,
    { id: 'deliver-count', description: 'Return the count', routes: [route.deliver('count')] },
    {
      id: 'deliver-empty',
      description: 'Return the empty result',
      routes: [{ complete: () => 0 }],
    },
  ],
});

/** Run the same registered node through either route and assert the resulting state and trace. */
function countCase(id, inputs, expectedRoute) {
  return {
    id,
    layer: 'node',
    run({ runScenario }) {
      const state = { inputs };
      return runScenario({
        setup: ({ execution }) => ({
          agent: new AgentCoreEngine({ workflow: countWorkflow, execution }),
          state,
        }),
        verify({ result, events, modelCalls }) {
          assert.equal(result, inputs.length);
          assert.equal(state.count, inputs.length);
          assert.equal(modelCalls, 0);
          assert.deepEqual(
            events.filter(({ type }) => type === 'transition').map(({ routeId }) => routeId),
            [expectedRoute],
          );
        },
      });
    },
  };
}

const catalog = Support.defineToolCatalog([
  {
    id: 'normalize-text',
    kind: 'pure',
    description: 'Normalize text using the supplied handler',
    inputSchema: {
      jsonSchema: {
        type: 'object',
        required: ['text'],
        properties: { text: { type: 'string' } },
      },
      parse(input) {
        if (typeof input?.text !== 'string') throw new TypeError('Expected text');
        return input.text.trim();
      },
    },
    authorize(_input, { app }) {
      if (!app.allowed) throw new Error('Access denied');
    },
    execute(value, { app }) {
      app.executed.push(value);
      return app.transform(value);
    },
    parseOutput(value) {
      if (typeof value !== 'string') throw new TypeError('Invalid tool output');
      return value;
    },
  },
]);
const toolId = 'normalize-text';

/** Bind the actual catalog using a fresh in-memory port for each Tool case. */
function bindTool(signal, { allowed = true, transform = (value) => value.toUpperCase() } = {}) {
  const executed = [];
  const binding = catalog.bind({ app: { allowed, transform, executed } });
  return { executed, invoke: (input) => binding.invoke({ toolId, input, signal }) };
}

export const agentTests = [
  ...scenarios.map((scenario) => ({
    id: scenario.id,
    layer: 'feature',
    run: ({ runScenario }) => runScenario(scenario),
  })),
  countCase('non-empty-input', ['a', 'b'], 'non-empty'),
  countCase('empty-input', [], 'empty'),
  {
    id: 'valid-tool-call',
    layer: 'tool',
    async run({ signal }) {
      const { invoke, executed } = bindTool(signal);
      const { value, invocation } = await invoke({ text: ' example ' });
      assert.equal(value, 'EXAMPLE');
      assert.ok(invocation.invocationId);
      assert.deepEqual(executed, ['example']);
    },
  },
  {
    id: 'invalid-tool-input',
    layer: 'tool',
    async run({ signal }) {
      const { invoke, executed } = bindTool(signal);
      await assert.rejects(invoke({ text: 42 }), /Expected text/);
      assert.deepEqual(executed, []);
    },
  },
  {
    id: 'denied-tool-call',
    layer: 'tool',
    async run({ signal }) {
      const { invoke, executed } = bindTool(signal, { allowed: false });
      await assert.rejects(invoke({ text: 'example' }), /Access denied/);
      assert.deepEqual(executed, []);
    },
  },
  {
    id: 'invalid-tool-output',
    layer: 'tool',
    async run({ signal }) {
      const { invoke, executed } = bindTool(signal, { transform: () => 42 });
      await assert.rejects(invoke({ text: 'example' }), /Invalid tool output/);
      assert.deepEqual(executed, ['example']);
    },
  },
];

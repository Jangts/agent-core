/**
 * Example: observe Core execution progress without replacing the workflow or result contract.
 *
 * Shows `execution.observe` receiving metadata, tool events and node progress.
 */
import assert from 'node:assert/strict';
import { AgentCoreEngine, ToolRegistry, defineWorkflow, route } from '@jangts/agent-core';

// Fixed definitions are reused; each run receives only this question's state.
const tools = new ToolRegistry().register({
  id: 'lookup',
  kind: 'read',
  parseInput: (value) => value,
  parseOutput: (value) => value,
  execute: () => ({ status: 'online', redundant: 'duplicate '.repeat(20) }),
});
const workflow = defineWorkflow({
  id: 'service-answer',
  nodes: [
    {
      id: 'decide',
      description: 'Ask the model which service to read',
      async run(state, { model }) {
        await model.invoke({ input: state.question });
      },
      routes: [route.to('lookup')],
    },
    {
      id: 'lookup',
      description: 'Read the real service result',
      async run(_, { tools }) {
        return { receipt: (await tools.invoke({ toolId: 'lookup', input: {} })).value };
      },
      routes: [route.to('compress')],
    },
    {
      id: 'compress',
      description: 'Remove known redundant data',
      run({ receipt }, context) {
        context.report({
          payload: { phase: 'reducing', beforeChars: JSON.stringify(receipt).length },
        });
        // This example owns a deterministic reduction. Core does not decide its policy.
        const reduced = { status: receipt.status };
        context.report({
          payload: { phase: 'reduced', afterChars: JSON.stringify(reduced).length },
        });
        return { receipt: reduced };
      },
      routes: [route.to('answer')],
    },
    {
      id: 'answer',
      description: 'Answer using the reduced result',
      async run({ receipt }, { model }) {
        return { answer: (await model.invoke({ input: JSON.stringify(receipt) })).value };
      },
      routes: [route.deliver('answer')],
    },
  ],
});
const provider = {
  async *stream(messages) {
    yield messages.at(-1).content.includes('online') ? '服务在线。' : 'lookup';
  },
};

// Minimal use; add observation without replacing Workflow, run or the result contract.
const basic = new AgentCoreEngine({ workflow, tools, model: { provider } });
assert.equal(await basic.run({ question: '服务状态？' }), '服务在线。');
const observed = new AgentCoreEngine({
  workflow,
  tools,
  model: { provider },
  execution: {
    observe: {
      accepts: ({ event, content }) => content === 'metadata' || event === 'node.progress',
      event(fact) {
        if (fact.type === 'model.start') console.log('请求模型', fact.workflowNodeId);
        if (fact.type === 'tool.call') console.log('工具开始', fact.payload.toolId);
        if (fact.type === 'tool.result') console.log('工具结束', fact.payload.status);
        if (fact.type === 'workflow.event' && fact.nodeId === 'compress')
          console.log('压缩节点', fact.payload.event.type);
        if (fact.type === 'node.progress') console.log('压缩进度', fact.payload.payload);
      },
    },
  },
});
assert.equal(await observed.run({ question: '服务状态？' }), '服务在线。');

/**
 * Example: a two-intent mini app with declared tools, tools, diagnostics and routes.
 *
 * Support supplies schemas and interaction; Core still owns traversal, state commits and completion.
 */
import { ModelToolRegistry, ToolRegistry, Support } from '@jangts/agent-core';
import { AgentCoreEngine, defineWorkflow, route } from '@jangts/agent-core/engine';
import { createDiagnostics } from '@jangts/agent-core/diagnostics';
import { responses } from '@jangts/agent-core/mock';
import { createMockProvider } from './mock-provider.mjs';

// Exactly two intents. Recognition is performed by the model protocol below;
// these fixed rules simulate its answers, not production semantic recognition.
const intents = [
  {
    id: 'greet',
    description: '打招呼，不调用工具',
    run: () => ({ answer: '你好！' }),
  },
  {
    id: 'status',
    description: '查询服务状态，调用 get_status 工具',
    async run(_state, { tools }) {
      const { value } = await tools.invoke({ toolId: 'get_status', input: {} });
      return { answer: value };
    },
  },
];
const emptyInput = Support.defineSchema({
  jsonSchema: { type: 'object', properties: {}, additionalProperties: false },
  parse(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length) {
      throw new TypeError('此意图不接受参数');
    }
    return value;
  },
});
const tools = new ModelToolRegistry(
  intents.map(({ id, description }) => ({
    id,
    description,
    inputSchema: emptyInput,
    resolve: () => id,
  })),
).seal();
const interaction = Support.createModelInteraction({ id: 'intent', tools });
const { provider, mock } = createMockProvider([
  {
    prompt: '你好',
    generator: responses.toolCalls([{ name: 'greet', arguments: {} }]),
  },
  {
    prompt: '服务状态怎么样？',
    generator: responses.toolCalls([{ name: 'status', arguments: {} }]),
  },
]);
const toolDefinitions = [
  {
    id: 'get_status',
    kind: 'read',
    description: '返回演示服务状态',
    parseInput: emptyInput.parse,
    execute: () => '服务运行正常',
    // Identity output parser: preserve the tool result without rewriting it.
    parseOutput: (value) => value,
  },
];

// App declares nodes and routes; Core owns traversal, state commits and completion.
const workflow = defineWorkflow({
  id: 'miniapp',
  entryNodeId: 'recognize',
  isResult: (value) => typeof value === 'string',
  nodes: [
    {
      id: 'recognize',
      description: '模型识别两个已登记意图',
      startsRound: true,
      provides: ['intentId'],
      async run(state, { model }) {
        const { value } = await model.invoke({
          input: state.input,
          stageId: 'recognize',
          interaction,
        });
        return { intentId: value };
      },
      routes: intents.map(({ id }) => route.toIfEqual(id, 'intentId', id)),
    },
    ...intents.map(({ id, description, run }) => ({
      id,
      description,
      run,
      requires: ['intentId'],
      provides: ['answer'],
      routes: [route.deliver('answer')],
    })),
  ],
});

async function ask(input) {
  // One diagnostic run per question; child spans link workflow/model/tool events.
  const diagnostics = createDiagnostics({
    output: {
      write(event) {
        console.log('[diagnostics]', JSON.stringify(event, null, 2));
      },
    },
  });
  const visited = [];
  const execution = {
    signal: new AbortController().signal,
    diagnostics,
    observe: {
      event(fact) {
        if (fact.type === 'workflow.event' && fact.payload.event.type === 'enter')
          visited.push(fact.nodeId);
      },
    },
  };
  const tools = new ToolRegistry({ execution }).registerAll(toolDefinitions).seal();
  const engine = new AgentCoreEngine({
    workflow,
    model: { provider, interactions: [interaction], maxCalls: 1 },
    maxRounds: 1,
    execution,
    tools,
  });
  const answer = await engine.run({ input });
  return { answer, toolCalls: tools.events.length, visited };
}

for (const input of ['你好', '服务状态怎么样？']) {
  const { answer, toolCalls, visited } = await ask(input);
  console.log(`${input} → ${answer}（工具调用 ${toolCalls} 次）`);
  console.log('Core 调度：', visited.join(' → '));
}
console.log('模型调用：', mock.records.length); // Two questions, two recognition calls.

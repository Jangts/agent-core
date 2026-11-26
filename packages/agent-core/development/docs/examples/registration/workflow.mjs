/** One runtime for both configuration styles; its Provider is a fixed offline fixture. */
import { AgentCoreEngine, Support, defineWorkflow, route } from '@jangts/agent-core';

const context = Support.defineContextFragments(
  [
    {
      id: 'task-policy',
      sourceId: 'tutorial',
      trust: 'instruction',
      lifetime: 'configuration',
      role: 'system',
      maxChars: 500,
      format: () => '按用户需求选择一个已提供的能力并提交参数。操作结果由程序返回。',
    },
    {
      id: 'tool-catalog',
      sourceId: 'tool-registry',
      trust: 'server',
      lifetime: 'step',
      role: 'user',
      maxChars: 6000,
      format: ({ tools }) => ({
        tools: [...tools.values()].map(({ id, description }) => ({ id, description })),
      }),
    },
    {
      id: 'question',
      sourceId: 'user-message',
      trust: 'user',
      lifetime: 'turn',
      role: 'user',
      maxChars: 1000,
      format: ({ question }) => ({ question }),
    },
  ],
  { maxInputChars: 8000 },
);

/** Stage policy selects candidates; association does not automatically submit every registration. */
export function taskTransport(tools, toolIds = ['search_notes', 'read_note']) {
  return Support.createStageModelInteraction({
    id: 'task',
    tools,
    stages: [{ id: 'choose-operation', toolIds }],
  });
}

const workflow = defineWorkflow({
  id: 'notes-request',
  nodes: [
    {
      id: 'decide',
      description: '组织上下文，让模型提出一次操作',
      async run(state, { model, app }) {
        const input = context.build({
          input: {
            question: state.question,
            tools: app.tools,
          },
        });
        const { value: proposal } = await model.invoke({
          stageId: 'choose-operation',
          interaction: 'task',
          input,
        });
        return { proposal };
      },
      routes: [route.to('execute')],
    },
    {
      id: 'execute',
      description: '经过工具合同执行提议，取得真实结果',
      async run(state, { tools }) {
        const { value: result } = await tools.invoke(state.proposal);
        return { result };
      },
      routes: [route.deliver('result')],
    },
  ],
});

/** The chosen reply is fixture input, not a language-understanding implementation. */
export async function runCase(configuration, question, proposedName, proposedInput) {
  const submitted = [];
  const provider = {
    async *stream(messages, { options }) {
      submitted.push({ messages, functions: options.functions });
      if (!options.functions.some((fn) => fn.name === proposedName)) {
        throw new Error('Fixture attempted an unavailable capability');
      }
      yield {
        type: 'function-call-delta',
        index: 0,
        id: 'offline-call',
        name: proposedName,
        arguments: JSON.stringify(proposedInput),
      };
    },
  };
  const agent = new AgentCoreEngine({
    workflow,
    app: { tools: configuration.tools },
    tools: configuration.execution.bind({ app: {} }),
    model: {
      provider,
      interactions: [taskTransport(configuration.tools, configuration.candidateIds)],
      maxCalls: 1,
    },
  });
  return { result: await agent.run({ question }), submitted };
}

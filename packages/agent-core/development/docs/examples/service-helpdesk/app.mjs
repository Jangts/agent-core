/** Read-only service status example. Importing this file registers definitions without running them. */
import { pathToFileURL } from 'node:url';
import { AgentCoreEngine, Support, defineWorkflow, route } from '@jangts/agent-core';

export const tools = Support.defineToolCatalog([
  {
    id: 'read_status',
    kind: 'read',
    description: 'Read the latest authorized service status',
    inputSchema: Support.defineSchema({
      jsonSchema: {
        type: 'object',
        properties: { service: { type: 'string' } },
        required: ['service'],
        additionalProperties: false,
      },
      parse(value) {
        if (
          !value ||
          typeof value.service !== 'string' ||
          !value.service.trim() ||
          Object.keys(value).length !== 1
        )
          throw new TypeError('Expected one nonempty service name');
        return { service: value.service.trim() };
      },
    }),
    async authorize({ service }, { app, signal }) {
      if (!(await app.mayRead(service, signal))) throw new Error('Status access denied');
    },
    async execute({ service }, { app, signal }) {
      return app.readStatus(service, signal);
    },
    parseOutput(value) {
      if (
        !['online', 'offline'].includes(value?.status) ||
        typeof value.observedAt !== 'string' ||
        !Number.isFinite(Date.parse(value.observedAt)) ||
        typeof value.source !== 'string' ||
        !value.source.trim()
      )
        throw new TypeError('Expected status, observation time, and source');
      const { status, observedAt, source } = value;
      return { status, observedAt, source };
    },
  },
]);

const replyContext = Support.defineContextFragments(
  [
    {
      id: 'rules',
      sourceId: 'helpdesk.explanation',
      trust: 'instruction',
      lifetime: 'configuration',
      role: 'system',
      maxChars: 350,
      format: () =>
        'Explain the observed status. Use only the supplied facts. Do not invent a cause.',
    },
    {
      id: 'question',
      sourceId: 'helpdesk.request',
      trust: 'user',
      lifetime: 'turn',
      role: 'user',
      maxChars: 1000,
      format: ({ question }) => ({ question }),
    },
    {
      id: 'status',
      sourceId: 'helpdesk.read-status',
      trust: 'tool',
      lifetime: 'step',
      role: 'user',
      maxChars: 600,
      format: ({ receipt }) => ({ statusReceipt: receipt }),
    },
  ],
  { maxInputChars: 2000 },
);

export const statusNode = {
  id: 'deliver-status',
  description: 'Deliver the confirmed fields without a model call',
  run({ receipt }) {
    return { result: { ...receipt, answer: `Service status: ${receipt.status}.` } };
  },
  routes: [route.deliver('result')],
};

const workflow = defineWorkflow({
  id: 'service-helpdesk',
  nodes: [
    {
      id: 'lookup',
      description: 'Read a service status under the request identity',
      onErrorNodeId: 'unavailable',
      async run({ service }, { tools: runtime }) {
        const { value } = await runtime.invoke({ toolId: 'read_status', input: { service } });
        return { receipt: value };
      },
      routes: [
        {
          id: 'explain-requested',
          when: (state) => state.explain === true,
          targetNodeId: 'explain',
        },
        route.to('deliver-status'),
      ],
    },
    {
      id: 'explain',
      description: 'Explain the retained receipt using one bounded model call',
      onErrorNodeId: 'deliver-status',
      async run({ question, receipt }, { model }) {
        const input = replyContext.build({ input: { question, receipt } });
        const replyGuidance = Support.resolveReplyGuidance({
          defaults: { defaultDetail: 'brief' },
        });
        const prepared = model.prepare({ stageId: 'explain', maxOutputTokens: 180, replyGuidance });
        const { value } = await model.invoke({ input, prepared });
        const answer = value.trim();
        if (!answer || answer.length > 200) throw new Error('Explanation format rejected');
        return { result: { ...receipt, answer } };
      },
      routes: [route.deliver('result')],
    },
    statusNode,
    {
      id: 'unavailable',
      description: 'Return an unconfirmed status without revealing protected records',
      run: () => ({
        result: { status: 'unknown', answer: 'Could not confirm the service status.' },
      }),
      routes: [route.deliver('result')],
    },
  ],
});

export const inspection = {
  workflow,
  toolCatalog: tools,
  nodeCapabilities: [{ nodeId: 'lookup', tools: [{ toolId: 'read_status', access: 'read' }] }],
};

export function createHelpdesk({ app, provider, execution }) {
  return new AgentCoreEngine({
    workflow,
    execution,
    model: { provider, maxCalls: 1 },
  }).bindToolRuntime(tools.bind({ app }));
}

export const sampleReceipt = {
  status: 'online',
  observedAt: '2026-01-03T10:00:00.000Z',
  source: 'monitor:7',
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const agent = createHelpdesk({
    app: { mayRead: (service) => service === 'demo', readStatus: () => sampleReceipt },
    provider: {
      async *stream() {
        yield 'The latest monitor reading shows the service online.';
      },
    },
  });
  const result = await agent.run({
    service: 'demo',
    question: 'What is the latest service status?',
    explain: process.argv.includes('--explain'),
  });
  console.log(JSON.stringify(result, null, 2));
}

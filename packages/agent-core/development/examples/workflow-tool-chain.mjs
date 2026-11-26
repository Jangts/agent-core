/*
 * Example: a workflow that drives a tool chain (工作流与工具链).
 *
 * The example shows the three-party split of an App integration: the model only
 * recognises the intent, the workflow decides which tools run and in which order, and
 * the tools themselves are typed App-owned handlers. The Support layer assembles the
 * tool catalog; Core keeps ownership of authorization, invocation, budgets and
 * cancellation.
 *
 * Main exports: `runExample`, which runs one request and reports the reply together
 * with the model and tool calls it produced.
 */
import { AgentCoreEngine, defineWorkflow, route, Support } from '@jangts/agent-core';

// A schema combines the JSON Schema the model sees with the parser the runtime uses,
// so a value the model produced is validated before it reaches the tool.
const text = Support.defineSchema({
  jsonSchema: { type: 'string', minLength: 1 },
  parse(value) {
    if (typeof value !== 'string' || !value.trim()) throw new TypeError('Expected nonempty text');
    return value;
  },
});
const latency = Support.defineSchema({
  jsonSchema: { type: 'number', minimum: 0 },
  parse(value) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
      throw new TypeError('Expected nonnegative latency');
    return value;
  },
});
/**
 * Build a record schema from a map of field schemas.
 *
 * @param shape - Field name to field schema.
 * @returns A schema for a closed object with exactly those fields.
 */
const fields = (shape) =>
  Support.defineSchema({
    jsonSchema: {
      type: 'object',
      properties: Object.fromEntries(
        Object.entries(shape).map(([key, schema]) => [key, schema.jsonSchema]),
      ),
      required: Object.keys(shape),
      additionalProperties: false,
    },
    parse(value) {
      // The record is closed, so the key count must match the declared shape.
      if (
        !value ||
        typeof value !== 'object' ||
        Array.isArray(value) ||
        Object.keys(value).length !== Object.keys(shape).length
      )
        throw new TypeError('Invalid record');
      return Object.fromEntries(
        Object.entries(shape).map(([key, schema]) => [key, schema.parse(value[key])]),
      );
    },
  });
const serviceInput = fields({ name: text });
const service = fields({ id: text, name: text });
const metricsInput = fields({ serviceId: text });
const metrics = fields({ latencyMs: latency });
const summaryInput = fields({ name: text, latencyMs: latency });

/**
 * Run one request through the example workflow.
 *
 * @param input - The user request text.
 * @param options - Optional `signal` for cancellation and `diagnostics` for the run records.
 * @returns The reply value plus the recorded model and tool calls.
 * @throws The engine's error when the run is cancelled or a contract is violated.
 */
export async function runExample(input, { signal, diagnostics } = {}) {
  // The call counters let the caller verify how many rounds and tools were used.
  const calls = { model: 0, tools: [] };
  const tools = Support.defineToolCatalog([
    {
      id: 'get_service',
      kind: 'read',
      description: '取得服务身份',
      inputSchema: serviceInput,
      // Authorization is the App's decision; the example accepts every call.
      authorize() {},
      execute({ name }) {
        calls.tools.push('get_service');
        return { id: 'svc-demo', name };
      },
      parseOutput: service.parse,
    },
    {
      id: 'get_metrics',
      kind: 'read',
      description: '读取延迟',
      inputSchema: metricsInput,
      authorize() {},
      execute() {
        calls.tools.push('get_metrics');
        return { latencyMs: 12 };
      },
      parseOutput: metrics.parse,
    },
    {
      id: 'summarize_status',
      kind: 'pure',
      description: '生成状态文本',
      inputSchema: summaryInput,
      authorize() {},
      execute({ name, latencyMs }) {
        calls.tools.push('summarize_status');
        return `${name}运行正常，延迟 ${latencyMs}ms`;
      },
      parseOutput: text.parse,
    },
  ]);
  const execution = { signal: signal ?? new AbortController().signal, diagnostics };
  // The runtime binds the catalog to one application request.
  const registry = tools.bind({ app: {} });
  const modelOptions = {
    // One model round is enough; the tool chain runs afterwards.
    maxCalls: 1,
    provider: {
      async *stream(messages) {
        calls.model++;
        yield messages.at(-1).content === '你好' ? 'greet' : 'status';
      },
    },
  };
  const workflow = defineWorkflow({
    id: 'miniapp',
    entryNodeId: 'recognize',
    nodes: [
      {
        id: 'recognize',
        description: '识别问候或状态查询',
        startsRound: true,
        async run(state, ctx) {
          return { intent: (await ctx.model.invoke({ input: state.input })).value };
        },
        routes: [
          { when: (state) => state.intent === 'greet', complete: () => '你好！' },
          route.toIfEqual('service', 'intent', 'status'),
        ],
      },
      {
        id: 'service',
        description: '查询演示服务',
        async run(_, ctx) {
          return {
            service: (
              await ctx.tools.invoke({ toolId: 'get_service', input: { name: '演示服务' } })
            ).value,
          };
        },
        routes: [{ targetNodeId: 'metrics' }],
      },
      {
        id: 'metrics',
        description: '读取延迟',
        async run(state, ctx) {
          return {
            metrics: (
              await ctx.tools.invoke({
                toolId: 'get_metrics',
                // The tool input is derived from the previous node's committed state.
                input: { serviceId: state.service.id },
              })
            ).value,
          };
        },
        routes: [{ targetNodeId: 'summary' }],
      },
      {
        id: 'summary',
        description: '生成状态文本',
        async run(state, ctx) {
          const { value } = await ctx.tools.invoke({
            toolId: 'summarize_status',
            input: { name: state.service.name, latencyMs: state.metrics.latencyMs },
          });
          return { result: value };
        },
        routes: [route.deliver('result')],
      },
    ],
  });
  const agent = new AgentCoreEngine({ maxRounds: 1, execution });
  agent.bindWorkflow(workflow).bindModel(modelOptions).bindToolRuntime(registry);
  const value = await agent.run({ input });
  return { value, calls };
}

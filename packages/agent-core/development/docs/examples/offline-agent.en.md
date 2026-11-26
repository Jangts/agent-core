# Complete Offline Example: Service Status Q&A

[Back to example index](../examples.md) · [Model and tool integration](../basic-usage.md) · [How it works](../mechanisms.md)

The code below can be copied into a project with the SDK installed and run without model credentials, a database, network access, or extra example files. The Provider only assembles strings from fixed data, so it serves to explain the execution process and has no real semantic understanding; the tool likewise returns only offline demo data.

## Preparation

First obtain the SDK and its real dependencies through the [installation guide](../getting-started.md). Save the complete JavaScript code as `app.mjs` and run `node app.mjs`. Save TypeScript as `app.ts` and use the compilation flow already present in your project; a standalone Node project can set type to module in package.json and install typescript/@types/node:

```sh
npx tsc --module nodenext --target es2022 --strict --outDir dist app.ts
node dist/app.js
```

The two stages are separate code files; do not paste declarations from multiple stages into the same file.

## Stage One: Configure a Single Node

Start by getting state updates and final delivery working end to end. The Workflow entry defaults to the first node, nodes return partial updates, and `route.deliver` reads the final field.

### TypeScript

```ts
import { AgentCoreEngine, defineWorkflow, route } from '@jangts/agent-core';

type State = { question: string; answer?: string };
const workflow = defineWorkflow<State, string>({
  id: 'service-helpdesk',
  nodes: [{
    id: 'answer',
    description: '回答演示服务状态',
    run: () => ({ answer: '演示服务在线。' }),
    routes: [route.deliver('answer')],
  }],
});
const agent = new AgentCoreEngine({ workflow });
const answer = await agent.run({ question: '演示服务在线吗？' });
console.log(answer);
```

### JavaScript

```js
import { AgentCoreEngine, defineWorkflow, route } from '@jangts/agent-core';

const workflow = defineWorkflow({
  id: 'service-helpdesk',
  nodes: [{
    id: 'answer',
    description: '回答演示服务状态',
    run: () => ({ answer: '演示服务在线。' }),
    routes: [route.deliver('answer')],
  }],
});
const agent = new AgentCoreEngine({ workflow });
const answer = await agent.run({ question: '演示服务在线吗？' });
console.log(answer);
```

The expected output is `演示服务在线。`. No model is needed at this point.

## Stage Two: Add Tools, a Model, and Observation

This stage still uses the same defineWorkflow, AgentCoreEngine, and agent.run. The new lookup node first executes the tool and obtains a validated result, and the answer node then calls the already bound model. Listening only receives metadata and explicitly approved node progress, and no persistent log is configured.

`createServiceAgent` is the assembly function of the App in this example, not a new SDK entry point; the fixed tool definition and Workflow are reused outside the function. Each call establishes an independent tool runtime and Engine, which can be used to give a request its own observation and lifecycle. The authorize of a production tool must be connected to real server-side identity and rules; the empty authorization here applies only to the public offline constants in this example.

### TypeScript

```ts
import { AgentCoreEngine, Support, defineWorkflow, route } from '@jangts/agent-core';
import type { ChatProvider, ExecutionOptions } from '@jangts/agent-core/types';

type Status = { status: 'online'; latencyMs: number };
type State = { question: string; service?: Status; answer?: string };

// 固定定义只写一次；这个离线公开资料工具不需要用户身份。
const tools = Support.defineToolCatalog([{
  id: 'get_status',
  kind: 'read',
  description: '读取演示服务的当前状态',
  inputSchema: {
    jsonSchema: { type: 'object', properties: {}, additionalProperties: false },
    parse(value: unknown) {
      if (!value || typeof value !== 'object' || Array.isArray(value)
        || Object.keys(value).length !== 0) throw new TypeError('状态查询不接受参数');
      return {};
    },
  },
  authorize() {
    // 仅适用于本例的公开离线数据；真实用户数据必须在这里校验授权。
  },
  execute: (): Status => ({ status: 'online', latencyMs: 12 }),
  parseOutput(value: unknown): Status {
    if (!value || typeof value !== 'object') throw new TypeError('状态结果无效');
    const status = value as Partial<Status>;
    if (status.status !== 'online' || typeof status.latencyMs !== 'number'
      || !Number.isFinite(status.latencyMs) || status.latencyMs < 0) {
      throw new TypeError('状态结果无效');
    }
    return { status: status.status, latencyMs: status.latencyMs };
  },
}]);

const provider: ChatProvider = {
  async *stream(messages, context) {
    context.signal.throwIfAborted();
    // 固定模拟协议，仅用于离线教程；不是语义理解或事实校验器。
    const input = JSON.parse(messages.at(-1)?.content ?? '{}');
    yield `演示服务${input.service.status === 'online' ? '在线' : '不可用'}，延迟 ${input.service.latencyMs}ms。`;
  },
};

const workflow = defineWorkflow<State, string>({
  id: 'service-helpdesk',
  nodes: [
    {
      id: 'lookup',
      description: '执行状态查询工具',
      provides: ['service'],
      async run(_state, { tools, report }) {
        report({ payload: { phase: 'lookup', message: '正在查询服务状态' } });
        const { value } = await tools.invoke({ toolId: 'get_status', input: {} });
        return { service: value as Status };
      },
      routes: [route.to('answer')],
    },
    {
      id: 'answer',
      description: '根据查询回执组织回答',
      requires: ['service'],
      provides: ['answer'],
      async run(state, { model }) {
        const { value } = await model.invoke({
          input: JSON.stringify({ question: state.question, service: state.service }),
        });
        return { answer: value };
      },
      routes: [route.deliver('answer')],
    },
  ],
});

export function createServiceAgent(execution: ExecutionOptions = {}) {
  const runtime = tools.bind({ app: {} });
  return new AgentCoreEngine({
    workflow,
    model: { provider, maxCalls: 1 },
    maxRounds: 1,
    execution,
  }).bindToolRuntime(runtime);
}

const agent = createServiceAgent({
  observe: {
    accepts: ({ event, content }) => content === 'metadata' || event === 'node.progress',
    event(fact) {
      if (fact.type === 'node.progress') console.log('[进度]', fact.payload.payload);
      if (fact.type === 'model.start') console.log('[进度] 正在组织回答');
    },
  },
});
console.log(await agent.run({ question: '演示服务在线吗？' }));
```

### JavaScript

```js
import { AgentCoreEngine, Support, defineWorkflow, route } from '@jangts/agent-core';

const tools = Support.defineToolCatalog([{
  id: 'get_status',
  kind: 'read',
  description: '读取演示服务的当前状态',
  inputSchema: {
    jsonSchema: { type: 'object', properties: {}, additionalProperties: false },
    parse(value) {
      if (!value || typeof value !== 'object' || Array.isArray(value)
        || Object.keys(value).length !== 0) throw new TypeError('状态查询不接受参数');
      return {};
    },
  },
  authorize() {
    // 仅适用于本例的公开离线数据；真实用户数据必须在这里校验授权。
  },
  execute: () => ({ status: 'online', latencyMs: 12 }),
  parseOutput(value) {
    if (!value || typeof value !== 'object' || value.status !== 'online'
      || typeof value.latencyMs !== 'number' || !Number.isFinite(value.latencyMs)
      || value.latencyMs < 0) throw new TypeError('状态结果无效');
    return { status: value.status, latencyMs: value.latencyMs };
  },
}]);

const provider = {
  async *stream(messages, context) {
    context.signal.throwIfAborted();
    const input = JSON.parse(messages.at(-1)?.content ?? '{}');
    yield `演示服务${input.service.status === 'online' ? '在线' : '不可用'}，延迟 ${input.service.latencyMs}ms。`;
  },
};

const workflow = defineWorkflow({
  id: 'service-helpdesk',
  nodes: [
    {
      id: 'lookup',
      description: '执行状态查询工具',
      provides: ['service'],
      async run(_state, { tools, report }) {
        report({ payload: { phase: 'lookup', message: '正在查询服务状态' } });
        const { value } = await tools.invoke({ toolId: 'get_status', input: {} });
        return { service: value };
      },
      routes: [route.to('answer')],
    },
    {
      id: 'answer',
      description: '根据查询回执组织回答',
      requires: ['service'],
      provides: ['answer'],
      async run(state, { model }) {
        const { value } = await model.invoke({
          input: JSON.stringify({ question: state.question, service: state.service }),
        });
        return { answer: value };
      },
      routes: [route.deliver('answer')],
    },
  ],
});

export function createServiceAgent(execution = {}) {
  const runtime = tools.bind({ app: {} });
  return new AgentCoreEngine({
    workflow,
    model: { provider, maxCalls: 1 },
    maxRounds: 1,
    execution,
  }).bindToolRuntime(runtime);
}

const agent = createServiceAgent({
  observe: {
    accepts: ({ event, content }) => content === 'metadata' || event === 'node.progress',
    event(fact) {
      if (fact.type === 'node.progress') console.log('[进度]', fact.payload.payload);
      if (fact.type === 'model.start') console.log('[进度] 正在组织回答');
    },
  },
});
console.log(await agent.run({ question: '演示服务在线吗？' }));
```

Lookup and model progress appear first, and the final output is:

```text
演示服务在线，延迟 12ms。
```

Tool and model invocations each return `{ value, invocation }`; the final Result of the current Workflow is a string. These two boundaries do not need to share the same shape. Nodes report only a payload, and the Loop handles execution identity, time, and correlation.

The `as Status` in the TypeScript example does not perform runtime validation. Real validation is done by the tool's parseOutput, which then associates the result of a known demo tool with the state type. When integrating with Node/NestJS or another host, you still need to establish identity, authorization, and signal per request, and must not hand a client's permission flag directly to the model or tool as a trusted condition.

## Keep Configuring Without Changing the Entry Point

- Cancel this run: `agent.run({ question }, { signal })`.
- Add a real model: replace the bound Provider and keep the same node calls and result reads.
- Add conditional branches: use raw routes or route builders in the ordinary routes array.
- Handle over-limit input: add an explicit node per the [context node contract](../api/context-processing.md); the final model call remains subject to the Core budget check.

The tool order in this example is configured by the Workflow, not chosen by the model. Model capability selection should register a capability schema, a transport, and a real authorized execution entry separately, and a model claiming it "looked it up" must not be taken as a real tool receipt.

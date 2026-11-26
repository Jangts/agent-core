# 离线完整示例：服务状态问答

[返回示例目录](../examples.md) · [模型与工具接入](../basic-usage.md) · [工作机制](../mechanisms.md)

以下代码可以复制到已安装 SDK 的项目中运行，不需要模型凭据、数据库、网络或额外示例文件。Provider 只按固定数据组织字符串，用于理解执行过程，不具备真实语义理解能力；工具也只返回离线演示数据。

## 运行准备

先按[安装指南](../getting-started.md)取得 SDK 与实际依赖。JavaScript 完整代码保存为 `app.mjs`，运行 `node app.mjs`。TypeScript 保存为 `app.ts`，使用项目已有编译流程；独立 Node 项目可以将 package.json 的 type 设为 module，并安装 typescript／@types/node：

```sh
npx tsc --module nodenext --target es2022 --strict --outDir dist app.ts
node dist/app.js
```

两个阶段分别是一份独立代码，不要把多个阶段的声明粘进同一个文件。

## 阶段一：只配置一个节点

先让状态更新与最终交付跑通。Workflow 的入口缺省为首节点，节点返回局部更新，`route.deliver` 读取最终字段。

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

预期输出 `演示服务在线。`。此时不需要模型。

## 阶段二：增加工具、模型与观察

仍然使用相同的 defineWorkflow、AgentCoreEngine 和 agent.run。新增查询节点先执行工具并取得校验后的结果，回答节点再调用已经绑定的模型。监听只接元数据和明确获准的节点进度，不配置持久日志。

`createServiceAgent` 是本例 App 的装配函数，不是 SDK 新入口；固定工具定义和 Workflow 在函数外复用。每次调用它会建立独立的工具运行时与 Engine，可用于建立请求自己的观察与生命周期。生产工具的 authorize 必须接真实的服务端身份与规则；这里的空授权只适用于本例公开的离线常量。

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

预期先出现查询与模型进度，最终输出：

```text
演示服务在线，延迟 12ms。
```

工具与模型调用各自返回 `{ value, invocation }`；当前 Workflow 的最终 Result 是字符串。这两种边界不需要采用相同外形。节点只报告 payload，执行身份、时间和关联由 Loop 处理。

TypeScript 示例中的 `as Status` 不承担运行时校验。真实校验由工具 parseOutput 完成，再把已知演示工具的结果关联到状态类型。Node／NestJS 或其他宿主接入时，仍需按各自请求建立身份、授权和 signal，不能把客户端的权限标记直接交给模型或工具作为可信条件。

## 继续配置，不更换入口

- 取消本次运行：`agent.run({ question }, { signal })`。
- 增加真实模型：替换绑定的 Provider，保留相同节点调用和结果读取方式。
- 增加条件分支：在普通 routes 数组中使用原始路由或 route 生成器。
- 处理超限输入：按[上下文节点合同](../api/context-processing.md)添加明确节点，最终模型调用仍受 Core 预算检查。

本例的工具顺序由 Workflow 配置，不是模型自主选择。模型选择能力时应另行登记能力 schema、传输与实际授权执行入口，不能把模型声称“查到了”当作真实工具回执。

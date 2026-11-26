[English](#english) · [中文](#中文)

<a id="english"></a>

# Jangts Agent Core

<img src="https://agent-core-docs.pages.jangts.cafe/branding/agent-core-logo.svg" alt="Agent Core" width="360">

Agent Core is a Node.js SDK for adding model-driven tasks to an application. Use it to summarize a support ticket, answer from records the current user can access, or carry a task across an approval and an interrupted operation. Your application defines the workflow and business rules. The SDK runs the declared steps, enforces call budgets and registered tool checks, and exposes execution records.

[Quickstart](#quickstart) · [Upgrade guide](development/docs/upgrading.en.md) · [Changelog](CHANGELOG.md)

## Quickstart

Use **Node.js 22.12.0 or newer**. Agent Core ships ESM, CommonJS, and TypeScript declarations. This guide uses version 1.0.0.

```sh
mkdir ticket-agent
cd ticket-agent
npm init -y
npm install @jangts/agent-core@1.0.0
```

Save the following as `ticket.mjs`. The workflow summarizes a support note in one model call. When the note is empty, the application returns a request for details immediately.

```js
import { AgentCoreEngine, defineWorkflow, route } from '@jangts/agent-core';

const workflow = defineWorkflow({
  id: 'ticket-summary',
  nodes: [
    {
      id: 'intake',
      description: 'Check whether the ticket has a note',
      run({ note }) {
        return { note: note.trim(), summary: 'Please describe the issue.' };
      },
      routes: [
        { id: 'has-note', when: ({ note }) => note.length > 0, targetNodeId: 'summarize' },
        route.deliver('summary'),
      ],
    },
    {
      id: 'summarize',
      description: 'Summarize the support note',
      async run({ note }, { model }) {
        const { value } = await model.invoke({
          input: [
            { role: 'system', content: 'Summarize the reported issue in one sentence.' },
            { role: 'user', content: note },
          ],
        });
        return { summary: value };
      },
      routes: [route.deliver('summary')],
    },
  ],
});

const provider = { async *stream() { yield 'Card payment failed twice.'; } };
const agent = new AgentCoreEngine({ workflow, model: { provider, maxCalls: 1 } });

console.log(await agent.run({ note: 'I tried to pay by card twice and both attempts failed.' }));
console.log(await agent.run({ note: '   ' }));
```

Run `node ticket.mjs`. The fixed Provider reply keeps the example offline and requires no credentials.

```text
Card payment failed twice.
Please describe the issue.
```

Each node returns a state patch. The Engine applies it and takes the first matching route. `route.deliver('summary')` returns the selected field to the caller. The first run uses one model call and the second uses zero. `maxCalls` applies to each run. The model result's `value` holds the text and `invocation` holds call metadata.

## Connect a model

Add `Support` to the import and replace the example's `provider` declaration with the following. Set `MODEL_API_KEY` and `MODEL_NAME` in the server environment using credentials and a model with Responses API access.

```js
const provider = Support.createModelProvider({
  protocol: 'responses',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: process.env.MODEL_API_KEY,
  model: process.env.MODEL_NAME,
});
```

The workflow and its return value use the same contract with the real Provider. Run failures reach the caller unless the workflow handles them explicitly. Keep provider credentials on the server and pass the current request's cancellation signal through the execution context. For a single model call inside an existing handler, use [`ModelRunner`](development/docs/basic-usage.en.md). For other providers, streaming, continuation, batch, and realtime, see [model protocols and lifecycles](development/docs/api/model-protocols.en.md).

## Extend a task

| When you need to | Start here |
| --- | --- |
| Read protected data or perform a business operation | Declare a tool's input schema, authorization, execution, and output checks in one place. Bind the tool catalog to trusted request context. [Tool integration](development/docs/basic-usage.en.md) |
| Control how a task branches, stops, and returns results | Declare workflow routes and delivery points. Add call budgets, cancellation, and diagnostics at the execution boundary. [Workflows](development/docs/api/workflow.en.md) · [Observability](development/docs/api/observability.en.md) |
| Wait for approval, recover after interruption, or accept a reviewed result | Use Waiting for submissions, Durable to reconcile an interrupted operation, and Result Review to inspect evidence and select a result. The application supplies current authorization and persistence. [Reliable execution](development/examples/harness-durable.en.md) · [Result review](development/docs/api/result-review.en.md) |
| Answer from sources, retain user preferences, or set reply defaults | Use optional Kits for evidence-based answering or evidence-linked personal memory. The application controls source access, memory storage, and retention. Set reply detail on the relevant call with `replyGuidance`. [Kits](development/docs/api/kits.en.md) · [Memory](development/docs/memory-and-learning.en.md) · [Reply organization](development/articles/reply-organization.en.md) |

Import Core and `Support` from the package root, optional capabilities from `@jangts/agent-core/kits/<name>`, and reusable task methods from `@jangts/agent-core/skills`. The optional [MockGPT adapters](development/docs/api/mock.en.md) require the `@jangts/mock-gpt` peer package. The [development handbook](development/docs/README.en.md) covers application setup and integration.

## Verify the workflow

Run the bundled offline scenarios from the project directory to verify authorization, recovery, and model call counts using a registered workflow.

```sh
sdk=./node_modules/@jangts/agent-core
node "$sdk/development/scripts/workflow-scenarios/cli.mjs" \
  --fixture "$sdk/development/examples/workflow-scenarios.mjs"
```

The `authorized` scenario completes with one model call. The `denied` scenario takes the recovery path with zero. Use the [workflow inspector and development handbook](development/docs/workflow-development.en.md) to explore routes, view recorded traces, compare declarations, and test your own cases. The [reply development Skill](development/skills/agent-core-reply-development/SKILL.md) covers testing reply content, format, and references.

[Documentation site](https://agent-core-docs.pages.jangts.cafe/en/) · [API handbook](development/docs/api/README.en.md) · [Technical articles](development/articles/README.en.md)

Apache 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

---

<a id="中文"></a>

# Jangts Agent Core

Agent Core 是在 Node.js 应用中接入模型任务的 SDK。可以用它汇总客服工单、基于当前用户有权访问的资料作答，或处理需要人工审批和中断恢复的任务。应用定义工作流和业务规则，SDK 执行已声明的步骤、约束调用预算、执行已注册的工具检查，并提供运行记录。

[快速开始](#快速开始) · [升级指南](development/docs/upgrading.md) · [变更日志](CHANGELOG.md)

## 快速开始

使用 **Node.js 22.12.0 或更高版本**。Agent Core 提供 ESM、CommonJS 和 TypeScript 类型声明。本指南使用 1.0.0。

```sh
mkdir ticket-agent
cd ticket-agent
npm init -y
npm install @jangts/agent-core@1.0.0
```

将以下代码保存为 `ticket.mjs`。有工单备注时，工作流调用一次模型生成摘要。备注为空时，应用直接提示补充信息。

```js
import { AgentCoreEngine, defineWorkflow, route } from '@jangts/agent-core';

const workflow = defineWorkflow({
  id: 'ticket-summary',
  nodes: [
    {
      id: 'intake',
      description: '检查工单是否填写备注',
      run({ note }) {
        return { note: note.trim(), summary: '请描述遇到的问题。' };
      },
      routes: [
        { id: 'has-note', when: ({ note }) => note.length > 0, targetNodeId: 'summarize' },
        route.deliver('summary'),
      ],
    },
    {
      id: 'summarize',
      description: '生成工单摘要',
      async run({ note }, { model }) {
        const { value } = await model.invoke({
          input: [
            { role: 'system', content: '用一句话概括工单描述的问题。' },
            { role: 'user', content: note },
          ],
        });
        return { summary: value };
      },
      routes: [route.deliver('summary')],
    },
  ],
});

const provider = { async *stream() { yield '银行卡支付失败两次。'; } };
const agent = new AgentCoreEngine({ workflow, model: { provider, maxCalls: 1 } });

console.log(await agent.run({ note: '我用银行卡试了两次，两次都没有支付成功。' }));
console.log(await agent.run({ note: '   ' }));
```

执行 `node ticket.mjs`。示例 Provider 返回固定文本，运行时无需模型密钥或网络。

```text
银行卡支付失败两次。
请描述遇到的问题。
```

节点返回状态补丁。Engine 应用补丁后选择第一条匹配的路由，`route.deliver('summary')` 将指定字段返回给调用方。第一次运行调用模型一次，第二次为零次。每次运行独立计算 `maxCalls`。模型结果的 `value` 是正文，`invocation` 保存调用信息。

## 接入真实模型

在 import 中加入 `Support`，将示例中的 `provider` 声明替换为以下代码。在服务端环境中设置 `MODEL_API_KEY` 和 `MODEL_NAME`，使用有权访问 Responses API 的凭据和模型。

```js
const provider = Support.createModelProvider({
  protocol: 'responses',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: process.env.MODEL_API_KEY,
  model: process.env.MODEL_NAME,
});
```

接入真实 Provider 后，工作流的调用方式和返回合同保持一致。运行失败会抛给调用方，应用也可以在工作流中声明明确的处理路径。模型密钥保留在服务端，通过执行上下文传入当前请求的取消信号。只需在现有 handler 中调用一次模型时，可以直接使用 [`ModelRunner`](development/docs/basic-usage.md)。其他供应商、流式响应、续接、批量和实时会话见[模型协议与生命周期](development/docs/api/model-protocols.md)。

## 按任务扩展

| 需要完成的事 | 接入方式 |
| --- | --- |
| 读取受保护的数据或执行业务操作 | 集中声明工具的输入 schema、授权、执行和输出检查，将工具目录绑定到可信的请求上下文。[工具接入](development/docs/basic-usage.md) |
| 控制任务如何分支、停止和交付 | 声明工作流路由和交付点，在执行边界设置预算、取消和诊断。[工作流](development/docs/api/workflow.md) · [运行观测](development/docs/api/observability.md) |
| 等待审批、中断后恢复或接受评审结果 | 用 Waiting 接收提交，用 Durable 核对中断操作的结果，用 Result Review 检查证据并选择成果。应用负责当前授权和持久化。[可靠执行](development/examples/harness-durable.md) · [结果评审](development/docs/api/result-review.md) |
| 基于资料作答、保留用户偏好或设置答复默认值 | 按需接入取证问答或带证据的个人记忆。应用控制资料访问、记忆存储和保留策略。通过 `replyGuidance` 为相关调用设置答复详略。[Kits](development/docs/api/kits.md) · [记忆](development/docs/memory-and-learning.md) · [答复组织](development/articles/reply-organization.md) |

从包根入口导入 Core 和 `Support`，从 `@jangts/agent-core/kits/<name>` 导入可选能力，从 `@jangts/agent-core/skills` 使用可复用的任务方法。可选的 [MockGPT 适配器](development/docs/api/mock.md) 需要安装 `@jangts/mock-gpt`。[开发手册](development/docs/README.md)覆盖应用创建与接入。

## 验证工作流

在项目目录运行随包提供的离线场景，即可用已注册的工作流验证授权、恢复和模型调用次数。

```sh
sdk=./node_modules/@jangts/agent-core
node "$sdk/development/scripts/workflow-scenarios/cli.mjs" \
  --fixture "$sdk/development/examples/workflow-scenarios.mjs"
```

`authorized` 场景调用模型一次并完成任务，`denied` 场景走恢复路径且不调用模型。[工作流检查与开发手册](development/docs/workflow-development.md)介绍如何查看路由、回看经授权的运行记录、对照声明及测试自己的场景。[答复开发 Skill](development/skills/agent-core-reply-development/SKILL.md)覆盖答复内容、格式与参考资料的检查。

[文档站](https://agent-core-docs.pages.jangts.cafe/zh/) · [API 手册](development/docs/api/README.md) · [技术文章](development/articles/README.md)

Apache 2.0。见 [LICENSE](LICENSE) 和 [NOTICE](NOTICE)。

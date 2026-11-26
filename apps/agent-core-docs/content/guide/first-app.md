---
title: 实作第一个 Agent App
description: 安装并运行服务台案例，查看注册图，比较路由变更，验证权限、模型调用次数和答复降级。
---

# 实作第一个 Agent App

把[设计页](./design.md)的服务台任务跑一遍。同一份代码从监控端口读取状态，可选地调用模型解释，随后交付已确认的字段。当解释失败时，它沿恢复路径返回原先确认的状态。案例使用内存监控和固定模型回复，无需密钥、数据库或线上服务。

## 安装并运行服务台

使用 Node.js 22.12.0 或更新版本。本教程使用 Agent Core 1.0.0。

```sh
mkdir helpdesk-lab
cd helpdesk-lab
npm init -y
npm install @jangts/agent-core@1.0.0
```

使用维护方提供的本地包时，将最后一条改为 `npm install /path/to/jangts-agent-core-1.0.0.tgz`。以下命令均从 `helpdesk-lab` 执行。复制包内示例到自己的目录，后续可以直接改这份代码。

```sh
SDK=./node_modules/@jangts/agent-core
cp -R "$SDK/development/docs/examples/service-helpdesk" ./service-helpdesk
node ./service-helpdesk/app.mjs
node ./service-helpdesk/app.mjs --explain
```

两次输出都有同一组确认字段。普通查询的 `answer` 是 `Service status: online.`，解释路径是 `The latest monitor reading shows the service online.`。

```json
{
  "status": "online",
  "observedAt": "2026-01-03T10:00:00.000Z",
  "source": "monitor:7",
  "answer": "Service status: online."
}
```

示例用 `--explain` 显式选择路径，便于复现。实际应用可以根据已验证的界面选项或语义判断请求范围。创建自己独立的 TypeScript 工程时，可以先审阅 `create-app` 的只读计划，再用相同命令加 `--write` 生成。工程包含真实工具接线、空资料清单和独立的离线测试。[创建应用](/manual/create-app)

## 沿一次调用读代码

`service-helpdesk/app.mjs` 是请求工厂和注册入口。它导出 `inspection`，供开发工具读取同一个 Workflow 和工具目录。`cases.mjs` 提供场景与分层用例。

1. **读取。** `lookup` 使用 `read_status`。工具先解析服务名，再通过 App 的 `mayRead` 检查当前身份。授权成功才调用 `readStatus`，返回值经过字段校验后进入 `receipt`。拒绝或监控异常时走 `unavailable`，用户得到无法确认，返回值没有受保护的字段。
2. **决定是否解释。** `lookup` 先匹配 `explain-requested`，再匹配直接交付。普通查询由 `deliver-status` 绑定确认字段，模型调用次数为零。
3. **组织解释。** `explain` 用 `Support.defineContextFragments` 装配应用规则、问题和 `receipt`。可信规则放在 system，问题和工具回执作为数据。它用 `Support.resolveReplyGuidance` 选择简短默认值，再通过同一准备句柄调用模型。
4. **保留成果。** 这个工作流每次最多一次模型调用，解释还有自己的输出约束。文案为空或超出要求时，失败边回到 `deliver-status`，已验证的 `receipt` 仍在 state。取消由请求信号传给执行端，取消后不交付迟到结果。

应用定义允许披露的字段，示例把状态、来源和观察时间从回执直接绑定到结果。测试覆盖固定模型响应与失败回路。接入真实模型时，还需要检查解释有没有误读状态或补造原因。[提示与上下文](/articles/prompts-and-context) · [调用预算](/articles/reasonable-dynamic-budgets) · [答复组织](/articles/reply-organization)

## 检查注册图和路由变更

从实际注册入口生成可独立打开的 HTML 并保存基线。检查模块导入自己可信的示例。App 自己的检查入口也应可导入而不启动服务或执行请求。

```sh
SDK=./node_modules/@jangts/agent-core
INSPECTOR="$SDK/development/scripts/workflow-inspector/cli.mjs"
mkdir -p .tmp
node "$INSPECTOR" inspect --entry ./service-helpdesk/app.mjs --output .tmp/helpdesk.html
node "$INSPECTOR" export --entry ./service-helpdesk/app.mjs > .tmp/helpdesk-before.json
```

在 `.tmp/helpdesk.html` 中查看 `lookup` 的条件边、默认边、到 `unavailable` 的恢复边和 `read_status` 的引用。注册图说明可能路径，需要解释具体请求时，用 App 授权导出的运行记录与图对照。[工作流检查器](/manual/workflow-inspector)

在复制的 `app.mjs` 中，尝试把 `lookup` 的无条件路由 `route.to('deliver-status')` 移到 `explain-requested` 前，并再次执行 `export`。检查器会报入口导入失败。直接运行 `node ./service-helpdesk/app.mjs` 会看到注册错误 `Invalid or unreachable workflow route: lookup`，因为无条件路由会屏蔽所有后续路由。

现在用下面的条件路由替换该无条件路由，保持它位于 `explain-requested` 前。两条规则都可能匹配已确认且需要解释的状态，因此图能注册，实际优先级却改变了。

```js
{
  id: 'to-deliver-status',
  when: ({ receipt }) => receipt !== undefined,
  targetNodeId: 'deliver-status',
},
```

导出这份可以注册的候选，再比较和运行指定用例。

```sh
node "$INSPECTOR" export --entry ./service-helpdesk/app.mjs > .tmp/helpdesk-after.json
node "$SDK/development/scripts/workflow-diff/cli.mjs" \
  --before .tmp/helpdesk-before.json --after .tmp/helpdesk-after.json
node "$SDK/development/scripts/workflow-scenarios/cli.mjs" \
  --fixture ./service-helpdesk/cases.mjs --case explained
```

差异报告会标出 `lookup` 的路由变化。最后一条命令应失败，报告预期一次模型调用，实际零次。直接交付条件先匹配，解释阶段没有执行。把 `explain-requested` 恢复到第一条，并在它后面放回原有的 `route.to('deliver-status')`。实际评审可将两份快照与失败场景交给变更审查 Skill，由其说明变更、直接受影响的节点和要重跑的用例。[变更审查 Skill](/development/skills/agent-core-workflow-change-review)

## 验证真实 Engine 路径与分层合同

恢复路由顺序后，运行同一份测试模块的场景入口和分层入口。

```sh
SDK=./node_modules/@jangts/agent-core
CASES=./service-helpdesk/cases.mjs
node "$SDK/development/scripts/workflow-scenarios/cli.mjs" --fixture "$CASES"
node "$SDK/development/skills/agent-core-app-testing/scripts/test-agent.mjs" --fixture "$CASES"
```

| 场景 | 监控读取 | 模型调用 | 交付 |
| --- | ---: | ---: | --- |
| `status-only` | 1 | 0 | 确认状态 |
| `explained` | 1 | 1 | 确认状态和解释 |
| `denied` | 0 | 0 | 无法确认 |
| `read-failed` | 1 | 0 | 无法确认 |
| `bad-explanation` | 1 | 1 | 复用回执交付确认状态 |

场景还断言节点的实际访问顺序。分层测试预期通过四项。功能层检查解释失败，以及查询期间取消时拒绝交付且不调用模型。节点层将 `deliver-status` 放进最小 Workflow 并核对字段。工具层检查拒绝时无读取、通过时返回真实格式的回执。可用 `--layer tool` 或 `--case bad-explanation` 聚焦。自己的 App 仍可共享一份 fixture，但每个用例要有独立端口和状态。[工作流开发与验证](/manual/workflow-development) · [App 分层测试 Skill](/development/skills/agent-core-app-testing)

## 接到自己的 App

保留可复用定义，在已鉴权的请求里把当前用户、监控端口和取消信号接到 `createHelpdesk({ app, provider, execution: { signal } })`，再执行 `agent.run(state)`。开发时可以保留固定 Provider，验证供应商集成时使用服务器配置的真实 Provider。例如在 `app.mjs` 的调用入口，用已导入的 `Support` 创建它：

```js
const provider = Support.createModelProvider({
  protocol: 'responses',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: process.env.MODEL_API_KEY,
  model: process.env.MODEL_NAME,
});
```

把这个 Provider 交给请求工厂的 `provider`。由服务端提供可用的凭据和模型名称，其余接线保持不变。用有权限、拒绝访问、过期来源、用户取消及追问样本检查真实端口和语义效果。需要研究不同协议时，可注入 [MockGPT](/manual/api/mock) 检验可复现的协议行为，再用目标模型补做语义验证。[模型协议与生命周期](/manual/api/model-protocols) · [上线检查](/guide/extended/production-checklist)

### 在 Node.js 宿主中接线

把下列函数放在宿主的 `status-handler.mjs`。监控适配器接收服务端确认的 `principal`，每次读取按当前身份核验权限。HTTP 层负责校验 `state`，并把请求断开、用户停止或应用期限转换成 `signal`。

```js
import { createHelpdesk } from './service-helpdesk/app.mjs';

export function createStatusHandler({ monitor, provider }) {
  return ({ state, principal, signal }) => {
    const agent = createHelpdesk({
      app: {
        mayRead: (service, signal) => monitor.mayRead(principal, service, signal),
        readStatus: (service, signal) => monitor.readStatus(service, signal),
      },
      provider,
      execution: { signal },
    });
    return agent.run(state);
  };
}
```

### 在 NestJS 中复用同一个 handler

用已有模块的 provider 注册 `STATUS_HANDLER`，值为 `createStatusHandler({ monitor, provider })`。控制器把鉴权获得的身份、已校验的查询及本次取消信号交给服务。单例只复用 handler，Engine 和 Tool Runtime 随请求创建。

```ts [NestJS · status.service.ts]
import { Inject, Injectable } from '@nestjs/common';

type StatusRequest = {
  state: { service: string; question: string; explain: boolean };
  principal: Readonly<{ accountId: string }>;
  signal: AbortSignal;
};

@Injectable()
export class StatusService {
  constructor(
    @Inject('STATUS_HANDLER')
    private readonly runStatus: (request: StatusRequest) => Promise<unknown>,
  ) {}

  ask(request: StatusRequest) {
    return this.runStatus(request);
  }
}
```

[按稳健性选择下一组案例](/recipes/) · [回到设计页](./design.md) · [查看工作机制](./mechanism.md) · [API 阅读路线](./api-path.md)

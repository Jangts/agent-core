# 工作流开发与验证

开发者可以用随包 Skill 设计节点和分析调用预算，再用 Node.js 工具查看注册图、比较声明与运行离线用例。

| 开发任务 | 入口 | 交付物 |
| --- | --- | --- |
| 不改变图也可设计或检查答复 | [答复怎样组织](../articles/reply-organization.md) | 处理方式、风格、参考、定向示例和证据 |
| 了解定义和实际运行 | [工作流检查器](workflow-inspector.md) | 注册快照、可独立打开的 HTML、按需附带指定运行链 |
| 找出预算和资料读取的稳健性缺口 | [稳健性检查](#检查-agent-稳健性) | 失败路径、触发证据和回归建议 |
| 核对工作流改动 | [声明差异](#查变更影响) | 路由、Schema、适配器变更与直接受影响的节点 |
| 验证既有行为 | [离线用例](#跑离线用例) | 结果、路径、恢复与模型调用次数 |
| 按层测试 App | [功能、节点和工具测试](#test-agent-features-nodes-and-tools) | 一份用例清单及 Node.js 测试报告 |

[创建 App](create-app.md)提供项目起点，[开发者 Skills](agent-development.md#开发者-skills)可按任务交给编码助手。

## 设计工作流节点

工作流节点设计 Skill 从代表性请求梳理职责、输入输出、分支和失败去向。独立路由、成果提交或恢复可以支持拆分，但要比较收益与状态交接、额外调用及恢复复杂度，不能仅凭其中一项就要求增加节点。只需观察的细节优先留在节点内执行记录；共用的读取、转换和校验可留在 handler 或工具中。完整用例可以由一个节点承担，受约束的调查循环也可以合理：根据新证据选择下一步，缺乏进展时重规划或停止。已有前置结果满足合同就由程序直接推进，需要理解歧义、判断新证据或综合结果时再调用模型。

Skill 位于安装包的 `development/skills/agent-core-workflow-design/SKILL.md`。用[工作流检查器](workflow-inspector.md)查看注册图，并在有记录时核对实际节点访问、转移和模型调用。

先读[同一任务的两种组织方式](examples/organization-comparison.md)，比较共享事实与交付合同如何支撑不同生命周期边界。选择边界后，用检查器核对注册与引用，用声明差异审阅修改，再用离线场景断言成果、实际路径和副作用次数。案例提供包内可运行入口；图形相似或引用检查通过都不能替代行为验证。

## 优化模型调用预算

模型调用预算优化 Skill 按实际调用建立账本，记录阶段、用途、结果、用量和耗时。先查重复取证、重复传入的上下文以及常规复核，再根据必需路径设置共享预算和交付预留。使用 [Core 请求测量](api/core.md)核对实际装配的消息和声明，使用[上下文处理](api/context-processing.md)控制历史保留和压缩。

Skill 位于安装包的 `development/skills/agent-core-budget-optimization/SKILL.md`。离线用例分别核对初始估计不足时的合理扩额、上下文压力下的投影或压缩，以及实际阻碍或硬边界下的真实交代；初始额度不足不等于应该部分交付。用量、延迟和语义质量的前后比较需要可比样本与真实模型记录。

## 检查 Agent 稳健性

`development/skills/agent-core-resilience-review/SKILL.md` 用于检查普通请求、复杂请求、长历史续聊和预算将尽时的实际路径。先评估解析、筛选、统计和比对是否值得程序化；合适的全模型答复无需因此改造，再核对不同任务的配额、累计用量与收尾预留。任务规模差异明显时，由 App 按已确认的工作和能力要求分配额度，维持总量硬上限。

检查首次允许模型选择工具的实际请求。核对工具 ID、工具选择模式和当前阶段需要的能力，覆盖普通问答、隐含请求、短句续接和多意图。可以从同一份[工具注册定义](api/configuration-in-workflow.md)按阶段筛选。比较工具列表、说明、Schema 和提示词，清理重复别名、字段说明和实现细节，保留区分用途、参数与副作用所需的信息。用[实际请求测量](api/core.md)比较精简前后的输入大小，并复测选路和参数。

资料库检查包含[稳定的章节标记](knowledge.md#文本章节锚点)、实际的[检索索引](api/kits.md#textsearch-vectorsearch-rrf-modelcalls)和按章节读正文。使用 MiniSearch 时，可以从 `TextSearch` 的接线核对分词、命中范围以及版本更新。长历史则检查是否采用合适的[上下文处理策略](api/context-processing.md)，包括阈值、近期原文与增量摘要。用离线用例确认额度耗尽时能如实交付已验证的部分，并保留取消、授权和执行回执。

每项发现记录触发请求、执行路径、实际用量与上限、还能交付的结果，以及可复现的最小用例。比如复杂查询耗尽工具额度时，用[分层测试](#test-agent-features-nodes-and-tools)断言它停止追加读取，并把覆盖不全的结果标为部分完成。

<a id="review-a-declaration-change"></a>

## 查变更影响

在 App 目录执行以下命令。先从实际注册定义导出基线，改动后再导出同一工作流的候选快照。如果接入的是由 TypeScript 编译的声明，每次导出前生成对应的 JavaScript 入口。

```sh
SDK=./node_modules/@jangts/agent-core
mkdir -p .tmp
node "$SDK/development/scripts/workflow-inspector/cli.mjs" export \
  --entry ./inspect-workflow.mjs > .tmp/workflow-before.json

# 修改注册定义后：
node "$SDK/development/scripts/workflow-inspector/cli.mjs" export \
  --entry ./inspect-workflow.mjs > .tmp/workflow-after.json
node "$SDK/development/scripts/workflow-diff/cli.mjs" \
  --before .tmp/workflow-before.json --after .tmp/workflow-after.json
```

报告列出入口、节点、边、路由优先级、工具 Schema、工具和适配器绑定、handler 元数据及条件来源的变更，并给出直接相关节点。工具变化会沿两份快照中的节点及适配器绑定反查。缺少可选清单时，该项显示未比较。清单按标识比较，单条声明内的数组顺序参与比较。快照时间、来源指纹、版本标签和对象键顺序不影响结果。检查读取声明，实际路由和权限由运行验证。

`--json` 返回结构化报告，`--fail-on-change` 让发现声明差异时退出码为 2。输入无效时退出码为 1。建议在改动前保存确实来自当前注册的快照，引擎和工具目录继续作为唯一来源。

需要 Agent 辅助梳理变更影响时，使用[工作流变更审查 Skill](../skills/agent-core-workflow-change-review/SKILL.md)。

## 跑离线用例

先运行[随包示例](../examples/workflow-scenarios.mjs)，它将授权成功与拒绝恢复绑定到同一份工作流：

```sh
SDK=./node_modules/@jangts/agent-core
node "$SDK/development/scripts/workflow-scenarios/cli.mjs" \
  --fixture "$SDK/development/examples/workflow-scenarios.mjs"
```

App 在可信的 JavaScript 文件中导出 `scenarios` 数组。每个用例各有 `id` 与 `setup({ execution, provider })`，后者使用 App 的工厂和合成依赖返回 `{ agent, state }`。把 `execution` 交给 Engine，把 `provider` 接进对应模型配置。App 负责提供基于内存或合成数据的工具、存储及外部端口。入口模块和工厂以当前进程权限执行。

- `replies` 可省略，表示预期零次模型调用。每条回复是字符串或一组 Core `ModelPart`。多调用与未消费的回复会使本次用例失败。
- 成功用 `verify({ result, events, modelCalls })`，预期拒绝用 `verifyError({ error, events, modelCalls })`。可用 Node 的 `assert` 检查实际结果、按顺序记录的节点与路由、恢复路径及调用次数。报告仅列出选定的工作流事件字段，JSON 输出不包含成功结果与模型正文。
- `timeoutMs` 默认 5000，超时取消传给 Engine 的信号并判定失败。`--case ID` 只运行指定用例，可重复。失败时退出码为 1。

离线用例适合守住已知决策、分支、授权拒绝和输出合同。真实模型的语义效果以及生产端口的副作用由对应的集成验证覆盖。

需要 Agent 辅助编写或排查用例时，使用[工作流离线回归 Skill](../skills/agent-core-workflow-regression/SKILL.md)。

<a id="test-agent-features-nodes-and-tools"></a>

## 测试 Agent 功能、节点和工具

在 App 目录运行随包 Node.js 脚本。省略 `--fixture` 时，它运行同一 Skill 附带的示例。

```sh
SDK=./node_modules/@jangts/agent-core
TEST_AGENT="$SDK/development/skills/agent-core-app-testing/scripts/test-agent.mjs"
node "$TEST_AGENT"
node "$TEST_AGENT" --layer tool
```

在可信的 JavaScript 模块中导出 `agentTests` 数组。每个条目注册唯一的 `id`、`layer` 和 `run({ signal, runScenario })`，并可设置 `timeoutMs`，缺省为 5000 毫秒。

| 层 | 接线与断言 |
| --- | --- |
| `feature` | 通过 `runScenario` 接 App 的实际 Engine，检查用户结果、权限路径或模型调用次数 |
| `node` | 把实际节点放入最小工作流，检查状态提交、路由优先级及恢复 |
| `tool` | 调用实际 Tool 绑定，通过合成端口检查参数、授权、效果次数、输出校验与回执 |

`--fixture` 指向本地 Node.js 能加载的入口。JS 项目可以直接写 `.mjs`，TS 项目可以用原有工具链生成 JS 入口，再把生成路径传给脚本。

将下面的例子保存为 `test/agent-tests.mjs`。它使用真实 Engine 运行计数节点，断言交付结果以及零次模型调用。接入自己的 App 时，将示例工作流换成实际节点及最小接线。

```js
import assert from 'node:assert/strict';
import { AgentCoreEngine, defineWorkflow, route } from '@jangts/agent-core';

const workflow = defineWorkflow({
  id: 'count-records',
  nodes: [{
    id: 'count',
    description: 'Count the records supplied by the App',
    run: ({ records }) => ({ count: records.length }),
    routes: [route.deliver('count')],
  }],
});

export const agentTests = [{
  id: 'counts-records',
  layer: 'node',
  run({ runScenario }) {
    return runScenario({
      setup: ({ execution }) => ({
        agent: new AgentCoreEngine({ workflow, execution }),
        state: { records: ['first', 'second'] },
      }),
      verify({ result, modelCalls }) {
        assert.equal(result, 2);
        assert.equal(modelCalls, 0);
      },
    });
  },
}];
```

运行 `node "$TEST_AGENT" --fixture ./test/agent-tests.mjs --case counts-records`。通过时，Node 测试报告显示 `node/counts-records`。

`runScenario` 接受上面的离线用例合同，默认沿用当前测试的 `id` 和期限，使用固定模型回复并继承测试的取消信号。直接测试 Tool 时，把测试信号交给绑定或调用。用合成依赖隔离外部服务，每个用例自己准备状态与断言。脚本使用 Node 测试报告，失败时返回非零退出码。`--layer` 与 `--case ID` 可重复，分别按层或用例 ID 选择。

## 解读证据

检查器与 diff 建立静态声明事实。diff 的 `hasChanges: false` 表示已比较的投影字段没有差异；缺少的可选部分仍未检查，handler 函数体、条件实现和外部端口不参与比较。diff JSON 的新增 `evidence` 字段说明此范围。scenario 通过表示 fixture 的验收回调接受了脚本化执行，不表示所有业务属性都有断言。请求恢复、交付持久化、未知写入与副作用重放须通过 App 对应端口及明确断言验证。注册图和通过的用例均不提供真实模型或生产证据。

## 选择流程组织方式

按完整业务责任选择用例节点，按新证据选择受约束探索，按相似执行阶段与工具钩子选择[矩阵范式](examples/lifecycle-matrix.md)。三者共享授权、合理预算、成果保留和真实交代要求，不强求拓扑一致。矩阵的模型意图、工具与参数可同次取得，程序推进已知步骤；用真实调用而非节点数评价消耗。检查器和 diff 支持可选矩阵声明与运行关联，语义质量仍需真实模型证据。

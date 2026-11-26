# Agent Core SDK 接口改造清单

本文保留接口改造的基线、渐进对照与长期目标，不再作为全部“待实施”的清单。当前接口以[公开 API 手册](../../../packages/agent-core/development/docs/api/README.md)和实际声明为准；完整状态由[计划 C 覆盖矩阵](plan-c.md)统一，B 的运行改造以[计划 B](plan-b.md)执行记录为准。历史基线不是现行兼容入口，下文长期目标也不表示已有 API 或已经取得实施授权。

## 已有基础与后续范围（2026-11-04 复核）

已落地 Workflow 默认入口、普通 `run` 节点、`workflow.add`、实例 `fork`、绑定后的 `run(state, { signal })`，以及节点调用已绑定工具时自动关联诊断和取消。Banker 与小可乐的主流程、恢复和委派调用点已改用绑定执行。其余章节保留基线和目标作为对照。

SDK 已提供模型注册和节点作用域，Runner 在每次运行内按需创建。两端业务模型的进一步生命周期接线归 B4，不从旧调用方式反推现行合同。B1 已接入统一 `execution.observe.event` 与节点运行中的 `context.report({ payload, subs })`；节点结束时的 `report(update)` 仍可提供补充资料。两者共同使用 Core 的事实身份及有界 reported 数据。旧执行入口已移除；自编排继续使用显式 StepOutcome 的 `run(step)`，不恢复 runUntil 或旧 undefined-as-continue。接口整改及验证结果见[实施状态](../records/api-implementation-status.md)。

本轮将小可乐的请求分流定义移到模块级，运行只绑定本次请求的处理依赖，并将节点上下文改读 `roundIndex`。Banker 的主决策分发和兴趣交付共用 Loop 提供的工具调用，工具记录自动挂到分发节点。Candidates 示例使用绑定的默认模型，省略自定义纯文本传输、节点诊断传递及旧执行入口。两端业务模型的完整作用域迁移仍在清单内。已移除重复的工作流执行入口，Answering Kit 与仓库测试均迁到绑定后执行。

## 1. 三种简化方式

| 方式 | 内置 | 提前配置 |
| --- | --- | --- |
| **缺省**。省略可以确定的配置 | 省略 Workflow 入口时，从首节点开始 | Agent 绑定 Workflow 后，`run(input)` 省略 Workflow |
| **复用**。直接用已有定义，或复制后只改差异 | 直接使用 SDK 提供的普通节点，按需覆盖原字段 | 用 `baseWorkflow.add(...)` 扩展已配置的公共流程 |
| **代指**。用明确的引用指向已有定义 | 使用内置 ID 引用 SDK 提供的能力 | 用 `toolId` 引用已经注册的工具，调用时只补输入 |

验收用同一个业务从简到繁。要改变默认行为，就补回原字段。要定制已有定义，就复制并覆盖差异。要换引用，就改对应的 ID。构造、运行和取结果沿用原写法。权限、写入条件和数据去向按原合同校验。

## 两类改造的复盘与下一批检查

**入口做减法。** 先分清一份配置的生命周期。Workflow、模型配置、固定依赖在装配处绑定，运行只提供本次输入和必要覆盖。单模型可以直接配置，多模型通过已登记的 ID 代指。并发运行各自拥有预算、回执、取消和状态。首选调用从最小到复杂始终是同一个 `run(input, options?)`，低层循环单独说明，全部消费者使用现行合同，不保留迁移签名。

**配置做减法。** 从实际调用统计完整规则，像交付已就绪结果、按完成协议决定去向。专用生成器复用判断、表达意图并给出可推导的默认值，输出普通配置。Workflow 根据已有字段校验并解析 `conditionId` 占位符，省略的标识留空。生成器自己的命名习惯留在生成器。业务一次性条件直接写普通 `when`。

| 优先级 | 历史基线中的负担 | 当前归属与渐进验证 |
| --- | --- | --- |
| 1 | Banker 的决策和委派、小可乐的提议、编排、复核在多处传递诊断 | SDK 已由节点作用域绑定模型／工具调用；B4 继续核对实际 App。增加记录输出只改装配，验证父子链、共享预算及即时／结束报告 |
| 2 | SDK 的最小示例能绑定 Workflow 与模型，实际两端仍把稳定定义和请求依赖一起装配。Banker 的决策、知识回答与委派共用请求 Runner | 从真实入口逐项区分可提前绑定的定义与按次资源。用同一业务验证第二次请求只传变化数据，并保持同请求的共享预算和授权 |
| 3 | 原工具目录提供两套绑定入口 | 已合并为 `catalog.bind`。绑定结果以 `invoke` 为异步入口，显式同步用 `invokeSync`。Banker 与 SDK 示例已迁移 |
| 4 | 旧 Workflow 曾有 `roundIndex` 与废弃 `round` 并存，Engine 有重复执行入口 | A 已迁移消费者并拒绝旧字段，现行使用 roundIndex／startsRound／maxRounds；不再登记为待建兼容能力 |
| 5 | 模型阶段、传输与模型 ID 有时在声明和调用两处重复选择 | 默认文本调用只给输入。接入结构化决策时引用已登记的传输或阶段。以同一个 Banker 决策请求核对切换交互格式时预算、回执与结果结构 |
| 6 | Kit 接入方式跨资料、检查、交付和持久任务，单凭签名无法判断真实重复 | 从 Banker 知识回答和小可乐复核各取一条调用链。只有已有定义、共同规则或可代指的注册项才提取。以原入口上增加一项检查或数据来源作为验收 |

每项整改先给同一业务的旧写法、最小写法和进阶差量。审查时指出被删掉的决定或接线来自哪里，并标明由哪个现有合同接管。

## 2. 贯穿示例与现状对照

用同一个服务状态查询贯穿 Agent、Workflow、模型、工具和诊断。请求输入为服务名。基础版返回状态，进阶版在线时查询延迟，失败时可返回已取得的状态。模型可以在更高一级加入，用来识别请求意图，仍在同一张图里编排。

下表左列保留改造前反例，右列解释同一合同的简化方向；不能照左列接入或据其判断当前仍有旧入口。

| 位置 | 改造前写法或负担 | 现行方向与后续核对 |
| --- | --- | --- |
| Agent 执行 | 旧 `runAgent({ workflow, state, app })` 重复传固定定义 | 绑定 Workflow 的实例使用 `run(state, options?)`；自编排实例可用 `run(step)`，两者共用当前预算和取消，不保留旧 runAgent/runUntil |
| Workflow 入口 | `entryNodeId` 与入口节点的 `startsRound: true` 均需配置 | 首节点作为默认入口，入口默认计入首轮。显式入口和额外轮次边界仍用原字段 |
| 节点 | `run` 与 `invoke.call/saveAs` 两套写法 | 节点统一使用 `run`。通过直接使用或复制普通节点减少重复配置 |
| 工具 | 节点从 `app` 取得工具实例，再将诊断传给调用 | 固定注册一次，节点给工具 ID 和输入，Loop 提供当前运行作用域 |
| 模型 | provider、runner、阶段、传输、诊断常在多个调用点反复选择 | provider、默认模型和传输装配一次。只有需要改变行为的调用才显式指定阶段、传输或预算 |
| 诊断 | Engine、Runner、工具和节点回调之间重复转交诊断 | execution 注册观察／输出；context.report 提交运行中报告，节点 report 提交结束补充。Core 记录身份和边界，App 只提供约定数据 |

### 2.1 Agent 与 Workflow 的渐进配置

已有绑定路径的渐进示意。示例节点由应用提供，`lookupService` 是一个带 `run` 和完成路由的普通节点。`readLatency` 与 `statusOnly` 也遵守同一合同；可执行版本见[服务查询示例](../../../packages/agent-core/development/examples/workflow-node-invoke.mjs)。

```ts
const workflow = defineWorkflow({
  id: 'service-status',
  nodes: [lookupService],
});

const agent = new AgentCoreEngine();
agent.bindWorkflow(workflow);
agent.bindToolRuntime(serviceTools);

const result = await agent.run({ name: '演示服务' });
```

首节点作为默认入口及绑定方法已实现。已知 Workflow 时可随构造选项提供，省略后可用 `bindWorkflow` 绑定一次。一个实例绑定一个 Workflow；单一模型配置和工具运行时可用 `bindModel`、`bindToolRuntime`，其他登记方法按各自目录合同使用，不新增泛化的 registerTools 层。引用在所属边界校验；Workflow 的 add 返回新定义，进行中的运行不偷偷切换定义。

下一步只把 Workflow 的 `nodes` 改为以下内容。原来的查询处理器、离线完成路由与 `agent.run` 调用都可以照用。

```ts
nodes: [
  {
    ...lookupService,
    routes: [
      { when: ({ status }) => status.online, targetNodeId: readLatency.id },
      ...lookupService.routes,
    ],
  },
  readLatency,
]
```

如果延迟查询失败时要返回已有状态，就把 `readLatency` 替换为 `{ ...readLatency, onErrorNodeId: statusOnly.id }`，再加入 `statusOnly`。如果需要改变查询行为，就覆盖 `lookupService.run`。模型意图判断也是增加一个普通节点和它的路由。若它需要成为入口，使用同一个 `entryNodeId` 字段。App 入口始终调用同一个实例。

请求取消、用户身份和临时上下文属于每次运行。下面的调用只增加取消能力，第一参数和返回值合同保持一致。

```ts
const result = await agent.run({ name: '演示服务' }, { signal });
```

在实现中明确区分请求输入和内部可更新状态。请求数据初始化一次，内部状态、回执、计数器及运行身份每次新建。固定工具实现和 provider 可以共享，带请求预算的 Runner、接收本轮授权信息的执行上下文和其他可变对象按运行隔离。

### 2.1.1 从现有实例生成升级版

已实现的进程内派生用法如下。原实例与已开始的运行继续使用原定义；这里不包含宿主持久接续或成果合并。

```ts
const upgraded = agent.fork({
  at: agent.checkpoint(continuation),
  workflow: extension,
  resume: restoreBranchDependencies,
});

const result = await upgraded.run({ name: '演示服务' });
```

- `agent.workflow` 公开当前已绑定的 Workflow。
- `workflow.add(extension)` 接收普通配置或另一份 Workflow。新增节点与接入路由一起声明、一起校验，返回新的 Workflow。接入关系沿用 `routes`，同名节点冲突时报错。另一份 Workflow 的完成路由仍表示结束当前运行。需要回接原流程时，显式指定后继节点。
- `agent.fork({ at, workflow, resume })` 从源实例的检查点派生，保留 Agent 身份，分配独立的分支和版本。复用固定模型配置，宿主按检查点重新绑定 App 依赖和工具运行时。
- `run` 的调用方式保持一致。日志区分实例派生关系和运行父子关系。升级版单独运行时有自己的运行 ID 与定义版本。问答内委派继续通过已有子执行作用域传递父级取消、预算和日志关联。

验收使用同一个服务查询。基础实例只查询状态，升级版通过 `add` 加入在线时读延迟的节点和条件路由。两者使用同一请求合同，分别从自己的定义快照提供主图数据。

Workflow 可以独立复用。只有共同流程时，直接扩展 `baseWorkflow`，再创建一个 Agent 并登记所需依赖。公共流程可以只是一份供复用的定义。

```ts
const agent = new AgentCoreEngine();
agent.bindWorkflow(baseWorkflow.add(latencyExtension));
agent.bindToolRuntime(serviceTools);

await agent.run({ name: '演示服务' });
```

基础 Agent 自身也承担一项可独立运行的业务时，可以用 `fork` 从这个已有实例派生变体，复用它已经登记的工具、模型和日志配置。每个变体只写自己的流程差异，并按需登记专属依赖。

```ts
const at = base.checkpoint(continuation);
const withLatency = base.fork({
  at, resume: restoreBranchDependencies,
  workflow: latencyExtension,
});

const withMaintenance = base.fork({
  at, resume: restoreBranchDependencies,
  workflow: maintenanceExtension,
});
```

两个成员的流程差异都相对于 `base`，分别在派生时校验。成员的专属工具只登记到该成员的注册快照，调用仍按请求校验授权。主图按各成员的定义快照生成，日志可区分成员及定义版本。同一套 `run(input)` 适用于基础实例和派生成员。

### 2.1.2 有血缘的 Agent 分支

Core 已支持内存检查点和分支身份，日志可按 Agent、分支、版本和工作流调用区分。`src/execution/engine.ts` 用源分支的 WeakSet 核对 checkpoint 并克隆数据；resume 由宿主重绑依赖。Banker 和小可乐的宿主持久接续、合并与上岗仍为 R3，下列家族语义是目标，不能从现有 fork 推导出已经交付。

- **新建**。即使复用完全相同的 Workflow、配置和导入资料，也建立独立 Agent 身份。
- **分叉**。从明确的分叉点建立工作分支，保留稳定 Agent 身份，另分配分支、定义版本和运行标识。宿主未来可按合同接续会话上下文、记忆和任务关联，但 fork 本身不继承有效业务授权。授权来源、范围、期限与副作用执行归属由宿主重新核对。
- **合并**。复杂任务的支线完成后，由主线选择性接纳成果。保留来源与分叉点，明确冲突处理和批准责任。历史执行与外部副作用各自保留原记录。
- **上岗**。Agent 可分叉并升级 Workflow。候选版本通过宿主验证后，由宿主切换原入口所指向的版本，延续用户关系和可接续的上下文。候选验证失败时，当前在岗版本继续服务。

分叉、成果合并和候选上岗分别建模。进行中的任务、提醒及外部操作始终只有一个执行归属。明确交接成功后才能转移，重试须防止重复执行。分支身份与运行关联由 Core 使用通用标识表达，会话、记忆、授权及上岗政策由宿主负责。

### 2.2 工具与模型

工具节点继续是普通函数。绑定工具运行时后使用节点的 tools.invoke，Core 自动沿当前节点关联取消和诊断，保留原有命名请求与结果结构。实际 App 是否已完成相同迁移由 B4 核对。

```ts
async run({ name }, { tools }) {
  const { value: status } = await tools.invoke({
    toolId: 'lookup_service',
    input: { name },
  });
  return { status };
}
```

`tools` 由 Loop 从已登记的工具生成本次节点的调用作用域。增加权限控制时，修改同一个工具定义的 `authorize`。增加结构约束时，在同一个工具定义补 schema。调用点和 `{ value, invocation }` 保持一致。注册的工具必须经过原有解析、授权和执行路径。应用需要读节点与工具的静态关联时，应复用显式声明的引用或节点元数据。普通回调动态计算的目标只能由实际执行记录给出，主图不得猜测回调内容。

模型继续使用原有的 `invoke({ input, ... })`。基础模型调用只给输入。需要结构化意图时，先登记传输，再在同一个调用补上 `transport` 引用。需要某次调用不同的输出预算时，再加 `maxOutputTokens`。这些选项各自只改变其描述的行为。

```ts
const { value } = await model.invoke({ input });
const { value: intent } = await model.invoke({ input, transport: 'status-intent' });
```

两行是同一节点的两个版本。Agent 内的模型调用和独立的 `ModelRunner` 使用同一请求与结果合同。文本与结构化值都从 `value` 读取。默认模型、传输与阶段的选择必须可查，结构化结果仍走原有 schema 和验证。模型需要参与业务分支时，结果写回节点状态，再由该节点的路由选择后继。

### 2.3 诊断、日志与主图

基础示例无需配置日志。进阶在 execution 登记旁路监听或持久输出，原来的 run、模型与工具调用保持原样。Core 为运行及每次节点访问建立身份，记录进入、完成、路由、错误和子调用关系。节点以 context.report 在运行中提供 payload／subs，也可保留结束 report；这些资料与状态补丁分开，不把普通状态字段当作报告。内容采集与脱敏范围继续按各消费者策略执行。

Journal 与诊断遵循同一事实源和关系键，沿用[日志与调用链合同](../../../packages/agent-core/development/docs/api/observability.md)。Workflow.describe、能力目录和工具清单已有实际登记投影，它们不是现成的图／链查询服务，也不运行请求来补图。App 的 message record 持有 Core 运行关联键，Core 的定义和日志合同无需 App 消息身份。

R1 的最新实验方向以[后台实验规划](../../../../main/apps/web-admin/docs/agent-execution-atlas-experiment.md)为来源：最新主图作为底图，所选日志按真实关系补临时历史节点；有自报分步时临时增链，无分步则保留主节点与主边。不要求完整历史定义快照，不恢复更早的静态局部子图注册、挂载端口或递归展开候选。当前定义边、日志证明的转移和 reported 局部资料分别表达，未记录关系保持缺口。图数据／链查询合同及 App message→run 授权关联仍须明确，UI 继续仅规划。

2026-11-04 已按实际执行链修订 R1：Loop 不在节点之外自主调用模型选路，撤回 Bus thinking 类别。应用登记的模型提议／决策节点属于主图；低层 run(callback) 的模型请求由 App 回调发起，不自动获得 Workflow 节点身份。现有日志接口已允许主／子节点上报本次自身的 usedModel 布尔值并随日志保留，未上报保持未知；子树汇总不改写原标记。后续图中“思考型”为实例显示属性，展开按自身标记、收起按子树汇总，不新增虚拟节点。所有节点用圆形、大小区分主子等展示规则只归管理端，仍待图形实施，不写入 Core 合同。

子日志生产入口已收紧为节点创建并绑定本次执行的 SubFlowLogger 实例，通过 write／fix／readAll 写入、补全和读取；不接收手写数组或普通对象，规范存档仍输出固定结构数组，缺省为空。write 先留下意图和时序，fix 补后续结果，短路／取消时保留已送出的计划及未知结果；补全追加修订事件，不改写已输出日志或已确定事实。Workflow、简易 Loop 和工具继续复用现有 report／诊断出口及内容策略，普通状态更新与报告分开。实际合同见[SDK 使用手册](../../../packages/agent-core/development/docs/api/observability.md#子日志实例与先记后补)。日志改造是现有接口实施；只有出图、播放和 Jangts 后台渲染仍为 R1 规划，不增加实际模型请求或子图调度 API。

## 3. 其余主要接口逐项审查

以下清单用同一个服务查询举例。复杂度应通过原有声明或选项增加。已经符合这一规律的接口以保留调用形式为验收结果。实际实施前按公开符号参考补齐到具体导出，避免只整改演示路径。

| 接口组 | 入门 → 进阶 → 更复杂 | 整改检查 |
| --- | --- | --- |
| Schema、解析、校验与拒绝 | 验证服务名 → 同一 schema 增加字段约束 → 同一合同增加跨字段校验 | 复用同一 schema 给模型和运行时。布尔判断、抛错校验和问题报告各自保持明确语义。保留 `breakWhile` 的 `occur` 命名 |
| 能力、意图、协议与目录 | 登记查询能力 → 补充可用条件 → 为受限操作附授权与分发规则 | 清单参与投影、校验和分发。已有目录使用相同查询约定，引用处使用同一个 ID |
| 上下文、片段与压缩 | 使用服务名 → 加一个查询结果片段 → 增加预算、保留原文策略和压缩规则 | 策略随同一上下文定义逐步添加，调用方无需同时组装多份模型输入 |
| Provider、交互、阶段、流与预览 | 默认 provider 返回状态 → 增加结构化传输 → 配置流式接收或受控回退 | 保持同一模型调用和最终结果。预览通过既有观察或交付端口传递，不能变成新的结果模式 |
| Knowledge、Evidence、Retrieval 与检索融合 | 读已知服务资料 → 按版本或选择读取 → 增加索引、向量检索或融合策略 | 逐层配置数据来源，保留资料身份和证据引用。局部检索算法继续保有自身的参数与结果 |
| AnswerTask、检查、AnswerFlow 与输出 | 交付状态文本 → 登记一项事实检查 → 增加局部修复或结构化输出 | Kit 的入口与局部合同保持可独立使用。检查、修复和输出的增加不改写 Core 节点合同 |
| Policies、Candidates、Normalization 与 Delivery | 交付一个状态 → 归一化候选结果 → 对多个候选增加选择与交付规则 | 复用已有校验和输出边界。规则登记的位置与实际分发一致 |
| Projection、Aggregation、TextSkills 与 Artifacts | 返回单条状态 → 聚合多个服务状态 → 生成可交付产物 | 各算法按输入输出职责演进。相同选项保持一致含义，产物交付使用已有端口 |
| Durable 与子执行 | 执行一次查询 → 加运行检查点 → 恢复已确认的结果或在共享预算内调用子流程 | 保持任务身份、恢复和授权保证。持久副作用需显式配置。子执行预算与取消继承须有独立回归 |

Support 继续辅助生成 Core 可消费的声明。Kit 由 App 节点自行使用，Core 的通用执行协议只承载共享保证。各组现行签名见 [Core](../../../packages/agent-core/development/docs/api/core.md)、[Support](../../../packages/agent-core/development/docs/api/support.md)和 [Kit](../../../packages/agent-core/development/docs/api/kits.md)。

## 4. 实施顺序与完成条件

1. **锁定基线。** 从公开导出、文档和 Banker／小可乐的真实调用点建立迁移表。标记每个字段属于固定定义、实例依赖、请求输入、运行内部状态还是记录元数据。记录已有权限、预算、取消、结果和错误语义。
2. **收敛 Workflow 与实例。** 移除 `invoke.call/saveAs` 及配套文档。为入口加默认值，并验证显式入口、循环和错误路由仍受预算约束。确定实例注册与快照边界。统一首选 `run(input, options?)`，把低层回调循环和旧调用迁移单列，避免同一个方法根据内部状态解释两种参数。
3. **收敛工具、模型和诊断。** 让 Loop 装配调用作用域与日志。沿现有解析、授权、模型传输和诊断端口迁移。并发请求要验证身份、回执、预算和取消互相隔离。实例升级另验收原定义保持、注册复用、定义版本可区分和并发运行隔离。失败、取消、恢复路径要验证记录关系与状态提交顺序。
4. **迁移实际消费者。** 用 Banker 的上下文、模型决定、工具分发和交付，以及小可乐的候选、复核、修复和兜底核对职责。把稳定装配移出请求路径，把业务判断留在已有 Workflow。需要按用户计算的授权、历史与回执保持请求级。
5. **逐组检查其余入口。** 按第三节分别留下同业务的最小版和差量版。只有确实需要改变合同的入口才改代码。同步 SDK 与真实消费者并更新公开类型和 API 参考；不为旧入口、配置、持久记录或日志增加兼容转换。
6. **按差量验收。** 从最简服务查询依次加在线分支、恢复、模型判断、权限、预算与日志。每一步都能用源码 diff 指出新增业务行为的位置。相同输入在仅加诊断时应得到相同结果。新手文档、进阶文档和真实 App 应能对上同一套配置和执行概念。

每批交付注明实际运行的类型、离线回归与应用验证范围。图形化实验与生产发布分别验收。

`fork` 默认继承原 Workflow。传入 `workflow` 时，内部调用原 Workflow 的 `add` 完成组合和校验。独立新建实例时，可以直接调用 `baseWorkflow.add(extension)`。

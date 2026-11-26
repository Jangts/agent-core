# 从当前实现迁到统一合同

## Support 入口

根入口的 `Support` 与 `@jangts/agent-core/support` 使用同一组导出。意图与范围目录从 `/kits/intents` 导入，交互协议从 `/kits/interaction` 导入，工具生命周期从 `/kits/tools` 导入。

## Journal 模型回执

用 `journal.model({ stageId, value, invocation })` 记录模型结果，沿用实际调用的标识与耗时。ModelRunner 会自动记录自己的调用。

## 文本传输

使用 `Support.createTextTransport({ id: 'text' })`，需要设置温度时在同一配置中加入 `options: { temperature }`。

## 诊断入口

使用 `createDiagnostics({ output, runId, spanId })`。省略输出可直接调用
`createDiagnostics()`。旧位置参数与历史日志读取分支均已移除。
Workflow 节点的 `debugSteps` 已统一为 `report(update)`，返回可选的 `payload` 和 `subs`。
节点上下文统一使用 `app` 和 `roundIndex`，旧的 `runtime` 和 `round` 已移除。

## 上下文装配

`builder.build(input, maxInputChars)` 和 `builder.plan(input, maxInputChars, originalFragments)`
改用命名请求。预算能在创建 builder 时确定的话，设置 `maxInputChars` 后调用
`builder.build({ input })` 或 `builder.plan({ input })`。
上下文 builder 从 `Support` 或独立的 `@jangts/agent-core/support/context` 获取。
Core 的 `@jangts/agent-core/context` 继续提供 `assembleFragments`。

## 工具目录绑定

工具目录的 `createRegistry` 与 `createRuntime` 已合并为 `catalog.bind({ app, execution })`。
默认用 `tools.invoke({ toolId, input })` 异步执行。需要同步执行时，在同一个绑定结果上用
`tools.invokeSync({ toolId, input })`。模型能力投影和工具调用回执仍可从绑定结果读取。

## 工作流执行

旧的 `runAgent({ workflow, state, app })` 和 `runWorkflow(...)` 已移除。
构造时提供 `workflow` 和所需的 `app`，或者调用一次 `bindWorkflow(workflow, app)`。
之后用 `agent.run(state)` 执行，每次只传运行状态。

**现行迁移指南（2026-11-04）。** [返回首页](../../../packages/agent-core/development/docs/api/README.md)。表中的“当前”指审查时的迁移前快照，实施结果见[实施状态](api-implementation-status.md)；“目标”对应现行合同，不以增加别名代替收敛。

## 入口和调用输出

| 当前 | 目标 | 迁移要求 |
| --- | --- | --- |
| root、root.Support、/support夹杂不同层接口 | Core根、根Support、单项Kit具名导入 | 根Support与独立/support同源；Kit从所属模块导入，现行聚合路径转出同一实现 |
| WAITP/WebAITransferProtocol、WAIIC/WebAIInvokeCommands | InteractionProtocol、CommandCatalog | 旧别名已移除；Interaction 命名空间继续引用同一构造器 |
| /types仅Provider家族，/structs又有运行值 | /types统一类型导入；根及所属模块也可type import | /structs保留历史类型／常量，不作为运行值首选入口 |
| invoke返回裸string／结构值／unknown | 模型与工具统一InvocationResult `{ value, invocation }` | 迁移调用方读取value，不能靠输入短写切换新旧输出 |
| 本次新增输出封装的设计约束 | 统一成功外形；流、事件有独立接口 | 不引入raw/fullResponse开关，失败继续抛错／拒绝Promise |
| named与长位置参数并列推荐 | 一种首选命名调用；简单标量查询保留单参数 | 旧写法移除，不静默合并两套配置 |

同一模型输入的字符串短写和对象写法必须得到同一种ModelResult；泛型只改变value类型。跨App迁移同时检查回复正文、工具回执、流式最终值、日志和文档示例，不能只让TypeScript通过。

## 标识、schema与校验

| 当前 | 目标 |
| --- | --- |
| Tool.name、Intent.goal作为主键 | id；显示名称另用name |
| ToolProposal.tool、ModelSelection.capability | toolId、capabilityId |
| KnowledgeRead.document/select.sections | documentId/selection.sectionIds |
| AnswerTask.reader/output/checks/intents | readerId/outputId/checkIds/intentIds |
| Intent.scope/target为模式，Task.scope为选择 | scopePolicy/targetPolicy 与scopeId/targetId |
| ModelCapability.input及parse(value, stage) | inputSchema: SchemaAdapter加resolve(input, { stageId })；保留阶段转换，工具提议不提前执行业务parser |
| Tool.inputSchema裸JSON或adapter联合 | inputSchema固定SchemaAdapter，裸JSON先经Support工厂 |
| AnswerTask.parameters.schema/parse | inputSchema: SchemaAdapter |
| TextSearchSnapshot.schema字符串 | configurationFingerprint，不能冒充JsonSchema |
| boolean/void/CheckResult都叫validate | is/assert/check；转换使用parse |
| authorize返回false或void | 通过void，拒绝抛错；误返boolean拒绝，不能当授权通过 |
| AnswerChecker.validate(context,value) | check(value,context) |
| 静态Definition带请求signal | Definition编译一次，请求context在run时传 |

外部wire中的function.name/parameters、App自己的命令字段、已有HTTP协议不是SDK登记类型。应在适配边界映射，不能为统一SDK而批量改写外部协议或放松校验。

## 集合、结果和类型

| 当前 | 目标 |
| --- | --- |
| get有的返回undefined、有的抛错 | get可缺失，require必须存在 |
| definitions同时为数组和Record | definitions只读数组，byId显式Record |
| entries属性是数组／entries()是Map迭代 | definitions数组、entries()/values()保留迭代语义 |
| registerAll有的自动seal、有的不seal | registerAll仅登记，seal显式；defineCatalog直接返回只读快照 |
| `ToolRegistry.invoke<Output>`自报结果类型 | 低层`ToolResult<unknown>`，高层由登记ID推断 |
| select后仍保留全部原工具联合 | 静态ID选择后同时收窄实际集合和类型 |
| fields与document表示搜索载荷 | SearchHit.document；部分字段仍用Partial类型，不伪造全文 |
| 类handler被展开后方法／this丢失 | 固定原方法引用并绑定原接收者，覆盖全部注册器 |
| 可写events／结果活引用 | 只读视图或副本，明确所有权 |
| OutputIssue只有code/path、ValidationError.errors另一结构 | 共享Issue，中央归一保留message/path |
| observer与sink都只是on* | observe旁路、sink等待；失败处理不互换 |

## 字段单位和控制语义

- ModelOptions 与 Provider 配置统一用 maxOutputTokens，分别表示本次请求额度与供应商配置上限。
- Engine.maxSteps迁为maxRounds；Workflow.round为startsRound，运行上下文round为roundIndex。
- AnswerItem.source状态迁为sourceStatus；TextSkill.status固定类型迁为kind。
- ContextPlan.contextFragments迁为fragments；BuiltContext.fragments用量元数据迁为fragmentUsage。
- 工具关联统一invocationId，不能将两个独立计数器只改成同名。
- type用于消息／事件判别；领域kind和资源status不合并。
- 终值可为undefined的调度使用显式continue/complete；普通read/parse/search不套控制信封。

## 持久化与序列化

SDK 和 App 以全新合同同步发布，不读取或升级旧格式。

| 对象 | 当前格式 | 执行要求 |
| --- | --- | --- |
| DurableCheckpoint | version=2、definitionId/nextStepIndex/attemptCount/deadlineAtMs | 锁内校验和保存，恢复当前任务不重置次数或期限 |
| TextSearchSnapshot | version=2、configurationFingerprint/serializedIndex | 指纹使用现行配置名称；不匹配的缓存拒绝，从 App 权威记录重建 |
| CoreDiagnosticEvent | version=2、eventId/type/producerSequence/occurredAtMs | 只校验当前信封，不转换旧字段或合成缺失身份 |
| ArtifactReference | resolverId/artifactId/revision? | 直接解析现行引用，不提供 kind/id 转换 |
| App任务/反馈/运行记录 | App自己的现行格式与保留期 | 不复制问答、不改账号归属、不延长期限 |

输出包裹层改变后，持久化业务值仍取result.value，不能把模型调用元数据、内部协议或额外隐私字段顺带写入聊天正文、画像或长期知识。

## 实施与验证顺序

1. 共同类型、授权拒绝、同步误返Promise、注册接收者、Issue与事件类型先收敛。
2. 模型／工具调用统一输出，迁移全部消费者，再改schema、ID和校验语义。
3. 集合操作、静态定义／请求运行、泛型推断、只读所有权按概念成组迁移。
4. App 与 SDK 同步使用当前数据结构；移除旧入口和历史转换，统一指南和类型样例。

需验证同样的输入短写不改变返回形状、value推断正确、拒绝不会变通过、未知ID行为一致、观察不影响业务、事件与实现一致、恢复当前检查点不获得新额度。文档目标是合同依据，不是替代这些验证的完成证据。

## 同步发布与真实消费者

这次包含同名方法返回值变化，属于破坏性合同升级。新旧 invoke 不能靠输入形状、raw 开关或旧路径别名区分。仓库内同步迁移公共包与全部消费者；独立第三方接入按包版本区分，新版本采用新合同。开发期旧参数与类型别名已经移除，现行聚合路径共享同一实现。私有包当前 0.1.0 不表示可以忽略消费者。

已同步处理的真实消费边界：

- Jangts 的模型阶段使用现行 invoke 与命名请求，阶段结果处理读取 result.value；跟踪与错误工厂保留在对应阶段和观察接线。
- Banker 的 embedding runtime 与启动探针提取 ModelCalls 结果 value；业务检索、向量维度／identity 与索引兼容检查维持原顺序。
- Tools Kit 委托 Core 执行，executeInvocation 与 Journal 沿用同一 invocationId，外层不重复记录相同写操作。
- cafe 的类型、协议和流适配按现行 exports 检查，不能因为没有模型调用就排除消费者。
- 不受限的旧预算输入改为明确限制；预算拒绝、取消和截止时间仍由真实执行边界保证。

本项目不承担历史格式兼容。SDK、App、索引、持久任务与日志统一使用当前合同；旧格式输入拒绝，不保留迁移接口或分阶段升级部署要求。本次代码整改不包含清库、删除线上记录或运行数据转换。

## 日志与Journal关联

按[调用链与存储合同](../../../packages/agent-core/development/docs/api/observability.md)统一事实身份，贯通HTTP请求、Core、Provider、Journal及异常收尾；App日志适配解开旧双层信封，将关联列置于顶层。旧callId不得只改名称冒充执行器invocationId；没有证据的旧父关系标记缺失。运行日志仍使用既有配置与保留期，本次合同不自动授权建表、迁库或扩大正文保存。

### 拒绝检查字段（2026-11-03）

单项拒绝检查改为 `{ occur, error?, tags? }`，ProtocolCheck 同步；`when` 仍只控制是否启用检查，批量 OR 谓词也写作 `occur: [() => failureA, () => failureB]`。直接调用写作 `breakWhile(occur, error?, tags?)`。旧对象字段 `condition`／`conditions` 会报迁移错误，避免漏做拒绝检查。错误优先级、首次拒绝即停止与惰性原因计算保持原样。

## 本轮剩余合同的收口

- ContextFragment与fragmentUsage的来源身份为sourceId；ContextModelCall统一命名请求与ModelResult，handlerId是压缩／选择引用。
- ModelCallTrace与ToolExecutionEvent使用InvocationMetadata及success/error/cancelled；App业务评审结论另存outcome。Journal使用type、producerSequence、value，只接受 success/error/cancelled 状态，不再输出callId/name/stage副本字段。
- Core新日志写v2：version/type/occurredAtMs/producerSequence，normalizeDiagnosticEvent 只校验当前 v2，不转换旧字段或生成缺失身份。FileLogSession.recordFact在App侧平铺保存，不把Core事件再包装进payload；外层sequence与recordedAtMs由收集器拥有。
- 交付辅助publishReplyEvents、writeSseFrame、streamEvents采用命名请求／执行context；旧位置调用已移除，保留背压。
- 目录／协议的旧inputSchema裸JSON、schema、parameters等按上文章节显式迁移；同步assert返回非undefined均拒绝。纯算法仍直接返回业务值。

## Journal 工具回执

`beginTool({ toolId, input, invocation? })` 返回调用 ID，用
`finishTool({ invocationId, status, value })` 结束同一次调用。
自定义 `ToolJournal` 实现使用相同合同，取消状态统一写入 `cancelled`。

## 模型阶段

阶段条目使用 `{ id, capabilityIds }` 引用能力。传输的 `capabilities` 提供完整能力目录。
同一阶段策略可以复用到多个传输，分别配置模型交互适配器。

## 模型调用计数

使用 `model.callCount` 读取当前 Runner 的计数。含子 Runner 的共享预算消耗用
`model.totalCallCount`。旧的 `model.calls` 已移除。

## 模型调用入口

将 `model.call(stageId, input, maxOutputTokens, transportId)` 改为
`model.invoke({ stageId, input, maxOutputTokens, transport })`。模型调用结果继续使用
`ModelResult`。观察调用时使用 `execution.observe.event`（按 `model.end` 读取 `payload.state`），配置供应商行为时实现 `ChatProvider`。

命名模型请求统一用 `stageId` 和 `input`。纯文本仍可直接写
`model.invoke('你好')`。需要系统指令时写 `model.invoke({ input: '你好', instructions })`。

## Core 工具调用

`ToolRegistry.invoke` 和 `ToolRegistry.invokeAsync` 统一接收
`{ toolId, input }`，需要时可在同一个请求里提供 `signal` 或 `diagnostics`。

Support 的 `catalog.bind(...)` 返回的工具运行时同样使用命名请求。
异步用 `tools.invoke({ toolId, input })`，同步用 `tools.invokeSync({ toolId, input })`。

Core 和 Kit 工具注册表的构造配置把取消信号和诊断放在 `execution`，
把工具不可用错误和错误码策略放在 `errors`。

## Schema 适配

已有 JSON Schema 和编译器用 `Support.fromJsonSchema(schema, { compile, error? })`。
已有解析库用 `Support.fromParserSchema(schema, { toJsonSchema })`，转换函数从解析库的定义生成模型可见 Schema。
直接实现合同用 `Support.defineSchema({ jsonSchema, parse })`，也可将实现 `SchemaAdapter` 的对象直接传给 Core。

## Support 工具声明

`defineTool` 和 `defineToolCatalog` 接收 Core 的 `ToolDefinition` 合同，使用 `id`、
`inputSchema: { jsonSchema, parse }`、`authorize(input, context)`、`execute(input, context)`
和 `parseOutput`。`context.app` 提供应用依赖，`context.signal` 提供取消信号。
授权通过时返回 void，拒绝时抛错。旧的 `name`、独立 `parseInput` 和布尔授权格式已移除。

## 回复预览

`createReplyPreview` 使用 `sink` 输出预览，规则以 `stageId` 和 `capabilityId` 筛选。
旧 `emit`、`stage` 和 `name` 别名已移除。自定义规则的 getter 在装配时读取，
路径与准入条件生成快照，后续预览按该快照筛选。

## 兼容模型 Provider

构造使用 `new CompatibleModelProvider({ config, ports?, observe?, errors? })`，
`config` 可直接提供配置对象，也可提供动态读取函数。流调用使用
`provider.stream(messages, { signal, options?, diagnostics? })`。
错误映射放在 `errors.failure`，供应商观察放在 `observe.provider`。

SSE 写入统一用 `writeSseFrame({ writer, frame }, { signal })`。
`writer` 负责实际写入和等待 drain，执行上下文提供取消信号。

## Workflow 配置字段

Workflow 定义使用 `entryNodeId` 和 `isResult`，节点使用 `startsRound` 和 `onErrorNodeId`，
原始跳转路由使用 `targetNodeId`。旧 `entry`、`validateResult`、`round`、`onError` 和路由 `to` 已移除。
Workflow 实例同样以 `entryNodeId` 和 `isResult` 暴露对应信息。
入口省略时仍选第一个节点，该入口未填写 `startsRound` 时会开始一轮。

## Workflow 运行事件

新生成的事件使用 `workflowId`、`nodeId`、`roundIndex` 和 `targetNodeId`，
移除重复的 `workflow`、`node`、`round` 和 `to`。
诊断只校验当前格式，不提供旧字段转换；应用报告的 payload 保留业务字段。

模型选项、Provider 配置和新 `model.prepare` 诊断的输出额度字段统一为
`maxOutputTokens`。本次调用额度受 Provider 配置上限约束，两者均要求正安全整数。
供应商 HTTP 请求仍按其协议生成 `max_tokens`。

## ModelRunner 构造

五个位置参数改为单个配置对象，例如
`new ModelRunner({ provider, maxCalls, callTimeoutMs, maxInputChars, transports, execution: { signal } })`。
最小用法仍是 `new ModelRunner({ provider })`。预算参数统一在顶层配置，`config` 已移除。`ports` 中的配置按下方命名字段迁移。

ModelRunner 的取消信号统一通过 `execution.signal` 绑定，顶层 `signal` 已移除。
调用者从最小构造逐步添加取消和诊断时，只需加入 `execution` 配置。

## ModelRunner 依赖配置

移除 `ports`。传输、上下文策略和处理器分别使用顶层 `transports`、`contextPolicy`、
`contextCompressors`、`contextSelectors`。诊断放在 `execution.diagnostics`，
输出放在 `sink.output`，观察放在 `execution.observe.event`（按 `model.end` 读取 `payload.state`），预算错误工厂放在
`errors.inputBudget` 和 `errors.outputBudget`。这些合同支持实现了相应方法的实例。

## AgentCoreEngine 构造与自编排

构造统一用 `new AgentCoreEngine({ maxRounds, execution, errors, observe })`，全部可省略。
旧的位置参数、`maxSteps`、顶层执行与观察回调已移除。自编排继续使用
`run((roundIndex, context) => outcome)`，返回 `{ type: 'continue' }` 或
`{ type: 'complete', value }`。旧 `runUntil` 已移除，完成值为 `undefined` 时同样使用显式 complete。

错误诊断读取使用 `getErrorInfo(error).stageId`，旧的 `stage` 别名已移除。
重抛保留最初记录的阶段，`cause` 仍引用原始错误。

## 模型能力选择

Core 的选择结果统一为 `{ capabilityId, input }`，能力目录用
`resolve(selection, { stageId })` 解析。JSON 交互的供应商信封可以继续使用
`{ capability, input }`，由交互适配器转换到 Core 合同。

模型能力的登记与查询结果统一为 `ModelCapability`。参数合同放在
`inputSchema: { jsonSchema, parse }`，阶段结果通过 `resolve(input, { stageId })` 生成。
查询模型可见 Schema 使用 `capability.inputSchema.jsonSchema`，旧的 `input` 和 `parse` 别名已移除。
Core 及 Support 保留注册时的解析方法和接收者，投影能力清单时继续使用同一个合同。

## 模型传输注册

所有传输实现 `ModelTransportDefinition.prepare(stageId)`，返回 `options`、
`schemaChars` 与 `createResponse()`。收集器实现 `outputChars`、`push(part)` 和 `finish()`。
旧的 `decode`、`interaction` 注册方式已移除。纯文本和结构化传输可继续用 Support 生成，
自定义类实例直接实现同一个 Core 合同。

## Kit 策略与恢复

策略声明统一用 `when`，目录统一通过 `definitions` 查询。
恢复链统一调用 `tryRecover(input)`，返回 `{ handled: false }` 或
`{ handled: true, value }`。已处理的 undefined、false、0 和空串均为实际结果。
旧 `matches`、`catalog`、`recover` 声明与调用别名已移除。

## Kit 证据检查与投影

证据提供器统一实现 `isSatisfied`。检查清单使用
`isSatisfied({ observations, requirement })`、`isComplete({ observations, requirements })`
和 `missing({ observations, requirements })`。投影使用
`project({ observations, sourceIds? })`。旧方法别名和位置请求已移除。

## Kit 意图、范围与顺序处理

意图登记与查询只使用 id、scopePolicy 和 targetPolicy，ID 清单使用 ids()。
范围引用只使用 intentIds、toolIds、queryScopeIds 和 knowledgeTopicIds，
describe() 也返回这些字段。注册策略只使用 idPattern 和 assertDefinition。
两种注册器的 create 完整清单入口保留，等价于构造后 registerAll().seal()。
业务模型协议中的 goal、scope、target 仍由 App 定义，不随注册字段迁移。

Normalization 的完成判断统一为 isComplete。候选解析使用
parse({ value, allowed })，数量配置为 minCandidates／maxCandidates，旧 min／max 已移除。

Delivery 阶段统一为 id 和显式 continue／complete 结果；
beforeStage({ stageId, state }, context) 与 handle(state, context) 使用相同执行上下文，
deliver(input, execution) 必须提供真实取消信号。ContentProjection 使用
project({ value, maxChars })；TreeProjection 使用 visit(value, context)。

## Interaction 命令与分发

协议类型与工厂使用 InteractionProtocol／defineInteractionProtocol、
CommandCatalog／defineCommandCatalog 和 Command／defineCommand。
声明类型为 InteractionProtocolDefinition、CommandDefinition、CommandCatalogOptions；
交互类型使用 InteractionCategory、InteractionDescriptor、InteractionHandlers，
类别清单为 INTERACTION_CATEGORIES。旧 WAITP、WAIIC、WebAI* 及其工厂别名已移除。

ProtocolField 仅使用 jsonSchema。编译结果使用 fieldSchemas、modelJsonSchema、
inputJsonSchema、assert 和 parse，不再额外返回 schema、parameters、validate。
动态协议仍可直接实现 ProtocolShape，commandSchema 从已提供的 Schema 或动态 keys 派生模型声明。

bindInteraction(protocol, handlers) 接受结构化接收者和 handler 实现，
按注册命令固定 handler 及接收者，不要求具体协议实例。它保留选择、模式、字段归属、
结构检查及业务格式化之后再分发的顺序，不因格式器返回其他选择字段而改派 handler。

## Answering 任务、检查与流程

移除 defineAnswerTasks、defineAnswerChecks 和对应 Legacy 声明。任务目录使用
defineAnswerTaskCatalog；读取器与检查器分别使用 defineAnswerReaderCatalog、defineAnswerCheckCatalog，
依赖目录实现 ReadonlyCatalog。任务字段为 readerId、outputId、intentIds、scopeId、checkIds、
inputSchema 和 metadata；读取用 read／readAsync({ taskId, input }, context)。

AnswerFlow 只接受 AnswerFlowDefinition，generate／check／review／fallback／observe
使用命名输入和 OperationContext。运行统一为 run({ inputIds, items }, context)，
不再接受构造时绑定 signal、旧 validate 回调、source 别名及位置请求。fallback 显式返回
handled 判别结果。CheckResult 的 issues 必须是数组；path 必须是字符串／数字数组。

固定 Workflow 在定义时编译，handler 与原接收者一起绑定；请求各自拥有修复额度、
任务结果和取消信号，并获得各节点的诊断作用域。同一个 flow 可以并发复用。
Core bindWorkflow 保留无 App 的单参数调用和显式传 App 的双参数调用；泛型封装可直接传递
其 App 参数，仍禁止省略一个需要依赖的 Workflow 的 App。

## 检索、搜索与外部推理

Retrieval 统一为 run(input, OperationContext)，声明使用 assertInput、assertResult 和
errors.duplicate／errors.budget。旧 validate、validateResult、duplicateError、budgetError、
裸执行上下文及 retrieve 别名已移除。queryCount 和 limit 是非负安全整数，0 额度直接拒绝，
不改变去重、额度、授权、预占、结果验证与提交的顺序。取消在来源绑定提交前及每个 effect 前后检查，
已经提交的证据不因后续 effect 失败而回滚。

TextSearch 构造只用 indexRevision、fields、storedFields 及可选 tokenizer／排序设置，
查询用 search({ query, limit, filter })。快照只读写当前 version=2；
配置指纹使用 indexRevision／storedFields 等现行字段，不保留旧快照类型或键转换。

VectorSearch 使用 upsert({ document, vector }) 和 search({ vector, limit, filter, ...options })，
命中类型统一为 VectorSearchHit。RRF 排名来源只使用 sourceId。
ModelCalls 绑定使用 assertInput／assertOutput，调用使用
invoke({ modelId, input, timeoutMs }, ExecutionContext)。旧位置调用及 validate 别名已移除，
不支持的超时值在模型执行前拒绝。

## Support 合同与结构化实现

CapabilityModule.tools 只按 id 登记和查找，不再用 name 代指；App 可保留自己的 name 元数据。
Schema 合同统一使用根 SchemaAdapter，旧 InputSchema 类型已移除。
ModelRunner 的无作用 trace 配置、无运行归属的 ModelTrace 类型及没有消费者的
fromLegacyProvider／LegacyChatProvider 迁移接口已移除。App 的业务 trace 数据保持独立。

Support.defineTool 的产物直接符合 Core ToolDefinition，包括 execute 的 `MaybePromise<Output>`，
无需转换为普通对象。工具 bind 请求接受 app getter；缺少 app 仍拒绝，明确的 undefined 可以表示无依赖。
模型选项按 ModelOptions 合同读取原型 getter，绑定 onUsage 的原接收者；准备、输入测量、诊断和
发送使用同一份选项快照，保留缺少字段与显式 undefined 覆盖的差别。

## Knowledge、TextSkills 与持久任务

Knowledge 读取只用 documentId／selection／sectionIds，目录方法只用 sectionIds、assertSelection、read。
TextSkills 只用 kind／toolIds 注册并调用 load({ entries }, { read })；Banker 的静态注册表同步迁移，
其工具回执仍由 App 显式投影自己的 wire 字段。旧位置调用与注册字段不再参与执行。

Artifact resolver 只用 id 和 resolve(reference, OperationContext)，运行时引用只用 resolverId／artifactId。
旧 kind／id 引用、历史声明、转换接口及旧执行重载已移除。
Durable 只用 isState、replayPolicy、OperationContext 和命名 run 请求，旧 validate／replay 分支和位置重载已移除。
实现类可以携带额外成员，执行仅消费现行合同；不会把额外成员当作替代协议。

Durable 检查点只读写当前 version=2，恢复时保留尝试次数、期限和状态。
任务进入锁、读取、状态检查和保存边界检查取消与期限，
保存始终在排他操作内等待。取消发生在写入中时，已提交的记录不会被描述为撤回成功。

# Agent Core 计划 B

2026-11-04。目标是沿用首轮已经形成的 API 风格，完成后置能力和实际接入优化。执行者同时维护 agent-core、Banker 和小可乐，不能只提供设计或再套一层 API。工作方式见[交接约定](plan-b-handoff.md)。

状态：B1—B5 实现、真实 App 迁移、公开文档与离线验收完成，workspace 检查通过。原会话已确认概念、需求和目标风格；本记录区分实现完成、离线验证与尚未开展的长期产品工作。

## A 的基线与补正

A 已完成公开入口、共同类型、命名、返回、绑定、路由生成器、Core／Support 依赖边界、Kit 调用和 App 消费者的迁移，删除历史格式兼容。原有自编排、单模型／多模型、Workflow 扩展和 fork 保留。首轮证据见[实施记录](../records/api-implementation-status.md)。

交接前独立复核补查并修复：嵌套模型定义的绑定快照；Kit 错误工厂和生命周期配置的一次绑定；规范策略数组快照；显式结果 getter；CoreStep 单次取消；Support 默认空选择与 Core 校验的矛盾。SDK 430 项全量回归、两后端编译、Microcola 145 项与 Banker 44 项相关回归已通过。这些属于 A 补正，不能靠改名为 B 消除首轮未完成项；完整证据见 A 实施记录。

## B 的验收方向

- 简化只有缺省、复用、代指。减少开发者需要决定、重复填写和追查的关系；代码行数只是旁证。
- 同一业务的最小配置、补充配置、自定义实现沿用同一合同；不能从函数式入口换学配置 DSL。
- Core 接收 Interface／type 的实现；Support 是推荐的最佳实践实现，Kit 是可选独立业务库。Support 产物可直接传给 Core，无需转普通对象。
- Core 缺省解决“缺参如何运行”；Support 补全解决“此场景怎样更合适”，包含有依据的值、handler、生成规则和多套策略。
- 每一项以实际消费者、同一业务的新旧对比和可验证结果收口。减少配置不能削弱预算、取消、授权、检查、时序或隐私。

## 实施批次

| 批次 | 内容 | 完成条件 |
| --- | --- | --- |
| B1 | 统一过程事件和注册监听 | 固定流程、节点动态和模型状态共享类型与执行身份；App 运行中可接收，关闭持久日志仍有效 |
| B2 | 上下文装配、选择、压缩节点化 | Support 和第三方可实现同一节点合同；Core 仅提供通用接入、调度及最终输入预算保证 |
| B3 | Support 场景策略与配置生成 | 真实场景有多种推荐补全，精确覆盖有效；从既有清单生成重复的枚举、数组和映射 |
| B4 | 两个 App 的接线和主要入口再简化 | 固定定义提前绑定，请求只带本次数据；去除能由 Loop／已有目录完成的手工传递和重复清单 |
| B5 | 示例、文档和交付审计 | 同业务渐进示例、公开类型、离线验证和真实消费者一致；未实施的长期项有明确状态 |

批次可以按依赖细分，不能只堆规划后停止。先解释首批合同和同业务对比，再实现一条端到端路径，验证后扩大。首批不要求把整个新功能一次铺到全部模块。

上下文节点化有一个必须先解决的技术依赖：将 Runner 私有的真实请求测量能力开放为可组合合同。测量必须涵盖传输指令、Schema 和输出预留，测量与发送复用同一次准备快照，不能对动态能力执行两次 prepare 得到不同请求。这个进阶能力不能改变最小 invoke 的基本写法，也不能要求普通用户预先学习另一套强制准备流程。可在 B1 后、B2 前单独交付。

### B1：过程事件与监听

当前执行事实分散在 CoreLogOutput、Workflow／Loop observer、ModelOutputEvent、ProviderObserver 和各 Kit 局部观察。先画清来源、触发时点、身份、载荷、采集规则和消费者，再确定共享类型及注册入口；不要另造与现有流程并行运行的事件框架。

必须实现：

1. App 注册监听；Core 在执行事实发生时触发。Core 不直接操作 App 界面，也不提供轮询查询进度来代替通知。
2. 固定流程和特定节点动态具有一致的事件外层、可判别载荷、节点／调用关联及请求作用域。监听器可关注事件类型和节点身份。
3. 开始事件在实际工作开始前发出，完成／失败／取消如实对应；模型请求、工具执行、选择和压缩不能只有事后摘要。
4. 用户可见状态与持久日志开关分离。App 可以只接进度、不存日志，或只保存获准的字段；无监听时保持低开销。
5. 状态观察是旁路，异步失败不得改变执行；内容交付仍按序等待消费和处理背压。统一类型不抹平二者的运行保证。
6. 节点只报告约定的 payload／subs 或相应进度数据，由 Loop 赋予身份、时间、状态并记录；不能让节点自己管理 diagnostics、写日志或维护另一套 span。
7. 保留请求并发隔离、订阅生命周期、失败隔离、取消和迟到结果边界。不要从 lastCall 或共享“当前请求”猜关联。

目前 ModelPart 没有独立推理分片。不要把“正在思考”状态、模型明确提供的过程说明、工具事实、暂态预览、最终答案和内部隐藏推理混成一个字段。若接入供应商提供的推理内容，先明确该供应商的实际协议、可见性和隐私；不能为了状态通知默认采集或暴露完整提示词与内部协议。

首个对照示例应展示同一问答：App 如何监听“开始请求模型→进入工具→结束工具→开始压缩→结束压缩→继续模型→完成”，并覆盖关闭持久日志、取消和失败。先使用离线 Provider，不要求 UI 或真实模型。

### B2：上下文能力通过普通节点接入

推荐装配、选择、压缩算法属于 Support。第三方直接实现相同接口即可替换，无需继承 Support 或模仿某个 Kit 的状态。Core 不拥有特定算法、分组、压缩轮数或策略管线。

- 复用现有 Workflow 节点、路由、运行上下文和 B1 事件，不另造压缩 hook 调度器。
- App 将节点及触发条件配置进 Workflow。不要在 Core 内根据某个模式隐式插入 Support 步骤。
- 实际模型请求仍由 Core 测量完整输入，包括传输指令、Schema 和输出预留，并做最终字符／token 预算校验。节点的预估不能冒充供应商真实容量。
- 节点内部模型调用共享同一请求额度、取消、截止时间和父子调用关系；选择或压缩不能新建一份完整额度。
- 保留来源、信任等级、受保护内容、结构、选择依据和未满足预算的真实失败。无安全处理方案时允许拒绝，不伪装成功。
- 原内置上下文策略逐项迁移后移除对应专有执行分支、旧参数和文档；本项目没有历史兼容要求，不能保留两套等价运行机制。

验收使用同一数据从不启用处理，到加入一个内置节点，再替换为自定义节点；原有 agent.run、模型调用和取结果方式保持一致。事件证明节点真实运行，而非只在 subs 中声称发生。

### B3：Support 的策略化价值

逐一盘点当前 Support 导出，为每个保留入口说明场景、生成内容、推荐依据、覆盖规则及真实消费者。只有直接输入再同形输出、没有推荐行为或生成收益的壳，评估合并或删除；基础协议转换工具按其真实职责保留，不硬包装为推荐策略。

候选重点：

- 上下文的保留、选择、压缩与预算分配；按小／中／大、快／均衡／深度等自然语义配置，但必须有明确适用条件和映射依据。
- 模型、推理强度、速度偏好和输出额度的组合。沿用 App 已登记的模型及供应商能力，不凭名字或 URL 猜能力，不把档位描述成未经验证的性能保证。
- 从同一能力／Schema／阶段清单生成模型可见枚举、工具投影、预览字段和引用检查，减少手配数组、字典和重复默认值。
- 子执行的角色、工具子集与输入投影若在两个 App 中确有同构重复，可提供推荐装配；不引入新的角色调度协议或无限递归。

多种构造入口或单入口的类型化场景参数均可采用，以实际学习路径和概念数量判断。保留用户精确数值、自定义函数和完整 Core 配置的覆盖能力；公开优先级，拒绝含糊的同传冲突。

当前核对入口包括两个 App 的 context assembly（目前 build 而非显式节点计划）、Runner 的 processContext 接线、Microcola 的 outputs/preview.ts（独立阶段和字段路径）、Banker 的 infrastructure/models/transport.ts（交互映射）和 contracts 的 ai-provider-presets.ts。以这些真实来源检验生成收益；展示白名单不能从任意模型字段擅自推断，必须有明确的展示资格元信息。

### B4：真实入口与接线减法

从 Banker 和小可乐当前装配入口出发，逐项记录“固定内容是否还在每次传、既有清单是否还要抄、Scope 和状态是否可由已绑定执行上下文得到”。只消除真实重复，不合并应用业务差异。

- 一对一依赖使用构造配置或后续一次 bind；多项目录使用 register。Workflow 不切换，升级靠不可变 add／fork 组合。
- 外部 ModelCalls 必须核查其请求额度端口与 Banker embedding 调用：先区分模型调用次数、向量条目等计量单位和业务额度归属；不得把 embedding 次数直接混扣聊天 maxCalls，也不宣称任意外部推理已统一额度。优先复用已有预算端口；需要产品决定时明确标注。
- 模型可直接绑定或按已登记 ID 选择，支持单次多模型及多次切换，保留各次请求隔离。
- 自编排、内置节点和自定义节点遵守同一执行保证，不能为了推荐写法把原始 CoreStep／Workflow 能力删掉。
- 诊断、取消、预算和父子关系由运行机制接线；App 负责事实、权限与业务选择。不要将一个重复入参换成多个新字段后称作简化。
- 专用生成器负责自己的默认值，公共 Workflow 只处理所有原始对象都适用的规则。route 及 route.xxx 生成普通路由，不能要求私有标记或新配置格式。

### B5：验收和退出条件

每组必须同时交付实现、真实调用迁移、同业务前后对比、逐步加配置的示例及当前文档。检查正常、失败、取消、超限和结构化自定义实现；不以通过编译替代行为证据，也不以离线模型代替真实语义验证。

结束 B 前重新按 exports 检查未覆盖入口，清理并行旧实现及过时文档，生成公开符号参考，按改变范围执行 SDK 和 App 检查。不要每一步重复全套构建。未调用真实模型、未预览界面、未部署时如实说明。

## B 执行记录（2026-11-04）

### B1 首个切片

- 合同：`execution.observe.event(CoreEvent)` 统一过程观察；监听按事件／节点元数据筛选，默认不采内容；`context.report({ payload, subs })` 即时报告，Loop 提供身份与时间。模型 sink 使用同一事件外层，仍按序等待并传播交付失败。
- 实现：共享事实来源位于 `src/execution/events.ts`。日志与多个监听器复用同一事实身份，各自按规则取副本；Provider 作用域在绑定监听后继续关联。节点取消及完成后拒收迟到报告，原型方法在装配时绑定。旧 Core workflowEvent／loopEvent／callEnd 观察入口移除；Kit 自有观察不升级为 Core 目录。
- 实际 App：Banker 请求装配与小可乐 AgentTrace 从 `model.end` 收集摘要；小可乐从 `workflow.event` 收集流程，删除分散接线。Banker 可在请求服务注册观察，关闭日志的真实 Agent 离线测试收到模型与工具开始／完成。未改 UI、正文存储范围或保留期。
- 同业务示例：`execution-progress.mjs` 先运行普通服务问答，再只增加监听；实际普通节点减少冗余回执并报告进度，模型／工具调用与结果合同保持。
- 证据：SDK 双格式编译通过；定向 117 项通过。全量首轮 440 项中 438 通过，遗漏的旧观察夹具及新增用例边界修正后，相关 17 项复验通过。两个后端编译通过；App 首轮 55 项中 47 通过，剩余旧夹具迁移后，含截止时间的相关 30 项复验通过。离线进度与 miniapp 示例通过，公开参考已生成。证据文件为本机 `/tmp/agent-b1-*.log`，不挪用 A 的数量。
- 收口：最终输出接收前的事实时序、背压及公开接口 32 项复验通过。上下文开始／完成目前可由显式普通节点表达，原 Runner 内置处理尚未节点化；下一批先开放同次准备快照的实际请求测量。

### B2 前置：真实请求测量

已提供可选 `ModelRunner.prepare` 与 `WorkflowContext.model.prepare`，结果通过同一 invoke 的 prepared 字段消费。动态传输、指令、Schema 和工厂接收者形成单次快照；反复测量不重做准备、不扣调用数。最终请求继续执行实际预算检查，传输指令纳入独立声明预算，实际总量避免重复计算嵌入指令的 Schema，token 限额扣输出预留与安全余量。句柄单次使用并校验请求／模型归属，普通 invoke 不需学习准备流程。

SDK 双格式编译通过；测量、现有上下文、事件及模型绑定相关 55 项通过。补充 40 项中 39 项首轮通过：原取消夹具把实际传输指令限制在10字符内，在新检查下先超预算，已调整为允许指令的预算后，相关 Core 文件定向复验通过。尚未据此宣称完成 B2 上下文节点迁移。

### B2 上下文普通节点

Core 已移除专用上下文策略、选择器／压缩器参数与私有调度分支；只保留 ContextPlan 通用装配、结构／信任审计及最终请求预算。算法、分组、保护和清单迁入 Support，同一实现服务完整处理节点与显式选择／单步缩减／装配节点。App 用普通路由决定进入；自定义类节点可直接替换，不依赖 Support 内部状态。内部模型调用共享原 Runner／Workflow 额度，节点期限继续传给实际调用，不只停止等待。

Banker 的真实 context 节点已使用 Support 默认校验与装配，最终决策复用该次准备句柄；多调用格式纠正重新准备实际选中的传输，不重用已消费句柄。图片作为额外用户消息在装配时统一计量。未自动启用摘要或改变持久历史。

新增 context-nodes 示例展示同一数据的拒绝、内置节点与独立类替换。SDK 首轮全量 451 项中447通过，4处旧接口／旧父子关系夹具已迁移，相关28项复验通过；显式节点与保留／预算15项通过。Banker 编译通过，相关30项首轮26通过；JSON模式下Schema嵌入指令被重复归入正文的计量问题已纠正，native-functions文件全部复验通过。新计量保持正文与声明独立预算，实际合计不重复计算。仍需本批最终增补用例和两端消费复验。

### B3 场景补全与同源配置

同一历史数据可以直接用 Core 调用并因超限拒绝，补入 `createContextStrategy({ kind: 'recent', fragment, field })` 生成本地完整轮次窗口，或改为 `continuity` 加入旧段摘要与近期原文。生成的 policy/compressors 直接进入普通处理节点；精确 targetChars、keepGroups、grouping、selection 仍覆盖同一合同，0 不作缺省处理。默认值来自已登记片段限额和完整 user-turn 保护，不宣称摘要质量。独立类节点仍可替换同一工作流节点。

小可乐阶段清单现在使用 transportId/capabilityIds 和明确 preview 资格；同一能力声明提供 Schema 与允许显示的正文路径。`createReplyPreviewRules` 校验阶段引用、展示路径、条件及重复 ID，替代原独立预览白名单；Profile 正文槽位 Schema 和路径来自同一字段清单，未扩大展示字段。模型可见工具枚举继续由原注册器生成，未另造全能目录。

Banker 从 contracts 供应商清单的显式 interaction 字段选择实际 adapter，`modelInteractionCatalog` 引用真实实现；静态传输定义按 provider 复用，collector 保持每次新建。小可乐继续明确选用 native。未按品牌、URL 或模型名猜能力。原 B 批次未提供快／深度／预算档位；2026-11-05 的策略收口已补入基于显式登记的模型与推理配置、具有公开本地限额的预算档位及上下文保留档位，见 support-refactor-plan.md。仍不凭名称虚构性能保证，未增加角色框架。

#### Support 导出复核

原 B 批次按当时 Support 的 55 个运行时导出逐项归组核对；当前新增策略见 support-refactor-plan.md。以下按原批次，类型与重载由同源公开参考覆盖。保留入口均有合同转换、校验、生命周期或算法职责；纯基础工具按真实职责保留，不包装成场景推荐。

| 运行时入口 | 用途、收益与覆盖边界 |
| --- | --- |
| defineSchema、fromJsonSchema、fromParserSchema | 原始 schema、有类型 parser、既有库三条输入返回同一 SchemaAdapter；固定方法接收者，不假装裸 JSON 有类型证明 |
| defineTool、defineToolCatalog、defineModelCapabilities、defineCapabilityCatalog、validateToolReferences、defineRegistrationCatalog | 同一声明驱动模型能力、真实执行、引用校验与顺序登记；静态清单可复用，权限与请求 runtime 独立绑定；两 App 实际消费 |
| createTextTransport、createModelTransport、createStageModelTransport、nativeFunctionInteraction、jsonObjectInteraction、modelInteractionCatalog | 同一 collector 合同，阶段引用从清单生成；默认和显式 adapter 可覆盖，原生与 JSON 不混成新协议；两 App 传输实际消费 |
| CompatibleModelProvider、chatCompletionFunctionOptions、chatCompletionMessages、chatCompletionParts、createProviderObservationScope | 兼容 wire 转换、连接校验与请求观察关联；非业务档位，App 保有连接、配置及日志授权 |
| defineContextAssembly、defineContextFragments、assembleFragments、transformContextText | 投影顺序、片段元数据、装配和显式文字变换；预算一次配置，plan/build 同一合同；两 App 上下文实际消费 |
| createContextStrategy、createContextProcessingNode、createContextSelectionNode、createContextReductionNode | recent/continuity 推荐及普通节点装配；精确参数或独立 handler 可替换；Banker 真实 context 节点只启用原有校验，不自动摘要 |
| createContextCompressor、createContextSelector、processContext、validateContextPolicy、validateContextSelection、selectContextSteps、contextPolicyCatalog、contextReductionCatalog、contextSelectionCatalog、reservedContextCalls、contextHandlerCalls | 有界处理、选择、额度与策略注册；供自编排或上述节点共同使用，不保留 Core 隐式分支；策略回归覆盖失败、保留、超限与取消 |
| createReplyPreviewRules、createReplyPreview、streamEvents | 明确展示资格生成规则、投影和有界交付；配置覆盖仍受路径检查，预览不等于执行／最终回复；小可乐实际消费 |
| readSse、writeSseFrame、encodeSseEvent、SseIdleTimeoutError、abortableStream、scanJsonObjectFrames、parseJsonFrames | 标准 wire、背压、取消和 JSON 帧边界，保留原协议；属于基础适配，不虚称场景最佳实践 |
| breakWhile、configureBreakWhile、matchRule、walkRules、commonPrefixLength、retryMultipleModelCalls | 集中拒绝规则、规则遍历、前缀计算与有限多调用格式修正；保留专门算法和失败归属，不机械转换为流程节点 |

### B4 请求接线与外部推理额度

Core 新增结构化 `bindModelRuntime`，固定 invoke/prepare 接收者、读取实时次数并复用已有 execution；静态配置绑定仍每次运行新建 Runner。请求级 runtime 不因重复 run 获赠额度，不允许重叠运行，fork 须恢复分支自己的 runtime。登记模型 ID 随准备句柄和真实调用传播；无全局默认模型也可明确选择主模型／处理模型，共享一次请求总上限。

Banker 删除 WorkflowRuntime 中平行 model 依赖，context 和 decide 统一用当前节点端口；小可乐主循环、正文和复核节点同样接入 Core 端口，保留 App 阶段解析、动态能力与业务策略。外层与内层 Engine 一次绑定已有请求 Runner，删除可推导的 signal／诊断接线；Profile／局部 Kit 明确嵌套调用的父作用域仍保留，Core 不猜 App 内部调用关系。

外部 `ModelCalls.invoke` 的 context 可带已有 `AttemptBudget.take` 结构端口，一次真实绑定调用扣一次尝试，批量向量仍计一次；前置校验／取消不扣，失败不退回，异步或非布尔 take 拒绝。Banker 查询 embedding 每次搜索一份单调用预算，探测一份单调用预算，索引重建按当前明确计划批次数形成预算；与聊天 maxCalls、向量条目数及用户问答业务额度分别拥有。未添加跨业务总额度、持久账本或更大的记录范围。

### B5 最终验证与文档

- SDK ESM／CommonJS 编译通过；最终全量 **464 项通过**，覆盖统一事件、失败隔离／背压、准备句柄、显式处理节点、策略覆盖、结构化类／接收者、多模型与同请求额度。证据 `/tmp/agent-b5-sdk-final-build.log`、`/tmp/agent-b5-sdk-final-tests.log`；此前 461 全量与 67 项边界复验为中间证据，不与最终数量相加。
- contracts 与两后端编译通过；小可乐主循环、工作流、流式预览、上下文、native 协议及期限 **161 项通过**，Banker 主流程、完成、协议、增长及向量检索 **48 项通过**。证据 `/tmp/agent-b5-server-corrected.log`、`/tmp/agent-b5-banker-tests.log` 及 B4/B5 编译日志。用例为离线 provider／隔离临时数据，不涉及运行库。
- 最终 App 回归发现旧 36,000 原始消息默认值被误作 Core 全局硬上限，已在小可乐装配区分原始消息限制与阶段 BuiltContext 限额；48,000／72,000 原阶段恢复，原始消息仍受原限额。没有放松 Core 的 runner 与阶段共同硬上限。增加同一阶段裸消息拒绝、完整 BuiltContext 可调用的覆盖。
- 当前 API 手册、根 README、进度／上下文示例同步；保留完整随包 Markdown 示例，仓库 .mjs 示例不冒充 SDK 文件。采用 C 的声明生成器，从当前 dist 与 package.exports 重新生成正式 reference；文档站拟定网址加到根 README，站点源码／产物不进 SDK。
- 两个渐进示例实际运行通过；最终 npm pack 离线 dry-run 清单为 709 文件，其中 29 篇 Markdown。逐条核对的 1,868 个本地链接全部在包内，1,676 个声明行号有效，无 src、相邻工程、未分发 .mjs 或维护规划文档依赖。证据 `/tmp/agent-b5-pack.json`、`/tmp/agent-b5-doc-links-final.log`；一次性检查脚本仅留 `/tmp`，未加入正式维护工具。
- 退出复核补齐三项：run 的更短信号传到 runtime 实际 Provider；fork 显式恢复 runtime 时不再同时继承静态模型配置；仅模型 sink、没有日志或过程 observer 的 Workflow 仍保留自动执行身份。公开类型夹具覆盖准备句柄的结果推断与结构化 runtime，ESM／CommonJS 均通过。未订阅报告的 getter 保持惰性，不增加正文采集。
- `check:workspace` 首次发现并行文档站依赖变更中 esbuild@0.28.2 的跨平台 optionalDependencies 缺项；该任务补齐根锁后，按原检查器复验通过（8 apps、9 packages、36 contract exports）。未改检查器或绕过。最终证据 `/tmp/agent-b5-workspace-final.log`，改动差异空白检查通过。
- 未调用真实外部模型、未运行 UI 预览或截图、未部署；离线行为不代表真实模型语义／性能或最终视觉验收。

## B 完成时登记的长期事项

以下表格保留 B 收尾时的范围和前置条件。后续 R2—R5、R7 已按[计划 D](plan-d.md)完成，R6 已按[新应用创建能力](new-application-plan.md)独立完成；当前覆盖状态见[计划 C 覆盖矩阵](plan-c.md#全部规划的覆盖对照)。R1 图形实验继续暂缓，不因本次复核自动实施产品界面或扩大业务数据记录。

| 事项 | 当前边界和前置条件 |
| --- | --- |
| Jangts 图形／网状步进回放 | 用户明确为后台实验规划，暂不实施；Core 不感知 App，message→run 关联由 App 持有。沿用执行事实，不做还原内部隐藏推理的调试器 |
| 静态主图、局部子图与链查询 | 先用稳定登记实体和日志关系审查可行性；Flow Kit 可生成局部图，自定义节点可提供同结构扩展，无子图时视为黑盒。没有这些数据也不能为采图发起超级请求 |
| 日志回查、模型复盘和经验产物 | 保持现有设计提案状态；明确读取授权、脱敏、保留期、来源可信度及结果消费后才能实施，不自动保存新正文或发布经验 |
| Agent 家族持久分支、合并与上岗 | Core 已有内存分支身份和检查点；App 长期状态、合并冲突与发布责任需单独产品定义，不借 fork 隐式共享写状态 |
| 多层／并发子执行 | 首期仅一层顺序执行；实际需求、原子预算、容量、取消和输出隔离明确后再做，不提前递归或互相自由派活 |
| 跨请求专业子任务恢复 | 不同于 Durable 批次与现有内存家族分支；累计预算／期限、证据版本、重新授权、对账及长期状态尚需单独设计 |
| 新应用模板／脚手架 | 当前只集成既有项目；模板目标、环境和维护范围待明确，不生成虚构资料或默认安装、调用模型 |

B 执行者负责保持这些事项的需求和依赖清晰；如发现已有实现，应核实并标注，不能重复造一套。

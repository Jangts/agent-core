# Agent Core 组织调整执行蓝本

状态：设计执行参考，用户已授权按本蓝本调整。第 11 节记录本轮已实施范围，其余组织方式仍按实际收益选择，不表示整包已照目录参考重排。基本边界见 [Core、Support 与 Kit](../../design/design-layers.md)。

本页的组织方案与第 11—12 节验证记录主要形成于 2026-10-29。现行合同已在 A 收口，并由 B 继续调整运行接口；完整状态统一见[计划 C](../plans/plan-c.md)，不能从早期“目标／重点拆分”段落重新推出待编码清单。SDK 与 App 同步采用当前合同，不为本页曾列出的旧类、旧函数、再导出路径或持久格式保留兼容层。

这是按实际收益执行的参考蓝本，不是为了分类完整而实施的架构门禁。同一 API 可以跨用途使用；先确认重复、耦合或接入困难，再决定是否拆分。没有必要逐个函数裁定唯一等级。

## 1. 沿用成熟的核心与插件设计

采用常见的 **Core API、Support、Plugin／Extension、Adapter、Hook、Middleware** 概念。重点借鉴“宿主定义扩展接口，应用实现接口，宿主按协议回调”的常规设计。Kit 是 App 侧可选业务库的组织名称，不能据此增设一种由 Core 识别、加载或调度的执行实体。

同构参照来自官方资料：

- [Fastify Plugins](https://fastify.dev/docs/latest/Reference/Plugins/)：功能通过 register 加入，插件可以提供 routes、decorators 等自己的能力。借鉴公开注册边界；对应的是 App 向 Core 注册扩展实现，不把所有 Kit 都做成 Core 插件，也不引入 HTTP 路由体系。
- [fastify-plugin](https://github.com/fastify/fastify-plugin/blob/main/README.md)：配套 helper 提供版本、名称和依赖检查。对应“围绕核心协议的推荐辅助”；这只是职责对照，Fastify 没有把该包正式称为这里的 Support。
- [Fastify Hooks](https://fastify.dev/docs/latest/Reference/Hooks/)：宿主公开生命周期入口，并规定时机及调用方式。对应核心 hook 接口与调用语义；不复制其 HTTP 阶段名称。
- [pluggy](https://pluggy.readthedocs.io/en/stable/)：区分宿主定义的 hook specification、插件实现和宿主的 hook 调用。借鉴规范与实现分离、登记校验；不复制其默认回调顺序和聚合策略，也不引入 Python 依赖。

以上是结构对照，不是逐行移植，也不表示三个项目使用相同名词。它们足以支持“稳定核心、配套 helper、可选插件”的设计，不需要再发明平行框架。

## 2. 边界先于目录

Core 由双向 API、协议和维持这些保证的运行实现构成：App 调用 Core 的服务接口，同时实现由 Core 定义的扩展接口供其回调。Support 在 App 侧辅助这两种接入，没有独立的调度协议。Kit 则服务于 App 内部业务，其局部接口由 App 消费。

判断一个规则应放哪里：

1. 独立的实现若不同意这条规则，就无法正确调用或参与核心执行，属于 Core 协议。例如完整结果提交、预算和错误传播。
2. 当前代码帮助 App 调用核心服务，或将 App 配置／handler 整理为 Core 可调度的接口实现，属于 Support。例如从清单构造 ContextFragment；其对接依据只取自第一类契约。
3. 规则只对某类工作有意义，属于该 Kit 的局部协议。例如知识章节、来源选择、回答项状态和交付阶段。
4. 规则包含平台实体、事实、权限或页面行为，留在应用配置和 handler。Kit 可执行这类规则，但不内建其具体内容。

是否通用与是否核心分别判断。连续摘录和去重很通用，但不构成 Agent 的接入前提。一个 Kit 有严格协议，也不会因此成为 Core。

## 3. 目标依赖与公开入口

运行时交互：

```text
App ──调用核心服务 API──────────────→ Core
App ←─按核心扩展接口回调──────────── Core

App ──→ Support ──→ 配置／handler ──→ App 调用或注册到 Core
App 的 handler ──→ Kit ──→ 业务结果 ──→ App 返回核心协议结果
```

源码依赖为 Support → Core，App → Core／Support／Kit；Kit 可以内部复用 Core 或 Support，但不会成为 Core 的依赖。Core 不导入 Support 或 Kit，也不根据 Kit 名称分支。Support 不自动装载 Kit。Kit 之间的依赖由参数或业务装配显式表达。公共基础函数由 utils 共享，内核不经 Support 总入口引用它们。

源码按实际职责与规模组织，当前阅读入口见 [包目录说明](../../design/modules.md)。运行机制、协议、Support 与可选能力各有清楚的位置，结构声明按对应职责分组；公开子入口与源文件通过 exports 映射，不要求一个入口对应一个目录。

公开入口可按需要提供 `/support`、`/kits/<name>`；是否增加 `/api` 总入口另看实际收益，不能只为术语对称增加入口。现行根入口及 `/engine`、`/tools`、`/context` 等转出所属接口。Kit 的局部 creator 优先随 Kit 导出。这些路径是组织参考，实际可用项以 package.json.exports 为准。

仍先在 agent-core 包内组织，不因分类立即拆出多个 npm 包。包清单、ESM／CJS／声明映射在实际增加入口时同步。内核源码使用明确的内部路径，不从聚合根入口导入。

## 4. Support 的范围

Support 优先整理已有代码，不另造一套 DSL：

| 工作 | 推荐实现 | 不承担的职责 |
| --- | --- | --- |
| 登记与装配 | registerAll、defineRegistrationCatalog、注册器 creator | 决定应用必须安装哪些 Kit |
| 模型适配 | createModelTransport、adapter、Provider | 应用 handler 自己解释函数调用增量；品牌或型号预设进入内核 |
| 协议编译 | 为核心真实消费的协议生成字段、schema、检查和 handler 绑定 | 将所有 schema compiler 都称为 Support；把本地业务消息或 Kit 协议提升为核心协议 |
| 上下文 | defineContextAssembly、片段构造和转换 | 决定必须读取哪些人物、产品或页面 |
| hook 装配 | 具名 handler、阶段顺序、调用端口适配 | 规定所有 Agent 使用同一交付／复核流程 |
| 规则辅助 | matchRule、walkRules、breakWhile | 取代规范化、交付、检索等能力的完整执行主体 |

Support 的必要检验是：不用该 Support，手写调用与 handler 仍可通过同一核心 API 工作。Core 不得识别“Support 创建”标记才允许调度。核心拒绝非法输入的能力不能只存在于 Support 中。Support 自身配置可以有方便书写的格式，但最终产物必须 Follow 核心契约，不制造另一套对接规则。

例如 InteractionProtocol／CommandCatalog 也能用于 App 自己的跨端消息；它们与 Kit 的输出编译器一样，归属要看服务对象。核心真正读取的 RegisteredProtocol／ModelCapability 等最低结构仍须保留；不为追求局部化而删除共同合同，也不为复用编译器而强制 App 使用额外业务信封。

## 5. Kit 的最小组织

沿用 catalog／handlers／registration 或模块配置＋执行器。每个 Kit 至少说清：App 如何调用它、接受什么输入、依赖哪些真实端口、维护哪些状态、产生什么结果、按什么顺序执行及如何失败。其局部 API 只服务于 App 组织业务。

Kit 不要求安装函数或插件基类。App 可以在自己的 handler 中调用 Kit，再按一类协议向 Core 返回结果；Support 可以辅助生成这种 handler。Kit 的类、局部 schema 或工作流不能因此成为 Core 的第二套扩展协议。插件发现、动态加载、热卸载和独立容器不在本次范围内。

### 5.1 规范化

- Kit 执行有序转换，后项读取前项结果；字段别名、缺省、移除、去重等用已有配置或具名函数表达。
- 明确输入所有权和返回约定。迁移既有代码时保留浅拷贝／原地修改、unknown 字段、null／undefined 和 getter 的求值时机。
- 外部协议适配不推断 command、target、mode 或权限；适配后仍走协议和授权检查。
- 首项分发、有序转换和“返回 undefined 继续尝试”的恢复是三种不同语义；不合并成一个万能规则模式。

### 5.2 交付

- Kit 拥有自己的阶段配置、共享状态与结果协议。Core 只看到已登记 handler 和合法终态。
- 保留原先“阶段 hook → 阶段 handler → 判断是否提前返回”的顺序；不是先执行全部 hook 再跑全部 handler。
- 迁移 ReplyFinalizer 时保留 callback 的 this／owner、undefined 提前返回规则、异常出口、来源绑定与正文处理顺序。
- 来源、链接、平台交互要求和具体文字处理由应用登记。Kit 不默认发布、不自行调用模型。

### 5.3 投影、树遍历、查询汇总

- JSON 预算投影与连续摘录作为投影 Kit；通用算法及策略配置在 Kit，字段提取和语言偏好由应用提供。
- 页面对象递归处理作为遍历功能，保留深度、字段顺序、数组顺序及省略值；具体查询线索由访问回调提取。只有形成独立完整职责时才单列 Kit，避免单函数碎片模块。
- 多路查询明确串行顺序、去重键、重复项覆盖／合并方式和计数口径。现有同步流程不改成并发，也不增加查询预算。

### 5.4 已有与新增能力

retrieval、evidence、policies、candidates、text-skills、presentation 已有实现按 Kit 归属整理。知识章节、回答任务和输出组合亦是 Kit，而不是核心必须接受的统一业务模型。

各 Kit 自己的结果状态、字段所有权和局部校验可以严格约束；应用不采用该 Kit 时，无须填充其字段。不同 Kit 通过真实输入输出适配，不靠把所有字段塞入一个全局 context 连接。

## 6. 首轮重点拆分依据

下表保留首轮对象与迁移理由，最终职责见第 12 节及现行模块定位。后续 B／C 以实际缺口推进，不重复创建已经提取的 Kit。

| 首轮对象 | 迁移内容 | 必须保持的运行保证 |
| --- | --- | --- |
| IntentDefinition／ScopeDefinition | 分出最小标识与核心所需关系，任务、资料、交付元数据随对应 Kit；注册实现由 Support 提供 | 当前字段、描述结果、别名、封存、错误与标签优先级经应用 facade 保持 |
| ToolLifecycleRegistry | 保留核心调用边界，分离 hook 装配和贡献聚合；旧类继续委托新实现 | 先全局 inspect 再选中 inspect、选中 authorize／resume／complete、回执和取消顺序 |
| createAgentCatalog | 机械目录投影与任务限定策略分开，限定策略显式注入 | 原应用继续使用原限定方式，包括已有 goal／scope 与空值处理 |
| ReplyFinalizer | 将阶段调度与结果契约移入交付 Kit；平台 handler 留应用 | 提前返回、正文修改、sourceIds、review 标记和原输出 |
| normalizeDecisionShape／normalizeReadQuery | 拆出规范化 Kit 和应用规则；不机械把单 if 改成规则项 | 原输入接收范围、转换顺序、unknown 字段和无授权推断 |
| content-projection、page-context、grouped queries | 抽取完整算法主体，领域读取及字段规则配置化 | 有效 JSON、裁剪顺序、Unicode、遍历顺序、去重覆盖及总数口径 |
| 知识／回答／输出新增实现 | 以独立 Kit 和 Core adapter 审查，不借源码新增升级核心契约 | 当前用户已授权的接入范围；不同应用的事实、预算、文案与协议 |

Intent／Scope 的最小结构不能在没有追踪全部消费者前直接删字段。所谓最小，是核心真正消费的合同，而非只保留一个 ID；自定义关系必须仍有类型、引用检查和明确所有者。

## 7. 执行顺序与交付物

| 批次 | 实际工作 | 完成依据 |
| --- | --- | --- |
| 1. 核对合同与职责 | 追踪本次拟抽取部分的真实消费者、可观察语义、重复和依赖 | 能指出具体收益；没有为了给全包每个 API 唯一归类而增加工作 |
| 2. 明确接入边界 | 分别列出 App 调用 Core、Core 回调 App 的接口；固定签名、校验、取消、错误、回执和状态所有权 | Support 生成和手写实现通过同一套双向合同，非法实现由同一边界拒绝 |
| 3. 整理辅助实现 | 抽 Support 中的编译、装配和 adapter；保留原 creator／facade | 应用继续按原输入输出运行；Core 不通过 Support 总入口反向依赖 Kit |
| 4. 逐项移入 Kit | 优先交付、规范化、投影；每次同步真实应用适配并移除已被替代的通用主体 | 一个职责只保留一份执行实现；新 Kit 有局部接口、适配器及等效证据 |
| 5. 按需整理目录与导出 | 只迁移确有收益的模块，按需增加子入口，维持旧再导出 | 真实 ESM／CJS／声明可解析，不依赖源码路径映射掩盖产物错误 |
| 6. 收敛说明 | 文档对应实际接口和配置；对已发生的依赖或导出问题补针对性检查 | 解决实际耦合和漂移，不新建只为分类标签服务的自动门禁 |

每批交付：具体差异、真实消费者、针对性证据及剩余问题。先拆责任后搬文件；不同时增加模型调用、改业务规则或换框架。工作区已有改动独立保留。

## 8. 验收内容与执行频率

验收围绕实际变更提出具体问题，再做最小检查，遵守 AGENTS 的运行限制；以下不是每轮自动执行的全套仪式：

- 协议：签名、错误、状态及合法实现的边界；Support 与手写接入接受同样的合同检验。
- 行为等效：输出、异常对象／错误码、执行和求值顺序、短路、tags、回调 receiver、复制与请求隔离。
- 关键细节：false／0／空字符串、null／undefined、可变引用、稳定排序、同步／异步及取消时机。
- Kit 独立性：未选用 Kit 的 Agent 可完成最小流程；Kit 不拥有第二套模型预算、不伪造执行回执。
- 抽象有效性：用不含平台名称和字段的一个小样例检验配置自由度；已有合适消费者时复用，不为凑数量强迫另一应用接入。
- 实际发布面：改变公开导出时，通过根构建按依赖顺序生成公共包，再验证真实 ESM、CJS 和类型声明；不使用临时源码映射代替。
- 仅调整设计文档时只核对内容、链接与差异，不运行应用、UI、真实模型或全套测试。

## 9. 设计审查问题

讨论围绕实际代码收益与问题，不逐项进行概念审判。需要时检查：

1. 某个被列入 Core 的字段或阶段，是否只有一个 Kit 会消费？
2. 不使用推荐 Support 时，替代实现是否真能接入？若不能，是必要协议还是隐藏依赖？
3. Kit 的结果／检查状态是否被提升成了所有 Agent 必须懂的状态？
4. Support 和 Kit 的辅助函数是否被错误并入核心运行模型？
5. 现有 hook 的时序是否被“统一”改变？能否举出原行为会不同的输入？
6. 借鉴成熟框架的是已存在的扩展模式，还是顺便引入当前并不需要的插件运行平台？

一致项、未决项及其依据另作讨论记录。讨论方案由用户确认，不能将会话之间达成的意见写成用户已经批准的运行变更。

## 10. 本次交叉审查结论

- 一致：第一类 API 包括 App 调用 Core 与 Core 回调 App 的双向合同；Support 是 App 侧辅助，Kit 是 App 侧业务库，不增设 Kit 调度协议。
- 一致：知识章节、回答项、检查状态和输出结构可保留严格的 Kit 局部协议；工具回执、流程终态等核心实际消费的最低结构仍由核心合同定义。
- 一致：Support／Kit 的 creator 按服务对象组织；允许跨用途复用，不按函数名或公共导出形式机械分类。
- 一致：新增知识／回答／输出模块的本次接入有独立授权；整包目录重排、新增总入口和新插件平台不因本次讨论取得实施授权。
- 一致：采用成熟的注册、回调、adapter 与 hook 设计；优先普通模块和 App 装配，不为分类完整增加机制。
- 日志讨论曾考虑通用扩展事件；用户随后明确 Core 只记录自身运行。本轮移除 extension.event 与 presentation.rendered，Kit 返回／异常／observe 由 App 收集；嵌套 Engine／ModelRunner 的核心运行事件保持原机制。

设计分类保持指导性；已存在的真实运行合同及行为等效要求不因此放松。以上记录设计讨论的结论，实施与检查依据见下节，不代替其他会话的验收结论。

## 11. 本轮已实施内容

- 新增实际 `/support` 入口，将意图、范围、条件装配、生命周期和能力目录辅助放入 Support；原公开入口转出同一实现，不复制逻辑。Core 的执行器和基本工具调用不通过 Support 总入口运行。
- 新增规范化、交付、投影与聚合 Kit，声明结构集中在 structs/kits。已有检索、证据、策略、候选、文本 Skill 和展示模块提供可选 Kit 子入口，现行聚合入口转出同一实现。
- App 的决策规范化变为具名阶段清单；查询规范化为静态转换配置。未扩展输入权限，也不推断命令或执行方式。
- ReplyFinalizer 保留应用 facade。阶段顺序由既有 toolFinalPhaseCatalog 派生，处理器清单用类型检查覆盖每个 phase，Kit 执行交错 hook、共享状态和提前结束。
- 内容 JSON 裁剪、连续摘录、页面树遍历、查询归并和稳定键选择使用 Kit；平台的字段、语言偏好、查询资源及提示留在 App。
- server 与 Banker 分别接入所用 Support／Kit；不为增加消费者强迫 Banker 使用本站的资料流程。
- Core 不记录 Support／Kit 的业务日志。知识与输出采用可选 observe，回答流程保留 App 的 observe；其 diagnostics 参数只传给内部 Core Engine。
- 旧 Profile／城市离线脚本迁移到真实任务选择、生成和检查阶段；仍断言正文、真实资料、语言链接、错误引文拒绝和历史隔离。母板测试通过真实输出目录构造验证，不修改已编译目录的快照语义。

保留现有业务工作模型，不为得到更小的类型而强删 Support 已有元数据；不新增插件运行平台、自动发现、全包分类门禁或仅为对称的 `/api` 总入口。行为对照与实际检查记录随交付说明提供，不能用“已存在源码”代替通过验证。

### 本轮检查记录（2026-10-29）

- 根目录 `npm run build:packages` 通过；公开入口使用实际生成的 ESM、CJS 与类型声明验证，没有以源码映射替代包解析。
- 相关 Core／Kit 回归 46 项通过；server 的流程、上下文与 Profile 回归 156 项通过，没有跳过项。
- 迁移前后 1,524 组对照一致：查询规范化 396、决策规范化 980、内容投影 99、页面遍历 23、查询聚合 8、交付阶段 18。对照包括结果、输入修改、异常与阶段调用顺序。
- server 与 banker-api 的针对性类型检查通过。未启动应用、打开 UI、调用真实模型或执行部署；离线通过不代表这些运行场景已验收。

## 12. 职责归位与公开 API 收口（2026-10-29）

第 11 节记录首轮实现；本节记录后续复核与最终归位，不将首轮 Support 的临时分布作为推荐接入方式。

- Core 持有实际执行／回执、模型接入与 collector 合同、上下文信任与预算；Support 持有模型 adapter、creator、HTTP Provider、消息装配和传输辅助。
- 完整 InteractionProtocol／CommandCatalog 归 Interaction Kit，意图／范围与关系投影归 Intents Kit，领域生命周期归 Tools Kit；工具实际调用继续委托 Core。
- Core 与 Support 均从根 index 调用；Support 为单一总空间。Kit 默认按 `/kits/<name>` 使用，也提供独立 `/kits` 全量入口；根不新增各 Kit 对象。
- 对象或主构造器按模块实际组成确定。Engine 持有 Workflow／AttemptBudget／createWorkflow；Interaction 持有 Commands 与相关静态辅助；Intents 的两个注册器各带 create；静态 Kit 提供对应对象。保持旧函数、类和路径的实现身份。
- 类型与实现按责任归位；SSE／JSON 辅助及其声明进入 Support；共享 ProtocolRegistry 作为唯一键 Map 基础保留。模型运行的 trace 配置和无运行归属的 ModelTrace 类型已移除，诊断使用 execution.diagnostics 与 observe.callEnd；App 自己的 trace 数据仍由 App 管理。ValidationError 只提供 issues，旧 response／errors 别名与 CheckError 类型已移除。
- Provider HTTP／SSE 的五类事件经 Support 自有 observer 交给 App，不再进入 Core 事件目录；App 保留自身日志策略与请求隔离。无观察器时惰性，观察错误不影响业务。
- 对外文档重写为 [开发者 API 手册](../../../packages/agent-core/development/docs/api/README.md)，按 Core／Support／Kit 说明调用、参数、返回和异常；目录与责任排查留在维护文档。

最终公开 API 检查与内部行为回归分别记录交付证据。不能把旧轮次的测试数视作本轮新增公开面的验证结果。

### 本轮最终验证

- 根公共包双格式构建、workspace 检查通过。
- 新公开 API 4 项用例通过：单项／全量 Kit 身份、构造器静态辅助实际调用、Support 接入空间、ESM／CommonJS 的泛型与类型使用；迁移前 32 个入口的运行导出均保留。
- 内部 Core／Support／Kit 回归 138 项通过。应用首轮 194 项中 193 项通过，1 项依赖方向问题修正后，受影响的 126 项复跑通过；其余 68 项已有首轮通过依据。
- 1,095 组行为对照一致；两个后端与使用新入口的前端类型检查通过。
- 未启动应用、查看 UI 或调用真实模型。本轮不据离线结果宣称这些场景已验收。

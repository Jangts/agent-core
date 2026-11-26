# Agent Core API 一致性设计

2026-11-03。状态：**本轮API迁移已落地**。本页保留设计依据与边界，现行签名见统一手册，验证结果见完成记录。职责关系仍遵守 [Core、Support 与 Kit](../../design/design-layers.md)。

这里的“本轮”指 A 的一致性迁移，不包含 B 后续运行接口、C 的分发／维护整改或长期 R1—R7。全量状态统一见[计划 C](../plans/plan-c.md)，执行观察、上下文及消费者接线进度见[计划 B](../plans/plan-b.md)。下文清点数量、旧名称与“需要收敛”的例子保留当时审查依据，不代表今天仍支持旧合同或继续等待同一改造。

面向调用者的[统一版 API 合同](../../../packages/agent-core/development/docs/api/README.md)已与运行实现同步，包含固定调用结果、类型、模块签名和迁移表；旧参考入口转向现行手册，基础合同、调用结果与真实消费者已同步迁移，完整状态见[实施状态](api-implementation-status.md)。静态复核后的[覆盖范围、可行性及落地条件](api-refactor-coverage.md)进一步区分目标规格与完整发布手册，列出继承覆盖、一次解析、调用记账及当前数据合同要求。

## 1. 目标与范围

使用者掌握一组术语、创建方式和执行约定后，应能推断相邻能力的调用方式、数据结构及失败语义。统一包含命名、参数、类型、生命周期和可观察行为，不能只统一函数前缀。

本次静态审查覆盖 package.json.exports 的40个入口、21个单项Kit，以及可达声明与六端源码引用。已确认问题涉及 Core、Support、旧 Kit 和新增 Artifacts/Durable。详细一次性清点、源码定位及消费者列表按仓库约定保留在 development/output；本页只保留长期设计、代表性依据和迁移要求。

优先顺序：避免错误接入与数据丢失 → 统一同一概念 → 降低学习与发现成本。不能为了形式整齐放宽授权、取消、预算、来源、持久化和完整交付合同。

## 2. 术语与数据结构

| 概念 | 目标名称及含义 | 迁移前审查的代表 |
| --- | --- | --- |
| 登记实体主键 | id，始终为机器标识字符串 | Tool.name、Intent.goal、ModelCapability.id |
| 指向其他登记实体 | 明确的 *Id / *Ids | proposal.tool、selection.capability、read.document、task.reader/output/checks |
| 显示与说明 | name 为显示名称，description 为用途说明 | name 不再同时是工具主键 |
| 选择与策略 | scopeId/targetId 是选择；scopePolicy/targetPolicy 是约束 | Intent.scope/target 当前是模式，任务中的 scope 是ID |
| 领域分类 | kind | tool类别、output种类，不作为执行成功证明 |
| 消息／事件判别 | type | ContextRecord.kind、JsonTransportPart.kind 与其他事件type |
| 来源对象／来源身份／来源状态 | source、sourceId、sourceStatus 分开 | AnswerItem.source 当前是ready/unavailable/conflict |
| JSON Schema | JsonSchema 类型，jsonSchema 字段始终是只读对象 | ModelCapability.input、AnswerTask.parameters.schema 等 |
| 可执行 schema 适配器 | `SchemaAdapter<T>`：jsonSchema + parse，作为一个明确类型 | InputSchema 与原始JSON对象的隐式联合 |
| 运行输入与结果 | input 是实际载荷；value 是局部结果值；result 是流程结果 | 不再把 input 当 JSON Schema |
| 运行身份与调用身份 | runId、invocationId；requestId 是App传输请求身份 | Journal.callId、ToolEvent.invocationId 及数字call混用 |
| 错误问题 | Issue：code、message，可选结构化定位信息 | errors/code-message、issues/code-path等不同结构 |
| 时间与时长 | *AtMs 为绝对毫秒时间；*Ms 为时长 | deadline、startedAt数字与occurredAt ISO字符串 |
| 计数与序号 | *Count为累计数量，*Index为0起索引，*Sequence为1起顺序 | round、calls、sequence及maxSteps的含义 |
| 版本 | version为序列化格式版本；revision为内容／定义修订 | 不把内容修订和格式version互相替代 |
| 索引兼容签名 | configurationFingerprint等明确字段 | TextSearchSnapshot.schema实际上是签名字符串 |

本地目录内的引用可以是 *Id 字符串；跨生命周期且需要类型／版本定位的产物继续使用明确的 Reference。不要把所有字符串ID都包装成对象，也不要把 ArtifactReference 当权限凭证。

`ModelBinding.id` 是登记键，identity 是真实模型身份；二者不是同一个概念，不应合并。外部 wire 中的 name、parameters、functions 等标准字段也不跟随内部词典改名，由适配器转换。

## 3. 声明、配置和生命周期

| 名称 | 应表示的对象 |
| --- | --- |
| *Definition | 可复用的静态声明：身份、关系、schema和具名handler；不绑定一次请求的signal、预算或用户状态 |
| *Config | 可配置的值与策略，不夹带执行服务，不因可编辑就成为授权 |
| *Ports | 可调用的依赖／适配器合同，不隐藏数值额度或业务默认值 |
| *Options | 对具体构造或调用的命名选项，可组合config/ports，但二者归属明确 |
| *Context | 当前操作所需的App上下文与运行边界，不成为全局业务字段集合 |
| *State | 被流程拥有、可按合同更新的工作状态 |
| *Runtime | 已绑定依赖和生命周期的执行实例，不能把它与可提交State混在一起 |
| *Snapshot | 已捕获的数据与身份／修订信息，需说明所有权及是否可序列化 |
| *Checkpoint | 可恢复的运行状态及格式版本，不等同业务事实、历史授权或模型答案 |

- define* 编译／校验可复用声明；create* 构造适配器或绑定运行环境；new 用于有独立实例状态／生命周期的服务。不得同时为一个普通创建动作增加三个首选写法。
- 只读 catalog 优先通过 define 工厂；有增量注册需求的 registry 提供明确 register/registerAll/seal 生命周期。
- 请求signal、模型预算和权限在运行时绑定。AnswerFlow与Durable均在run传入运行context；旧构造与历史输入分支移除。
- 一次绑定的实例可以让后续调用省略execution；逐次绑定的API把execution放到请求末端。不能同一首选API有多处signal且优先级不明。
- 不建立一个包含所有Kit字段的全局上下文，不要求不使用Kit的应用填充其局部状态。

## 4. 动词必须带有可推断的合同

| 动词 | 约定 |
| --- | --- |
| is* / can* / has* | 返回boolean，不做转换；不能靠false以外的truthy值判定 |
| assert* | 通过返回void，失败抛错；不能忽略boolean或Promise返回 |
| parse* | 校验并转换，返回类型化结果；失败抛错 |
| check* | 返回结构化CheckResult，带issues；可按已声明规则提供修正值 |
| authorize | 通过返回void，拒绝抛错；布尔能力测试另叫isAllowed |
| get | 查询一个可能不存在的登记项，缺失返回undefined |
| require | 强制取得登记项，缺失抛明确合同错误 |
| read | 真正取得资料／资源；由真实端口拥有授权、存在性及版本校验 |
| run | 执行一段有界流程 |
| invoke | 调用某个已选择能力 |
| dispatch | 对已解析协议分发到登记handler，不等同工具真实执行 |
| render / compose / project / search | 保留各自领域语义，不统一改叫execute |
| observe* | 旁路观察、错误隔离，不参与业务成功与授权 |

同步和异步版本服从原流程性质。不能为了统一外形把同步检索、转换、校验全部改成Promise。同步接口误返thenable应在接入边界拒绝；异步接口必须明确等待。仅依靠 TypeScript 的 void 回调并不能排除返回boolean或Promise的函数。

Support 授权统一通过返回 void、拒绝抛错；误返 boolean 必须拒绝，不能悄悄当作通过。首次拒绝、错误优先级、校验和授权顺序必须保持。

## 5. Schema、检查和错误

### Schema

统一两个明确概念：

- JsonSchema：只读的原始JSON Schema描述。
- `SchemaAdapter<Value>`：含jsonSchema和parse的可执行适配器。

SDK首选声明中的 inputSchema 固定为适配器合同，不再在同一字段中隐式接受原始JSON对象或带函数适配器。需要裸JSON和parser的调用先通过Support构造适配器；向模型投影时只取jsonSchema，实际执行仍调用同一parser。

与stage、权限或业务上下文有关的refine/handler继续显式接入，不能为统一纯parser而删除这些检查。旧协议的完整schema和模型可见schema分别命名，不能把不同投影混成一个schema属性。索引配置签名不是JSON Schema，必须改名而不是转换为假schema。

### 检查结果

共享 Issue 基础字段采用 code/message，路径信息使用可无损定位字段的结构，不在中央归一时丢弃。CheckResult 明确status、issues和可选value；passed/failed/unavailable/not-run是检查状态，不成为所有工具、任务和交付的统一业务状态。

纯布尔条件、抛错断言和可恢复的问题报告不能继续都叫validate。共享只发生在它们真的具有同一语义时；不为每个普通返回值增加Result信封。

### 错误

- SDK自身的异常与getErrorInfo采用同一issues和code来源；保留App异常身份、取消原因和已知字段。
- 当前OutputCatalog抛出的.issues与getErrorInfo读取的.errors必须接通，不能继续丢失定位数据。
- 错误工厂按构造选项中的errors登记，具名说明触发条件；便利规则工具可保留字符串短写，不让所有业务接口各自再造一套Error|string|factory联合。
- `BudgetError.code` 与统一视图代码不得对同一语义给出互相竞争的权威值；资源／阶段细节另行描述。
- 交付sink失败和旁路observer失败必须保持不同处理，不能让日志失败触发业务重试。

## 6. 参数、泛型和返回对象

- 简单标量操作保留get(id)、has(id)，不为形式统一再包一层请求。
- 通常采用payload在前、context在后；存在多个身份、输入、运行端口和限制时用具名请求对象，避免四五个位置参数。
- 同一创建函数只保留一个首选构造形状；历史位置参数移除，不与新选项并列。
- 通用泛型角色顺序为Input、Output、Context，角色不存在时省略。复杂流程的额外角色使用具名类型，避免连续unknown使接入方必须查实现。
- 低层动态输入的结果维持unknown，高层由登记清单推断；禁止用调用者自报泛型让未经检查的结果看似经过验证。
- select(ids)后的类型与实际集合同时收窄；动态字符串仍经过运行时检查，不伪造编译期保证。
- 有独立接入价值的公开工厂返回对象提供具名接口，方便App实现端口、声明属性和查文档；不为每个私有局部对象补类型。

### 调用输出固定形状

根据后续用户反馈，invoke统一返回InvocationResult：`{ value, invocation }`。模型／工具／外部模型绑定共享这个外形，各自的业务值和调用元数据通过泛型表达；纯文本短写只能归一化输入，不能切换为裸string返回。结构化协议改变value类型，不改变外层合同。失败统一抛错／拒绝Promise，不增设raw/fullResponse等输出模式。不同职责的纯查询、解析和检查仍保留自己的返回合同。具体类型见目标API的共同类型页。

## 7. Catalog 与 Registry 共同表面

对真正表示登记集合的对象，采用下面的可预测语义：

| 操作／属性 | 目标合同 |
| --- | --- |
| definitions | 有序、只读的定义数组，不同时表示Record |
| byId | 如确有必要暴露，明确为按ID的只读对象映射 |
| ids() | 只读ID数组 |
| values()/entries() | 遵守Map式迭代语义，不用同名数组属性替代 |
| has(id) | boolean |
| get(id) | `Readonly<Definition>`或undefined |
| require(id) | `Readonly<Definition>`，缺失抛错 |
| register/registerAll | 只存在于可变registry；返回和封存时机必须一致 |
| seal | 固定注册边界；不能某个批量API默认封存、另一个完全不封存却不说明 |

命令闭集可以保留Record书写优势，但不能把它命名成与数组definitions相同的形状；通过具名入口适配。纯算法、单个resolver或渲染函数无需为凑共同方法变成registry。

`ProtocolRegistry` 当前只是唯一键Map。应明确作为基础集合，不向使用者暗示它就是Core调度协议。

## 8. 观察、时间、身份和数据所有权

- observer是旁路，sink是交付；返回Promise是否被等待必须由名称和合同共同说明。onOutput与onCallEnd不能仅靠一段注释区分两个完全不同的运行保证。
- Core、Provider、Kit事件保持各自所有者。它们可复用描述／观察基础类型，不能把所有事件升级成Core事件。
- 同一次工具调用在Journal、工具事件和诊断里使用同一invocationId或显式映射。不能只统一字段名却保留两个互不关联的编号生成器。
- 补齐实际事件载荷的类型；当前tool.call/result的invocationId、已知workflow事件结构不能继续在公开类型中缺失或被unknown抹掉。模型任意生成值和App错误仍可保持unknown。
- 内部运行的绝对时间统一毫秒；日志/外部wire需要ISO时在明确的序列化适配边界转换。当前日志采用明确版本与字段，不实现历史格式读取或升级。
- 模型调用数、检索次数、修复次数分别计数，但计数机制和单位命名可一致；round预算与node执行次数不能继续共用模糊maxSteps名称。
- 返回缺失、未测量、拒绝接管、继续执行分别说明；只有泛型终值可包含undefined且与“继续”冲突的控制协议需要显式判别，不把所有业务返回改成统一信封。
- 定义快照、结果副本和实时业务句柄明确分开。本库拥有的配置使Readonly与冻结保证一致；公开事件集合不给可写活引用，不深冻App服务实例。
- 所有handler注册边界都保留原接收者及注册时方法引用；不能只在Core修好，而在AnswerReader/OutputProvider等Kit里重新丢失原型方法。

## 9. 一个首选公开面

- Core服务从根入口使用；Support接入辅助通过根Support命名空间。
- Kit首选其独立子路径的具名函数／构造器，按职责使用define/create/new；显式全量入口提供一致的再导出。namespace 对象可提供同源组织入口，但不为同一创建动作给出多套并列教程。
- 同一实现保留明确的公开名称。Interaction 为 InteractionProtocol 的命名空间入口，Commands 为 CommandCatalog；不再提供历史全称、缩写及弃用别名。
- /types和/structs不能继续让使用者猜覆盖范围和是否有运行时值；逐步收敛到清晰的类型导入规则，不保留历史路径和字段适配。
- 公开面以package.json.exports和实际export为权威。文档与静态清点从这里派生，不能另建只供提示词或文档消费的平行函数清单。
- 现行聚合入口转出同一实现，不制造 wrapper class、历史兼容层或另一套运行循环。

## 10. 实施顺序与完成依据

| 次序 | 同步改动 | 完成依据 |
| --- | --- | --- |
| 1 语义底座 | 术语、SchemaAdapter、Issue/CheckResult、执行与观察合同 | 相同字段具有同一类型和解释，不靠所在文件猜含义 |
| 2 高风险合同 | authorize、同步误接、handler接收者、错误归一、事件关联 | 拒绝不会变通过；已知错误不会丢失；日志/取消不改变业务结果 |
| 3 定义与运行 | 工厂/构造、参数顺序、Catalog、只读/副本、推断 | 一个概念的库接口和全部真实调用方同批迁移，无平行分发 |
| 4 公开面 | 首选入口、别名、具名类型、示例与文档 | 新手只学现行路径，全部消费者同步使用当前合同 |
| 5 持久化合同 | Durable检查点、索引快照、诊断事件和App记录 | 只读写当前格式；不新增历史转换，不操作运行数据 |

每次以一个概念及其消费者为单位，不能先给全部旧参数加别名就宣布统一完成。迁移不改变产品规则、模型语义选择、授权范围、错误优先级或已发生副作用的判断。

验证围绕真实合同：统一授权拒绝与异步误接、三类校验用法、参数顺序、get/require、缺失值、选择后的类型收窄、事件载荷、接收者、观察隔离和当前持久格式。利用现有public-api类型示例和相关隔离测试，不新增只检查函数名文本、为分类完整而存在的自动门禁。

当轮已完成运行 API 与消费者迁移、公共包双格式编译、公开类型及相关隔离回归；详细结果见实施状态。未启动应用、调用真实模型或部署，不将这些本地证据称为线上验收，也不把历史测试数当作 B／C 新产物的验证。

## 日志链路补充

日志目标采用逐条事件与显式关联键，提供可直接映射关系表的run/span/event结构；Journal从同一执行事实生成运行投影，不另造callId或持久化整份历史副本。现状缺口、请求异常关联及当前格式见[请求、调用链与Journal](../../../packages/agent-core/development/docs/api/observability.md)。基础v2事实信封、调用关联和App文件平铺适配已落地；关系表／链查询及图形实验未实施，保留期与采集配置不变。

B1 进一步让日志输出与 `execution.observe.event` 消费共同事实，替代旧 workflowEvent／loopEvent／callEnd 观察入口；按序等待的 sink.output 仍保留内容交付语义。App 通过 FileLogSession.recordFact 平铺 Core 信封，自有 record 记录保留另一种当前来源，不增加双层 Core payload 或旧格式转换。有界文件 reader 属于 C4 的 App 存储适配，不能视为 R1 图查询或 R2 模型复盘已完成。

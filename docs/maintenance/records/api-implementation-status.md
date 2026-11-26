# API 整改实施记录

2026-11-04。现行 API 只维护一套合同。Core 拥有接口和执行保证，Support 提供推荐实现与配置生成，Kit 保留独立领域能力；Core 运行不依赖 Support 或 Kit。完整原则及实施过程见[Core 与 Support 整改](../plans/support-refactor-plan.md)。

## 已落地的合同

| 范围 | 现行结果 |
| --- | --- |
| 调用入口 | Engine 绑定 Workflow、模型与固定依赖后执行 run(state)；原始 CoreStep 自编排继续有效。fork 复用绑定并组合 Workflow |
| 成功结果 | 模型与工具统一返回 `{ value, invocation }`；字符串短写仅简化输入，失败继续抛错 |
| 结构化实现 | Core 接受接口实现，Support 产物无需转换普通对象；规范方法绑定原接收者，配置 getter 按约定读取并快照 |
| 注册与查询 | 查询只承诺真实保存的登记投影；保留 App 数据元信息，额外 helper 不伪装成登记方法。规范列表只读，describe 的列表是独立副本 |
| Schema、检查与错误 | 使用 SchemaAdapter、Issue、CheckResult；ValidationError 只提供 issues。同步断言误返 thenable 或 boolean 时拒绝，不放松授权 |
| 模型协议 | 统一 prepare/createResponse/push/finish 传输，InteractionProtocol/CommandCatalog 使用明确的模型与完整输入 Schema 投影 |
| Workflow 与路由 | 定义和事件统一使用 entryNodeId/nodeId/roundIndex/targetNodeId；生成器拥有专用默认值，Workflow 只做公共校验、重复消歧与占位符展开 |
| 业务 Kit | Knowledge、Answering、Presentation、检索、搜索、外部推理、Artifact、Durable 均已迁移到现行合同与真实消费者 |
| 诊断与 Journal | 复用真实 invocationId 与 run/span 关系；Journal 是请求内投影。Core 事实逐条发出，App 通过 recordFact 平铺保存 |
| 子日志与模型参与标记 | 2026-11-04 追加：现有 context.report／回执／诊断接口接入 usedModel 与执行专属 SubFlowLogger；write 先记意图，fix 补待定结果，readAll 返回固定快照，拒收手写数组／普通对象 |
| 持久数据 | DurableCheckpoint、TextSearchSnapshot 和 Core 事件只接受当前结构；ArtifactReference 直接使用 resolverId/artifactId。旧类型、升级转换与历史读取分支移除 |
| 文档与示例 | 一套现行手册，公开符号参考从实际 exports 和声明生成；离线示例展示同一调用方式逐步增加配置 |

本项目按全新版本同步发布 SDK 与 App，不承担历史格式兼容。本次没有清库、转换线上记录或操作运行数据。当前格式中的 version 字段仍用于明确协议身份，不意味着实现历史升级路径。

## 真实消费者

Banker 与小可乐已同步迁移模型、工具、流程、上下文、检查／输出目录和持久任务调用。cafe 的协议与流消费者也在范围内。App 原有领域字段、供应商 wire 格式与当前语义别名保持其归属；它们不作为 SDK 历史兼容接口。

## 验证依据

SDK ESM／CommonJS 编译与追加复核后的 430 项全量离线回归通过，覆盖公开类型、注册投影、类私有接收者、授权、预算、取消、调用关联、当前持久结构及旧格式拒绝。

| 集成检查 | 结果 |
| --- | --- |
| 全部公共包生成与双格式构建 | build:packages 通过 |
| server、banker-api 编译 | 通过 |
| cafe、banker-web 消费类型检查 | 通过 |
| Microcola 相关后端回归 | 206 项通过；真实 SSE 首轮受沙箱端口限制，允许回环监听后单独复验通过 |
| Microcola 权限与维护边界 | 6 项通过 |
| Banker 相关后端回归 | 135 项通过；两处测试旧字段／依赖转发修正后对应文件复验通过 |
| cafe 协议、历史与流回归 | 34 项通过 |
| Banker Web 对话、欢迎与账号回归 | 26 项通过 |
| 离线示例 | 8 个示例已执行通过；统一 API 示例另有 checkJs 类型回归 |
| Workspace | 依赖、导出与双格式解析检查通过 |
| SDK 文档 | 45 份 Markdown、1978 个本地链接及相关锚点检查通过 |

以上是 SDK 全量与相关消费者的针对性验证，不是六端全部测试。HTTP/SSE 回归使用临时数据库与本机模拟服务；未访问运行数据库或外部模型。其他阶段性证据见整改计划。

## A 阶段留待后续的范围（历史）

以下保留 A 阶段当时的范围记录；B 已实施的内容以[计划 B](../plans/plan-b.md)为准，现有日志接口的追加实施见本页末节，不能继续把它们视作出图前的未实施规划。

- Support 的策略档位、多场景推荐补全，以及上下文压缩／选择迁为可替换 Workflow 节点，已记录方向，未在 A 计划中实施。
- 过程事件按“App 注册监听、Core 触发执行事实”统一设计。当前已有生命周期观察与模型分片；压缩开始、节点内连续进度和统一订阅面仍有缺口，详见[运行中的状态和输出](../../../packages/agent-core/development/docs/api/observability.md#运行中的状态和输出)。
- 图生成、链查询服务、子图展开与动画回放仍属于独立实验规划，没有实施。

本地验证不代表真实模型、生产部署或 UI 外观验收。本轮未打开 UI、调用真实模型或部署。

## 交接前追加复核

2026-11-04 按用户要求再次独立核对首轮目标，已完成下列 A 补正，不将它们改名为 B 后置能力：

| 补正范围 | 修复与新增证据 |
| --- | --- |
| 错误工厂与结果接口 | Candidates、Intent／Scope、Tools 错误工厂固定原接收者；Recovery／Delivery／CoreStep 接受原型 getter 与合法 undefined，拒绝缺失值，读取后检查取消 |
| 一次绑定与快照 | Engine 与 Runner 复用 Core 内部模型定义编译，嵌套预算／上下文策略和规范回调在安装时固定，保留 transport 原对象身份；ToolLifecycle 全部规范 options 方法与策略列表快照，App 私有服务仍可动态工作 |
| 单次取消 | CoreStep run(step, { signal }) 与实例信号组合；无 Workflow 却传 modelId 明确拒绝，保留原取消原因 |
| 默认选择器 | 空选择表示不裁切，继续最终预算校验；真实 Support→Core 路径覆盖字符及 token 超限，不能借空选择放过限制 |
| 验证 | SDK 双格式构建、430 项全量回归、两后端编译、Microcola 145 项和 Banker 44 项相关回归通过 |

独立审计同时核对了 Core／Support 依赖、全部 Kit 运行与存储入口、结构化实现、注册投影、路由公私边界、两个 App 和离线示例。没有发现仍需转交执行的 A 范围明确缺陷；B 承接新增／后置能力及进一步优化，不能把这里的证据冒充 B 完成。

后置实施及完整交接见[计划 B](../plans/plan-b.md)与[交接约定](../plans/plan-b-handoff.md)。过程事件统一、上下文节点化与策略补全仍按其真实状态单列。

## 现有日志接口追加实施（2026-11-04）

用户确认日志改造现在实施，只有出图、播放和 Jangts 后台渲染保留为规划。Workflow、简易 Loop、ToolRegistry／Support 工具与 executeInvocation 的既有执行 context 统一提供 report 和 createSubFlowLogger；未新增日志出口、调度层或 SDK 运行依赖。

子日志实例绑定一次执行，通过 write／fix／readAll 生成固定格式有界数组；普通对象／数组、伪造方法和跨执行实例拒收。write 立即追加意图事件，fix 按稳定 ID 和递增修订补空缺结果，旧快照和已知事实不改写；已知终态可以补尚未取得的结果，但不能重开状态。短路、错误、取消保留已送出的计划／开始记录，缺少结果不推断终态。完成通知前关闭实例，拒绝监听回调和异步迟到补写。

usedModel 为主／子节点自身上报的可选布尔元数据，未上报保持未知，不自动滚入主节点。沿用内容授权、getter 延迟求值、日志失败隔离与保留期；两端现有 recordFact 适配继续接收同一信封。字段及参数见[现行合同](../../../packages/agent-core/development/docs/api/observability.md#子日志实例与先记后补)。

本次 SDK 双格式构建及106项相关离线回归通过。首轮相关检查发现一个旧用例仍要求同一 ModelRunner 并发，已将用例同步到既有拒绝并发规则，并验证拒绝不污染当前调用及后续回执；未改变模型并发策略。最终真实 tarball 在空缓存、真实本地依赖和 offline／ignore-scripts 安装下通过42入口 ESM/CJS 加载及 skipLibCheck=false 严格消费；正式 reference 与最终声明生成结果逐字节一致，2062个本地链接（含1849个声明行号链接）及17个标题锚点有效。随包与复制 Skill 解析复验通过，网站源码／产物仍不进入 SDK。

证据位于 `development/output/agent-core-logging/tests.txt`、`final/result.json` 和 `docs-generate.txt`；旧失败保留在 initial-tests.txt。此为当前日志改造的针对性验证，不冒充 A／B／C 历史批次或两端完整运行验收；未调用真实模型、读取运行日志、启动 UI／服务或部署。

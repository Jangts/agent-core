# 模块职责与源码定位

本页供维护者理解内部归属。App 开发者的接口、参数、返回和异常见 [API 手册](../../packages/agent-core/development/docs/api/README.md)。

Core 定义 App 调用与 Core 回调的双向合同；Support 在 App 侧辅助接入；Kit 在 App 侧组织可选业务。三者是设计取向，允许复用公共基础，不为分类完整新增执行层。

## Core

| 能力 | 实现定位 | 负责内容 |
| --- | --- | --- |
| 执行与工作流 | `src/execution/engine.ts`、`workflow.ts` | 有界轮次、路由、状态提交、roundIndex、取消与错误 |
| 模型调用 | `src/model/runner.ts` | 输入／schema／输出预算、provider 消费、取消、超时及解析提交 |
| 模型能力 | `src/capabilities/model.ts` | 能力声明、阶段选择、封存与 parse 调度 |
| 工具执行 | `src/capabilities/tools.ts`、`src/capabilities/invocation.ts` | 输入→执行→输出；真实调用与回执 |
| 上下文 | `src/context/` | 单片段信任与预算边界、装配／审计及请求内 journal |
| Core 执行事实与日志 | `src/execution/events.ts`、`src/diagnostics/` | 同源事实、execution.observe 与可选 output、惰性资料和失败隔离 |

## Support

Support 的推荐公共面是根部 `Support`。

| 能力 | 实现定位 | 负责内容 |
| --- | --- | --- |
| 模型接入 | `src/support/model/` | 原生／JSON adapter、interaction creator、阶段协议引用装配、HTTP Provider 与 wire 格式 |
| Support 网络观察 | `src/support/model/observer.ts` | Provider 自有可选 observer，不写 Core 事件 |
| 上下文接入 | `src/support/context/` | formatter、片段顺序、字段合并、消息构造；选择／压缩策略及节点实现，不在 Core 再建业务策略分发 |
| 能力组合 | `src/support/capabilities.ts` | 应用模块工具归属、重复及跨模块引用检查；不定义业务生命周期 |
| 条件登记 | `src/support/registration.ts` | 有序配置、when 与 register |
| 传输辅助 | `src/support/transport/` | SSE 读写与背压、JSON 对象帧扫描 |
| 规则辅助 | 复用 `src/utils/rules.ts` | breakWhile、matchRule、walkRules 与 App 可选观察 |

Support 的 creator 产出 Core 可消费的配置；不会建立平行的调度协议。Provider 不根据模型名猜测供应商特性。

## Kit

单项入口与 `/kits` 全量入口使用同一对象或构造器。实现名与入口名保持可定位的对应关系。

| 公开名 | 首选入口后缀 | 负责内容 |
| --- | --- | --- |
| Interaction | `/kits/interaction` | InteractionProtocol／CommandCatalog、字段检查、schema、载荷解析与本地分发 |
| Domain Tools | `/kits/domains` | 领域 Tool、范围及任务关系投影 |
| LifecycleTool | `/kits/tools` | 领域生命周期、贡献、normalizer、finalizer；真实调用委托 Core |
| Knowledge | `/kits/knowledge` | 文档、章节、显式选择与快照 |
| Personal Memory | `/kits/memory` | 用户自述的来源关联、版本替代、撤回、有限投影；存储、模型、授权和生命周期由App拥有 |
| Answering | `/kits/answering` | 回答任务、校验、复核、修复和降级 |
| Presentation | `/kits/presentation` | 母板、字段所有权、语义插槽、回复格式与气泡归一、变体 |
| Normalization | `/kits/normalization` | 有序转换、完成短路、稳定去重 |
| DeliveryPipeline | `/kits/delivery` | 请求状态、阶段 hook 与 handler、提前交付 |
| Projection | `/kits/projection` | 内容预算、连续前缀与树投影 |
| Aggregation | `/kits/aggregation` | 同步查询、稳定归并与结果计数 |
| ModelCalls | `/kits/inference` | App定义输入输出与模型身份的统一注册／调用／取消，不定义模型类别 |
| VectorSearch | `/kits/vector-search` | 可选精确余弦检索、维度校验、应用过滤与分组 |
| RRF | `/kits/rank-fusion` | 可选多路排名融合，不依赖模型或数据库 |
| TextSearch | `/kits/search` | 可选MiniSearch全文索引、字段加权、应用过滤、有界候选及快照恢复 |
| TextBlocks | `/kits/text-blocks` | 长文本结构分片、原文偏移与精确拼回；分页、检索与存储由 App 负责 |
| Retrieval | `/kits/retrieval` | 查询去重、预算、真实来源与 effects |
| Evidence | `/kits/evidence` | 证据满足条件和来源投影 |
| Policies | `/kits/policies` | 全量原因评估与有序恢复 |
| Candidates | `/kits/candidates` | 浅层候选提案合同 |
| Artifacts | `/kits/artifacts` | 产物引用与当前授权、版本、有效性 resolver；真实规则由 App 提供 |
| Durable | `/kits/durable` | 基于现有 Core Engine 的可恢复顺序任务；App 存储、锁及副作用对账 |
| BranchVersioning／BranchVersions | `/kits/branch-versioning`（兼容 `/kits/family`） | App 状态版本、候选分支、合并及显式启用；授权与原子存储由 App 提供 |
| Reflection | `/kits/reflection` | 获准元数据读取、有界模型复盘与带证据报告 |
| TextSkills | `/kits/text-skills` | 文本 Skill 清单、文档头和长度检查 |

实现位于 `src/kits/`：单文件能力直接使用对应名字，例如 `tools.ts`、`text-skills.ts`；多文件能力使用对应目录，例如 `knowledge/`、`interaction/`。相关声明在 `src/structs/kits/` 按同名职责组织。

Core 子入口（`/engine`、`/model`、`/tools`、`/context`、`/journal`）只转出 Core 合同与共享机制；Kit 实现从各自的 `/kits/*` 入口导入。根入口仅作为文档化的便利聚合，不使 Kit 成为 Core 运行依赖。

## 类型与共享基础

`src/structs/` 按 execution、model、tools、context、support、kits、utils 分组，公共错误与 Core 诊断合同有独立文件。命名 interface/type 由声明模块拥有；实现按类型导入，不让 Core 运行主体反向依赖 Support／Kit。

`src/utils/` 保留规则匹配、冻结、可选观察、前缀、稳定查询键与唯一键注册器等公共基础。ProtocolRegistry 是通用唯一键 Map，不定义 Core 调度协议。内部模块直接引用实际实现；公开聚合入口转出同一实现。

## 领域组织与日志

App 的能力可使用 catalog／handlers／registration：清单说明约束与关系，handler 实现领域处理，登记入口注入依赖。按算法与时序组织普通函数，不强制把每个过程改成图。

Kit 的结果、异常及 observe 由 App 收集；Support Provider 的网络事件由 Support observer 交给 App。Core 日志只记录其实际运行，包括 Kit 内部调用 Core 执行器时产生的 Core 事件。可选观察器失败不改变正常业务结果。

Workflow.describe、ModelToolRegistry 与 Support.defineCapabilityCatalog 投影实际登记信息，不是另一份图专用业务清单。`subSteps` 是有界 reported 材料，不等同静态子图或 Core 内部真实调度。

文件／数据库 I/O 的归属在 App 适配侧：`development/skills/agent-core-app/scripts/lib/knowledge.mjs` 读取受控配置和知识源，调用公开 Knowledge 编译器；`packages/diagnostics` 与 `development/tools/diagnostics/inspect.mjs` 拥有文件日志适配。Core 不因此依赖文件读取、HTTP 路由或 App 存储政策。

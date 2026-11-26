# Agent Core 后续能力：R2—R5、R7

R6 随后独立实施并完成，当前记录见[新应用创建能力](new-application-plan.md)。下文的 R6 排除项描述本计划当时的批次范围。

2026-11-04，用户授权实施 SDK 能力及两个 App 的现有授权范围。A／B／C 的完成证据保留；本计划处理新的后续工作，不将其冒记为 C 的交付。

用户已明确两项新增边界：

- R2：仅站长／Developer 明确要求时，分析本人作用域的既有日志元数据，使用当前配置模型，不含日志正文，报告默认不持久保存。
- R3／R4：新增分支／专业任务记录，仅存脱敏目标、来源版本、阶段结果、累计预算和分支身份；7 天保留、24 小时执行期限、每账户最多 32 项，小可乐仅站长可用。不存原始日志／附件，不自动恢复。

## 实施关系

| 项目 | SDK 归属与复用 | App 归属 |
| --- | --- | --- |
| R2 日志复盘 | 可选任务能力，复用执行事实目录、ModelRunner／Workflow／工具和有界 reader 适配；模型可选择证据，不另建调度协议 | 当前认证作用域、元数据投影、模型处理和披露授权；报告直接返回 |
| R3 家族分支 | 在现有 branch／checkpoint 基础上提供可持久化的数据版本、合并检查与显式启用；运行依赖由 App 重绑 | 有界存储、来源／版本冲突、真实审核和唯一副作用提交 |
| R4 专业任务恢复 | 扩展现有 Durable 合同复用步骤、累计账本、版本、期限及对账 | 实际角色清单、资料版本、重新授权、账号隔离与显式恢复 |
| R5 深度／并发 | 既有 createChild 增加可覆盖深度、容量；逐层预算预留、取消和输出隔离；Support 组合普通子执行合同 | 角色与工具范围不自动继承；先接受结果，再按声明顺序提交 |
| R7 资料增长 | 可选候选与版本提交能力，复用 Knowledge 编译和实际存储端口 | 继续区分人工事实、用户画像、经验候选与发布，复用已有成长／画像生命周期 |

默认路径继续单层串行；进阶配置补在原入口，不换 DSL。Core 不导入 Support／Kit；文件、数据库、真实身份、审批和发布规则由 App 提供。可枚举能力／角色／规则从实际清单驱动，无旁路分发。R1 和 R6 不在本轮范围。

验证围绕具体疑问使用临时数据与离线 Provider，重点覆盖并发超额、逐层预留、取消与迟到结果、来源变化、恢复不重置预算、CAS 冲突和账号隔离；不访问运行日志／数据库、真实模型、UI 或部署。SDK 的 development 面向使用 SDK 开发 App 的人；本库设计和执行证据留在根 docs。

## 执行记录

状态：**本次授权范围已完成**。R1 保留原前置条件；R6 已在后续独立完成。下述交付独立于 A／B／C。

| 项目 | 完成实现与消费者 | 必要边界 |
| --- | --- | --- |
| R2 | Reflection Kit 使用普通 Core Loop、ModelRunner child、注册工具及 coreEventCatalog；defineReflectionLogSource 固定 trace 并投影元数据。Banker `/api/agent/reflection` 仅当前 Developer，小可乐 `/api/chat/reflection` 仅真实 owner 且核对 messages.userId／turnId | 当前模型、本人作用域、只读元数据，最多4页／64项／12000字符／4次模型调用；报告默认不持久化，不新增日志采集 |
| R3 | Engine 支持可序列化检查点 export／restore 和完整 branch 身份匹配；Family Kit 提供版本、三方合并、候选检查与 CAS 显式启用。两个 App 均有真实存储的 families／fork／merge／promote 接口，可从本人已完成专业任务接纳阶段成果 | activeId 选择数据版本，不热换运行进程或继承身份／工具／授权；调用方使用选定成果时重绑当前依赖；冲突不覆盖 |
| R4 | Durable 沿既有合同增加 bound store、每次恢复 authorize 和持久 modelBudget 预留。Banker products／planning、小可乐 knowledge-review／guide-outline 通过真实注册角色、版本与业务服务显式恢复 | 专业任务累计2次尝试，每次预留8次调用、总16次；失败不退款、不重置期限。未完整完成不保存阶段结果；附件不为恢复归档 |
| R5 | createChild 的 children 配置统一深度、共享容量和总创建数；逐层预算保留。Support.runChildren 复用普通子 runner，全部接受后按声明顺序提交。Banker 两层同角色子集委派，小可乐专业任务最多两路资料分析再汇总 | SDK 默认深度1、容量1、最多32 child；配置不复制权限、对话或输出。Banker 内层无进一步 delegate／写工具；父取消、局部超时与迟到结果均受约束 |
| R7 | Knowledge.defineKnowledgePublication 以同一公开编译器校验候选和发布集合，重新验证来源、有效期、publishedRevision 与真实 CAS。两个 App 的画像复用编译器；Banker 成长 review 的 promoted 必须引用实际维护资料／Skill 的真实版本 | 不把候选当事实；不自动写正式资料、Skill 或源码。App 的原有画像周期、低可信度及人工资料优先级继续有效 |

App 记录和协议的共同边界在 `packages/contracts/src/agent-work.ts`，已登记 catalog 和公开 exports，两个 App 继续显式依赖 contracts。Banker 的 `work` 与原产品 `tasks` 共计32项；小可乐任务和家族共计32项；家族最多16版本。仅保存脱敏目标、角色、来源版本、阶段摘要、累计预算及分支身份。7天保留、24小时执行期限，按原维护周期清理，不后台恢复。确定性脱敏屏蔽已知本人称呼、邮箱、连续号码和显式凭据字段；自由文本仍需调用者提交脱敏目标，未宣称语义匿名化。

小可乐新增 `0080_agent_work` 仅含表与索引；未对运行库执行迁移、写入数据或 seed。App 使用合同和实际源码导航分别见 [小可乐](../../../../main/docs/agent/professional-work.md)、[Banker](../../../../main/docs/banker-app/professional-work.md)。SDK 学习文档只保留成品合同和示例，不展示本计划或实施过程；网站由原会话维护，本次未启动站点。

### 独立验收

- SDK 新增绝对毫秒字段统一为 `createdAtMs`／`expiresAtMs`，与 `occurredAtMs`、Durable 的 `deadlineAtMs` 一致；App 既有外层存储字段在边界显式映射，不保留 SDK 旧字段别名。
- `npm run check:workspace`通过：8个App、9个包、37个contracts入口，双格式导出与声明依赖隔离正确。

- SDK ESM／CJS 编译通过。模型、预算、绑定、层级、持久任务、公开 API 和演进相关的60项离线用例通过；最终 Reflection／Family／Publication／Durable 演进组8项通过，覆盖低预算不动父预留、元数据投影、伪造证据、来源变更与真实 CAS。
- 两个 App 的定向 TypeScript 编译通过。新增工作记录隔离用例6项通过：真实 Level／SQLite 临时数据、跨账号拒绝、原产品任务与新记录合并配额、显式版本启用、完成成果接纳、崩溃后累计预留、来源变更、两路容量和取消后不提交。
- Banker 嵌套专业委派2项通过，证明相同 Workflow 和祖先账本、角色／资源范围不扩张；真实已维护发布目标核验1项通过。既有 Banker 委派与产品持久任务23项通过。
- 首次选入的旧 server 画像文件含两个 HTTP 监听用例，监听被环境 EPERM 拒绝；该组其他用例通过。已停止这些监听用例，不申请权限、不作为已通过证据，也未扩大为服务运行验收。新增验证保持无监听的隔离形式。
- 最终真实 tarball 为734文件，files严格为dist、development/docs、development/skills；30个MD。25个真实本地依赖tarball，以版本限定overrides、空缓存、--offline --ignore-scripts安装，保留嵌套多版本。42个入口ESM／CJS加载通过，实际.mts／.cts消费者strict且skipLibCheck=false通过。
- 正式reference经`api-reference.mjs --output`临时生成逐字节一致，sha256 `a1d3893632b1e2cefa8263cda9c991fd6b3b336aaea4b8ae3abb68e68d5b2b05`。2013个包内目标、1810个声明行链接、17个标题锚点有效；包内／复制Skill均能解析真实SDK工具和文档，候选准备不修改正式配置。源码指纹在验收前后保持一致。

证据位于本地忽略目录 `development/output/agent-core-plan-d/`：`sdk-tests.txt`、`evolution-tests.txt`、`app-work-tests.txt`、`nested-tests.txt`、`publication-test.txt` 及 `final/result.json`。上一轮 C 的证据不被覆盖。未访问真实运行日志／数据库，未调用真实模型或部署；没有 UI／视觉验收。本次上线后真实模型的分析质量、耗时与成本未验证。

临时参考生成与打包检查曾有一次先后顺序竞态，比较在正式生成结束前开始而失败；已等生成完成后复验通过。该工具调度历史保留在 `reference-generation-race.log`；最终证据只使用最新 `final/result.json`。

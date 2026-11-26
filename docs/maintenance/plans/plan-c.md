# Agent Core 计划 C：交付、维护与只读日志基础

2026-11-04 追加授权的 R2—R5、R7 当前实现与独立验收见[计划 D](plan-d.md)。本页较早的未实施判断保留为其时点记录，不能覆盖现行 API。

R6 已在后续独立授权中完成，见[新应用创建能力](new-application-plan.md)。C1—C5 的交付范围和完成证据保持独立。

2026-11-04。对 A、B 和既有规划重新对照后确认：B 覆盖运行接口、过程监听、上下文节点化、Support 策略及两个 App 的接线，未完整覆盖第三方开发套件交付和只读日志查询基础。部分长期项仅在 B 列名，不能按 B 当前实施批次结项。

C 的可执行批次不依赖 B 完成，另开会话实施；Core 运行代码和 B 的事件／上下文／模型接口继续由 B 所有。长期项在本文件明确状态和依赖，不以写入计划冒充已实现，也不自动突破此前仅规划的限制。

完成状态（2026-11-04）：C1—C5 全部完成。Tools.describe 的声明缺陷由原会话收尾，C 已对修复后的真实 tarball 完成独立严格复验。R1—R7 保留前置条件，不属于本次完成范围。

## 全部规划的覆盖对照

| 原规划事项 | 当前归属与真实状态 | 后续承接 |
| --- | --- | --- |
| Core／Support／Kit 边界、结构化接口、统一调用结果、命名与错误 | A 已完成；保留自编排与普通对象最小启动 | 作为 B／C 共用基线，不重复造接口 |
| Workflow 入口省略、绑定、模型选择、add／fork、route 生成 | A 基础与 B4 接线已完成；纯定义与运行状态分离 | 现行合同与 B5 证据，不重新列为待建 |
| 能力／工具／Skill 关系、阶段协议装配 | 现有 Catalog 与 B3 同源生成已实现 | 现行声明驱动实际装配，不新建巨型目录 |
| 完成性、复核、局部修正、兜底与最终提交 | 当前业务出口已接入；异步节点能做接受检查 | B4／B5 审查实际缺口，不预建第二套终态框架 |
| 聊天／修复／复核／一层委派的共享预算、取消及期限 | 已实现对应请求账本与隔离 | B2 的节点调用继续复用，不能重新给额度 |
| 外部 ModelCalls 的对应请求预算 | B4 已接 AttemptBudget 尝试端口；Banker 查询／索引／探针各自拥有明确范围 | 独立于聊天 maxCalls 和向量条目，不声称跨业务持久总账本 |
| 产物引用、产品证据问答、持久产品批次 | Artifacts／Answering／Durable 及 Banker 消费者已实现 | 不重新列成待建；不等同跨请求专业子任务恢复 |
| 材料／产品／规划专业角色与 case work-plan | Banker 已有真实清单与接入 | B3／B4 按收益生成配置，不重建角色框架 |
| 统一类型过程监听和节点即时报告 | B1—B2 已完成同源执行事实与真实处理节点接线 | 当前 execution.observe.event 与 report 合同，证据见 B5 |
| 实际请求测量与同次准备快照 | B2 前置已完成 prepare／invoke 同次句柄 | 普通 invoke 仍不需要强制多步准备 |
| 上下文装配／选择／压缩节点化 | B2 已完成，Core 只保留通用装配／审计／最终预算 | Support 普通节点与 App 自定义实现遵守同一 Workflow 合同 |
| Support 场景策略、档位及配置生成 | B3 完成基础场景及同源生成，2026-11-05 补齐模型／推理／本地预算与上下文保留档位 | 完整上下文合同、精确配置和自定义实现可覆盖；不凭模型名称推断质量承诺 |
| 两个 App 的入口及运行接线 | B4 已完成 | B5 有实际消费者证据，C 不重复改运行接线 |
| 运行 API、渐进运行示例与实际消费者审计 | B5 已完成 | C3 对其最终分发产物做独立验证 |
| 维护工具的配置／候选基线一致性 | 已完成同次配置字节快照与 proposal 基线 | **C1 已完成**，证据见执行记录 |
| 官方 Skill 安装／复制后的资源定位 | 已完成公共解析、资产核实及共享编译入口复用 | **C2 已完成**，证据见执行记录 |
| 分发包内的公开参考、文档与真实依赖 | 最终实际 tarball、ESM／CJS 严格声明、文档链接、正式参考及 Skill 复验通过 | **C3 已完成**，声明缺陷由原会话修复，C 独立核对交付产物 |
| 有界日志读取及 inspect CLI | 已完成共用有界 reader 与 CLI，已修复集成审查的具体边界 | **C4 已完成**；不含模型复盘或后台接口 |
| 规划中的旧源码依据与状态描述 | 已核对 12 份维护文档，标明历史、现行与长期前置条件 | **C5 已完成**，跨范围冲突保留说明 |
| 静态主图／链查询／图形步进 | 出图与后台接入尚未实施；现有日志接口已接入 usedModel 及实例式子日志，write 先留意图、fix 补结果，入口拒收普通数组；未来视图按子树汇总颜色 | 长期 R1 仅图形部分待实施；日志是后续现有接口改造，不回计 C1—C5，不启动 UI 或图服务 |
| 日志模型复盘、经验产物与消费反馈 | R2 已完成有界元数据复盘、实际工具查询及两个 App 授权入口；报告默认不持久化 | 后续实施见[计划 D](plan-d.md)，不回计 C4；持久经验发布按 R7 合同处理 |
| Agent 家族持久接续、成果合并和候选上岗 | R3 已完成检查点导出／恢复、Family 版本、三方合并与 CAS 显式启用；两个 App 有真实存储消费者 | 见[计划 D](plan-d.md)；启用数据版本不热换进程，不恢复旧权限和执行依赖 |
| 跨请求专业子任务恢复 | R4 已完成专业角色、持久预算预留、每次恢复授权、来源版本核验及期限检查 | 见[计划 D](plan-d.md)；累计预算与期限不因恢复重置，不自动恢复 |
| 多层子执行与受控并发 | R5 已完成共享深度／容量／总数限制、祖先预算预留及 Support 结果接纳与有序提交 | 见[计划 D](plan-d.md)；默认仍单层串行，不自动继承工具和授权 |
| 新应用模板／脚手架 | C 验收时为长期项；后续已独立完成 Node／TypeScript 初始化工具、模板及真实包消费验证 | R6 独立交付见[新应用创建能力](new-application-plan.md)，不计入 C1—C5 |
| 自动摄取／画像学习／运行期资料发布 | R7 已完成候选、来源复核、重新编译、CAS 发布和实际成长／画像接线 | 见[计划 D](plan-d.md)；人工资料、画像和经验继续区分，不扩大自动采集与发布授权 |
| 插件发现／热卸载／独立容器、强制 /api 总入口、机械全包重排 | 原规划明确排除或按实际收益另议 | 不作为欠缺能力补造，不新增平行框架 |

已实现判断依据包括 A 实施记录、现行 Engine／Workflow／预算／Kit、Banker delegation 与 tasks 的实际消费者。B 状态以 plan-b.md 及其执行记录为准。历史段落写“尚未”不能覆盖后续真实实现；历史段落写“已完成”也不能扩大到未验收的远景。

## C1：维护工具使用同一配置快照

整改前 `readApplicationKnowledge` 读取配置并解析文档，`prepare-source` 在编译候选后再次读取配置计算 baseConfigSha256。配置在两次读取之间改变时，候选会声称一个与实际校验不一致的基线。C1 已消除第二次读取，当前证据见执行记录。

要求：

- 配置解析、读取预算、requiredReads 校验与 proposal 基线使用同一次读取的快照；hash 必须来自实际使用的字节。
- 人工校验、候选准备和 Skill 计划器按需复用现有解析／编译，不新增第二套 Knowledge 验证规则。
- 继续调用公开 Knowledge 接口。配置仍是 App 侧范本，文件加载不进入 Core，不为此新增 SDK 运行类型。
- 仅生成候选；不覆盖生效配置／资料，不自动审批或发布，不写运行数据库。过期基线明确失败或重新准备，不伪造 CAS／事务能力。

使用临时资料目录覆盖非空 canonical requiredReads、非法章节、超限、来源变化、配置变化与候选无发布副作用。旧 `{document,select}` 和快照旧字段属于 A 文档尾漏，原会话已先直接改正，不能包装成新的 C 能力。

## C2：官方 Skill 与已安装包复用同一资产

整改前 Skill 文档允许安装或复制，但 `plan.mjs` 从自身位置推断 tools，SKILL.md 也依赖原目录相对文档；只复制 Skill 后路径失效。C2 已改为定位并核实实际 SDK 资产。

- 核对并实现明确的安装／复制支持方式。若使用 App 已安装 SDK 定位资源，应按 Node 公共解析机制找到实际产物，验证返回的工具和文档存在；不能打印猜测路径。
- Skill、人工指南、候选和验证工具继续使用同一权威文档和编译入口，不复制第二套会漂移的规则。
- 计划器仍只读，不执行 App 代码、不调用模型、不建新应用、不编造事实、不默认全局安装。
- 最小用法保持简单；需要更多参数时是在相同入口补参数，不另造通用初始化框架。

修改 SKILL.md 前使用本机 skill-creator 技能，并遵守项目约定优先级。覆盖包内执行、复制 Skill 后从已安装 App 定位、依赖缺失及无资料空状态。

## C3：分发产物自洽

agent-core 按用户最终边界仅分发 dist、development/docs 和 development/skills；整改前生成器链接未分发 src 及相邻工程，部分开发手册又链接维护 docs。本仓链接检查通过不能作为第三方可用证明。C3 生成器与依赖整改已完成，正式参考及 B 文档剩余链接由 B 最终收口。

- 公开参考应链接实际交付的声明／资源或已有可靠源码地址；不捏造网址，不默认存在 monorepo 邻居。外部 re-export 使用真实可用的导出声明定位。
- 消费者文档与维护规划保持边界，不为补链接将整套内部规划打包，也不维护两套首选 API 文档。
- 安装说明依据真实 package dependencies 核对 streaming、mock-gpt 及其他依赖，不漏私有包，也不通过临时 stub、改变锁文件或放松 exports 伪造可安装。
- 在临时目录核对打包清单、公开入口、文档链接、工具及 Skill，避免依赖仓库别端 node_modules。不得发布 registry、访问密钥或安装全局 Skill。
- 重用现有生成器，以实际 exports／声明为权威，不添加手写平行符号清单。

生成器源码 `scripts/api-reference.mjs` 由 C 收口；正式 `development/docs/api/reference.md` 的最终生成归 B。C 可在临时输出验证生成器，不在 B 运行改造中竞争覆盖正式输出。

## C4：有界只读日志 reader 与 CLI 复用

归属为 `@jangts/diagnostics` 的 App 侧存储适配及开发 CLI，不是 Core 认识 App 或操作数据库。当前 FileLogStore 写入、保留期及 Core 事实不改变。

- 提供可组合的有界读取，配置根目录／范围及策略可先绑定，请求只传查询与分页；不强制另一个执行框架。
- 扫描字节、返回字节、事件数、行／附件大小、时间、取消及分页均有界；不能先整文件 readFile 再检查限制，或无限累计所有事件后排序。
- 游标绑定实际查询和读取范围。稳定快照能保证则保证，不能保证时说明 best-effort、水位、已读前缀与缺口；不将分页读完说成完整采集。
- 取消、过期、缺失、截断尾行、损坏、过滤、附件校验失败、限制中断分别如实表达；未知数量不填零。按现有存储到期策略读取，不自动延长期限或恢复正文。
- 只支持当前 FileLogStore 的实际格式；App record 与 Core recordFact 是两种当前来源，不是历史兼容。不得恢复旧 Core 字段转换。
- CLI 改消费同一 reader。保留已存在的明确正文查看语义；不增加 HTTP 路由、不读 App 消息表、不自动发给模型、不将查询提升成重放或业务执行授权。

仅以临时 fixture 验证普通／分页／超限／取消／到期／部分写入／附件等情况，不读当前运行日志，不改数据库、日志内容开关或保存范围。关系图、上下游业务链服务和模型复盘仍不在此批实现。

## C5：旧规划与实际状态对齐

- 以本文件覆盖矩阵为统一路线图，旧规划保留必要决策背景，当前入口指向对应现行合同；不再让相互矛盾的“待实施／已完成”决定状态。
- 核对日志平铺信封、统一观察入口、注册投影与真实源码位置，不照抄双层 payload 或已删除 workflowEvent／runUntil 等调用。
- 图形实验文档已经收窄为最新主图与所选日志临时增链；更早的静态局部子图候选不能与之混写成当前共同要求。保留来源和变化说明，未确认冲突明确标注，不自动新增子图 API。
- 明确区分已实现的 Durable 产品恢复、长期 case work-plan、内存 fork，与未实现的跨请求专业子任务恢复、宿主家族合并及上岗。
- 不把原本明确排除或待产品定义的事项列为可以直接编码的新任务。

## 依赖与并行边界

| 边界 | C 可以修改 | C 不修改 |
| --- | --- | --- |
| 维护与 Skill | development/skills/agent-core-app/scripts 及 lib、维护／知识／安装／Skill 文档 | Core／Support／Kit 运行源码及 App 调用 |
| 分发参考 | api-reference 生成器、必要的包交付元信息、临时产物测试 | 正式 API 参考输出与 B 新运行签名 |
| 日志读取 | packages/diagnostics 的新增 reader／相关声明与测试，development/tools/diagnostics/inspect.mjs | FileLogStore 写入、留存策略、两个 App 记录接线与生产数据 |
| 规划 | plan-c、C 交接记录及旧规划现状索引 | plan-b 的执行记录和 B 运行 API 手册 |

C 不等待 B 全部完成。共享构建与正式生成只是工作区操作协调，不是功能依赖：不要同时执行覆盖 SDK dist 的全包构建，C 优先使用独立包／工具检查；确需共同产物时先协调一个短窗口，不重建或回退 B 的源码。

## 长期事项的前置条件

R1 图形实验、R2 模型复盘、R3 家族合并／上岗、R4 跨请求子任务、R5 多层／并发、R6 新应用模板、R7 自动资料增长全部保留，不算 C1—C5 的验收产物。技术上可不依赖 B，不代表此前的产品／授权前置条件已经满足。

- R1：先明确图数据与链查询合同、真实关系／缺口、App message→run 授权关联；UI 仍仅规划。
- R2：先明确读取、模型处理、结果披露、派生内容保留与消费反馈，C4 不提供这些授权。
- R3：宿主状态、来源与冲突、批准责任、候选验证、唯一副作用归属先定义；fork 不自动接续有效授权。
- R4：目标／材料版本、累计模型额度及 deadline、重新授权、幂等与对账、可恢复结果先定义；不能按新请求重置额度或启动后台自动恢复。
- R5：深度、祖先预算预留、容量、并发取消、输出／状态隔离、提交顺序先定义，不直接解除当前限制。
- R6：模板用途、支持环境、运行体验和维护范围先确定；不生成虚构初始资料。
- R7：App 的来源可信度、审定、存储事务／CAS、删除、权限和记录范围先明确；当前文件候选工具不是运行期发布系统。

## C 的完成标准

C1—C5 分批实现并闭环，给出同业务前后对比、实际少掉的配置或重复、对应源码／文档／临时验证证据及未实施范围。普通代码／测试问题照常修复；交接考核只看概念、需求和目标风格。首批可从同一次配置快照开始，完成后持续推进，不一项一停等用户确认。

## 执行记录

### C1：同次配置快照（2026-11-04，已完成）

同一业务“替换带 terms 章节的 guide 资料”：此前 prepare-source 在编译候选后重新读取配置计算基线；现在 readApplicationKnowledge 从实际解析的字节计算 baseConfigSha256，候选编译、预算、requiredReads 和 proposal 共用这一读取结果。命令、配置字段与 Knowledge 公共合同不变，少一次文件读取，也去掉维护者需自行防范的错误基线关系；没有新增编译器或 SDK 运行类型。

源码现归 development/skills/agent-core-app/scripts/lib/knowledge.mjs 与 scripts/prepare-source.mjs；根据用户最终分发边界将原工具移入 Skill，不留第二份编译入口。针对性命令 `node --test test/maintenance-tools.test.mjs`：4 项通过，全部在临时目录执行，覆盖非空 canonical requiredReads、章节缺失／非法锚点、文档／读取超限、来源 revision 变化、配置字节变化、候选不改生效文件及失败不新增候选。竞态用例用 FIFO 在配置已读且来源等待期间修改配置：proposal 保持实际用于校验的旧配置 hash，不冒称新基线。

这不是文件系统多文件事务：来源读取期间各文件仍可能变化；proposal 保存各已读来源 revision，发布方仍须比较当前配置及来源基线，过期需重新准备。不提供自动发布、CAS、数据库写入或运行期学习。未构建 SDK、启动服务、读取运行资料或调用模型。

### C2：官方 Skill 资源定位（2026-11-04，已完成）

同一资料维护业务仍运行 `plan.mjs PROJECT [--source UTF8_FILE]`。新增 Skill 内 resources.mjs：从 PROJECT 使用 Node 公共包入口解析已安装 SDK、核实包身份和真实工具／文档文件；只有 SDK 包内 Skill 可以回退到自己的资产，破损的 App 安装不能被回退掩盖。计划器复用该 SDK 的 readApplicationKnowledge／compileApplicationKnowledge，透出同次配置 hash；不再自己读一套配置再猜工具路径。

SKILL.md 按 skill-creator 窄修，复制整个 Skill 文件夹后，使用计划器返回的 docs／tools 绝对路径；文档仍使用已安装 SDK 的权威使用说明，工具与共享加载编译范本统一维护在 Skill 的 scripts／lib，继续调用公开 Knowledge 编译器。最小入口不变，实际少掉复制后人工修路径与重复校验规则；不读取可选来源正文、不执行 App 代码、不造事实、不全局安装。

7 组临时资源定位场景和 Skill validator 通过：包内回退、复制后依赖缺失、已安装包定位、空资料与配置 hash、canonical 引用／缺章、缺资产、破损公开入口。临时脚本与结果在 development/output/agent-core-plan-c/c2/；这是资源定位 fixture，不是完整依赖安装证据（其扁平复制未保留嵌套版本）。真实依赖闭包与 tarball 验证另见 C3。

### C3：分发生成器与真实产物（2026-11-04，已完成；保留分批证据）

生成器 scripts/api-reference.mjs 现在从 package.exports.types 和实际已构建声明生成；本包符号链接随包 dist 声明，外部 re-export 链接本包实际导出声明，不假定邻包安装位置或编造源码 URL。新增可选 `--output FILE`，链接仍按正式 development/docs/api 位置计算，便于将临时结果放入交付快照核对；没有第二套符号清单。原交接标记为**生成器可供 B 最终生成**；B 与原会话现已完成正式生成，C 未覆盖正式 reference.md，也未构建 SDK。

受众审计追加：生成参考的首段仅保留定义来源、同源导出与声明链接等消费说明，已移除 workspace docs:api／--output 维护命令。操作说明归本包根 docs/README.md，不随 SDK 发布；正式 reference 仍由 B 最终生成。独立文档站拟定域名为 https://agent-core.jangts.cafe，源码和网站产物归 App，与此生成器及 SDK 分发无耦合。

安装指南、维护指南和包 README 已按实际 dependencies 补齐 streaming、mock-gpt、minisearch 与传递依赖要求，说明私有包来源、离线依赖闭包和当前 mock-gpt 的 Node 要求。不通过添加内部规划到 npm files 来补坏链接。

临时验证 development/output/agent-core-plan-c/check-distribution.mjs：按每个消费者实际 Node 解析递归收集 25 个真实包版本（含嵌套同名依赖），npm pack --ignore-scripts --offline 后按真实层级解包到隔离目录；40 个公开入口 ESM／CJS 均可加载，复制 Skill 定位与空资料编译通过。临时生成参考的 1,696 个链接均在真实打包清单内，声明行号有效。未使用 stub、网络 registry、源码路径映射或别端 node_modules。初次空缓存 offline npm install 因缺少多版本依赖元数据报 ENOTCACHED，解包验证不冒充 npm 安装成功。

后续一次标准 npm 方案已通过：临时 consumer 只直接依赖真实 SDK tarball，对其余 24 个真实 tarball 采用 name@version 选择 overrides，npm 11.6.0 在空缓存下以 --offline --ignore-scripts 安装 25 包；40 个入口 ESM／CJS 通过，临时锁文件版本清单与 tarball 清单完全一致。证据在 c2/npm-overrides-result.json，未修改交付包 manifest 或仓库锁文件；结论限定为这一明确的本地产物安装方式，仍不覆盖 B 声明错误。

用户最终决定：文档站是独立 App，源码归 apps/agent-core-docs，静态产物归该 App 的 dist，两者都不进入 SDK 发布包。SDK 的 package.files 精确列出 dist、development/docs、development/skills，不再包含整个 development 或 site。此前两次 site 源码／静态产物入包的判断和探针均已被此决定取代，不能作为当前验收依据。必要资料工具已整体迁入 Skill scripts／lib；人工与 Agent 复用同一代码和公开 Knowledge 编译器，没有将文件读取装入 Core。仓库 development/examples 退出分发，保留真实开发／回归消费者；使用文档到这些示例的链接由原会话与 B 按文档受众收口，不能为补链接反向扩大分发。VitePress 开发依赖归文档站 App，SDK 消费者不安装它。

新边界验证：实际 SDK tarball 的 714 个文件仅来自 dist、development/docs、development/skills 及 npm 自动纳入的包元信息；site、原 tools 和根 examples 未入包。临时消费者使用真实依赖 tarball、版本选择 overrides 与空缓存 --offline --ignore-scripts 安装，通过包内及复制 Skill 两条 plan → prepare-source → validate-knowledge 路径；工具路径均指向安装 SDK 的 Skill scripts，候选保持同次配置 hash，当前清单未被发布或改写。证据为 development/output/agent-core-plan-c/c3-skill-layout-result.json。迁移后的 C1 四项定向回归及 Skill validator 通过；未构建 SDK或运行 B 全套验证。该快照仍不替代 B 完成后的最终声明与链接核验，MD 受众分类继续由原会话负责。

首轮隔离快照曾发现以下真实问题；B 完成后的状态见下方最终复验，不能据 C 局部验证宣称分发整体通过：

- 首轮隔离声明快照的严格检查（skipLibCheck=false，ESM／CJS 消费者）报告 kits/tools.d.ts 的 Types_1／Types_2／Types_3 未定义。**最终复验已解决**：原会话修复源码并构建，C 验证真实新声明，未放宽检查。最初诊断仍保存在本地 c3-results.json。
- API 手册中的四个内部规划链接未随包分发：context-processing.md → plan-b；implementation-status.md → support-refactor-plan、plan-b、plan-b-handoff。**最终复验已解决**：维护记录已移出发布目录，消费者文档无未交付链接。
- B 按最终 dist 生成正式 reference.md。**最终复验已解决**：正式文件与当前生成器临时输出逐字节相同，链接指向实际交付声明，不覆盖正式文件。

### C3：B 完成后的首轮产物复验（2026-11-04，曾发现声明缺陷，现已修复）

已用会话状态与 plan-b B5 最终记录确认 B1—B5 完成，随后直接打包当前 SDK 和按消费者实际解析得到的 24 个真实依赖版本，未使用首轮 SDK tarball／临时参考替换最终文件。空缓存、版本选择 overrides、--offline --ignore-scripts 安装 25 包后：40 个入口的 ESM／CJS 加载通过；包内与复制 Skill 均通过计划、候选准备、校验且未改生效清单。

真实 tarball 为 709 文件、29 篇 Markdown（含包 README／SKILL）。仅交付 dist、development/docs、development/skills 与 npm 自动纳入的包元信息；使用文档均为 Markdown，网站、根示例、原工具目录及维护记录不入包。1,869 个本地链接目标（含页内锚点）、1,676 个声明行号和 14 个 Markdown 标题锚点全部有效。正式 reference 与基于最终声明重新生成的临时文件逐字节一致；验证前后交付源文件指纹相同，未覆盖正式参考。

当时未通过：隔离 .mts／.cts 消费者引入全部公开入口及真实 public-api 类型夹具，strict=true、skipLibCheck=false，报告 kits/tools.d.ts 中 15 处未定义 Types_1／Types_2／Types_3。问题定位到 src/kits/tools.ts 的 ToolLifecycleRegistry.describe 返回类型推断：复杂 RegisteredLifecycleTool 投影被声明发射器展开后产生无绑定别名。提出的修复点为显式声明 describe 的现有字段投影返回类型，保留 id／kind／description／audience／effect 的原类型及 string[] intentIds；不需要改运行行为或增加 API。该源文件由原会话接手修复，C 按既定边界未修改 agent-core/src，也未手改 dist 或放宽类型检查。

本次失败快照保存在 development/output/agent-core-plan-c/final/failed-tools-declarations.json；pending.json 保留旧声明指纹并现已标记 resolved，result.json 为下方最新通过结果。一次性脚本为 check-final-distribution.mjs。当时 C3 保持未结项，声明指纹未变化期间未重复安装或测试；B 的回归通过不替代独立严格分发检查。

分发受众追加闭环：原会话完成的 development/output/agent-core-docs/sdk-pack.json 已只读核对，实际清单仍为 709 文件，其中 development/docs 为 27 篇 Markdown，网站文件 0、docs/maintenance 维护资料 0。三篇维护记录归 SDK 根 docs/maintenance，JSON 范本已内联使用 Markdown，离线示例亦随包提供为 Markdown；原会话的消费 MD 链接检查无断链。此计数与 C 的 29 篇总 Markdown（另含包 README 和 SKILL）口径不同，不相加。

独立文档站由原会话另行验收，源码与产物仅归 apps/agent-core-docs，拟定域名 https://agent-core.jangts.cafe，未部署。其构建／校验覆盖 40 模块、472 符号、428 可调用成员、61 场景、62 策略源码、3 篇文章与 9 处图语法，本地搜索英文／中文／接口名命中；覆盖证据为 development/output/agent-core-docs/coverage.json。新增文档站开发依赖后，根锁及 workspace 检查由原会话复验通过（8 Apps、9 包）。这些是独立网站及 workspace 证据，不移记为 C 的 UI 检查或 B 运行功能验收，也不改变 SDK 分发白名单。

上述受众追加核对发生时 Tools 声明尚未修复，彼时 C3 仍未结项；此为历史阶段，不覆盖下方修复后结果。SDK site 或维护者 Markdown 均未恢复分发。

### C3：修复后最终收口（2026-11-04，已完成）

声明缺陷由原会话收尾：仅给 ToolLifecycleRegistry.describe 的原六字段投影加显式返回注解，保留 Tool 各字段类型、可写对象副本及 string[] intentIds，未改运行体或新增 API。原会话统一构建公共包并更新正式 reference，将现有 public-api 类型回归改为 skipLibCheck=false，增加 literal／可写副本夹具；其报告的 9 项 public-api／lifecycle 回归通过，作为源码修复方证据，未与 C 的产物检查计数相加。

C 收到新声明指纹后，重新打包当前 SDK 与真实完整依赖闭包，在全新缓存／隔离消费者执行原有实际产物验证：

- ESM／CommonJS 全部 40 个公开入口加载通过；.mts／.cts 消费者引入全部入口和更新后的真实 public-api 类型夹具，strict=true、skipLibCheck=false，严格编译通过，原 15 处未定义别名错误消失。
- 空缓存 --offline --ignore-scripts、版本选择 overrides 指向 25 个真实本地 tarball 的安装通过，保留同名依赖的真实并存版本；不使用 registry、stub、源码路径映射或仓库锁文件修改。
- 真实 SDK 为 709 文件，development/docs 的 27 篇使用 Markdown 加包 README／SKILL 共 29 篇；1,869 个本地链接目标、1,676 个声明行号、14 个 Markdown 标题锚点全部有效。网站、维护资料、独立示例及原工具目录均不入包，分发白名单未扩大。
- 正式 reference 与对新 dist 执行生成器 --output 的临时结果逐字节一致；没有覆盖正式文件。验证前后全部交付资产及生成器源码的指纹不变。
- 包内及复制 Skill 均通过 plan → prepare-source → validate-knowledge，返回实际安装 SDK 中的同一组工具／文档路径，候选保留同次配置 hash，未修改生效清单或发布资料。

新声明 sha256 为 a0cf46727a276992ace0e637092a2fb1412e8d9ff7482404102088121b5f3ef4，与原会话交付值一致。最新真实证据为 development/output/agent-core-plan-c/final/result.json（含已解决声明及来源归属），失败历史保留在 failed-tools-declarations.json。本次只重做修复所需的产物验证，没有重跑 SDK／App 全套回归、启动 UI／服务、调用真实模型或部署。C3 已完成，C1—C5 全部结项，完成后的自动跟进删除；R1—R7 继续保留各自前置条件。

### C4：有界 reader 与 inspect（2026-11-04，已完成）

同一业务“检查一条资料准备请求的获准日志”：此前 inspect 整文件读取并累计排序；现在 FileLogReader 预绑定 root／app／limits，listRuns 和 readEvents 的请求只给查询、分页、signal，CLI 共用同一实现。配置 primitive 和限额在装配时复制，调用方随后改 options 不改变已绑定范围。writer、到期清理、记录策略与 App 接线未改，Core 不依赖 reader。

扫描、目录枚举、返回 JSON、事件、行、附件、manifest、耗时、游标数量与空闲期均有界，不累计跨页事件或全局排序。实例内游标绑定查询和范围，close／取消／超时会释放读取会话；CLI 用 --pages 约束所有 reader 调用总数，退出后游标失效。当前 App record 与平铺 recordFact 均按原结构返回，附件核实实际字节、hash 和全部平铺身份；不转换历史 Core 字段。

coverage 明确 best-effort、当前／最后分段水位与解析已读前缀，包含过滤、跳过和 pending，不能当作已经返回的范围或完整采集。未知总量为 null；缺失的采集状态不填零。活动尾行保留缓冲供 TTL 内续页，已完成水位后的新增完整行不承诺被看到。静态链接拒绝与 O_NOFOLLOW 用于受控本地目录，不宣称对恶意并发父目录替换提供原子隔离。

针对性验证：独立 diagnostics 双格式构建通过；reader／CLI 共 16 个场景分批通过，原有 6 项 writer 诊断回归此前通过，未改 writer。覆盖普通／分页、扫描／目录／返回限制、无进展配置拒绝及仅余 1 字节的进展、游标 query／TTL／容量／close、当前两种来源、过滤、损坏／超长行、尾行补写、取消／超时、跨页 pending 和处理中到期、附件大小／hash／身份漂移、symlink、配置变异和 CLI 总页数。最后一个新增场景单独验证 8192 字节返回预算下恶意 manifest 的大字段、负序号及缺字段未知状态；不重复全套。测试仅临时 fixture，不读当前运行日志，不启动服务或模型。

### C5：规划状态与源码依据（2026-11-04，已完成）

复核 12 份维护文档（README、接口改造清单、API 一致性、能力演进、职责关系、日志规则／回查、执行蓝本、Knowledge 设计、模块职责、多智能体、新应用规划），统一从 C 覆盖矩阵进入现状，保留有用历史并标明旧签名／旧测试数的适用阶段。核对统一 execution 观察、平铺 recordFact 与 App record 两种当前来源、注册投影、当前源码位置和 KnowledgeSnapshot 字段；不恢复 workflowEvent、runUntil 或旧信封兼容。

图形规划以最新主图＋所选日志临时增链为当前方向，旧静态局部子图作为已取代方案保留说明。已实现的 Durable 产品批次、case work-plan、内存 fork，与 R3—R5 的宿主合并、跨请求专业任务、并发／多层分别表达；R1—R7 继续保留前置条件，不计为本次交付。

验证仅为源码／消费者核对、定向 diff whitespace 和本地 Markdown 目标检查；未构建、启动或读取运行数据。跨范围已标注而未抢改：App 图形实验文档 subSteps 默认值的历史矛盾，以及 B 长期表的旧静态子图措辞，最终由相应所有者收口。

### 本次交付边界

C1—C5 全部完成；B1—B5 的运行验收与 C 的独立分发验证分别保留证据。Tools.describe 的声明缺陷由原会话修复，C 已验证实际新 tarball 的严格声明、链接、正式参考与 Skill 自洽，未改 agent-core/src 或手改 dist。运行数据、采集范围、保留期和 R1—R7 前置条件未扩大。development 服务于使用 SDK 开发 App 的人，本库自身设计／规划／维护资料归 SDK 根 docs；独立文档站不计作 C 新 starter 或图 UI，也不随 SDK 分发。

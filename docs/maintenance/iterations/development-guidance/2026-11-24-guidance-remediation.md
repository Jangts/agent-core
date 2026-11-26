# 开发指导整改维护记录（工作包 A）

## 接手基线与范围

2026-11-24 在 main 工作目录接手。仓库已有大量暂存修改，文章唯一源稿与生成副本为新增暂存文件；budget-optimization、resilience-review 及其 reference、design-layers 已有暂存修改。未重置、清理、提交或覆盖既有版本。编辑前保存的 `git status --porcelain=v1`、A 范围 cached/unstaged 二进制 diff 位于本机 `.tmp/guidance-remediation/baseline-*`，供本次协作核对，不作为正式合同。

已读取仓库 AGENTS.md、总计划、文档规范、skill-creator，审阅全部八个 development Skills 入口、resilience review patterns、九篇双语文章和公开资源 API、现有离线 fixture/CLI。没有子目录 AGENTS.md。未改总计划、公共运行时、package.json、生成副本、B 文档或 C 示例。

## 缺陷与修改

- 重写 nodes-and-tools 双语正文：节点名字、业务/技术图、数量不能推断质量；独立路由/提交/恢复是候选理由，需比较交接与恢复成本；完整用例和有进展边界的探索循环均可合理。观察细节不自动升为节点。提供过拆及隐藏批准边界两个反例。
- 其余八篇保留正确的独立议题，分别补充实现与证据边界。预算以已用 2、分配 3、剩余工作 4、上限 8 举例解释总分配至少 6；压缩比较自身成本与未来节省，并提供仅取两个数字的反例。其他篇分别说明阶段快照、写入对账、恢复、定向修复、观察及故障测试如何验证，而非复制同一组工具链接当作证明。
- 八个 Skills 按各自触发范围修订，保留元数据、工具及现有执行合同。workflow-design 直接更正拆分标准；其余补充各自的决策或证据限制，未新增脚本、DSL 或调度器。app 入口修正重复 tools 用词。
- design-layers 明确 Core 保证、Support 推荐和 App 产品角色；inspection 无警告不能升级为设计通过。

review-patterns 的现有条目已有静态/离线/语义区分与具体检查，保留；Skills 脚本和模板无需因本次指导修订而改变。文章保持九篇，既有主题未机械合并或扩篇；中英文同步修改。

## 验证证据

- 静态：八个 Skills 分别通过 skill-creator `quick_validate.py`；120 个文章 Markdown 相对链接的文件目标均存在；九篇各有中英文版本。新增 reliability 中文锚点按实际标题核对并修正。`git diff --check` 通过。静态路径存在不证明打包交付或网页渲染。
- CLI 入口：默认 `/usr/local/bin/node` 过旧，导入 node:util parseArgs / node:test 失败；使用 `/Users/ivan/.nvmd/bin/node` v24.9.0 后，scenario 和 app-testing 的 `--help` 均成功。文中注明 Node >=22.12.0。
- 最小离线：为确认文章给出的现有复现命令可执行，使用 Node 24.9.0 运行 `workflow-scenarios/cli.mjs --fixture packages/agent-core/development/examples/workflow-scenarios.mjs --case authorized --case denied`。结果 authorized PASS，1 次模型调用；denied PASS，0 次模型调用。使用既有可解析 SDK，不构建、不修改 fixture。它证明该 fixture 的离线路径，不证明业务拓扑合理或新的指导带来语义收益。
- 未运行资源 API 全测试、真实模型、生产、UI 预览、构建或发布。文中源码测试命令是可复现入口而非本次通过声明；源码测试需要与源码匹配的已有构建产物。

## 交接与未验证项

总线程负责运行唯一来源同步生成 articles 副本，并检查 npm 白名单及站点来源；本线程未运行 sync-articles 写入或 --check（生成副本预期仍旧）。design-layers 使用包内 articles 路径，待统一生成后内容一致。无需新增公共 API、运行时或跨 App 契约。

B/C 的新入口未被假定存在。文章使用现有 workflow-development、inspector Skills、workflow-scenarios.mjs 和 app-testing fixture；总线程可在 B/C 实际交付后加入两种参考架构入口。当前授权/拒绝 fixture 只作接线示例，不能充当完整业务用例与探索架构的比较实验。两种架构在真实 App factory 上的推进、无进展退出、修复映射和副作用断言由 B/C 与 App 实施交叉核对。

真实模型的短追问理解、摘要保真、语义选工具，以及生产授权、跨请求幂等、连接与存储恢复仍需各自证据，本文未声称验证。没有警告或离线通过不代表架构、模型或生产验收完成。

## C 最终案例交叉审校（同日续接）

本节取代前文“B/C 的新入口未被假定存在”中关于 C 入口的交接状态。已阅读 C 最终双语说明、organization-comparison.mjs 和 reference-organizations.test.mjs；接入九篇双语源稿及八个 development Skills。未修改 C 文件或生成 articles。

审校过程发现 C 初稿采用固定 stages/phase 递增、未使用预算评估器；总线程要求 C 修正后，再按实际最终源码审校。正式文章没有保留初稿的“五次 explore”、旧节点名或“未调用 assessModelBudget”等失效结论：

- nodes-and-tools 改用完整案例作为主要复现入口，删除旧 authorized/denied 充当架构对照的段落。解释 explain-status 的完整业务成果与 nextWork 按 online/degraded/changing 证据缺口选动作的区别；提供包内命令、源码路径及自选 options 的完整运行片段，不把确定性选择说成模型规划。
- dynamic budgets 对照 ledger.assessment、扩额时 budget 快照与最终 calls，说明 assessModelBudget 评估剩余一次生成；hardLimit 分支不是因初始分配不足直接收束。
- compression 对照实际 noise 字段投影、原记录与模型输入；明确没有模型摘要、游标或摘要保真验证。
- recovery 与 evidence receipts 沿 unknownWrite/unresolvedWrite 核实回执，不声称使用了 createRequestRecovery；模型恢复失败后的本地 fallback 仍沿真实 helper 的独立 API 示例。
- targeted repair 与 fault acceptance 补充 formatFailure 的确定性局部修复：没有工具/模型上下文，保留答案和回执；不把它写成 Completion Kit 或模型式修复验证。故障清单同步为当前回归实际覆盖项。
- observation 区分 explain-status 的一次业务访问和 explore 的多次 action 记录，预算调整快照不充当最终调用总数；phase 快照一致性文章说明案例普通文本 Provider 不验证模型工具 schema 投影。
- Skills 按职责提供相同案例入口及实际阅读/判断方式，不要求复制组织名称、fixture 授权或内存回执策略。

审校验证使用 Node v24.9.0，针对具体复现与覆盖疑问运行：

1. 案例主入口实际成功，输出两种组织的成果与调用/工具/预算/投影记录。本地输出在 `.tmp/guidance-remediation/organization-output.jsons`。
2. `node --test packages/agent-core/test/reference-organizations.test.mjs`：42/42 通过。本地记录在 `.tmp/guidance-remediation/organization-tests.txt`。这是离线行为证据，不把测试数量当作架构成立依据。
3. 文章新增 options 片段按源码路径实际运行：两种 organization 的 degraded/noProgress 均返回 No new explanation evidence 的 partial，工具顺序 read/incident/save/optional，effects 为 1。
4. 八个 Skill 元数据重新校验通过；138 个文章相对链接文件目标均存在；新增案例链接无锚点，已有 reliability 中文锚点保持匹配实际标题。`git diff --check` 通过。

没有额外构建、模型调用、服务、数据库、部署或发布。仍由总线程统一生成 articles 副本。真实模型摘要与语义质量、跨进程持久化、真实宿主交付等证据边界保持独立；本次没有公共运行时或跨 App 契约需求。

## 后续文章讲解质量整改

原有同步与原则补充未充分解决文章像短条目备忘录的问题。九篇中英文已按具体场景、原因分析、方案比较和实践路径逐篇重写，目录也调整为可顺序阅读的主题路径。来源、包体与本地站点正文核对见[文章质量整改记录](2026-11-24-article-editorial-rewrite.md)。该记录区分编辑质量复核与原有运行行为证据，不据此追加运行时或线上验证结论。

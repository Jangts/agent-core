# 新应用创建能力：R6

2026-11-04，用户确认目录与范围后授权落地。状态：**已完成**。本次是 R6 的独立交付，不回填为 C1—C5 或计划 D 的产物；R1 图形实验仍保留原前置条件。

## 已确定的范围

提供一个 Node 22.12+／TypeScript／ESM 模板，通过程序调用入口运行 Agent。能力清单、具名 handler、Provider、预算、取消及资料读取均消费现行 SDK 的公开合同。Web／桌面框架、数据库、持久日志、画像与自动恢复按 App 需求选择，不由初始化启用。

| 实现 | 归属 |
| --- | --- |
| 只读计划、显式生成、基线差异检查 | `development/skills/agent-core-app/scripts/create-app.mjs` |
| 模板目录、revision 和真实文件清单 | `development/skills/agent-core-app/templates/catalog.json` |
| 唯一模板源资产 | `development/skills/agent-core-app/templates/node-ts/` |
| 人工使用与 App 接入合同 | `development/docs/create-app.md` |
| 编码 Agent 采用方式 | 现有 agent-core-app Skill，使用同一初始化实现 |

资产随 development/skills 交付，SDK package.files 仍仅 dist、development/docs、development/skills；没有扩大到整份 development、网站、维护者 docs 或根 examples。

## 创建与维护保证

- 默认只返回目标、SDK／模板版本、受管文件与摘要。显式 `--write` 才创建，拒绝非空或符号链接目标。所有文件先写入相邻 .local 的唯一临时目录，复查后原子 rename；并发创建只允许一方提交，不覆盖另一方的成果。
- 新目标不必预装 SDK。包内工具定位自身资产；复制的 Skill 由当前目录或 `--sdk-from` 解析真实公开 SDK 入口和对应模板。复制到新 App 的资源桥接器来自同一实现，并限制“包内回退”仅适用于真实 SDK 位置。
- 只生成文件，不安装、不启动服务、不读模型凭据或调用模型。模板依赖 SDK 的实际版本及该 SDK 声明的 TypeScript 版本，不导入本仓库私有包、workspace 别名或其他端的依赖。
- 想法只进入用途配置，初始资料清单为空。显式真实来源由共享 readSuppliedSource 读取一次快照，再调用同一 prepare-source／Knowledge 编译路径；候选保留精确原件、hash、revision 和配置基线，始终未发布。原件中的指令不参与代码生成。
- 生成回执记录模板／SDK 版本、用途及受管文件原始摘要。`--check` 比较当前文件、基线和所选模板，不覆盖用户代码、不读取 .env 或候选正文；符号链接拒绝读取，当前模板之外的回执路径只报告元信息。升级通过另目录生成、审阅合并完成。

模板内的模型选择、工具执行及最后交付沿同一 Core 循环。资料工具以真实授权端口校验，并只允许最终答复引用该请求实际读取的文档版本。无授权、伪造引用、超额、取消和 Provider 失败均拒绝，不产生虚构完成回执。测试用资料只在测试代码中定义，不写入初始知识库。

## 验收与边界

- 初始化与共享维护工具11项测试通过：只读计划、用途转义、真实来源快照、无效资料不提交、非空／符号链接目标、并发创建、受管文件自定义检测、复制资源解析及配置快照。
- 使用最终真实 SDK tarball 及真实本地依赖，在空缓存下 `--offline --ignore-scripts` 安装生成工程；保留嵌套多版本，不修改仓库锁或构造 stub。生成工程 strict、skipLibCheck=false 编译通过，4项离线应用用例通过；知识检查返回 empty-awaiting-source。
- 包内初始化器与复制到包外的 Skill 均能创建；后者可通过已安装工程选择 SDK，准备实际提供的文本候选而不激活资料。模板文件、生成回执与 dotfile 均在真实分发中核对。
- SDK 的42入口 ESM／CJS、严格 .mts／.cts 消费者、正式 reference 逐字节一致性及所有随包 MD 链接继续通过。完整真实依赖和编译器为26个本地 tarball；前后交付文件指纹保持一致。
- Skill 的 quick_validate 通过。未访问运行数据、调用真实模型、启动 UI／服务或部署；离线用例不能证明真实模型的分析质量及费用。

证据保留在忽略目录 `development/output/agent-core-r6/`：`tools-tests.txt`、`final/result.json`、`final/generated-tests.txt` 和分发检查脚本。本库维护计划不随 SDK 发行；消费者手册只说明成品合同及使用步骤。

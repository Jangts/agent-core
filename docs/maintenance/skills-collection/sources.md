# SKILLs 收集来源与提炼依据

核对日期：2026-11-18。应用依据为本地源码与文字方法的静态阅读，未运行应用或验证真实模型表现。外部依据为下列原作者资料，不以搜索摘要、转载或技能合集的数量作为收录依据。

`catalog.json` 使用本页来源 ID。下列“提炼”是本次整理的判断，不表示原应用已经提供对应通用 Skill。草稿正文独立撰写，没有迁入业务数据、内部端点、凭据、第三方程序或平台安装流程。

## 应用来源

本仓库路径以 Jangts 根目录为基准；Console 路径以兄弟仓库 `../ripple/wfj-campaign-console` 为基准。跨仓库依据只保留维护定位，不作为 SDK 发布依赖。

### cafe-evidence

- `apps/server/src/microcola/tools/catalog.ts`：`siteGuide`、`siteQuery` 和回复检查的声明。
- `apps/server/src/microcola/tools/handlers/guide/invocation.ts`：搜索与正文读取分开、已读来源复用及回复检查。
- `apps/server/src/microcola/tools/handlers/query/evidence.ts`：`reviewEvidence` 仅投影实际选中的来源。
- 提炼：问题确定取证范围，发现不等于读取，回答与真实来源关联；不迁入栏目、站长身份、Scope 和导航协议。

### cafe-actions

- `apps/server/src/microcola/tools/handlers/action/invocation.ts`：`actionLifecycle` 的计划检查、自动操作授权与准备状态。
- 提炼：当前请求决定授权范围，准备与执行分开，说明不能冒充操作结果；不迁入播放器、阅读器、天气或站点命令。

### cafe-work

- `apps/server/src/microcola/work/catalog.ts`：`professionalRoles` 与 `professionalDocuments`。
- 提炼：明确所选材料，核对说明、冲突和缺项；提纲和分析保持来源范围，不自动修改或发布资料。

### banker-materials

- `apps/banker-api/skills/customer-brief/SKILL.md`。
- `apps/banker-api/skills/material-analysis/SKILL.md`。
- `apps/banker-api/skills/material-follow-up/SKILL.md`。
- `apps/banker-api/src/capabilities/office/agent/tools.ts`：读取进度、范围和表格引用处理。
- 提炼：原文定位、事实与自述区分、任务覆盖与全文覆盖分开、缺项优先级；去除客户、银行材料和 `office.*` 等工具绑定。

### banker-comparison

- `apps/banker-api/skills/product-compare/SKILL.md`。
- `apps/banker-api/skills/policy-change-review/SKILL.md`。
- 提炼：同口径比较、范围和生效日期、文字变化与适用变化区分；不迁入具体金融产品、准入条件或审批规则。

### banker-tables

- `apps/banker-api/skills/cashflow-analysis/SKILL.md`。
- `apps/banker-api/src/capabilities/office/processing/query.ts`：字段、过滤、数值与计算检查。
- 提炼：先确认表结构和口径，再由程序计算；保留缺值、单位和去重依据；不迁入收入分类、偿付指标或产品阈值。

### banker-review

- `apps/banker-api/skills/delivery-review/SKILL.md`。
- 提炼：检查范围、成稿与来源的逐项核对、程序重算、问题位置和修订建议；不把文件生成成功当成内容验证。

### banker-continuity

- `apps/banker-api/skills/meeting-assistance/SKILL.md`。
- `apps/banker-api/skills/case-handover/SKILL.md`。
- `apps/banker-api/skills/business-planning/SKILL.md`。
- 提炼：当前版本优先、事实与意向及约定分开、依赖和未决事项、最小修订；不迁入业务建档与结案生命周期。

### console-guides

- `apps/backend/src/modules/assistant/tools/guides.ts`：`guide_list`、`guide_search`、`guide_read`、`guide_flow_list`。
- 提炼：目录发现后读取相关正文；按已登记流程分步指导，不以页面概览的省略判定功能不存在。

### console-attachments

- `apps/backend/src/modules/assistant/uploads/table.ts`：工作表与文本表格解析、范围限制。
- 提炼：附件需经过实际解析，保留工作表和字段关系；有限预览不是全部数据。未迁入解析代码或依赖。

### console-comparison

- `apps/backend/src/modules/assistant/tools/products.ts`：`product_version_comparison` 及差异项历史查询。
- 提炼：比较字段由问题决定，先摘要后有限明细，区分整体统计和截断明细；不迁入产品字段、比较档位或服务地址。

### console-quality

- `apps/backend/src/modules/assistant/tools/product-quality.ts`：`productQualityTool`。
- 提炼：规则、计数、扫描范围与明细截断分开；空字段不自动等于业务错误，有文件地址不证明文件可用。不迁入默认商品字段或扫描上限。

### console-drafts

- `apps/backend/src/modules/assistant/tools/commands.ts`：`commandTools` 与命令校验。
- `apps/backend/src/modules/assistant/tools/forms.ts`：`formTools` 与允许编辑目标。
- `apps/backend/src/modules/assistant/core/prompts.ts`：未保存场景、差异分类和回执表达。
- 提炼：只读当前状态、已授权目标与字段、最小差异、准备和保存分开；不迁入路由、表单目标、角色或具体状态库操作。

### console-history

- `apps/backend/src/modules/assistant/tools/audit.ts`：`audit_list`、`audit_detail`。
- 提炼：先限定对象与时间，再读真实记录；历史只能证明其记录的操作，不能冒充当前状态或完整因果。

### cafe-selected-source

`apps/server/src/microcola/tools/handlers/query/finalizers.ts` 的 `requireSelectedSource` 要求回复引用实际准备打开的视频。选材流程沿用“说明与交付入口指向同一素材”的核对方法。

### banker-worklist

`apps/banker-api/skills/portfolio-review/SKILL.md` 从多条在办记录中核对期限、等待对象和可推进事项，记录分页覆盖。该材料支持跨事项盘点。单个目标的步骤拆解另见上文 `banker-continuity` 中的业务规划方法。

### banker-feedback

`apps/banker-api/src/business/growth/model/catalog.ts` 定义原话、使用场景、期望与验收边界。`apps/banker-api/src/business/growth/agent/tools.ts` 允许一份输入拆成数项关联记录，区分用户表述与推断，并限定留存内容为去标识摘要。这里提炼反馈分类的证据关系，以及产生脱敏副本的需求。识别敏感片段的具体方法另有依据。

### banker-pictures

`apps/banker-api/src/capabilities/pictures/agent/tools.ts` 在当前搜索候选内选图，显式排除项按真实标识处理。`apps/banker-api/skills/moments-writing/SKILL.md` 区分展示、用户选择和已使用状态。通用选材流程取其中的已有素材复用部分。

### console-record-matching

`apps/backend/guides/categories-import.md` 描述导入行与主数据的标识核对。`apps/backend/guides/campaigns-mcc-import.md` 规定来源中缺失的标识、重复归属和文件名仅作线索时的处置。这里采用导入准备的匹配经验。模糊候选与歧义处置另参考 OpenRefine。

### console-dashboard-checks

`apps/backend/guides/dashboard-checks.md` 给检查发现分配阻塞、需核对、观察等级和对应处理方向。这里引用的是工作台指南中的优先依据，具体分级留给 App。

### console-media

`apps/backend/src/modules/assistant/tools/media.ts` 通过 `product_media` 定位素材，`product_view_image` 支持读取选中的具体图片。文件目录和实际图片为不同层次的证据，这一点直接影响取景、背景、构图等条件的判断。

### jangts-redaction

`packages/diagnostics/src/redact.ts` 的 `safePayload` 在副本上遮盖已知敏感键及字面量，并记录处理路径。`apps/server/src/common/diagnostics/session.ts` 与 `apps/banker-api/src/infrastructure/diagnostics/session.ts` 是两端的诊断接线实例。通用文本脱敏草案借鉴“处理副本、结果附位置”的做法，姓名等语义类别的覆盖取决于 App 提供的规则和检测能力。

## 外部一手资料

外部来源仅用于方法研究和结构参考，没有直接复制或重新分发上游 Skill。若以后决定引入上游代码或正文，需要另行核对对应文件的许可与归属；当前草稿不以参考链接代表引入许可。

| 来源 ID | 原始资料 | 本次采用的思想 | 未迁入的内容 |
| --- | --- | --- | --- |
| external-format | [Agent Skills Specification](https://agentskills.io/specification) | `SKILL.md` 的名称、用途描述与按需展开组织 | 实验性工具授权字段、自动发现或执行承诺；未声明已完成全规范兼容 |
| external-workflows | [Anthropic：Building effective agents](https://www.anthropic.com/research/building-effective-agents) | 简单组合、按需增加复杂度、有界的生成与检查 | 品牌 SDK、Provider 接线与通用多 Agent 框架。该文发表于 2024 年，采用其流程思想而非当下工具安装建议 |
| external-authoring | [Anthropic：doc-coauthoring](https://github.com/anthropics/skills/blob/main/skills/doc-coauthoring/SKILL.md) | 先明确读者和用途，形成结构，按读者需要检查表达 | 固定交互问卷、强制另开 Agent、平台操作与原文模板 |
| external-research | [OpenAI：notion-research-documentation](https://github.com/openai/skills/blob/main/skills/.curated/notion-research-documentation/SKILL.md) | 发现后读正文、围绕目标综合资料、保留来源 | Notion 工具名、连接安装、页面创建和自动发布 |
| external-meetings | [OpenAI：notion-meeting-intelligence](https://github.com/openai/skills/blob/main/skills/.curated/notion-meeting-intelligence/SKILL.md) | 会前目标、上下文和预读准备，行动责任明确 | 日历或 Notion 依赖、MCP 安装、自动创建任务和页面 |
| external-schema | [JSON Schema：Object](https://json-schema.org/understanding-json-schema/reference/object) | 字段形状、必需项与额外字段的结构检查 | 固定 schema 草案版本与特定校验库；事实正确性仍需来源和业务检查 |
| external-planning | [OpenAI · Spec to Implementation](https://github.com/openai/plugins/blob/main/plugins/notion/skills/notion-spec-to-implementation/SKILL.md) | 将已知要求映射为有依赖与验收条件的计划 | 平台建页、工单库、固定任务工期和进度发布 |
| external-reconciliation | [OpenRefine · Reconciling](https://openrefine.org/docs/manual/reconciling/) | 跨来源匹配、辅助字段、候选与判断的区别 | 服务协议、分值门槛、批量修改原表 |
| external-feedback | [Anthropic · Synthesize Research](https://github.com/anthropics/knowledge-work-plugins/blob/main/product-management/skills/synthesize-research/SKILL.md) | 把原始反馈分解成观察，按主题归并，保留来源并分别考虑频次和影响 | 固定研究报告模板与优先级矩阵 |
| external-terminology | [Microsoft · Manage terminology](https://learn.microsoft.com/en-us/globalization/localization/managing-terminology) | 术语含义、适用语言、审定译法与保留原名 | 指定词库格式和翻译软件 |
| external-message-format | [Microsoft · Message formatting](https://learn.microsoft.com/en-us/globalization/internationalization/message-formatting) | 完整语境、命名占位符、不同语言的语序与复数表达 | 特定语言或框架的格式化 API |
| external-text-redaction | [Google Cloud · Redacting sensitive data from text](https://docs.cloud.google.com/sensitive-data-protection/docs/redacting-sensitive-data) | 按指定信息类别检测命中，并用占位符替换 | 云服务、SDK 配置与外部上传步骤 |

格式来源约束方法文档的组织；其余来源分别对应具体草稿。来源链接不是运行依赖，方法正文可独立阅读。

# 知识、回答与内容输出 Kit

这组可选模块帮助应用组织资料、生成正文、逐项检查和组合输出。应用通过普通函数和 handler 使用它们；Core 执行器仍消费原有的模型、工具和工作流接口。职责判断参考 [设计取向](design-layers.md)，不要求每个辅助 API 只能服务一种用途。

调用合同见[知识回答 API](../../packages/agent-core/development/docs/api/knowledge-answering.md)。文件准备、候选审批和实际发布由 App 负责，不进入 Core。

| 公开入口 | 能力 | 实现 |
| --- | --- | --- |
| `@jangts/agent-core/kits/knowledge` | 章节解析、目录校验、明确范围的读取快照 | `src/kits/knowledge/` |
| `@jangts/agent-core/kits/answering` | 任务关系、检查登记、批次覆盖和有界回答流程 | `src/kits/answering/` |
| `@jangts/agent-core/kits/presentation` | 输出目录、字段所有权、母板组合、回复格式、变体与偏好选择 | `src/kits/presentation/` |

类型随各入口导出，声明位于 `src/structs/kits/`。模块使用现有执行、预算、母板和诊断能力，不读取文件或环境变量，不内建资料、权限、提示词或页面样式。

## 知识目录与适配

`defineKnowledgeCatalog(documents, options)` 接收应用已经取得的资料。每份文档提供 `id`、必需的 `revision`、可选 `locale` 和有序 `parts`；part 可以是字符串或 `{ id, parts }` 章节。目录编译时快照冻结，拒绝重复文档、重复章节和循环结构。

```ts
import { defineKnowledgeCatalog, parseKnowledgeDocument } from '@jangts/agent-core/kits/knowledge';

const knowledge = defineKnowledgeCatalog([
  parseKnowledgeDocument({ id: 'manual', revision: 'r1', text: sourceText }),
], { maxChars: sourceBudget });
const snapshot = knowledge.read({
  documentId: 'manual', selection: { mode: 'subtree', sectionIds: ['installation'] },
});
```

`parseKnowledgeDocument` 是可选纯文本适配器，支持成对、嵌套的稳定锚点：

```md
<!-- agent-section:installation -->
## 安装
正文
<!-- /agent-section:installation -->
```

解析器拒绝未闭合或配对错误的锚点。结构化来源可直接提供文档树，无需使用注释。意图、授权和执行指令由应用登记，不放进锚点。

读取有三种明确范围：`self` 只取指定章节的直接内容，`subtree` 按原顺序取该节及其后代，`document` 取整篇。未知或重复选择被拒绝，不自动扩大范围。超出 `maxChars` 报错，不截断事实。

当前 `KnowledgeSnapshot` 字段为 `documentId`、`selection`、`revision`、`locale`、`content` 和 `id`。id 同时包含选择条件，适合关联同版本文档的不同章节；它不是正文 hash、持久化 ID、签名或授权凭据，文档版本本身也不能替代该关联。版本真实性、取得资料的授权与跨请求缓存由应用负责，目录本身不执行 I/O；生成和复核应消费同一读取快照。

## 输出声明与母板

`defineOutputCatalog(definitions, { providers, observe? })` 编译一份输出目录，提供统一目录查询及 `toModelSchema/check/compose`。

| kind | 内容 |
| --- | --- |
| `text` | 一个必需的正文值 |
| `master` | 程序母板与声明槽位，槽位集合须一致 |
| `record` | 具名字段及其类型检查 |
| `group` | 程序分配 ID 的有序内容项，限定允许的输出和数量 |

字段的 `owner` 决定取值方式：`generated` 接受模型值，`bound` 调用程序 provider，`constant` 使用声明值，`semantic` 允许模型选公开 key、再由 provider 解析真实值。模型投影仅包含 generated 字段与 semantic key；未选中的可选 semantic 字段不会调用私有 provider。

```ts
import { defineOutputCatalog } from '@jangts/agent-core/kits/presentation';

const outputs = defineOutputCatalog([
  { id: 'explanation', kind: 'master', master: '{{title}}\n{{body}}', fields: [
    { id: 'title', owner: 'bound', providerId: 'title' },
    { id: 'body', owner: 'generated' },
  ] },
], { providers: [{ id: 'title', resolve: (_request, { app }) => app.title }] });
const schema = outputs.toModelSchema('explanation');
const partial = outputs.check({ outputId: 'explanation', value: candidate });
const result = outputs.compose({ outputId: 'explanation', input: {
  generated: { body: acceptedBody },
} }, { app: { title: actualTitle }, signal });
```

`check` 通过 CheckResult 的 value 保留有效字段，并返回缺失、无效和越权字段问题；`compose` 重新检查完整模型值，程序绑定仍须通过值检查。默认字段值为字符串；自定义 valueSchema 实现 SchemaAdapter 的 jsonSchema 与 parse，Schema 描述本身不充当校验器。group 逐项使用同样的接口，拒绝循环输出引用、重复 item ID 和未知子输出。

“模板”是模型的生成要求；“母板”是程序持有的替换结构。母板只替换一次，正文里的槽位样式保持文本。输出模块不执行正文中的命令。展示清理、事实检查、链接和渲染由应用提供。

## 回复格式与模板

`defineReplyFormats({ formats, checks })` 把回复格式与模板绑定。`formats` 每项声明 id、说明、检查项 id 和 `when(context)`；`checks` 提供具名检查，`accepts(bubbles)` 判断渲染后的正文与后续气泡是否符合模板。`resolve(context)` 只在模板命中时返回带 `inspect` 的格式，其余回复返回 `undefined`，调用方因此不执行气泡数量、空白气泡和长度检查，由程序归一而不是重问模型。

`replyFormatChecks.bubbles(totalLimit)` 与 `textBudget(maxChars)` 提供通用检查，限额由应用声明；`mergeReplyBubbles(bubbles, limit)` 丢弃空白气泡并把超出部分并入最后一条。模板是否命中、使用哪些检查属于应用策略，Kit 只编译声明并返回未通过的检查项。

```ts
import { defineReplyFormats, replyFormatChecks } from '@jangts/agent-core/kits/presentation';

const formats = defineReplyFormats({
  checks: [replyFormatChecks.bubbles(5), replyFormatChecks.textBudget(8000)],
  formats: [
    { id: 'listing', description: '清单模板', checks: ['bubbles'], when: (context) => context.listing },
  ],
});
const format = formats.resolve({ listing: true });
const failed = format ? format.inspect(['正文', '后续']) : [];
```

## 任务与检查登记

`defineAnswerTaskCatalog(definitions, ports)` 关联任务 id、description、domainToolIds、scopeId、inputSchema、readerId、outputId、checkIds 与 metadata。编译时检查重复 ID、reader/output/check 引用、解析函数及可选业务引用检查。声明数据须可结构化克隆；schema、关系数组和数据被快照冻结。

- `describe()` 投影同一登记的模型说明和关系。
- `read({ taskId, input }, context)` 先运行登记的参数 parser，再调用所选 reader。
- `get(id)` 提供任务实际使用的输出与检查清单。

reader 自己执行权限和真实读取。应用可以把这份登记适配为现有 `ModelCapability`，也可从自己已有的权威业务清单构建登记。模块不建立另一套全局意图系统。

`defineAnswerCheckCatalog` 通过 `check({ checkIds, value }, context)` 按选中的检查 ID 顺序执行 checker，归并问题并保留 sanitizer 返回值。检查状态包括 `passed/failed/unavailable/not-run`；问题使用 code、message，以及可选 checkId/path。事实引用、语言、日期和关系规则由应用提供。

## 有界回答流程

`defineAnswerFlow(definition).run({ inputIds, items }, context)` 使用现有 Workflow、AgentCoreEngine 和 AttemptBudget 组织生成、检查、复核、局部修正、再检查与交付。definition 绑定 canInvoke、generate、check、可选 review、fallback、observe 和数量／修正上限／复核策略，Workflow 在定义时编译。context 为本次 OperationContext；每次执行独立维护任务状态与修复额度，所有 handler 接受相同合同。

`validateAnswerBatch` 检查输入与回答项 ID、覆盖、引用和数量；独立输入不能遗漏，同一输入允许拆成多个回答项。模型结果按程序分配的 item ID 归属，未知 ID 是契约错误。缺失值只影响对应项，修正只提交失败项。

复核可设为 `optional/required/off`。optional 不可用时允许交付本地通过的内容；已确认的复核错误必须重新通过复核，不能因后续检查不可用被放行。修正调用失败时不会把旧错误正文当成新值再检查。

交付逐项返回 `accepted/fallback/blocked`、值、问题及检查状态。fallback 文案和原文摘录由应用决定，不被标记为生成成功。无来源或来源冲突的项不进入生成。取消传播；生成或复核服务不可用按流程处理，非法登记、validator 错误和返回归属错误继续抛出。

Kit 不自行创建模型。`canInvoke` 读取调用方真实余额，`ModelRunner.remainingCalls` 是原计数的只读视图；局部修正上限不增加模型调用额度。

## 偏好、变体与诊断

`resolvePreference` 按显式 priority、order 选取偏好，不识别自然语言。`selectVariant` 使用注入的随机索引，尽量排除前一个候选，明确处理空／单候选。用户、语言、私有称呼和前次值的状态由应用持有。

Kit 的返回、异常和可选 observe 回调由 App 收集，不写入 Core 日志。知识读取可观察快照，输出组合可观察结果；回答流程的 observe 提供逐项状态。run 的 context.diagnostics 交给内部 Core Engine 记录节点运行事件，节点 handler 使用 Loop 分配的诊断作用域。观察器异常与异步拒绝不改变业务结果，库不持久化日志。

离线契约回归为 `test/knowledge-output.test.mjs`，覆盖结构化与文本资料、字段所有权、逐项修正、复核不可用、额度、取消及真实 ESM/CJS 子入口。

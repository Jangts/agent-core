# Knowledge、Answering 与 Presentation

[共同类型](types.md) · [返回首页](README.md)。三个 Kit 通过普通输入输出组合。

## Knowledge

```ts
defineKnowledgeCatalog(documents, options?): KnowledgeCatalog
parseKnowledgeDocument({ id, revision, locale?, text }): KnowledgeDocument
```

文档仍是`{ id, revision, locale?, parts }`，章节仍是`{ id, parts }`。Catalog继承`ReadonlyCatalog<KnowledgeDocument>`，增加：

```ts
catalog.sectionIds(documentId): readonly string[]
catalog.assertSelection(request: KnowledgeRead): void
catalog.read(request: KnowledgeRead): KnowledgeSnapshot
interface KnowledgeRead {
  readonly documentId: string;
  readonly selection:
    | { readonly mode: 'document' }
    | { readonly mode: 'self' | 'subtree'; readonly sectionIds: readonly string[] };
}
interface KnowledgeSnapshot extends KnowledgeRead {
  readonly id: string;
  readonly revision: string;
  readonly locale?: string;
  readonly content: string;
}
```

读取仍是同步的内存操作，不读取文件、联网或决定资料权限。snapshot的id区分文档、revision、语言及选择范围。未知文档／章节或重复选择拒绝；超过maxChars拒绝，不截断事实。观察回调在options.observe，失败隔离。

读取请求使用 KnowledgeRead。maxChars 与 observe 在目录构造时绑定；结构化文档、请求及观察器可由类实现。章节快照 ID 是不透明的来源身份标识。

知识、输出组合及回答流程的观察回调只取得独立的 structuredClone 数据快照，不保留业务值的原型或方法。无法复制的观察载荷会跳过通知；观察失败不改变业务结果，也不把内部对象引用作为兜底传出。回答观察不能修改已经检查的正文或来源数据。

## AnswerTaskCatalog

```ts
defineAnswerTaskCatalog(definitions, ports): AnswerTaskCatalog
interface AnswerTaskDefinition<Input, Metadata> {
  readonly id: string;
  readonly description: string;
  readonly inputSchema: SchemaAdapter<Input>;
  readonly domainToolIds: readonly string[];
  readonly scopeId?: string;
  readonly readerId: string;
  readonly outputId: string;
  readonly checkIds: readonly string[];
  readonly metadata: Metadata;
}
```

ports 包含 readers、outputs、checks 及可选 assertDefinition。readers/outputs/checks 均接收登记集合接口。

```ts
defineAnswerReaderCatalog(definitions): AnswerReaderCatalog
reader.read(input, context): MaybePromise<Evidence>
catalog.read({ taskId, input }, context): Evidence
catalog.readAsync({ taskId, input }, context): Promise<Evidence>
```

context扩展OperationContext，包含本次选择的只读task定义。同步read拒绝thenable；有I/O的reader用readAsync。输入schema先解析，reader仍负责真实授权与读取。注册时检查ID、reader/output/check引用，不隐式选择另一个任务。

## 检查目录

```ts
defineAnswerCheckCatalog(definitions): AnswerCheckCatalog
interface AnswerChecker<Value, App> {
  readonly id: string;
  check(value: Value, context: OperationContext<App>): CheckResult<Value>;
}
checks.check({ checkIds, value }, context): CheckResult<Value>
```

value在前、context在后。目录按checkIds顺序运行，保留显式修正值，按执行顺序归并问题并标记检查来源；程序错误不包装成模型事实错误。同步checker不得误返Promise。

## AnswerFlow

```ts
defineAnswerFlow<Data, Value, App>(definition): AnswerFlow<Data, Value, App>
flow.run({ inputIds, items }, context): Promise<readonly AnswerResult<Data, Value>[]>
```

definition 包含可复用的 maxItems、maxRepairs、reviewPolicy、canInvoke 及具名 handler。signal、diagnostics 和本次 App 依赖通过 run 的 context 传入；canInvoke(context) 在实际需要调用时读取这些依赖的真实余额。

| handler | 输入 | 返回 |
| --- | --- | --- |
| generate | `{ items, repairs?, previous? }` | `Promise<ReadonlyMap<itemId, Value>>` |
| check | `{ item, value }` | 同步`CheckResult<Value>` |
| review | `{ items: readonly { item, value }[] }` | `Promise<ReadonlyMap<itemId, CheckResult<Value>>>` |
| fallback | `{ item, issues }` | `{ handled: true; value: Value }`或`{ handled: false }` |

handler 的第二个参数统一为 `OperationContext<App>`。App 可通过 context.app 提供同一个 ModelRunner，Kit 不创建模型或增加模型额度。定义时绑定 handler 并编译固定 Workflow，每次 run 独立建立任务状态与修复额度；同一个 flow 可被并发复用。handler 获得当前节点的取消信号与诊断作用域，阶段运行由 Core Loop 记录。

```ts
interface AnswerItem<Data> {
  readonly id: string;
  readonly inputIds: readonly string[];
  readonly sourceStatus: 'ready' | 'unavailable' | 'conflict';
  readonly data: Data;
}
interface AnswerResult<Data, Value> {
  readonly item: AnswerItem<Data>;
  readonly value?: Value;
  readonly status: 'accepted' | 'fallback' | 'blocked';
  readonly issues: readonly Issue[];
  readonly checks: Readonly<{ local: CheckResult<Value>; review: CheckResult<Value> }>;
}
```

生成／复核用Map支持部分修正和按ID检查；最终结果用数组保持输入交付顺序。这是用途差异，不是同名集合字段的任意换形。

独立问题必须覆盖；未知itemId、重复归属和非法引用拒绝。reviewPolicy保留required/optional/off语义：已确认事实错误不能因后续复核不可用而被放行。修正仅作用于失败项，fallback必须由真实证据产生。取消、模型调用和修复额度继续共享上层边界。

## OutputCatalog

```ts
defineOutputCatalog(definitions, { providers?, observe? }): OutputCatalog
catalog.toModelSchema(outputId): JsonSchema
catalog.check({ outputId, value }): CheckResult<Readonly<Record<string, unknown>>>
catalog.compose({ outputId, input }, context): OutputResult // 同步provider；误返thenable拒绝
```

Catalog继承共同的has/get/require/ids/values。定义仍有text/master/record/group四种kind，不把它们变成全Core必需输出。

| 声明字段 | 合同 |
| --- | --- |
| id | 输出或字段身份 |
| owner | generated/bound/constant/semantic，表示取值所有者，不是handler的this |
| valueSchema | 可选SchemaAdapter；缺省字符串；模型和程序值均走真实parser |
| providerId | 程序绑定或semantic解析的provider引用 |
| constantValue | 程序固定值，注册时快照 |
| semanticKeys | 只公开可选key，不公开私有映射值 |
| allowedOutputIds | group允许的输出ID |

provider 使用 `resolve({ key? }, context)`，第一个参数描述选择，第二个参数提供执行上下文。toModelSchema 只投影 generated 字段和 semantic key；程序负责 bound/constant 及真实链接。check 能保留有效字段供局部修复，但 compose 内部重新解析／检查 input，只有 passed 结果能继续组合。检查结果不是权限凭证，不能用部分可用值完成整体输出。

OutputResult为`{ outputId, kind, value }`。group子项使用程序分配的id和outputId引用；不能由模型自行登记输出、provider或权限。

## 母板、语义槽位与气泡

| 工厂／方法 | 统一合同 |
| --- | --- |
| defineTextTemplate(master, options) | 纯编译；render(values)同步替换一次；errors.missingField创建错误 |
| defineSemanticSlots(definition) | namespace、keys、maxOccurrences；isValid(text): boolean |
| defineReplyFormats({ formats, checks }) | 编译模板绑定的回复格式；resolve(context)仅命中时返回带inspect的格式，其余返回undefined |
| replyFormatChecks.bubbles(totalLimit) / textBudget(maxChars) | 通用气泡数量、空白气泡与正文长度检查，限额由应用声明 |
| mergeReplyBubbles(bubbles, limit) | 无模板回复的程序归一：丢弃空白气泡并把超出部分并入最后一条 |
| replyBubbleTexts(input) | 保留现有纯文本／气泡提取职责，返回readonly string[]；数量与长度限制由已登记输出合同执行 |
| publishReplyEvents({ text, delivery }, context) | 返回`AsyncIterable<AgentOutputEvent>`，保留消费者拉取时的背压及取消；pacing继续使用*Ms |
| serializeOutputEvents(events) / textOutputEvents(chunks) | 保留事件与文本流的显式转换，不作为invoke返回模式 |

展示处理不负责事实验证或授权。生成要求称prompt/template；程序持有替换结构称master，不能把模型正文当作可执行母板。

完整导出、精确重载和声明源码见[公开符号参考](reference.md)。示例中的签名用于阅读，不能据省略字段推断任意扩展选项。

### 内容与检查边界

AnswerTask.describe将可执行inputSchema投影为inputJsonSchema，避免同名字段有时是适配器、有时是裸JSON。OutputCatalog 的生成字段 valueSchema 普通解析失败形成可修复 Issue；AbortError、TimeoutError 及程序 provider 异常继续传播。kind=text/master的最终值必须是字符串；record/group保留各自结构。

Knowledge文档parts允许段落字符串与具名章节，章节递归包含parts；self只读取本章直属段落，subtree包括子章节。document读取整篇，sectionIds非空、去重且全部存在；maxChars超限拒绝，不截断证据。相同定义、修订、语言和选择产生稳定snapshot身份。读取操作只处理已有内存文档，不提供文件或账号授权。

Presentation的publishReplyEvents使用`({ text, delivery? }, context)`，delivery默认chunkSize=240、intervalMs=0、bubblePauseMs=0、maxDurationMs=3000。按Unicode字符分片；intentional pacing受maxDurationMs约束，消费者拉取仍提供背压。serializeOutputEvents为明确需要文本流协议的消费者转换，不是invoke的另一种输出模式。

检查结果必须包含 issues 数组；passed 时为空，failed 时至少包含一项。检查目录、局部检查与复核采用相同合同，path 为字符串／数字数组。显式返回 value: undefined 仍是一次 sanitizer 更新，不能与缺少 value 混淆。

signal／diagnostics 通过执行上下文传入。模型与工具的完整离线 App 接入见[基础示例](../examples/offline-agent.md)；Knowledge／Answering 的局部合同按本页配置。

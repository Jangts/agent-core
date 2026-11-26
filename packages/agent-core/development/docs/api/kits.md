# 其余可选 Kit

[共同类型](types.md) · [返回首页](README.md)。每个 Kit 从自己的子路径导入具名函数／构造器，静态声明与每次运行上下文分离。

## Domain Tools、Scope、Interaction、Tools

DomainToolRegistry 注册继承 ModelTool 的 DomainTool，保留 scopeMode、targetMode 和任务约束。显式允许集合统一由 DomainTool.delegates 声明；delegates 是可选允许集合，不是顺序。不存在独立 Intent 实体或 Intent ID；Scope 的 domainToolIds 引用真实 Tool ID。可选注册辅助从 `@jangts/agent-core/kits/domains` 导入。

| 能力 | 首选接口／关键合同 |
| --- | --- |
| DomainToolRegistry | 定义主键 id，使用 scopeMode/targetMode，实现共同 Registry 合同 |
| ScopeRegistry | id、domainToolIds、toolIds、queryScopeIds、knowledgeTopicIds；aliases保留，查询方法使用scopeId |
| defineAgentCatalog | 由实际登记投影关系；当前任务为`{ domainToolId, scopeId? }`，不能同时用scope指策略和引用 |
| defineInteractionProtocol | 一份commands声明编译协议，commandField由App拥有，不强制其wire字段叫type或kind |
| defineCommandCatalog | commands闭集可用Record书写；公开definitions为数组，toRecord()为明确映射 |
| bindInteraction | 对齐协议与具名handler；dispatch(input, context)，不执行未登记命令 |
| ToolLifecycleRegistry | 真正执行委托 Core 工具；assertDecision 检查决策，authorize 通过返回 void、拒绝抛错 |

注册器的声明和查询结果使用同一套字段。ID 清单使用 ids()，命名规则使用 idPattern，自定义断言使用 assertDefinition。Scope 的 aliases 用于业务名称代指，由 normalize 解析。

构造时已有完整清单，可用 DomainToolRegistry.create(definitions, policy) 或 ScopeRegistry.create(definitions, policy)，一次建立并封存目录。需要分阶段装配时，用 new Registry(policy).registerAll(definitions).seal()；二者沿用同一注册合同。

InteractionProtocol、CommandCatalog 是公开构造器；Interaction 与 Interaction.Commands 分别提供它们的命名空间入口。

Tools Kit 保留全局检查→授权→resume/execute→完成→finalize 的真实次序。每个工具只声明一个 lifecycle 块：inspect、finalize 等钩子对全部工具运行，protocol/call 与 authorize/resume/complete 只由被选中的工具运行。接收者字段叫receiver，不与OutputField.owner混用；请求内journal沿用Core分配的invocationId。

## Evidence 与 Retrieval

```ts
defineEvidenceChecklist(providers): EvidenceChecklist
checklist.isSatisfied({ observations, requirement }): boolean
checklist.missing({ observations, requirements }): readonly EvidenceRequirement[]
checklist.isComplete({ observations, requirements }): boolean

defineEvidenceProjection(definition): EvidenceProjection
projection.project({ observations, sourceIds }): readonly Observation[]

defineRetrieval(definition): Retrieval
retrieval.run(input, context): RetrievalReceipt
```

EvidenceRequirement描述需求，不是已存在资源；不能因与ArtifactReference同含ID而合并权限合同。Projection对无选择、未知选择及完整候选的处理保留当前证据边界。

Retrieval定义使用assertInput、authorize、execute、assertResult和具名effects。RetrievalSource.sourceId是本次请求的引用标识，可与资料实体自身的id并存；它不是另一种实体主键拼写。Receipt使用startedAtMs，检索计数使用queryCount。定义中不得绑定请求状态，state/budget从本次context.app取得，errors.duplicate/budget集中声明拒绝原因。同步运行保持同步，误返Promise明确拒绝。

Retrieval 提供 run(input, OperationContext)，定义中的 assertInput 为必需断言，结果断言使用 assertResult，错误工厂放在 errors.duplicate／errors.budget。limit 与 queryCount 必须为非负安全整数，0 额度不会发起读取。去重优先于预算；拒绝授权不预占，读取失败保留 seen key。来源绑定完成后再次检查取消再提交证据；提交后的 effect 顺序执行，取消或失败停止后续项，不伪造回滚。

`retrievalQueryKey` 接受 null、布尔、字符串、有限数、稠密数组和普通数据对象；对象键顺序不影响身份，数组顺序影响身份。Date、自定义对象、循环、稀疏数组、函数、symbol、非有限数和任意层级的 undefined 均拒绝；可选条件应在 App 的 prepare 中显式规范为实际执行的查询，而非仅为去重丢弃条件。

## Policies、Normalization、Delivery、Candidates

| Kit | 首选创建与执行 | 终止／错误语义 |
| --- | --- | --- |
| Policies | definePolicySet；assess(input) | 全量匹配原因，不是首个命中 |
| Recovery | defineRecoveryChain；tryRecover(input) | 首个明确接管，不能误吞错误；终值可含undefined时用显式handled判别 |
| Normalization | defineNormalization；normalize(input, context) | 顺序转换，when条件及isComplete判定；保留0/false/空串 |
| Delivery | defineDelivery；deliver(input, context) | 阶段hook与handler交错；显式continue/complete，支持合法undefined终值 |
| Candidates | defineCandidateSelection；parse({ value, allowed }) | minCandidates/maxCandidates，顺序和数量受真实声明限制 |

候选解析中 value 是待解析值，allowed 表示本次任务是否允许候选信封。maxCandidates 必须明确配置，minCandidates 省略时为 1；普通单值仍返回单元素数组，不能在任务接管后提交新候选，也不能嵌套候选。

交付阶段使用 id；beforeStage 接收 { stageId, state } 和 OperationContext，handle 接收 state 和同一个上下文。deliver 的第二个参数提供真实 signal 和可选 diagnostics，进入阶段及 handler 前后均检查取消；同步 hook 或 handler 不接受 Promise。ContentProjection 使用命名请求，TreeProjection 使用 visit 遍历。

每个策略定义用id、description、when和具名handler。普通单条件不需要变成阶段类；顺序pipeline、首项匹配、归并和拒绝检查仍是不同流程。

## Projection、Aggregation、TextSkills

| Kit | 统一合同 |
| --- | --- |
| ContentProjection | defineContentProjection；project({ value, maxChars })，返回`{ text, truncated }`；兜底文本也须满足预算，无法满足时拒绝；数据不可伪造 |
| TreeProjection | defineTreeProjection；visit(input, context)，maxDepth和omit有明确同步语义 |
| QueryAggregation | defineQueryAggregation；collect(inputs, context)，保留串行顺序、去重键、覆盖和计数口径 |
| TextSkills | defineTextSkillLoader；load(input, context)，真实文件读取由App端口提供 |

TextSkill 定义使用 id、entry、toolIds 和 kind=text-workflow。目录项的结构与正文说明分开，ID 及工具引用来自同一登记源。

TextSkillLoader 接受 load({ entries }, { read })。注册 ID、路径、工具引用和重复项检查先于对应文件读取，read 与自定义解析器均须同步。读取端口、注册项和错误工厂可以由类实现，原型 getter 与原方法接收者保留。工具回执的 App 自有字段由 App 显式投影。

`aggregateBranchResults({ branches, results })` 按声明分支身份检查完整结果集合。只有全部成功且顶层写入互不重叠时返回 accepted 和 patch；同字段即使同值也冲突拒绝，失败时保留成功成果但不生成可提交 patch。它不启动任务、不提交父状态；输入隔离、取消、授权和真实提交仍由调用方负责。[并行样例](../../examples/harness-parallel.md)。

## TextBlocks

```ts
interface TextBlock {
  readonly number: number
  readonly text: string
  readonly start: number
  readonly end: number
}
TextBlocks.split(text, { targetChars }): readonly TextBlock[]
```

`split` 只切分已解码的纯文本：标题与分隔线起新块，空行结束当前块，其余在换行处按 `targetChars` 断开。超过目标长度的单行保留为一个块，由分页读取再切片段，避免同一行被拆成互不相关的两段。各块按顺序拼回与原文逐字一致，保留全部空白与 CRLF；`number` 从 1 开始，`start`／`end` 是原文 UTF-16 偏移。`targetChars` 必须为正整数，空文本返回空数组。

Kit 不读写文件、不分页、不访问模型或存储；分页窗口、索引、摘要与提示词由 App 决定。块边界是结构边界，不与固定字符窗口对齐，需要覆盖范围时使用 `start`／`end`。

<a id="textsearch-vectorsearch-rrf-modelcalls"></a>

## TextSearch、VectorSearch、RRF、ModelCalls

```ts
interface SearchHit<Document> {
  readonly id: string;
  readonly score: number;
  readonly document: Readonly<Document>;
}
new TextSearch({ indexRevision, fields, storedFields, ...options })
new VectorSearch({ identity, dimensions })
textSearch.search({ query, limit, filter }): readonly TextSearchHit<Document>[]
vectorSearch.search({ vector, limit, filter, minScore?, groupBy? }): readonly VectorSearchHit<Document>[]
vectorSearch.upsert({ document, vector }): void
reciprocalRankFusion(lists, options): readonly FusedRank[]
```

TextSearch的Payload仍是已声明存储字段的`Partial<Document>`，VectorSearch可返回完整文档；不能因统一document字段就声称全文数据已读取。额外terms/contributions按各算法扩展。三者score不是相同置信度，RRF不能直接混合原始分数。

TextSearch 只复制已声明的索引及存储字段，输入原件、过滤回调和返回结果不共享嵌套元数据。VectorSearch 的过滤与分组回调各自取得独立文档副本；修改这些副本不会改写索引或影响另一回调。索引元数据须可 structuredClone，向量必须完整提供每一维数值，稀疏数组拒绝。

`TextSearch.upsert(document)` 先完成每个已提供索引字段的自定义分词，再写入索引。分词抛错或返回无效词项时，已有索引内容保持原样，可修正输入后重试。

TextSearch.snapshot() 返回 version=2、engine、configurationFingerprint 和 serializedIndex；restore 接受 version=2。指纹和公开构造参数均使用 indexRevision／storedFields。remove 会等待索引 vacuum 后再返回，保证删除内容不残留在下一次序列化中。

```ts
new ModelCalls(bindings)
models.invoke({ modelId, input, timeoutMs }, context): Promise<ModelResult<Output>>
```

绑定使用 id、identity、invoke、assertInput/assertOutput。绑定回调返回业务值，ModelCalls 公开边界包装为 `{ value, invocation }`。id 为登记键，identity 为实际模型身份；context.signal 与 timeoutMs 共同约束外部 I/O。异构模型按登记 ID 推断 I/O，动态 ID 保持 unknown。

输入检查通过后，ModelCalls 在当前调用栈中交接给 invoke，不额外排入微任务。任意 App 输入可保留类实例和原型；handler 内部若跨 await 使用可变数据，由该 handler 明确快照所需字段。

```ts
const attemptBudget = new AttemptBudget(2);
await models.invoke({ modelId, input, timeoutMs: 1000 }, { signal, attemptBudget });
```

attemptBudget 是当前请求的可选调用尝试端口，可直接使用 Core 的 AttemptBudget。解析／前置取消不扣额度；实际接纳尝试在 I/O 前原子取得一次，失败不退回。一次批量调用仍计一次，向量条目、token 和聊天调用次数分别由 App 定义与计量；没有传入预算时，不应声称外部推理已受统一额度约束。复用模型目录不会自动创建用户问答的业务额度。上下游绑定可传递同一预算端口，Core 不内置供应商、模型角色或跨业务总额度。

## Artifacts

```ts
interface ArtifactReference {
  readonly resolverId: string;
  readonly artifactId: string;
  readonly revision?: string;
}
interface ArtifactResolver<Output, App> {
  readonly id: string;
  resolve(reference: ArtifactReference, context: OperationContext<App>): MaybePromise<Output>;
}
defineArtifactCatalog(resolvers): ArtifactCatalog
catalog.resolve(reference, context): Promise<Output>
```

resolverId指向登记的解析器，artifactId指向资源，两者不复用含义不清的id/kind。Resolver负责真实账号、存在性、版本和生命周期校验；额外URL／路径字段不选择实际资源。取消中断等待并消费迟到拒绝，不证明外部读取已停止。

执行入口接受 ArtifactReference 与 OperationContext。实现可携带自己的额外成员，执行时读取接口定义的字段。

## Durable

选择 `replayPolicy: 'reconcile'` 时必须在注册阶段提供对账 handler；缺失会在首次副作用前拒绝构造，不能只在恢复时才发现。取消终态仍先按当前 read 授权核验，再拒绝继续；running 检查点必须已有当前步骤的登记尝试。

```ts
defineDurableTask(definition, options?): DurableTask
interface DurableTaskDefinition<State, App> {
  readonly id: string;
  readonly revision: string;
  readonly steps: readonly DurableStep<State, App>[];
  isState(input: unknown): input is State;
  authorize?(checkpoint, context: DurableAuthorizationContext<App>): void | Promise<void>;
}
type DurableReconciliation<State> =
  | { readonly kind: 'completed'; readonly state: State }
  | { readonly kind: 'not-executed' }
  | { readonly kind: 'unknown'; readonly reason?: string };
task.run({ taskId, store }, context): Promise<State>
```

步骤声明 id、replayPolicy、run 和可选 reconcile。run(state, context) 返回完整 State；reconcile(state, context) 返回上述三态，不能直接返回 State。handler 均保持 state 在前、运行上下文在后。App 提供真实存储、身份、权限、保留期和序列化验证；SDK 不安装默认数据库或自动调度任务。

先根据副作用选择策略：safe 要求操作能够安全重放；reconcile 用于上次操作可能已生效的情况，没有对账实现时拒绝恢复。对账只读确认真实回执，不补发操作、不调用模型、不做补偿。

| 对账结果 | 行为 |
| --- | --- |
| completed | 验证并保存 state，推进下一位置；不增加执行尝试或模型预留 |
| not-executed | 保存 ready，再按执行权限、期限、次数和模型额度决定是否允许新尝试；不退还旧预留 |
| unknown | 保留位置与额度并拒绝继续，错误 code 为 DURABLE_UNRESOLVED；不自动重试 |

临时查不到远端记录不构成 not-executed：旧调用仍可能迟到生效时应返回 unknown，或由外部幂等／排他机制提供稳定否定证据。抛错、畸形返回和无效 state 不推进任务。

每个 run／reconcile context 提供 taskId、stepId、稳定 operationId 和累计 attemptCount。operationId 关联定义、修订、任务和步骤，跨尝试保持一致；App 不得将 taskId 重用为不同任务。reconcile 的 maxModelCalls 固定为 0；普通执行按配置的持久预留提供额度，App 须将其绑定到真实 Runner。该字段不是沙箱，宿主自行限制只读确认端口的费用和权限。

授权 context.operation 区分 execute、reconcile、read。每次真正执行前调用 execute；中断操作先调用 reconcile 授权并确认；已完成记录经 read 授权后返回分离副本。旧写入许可不自动授予查询权，授权回调须返回 void，拒绝应抛错。

已保存的 completed 可以在执行 deadlineAtMs 之后读取；中断步骤的只读对账也可以在执行期限或额度耗尽后进行。查询使用本次调用的 signal，由 App 设置超时和保留期。确认后若还有新步骤，仍须通过原执行期限及额度门槛，不能借对账续期或清零消费。任务不存在时拒绝，不自动创建。

DurableStore 提供 exclusive(taskId, operation)、load(taskId)、save(taskId, checkpoint)。Checkpoint 保持 version=2，包含 definitionId、revision、nextStepIndex、attemptCount、maxAttempts、deadlineAtMs、status、state 和可选 modelBudget／commitId。旧 v2 可省略 commitId；新保存生成唯一 commitId，若存在必须是非空字符串。其他版本明确拒绝，不静默迁移。status 是局部 Kit 状态，不是所有 Core App 的必需字段。

执行前保存 running、尝试次数和保守预留；保存完整下一状态与位置后才确认步骤完成。save 确认丢失时在同一锁内读回，只接纳与本次 commitId 相同且通过结构检查的记录；未确认则保留原保存错误，不盲重发。commitId 不替代存储原子性和真实排他。已经开始的保存及其确认读回须 settle 后才释放锁，取消不能假装撤回已提交写入。

取消／超时中止等待及结果接纳，不证明远端副作用已撤销。显式持久 cancelled 由 App 登记；HTTP 断连或普通 signal 中止不会由 Kit 自动永久取消任务。cancelled 拒绝恢复，未知远端操作仍需 App 独立查询。handler 的输入和交付状态使用副本，执行诊断沿当前 Loop 子作用域关联。

完整导出、精确签名与声明源码见[公开符号参考](reference.md)。示意签名省略字段不表示接受任意扩展选项。


## Waiting

多 Agent 汇合结果的检测、覆盖、准入及裁决关联见[结果评审与裁决](result-review.md)。仅检测可以不启用等待和持久存储。

`defineWaitGate` 从 `@jangts/agent-core/kits/waiting` 导入，是可选 App 等待组织件，不暂停 JS 调用栈，也不调度父工作流。

```ts
const gate = defineWaitGate({ id, revision, isAnswer, authorize }, { store });
const record = await gate.open({ identity: { taskId, waitId, subject }, expiresAtMs }, context);
const answered = await gate.respond({ identity, submissionId, answer }, context);
const current = await gate.read(identity, context);
await gate.cancel(identity, context);
```

`store` 提供 `exclusive/load/save`，所有写入者须共享排他范围。定义身份和修订绑定一次；每次操作都重新调用 App 授权，subject 只是关联身份，不能充当权限。pending 正常返回，由 App 释放当前请求并在明确边界继续；结果状态为 pending／resolved／cancelled，Core 不认识这些局部状态。

答复必须匹配当前 waitId、主体和定义；过期、旧代次、冲突提交拒绝。同 submissionId 且同 JSON 答案幂等，已确认结果可在原期限后按当前读取权限取得。终态槽轮换需显式 previousWaitId，pending 不能替换；App 保证新 waitId 永不复用，不依赖框架保留全部历史。JSON 数据拒绝 getter、symbol、类、稀疏数组和循环，读写均有独立副本。

App 负责真实身份、原子持久存储、查询期限、取消政策与资源重建。工具可能已经发生的外部副作用不因取消 gate 而回滚。参见[跨进程等待与保存示例](../../examples/harness-durable.md)。

## 局部协议与纯算法的有意差异

PolicySet／RecoveryChain 提供 definitions/ids/values/entries/has/get/require，直接处理调用方输入。纯谓词／恢复链不需要执行 signal；Normalization、TreeProjection、Aggregation 的第二个 Context 是调用方声明的算法上下文，没有外部执行生命周期。读取、工具执行和持久任务使用 OperationContext。

Interaction 的协议接收者与 handler 均按接口接入，独立对象或类实例无需转换成普通对象。bindInteraction 在绑定时固定命令处理函数及原接收者；私有状态和原型方法继续有效。协议类提供的选择错误与 envelope 回调也保留原接收者。

Interaction 的 ProtocolField 使用 jsonSchema；compiled command 公开 inputJsonSchema（完整必需字段）、modelJsonSchema（模型可提交投影）与 fieldSchemas（各字段描述），assert 负责断言、parse 负责转换。when 必须是同步 boolean；occur 是同步拒绝谓词或 OR 谓词数组。refine 返回 void、format 返回已转换值；所有回调固定原方法及原接收者。

ToolLifecycle的composition选择结构化模板提供者，保留其既有falsey拒绝语义，不视为任意泛型终值；Delivery、Recovery及AnswerFlow中可能合法返回undefined的控制协议则必须显式判别。其余同步hook拒绝thenable，authorize/inspect必须返回void。绑定的执行signal与诊断通过真实调用context下传。

RRF 每条输入排名及贡献明细均用 sourceId。Text/VectorSearch 中的 filter 由 App 提供，必须同步返回 boolean。VectorSearch.upsert 使用 { document, vector }，search 使用命名请求。两者命中都用 document，分数含义分别为词法权重和余弦相似度；RRF 只融合名次，不能直接比较它们的 score。

ModelCalls 绑定使用 assertInput／assertOutput 检查输入与输出。timeoutMs 必须是 1 到 2147483647 的安全整数，非法值在调用前拒绝。

DurableTask 的第二个构造 options 可绑定 store 和 now；run 的命名请求可提供本次 store。`authorize` 在每次恢复及已完成结果返回前检查当前身份、来源版本和授权。

Checkpoint 可包含 `modelBudget: { maxCalls, reservedCalls, maxCallsPerAttempt }`。每次执行前先持久预留整次额度，再交给 handler 的 `maxModelCalls`；App 用它约束真实 runner。中断或未用完的预留不退还，因此崩溃后恢复也不能重置累计额度。State 谓词同步 boolean，steps 具有明确 replayPolicy；时钟、保存中取消和对账沿用相同生命周期。完整示例见[持久任务](advanced-agents.md#持久专业任务)。

## Reflection、BranchVersions 与知识发布

[复盘、分支和资料发布](advanced-agents.md)介绍 `defineReflection`、`defineBranchVersioning` 和 `Knowledge.defineKnowledgePublication` 的配置及使用。它们是 App 可选的 Kit，身份、真实存储和发布决定由 App 提供。

## MockGPT

模拟模型 Kit 从 `@jangts/agent-core/mock` 使用；Node 服务和网页来源分别由 `/mock/node`、`/mock/web` 提供。可直接生成 JSON 值，也可测试模型客户端的 HTTP/SSE 及故障处理。完整输入、返回、预算与 TS/JS 示例见 [MockGPT API](mock.md)。

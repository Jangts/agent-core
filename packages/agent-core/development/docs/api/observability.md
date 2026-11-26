# 请求、调用链、事件与 Journal

[返回 API 手册](README.md) · [Core](core.md#journal-与诊断)。Core 记录运行、调用与登记实体。App 的账号、HTTP 请求与问答记录在自身数据模型中关联 runId。

## 一条事实一条记录，关系在顶层

同一个 observer 对象沿 Runner、Engine 和子调用重复接入时，只订阅一次；保留该事件树最先订阅的方法快照和原接收者。不同 observer 对象即使共用回调函数，仍各自接收一次。

Core通过可选CoreLogOutput逐条发射事件，不把整棵调用树塞进一条JSON，也不是一次模型问答只留一条摘要。模型请求／输出、工具开始／完成、工作流转换／失败各有事件；它们采用同一个v2外层，payload按type表达差异：

```ts
interface CoreDiagnosticRecord extends DiagnosticIdentity {
  readonly version: 2;
  readonly eventId: string;
  readonly type: CoreEventName;
  readonly producerSequence: number;
  readonly occurredAtMs: number;
  readonly payload: unknown; // 未可信存储输入；CoreEvent按type关联具体载荷
  readonly usedModel?: boolean; // 本次节点自身上报；未上报保持未知
  readonly subSteps: readonly ReportedStepRecord[];
  readonly subStepsDropped: number;
  readonly subStepsTruncated: boolean;
}
```

| 字段 | 职责 |
| --- | --- |
| runId | 一次Core运行身份，由调用方在运行前取得；不自动等于requestId或messageId |
| spanId/parentSpanId | 当前执行边界及直接父边界；不依赖解析span路径来查询 |
| invocationId/parentInvocationId | 真实模型或工具调用及其调用父级；不是供应方function-call ID |
| workflowInvocationId | 一次显式工作流调用的范围；嵌套工作流另有身份和父关联 |
| eventId | 这条执行事实的身份；与workflow observer看到的事实ID一致 |
| producerSequence | Core诊断context树内的1起序号；不能用它冒充跨来源总序或因果证明 |
| occurredAtMs | Core事实产生的毫秒时间 |
| definitionId/definitionKind/definitionRevision | 登记实体及可用修订信息 |
| nodeId/nodeName/nodeKind/nodeDescription | 本次边界的基础描述；不强制存整幅历史配置 |
| nodeRole | workflow-node/workflow-boundary/invocation/loop-step，防止把局部调用当成主流程调度 |

工具和模型成功返回中的invocation、对应事件与Journal共享同一调用身份。压缩模型、真实嵌套工具调用各有自己的invocationId并关联父调用；纯包装不凭空生成一次已执行业务操作。重复进入同一工作流节点有不同span，静态nodeId相同不表示同一次访问。

## Journal不是第二个持久化日志

ContextJournal是本轮内存上下文投影，用于让模型继续参考真实调用回执；它不创建数据库或另存一套执行历史。模型与工具开始记录共用 invocationId 去重范围，重复模型记录或模型／工具身份碰撞会拒绝；快照失败不占用该身份。记录采用type、producerSequence、occurredAtMs和InvocationMetadata：

```ts
journal.model({ stageId, value, invocation }): void
journal.beginTool({ toolId, input, invocation? }): string
journal.finishTool({ invocationId, status, value }): void
journal.snapshot(): readonly ContextRecord[]
```

模型在解析、交付及取消检查后提交value；工具开始／结束复用同一个invocationId。默认不产生call-1这类跨实例无法关联的编号。不存在调用或重复结束会拒绝。snapshot是副本。仅接受命名请求与 success/error/cancelled 状态，记录使用 type、value、toolId/stageId。

Journal与诊断投影同一实际执行边界，不保证二者内容完全相同：Journal保存本轮需要的业务值，诊断按采集规则记录执行事实，关闭诊断不改变Journal和业务执行。需要持久化时，由App接出CoreLogOutput，不能另把Journal序号当作一条新的真实调用。

## 真实工作流、失败与未进入的边界

WorkflowEvent具有必需eventId、workflowId、workflowInvocationId、nodeId、roundIndex及type。transition/error的targetSpanId指向**选中的下一次访问**；只有对应enter事件证明实际进入。选择以后发生取消、预算拒绝或丢日志时，不能把目标画成已执行。

错误事件的errorEventId沿恢复context传递；失败阶段phase及failedRouteId定位问题。取消、预算和合同错误不能被恢复成未经执行的成功。节点进入前的失败标记workflow-boundary，不伪造第二个enter。原始engine.run只产生loop.event，不借用工作流主节点身份。

ModelCallTrace和ToolExecutionEvent使用success/error/cancelled；检查passed/failed属于业务检查，不覆写模型调用是否成功完成。ToolRegistry在元数据采集下保留工具身份与开始／完成事实；input/value、详细错误和subSteps只在内容采集获准时附带。预检查拒绝与已接纳尝试分开记录，不能据一条错误推断供应方必然收到了请求。

## 运行中的状态和输出

Core 调用 App 登记的接收端，不直接操作界面。固定流程、模型／工具调用和节点动态进度使用同一个 `CoreEvent` 外层，按 `type` 区分载荷。日志与监听收到的同一事实具有相同 eventId、时间和调用关系；内容采集规则及副本各自隔离。

```ts
const agent = new AgentCoreEngine({
  workflow, model: { provider },
  execution: { observe: {
    // 默认只接元数据。仅对明确需要的进度报告开放内容。
    accepts: ({ event, content }) => content === 'metadata' || event === 'node.progress',
    event(fact) {
      if (fact.type === 'model.start') showStatus(fact.workflowNodeId);
      if (fact.type === 'node.progress') showProgress(fact.payload.payload);
    },
  } },
});
await agent.run(state);
```

| 接入点 | 内容 | 保证 |
| --- | --- | --- |
| execution.observe.event | Loop／Workflow、model.start／end、工具开始／结束及获准的动态报告 | 旁路；同步抛错、异步拒绝或悬挂不改变执行；关闭持久日志仍有效 |
| execution.diagnostics → CoreLogOutput.write | 同一事实的可选持久投影 | App 决定字段、正文、存储和保留期；不获得其他监听器的内容授权 |
| ModelRunner.sink.output | 同一外层的 model.start／output／parsed，以及成功、失败或取消时 model.end | 正文按序等待、传播失败、保留背压；结束通知独立限时250毫秒，其失败不覆盖结果或原始异常 |
| context.report({ usedModel, payload }) | 当前节点运行中的即时报告 | usedModel 为可选布尔元数据，payload 仅内容获准才读取；Core 补齐身份、时间和序号，节点结束或取消后的报告丢弃 |
| 节点 report(update, context) | 完成／跳转时的 usedModel／payload | 内容获准才求值，不替代运行中的即时报告 |
| context.createStepRecorder() | 绑定本次执行的子日志实例 | write 先留记录，fix 随后补全，readAll 取得固定格式快照；复用既有 node.progress 出口 |

监听器可用 event、nodeId、workflowNodeId 等元数据过滤。workflowNodeId 保留所属 Workflow 节点，模型／工具边界自身仍有 nodeId 和 invocationId。重复访问同一节点有不同 span，并发运行不借助 lastCall 或共享“当前请求”关联。可在已有请求作用域上调用 `withObserver` 增加监听，沿子作用域继承；这是不可变的接线，原作用域不受影响。规范方法在装配时绑定原接收者。可复用 Engine 未配置请求作用域时，每次 run 分配独立身份。

无 accepts 的监听器仅接元数据。内容事件、payload 和子日志正文 只在对应消费者明确接纳后采集；其他元数据消费者不会连带获得正文。消费者拿到独立副本。结果快照与实际返回值隔离，不因预览修改而改写最终值；模型结果仍须符合既有 Journal 快照合同。

ModelPart 不提供独立推理内容分片。状态、模型明确提供的过程说明、工具事实、暂态预览和最终答案各自保持含义，不能把内部隐藏推理或原始协议当用户回复。选择、压缩与装配可分别注册普通节点，使用真实生命周期事实；算法报告按获准的 node.progress 交付。

增加监听只改变装配配置；原 Workflow、run 和模型结果合同不变。

<a id="子日志实例与先记后补"></a>

## 上报步骤记录器与追加更新

Workflow 节点、简易 run(step)、ToolRegistry／Support 工具及 executeInvocation 的执行 context 均提供 `createStepRecorder()` 和 `report()`。每次节点访问或调用各有一个实例，多次 create 返回同一实例；不共用全局 logger。创建入口已绑定执行 context，无需再次传参；身份沿 App 装配的诊断作用域继承，自动关联当前 Engine 定义、run 与 node 访问，不保存 App 服务对象。Loop 接管生命周期，write／fix 接受后立即把不可变快照交给 runtime，再通过 node.progress 通知 App 与日志出口。节点不提交 logger 或 readAll() 的结果；终态事件使用 runtime 已接收的快照，不回读 logger。节点结束时解绑写入并释放 runtime 的实例引用，失败与取消保留此前记录；再次访问同一节点创建独立实例。readAll() 向任何持有者提供持续只读查询，不产生事件或提交。实例可由节点、App 或外部代码保留并借用，Core 不限制用途；后续节点访问获得新实例，旧实例可用于读取上次 flow。App 按 operation 与 targetStepId 将追加的 fix 应用到原 write 对应的界面视图，按 revision 判断修订顺序。存储字段 subSteps 为固定格式数组。

```ts
async run(state, context) {
  const subs = context.createStepRecorder();
  const id = subs.write({ name: '查询资料', kind: 'retrieval', payload: { query: state.question } });
  // write 已记录意图；即使后续短路，也保留这条计划。
  if (!state.canRead) {
    subs.fix(id, { status: 'skipped', usedModel: false });
    return;
  }
  subs.fix(id, { status: 'running' });
  try {
    const result = await readSource(state.question);
    subs.fix(id, { status: 'success', usedModel: false, payload: { result } });
  } catch (error) {
    if (!context.signal.aborted) subs.fix(id, { status: 'error' });
    throw error;
  }
  context.report({ usedModel: false });
}
```

| 方法 | 固定合同 |
| --- | --- |
| write(input): string \| -1 | name 必填，type 为自定义业务类型；兼容的 kind 分类与 type 至少提供一项，缺省时互为补足，status 默认 planned；自动分配 stepId、sequence、createdAtMs 和初始 revision=1。可选 parentStepId、relatedDefinitionId、caseId、nextStepIds、状态、时间、摘要、payload 和 usedModel。只有明确报告 running 才自动记 startedAtMs，计划时间不冒充实际开始。 |
| fix(stepId: string \| -1, patch): boolean | 给同一实例内的记录补状态、模型使用、待定时间、摘要、后继或 payload 字段；终态不能重开，但执行仍活跃时可补缺失的结果字段。每次成功均追加独立记录，operation=fix，分配新 stepId、sequence、createdAtMs；targetStepId 指向原 write 的 ID，revision 按该原记录递增。记录携带本次修订后的完整状态，不修改原 write 或先前 fix。payload 递归补缺失键，已有事实不能覆盖；已给定的摘要、时间和后继不能改写。 |
| readAll(): readonly ReportedStepRecord[] | 按实际追加顺序返回全部 write／fix 记录；多次 fix 对应多条记录，旧行和旧快照保持不变。没有步骤为 []，执行关闭后仍可读快照。 |

记录的固定字段为 origin=reported、operation=write／fix、唯一 stepId、追加序号 sequence、name、kind、status、createdAtMs、revision；fix 另有 targetStepId，始终关联原 write，不能以 fix 记录的 ID 再修订。历史投影快照可缺省 operation。planned／unknown 可推进到实际状态，running 不能退回计划或 skipped；success／error／cancelled／skipped 为终态，状态和已确定的事实不能改写，但所属节点仍活跃时可以继续填入等待中的结果字段。状态及合法推进关系来自同一 reportedStepStatusCatalog。重试另 write 一条，不重开终态。父、后继必须属于同一 logger；尚未取得后继 ID 时可在后续 fix 中一次补齐 nextStepIds。待填 payload 字段先省略，不以 null 或空数组冒充可覆盖的占位。默认最多256条原始 write、总计1024条 write／fix 记录、全部序列65536个JSON字符；payload 只收有限深度的 JSON 数据，不接受函数、服务实例、循环引用或内部 getter。

write 和 fix 当时就经既有 node.progress 发射初始／补全事件，payload.subStep 保存 operation、当前记录 stepId、fix 的 targetStepId、sequence、revision、createdAtMs、status 和可选 usedModel 元数据。内容获准时，事件附带该时点的固定格式 subSteps 快照；节点结束／失败事件也附带最后快照。日志追加修订，已经输出的事件不原地更新。原始 write 不因乱序结果而重新排序；fix 按实际接收顺序追加，回放可区分“当时只有计划”和“后来有了结果”。只收到计划或开始而没有结果时保持原状态；不能推断已经成功、失败或实际调用了模型。

主节点通过 context.report({ usedModel: true | false }) 上报本次自身是否使用模型，日志外层 usedModel 作为元数据保留；子步骤通过 write／fix 上报自身的 usedModel。未上报保持未知，不默认 false；已报告 true 不能改回 false。子节点的 true 不自动汇总进主节点原始标记。此为节点报告，不因字段为 true 而补造 model.start／end 或调用次数，也不采集模型内部隐藏推理。结束 report(update, context) 仍仅在内容采集获准时求值，需在元数据模式保留的标记应在运行中用 context.report 提交。

内容权限继续按事件和消费者分别判断。未获内容授权时不读取 payload／summary getter，也不读取报告中的私有 payload getter；只保留已获准的状态、修订和布尔元数据。执行结束或取消后实例关闭，write 固定返回数字 -1，fix 返回 false，不报错、不校验或读取入参、不入账或发事件；readAll 持续可读。fix 成功返回 true；无效 ID、非法输入、禁止的修订及解绑等失败统一返回 false，不抛错、不改变原记录或产生修订事件。write 成功返回新 ID，非法输入、容量限制、解绑等任何失败统一返回 -1，不抛错、不入账或发事件。日志关闭、出口失败或进程崩溃仍遵守原失败隔离及 incomplete 机制，先记意图不构成事务审计保证。

## 子节点归集与受限委托

`subnodeId` 是同次 node 执行内的逻辑归集身份，不是某条日志的 ID。一个子节点可以拥有多条 write，以及每条 write 的多次 fix；未指定 subnodeId 的记录直接归父 node。它不规定分发、连续分段、执行顺序或依赖关系。App 按实际职责组织自定义子节点，无需为了日志增加调度节点。

- `ReportedStepRecorder` 是完整类，独占记录存储与生命周期。write 可直接填写任意非空字符串 subnodeId，无业务枚举；也可通过 fork(subnodeId) 创建另一个实例。
- `ScopedReportedStepRecorder` 是独立且不继承完整类的委托类，只持有原 logger 与绑定 ID，不保存记录。write 自动补归属并拒绝覆盖；fix 只能修订该子节点的原记录，越界返回 false。没有 fork，不能作为原生 invoke 的 logger。
- 两类实现共同读写接口 `ReportedStepLog`；它们的 readAll 返回同一份全量不可变记录，包括其他分组。读权限不会扩大受限实例的写权限。
- fix 使用独立 `ReportedStepUpdate`，不是 `Partial<write参数>`。只接受 status、usedModel、startedAtMs、endedAtMs、summary、nextStepIds、payload，仍受状态推进和已有事实保护。不能改变 subnodeId、type、kind、name、stepId 或其他身份字段。
- type 是可自定义的业务日志类型，operation 才是 write／fix。fix 继承原记录的业务类型和归属；每次成功都追加独立记录。

```ts
const logger = context.createStepRecorder();
// 可直接指定分组，fork 不是必需步骤。
logger.write({ subnodeId: 'prepare', type: 'source.read', name: '读取资料' });
const logs: ReportedStepLog = logger.fork('prepare');
prepareMaterials(logs); // 子函数只需要公共读写接口。
await context.tools.invoke({ toolId: 'read', input: {}, logger });
// Core 传给真实工具的 execution.logger 是 ScopedReportedStepRecorder。
```

注册子节点 ID 只在本次 node 执行内唯一，格式为 kind:encodedDefinitionId:ordinal，例如 tool:product.references:1。定义 ID 使用 URL 编码，计数按能力种类与定义 ID 分开，在调用开始时分配；失败、取消不复用，下一次 node 访问从1开始。父级访问身份已有独立字段，不重复拼入子节点 ID。真实调用身份单独保存在 relatedInvocationId，用于对应模型／工具主事件，不以短序号代替 invocationId。重复／并发调用分别归集，同次调用的多条日志保持相同 subnodeId。自定义子节点由 node 自行命名，两种归集都没有业务枚举约束。

fix 的失败统一返回 false，write 的失败统一返回 -1；调试控制台使用固定原因输出 warn，同一 logger 同类原因去重，不包含入参、正文或任意错误文本。控制台自身异常不改变返回值。fork 对无效 ID 的参数检查与 invoke 对非完整 logger 的边界检查仍保留。

## 原生调用的可选记录

logger 是调用级参数，不是全局开关。未传入时不产生原生子日志，开发者可以自行组织全部记录；显式传入时原生组件统一 write 一条运行记录，并在成功、失败或取消时 fix，形成两条独立记录。不自动创建完整 logger 存储或向所有下游传播完整 logger 权限，不改变它所属的 App、Engine、node 或生命周期。Tool handler 取得 Core 为本次调用绑定的 execution.logger，可把该受限委托交给内部业务函数；不能继续 fork 或传给另一次 invoke。

| 原生入口 | 显式传入位置 | 固定记录 |
| --- | --- | --- |
| ModelRunner.invoke／Workflow model.invoke | request.logger | Model call，关联阶段 ID |
| ToolRegistry.invoke／invokeAsync、Support 工具 | request.logger | Tool call，关联工具 ID |
| executeInvocation／Tools Kit 生命周期 | ports.logger(context) | Invocation，关联 handler ID |
| Retrieval.run | context.logger | Retrieval |
| Answering task.read／readAsync、checks.check、flow.run | context.logger | 证据读取、每个实际 checker、完整答复流程 |
| Knowledge.read | 可选第二参数的 logger | Read knowledge |
| Presentation outputs.compose | context.logger | Compose output |
| Support.processContext、上下文节点 run | ports.logger／显式提供的 context.logger | Process context |
| Support.retryMultipleModelCalls | request.logger | 只在实际降级重试时记录 Retry model proposal |
| Policies 恢复链 tryRecover | 可选第二参数的 logger | 每个实际尝试的恢复策略 |
| Delivery.deliver | execution.logger | Deliver result |
| Aggregation.collect | 可选第三参数的 logger | Aggregate queries |

固定记录只描述执行边界，不自动复制模型输入输出、工具参数或客户材料。检查正常返回不通过、恢复正常返回未处理，都属于函数成功返回；业务结果由开发者按需补充。已有 Core 主事件继续提供原有调用事实；可选子日志用于节点内部编排展示，不替代主事件、回执或权限检查。纯配置、清单查询和格式化函数不追加日志。

```ts
const logger = context.createStepRecorder();
await context.model.invoke({ input: '简要说明', logger });
await context.tools.invoke({ toolId: 'read', input: {}, logger });
// 此次调用未传 logger，不追加原生子日志。
await context.tools.invoke({ toolId: 'read', input: {} });
```

## 文件适配与关系表映射

App 可将 CoreLogOutput.write 接到自己的文件或数据库适配器。Core 事件平铺保存，App／存储字段source、traceId、app、sequence和recordedAtMs由适配器补充，Core不依赖这些字段；其余应用诊断仍可使用原record接口。文件可按来源分段，它们属于同一个运行会话，不是另一套Journal持久账本。

采集器sequence串起App、Core等来源的落盘观察次序；producerSequence保持生产者原序号。occurredAtMs与recordedAtMs分别保留。适配器沿用现有脱敏、正文开关、有限队列、分段／大载荷文件及保留期；旁路失败不会改变业务结果，队列丢弃或写入失败标记incomplete。此接口不提供事务审计或恰好一次保证。

关系数据库代记无需网状JSON，可以直接映射：

| 对象 | 主要关系列 | 明细 |
| --- | --- | --- |
| runs | run_id、started_at_ms、ended_at_ms、status、incomplete | 运行摘要 |
| spans | run_id、span_id、parent_span_id、invocation_id、parent_invocation_id、definition_id | 边界摘要 |
| events | event_id、run_id、span_id、invocation_id、type、sequence、producer_sequence、occurred_at_ms、recorded_at_ms | 各type的payload JSON；必要正文另存引用 |
| App message_run_links | message_id、run_id、relation及账号隔离列 | App拥有的用户问答关联 |

这里是可行映射，不是已创建的SQL表或SDK内置仓库。查询由App授权；一个输入可触发多个run，失败／取消没有最终输出时也可关联输入消息，Core不回查App消息表。父子键可用于递归查上游／下游；不要靠时间邻近或文字相似度猜关联。存储可用同一事实幂等投影摘要，处理乱序和缺失，不能把最后落盘一行当作权威完成状态。

## 事件格式校验

normalizeDiagnosticEvent(input) 接受 version=2，校验身份、时间、序号和 reported steps，并生成独立副本。缺失身份或不支持的版本会被拒绝。

读取边界的 payload 为 unknown，外层校验不等于验证任意业务 JSON。写入接口 CoreEvent 按 type 关联 CoreEventPayloads，精确事件目录和字段见[公开声明](reference.md)。

## 事实与报告的区别

只有实际 Loop 调度的工作流节点才是主访问；节点调用局部函数不会产生额外的已调度节点。subSteps 是可选、有限的 reported 材料，不能当成 Core 调度事实或静态子图。只有目标 enter 事件证明已进入，不能把选中的路由目标或最后落盘一行当作执行证明。App 自己拥有用户输入／最终输出及消息关联。

## 文件适配的大记录

选用 `@jangts/diagnostics` 文件适配时，大记录中的 payload、subSteps、redactions 作为同一校验附件的正文域保存；引用行保留身份和索引信息。reader 校验附件范围、大小、SHA-256 与适用身份后还原记录。附件及返回预算仍由 App 明确配置，Core 本身不拥有文件存储。

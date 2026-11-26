# Core：执行、模型与真实工具

[共同类型](types.md) · [返回首页](README.md)。下文的 `execution`、`OperationContext`、`SchemaAdapter`、`ReadonlyCatalog` 均采用共同合同。

## ModelRunner

```ts
new ModelRunner({ provider, interactions?, execution?, ...options })
runner.bind(execution?): ModelRunner
runner.invoke({ input, execution?, stageId?, interaction?, maxOutputTokens? }): Promise<ModelResult<Output>>
runner.invoke(input: string): Promise<ModelResult<string>> // 只归一化输入，返回外形不变
```

| 构造字段 | 类型／语义 |
| --- | --- |
| provider | ChatProvider；实际模型连接由App提供 |
| interactions | 只读ModelInteractionDefinition 数组，登记ID唯一；缺省仅有core:plain-text |
| execution | ExecutionOptions；显式提供则绑定请求，省略则各顶层调用独立 |
| maxCalls | 本请求模型调用上限，包含使用同一请求 Runner 的选择／压缩调用 |
| callTimeoutMs | 单次调用时长，不延长上层请求期限 |
| maxInputChars/maxOutputChars/maxSchemaChars | 三种不同字符预算，不互相借用 |
| tokenBudget | 有明确计数器身份和计数端口的token预算，不猜字符换算 |
| maxOutputTokens | 单次调用的默认输出预留；invoke可覆盖 |
| sink.output | (event: ModelOutputEvent) => void \| `Promise<void>`；正文交付按序等待、失败传播；model.end 为有界收尾通知 |
| execution.observe | ExecutionObserver；统一接收节点、模型、工具过程事实，旁路、失败隔离 |

`input` 为共享的 ModelInput：纯文本、只读消息数组、BuiltContext 或 ContextPlan。字符串短写省略输入对象，返回同一种 ModelResult。

两种纯文本调用完全等价：

```ts
const a = await runner.invoke('你好');
const b = await runner.invoke({ input: '你好' });
// a、b都为ModelResult<string>，正文取value，调用信息取invocation。
```

成功结果固定为`{ value, invocation }`。结构化模型仅改变value的静态类型；不会切换成裸对象，也不提供raw/fullResponse返回模式。错误通过Promise拒绝传播。实际调用事件和回执不能由模型填入invocation。

类型推断来自构造时保留字面量ID的只读interactions元组，不能仅凭任意string推断Output。invoke省略 interaction固定选择内置`core:plain-text`，不按“唯一注册交互”猜默认值；stageId缺省为`model`。已知字面量ID返回对应`ModelResult<T>`，动态string返回`ModelResult<unknown>`。字符串短写与同值对象输入的推断一致。

同一 `interaction` 字段接受已登记的 ID 或交互定义句柄。传句柄时校验原对象已登记，并从该对象合同推断结果。

预算默认沿用当前modelRunnerDefaults：maxCalls=8、callTimeoutMs=30000、maxInputChars=32000、maxOutputChars=16000、maxSchemaChars=16000、maxOutputTokens=1024。maxCalls 为非负安全整数；maxInputChars／maxOutputChars 为非负安全整数或 Infinity；maxSchemaChars／maxOutputTokens 为正安全整数，callTimeoutMs 为 1 到 2147483647 的安全整数。token预算另校验窗口、计数器及安全余量，不将这些默认值当供应方容量声明。

未传 `execution` 构造的 Runner 可长期共享：每次顶层 `invoke` 使用独立预算、取消、journal 和调用记录；共享宿主没有隐式的当前请求，直接读取 callCount、totalCallCount、remainingCalls、lastCall、journal 或 signal 会抛错，必须从 `bind(execution)` 返回的绑定读取。多步调用使用 `runner.bind(execution)`，相同 execution 对象返回同一绑定，或直接在构造时传 execution；在绑定实例上读取实时计数和 journal。已绑定实例再次 bind 不重置寿命或赠送额度。共享实例的 `prepare` 固定本次执行，句柄只能由原实例使用一次；`createChild` 须先绑定或显式传 execution，子调用仍扣减祖先预算。同一绑定同时只执行一次调用。Engine 接入共享 Runner 后按每次 run 自动绑定；已有请求绑定仍累计预算并拒绝重叠运行。子类 handler 保留真实接收者；覆写方法通过请求参数中的 execution 调用 `this.bind(request.execution)`，读取与 super 调用一致的执行状态。自定义字段仍共享，请求数据通过参数或 context 传递。

```ts
const requestModel = runner.bind(execution);
await requestModel.invoke({ input: 'first stage' });
await requestModel.invoke({ input: 'second stage' });
console.log(requestModel.callCount, requestModel.journal.snapshot());
```

```ts
interface ModelTool<Input, Output = Input> {
  readonly id: string;
  readonly description: string;
  readonly inputSchema: SchemaAdapter<Input>;
  resolve(input: Input, context: Readonly<{ stageId: string }>): Output;
}
interface ModelSelection {
  readonly toolId: string;
  readonly input: unknown;
}
interface ModelInteractionDefinition<Output> {
  readonly id: string;
  prepare(stageId: string): PreparedModelInteraction<Output>;
}
```

`PreparedModelInteraction<Output>`为统一的模型交互准备合同：options、schemaChars、可选instruction、createResponse()。返回的collector具有outputChars、push(part)及finish(): Output；文本collector累积并拒绝函数调用分片，结构化collector完整解析后才返回结果。collector是每次调用新建的实例，不复用跨请求状态。PreparedModelSelection 供结构化适配组合使用，文本交互直接实现通用收集合同。

ModelTool 使用 inputSchema.parse 解析能力参数，使用 resolve(input, { stageId }) 生成类型化阶段结果。resolve 同步执行，误返 thenable 时拒绝，不执行工具或授权。ModelToolSource.resolve(selection, context) 先核对本阶段可用 ID，再解析、转换并执行已声明的 refine 检查。

Core 在 collector 工厂返回后、每次 push 后和 finish 后读取 outputChars：值必须是非负安全整数，NaN、Infinity、负数和小数均按协议错误拒绝。maxOutputChars 可以显式设为 Infinity，但不放宽 collector 计数合同。诊断保留各次有效观测的峰值，finish 可释放或规范化内部缓冲，不要求缓冲一直增长。

原生交互接收字符串或合法的 function-call-delta。函数分片必须是非数组对象，index 为 0；id 提供时必须是非空字符串，name 和 arguments 提供时必须是字符串。冲突 ID、多个调用、未登记能力、混合正文或不完整参数被拒绝，不执行工具。需要正文 + 多调用时使用 `Support.createModelInteraction`；它复用同一聚合 collector，但不改变原生交互的单提案合同。

collector 可选 call 元数据只尽力读取一次；getter 抛错不覆盖已取得的业务结果、原始错误或取消，也不阻止 model.end 收尾。outputChars 是执行校验字段，不适用这个容错规则。

纯文本交互与结构化传输各自提供构造函数，返回满足模型交互准备合同的实现。准备好的交互负责收集完整结果并解析选择；原始分片不能成为工具回执。

### 可选答复指导

`ModelCallRequest` 和 `ModelPrepareRequest` 接受 `replyGuidance: { defaultDetail: 'brief' | 'normal' | 'detailed' }`。可信 App 默认值在准备阶段补入固定短指令。简短答复先给结论，摘要压缩原文；用户明确要求详情、完整结果和格式时仍应遵从，同时保留交互协议。省略配置不加指令，只在适用的答复调用启用。

prepared 句柄暴露冻结后的 `replyGuidance`；使用句柄调用时再传指导会被拒绝。指令遵循既有交互/schema 字符计量并计入总输入/token，与 provider 发送共用快照。它不截断输出，也不保证模型遵从。[答复组织](../../articles/reply-organization.md)展示工具/节点默认值的 App 选择，[Support](support.md#答复指导归并)说明归并规则。

### 可选的请求准备与实际测量

普通 `runner.invoke(input)` 不需要准备步骤。显式上下文节点需要提前判断候选输入时，可准备一次传输快照：

```ts
const prepared = runner.prepare({ stageId: 'reply', interaction, maxOutputTokens: 1000 });
const measurement = prepared.measure(candidateMessages);
// 调整候选消息后可以重新 measure；不会重新 prepare 或消耗模型调用。
const result = await runner.invoke({ input: finalMessages, prepared });
```

`context.model` 提供相同的 prepare／invoke 合同，可把句柄保存在本次 Workflow 状态中交给后续节点。多模型时准备请求可指定 modelId，最终 invoke 由句柄定位原模型，不必再次手传；处理模型和最终模型仍受同一个请求额度约束。

准备固定当次动态传输的 instruction、Schema、选项及 collector 工厂接收者。测量覆盖合并后的真实消息、传输指令和 Schema；有显式计数器时，输入 token 限额扣除本次输出预留与安全余量。注册模型的句柄同时保留 modelId，选择或压缩可显式引用另一个已登记模型，最终调用仍定位原准备模型。无计数器不生成 token 估计。App 正文受 maxInputChars 约束，传输指令及声明受 maxSchemaChars 独立约束，不互借额度。JSON Schema 若已嵌入指令，实际总量不再重复相加。

测量返回 `ModelInputMeasurement`，含正文 messageChars、增加的 instructionChars、消息外声明 schemaChars、传输预算用量 interactionChars、实际合计 inputChars、有效限额和 withinBudget。它不是额度预订或放行凭证：最终输入仍在 Provider 前重新测量和校验。句柄只属于准备它的 Runner／Workflow 请求，只能消费一次，不能替换 stageId、interaction 或输出预留。取消、过期、外部句柄及重复使用会拒绝；预检查拒绝仍不消耗模型次数。

最终调用在首次异步等待前固定消息的 role、content 和 images 快照，预算、token 计数及 Provider 发送共用该快照；调用方随后修改原对象不会改写请求。prepare 固定本次能力 ID 集合，后续注册的新能力只能供新的准备使用。

字符预算只接受非负安全整数或 Infinity；BuiltContext 自带的预算也须通过同一校验，只能缩小 Runner 上限。NaN、缺失预算、分数及其他非法值在计费和 Provider 调用前拒绝，测量与实际执行使用相同判断。

### 固定的调用结果

```ts
interface ModelCallRecord extends InvocationMetadata {
  readonly stageId?: string;
  readonly modelId?: string;
  readonly callSequence: number;
  readonly startedAtMs: TimestampMs;
  readonly status: 'success'; // 仅成功返回的invocation
  readonly usage?: ModelUsage;
}
interface ToolCallRecord extends InvocationMetadata {
  readonly toolId: string;
  readonly startedAtMs: TimestampMs;
  readonly status: 'success'; // 仅成功返回的invocation
}
```

invoke成功返回中的invocation始终是success记录；失败记录走事件／诊断，失败调用本身抛错。ModelCalls的已登记外部模型设置modelId，Agent模型阶段设置stageId；这不改变结果外形，也不要求模型提供调用元数据。

### Provider 和模型输出

```ts
interface ChatProvider {
  stream(
    messages: readonly ModelMessage[],
    context: ModelProviderContext,
  ): AsyncIterable<ModelPart>;
}
interface ModelProviderContext {
  readonly signal: AbortSignal;
  readonly options: Readonly<ModelOptions>;
  readonly diagnostics?: DiagnosticContext;
}
```

ModelOptions 提供 json、temperature、functions、includeUsage、maxOutputTokens 等供应方中立字段。usage 接收属于执行记账端口，先记录真实用量再通知 observer；observer 的失败隔离不影响用量记录。

Provider合同只传真实调用与传输参数，不决定业务授权。请求时的输出token叫maxOutputTokens；连接配置中的硬上限叫outputTokenLimit，不能与默认预留混淆。供应方max_tokens/tools等wire字段继续由适配器转换。

模型sink与过程观察复用同一CoreEvent外层。sink接收model.start、model.output、model.parsed，以及成功、失败或取消时的model.end；载荷在payload中，使用真实invocationId隔离调用。model.parsed表示完整模型值通过解析，仍须等待交付及取消检查后提交；它不是App最终回复。model.end 使用独立的250毫秒收尾期限，取消后仍尝试通知预览撤回；通知失败不覆盖已提交结果或原始异常，消费者仍须自行处理连接中断。事件使用type判别，阶段引用叫stageId，模型序号叫callSequence（1起）。预览仍是暂态，最终值只有完整收集、解析、预算和取消检查通过后才返回。

## AgentCoreEngine 和 Workflow

### 已有请求模型服务

```ts
const runner = new ModelRunner({ provider, maxCalls: 4, execution });
const agent = new AgentCoreEngine({ workflow }).bindModelRuntime(runner);
await agent.run(state);
```

bindModel 配置定义时，每次 run 构建独立请求 Runner。bindModelRuntime 接入未绑定的共享 Runner 时，Engine 用本次 execution 自动绑定，多个 run 独立计数、取消和记录。接入已有请求绑定或不提供 bind 的结构化服务时，复用原预算和寿命，不获赠额度，不允许重叠运行。节点通过 context.model 自动取得调用父级及实时计数；fork 仍须显式恢复分支模型。规范 invoke／prepare 固定原接收者，服务本身不 clone／freeze。

### 子执行与共享预算

```ts
const child = parent.createChild({
  id: 'app.analysis', maxCalls: 8, reserveCalls: 1, timeoutMs: 60000,
  interactions: specialistTransports, diagnostics: operation.diagnostics,
});
const engine = new AgentCoreEngine({ maxRounds: 8, execution: child.execution });
// 使用同一 Engine／Workflow，App 提供独立 state、app、工具与完成检查。
```

`ModelChildOptions` 是显式子执行设置。子 runner 继承 Provider、单次限制、token计数器及调用观察端口；不继承父对话、journal、输出sink或传输清单。省略 `interactions` 时使用内置纯文本交互；按需添加专用交互。`execution` 是只读的 signal／diagnostics，可传给 Engine 和工具注册器。子 signal 受父取消与本地期限共同限制，诊断使用同一 run 的唯一子作用域，不能换入另一 run 的观察父级。

`maxCalls` 是局部上限，`reserveCalls` 是留给祖先的额度。调用在供应方 I/O 前原子扣减本地与祖先账本，失败不退回尝试次数；预检查拒绝不扣。`remainingCalls` 同时反映本地、总预算及预留限制；`callCount` 仍只计本实例，`totalCallCount` 包括子调用。不因创建新实例扩大全请求额度。

`children` 配置这一请求家族的 `maxDepth`、`maxConcurrentCalls` 和 `maxChildren`，默认分别为 1、1、32。深度从根 runner 的 0 开始；总创建数不会因子任务结束而返还。配置在根构造时固定，所有后代共用容量，每层仍保留自己的祖先收尾额度。`ModelChildOptions.signal` 可再附加局部取消，父取消会传到全部后代。

```ts
const parent = new ModelRunner({
  provider, maxCalls: 12,
  children: { maxDepth: 3, maxConcurrentCalls: 2, maxChildren: 16 },
  execution,
});
```

上下文节点通过普通模型端口共享预算。App 提供角色清单、权限端口及结果合同，以 Workflow／handler 组织任务，并将子 signal 传给真实工具和收尾副作用。需要组合有界并行任务时，可使用 [Support.runChildren](advanced-agents.md#有界子任务组合)。

```ts
const agent = new AgentCoreEngine({ workflow, app, tools, maxRounds: 8 });
const result = await agent.run(state);
```

`defineWorkflow` 编译定义。已知 Workflow 时可在构造时绑定，也可在装配阶段用 `bindWorkflow` 绑定一次。工具运行实例同样可以通过构造参数 `tools` 绑定，或在装配阶段用 `bindToolRuntime` 绑定一次；两者接受同一合同，不可重复绑定。节点、路由、模型与工具的完整用法见[工作流入门](workflow.md)。

`maxRounds` 约束轮次，缺省为 8。底层回调循环仍可用 `engine.run(step)`，其回调接收轮次和执行上下文并返回 `StepOutcome`。

`run(step, { signal })` 与 Workflow 的 `run(state, { signal })` 均将单次取消与实例 execution.signal 组合，保留原取消原因。未绑定 Workflow 的 CoreStep 调用不接受 modelId 选择。

自编排的 CoreStep 回调应将上下文的 signal 传给内部异步操作，并在副作用前检查取消。取消会停止等待当前回调，迟到结果不进入后续循环；取消不能强制终止任意 JavaScript，也不能把尚未确认的存储提交视作已经回滚。持有事务或排他锁的 App／Kit 须等待已开始的存储提交确认后再释放资源。

```ts
type StepOutcome<Output> =
  | { readonly type: 'continue' }
  | { readonly type: 'complete'; readonly value: Output };
interface WorkflowContext<App> extends OperationContext<App> {
  readonly roundIndex: number;
  readonly error?: unknown;
}
interface WorkflowNode<State, Output, App> {
  readonly id: string;
  readonly description: string;
  readonly startsRound?: boolean;
  readonly requires?: readonly (keyof State & string)[];
  readonly provides?: readonly (keyof State & string)[];
  readonly onErrorNodeId?: string;
  run?(state: Readonly<State>, context: WorkflowContext<App>): MaybePromise<Partial<State> | void>;
  readonly routes: readonly WorkflowRoute<State, Output, App>[];
}
```

run(step) 使用 StepOutcome，允许 undefined 成为合法完成值。工作流路由通过 targetNodeId 与 complete 显式区分跳转和完成：

```ts
type WorkflowRoute<State, Output, App> =
  | { readonly when?: WorkflowGuard<State, App>; readonly targetNodeId: string }
  | { readonly when?: WorkflowGuard<State, App>; readonly complete: (state: Readonly<State>, context: WorkflowContext<App>) => Output };
```

`WorkflowGuard<State, App>`为同步`(state: Readonly<State>, context: WorkflowContext<App>) => boolean`，误返thenable拒绝。WorkflowDefinition包含id、entryNodeId、只读nodes及可选isResult；nodes的引用、可达性及有界循环在define时检查。执行时先检查requires，再运行handler，检查取消和provides后提交补丁，最后取首个匹配route。取消和合同错误不能被onError改成业务成功。

isResult只回答boolean；若需可恢复业务检查，App在流程节点中调用checker。工作流状态仍与app依赖分离。

## ToolRegistry 和 ToolRuntime

Core低层ToolRegistry可以接手写ErasedTool；Support的ToolRuntime来自类型化工具目录。两者复用同一个真实调用机制。

```ts
interface ErasedTool {
  readonly id: string;
  readonly kind: string;
  parseInput(input: unknown): unknown;
  execute(input: unknown, context: ToolExecutionContext): unknown;
  parseOutput(output: unknown): unknown;
}
new ToolRegistry({ execution?, errors? })
registry.register(definition): this
registry.registerAll(definitions): this
registry.seal(): this
registry.invoke({ toolId, input }): ToolResult<unknown>       // 同步，拒绝thenable
registry.invokeAsync({ toolId, input }): Promise<ToolResult<unknown>>
```

低层value保持unknown，调用结果仍使用固定的InvocationResult；不提供由调用方自报Output的“类型验证”。类型推断来自Support目录。registry实现共同Catalog表面，get缺失返回undefined、require缺失抛错。

管线固定：解析输入 → 已登记执行／授权适配 → 等待实际结果 → 解析输出 → 取消检查 → 记录完成。低层执行合同不要求所有工具额外带业务授权字段；真实规则由App或Support适配后的handler提供。

成功返回中的ToolCallRecord固定status=success；失败调用抛错。只读events中的ToolExecutionEvent及ModelCallTrace区分success/error/cancelled，携带同一InvocationMetadata；业务检查结论由App另行记录，不覆写调用状态。

## Journal 与诊断

[请求、调用链、事件与Journal](observability.md)定义完整关联与存储合同：逐条事件、显式父子键，Journal为同一执行事实的运行投影，不另建一套记账。

```ts
journal.model({ stageId, value, invocation }): void
journal.beginTool({ toolId, input, invocation? }): string // 返回同一invocationId
journal.finishTool({ invocationId, status, value }): void // success | error | cancelled
journal.snapshot(): readonly ContextRecord[]
createDiagnostics({ output?, runId?, spanId? }): DiagnosticContext
```

invocationId 由真实工具调用边界分配，Journal 使用同一身份。跨 run 关联须结合 runId；App requestId 由 App 单独关联。不存在调用或重复结束均拒绝。嵌套 Tools Kit／Support／Core 的一次真实执行只分配一个 invocationId，沿执行上下文下传；executeInvocation 与其 Journal 共享该边界的 invocationId。真正发生的嵌套工具执行是另一条子调用，具有独立 ID，并通过 parentInvocationId 关联父调用。ID 在跨实例范围内保持唯一。

低层执行回调与业务绑定均返回原业务值，只有公开invoke边界包装一次；内部压缩子调用使用result.value，不能将整个信封交给parser。durationMs覆盖当前调用准备、执行、解析和交付等待，startedAtMs在对应边界开始时记录；callSequence仅给实际发出的模型调用分配，预检查拒绝走rejected诊断，不虚构provider调用。

ContextRecord 使用 type 判别、producerSequence（1 起）、stageId/toolId/invocationId 及 value。工具调用状态为 success、error 或 cancelled。工具与 workflow 诊断载荷使用已知字段与 WorkflowEvent 类型；模型生成值和 App 异常可为 unknown。

Core 事实信封使用 version、eventId、type、occurredAtMs、runId、spanId、parentSpanId、可选 invocationId 和 payload。跨来源存储 sequence 由 App 运行收集器统一分配，Core 局部序号使用 producerSequence。Core、Provider、Kit 各自定义事件目录。

完整导出、精确重载和声明源码见[公开符号参考](reference.md)。示例中的签名用于阅读，不能据省略字段推断任意扩展选项。

### 观察与预算的边界

ModelCallTrace包含必需invocationId、startedAtMs、durationMs、callSequence及stageId；status是success/error/cancelled。调用结果、trace与诊断使用同一调用身份。`model.end`只报告已接纳的尝试；输入／预算预检查拒绝走runtime.rejected，未发起供应方I/O不伪造输出。已接纳但collector工厂失败仍收尾为error，并保留已消耗的尝试次数。

ModelRunner默认值和错误优先级由modelRunnerDefaults及执行器定义；预算错误的原始BudgetError.code与getErrorInfo.code均为BUDGET，App可以在自己的呈现层映射成更具体的业务提示。超时／取消原异常身份保留。CallTrace测量覆盖该次调用准备、解析及交付等待；子调用共享总额度，duration不作为可叠加的费用。

## 请求内额度调整

maxCalls为请求初始分配，maxTotalCalls为宿主授权上限，默认等于maxCalls。已绑定ModelRunner通过callBudget和adjustCallBudget读取及调整请求额度，不清零已消耗次数，也不绕过祖先预留。这只改变请求内计账，不修改固定Provider配置、期限或模型窗口。[资源与恢复](reliability.md)说明预算评估、压缩与部分交付的区别及恢复合同。

模型协议、每轮设置、资源准备、续接与生命周期见[统一模型接入](model-protocols.md)。

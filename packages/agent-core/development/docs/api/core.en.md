# Core: execution, models, and real tools

[Shared types](types.md) · [Back to home](README.md). Below, `execution`, `OperationContext`, `SchemaAdapter`, and `ReadonlyCatalog` all use the shared contracts.

## ModelRunner

```ts
new ModelRunner({ provider, interactions?, execution?, ...options })
runner.bind(execution?): ModelRunner
runner.invoke({ input, execution?, stageId?, interaction?, maxOutputTokens? }): Promise<ModelResult<Output>>
runner.invoke(input: string): Promise<ModelResult<string>> // 只归一化输入，返回外形不变
```

| Constructor field | Type / semantics |
| --- | --- |
| provider | ChatProvider; the App supplies the actual model connection |
| interactions | Read-only ModelInteractionDefinition array with unique registered IDs; defaults to only core:plain-text |
| execution | ExecutionOptions; explicit options bind a request, omission isolates top-level invocations |
| maxCalls | Per-request model call limit, including selection and compression calls that use the Runner of the same request |
| callTimeoutMs | Duration of a single call; does not extend the upper request deadline |
| maxInputChars/maxOutputChars/maxSchemaChars | Three distinct character budgets; they are not interchangeable |
| tokenBudget | Token budget with an explicit counter identity and counting port; character conversion is never guessed |
| maxOutputTokens | Default output reservation for a single call; invoke can override it |
| sink.output | (event: ModelOutputEvent) => void \| `Promise<void>`; body delivery is awaited in order and failures propagate; model.end is a bounded wrap-up notification |
| execution.observe | ExecutionObserver; uniformly receives node, model, and tool process facts, out of band, with failure isolation |

`input` is the shared ModelInput: plain text, a read-only message array, BuiltContext, or ContextPlan. The string shorthand omits the input object and returns the same kind of ModelResult.

The two plain-text calls are fully equivalent:

```ts
const a = await runner.invoke('你好');
const b = await runner.invoke({ input: '你好' });
// a、b都为ModelResult<string>，正文取value，调用信息取invocation。
```

A successful result is always `{ value, invocation }`. A structured model only changes the static type of value; it never switches to a bare object and offers no raw/fullResponse return mode. Errors propagate through Promise rejection. The model cannot fill invocation with actual call events or receipts.

Type inference comes from the read-only interactions tuple that preserves literal IDs at construction; Output cannot be inferred from an arbitrary string alone. When invoke omits interaction it always selects the built-in `core:plain-text` and does not guess a default from the "only registered interaction"; stageId defaults to `model`. A known literal ID returns the matching `ModelResult<T>`, while a dynamic string returns `ModelResult<unknown>`. The string shorthand and an object input with the same value infer identically.

The same `interaction` field accepts a registered ID or a interaction handle. When a handle is passed, the original object is verified as registered and the result is inferred from that object's contract.

Budgets default to the current modelRunnerDefaults: maxCalls=8, callTimeoutMs=30000, maxInputChars=32000, maxOutputChars=16000, maxSchemaChars=16000, maxOutputTokens=1024. maxCalls is a non-negative safe integer; maxInputChars/maxOutputChars are non-negative safe integers or Infinity; maxSchemaChars/maxOutputTokens are positive safe integers, and callTimeoutMs is a safe integer from 1 to 2147483647. The token budget additionally validates the window, counter, and safety margin; these defaults are not a statement of provider capacity.

A Runner constructed without `execution` can be shared: each top-level `invoke` has its own budget, cancellation, journal and call records. The shared host has no implicit current request. Reading callCount, totalCallCount, remainingCalls, lastCall, journal or signal on it throws; read these from bind(execution). For multiple calls, use `runner.bind(execution)`; the same execution object returns the same binding. Passing execution to the constructor also binds its lifetime. Read live counts and journals on that bound instance. Binding an already-bound instance never resets its lifetime or grants budget. Shared `prepare` pins one execution; its handle is single-use and belongs to its original instance. Bind before `createChild`, or pass execution explicitly; children still consume ancestor budgets. Only one call can be active on a binding. Engine binds a shared Runner per run; an existing request binding retains cumulative budget and rejects overlapping runs. Subclass handlers keep their real receiver. Overrides use this.bind(request.execution) to read the same execution state as super calls; custom fields remain shared and request data belongs in parameters or context.

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

`PreparedModelInteraction<Output>` is the unified interaction preparation contract: options, schemaChars, optional instruction, and createResponse(). The returned collector has outputChars, push(part), and finish(): Output; the text collector accumulates and rejects function-call parts, and the structured collector returns a result only after full parsing. A collector is a new instance per call and does not reuse state across requests. PreparedModelSelection is used for structured adapter composition, while text interactions implement the generic collection contract directly.

ModelTool uses inputSchema.parse to parse capability parameters and resolve(input, { stageId }) to produce a typed stage result. resolve runs synchronously; a mistakenly returned thenable is rejected, and it neither executes tools nor authorizes. ModelToolSource.resolve(selection, context) first verifies the IDs available in this stage, then parses, converts, and runs the declared refine checks.

Core reads outputChars after the collector factory returns, after each push, and after finish: the value must be a non-negative safe integer, and NaN, Infinity, negative numbers, and fractions are rejected as protocol errors. maxOutputChars may be explicitly set to Infinity, but that does not relax the collector counting contract. Diagnostics keep the peak of each valid observation, and finish may release or normalize internal buffers; buffers are not required to grow indefinitely.

Native interaction accepts a string or a valid function-call-delta. A function part must be a non-array object with index 0; id, when provided, must be a non-empty string, and name and arguments, when provided, must be strings. Conflicting IDs, multiple calls, unregistered tools, mixed body text, or incomplete arguments are rejected, and no tool is executed.

Optional call metadata on the collector is read only once on a best-effort basis; a throwing getter does not overwrite an obtained business result, the original error, or cancellation, nor does it block the model.end wrap-up. outputChars is an execution-validated field and is exempt from this tolerance rule.

Plain-text and structured interactions each provide their own constructor that returns an implementation satisfying the interaction preparation contract. A prepared interaction collects the complete result and parses the selection; raw parts cannot become a tool receipt.

### Optional reply guidance

`ModelCallRequest` and `ModelPrepareRequest` accept `replyGuidance: { defaultDetail: 'brief' | 'normal' | 'detailed' }`. This trusted App default adds a fixed short instruction during preparation. Brief replies lead with the conclusion and summaries compress the source; explicit user requests for detail, complete results and format remain applicable, as does the interaction's output protocol. Omission adds no instruction. Enable it on relevant reply calls rather than every reasoning step.

The prepared handle exposes its frozen `replyGuidance`; supplying guidance again when invoking a prepared handle is rejected. The instruction participates in existing interaction/schema character accounting and total input/token measurement, using the same snapshot sent to the provider. It neither truncates output nor guarantees model adherence. See [reply organization](../../articles/reply-organization.en.md) for App-selected tool/node defaults and [Support resolution](support.en.md#reply-guidance-resolution).

### Optional request preparation and actual measurement

An ordinary `runner.invoke(input)` needs no preparation step. When an explicit context node must judge candidate input in advance, it can prepare a interaction snapshot once:

```ts
const prepared = runner.prepare({ stageId: 'reply', interaction, maxOutputTokens: 1000 });
const measurement = prepared.measure(candidateMessages);
// 调整候选消息后可以重新 measure；不会重新 prepare 或消耗模型调用。
const result = await runner.invoke({ input: finalMessages, prepared });
```

`context.model` provides the same prepare/invoke contract, and the handle can be kept in this Workflow's state for later nodes. With multiple models, a preparation request may specify modelId, and the final invoke locates the original model through the handle without passing it again; the processing model and the final model are still bounded by the same request budget.

Preparation fixes the instruction, Schema, options, and collector factory receiver of the current dynamic interaction. Measurement covers the merged real messages, interaction instruction, and Schema; with an explicit counter, the input token limit deducts this call's output reservation and safety margin. A handle for a registered model also keeps modelId, so selection or compression can explicitly reference another registered model while the final call still targets the originally prepared model. Without a counter no token estimate is produced. App body text is bounded by maxInputChars, while interaction instructions and declarations are independently bounded by maxSchemaChars; budgets are not borrowed across them. If a JSON Schema is already embedded in the instruction, the actual total is not added twice.

Measurement returns `ModelInputMeasurement` with body messageChars, added instructionChars, out-of-message declaration schemaChars, interaction budget usage interactionChars, the actual total inputChars, the effective limit, and withinBudget. It is not a budget reservation or a pass: the final input is still measured and validated again before the Provider. A handle belongs only to the Runner/Workflow request that prepared it, can be consumed once, and cannot replace stageId, interaction, or the output reservation. Cancellation, expiry, foreign handles, and reuse are rejected; a pre-check rejection still consumes no model calls.

The final call fixes a snapshot of message role, content, and images before the first asynchronous wait, and budgeting, token counting, and Provider sending share that snapshot; the caller modifying the original object afterwards does not rewrite the request. prepare fixes the set of capability IDs for this preparation, and tools registered later are available only to new preparations.

Character budgets accept only non-negative safe integers or Infinity; a budget carried by BuiltContext must pass the same validation and can only narrow the Runner upper limit. NaN, missing budgets, fractions, and other invalid values are rejected before billing and Provider calls, and measurement and actual execution use the same judgment.

### Fixed invocation results

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

The invocation in a successful invoke return is always a success record; failure records go to events/diagnostics, and the failed call itself throws. Registered external models in ModelCalls set modelId, and Agent model stages set stageId; this does not change the result shape and does not require models to supply call metadata.

### Provider and model output

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

ModelOptions provides provider-neutral fields such as json, temperature, functions, includeUsage, and maxOutputTokens. The usage receiver is an execution accounting port: it records actual usage before notifying the observer, and observer failure isolation does not affect the usage record.

The Provider contract only passes real call and interaction parameters; it does not decide business authorization. The output token value on a request is called maxOutputTokens; the hard limit in connection configuration is called outputTokenLimit, and the two must not be confused with the default reservation. Provider wire fields such as max_tokens/tools continue to be converted by the adapter.

The model sink and process observation reuse the same CoreEvent envelope. The sink receives model.start, model.output, model.parsed, and model.end on success, failure, or cancellation; the payload is in payload, and the real invocationId isolates calls. model.parsed means the full model value passed parsing and still must wait for delivery and cancellation checks before commit; it is not the App's final reply. model.end uses a separate 250-millisecond wrap-up deadline and still attempts to notify preview withdrawal after cancellation; a failed notification does not overwrite a committed result or the original exception, and consumers must still handle connection loss themselves. Events are discriminated by type, stage references use stageId, and model ordinal uses callSequence (starting at 1). Previews remain transient, and a final value is returned only after complete collection, parsing, budget, and cancellation checks pass.

## AgentCoreEngine and Workflow

### Existing request model service

```ts
const runner = new ModelRunner({ provider, maxCalls: 4, execution });
const agent = new AgentCoreEngine({ workflow }).bindModelRuntime(runner);
await agent.run(state);
```

With bindModel, each run constructs an independent request Runner. With bindModelRuntime and an unbound shared Runner, Engine binds the current execution automatically; runs have independent counts, cancellation and records. An existing request binding or structural service without bind retains its original budget and lifetime, receives no extra budget and cannot run overlappingly. Nodes obtain the call parent and live counts through context.model; forks must explicitly restore their branch model. The canonical invoke/prepare retain the original receiver; the service itself is neither cloned nor frozen.

### Child execution and shared budget

```ts
const child = parent.createChild({
  id: 'app.analysis', maxCalls: 8, reserveCalls: 1, timeoutMs: 60000,
  interactions: specialistTransports, diagnostics: operation.diagnostics,
});
const engine = new AgentCoreEngine({ maxRounds: 8, execution: child.execution });
// 使用同一 Engine／Workflow，App 提供独立 state、app、工具与完成检查。
```

`ModelChildOptions` are explicit child execution settings. A child runner inherits the Provider, per-call limits, token counter, and call observation ports; it does not inherit the parent conversation, journal, output sink, or interaction list. When `interactions` is omitted, the built-in plain-text interaction is used; add specialized interactions as needed. `execution` is a read-only signal/diagnostics pair that can be passed to the Engine and tool registrars. The child signal is bounded by both parent cancellation and the local deadline, and diagnostics use the single child scope of the same run and cannot be swapped for the observation parent of another run.

`maxCalls` is a local limit, and `reserveCalls` is budget left for ancestors. A call atomically deducts from the local and ancestor ledgers before provider I/O, and failures do not refund the attempt; pre-check rejections do not deduct. `remainingCalls` reflects local, total budget, and reservation limits together; `callCount` still counts only this instance, while `totalCallCount` includes child calls. Creating new instances does not expand the whole-request budget.

`children` configures `maxDepth`, `maxConcurrentCalls`, and `maxChildren` for this request family, defaulting to 1, 1, and 32. Depth starts at 0 for the root runner; the total creation count is not returned when subtasks finish. Configuration is fixed when the root is constructed, all descendants share capacity, and each level still keeps its own ancestor wrap-up budget. `ModelChildOptions.signal` can attach additional local cancellation, and parent cancellation propagates to all descendants.

```ts
const parent = new ModelRunner({
  provider, maxCalls: 12,
  children: { maxDepth: 3, maxConcurrentCalls: 2, maxChildren: 16 },
  execution,
});
```

Context nodes share budget through the ordinary model port. The App supplies the role list, permission ports, and result contracts, organizes tasks with Workflow/handlers, and passes the child signal to real tools and wrap-up side effects. To compose bounded parallel tasks, use [Support.runChildren](advanced-agents.en.md#bounded-subtask-composition).

```ts
const agent = new AgentCoreEngine({ workflow, app, tools, maxRounds: 8 });
const result = await agent.run(state);
```

`defineWorkflow` compiles a definition. When the Workflow is known, it can be bound at construction, or bound once during assembly with `bindWorkflow`. A tool runtime instance can likewise be bound through the constructor parameter `tools`, or bound once during assembly with `bindToolRuntime`; both accept the same contract and cannot be bound repeatedly. For complete usage of nodes, routes, models, and tools, see [Workflow primer](workflow.md).

`maxRounds` bounds rounds and defaults to 8. The low-level callback loop is still available through `engine.run(step)`, whose callback receives the round and execution context and returns `StepOutcome`.

`run(step, { signal })` and Workflow's `run(state, { signal })` both combine single-run cancellation with the instance execution.signal and preserve the original cancellation reason. CoreStep calls without a bound Workflow do not accept modelId selection.

A self-orchestrated CoreStep callback should pass the context signal to internal asynchronous operations and check cancellation before side effects. Cancellation stops waiting for the current callback, and late results do not enter subsequent rounds; cancellation cannot forcibly terminate arbitrary JavaScript, nor does it treat an unconfirmed storage commit as rolled back. Apps or Kits holding a transaction or exclusive lock must wait for the already-started storage commit to confirm before releasing resources.

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

run(step) uses StepOutcome and allows undefined as a legitimate completion value. Workflow routes distinguish jumps from completion explicitly through targetNodeId and complete:

```ts
type WorkflowRoute<State, Output, App> =
  | { readonly when?: WorkflowGuard<State, App>; readonly targetNodeId: string }
  | { readonly when?: WorkflowGuard<State, App>; readonly complete: (state: Readonly<State>, context: WorkflowContext<App>) => Output };
```

`WorkflowGuard<State, App>` is the synchronous `(state: Readonly<State>, context: WorkflowContext<App>) => boolean`; a mistakenly returned thenable is rejected. WorkflowDefinition contains id, entryNodeId, read-only nodes, and optional isResult; node references, reachability, and bounded loops are checked at define time. At execution, requires is checked first, then the handler runs, cancellation and provides are checked before the patch is committed, and finally the first matching route is taken. Cancellation and contract errors cannot be turned into business success by onError.

isResult only answers with a boolean; if a resumable business check is needed, the App calls a checker inside a workflow node. Workflow state remains separate from app dependencies.

## ToolRegistry and ToolRuntime

The low-level ToolRegistry in Core can take hand-written ErasedTool implementations; Support's ToolRuntime comes from typed tool catalogs. Both reuse the same real invocation mechanism.

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

The low-level value stays unknown, and the call result still uses the fixed InvocationResult; there is no "type validation" in which the caller self-reports Output. Type inference comes from Support catalogs. The registry implements the shared Catalog surface: get returns undefined for a missing entry, and require throws.

The pipeline is fixed: parse input → registered execution/authorization adapter → await the actual result → parse output → cancellation check → record completion. The low-level execution contract does not require every tool to carry extra business authorization fields; real rules are supplied by the App or by handlers adapted through Support.

The ToolCallRecord in a successful return always has status=success; a failed call throws. ToolExecutionEvent and ModelCallTrace in read-only events distinguish success/error/cancelled and carry the same InvocationMetadata; business check conclusions are recorded separately by the App and do not overwrite call status.

## Journal and diagnostics

[Requests, call chains, events, and Journal](observability.md) defines the complete correlation and storage contracts: per-event records and explicit parent-child keys, where Journal is the run projection of the same execution facts and does not build a second accounting system.

```ts
journal.model({ stageId, value, invocation }): void
journal.beginTool({ toolId, input, invocation? }): string // 返回同一invocationId
journal.finishTool({ invocationId, status, value }): void // success | error | cancelled
journal.snapshot(): readonly ContextRecord[]
createDiagnostics({ output?, runId?, spanId? }): DiagnosticContext
```

invocationId is assigned by the real tool call boundary, and Journal uses the same identity. Cross-run correlation must combine runId; App requestId is correlated separately by the App. A nonexistent call or a duplicate finish is rejected. One real execution nesting Tools Kit/Support/Core allocates only one invocationId, passed down the execution context; executeInvocation and its Journal share the invocationId of that boundary. A genuinely nested tool execution is another child call with an independent ID, correlated to the parent call through parentInvocationId. IDs remain unique across instances.

Low-level execution callbacks and business bindings both return the original business value, and only the public invoke boundary wraps it once; internal compression subcalls use result.value and must not hand the whole envelope to a parser. durationMs covers preparation, execution, parsing, and delivery waiting for the current call, and startedAtMs is recorded when the corresponding boundary starts; callSequence is allocated only to model calls that are actually issued, and pre-check rejections go to rejected diagnostics without fabricating provider calls.

ContextRecord uses type discrimination, producerSequence (starting at 1), stageId/toolId/invocationId, and value. Tool call status is success, error, or cancelled. Tool and workflow diagnostic payloads use known fields and the WorkflowEvent type; model-generated values and App exceptions may be unknown.

The Core fact envelope uses version, eventId, type, occurredAtMs, runId, spanId, parentSpanId, optional invocationId, and payload. Cross-source storage sequence is assigned uniformly by the App run collector, while Core local ordinals use producerSequence. Core, Provider, and Kit each define their own event catalogs.

For complete exports, exact overloads, and declaration sources, see [Public symbol reference](reference.md). Signatures in examples are for reading only; omitted fields cannot be used to infer arbitrary extension options.

### Boundaries of observation and budget

ModelCallTrace contains the required invocationId, startedAtMs, durationMs, callSequence, and stageId; status is success/error/cancelled. Call results, traces, and diagnostics use the same call identity. `model.end` reports only accepted attempts; input/budget pre-check rejections go to runtime.rejected and do not fabricate output when no provider I/O was initiated. An accepted attempt whose collector factory fails still wraps up as error and retains the consumed attempt count.

ModelRunner defaults and error priority are defined by modelRunnerDefaults and the executor; the original BudgetError.code and getErrorInfo.code of a budget error are both BUDGET, and the App can map them to a more specific business message in its own presentation layer. Timeout and cancellation preserve the original exception identity. CallTrace measurement covers preparation, parsing, and delivery waiting for that call; child calls share the total budget, and duration is not an additive cost.

## Request-local allocation revisions

maxCalls is the initial request allocation; maxTotalCalls is the host-authorized ceiling and defaults to maxCalls. A bound ModelRunner exposes callBudget and adjustCallBudget without resetting charged attempts or bypassing ancestor reserves. This changes request-local accounting, not the immutable Provider configuration, deadline or context window. See [resources and recovery](reliability.en.md) for assessment, compression versus partial delivery and recovery contracts.

Model protocols, per-turn options, resources, continuation and lifecycle entries are described in [unified model integration](model-protocols.en.md).

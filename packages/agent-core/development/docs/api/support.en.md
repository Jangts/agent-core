# Support: assembling against shared contracts

[Shared types](types.md) · [Back to home](README.md). Support is used from the root namespace and provides implementations that conform to Core interfaces.

## SchemaAdapter

```ts
Support.defineSchema<Value>({ jsonSchema, parse }): SchemaAdapter<Value>
Support.fromJsonSchema(jsonSchema, { compile, error? }): SchemaAdapter<unknown>
Support.fromParserSchema(schema, { toJsonSchema }): SchemaAdapter<Output>
```

defineSchema accepts an explicit raw schema and parser, copies jsonSchema, and fixes the parser reference and receiver. fromJsonSchema reuses the App's validator/compiler; fromParserSchema connects existing parser libraries such as Zod and does not maintain a second JSON Schema.

Schema compilation, conversion, validation, parsing, and error factories are all synchronous contracts; an unexpected Promise/thenable return immediately throws TypeError and observes the late rejection. `compile` must return a validator function when the adapter is created, and the validator must return a boolean at runtime.

A bare JSON Schema provides no TypeScript business type proof, and fromJsonSchema returns unknown by default; when Value inference is needed, use a parser that returns a validated Value or a typed compiler port, and never pass an arbitrary `<Value>` assertion off as type inference.

All three functions return the same SchemaAdapter structure; the mode is not guessed from whether inputSchema happens to contain parse/jsonSchema fields. The parser is synchronous; asynchronous business reads and authorization belong in the execution handler.

## Tool declarations and catalogs

```ts
interface ToolDefinition<Input, Output, App> {
  readonly id: string;
  readonly kind: string;
  readonly description: string;
  readonly inputSchema: SchemaAdapter<Input>;
  authorize(input: Input, context: OperationContext<App>): MaybePromise<void>;
  execute(input: Input, context: OperationContext<App>): MaybePromise<Output>;
  parseOutput(value: unknown): Output;
}
Support.defineTool<Input, Output, App>(definition): ToolDefinition<Input, Output, App>
Support.defineToolCatalog(definitions): ToolCatalog
```

authorize returns void on approval and throws on rejection. When adapting existing boolean permission functions, evaluate the result inside the callback and throw the App's authorization error. Support fixes methods and receivers at registration and validates the completion value of asynchronous authorization. parseOutput parses the tool execution result.

```ts
catalog.select(toolIds): ToolCatalog<SelectedDefinitions>
catalog.bind({ app, execution }): ToolRuntime
runtime.invoke({ toolId, input }): Promise<ToolResult<InferredOutput>>
```

catalog.tools projects the same jsonSchema from the tool declarations; its capability adapter checks only the raw parameter object and the selection contract, resolve returns `{ toolId, input }`, and input keeps the raw parameters. It does not run the tool's business inputSchema.parse early; the tool parses once in the real invoke before authorization and execution, avoiding repeated runs of transforming parsers. A custom model stage may register its own parsing and resolve, but a converted value must not be passed off again as the tool's raw input.

Catalog implements the shared read-only collection interface. After a static selection, the inferred tool IDs and result types narrow together; dynamic IDs go through the unknown boundary. Context/App do not enter the model schema and cannot be overridden by model parameters.

The return shape is always `{ value, invocation }`, with the actual tool result in value; execute/parseOutput handle only business values and do not construct call receipts themselves.

runtime is created per request; all input, authorize, execute, and output callbacks receive or use the same effective signal. Cancellation, unknown tools, and input or output rejection can never write a success receipt. A static schema description by itself does not prove execution.

The same binding provides asynchronous `invoke` and explicit synchronous `invokeSync`. Both reuse the same Core registry, authorization checks, and receipt recording.

## App capability composition

```ts
Support.defineCapabilityCatalog(definitions, { toolReferences? }): CapabilityCatalog
Support.validateToolReferences(toolIds, references): void
Support.defineRegistrationCatalog(definitions): RegistrationCatalog
```

Modules use id, description, and tools. The primary key of a tools item is id; reference explicitly states requiredToolIds/optionalToolIds. The composed result inherits the shared Catalog operations and provides tools and findToolOwner(toolId); an unknown owner returns undefined.

The composition layer only verifies references and assembly and does not understand the App's business completion or recovery fields. RegistrationCatalog uses a definitions array, and install(app) registers in declaration order under when conditions. Static registration, deployment configurability, and per-request authorization are judged separately; a single enabled flag does not replace all three.

## Model interactions and stages

```ts
Support.createTextInteraction({ id, options? }): ModelInteractionDefinition<string>
Support.createJsonInteraction({ id, outputSchema, options? }): ModelInteractionDefinition<Output>
Support.createModelInteraction({ id, tools, adapter?, options?, requireStrictArguments? }): ModelInteractionDefinition
Support.createStageModelInteraction({ id, tools, stages, adapter?, options? }): ModelInteractionDefinition
```

`createJsonInteraction` is used to generate JSON values that conform to a Schema directly, such as summaries, classification results, or tabular data. `outputSchema` is an ordinary `SchemaAdapter<Output>` containing `jsonSchema` and a synchronous `parse(value)`; it can be provided directly, built with a Support Schema factory, or passed as a stateful class implementation. The parser is called after JSON decoding; declaring a JSON Schema does not replace runtime validation.

```ts
const summary = Support.createJsonInteraction({ id: 'summary', outputSchema: {
  jsonSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false },
  parse(value: unknown) {
    if (!value || typeof value !== 'object' || !('text' in value) || typeof value.text !== 'string') throw new TypeError('需要摘要正文');
    return { text: value.text };
  },
} });
const model = new ModelRunner({ provider, interactions: [summary] });
const result = await model.invoke({ input: '概括资料', interaction: summary });
console.log(result.value.text, result.invocation);
```

The ID keeps its literal type; after registration the original interaction handle or the ID can be used for calls. Each call creates a new collector, and parts accumulate only within that call. Invalid JSON, Schema parser rejection, asynchronous parsers, and function-call parts all propagate as failures and produce no deliverable success value. Input/output/Schema budgets, cancellation, and call limits continue to be enforced by the same Runner.

It requires no capability list and introduces no capability/input envelope; when a model must choose among registered tools, use `createModelInteraction` or `createStageModelInteraction`. The JSON request mode and the JSON value types a provider actually supports are decided by the Provider. Output remains uniformly `{ value, invocation }` and does not become a bare object in JSON mode. `options` accepts only temperature overrides and does not relax Provider and Runner constraints.

tools is a ModelToolSource or a source factory read by stageId. A stages item uses `{ id, toolIds }`. Static sources validate all references at assembly, and dynamic sources refresh when the interaction is prepared for this call. An unknown stage does not invoke a dynamic source and does not extend to other stages.

prepare(stageId) returns the unified collector protocol; a prepared interaction fixes the resolver and receiver for this call, and the next dynamic preparation can obtain a new source. Native and JSON adapters consume the same capability projection. The native adapter validates the object shape, index, ID, name, and argument strings of neutral function-call-delta values; invalid parts do not enter capability execution. The collector's outputChars counting and call metadata reading boundaries follow the [Core interaction contract](core.md). Fallback is chosen explicitly by the App and is not guessed implicitly from model names or URLs.

## Model strategy and budget

```ts
Support.createModelStrategy({ model, models?, reasoning?, reasoningOptions?, budget?, ...coreSettings }): ModelRunnerOptions
```

`model` accepts a model definition or an ID in `models`. `reasoning` selects a configuration explicitly registered in `reasoningOptions`; for example, high/off correspond to a Provider already configured with provider reasoning parameters. Unknown IDs or reasoning schemes raise errors, and model tools are not inferred from names.

The budget defaults to medium. These are overridable local task budgets, not guarantees of provider capacity or performance:

| budget | Scenario | maxCalls | maxInputChars | maxOutputChars | maxOutputTokens | callTimeoutMs |
| --- | --- | --- | --- | --- | --- | --- |
| small | Short task with few calls | 2 | 8000 | 4000 | 512 | 15000 |
| medium | Ordinary multi-step task | 8 | 32000 | 16000 | 1024 | 30000 |
| large | More calls and output space | 16 | 64000 | 32000 | 4096 | 60000 |

Values apply from lowest to highest: the tier, the model definition, the reasoning configuration, exact values in the budget object, and top-level Core settings. Legitimate 0 and Infinity are preserved; an explicit undefined uses the Core default. A budget object uses medium as its baseline. All Core model fields can be passed, and the output is still the same ModelRunnerOptions. A result without a bound execution can be used directly as an Engine's model; request-level execution still belongs to the Engine and cannot be bypassed through a strategy.

```ts
const settings = Support.createModelStrategy({ model: { provider }, budget: 'small', maxCalls: 1 });
const model = new ModelRunner(settings);
```

## Context

```ts
Support.defineContextFragments(definitions, options?): ContextBuilder
Support.defineContextAssembly(definitions, options): ContextBuilder
builder.fragments(input): readonly ContextFragment[]
builder.plan({ input, maxInputChars?, originalFragments?, mutableFragmentIds?, additionalMessages? }): ContextPlan
builder.build({ input, maxInputChars?, originalFragments?, mutableFragmentIds?, additionalMessages? }): BuiltContext
```

- ContextPlan.fragments are unassembled definition fragments; BuiltContext.fragmentUsage is used-amount metadata and must not also be called fragments.
- A fragment uses id, sourceId, trust, lifetime, maxChars, role, and value. Business original text is data and is not promoted to a system instruction.
- Formatting first obtains this call's input, then assembles by declaration order and budget; the current question, authorization conditions, and existing evidence cannot be trimmed at will.
- ContextBuilder has no per-request signal. Selection and compression run as plain Workflow nodes, and their internal calls reuse the Core request budget and signal.

Support strategy modes are `validate | reduce | audit`. `createContextProcessingNode` returns a plain WorkflowNode; when observation and routing must be separate, use `createContextSelectionNode` and `createContextReductionNode`. Core does not schedule by these modes; for concrete run boundaries, see [Context nodes](context-processing.md).

`createContextStrategy` can use `preset: compact | balanced | extended` to generate a target character count at 25%/50%/75% of the fragment hard budget and keep the most recent 1/3/6 groups of original text; exact targetChars and keepGroups take precedence. The ratio expresses only character space, not semantic retention. Without a preset, the fragment hard budget and one group of original-text protection apply. The function can generate a recent-window or continuous-task summary configuration from registered historical fragments. It reuses fragment IDs/budgets, generation step IDs, and handler references; after exact overrides of targetChars, keepGroups, grouping, and selection it still uses the same node contract. The returned policy, compressors, and selectors can be configured directly into a plain processing node. A single strategy can configure the full selection (including model), selectors, compressors, steps, and character/token triggers and target watermarks; explicit steps fully replace generation steps and their dependencies; when steps are given directly, the generation-specific kind, fragment, field, and compressor can be omitted. Default selection is decided by the final step: fixed for a single step, sequence for multiple steps. When an array of strategies is passed, each item generates an operation, shared settings go in the second parameter, and execution defaults to sequential order. Duplicate steps or conflicting handlers are rejected at assembly. Each group defaults to user-turn and the most recent group's complete original text is kept; the numbers come from configuration and complete-round protection and do not promise model performance or summary quality.

The budget can be configured once at assembly. Pass a number for a fixed budget, or `maxInputChars(input)` for a per-request calculation.
Both forms use `builder.build({ input })` or `builder.plan({ input })`, adding a budget only for a single-call override.
If no budget is configured or passed with the request, construction raises an error. `plan` and `build` both accept the additional messages and change-audit fields of the Core ContextPlan; user messages with images participate in the final budget, and build reuses Core auditing and assembly without silently dropping these fields. Processing entry points accept the same character budgets as Core (including Infinity); a zero budget must still pass the final actual usage check. Each processing call first fixes the plan and the contract fields of structured fragments, messages, and images, allows prototype getters, and does not let caller changes to the original plan during asynchronous processing alter an already-determined budget.

## Provider, previews, and streams

`CompatibleModelProvider.stream` also enforces the cancellation contract when used directly: an already-cancelled call sends no HTTP request, and waiting during the request/SSE can be stopped; if a request that ignores cancellation returns late, the adapter releases its unconsumed body. Body cleanup for HTTP or format errors is best-effort and does not overwrite the original classification; diagnostic body capture still has independent size and time limits and releases the reader.

`writeSseFrame` requires `writer.write` to return a boolean synchronously; waiting for drain is protected by the unified cancellation wait. `readSse` checks cancellation before obtaining a reader and between events within a network chunk, and does not deliver buffered late events.

| Interface | Preferred input / semantics |
| --- | --- |
| new CompatibleModelProvider | `{ config, ports?, observe?, errors? }`, where config accepts static configuration or a dynamic reader function |
| createReplyPreviewRules | generates and validates preview rules from actual stage references, capability Schemas, and explicit display eligibility |
| createReplyPreview | `{ rules, sink, render?, maxChars? }`, returning a handler for the model output sink to call |
| streamEvents | `(producer, context)`, where producer must await emit and maintain bounded backpressure |
| readSse | `(body, options)`, with signal and idleTimeoutMs in options, following real interaction constraints |
| encodeSseEvent | raw SSE event structure, preserving external event/data fields |
| writeSseFrame | `({ writer, frame }, context)`, awaiting backpressure and propagating delivery errors |
| scanJsonObjectFrames / parseJsonFrames | stay synchronous; the former only splits, the latter parses and limits the frame count |

modelInteractionCatalog selects a native function or JSON adapter by an explicitly registered interaction ID; the App supplies selection metadata, can override explicitly, and does not infer capability from brand, model name, or URL.

Preview rules use stageId and toolId; previews are transient and cannot authorize, persist, or execute model proposals. ModelOutputEvent goes to the sink and ProviderObservation goes to the observer; they are not mixed.

External SSE/wire types can keep standard fields and are converted at the Support boundary; the protocol itself is not changed to standardize SDK spelling.

The compatible Provider's `requestBody` is for provider extension fields. Model identity, input messages, streaming protocol, and token limits are controlled by the adapter and Core call contracts. Overriding these fields raises an error before the request is sent. To use another request protocol, implement the same `ChatProvider` interface directly.

Completion determination is selected through `ports.completionPolicy` and defaults to `Support.completionPolicyCatalog.default`; whether function parts are accepted, the expected `finish_reason`, and integrity before `[DONE]` are all judged by whether the call declares `functions`, and a stream that ends without a finish marker still ends as `MODEL_INCOMPLETE`. `Support.completionPolicyCatalog.session` judges by the on-the-wire `tool_choice`: `auto` requires every started call to be complete and allows accompanying body text, `required` and a specific function object require at least one complete call, `none` rejects any function part, omitted fields adopt the default completion rules, and unknown values are rejected before sending as configuration errors. A policy only judges whether the response satisfies the request; it does not take over the request loop, interaction protection, or tool execution. Cancellation and interaction failures never become success because of a policy.

`Support.createToolCallCollector` aggregates call parts by index, and the completion policy and direct callers share the same implementation. Conflicting part IDs, duplicate IDs across indices, and incomplete calls are rejected as protocol errors, and one complete call does not mask another incomplete call.

The protocol layer never restricts receiving multiple call parts, and `parallel_tool_calls` is only a send field that expresses neither execution authorization nor scheduling policy. The single-proposal limit on the Agent path is decided by the `nativeFunctionInteraction` collector; using the Provider directly is not subject to that limit and does not thereby gain tool execution, authorization, or loop tools.

`ProviderMessage` provides the `tool` result and assistant `toolCalls` shapes needed for direct connection, and `chatCompletionMessages` maps them explicitly to `tool_call_id` and nested `tool_calls`; mismatched roles or fields and incomplete call fields are rejected as `TypeError`. Only declared fields are sent, and extra fields (including raw wire fields) are not passed through; `toolCallId` must be a non-empty string, and `role` and `content` are validated per the message contract. The Core `ModelMessage` and `ChatProvider` abstract signatures are unchanged.

A direct tool thread uses declared fields, the assistant `content` may be an empty string, and tool results are correlated by the same call ID:

```ts
import { Support } from '@jangts/agent-core';

const messages: Support.ProviderMessage[] = [
  { role: 'user', content: '查询资料' },
  {
    role: 'assistant', content: '',
    toolCalls: [{ id: 'call-1', name: 'lookup', arguments: '{"query":"资料"}' }],
  },
  { role: 'tool', content: '{"found":true}', toolCallId: 'call-1' },
];
const wireMessages = Support.chatCompletionMessages(messages);
// 工具声明映射为 tool_calls，工具结果映射为 tool_call_id。
```

Tool registration, parameter business validation, authorization, and execution are the host's responsibility. `createToolCallCollector.complete()` checks the integrity of call IDs and names and does not parse or validate business argument JSON.

When multiple requests reuse the same Provider, `Support.createProviderObservationScope` can bind the App's own output rules. Assign the returned `observer` to the Provider and, for each request, use `attach(diagnostics, destination)` to associate the log destination. Child scopes inherit the association automatically. The App is responsible for redaction, retention, and write policy, and Provider events are recorded through the existing App log outlets.

## Rejection checks

```ts
Support.breakWhile(occur, error?, tags?): void
Support.breakWhile([
  { occur: () => expired, error: '已过期' },
  { occur: [() => missing, () => invalid], error: '输入不可用' },
]): void
```

`occur` specifies rejection conditions: a truthy value, a lazy predicate, or an array of OR predicates that short-circuit in order; any true item rejects, stopping later predicates and error factories. Multiple check objects also stop at the first rejection in order. ProtocolCheck uses the same `occur` field, and `when` decides whether the check is enabled.

For complete exports, exact overloads, and declaration sources, see [Public symbol reference](reference.md). Signatures in examples are for reading only; omitted fields cannot be used to infer arbitrary extension options.

## Context compression/selection and local callbacks

`createContextCompressor({ id, instruction, interaction, maxOutputTokens, parse })` and `createContextSelector({ id, instruction?, interaction, maxOutputTokens, parse?, maxExcerptChars? })` construct registrable handlers. The main request and their model calls share the same runner, deadline, remaining budget, and parent diagnostic identity:

```ts
compress(request: ContextCompressionCall, context: ExecutionContext)
select(request: ContextSelectionCall, context: ExecutionContext)
request.callModel({ stageId, input, maxOutputTokens, interaction }): Promise<ModelResult<unknown>>
```

request provides stageId and the fragments to compress or candidates to select; the result parser handles only the returned value. Policies reference handlers by handlerId; callModel takes a named request and returns a ModelResult. The cancellation signal is read from the second context. Processing nodes connect these callbacks through the Workflow model port; for original-text protection, history grouping, watermarks, reserved calls, and audit rules, see [Context nodes](context-processing.md).

createReplyPreview uses `{ rules, sink, render?, maxChars? }`; rules use stageId and toolId (native adaptation maps the latter to the function wire name). The sink is awaited in order, and render is synchronous. Rule data is copied as a snapshot and callbacks fix the original receiver; a preview never authorizes or executes tools.

When a selector omits `instruction`, it uses the built-in trimming selection instruction, which requires the model to return `{ stepIds }` and explicitly treats fragment excerpts as data. A custom parser must provide the corresponding instruction as well.

### Explicit reasoning wire policies

CompatibleModelProvider's `config.reasoning` accepts `{ format, level }`. level is off/low/medium/high; format explicitly specifies the field format the provider supports and is not guessed from the model name.

| format | Generated fields |
| --- | --- |
| reasoning-effort | reasoning_effort: none/low/medium/high |
| thinking | thinking.type: disabled/enabled, switch only |
| enable-thinking | enable_thinking: false/true, switch only |
| thinking-budget | thinking.type and budget_tokens; low/medium/high default to 1024/4096/8192, and budgets can override them precisely |
| custom | map(level) returns custom requestBody fields and must be synchronous |

Explicit requestBody fields take precedence over generated fields; neither can override model, messages, stream, or output limits. thinking-budget must reserve space for the answer, and the thinking token count must be less than the actual output limit; otherwise the request is rejected before sending without expanding the Core budget. A mapper with getters or private state keeps its receiver, static configuration is resolved only once, and dynamic configuration is resolved per request.

```ts
const provider = new Support.CompatibleModelProvider({ config: {
  baseUrl, apiKey, model,
  reasoning: { format: 'thinking-budget', level: 'high' },
} });
const settings = Support.createModelStrategy({ model: { provider }, maxOutputTokens: 10000 });
```

JSON value interactions enable `json` mode by default. This mode in CompatibleModelProvider uses `json_object`; when an array or scalar is needed and the provider does not support the corresponding mode, set `json: false` explicitly in the same `options` while keeping full JSON decoding and outputSchema validation.

## Model Tools and demand discovery

`Support.defineModelTools(definitions)` compiles BaseTool declarations. Each has id, description, inputSchema and a synchronous resolve. When resolve is omitted, Support uses the parsed input as the result. ExecutableTool adds authorization, execution and output validation; `defineToolCatalog` derives its model view as `catalog.tools` without requiring a separate capability declaration.

```ts
const tools = Support.defineModelTools([{
  id: 'manage_memo',
  description: 'Process a memo draft',
  inputSchema: memoSchema,
  asIntent: {
    description: 'Remember something or set a reminder',
    when: context => context.features.memos,
  },
  active: context => context.services.memos != null,
  resolve: input => input,
}]);
const discovery = tools.select({ intent: true }, context);
const explicit = tools.select(['manage_memo'], context);
```

`asIntent` accepts true, a nonblank description, a synchronous boolean predicate, or `{ description?, when? }`. Omission means not participating in demand discovery; no static false is needed. Missing description reuses the Tool description. Missing when enables discovery. Allowed next steps belong to DomainTool.delegates, separately from discovery metadata. Intent has no independent identity or registry. Similar descriptions on different tools remain separate.

`active` accepts a boolean or synchronous predicate and defaults to true. Selection filters activation; prepared projections and execution recheck it before accepting or performing work. Activation does not replace authorization. Node code owns candidate selection and can use select({ intent: true }, context) at any stage; Engine does not automatically publish tools based on this metadata.

## Delegates and dispatch

Lifecycle calls use the tool's own `id`. A `lifecycle` declares protocol and hooks without another identity. `registry.call(next, context)` looks up `next.type` in the same tool registry and rechecks activation. Protocol projection, selected hooks and dispatch share that ID. Decisions default to `next.type` or `type`; only custom shapes configure `ToolLifecycleRegistryOptions.toolId`.

DomainTool.delegates is a business constraint listing allowed tool IDs or terminal output protocol IDs, without another tool declaration or an execution order.

```ts
const linked = Support.defineAssociatedCatalog(owners, {
  tools: independentTools,
  toolDefaults: owner => existingTools.require(owner.id),
});
// owner.modelTools: an array of inline Tool overrides or independent Tool IDs.
// linked.tools: normalized model Tool catalog.
// linked.bindings: owner ID -> toolIds.
// linked.sources: local provenance; not automatically sent to the model.
```

References name explicitly declared independent tools, never a tool accidentally contributed by another owner. Duplicate identities, repeated references and missing contracts are rejected. An empty modelTools array suppresses default projection. Tool descriptions are not aggregated into Intent entities. Decorator conversion does not accept parallel asIntent configuration: combine WorkflowTool and a separate Intent decorator on the same target. See [the complete runnable comparison](configuration-in-workflow.en.md).

Executable declarations share model metadata but do not configure a custom `resolve`. Their model projection always proposes `{ toolId, input }` with raw arguments; parsing occurs once at execution. Use a separate model tool for custom synchronous mapping.

`select(ids, context?)` and `select({ intent: true }, context)` reuse immutable entries. Empty selections are valid. Without context, selection excludes `active: false` but retains predicates without evaluating them. Pass context to filter and recheck predicates when resolving proposals. `bind({ app })` applies that App context to its model view. Execution rechecks activation and authorization.

A single model tool response returns `DecodedModelToolResponse` / `DecodedModelResponseToolCall`: wire names and JSON objects are decoded, not schema-validated, resolved, authorized or executed. For model mapping, pass the proposal through the selected source's `resolve`; for executable tools, invoke the bound runtime with raw arguments. Unknown tools have no decoded `input`.

## Candidates, envelopes and tool responses

Use `catalog.select({ intent: true, include: continuationIds }, context)` for demand entry points plus explicit continuations. It uses the same activation, immutable projection and description rules as `select(ids, context)`.

`Support.defineSchema({ jsonSchema, tools: candidates.tools, parse })` derives the name/input envelope's name enum, parameter-schema branches and required fields from the selected tools, and rejects unselected names before invoking the command parser. It never runs business input parsers early or replaces authorization.

`Support.createModelInteraction({ id, response: 'tools', tools: runtime.tools })` returns prose and decoded calls; omit response for the normal single-selection result. A session may have an empty tool source and answer directly. Pass each decoded call to `await runtime.invoke(call)` in the App's required order. Unknown names and invalid JSON cannot execute; valid calls retain input parsing, authorization, cancellation and real receipts. The App continues to own dependency ordering and result presentation.

domainToolDelegates derives allowed next steps from tool domainToolIds and terminal protocols. Explicit delegates are a closed allowed set; omission derives choices from associated tools. Request views exclude missing protocols and inactive tools.

Model protocols, per-turn options, resources, continuation and lifecycle entries are described in [unified model integration](model-protocols.en.md).

## Reply guidance resolution

`Support.resolveReplyGuidance({ defaults?, node?, tools?, call? })` copies and freezes trusted `ReplyGuidance` selected by the App. Precedence is defaults < node < applicable tools < call; conflicting tool defaults require an explicit call choice. All supplied values are validated, including overridden defaults. With no values it returns undefined. It never scans registrations or promotes tool descriptions, tool results or user text into instructions. Pass its result as `replyGuidance` on a Runner or workflow model call. See [reply organization](../../articles/reply-organization.en.md) for the complete example and richer style/reference guidance.

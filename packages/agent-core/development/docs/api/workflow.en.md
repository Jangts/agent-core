# Workflow primer

Use `defineWorkflow` to declare plain nodes. When the entry is omitted, execution starts from the first node and counts as the first round.

```js
const agent = new AgentCoreEngine({ workflow });
agent.bindToolRuntime(tools);
const result = await agent.run({ name: '演示服务' });
```

The constructor may omit `workflow`, which can be bound once later with `agent.bindWorkflow(workflow)`.
`bindModel` and `bindToolRuntime` likewise each bind one dependency. A tool catalog registers
multiple tools with `register` or `registerAll`.

In a plain node's `run`, call bound tools with `tools.invoke({ toolId, input })`.
Core records the call with the current node's diagnostics, and the node updates state with the returned value.

Use an ordinary mutable object for workflow state. The engine checks `provides` and every write target before applying the returned update. State fields written by the update must be writable data properties, and adding a field requires an extensible object. An invalid write raises `WorkflowContractError`, leaves the entire update unapplied, and bypasses `onErrorNodeId`.

When a model is needed, you can construct `new AgentCoreEngine({ workflow, model: { provider, maxCalls } })` directly,
or omit the model and bind it once later with `agent.bindModel({ provider, maxCalls })`.
Nodes still call `model.invoke({ input })`. The Runner is created when the model is first used in this run,
and later nodes share that call budget. The Loop connects both models and tools to the current node's diagnostics.

`agent.switchModel({ provider, maxCalls })` replaces the model configuration for later runs.
Runs that have already started continue with the configuration and budget from startup. The Workflow stays bound once.

Installing a model fixes the canonical callbacks, the definition corresponding to the original transport object, and the pure budget configuration; each run still creates its own call budget and collectors. The App service instance is not frozen as a whole, and the original methods can still read dynamic state inside the service. Context policies are registered by plain nodes, and Core does not schedule them implicitly.

`agent.bindModelRuntime(runner)` attaches an existing Runner; nodes continue using `context.model.invoke`/`prepare`. Engine binds an unbound shared Runner to each run execution automatically, allowing independent runs. A request-bound Runner or structural service without bind retains its budget, cancellation and observation lifetime, rejects overlapping runs and receives no extra budget through reuse. Forks explicitly restore their branch model. Static bindModel instead constructs a new Runner per run. See [Existing request model service](core.en.md#existing-request-model-service).

`context.tools.invoke` merges the single-run signal with the Workflow signal. Local cancellation terminates only that tool call and cannot replace or extend the Workflow deadline.

The merged signal is checked uniformly at Engine call boundaries and used to stop waiting; hand-written ToolBinding and ToolRegistry receive the same guarantee. A late return cannot become a success result, and cancellation of real side effects and receipts remain the App's responsibility.

To add a node and wire its routes into an existing flow, use `workflow.add({ nodes, routes })`.
It validates the new nodes and wiring in one step and returns a new definition. You can also pass another Workflow and then the wiring routes.
To use the new definition independently, register it with a new Agent. When an existing business instance needs to reuse the assembly, derive an instance.

```js
const at = agent.snapshot({ conversationId, revision });
const upgraded = agent.fork({
  at,
  workflow: extension,
  resume: snapshot => restoreBranchDependencies(snapshot),
});
const result = await upgraded.run({ name: '演示服务' });
```

[Complete offline service Q&A example](../examples/offline-agent.md) shows the basic combination of tool and model nodes; Workflow derivation follows the add/fork contracts above.

A checkpoint keeps a copy of data supplied by the host. A derived instance continues the Agent identity and receives a new branch and revision identity.
`resume` restores dependencies for the new branch from the checkpoint. Request-level App objects and tool runtimes must be restored separately,
while fixed model configuration can be reused. Each run has its own `workflowInvocationId`.
`exportSnapshot(at)` returns a serializable data copy and the complete branch identity. After the App saves the record, it can rebind dependencies with `new AgentCoreEngine({ branch: record.source, workflow, app })` and then call `restoreSnapshot(record)`; the branch identity must match exactly. A data record carries no executable functions, tool instances, or valid authorization. For persisted revisions, merging, and explicit enablement, see [BranchVersions](advanced-agents.en.md#durable-branches-and-explicit-promotion).

`fork` inherits the original Workflow by default. When `workflow` is passed, it internally calls `add` on the original Workflow to complete composition and validation. When creating a standalone instance, call `baseWorkflow.add(extension)` directly.

## Using multiple configured models

With a single model, keep using `{ workflow, model }`. When multiple models are needed, register the configurations in the constructor:

```js
const agent = new AgentCoreEngine({
  workflow,
  models: { fast, reasoning },
  model: 'fast',
  maxModelCalls: 4,
});

await agent.run(input);
await agent.run(nextInput, { modelId: 'reasoning' });
```

A node can inherit the run's default model with `model.invoke({ input })`, or select another configuration within the same run
with `model.invoke({ modelId: 'reasoning', input })`. Selection order is the ID specified by the node call, the ID specified by the request, then the instance default ID. With a single registration the default ID can be omitted.
With multiple registrations and `model` omitted, calls must provide an ID. A model ID passed at construction must exist in `models`.

`agent.switchModel('reasoning')` changes the default for later runs. Each model keeps its own call limit, and
with `maxModelCalls` configured it is also bounded by the total limit of the same run. Counts are separate per run.

## Single equality routes

`route.toIfEqual(target, path, value, options?)` generates a plain jump route using strict equality.
The same state query branch looks as follows before and after.

```js
// 手写
{ id: 'to-service', conditionId: 'intent.status',
  when: state => state.intent === 'status', targetNodeId: 'service' }

// 使用 route
route.toIfEqual('service', 'intent', 'status', {
  id: 'to-service', conditionId: 'intent.status',
})
```

The fourth parameter can be omitted or used to add `description`. Generated routes can sit in the same `routes` array as hand-written conditions, completion routes,
and fallback routes, reusing existing validation and diagnostics.

For ordinary literal values, a stable ID is generated when identifiers are omitted. `id` is derived from the field, value, and target node.
`conditionId` is expanded at registration from the source node ID and the final route ID. Both can be overridden independently. Object references or Symbol conditions can have identifiers supplied explicitly.
Automatic identifiers include the condition value, so if the value is private data, supply both log identifiers explicitly.

When route `id` values collide within a node, the first keeps its value and later ones receive `~2`, `~3`, and so on in order, skipping existing IDs. Hand-written and generated routes share this rule.

Paths support dot-separated fields. Array indices also use dot form, such as `aaa.0.bbb`. For example, `route.toIfEqual('deliver', 'decision.type', 'reply')`.
To compare two state values, use `route.toIfEqualWith('deliver', 'decision.id', 'expected.id')`.
A missing path reads as `undefined`, and comparison still uses strict equality, so two missing paths also match.

### Unconditional jumps

`route('repair')` and `route.to('repair')` are the same unconditional jump generator and produce `{ id: 'to-repair', targetNodeId: 'repair' }`.
To keep a custom identifier, pass `route.to('repair', 'retry-repair')`.

### Conditional jumps

`route.toIfDefined('failure', 'error', { conditionId: 'review.to-failure' })`
jumps when the field value is not `undefined`, with a default route ID of `to-failure`.
To handle an error already recorded in state, use `route.toIfError('failure', { conditionId: 'review.to-failure' })` directly.

By default it reads the state `error` field. To use another field, pass `route.toIfError('failure', { errorKey: 'reviewError' })`.

When the field and target node share a name, use `route.toIf('recovered')`. It jumps only when the field is truthy.

`route.toIfNotEmpty('candidate', 'candidates')` jumps when the state array has elements; it does not match when the path is missing or the array is empty. Field paths support dot form such as `result.items` and `groups.0.items`, and the `errorKey` of `toIfDefined` and `toIfError` uses the same path reading.
`route.to*` usually omits the route ID. Existing methods conventionally generate `to-${target}` from the target.

### Delivery routes

- `route.deliver('result', { id })` delivers the required result on reaching the terminal; a missing result throws a contract error.
- `route.deliverIfReady('result', { id, conditionId })` delivers when a result exists, otherwise it continues to the next route. Only `undefined` means missing.
- `route.deliverWhenComplete('outcome', { id, conditionId })` consumes the SDK's `StepOutcome`. It delivers the `value` on completion and evaluates the next route when continuing.

When the same `StepOutcome` must be checked and unwrapped, the generator preserves the same plain route contract:

```js
// 手写普通路由
{
  id: 'complete',
  conditionId: 'dispatch.complete',
  when: state => state.outcome?.type === 'complete',
  complete: state => {
    const outcome = requireWorkflowValue(state, 'outcome');
    if (outcome.type !== 'complete') throw new TypeError('Expected a complete outcome');
    return outcome.value;
  },
}

// 使用路由生成器
route.deliverWhenComplete('outcome', {
  id: 'complete',
  conditionId: 'dispatch.complete',
})
```

Each `route.xxx()` method returns a plain route;
the `routes` array determines order, and `defineWorkflow` validates it uniformly.

`conditionId` supports `{nid}` and `{rid}`. At Workflow registration they are replaced with the source node ID and the final route ID,
the latter including any automatic de-duplication suffix. Hand-written routes can use `conditionId: '{nid}.{rid}'` directly.
Existing conditional jump generators generally use this template, and an explicitly passed `conditionId` takes precedence.

Delivery generators use `complete` as the default route ID. Conditional routes use `{nid}.{rid}` as the default condition ID,
so calls that follow these names can omit the entire options object. To customize identifiers, override them explicitly.

Hand-written routes may omit log identifiers. Workflow preserves omitted `id` and `conditionId`,
and resolves only explicitly provided placeholders. When `{rid}` is referenced, the route must provide an ID.

Route generators each decide their output defaults. The naming conventions of existing methods follow. `route.to` uses `to-${target}`,
delivery generators use `complete`, and equality jumps derive from field, value, and target. Generators may define their own naming.
Workflow uniformly handles identifier collisions and placeholders in existing configuration, and missing identifiers remain empty.

## Node reports

The Loop automatically records node entry, jumps, completion, and exceptions. When a node needs to add business details, it can provide
`report(update, context)` in its definition, returning `{ usedModel, payload }`, where every field is optional. Sub-logs use the execution-bound `context.createStepRecorder()`; write/fix commit immediately without returning or submitting the instance. This completion callback is called only when diagnostics allow content, and it reads a copy of the state update; a `usedModel` that must be retained in metadata mode should be submitted during the run through `context.report`.
The Loop attaches this supplementary information to the node's completion or jump record. If reporting fails, the original node event is still recorded.

`model.invoke` in a node also accepts a registered structured interaction object. `model.invoke({ input, transport })`
infers the output type from the object contract, and the same field also accepts an ID reference. Both forms share the node's diagnostics and request budget.

### Reports during node execution

`run(state, context)` can call `context.report({ usedModel, payload })` to report progress. usedModel is optional boolean metadata about this node itself and remains unknown when not reported; payload is read only when content is allowed. `context.createStepRecorder()` returns the unique logger for this execution; write/fix commit automatically and readAll is a read-only query for any holder. write records the intent first and returns an ID, fix adds later results, and readAll returns an immutable snapshot in a fixed format; writes and completions reuse the existing node.progress, and a short circuit or throw still preserves the start record already sent. Reports do not submit business state and do not determine routing; the Loop adds node identity, time, and event ordinal. After cancellation or node completion, the detached logger returns write=-1 and fix=false without throwing; readAll remains readable. The node's `report(update, context)` at completion continues to serve supplementary reporting when content is allowed. For the contract, see [Child log instances](observability.en.md#reported-step-recorders-and-append-only-updates).

## Node caches

Engine option `cache: { maxEntries: 1024, ttlMs: 60000 }` configures bounded instance-local LRU memory. Capacity defaults to 1024 across all partitions; omitted TTL means no time-based expiry. Expiry is lazy and measured from writes. Values retain identity, including undefined; has distinguishes a stored undefined from a miss. delete returns a boolean; set and clear return void.

context.cache belongs to the current node. Only get(key, { nodeId }) may read another partition. Other operations only address the current partition, and clear never clears the entire Engine. Low-level run(step) uses `$step`. Runs on one Engine share memory; forks preserve bounds but start with empty memory.

Optional Engine option agentCache accepts an AgentCachePort. context.agentCache exposes asynchronous get/has/set/delete/clear, or is absent when no port is supplied. The App receives immutable addresses with nodeId, key, persistence and signal; clear receives an address without key. Port callbacks retain their receiver. Cancellation is checked before dispatch and after completion; it does not roll back an App write already started.

Persistence defaults to false. Passing true requires supportsPersistence: true; otherwise the call rejects. Volatile and persistent spaces are independent, with no fallback or mirroring. The App owns capacity, TTL, serialization, user isolation and storage. Cache partitions are not authorization boundaries. Fork resume may explicitly return agentCache to restore a borrowed port; it is never inherited implicitly. Cache data is not checkpoint state or durable business evidence, and captured views must not be used after cancellation.

## Developer aids: workflow graphs and execution chains

These readonly exports do not participate in Agent scheduling or business execution. `toGraph()` exports registered topology; `toTrace(runId)` aggregates observed main-node visits and retains ordered subflow records. See [Workflow graphs and run traces](workflow-views.en.md) for fields, sources, coverage and consumer responsibilities.

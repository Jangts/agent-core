# Other optional Kits

[Shared types](types.md) · [Back to home](README.md). Each Kit is imported by named function／constructor from its own subpath, with static declarations separated from the per-run context.

## Domain Tools, Scope, Interaction, Tools

DomainToolRegistry registers ModelTool-derived DomainTool declarations, preserving scope/target policies and task constraints. DomainTool.delegates declares explicit allowed next steps; delegates are optional allowed sets, not a sequence. There is no independent Intent entity or Intent ID. Scope domainToolIds reference actual Tool IDs. Import the optional registry helpers from `@jangts/agent-core/kits/domains`.

| Capability | Preferred interface／key contract |
| --- | --- |
| DomainToolRegistry | Defines the primary key id, uses scopeMode/targetMode, implements the shared Registry contract |
| ScopeRegistry | id, domainToolIds, toolIds, queryScopeIds, knowledgeTopicIds; aliases are retained, and query methods use scopeId |
| defineAgentCatalog | Projects relationships from actual registrations; the current task is `{ domainToolId, scopeId? }`, and scope cannot be used for both policy and reference |
| defineInteractionProtocol | One commands declaration compiles the protocol; commandField is owned by the App, which is not forced to name its wire field type or kind |
| defineCommandCatalog | The closed commands set may be written as a Record; the public definitions are an array, and toRecord() is the explicit mapping |
| bindInteraction | Aligns protocol with named handlers; dispatch(input, context) never executes unregistered commands |
| ToolLifecycleRegistry | Actual execution delegates to Core tools; assertDecision checks decisions, authorize returns void on approval and throws on rejection |

Registrar declarations and query results use the same set of fields. ID lists use ids(), naming rules use idPattern, and custom assertions use assertDefinition. Scope aliases are business-name references resolved by normalize.

When the complete list is available at construction time, use DomainToolRegistry.create(definitions, policy) or ScopeRegistry.create(definitions, policy) to build and seal the catalog at once. When staged assembly is needed, use new Registry(policy).registerAll(definitions).seal(); both follow the same registration contract.

InteractionProtocol and CommandCatalog are public constructors; Interaction and Interaction.Commands provide their namespace entries respectively.

The Tools Kit preserves the real order: global check → authorization → resume/execute → completion → finalize. Each tool declares one lifecycle block: hooks such as inspect and finalize run for every tool, while protocol/call and authorize/resume/complete run only for the selected tool. The receiver field is called receiver and is not conflated with OutputField.owner; the in-request journal reuses the invocationId allocated by Core.

## Evidence and Retrieval

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

EvidenceRequirement describes a requirement, not an existing resource; it cannot be merged with ArtifactReference permissions just because both contain an ID. Projection keeps the current evidence boundary for no selection, unknown selection, and complete candidates.

Retrieval definitions use assertInput, authorize, execute, assertResult, and named effects. RetrievalSource.sourceId is the reference identifier for this request and may coexist with the material entity's own id; it is not another spelling of an entity primary key. Receipt uses startedAtMs, and retrieval counts use queryCount. Definitions must not bind request state; state/budget come from this run's context.app, and errors.duplicate/budget declare rejection reasons centrally. Synchronous runs stay synchronous, and an accidental Promise return is explicitly rejected.

Retrieval provides run(input, OperationContext); assertInput in the definition is a required assertion, result assertions use assertResult, and error factories live in errors.duplicate／errors.budget. limit and queryCount must be non-negative safe integers, and a quota of 0 does not start any read. Deduplication takes priority over budget; a rejected authorization makes no reservation, and a failed read retains the seen key. Cancellation is checked again before submitting evidence after source binding completes; once submitted, effects run in order, and cancellation or failure stops subsequent items without fabricating a rollback.

`retrievalQueryKey` accepts null, booleans, strings, finite numbers, dense arrays and plain data objects. Object key order does not change identity; array order does. Dates, custom objects, cycles, sparse arrays, functions, symbols, non-finite numbers and undefined at any depth are rejected. Normalize optional conditions in App prepare into the query actually executed, rather than dropping conditions only for deduplication.

## Policies, Normalization, Delivery, Candidates

| Kit | Preferred creation and execution | Termination／error semantics |
| --- | --- | --- |
| Policies | definePolicySet; assess(input) | Reports all matching reasons, not just the first hit |
| Recovery | defineRecoveryChain; tryRecover(input) | The first explicit takeover; errors must not be swallowed accidentally; use an explicit handled flag when the final value may be undefined |
| Normalization | defineNormalization; normalize(input, context) | Sequential transformation, when conditions, and isComplete decisions; preserves 0/false/empty string |
| Delivery | defineDelivery; deliver(input, context) | Stage hooks interleaved with handlers; explicit continue/complete, supports legitimate undefined final values |
| Candidates | defineCandidateSelection; parse({ value, allowed }) | minCandidates/maxCandidates; order and count are constrained by real declarations |

In candidate parsing, value is the value to parse and allowed indicates whether this task permits a candidate envelope. maxCandidates must be configured explicitly, and minCandidates defaults to 1 when omitted; an ordinary single value still returns a single-element array, new candidates cannot be submitted after the task has taken over, and candidates cannot be nested.

Delivery stages use id; beforeStage receives { stageId, state } and OperationContext, and handle receives state and the same context. deliver's second argument provides the real signal and optional diagnostics, and cancellation is checked on entering a stage and before and after each handler; synchronous hooks or handlers do not accept Promises. ContentProjection uses named requests, and TreeProjection uses visit traversal.

Each policy definition uses id, description, when, and a named handler. An ordinary single condition does not need to become a stage class; sequential pipelines, first-match, merging, and rejection checks remain distinct flows.

## Projection, Aggregation, TextSkills

| Kit | Shared contract |
| --- | --- |
| ContentProjection | defineContentProjection; project({ value, maxChars }) returns `{ text, truncated }`; fallback text must also satisfy the budget, and is rejected if it cannot; data cannot be fabricated |
| TreeProjection | defineTreeProjection; visit(input, context), with explicit synchronous semantics for maxDepth and omit |
| QueryAggregation | defineQueryAggregation; collect(inputs, context), preserving serial order, deduplication keys, overrides, and counting basis |
| TextSkills | defineTextSkillLoader; load(input, context), with real file reads provided by an App port |

A TextSkill definition uses id, entry, toolIds, and kind=text-workflow. Catalog entry structure is separated from body description, and IDs and tool references come from the same registration source.

TextSkillLoader accepts load({ entries }, { read }). Registration ID, path, tool reference, and duplicate checks precede reading the corresponding file, and both read and custom parsers must be synchronous. The read port, registration entries, and error factory may be implemented by a class, and prototype getters and original method receivers are preserved. App-owned fields in tool receipts are projected explicitly by the App.

`aggregateBranchResults({ branches, results })` inspects complete outcomes in declared branch order. It returns accepted and a patch only when every branch succeeds with disjoint top-level writes. Repeated keys conflict even for equal values; failures retain successful outcomes without a commit patch. It neither starts tasks nor commits parent state. The caller owns independent inputs, cancellation, authorization and actual acceptance. See the [parallel example](../../examples/harness-parallel.en.md).

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

`split` only processes decoded plain text: headings and horizontal rules start a new block, blank lines end the current one, and other lines break at line boundaries once `targetChars` would be exceeded. A single over-long line stays one block so paging can cut it into fragments later without turning one line into unrelated sections. Blocks reassemble into the original text exactly, including whitespace and CRLF; `number` starts at 1 and `start`／`end` are UTF-16 offsets in the source. `targetChars` must be a positive integer, and empty text returns an empty array.

The Kit does not read files, page, call models or touch storage; paging windows, indexing, summaries and prompts remain App decisions. Block boundaries follow structure rather than a fixed character window, so use `start`／`end` when reporting coverage.

## TextSearch, VectorSearch, RRF, ModelCalls

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

TextSearch's payload is still a `Partial<Document>` of the declared stored fields, while VectorSearch may return full documents; the unified document field does not mean full-text data has been read. Extra terms/contributions extend each algorithm. The three scores are not the same confidence, and RRF cannot mix raw scores directly.

TextSearch copies only the declared index and stored fields; input originals, filter callbacks, and returned results do not share nested metadata. VectorSearch's filter and grouping callbacks each receive an independent document copy; modifying these copies does not rewrite the index or affect the other callback. Index metadata must be structuredClone-able, and vectors must supply a numeric value for every dimension; sparse arrays are rejected.

`TextSearch.upsert(document)` runs the custom tokenizer for every supplied indexed field before writing to the index. If tokenization throws or returns invalid terms, the index retains its prior contents and the App can retry with corrected input.

TextSearch.snapshot() returns version=2, engine, configurationFingerprint, and serializedIndex; restore accepts version=2. Both the fingerprint and public constructor parameters use indexRevision／storedFields. remove waits for index vacuum before returning, ensuring deleted content does not remain in the next serialization.

```ts
new ModelCalls(bindings)
models.invoke({ modelId, input, timeoutMs }, context): Promise<ModelResult<Output>>
```

Bindings use id, identity, invoke, assertInput/assertOutput. Binding callbacks return business values, and the ModelCalls public boundary wraps them as `{ value, invocation }`. id is the registration key and identity is the actual model identity; context.signal and timeoutMs together constrain external I/O. Heterogeneous models infer I/O from the registration ID, while dynamic IDs stay unknown.

After input validation passes, ModelCalls hands over to invoke in the current call stack without queueing an extra microtask. Arbitrary App inputs may retain class instances and prototypes; if a handler uses mutable data across an await, that handler must explicitly snapshot the required fields.

```ts
const attemptBudget = new AttemptBudget(2);
await models.invoke({ modelId, input, timeoutMs: 1000 }, { signal, attemptBudget });
```

attemptBudget is the optional call-attempt port for the current request and may directly use Core's AttemptBudget. Resolution／pre-cancellation does not consume quota; an actually accepted attempt atomically takes one before I/O and is not refunded on failure. A batch call still counts as one, while vector entries, tokens, and chat call counts are defined and metered by the App; without a budget passed in, one must not claim that external inference is subject to a unified quota. Reusing the model catalog does not automatically create a business quota for user Q&A. Upstream and downstream bindings may pass the same budget port; Core does not build in providers, model roles, or cross-business total quotas.

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

resolverId points to the registered resolver and artifactId points to the resource; the two do not reuse the ambiguous id/kind. The Resolver is responsible for validating real accounts, existence, revision, and lifecycle; additional URL／path fields do not select the actual resource. Cancellation interrupts waiting and consumes late rejections, but does not prove that external reads have stopped.

The execution entry accepts ArtifactReference and OperationContext. Implementations may carry their own extra members, while execution reads the fields defined by the interface.

## Durable

A step with `replayPolicy: 'reconcile'` must provide its handler at registration; missing confirmation support rejects construction before the first side effect. Cancelled records still require current read authorization before refusing continuation. A running checkpoint must have a registered attempt for the current step.

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

Steps declare id, replayPolicy, run and optional reconcile. run(state, context) returns a complete State; reconcile(state, context) returns the explicit union above, never a plain State. Handlers keep state first and execution context second. The App supplies storage, identity, permissions, retention and serialization validation; the SDK installs no default database or automatic scheduler.

Choose the policy from the side effect: safe requires an operation that tolerates replay; reconcile handles an operation that may already have taken effect and rejects recovery without its confirmation handler. Reconciliation reads actual receipts; it must not repeat the operation, call a model or compensate.

| Confirmation | Behavior |
| --- | --- |
| completed | Validate and save state, then advance; spend no new execution attempt or model reservation |
| not-executed | Save ready, then check execution authorization, deadline, attempts and model allowance before a new attempt; never refund old reservations |
| unknown | Retain position and allowance, then reject with code DURABLE_UNRESOLVED; do not retry automatically |

A temporarily absent remote record is not proof of not-executed: use unknown while an old call could still take effect, or require stable negative evidence from external idempotency or exclusion. Exceptions, malformed results and invalid state do not advance the task.

Every run/reconcile context provides taskId, stepId, stable operationId and cumulative attemptCount. operationId identifies the definition, revision, task and step across attempts; hosts must not reuse a taskId for unrelated work. Reconciliation receives maxModelCalls=0; execution receives its configured durable reservation, which the App binds to the actual Runner. This field is not a sandbox: the host must separately bound permissions and costs of confirmation ports.

Authorization context.operation distinguishes execute, reconcile and read. Execute authorization precedes actual work; interrupted operations first authorize reconciliation; completed records authorize reads before returning a detached copy. Historical write permission grants no automatic read permission. Authorization returns void and rejects by throwing.

Saved completed results remain readable after execution deadlineAtMs; read-only reconciliation also remains available after execution time or allowance is exhausted. Queries use the current call's signal, with App-defined timeout and retention. Any subsequent execution still passes the original deadline and allowance checks: confirmation does not extend time or reset spending. Missing tasks are rejected, never auto-created.

DurableStore provides exclusive(taskId, operation), load(taskId) and save(taskId, checkpoint). Checkpoints retain version=2 with definitionId, revision, nextStepIndex, attemptCount, maxAttempts, deadlineAtMs, status, state and optional modelBudget/commitId. Older v2 records may omit commitId; new saves generate a unique one, and a supplied value must be a nonempty string. Other formats are rejected without silent migration. Status belongs to this Kit, not to every Core App.

Save running, attempt count and a conservative reservation before execution. Save the complete next state and position before confirming completion. If a save acknowledgement is lost, read back under the same lock and accept only a structurally checked record with this save's commitId. Unconfirmed saves preserve the original error without blindly repeating work. Commit identity does not replace atomic storage or real exclusion. An already-started save and its confirmation read-back settle before lock release; cancellation cannot pretend to withdraw a committed write.

Cancellation/timeouts stop waiting and result acceptance, not necessarily remote side effects. The App records explicit durable cancelled; the Kit does not permanently cancel a task merely because an HTTP connection or ordinary signal ends. Cancelled tasks refuse recovery; uncertain remote effects still require separate App queries. Inputs and accepted state use copies, with handler diagnostics associated with the current Loop child scope.

Full exports, exact signatures and declaration sources are in the [public symbol reference](reference.en.md). Omitted fields in illustrative signatures do not imply arbitrary extra options.


## Waiting

For multi-agent inspection, coverage, admission and decision association, see [Result review and decisions](result-review.en.md). Inspection alone needs no waiting or persistent storage.

Import `defineWaitGate` from `@jangts/agent-core/kits/waiting`. This optional App-side component neither suspends the JavaScript stack nor schedules the parent workflow.

```ts
const gate = defineWaitGate({ id, revision, isAnswer, authorize }, { store });
const record = await gate.open({ identity: { taskId, waitId, subject }, expiresAtMs }, context);
const answered = await gate.respond({ identity, submissionId, answer }, context);
const current = await gate.read(identity, context);
await gate.cancel(identity, context);
```

The App store supplies `exclusive/load/save`; all writers share that exclusive scope. Definition identity and revision are bound once. Every operation rechecks current authorization; subject text is an identity reference, never a grant. Pending is a normal result: the App releases its request and later continues at an explicit boundary. The local pending/resolved/cancelled states are not Core states.

Responses must match the current waitId, subject and definition. Expired, stale and conflicting submissions reject. The same submissionId and JSON answer are idempotent; confirmed results remain readable after the original deadline under current authorization. Rotating a terminal slot requires explicit previousWaitId; pending slots cannot be replaced. Apps must never reuse waitIds; no unbounded historical deduplication is promised. JSON data rejects getters, symbols, classes, sparse arrays and cycles, and crosses read/write boundaries as detached copies.

Apps own real identity, atomic persistence, query lifetimes, cancellation policy and resource reconstruction. Cancelling a gate does not roll back an external tool operation. See the [cross-process waiting and saving example](../../examples/harness-durable.en.md).

## Intentional differences of local protocols and pure algorithms

PolicySet／RecoveryChain provide definitions/ids/values/entries/has/get/require and operate directly on caller input. Pure predicates／recovery chains do not need an execution signal; the second Context of Normalization, TreeProjection, and Aggregation is the algorithm context declared by the caller and has no external execution lifecycle. Reads, tool execution, and durable tasks use OperationContext.

Interaction protocol receivers and handlers both plug in as interfaces, so standalone objects or class instances need no conversion to plain objects. bindInteraction fixes the command handling function and the original receiver at binding time; private state and prototype methods remain effective. Selection errors and envelope callbacks provided by the protocol class also preserve the original receiver.

Interaction's ProtocolField uses jsonSchema; a compiled command exposes inputJsonSchema (complete required fields), modelJsonSchema (the projection the model may submit), and fieldSchemas (per-field descriptions), while assert performs assertions and parse performs conversion. when must be a synchronous boolean; occur is a synchronous rejection predicate or an OR array of predicates. refine returns void and format returns the converted value; all callbacks fix the original method and original receiver.

ToolLifecycle's composition selects a structured template provider and preserves its existing falsey-rejection semantics without treating it as an arbitrary generic final value; control protocols in Delivery, Recovery, and AnswerFlow that may legitimately return undefined must be discriminated explicitly. Other synchronous hooks reject thenables, and authorize/inspect must return void. Bound execution signal and diagnostics are passed down through the real call context.

Every RRF input ranking and contribution detail uses sourceId. The filter in Text/VectorSearch is provided by the App and must return a boolean synchronously. VectorSearch.upsert uses { document, vector }, and search uses named requests. Both hits use document, with score semantics being lexical weight and cosine similarity respectively; RRF only fuses ranks and cannot compare their scores directly.

ModelCalls bindings use assertInput／assertOutput to check input and output. timeoutMs must be a safe integer from 1 to 2147483647, and illegal values are rejected before the call.

DurableTask's second construction options may bind store and now; run's named request may provide a store for this run. `authorize` checks the current identity, source revision, and authorization on every resume and before returning a completed result.

A Checkpoint may contain `modelBudget: { maxCalls, reservedCalls, maxCallsPerAttempt }`. Before each execution, persist the reservation for the whole run, then hand it to the handler's `maxModelCalls`; the App uses it to constrain the real runner. Interrupted or unused reservations are not refunded, so recovery after a crash cannot reset the accumulated quota. State predicates are synchronous booleans, and steps have explicit replayPolicy; clock, cancellation during save, and reconciliation follow the same lifecycle. See [Durable tasks](advanced-agents.en.md#durable-professional-tasks) for a complete example.

## Reflection, BranchVersions, and knowledge publishing

[Reflection, branching, and material publishing](advanced-agents.md) introduces the configuration and use of `defineReflection`, `defineBranchVersioning`, and `Knowledge.defineKnowledgePublication`. They are optional Kits for the App, while identity, real storage, and publishing decisions are provided by the App.

## MockGPT

The simulated model Kit is used from `@jangts/agent-core/mock`; Node service and web source are provided by `/mock/node` and `/mock/web` respectively. It can generate JSON values directly and also test a model client's HTTP/SSE and failure handling. See [MockGPT API](mock.md) for complete input, returns, budget, and TS/JS examples.

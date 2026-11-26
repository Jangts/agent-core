# Requests, call chains, events and Journal

[Back to the API handbook](README.md) · [Core](core.en.md#journal-and-diagnostics). Core records runs, calls and registered entities. An App's accounts, HTTP requests and Q&A records are linked to runId in its own data model.

## One fact per record, relations at the top level

Reusing the same observer object through a Runner, Engine and child execution subscribes it once. The first method snapshot and receiver in that event tree win. Distinct observer objects remain separate subscriptions even if they share a callback.

Core emits events one by one through the optional CoreLogOutput; it neither packs the whole call tree into a single JSON nor keeps only one summary per model Q&A. Model request／output, tool start／completion and workflow transition／failure each have their own event; they share the same v2 outer layer, and payload expresses differences by type:

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

| Field | Responsibility |
| --- | --- |
| runId | Identity of one Core run, obtained by the caller before the run; not automatically equal to requestId or messageId |
| spanId/parentSpanId | Current execution boundary and its direct parent boundary; queries do not rely on parsing span paths |
| invocationId/parentInvocationId | Real model or tool call and its calling parent; not a provider function-call ID |
| workflowInvocationId | Scope of one explicit workflow call; nested workflows have their own identity and parent relation |
| eventId | Identity of this execution fact; consistent with the fact ID seen by the workflow observer |
| producerSequence | Sequence starting at 1 within the Core diagnostics context tree; it cannot stand in for a cross-source total order or a causal proof |
| occurredAtMs | Millisecond time at which the Core fact was produced |
| definitionId/definitionKind/definitionRevision | Registered entity and available revision information |
| nodeId/nodeName/nodeKind/nodeDescription | Basic description of this boundary; storing the whole historical configuration is not required |
| nodeRole | workflow-node/workflow-boundary/invocation/loop-step, preventing a local call from being taken for main-flow dispatch |

The invocation in a successful tool or model return, the corresponding event and the Journal share the same call identity. Compression models and real nested tool calls each have their own invocationId and are linked to the parent call; pure wrapping does not create an already executed business operation out of nowhere. Re-entering the same workflow node has a different span; an identical static nodeId does not mean the same visit.

## The Journal is not a second persistent log

ContextJournal is the in-memory context projection for this round, used so that the model can keep referring to real call receipts; it does not create a database or store a separate execution history. Model and tool start records share the invocationId deduplication scope, so duplicate model records or model／tool identity collisions are rejected; a failed snapshot does not occupy that identity. Records use type, producerSequence, occurredAtMs and InvocationMetadata:

```ts
journal.model({ stageId, value, invocation }): void
journal.beginTool({ toolId, input, invocation? }): string
journal.finishTool({ invocationId, status, value }): void
journal.snapshot(): readonly ContextRecord[]
```

The model submits value after parsing, delivery and cancellation checks; tool start／end reuse the same invocationId. By default no numbers such as call-1 that cannot be correlated across instances are produced. A missing call or a duplicate end is rejected. snapshot is a copy. Only named requests and the success/error/cancelled statuses are accepted, and records use type, value, toolId/stageId.

The Journal and diagnostics project the same actual execution boundary but are not guaranteed to have identical contents: the Journal keeps the business values needed for this round, diagnostics record execution facts per collection rules, and closing diagnostics does not change the Journal or business execution. When persistence is required, the App wires up CoreLogOutput and must not treat a Journal sequence number as a new real call.

## Real workflows, failures and boundaries not entered

WorkflowEvent has required eventId, workflowId, workflowInvocationId, nodeId, roundIndex and type. The targetSpanId of transition/error points to the **selected next visit**; only the corresponding enter event proves actual entry. When cancellation, budget rejection or log loss happens after selection, the target must not be drawn as executed.

The errorEventId of an error event is passed along the recovery context; the failure phase and failedRouteId locate the problem. Cancellation, budget and contract errors cannot be recovered into a success that was never executed. A failure before node entry is marked workflow-boundary and does not fabricate a second enter. The raw engine.run produces only loop.event and does not borrow the identity of the main workflow node.

ModelCallTrace and ToolExecutionEvent use success/error/cancelled; check passed/failed belongs to business checks and does not override whether the model call completed successfully. ToolRegistry keeps tool identity and start／completion facts under metadata collection; input/value, detailed errors and subSteps are attached only when content collection is permitted. Pre-check rejections and accepted attempts are recorded separately, and a single error does not imply that the provider necessarily received the request.

## State and output during a run

Core invokes the receivers registered by the App and does not manipulate the interface directly. Fixed flows, model／tool calls and dynamic node progress use the same `CoreEvent` outer layer and are distinguished by `type`. The same fact received by logs and listeners has the same eventId, time and call relations; content collection rules and copies are isolated from one another.

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

| Access point | Content | Guarantee |
| --- | --- | --- |
| execution.observe.event | Loop／Workflow, model.start／end, tool start／end and permitted dynamic reports | Side channel; a synchronous throw, async rejection or hang does not change execution; still effective when persistent logging is closed |
| execution.diagnostics → CoreLogOutput.write | Optional persistent projection of the same fact | The App decides fields, body, storage and retention; it gains no content authorization from other listeners |
| ModelRunner.sink.output | model.start／output／parsed of the same outer layer, plus model.end on success, failure or cancellation | Body waits in order, propagates failures and preserves backpressure; the end notification is limited to 250 milliseconds independently, and its failure does not override the result or the original exception |
| context.report({ usedModel, payload }) | Immediate report during the current node's run | usedModel is optional boolean metadata, payload are read only when content is permitted; Core fills in identity, time and sequence, and reports after the node ends or is cancelled are dropped |
| node report(update, context) | usedModel／payload on completion／transition | Evaluated only when content is permitted; does not replace immediate reports during the run |
| context.createStepRecorder() | Sub-log instance bound to this execution | write records first, fix completes later, readAll obtains a fixed-format snapshot; reuses the existing node.progress outlet |

Listeners can filter by metadata such as event, nodeId and workflowNodeId. workflowNodeId keeps the owning Workflow node, while model／tool boundaries still have their own nodeId and invocationId. Repeated visits to the same node have different spans, and concurrent runs do not correlate through lastCall or a shared "current request". `withObserver` can be called on an existing request scope to add a listener, inherited along sub-scopes; this is immutable wiring and leaves the original scope unaffected. Canonical methods are bound to their original receivers at assembly time. When a reusable Engine has no request scope configured, each run is assigned an independent identity.

Listeners without accepts receive metadata only. Content events, payload and sub-log content are collected only after the corresponding consumer explicitly accepts them; other metadata consumers do not gain the body as a side effect. Each consumer receives an independent copy. The result snapshot is isolated from the actual return value, so preview edits do not rewrite the final value; model results must still satisfy the existing Journal snapshot contract.

ModelPart does not provide separate reasoning content chunks. State, process notes explicitly provided by the model, tool facts, transient previews and the final answer each keep their own meaning; internal hidden reasoning or the raw protocol must not be treated as a user reply. Selection, compression and assembly can be registered as ordinary nodes separately and use real lifecycle facts; algorithmic reports are delivered as permitted node.progress.

Adding a listener only changes assembly configuration; the original Workflow, run and model result contracts are unchanged.

<a id="sub-log-instances-and-record-first-then-complete"></a>

## Reported-step recorders and append-only updates

Workflow nodes, simple run(step), ToolRegistry／Support tools and the execution context of executeInvocation all provide `createStepRecorder()` and `report()`. Each node visit or call has one instance, and repeated create returns the same instance; no global logger is shared. The factory is already bound to the execution context; no context argument is required. Identity inherits the App diagnostic scope and identifies the Engine definition, run and node visit without retaining App service objects. The Loop owns the lifecycle: each accepted write/fix immediately commits an immutable snapshot to runtime before publishing node.progress to observers and the log outlet. Nodes never submit a logger or readAll() result. Terminal events use the committed runtime snapshot without reading the logger. Node completion detaches writes and releases the runtime reference; failure and cancellation preserve prior records. A later visit gets a new instance. readAll() remains readable by any holder and emits nothing. Nodes, Apps and external code may retain or lend the instance; Core does not prescribe its use. A later visit receives a new logger and may consult the previous flow through a retained old instance. Apps apply each appended fix to the original write view using operation/targetStepId and order revisions with revision. Stored subSteps remain fixed-format arrays.

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

| Method | Fixed contract |
| --- | --- |
| write(input): string \| -1 | name and kind are required, status defaults to planned; stepId, sequence, createdAtMs and initial revision=1 are allocated automatically. Optional parentStepId, relatedDefinitionId, caseId, nextStepIds, status, time, summary, payload and usedModel. startedAtMs is recorded automatically only when running is reported explicitly, so planned time does not pass for an actual start. |
| fix(stepId: string \| -1, patch): boolean | Completes status, model usage, pending times, summary, successors or payload fields for a record in the same instance; a terminal state cannot be reopened, but missing result fields can still be filled while execution is active. Every successful fix appends an independent record with operation=fix, a new stepId, sequence and createdAtMs. targetStepId references the original write and revision increases for that original. Each fix carries the resulting state without changing any earlier row. payload merges missing keys recursively and existing facts cannot be overwritten; a given summary, time or successor cannot be rewritten. |
| readAll(): readonly ReportedStepRecord[] | Returns all write/fix records in append order; repeated fixes create separate rows and never mutate earlier rows or snapshots. With no steps it is [], and the snapshot remains readable after the execution is closed. |

Records have origin=reported, operation=write/fix, unique stepId, append sequence, name, kind, status, createdAtMs and revision. Fix records reference the original write with targetStepId; fixing a fix ID is rejected. Historical projected snapshots may omit operation. planned／unknown can advance to an actual status, while running cannot go back to planned or skipped; success／error／cancelled／skipped are terminal, the status and established facts cannot be rewritten, but pending result fields can still be filled while the owning node is active. Statuses and legal transitions come from the same reportedStepStatusCatalog. A retry writes another record and does not reopen a terminal state. The parent and successors must belong to the same logger; when the successor ID is not yet available, nextStepIds can be completed in one later fix. Pending payload fields are omitted first and are not represented by null or an empty array as an overwritable placeholder. By default at most 256 original writes, 1024 total write/fix records and 65536 JSON characters for the complete ledger; payload accepts only bounded-depth JSON data and does not accept functions, service instances, circular references or internal getters.

write and fix emit the initial／completion event through the existing node.progress at that moment, with payload.subStep holding operation, current record stepId, targetStepId for fixes, sequence, revision, createdAtMs, status and optional usedModel metadata. When content is permitted, the event carries the fixed-format subSteps snapshot at that point; node end／failure events also carry the last snapshot. The log appends revisions, and events already emitted are not updated in place. Results returning out of order do not change the initial order, and replay can distinguish "only a plan at the time" from "a result later". When only a plan or start was received without a result, the original status is kept; success, failure or an actual model call cannot be inferred.

The main node reports through context.report({ usedModel: true | false }) whether it used the model this time, and the outer usedModel in the log is kept as metadata; sub-steps report their own usedModel through write／fix. Unreported stays unknown and does not default to false; a reported true cannot change back to false. A child's true is not automatically aggregated into the main node's original marker. This is a node report: a field of true does not fabricate model.start／end or call counts, and model internal hidden reasoning is not collected. The end report(update, context) is still evaluated only when content collection is permitted; markers that must be kept in metadata mode should be submitted during the run with context.report.

Content permission continues to be decided per event and per consumer. Without content authorization, payload／summary getters are not read, nor are the private payload getters in reports; only permitted status, revision and boolean metadata are kept. The instance closes when execution ends or is cancelled, and write returns numeric -1 and fix returns false without throwing, inspecting arguments, recording or emitting. readAll remains readable. fix returns true on success; invalid IDs, invalid input, forbidden revisions and detachment all return false without throwing, changing the record or emitting a revision. write returns the new ID on success and -1 on any failure, including invalid input, limits and detachment, without throwing, recording or emitting. Log shutdown, outlet failure or a process crash still follow the original failure isolation and incomplete mechanism; recording intent first does not constitute a transactional audit guarantee.

## Subnode grouping and restricted delegation

subnodeId groups multiple records within one node visit. It is independent of stepId, which identifies a log record. A group can contain multiple writes and multiple fixes per write; ungrouped logs belong to the parent node. Grouping does not imply dispatch, contiguous phases, scheduling or dependencies.

ReportedStepRecorder and ScopedReportedStepRecorder are independent, non-inheriting classes implementing ReportedStepLog. The full class owns storage/lifecycle, accepts subnodeId directly on write, and may fork(subnodeId). A scoped instance holds only the original logger and bound ID: write adds the ID, fix checks original-record ownership and delegates. It cannot override its group, fork or be supplied to native invoke. Both readAll methods return the same complete immutable ledger, including other groups.

Business type is an arbitrary string; operation is the separate write/fix enum. type and the compatible kind classification fill each other's omitted default. Fix uses the explicit ReportedStepUpdate whitelist (status, usedModel, times, summary, nextStepIds, payload), not Partial of the write input. Identity, group, business type and label cannot be revised. A rejected fix returns false; rejected writes return -1. Safe console warnings explain fixed reasons, deduplicated per logger, without payloads or arbitrary error text; console failures do not change results.

Registered subnode IDs are local to one node visit: kind:encodedDefinitionId:ordinal, for example tool:product.references:1. Definition IDs are URL-encoded. The owning logger allocates ordinals per kind/definition at call start; failure and cancellation never reuse them, and a new node visit starts from 1. Parent identity stays in its existing fields. relatedInvocationId separately retains the real call identity for correlation with model/tool events; a short ordinal never replaces invocationId. App-owned custom groups need no business enum. Direct write({subnodeId, type, name}) and fork(subnodeId).write({type, name}) are equivalent grouping choices. fork validates its ID and native invoke rejects scoped/forged logger inputs at the boundary.

## Optional native call records

logger is a per-call choice. Omission creates no native sub-log; passing it produces a fixed write followed by a separate fix on success, error or cancellation. Components do not create owning logger storage or implicitly forward full logging authority. Tools expose a scoped delegate bound by Core to the actual invocation. It may be lent to business helpers but cannot fork or be passed to another invoke. Business steps remain App-owned.

| Entry | Explicit logger location |
| --- | --- |
| ModelRunner / Workflow model.invoke; ToolRegistry / Support tool invocation | request.logger |
| executeInvocation / Tools lifecycle | ports.logger(context) |
| Retrieval.run; Answering task.read/readAsync, checks.check, flow.run; output.compose | context.logger |
| Knowledge.read; recovery chain tryRecover | Optional second context argument |
| Support.processContext / context node run | ports.logger / explicitly supplied context.logger |
| retryMultipleModelCalls | request.logger; records only an actual fallback attempt |
| Delivery.deliver; Aggregation.collect | execution.logger; optional third execution argument respectively |

Fixed records contain producer/definition identity and execution status, never automatic copies of prompts, results, tool arguments or customer material. A checker returning a rejection or a recovery returning unhandled still completed normally; callers choose whether to record the business result. Existing Core events and receipts remain unchanged. Pure configuration, lookup and formatting functions do not record.

## File adaptation and relational table mapping

An App can connect CoreLogOutput.write to its own file or database adapter. Core events are stored flattened, and the App／storage fields source, traceId, app, sequence and recordedAtMs are filled in by the adapter, which Core does not depend on; other application diagnostics can still use the original record interface. Files can be segmented by source; they belong to the same run session and are not another Journal persistence ledger.

The collector sequence links the persisted observation order of sources such as App and Core; producerSequence keeps the producer's original sequence. occurredAtMs and recordedAtMs are preserved separately. The adapter continues to use the existing redaction, body switch, bounded queue, segmented／large-payload files and retention period; side-channel failures do not change business results, and queue drops or write failures mark incomplete. This interface provides no transactional audit or exactly-once guarantee.

Relational databases can record this without mesh JSON and map it directly:

| Object | Main relation columns | Details |
| --- | --- | --- |
| runs | run_id, started_at_ms, ended_at_ms, status, incomplete | Run summary |
| spans | run_id, span_id, parent_span_id, invocation_id, parent_invocation_id, definition_id | Boundary summary |
| events | event_id, run_id, span_id, invocation_id, type, sequence, producer_sequence, occurred_at_ms, recorded_at_ms | payload JSON per type; necessary bodies stored as separate references |
| App message_run_links | message_id, run_id, relation and account isolation columns | App-owned user Q&A links |

This is a feasible mapping, not a created SQL table or an SDK built-in repository. Queries are authorized by the App; one input can trigger multiple runs, and a failed／cancelled run without final output can still be linked to the input message; Core does not query App message tables back. Parent/child keys can be used for recursive upstream／downstream queries; do not guess relations from time proximity or text similarity. Storage may idempotently project summaries of the same fact and handle out-of-order and missing data, but the last persisted row cannot be treated as the authoritative completion state.

## Event format validation

normalizeDiagnosticEvent(input) accepts version=2, validates identity, time, sequence and reported steps, and produces an independent copy. Missing identity or unsupported versions are rejected.

The payload at the read boundary is unknown, and outer validation does not equal validating arbitrary business JSON. The write interface CoreEvent associates CoreEventPayloads by type; for the exact event catalog and fields see the [public declarations](reference.md).

## Difference between facts and reports

Only workflow nodes actually dispatched by the Loop are primary visits; a node calling a local function does not produce an additional dispatched node. subSteps is optional, bounded reported material and must not be treated as a Core dispatch fact or a static subgraph. Only the target enter event proves entry; a selected route target or the last persisted row must not be treated as proof of execution. The App owns user input／final output and message links itself.

## Large records in file adaptation

When the `@jangts/diagnostics` file adapter is used, payload, subSteps and redactions in a large record are stored as body domains of the same validated attachment; the reference row keeps identity and index information. The reader restores the record after validating the attachment scope, size, SHA-256 and applicable identity. Attachments and return budgets are still configured explicitly by the App; Core itself does not own file storage.

# Workflow graphs and run traces

`workflow.toGraph()` returns registered topology. `await workflow.toTrace(runId)` returns observed visits of this Workflow within a run. Both return deeply readonly JSON data, without handlers, condition functions, layout or renderers.

The run-trace API preserves the existing serialized fields, including `nodes`, `transitions`, and `subflow`. These names describe the saved format; reported steps are not executable subworkflows. The inspector accepts `--trace`, with `--chain` retained as an input alias.

These interfaces support developer reviews, debugging, observability clients and demonstrations. Export does not participate in Agent decisions, scheduling or task execution and adds no business capability. A chain is a readonly projection of existing records, not a replay or resume entry. Apps can authorize log-based reflection; graphs and chains do not automatically enter learning or rule modification.

## Reading a run

```ts
const workflow = defineWorkflow({
  id: 'assistant', nodes,
  traceSource: async runId => {
    const capture = await authorizedRunReader.readAll(runId);
    return { events: capture.events, coverage: capture.coverage };
  },
});
const graph = workflow.toGraph();
const chain = await workflow.toTrace(runId);
const exported = await workflow.toTrace(runId, authorizedSource);
```

`WorkflowRunTraceSource` receives a runId and returns `Promise<{ events: readonly CoreDiagnosticRecord[]; coverage: WorkflowRunTraceCoverage }>`. The App owns authorization, account isolation, storage paths, retention, pagination and read limits. Core installs no global run store and does not retain the latest run. A per-call source overrides the bound source without modifying the Workflow. `add()` carries the bound source into the derived Workflow.

An empty runId or absent source throws TypeError. Source errors propagate. No matching Workflow visits throws RangeError, rather than returning an apparently successful empty history. Readers must provide a consistent snapshot and state whether the capture is complete, live or uncertain.

## WorkflowGraph

The root contains `schemaVersion: 1`, `workflowId`, optional `revision`, `entryNodeId`, `nodes` and `edges`.

Each `WorkflowGraphNode` contains `id`, `name` (defaults to id), `description`, zero-based `order`, `startsRound`, `requires`, `provides`, `routes`, `incomingEdgeIds` and `outgoingEdgeIds`. Empty collections are arrays. The explicit entry cannot be inferred from incoming edges because loops may lead back to it.

Each `WorkflowGraphRoute` contains zero-based `order`, optional `routeId`, `description` and `conditionId`, a `conditional` boolean, and `edgeId`. Order is matching priority. Export never calls `when` or `complete`.

Each `WorkflowGraphEdge` contains `id`, `kind: transition | error | complete`, `sourceNodeId`, optional `targetNodeId`, `routeOrders` and optional `errorRouteId`. Routes with the same source, kind and target share one edge while retaining their individual orders. Recovery and normal edges remain separate. Completion has no target node. Recovery has an empty routeOrders array and takes errorRouteId from onErrorRouteId. IDs are deterministic JSON tuples `[sourceNodeId, kind, targetNodeId ?? null]`; consumers should treat them as opaque strings.

Registration reads a routes getter exactly once and seals a copied snapshot. The getter must be pure and depend only on immutable definitions. Runtime conditions belong in `when`. Execution and graph export use the same snapshot. Export does not inspect function bodies or infer internal tool calls and custom subnodes.

## WorkflowRunTrace

The root contains `schemaVersion: 1`, `workflowId`, `runId`, `nodes`, `transitions` and `coverage`. Nodes are sorted by first observed producerSequence, transitions by their original producerSequence.

A `WorkflowNodeVisit` identifies one visit with `spanId` and `nodeId`, plus optional `workflowInvocationId`, `definitionRevision`, `name`, `description`, `kind` and `roundIndex`. Repeated visits and multiple Workflow invocations within one run stay separate. Historical nodes absent from the current graph remain in the chain. Descriptive fields come only from captured events, never from current definitions.

Visit fields also include `firstEventSequence`, `lastEventSequence`, optional `enteredAtMs`, `endedAtMs`, `durationMs`, `usedModel`, and mandatory `status`, `events`, `subflow`. Time is epoch milliseconds. Sequence values are original producer values. Status is `running | success | error | cancelled | unknown` for this visit alone; recovery does not overwrite an error with success. Missing exits in a complete capture yield unknown; an entered visit in an incomplete live capture can remain running. TIMEOUT and CANCELLED map to cancelled.

Each node event contains `eventId`, `producerSequence`, `occurredAtMs`, `type: enter | progress | transition | complete | error`, and optional `phase`, `routeId`, `conditionId`, `errorCode`, `errorEventId`, `payload`. Sub-step progress is represented by subflow rather than duplicated as ordinary progress.

Each `WorkflowTransitionRecord` contains `eventId`, `producerSequence`, `occurredAtMs`, `type: transition | complete`, `sourceSpanId`, and optional `targetSpanId`, `targetNodeId`, `routeOrder`, `routeId`, `conditionId`, `errorEventId`. Only explicit handoff facts create connections. An error event with a recovery target also creates a transition, with eventId and errorEventId referencing that original error event. Neither adjacency nor timestamps imply a handoff. A selected targetSpanId does not prove that its entry was captured; missing target visits are reported.

### Ordered subflow

`WorkflowReportedStepRecord` retains ReportedStepRecord fields: `origin`, `stepId`, `operation`, `targetStepId`, `sequence`, `createdAtMs`, `revision`, `subnodeId`, `type`, `kind`, `name`, `status`, `usedModel`, `startedAtMs`, `endedAtMs`, `relatedDefinitionId`, `relatedInvocationId`, `parentStepId`, `nextStepIds`, `caseId`, `summary`, `payload`.

Records stay in node-local sequence order. Every fix retains its own stepId and targetStepId; original writes are never overwritten. Repeated snapshots deduplicate by stepId within one span. Direct progress evidence adds `sourceEventId` and `producerSequence`. Records found only in later snapshots receive no fabricated emission sequence. Historical operation/createdAtMs/revision omissions remain absent and are reported. Metadata captures may omit name, kind, payload and other content.

subnodeId and type are caller-defined strings. Records without subnodeId belong to the main node's own process. Core creates no subnodes array, implicit group, merged view or dependency between subnodes. Consumer DataModels choose grouping, fix projection, filtering and expansion. A group need not be contiguous or sequential.

### Coverage

`complete: boolean | 'unknown'` states source event coverage; projection issues downgrade it to false. `content: included | omitted | mixed | unknown` independently describes content capture. Omitted content does not imply missing events. Each issue has a `code` and optional `spanId`, `eventId`, `count`.

Core issue codes are `conflicting-event`, `invalid-workflow-event`, `missing-node-id`, `conflicting-span`, `subflow-truncated`, `conflicting-subflow`, `invalid-subflow-progress`, `missing-enter`, `missing-exit`, `historical-subflow-fields`, `missing-target-enter`. Apps can supply additional read-side issue codes. Invalid v2 diagnostic envelopes throw through normalizeDiagnosticEvent rather than becoming apparently valid history.

Readonly types are exported from the root, `/engine`, `/types`, and `/structs`. See the [symbol reference](reference.en.md).

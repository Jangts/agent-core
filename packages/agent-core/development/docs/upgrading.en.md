# Upgrading from 0.9.0 to 1.0.0

Update imports, types, configuration and consumers by concept domain, then verify the original results, authorization, cancellation and recovery behavior. Canonical names serve new code; retained deprecated names are migration entries, not independent implementations. Do not globally replace strings in persisted payloads, prompts or business data.

## Model interactions and types

| 0.9 name | Canonical name |
| --- | --- |
| ModelTransportDefinition / ModelTransportRegistration | ModelInteractionDefinition / ModelInteractionRegistration |
| ModelStageTransportRegistration | ModelStageInteractionRegistration |
| createModelTransport / createStageModelTransport | createModelInteraction / createStageModelInteraction |
| createTextTransport / createJsonTransport / createPlainTextTransport | createTextInteraction / createJsonInteraction / createPlainTextInteraction |
| RegisteredTransportOutput | RegisteredInteractionOutput |
| ModelRunnerProvider | ModelProvider |
| LifecycleContext / LifecycleRun | ModelLifecycleContext / ModelLifecycleRun |
| OperationAction / OperationStatus | ModelOperationAction / ModelOperationStatus |
| ModelSessionCall / ModelSessionResult | ModelResponseToolCall / ModelToolResponse |
| PreparedSessionTransport / SessionModelTransportRegistration | PreparedModelToolInteraction / ModelToolInteractionRegistration |
| createSessionTransport / prepareSessionFunctions | createModelToolInteraction / prepareModelToolInteraction |

**Prepared outputs have an explicit same-name type migration exception:** the 0.9 single-selection `PreparedModelInteraction<Result>` becomes `PreparedModelSelection<Result>`. The old `PreparedModelTransport<Result>` becomes the new `PreparedModelInteraction<Result>`. The new name describes final-result collection and cannot simultaneously remain an alias of the old selection type. Check custom adapter `prepare`, selection parsing and `resolve` together; merely repairing an import must not hide a mismatched contract. The old `PreparedModelTransport` remains a deprecated alias of the final prepared interaction.

For ordinary model selection, change `transports` / `transport` to `interactions` / `interaction`. Legacy keys still bridge to canonical values; explicitly supplying inconsistent old and new values is rejected rather than silently prioritized. Prefer one naming family per input. Measurement views add `interactionId` / `interactionChars`; compatibility and stored fields for `transportId` / `transportChars` remain. This mapping does not rename network HTTP, SSE or duplex transports. The canonical selector for a finite text/multiple-tool response is `tools`, with legacy `session` compatibility; a real realtime session does not become a single response.

Operation-only, realtime-only and combined providers retain their capabilities without fabricated `stream` methods. Local tool proposals, hosted execution events and local execution receipts remain distinct.

## Domain and lifecycle tools

| 0.9 name | Canonical name |
| --- | --- |
| GoalTool / GoalRegistry / createGoalRegistry | DomainTool / DomainToolRegistry / createDomainToolRegistry |
| GoalToolRegistration / RegisteredGoal / GoalId | DomainToolRegistration / RegisteredDomainTool / DomainToolId |
| GoalPolicy / GoalDescription | DomainToolPolicy / DomainToolDescription |
| CatalogGoal / CatalogTool | CatalogDomainTool / CatalogExecutionTool |
| Kit Tool / ToolRegistration / RegisteredToolDefinition | LifecycleTool / LifecycleToolRegistration / RegisteredLifecycleTool |
| Kit Policy / LifecycleHooks / LifecycleProtocol | ToolLifecyclePolicy / ToolLifecycleHooks / ToolLifecycleProtocol |
| ToolsOptions | ToolLifecycleRegistryOptions |

Change only imports from the relevant Kit. Do not rename Core `ExecutableTool`, basic `ToolDefinition` or unrelated business Tool types. Domain relation keys `goalId` / `goalIds` correspond to `domainToolId` / `domainToolIds`; `scopePolicy`, `targetPolicy` and `planIntent` correspond to `scopeMode`, `targetMode` and `planningAction`. Relevant entries bridge old inputs without interpreting conflicts by property order. Read canonical projections and legacy shape-preserving directory entries according to their respective return contracts.

`asIntent`, `select({ intent: true })`, App business `goal`/`intent` selectors and model-visible protocol keys such as `availableGoals` retain their meaning. Do not mechanically replace them with domain-directory terms. Domain tools and execution tools have different ID sets and relationship directions.

## Reporting, traces and state versions

| 0.9 name or method | Canonical name or method |
| --- | --- |
| SubFlowLogger / ScopedSubFlowLogger | ReportedStepRecorder / ScopedReportedStepRecorder |
| SubFlowLog / RecordedSubStep / SubFlowValue | ReportedStepLog / ReportedStepRecord / ReportedStepValue |
| SubFlowStepInput / SubFlowStepFix | ReportedStepInput / ReportedStepUpdate |
| context.createSubFlowLogger() | context.createStepRecorder() |
| WorkflowChain / WorkflowChainNode | WorkflowRunTrace / WorkflowNodeVisit |
| WorkflowChainCoverage / WorkflowChainSource | WorkflowRunTraceCoverage / WorkflowRunTraceSource |
| workflow.toChain() / chainSource | workflow.toTrace() / traceSource |
| AgentFamily / FamilyRecord / FamilyVersion | BranchVersioning / BranchVersionRecord / BranchVersion |
| FamilyDefinition / FamilyStore / FamilyOperation | BranchVersioningDefinition / BranchVersionStore / BranchVersionOperation |
| defineAgentFamily / Family / familyOperations | defineBranchVersioning / BranchVersions / branchVersionOperations |
| AgentCheckpoint / AgentCheckpointRecord | AgentSnapshot / AgentSnapshotRecord |
| checkpoint / exportCheckpoint / restoreCheckpoint | snapshot / exportSnapshot / restoreSnapshot |

Within the same module format, old and new recorder names refer to the same constructor, and factory aliases refer to the canonical function. Engine snapshot methods share data-copy and identity-validation mechanisms with their legacy equivalents. Workflow trace methods read the same authorized projection. Supplying both `traceSource` and `chainSource` is explicitly rejected.

Core-produced runtime contexts provide the canonical factory. Existing custom implementations of legacy `NodeReportingContext` do not acquire a new required method. Use `RuntimeNodeReportingContext` when a canonical factory guarantee is needed; do not assert an arbitrary legacy substitute into that contract.

This does not preserve every old context input unchanged. `ToolExecutionContext`, `WorkflowContext`, and related execution callbacks now describe enhanced Core-produced contexts and require `createStepRecorder`. Manually constructed 0.9 contexts and test doubles need an explicit migration; do not cast a legacy object to the enhanced type. Bind the existing factory so both names use the same recorder and receiver:

```ts
const upgraded = {
  ...legacyContext,
  createStepRecorder: legacyContext.createSubFlowLogger.bind(legacyContext),
};
```

Preserve cancellation, diagnostic scope, and the original `report` binding. This example assumes a safely spreadable data object. For prototype-based services and private state, explicitly bind the methods on an adapter rather than spreading a service instance. Core already provides both methods; no second recorder is created. This is an explicit 0.9 input-type migration, alongside the prepared-type naming change.

`ContextJournal`, `ContextRecord`, `ContextTrust`, `trust` and `Reflection` retain their names and responsibilities. `DeliveryPipeline` is the canonical Delivery namespace, with legacy-name compatibility. A snapshot does not restore arbitrary execution positions, and version management is not multi-agent scheduling.

## Existing records and upgrade checks

Source renaming does not rebuild storage keys or identities. Diagnostic `recordedSubSteps`, `subflow`, `subStep` and format markers remain unchanged. BranchVersionRecord `revision`, `activeId`, expiry and version identities are not recalculated. WaitRecord definition/task addressing, waitId, submission, expiry and terminal facts remain intact; upgrading must not reopen or extend a wait.

Durable `operationId` identifies a stable logical operation. An existing `commitId` still identifies that exact submission; a new submission generates a new commitId. Continuation protocol/model/scope, complete history anchors and per-turn native blocks remain intact. Do not bulk-rewrite provider fields or signatures; renamed historical tools require protocol-specific compatibility or rejection.

Verify both fresh integration and an existing consumer upgrade: public ESM/CJS imports, strict types, custom objects and prototype instances, adapter result inference, cancellation/authorization denial, old-record reads and necessary recovery. Each format is read or rejected under its own contract; upgrading the package does not convert arbitrary old formats. Package contents, dependencies, optional peers, documentation and consumers should correspond to the same actual candidate. Local build, simulator and real-service evidence are evaluated separately.

See [version compatibility and maintenance](compatibility.en.md) for maintenance boundaries.

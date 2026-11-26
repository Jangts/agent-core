# Public symbol reference

Symbols are listed by `package.json.exports` and the TypeScript declarations shipped with the package; parameters, overloads and return types follow the linked declarations.

Symbols of this package link to the declarations shipped with the package; external symbols link to the declaration from which this package actually re-exports them, and the full type is provided by the installed dependency referenced by that declaration, without assuming the location of that dependency on disk. Aggregate entries from the same source point to the same implementation; usage is described in each chapter. Shared runtime types can be imported from `@jangts/agent-core/types`, which has no runtime values; each sub-entry also exports its own related types, and MockGPT types are imported from the corresponding mock entry.

## @jangts/agent-core

[Contracts and behavior](core.md) · 411 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `abortableStream` | value | [Declaration](../../../dist/esm/index.d.ts#L35) |
| `AgentBranch` | type | [Declaration](../../../dist/esm/execution/engine.d.ts#L63) |
| `AgentCacheAddress` | type | [Declaration](../../../dist/esm/structs/execution/cache.d.ts#L27) |
| `AgentCacheOptions` | type | [Declaration](../../../dist/esm/structs/execution/cache.d.ts#L23) |
| `AgentCachePort` | type | [Declaration](../../../dist/esm/structs/execution/cache.d.ts#L34) |
| `AgentCatalogPorts` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L77) |
| `AgentCheckpoint` | type | [Declaration](../../../dist/esm/execution/engine.d.ts#L83) |
| `AgentCheckpointRecord` | type | [Declaration](../../../dist/esm/execution/engine.d.ts#L94) |
| `AgentCoreEngine` | value + type | [Declaration](../../../dist/esm/execution/engine.d.ts#L110) |
| `AgentCoreEngineOptions` | type | [Declaration](../../../dist/esm/structs/execution/engine.d.ts#L37) |
| `AgentCoreEngineSetup` | type | [Declaration](../../../dist/esm/execution/engine.d.ts#L36) |
| `AgentErrorInfo` | type | [Declaration](../../../dist/esm/structs/errors.d.ts#L46) |
| `AgentModelBinding` | type | [Declaration](../../../dist/esm/execution/engine.d.ts#L25) |
| `AgentModelRuntime` | type | [Declaration](../../../dist/esm/execution/engine.d.ts#L15) |
| `AgentOutputEvent` | type | [Declaration](../../../dist/esm/structs/kits/presentation/events.d.ts#L11) |
| `AgentSnapshot` | type | [Declaration](../../../dist/esm/execution/engine.d.ts#L83) |
| `AgentSnapshotRecord` | type | [Declaration](../../../dist/esm/execution/engine.d.ts#L94) |
| `AgentWorkflow` | value + type | [Declaration](../../../dist/esm/execution/workflow.d.ts#L9) |
| `AgentWorkflowDefinition` | type | [Declaration](../../../dist/esm/structs/execution/workflow.d.ts#L103) |
| `AsIntent` | type | [Declaration](../../../dist/esm/structs/capabilities/model.d.ts#L27) |
| `assembleContextPlan` | value | [Declaration](../../../dist/esm/context/plan.d.ts#L14) |
| `assembleFragments` | value | [Declaration](../../../dist/esm/context/assembly.d.ts#L14) |
| `AsyncSink` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L21) |
| `AttemptBudget` | value + type | [Declaration](../../../dist/esm/execution/workflow.d.ts#L158) |
| `bindInteraction` | value | [Declaration](../../../dist/esm/kits/interaction/handlers.d.ts#L21) |
| `BoundModelProvider` | type | [Declaration](../../../dist/esm/structs/model/chat-provider.d.ts#L51) |
| `BreakCheck` | type | [Declaration](../../../dist/esm/structs/utils/rules.d.ts#L33) |
| `BreakEvent` | type | [Declaration](../../../dist/esm/structs/utils/rules.d.ts#L42) |
| `BreakPredicate` | type | [Declaration](../../../dist/esm/structs/utils/rules.d.ts#L31) |
| `BreakReason` | type | [Declaration](../../../dist/esm/structs/utils/rules.d.ts#L29) |
| `breakWhile` | value | [Declaration](../../../dist/esm/utils/rules.d.ts#L56) |
| `BreakWhileConfig` | type | [Declaration](../../../dist/esm/structs/utils/rules.d.ts#L49) |
| `BudgetError` | value + type | [Declaration](../../../dist/esm/structs/errors.d.ts#L29) |
| `BuiltContext` | type | [Declaration](../../../dist/esm/structs/context/fragments.d.ts#L45) |
| `CacheContext` | type | [Declaration](../../../dist/esm/structs/execution/cache.d.ts#L51) |
| `CacheReadOptions` | type | [Declaration](../../../dist/esm/structs/execution/cache.d.ts#L11) |
| `CandidateSelectionDefinition` | type | [Declaration](../../../dist/esm/structs/kits/candidates.d.ts#L16) |
| `CatalogDomainTool` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L12) |
| `CatalogExecutionTool` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L29) |
| `CatalogGoal` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L12) |
| `CatalogScope` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L17) |
| `CatalogTask` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L22) |
| `CatalogTool` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L29) |
| `chatCompletionFunctionOptions` | value | [Declaration](../../../dist/esm/support/model/chat-completions.d.ts#L22) |
| `chatCompletionMessages` | value | [Declaration](../../../dist/esm/support/model/chat-completions.d.ts#L47) |
| `chatCompletionParts` | value | [Declaration](../../../dist/esm/support/model/chat-completions.d.ts#L33) |
| `ChatProvider` | value + type | [Declaration](../../../dist/esm/structs/model/chat-provider.d.ts#L24) |
| `CheckResult` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L52) |
| `Command` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L93) |
| `CommandCatalog` | value + type | [Declaration](../../../dist/esm/kits/interaction/commands.d.ts#L19) |
| `CommandCatalogOptions` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L115) |
| `CommandDefinition` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L58) |
| `commandSchema` | value | [Declaration](../../../dist/esm/kits/interaction/command.d.ts#L41) |
| `commonPrefixLength` | value | [Declaration](../../../dist/esm/utils/text.d.ts#L16) |
| `CompatibleModelConfig` | type | [Declaration](../../../dist/esm/structs/support/model/provider.d.ts#L74) |
| `CompatibleModelPorts` | type | [Declaration](../../../dist/esm/structs/support/model/provider.d.ts#L98) |
| `CompatibleModelProvider` | value + type | [Declaration](../../../dist/esm/support/model/compatible-provider.d.ts#L11) |
| `CompatibleModelProviderOptions` | type | [Declaration](../../../dist/esm/structs/support/model/provider.d.ts#L118) |
| `configureBreakWhile` | value | [Declaration](../../../dist/esm/utils/break-observer.d.ts#L19) |
| `ContextAssemblyOptions` | type | [Declaration](../../../dist/esm/structs/support/context.d.ts#L35) |
| `ContextBuilder` | type | [Declaration](../../../dist/esm/structs/support/context.d.ts#L49) |
| `ContextBuilderOptions` | type | [Declaration](../../../dist/esm/structs/support/context.d.ts#L28) |
| `ContextFragment` | type | [Declaration](../../../dist/esm/structs/context/fragments.d.ts#L17) |
| `ContextFragmentConfig` | type | [Declaration](../../../dist/esm/structs/support/context.d.ts#L42) |
| `ContextFragmentUsage` | type | [Declaration](../../../dist/esm/structs/context/fragments.d.ts#L34) |
| `ContextJournal` | value + type | [Declaration](../../../dist/esm/context/journal.d.ts#L5) |
| `ContextLifetime` | type | [Declaration](../../../dist/esm/structs/context/fragments.d.ts#L15) |
| `ContextPlan` | type | [Declaration](../../../dist/esm/structs/context/processing.d.ts#L13) |
| `ContextProjection` | type | [Declaration](../../../dist/esm/structs/support/context.d.ts#L15) |
| `ContextRecord` | type | [Declaration](../../../dist/esm/structs/context/journal.d.ts#L26) |
| `ContextTrust` | type | [Declaration](../../../dist/esm/structs/context/fragments.d.ts#L13) |
| `CoreDiagnosticRecord` | type | [Declaration](../../../dist/esm/structs/diagnostics.d.ts#L279) |
| `CoreEvent` | type | [Declaration](../../../dist/esm/structs/diagnostics.d.ts#L207) |
| `coreEventCatalog` | value | [Declaration](../../../dist/esm/diagnostics/catalog.d.ts#L7) |
| `CoreEventDescriptor` | type | [Declaration](../../../dist/esm/structs/diagnostics.d.ts#L145) |
| `CoreEventName` | type | [Declaration](../../../dist/esm/structs/diagnostics.d.ts#L138) |
| `CoreEventPayloads` | type | [Declaration](../../../dist/esm/structs/diagnostics.d.ts#L17) |
| `CoreLogOutput` | type | [Declaration](../../../dist/esm/structs/diagnostics.d.ts#L232) |
| `CoreStep` | type | [Declaration](../../../dist/esm/structs/execution/engine.d.ts#L35) |
| `createDiagnostics` | value | [Declaration](../../../dist/esm/diagnostics/index.d.ts#L18) |
| `CreateDiagnosticsOptions` | type | [Declaration](../../../dist/esm/structs/diagnostics.d.ts#L266) |
| `createDomainToolRegistry` | value | [Declaration](../../../dist/esm/kits/domains/registry.d.ts#L105) |
| `createGoalRegistry` | value | [Declaration](../../../dist/esm/kits/domains/registry.d.ts#L105) |
| `createJsonInteraction` | value | [Declaration](../../../dist/esm/support/model/transports.d.ts#L43) |
| `createJsonTransport` | value | [Declaration](../../../dist/esm/support/model/transports.d.ts#L43) |
| `createModelInteraction` | value | [Declaration](../../../dist/esm/support/model/transports.d.ts#L6) |
| `createModelTransport` | value | [Declaration](../../../dist/esm/support/model/transports.d.ts#L6) |
| `createScopeRegistry` | value | [Declaration](../../../dist/esm/kits/domains/scopes.d.ts#L165) |
| `createTextInteraction` | value | [Declaration](../../../dist/esm/support/model/transports.d.ts#L24) |
| `createTextTransport` | value | [Declaration](../../../dist/esm/support/model/transports.d.ts#L24) |
| `DebugStepsOutput` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L169) |
| `DecodedModelResponseToolCall` | type | [Declaration](../../../dist/esm/support/model/session.d.ts#L7) |
| `DecodedModelToolResponse` | type | [Declaration](../../../dist/esm/support/model/session.d.ts#L16) |
| `DecodedSessionCall` | type | [Declaration](../../../dist/esm/support/model/session.d.ts#L7) |
| `DecodedSessionResult` | type | [Declaration](../../../dist/esm/support/model/session.d.ts#L16) |
| `defineAgentCatalog` | value | [Declaration](../../../dist/esm/kits/domains/catalog.d.ts#L16) |
| `defineCandidateSelection` | value | [Declaration](../../../dist/esm/kits/candidates.d.ts#L24) |
| `defineCommand` | value | [Declaration](../../../dist/esm/kits/interaction/command.d.ts#L15) |
| `defineCommandCatalog` | value | [Declaration](../../../dist/esm/kits/interaction/commands.d.ts#L89) |
| `defineContextAssembly` | value | [Declaration](../../../dist/esm/support/context/assembly.d.ts#L15) |
| `defineContextFragments` | value | [Declaration](../../../dist/esm/support/context/assembly.d.ts#L28) |
| `defineEvidenceChecklist` | value | [Declaration](../../../dist/esm/kits/evidence.d.ts#L14) |
| `defineEvidenceProjection` | value | [Declaration](../../../dist/esm/kits/evidence.d.ts#L40) |
| `defineInteractionProtocol` | value | [Declaration](../../../dist/esm/kits/interaction/transfer.d.ts#L65) |
| `definePolicySet` | value | [Declaration](../../../dist/esm/kits/policies.d.ts#L14) |
| `defineRecoveryChain` | value | [Declaration](../../../dist/esm/kits/policies.d.ts#L40) |
| `defineRegistrationCatalog` | value | [Declaration](../../../dist/esm/support/registration.d.ts#L13) |
| `defineRetrieval` | value | [Declaration](../../../dist/esm/kits/retrieval.d.ts#L18) |
| `defineSemanticSlots` | value | [Declaration](../../../dist/esm/kits/presentation/templates.d.ts#L37) |
| `defineTextSkillLoader` | value | [Declaration](../../../dist/esm/kits/text-skills.d.ts#L16) |
| `defineTextTemplate` | value | [Declaration](../../../dist/esm/kits/presentation/templates.d.ts#L21) |
| `defineWorkflow` | value | [Declaration](../../../dist/esm/execution/workflow.d.ts#L151) |
| `DescribedTool` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L42) |
| `DiagnosticContext` | type | [Declaration](../../../dist/esm/structs/diagnostics.d.ts#L243) |
| `diagnosticError` | value | [Declaration](../../../dist/esm/diagnostics/index.d.ts#L27) |
| `DiagnosticIdentity` | type | [Declaration](../../../dist/esm/structs/diagnostics.d.ts#L150) |
| `DiagnosticSpanFields` | type | [Declaration](../../../dist/esm/structs/diagnostics.d.ts#L199) |
| `DomainTool` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L15) |
| `domainToolDelegates` | value | [Declaration](../../../dist/esm/kits/domains/catalog.d.ts#L78) |
| `DomainToolDescription` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L71) |
| `DomainToolId` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L75) |
| `DomainToolPolicy` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L44) |
| `DomainToolRegistration` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L42) |
| `DomainToolRegistry` | value + type | [Declaration](../../../dist/esm/kits/domains/registry.d.ts#L9) |
| `DurationMs` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L17) |
| `encodeSseEvent` | value | [Declaration](../../../dist/esm/support/transport/sse.d.ts#L25) |
| `EngineCacheOptions` | type | [Declaration](../../../dist/esm/structs/execution/cache.d.ts#L6) |
| `ErasedTool` | type | [Declaration](../../../dist/esm/structs/capabilities/tools.d.ts#L54) |
| `EvidenceProjectionDefinition` | type | [Declaration](../../../dist/esm/structs/kits/evidence.d.ts#L36) |
| `EvidenceProjectionProvider` | type | [Declaration](../../../dist/esm/structs/kits/evidence.d.ts#L29) |
| `EvidenceProvider` | type | [Declaration](../../../dist/esm/structs/kits/evidence.d.ts#L21) |
| `EvidenceRequirement` | type | [Declaration](../../../dist/esm/structs/kits/evidence.d.ts#L12) |
| `executeInvocation` | value | [Declaration](../../../dist/esm/capabilities/invocation.d.ts#L17) |
| `ExecutionContext` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L95) |
| `ExecutionEventDescriptor` | type | [Declaration](../../../dist/esm/structs/execution/events.d.ts#L14) |
| `ExecutionObserver` | type | [Declaration](../../../dist/esm/structs/execution/events.d.ts#L17) |
| `ExecutionOptions` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L86) |
| `FunctionCallDelta` | type | [Declaration](../../../dist/esm/structs/model/messages.d.ts#L114) |
| `getErrorInfo` | value | [Declaration](../../../dist/esm/errors.d.ts#L25) |
| `goalDelegates` | value | [Declaration](../../../dist/esm/kits/domains/catalog.d.ts#L78) |
| `GoalDescription` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L71) |
| `GoalId` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L75) |
| `GoalPolicy` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L44) |
| `GoalRegistry` | value + type | [Declaration](../../../dist/esm/kits/domains/registry.d.ts#L9) |
| `GoalTool` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L15) |
| `GoalToolRegistration` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L42) |
| `Id` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L13) |
| `IntentOptions` | type | [Declaration](../../../dist/esm/structs/capabilities/model.d.ts#L20) |
| `INTERACTION_CATEGORIES` | value | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L28) |
| `InteractionCategory` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L26) |
| `InteractionDescriptor` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L30) |
| `InteractionHandlers` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L41) |
| `InteractionProtocol` | value + type | [Declaration](../../../dist/esm/kits/interaction/transfer.d.ts#L11) |
| `InteractionProtocolDefinition` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L128) |
| `InvocationHandler` | type | [Declaration](../../../dist/esm/structs/capabilities/invocation.d.ts#L38) |
| `InvocationMetadata` | type | [Declaration](../../../dist/esm/structs/invocation.d.ts#L13) |
| `InvocationResult` | type | [Declaration](../../../dist/esm/structs/invocation.d.ts#L30) |
| `InvocationStatus` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L23) |
| `Issue` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L36) |
| `JsonFrameLimits` | type | [Declaration](../../../dist/esm/structs/support/transport/json.d.ts#L12) |
| `jsonObjectInteraction` | value | [Declaration](../../../dist/esm/model/interactions/json-object.d.ts#L9) |
| `JsonSchema` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L25) |
| `LegacyAgentCatalogPorts` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L51) |
| `LifecycleContext` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L2) |
| `LifecycleHooks` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L72) |
| `LifecycleProtocol` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L59) |
| `LifecycleRun` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L36) |
| `LifecycleTool` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L131) |
| `LifecycleToolBase` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L112) |
| `LifecycleToolRegistration` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L133) |
| `LoopEvent` | type | [Declaration](../../../dist/esm/structs/execution/engine.d.ts#L13) |
| `matchRule` | value | [Declaration](../../../dist/esm/utils/rules.d.ts#L26) |
| `MatchRule` | type | [Declaration](../../../dist/esm/structs/utils/rules.d.ts#L12) |
| `MaybePromise` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L27) |
| `ModelCallRecord` | type | [Declaration](../../../dist/esm/structs/invocation.d.ts#L35) |
| `ModelCallRequest` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L199) |
| `ModelCallTrace` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L74) |
| `ModelCapabilities` | type | [Declaration](../../../dist/esm/structs/model/messages.d.ts#L45) |
| `ModelChildOptions` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L137) |
| `ModelChildPolicy` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L58) |
| `ModelContentPart` | type | [Declaration](../../../dist/esm/structs/model/messages.d.ts#L28) |
| `ModelContinuation` | type | [Declaration](../../../dist/esm/structs/model/messages.d.ts#L37) |
| `ModelDuplex` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L51) |
| `ModelFunction` | type | [Declaration](../../../dist/esm/structs/model/messages.d.ts#L103) |
| `ModelImage` | type | [Declaration](../../../dist/esm/structs/model/messages.d.ts#L11) |
| `ModelInputMeasurement` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L231) |
| `ModelInteractionAdapter` | type | [Declaration](../../../dist/esm/structs/model/interactions.d.ts#L52) |
| `modelInteractionCatalog` | value | [Declaration](../../../dist/esm/support/model/interactions/index.d.ts#L6) |
| `ModelInteractionDefinition` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L67) |
| `ModelInteractionOptions` | type | [Declaration](../../../dist/esm/structs/model/messages.d.ts#L157) |
| `ModelInteractionRegistration` | type | [Declaration](../../../dist/esm/structs/model/interactions.d.ts#L67) |
| `ModelLifecycleContext` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L2) |
| `ModelLifecycleRun` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L36) |
| `ModelMessage` | type | [Declaration](../../../dist/esm/structs/model/messages.d.ts#L66) |
| `ModelOperationAction` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L7) |
| `ModelOperationHandle` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L10) |
| `ModelOperationPorts` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L43) |
| `ModelOperationProvider` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L32) |
| `ModelOperationRequest` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L19) |
| `ModelOperationResult` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L25) |
| `ModelOperationStatus` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L8) |
| `ModelOptions` | type | [Declaration](../../../dist/esm/structs/model/messages.d.ts#L128) |
| `ModelOutputEvent` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L116) |
| `ModelPart` | type | [Declaration](../../../dist/esm/structs/model/messages.d.ts#L126) |
| `ModelPrepareRequest` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L287) |
| `modelProtocolError` | value | [Declaration](../../../dist/esm/utils/model-protocol.d.ts#L9) |
| `ModelProvider` | type | [Declaration](../../../dist/esm/structs/model/chat-provider.d.ts#L41) |
| `ModelProviderContext` | type | [Declaration](../../../dist/esm/structs/model/chat-provider.d.ts#L14) |
| `ModelProviderErrorCode` | type | [Declaration](../../../dist/esm/structs/support/model/provider.d.ts#L15) |
| `ModelProviderFailure` | type | [Declaration](../../../dist/esm/structs/support/model/provider.d.ts#L37) |
| `ModelRealtimeEvent` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L60) |
| `ModelRealtimeProvider` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L56) |
| `ModelResponseCollector` | type | [Declaration](../../../dist/esm/structs/model/interactions.d.ts#L14) |
| `ModelResult` | type | [Declaration](../../../dist/esm/structs/invocation.d.ts#L55) |
| `ModelRunner` | value + type | [Declaration](../../../dist/esm/model/runner.d.ts#L16) |
| `modelRunnerDefaults` | value | [Declaration](../../../dist/esm/model/defaults.d.ts#L8) |
| `ModelRunnerOptions` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L179) |
| `ModelRunnerPorts` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L120) |
| `ModelRunnerProvider` | type | [Declaration](../../../dist/esm/structs/model/chat-provider.d.ts#L41) |
| `ModelRunnerSettings` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L157) |
| `ModelRuntimeConfig` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L45) |
| `ModelSelection` | type | [Declaration](../../../dist/esm/structs/capabilities/model.d.ts#L58) |
| `ModelStreamEvent` | type | [Declaration](../../../dist/esm/structs/model/messages.d.ts#L52) |
| `ModelTokenBudget` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L29) |
| `ModelTool` | type | [Declaration](../../../dist/esm/structs/capabilities/model.d.ts#L31) |
| `ModelToolCatalog` | type | [Declaration](../../../dist/esm/structs/capabilities/model.d.ts#L88) |
| `ModelToolInteractionOptions` | type | [Declaration](../../../dist/esm/support/model/session.d.ts#L27) |
| `ModelToolInteractionRegistration` | type | [Declaration](../../../dist/esm/support/model/session.d.ts#L33) |
| `ModelToolRegistration` | type | [Declaration](../../../dist/esm/structs/capabilities/model.d.ts#L52) |
| `ModelToolRegistry` | value + type | [Declaration](../../../dist/esm/capabilities/model.d.ts#L4) |
| `ModelToolSelection` | type | [Declaration](../../../dist/esm/structs/capabilities/model.d.ts#L71) |
| `ModelToolSource` | type | [Declaration](../../../dist/esm/structs/capabilities/model.d.ts#L80) |
| `ModelTransportDefinition` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L67) |
| `ModelTransportRegistration` | type | [Declaration](../../../dist/esm/structs/model/interactions.d.ts#L67) |
| `ModelUsage` | type | [Declaration](../../../dist/esm/structs/model/messages.d.ts#L94) |
| `nativeFunctionInteraction` | value | [Declaration](../../../dist/esm/model/interactions/native-functions.d.ts#L8) |
| `NodeAgentCache` | type | [Declaration](../../../dist/esm/structs/execution/cache.d.ts#L43) |
| `NodeCache` | type | [Declaration](../../../dist/esm/structs/execution/cache.d.ts#L15) |
| `NodeReportingContext` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L140) |
| `normalizeDiagnosticEvent` | value | [Declaration](../../../dist/esm/diagnostics/index.d.ts#L41) |
| `Observer` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L19) |
| `openModelRealtime` | value | [Declaration](../../../dist/esm/model/realtime.d.ts#L14) |
| `OperationAction` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L7) |
| `OperationContext` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L109) |
| `OperationStatus` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L8) |
| `parseJsonFrames` | value | [Declaration](../../../dist/esm/support/transport/json.d.ts#L32) |
| `Policy` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L211)；Use ToolLifecyclePolicy. |
| `PolicyAssessment` | type | [Declaration](../../../dist/esm/structs/kits/policies.d.ts#L22) |
| `PolicyDefinition` | type | [Declaration](../../../dist/esm/structs/kits/policies.d.ts#L11) |
| `PreparedModelCall` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L264) |
| `PreparedModelInteraction` | type | [Declaration](../../../dist/esm/structs/model/interactions.d.ts#L45) |
| `PreparedModelSelection` | type | [Declaration](../../../dist/esm/structs/model/interactions.d.ts#L32) |
| `PreparedModelToolInteraction` | type | [Declaration](../../../dist/esm/support/model/session.d.ts#L20) |
| `PreparedSessionTransport` | type | [Declaration](../../../dist/esm/support/model/session.d.ts#L20) |
| `prepareModelToolInteraction` | value | [Declaration](../../../dist/esm/support/model/session.d.ts#L52) |
| `prepareSessionFunctions` | value | [Declaration](../../../dist/esm/support/model/session.d.ts#L52) |
| `ProtocolCheck` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L47) |
| `ProtocolField` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L15) |
| `ProtocolPredicate` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L45) |
| `ProtocolReason` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L43) |
| `ProtocolRegistry` | value + type | [Declaration](../../../dist/esm/utils/protocol-registry.d.ts#L16) |
| `ProtocolShape` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L138) |
| `ProviderReasoningLevel` | type | [Declaration](../../../dist/esm/structs/support/model/provider.d.ts#L45) |
| `ProviderReasoningStrategy` | type | [Declaration](../../../dist/esm/structs/support/model/provider.d.ts#L52) |
| `publishReplyEvents` | value | [Declaration](../../../dist/esm/kits/presentation/events.d.ts#L40) |
| `ReadonlyCatalog` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L60) |
| `readSse` | value | [Declaration](../../../dist/esm/index.d.ts#L35) |
| `RealtimeSessionOptions` | type | [Declaration](../../../dist/esm/model/realtime.d.ts#L4) |
| `RecordedSubStep` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L94) |
| `RecoveryDefinition` | type | [Declaration](../../../dist/esm/structs/kits/policies.d.ts#L40) |
| `RecoveryResult` | type | [Declaration](../../../dist/esm/structs/kits/policies.d.ts#L31) |
| `RegisteredDomainTool` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L82) |
| `RegisteredGoal` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L82) |
| `RegisteredLifecycleTool` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L142) |
| `RegisteredModelTool` | type | [Declaration](../../../dist/esm/structs/capabilities/model.d.ts#L56) |
| `RegisteredProtocol` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L149) |
| `RegisteredScope` | type | [Declaration](../../../dist/esm/structs/kits/domains/scopes.d.ts#L79) |
| `RegisteredScopeEvidence` | type | [Declaration](../../../dist/esm/structs/kits/domains/scopes.d.ts#L67) |
| `RegisteredTool` | type | [Declaration](../../../dist/esm/structs/capabilities/tools.d.ts#L65) |
| `RegisteredToolDefinition` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L142) |
| `RegistrationDefinition` | type | [Declaration](../../../dist/esm/structs/support/registration.d.ts#L11) |
| `Registry` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L76) |
| `REPLY_BUBBLE_BOUNDARY` | value | [Declaration](../../../dist/esm/kits/presentation/events.d.ts#L19) |
| `ReplyBubbleInput` | type | [Declaration](../../../dist/esm/structs/kits/presentation/events.d.ts#L32) |
| `replyBubbleTexts` | value | [Declaration](../../../dist/esm/kits/presentation/events.d.ts#L26) |
| `ReplyDeliveryOptions` | type | [Declaration](../../../dist/esm/structs/kits/presentation/events.d.ts#L39) |
| `ReplyGuidance` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L195) |
| `ReportedStep` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L57) |
| `ReportedStepInput` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L111) |
| `ReportedStepLog` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L130) |
| `ReportedStepProgress` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L148) |
| `ReportedStepRecord` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L94) |
| `ReportedStepRecorder` | value + type | [Declaration](../../../dist/esm/diagnostics/sub-flow.d.ts#L45) |
| `ReportedStepStatus` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L55) |
| `reportedStepStatusCatalog` | value | [Declaration](../../../dist/esm/structs/debug.d.ts#L19) |
| `reportedStepStatuses` | value | [Declaration](../../../dist/esm/structs/debug.d.ts#L53) |
| `ReportedStepUpdate` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L119) |
| `ReportedStepValue` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L90) |
| `requireWorkflowValue` | value | [Declaration](../../../dist/esm/execution/state.d.ts#L22) |
| `RetrievalDefinition` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L96) |
| `RetrievalEffect` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L49) |
| `RetrievalPorts` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L56) |
| `retrievalQueryKey` | value | [Declaration](../../../dist/esm/utils/query-key.d.ts#L12) |
| `RetrievalReason` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L47) |
| `RetrievalReceipt` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L30) |
| `RetrievalResult` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L17) |
| `RetrievalRunner` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L87) |
| `RetrievalSource` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L13) |
| `RetrievalState` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L21) |
| `route` | value | [Declaration](../../../dist/esm/execution/state.d.ts#L195) |
| `runModelOperation` | value | [Declaration](../../../dist/esm/model/operations.d.ts#L4) |
| `RuntimeNodeReportingContext` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L190) |
| `scanJsonObjectFrames` | value | [Declaration](../../../dist/esm/support/transport/json.d.ts#L18) |
| `SchemaAdapter` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L29) |
| `ScopeDefinition` | type | [Declaration](../../../dist/esm/structs/kits/domains/scopes.d.ts#L15) |
| `ScopeDescription` | type | [Declaration](../../../dist/esm/structs/kits/domains/scopes.d.ts#L83) |
| `ScopedReportedStepInput` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L117) |
| `ScopedReportedStepRecorder` | value + type | [Declaration](../../../dist/esm/diagnostics/sub-flow.d.ts#L55) |
| `ScopedSubFlowLogger` | value + type | [Declaration](../../../dist/esm/diagnostics/sub-flow.d.ts#L55) |
| `ScopedSubFlowStepInput` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L117) |
| `ScopeRegistry` | value + type | [Declaration](../../../dist/esm/kits/domains/scopes.d.ts#L17) |
| `ScopeRegistryPolicy` | type | [Declaration](../../../dist/esm/structs/kits/domains/scopes.d.ts#L40) |
| `SearchHit` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L118) |
| `SemanticSlotDefinition` | type | [Declaration](../../../dist/esm/structs/kits/presentation/templates.d.ts#L19) |
| `serializeOutputEvents` | value | [Declaration](../../../dist/esm/kits/presentation/events.d.ts#L53) |
| `SessionFunctionOptions` | type | [Declaration](../../../dist/esm/support/model/session.d.ts#L27) |
| `SessionModelTransportRegistration` | type | [Declaration](../../../dist/esm/support/model/session.d.ts#L33) |
| `SseEvent` | type | [Declaration](../../../dist/esm/index.d.ts#L35) |
| `SseIdleTimeoutError` | value + type | [Declaration](../../../dist/esm/index.d.ts#L35) |
| `SseOutputEvent` | type | [Declaration](../../../dist/esm/structs/support/transport/sse.d.ts#L19) |
| `SseReadOptions` | type | [Declaration](../../../dist/esm/index.d.ts#L35) |
| `SseWriter` | type | [Declaration](../../../dist/esm/structs/support/transport/sse.d.ts#L12) |
| `StepOutcome` | type | [Declaration](../../../dist/esm/structs/execution/engine.d.ts#L26) |
| `SubFlowLog` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L130) |
| `SubFlowLogger` | value + type | [Declaration](../../../dist/esm/diagnostics/sub-flow.d.ts#L45) |
| `SubFlowStepFix` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L119) |
| `SubFlowStepInput` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L111) |
| `SubFlowValue` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L90) |
| `SubStepProgress` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L148) |
| `Support` | value | [Declaration](../../../dist/esm/support/index.d.ts#L10) |
| `textOutputEvents` | value | [Declaration](../../../dist/esm/kits/presentation/events.d.ts#L60) |
| `TextSkill` | type | [Declaration](../../../dist/esm/structs/kits/text-skills.d.ts#L24) |
| `TextSkillHeader` | type | [Declaration](../../../dist/esm/structs/kits/text-skills.d.ts#L31) |
| `TextSkillLoader` | type | [Declaration](../../../dist/esm/structs/kits/text-skills.d.ts#L61) |
| `TextSkillLoaderDefinition` | type | [Declaration](../../../dist/esm/structs/kits/text-skills.d.ts#L36) |
| `TextSkillReadPorts` | type | [Declaration](../../../dist/esm/structs/kits/text-skills.d.ts#L56) |
| `TextSkillRegistration` | type | [Declaration](../../../dist/esm/structs/kits/text-skills.d.ts#L13) |
| `TextTemplateOptions` | type | [Declaration](../../../dist/esm/structs/kits/presentation/templates.d.ts#L10) |
| `TimestampMs` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L15) |
| `Tool` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L219)；Use LifecycleTool and domainToolIds. |
| `ToolCallRecord` | type | [Declaration](../../../dist/esm/structs/invocation.d.ts#L48) |
| `ToolCondition` | type | [Declaration](../../../dist/esm/structs/capabilities/model.d.ts#L29) |
| `ToolContext` | type | [Declaration](../../../dist/esm/structs/capabilities/model.d.ts#L18) |
| `ToolDefinition` | type | [Declaration](../../../dist/esm/structs/capabilities/tools.d.ts#L39) |
| `ToolDomainMembership` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L123) |
| `ToolExecutionContext` | type | [Declaration](../../../dist/esm/structs/capabilities/tools.d.ts#L41) |
| `ToolExecutionEvent` | type | [Declaration](../../../dist/esm/structs/capabilities/tools.d.ts#L67) |
| `ToolFinalizer` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L179) |
| `ToolInvocationPorts` | type | [Declaration](../../../dist/esm/structs/capabilities/invocation.d.ts#L51) |
| `ToolInvocationRequest` | type | [Declaration](../../../dist/esm/structs/capabilities/tools.d.ts#L88) |
| `ToolJournal` | type | [Declaration](../../../dist/esm/structs/capabilities/invocation.d.ts#L31) |
| `ToolLifecycleHooks` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L72) |
| `ToolLifecyclePolicy` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L225) |
| `ToolLifecycleProtocol` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L59) |
| `ToolLifecycleRegistry` | value + type | [Declaration](../../../dist/esm/kits/tools.d.ts#L20) |
| `ToolLifecycleRegistryOptions` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L231) |
| `ToolModelField` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L44) |
| `ToolNormalizer` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L177) |
| `ToolProposal` | type | [Declaration](../../../dist/esm/structs/capabilities/model.d.ts#L13) |
| `ToolProtocol` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L171) |
| `ToolRegistration` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L223)；Use LifecycleToolRegistration. |
| `ToolRegistry` | value + type | [Declaration](../../../dist/esm/capabilities/tools.d.ts#L7) |
| `ToolRegistryOptions` | type | [Declaration](../../../dist/esm/structs/capabilities/tools.d.ts#L99) |
| `ToolRegistryPorts` | type | [Declaration](../../../dist/esm/structs/capabilities/tools.d.ts#L78) |
| `ToolResult` | type | [Declaration](../../../dist/esm/structs/invocation.d.ts#L57) |
| `ToolRuntimeTypes` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L25) |
| `ToolsOptions` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L215)；Use ToolLifecycleRegistryOptions. |
| `transformContextText` | value | [Declaration](../../../dist/esm/support/context/assembly.d.ts#L39) |
| `validateContextBudget` | value | [Declaration](../../../dist/esm/context/fragments.d.ts#L39) |
| `validateContextFragment` | value | [Declaration](../../../dist/esm/context/fragments.d.ts#L26) |
| `ValidationError` | value + type | [Declaration](../../../dist/esm/structs/errors.d.ts#L17) |
| `waitModelOperation` | value | [Declaration](../../../dist/esm/model/operations.d.ts#L6) |
| `WalkRule` | type | [Declaration](../../../dist/esm/structs/utils/rules.d.ts#L22) |
| `walkRules` | value | [Declaration](../../../dist/esm/utils/rules.d.ts#L36) |
| `WorkflowChain` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L62) |
| `WorkflowChainCoverage` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L46) |
| `WorkflowChainNode` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L78) |
| `WorkflowChainNodeEvent` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L98) |
| `WorkflowChainSource` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L57) |
| `WorkflowChainTransition` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L111) |
| `WorkflowContext` | type | [Declaration](../../../dist/esm/structs/execution/workflow.d.ts#L26) |
| `WorkflowContractError` | value + type | [Declaration](../../../dist/esm/structs/errors.d.ts#L38) |
| `WorkflowEvent` | type | [Declaration](../../../dist/esm/structs/execution/workflow.d.ts#L119) |
| `WorkflowExtension` | type | [Declaration](../../../dist/esm/structs/execution/workflow.d.ts#L161) |
| `WorkflowGraph` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L6) |
| `WorkflowGraphEdge` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L37) |
| `WorkflowGraphNode` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L15) |
| `WorkflowGraphRoute` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L28) |
| `WorkflowModel` | type | [Declaration](../../../dist/esm/structs/execution/workflow.d.ts#L175) |
| `WorkflowNode` | type | [Declaration](../../../dist/esm/structs/execution/workflow.d.ts#L73) |
| `WorkflowNodeReport` | type | [Declaration](../../../dist/esm/structs/execution/workflow.d.ts#L66) |
| `WorkflowNodeVisit` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L78) |
| `WorkflowNodeVisitEvent` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L98) |
| `WorkflowReportedStepRecord` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L71) |
| `WorkflowRoute` | type | [Declaration](../../../dist/esm/structs/execution/workflow.d.ts#L50) |
| `WorkflowRunTrace` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L62) |
| `WorkflowRunTraceCoverage` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L46) |
| `WorkflowRunTraceSource` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L57) |
| `WorkflowSubflowRecord` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L71) |
| `WorkflowTransitionRecord` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L111) |
| `writeSseFrame` | value | [Declaration](../../../dist/esm/support/transport/sse.d.ts#L38) |

## @jangts/agent-core/engine

[Contracts and behavior](core.md) · 53 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `AgentBranch` | type | [Declaration](../../../dist/esm/execution/engine.d.ts#L63) |
| `AgentCacheAddress` | type | [Declaration](../../../dist/esm/structs/execution/cache.d.ts#L27) |
| `AgentCacheOptions` | type | [Declaration](../../../dist/esm/structs/execution/cache.d.ts#L23) |
| `AgentCachePort` | type | [Declaration](../../../dist/esm/structs/execution/cache.d.ts#L34) |
| `AgentCheckpoint` | type | [Declaration](../../../dist/esm/execution/engine.d.ts#L83) |
| `AgentCheckpointRecord` | type | [Declaration](../../../dist/esm/execution/engine.d.ts#L94) |
| `AgentCoreEngine` | value + type | [Declaration](../../../dist/esm/execution/engine.d.ts#L110) |
| `AgentCoreEngineOptions` | type | [Declaration](../../../dist/esm/structs/execution/engine.d.ts#L37) |
| `AgentCoreEngineSetup` | type | [Declaration](../../../dist/esm/execution/engine.d.ts#L36) |
| `AgentModelBinding` | type | [Declaration](../../../dist/esm/execution/engine.d.ts#L25) |
| `AgentModelRuntime` | type | [Declaration](../../../dist/esm/execution/engine.d.ts#L15) |
| `AgentSnapshot` | type | [Declaration](../../../dist/esm/execution/engine.d.ts#L83) |
| `AgentSnapshotRecord` | type | [Declaration](../../../dist/esm/execution/engine.d.ts#L94) |
| `AgentWorkflow` | value + type | [Declaration](../../../dist/esm/execution/workflow.d.ts#L9) |
| `AgentWorkflowDefinition` | type | [Declaration](../../../dist/esm/structs/execution/workflow.d.ts#L103) |
| `AttemptBudget` | value + type | [Declaration](../../../dist/esm/execution/workflow.d.ts#L158) |
| `CacheContext` | type | [Declaration](../../../dist/esm/structs/execution/cache.d.ts#L51) |
| `CacheReadOptions` | type | [Declaration](../../../dist/esm/structs/execution/cache.d.ts#L11) |
| `CoreStep` | type | [Declaration](../../../dist/esm/structs/execution/engine.d.ts#L35) |
| `defineWorkflow` | value | [Declaration](../../../dist/esm/execution/workflow.d.ts#L151) |
| `EngineCacheOptions` | type | [Declaration](../../../dist/esm/structs/execution/cache.d.ts#L6) |
| `LoopEvent` | type | [Declaration](../../../dist/esm/structs/execution/engine.d.ts#L13) |
| `NodeAgentCache` | type | [Declaration](../../../dist/esm/structs/execution/cache.d.ts#L43) |
| `NodeCache` | type | [Declaration](../../../dist/esm/structs/execution/cache.d.ts#L15) |
| `requireWorkflowValue` | value | [Declaration](../../../dist/esm/execution/state.d.ts#L22) |
| `route` | value | [Declaration](../../../dist/esm/execution/state.d.ts#L195) |
| `StepOutcome` | type | [Declaration](../../../dist/esm/structs/execution/engine.d.ts#L26) |
| `WorkflowChain` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L62) |
| `WorkflowChainCoverage` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L46) |
| `WorkflowChainNode` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L78) |
| `WorkflowChainNodeEvent` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L98) |
| `WorkflowChainSource` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L57) |
| `WorkflowChainTransition` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L111) |
| `WorkflowContext` | type | [Declaration](../../../dist/esm/structs/execution/workflow.d.ts#L26) |
| `WorkflowContractError` | value + type | [Declaration](../../../dist/esm/structs/errors.d.ts#L38) |
| `WorkflowEvent` | type | [Declaration](../../../dist/esm/structs/execution/workflow.d.ts#L119) |
| `WorkflowExtension` | type | [Declaration](../../../dist/esm/structs/execution/workflow.d.ts#L161) |
| `WorkflowGraph` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L6) |
| `WorkflowGraphEdge` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L37) |
| `WorkflowGraphNode` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L15) |
| `WorkflowGraphRoute` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L28) |
| `WorkflowModel` | type | [Declaration](../../../dist/esm/structs/execution/workflow.d.ts#L175) |
| `WorkflowNode` | type | [Declaration](../../../dist/esm/structs/execution/workflow.d.ts#L73) |
| `WorkflowNodeReport` | type | [Declaration](../../../dist/esm/structs/execution/workflow.d.ts#L66) |
| `WorkflowNodeVisit` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L78) |
| `WorkflowNodeVisitEvent` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L98) |
| `WorkflowReportedStepRecord` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L71) |
| `WorkflowRoute` | type | [Declaration](../../../dist/esm/structs/execution/workflow.d.ts#L50) |
| `WorkflowRunTrace` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L62) |
| `WorkflowRunTraceCoverage` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L46) |
| `WorkflowRunTraceSource` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L57) |
| `WorkflowSubflowRecord` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L71) |
| `WorkflowTransitionRecord` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L111) |

## @jangts/agent-core/model

[Contracts and behavior](core.md) · 18 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `BudgetError` | value + type | [Declaration](../../../dist/esm/structs/errors.d.ts#L29) |
| `ModelCallRequest` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L199) |
| `ModelCallTrace` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L74) |
| `ModelChildOptions` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L137) |
| `ModelChildPolicy` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L58) |
| `ModelInputMeasurement` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L231) |
| `ModelInteractionDefinition` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L67) |
| `ModelOutputEvent` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L116) |
| `ModelPrepareRequest` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L287) |
| `ModelRunner` | value + type | [Declaration](../../../dist/esm/model/runner.d.ts#L16) |
| `ModelRunnerOptions` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L179) |
| `ModelRunnerPorts` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L120) |
| `ModelRunnerSettings` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L157) |
| `ModelRuntimeConfig` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L45) |
| `ModelTokenBudget` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L29) |
| `ModelTransportDefinition` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L67) |
| `PreparedModelCall` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L264) |
| `ReplyGuidance` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L195) |

## @jangts/agent-core/types

[Contracts and behavior](types.md) · 663 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `abortableStream` | type | [Declaration](../../../dist/esm/types.d.ts#L20) |
| `AgentBranch` | type | [Declaration](../../../dist/esm/execution/engine.d.ts#L63) |
| `AgentCacheAddress` | type | [Declaration](../../../dist/esm/structs/execution/cache.d.ts#L27) |
| `AgentCacheOptions` | type | [Declaration](../../../dist/esm/structs/execution/cache.d.ts#L23) |
| `AgentCachePort` | type | [Declaration](../../../dist/esm/structs/execution/cache.d.ts#L34) |
| `AgentCatalogPorts` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L77) |
| `AgentCheckpoint` | type | [Declaration](../../../dist/esm/execution/engine.d.ts#L83) |
| `AgentCheckpointRecord` | type | [Declaration](../../../dist/esm/execution/engine.d.ts#L94) |
| `AgentCoreEngine` | type | [Declaration](../../../dist/esm/execution/engine.d.ts#L110) |
| `AgentCoreEngineOptions` | type | [Declaration](../../../dist/esm/structs/execution/engine.d.ts#L37) |
| `AgentCoreEngineSetup` | type | [Declaration](../../../dist/esm/execution/engine.d.ts#L36) |
| `AgentErrorInfo` | type | [Declaration](../../../dist/esm/structs/errors.d.ts#L46) |
| `AgentFamily` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L86) |
| `AgentModelBinding` | type | [Declaration](../../../dist/esm/execution/engine.d.ts#L25) |
| `AgentModelRuntime` | type | [Declaration](../../../dist/esm/execution/engine.d.ts#L15) |
| `AgentOutputEvent` | type | [Declaration](../../../dist/esm/structs/kits/presentation/events.d.ts#L11) |
| `AgentSnapshot` | type | [Declaration](../../../dist/esm/execution/engine.d.ts#L83) |
| `AgentSnapshotRecord` | type | [Declaration](../../../dist/esm/execution/engine.d.ts#L94) |
| `AgentWorkflow` | type | [Declaration](../../../dist/esm/execution/workflow.d.ts#L9) |
| `AgentWorkflowDefinition` | type | [Declaration](../../../dist/esm/structs/execution/workflow.d.ts#L103) |
| `aggregateBranchResults` | type | [Declaration](../../../dist/esm/kits/aggregation.d.ts#L55) |
| `Aggregation` | type | [Declaration](../../../dist/esm/kits/aggregation.d.ts#L58) |
| `AnswerCheck` | type | [Declaration](../../../dist/esm/structs/kits/answering/flow.d.ts#L16) |
| `AnswerChecker` | type | [Declaration](../../../dist/esm/structs/kits/answering/checks.d.ts#L11) |
| `AnswerFlowDefinition` | type | [Declaration](../../../dist/esm/structs/kits/answering/flow.d.ts#L45) |
| `Answering` | type | [Declaration](../../../dist/esm/kits/answering/index.d.ts#L21) |
| `AnswerIssue` | type | [Declaration](../../../dist/esm/structs/kits/answering/flow.d.ts#L13) |
| `AnswerItem` | type | [Declaration](../../../dist/esm/structs/kits/answering/flow.d.ts#L19) |
| `AnswerReader` | type | [Declaration](../../../dist/esm/structs/kits/answering/tasks.d.ts#L38) |
| `AnswerResult` | type | [Declaration](../../../dist/esm/structs/kits/answering/flow.d.ts#L30) |
| `AnswerTaskBase` | type | [Declaration](../../../dist/esm/structs/kits/answering/tasks.d.ts#L11) |
| `AnswerTaskDefinition` | type | [Declaration](../../../dist/esm/structs/kits/answering/tasks.d.ts#L30) |
| `AnswerTaskPorts` | type | [Declaration](../../../dist/esm/structs/kits/answering/tasks.d.ts#L46) |
| `applyMemoryUpdate` | type | [Declaration](../../../dist/esm/kits/memory.d.ts#L131) |
| `ArtifactReference` | type | [Declaration](../../../dist/esm/structs/kits/artifacts.d.ts#L12) |
| `ArtifactResolver` | type | [Declaration](../../../dist/esm/structs/kits/artifacts.d.ts#L21) |
| `Artifacts` | type | [Declaration](../../../dist/esm/kits/artifacts.d.ts#L40) |
| `AsIntent` | type | [Declaration](../../../dist/esm/structs/capabilities/model.d.ts#L27) |
| `assembleContextPlan` | type | [Declaration](../../../dist/esm/context/plan.d.ts#L14) |
| `assembleFragments` | type | [Declaration](../../../dist/esm/context/assembly.d.ts#L14) |
| `AsyncSink` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L21) |
| `AttemptBudget` | type | [Declaration](../../../dist/esm/execution/workflow.d.ts#L158) |
| `batchMemorySources` | type | [Declaration](../../../dist/esm/kits/memory.d.ts#L149) |
| `bindInteraction` | type | [Declaration](../../../dist/esm/kits/interaction/handlers.d.ts#L21) |
| `bindReviewChoiceDecision` | type | [Declaration](../../../dist/esm/kits/review-choice.d.ts#L9) |
| `BoundModelProvider` | type | [Declaration](../../../dist/esm/structs/model/chat-provider.d.ts#L51) |
| `BranchAggregationRequest` | type | [Declaration](../../../dist/esm/structs/kits/aggregation.d.ts#L29) |
| `BranchAggregationResult` | type | [Declaration](../../../dist/esm/structs/kits/aggregation.d.ts#L34) |
| `BranchResult` | type | [Declaration](../../../dist/esm/structs/kits/aggregation.d.ts#L19) |
| `BranchVersion` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L19) |
| `BranchVersioning` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L86) |
| `BranchVersioningDefinition` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L56) |
| `BranchVersionOperation` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L17) |
| `branchVersionOperations` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L15) |
| `BranchVersionRecord` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L36) |
| `BranchVersions` | type | [Declaration](../../../dist/esm/kits/family.d.ts#L19) |
| `BranchVersionStore` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L49) |
| `BreakCheck` | type | [Declaration](../../../dist/esm/structs/utils/rules.d.ts#L33) |
| `BreakEvent` | type | [Declaration](../../../dist/esm/structs/utils/rules.d.ts#L42) |
| `BreakPredicate` | type | [Declaration](../../../dist/esm/structs/utils/rules.d.ts#L31) |
| `BreakReason` | type | [Declaration](../../../dist/esm/structs/utils/rules.d.ts#L29) |
| `breakWhile` | type | [Declaration](../../../dist/esm/utils/rules.d.ts#L56) |
| `BreakWhileConfig` | type | [Declaration](../../../dist/esm/structs/utils/rules.d.ts#L49) |
| `BudgetError` | type | [Declaration](../../../dist/esm/structs/errors.d.ts#L29) |
| `BuiltContext` | type | [Declaration](../../../dist/esm/structs/context/fragments.d.ts#L45) |
| `CacheContext` | type | [Declaration](../../../dist/esm/structs/execution/cache.d.ts#L51) |
| `CacheReadOptions` | type | [Declaration](../../../dist/esm/structs/execution/cache.d.ts#L11) |
| `Candidates` | type | [Declaration](../../../dist/esm/kits/candidates.d.ts#L35) |
| `CandidateSelectionDefinition` | type | [Declaration](../../../dist/esm/structs/kits/candidates.d.ts#L16) |
| `CapabilityCatalogOptions` | type | [Declaration](../../../dist/esm/structs/support/capabilities.d.ts#L31) |
| `CapabilityModule` | type | [Declaration](../../../dist/esm/structs/support/capabilities.d.ts#L20) |
| `CapabilityToolReferences` | type | [Declaration](../../../dist/esm/structs/support/capabilities.d.ts#L11) |
| `CatalogDomainTool` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L12) |
| `CatalogExecutionTool` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L29) |
| `CatalogGoal` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L12) |
| `CatalogScope` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L17) |
| `CatalogTask` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L22) |
| `CatalogTool` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L29) |
| `chatCompletionFunctionOptions` | type | [Declaration](../../../dist/esm/support/model/chat-completions.d.ts#L22) |
| `chatCompletionMessages` | type | [Declaration](../../../dist/esm/support/model/chat-completions.d.ts#L47) |
| `chatCompletionParts` | type | [Declaration](../../../dist/esm/support/model/chat-completions.d.ts#L33) |
| `ChatProvider` | type | [Declaration](../../../dist/esm/structs/model/chat-provider.d.ts#L24) |
| `CheckResult` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L52) |
| `checkReviewAdmission` | type | [Declaration](../../../dist/esm/kits/result-review.d.ts#L5) |
| `Command` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L93) |
| `CommandCatalog` | type | [Declaration](../../../dist/esm/kits/interaction/commands.d.ts#L19) |
| `CommandCatalogOptions` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L115) |
| `CommandDefinition` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L58) |
| `commandSchema` | type | [Declaration](../../../dist/esm/kits/interaction/command.d.ts#L41) |
| `commonPrefixLength` | type | [Declaration](../../../dist/esm/utils/text.d.ts#L16) |
| `CompatibleModelConfig` | type | [Declaration](../../../dist/esm/structs/support/model/provider.d.ts#L74) |
| `CompatibleModelPorts` | type | [Declaration](../../../dist/esm/structs/support/model/provider.d.ts#L98) |
| `CompatibleModelProvider` | type | [Declaration](../../../dist/esm/support/model/compatible-provider.d.ts#L11) |
| `CompatibleModelProviderOptions` | type | [Declaration](../../../dist/esm/structs/support/model/provider.d.ts#L118) |
| `compileCommands` | type | [Declaration](../../../dist/esm/kits/interaction/command.d.ts#L28) |
| `CompiledReplyFormat` | type | [Declaration](../../../dist/esm/structs/kits/presentation/formats.d.ts#L31) |
| `CompiledTool` | type | [Declaration](../../../dist/esm/structs/support/tools.d.ts#L43) |
| `completeMemoryReview` | type | [Declaration](../../../dist/esm/kits/memory.d.ts#L156) |
| `CompletionCheck` | type | [Declaration](../../../dist/esm/kits/completion.d.ts#L18) |
| `CompletionDecision` | type | [Declaration](../../../dist/esm/kits/completion.d.ts#L7) |
| `CompletionReport` | type | [Declaration](../../../dist/esm/kits/completion.d.ts#L24) |
| `configureBreakWhile` | type | [Declaration](../../../dist/esm/utils/break-observer.d.ts#L19) |
| `ContentProjection` | type | [Declaration](../../../dist/esm/structs/kits/projection.d.ts#L11) |
| `ContentProjectionOptions` | type | [Declaration](../../../dist/esm/structs/kits/projection.d.ts#L18) |
| `ContextAssemblyOptions` | type | [Declaration](../../../dist/esm/structs/support/context.d.ts#L35) |
| `ContextBuilder` | type | [Declaration](../../../dist/esm/structs/support/context.d.ts#L49) |
| `ContextBuilderOptions` | type | [Declaration](../../../dist/esm/structs/support/context.d.ts#L28) |
| `ContextFragment` | type | [Declaration](../../../dist/esm/structs/context/fragments.d.ts#L17) |
| `ContextFragmentConfig` | type | [Declaration](../../../dist/esm/structs/support/context.d.ts#L42) |
| `ContextFragmentUsage` | type | [Declaration](../../../dist/esm/structs/context/fragments.d.ts#L34) |
| `ContextJournal` | type | [Declaration](../../../dist/esm/context/journal.d.ts#L5) |
| `ContextLifetime` | type | [Declaration](../../../dist/esm/structs/context/fragments.d.ts#L15) |
| `ContextPlan` | type | [Declaration](../../../dist/esm/structs/context/processing.d.ts#L13) |
| `ContextProjection` | type | [Declaration](../../../dist/esm/structs/support/context.d.ts#L15) |
| `ContextRecord` | type | [Declaration](../../../dist/esm/structs/context/journal.d.ts#L26) |
| `ContextTrust` | type | [Declaration](../../../dist/esm/structs/context/fragments.d.ts#L13) |
| `CoreDiagnosticRecord` | type | [Declaration](../../../dist/esm/structs/diagnostics.d.ts#L279) |
| `CoreEvent` | type | [Declaration](../../../dist/esm/structs/diagnostics.d.ts#L207) |
| `coreEventCatalog` | type | [Declaration](../../../dist/esm/diagnostics/catalog.d.ts#L7) |
| `CoreEventDescriptor` | type | [Declaration](../../../dist/esm/structs/diagnostics.d.ts#L145) |
| `CoreEventName` | type | [Declaration](../../../dist/esm/structs/diagnostics.d.ts#L138) |
| `CoreEventPayloads` | type | [Declaration](../../../dist/esm/structs/diagnostics.d.ts#L17) |
| `CoreLogOutput` | type | [Declaration](../../../dist/esm/structs/diagnostics.d.ts#L232) |
| `CoreStep` | type | [Declaration](../../../dist/esm/structs/execution/engine.d.ts#L35) |
| `createDiagnostics` | type | [Declaration](../../../dist/esm/diagnostics/index.d.ts#L18) |
| `CreateDiagnosticsOptions` | type | [Declaration](../../../dist/esm/structs/diagnostics.d.ts#L266) |
| `createDomainToolRegistry` | type | [Declaration](../../../dist/esm/kits/domains/registry.d.ts#L105) |
| `createGoalRegistry` | type | [Declaration](../../../dist/esm/kits/domains/registry.d.ts#L105) |
| `createJsonInteraction` | type | [Declaration](../../../dist/esm/support/model/transports.d.ts#L43) |
| `createJsonTransport` | type | [Declaration](../../../dist/esm/support/model/transports.d.ts#L43) |
| `createModelInteraction` | type | [Declaration](../../../dist/esm/support/model/transports.d.ts#L6) |
| `createModelTransport` | type | [Declaration](../../../dist/esm/support/model/transports.d.ts#L6) |
| `createScopeRegistry` | type | [Declaration](../../../dist/esm/kits/domains/scopes.d.ts#L165) |
| `createTextInteraction` | type | [Declaration](../../../dist/esm/support/model/transports.d.ts#L24) |
| `createTextTransport` | type | [Declaration](../../../dist/esm/support/model/transports.d.ts#L24) |
| `DebugStepsOutput` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L169) |
| `DecodedModelResponseToolCall` | type | [Declaration](../../../dist/esm/support/model/session.d.ts#L7) |
| `DecodedModelToolResponse` | type | [Declaration](../../../dist/esm/support/model/session.d.ts#L16) |
| `DecodedSessionCall` | type | [Declaration](../../../dist/esm/support/model/session.d.ts#L7) |
| `DecodedSessionResult` | type | [Declaration](../../../dist/esm/support/model/session.d.ts#L16) |
| `defineAgentCatalog` | type | [Declaration](../../../dist/esm/kits/domains/catalog.d.ts#L16) |
| `defineAgentFamily` | type | [Declaration](../../../dist/esm/kits/family.d.ts#L17) |
| `defineAnswerCheckCatalog` | type | [Declaration](../../../dist/esm/kits/answering/checks.d.ts#L15) |
| `defineAnswerFlow` | type | [Declaration](../../../dist/esm/kits/answering/flow.d.ts#L17) |
| `defineAnswerReaderCatalog` | type | [Declaration](../../../dist/esm/kits/answering/tasks.d.ts#L10) |
| `defineAnswerTaskCatalog` | type | [Declaration](../../../dist/esm/kits/answering/tasks.d.ts#L30) |
| `defineArtifactCatalog` | type | [Declaration](../../../dist/esm/kits/artifacts.d.ts#L13) |
| `defineBranchVersioning` | type | [Declaration](../../../dist/esm/kits/family.d.ts#L17) |
| `defineCandidateSelection` | type | [Declaration](../../../dist/esm/kits/candidates.d.ts#L24) |
| `defineCommand` | type | [Declaration](../../../dist/esm/kits/interaction/command.d.ts#L15) |
| `defineCommandCatalog` | type | [Declaration](../../../dist/esm/kits/interaction/commands.d.ts#L89) |
| `defineCompletionChecks` | type | [Declaration](../../../dist/esm/kits/completion.d.ts#L36) |
| `defineContentProjection` | type | [Declaration](../../../dist/esm/kits/projection.d.ts#L15) |
| `defineContextAssembly` | type | [Declaration](../../../dist/esm/support/context/assembly.d.ts#L15) |
| `defineContextFragments` | type | [Declaration](../../../dist/esm/support/context/assembly.d.ts#L28) |
| `defineDelivery` | type | [Declaration](../../../dist/esm/kits/delivery.d.ts#L47)；Use defineDeliveryPipeline. |
| `defineDeliveryPipeline` | type | [Declaration](../../../dist/esm/kits/delivery.d.ts#L16) |
| `defineDurableTask` | type | [Declaration](../../../dist/esm/kits/durable.d.ts#L19) |
| `defineEvidenceChecklist` | type | [Declaration](../../../dist/esm/kits/evidence.d.ts#L14) |
| `defineEvidenceProjection` | type | [Declaration](../../../dist/esm/kits/evidence.d.ts#L40) |
| `defineInteractionProtocol` | type | [Declaration](../../../dist/esm/kits/interaction/transfer.d.ts#L65) |
| `defineKnowledgeCatalog` | type | [Declaration](../../../dist/esm/kits/knowledge/catalog.d.ts#L15) |
| `defineKnowledgePublication` | type | [Declaration](../../../dist/esm/kits/knowledge/publication.d.ts#L17) |
| `defineNormalization` | type | [Declaration](../../../dist/esm/kits/normalization.d.ts#L15) |
| `defineOutputCatalog` | type | [Declaration](../../../dist/esm/kits/presentation/outputs.d.ts#L16) |
| `definePolicySet` | type | [Declaration](../../../dist/esm/kits/policies.d.ts#L14) |
| `defineQueryAggregation` | type | [Declaration](../../../dist/esm/kits/aggregation.d.ts#L29) |
| `defineRecoveryChain` | type | [Declaration](../../../dist/esm/kits/policies.d.ts#L40) |
| `defineReflection` | type | [Declaration](../../../dist/esm/kits/reflection.d.ts#L16) |
| `defineReflectionLogSource` | type | [Declaration](../../../dist/esm/kits/reflection-log-source.d.ts#L63) |
| `defineRegistrationCatalog` | type | [Declaration](../../../dist/esm/support/registration.d.ts#L13) |
| `defineReplyFormats` | type | [Declaration](../../../dist/esm/kits/presentation/formats.d.ts#L38) |
| `defineResultReview` | type | [Declaration](../../../dist/esm/kits/result-review.d.ts#L3) |
| `defineRetrieval` | type | [Declaration](../../../dist/esm/kits/retrieval.d.ts#L18) |
| `defineReviewDecision` | type | [Declaration](../../../dist/esm/kits/review-decision.d.ts#L3) |
| `defineSemanticSlots` | type | [Declaration](../../../dist/esm/kits/presentation/templates.d.ts#L37) |
| `defineTextSkillLoader` | type | [Declaration](../../../dist/esm/kits/text-skills.d.ts#L16) |
| `defineTextTemplate` | type | [Declaration](../../../dist/esm/kits/presentation/templates.d.ts#L21) |
| `defineTreeProjection` | type | [Declaration](../../../dist/esm/kits/projection.d.ts#L48) |
| `defineWaitGate` | type | [Declaration](../../../dist/esm/kits/waiting.d.ts#L6) |
| `defineWorkflow` | type | [Declaration](../../../dist/esm/execution/workflow.d.ts#L151) |
| `Delivery` | type | [Declaration](../../../dist/esm/kits/delivery.d.ts#L41)；Use DeliveryPipeline. Same immutable namespace and implementation. |
| `DeliveryOptions` | type | [Declaration](../../../dist/esm/structs/kits/delivery.d.ts#L41)；Use DeliveryPipelineOptions. |
| `DeliveryPipeline` | type | [Declaration](../../../dist/esm/kits/delivery.d.ts#L35) |
| `DeliveryPipelineOptions` | type | [Declaration](../../../dist/esm/structs/kits/delivery.d.ts#L25) |
| `DeliveryPipelineStage` | type | [Declaration](../../../dist/esm/structs/kits/delivery.d.ts#L13) |
| `DeliveryStage` | type | [Declaration](../../../dist/esm/structs/kits/delivery.d.ts#L39)；Use DeliveryPipelineStage. |
| `DescribedTool` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L42) |
| `DiagnosticContext` | type | [Declaration](../../../dist/esm/structs/diagnostics.d.ts#L243) |
| `diagnosticError` | type | [Declaration](../../../dist/esm/diagnostics/index.d.ts#L27) |
| `DiagnosticIdentity` | type | [Declaration](../../../dist/esm/structs/diagnostics.d.ts#L150) |
| `DiagnosticSpanFields` | type | [Declaration](../../../dist/esm/structs/diagnostics.d.ts#L199) |
| `DomainTool` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L15) |
| `domainToolDelegates` | type | [Declaration](../../../dist/esm/kits/domains/catalog.d.ts#L78) |
| `DomainToolDescription` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L71) |
| `DomainToolId` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L75) |
| `DomainToolPolicy` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L44) |
| `DomainToolRegistration` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L42) |
| `DomainToolRegistry` | type | [Declaration](../../../dist/esm/kits/domains/registry.d.ts#L9) |
| `Durable` | type | [Declaration](../../../dist/esm/kits/durable.d.ts#L22) |
| `DurableAuthorizationContext` | type | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L97) |
| `DurableCheckpoint` | type | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L24) |
| `DurableReconcileContext` | type | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L93) |
| `DurableReconciliation` | type | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L72) |
| `durableReplayPolicies` | type | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L22) |
| `durableStatuses` | type | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L15) |
| `DurableStep` | type | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L61) |
| `DurableStepContext` | type | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L82) |
| `DurableStore` | type | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L52) |
| `DurableTask` | type | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L120) |
| `DurableTaskDefinition` | type | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L101) |
| `DurableTaskOptions` | type | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L113) |
| `DurationMs` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L17) |
| `encodeSseEvent` | type | [Declaration](../../../dist/esm/support/transport/sse.d.ts#L25) |
| `EngineCacheOptions` | type | [Declaration](../../../dist/esm/structs/execution/cache.d.ts#L6) |
| `ErasedTool` | type | [Declaration](../../../dist/esm/structs/capabilities/tools.d.ts#L54) |
| `ErrorContext` | type | [Declaration](../../../dist/esm/structs/errors.d.ts#L61) |
| `Evidence` | type | [Declaration](../../../dist/esm/kits/evidence.d.ts#L48) |
| `EvidenceProjectionDefinition` | type | [Declaration](../../../dist/esm/structs/kits/evidence.d.ts#L36) |
| `EvidenceProjectionProvider` | type | [Declaration](../../../dist/esm/structs/kits/evidence.d.ts#L29) |
| `EvidenceProvider` | type | [Declaration](../../../dist/esm/structs/kits/evidence.d.ts#L21) |
| `EvidenceRequirement` | type | [Declaration](../../../dist/esm/structs/kits/evidence.d.ts#L12) |
| `ExecutableTool` | type | [Declaration](../../../dist/esm/structs/capabilities/tools.d.ts#L18) |
| `executeInvocation` | type | [Declaration](../../../dist/esm/capabilities/invocation.d.ts#L17) |
| `ExecutionContext` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L95) |
| `ExecutionEventDescriptor` | type | [Declaration](../../../dist/esm/structs/execution/events.d.ts#L14) |
| `ExecutionObserver` | type | [Declaration](../../../dist/esm/structs/execution/events.d.ts#L17) |
| `ExecutionOptions` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L86) |
| `Family` | type | [Declaration](../../../dist/esm/kits/family.d.ts#L19) |
| `FamilyDefinition` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L56) |
| `FamilyOperation` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L17) |
| `familyOperations` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L15) |
| `FamilyRecord` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L36) |
| `FamilyStore` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L49) |
| `FamilyVersion` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L19) |
| `FunctionCallDelta` | type | [Declaration](../../../dist/esm/structs/model/messages.d.ts#L114) |
| `FusedRank` | type | [Declaration](../../../dist/esm/kits/rank-fusion.d.ts#L11) |
| `getErrorInfo` | type | [Declaration](../../../dist/esm/errors.d.ts#L25) |
| `goalDelegates` | type | [Declaration](../../../dist/esm/kits/domains/catalog.d.ts#L78) |
| `GoalDescription` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L71) |
| `GoalId` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L75) |
| `GoalPolicy` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L44) |
| `GoalRegistry` | type | [Declaration](../../../dist/esm/kits/domains/registry.d.ts#L9) |
| `GoalTool` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L15) |
| `GoalToolRegistration` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L42) |
| `Id` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L13) |
| `inspectReviewChoices` | type | [Declaration](../../../dist/esm/kits/review-choice.d.ts#L7) |
| `IntentOptions` | type | [Declaration](../../../dist/esm/structs/capabilities/model.d.ts#L20) |
| `Interaction` | type | [Declaration](../../../dist/esm/kits/interaction/transfer.d.ts#L11) |
| `INTERACTION_CATEGORIES` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L28) |
| `InteractionCategory` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L26) |
| `InteractionDescriptor` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L30) |
| `InteractionHandlers` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L41) |
| `InteractionProtocol` | type | [Declaration](../../../dist/esm/kits/interaction/transfer.d.ts#L11) |
| `InteractionProtocolDefinition` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L128) |
| `InvocationHandler` | type | [Declaration](../../../dist/esm/structs/capabilities/invocation.d.ts#L38) |
| `InvocationMetadata` | type | [Declaration](../../../dist/esm/structs/invocation.d.ts#L13) |
| `InvocationResult` | type | [Declaration](../../../dist/esm/structs/invocation.d.ts#L30) |
| `InvocationStatus` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L23) |
| `isMemoryState` | type | [Declaration](../../../dist/esm/kits/memory.d.ts#L59) |
| `isReviewChoice` | type | [Declaration](../../../dist/esm/kits/review-choice.d.ts#L5) |
| `isReviewChoiceAnswer` | type | [Declaration](../../../dist/esm/kits/review-choice.d.ts#L3) |
| `Issue` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L36) |
| `JsonFrameLimits` | type | [Declaration](../../../dist/esm/structs/support/transport/json.d.ts#L12) |
| `jsonObjectInteraction` | type | [Declaration](../../../dist/esm/model/interactions/json-object.d.ts#L9) |
| `JsonSchema` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L25) |
| `JsonSchemaOptions` | type | [Declaration](../../../dist/esm/structs/support/schema.d.ts#L18) |
| `JsonSchemaValidator` | type | [Declaration](../../../dist/esm/structs/support/schema.d.ts#L11) |
| `JsonTransportPart` | type | [Declaration](../../../dist/esm/structs/support/transport/json.d.ts#L21) |
| `Knowledge` | type | [Declaration](../../../dist/esm/kits/knowledge/index.d.ts#L18) |
| `KnowledgeCandidate` | type | [Declaration](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L26) |
| `KnowledgeCatalog` | type | [Declaration](../../../dist/esm/structs/kits/knowledge.d.ts#L67) |
| `KnowledgeCatalogOptions` | type | [Declaration](../../../dist/esm/structs/kits/knowledge.d.ts#L60) |
| `KnowledgeDocument` | type | [Declaration](../../../dist/esm/structs/kits/knowledge.d.ts#L22) |
| `KnowledgePart` | type | [Declaration](../../../dist/esm/structs/kits/knowledge.d.ts#L20) |
| `KnowledgePublication` | type | [Declaration](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L76) |
| `knowledgePublicationOperations` | type | [Declaration](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L15) |
| `KnowledgePublicationOptions` | type | [Declaration](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L58) |
| `KnowledgePublicationRecord` | type | [Declaration](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L40) |
| `KnowledgePublicationStore` | type | [Declaration](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L51) |
| `KnowledgeRead` | type | [Declaration](../../../dist/esm/structs/kits/knowledge.d.ts#L44) |
| `KnowledgeSection` | type | [Declaration](../../../dist/esm/structs/kits/knowledge.d.ts#L13) |
| `KnowledgeSnapshot` | type | [Declaration](../../../dist/esm/structs/kits/knowledge.d.ts#L50) |
| `KnowledgeSourceReference` | type | [Declaration](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L17) |
| `LegacyAgentCatalogPorts` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L51) |
| `LifecycleContext` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L2) |
| `LifecycleHooks` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L72) |
| `LifecycleProtocol` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L59) |
| `LifecycleRun` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L36) |
| `LifecycleTool` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L131) |
| `LifecycleToolBase` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L112) |
| `LifecycleToolRegistration` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L133) |
| `LoopEvent` | type | [Declaration](../../../dist/esm/structs/execution/engine.d.ts#L13) |
| `matchRule` | type | [Declaration](../../../dist/esm/utils/rules.d.ts#L26) |
| `MatchRule` | type | [Declaration](../../../dist/esm/structs/utils/rules.d.ts#L12) |
| `MaybePromise` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L27) |
| `memoryContext` | type | [Declaration](../../../dist/esm/kits/memory.d.ts#L135) |
| `MemoryEntry` | type | [Declaration](../../../dist/esm/kits/memory.d.ts#L24) |
| `memoryModelView` | type | [Declaration](../../../dist/esm/kits/memory.d.ts#L158) |
| `MemoryOperation` | type | [Declaration](../../../dist/esm/kits/memory.d.ts#L11) |
| `memoryReviewBatch` | type | [Declaration](../../../dist/esm/kits/memory.d.ts#L154) |
| `MemorySource` | type | [Declaration](../../../dist/esm/kits/memory.d.ts#L1) |
| `MemoryState` | type | [Declaration](../../../dist/esm/kits/memory.d.ts#L47) |
| `memoryUpdateInstruction` | type | [Declaration](../../../dist/esm/kits/memory.d.ts#L147) |
| `memoryUpdateSchema` | type | [Declaration](../../../dist/esm/kits/memory.d.ts#L61) |
| `mergeByKey` | type | [Declaration](../../../dist/esm/kits/aggregation.d.ts#L14) |
| `mergeReplyBubbles` | type | [Declaration](../../../dist/esm/kits/presentation/formats.d.ts#L29) |
| `ModelAssistantToolMessage` | type | [Declaration](../../../dist/esm/structs/model/messages.d.ts#L80) |
| `ModelBinding` | type | [Declaration](../../../dist/esm/kits/inference.d.ts#L15) |
| `ModelCallRecord` | type | [Declaration](../../../dist/esm/structs/invocation.d.ts#L35) |
| `ModelCallRequest` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L199) |
| `ModelCalls` | type | [Declaration](../../../dist/esm/kits/inference.d.ts#L61) |
| `ModelCallTrace` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L74) |
| `ModelCapabilities` | type | [Declaration](../../../dist/esm/structs/model/messages.d.ts#L45) |
| `ModelChildOptions` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L137) |
| `ModelChildPolicy` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L58) |
| `ModelChoiceIndex` | type | [Declaration](../../../dist/esm/structs/support/model/provider.d.ts#L113) |
| `ModelContentPart` | type | [Declaration](../../../dist/esm/structs/model/messages.d.ts#L28) |
| `ModelContinuation` | type | [Declaration](../../../dist/esm/structs/model/messages.d.ts#L37) |
| `ModelDuplex` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L51) |
| `ModelFunction` | type | [Declaration](../../../dist/esm/structs/model/messages.d.ts#L103) |
| `ModelImage` | type | [Declaration](../../../dist/esm/structs/model/messages.d.ts#L11) |
| `ModelInputMeasurement` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L231) |
| `ModelInteractionAdapter` | type | [Declaration](../../../dist/esm/structs/model/interactions.d.ts#L52) |
| `modelInteractionCatalog` | type | [Declaration](../../../dist/esm/support/model/interactions/index.d.ts#L6) |
| `ModelInteractionDefinition` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L67) |
| `ModelInteractionOptions` | type | [Declaration](../../../dist/esm/structs/model/messages.d.ts#L157) |
| `ModelInteractionRegistration` | type | [Declaration](../../../dist/esm/structs/model/interactions.d.ts#L67) |
| `ModelInvocationContext` | type | [Declaration](../../../dist/esm/kits/inference.d.ts#L28) |
| `ModelInvocationRequest` | type | [Declaration](../../../dist/esm/kits/inference.d.ts#L37) |
| `ModelLifecycleContext` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L2) |
| `ModelLifecycleRun` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L36) |
| `ModelMessage` | type | [Declaration](../../../dist/esm/structs/model/messages.d.ts#L66) |
| `ModelOperationAction` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L7) |
| `ModelOperationHandle` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L10) |
| `ModelOperationPorts` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L43) |
| `ModelOperationProvider` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L32) |
| `ModelOperationRequest` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L19) |
| `ModelOperationResult` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L25) |
| `ModelOperationStatus` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L8) |
| `ModelOptions` | type | [Declaration](../../../dist/esm/structs/model/messages.d.ts#L128) |
| `ModelOutputEvent` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L116) |
| `ModelPart` | type | [Declaration](../../../dist/esm/structs/model/messages.d.ts#L126) |
| `ModelPrepareRequest` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L287) |
| `modelProtocolError` | type | [Declaration](../../../dist/esm/utils/model-protocol.d.ts#L9) |
| `ModelProvider` | type | [Declaration](../../../dist/esm/structs/model/chat-provider.d.ts#L41) |
| `ModelProviderContext` | type | [Declaration](../../../dist/esm/structs/model/chat-provider.d.ts#L14) |
| `ModelProviderErrorCode` | type | [Declaration](../../../dist/esm/structs/support/model/provider.d.ts#L15) |
| `ModelProviderFailure` | type | [Declaration](../../../dist/esm/structs/support/model/provider.d.ts#L37) |
| `ModelRealtimeEvent` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L60) |
| `ModelRealtimeProvider` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L56) |
| `ModelResponseCollector` | type | [Declaration](../../../dist/esm/structs/model/interactions.d.ts#L14) |
| `ModelResponseToolCall` | type | [Declaration](../../../dist/esm/structs/model/session.d.ts#L11) |
| `ModelResult` | type | [Declaration](../../../dist/esm/structs/invocation.d.ts#L55) |
| `ModelRunner` | type | [Declaration](../../../dist/esm/model/runner.d.ts#L16) |
| `ModelRunnerBudgetSnapshot` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L298) |
| `modelRunnerDefaults` | type | [Declaration](../../../dist/esm/model/defaults.d.ts#L8) |
| `ModelRunnerOptions` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L179) |
| `ModelRunnerPorts` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L120) |
| `ModelRunnerProvider` | type | [Declaration](../../../dist/esm/structs/model/chat-provider.d.ts#L41) |
| `ModelRunnerSettings` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L157) |
| `ModelRuntimeConfig` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L45) |
| `ModelSelection` | type | [Declaration](../../../dist/esm/structs/capabilities/model.d.ts#L58) |
| `ModelSessionCall` | type | [Declaration](../../../dist/esm/structs/model/session.d.ts#L11) |
| `ModelSessionResult` | type | [Declaration](../../../dist/esm/structs/model/session.d.ts#L24) |
| `ModelStageInteractionRegistration` | type | [Declaration](../../../dist/esm/structs/support/model/interactions.d.ts#L15) |
| `ModelStageTransportRegistration` | type | [Declaration](../../../dist/esm/structs/support/model/interactions.d.ts#L15) |
| `ModelStreamEvent` | type | [Declaration](../../../dist/esm/structs/model/messages.d.ts#L52) |
| `ModelTokenBudget` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L29) |
| `ModelTool` | type | [Declaration](../../../dist/esm/structs/capabilities/model.d.ts#L31) |
| `ModelToolCall` | type | [Declaration](../../../dist/esm/structs/model/messages.d.ts#L18) |
| `ModelToolCatalog` | type | [Declaration](../../../dist/esm/structs/capabilities/model.d.ts#L88) |
| `ModelToolInteractionOptions` | type | [Declaration](../../../dist/esm/support/model/session.d.ts#L27) |
| `ModelToolInteractionRegistration` | type | [Declaration](../../../dist/esm/support/model/session.d.ts#L33) |
| `ModelToolRegistration` | type | [Declaration](../../../dist/esm/structs/capabilities/model.d.ts#L52) |
| `ModelToolRegistry` | type | [Declaration](../../../dist/esm/capabilities/model.d.ts#L4) |
| `ModelToolResponse` | type | [Declaration](../../../dist/esm/structs/model/session.d.ts#L24) |
| `ModelToolResultMessage` | type | [Declaration](../../../dist/esm/structs/model/messages.d.ts#L87) |
| `ModelToolSelection` | type | [Declaration](../../../dist/esm/structs/capabilities/model.d.ts#L71) |
| `ModelToolSource` | type | [Declaration](../../../dist/esm/structs/capabilities/model.d.ts#L80) |
| `ModelTransportDefinition` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L67) |
| `ModelTransportRegistration` | type | [Declaration](../../../dist/esm/structs/model/interactions.d.ts#L67) |
| `ModelUsage` | type | [Declaration](../../../dist/esm/structs/model/messages.d.ts#L94) |
| `NativeFunctionCall` | type | [Declaration](../../../dist/esm/structs/model/interactions.d.ts#L80) |
| `nativeFunctionInteraction` | type | [Declaration](../../../dist/esm/model/interactions/native-functions.d.ts#L8) |
| `NodeAgentCache` | type | [Declaration](../../../dist/esm/structs/execution/cache.d.ts#L43) |
| `NodeCache` | type | [Declaration](../../../dist/esm/structs/execution/cache.d.ts#L15) |
| `NodeReportingContext` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L140) |
| `Normalization` | type | [Declaration](../../../dist/esm/kits/normalization.d.ts#L37) |
| `NormalizationOptions` | type | [Declaration](../../../dist/esm/structs/kits/normalization.d.ts#L20) |
| `NormalizationStep` | type | [Declaration](../../../dist/esm/structs/kits/normalization.d.ts#L11) |
| `normalizeDiagnosticEvent` | type | [Declaration](../../../dist/esm/diagnostics/index.d.ts#L41) |
| `Observer` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L19) |
| `openModelRealtime` | type | [Declaration](../../../dist/esm/model/realtime.d.ts#L14) |
| `OperationAction` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L7) |
| `OperationContext` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L109) |
| `OperationStatus` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L8) |
| `OutputCatalogOptions` | type | [Declaration](../../../dist/esm/structs/kits/presentation/outputs.d.ts#L77) |
| `OutputComposeInput` | type | [Declaration](../../../dist/esm/structs/kits/presentation/outputs.d.ts#L60) |
| `OutputDefinition` | type | [Declaration](../../../dist/esm/structs/kits/presentation/outputs.d.ts#L33) |
| `OutputField` | type | [Declaration](../../../dist/esm/structs/kits/presentation/outputs.d.ts#L13) |
| `OutputIssue` | type | [Declaration](../../../dist/esm/structs/kits/presentation/outputs.d.ts#L56) |
| `OutputProvider` | type | [Declaration](../../../dist/esm/structs/kits/presentation/outputs.d.ts#L48) |
| `OutputResult` | type | [Declaration](../../../dist/esm/structs/kits/presentation/outputs.d.ts#L71) |
| `parseJsonFrames` | type | [Declaration](../../../dist/esm/support/transport/json.d.ts#L32) |
| `parseKnowledgeDocument` | type | [Declaration](../../../dist/esm/kits/knowledge/sections.d.ts#L18) |
| `Policies` | type | [Declaration](../../../dist/esm/kits/policies.d.ts#L72) |
| `Policy` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L211)；Use ToolLifecyclePolicy. |
| `PolicyAssessment` | type | [Declaration](../../../dist/esm/structs/kits/policies.d.ts#L22) |
| `PolicyDefinition` | type | [Declaration](../../../dist/esm/structs/kits/policies.d.ts#L11) |
| `PreparedModelCall` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L264) |
| `PreparedModelInteraction` | type | [Declaration](../../../dist/esm/structs/model/interactions.d.ts#L45) |
| `PreparedModelSelection` | type | [Declaration](../../../dist/esm/structs/model/interactions.d.ts#L32) |
| `PreparedModelToolInteraction` | type | [Declaration](../../../dist/esm/support/model/session.d.ts#L20) |
| `PreparedModelTransport` | type | [Declaration](../../../dist/esm/structs/model/interactions.d.ts#L45) |
| `PreparedSessionTransport` | type | [Declaration](../../../dist/esm/support/model/session.d.ts#L20) |
| `prepareModelToolInteraction` | type | [Declaration](../../../dist/esm/support/model/session.d.ts#L52) |
| `prepareSessionFunctions` | type | [Declaration](../../../dist/esm/support/model/session.d.ts#L52) |
| `Presentation` | type | [Declaration](../../../dist/esm/kits/presentation/index.d.ts#L25) |
| `projectContinuousExcerpt` | type | [Declaration](../../../dist/esm/kits/projection.d.ts#L34) |
| `Projection` | type | [Declaration](../../../dist/esm/kits/projection.d.ts#L53) |
| `ProtocolCheck` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L47) |
| `ProtocolField` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L15) |
| `ProtocolPredicate` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L45) |
| `ProtocolReason` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L43) |
| `ProtocolRegistry` | type | [Declaration](../../../dist/esm/utils/protocol-registry.d.ts#L16) |
| `ProtocolShape` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L138) |
| `ProviderErrorCapture` | type | [Declaration](../../../dist/esm/structs/support/model/provider-observer.d.ts#L63) |
| `ProviderEventDescriptor` | type | [Declaration](../../../dist/esm/structs/support/model/provider-observer.d.ts#L44) |
| `ProviderEventName` | type | [Declaration](../../../dist/esm/structs/support/model/provider-observer.d.ts#L42) |
| `ProviderEventPayloads` | type | [Declaration](../../../dist/esm/structs/support/model/provider-observer.d.ts#L13) |
| `ProviderObservation` | type | [Declaration](../../../dist/esm/structs/support/model/provider-observer.d.ts#L49) |
| `ProviderObserver` | type | [Declaration](../../../dist/esm/structs/support/model/provider-observer.d.ts#L56) |
| `ProviderReasoningLevel` | type | [Declaration](../../../dist/esm/structs/support/model/provider.d.ts#L45) |
| `ProviderReasoningStrategy` | type | [Declaration](../../../dist/esm/structs/support/model/provider.d.ts#L52) |
| `publishReplyEvents` | type | [Declaration](../../../dist/esm/kits/presentation/events.d.ts#L40) |
| `QueryAggregationOptions` | type | [Declaration](../../../dist/esm/structs/kits/aggregation.d.ts#L10) |
| `RankedList` | type | [Declaration](../../../dist/esm/kits/rank-fusion.d.ts#L2) |
| `ReadonlyCatalog` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L60) |
| `readSse` | type | [Declaration](../../../dist/esm/types.d.ts#L20) |
| `RealtimeSessionOptions` | type | [Declaration](../../../dist/esm/model/realtime.d.ts#L4) |
| `reciprocalRankFusion` | type | [Declaration](../../../dist/esm/kits/rank-fusion.d.ts#L36) |
| `RecordedSubStep` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L94) |
| `RecoveryDefinition` | type | [Declaration](../../../dist/esm/structs/kits/policies.d.ts#L40) |
| `RecoveryResult` | type | [Declaration](../../../dist/esm/structs/kits/policies.d.ts#L31) |
| `Reflection` | type | [Declaration](../../../dist/esm/kits/reflection.d.ts#L18) |
| `ReflectionDefinition` | type | [Declaration](../../../dist/esm/structs/kits/reflection.d.ts#L108) |
| `ReflectionEvidence` | type | [Declaration](../../../dist/esm/structs/kits/reflection.d.ts#L20) |
| `ReflectionFinding` | type | [Declaration](../../../dist/esm/structs/kits/reflection.d.ts#L80) |
| `reflectionFindingKinds` | type | [Declaration](../../../dist/esm/structs/kits/reflection.d.ts#L78) |
| `reflectionIdentityFields` | type | [Declaration](../../../dist/esm/structs/kits/reflection.d.ts#L18) |
| `ReflectionLogReader` | type | [Declaration](../../../dist/esm/kits/reflection-log-source.d.ts#L20) |
| `ReflectionPage` | type | [Declaration](../../../dist/esm/structs/kits/reflection.d.ts#L54) |
| `ReflectionQuery` | type | [Declaration](../../../dist/esm/structs/kits/reflection.d.ts#L43) |
| `ReflectionReport` | type | [Declaration](../../../dist/esm/structs/kits/reflection.d.ts#L89) |
| `ReflectionSource` | type | [Declaration](../../../dist/esm/structs/kits/reflection.d.ts#L69) |
| `ReflectionTask` | type | [Declaration](../../../dist/esm/structs/kits/reflection.d.ts#L131) |
| `RegisteredDomainTool` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L82) |
| `RegisteredGoal` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L82) |
| `RegisteredInteractionOutput` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L173) |
| `RegisteredLifecycleTool` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L142) |
| `RegisteredModelTool` | type | [Declaration](../../../dist/esm/structs/capabilities/model.d.ts#L56) |
| `RegisteredProtocol` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L149) |
| `RegisteredScope` | type | [Declaration](../../../dist/esm/structs/kits/domains/scopes.d.ts#L79) |
| `RegisteredScopeEvidence` | type | [Declaration](../../../dist/esm/structs/kits/domains/scopes.d.ts#L67) |
| `RegisteredTool` | type | [Declaration](../../../dist/esm/structs/capabilities/tools.d.ts#L65) |
| `RegisteredToolDefinition` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L142) |
| `RegisteredTransportOutput` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L173) |
| `RegistrationDefinition` | type | [Declaration](../../../dist/esm/structs/support/registration.d.ts#L11) |
| `Registry` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L76) |
| `REPLY_BUBBLE_BOUNDARY` | type | [Declaration](../../../dist/esm/kits/presentation/events.d.ts#L19) |
| `ReplyBubbleInput` | type | [Declaration](../../../dist/esm/structs/kits/presentation/events.d.ts#L32) |
| `replyBubbleTexts` | type | [Declaration](../../../dist/esm/kits/presentation/events.d.ts#L26) |
| `ReplyDeliveryOptions` | type | [Declaration](../../../dist/esm/structs/kits/presentation/events.d.ts#L39) |
| `ReplyFormatCheck` | type | [Declaration](../../../dist/esm/structs/kits/presentation/formats.d.ts#L11) |
| `replyFormatChecks` | type | [Declaration](../../../dist/esm/kits/presentation/formats.d.ts#L5) |
| `ReplyFormatDefinition` | type | [Declaration](../../../dist/esm/structs/kits/presentation/formats.d.ts#L20) |
| `ReplyFormatOptions` | type | [Declaration](../../../dist/esm/structs/kits/presentation/formats.d.ts#L39) |
| `ReplyGuidance` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L195) |
| `ReportedStep` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L57) |
| `ReportedStepInput` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L111) |
| `ReportedStepLog` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L130) |
| `ReportedStepProgress` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L148) |
| `ReportedStepRecord` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L94) |
| `ReportedStepRecorder` | type | [Declaration](../../../dist/esm/diagnostics/sub-flow.d.ts#L45) |
| `ReportedStepStatus` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L55) |
| `reportedStepStatusCatalog` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L19) |
| `reportedStepStatuses` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L53) |
| `ReportedStepUpdate` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L119) |
| `ReportedStepValue` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L90) |
| `requireWorkflowValue` | type | [Declaration](../../../dist/esm/execution/state.d.ts#L22) |
| `resolvePreference` | type | [Declaration](../../../dist/esm/kits/presentation/variants.d.ts#L34) |
| `ResultReview` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L98) |
| `ResultReviewAdmissionRequest` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L105) |
| `ResultReviewCandidate` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L30) |
| `ResultReviewCoverage` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L45) |
| `ResultReviewDefinition` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L93) |
| `ResultReviewDetector` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L59) |
| `ResultReviewFinding` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L35) |
| `ResultReviewInput` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L12) |
| `ResultReviewRequest` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L24) |
| `ResultReviewResolution` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L74) |
| `ResultReviewResult` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L53) |
| `ResultReviewScope` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L4) |
| `ResultReviewStrategy` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L82) |
| `Retrieval` | type | [Declaration](../../../dist/esm/kits/retrieval.d.ts#L23) |
| `RetrievalDefinition` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L96) |
| `RetrievalEffect` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L49) |
| `RetrievalPorts` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L56) |
| `retrievalQueryKey` | type | [Declaration](../../../dist/esm/utils/query-key.d.ts#L12) |
| `RetrievalReason` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L47) |
| `RetrievalReceipt` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L30) |
| `RetrievalResult` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L17) |
| `RetrievalRunner` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L87) |
| `RetrievalSource` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L13) |
| `RetrievalState` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L21) |
| `ReviewChoice` | type | [Declaration](../../../dist/esm/structs/kits/review-choice.d.ts#L21) |
| `ReviewChoiceAnswer` | type | [Declaration](../../../dist/esm/structs/kits/review-choice.d.ts#L16) |
| `ReviewChoiceDecision` | type | [Declaration](../../../dist/esm/structs/kits/review-choice.d.ts#L53) |
| `ReviewChoiceHost` | type | [Declaration](../../../dist/esm/structs/kits/review-choice.d.ts#L46) |
| `ReviewChoiceInput` | type | [Declaration](../../../dist/esm/structs/kits/review-choice.d.ts#L10) |
| `ReviewChoiceInspection` | type | [Declaration](../../../dist/esm/structs/kits/review-choice.d.ts#L34) |
| `ReviewDecision` | type | [Declaration](../../../dist/esm/structs/kits/review-decision.d.ts#L47) |
| `ReviewDecisionBinding` | type | [Declaration](../../../dist/esm/structs/kits/review-decision.d.ts#L5) |
| `ReviewDecisionDefinition` | type | [Declaration](../../../dist/esm/structs/kits/review-decision.d.ts#L26) |
| `ReviewDecisionState` | type | [Declaration](../../../dist/esm/structs/kits/review-decision.d.ts#L16) |
| `reviewMemorySources` | type | [Declaration](../../../dist/esm/kits/memory.d.ts#L133) |
| `route` | type | [Declaration](../../../dist/esm/execution/state.d.ts#L195) |
| `runModelOperation` | type | [Declaration](../../../dist/esm/model/operations.d.ts#L4) |
| `RuntimeNodeReportingContext` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L190) |
| `scanJsonObjectFrames` | type | [Declaration](../../../dist/esm/support/transport/json.d.ts#L18) |
| `SchemaAdapter` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L29) |
| `ScopeDefinition` | type | [Declaration](../../../dist/esm/structs/kits/domains/scopes.d.ts#L15) |
| `ScopeDescription` | type | [Declaration](../../../dist/esm/structs/kits/domains/scopes.d.ts#L83) |
| `ScopedReportedStepInput` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L117) |
| `ScopedReportedStepRecorder` | type | [Declaration](../../../dist/esm/diagnostics/sub-flow.d.ts#L55) |
| `ScopedSubFlowLogger` | type | [Declaration](../../../dist/esm/diagnostics/sub-flow.d.ts#L55) |
| `ScopedSubFlowStepInput` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L117) |
| `ScopeRegistry` | type | [Declaration](../../../dist/esm/kits/domains/scopes.d.ts#L17) |
| `ScopeRegistryPolicy` | type | [Declaration](../../../dist/esm/structs/kits/domains/scopes.d.ts#L40) |
| `SearchHit` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L118) |
| `SectionSelection` | type | [Declaration](../../../dist/esm/structs/kits/knowledge.d.ts#L33) |
| `SelectedTools` | type | [Declaration](../../../dist/esm/structs/support/tools.d.ts#L37) |
| `selectVariant` | type | [Declaration](../../../dist/esm/kits/presentation/variants.d.ts#L20) |
| `SemanticSlotDefinition` | type | [Declaration](../../../dist/esm/structs/kits/presentation/templates.d.ts#L19) |
| `serializeOutputEvents` | type | [Declaration](../../../dist/esm/kits/presentation/events.d.ts#L53) |
| `SessionFunctionOptions` | type | [Declaration](../../../dist/esm/support/model/session.d.ts#L27) |
| `SessionModelTransportRegistration` | type | [Declaration](../../../dist/esm/support/model/session.d.ts#L33) |
| `splitTextBlocks` | type | [Declaration](../../../dist/esm/kits/text-blocks.d.ts#L19) |
| `SseEvent` | type | [Declaration](../../../dist/esm/types.d.ts#L10) |
| `SseIdleTimeoutError` | type | [Declaration](../../../dist/esm/types.d.ts#L20) |
| `SseOutputEvent` | type | [Declaration](../../../dist/esm/structs/support/transport/sse.d.ts#L19) |
| `SseReadOptions` | type | [Declaration](../../../dist/esm/types.d.ts#L10) |
| `SseWriter` | type | [Declaration](../../../dist/esm/structs/support/transport/sse.d.ts#L12) |
| `StepOutcome` | type | [Declaration](../../../dist/esm/structs/execution/engine.d.ts#L26) |
| `SubFlowLog` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L130) |
| `SubFlowLogger` | type | [Declaration](../../../dist/esm/diagnostics/sub-flow.d.ts#L45) |
| `SubFlowStepFix` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L119) |
| `SubFlowStepInput` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L111) |
| `SubFlowValue` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L90) |
| `SubStepProgress` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L148) |
| `Support` | type | [Declaration](../../../dist/esm/support/index.d.ts#L10) |
| `TextBlock` | type | [Declaration](../../../dist/esm/structs/kits/text-blocks.d.ts#L11) |
| `TextBlockOptions` | type | [Declaration](../../../dist/esm/structs/kits/text-blocks.d.ts#L22) |
| `TextBlocks` | type | [Declaration](../../../dist/esm/kits/text-blocks.d.ts#L21) |
| `textOutputEvents` | type | [Declaration](../../../dist/esm/kits/presentation/events.d.ts#L60) |
| `TextSearch` | type | [Declaration](../../../dist/esm/kits/search.d.ts#L8) |
| `TextSearchHit` | type | [Declaration](../../../dist/esm/structs/kits/search.d.ts#L29) |
| `TextSearchOptions` | type | [Declaration](../../../dist/esm/structs/kits/search.d.ts#L12) |
| `TextSearchQuery` | type | [Declaration](../../../dist/esm/structs/kits/search.d.ts#L36) |
| `TextSearchSnapshot` | type | [Declaration](../../../dist/esm/structs/kits/search.d.ts#L47) |
| `TextSkill` | type | [Declaration](../../../dist/esm/structs/kits/text-skills.d.ts#L24) |
| `TextSkillHeader` | type | [Declaration](../../../dist/esm/structs/kits/text-skills.d.ts#L31) |
| `TextSkillLoader` | type | [Declaration](../../../dist/esm/structs/kits/text-skills.d.ts#L61) |
| `TextSkillLoaderDefinition` | type | [Declaration](../../../dist/esm/structs/kits/text-skills.d.ts#L36) |
| `TextSkillReadPorts` | type | [Declaration](../../../dist/esm/structs/kits/text-skills.d.ts#L56) |
| `TextSkillRegistration` | type | [Declaration](../../../dist/esm/structs/kits/text-skills.d.ts#L13) |
| `TextSkills` | type | [Declaration](../../../dist/esm/kits/text-skills.d.ts#L19) |
| `TextTemplateOptions` | type | [Declaration](../../../dist/esm/structs/kits/presentation/templates.d.ts#L10) |
| `TimestampMs` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L15) |
| `Tool` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L219)；Use LifecycleTool and domainToolIds. |
| `ToolCallRecord` | type | [Declaration](../../../dist/esm/structs/invocation.d.ts#L48) |
| `ToolCatalog` | type | [Declaration](../../../dist/esm/structs/support/tools.d.ts#L66) |
| `ToolCatalogEntry` | type | [Declaration](../../../dist/esm/structs/support/tools.d.ts#L64) |
| `ToolCondition` | type | [Declaration](../../../dist/esm/structs/capabilities/model.d.ts#L29) |
| `ToolContext` | type | [Declaration](../../../dist/esm/structs/capabilities/model.d.ts#L18) |
| `ToolDefinition` | type | [Declaration](../../../dist/esm/structs/capabilities/tools.d.ts#L39) |
| `ToolDomainMembership` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L123) |
| `ToolExecutionContext` | type | [Declaration](../../../dist/esm/structs/capabilities/tools.d.ts#L41) |
| `ToolExecutionEvent` | type | [Declaration](../../../dist/esm/structs/capabilities/tools.d.ts#L67) |
| `ToolFinalizer` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L179) |
| `ToolInvocationPorts` | type | [Declaration](../../../dist/esm/structs/capabilities/invocation.d.ts#L51) |
| `ToolInvocationRequest` | type | [Declaration](../../../dist/esm/structs/capabilities/tools.d.ts#L88) |
| `ToolJournal` | type | [Declaration](../../../dist/esm/structs/capabilities/invocation.d.ts#L31) |
| `ToolJournalFinish` | type | [Declaration](../../../dist/esm/structs/capabilities/invocation.d.ts#L22) |
| `ToolJournalStart` | type | [Declaration](../../../dist/esm/structs/capabilities/invocation.d.ts#L13) |
| `ToolLifecycleHooks` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L72) |
| `ToolLifecyclePolicy` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L225) |
| `ToolLifecycleProtocol` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L59) |
| `ToolLifecycleRegistry` | type | [Declaration](../../../dist/esm/kits/tools.d.ts#L20) |
| `ToolLifecycleRegistryOptions` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L231) |
| `ToolModelField` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L44) |
| `ToolModelView` | type | [Declaration](../../../dist/esm/structs/support/tools.d.ts#L23) |
| `ToolNormalizer` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L177) |
| `ToolOutput` | type | [Declaration](../../../dist/esm/structs/support/tools.d.ts#L41) |
| `ToolProposal` | type | [Declaration](../../../dist/esm/structs/capabilities/model.d.ts#L13) |
| `ToolProtocol` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L171) |
| `ToolRegistration` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L223)；Use LifecycleToolRegistration. |
| `ToolRegistry` | type | [Declaration](../../../dist/esm/capabilities/tools.d.ts#L7) |
| `ToolRegistryOptions` | type | [Declaration](../../../dist/esm/structs/capabilities/tools.d.ts#L99) |
| `ToolRegistryPorts` | type | [Declaration](../../../dist/esm/structs/capabilities/tools.d.ts#L78) |
| `ToolResult` | type | [Declaration](../../../dist/esm/structs/invocation.d.ts#L57) |
| `ToolRuntime` | type | [Declaration](../../../dist/esm/structs/support/tools.d.ts#L51) |
| `ToolRuntimeTypes` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L25) |
| `ToolsOptions` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L215)；Use ToolLifecycleRegistryOptions. |
| `transformContextText` | type | [Declaration](../../../dist/esm/support/context/assembly.d.ts#L39) |
| `TreeProjectionOptions` | type | [Declaration](../../../dist/esm/structs/kits/projection.d.ts#L29) |
| `uniqueBy` | type | [Declaration](../../../dist/esm/kits/normalization.d.ts#L34) |
| `validateAnswerBatch` | type | [Declaration](../../../dist/esm/kits/answering/batch.d.ts#L19) |
| `validateContextBudget` | type | [Declaration](../../../dist/esm/context/fragments.d.ts#L39) |
| `validateContextFragment` | type | [Declaration](../../../dist/esm/context/fragments.d.ts#L26) |
| `ValidationError` | type | [Declaration](../../../dist/esm/structs/errors.d.ts#L17) |
| `VectorSearch` | type | [Declaration](../../../dist/esm/kits/vector-search.d.ts#L38) |
| `VectorSearchHit` | type | [Declaration](../../../dist/esm/kits/vector-search.d.ts#L19) |
| `VectorSearchQuery` | type | [Declaration](../../../dist/esm/kits/vector-search.d.ts#L22) |
| `VectorSearchSpace` | type | [Declaration](../../../dist/esm/kits/vector-search.d.ts#L12) |
| `WaitGate` | type | [Declaration](../../../dist/esm/structs/kits/waiting.d.ts#L47) |
| `WaitGateDefinition` | type | [Declaration](../../../dist/esm/structs/kits/waiting.d.ts#L33) |
| `WaitGateOptions` | type | [Declaration](../../../dist/esm/structs/kits/waiting.d.ts#L42) |
| `WaitIdentity` | type | [Declaration](../../../dist/esm/structs/kits/waiting.d.ts#L4) |
| `waitModelOperation` | type | [Declaration](../../../dist/esm/model/operations.d.ts#L6) |
| `WaitRecord` | type | [Declaration](../../../dist/esm/structs/kits/waiting.d.ts#L10) |
| `WaitStore` | type | [Declaration](../../../dist/esm/structs/kits/waiting.d.ts#L27) |
| `WalkRule` | type | [Declaration](../../../dist/esm/structs/utils/rules.d.ts#L22) |
| `walkRules` | type | [Declaration](../../../dist/esm/utils/rules.d.ts#L36) |
| `WorkflowChain` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L62) |
| `WorkflowChainCoverage` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L46) |
| `WorkflowChainNode` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L78) |
| `WorkflowChainNodeEvent` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L98) |
| `WorkflowChainSource` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L57) |
| `WorkflowChainTransition` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L111) |
| `WorkflowContext` | type | [Declaration](../../../dist/esm/structs/execution/workflow.d.ts#L26) |
| `WorkflowContractError` | type | [Declaration](../../../dist/esm/structs/errors.d.ts#L38) |
| `WorkflowEvent` | type | [Declaration](../../../dist/esm/structs/execution/workflow.d.ts#L119) |
| `WorkflowExtension` | type | [Declaration](../../../dist/esm/structs/execution/workflow.d.ts#L161) |
| `WorkflowFailure` | type | [Declaration](../../../dist/esm/structs/execution/workflow.d.ts#L156) |
| `WorkflowGraph` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L6) |
| `WorkflowGraphEdge` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L37) |
| `WorkflowGraphNode` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L15) |
| `WorkflowGraphRoute` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L28) |
| `WorkflowModel` | type | [Declaration](../../../dist/esm/structs/execution/workflow.d.ts#L175) |
| `WorkflowNode` | type | [Declaration](../../../dist/esm/structs/execution/workflow.d.ts#L73) |
| `WorkflowNodeReport` | type | [Declaration](../../../dist/esm/structs/execution/workflow.d.ts#L66) |
| `WorkflowNodeVisit` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L78) |
| `WorkflowNodeVisitEvent` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L98) |
| `WorkflowReportedStepRecord` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L71) |
| `WorkflowRoute` | type | [Declaration](../../../dist/esm/structs/execution/workflow.d.ts#L50) |
| `WorkflowRunTrace` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L62) |
| `WorkflowRunTraceCoverage` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L46) |
| `WorkflowRunTraceSource` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L57) |
| `WorkflowSubflowRecord` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L71) |
| `WorkflowTransitionRecord` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L111) |
| `writeSseFrame` | type | [Declaration](../../../dist/esm/support/transport/sse.d.ts#L38) |

## @jangts/agent-core/structs

[Contracts and behavior](types.md) · 409 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `AgentCacheAddress` | type | [Declaration](../../../dist/esm/structs/execution/cache.d.ts#L27) |
| `AgentCacheOptions` | type | [Declaration](../../../dist/esm/structs/execution/cache.d.ts#L23) |
| `AgentCachePort` | type | [Declaration](../../../dist/esm/structs/execution/cache.d.ts#L34) |
| `AgentCatalogPorts` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L77) |
| `AgentCoreEngineOptions` | type | [Declaration](../../../dist/esm/structs/execution/engine.d.ts#L37) |
| `AgentErrorInfo` | type | [Declaration](../../../dist/esm/structs/errors.d.ts#L46) |
| `AgentFamily` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L86) |
| `AgentOutputEvent` | type | [Declaration](../../../dist/esm/structs/kits/presentation/events.d.ts#L11) |
| `AgentWorkflowDefinition` | type | [Declaration](../../../dist/esm/structs/execution/workflow.d.ts#L103) |
| `ArtifactReference` | type | [Declaration](../../../dist/esm/structs/kits/artifacts.d.ts#L12) |
| `ArtifactResolver` | type | [Declaration](../../../dist/esm/structs/kits/artifacts.d.ts#L21) |
| `AsIntent` | type | [Declaration](../../../dist/esm/structs/capabilities/model.d.ts#L27) |
| `AsyncSink` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L21) |
| `BoundModelProvider` | type | [Declaration](../../../dist/esm/structs/model/chat-provider.d.ts#L51) |
| `BranchVersion` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L19) |
| `BranchVersioning` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L86) |
| `BranchVersioningDefinition` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L56) |
| `BranchVersionOperation` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L17) |
| `branchVersionOperations` | value | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L15) |
| `BranchVersionRecord` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L36) |
| `BranchVersionStore` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L49) |
| `BreakCheck` | type | [Declaration](../../../dist/esm/structs/utils/rules.d.ts#L33) |
| `BreakEvent` | type | [Declaration](../../../dist/esm/structs/utils/rules.d.ts#L42) |
| `BreakPredicate` | type | [Declaration](../../../dist/esm/structs/utils/rules.d.ts#L31) |
| `BreakReason` | type | [Declaration](../../../dist/esm/structs/utils/rules.d.ts#L29) |
| `BreakWhileConfig` | type | [Declaration](../../../dist/esm/structs/utils/rules.d.ts#L49) |
| `BudgetError` | value + type | [Declaration](../../../dist/esm/structs/errors.d.ts#L29) |
| `BuiltContext` | type | [Declaration](../../../dist/esm/structs/context/fragments.d.ts#L45) |
| `CacheContext` | type | [Declaration](../../../dist/esm/structs/execution/cache.d.ts#L51) |
| `CacheReadOptions` | type | [Declaration](../../../dist/esm/structs/execution/cache.d.ts#L11) |
| `CandidateSelectionDefinition` | type | [Declaration](../../../dist/esm/structs/kits/candidates.d.ts#L16) |
| `CapabilityCatalogOptions` | type | [Declaration](../../../dist/esm/structs/support/capabilities.d.ts#L31) |
| `CapabilityModule` | type | [Declaration](../../../dist/esm/structs/support/capabilities.d.ts#L20) |
| `CapabilityToolReferences` | type | [Declaration](../../../dist/esm/structs/support/capabilities.d.ts#L11) |
| `CatalogDomainTool` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L12) |
| `CatalogExecutionTool` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L29) |
| `CatalogGoal` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L12) |
| `CatalogScope` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L17) |
| `CatalogTask` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L22) |
| `CatalogTool` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L29) |
| `ChatProvider` | value + type | [Declaration](../../../dist/esm/structs/model/chat-provider.d.ts#L24) |
| `CheckResult` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L52) |
| `Command` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L93) |
| `CommandCatalogOptions` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L115) |
| `CommandDefinition` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L58) |
| `CompatibleModelConfig` | type | [Declaration](../../../dist/esm/structs/support/model/provider.d.ts#L74) |
| `CompatibleModelPorts` | type | [Declaration](../../../dist/esm/structs/support/model/provider.d.ts#L98) |
| `CompatibleModelProviderOptions` | type | [Declaration](../../../dist/esm/structs/support/model/provider.d.ts#L118) |
| `CompiledTool` | type | [Declaration](../../../dist/esm/structs/support/tools.d.ts#L43) |
| `ContextAssemblyOptions` | type | [Declaration](../../../dist/esm/structs/support/context.d.ts#L35) |
| `ContextBuilder` | type | [Declaration](../../../dist/esm/structs/support/context.d.ts#L49) |
| `ContextBuilderOptions` | type | [Declaration](../../../dist/esm/structs/support/context.d.ts#L28) |
| `ContextFragment` | type | [Declaration](../../../dist/esm/structs/context/fragments.d.ts#L17) |
| `ContextFragmentConfig` | type | [Declaration](../../../dist/esm/structs/support/context.d.ts#L42) |
| `ContextFragmentUsage` | type | [Declaration](../../../dist/esm/structs/context/fragments.d.ts#L34) |
| `ContextLifetime` | type | [Declaration](../../../dist/esm/structs/context/fragments.d.ts#L15) |
| `ContextPlan` | type | [Declaration](../../../dist/esm/structs/context/processing.d.ts#L13) |
| `ContextProjection` | type | [Declaration](../../../dist/esm/structs/support/context.d.ts#L15) |
| `ContextRecord` | type | [Declaration](../../../dist/esm/structs/context/journal.d.ts#L26) |
| `ContextTrust` | type | [Declaration](../../../dist/esm/structs/context/fragments.d.ts#L13) |
| `CoreDiagnosticRecord` | type | [Declaration](../../../dist/esm/structs/diagnostics.d.ts#L279) |
| `CoreEvent` | type | [Declaration](../../../dist/esm/structs/diagnostics.d.ts#L207) |
| `CoreEventDescriptor` | type | [Declaration](../../../dist/esm/structs/diagnostics.d.ts#L145) |
| `CoreEventName` | type | [Declaration](../../../dist/esm/structs/diagnostics.d.ts#L138) |
| `CoreEventPayloads` | type | [Declaration](../../../dist/esm/structs/diagnostics.d.ts#L17) |
| `CoreLogOutput` | type | [Declaration](../../../dist/esm/structs/diagnostics.d.ts#L232) |
| `CoreStep` | type | [Declaration](../../../dist/esm/structs/execution/engine.d.ts#L35) |
| `CreateDiagnosticsOptions` | type | [Declaration](../../../dist/esm/structs/diagnostics.d.ts#L266) |
| `DebugStepsOutput` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L169) |
| `DescribedTool` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L42) |
| `DiagnosticContext` | type | [Declaration](../../../dist/esm/structs/diagnostics.d.ts#L243) |
| `DiagnosticIdentity` | type | [Declaration](../../../dist/esm/structs/diagnostics.d.ts#L150) |
| `DiagnosticSpanFields` | type | [Declaration](../../../dist/esm/structs/diagnostics.d.ts#L199) |
| `DomainTool` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L15) |
| `DomainToolDescription` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L71) |
| `DomainToolId` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L75) |
| `DomainToolPolicy` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L44) |
| `DomainToolRegistration` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L42) |
| `DurableAuthorizationContext` | type | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L97) |
| `DurableCheckpoint` | type | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L24) |
| `DurableReconcileContext` | type | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L93) |
| `DurableReconciliation` | type | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L72) |
| `durableReplayPolicies` | value | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L22) |
| `durableStatuses` | value | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L15) |
| `DurableStep` | type | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L61) |
| `DurableStepContext` | type | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L82) |
| `DurableStore` | type | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L52) |
| `DurableTask` | type | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L120) |
| `DurableTaskDefinition` | type | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L101) |
| `DurableTaskOptions` | type | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L113) |
| `DurationMs` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L17) |
| `EngineCacheOptions` | type | [Declaration](../../../dist/esm/structs/execution/cache.d.ts#L6) |
| `ErasedTool` | type | [Declaration](../../../dist/esm/structs/capabilities/tools.d.ts#L54) |
| `ErrorContext` | type | [Declaration](../../../dist/esm/structs/errors.d.ts#L61) |
| `EvidenceProjectionDefinition` | type | [Declaration](../../../dist/esm/structs/kits/evidence.d.ts#L36) |
| `EvidenceProjectionProvider` | type | [Declaration](../../../dist/esm/structs/kits/evidence.d.ts#L29) |
| `EvidenceProvider` | type | [Declaration](../../../dist/esm/structs/kits/evidence.d.ts#L21) |
| `EvidenceRequirement` | type | [Declaration](../../../dist/esm/structs/kits/evidence.d.ts#L12) |
| `ExecutableTool` | type | [Declaration](../../../dist/esm/structs/capabilities/tools.d.ts#L18) |
| `ExecutionContext` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L95) |
| `ExecutionEventDescriptor` | type | [Declaration](../../../dist/esm/structs/execution/events.d.ts#L14) |
| `ExecutionObserver` | type | [Declaration](../../../dist/esm/structs/execution/events.d.ts#L17) |
| `ExecutionOptions` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L86) |
| `FamilyDefinition` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L56) |
| `FamilyOperation` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L17) |
| `familyOperations` | value | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L15) |
| `FamilyRecord` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L36) |
| `FamilyStore` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L49) |
| `FamilyVersion` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L19) |
| `FunctionCallDelta` | type | [Declaration](../../../dist/esm/structs/model/messages.d.ts#L114) |
| `GoalDescription` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L71) |
| `GoalId` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L75) |
| `GoalPolicy` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L44) |
| `GoalTool` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L15) |
| `GoalToolRegistration` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L42) |
| `Id` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L13) |
| `IntentOptions` | type | [Declaration](../../../dist/esm/structs/capabilities/model.d.ts#L20) |
| `INTERACTION_CATEGORIES` | value | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L28) |
| `InteractionCategory` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L26) |
| `InteractionDescriptor` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L30) |
| `InteractionHandlers` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L41) |
| `InteractionProtocolDefinition` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L128) |
| `InvocationHandler` | type | [Declaration](../../../dist/esm/structs/capabilities/invocation.d.ts#L38) |
| `InvocationMetadata` | type | [Declaration](../../../dist/esm/structs/invocation.d.ts#L13) |
| `InvocationResult` | type | [Declaration](../../../dist/esm/structs/invocation.d.ts#L30) |
| `InvocationStatus` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L23) |
| `Issue` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L36) |
| `JsonFrameLimits` | type | [Declaration](../../../dist/esm/structs/support/transport/json.d.ts#L12) |
| `JsonSchema` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L25) |
| `JsonSchemaOptions` | type | [Declaration](../../../dist/esm/structs/support/schema.d.ts#L18) |
| `JsonSchemaValidator` | type | [Declaration](../../../dist/esm/structs/support/schema.d.ts#L11) |
| `JsonTransportPart` | type | [Declaration](../../../dist/esm/structs/support/transport/json.d.ts#L21) |
| `KnowledgeCandidate` | type | [Declaration](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L26) |
| `KnowledgePublication` | type | [Declaration](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L76) |
| `knowledgePublicationOperations` | value | [Declaration](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L15) |
| `KnowledgePublicationOptions` | type | [Declaration](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L58) |
| `KnowledgePublicationRecord` | type | [Declaration](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L40) |
| `KnowledgePublicationStore` | type | [Declaration](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L51) |
| `KnowledgeSourceReference` | type | [Declaration](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L17) |
| `LegacyAgentCatalogPorts` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L51) |
| `LifecycleContext` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L2) |
| `LifecycleHooks` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L72) |
| `LifecycleProtocol` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L59) |
| `LifecycleRun` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L36) |
| `LifecycleTool` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L131) |
| `LifecycleToolBase` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L112) |
| `LifecycleToolRegistration` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L133) |
| `LoopEvent` | type | [Declaration](../../../dist/esm/structs/execution/engine.d.ts#L13) |
| `MatchRule` | type | [Declaration](../../../dist/esm/structs/utils/rules.d.ts#L12) |
| `MaybePromise` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L27) |
| `ModelAssistantToolMessage` | type | [Declaration](../../../dist/esm/structs/model/messages.d.ts#L80) |
| `ModelCallRecord` | type | [Declaration](../../../dist/esm/structs/invocation.d.ts#L35) |
| `ModelCallRequest` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L199) |
| `ModelCallTrace` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L74) |
| `ModelCapabilities` | type | [Declaration](../../../dist/esm/structs/model/messages.d.ts#L45) |
| `ModelChildOptions` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L137) |
| `ModelChildPolicy` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L58) |
| `ModelChoiceIndex` | type | [Declaration](../../../dist/esm/structs/support/model/provider.d.ts#L113) |
| `ModelContentPart` | type | [Declaration](../../../dist/esm/structs/model/messages.d.ts#L28) |
| `ModelContinuation` | type | [Declaration](../../../dist/esm/structs/model/messages.d.ts#L37) |
| `ModelDuplex` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L51) |
| `ModelFunction` | type | [Declaration](../../../dist/esm/structs/model/messages.d.ts#L103) |
| `ModelImage` | type | [Declaration](../../../dist/esm/structs/model/messages.d.ts#L11) |
| `ModelInputMeasurement` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L231) |
| `ModelInteractionAdapter` | type | [Declaration](../../../dist/esm/structs/model/interactions.d.ts#L52) |
| `ModelInteractionDefinition` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L67) |
| `ModelInteractionOptions` | type | [Declaration](../../../dist/esm/structs/model/messages.d.ts#L157) |
| `ModelInteractionRegistration` | type | [Declaration](../../../dist/esm/structs/model/interactions.d.ts#L67) |
| `ModelLifecycleContext` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L2) |
| `ModelLifecycleRun` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L36) |
| `ModelMessage` | type | [Declaration](../../../dist/esm/structs/model/messages.d.ts#L66) |
| `ModelOperationAction` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L7) |
| `ModelOperationHandle` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L10) |
| `ModelOperationPorts` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L43) |
| `ModelOperationProvider` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L32) |
| `ModelOperationRequest` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L19) |
| `ModelOperationResult` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L25) |
| `ModelOperationStatus` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L8) |
| `ModelOptions` | type | [Declaration](../../../dist/esm/structs/model/messages.d.ts#L128) |
| `ModelOutputEvent` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L116) |
| `ModelPart` | type | [Declaration](../../../dist/esm/structs/model/messages.d.ts#L126) |
| `ModelPrepareRequest` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L287) |
| `ModelProvider` | type | [Declaration](../../../dist/esm/structs/model/chat-provider.d.ts#L41) |
| `ModelProviderContext` | type | [Declaration](../../../dist/esm/structs/model/chat-provider.d.ts#L14) |
| `ModelProviderErrorCode` | type | [Declaration](../../../dist/esm/structs/support/model/provider.d.ts#L15) |
| `ModelProviderFailure` | type | [Declaration](../../../dist/esm/structs/support/model/provider.d.ts#L37) |
| `ModelRealtimeEvent` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L60) |
| `ModelRealtimeProvider` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L56) |
| `ModelResponseCollector` | type | [Declaration](../../../dist/esm/structs/model/interactions.d.ts#L14) |
| `ModelResponseToolCall` | type | [Declaration](../../../dist/esm/structs/model/session.d.ts#L11) |
| `ModelResult` | type | [Declaration](../../../dist/esm/structs/invocation.d.ts#L55) |
| `ModelRunnerBudgetSnapshot` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L298) |
| `ModelRunnerOptions` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L179) |
| `ModelRunnerPorts` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L120) |
| `ModelRunnerProvider` | type | [Declaration](../../../dist/esm/structs/model/chat-provider.d.ts#L41) |
| `ModelRunnerSettings` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L157) |
| `ModelRuntimeConfig` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L45) |
| `ModelSelection` | type | [Declaration](../../../dist/esm/structs/capabilities/model.d.ts#L58) |
| `ModelSessionCall` | type | [Declaration](../../../dist/esm/structs/model/session.d.ts#L11) |
| `ModelSessionResult` | type | [Declaration](../../../dist/esm/structs/model/session.d.ts#L24) |
| `ModelStageInteractionRegistration` | type | [Declaration](../../../dist/esm/structs/support/model/interactions.d.ts#L15) |
| `ModelStageTransportRegistration` | type | [Declaration](../../../dist/esm/structs/support/model/interactions.d.ts#L15) |
| `ModelStreamEvent` | type | [Declaration](../../../dist/esm/structs/model/messages.d.ts#L52) |
| `ModelTokenBudget` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L29) |
| `ModelTool` | type | [Declaration](../../../dist/esm/structs/capabilities/model.d.ts#L31) |
| `ModelToolCall` | type | [Declaration](../../../dist/esm/structs/model/messages.d.ts#L18) |
| `ModelToolCatalog` | type | [Declaration](../../../dist/esm/structs/capabilities/model.d.ts#L88) |
| `ModelToolRegistration` | type | [Declaration](../../../dist/esm/structs/capabilities/model.d.ts#L52) |
| `ModelToolResponse` | type | [Declaration](../../../dist/esm/structs/model/session.d.ts#L24) |
| `ModelToolResultMessage` | type | [Declaration](../../../dist/esm/structs/model/messages.d.ts#L87) |
| `ModelToolSelection` | type | [Declaration](../../../dist/esm/structs/capabilities/model.d.ts#L71) |
| `ModelToolSource` | type | [Declaration](../../../dist/esm/structs/capabilities/model.d.ts#L80) |
| `ModelTransportDefinition` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L67) |
| `ModelTransportRegistration` | type | [Declaration](../../../dist/esm/structs/model/interactions.d.ts#L67) |
| `ModelUsage` | type | [Declaration](../../../dist/esm/structs/model/messages.d.ts#L94) |
| `NativeFunctionCall` | type | [Declaration](../../../dist/esm/structs/model/interactions.d.ts#L80) |
| `NodeAgentCache` | type | [Declaration](../../../dist/esm/structs/execution/cache.d.ts#L43) |
| `NodeCache` | type | [Declaration](../../../dist/esm/structs/execution/cache.d.ts#L15) |
| `NodeReportingContext` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L140) |
| `Observer` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L19) |
| `OperationAction` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L7) |
| `OperationContext` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L109) |
| `OperationStatus` | type | [Declaration](../../../dist/esm/structs/model/lifecycle.d.ts#L8) |
| `Policy` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L211)；Use ToolLifecyclePolicy. |
| `PolicyAssessment` | type | [Declaration](../../../dist/esm/structs/kits/policies.d.ts#L22) |
| `PolicyDefinition` | type | [Declaration](../../../dist/esm/structs/kits/policies.d.ts#L11) |
| `PreparedModelCall` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L264) |
| `PreparedModelInteraction` | type | [Declaration](../../../dist/esm/structs/model/interactions.d.ts#L45) |
| `PreparedModelSelection` | type | [Declaration](../../../dist/esm/structs/model/interactions.d.ts#L32) |
| `PreparedModelTransport` | type | [Declaration](../../../dist/esm/structs/model/interactions.d.ts#L45) |
| `ProtocolCheck` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L47) |
| `ProtocolField` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L15) |
| `ProtocolPredicate` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L45) |
| `ProtocolReason` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L43) |
| `ProtocolShape` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L138) |
| `ProviderErrorCapture` | type | [Declaration](../../../dist/esm/structs/support/model/provider-observer.d.ts#L63) |
| `ProviderEventDescriptor` | type | [Declaration](../../../dist/esm/structs/support/model/provider-observer.d.ts#L44) |
| `ProviderEventName` | type | [Declaration](../../../dist/esm/structs/support/model/provider-observer.d.ts#L42) |
| `ProviderEventPayloads` | type | [Declaration](../../../dist/esm/structs/support/model/provider-observer.d.ts#L13) |
| `ProviderObservation` | type | [Declaration](../../../dist/esm/structs/support/model/provider-observer.d.ts#L49) |
| `ProviderObserver` | type | [Declaration](../../../dist/esm/structs/support/model/provider-observer.d.ts#L56) |
| `ProviderReasoningLevel` | type | [Declaration](../../../dist/esm/structs/support/model/provider.d.ts#L45) |
| `ProviderReasoningStrategy` | type | [Declaration](../../../dist/esm/structs/support/model/provider.d.ts#L52) |
| `ReadonlyCatalog` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L60) |
| `RecordedSubStep` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L94) |
| `RecoveryDefinition` | type | [Declaration](../../../dist/esm/structs/kits/policies.d.ts#L40) |
| `RecoveryResult` | type | [Declaration](../../../dist/esm/structs/kits/policies.d.ts#L31) |
| `ReflectionDefinition` | type | [Declaration](../../../dist/esm/structs/kits/reflection.d.ts#L108) |
| `ReflectionEvidence` | type | [Declaration](../../../dist/esm/structs/kits/reflection.d.ts#L20) |
| `ReflectionFinding` | type | [Declaration](../../../dist/esm/structs/kits/reflection.d.ts#L80) |
| `reflectionFindingKinds` | value | [Declaration](../../../dist/esm/structs/kits/reflection.d.ts#L78) |
| `reflectionIdentityFields` | value | [Declaration](../../../dist/esm/structs/kits/reflection.d.ts#L18) |
| `ReflectionPage` | type | [Declaration](../../../dist/esm/structs/kits/reflection.d.ts#L54) |
| `ReflectionQuery` | type | [Declaration](../../../dist/esm/structs/kits/reflection.d.ts#L43) |
| `ReflectionReport` | type | [Declaration](../../../dist/esm/structs/kits/reflection.d.ts#L89) |
| `ReflectionSource` | type | [Declaration](../../../dist/esm/structs/kits/reflection.d.ts#L69) |
| `ReflectionTask` | type | [Declaration](../../../dist/esm/structs/kits/reflection.d.ts#L131) |
| `RegisteredDomainTool` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L82) |
| `RegisteredGoal` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L82) |
| `RegisteredInteractionOutput` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L173) |
| `RegisteredLifecycleTool` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L142) |
| `RegisteredModelTool` | type | [Declaration](../../../dist/esm/structs/capabilities/model.d.ts#L56) |
| `RegisteredProtocol` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L149) |
| `RegisteredScope` | type | [Declaration](../../../dist/esm/structs/kits/domains/scopes.d.ts#L79) |
| `RegisteredScopeEvidence` | type | [Declaration](../../../dist/esm/structs/kits/domains/scopes.d.ts#L67) |
| `RegisteredTool` | type | [Declaration](../../../dist/esm/structs/capabilities/tools.d.ts#L65) |
| `RegisteredToolDefinition` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L142) |
| `RegisteredTransportOutput` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L173) |
| `RegistrationDefinition` | type | [Declaration](../../../dist/esm/structs/support/registration.d.ts#L11) |
| `Registry` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L76) |
| `ReplyBubbleInput` | type | [Declaration](../../../dist/esm/structs/kits/presentation/events.d.ts#L32) |
| `ReplyDeliveryOptions` | type | [Declaration](../../../dist/esm/structs/kits/presentation/events.d.ts#L39) |
| `ReplyGuidance` | type | [Declaration](../../../dist/esm/structs/model/runtime.d.ts#L195) |
| `ReportedStep` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L57) |
| `ReportedStepInput` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L111) |
| `ReportedStepLog` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L130) |
| `ReportedStepProgress` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L148) |
| `ReportedStepRecord` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L94) |
| `ReportedStepRecorder` | value + type | [Declaration](../../../dist/esm/diagnostics/sub-flow.d.ts#L45) |
| `ReportedStepStatus` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L55) |
| `reportedStepStatusCatalog` | value | [Declaration](../../../dist/esm/structs/debug.d.ts#L19) |
| `reportedStepStatuses` | value | [Declaration](../../../dist/esm/structs/debug.d.ts#L53) |
| `ReportedStepUpdate` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L119) |
| `ReportedStepValue` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L90) |
| `ResultReview` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L98) |
| `ResultReviewAdmissionRequest` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L105) |
| `ResultReviewCandidate` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L30) |
| `ResultReviewCoverage` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L45) |
| `ResultReviewDefinition` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L93) |
| `ResultReviewDetector` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L59) |
| `ResultReviewFinding` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L35) |
| `ResultReviewInput` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L12) |
| `ResultReviewRequest` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L24) |
| `ResultReviewResolution` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L74) |
| `ResultReviewResult` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L53) |
| `ResultReviewScope` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L4) |
| `ResultReviewStrategy` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L82) |
| `RetrievalDefinition` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L96) |
| `RetrievalEffect` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L49) |
| `RetrievalPorts` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L56) |
| `RetrievalReason` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L47) |
| `RetrievalReceipt` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L30) |
| `RetrievalResult` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L17) |
| `RetrievalRunner` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L87) |
| `RetrievalSource` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L13) |
| `RetrievalState` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L21) |
| `ReviewChoice` | type | [Declaration](../../../dist/esm/structs/kits/review-choice.d.ts#L21) |
| `ReviewChoiceAnswer` | type | [Declaration](../../../dist/esm/structs/kits/review-choice.d.ts#L16) |
| `ReviewChoiceDecision` | type | [Declaration](../../../dist/esm/structs/kits/review-choice.d.ts#L53) |
| `ReviewChoiceHost` | type | [Declaration](../../../dist/esm/structs/kits/review-choice.d.ts#L46) |
| `ReviewChoiceInput` | type | [Declaration](../../../dist/esm/structs/kits/review-choice.d.ts#L10) |
| `ReviewChoiceInspection` | type | [Declaration](../../../dist/esm/structs/kits/review-choice.d.ts#L34) |
| `ReviewDecision` | type | [Declaration](../../../dist/esm/structs/kits/review-decision.d.ts#L47) |
| `ReviewDecisionBinding` | type | [Declaration](../../../dist/esm/structs/kits/review-decision.d.ts#L5) |
| `ReviewDecisionDefinition` | type | [Declaration](../../../dist/esm/structs/kits/review-decision.d.ts#L26) |
| `ReviewDecisionState` | type | [Declaration](../../../dist/esm/structs/kits/review-decision.d.ts#L16) |
| `RuntimeNodeReportingContext` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L190) |
| `SchemaAdapter` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L29) |
| `ScopeDefinition` | type | [Declaration](../../../dist/esm/structs/kits/domains/scopes.d.ts#L15) |
| `ScopeDescription` | type | [Declaration](../../../dist/esm/structs/kits/domains/scopes.d.ts#L83) |
| `ScopedReportedStepInput` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L117) |
| `ScopedReportedStepRecorder` | value + type | [Declaration](../../../dist/esm/diagnostics/sub-flow.d.ts#L55) |
| `ScopedSubFlowLogger` | value + type | [Declaration](../../../dist/esm/diagnostics/sub-flow.d.ts#L55) |
| `ScopedSubFlowStepInput` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L117) |
| `ScopeRegistryPolicy` | type | [Declaration](../../../dist/esm/structs/kits/domains/scopes.d.ts#L40) |
| `SearchHit` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L118) |
| `SelectedTools` | type | [Declaration](../../../dist/esm/structs/support/tools.d.ts#L37) |
| `SemanticSlotDefinition` | type | [Declaration](../../../dist/esm/structs/kits/presentation/templates.d.ts#L19) |
| `SseEvent` | type | [Declaration](../../../dist/esm/structs/index.d.ts#L27) |
| `SseOutputEvent` | type | [Declaration](../../../dist/esm/structs/support/transport/sse.d.ts#L19) |
| `SseReadOptions` | type | [Declaration](../../../dist/esm/structs/index.d.ts#L27) |
| `SseWriter` | type | [Declaration](../../../dist/esm/structs/support/transport/sse.d.ts#L12) |
| `StepOutcome` | type | [Declaration](../../../dist/esm/structs/execution/engine.d.ts#L26) |
| `SubFlowLog` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L130) |
| `SubFlowLogger` | value + type | [Declaration](../../../dist/esm/diagnostics/sub-flow.d.ts#L45) |
| `SubFlowStepFix` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L119) |
| `SubFlowStepInput` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L111) |
| `SubFlowValue` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L90) |
| `SubStepProgress` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L148) |
| `TextSkill` | type | [Declaration](../../../dist/esm/structs/kits/text-skills.d.ts#L24) |
| `TextSkillHeader` | type | [Declaration](../../../dist/esm/structs/kits/text-skills.d.ts#L31) |
| `TextSkillLoader` | type | [Declaration](../../../dist/esm/structs/kits/text-skills.d.ts#L61) |
| `TextSkillLoaderDefinition` | type | [Declaration](../../../dist/esm/structs/kits/text-skills.d.ts#L36) |
| `TextSkillReadPorts` | type | [Declaration](../../../dist/esm/structs/kits/text-skills.d.ts#L56) |
| `TextSkillRegistration` | type | [Declaration](../../../dist/esm/structs/kits/text-skills.d.ts#L13) |
| `TextTemplateOptions` | type | [Declaration](../../../dist/esm/structs/kits/presentation/templates.d.ts#L10) |
| `TimestampMs` | type | [Declaration](../../../dist/esm/structs/common.d.ts#L15) |
| `Tool` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L219)；Use LifecycleTool and domainToolIds. |
| `ToolCallRecord` | type | [Declaration](../../../dist/esm/structs/invocation.d.ts#L48) |
| `ToolCatalog` | type | [Declaration](../../../dist/esm/structs/support/tools.d.ts#L66) |
| `ToolCatalogEntry` | type | [Declaration](../../../dist/esm/structs/support/tools.d.ts#L64) |
| `ToolCondition` | type | [Declaration](../../../dist/esm/structs/capabilities/model.d.ts#L29) |
| `ToolContext` | type | [Declaration](../../../dist/esm/structs/capabilities/model.d.ts#L18) |
| `ToolDefinition` | type | [Declaration](../../../dist/esm/structs/capabilities/tools.d.ts#L39) |
| `ToolDomainMembership` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L123) |
| `ToolExecutionContext` | type | [Declaration](../../../dist/esm/structs/capabilities/tools.d.ts#L41) |
| `ToolExecutionEvent` | type | [Declaration](../../../dist/esm/structs/capabilities/tools.d.ts#L67) |
| `ToolFinalizer` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L179) |
| `ToolInvocationPorts` | type | [Declaration](../../../dist/esm/structs/capabilities/invocation.d.ts#L51) |
| `ToolInvocationRequest` | type | [Declaration](../../../dist/esm/structs/capabilities/tools.d.ts#L88) |
| `ToolJournal` | type | [Declaration](../../../dist/esm/structs/capabilities/invocation.d.ts#L31) |
| `ToolJournalFinish` | type | [Declaration](../../../dist/esm/structs/capabilities/invocation.d.ts#L22) |
| `ToolJournalStart` | type | [Declaration](../../../dist/esm/structs/capabilities/invocation.d.ts#L13) |
| `ToolLifecycleHooks` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L72) |
| `ToolLifecyclePolicy` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L225) |
| `ToolLifecycleProtocol` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L59) |
| `ToolLifecycleRegistryOptions` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L231) |
| `ToolModelField` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L44) |
| `ToolModelView` | type | [Declaration](../../../dist/esm/structs/support/tools.d.ts#L23) |
| `ToolNormalizer` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L177) |
| `ToolOutput` | type | [Declaration](../../../dist/esm/structs/support/tools.d.ts#L41) |
| `ToolProposal` | type | [Declaration](../../../dist/esm/structs/capabilities/model.d.ts#L13) |
| `ToolProtocol` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L171) |
| `ToolRegistration` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L223)；Use LifecycleToolRegistration. |
| `ToolRegistryOptions` | type | [Declaration](../../../dist/esm/structs/capabilities/tools.d.ts#L99) |
| `ToolRegistryPorts` | type | [Declaration](../../../dist/esm/structs/capabilities/tools.d.ts#L78) |
| `ToolResult` | type | [Declaration](../../../dist/esm/structs/invocation.d.ts#L57) |
| `ToolRuntime` | type | [Declaration](../../../dist/esm/structs/support/tools.d.ts#L51) |
| `ToolRuntimeTypes` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L25) |
| `ToolsOptions` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L215)；Use ToolLifecycleRegistryOptions. |
| `ValidationError` | value + type | [Declaration](../../../dist/esm/structs/errors.d.ts#L17) |
| `WalkRule` | type | [Declaration](../../../dist/esm/structs/utils/rules.d.ts#L22) |
| `WorkflowChain` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L62) |
| `WorkflowChainCoverage` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L46) |
| `WorkflowChainNode` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L78) |
| `WorkflowChainNodeEvent` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L98) |
| `WorkflowChainSource` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L57) |
| `WorkflowChainTransition` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L111) |
| `WorkflowContext` | type | [Declaration](../../../dist/esm/structs/execution/workflow.d.ts#L26) |
| `WorkflowContractError` | value + type | [Declaration](../../../dist/esm/structs/errors.d.ts#L38) |
| `WorkflowEvent` | type | [Declaration](../../../dist/esm/structs/execution/workflow.d.ts#L119) |
| `WorkflowExtension` | type | [Declaration](../../../dist/esm/structs/execution/workflow.d.ts#L161) |
| `WorkflowFailure` | type | [Declaration](../../../dist/esm/structs/execution/workflow.d.ts#L156) |
| `WorkflowGraph` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L6) |
| `WorkflowGraphEdge` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L37) |
| `WorkflowGraphNode` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L15) |
| `WorkflowGraphRoute` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L28) |
| `WorkflowModel` | type | [Declaration](../../../dist/esm/structs/execution/workflow.d.ts#L175) |
| `WorkflowNode` | type | [Declaration](../../../dist/esm/structs/execution/workflow.d.ts#L73) |
| `WorkflowNodeReport` | type | [Declaration](../../../dist/esm/structs/execution/workflow.d.ts#L66) |
| `WorkflowNodeVisit` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L78) |
| `WorkflowNodeVisitEvent` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L98) |
| `WorkflowReportedStepRecord` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L71) |
| `WorkflowRoute` | type | [Declaration](../../../dist/esm/structs/execution/workflow.d.ts#L50) |
| `WorkflowRunTrace` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L62) |
| `WorkflowRunTraceCoverage` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L46) |
| `WorkflowRunTraceSource` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L57) |
| `WorkflowSubflowRecord` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L71) |
| `WorkflowTransitionRecord` | type | [Declaration](../../../dist/esm/structs/execution/workflow-views.d.ts#L111) |

## @jangts/agent-core/context

[Contracts and behavior](context-processing.md) · 13 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `assembleContextPlan` | value | [Declaration](../../../dist/esm/context/plan.d.ts#L14) |
| `assembleFragments` | value | [Declaration](../../../dist/esm/context/assembly.d.ts#L14) |
| `BuiltContext` | type | [Declaration](../../../dist/esm/structs/context/fragments.d.ts#L45) |
| `commonPrefixLength` | value | [Declaration](../../../dist/esm/utils/text.d.ts#L16) |
| `ContextFragment` | type | [Declaration](../../../dist/esm/structs/context/fragments.d.ts#L17) |
| `ContextFragmentUsage` | type | [Declaration](../../../dist/esm/structs/context/fragments.d.ts#L34) |
| `ContextJournal` | value + type | [Declaration](../../../dist/esm/context/journal.d.ts#L5) |
| `ContextLifetime` | type | [Declaration](../../../dist/esm/structs/context/fragments.d.ts#L15) |
| `ContextPlan` | type | [Declaration](../../../dist/esm/structs/context/processing.d.ts#L13) |
| `ContextRecord` | type | [Declaration](../../../dist/esm/structs/context/journal.d.ts#L26) |
| `ContextTrust` | type | [Declaration](../../../dist/esm/structs/context/fragments.d.ts#L13) |
| `validateContextBudget` | value | [Declaration](../../../dist/esm/context/fragments.d.ts#L39) |
| `validateContextFragment` | value | [Declaration](../../../dist/esm/context/fragments.d.ts#L26) |

## @jangts/agent-core/journal

[Contracts and behavior](observability.md) · 2 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `ContextJournal` | value + type | [Declaration](../../../dist/esm/context/journal.d.ts#L5) |
| `ContextRecord` | type | [Declaration](../../../dist/esm/structs/context/journal.d.ts#L26) |

## @jangts/agent-core/events

[Contracts and behavior](knowledge-answering.md) · 8 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `AgentOutputEvent` | type | [Declaration](../../../dist/esm/structs/kits/presentation/events.d.ts#L11) |
| `publishReplyEvents` | value | [Declaration](../../../dist/esm/kits/presentation/events.d.ts#L40) |
| `REPLY_BUBBLE_BOUNDARY` | value | [Declaration](../../../dist/esm/kits/presentation/events.d.ts#L19) |
| `ReplyBubbleInput` | type | [Declaration](../../../dist/esm/structs/kits/presentation/events.d.ts#L32) |
| `replyBubbleTexts` | value | [Declaration](../../../dist/esm/kits/presentation/events.d.ts#L26) |
| `ReplyDeliveryOptions` | type | [Declaration](../../../dist/esm/structs/kits/presentation/events.d.ts#L39) |
| `serializeOutputEvents` | value | [Declaration](../../../dist/esm/kits/presentation/events.d.ts#L53) |
| `textOutputEvents` | value | [Declaration](../../../dist/esm/kits/presentation/events.d.ts#L60) |

## @jangts/agent-core/errors

[Contracts and behavior](types.md) · 5 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `AgentErrorInfo` | type | [Declaration](../../../dist/esm/structs/errors.d.ts#L46) |
| `BudgetError` | value + type | [Declaration](../../../dist/esm/structs/errors.d.ts#L29) |
| `ErrorContext` | type | [Declaration](../../../dist/esm/structs/errors.d.ts#L61) |
| `ValidationError` | value + type | [Declaration](../../../dist/esm/structs/errors.d.ts#L17) |
| `WorkflowContractError` | value + type | [Declaration](../../../dist/esm/structs/errors.d.ts#L38) |

## @jangts/agent-core/tools

[Contracts and behavior](core.md) · 13 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `ErasedTool` | type | [Declaration](../../../dist/esm/structs/capabilities/tools.d.ts#L54) |
| `executeInvocation` | value | [Declaration](../../../dist/esm/capabilities/invocation.d.ts#L17) |
| `InvocationHandler` | type | [Declaration](../../../dist/esm/structs/capabilities/invocation.d.ts#L38) |
| `RegisteredTool` | type | [Declaration](../../../dist/esm/structs/capabilities/tools.d.ts#L65) |
| `ToolDefinition` | type | [Declaration](../../../dist/esm/structs/capabilities/tools.d.ts#L39) |
| `ToolExecutionContext` | type | [Declaration](../../../dist/esm/structs/capabilities/tools.d.ts#L41) |
| `ToolExecutionEvent` | type | [Declaration](../../../dist/esm/structs/capabilities/tools.d.ts#L67) |
| `ToolInvocationPorts` | type | [Declaration](../../../dist/esm/structs/capabilities/invocation.d.ts#L51) |
| `ToolInvocationRequest` | type | [Declaration](../../../dist/esm/structs/capabilities/tools.d.ts#L88) |
| `ToolJournal` | type | [Declaration](../../../dist/esm/structs/capabilities/invocation.d.ts#L31) |
| `ToolRegistry` | value + type | [Declaration](../../../dist/esm/capabilities/tools.d.ts#L7) |
| `ToolRegistryOptions` | type | [Declaration](../../../dist/esm/structs/capabilities/tools.d.ts#L99) |
| `ToolRegistryPorts` | type | [Declaration](../../../dist/esm/structs/capabilities/tools.d.ts#L78) |

## @jangts/agent-core/protocols

[Contracts and behavior](types.md) · 1 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `ProtocolRegistry` | value + type | [Declaration](../../../dist/esm/utils/protocol-registry.d.ts#L16) |

## @jangts/agent-core/sse

[Contracts and behavior](support.md) · 9 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `abortableStream` | value | [Declaration](../../../dist/esm/support/transport/sse.d.ts#L15) |
| `encodeSseEvent` | value | [Declaration](../../../dist/esm/support/transport/sse.d.ts#L25) |
| `readSse` | value | [Declaration](../../../dist/esm/support/transport/sse.d.ts#L13) |
| `SseEvent` | type | [Declaration](../../../dist/esm/support/transport/sse.d.ts#L13) |
| `SseIdleTimeoutError` | value + type | [Declaration](../../../dist/esm/support/transport/sse.d.ts#L13) |
| `SseOutputEvent` | type | [Declaration](../../../dist/esm/structs/support/transport/sse.d.ts#L19) |
| `SseReadOptions` | type | [Declaration](../../../dist/esm/support/transport/sse.d.ts#L13) |
| `SseWriter` | type | [Declaration](../../../dist/esm/structs/support/transport/sse.d.ts#L12) |
| `writeSseFrame` | value | [Declaration](../../../dist/esm/support/transport/sse.d.ts#L38) |

## @jangts/agent-core/json-transport

[Contracts and behavior](support.md) · 3 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `JsonFrameLimits` | type | [Declaration](../../../dist/esm/structs/support/transport/json.d.ts#L12) |
| `parseJsonFrames` | value | [Declaration](../../../dist/esm/support/transport/json.d.ts#L32) |
| `scanJsonObjectFrames` | value | [Declaration](../../../dist/esm/support/transport/json.d.ts#L18) |

## @jangts/agent-core/diagnostics

[Contracts and behavior](observability.md) · 39 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `CoreDiagnosticRecord` | type | [Declaration](../../../dist/esm/structs/diagnostics.d.ts#L279) |
| `CoreEvent` | type | [Declaration](../../../dist/esm/structs/diagnostics.d.ts#L207) |
| `coreEventCatalog` | value | [Declaration](../../../dist/esm/diagnostics/catalog.d.ts#L7) |
| `CoreEventDescriptor` | type | [Declaration](../../../dist/esm/structs/diagnostics.d.ts#L145) |
| `CoreEventName` | type | [Declaration](../../../dist/esm/structs/diagnostics.d.ts#L138) |
| `CoreEventPayloads` | type | [Declaration](../../../dist/esm/structs/diagnostics.d.ts#L17) |
| `CoreLogOutput` | type | [Declaration](../../../dist/esm/structs/diagnostics.d.ts#L232) |
| `createDiagnostics` | value | [Declaration](../../../dist/esm/diagnostics/index.d.ts#L18) |
| `CreateDiagnosticsOptions` | type | [Declaration](../../../dist/esm/structs/diagnostics.d.ts#L266) |
| `DebugStepsOutput` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L169) |
| `DiagnosticContext` | type | [Declaration](../../../dist/esm/structs/diagnostics.d.ts#L243) |
| `diagnosticError` | value | [Declaration](../../../dist/esm/diagnostics/index.d.ts#L27) |
| `DiagnosticIdentity` | type | [Declaration](../../../dist/esm/structs/diagnostics.d.ts#L150) |
| `DiagnosticSpanFields` | type | [Declaration](../../../dist/esm/structs/diagnostics.d.ts#L199) |
| `NodeReportingContext` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L140) |
| `normalizeDiagnosticEvent` | value | [Declaration](../../../dist/esm/diagnostics/index.d.ts#L41) |
| `RecordedSubStep` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L94) |
| `ReportedStep` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L57) |
| `ReportedStepInput` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L111) |
| `ReportedStepLog` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L130) |
| `ReportedStepProgress` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L148) |
| `ReportedStepRecord` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L94) |
| `ReportedStepRecorder` | value + type | [Declaration](../../../dist/esm/diagnostics/sub-flow.d.ts#L45) |
| `ReportedStepStatus` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L55) |
| `reportedStepStatusCatalog` | value | [Declaration](../../../dist/esm/structs/debug.d.ts#L19) |
| `reportedStepStatuses` | value | [Declaration](../../../dist/esm/structs/debug.d.ts#L53) |
| `ReportedStepUpdate` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L119) |
| `ReportedStepValue` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L90) |
| `RuntimeNodeReportingContext` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L190) |
| `ScopedReportedStepInput` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L117) |
| `ScopedReportedStepRecorder` | value + type | [Declaration](../../../dist/esm/diagnostics/sub-flow.d.ts#L55) |
| `ScopedSubFlowLogger` | value + type | [Declaration](../../../dist/esm/diagnostics/sub-flow.d.ts#L55) |
| `ScopedSubFlowStepInput` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L117) |
| `SubFlowLog` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L130) |
| `SubFlowLogger` | value + type | [Declaration](../../../dist/esm/diagnostics/sub-flow.d.ts#L45) |
| `SubFlowStepFix` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L119) |
| `SubFlowStepInput` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L111) |
| `SubFlowValue` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L90) |
| `SubStepProgress` | type | [Declaration](../../../dist/esm/structs/debug.d.ts#L148) |

## @jangts/agent-core/kits/knowledge

[Contracts and behavior](knowledge-answering.md) · 19 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `defineKnowledgeCatalog` | value | [Declaration](../../../dist/esm/kits/knowledge/catalog.d.ts#L15) |
| `defineKnowledgePublication` | value | [Declaration](../../../dist/esm/kits/knowledge/publication.d.ts#L17) |
| `Knowledge` | value | [Declaration](../../../dist/esm/kits/knowledge/index.d.ts#L18) |
| `KnowledgeCandidate` | type | [Declaration](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L26) |
| `KnowledgeCatalog` | type | [Declaration](../../../dist/esm/structs/kits/knowledge.d.ts#L67) |
| `KnowledgeCatalogOptions` | type | [Declaration](../../../dist/esm/structs/kits/knowledge.d.ts#L60) |
| `KnowledgeDocument` | type | [Declaration](../../../dist/esm/structs/kits/knowledge.d.ts#L22) |
| `KnowledgePart` | type | [Declaration](../../../dist/esm/structs/kits/knowledge.d.ts#L20) |
| `KnowledgePublication` | type | [Declaration](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L76) |
| `knowledgePublicationOperations` | value | [Declaration](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L15) |
| `KnowledgePublicationOptions` | type | [Declaration](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L58) |
| `KnowledgePublicationRecord` | type | [Declaration](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L40) |
| `KnowledgePublicationStore` | type | [Declaration](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L51) |
| `KnowledgeRead` | type | [Declaration](../../../dist/esm/structs/kits/knowledge.d.ts#L44) |
| `KnowledgeSection` | type | [Declaration](../../../dist/esm/structs/kits/knowledge.d.ts#L13) |
| `KnowledgeSnapshot` | type | [Declaration](../../../dist/esm/structs/kits/knowledge.d.ts#L50) |
| `KnowledgeSourceReference` | type | [Declaration](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L17) |
| `parseKnowledgeDocument` | value | [Declaration](../../../dist/esm/kits/knowledge/sections.d.ts#L18) |
| `SectionSelection` | type | [Declaration](../../../dist/esm/structs/kits/knowledge.d.ts#L33) |

## @jangts/agent-core/kits/presentation

[Contracts and behavior](knowledge-answering.md) · 30 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `AgentOutputEvent` | type | [Declaration](../../../dist/esm/structs/kits/presentation/events.d.ts#L11) |
| `CompiledReplyFormat` | type | [Declaration](../../../dist/esm/structs/kits/presentation/formats.d.ts#L31) |
| `defineOutputCatalog` | value | [Declaration](../../../dist/esm/kits/presentation/outputs.d.ts#L16) |
| `defineReplyFormats` | value | [Declaration](../../../dist/esm/kits/presentation/formats.d.ts#L38) |
| `defineSemanticSlots` | value | [Declaration](../../../dist/esm/kits/presentation/templates.d.ts#L37) |
| `defineTextTemplate` | value | [Declaration](../../../dist/esm/kits/presentation/templates.d.ts#L21) |
| `mergeReplyBubbles` | value | [Declaration](../../../dist/esm/kits/presentation/formats.d.ts#L29) |
| `OutputCatalogOptions` | type | [Declaration](../../../dist/esm/structs/kits/presentation/outputs.d.ts#L77) |
| `OutputComposeInput` | type | [Declaration](../../../dist/esm/structs/kits/presentation/outputs.d.ts#L60) |
| `OutputDefinition` | type | [Declaration](../../../dist/esm/structs/kits/presentation/outputs.d.ts#L33) |
| `OutputField` | type | [Declaration](../../../dist/esm/structs/kits/presentation/outputs.d.ts#L13) |
| `OutputIssue` | type | [Declaration](../../../dist/esm/structs/kits/presentation/outputs.d.ts#L56) |
| `OutputProvider` | type | [Declaration](../../../dist/esm/structs/kits/presentation/outputs.d.ts#L48) |
| `OutputResult` | type | [Declaration](../../../dist/esm/structs/kits/presentation/outputs.d.ts#L71) |
| `Presentation` | value | [Declaration](../../../dist/esm/kits/presentation/index.d.ts#L25) |
| `publishReplyEvents` | value | [Declaration](../../../dist/esm/kits/presentation/events.d.ts#L40) |
| `REPLY_BUBBLE_BOUNDARY` | value | [Declaration](../../../dist/esm/kits/presentation/events.d.ts#L19) |
| `ReplyBubbleInput` | type | [Declaration](../../../dist/esm/structs/kits/presentation/events.d.ts#L32) |
| `replyBubbleTexts` | value | [Declaration](../../../dist/esm/kits/presentation/events.d.ts#L26) |
| `ReplyDeliveryOptions` | type | [Declaration](../../../dist/esm/structs/kits/presentation/events.d.ts#L39) |
| `ReplyFormatCheck` | type | [Declaration](../../../dist/esm/structs/kits/presentation/formats.d.ts#L11) |
| `replyFormatChecks` | value | [Declaration](../../../dist/esm/kits/presentation/formats.d.ts#L5) |
| `ReplyFormatDefinition` | type | [Declaration](../../../dist/esm/structs/kits/presentation/formats.d.ts#L20) |
| `ReplyFormatOptions` | type | [Declaration](../../../dist/esm/structs/kits/presentation/formats.d.ts#L39) |
| `resolvePreference` | value | [Declaration](../../../dist/esm/kits/presentation/variants.d.ts#L34) |
| `selectVariant` | value | [Declaration](../../../dist/esm/kits/presentation/variants.d.ts#L20) |
| `SemanticSlotDefinition` | type | [Declaration](../../../dist/esm/structs/kits/presentation/templates.d.ts#L19) |
| `serializeOutputEvents` | value | [Declaration](../../../dist/esm/kits/presentation/events.d.ts#L53) |
| `textOutputEvents` | value | [Declaration](../../../dist/esm/kits/presentation/events.d.ts#L60) |
| `TextTemplateOptions` | type | [Declaration](../../../dist/esm/structs/kits/presentation/templates.d.ts#L10) |

## @jangts/agent-core/kits/answering

[Contracts and behavior](knowledge-answering.md) · 16 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `AnswerCheck` | type | [Declaration](../../../dist/esm/structs/kits/answering/flow.d.ts#L16) |
| `AnswerChecker` | type | [Declaration](../../../dist/esm/structs/kits/answering/checks.d.ts#L11) |
| `AnswerFlowDefinition` | type | [Declaration](../../../dist/esm/structs/kits/answering/flow.d.ts#L45) |
| `Answering` | value | [Declaration](../../../dist/esm/kits/answering/index.d.ts#L21) |
| `AnswerIssue` | type | [Declaration](../../../dist/esm/structs/kits/answering/flow.d.ts#L13) |
| `AnswerItem` | type | [Declaration](../../../dist/esm/structs/kits/answering/flow.d.ts#L19) |
| `AnswerReader` | type | [Declaration](../../../dist/esm/structs/kits/answering/tasks.d.ts#L38) |
| `AnswerResult` | type | [Declaration](../../../dist/esm/structs/kits/answering/flow.d.ts#L30) |
| `AnswerTaskBase` | type | [Declaration](../../../dist/esm/structs/kits/answering/tasks.d.ts#L11) |
| `AnswerTaskDefinition` | type | [Declaration](../../../dist/esm/structs/kits/answering/tasks.d.ts#L30) |
| `AnswerTaskPorts` | type | [Declaration](../../../dist/esm/structs/kits/answering/tasks.d.ts#L46) |
| `defineAnswerCheckCatalog` | value | [Declaration](../../../dist/esm/kits/answering/checks.d.ts#L15) |
| `defineAnswerFlow` | value | [Declaration](../../../dist/esm/kits/answering/flow.d.ts#L17) |
| `defineAnswerReaderCatalog` | value | [Declaration](../../../dist/esm/kits/answering/tasks.d.ts#L10) |
| `defineAnswerTaskCatalog` | value | [Declaration](../../../dist/esm/kits/answering/tasks.d.ts#L30) |
| `validateAnswerBatch` | value | [Declaration](../../../dist/esm/kits/answering/batch.d.ts#L19) |

## @jangts/agent-core/support

[Contracts and behavior](support.md) · 232 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `abortableStream` | value | [Declaration](../../../dist/esm/support/index.d.ts#L15) |
| `AggregatedToolCall` | type | [Declaration](../../../dist/esm/model/interactions/calls.d.ts#L13) |
| `assembleFragments` | value | [Declaration](../../../dist/esm/context/assembly.d.ts#L14) |
| `assessModelBudget` | value | [Declaration](../../../dist/esm/support/model/budget-assessment.d.ts#L39) |
| `AssociatedRegistration` | type | [Declaration](../../../dist/esm/structs/support/associations.d.ts#L6) |
| `AssociationOptions` | type | [Declaration](../../../dist/esm/structs/support/associations.d.ts#L12) |
| `AssociationSource` | type | [Declaration](../../../dist/esm/structs/support/associations.d.ts#L17) |
| `BackgroundModelInput` | type | [Declaration](../../../dist/esm/support/model/lifecycle/background.d.ts#L5) |
| `BreakCheck` | type | [Declaration](../../../dist/esm/structs/utils/rules.d.ts#L33) |
| `BreakEvent` | type | [Declaration](../../../dist/esm/structs/utils/rules.d.ts#L42) |
| `BreakPredicate` | type | [Declaration](../../../dist/esm/structs/utils/rules.d.ts#L31) |
| `BreakReason` | type | [Declaration](../../../dist/esm/structs/utils/rules.d.ts#L29) |
| `breakWhile` | value | [Declaration](../../../dist/esm/utils/rules.d.ts#L56) |
| `BreakWhileConfig` | type | [Declaration](../../../dist/esm/structs/utils/rules.d.ts#L49) |
| `BudgetAssessment` | type | [Declaration](../../../dist/esm/support/model/budget-assessment.d.ts#L28) |
| `BudgetAssessmentInput` | type | [Declaration](../../../dist/esm/support/model/budget-assessment.d.ts#L15) |
| `BuiltContext` | type | [Declaration](../../../dist/esm/structs/context/fragments.d.ts#L45) |
| `CapabilityCatalogOptions` | type | [Declaration](../../../dist/esm/structs/support/capabilities.d.ts#L31) |
| `CapabilityModule` | type | [Declaration](../../../dist/esm/structs/support/capabilities.d.ts#L20) |
| `CapabilityToolReferences` | type | [Declaration](../../../dist/esm/structs/support/capabilities.d.ts#L11) |
| `chatCompletionFunctionOptions` | value | [Declaration](../../../dist/esm/support/model/chat-completions.d.ts#L22) |
| `chatCompletionMessages` | value | [Declaration](../../../dist/esm/support/model/chat-completions.d.ts#L47) |
| `chatCompletionParts` | value | [Declaration](../../../dist/esm/support/model/chat-completions.d.ts#L33) |
| `commonPrefixLength` | value | [Declaration](../../../dist/esm/utils/text.d.ts#L16) |
| `CompatibleModelConfig` | type | [Declaration](../../../dist/esm/structs/support/model/provider.d.ts#L74) |
| `CompatibleModelPorts` | type | [Declaration](../../../dist/esm/structs/support/model/provider.d.ts#L98) |
| `CompatibleModelProvider` | value + type | [Declaration](../../../dist/esm/support/model/compatible-provider.d.ts#L11) |
| `CompatibleModelProviderOptions` | type | [Declaration](../../../dist/esm/structs/support/model/provider.d.ts#L118) |
| `CompiledTool` | type | [Declaration](../../../dist/esm/structs/support/tools.d.ts#L43) |
| `CompletionFailure` | type | [Declaration](../../../dist/esm/structs/support/model/completion.d.ts#L29) |
| `CompletionPolicy` | type | [Declaration](../../../dist/esm/structs/support/model/completion.d.ts#L40) |
| `completionPolicyCatalog` | value | [Declaration](../../../dist/esm/support/model/completion/index.d.ts#L7) |
| `CompletionRequestFacts` | type | [Declaration](../../../dist/esm/structs/support/model/completion.d.ts#L20) |
| `CompletionSession` | type | [Declaration](../../../dist/esm/structs/support/model/completion.d.ts#L31) |
| `configureBreakWhile` | value | [Declaration](../../../dist/esm/utils/break-observer.d.ts#L19) |
| `connectModelWebRTC` | value | [Declaration](../../../dist/esm/support/model/lifecycle/realtime.d.ts#L31) |
| `connectModelWebSocket` | value | [Declaration](../../../dist/esm/support/model/lifecycle/realtime.d.ts#L24) |
| `ContextAssemblyOptions` | type | [Declaration](../../../dist/esm/structs/support/context.d.ts#L35) |
| `ContextBuilder` | type | [Declaration](../../../dist/esm/structs/support/context.d.ts#L49) |
| `ContextBuilderOptions` | type | [Declaration](../../../dist/esm/structs/support/context.d.ts#L28) |
| `ContextCompressionCall` | type | [Declaration](../../../dist/esm/structs/support/context-processing.d.ts#L160) |
| `ContextCompressor` | type | [Declaration](../../../dist/esm/structs/support/context-processing.d.ts#L169) |
| `ContextFragment` | type | [Declaration](../../../dist/esm/structs/context/fragments.d.ts#L17) |
| `ContextFragmentConfig` | type | [Declaration](../../../dist/esm/structs/support/context.d.ts#L42) |
| `ContextFragmentUsage` | type | [Declaration](../../../dist/esm/structs/context/fragments.d.ts#L34) |
| `contextHandlerCalls` | value | [Declaration](../../../dist/esm/support/context/selection-policy.d.ts#L19) |
| `ContextHandlerReference` | type | [Declaration](../../../dist/esm/structs/support/context-processing.d.ts#L36) |
| `ContextHistoryGrouping` | type | [Declaration](../../../dist/esm/structs/support/context-processing.d.ts#L20) |
| `contextHistoryStrategies` | value | [Declaration](../../../dist/esm/support/context/strategies.d.ts#L10) |
| `ContextLifetime` | type | [Declaration](../../../dist/esm/structs/context/fragments.d.ts#L15) |
| `ContextModelCall` | type | [Declaration](../../../dist/esm/structs/support/context-processing.d.ts#L221) |
| `ContextModelRequest` | type | [Declaration](../../../dist/esm/structs/support/context-processing.d.ts#L208) |
| `ContextNodeResult` | type | [Declaration](../../../dist/esm/support/context/nodes.d.ts#L7) |
| `ContextPlan` | type | [Declaration](../../../dist/esm/structs/context/processing.d.ts#L13) |
| `ContextPolicy` | type | [Declaration](../../../dist/esm/structs/support/context-processing.d.ts#L134) |
| `contextPolicyCatalog` | value | [Declaration](../../../dist/esm/support/context/processing.d.ts#L181) |
| `ContextProcessingNodeDefinition` | type | [Declaration](../../../dist/esm/support/context/nodes.d.ts#L22) |
| `ContextProcessingOptions` | type | [Declaration](../../../dist/esm/structs/support/context-processing.d.ts#L225) |
| `ContextProcessingReport` | type | [Declaration](../../../dist/esm/structs/support/context-processing.d.ts#L177) |
| `ContextProjection` | type | [Declaration](../../../dist/esm/structs/support/context.d.ts#L15) |
| `ContextRecentHistory` | type | [Declaration](../../../dist/esm/structs/support/context-processing.d.ts#L27) |
| `ContextReduction` | type | [Declaration](../../../dist/esm/structs/support/context-processing.d.ts#L41) |
| `contextReductionCatalog` | value | [Declaration](../../../dist/esm/support/context/processing.d.ts#L31) |
| `ContextReductionNodeDefinition` | type | [Declaration](../../../dist/esm/support/context/nodes.d.ts#L68) |
| `ContextSelection` | type | [Declaration](../../../dist/esm/structs/support/context-processing.d.ts#L62) |
| `ContextSelectionCall` | type | [Declaration](../../../dist/esm/structs/support/context-processing.d.ts#L108) |
| `ContextSelectionCandidate` | type | [Declaration](../../../dist/esm/structs/support/context-processing.d.ts#L84) |
| `contextSelectionCatalog` | value | [Declaration](../../../dist/esm/support/context/selection-policy.d.ts#L46) |
| `ContextSelectionNodeDefinition` | type | [Declaration](../../../dist/esm/support/context/nodes.d.ts#L59) |
| `ContextSelectionResult` | type | [Declaration](../../../dist/esm/support/context/nodes.d.ts#L54) |
| `ContextSelector` | type | [Declaration](../../../dist/esm/structs/support/context-processing.d.ts#L126) |
| `ContextStageResult` | type | [Declaration](../../../dist/esm/support/context/nodes.d.ts#L45) |
| `ContextStrategy` | type | [Declaration](../../../dist/esm/support/context/strategies.d.ts#L63) |
| `ContextStrategyOptions` | type | [Declaration](../../../dist/esm/support/context/strategies.d.ts#L57) |
| `ContextStrategySettings` | type | [Declaration](../../../dist/esm/support/context/strategies.d.ts#L39) |
| `ContextTokenMeasurement` | type | [Declaration](../../../dist/esm/structs/support/context-processing.d.ts#L100) |
| `ContextTrust` | type | [Declaration](../../../dist/esm/structs/context/fragments.d.ts#L13) |
| `createBackgroundModelProvider` | value | [Declaration](../../../dist/esm/support/model/lifecycle/background.d.ts#L10) |
| `createBatchModelProvider` | value | [Declaration](../../../dist/esm/support/model/lifecycle/batch.d.ts#L18) |
| `createContextCompressor` | value | [Declaration](../../../dist/esm/support/context/compression.d.ts#L20) |
| `createContextProcessingNode` | value | [Declaration](../../../dist/esm/support/context/nodes.d.ts#L84) |
| `createContextReductionNode` | value | [Declaration](../../../dist/esm/support/context/nodes.d.ts#L107) |
| `createContextSelectionNode` | value | [Declaration](../../../dist/esm/support/context/nodes.d.ts#L95) |
| `createContextSelector` | value | [Declaration](../../../dist/esm/support/context/selection.d.ts#L16) |
| `createContextStrategy` | value | [Declaration](../../../dist/esm/support/context/strategies.d.ts#L85) |
| `createJsonInteraction` | value | [Declaration](../../../dist/esm/support/model/transports.d.ts#L43) |
| `createJsonTransport` | value | [Declaration](../../../dist/esm/support/model/transports.d.ts#L43) |
| `createMemoryContinuationStore` | value | [Declaration](../../../dist/esm/support/model/continuation.d.ts#L17) |
| `createModelInteraction` | value | [Declaration](../../../dist/esm/support/model/transports.d.ts#L6) |
| `createModelProvider` | value | [Declaration](../../../dist/esm/support/model/provider-factory.d.ts#L35) |
| `createModelStrategy` | value | [Declaration](../../../dist/esm/support/model/strategies.d.ts#L75) |
| `createModelTransport` | value | [Declaration](../../../dist/esm/support/model/transports.d.ts#L6) |
| `createOperationHttpProvider` | value | [Declaration](../../../dist/esm/support/model/lifecycle/http.d.ts#L17) |
| `createProviderObservationScope` | value | [Declaration](../../../dist/esm/support/model/observer.d.ts#L32) |
| `createRealtimeProtocolProvider` | value | [Declaration](../../../dist/esm/support/model/lifecycle/realtime.d.ts#L10) |
| `createReplyPreview` | value | [Declaration](../../../dist/esm/support/model/reply-preview.d.ts#L44) |
| `createReplyPreviewRules` | value | [Declaration](../../../dist/esm/support/model/preview-rules.d.ts#L44) |
| `createRequestRecovery` | value | [Declaration](../../../dist/esm/support/recovery.d.ts#L18) |
| `createStageModelInteraction` | value | [Declaration](../../../dist/esm/support/model/stage-transport.d.ts#L11) |
| `createStageModelTransport` | value | [Declaration](../../../dist/esm/support/model/stage-transport.d.ts#L11) |
| `createTextInteraction` | value | [Declaration](../../../dist/esm/support/model/transports.d.ts#L24) |
| `createTextTransport` | value | [Declaration](../../../dist/esm/support/model/transports.d.ts#L24) |
| `createToolCallCollector` | value | [Declaration](../../../dist/esm/model/interactions/calls.d.ts#L40) |
| `createWebSocketDuplex` | value | [Declaration](../../../dist/esm/support/model/lifecycle/realtime.d.ts#L18) |
| `DecodedModelResponseToolCall` | type | [Declaration](../../../dist/esm/support/model/session.d.ts#L7) |
| `DecodedModelToolResponse` | type | [Declaration](../../../dist/esm/support/model/session.d.ts#L16) |
| `DecodedSessionCall` | type | [Declaration](../../../dist/esm/support/model/session.d.ts#L7) |
| `DecodedSessionResult` | type | [Declaration](../../../dist/esm/support/model/session.d.ts#L16) |
| `defaultCompletionPolicy` | value | [Declaration](../../../dist/esm/support/model/completion/default.d.ts#L11) |
| `defineAssociatedCatalog` | value | [Declaration](../../../dist/esm/support/associations.d.ts#L3) |
| `defineCapabilityCatalog` | value | [Declaration](../../../dist/esm/support/capabilities.d.ts#L28) |
| `defineContextAssembly` | value | [Declaration](../../../dist/esm/support/context/assembly.d.ts#L15) |
| `defineContextFragments` | value | [Declaration](../../../dist/esm/support/context/assembly.d.ts#L28) |
| `defineModelTools` | value | [Declaration](../../../dist/esm/support/model/capabilities.d.ts#L22) |
| `defineRegistrationCatalog` | value | [Declaration](../../../dist/esm/support/registration.d.ts#L13) |
| `defineSchema` | value | [Declaration](../../../dist/esm/support/schema.d.ts#L41) |
| `defineTool` | value | [Declaration](../../../dist/esm/support/tools.d.ts#L16) |
| `defineToolCatalog` | value | [Declaration](../../../dist/esm/support/tools.d.ts#L33) |
| `encodeSseEvent` | value | [Declaration](../../../dist/esm/support/transport/sse.d.ts#L25) |
| `fromJsonSchema` | value | [Declaration](../../../dist/esm/support/schema.d.ts#L16) |
| `fromParserSchema` | value | [Declaration](../../../dist/esm/support/schema.d.ts#L28) |
| `HostedToolEvent` | type | [Declaration](../../../dist/esm/support/model/protocols/hosted.d.ts#L4) |
| `JsonFrameLimits` | type | [Declaration](../../../dist/esm/structs/support/transport/json.d.ts#L12) |
| `jsonObjectInteraction` | value | [Declaration](../../../dist/esm/model/interactions/json-object.d.ts#L9) |
| `JsonSchemaOptions` | type | [Declaration](../../../dist/esm/structs/support/schema.d.ts#L18) |
| `JsonSchemaValidator` | type | [Declaration](../../../dist/esm/structs/support/schema.d.ts#L11) |
| `matchRule` | value | [Declaration](../../../dist/esm/utils/rules.d.ts#L26) |
| `MatchRule` | type | [Declaration](../../../dist/esm/structs/utils/rules.d.ts#L12) |
| `ModelBatchItem` | type | [Declaration](../../../dist/esm/support/model/lifecycle/batch.d.ts#L5) |
| `ModelBatchItemResult` | type | [Declaration](../../../dist/esm/support/model/lifecycle/batch.d.ts#L10) |
| `modelBudgetStrategies` | value | [Declaration](../../../dist/esm/support/model/strategies.d.ts#L11) |
| `ModelBudgetStrategy` | type | [Declaration](../../../dist/esm/support/model/strategies.d.ts#L35) |
| `ModelChildrenOptions` | type | [Declaration](../../../dist/esm/support/model/children.d.ts#L14) |
| `ModelChildTask` | type | [Declaration](../../../dist/esm/support/model/children.d.ts#L5) |
| `ModelChoiceIndex` | type | [Declaration](../../../dist/esm/structs/support/model/provider.d.ts#L113) |
| `ModelContinuationIdentity` | type | [Declaration](../../../dist/esm/support/model/continuation.d.ts#L7) |
| `ModelEndpointCapabilities` | type | [Declaration](../../../dist/esm/support/model/protocols/capabilities.d.ts#L3) |
| `ModelInteractionAdapter` | type | [Declaration](../../../dist/esm/structs/model/interactions.d.ts#L52) |
| `modelInteractionCatalog` | value | [Declaration](../../../dist/esm/support/model/interactions/index.d.ts#L6) |
| `ModelInteractionRegistration` | type | [Declaration](../../../dist/esm/structs/model/interactions.d.ts#L67) |
| `ModelProtocol` | type | [Declaration](../../../dist/esm/support/model/protocols/requests.d.ts#L3) |
| `modelProtocolCatalog` | value | [Declaration](../../../dist/esm/support/model/protocols/requests.d.ts#L5) |
| `ModelProviderConfig` | type | [Declaration](../../../dist/esm/support/model/provider-factory.d.ts#L11) |
| `ModelProviderErrorCode` | type | [Declaration](../../../dist/esm/structs/support/model/provider.d.ts#L15) |
| `ModelProviderFailure` | type | [Declaration](../../../dist/esm/structs/support/model/provider.d.ts#L37) |
| `ModelResourceInput` | type | [Declaration](../../../dist/esm/support/model/resources.d.ts#L20) |
| `ModelResourcePorts` | type | [Declaration](../../../dist/esm/support/model/resources.d.ts#L33) |
| `ModelResourceRunner` | type | [Declaration](../../../dist/esm/support/model/resources.d.ts#L25) |
| `ModelResourceSource` | type | [Declaration](../../../dist/esm/support/model/resources.d.ts#L8) |
| `ModelResponseCollector` | type | [Declaration](../../../dist/esm/structs/model/interactions.d.ts#L14) |
| `ModelStageInteractionRegistration` | type | [Declaration](../../../dist/esm/structs/support/model/interactions.d.ts#L15) |
| `ModelStageTransportRegistration` | type | [Declaration](../../../dist/esm/structs/support/model/interactions.d.ts#L15) |
| `ModelStrategyOptions` | type | [Declaration](../../../dist/esm/support/model/strategies.d.ts#L43) |
| `ModelToolInteractionOptions` | type | [Declaration](../../../dist/esm/support/model/session.d.ts#L27) |
| `ModelToolInteractionRegistration` | type | [Declaration](../../../dist/esm/support/model/session.d.ts#L33) |
| `ModelTransportRegistration` | type | [Declaration](../../../dist/esm/structs/model/interactions.d.ts#L67) |
| `NativeFunctionCall` | type | [Declaration](../../../dist/esm/structs/model/interactions.d.ts#L80) |
| `nativeFunctionInteraction` | value | [Declaration](../../../dist/esm/model/interactions/native-functions.d.ts#L8) |
| `openProtocolRealtime` | value | [Declaration](../../../dist/esm/support/model/lifecycle/session.d.ts#L6) |
| `OperationHttpConfig` | type | [Declaration](../../../dist/esm/support/model/lifecycle/http.d.ts#L3) |
| `parseJsonFrames` | value | [Declaration](../../../dist/esm/support/transport/json.d.ts#L32) |
| `parseModelContinuation` | value | [Declaration](../../../dist/esm/support/model/continuation.d.ts#L15) |
| `PreparedModelSelection` | type | [Declaration](../../../dist/esm/structs/model/interactions.d.ts#L32) |
| `PreparedModelToolInteraction` | type | [Declaration](../../../dist/esm/support/model/session.d.ts#L20) |
| `PreparedSessionTransport` | type | [Declaration](../../../dist/esm/support/model/session.d.ts#L20) |
| `prepareModelResources` | value | [Declaration](../../../dist/esm/support/model/resources.d.ts#L55) |
| `prepareModelToolInteraction` | value | [Declaration](../../../dist/esm/support/model/session.d.ts#L52) |
| `prepareSessionFunctions` | value | [Declaration](../../../dist/esm/support/model/session.d.ts#L52) |
| `PreviewTool` | type | [Declaration](../../../dist/esm/support/model/preview-rules.d.ts#L5) |
| `processContext` | value | [Declaration](../../../dist/esm/support/context/processing.d.ts#L235) |
| `ProviderAssistantMessage` | type | [Declaration](../../../dist/esm/structs/support/model/messages.d.ts#L31) |
| `ProviderErrorCapture` | type | [Declaration](../../../dist/esm/structs/support/model/provider-observer.d.ts#L63) |
| `ProviderEventDescriptor` | type | [Declaration](../../../dist/esm/structs/support/model/provider-observer.d.ts#L44) |
| `ProviderEventName` | type | [Declaration](../../../dist/esm/structs/support/model/provider-observer.d.ts#L42) |
| `ProviderEventPayloads` | type | [Declaration](../../../dist/esm/structs/support/model/provider-observer.d.ts#L13) |
| `ProviderMessage` | type | [Declaration](../../../dist/esm/structs/support/model/messages.d.ts#L47) |
| `ProviderObservation` | type | [Declaration](../../../dist/esm/structs/support/model/provider-observer.d.ts#L49) |
| `ProviderObserver` | type | [Declaration](../../../dist/esm/structs/support/model/provider-observer.d.ts#L56) |
| `ProviderReasoningLevel` | type | [Declaration](../../../dist/esm/structs/support/model/provider.d.ts#L45) |
| `ProviderReasoningStrategy` | type | [Declaration](../../../dist/esm/structs/support/model/provider.d.ts#L52) |
| `ProviderSystemMessage` | type | [Declaration](../../../dist/esm/structs/support/model/messages.d.ts#L15) |
| `ProviderToolCall` | type | [Declaration](../../../dist/esm/structs/support/model/messages.d.ts#L13) |
| `ProviderToolMessage` | type | [Declaration](../../../dist/esm/structs/support/model/messages.d.ts#L39) |
| `ProviderUserMessage` | type | [Declaration](../../../dist/esm/structs/support/model/messages.d.ts#L23) |
| `readSse` | value | [Declaration](../../../dist/esm/support/index.d.ts#L15) |
| `realtimeFunctionResponse` | value | [Declaration](../../../dist/esm/support/model/lifecycle/realtime.d.ts#L14) |
| `realtimeInput` | value | [Declaration](../../../dist/esm/support/model/lifecycle/realtime.d.ts#L12) |
| `RealtimeProtocolConfig` | type | [Declaration](../../../dist/esm/support/model/lifecycle/realtime.d.ts#L3) |
| `realtimeToolResult` | value | [Declaration](../../../dist/esm/support/model/lifecycle/realtime.d.ts#L16) |
| `RecoveredResult` | type | [Declaration](../../../dist/esm/support/recovery.d.ts#L8) |
| `RegistrationDefinition` | type | [Declaration](../../../dist/esm/structs/support/registration.d.ts#L11) |
| `RemainingModelWork` | type | [Declaration](../../../dist/esm/support/model/budget-assessment.d.ts#L8) |
| `ReplyGuidanceSources` | type | [Declaration](../../../dist/esm/support/reply-guidance.d.ts#L4) |
| `ReplyPreviewOptions` | type | [Declaration](../../../dist/esm/support/model/reply-preview.d.ts#L29) |
| `ReplyPreviewRule` | type | [Declaration](../../../dist/esm/support/model/reply-preview.d.ts#L7) |
| `ReplyPreviewStage` | type | [Declaration](../../../dist/esm/support/model/preview-rules.d.ts#L25) |
| `ReplyPreviewTool` | type | [Declaration](../../../dist/esm/support/model/preview-rules.d.ts#L13) |
| `RequestRecovery` | type | [Declaration](../../../dist/esm/support/recovery.d.ts#L2) |
| `reservedContextCalls` | value | [Declaration](../../../dist/esm/support/context/selection-policy.d.ts#L10) |
| `resolveReplyGuidance` | value | [Declaration](../../../dist/esm/support/reply-guidance.d.ts#L15) |
| `retryMultipleModelCalls` | value | [Declaration](../../../dist/esm/model/decision-retry.d.ts#L11) |
| `runChildren` | value | [Declaration](../../../dist/esm/support/model/children.d.ts#L37) |
| `scanJsonObjectFrames` | value | [Declaration](../../../dist/esm/support/transport/json.d.ts#L18) |
| `selectContextSteps` | value | [Declaration](../../../dist/esm/support/context/selection-policy.d.ts#L85) |
| `SelectedTools` | type | [Declaration](../../../dist/esm/structs/support/tools.d.ts#L37) |
| `serializeModelContinuation` | value | [Declaration](../../../dist/esm/support/model/continuation.d.ts#L13) |
| `sessionCompletionPolicy` | value | [Declaration](../../../dist/esm/support/model/completion/session.d.ts#L16) |
| `SessionFunctionOptions` | type | [Declaration](../../../dist/esm/support/model/session.d.ts#L27) |
| `SessionModelTransportRegistration` | type | [Declaration](../../../dist/esm/support/model/session.d.ts#L33) |
| `SseEvent` | type | [Declaration](../../../dist/esm/support/index.d.ts#L15) |
| `SseIdleTimeoutError` | value + type | [Declaration](../../../dist/esm/support/index.d.ts#L15) |
| `SseOutputEvent` | type | [Declaration](../../../dist/esm/structs/support/transport/sse.d.ts#L19) |
| `SseReadOptions` | type | [Declaration](../../../dist/esm/support/index.d.ts#L15) |
| `SseWriter` | type | [Declaration](../../../dist/esm/structs/support/transport/sse.d.ts#L12) |
| `streamEvents` | value | [Declaration](../../../dist/esm/support/stream-events.d.ts#L23) |
| `ToolAssociation` | type | [Declaration](../../../dist/esm/structs/support/associations.d.ts#L4) |
| `ToolCallCollector` | type | [Declaration](../../../dist/esm/model/interactions/calls.d.ts#L22) |
| `ToolCallFailure` | type | [Declaration](../../../dist/esm/model/interactions/calls.d.ts#L20) |
| `ToolCatalog` | type | [Declaration](../../../dist/esm/structs/support/tools.d.ts#L66) |
| `ToolCatalogEntry` | type | [Declaration](../../../dist/esm/structs/support/tools.d.ts#L64) |
| `ToolDefinition` | type | [Declaration](../../../dist/esm/structs/capabilities/tools.d.ts#L39) |
| `ToolModelView` | type | [Declaration](../../../dist/esm/structs/support/tools.d.ts#L23) |
| `ToolOutput` | type | [Declaration](../../../dist/esm/structs/support/tools.d.ts#L41) |
| `ToolProposal` | type | [Declaration](../../../dist/esm/structs/capabilities/model.d.ts#L13) |
| `ToolRuntime` | type | [Declaration](../../../dist/esm/structs/support/tools.d.ts#L51) |
| `transformContextText` | value | [Declaration](../../../dist/esm/support/context/assembly.d.ts#L39) |
| `validateContextPolicy` | value | [Declaration](../../../dist/esm/support/context/processing.d.ts#L17) |
| `validateContextSelection` | value | [Declaration](../../../dist/esm/support/context/selection-policy.d.ts#L72) |
| `validateToolReferences` | value | [Declaration](../../../dist/esm/support/capabilities.d.ts#L14) |
| `WalkRule` | type | [Declaration](../../../dist/esm/structs/utils/rules.d.ts#L22) |
| `walkRules` | value | [Declaration](../../../dist/esm/utils/rules.d.ts#L36) |
| `writeSseFrame` | value | [Declaration](../../../dist/esm/support/transport/sse.d.ts#L38) |

## @jangts/agent-core/skills

[Contracts and behavior](skills.en.md) · 3 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `TaskSkill` | type | [Declaration](../../../dist/esm/skills/index.d.ts#L6) |
| `TaskSkillId` | type | [Declaration](../../../dist/esm/skills/index.d.ts#L4) |
| `taskSkills` | value | [Declaration](../../../dist/esm/skills/index.d.ts#L13) |

## @jangts/agent-core/kits/normalization

[Contracts and behavior](kits.md) · 5 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `defineNormalization` | value | [Declaration](../../../dist/esm/kits/normalization.d.ts#L15) |
| `Normalization` | value | [Declaration](../../../dist/esm/kits/normalization.d.ts#L37) |
| `NormalizationOptions` | type | [Declaration](../../../dist/esm/structs/kits/normalization.d.ts#L20) |
| `NormalizationStep` | type | [Declaration](../../../dist/esm/structs/kits/normalization.d.ts#L11) |
| `uniqueBy` | value | [Declaration](../../../dist/esm/kits/normalization.d.ts#L34) |

## @jangts/agent-core/kits/delivery

[Contracts and behavior](kits.md) · 8 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `defineDelivery` | value | [Declaration](../../../dist/esm/kits/delivery.d.ts#L47)；Use defineDeliveryPipeline. |
| `defineDeliveryPipeline` | value | [Declaration](../../../dist/esm/kits/delivery.d.ts#L16) |
| `Delivery` | value | [Declaration](../../../dist/esm/kits/delivery.d.ts#L41)；Use DeliveryPipeline. Same immutable namespace and implementation. |
| `DeliveryOptions` | type | [Declaration](../../../dist/esm/structs/kits/delivery.d.ts#L41)；Use DeliveryPipelineOptions. |
| `DeliveryPipeline` | value | [Declaration](../../../dist/esm/kits/delivery.d.ts#L35) |
| `DeliveryPipelineOptions` | type | [Declaration](../../../dist/esm/structs/kits/delivery.d.ts#L25) |
| `DeliveryPipelineStage` | type | [Declaration](../../../dist/esm/structs/kits/delivery.d.ts#L13) |
| `DeliveryStage` | type | [Declaration](../../../dist/esm/structs/kits/delivery.d.ts#L39)；Use DeliveryPipelineStage. |

## @jangts/agent-core/kits/projection

[Contracts and behavior](kits.md) · 7 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `ContentProjection` | type | [Declaration](../../../dist/esm/structs/kits/projection.d.ts#L11) |
| `ContentProjectionOptions` | type | [Declaration](../../../dist/esm/structs/kits/projection.d.ts#L18) |
| `defineContentProjection` | value | [Declaration](../../../dist/esm/kits/projection.d.ts#L15) |
| `defineTreeProjection` | value | [Declaration](../../../dist/esm/kits/projection.d.ts#L48) |
| `projectContinuousExcerpt` | value | [Declaration](../../../dist/esm/kits/projection.d.ts#L34) |
| `Projection` | value | [Declaration](../../../dist/esm/kits/projection.d.ts#L53) |
| `TreeProjectionOptions` | type | [Declaration](../../../dist/esm/structs/kits/projection.d.ts#L29) |

## @jangts/agent-core/kits/aggregation

[Contracts and behavior](kits.md) · 8 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `aggregateBranchResults` | value | [Declaration](../../../dist/esm/kits/aggregation.d.ts#L55) |
| `Aggregation` | value | [Declaration](../../../dist/esm/kits/aggregation.d.ts#L58) |
| `BranchAggregationRequest` | type | [Declaration](../../../dist/esm/structs/kits/aggregation.d.ts#L29) |
| `BranchAggregationResult` | type | [Declaration](../../../dist/esm/structs/kits/aggregation.d.ts#L34) |
| `BranchResult` | type | [Declaration](../../../dist/esm/structs/kits/aggregation.d.ts#L19) |
| `defineQueryAggregation` | value | [Declaration](../../../dist/esm/kits/aggregation.d.ts#L29) |
| `mergeByKey` | value | [Declaration](../../../dist/esm/kits/aggregation.d.ts#L14) |
| `QueryAggregationOptions` | type | [Declaration](../../../dist/esm/structs/kits/aggregation.d.ts#L10) |

## @jangts/agent-core/kits/retrieval

[Contracts and behavior](kits.md) · 12 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `defineRetrieval` | value | [Declaration](../../../dist/esm/kits/retrieval.d.ts#L18) |
| `Retrieval` | value | [Declaration](../../../dist/esm/kits/retrieval.d.ts#L23) |
| `RetrievalDefinition` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L96) |
| `RetrievalEffect` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L49) |
| `RetrievalPorts` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L56) |
| `retrievalQueryKey` | value | [Declaration](../../../dist/esm/utils/query-key.d.ts#L12) |
| `RetrievalReason` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L47) |
| `RetrievalReceipt` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L30) |
| `RetrievalResult` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L17) |
| `RetrievalRunner` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L87) |
| `RetrievalSource` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L13) |
| `RetrievalState` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L21) |

## @jangts/agent-core/kits/evidence

[Contracts and behavior](kits.md) · 7 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `defineEvidenceChecklist` | value | [Declaration](../../../dist/esm/kits/evidence.d.ts#L14) |
| `defineEvidenceProjection` | value | [Declaration](../../../dist/esm/kits/evidence.d.ts#L40) |
| `Evidence` | value | [Declaration](../../../dist/esm/kits/evidence.d.ts#L48) |
| `EvidenceProjectionDefinition` | type | [Declaration](../../../dist/esm/structs/kits/evidence.d.ts#L36) |
| `EvidenceProjectionProvider` | type | [Declaration](../../../dist/esm/structs/kits/evidence.d.ts#L29) |
| `EvidenceProvider` | type | [Declaration](../../../dist/esm/structs/kits/evidence.d.ts#L21) |
| `EvidenceRequirement` | type | [Declaration](../../../dist/esm/structs/kits/evidence.d.ts#L12) |

## @jangts/agent-core/kits/policies

[Contracts and behavior](kits.md) · 7 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `definePolicySet` | value | [Declaration](../../../dist/esm/kits/policies.d.ts#L14) |
| `defineRecoveryChain` | value | [Declaration](../../../dist/esm/kits/policies.d.ts#L40) |
| `Policies` | value | [Declaration](../../../dist/esm/kits/policies.d.ts#L72) |
| `PolicyAssessment` | type | [Declaration](../../../dist/esm/structs/kits/policies.d.ts#L22) |
| `PolicyDefinition` | type | [Declaration](../../../dist/esm/structs/kits/policies.d.ts#L11) |
| `RecoveryDefinition` | type | [Declaration](../../../dist/esm/structs/kits/policies.d.ts#L40) |
| `RecoveryResult` | type | [Declaration](../../../dist/esm/structs/kits/policies.d.ts#L31) |

## @jangts/agent-core/kits/candidates

[Contracts and behavior](kits.md) · 3 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `Candidates` | value | [Declaration](../../../dist/esm/kits/candidates.d.ts#L35) |
| `CandidateSelectionDefinition` | type | [Declaration](../../../dist/esm/structs/kits/candidates.d.ts#L16) |
| `defineCandidateSelection` | value | [Declaration](../../../dist/esm/kits/candidates.d.ts#L24) |

## @jangts/agent-core/kits/text-skills

[Contracts and behavior](kits.md) · 8 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `defineTextSkillLoader` | value | [Declaration](../../../dist/esm/kits/text-skills.d.ts#L16) |
| `TextSkill` | type | [Declaration](../../../dist/esm/structs/kits/text-skills.d.ts#L24) |
| `TextSkillHeader` | type | [Declaration](../../../dist/esm/structs/kits/text-skills.d.ts#L31) |
| `TextSkillLoader` | type | [Declaration](../../../dist/esm/structs/kits/text-skills.d.ts#L61) |
| `TextSkillLoaderDefinition` | type | [Declaration](../../../dist/esm/structs/kits/text-skills.d.ts#L36) |
| `TextSkillReadPorts` | type | [Declaration](../../../dist/esm/structs/kits/text-skills.d.ts#L56) |
| `TextSkillRegistration` | type | [Declaration](../../../dist/esm/structs/kits/text-skills.d.ts#L13) |
| `TextSkills` | value | [Declaration](../../../dist/esm/kits/text-skills.d.ts#L19) |

## @jangts/agent-core/kits/interaction

[Contracts and behavior](kits.md) · 23 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `bindInteraction` | value | [Declaration](../../../dist/esm/kits/interaction/handlers.d.ts#L21) |
| `Command` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L93) |
| `CommandCatalog` | value + type | [Declaration](../../../dist/esm/kits/interaction/commands.d.ts#L19) |
| `CommandCatalogOptions` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L115) |
| `CommandDefinition` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L58) |
| `commandSchema` | value | [Declaration](../../../dist/esm/kits/interaction/command.d.ts#L41) |
| `compileCommands` | value | [Declaration](../../../dist/esm/kits/interaction/command.d.ts#L28) |
| `defineCommand` | value | [Declaration](../../../dist/esm/kits/interaction/command.d.ts#L15) |
| `defineCommandCatalog` | value | [Declaration](../../../dist/esm/kits/interaction/commands.d.ts#L89) |
| `defineInteractionProtocol` | value | [Declaration](../../../dist/esm/kits/interaction/transfer.d.ts#L65) |
| `Interaction` | value + type | [Declaration](../../../dist/esm/kits/interaction/transfer.d.ts#L11) |
| `INTERACTION_CATEGORIES` | value | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L28) |
| `InteractionCategory` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L26) |
| `InteractionDescriptor` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L30) |
| `InteractionHandlers` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L41) |
| `InteractionProtocol` | value + type | [Declaration](../../../dist/esm/kits/interaction/transfer.d.ts#L11) |
| `InteractionProtocolDefinition` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L128) |
| `ProtocolCheck` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L47) |
| `ProtocolField` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L15) |
| `ProtocolPredicate` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L45) |
| `ProtocolReason` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L43) |
| `ProtocolShape` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L138) |
| `RegisteredProtocol` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L149) |

## @jangts/agent-core/kits/domains

[Contracts and behavior](kits.md) · 35 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `AgentCatalogPorts` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L77) |
| `CatalogDomainTool` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L12) |
| `CatalogExecutionTool` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L29) |
| `CatalogGoal` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L12) |
| `CatalogScope` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L17) |
| `CatalogTask` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L22) |
| `CatalogTool` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L29) |
| `createDomainToolRegistry` | value | [Declaration](../../../dist/esm/kits/domains/registry.d.ts#L105) |
| `createGoalRegistry` | value | [Declaration](../../../dist/esm/kits/domains/registry.d.ts#L105) |
| `createScopeRegistry` | value | [Declaration](../../../dist/esm/kits/domains/scopes.d.ts#L165) |
| `defineAgentCatalog` | value | [Declaration](../../../dist/esm/kits/domains/catalog.d.ts#L16) |
| `DescribedTool` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L42) |
| `DomainTool` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L15) |
| `domainToolDelegates` | value | [Declaration](../../../dist/esm/kits/domains/catalog.d.ts#L78) |
| `DomainToolDescription` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L71) |
| `DomainToolId` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L75) |
| `DomainToolPolicy` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L44) |
| `DomainToolRegistration` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L42) |
| `DomainToolRegistry` | value + type | [Declaration](../../../dist/esm/kits/domains/registry.d.ts#L9) |
| `goalDelegates` | value | [Declaration](../../../dist/esm/kits/domains/catalog.d.ts#L78) |
| `GoalDescription` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L71) |
| `GoalId` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L75) |
| `GoalPolicy` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L44) |
| `GoalRegistry` | value + type | [Declaration](../../../dist/esm/kits/domains/registry.d.ts#L9) |
| `GoalTool` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L15) |
| `GoalToolRegistration` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L42) |
| `LegacyAgentCatalogPorts` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L51) |
| `RegisteredDomainTool` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L82) |
| `RegisteredGoal` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L82) |
| `RegisteredScope` | type | [Declaration](../../../dist/esm/structs/kits/domains/scopes.d.ts#L79) |
| `RegisteredScopeEvidence` | type | [Declaration](../../../dist/esm/structs/kits/domains/scopes.d.ts#L67) |
| `ScopeDefinition` | type | [Declaration](../../../dist/esm/structs/kits/domains/scopes.d.ts#L15) |
| `ScopeDescription` | type | [Declaration](../../../dist/esm/structs/kits/domains/scopes.d.ts#L83) |
| `ScopeRegistry` | value + type | [Declaration](../../../dist/esm/kits/domains/scopes.d.ts#L17) |
| `ScopeRegistryPolicy` | type | [Declaration](../../../dist/esm/structs/kits/domains/scopes.d.ts#L40) |

## @jangts/agent-core/kits/tools

[Contracts and behavior](kits.md) · 21 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `LifecycleHooks` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L72) |
| `LifecycleProtocol` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L59) |
| `LifecycleTool` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L131) |
| `LifecycleToolRegistration` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L133) |
| `Policy` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L211)；Use ToolLifecyclePolicy. |
| `RegisteredLifecycleTool` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L142) |
| `RegisteredToolDefinition` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L142) |
| `Tool` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L219)；Use LifecycleTool and domainToolIds. |
| `ToolFinalizer` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L179) |
| `ToolJournal` | type | [Declaration](../../../dist/esm/structs/capabilities/invocation.d.ts#L31) |
| `ToolLifecycleHooks` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L72) |
| `ToolLifecyclePolicy` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L225) |
| `ToolLifecycleProtocol` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L59) |
| `ToolLifecycleRegistry` | value + type | [Declaration](../../../dist/esm/kits/tools.d.ts#L20) |
| `ToolLifecycleRegistryOptions` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L231) |
| `ToolModelField` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L44) |
| `ToolNormalizer` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L177) |
| `ToolProtocol` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L171) |
| `ToolRegistration` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L223)；Use LifecycleToolRegistration. |
| `ToolRuntimeTypes` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L25) |
| `ToolsOptions` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L215)；Use ToolLifecycleRegistryOptions. |

## @jangts/agent-core/support/context

[Contracts and behavior](support.md) · 57 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `assembleFragments` | value | [Declaration](../../../dist/esm/context/assembly.d.ts#L14) |
| `BuiltContext` | type | [Declaration](../../../dist/esm/structs/context/fragments.d.ts#L45) |
| `commonPrefixLength` | value | [Declaration](../../../dist/esm/utils/text.d.ts#L16) |
| `ContextAssemblyOptions` | type | [Declaration](../../../dist/esm/structs/support/context.d.ts#L35) |
| `ContextBuilder` | type | [Declaration](../../../dist/esm/structs/support/context.d.ts#L49) |
| `ContextBuilderOptions` | type | [Declaration](../../../dist/esm/structs/support/context.d.ts#L28) |
| `ContextCompressionCall` | type | [Declaration](../../../dist/esm/structs/support/context-processing.d.ts#L160) |
| `ContextCompressor` | type | [Declaration](../../../dist/esm/structs/support/context-processing.d.ts#L169) |
| `ContextFragment` | type | [Declaration](../../../dist/esm/structs/context/fragments.d.ts#L17) |
| `ContextFragmentConfig` | type | [Declaration](../../../dist/esm/structs/support/context.d.ts#L42) |
| `ContextFragmentUsage` | type | [Declaration](../../../dist/esm/structs/context/fragments.d.ts#L34) |
| `contextHandlerCalls` | value | [Declaration](../../../dist/esm/support/context/selection-policy.d.ts#L19) |
| `ContextHandlerReference` | type | [Declaration](../../../dist/esm/structs/support/context-processing.d.ts#L36) |
| `ContextHistoryGrouping` | type | [Declaration](../../../dist/esm/structs/support/context-processing.d.ts#L20) |
| `contextHistoryStrategies` | value | [Declaration](../../../dist/esm/support/context/strategies.d.ts#L10) |
| `ContextLifetime` | type | [Declaration](../../../dist/esm/structs/context/fragments.d.ts#L15) |
| `ContextModelCall` | type | [Declaration](../../../dist/esm/structs/support/context-processing.d.ts#L221) |
| `ContextModelRequest` | type | [Declaration](../../../dist/esm/structs/support/context-processing.d.ts#L208) |
| `ContextNodeResult` | type | [Declaration](../../../dist/esm/support/context/nodes.d.ts#L7) |
| `ContextPlan` | type | [Declaration](../../../dist/esm/structs/context/processing.d.ts#L13) |
| `ContextPolicy` | type | [Declaration](../../../dist/esm/structs/support/context-processing.d.ts#L134) |
| `contextPolicyCatalog` | value | [Declaration](../../../dist/esm/support/context/processing.d.ts#L181) |
| `ContextProcessingNodeDefinition` | type | [Declaration](../../../dist/esm/support/context/nodes.d.ts#L22) |
| `ContextProcessingOptions` | type | [Declaration](../../../dist/esm/structs/support/context-processing.d.ts#L225) |
| `ContextProcessingReport` | type | [Declaration](../../../dist/esm/structs/support/context-processing.d.ts#L177) |
| `ContextProjection` | type | [Declaration](../../../dist/esm/structs/support/context.d.ts#L15) |
| `ContextRecentHistory` | type | [Declaration](../../../dist/esm/structs/support/context-processing.d.ts#L27) |
| `ContextReduction` | type | [Declaration](../../../dist/esm/structs/support/context-processing.d.ts#L41) |
| `contextReductionCatalog` | value | [Declaration](../../../dist/esm/support/context/processing.d.ts#L31) |
| `ContextReductionNodeDefinition` | type | [Declaration](../../../dist/esm/support/context/nodes.d.ts#L68) |
| `ContextSelection` | type | [Declaration](../../../dist/esm/structs/support/context-processing.d.ts#L62) |
| `ContextSelectionCall` | type | [Declaration](../../../dist/esm/structs/support/context-processing.d.ts#L108) |
| `ContextSelectionCandidate` | type | [Declaration](../../../dist/esm/structs/support/context-processing.d.ts#L84) |
| `contextSelectionCatalog` | value | [Declaration](../../../dist/esm/support/context/selection-policy.d.ts#L46) |
| `ContextSelectionNodeDefinition` | type | [Declaration](../../../dist/esm/support/context/nodes.d.ts#L59) |
| `ContextSelectionResult` | type | [Declaration](../../../dist/esm/support/context/nodes.d.ts#L54) |
| `ContextSelector` | type | [Declaration](../../../dist/esm/structs/support/context-processing.d.ts#L126) |
| `ContextStageResult` | type | [Declaration](../../../dist/esm/support/context/nodes.d.ts#L45) |
| `ContextStrategy` | type | [Declaration](../../../dist/esm/support/context/strategies.d.ts#L63) |
| `ContextStrategyOptions` | type | [Declaration](../../../dist/esm/support/context/strategies.d.ts#L57) |
| `ContextStrategySettings` | type | [Declaration](../../../dist/esm/support/context/strategies.d.ts#L39) |
| `ContextTokenMeasurement` | type | [Declaration](../../../dist/esm/structs/support/context-processing.d.ts#L100) |
| `ContextTrust` | type | [Declaration](../../../dist/esm/structs/context/fragments.d.ts#L13) |
| `createContextCompressor` | value | [Declaration](../../../dist/esm/support/context/compression.d.ts#L20) |
| `createContextProcessingNode` | value | [Declaration](../../../dist/esm/support/context/nodes.d.ts#L84) |
| `createContextReductionNode` | value | [Declaration](../../../dist/esm/support/context/nodes.d.ts#L107) |
| `createContextSelectionNode` | value | [Declaration](../../../dist/esm/support/context/nodes.d.ts#L95) |
| `createContextSelector` | value | [Declaration](../../../dist/esm/support/context/selection.d.ts#L16) |
| `createContextStrategy` | value | [Declaration](../../../dist/esm/support/context/strategies.d.ts#L85) |
| `defineContextAssembly` | value | [Declaration](../../../dist/esm/support/context/assembly.d.ts#L15) |
| `defineContextFragments` | value | [Declaration](../../../dist/esm/support/context/assembly.d.ts#L28) |
| `processContext` | value | [Declaration](../../../dist/esm/support/context/processing.d.ts#L235) |
| `reservedContextCalls` | value | [Declaration](../../../dist/esm/support/context/selection-policy.d.ts#L10) |
| `selectContextSteps` | value | [Declaration](../../../dist/esm/support/context/selection-policy.d.ts#L85) |
| `transformContextText` | value | [Declaration](../../../dist/esm/support/context/assembly.d.ts#L39) |
| `validateContextPolicy` | value | [Declaration](../../../dist/esm/support/context/processing.d.ts#L17) |
| `validateContextSelection` | value | [Declaration](../../../dist/esm/support/context/selection-policy.d.ts#L72) |

## @jangts/agent-core/support/model

[Contracts and behavior](support.md) · 114 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `AggregatedToolCall` | type | [Declaration](../../../dist/esm/model/interactions/calls.d.ts#L13) |
| `assessModelBudget` | value | [Declaration](../../../dist/esm/support/model/budget-assessment.d.ts#L39) |
| `BackgroundModelInput` | type | [Declaration](../../../dist/esm/support/model/lifecycle/background.d.ts#L5) |
| `BudgetAssessment` | type | [Declaration](../../../dist/esm/support/model/budget-assessment.d.ts#L28) |
| `BudgetAssessmentInput` | type | [Declaration](../../../dist/esm/support/model/budget-assessment.d.ts#L15) |
| `chatCompletionFunctionOptions` | value | [Declaration](../../../dist/esm/support/model/chat-completions.d.ts#L22) |
| `chatCompletionMessages` | value | [Declaration](../../../dist/esm/support/model/chat-completions.d.ts#L47) |
| `chatCompletionParts` | value | [Declaration](../../../dist/esm/support/model/chat-completions.d.ts#L33) |
| `CompatibleModelConfig` | type | [Declaration](../../../dist/esm/structs/support/model/provider.d.ts#L74) |
| `CompatibleModelPorts` | type | [Declaration](../../../dist/esm/structs/support/model/provider.d.ts#L98) |
| `CompatibleModelProvider` | value + type | [Declaration](../../../dist/esm/support/model/compatible-provider.d.ts#L11) |
| `CompatibleModelProviderOptions` | type | [Declaration](../../../dist/esm/structs/support/model/provider.d.ts#L118) |
| `CompletionFailure` | type | [Declaration](../../../dist/esm/structs/support/model/completion.d.ts#L29) |
| `CompletionPolicy` | type | [Declaration](../../../dist/esm/structs/support/model/completion.d.ts#L40) |
| `completionPolicyCatalog` | value | [Declaration](../../../dist/esm/support/model/completion/index.d.ts#L7) |
| `CompletionRequestFacts` | type | [Declaration](../../../dist/esm/structs/support/model/completion.d.ts#L20) |
| `CompletionSession` | type | [Declaration](../../../dist/esm/structs/support/model/completion.d.ts#L31) |
| `connectModelWebRTC` | value | [Declaration](../../../dist/esm/support/model/lifecycle/realtime.d.ts#L31) |
| `connectModelWebSocket` | value | [Declaration](../../../dist/esm/support/model/lifecycle/realtime.d.ts#L24) |
| `createBackgroundModelProvider` | value | [Declaration](../../../dist/esm/support/model/lifecycle/background.d.ts#L10) |
| `createBatchModelProvider` | value | [Declaration](../../../dist/esm/support/model/lifecycle/batch.d.ts#L18) |
| `createJsonInteraction` | value | [Declaration](../../../dist/esm/support/model/transports.d.ts#L43) |
| `createJsonTransport` | value | [Declaration](../../../dist/esm/support/model/transports.d.ts#L43) |
| `createMemoryContinuationStore` | value | [Declaration](../../../dist/esm/support/model/continuation.d.ts#L17) |
| `createModelInteraction` | value | [Declaration](../../../dist/esm/support/model/transports.d.ts#L6) |
| `createModelProvider` | value | [Declaration](../../../dist/esm/support/model/provider-factory.d.ts#L35) |
| `createModelStrategy` | value | [Declaration](../../../dist/esm/support/model/strategies.d.ts#L75) |
| `createModelTransport` | value | [Declaration](../../../dist/esm/support/model/transports.d.ts#L6) |
| `createOperationHttpProvider` | value | [Declaration](../../../dist/esm/support/model/lifecycle/http.d.ts#L17) |
| `createProviderObservationScope` | value | [Declaration](../../../dist/esm/support/model/observer.d.ts#L32) |
| `createRealtimeProtocolProvider` | value | [Declaration](../../../dist/esm/support/model/lifecycle/realtime.d.ts#L10) |
| `createReplyPreviewRules` | value | [Declaration](../../../dist/esm/support/model/preview-rules.d.ts#L44) |
| `createStageModelInteraction` | value | [Declaration](../../../dist/esm/support/model/stage-transport.d.ts#L11) |
| `createStageModelTransport` | value | [Declaration](../../../dist/esm/support/model/stage-transport.d.ts#L11) |
| `createTextInteraction` | value | [Declaration](../../../dist/esm/support/model/transports.d.ts#L24) |
| `createTextTransport` | value | [Declaration](../../../dist/esm/support/model/transports.d.ts#L24) |
| `createToolCallCollector` | value | [Declaration](../../../dist/esm/model/interactions/calls.d.ts#L40) |
| `createWebSocketDuplex` | value | [Declaration](../../../dist/esm/support/model/lifecycle/realtime.d.ts#L18) |
| `DecodedModelResponseToolCall` | type | [Declaration](../../../dist/esm/support/model/session.d.ts#L7) |
| `DecodedModelToolResponse` | type | [Declaration](../../../dist/esm/support/model/session.d.ts#L16) |
| `DecodedSessionCall` | type | [Declaration](../../../dist/esm/support/model/session.d.ts#L7) |
| `DecodedSessionResult` | type | [Declaration](../../../dist/esm/support/model/session.d.ts#L16) |
| `defaultCompletionPolicy` | value | [Declaration](../../../dist/esm/support/model/completion/default.d.ts#L11) |
| `defineModelTools` | value | [Declaration](../../../dist/esm/support/model/capabilities.d.ts#L22) |
| `HostedToolEvent` | type | [Declaration](../../../dist/esm/support/model/protocols/hosted.d.ts#L4) |
| `jsonObjectInteraction` | value | [Declaration](../../../dist/esm/model/interactions/json-object.d.ts#L9) |
| `ModelBatchItem` | type | [Declaration](../../../dist/esm/support/model/lifecycle/batch.d.ts#L5) |
| `ModelBatchItemResult` | type | [Declaration](../../../dist/esm/support/model/lifecycle/batch.d.ts#L10) |
| `modelBudgetStrategies` | value | [Declaration](../../../dist/esm/support/model/strategies.d.ts#L11) |
| `ModelBudgetStrategy` | type | [Declaration](../../../dist/esm/support/model/strategies.d.ts#L35) |
| `ModelChildrenOptions` | type | [Declaration](../../../dist/esm/support/model/children.d.ts#L14) |
| `ModelChildTask` | type | [Declaration](../../../dist/esm/support/model/children.d.ts#L5) |
| `ModelChoiceIndex` | type | [Declaration](../../../dist/esm/structs/support/model/provider.d.ts#L113) |
| `ModelContinuationIdentity` | type | [Declaration](../../../dist/esm/support/model/continuation.d.ts#L7) |
| `ModelEndpointCapabilities` | type | [Declaration](../../../dist/esm/support/model/protocols/capabilities.d.ts#L3) |
| `ModelInteractionAdapter` | type | [Declaration](../../../dist/esm/structs/model/interactions.d.ts#L52) |
| `modelInteractionCatalog` | value | [Declaration](../../../dist/esm/support/model/interactions/index.d.ts#L6) |
| `ModelInteractionRegistration` | type | [Declaration](../../../dist/esm/structs/model/interactions.d.ts#L67) |
| `ModelProtocol` | type | [Declaration](../../../dist/esm/support/model/protocols/requests.d.ts#L3) |
| `modelProtocolCatalog` | value | [Declaration](../../../dist/esm/support/model/protocols/requests.d.ts#L5) |
| `ModelProviderConfig` | type | [Declaration](../../../dist/esm/support/model/provider-factory.d.ts#L11) |
| `ModelProviderErrorCode` | type | [Declaration](../../../dist/esm/structs/support/model/provider.d.ts#L15) |
| `ModelProviderFailure` | type | [Declaration](../../../dist/esm/structs/support/model/provider.d.ts#L37) |
| `ModelResourceInput` | type | [Declaration](../../../dist/esm/support/model/resources.d.ts#L20) |
| `ModelResourcePorts` | type | [Declaration](../../../dist/esm/support/model/resources.d.ts#L33) |
| `ModelResourceRunner` | type | [Declaration](../../../dist/esm/support/model/resources.d.ts#L25) |
| `ModelResourceSource` | type | [Declaration](../../../dist/esm/support/model/resources.d.ts#L8) |
| `ModelResponseCollector` | type | [Declaration](../../../dist/esm/structs/model/interactions.d.ts#L14) |
| `ModelStageInteractionRegistration` | type | [Declaration](../../../dist/esm/structs/support/model/interactions.d.ts#L15) |
| `ModelStageTransportRegistration` | type | [Declaration](../../../dist/esm/structs/support/model/interactions.d.ts#L15) |
| `ModelStrategyOptions` | type | [Declaration](../../../dist/esm/support/model/strategies.d.ts#L43) |
| `ModelToolInteractionOptions` | type | [Declaration](../../../dist/esm/support/model/session.d.ts#L27) |
| `ModelToolInteractionRegistration` | type | [Declaration](../../../dist/esm/support/model/session.d.ts#L33) |
| `ModelTransportRegistration` | type | [Declaration](../../../dist/esm/structs/model/interactions.d.ts#L67) |
| `NativeFunctionCall` | type | [Declaration](../../../dist/esm/structs/model/interactions.d.ts#L80) |
| `nativeFunctionInteraction` | value | [Declaration](../../../dist/esm/model/interactions/native-functions.d.ts#L8) |
| `openProtocolRealtime` | value | [Declaration](../../../dist/esm/support/model/lifecycle/session.d.ts#L6) |
| `OperationHttpConfig` | type | [Declaration](../../../dist/esm/support/model/lifecycle/http.d.ts#L3) |
| `parseModelContinuation` | value | [Declaration](../../../dist/esm/support/model/continuation.d.ts#L15) |
| `PreparedModelSelection` | type | [Declaration](../../../dist/esm/structs/model/interactions.d.ts#L32) |
| `PreparedModelToolInteraction` | type | [Declaration](../../../dist/esm/support/model/session.d.ts#L20) |
| `PreparedSessionTransport` | type | [Declaration](../../../dist/esm/support/model/session.d.ts#L20) |
| `prepareModelResources` | value | [Declaration](../../../dist/esm/support/model/resources.d.ts#L55) |
| `prepareModelToolInteraction` | value | [Declaration](../../../dist/esm/support/model/session.d.ts#L52) |
| `prepareSessionFunctions` | value | [Declaration](../../../dist/esm/support/model/session.d.ts#L52) |
| `PreviewTool` | type | [Declaration](../../../dist/esm/support/model/preview-rules.d.ts#L5) |
| `ProviderAssistantMessage` | type | [Declaration](../../../dist/esm/structs/support/model/messages.d.ts#L31) |
| `ProviderErrorCapture` | type | [Declaration](../../../dist/esm/structs/support/model/provider-observer.d.ts#L63) |
| `ProviderEventDescriptor` | type | [Declaration](../../../dist/esm/structs/support/model/provider-observer.d.ts#L44) |
| `ProviderEventName` | type | [Declaration](../../../dist/esm/structs/support/model/provider-observer.d.ts#L42) |
| `ProviderEventPayloads` | type | [Declaration](../../../dist/esm/structs/support/model/provider-observer.d.ts#L13) |
| `ProviderMessage` | type | [Declaration](../../../dist/esm/structs/support/model/messages.d.ts#L47) |
| `ProviderObservation` | type | [Declaration](../../../dist/esm/structs/support/model/provider-observer.d.ts#L49) |
| `ProviderObserver` | type | [Declaration](../../../dist/esm/structs/support/model/provider-observer.d.ts#L56) |
| `ProviderReasoningLevel` | type | [Declaration](../../../dist/esm/structs/support/model/provider.d.ts#L45) |
| `ProviderReasoningStrategy` | type | [Declaration](../../../dist/esm/structs/support/model/provider.d.ts#L52) |
| `ProviderSystemMessage` | type | [Declaration](../../../dist/esm/structs/support/model/messages.d.ts#L15) |
| `ProviderToolCall` | type | [Declaration](../../../dist/esm/structs/support/model/messages.d.ts#L13) |
| `ProviderToolMessage` | type | [Declaration](../../../dist/esm/structs/support/model/messages.d.ts#L39) |
| `ProviderUserMessage` | type | [Declaration](../../../dist/esm/structs/support/model/messages.d.ts#L23) |
| `realtimeFunctionResponse` | value | [Declaration](../../../dist/esm/support/model/lifecycle/realtime.d.ts#L14) |
| `realtimeInput` | value | [Declaration](../../../dist/esm/support/model/lifecycle/realtime.d.ts#L12) |
| `RealtimeProtocolConfig` | type | [Declaration](../../../dist/esm/support/model/lifecycle/realtime.d.ts#L3) |
| `realtimeToolResult` | value | [Declaration](../../../dist/esm/support/model/lifecycle/realtime.d.ts#L16) |
| `RemainingModelWork` | type | [Declaration](../../../dist/esm/support/model/budget-assessment.d.ts#L8) |
| `ReplyPreviewStage` | type | [Declaration](../../../dist/esm/support/model/preview-rules.d.ts#L25) |
| `ReplyPreviewTool` | type | [Declaration](../../../dist/esm/support/model/preview-rules.d.ts#L13) |
| `runChildren` | value | [Declaration](../../../dist/esm/support/model/children.d.ts#L37) |
| `serializeModelContinuation` | value | [Declaration](../../../dist/esm/support/model/continuation.d.ts#L13) |
| `sessionCompletionPolicy` | value | [Declaration](../../../dist/esm/support/model/completion/session.d.ts#L16) |
| `SessionFunctionOptions` | type | [Declaration](../../../dist/esm/support/model/session.d.ts#L27) |
| `SessionModelTransportRegistration` | type | [Declaration](../../../dist/esm/support/model/session.d.ts#L33) |
| `ToolCallCollector` | type | [Declaration](../../../dist/esm/model/interactions/calls.d.ts#L22) |
| `ToolCallFailure` | type | [Declaration](../../../dist/esm/model/interactions/calls.d.ts#L20) |

## @jangts/agent-core/kits

[Contracts and behavior](kits.md) · 334 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `AgentCatalogPorts` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L77) |
| `AgentFamily` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L86) |
| `AgentOutputEvent` | type | [Declaration](../../../dist/esm/structs/kits/presentation/events.d.ts#L11) |
| `aggregateBranchResults` | value | [Declaration](../../../dist/esm/kits/aggregation.d.ts#L55) |
| `Aggregation` | value | [Declaration](../../../dist/esm/kits/aggregation.d.ts#L58) |
| `AnswerCheck` | type | [Declaration](../../../dist/esm/structs/kits/answering/flow.d.ts#L16) |
| `AnswerChecker` | type | [Declaration](../../../dist/esm/structs/kits/answering/checks.d.ts#L11) |
| `AnswerFlowDefinition` | type | [Declaration](../../../dist/esm/structs/kits/answering/flow.d.ts#L45) |
| `Answering` | value | [Declaration](../../../dist/esm/kits/answering/index.d.ts#L21) |
| `AnswerIssue` | type | [Declaration](../../../dist/esm/structs/kits/answering/flow.d.ts#L13) |
| `AnswerItem` | type | [Declaration](../../../dist/esm/structs/kits/answering/flow.d.ts#L19) |
| `AnswerReader` | type | [Declaration](../../../dist/esm/structs/kits/answering/tasks.d.ts#L38) |
| `AnswerResult` | type | [Declaration](../../../dist/esm/structs/kits/answering/flow.d.ts#L30) |
| `AnswerTaskBase` | type | [Declaration](../../../dist/esm/structs/kits/answering/tasks.d.ts#L11) |
| `AnswerTaskDefinition` | type | [Declaration](../../../dist/esm/structs/kits/answering/tasks.d.ts#L30) |
| `AnswerTaskPorts` | type | [Declaration](../../../dist/esm/structs/kits/answering/tasks.d.ts#L46) |
| `applyMemoryUpdate` | value | [Declaration](../../../dist/esm/kits/memory.d.ts#L131) |
| `ArtifactReference` | type | [Declaration](../../../dist/esm/structs/kits/artifacts.d.ts#L12) |
| `ArtifactResolver` | type | [Declaration](../../../dist/esm/structs/kits/artifacts.d.ts#L21) |
| `Artifacts` | value | [Declaration](../../../dist/esm/kits/artifacts.d.ts#L40) |
| `batchMemorySources` | value | [Declaration](../../../dist/esm/kits/memory.d.ts#L149) |
| `bindInteraction` | value | [Declaration](../../../dist/esm/kits/interaction/handlers.d.ts#L21) |
| `bindReviewChoiceDecision` | value | [Declaration](../../../dist/esm/kits/review-choice.d.ts#L9) |
| `BranchAggregationRequest` | type | [Declaration](../../../dist/esm/structs/kits/aggregation.d.ts#L29) |
| `BranchAggregationResult` | type | [Declaration](../../../dist/esm/structs/kits/aggregation.d.ts#L34) |
| `BranchResult` | type | [Declaration](../../../dist/esm/structs/kits/aggregation.d.ts#L19) |
| `BranchVersion` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L19) |
| `BranchVersioning` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L86) |
| `BranchVersioningDefinition` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L56) |
| `BranchVersionOperation` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L17) |
| `branchVersionOperations` | value | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L15) |
| `BranchVersionRecord` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L36) |
| `BranchVersions` | value | [Declaration](../../../dist/esm/kits/family.d.ts#L19) |
| `BranchVersionStore` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L49) |
| `Candidates` | value | [Declaration](../../../dist/esm/kits/candidates.d.ts#L35) |
| `CandidateSelectionDefinition` | type | [Declaration](../../../dist/esm/structs/kits/candidates.d.ts#L16) |
| `CatalogDomainTool` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L12) |
| `CatalogExecutionTool` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L29) |
| `CatalogGoal` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L12) |
| `CatalogScope` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L17) |
| `CatalogTask` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L22) |
| `CatalogTool` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L29) |
| `checkReviewAdmission` | value | [Declaration](../../../dist/esm/kits/result-review.d.ts#L5) |
| `Command` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L93) |
| `CommandCatalog` | value + type | [Declaration](../../../dist/esm/kits/interaction/commands.d.ts#L19) |
| `CommandCatalogOptions` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L115) |
| `CommandDefinition` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L58) |
| `commandSchema` | value | [Declaration](../../../dist/esm/kits/interaction/command.d.ts#L41) |
| `compileCommands` | value | [Declaration](../../../dist/esm/kits/interaction/command.d.ts#L28) |
| `CompiledReplyFormat` | type | [Declaration](../../../dist/esm/structs/kits/presentation/formats.d.ts#L31) |
| `completeMemoryReview` | value | [Declaration](../../../dist/esm/kits/memory.d.ts#L156) |
| `CompletionCheck` | type | [Declaration](../../../dist/esm/kits/completion.d.ts#L18) |
| `CompletionDecision` | type | [Declaration](../../../dist/esm/kits/completion.d.ts#L7) |
| `CompletionReport` | type | [Declaration](../../../dist/esm/kits/completion.d.ts#L24) |
| `ContentProjection` | type | [Declaration](../../../dist/esm/structs/kits/projection.d.ts#L11) |
| `ContentProjectionOptions` | type | [Declaration](../../../dist/esm/structs/kits/projection.d.ts#L18) |
| `createDomainToolRegistry` | value | [Declaration](../../../dist/esm/kits/domains/registry.d.ts#L105) |
| `createGoalRegistry` | value | [Declaration](../../../dist/esm/kits/domains/registry.d.ts#L105) |
| `createScopeRegistry` | value | [Declaration](../../../dist/esm/kits/domains/scopes.d.ts#L165) |
| `defineAgentCatalog` | value | [Declaration](../../../dist/esm/kits/domains/catalog.d.ts#L16) |
| `defineAgentFamily` | value | [Declaration](../../../dist/esm/kits/family.d.ts#L17) |
| `defineAnswerCheckCatalog` | value | [Declaration](../../../dist/esm/kits/answering/checks.d.ts#L15) |
| `defineAnswerFlow` | value | [Declaration](../../../dist/esm/kits/answering/flow.d.ts#L17) |
| `defineAnswerReaderCatalog` | value | [Declaration](../../../dist/esm/kits/answering/tasks.d.ts#L10) |
| `defineAnswerTaskCatalog` | value | [Declaration](../../../dist/esm/kits/answering/tasks.d.ts#L30) |
| `defineArtifactCatalog` | value | [Declaration](../../../dist/esm/kits/artifacts.d.ts#L13) |
| `defineBranchVersioning` | value | [Declaration](../../../dist/esm/kits/family.d.ts#L17) |
| `defineCandidateSelection` | value | [Declaration](../../../dist/esm/kits/candidates.d.ts#L24) |
| `defineCommand` | value | [Declaration](../../../dist/esm/kits/interaction/command.d.ts#L15) |
| `defineCommandCatalog` | value | [Declaration](../../../dist/esm/kits/interaction/commands.d.ts#L89) |
| `defineCompletionChecks` | value | [Declaration](../../../dist/esm/kits/completion.d.ts#L36) |
| `defineContentProjection` | value | [Declaration](../../../dist/esm/kits/projection.d.ts#L15) |
| `defineDelivery` | value | [Declaration](../../../dist/esm/kits/delivery.d.ts#L47)；Use defineDeliveryPipeline. |
| `defineDeliveryPipeline` | value | [Declaration](../../../dist/esm/kits/delivery.d.ts#L16) |
| `defineDurableTask` | value | [Declaration](../../../dist/esm/kits/durable.d.ts#L19) |
| `defineEvidenceChecklist` | value | [Declaration](../../../dist/esm/kits/evidence.d.ts#L14) |
| `defineEvidenceProjection` | value | [Declaration](../../../dist/esm/kits/evidence.d.ts#L40) |
| `defineInteractionProtocol` | value | [Declaration](../../../dist/esm/kits/interaction/transfer.d.ts#L65) |
| `defineKnowledgeCatalog` | value | [Declaration](../../../dist/esm/kits/knowledge/catalog.d.ts#L15) |
| `defineKnowledgePublication` | value | [Declaration](../../../dist/esm/kits/knowledge/publication.d.ts#L17) |
| `defineNormalization` | value | [Declaration](../../../dist/esm/kits/normalization.d.ts#L15) |
| `defineOutputCatalog` | value | [Declaration](../../../dist/esm/kits/presentation/outputs.d.ts#L16) |
| `definePolicySet` | value | [Declaration](../../../dist/esm/kits/policies.d.ts#L14) |
| `defineQueryAggregation` | value | [Declaration](../../../dist/esm/kits/aggregation.d.ts#L29) |
| `defineRecoveryChain` | value | [Declaration](../../../dist/esm/kits/policies.d.ts#L40) |
| `defineReflection` | value | [Declaration](../../../dist/esm/kits/reflection.d.ts#L16) |
| `defineReflectionLogSource` | value | [Declaration](../../../dist/esm/kits/reflection-log-source.d.ts#L63) |
| `defineReplyFormats` | value | [Declaration](../../../dist/esm/kits/presentation/formats.d.ts#L38) |
| `defineResultReview` | value | [Declaration](../../../dist/esm/kits/result-review.d.ts#L3) |
| `defineRetrieval` | value | [Declaration](../../../dist/esm/kits/retrieval.d.ts#L18) |
| `defineReviewDecision` | value | [Declaration](../../../dist/esm/kits/review-decision.d.ts#L3) |
| `defineSemanticSlots` | value | [Declaration](../../../dist/esm/kits/presentation/templates.d.ts#L37) |
| `defineTextSkillLoader` | value | [Declaration](../../../dist/esm/kits/text-skills.d.ts#L16) |
| `defineTextTemplate` | value | [Declaration](../../../dist/esm/kits/presentation/templates.d.ts#L21) |
| `defineTreeProjection` | value | [Declaration](../../../dist/esm/kits/projection.d.ts#L48) |
| `defineWaitGate` | value | [Declaration](../../../dist/esm/kits/waiting.d.ts#L6) |
| `Delivery` | value | [Declaration](../../../dist/esm/kits/delivery.d.ts#L41)；Use DeliveryPipeline. Same immutable namespace and implementation. |
| `DeliveryOptions` | type | [Declaration](../../../dist/esm/structs/kits/delivery.d.ts#L41)；Use DeliveryPipelineOptions. |
| `DeliveryPipeline` | value | [Declaration](../../../dist/esm/kits/delivery.d.ts#L35) |
| `DeliveryPipelineOptions` | type | [Declaration](../../../dist/esm/structs/kits/delivery.d.ts#L25) |
| `DeliveryPipelineStage` | type | [Declaration](../../../dist/esm/structs/kits/delivery.d.ts#L13) |
| `DeliveryStage` | type | [Declaration](../../../dist/esm/structs/kits/delivery.d.ts#L39)；Use DeliveryPipelineStage. |
| `DescribedTool` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L42) |
| `DomainTool` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L15) |
| `domainToolDelegates` | value | [Declaration](../../../dist/esm/kits/domains/catalog.d.ts#L78) |
| `DomainToolDescription` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L71) |
| `DomainToolId` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L75) |
| `DomainToolPolicy` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L44) |
| `DomainToolRegistration` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L42) |
| `DomainToolRegistry` | value + type | [Declaration](../../../dist/esm/kits/domains/registry.d.ts#L9) |
| `Durable` | value | [Declaration](../../../dist/esm/kits/durable.d.ts#L22) |
| `DurableAuthorizationContext` | type | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L97) |
| `DurableCheckpoint` | type | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L24) |
| `DurableReconcileContext` | type | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L93) |
| `DurableReconciliation` | type | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L72) |
| `durableReplayPolicies` | value | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L22) |
| `durableStatuses` | value | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L15) |
| `DurableStep` | type | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L61) |
| `DurableStepContext` | type | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L82) |
| `DurableStore` | type | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L52) |
| `DurableTask` | type | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L120) |
| `DurableTaskDefinition` | type | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L101) |
| `DurableTaskOptions` | type | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L113) |
| `Evidence` | value | [Declaration](../../../dist/esm/kits/evidence.d.ts#L48) |
| `EvidenceProjectionDefinition` | type | [Declaration](../../../dist/esm/structs/kits/evidence.d.ts#L36) |
| `EvidenceProjectionProvider` | type | [Declaration](../../../dist/esm/structs/kits/evidence.d.ts#L29) |
| `EvidenceProvider` | type | [Declaration](../../../dist/esm/structs/kits/evidence.d.ts#L21) |
| `EvidenceRequirement` | type | [Declaration](../../../dist/esm/structs/kits/evidence.d.ts#L12) |
| `Family` | value | [Declaration](../../../dist/esm/kits/family.d.ts#L19) |
| `FamilyDefinition` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L56) |
| `FamilyOperation` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L17) |
| `familyOperations` | value | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L15) |
| `FamilyRecord` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L36) |
| `FamilyStore` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L49) |
| `FamilyVersion` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L19) |
| `FusedRank` | type | [Declaration](../../../dist/esm/kits/rank-fusion.d.ts#L11) |
| `goalDelegates` | value | [Declaration](../../../dist/esm/kits/domains/catalog.d.ts#L78) |
| `GoalDescription` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L71) |
| `GoalId` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L75) |
| `GoalPolicy` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L44) |
| `GoalRegistry` | value + type | [Declaration](../../../dist/esm/kits/domains/registry.d.ts#L9) |
| `GoalTool` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L15) |
| `GoalToolRegistration` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L42) |
| `inspectReviewChoices` | value | [Declaration](../../../dist/esm/kits/review-choice.d.ts#L7) |
| `Interaction` | value + type | [Declaration](../../../dist/esm/kits/interaction/transfer.d.ts#L11) |
| `INTERACTION_CATEGORIES` | value | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L28) |
| `InteractionCategory` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L26) |
| `InteractionDescriptor` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L30) |
| `InteractionHandlers` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L41) |
| `InteractionProtocol` | value + type | [Declaration](../../../dist/esm/kits/interaction/transfer.d.ts#L11) |
| `InteractionProtocolDefinition` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L128) |
| `isMemoryState` | value | [Declaration](../../../dist/esm/kits/memory.d.ts#L59) |
| `isReviewChoice` | value | [Declaration](../../../dist/esm/kits/review-choice.d.ts#L5) |
| `isReviewChoiceAnswer` | value | [Declaration](../../../dist/esm/kits/review-choice.d.ts#L3) |
| `Knowledge` | value | [Declaration](../../../dist/esm/kits/knowledge/index.d.ts#L18) |
| `KnowledgeCandidate` | type | [Declaration](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L26) |
| `KnowledgeCatalog` | type | [Declaration](../../../dist/esm/structs/kits/knowledge.d.ts#L67) |
| `KnowledgeCatalogOptions` | type | [Declaration](../../../dist/esm/structs/kits/knowledge.d.ts#L60) |
| `KnowledgeDocument` | type | [Declaration](../../../dist/esm/structs/kits/knowledge.d.ts#L22) |
| `KnowledgePart` | type | [Declaration](../../../dist/esm/structs/kits/knowledge.d.ts#L20) |
| `KnowledgePublication` | type | [Declaration](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L76) |
| `knowledgePublicationOperations` | value | [Declaration](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L15) |
| `KnowledgePublicationOptions` | type | [Declaration](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L58) |
| `KnowledgePublicationRecord` | type | [Declaration](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L40) |
| `KnowledgePublicationStore` | type | [Declaration](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L51) |
| `KnowledgeRead` | type | [Declaration](../../../dist/esm/structs/kits/knowledge.d.ts#L44) |
| `KnowledgeSection` | type | [Declaration](../../../dist/esm/structs/kits/knowledge.d.ts#L13) |
| `KnowledgeSnapshot` | type | [Declaration](../../../dist/esm/structs/kits/knowledge.d.ts#L50) |
| `KnowledgeSourceReference` | type | [Declaration](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L17) |
| `LegacyAgentCatalogPorts` | type | [Declaration](../../../dist/esm/structs/kits/domains/catalog.d.ts#L51) |
| `LifecycleHooks` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L72) |
| `LifecycleProtocol` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L59) |
| `LifecycleTool` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L131) |
| `LifecycleToolRegistration` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L133) |
| `memoryContext` | value | [Declaration](../../../dist/esm/kits/memory.d.ts#L135) |
| `MemoryEntry` | type | [Declaration](../../../dist/esm/kits/memory.d.ts#L24) |
| `memoryModelView` | value | [Declaration](../../../dist/esm/kits/memory.d.ts#L158) |
| `MemoryOperation` | type | [Declaration](../../../dist/esm/kits/memory.d.ts#L11) |
| `memoryReviewBatch` | value | [Declaration](../../../dist/esm/kits/memory.d.ts#L154) |
| `MemorySource` | type | [Declaration](../../../dist/esm/kits/memory.d.ts#L1) |
| `MemoryState` | type | [Declaration](../../../dist/esm/kits/memory.d.ts#L47) |
| `memoryUpdateInstruction` | value | [Declaration](../../../dist/esm/kits/memory.d.ts#L147) |
| `memoryUpdateSchema` | value | [Declaration](../../../dist/esm/kits/memory.d.ts#L61) |
| `mergeByKey` | value | [Declaration](../../../dist/esm/kits/aggregation.d.ts#L14) |
| `mergeReplyBubbles` | value | [Declaration](../../../dist/esm/kits/presentation/formats.d.ts#L29) |
| `ModelBinding` | type | [Declaration](../../../dist/esm/kits/inference.d.ts#L15) |
| `ModelCalls` | value + type | [Declaration](../../../dist/esm/kits/inference.d.ts#L61) |
| `ModelInvocationContext` | type | [Declaration](../../../dist/esm/kits/inference.d.ts#L28) |
| `ModelInvocationRequest` | type | [Declaration](../../../dist/esm/kits/inference.d.ts#L37) |
| `Normalization` | value | [Declaration](../../../dist/esm/kits/normalization.d.ts#L37) |
| `NormalizationOptions` | type | [Declaration](../../../dist/esm/structs/kits/normalization.d.ts#L20) |
| `NormalizationStep` | type | [Declaration](../../../dist/esm/structs/kits/normalization.d.ts#L11) |
| `OutputCatalogOptions` | type | [Declaration](../../../dist/esm/structs/kits/presentation/outputs.d.ts#L77) |
| `OutputComposeInput` | type | [Declaration](../../../dist/esm/structs/kits/presentation/outputs.d.ts#L60) |
| `OutputDefinition` | type | [Declaration](../../../dist/esm/structs/kits/presentation/outputs.d.ts#L33) |
| `OutputField` | type | [Declaration](../../../dist/esm/structs/kits/presentation/outputs.d.ts#L13) |
| `OutputIssue` | type | [Declaration](../../../dist/esm/structs/kits/presentation/outputs.d.ts#L56) |
| `OutputProvider` | type | [Declaration](../../../dist/esm/structs/kits/presentation/outputs.d.ts#L48) |
| `OutputResult` | type | [Declaration](../../../dist/esm/structs/kits/presentation/outputs.d.ts#L71) |
| `parseKnowledgeDocument` | value | [Declaration](../../../dist/esm/kits/knowledge/sections.d.ts#L18) |
| `Policies` | value | [Declaration](../../../dist/esm/kits/policies.d.ts#L72) |
| `Policy` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L211)；Use ToolLifecyclePolicy. |
| `PolicyAssessment` | type | [Declaration](../../../dist/esm/structs/kits/policies.d.ts#L22) |
| `PolicyDefinition` | type | [Declaration](../../../dist/esm/structs/kits/policies.d.ts#L11) |
| `Presentation` | value | [Declaration](../../../dist/esm/kits/presentation/index.d.ts#L25) |
| `projectContinuousExcerpt` | value | [Declaration](../../../dist/esm/kits/projection.d.ts#L34) |
| `Projection` | value | [Declaration](../../../dist/esm/kits/projection.d.ts#L53) |
| `ProtocolCheck` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L47) |
| `ProtocolField` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L15) |
| `ProtocolPredicate` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L45) |
| `ProtocolReason` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L43) |
| `ProtocolShape` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L138) |
| `publishReplyEvents` | value | [Declaration](../../../dist/esm/kits/presentation/events.d.ts#L40) |
| `QueryAggregationOptions` | type | [Declaration](../../../dist/esm/structs/kits/aggregation.d.ts#L10) |
| `RankedList` | type | [Declaration](../../../dist/esm/kits/rank-fusion.d.ts#L2) |
| `reciprocalRankFusion` | value | [Declaration](../../../dist/esm/kits/rank-fusion.d.ts#L36) |
| `RecoveryDefinition` | type | [Declaration](../../../dist/esm/structs/kits/policies.d.ts#L40) |
| `RecoveryResult` | type | [Declaration](../../../dist/esm/structs/kits/policies.d.ts#L31) |
| `Reflection` | value | [Declaration](../../../dist/esm/kits/reflection.d.ts#L18) |
| `ReflectionDefinition` | type | [Declaration](../../../dist/esm/structs/kits/reflection.d.ts#L108) |
| `ReflectionEvidence` | type | [Declaration](../../../dist/esm/structs/kits/reflection.d.ts#L20) |
| `ReflectionFinding` | type | [Declaration](../../../dist/esm/structs/kits/reflection.d.ts#L80) |
| `reflectionFindingKinds` | value | [Declaration](../../../dist/esm/structs/kits/reflection.d.ts#L78) |
| `reflectionIdentityFields` | value | [Declaration](../../../dist/esm/structs/kits/reflection.d.ts#L18) |
| `ReflectionLogReader` | type | [Declaration](../../../dist/esm/kits/reflection-log-source.d.ts#L20) |
| `ReflectionPage` | type | [Declaration](../../../dist/esm/structs/kits/reflection.d.ts#L54) |
| `ReflectionQuery` | type | [Declaration](../../../dist/esm/structs/kits/reflection.d.ts#L43) |
| `ReflectionReport` | type | [Declaration](../../../dist/esm/structs/kits/reflection.d.ts#L89) |
| `ReflectionSource` | type | [Declaration](../../../dist/esm/structs/kits/reflection.d.ts#L69) |
| `ReflectionTask` | type | [Declaration](../../../dist/esm/structs/kits/reflection.d.ts#L131) |
| `RegisteredDomainTool` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L82) |
| `RegisteredGoal` | type | [Declaration](../../../dist/esm/structs/kits/domains/registry.d.ts#L82) |
| `RegisteredLifecycleTool` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L142) |
| `RegisteredProtocol` | type | [Declaration](../../../dist/esm/structs/kits/interaction.d.ts#L149) |
| `RegisteredScope` | type | [Declaration](../../../dist/esm/structs/kits/domains/scopes.d.ts#L79) |
| `RegisteredScopeEvidence` | type | [Declaration](../../../dist/esm/structs/kits/domains/scopes.d.ts#L67) |
| `RegisteredToolDefinition` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L142) |
| `REPLY_BUBBLE_BOUNDARY` | value | [Declaration](../../../dist/esm/kits/presentation/events.d.ts#L19) |
| `ReplyBubbleInput` | type | [Declaration](../../../dist/esm/structs/kits/presentation/events.d.ts#L32) |
| `replyBubbleTexts` | value | [Declaration](../../../dist/esm/kits/presentation/events.d.ts#L26) |
| `ReplyDeliveryOptions` | type | [Declaration](../../../dist/esm/structs/kits/presentation/events.d.ts#L39) |
| `ReplyFormatCheck` | type | [Declaration](../../../dist/esm/structs/kits/presentation/formats.d.ts#L11) |
| `replyFormatChecks` | value | [Declaration](../../../dist/esm/kits/presentation/formats.d.ts#L5) |
| `ReplyFormatDefinition` | type | [Declaration](../../../dist/esm/structs/kits/presentation/formats.d.ts#L20) |
| `ReplyFormatOptions` | type | [Declaration](../../../dist/esm/structs/kits/presentation/formats.d.ts#L39) |
| `resolvePreference` | value | [Declaration](../../../dist/esm/kits/presentation/variants.d.ts#L34) |
| `ResultReview` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L98) |
| `ResultReviewAdmissionRequest` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L105) |
| `ResultReviewCandidate` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L30) |
| `ResultReviewCoverage` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L45) |
| `ResultReviewDefinition` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L93) |
| `ResultReviewDetector` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L59) |
| `ResultReviewFinding` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L35) |
| `ResultReviewInput` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L12) |
| `ResultReviewRequest` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L24) |
| `ResultReviewResolution` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L74) |
| `ResultReviewResult` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L53) |
| `ResultReviewScope` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L4) |
| `ResultReviewStrategy` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L82) |
| `Retrieval` | value | [Declaration](../../../dist/esm/kits/retrieval.d.ts#L23) |
| `RetrievalDefinition` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L96) |
| `RetrievalEffect` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L49) |
| `RetrievalPorts` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L56) |
| `retrievalQueryKey` | value | [Declaration](../../../dist/esm/utils/query-key.d.ts#L12) |
| `RetrievalReason` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L47) |
| `RetrievalReceipt` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L30) |
| `RetrievalResult` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L17) |
| `RetrievalRunner` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L87) |
| `RetrievalSource` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L13) |
| `RetrievalState` | type | [Declaration](../../../dist/esm/structs/kits/retrieval.d.ts#L21) |
| `ReviewChoice` | type | [Declaration](../../../dist/esm/structs/kits/review-choice.d.ts#L21) |
| `ReviewChoiceAnswer` | type | [Declaration](../../../dist/esm/structs/kits/review-choice.d.ts#L16) |
| `ReviewChoiceDecision` | type | [Declaration](../../../dist/esm/structs/kits/review-choice.d.ts#L53) |
| `ReviewChoiceHost` | type | [Declaration](../../../dist/esm/structs/kits/review-choice.d.ts#L46) |
| `ReviewChoiceInput` | type | [Declaration](../../../dist/esm/structs/kits/review-choice.d.ts#L10) |
| `ReviewChoiceInspection` | type | [Declaration](../../../dist/esm/structs/kits/review-choice.d.ts#L34) |
| `ReviewDecision` | type | [Declaration](../../../dist/esm/structs/kits/review-decision.d.ts#L47) |
| `ReviewDecisionBinding` | type | [Declaration](../../../dist/esm/structs/kits/review-decision.d.ts#L5) |
| `ReviewDecisionDefinition` | type | [Declaration](../../../dist/esm/structs/kits/review-decision.d.ts#L26) |
| `ReviewDecisionState` | type | [Declaration](../../../dist/esm/structs/kits/review-decision.d.ts#L16) |
| `reviewMemorySources` | value | [Declaration](../../../dist/esm/kits/memory.d.ts#L133) |
| `ScopeDefinition` | type | [Declaration](../../../dist/esm/structs/kits/domains/scopes.d.ts#L15) |
| `ScopeDescription` | type | [Declaration](../../../dist/esm/structs/kits/domains/scopes.d.ts#L83) |
| `ScopeRegistry` | value + type | [Declaration](../../../dist/esm/kits/domains/scopes.d.ts#L17) |
| `ScopeRegistryPolicy` | type | [Declaration](../../../dist/esm/structs/kits/domains/scopes.d.ts#L40) |
| `SectionSelection` | type | [Declaration](../../../dist/esm/structs/kits/knowledge.d.ts#L33) |
| `selectVariant` | value | [Declaration](../../../dist/esm/kits/presentation/variants.d.ts#L20) |
| `SemanticSlotDefinition` | type | [Declaration](../../../dist/esm/structs/kits/presentation/templates.d.ts#L19) |
| `serializeOutputEvents` | value | [Declaration](../../../dist/esm/kits/presentation/events.d.ts#L53) |
| `splitTextBlocks` | value | [Declaration](../../../dist/esm/kits/text-blocks.d.ts#L19) |
| `TextBlock` | type | [Declaration](../../../dist/esm/structs/kits/text-blocks.d.ts#L11) |
| `TextBlockOptions` | type | [Declaration](../../../dist/esm/structs/kits/text-blocks.d.ts#L22) |
| `TextBlocks` | value | [Declaration](../../../dist/esm/kits/text-blocks.d.ts#L21) |
| `textOutputEvents` | value | [Declaration](../../../dist/esm/kits/presentation/events.d.ts#L60) |
| `TextSearch` | value + type | [Declaration](../../../dist/esm/kits/search.d.ts#L8) |
| `TextSearchHit` | type | [Declaration](../../../dist/esm/structs/kits/search.d.ts#L29) |
| `TextSearchOptions` | type | [Declaration](../../../dist/esm/structs/kits/search.d.ts#L12) |
| `TextSearchQuery` | type | [Declaration](../../../dist/esm/structs/kits/search.d.ts#L36) |
| `TextSearchSnapshot` | type | [Declaration](../../../dist/esm/structs/kits/search.d.ts#L47) |
| `TextSkill` | type | [Declaration](../../../dist/esm/structs/kits/text-skills.d.ts#L24) |
| `TextSkillHeader` | type | [Declaration](../../../dist/esm/structs/kits/text-skills.d.ts#L31) |
| `TextSkillLoader` | type | [Declaration](../../../dist/esm/structs/kits/text-skills.d.ts#L61) |
| `TextSkillLoaderDefinition` | type | [Declaration](../../../dist/esm/structs/kits/text-skills.d.ts#L36) |
| `TextSkillReadPorts` | type | [Declaration](../../../dist/esm/structs/kits/text-skills.d.ts#L56) |
| `TextSkillRegistration` | type | [Declaration](../../../dist/esm/structs/kits/text-skills.d.ts#L13) |
| `TextSkills` | value | [Declaration](../../../dist/esm/kits/text-skills.d.ts#L19) |
| `TextTemplateOptions` | type | [Declaration](../../../dist/esm/structs/kits/presentation/templates.d.ts#L10) |
| `Tool` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L219)；Use LifecycleTool and domainToolIds. |
| `ToolFinalizer` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L179) |
| `ToolJournal` | type | [Declaration](../../../dist/esm/structs/capabilities/invocation.d.ts#L31) |
| `ToolLifecycleHooks` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L72) |
| `ToolLifecyclePolicy` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L225) |
| `ToolLifecycleProtocol` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L59) |
| `ToolLifecycleRegistry` | value + type | [Declaration](../../../dist/esm/kits/tools.d.ts#L20) |
| `ToolLifecycleRegistryOptions` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L231) |
| `ToolModelField` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L44) |
| `ToolNormalizer` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L177) |
| `ToolProtocol` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L171) |
| `ToolRegistration` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L223)；Use LifecycleToolRegistration. |
| `ToolRuntimeTypes` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L25) |
| `ToolsOptions` | type | [Declaration](../../../dist/esm/structs/kits/tools.d.ts#L215)；Use ToolLifecycleRegistryOptions. |
| `TreeProjectionOptions` | type | [Declaration](../../../dist/esm/structs/kits/projection.d.ts#L29) |
| `uniqueBy` | value | [Declaration](../../../dist/esm/kits/normalization.d.ts#L34) |
| `validateAnswerBatch` | value | [Declaration](../../../dist/esm/kits/answering/batch.d.ts#L19) |
| `VectorSearch` | value + type | [Declaration](../../../dist/esm/kits/vector-search.d.ts#L38) |
| `VectorSearchHit` | type | [Declaration](../../../dist/esm/kits/vector-search.d.ts#L19) |
| `VectorSearchQuery` | type | [Declaration](../../../dist/esm/kits/vector-search.d.ts#L22) |
| `VectorSearchSpace` | type | [Declaration](../../../dist/esm/kits/vector-search.d.ts#L12) |
| `WaitGate` | type | [Declaration](../../../dist/esm/structs/kits/waiting.d.ts#L47) |
| `WaitGateDefinition` | type | [Declaration](../../../dist/esm/structs/kits/waiting.d.ts#L33) |
| `WaitGateOptions` | type | [Declaration](../../../dist/esm/structs/kits/waiting.d.ts#L42) |
| `WaitIdentity` | type | [Declaration](../../../dist/esm/structs/kits/waiting.d.ts#L4) |
| `WaitRecord` | type | [Declaration](../../../dist/esm/structs/kits/waiting.d.ts#L10) |
| `WaitStore` | type | [Declaration](../../../dist/esm/structs/kits/waiting.d.ts#L27) |

## @jangts/agent-core/mock

[Contracts and behavior](mock.md) · 26 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `CallRecord` | type | [Declaration](../../../dist/esm/mock.d.ts#L8) |
| `encodeModelResponse` | value | [Declaration](../../../dist/esm/mock.d.ts#L8) |
| `Generated` | type | [Declaration](../../../dist/esm/mock.d.ts#L8) |
| `GenerationContext` | type | [Declaration](../../../dist/esm/mock.d.ts#L8) |
| `GenerationInput` | type | [Declaration](../../../dist/esm/mock.d.ts#L8) |
| `GenerationOptions` | type | [Declaration](../../../dist/esm/mock.d.ts#L8) |
| `Generator` | type | [Declaration](../../../dist/esm/mock.d.ts#L8) |
| `generatorNames` | value | [Declaration](../../../dist/esm/mock.d.ts#L8) |
| `generators` | value | [Declaration](../../../dist/esm/mock.d.ts#L8) |
| `HttpFault` | type | [Declaration](../../../dist/esm/mock.d.ts#L8) |
| `JsonValue` | type | [Declaration](../../../dist/esm/mock.d.ts#L8) |
| `Message` | type | [Declaration](../../../dist/esm/mock.d.ts#L8) |
| `MockGPT` | value + type | [Declaration](../../../dist/esm/mock.d.ts#L8) |
| `MockGPTError` | value + type | [Declaration](../../../dist/esm/mock.d.ts#L8) |
| `MockGPTOptions` | type | [Declaration](../../../dist/esm/mock.d.ts#L8) |
| `ModelOutput` | type | [Declaration](../../../dist/esm/mock.d.ts#L8) |
| `ModelRequest` | type | [Declaration](../../../dist/esm/mock.d.ts#L8) |
| `OutputOptions` | type | [Declaration](../../../dist/esm/mock.d.ts#L8) |
| `ResponseDescription` | value + type | [Declaration](../../../dist/esm/mock.d.ts#L8) |
| `responses` | value | [Declaration](../../../dist/esm/mock.d.ts#L8) |
| `routes` | value | [Declaration](../../../dist/esm/mock.d.ts#L8) |
| `Rule` | type | [Declaration](../../../dist/esm/mock.d.ts#L8) |
| `TextOptions` | type | [Declaration](../../../dist/esm/mock.d.ts#L8) |
| `TextSource` | type | [Declaration](../../../dist/esm/mock.d.ts#L8) |
| `ToolCall` | type | [Declaration](../../../dist/esm/mock.d.ts#L8) |
| `Usage` | type | [Declaration](../../../dist/esm/mock.d.ts#L8) |

## @jangts/agent-core/kits/search

[Contracts and behavior](kits.md) · 5 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `TextSearch` | value + type | [Declaration](../../../dist/esm/kits/search.d.ts#L8) |
| `TextSearchHit` | type | [Declaration](../../../dist/esm/structs/kits/search.d.ts#L29) |
| `TextSearchOptions` | type | [Declaration](../../../dist/esm/structs/kits/search.d.ts#L12) |
| `TextSearchQuery` | type | [Declaration](../../../dist/esm/structs/kits/search.d.ts#L36) |
| `TextSearchSnapshot` | type | [Declaration](../../../dist/esm/structs/kits/search.d.ts#L47) |

## @jangts/agent-core/kits/text-blocks

[Contracts and behavior](kits.md) · 4 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `splitTextBlocks` | value | [Declaration](../../../dist/esm/kits/text-blocks.d.ts#L19) |
| `TextBlock` | type | [Declaration](../../../dist/esm/structs/kits/text-blocks.d.ts#L11) |
| `TextBlockOptions` | type | [Declaration](../../../dist/esm/structs/kits/text-blocks.d.ts#L22) |
| `TextBlocks` | value | [Declaration](../../../dist/esm/kits/text-blocks.d.ts#L21) |

## @jangts/agent-core/kits/inference

[Contracts and behavior](kits.md) · 4 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `ModelBinding` | type | [Declaration](../../../dist/esm/kits/inference.d.ts#L15) |
| `ModelCalls` | value + type | [Declaration](../../../dist/esm/kits/inference.d.ts#L61) |
| `ModelInvocationContext` | type | [Declaration](../../../dist/esm/kits/inference.d.ts#L28) |
| `ModelInvocationRequest` | type | [Declaration](../../../dist/esm/kits/inference.d.ts#L37) |

## @jangts/agent-core/kits/vector-search

[Contracts and behavior](kits.md) · 4 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `VectorSearch` | value + type | [Declaration](../../../dist/esm/kits/vector-search.d.ts#L38) |
| `VectorSearchHit` | type | [Declaration](../../../dist/esm/kits/vector-search.d.ts#L19) |
| `VectorSearchQuery` | type | [Declaration](../../../dist/esm/kits/vector-search.d.ts#L22) |
| `VectorSearchSpace` | type | [Declaration](../../../dist/esm/kits/vector-search.d.ts#L12) |

## @jangts/agent-core/kits/rank-fusion

[Contracts and behavior](kits.md) · 3 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `FusedRank` | type | [Declaration](../../../dist/esm/kits/rank-fusion.d.ts#L11) |
| `RankedList` | type | [Declaration](../../../dist/esm/kits/rank-fusion.d.ts#L2) |
| `reciprocalRankFusion` | value | [Declaration](../../../dist/esm/kits/rank-fusion.d.ts#L36) |

## @jangts/agent-core/kits/artifacts

[Contracts and behavior](kits.md) · 4 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `ArtifactReference` | type | [Declaration](../../../dist/esm/structs/kits/artifacts.d.ts#L12) |
| `ArtifactResolver` | type | [Declaration](../../../dist/esm/structs/kits/artifacts.d.ts#L21) |
| `Artifacts` | value | [Declaration](../../../dist/esm/kits/artifacts.d.ts#L40) |
| `defineArtifactCatalog` | value | [Declaration](../../../dist/esm/kits/artifacts.d.ts#L13) |

## @jangts/agent-core/kits/durable

[Contracts and behavior](kits.md) · 14 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `defineDurableTask` | value | [Declaration](../../../dist/esm/kits/durable.d.ts#L19) |
| `Durable` | value | [Declaration](../../../dist/esm/kits/durable.d.ts#L22) |
| `DurableAuthorizationContext` | type | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L97) |
| `DurableCheckpoint` | type | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L24) |
| `DurableReconcileContext` | type | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L93) |
| `DurableReconciliation` | type | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L72) |
| `durableReplayPolicies` | value | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L22) |
| `durableStatuses` | value | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L15) |
| `DurableStep` | type | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L61) |
| `DurableStepContext` | type | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L82) |
| `DurableStore` | type | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L52) |
| `DurableTask` | type | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L120) |
| `DurableTaskDefinition` | type | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L101) |
| `DurableTaskOptions` | type | [Declaration](../../../dist/esm/structs/kits/durable.d.ts#L113) |

## @jangts/agent-core/kits/result-review

[Contracts and behavior](kits.md) · 15 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `checkReviewAdmission` | value | [Declaration](../../../dist/esm/kits/result-review.d.ts#L5) |
| `defineResultReview` | value | [Declaration](../../../dist/esm/kits/result-review.d.ts#L3) |
| `ResultReview` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L98) |
| `ResultReviewAdmissionRequest` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L105) |
| `ResultReviewCandidate` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L30) |
| `ResultReviewCoverage` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L45) |
| `ResultReviewDefinition` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L93) |
| `ResultReviewDetector` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L59) |
| `ResultReviewFinding` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L35) |
| `ResultReviewInput` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L12) |
| `ResultReviewRequest` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L24) |
| `ResultReviewResolution` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L74) |
| `ResultReviewResult` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L53) |
| `ResultReviewScope` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L4) |
| `ResultReviewStrategy` | type | [Declaration](../../../dist/esm/structs/kits/result-review.d.ts#L82) |

## @jangts/agent-core/kits/review-choice

[Contracts and behavior](kits.md) · 10 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `bindReviewChoiceDecision` | value | [Declaration](../../../dist/esm/kits/review-choice.d.ts#L9) |
| `inspectReviewChoices` | value | [Declaration](../../../dist/esm/kits/review-choice.d.ts#L7) |
| `isReviewChoice` | value | [Declaration](../../../dist/esm/kits/review-choice.d.ts#L5) |
| `isReviewChoiceAnswer` | value | [Declaration](../../../dist/esm/kits/review-choice.d.ts#L3) |
| `ReviewChoice` | type | [Declaration](../../../dist/esm/structs/kits/review-choice.d.ts#L21) |
| `ReviewChoiceAnswer` | type | [Declaration](../../../dist/esm/structs/kits/review-choice.d.ts#L16) |
| `ReviewChoiceDecision` | type | [Declaration](../../../dist/esm/structs/kits/review-choice.d.ts#L53) |
| `ReviewChoiceHost` | type | [Declaration](../../../dist/esm/structs/kits/review-choice.d.ts#L46) |
| `ReviewChoiceInput` | type | [Declaration](../../../dist/esm/structs/kits/review-choice.d.ts#L10) |
| `ReviewChoiceInspection` | type | [Declaration](../../../dist/esm/structs/kits/review-choice.d.ts#L34) |

## @jangts/agent-core/kits/review-decision

[Contracts and behavior](kits.md) · 5 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `defineReviewDecision` | value | [Declaration](../../../dist/esm/kits/review-decision.d.ts#L3) |
| `ReviewDecision` | type | [Declaration](../../../dist/esm/structs/kits/review-decision.d.ts#L47) |
| `ReviewDecisionBinding` | type | [Declaration](../../../dist/esm/structs/kits/review-decision.d.ts#L5) |
| `ReviewDecisionDefinition` | type | [Declaration](../../../dist/esm/structs/kits/review-decision.d.ts#L26) |
| `ReviewDecisionState` | type | [Declaration](../../../dist/esm/structs/kits/review-decision.d.ts#L16) |

## @jangts/agent-core/kits/waiting

[Contracts and behavior](kits.md) · 7 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `defineWaitGate` | value | [Declaration](../../../dist/esm/kits/waiting.d.ts#L6) |
| `WaitGate` | type | [Declaration](../../../dist/esm/structs/kits/waiting.d.ts#L47) |
| `WaitGateDefinition` | type | [Declaration](../../../dist/esm/structs/kits/waiting.d.ts#L33) |
| `WaitGateOptions` | type | [Declaration](../../../dist/esm/structs/kits/waiting.d.ts#L42) |
| `WaitIdentity` | type | [Declaration](../../../dist/esm/structs/kits/waiting.d.ts#L4) |
| `WaitRecord` | type | [Declaration](../../../dist/esm/structs/kits/waiting.d.ts#L10) |
| `WaitStore` | type | [Declaration](../../../dist/esm/structs/kits/waiting.d.ts#L27) |

## @jangts/agent-core/kits/family

[Contracts and behavior](kits.md) · 18 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `AgentFamily` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L86) |
| `BranchVersion` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L19) |
| `BranchVersioning` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L86) |
| `BranchVersioningDefinition` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L56) |
| `BranchVersionOperation` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L17) |
| `branchVersionOperations` | value | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L15) |
| `BranchVersionRecord` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L36) |
| `BranchVersions` | value | [Declaration](../../../dist/esm/kits/family.d.ts#L19) |
| `BranchVersionStore` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L49) |
| `defineAgentFamily` | value | [Declaration](../../../dist/esm/kits/family.d.ts#L17) |
| `defineBranchVersioning` | value | [Declaration](../../../dist/esm/kits/family.d.ts#L17) |
| `Family` | value | [Declaration](../../../dist/esm/kits/family.d.ts#L19) |
| `FamilyDefinition` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L56) |
| `FamilyOperation` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L17) |
| `familyOperations` | value | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L15) |
| `FamilyRecord` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L36) |
| `FamilyStore` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L49) |
| `FamilyVersion` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L19) |

## @jangts/agent-core/kits/reflection

[Contracts and behavior](kits.md) · 14 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `defineReflection` | value | [Declaration](../../../dist/esm/kits/reflection.d.ts#L16) |
| `defineReflectionLogSource` | value | [Declaration](../../../dist/esm/kits/reflection-log-source.d.ts#L63) |
| `Reflection` | value | [Declaration](../../../dist/esm/kits/reflection.d.ts#L18) |
| `ReflectionDefinition` | type | [Declaration](../../../dist/esm/structs/kits/reflection.d.ts#L108) |
| `ReflectionEvidence` | type | [Declaration](../../../dist/esm/structs/kits/reflection.d.ts#L20) |
| `ReflectionFinding` | type | [Declaration](../../../dist/esm/structs/kits/reflection.d.ts#L80) |
| `reflectionFindingKinds` | value | [Declaration](../../../dist/esm/structs/kits/reflection.d.ts#L78) |
| `reflectionIdentityFields` | value | [Declaration](../../../dist/esm/structs/kits/reflection.d.ts#L18) |
| `ReflectionLogReader` | type | [Declaration](../../../dist/esm/kits/reflection-log-source.d.ts#L20) |
| `ReflectionPage` | type | [Declaration](../../../dist/esm/structs/kits/reflection.d.ts#L54) |
| `ReflectionQuery` | type | [Declaration](../../../dist/esm/structs/kits/reflection.d.ts#L43) |
| `ReflectionReport` | type | [Declaration](../../../dist/esm/structs/kits/reflection.d.ts#L89) |
| `ReflectionSource` | type | [Declaration](../../../dist/esm/structs/kits/reflection.d.ts#L69) |
| `ReflectionTask` | type | [Declaration](../../../dist/esm/structs/kits/reflection.d.ts#L131) |

## @jangts/agent-core/mock/node

[Contracts and behavior](mock.md) · 4 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `createMockHandler` | value | [Declaration](../../../dist/esm/mock/node.d.ts#L8) |
| `createMockServer` | value | [Declaration](../../../dist/esm/mock/node.d.ts#L8) |
| `HandlerOptions` | type | [Declaration](../../../dist/esm/mock/node.d.ts#L8) |
| `ServerOptions` | type | [Declaration](../../../dist/esm/mock/node.d.ts#L8) |

## @jangts/agent-core/mock/web

[Contracts and behavior](mock.md) · 5 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `isPublicAddress` | value | [Declaration](../../../dist/esm/mock/web.d.ts#L8) |
| `LoadedPage` | type | [Declaration](../../../dist/esm/mock/web.d.ts#L8) |
| `sources` | value | [Declaration](../../../dist/esm/mock/web.d.ts#L8) |
| `WebOptions` | type | [Declaration](../../../dist/esm/mock/web.d.ts#L8) |
| `WebProfile` | type | [Declaration](../../../dist/esm/mock/web.d.ts#L8) |

## @jangts/agent-core/support/decorators

[Contracts and behavior](support.md) · 29 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `agent` | value | [Declaration](../../../dist/esm/support/decorators/index.d.ts#L47) |
| `agentPool` | value | [Declaration](../../../dist/esm/support/decorators/pool.d.ts#L31) |
| `Authorize` | value | [Declaration](../../../dist/esm/support/decorators/parsers.d.ts#L11) |
| `ClassDecoration` | type | [Declaration](../../../dist/esm/support/decorators/definition.d.ts#L13) |
| `DecorationOptions` | type | [Declaration](../../../dist/esm/support/decorators/definition.d.ts#L10) |
| `DefinitionReader` | type | [Declaration](../../../dist/esm/support/decorators/pool.d.ts#L12) |
| `fragment` | value | [Declaration](../../../dist/esm/support/decorators/index.d.ts#L43) |
| `Fragment` | type | [Declaration](../../../dist/esm/support/decorators/types.d.ts#L16) |
| `fragmentPool` | value | [Declaration](../../../dist/esm/support/decorators/pool.d.ts#L29) |
| `IdentifiedDefinition` | type | [Declaration](../../../dist/esm/support/decorators/pool.d.ts#L8) |
| `InstanceDecorationOptions` | type | [Declaration](../../../dist/esm/support/decorators/runtime.d.ts#L3) |
| `Intent` | value | [Declaration](../../../dist/esm/support/decorators/index.d.ts#L29) |
| `MethodDecoration` | type | [Declaration](../../../dist/esm/support/decorators/definition.d.ts#L14) |
| `model` | value | [Declaration](../../../dist/esm/support/decorators/index.d.ts#L49) |
| `modelPool` | value | [Declaration](../../../dist/esm/support/decorators/pool.d.ts#L33) |
| `node` | value | [Declaration](../../../dist/esm/support/decorators/index.d.ts#L31) |
| `Node` | type | [Declaration](../../../dist/esm/support/decorators/types.d.ts#L10) |
| `nodePool` | value | [Declaration](../../../dist/esm/support/decorators/pool.d.ts#L25) |
| `ParseInput` | value | [Declaration](../../../dist/esm/support/decorators/parsers.d.ts#L5) |
| `ParseOutput` | value | [Declaration](../../../dist/esm/support/decorators/parsers.d.ts#L7) |
| `RuntimeDecoration` | type | [Declaration](../../../dist/esm/support/decorators/runtime.d.ts#L7) |
| `tool` | value | [Declaration](../../../dist/esm/support/decorators/index.d.ts#L35) |
| `Tool` | type | [Declaration](../../../dist/esm/support/decorators/types.d.ts#L12) |
| `toolbox` | value | [Declaration](../../../dist/esm/support/decorators/toolbox.d.ts#L17) |
| `Toolbox` | type | [Declaration](../../../dist/esm/support/decorators/toolbox.d.ts#L10) |
| `ToolboxEntry` | type | [Declaration](../../../dist/esm/support/decorators/toolbox.d.ts#L8) |
| `toolPool` | value | [Declaration](../../../dist/esm/support/decorators/pool.d.ts#L27) |
| `WorkflowNode` | value | [Declaration](../../../dist/esm/support/decorators/index.d.ts#L31) |
| `WorkflowTool` | value | [Declaration](../../../dist/esm/support/decorators/index.d.ts#L35) |

## @jangts/agent-core/kits/completion

[Contracts and behavior](kits.md) · 4 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `CompletionCheck` | type | [Declaration](../../../dist/esm/kits/completion.d.ts#L18) |
| `CompletionDecision` | type | [Declaration](../../../dist/esm/kits/completion.d.ts#L7) |
| `CompletionReport` | type | [Declaration](../../../dist/esm/kits/completion.d.ts#L24) |
| `defineCompletionChecks` | value | [Declaration](../../../dist/esm/kits/completion.d.ts#L36) |

## @jangts/agent-core/kits/branch-versioning

[Contracts and behavior](kits.md) · 18 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `AgentFamily` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L86) |
| `BranchVersion` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L19) |
| `BranchVersioning` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L86) |
| `BranchVersioningDefinition` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L56) |
| `BranchVersionOperation` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L17) |
| `branchVersionOperations` | value | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L15) |
| `BranchVersionRecord` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L36) |
| `BranchVersions` | value | [Declaration](../../../dist/esm/kits/family.d.ts#L19) |
| `BranchVersionStore` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L49) |
| `defineAgentFamily` | value | [Declaration](../../../dist/esm/kits/family.d.ts#L17) |
| `defineBranchVersioning` | value | [Declaration](../../../dist/esm/kits/family.d.ts#L17) |
| `Family` | value | [Declaration](../../../dist/esm/kits/family.d.ts#L19) |
| `FamilyDefinition` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L56) |
| `FamilyOperation` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L17) |
| `familyOperations` | value | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L15) |
| `FamilyRecord` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L36) |
| `FamilyStore` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L49) |
| `FamilyVersion` | type | [Declaration](../../../dist/esm/structs/kits/family.d.ts#L19) |

## @jangts/agent-core/kits/memory

[Contracts and behavior](kits.md) · 14 exported symbols

| Symbol | Type／value | Declaration and notes |
| --- | --- | --- |
| `applyMemoryUpdate` | value | [Declaration](../../../dist/esm/kits/memory.d.ts#L131) |
| `batchMemorySources` | value | [Declaration](../../../dist/esm/kits/memory.d.ts#L149) |
| `completeMemoryReview` | value | [Declaration](../../../dist/esm/kits/memory.d.ts#L156) |
| `isMemoryState` | value | [Declaration](../../../dist/esm/kits/memory.d.ts#L59) |
| `memoryContext` | value | [Declaration](../../../dist/esm/kits/memory.d.ts#L135) |
| `MemoryEntry` | type | [Declaration](../../../dist/esm/kits/memory.d.ts#L24) |
| `memoryModelView` | value | [Declaration](../../../dist/esm/kits/memory.d.ts#L158) |
| `MemoryOperation` | type | [Declaration](../../../dist/esm/kits/memory.d.ts#L11) |
| `memoryReviewBatch` | value | [Declaration](../../../dist/esm/kits/memory.d.ts#L154) |
| `MemorySource` | type | [Declaration](../../../dist/esm/kits/memory.d.ts#L1) |
| `MemoryState` | type | [Declaration](../../../dist/esm/kits/memory.d.ts#L47) |
| `memoryUpdateInstruction` | value | [Declaration](../../../dist/esm/kits/memory.d.ts#L147) |
| `memoryUpdateSchema` | value | [Declaration](../../../dist/esm/kits/memory.d.ts#L61) |
| `reviewMemorySources` | value | [Declaration](../../../dist/esm/kits/memory.d.ts#L133) |

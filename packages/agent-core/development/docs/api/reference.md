# 公开符号参考

符号按 `package.json.exports` 和随包 TypeScript 声明列出；参数、重载和返回类型以链接的声明为准。

本包符号链接到随包交付的声明；外部符号链接到本包实际转出它的声明，完整类型由该声明引用的已安装依赖提供，不假定依赖的磁盘位置。同源聚合入口指向同一实现，用法见各章。共享运行类型可从 `@jangts/agent-core/types` 导入，该入口没有运行时值；各子入口也导出自身相关类型，MockGPT 类型从对应 mock 入口导入。

## @jangts/agent-core

[合同与行为](core.md) · 411 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `abortableStream` | value | [声明](../../../dist/esm/index.d.ts#L35) |
| `AgentBranch` | type | [声明](../../../dist/esm/execution/engine.d.ts#L63) |
| `AgentCacheAddress` | type | [声明](../../../dist/esm/structs/execution/cache.d.ts#L27) |
| `AgentCacheOptions` | type | [声明](../../../dist/esm/structs/execution/cache.d.ts#L23) |
| `AgentCachePort` | type | [声明](../../../dist/esm/structs/execution/cache.d.ts#L34) |
| `AgentCatalogPorts` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L77) |
| `AgentCheckpoint` | type | [声明](../../../dist/esm/execution/engine.d.ts#L83) |
| `AgentCheckpointRecord` | type | [声明](../../../dist/esm/execution/engine.d.ts#L94) |
| `AgentCoreEngine` | value + type | [声明](../../../dist/esm/execution/engine.d.ts#L110) |
| `AgentCoreEngineOptions` | type | [声明](../../../dist/esm/structs/execution/engine.d.ts#L37) |
| `AgentCoreEngineSetup` | type | [声明](../../../dist/esm/execution/engine.d.ts#L36) |
| `AgentErrorInfo` | type | [声明](../../../dist/esm/structs/errors.d.ts#L46) |
| `AgentModelBinding` | type | [声明](../../../dist/esm/execution/engine.d.ts#L25) |
| `AgentModelRuntime` | type | [声明](../../../dist/esm/execution/engine.d.ts#L15) |
| `AgentOutputEvent` | type | [声明](../../../dist/esm/structs/kits/presentation/events.d.ts#L11) |
| `AgentSnapshot` | type | [声明](../../../dist/esm/execution/engine.d.ts#L83) |
| `AgentSnapshotRecord` | type | [声明](../../../dist/esm/execution/engine.d.ts#L94) |
| `AgentWorkflow` | value + type | [声明](../../../dist/esm/execution/workflow.d.ts#L9) |
| `AgentWorkflowDefinition` | type | [声明](../../../dist/esm/structs/execution/workflow.d.ts#L103) |
| `AsIntent` | type | [声明](../../../dist/esm/structs/capabilities/model.d.ts#L27) |
| `assembleContextPlan` | value | [声明](../../../dist/esm/context/plan.d.ts#L14) |
| `assembleFragments` | value | [声明](../../../dist/esm/context/assembly.d.ts#L14) |
| `AsyncSink` | type | [声明](../../../dist/esm/structs/common.d.ts#L21) |
| `AttemptBudget` | value + type | [声明](../../../dist/esm/execution/workflow.d.ts#L158) |
| `bindInteraction` | value | [声明](../../../dist/esm/kits/interaction/handlers.d.ts#L21) |
| `BoundModelProvider` | type | [声明](../../../dist/esm/structs/model/chat-provider.d.ts#L51) |
| `BreakCheck` | type | [声明](../../../dist/esm/structs/utils/rules.d.ts#L33) |
| `BreakEvent` | type | [声明](../../../dist/esm/structs/utils/rules.d.ts#L42) |
| `BreakPredicate` | type | [声明](../../../dist/esm/structs/utils/rules.d.ts#L31) |
| `BreakReason` | type | [声明](../../../dist/esm/structs/utils/rules.d.ts#L29) |
| `breakWhile` | value | [声明](../../../dist/esm/utils/rules.d.ts#L56) |
| `BreakWhileConfig` | type | [声明](../../../dist/esm/structs/utils/rules.d.ts#L49) |
| `BudgetError` | value + type | [声明](../../../dist/esm/structs/errors.d.ts#L29) |
| `BuiltContext` | type | [声明](../../../dist/esm/structs/context/fragments.d.ts#L45) |
| `CacheContext` | type | [声明](../../../dist/esm/structs/execution/cache.d.ts#L51) |
| `CacheReadOptions` | type | [声明](../../../dist/esm/structs/execution/cache.d.ts#L11) |
| `CandidateSelectionDefinition` | type | [声明](../../../dist/esm/structs/kits/candidates.d.ts#L16) |
| `CatalogDomainTool` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L12) |
| `CatalogExecutionTool` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L29) |
| `CatalogGoal` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L12) |
| `CatalogScope` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L17) |
| `CatalogTask` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L22) |
| `CatalogTool` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L29) |
| `chatCompletionFunctionOptions` | value | [声明](../../../dist/esm/support/model/chat-completions.d.ts#L22) |
| `chatCompletionMessages` | value | [声明](../../../dist/esm/support/model/chat-completions.d.ts#L47) |
| `chatCompletionParts` | value | [声明](../../../dist/esm/support/model/chat-completions.d.ts#L33) |
| `ChatProvider` | value + type | [声明](../../../dist/esm/structs/model/chat-provider.d.ts#L24) |
| `CheckResult` | type | [声明](../../../dist/esm/structs/common.d.ts#L52) |
| `Command` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L93) |
| `CommandCatalog` | value + type | [声明](../../../dist/esm/kits/interaction/commands.d.ts#L19) |
| `CommandCatalogOptions` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L115) |
| `CommandDefinition` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L58) |
| `commandSchema` | value | [声明](../../../dist/esm/kits/interaction/command.d.ts#L41) |
| `commonPrefixLength` | value | [声明](../../../dist/esm/utils/text.d.ts#L16) |
| `CompatibleModelConfig` | type | [声明](../../../dist/esm/structs/support/model/provider.d.ts#L74) |
| `CompatibleModelPorts` | type | [声明](../../../dist/esm/structs/support/model/provider.d.ts#L98) |
| `CompatibleModelProvider` | value + type | [声明](../../../dist/esm/support/model/compatible-provider.d.ts#L11) |
| `CompatibleModelProviderOptions` | type | [声明](../../../dist/esm/structs/support/model/provider.d.ts#L118) |
| `configureBreakWhile` | value | [声明](../../../dist/esm/utils/break-observer.d.ts#L19) |
| `ContextAssemblyOptions` | type | [声明](../../../dist/esm/structs/support/context.d.ts#L35) |
| `ContextBuilder` | type | [声明](../../../dist/esm/structs/support/context.d.ts#L49) |
| `ContextBuilderOptions` | type | [声明](../../../dist/esm/structs/support/context.d.ts#L28) |
| `ContextFragment` | type | [声明](../../../dist/esm/structs/context/fragments.d.ts#L17) |
| `ContextFragmentConfig` | type | [声明](../../../dist/esm/structs/support/context.d.ts#L42) |
| `ContextFragmentUsage` | type | [声明](../../../dist/esm/structs/context/fragments.d.ts#L34) |
| `ContextJournal` | value + type | [声明](../../../dist/esm/context/journal.d.ts#L5) |
| `ContextLifetime` | type | [声明](../../../dist/esm/structs/context/fragments.d.ts#L15) |
| `ContextPlan` | type | [声明](../../../dist/esm/structs/context/processing.d.ts#L13) |
| `ContextProjection` | type | [声明](../../../dist/esm/structs/support/context.d.ts#L15) |
| `ContextRecord` | type | [声明](../../../dist/esm/structs/context/journal.d.ts#L26) |
| `ContextTrust` | type | [声明](../../../dist/esm/structs/context/fragments.d.ts#L13) |
| `CoreDiagnosticRecord` | type | [声明](../../../dist/esm/structs/diagnostics.d.ts#L279) |
| `CoreEvent` | type | [声明](../../../dist/esm/structs/diagnostics.d.ts#L207) |
| `coreEventCatalog` | value | [声明](../../../dist/esm/diagnostics/catalog.d.ts#L7) |
| `CoreEventDescriptor` | type | [声明](../../../dist/esm/structs/diagnostics.d.ts#L145) |
| `CoreEventName` | type | [声明](../../../dist/esm/structs/diagnostics.d.ts#L138) |
| `CoreEventPayloads` | type | [声明](../../../dist/esm/structs/diagnostics.d.ts#L17) |
| `CoreLogOutput` | type | [声明](../../../dist/esm/structs/diagnostics.d.ts#L232) |
| `CoreStep` | type | [声明](../../../dist/esm/structs/execution/engine.d.ts#L35) |
| `createDiagnostics` | value | [声明](../../../dist/esm/diagnostics/index.d.ts#L18) |
| `CreateDiagnosticsOptions` | type | [声明](../../../dist/esm/structs/diagnostics.d.ts#L266) |
| `createDomainToolRegistry` | value | [声明](../../../dist/esm/kits/domains/registry.d.ts#L105) |
| `createGoalRegistry` | value | [声明](../../../dist/esm/kits/domains/registry.d.ts#L105) |
| `createJsonInteraction` | value | [声明](../../../dist/esm/support/model/transports.d.ts#L43) |
| `createJsonTransport` | value | [声明](../../../dist/esm/support/model/transports.d.ts#L43) |
| `createModelInteraction` | value | [声明](../../../dist/esm/support/model/transports.d.ts#L6) |
| `createModelTransport` | value | [声明](../../../dist/esm/support/model/transports.d.ts#L6) |
| `createScopeRegistry` | value | [声明](../../../dist/esm/kits/domains/scopes.d.ts#L165) |
| `createTextInteraction` | value | [声明](../../../dist/esm/support/model/transports.d.ts#L24) |
| `createTextTransport` | value | [声明](../../../dist/esm/support/model/transports.d.ts#L24) |
| `DebugStepsOutput` | type | [声明](../../../dist/esm/structs/debug.d.ts#L169) |
| `DecodedModelResponseToolCall` | type | [声明](../../../dist/esm/support/model/session.d.ts#L7) |
| `DecodedModelToolResponse` | type | [声明](../../../dist/esm/support/model/session.d.ts#L16) |
| `DecodedSessionCall` | type | [声明](../../../dist/esm/support/model/session.d.ts#L7) |
| `DecodedSessionResult` | type | [声明](../../../dist/esm/support/model/session.d.ts#L16) |
| `defineAgentCatalog` | value | [声明](../../../dist/esm/kits/domains/catalog.d.ts#L16) |
| `defineCandidateSelection` | value | [声明](../../../dist/esm/kits/candidates.d.ts#L24) |
| `defineCommand` | value | [声明](../../../dist/esm/kits/interaction/command.d.ts#L15) |
| `defineCommandCatalog` | value | [声明](../../../dist/esm/kits/interaction/commands.d.ts#L89) |
| `defineContextAssembly` | value | [声明](../../../dist/esm/support/context/assembly.d.ts#L15) |
| `defineContextFragments` | value | [声明](../../../dist/esm/support/context/assembly.d.ts#L28) |
| `defineEvidenceChecklist` | value | [声明](../../../dist/esm/kits/evidence.d.ts#L14) |
| `defineEvidenceProjection` | value | [声明](../../../dist/esm/kits/evidence.d.ts#L40) |
| `defineInteractionProtocol` | value | [声明](../../../dist/esm/kits/interaction/transfer.d.ts#L65) |
| `definePolicySet` | value | [声明](../../../dist/esm/kits/policies.d.ts#L14) |
| `defineRecoveryChain` | value | [声明](../../../dist/esm/kits/policies.d.ts#L40) |
| `defineRegistrationCatalog` | value | [声明](../../../dist/esm/support/registration.d.ts#L13) |
| `defineRetrieval` | value | [声明](../../../dist/esm/kits/retrieval.d.ts#L18) |
| `defineSemanticSlots` | value | [声明](../../../dist/esm/kits/presentation/templates.d.ts#L37) |
| `defineTextSkillLoader` | value | [声明](../../../dist/esm/kits/text-skills.d.ts#L16) |
| `defineTextTemplate` | value | [声明](../../../dist/esm/kits/presentation/templates.d.ts#L21) |
| `defineWorkflow` | value | [声明](../../../dist/esm/execution/workflow.d.ts#L151) |
| `DescribedTool` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L42) |
| `DiagnosticContext` | type | [声明](../../../dist/esm/structs/diagnostics.d.ts#L243) |
| `diagnosticError` | value | [声明](../../../dist/esm/diagnostics/index.d.ts#L27) |
| `DiagnosticIdentity` | type | [声明](../../../dist/esm/structs/diagnostics.d.ts#L150) |
| `DiagnosticSpanFields` | type | [声明](../../../dist/esm/structs/diagnostics.d.ts#L199) |
| `DomainTool` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L15) |
| `domainToolDelegates` | value | [声明](../../../dist/esm/kits/domains/catalog.d.ts#L78) |
| `DomainToolDescription` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L71) |
| `DomainToolId` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L75) |
| `DomainToolPolicy` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L44) |
| `DomainToolRegistration` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L42) |
| `DomainToolRegistry` | value + type | [声明](../../../dist/esm/kits/domains/registry.d.ts#L9) |
| `DurationMs` | type | [声明](../../../dist/esm/structs/common.d.ts#L17) |
| `encodeSseEvent` | value | [声明](../../../dist/esm/support/transport/sse.d.ts#L25) |
| `EngineCacheOptions` | type | [声明](../../../dist/esm/structs/execution/cache.d.ts#L6) |
| `ErasedTool` | type | [声明](../../../dist/esm/structs/capabilities/tools.d.ts#L54) |
| `EvidenceProjectionDefinition` | type | [声明](../../../dist/esm/structs/kits/evidence.d.ts#L36) |
| `EvidenceProjectionProvider` | type | [声明](../../../dist/esm/structs/kits/evidence.d.ts#L29) |
| `EvidenceProvider` | type | [声明](../../../dist/esm/structs/kits/evidence.d.ts#L21) |
| `EvidenceRequirement` | type | [声明](../../../dist/esm/structs/kits/evidence.d.ts#L12) |
| `executeInvocation` | value | [声明](../../../dist/esm/capabilities/invocation.d.ts#L17) |
| `ExecutionContext` | type | [声明](../../../dist/esm/structs/common.d.ts#L95) |
| `ExecutionEventDescriptor` | type | [声明](../../../dist/esm/structs/execution/events.d.ts#L14) |
| `ExecutionObserver` | type | [声明](../../../dist/esm/structs/execution/events.d.ts#L17) |
| `ExecutionOptions` | type | [声明](../../../dist/esm/structs/common.d.ts#L86) |
| `FunctionCallDelta` | type | [声明](../../../dist/esm/structs/model/messages.d.ts#L114) |
| `getErrorInfo` | value | [声明](../../../dist/esm/errors.d.ts#L25) |
| `goalDelegates` | value | [声明](../../../dist/esm/kits/domains/catalog.d.ts#L78) |
| `GoalDescription` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L71) |
| `GoalId` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L75) |
| `GoalPolicy` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L44) |
| `GoalRegistry` | value + type | [声明](../../../dist/esm/kits/domains/registry.d.ts#L9) |
| `GoalTool` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L15) |
| `GoalToolRegistration` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L42) |
| `Id` | type | [声明](../../../dist/esm/structs/common.d.ts#L13) |
| `IntentOptions` | type | [声明](../../../dist/esm/structs/capabilities/model.d.ts#L20) |
| `INTERACTION_CATEGORIES` | value | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L28) |
| `InteractionCategory` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L26) |
| `InteractionDescriptor` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L30) |
| `InteractionHandlers` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L41) |
| `InteractionProtocol` | value + type | [声明](../../../dist/esm/kits/interaction/transfer.d.ts#L11) |
| `InteractionProtocolDefinition` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L128) |
| `InvocationHandler` | type | [声明](../../../dist/esm/structs/capabilities/invocation.d.ts#L38) |
| `InvocationMetadata` | type | [声明](../../../dist/esm/structs/invocation.d.ts#L13) |
| `InvocationResult` | type | [声明](../../../dist/esm/structs/invocation.d.ts#L30) |
| `InvocationStatus` | type | [声明](../../../dist/esm/structs/common.d.ts#L23) |
| `Issue` | type | [声明](../../../dist/esm/structs/common.d.ts#L36) |
| `JsonFrameLimits` | type | [声明](../../../dist/esm/structs/support/transport/json.d.ts#L12) |
| `jsonObjectInteraction` | value | [声明](../../../dist/esm/model/interactions/json-object.d.ts#L9) |
| `JsonSchema` | type | [声明](../../../dist/esm/structs/common.d.ts#L25) |
| `LegacyAgentCatalogPorts` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L51) |
| `LifecycleContext` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L2) |
| `LifecycleHooks` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L72) |
| `LifecycleProtocol` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L59) |
| `LifecycleRun` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L36) |
| `LifecycleTool` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L131) |
| `LifecycleToolBase` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L112) |
| `LifecycleToolRegistration` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L133) |
| `LoopEvent` | type | [声明](../../../dist/esm/structs/execution/engine.d.ts#L13) |
| `matchRule` | value | [声明](../../../dist/esm/utils/rules.d.ts#L26) |
| `MatchRule` | type | [声明](../../../dist/esm/structs/utils/rules.d.ts#L12) |
| `MaybePromise` | type | [声明](../../../dist/esm/structs/common.d.ts#L27) |
| `ModelCallRecord` | type | [声明](../../../dist/esm/structs/invocation.d.ts#L35) |
| `ModelCallRequest` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L199) |
| `ModelCallTrace` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L74) |
| `ModelCapabilities` | type | [声明](../../../dist/esm/structs/model/messages.d.ts#L45) |
| `ModelChildOptions` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L137) |
| `ModelChildPolicy` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L58) |
| `ModelContentPart` | type | [声明](../../../dist/esm/structs/model/messages.d.ts#L28) |
| `ModelContinuation` | type | [声明](../../../dist/esm/structs/model/messages.d.ts#L37) |
| `ModelDuplex` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L51) |
| `ModelFunction` | type | [声明](../../../dist/esm/structs/model/messages.d.ts#L103) |
| `ModelImage` | type | [声明](../../../dist/esm/structs/model/messages.d.ts#L11) |
| `ModelInputMeasurement` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L231) |
| `ModelInteractionAdapter` | type | [声明](../../../dist/esm/structs/model/interactions.d.ts#L52) |
| `modelInteractionCatalog` | value | [声明](../../../dist/esm/support/model/interactions/index.d.ts#L6) |
| `ModelInteractionDefinition` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L67) |
| `ModelInteractionOptions` | type | [声明](../../../dist/esm/structs/model/messages.d.ts#L157) |
| `ModelInteractionRegistration` | type | [声明](../../../dist/esm/structs/model/interactions.d.ts#L67) |
| `ModelLifecycleContext` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L2) |
| `ModelLifecycleRun` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L36) |
| `ModelMessage` | type | [声明](../../../dist/esm/structs/model/messages.d.ts#L66) |
| `ModelOperationAction` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L7) |
| `ModelOperationHandle` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L10) |
| `ModelOperationPorts` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L43) |
| `ModelOperationProvider` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L32) |
| `ModelOperationRequest` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L19) |
| `ModelOperationResult` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L25) |
| `ModelOperationStatus` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L8) |
| `ModelOptions` | type | [声明](../../../dist/esm/structs/model/messages.d.ts#L128) |
| `ModelOutputEvent` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L116) |
| `ModelPart` | type | [声明](../../../dist/esm/structs/model/messages.d.ts#L126) |
| `ModelPrepareRequest` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L287) |
| `modelProtocolError` | value | [声明](../../../dist/esm/utils/model-protocol.d.ts#L9) |
| `ModelProvider` | type | [声明](../../../dist/esm/structs/model/chat-provider.d.ts#L41) |
| `ModelProviderContext` | type | [声明](../../../dist/esm/structs/model/chat-provider.d.ts#L14) |
| `ModelProviderErrorCode` | type | [声明](../../../dist/esm/structs/support/model/provider.d.ts#L15) |
| `ModelProviderFailure` | type | [声明](../../../dist/esm/structs/support/model/provider.d.ts#L37) |
| `ModelRealtimeEvent` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L60) |
| `ModelRealtimeProvider` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L56) |
| `ModelResponseCollector` | type | [声明](../../../dist/esm/structs/model/interactions.d.ts#L14) |
| `ModelResult` | type | [声明](../../../dist/esm/structs/invocation.d.ts#L55) |
| `ModelRunner` | value + type | [声明](../../../dist/esm/model/runner.d.ts#L16) |
| `modelRunnerDefaults` | value | [声明](../../../dist/esm/model/defaults.d.ts#L8) |
| `ModelRunnerOptions` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L179) |
| `ModelRunnerPorts` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L120) |
| `ModelRunnerProvider` | type | [声明](../../../dist/esm/structs/model/chat-provider.d.ts#L41) |
| `ModelRunnerSettings` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L157) |
| `ModelRuntimeConfig` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L45) |
| `ModelSelection` | type | [声明](../../../dist/esm/structs/capabilities/model.d.ts#L58) |
| `ModelStreamEvent` | type | [声明](../../../dist/esm/structs/model/messages.d.ts#L52) |
| `ModelTokenBudget` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L29) |
| `ModelTool` | type | [声明](../../../dist/esm/structs/capabilities/model.d.ts#L31) |
| `ModelToolCatalog` | type | [声明](../../../dist/esm/structs/capabilities/model.d.ts#L88) |
| `ModelToolInteractionOptions` | type | [声明](../../../dist/esm/support/model/session.d.ts#L27) |
| `ModelToolInteractionRegistration` | type | [声明](../../../dist/esm/support/model/session.d.ts#L33) |
| `ModelToolRegistration` | type | [声明](../../../dist/esm/structs/capabilities/model.d.ts#L52) |
| `ModelToolRegistry` | value + type | [声明](../../../dist/esm/capabilities/model.d.ts#L4) |
| `ModelToolSelection` | type | [声明](../../../dist/esm/structs/capabilities/model.d.ts#L71) |
| `ModelToolSource` | type | [声明](../../../dist/esm/structs/capabilities/model.d.ts#L80) |
| `ModelTransportDefinition` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L67) |
| `ModelTransportRegistration` | type | [声明](../../../dist/esm/structs/model/interactions.d.ts#L67) |
| `ModelUsage` | type | [声明](../../../dist/esm/structs/model/messages.d.ts#L94) |
| `nativeFunctionInteraction` | value | [声明](../../../dist/esm/model/interactions/native-functions.d.ts#L8) |
| `NodeAgentCache` | type | [声明](../../../dist/esm/structs/execution/cache.d.ts#L43) |
| `NodeCache` | type | [声明](../../../dist/esm/structs/execution/cache.d.ts#L15) |
| `NodeReportingContext` | type | [声明](../../../dist/esm/structs/debug.d.ts#L140) |
| `normalizeDiagnosticEvent` | value | [声明](../../../dist/esm/diagnostics/index.d.ts#L41) |
| `Observer` | type | [声明](../../../dist/esm/structs/common.d.ts#L19) |
| `openModelRealtime` | value | [声明](../../../dist/esm/model/realtime.d.ts#L14) |
| `OperationAction` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L7) |
| `OperationContext` | type | [声明](../../../dist/esm/structs/common.d.ts#L109) |
| `OperationStatus` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L8) |
| `parseJsonFrames` | value | [声明](../../../dist/esm/support/transport/json.d.ts#L32) |
| `Policy` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L211)；Use ToolLifecyclePolicy. |
| `PolicyAssessment` | type | [声明](../../../dist/esm/structs/kits/policies.d.ts#L22) |
| `PolicyDefinition` | type | [声明](../../../dist/esm/structs/kits/policies.d.ts#L11) |
| `PreparedModelCall` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L264) |
| `PreparedModelInteraction` | type | [声明](../../../dist/esm/structs/model/interactions.d.ts#L45) |
| `PreparedModelSelection` | type | [声明](../../../dist/esm/structs/model/interactions.d.ts#L32) |
| `PreparedModelToolInteraction` | type | [声明](../../../dist/esm/support/model/session.d.ts#L20) |
| `PreparedSessionTransport` | type | [声明](../../../dist/esm/support/model/session.d.ts#L20) |
| `prepareModelToolInteraction` | value | [声明](../../../dist/esm/support/model/session.d.ts#L52) |
| `prepareSessionFunctions` | value | [声明](../../../dist/esm/support/model/session.d.ts#L52) |
| `ProtocolCheck` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L47) |
| `ProtocolField` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L15) |
| `ProtocolPredicate` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L45) |
| `ProtocolReason` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L43) |
| `ProtocolRegistry` | value + type | [声明](../../../dist/esm/utils/protocol-registry.d.ts#L16) |
| `ProtocolShape` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L138) |
| `ProviderReasoningLevel` | type | [声明](../../../dist/esm/structs/support/model/provider.d.ts#L45) |
| `ProviderReasoningStrategy` | type | [声明](../../../dist/esm/structs/support/model/provider.d.ts#L52) |
| `publishReplyEvents` | value | [声明](../../../dist/esm/kits/presentation/events.d.ts#L40) |
| `ReadonlyCatalog` | type | [声明](../../../dist/esm/structs/common.d.ts#L60) |
| `readSse` | value | [声明](../../../dist/esm/index.d.ts#L35) |
| `RealtimeSessionOptions` | type | [声明](../../../dist/esm/model/realtime.d.ts#L4) |
| `RecordedSubStep` | type | [声明](../../../dist/esm/structs/debug.d.ts#L94) |
| `RecoveryDefinition` | type | [声明](../../../dist/esm/structs/kits/policies.d.ts#L40) |
| `RecoveryResult` | type | [声明](../../../dist/esm/structs/kits/policies.d.ts#L31) |
| `RegisteredDomainTool` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L82) |
| `RegisteredGoal` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L82) |
| `RegisteredLifecycleTool` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L142) |
| `RegisteredModelTool` | type | [声明](../../../dist/esm/structs/capabilities/model.d.ts#L56) |
| `RegisteredProtocol` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L149) |
| `RegisteredScope` | type | [声明](../../../dist/esm/structs/kits/domains/scopes.d.ts#L79) |
| `RegisteredScopeEvidence` | type | [声明](../../../dist/esm/structs/kits/domains/scopes.d.ts#L67) |
| `RegisteredTool` | type | [声明](../../../dist/esm/structs/capabilities/tools.d.ts#L65) |
| `RegisteredToolDefinition` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L142) |
| `RegistrationDefinition` | type | [声明](../../../dist/esm/structs/support/registration.d.ts#L11) |
| `Registry` | type | [声明](../../../dist/esm/structs/common.d.ts#L76) |
| `REPLY_BUBBLE_BOUNDARY` | value | [声明](../../../dist/esm/kits/presentation/events.d.ts#L19) |
| `ReplyBubbleInput` | type | [声明](../../../dist/esm/structs/kits/presentation/events.d.ts#L32) |
| `replyBubbleTexts` | value | [声明](../../../dist/esm/kits/presentation/events.d.ts#L26) |
| `ReplyDeliveryOptions` | type | [声明](../../../dist/esm/structs/kits/presentation/events.d.ts#L39) |
| `ReplyGuidance` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L195) |
| `ReportedStep` | type | [声明](../../../dist/esm/structs/debug.d.ts#L57) |
| `ReportedStepInput` | type | [声明](../../../dist/esm/structs/debug.d.ts#L111) |
| `ReportedStepLog` | type | [声明](../../../dist/esm/structs/debug.d.ts#L130) |
| `ReportedStepProgress` | type | [声明](../../../dist/esm/structs/debug.d.ts#L148) |
| `ReportedStepRecord` | type | [声明](../../../dist/esm/structs/debug.d.ts#L94) |
| `ReportedStepRecorder` | value + type | [声明](../../../dist/esm/diagnostics/sub-flow.d.ts#L45) |
| `ReportedStepStatus` | type | [声明](../../../dist/esm/structs/debug.d.ts#L55) |
| `reportedStepStatusCatalog` | value | [声明](../../../dist/esm/structs/debug.d.ts#L19) |
| `reportedStepStatuses` | value | [声明](../../../dist/esm/structs/debug.d.ts#L53) |
| `ReportedStepUpdate` | type | [声明](../../../dist/esm/structs/debug.d.ts#L119) |
| `ReportedStepValue` | type | [声明](../../../dist/esm/structs/debug.d.ts#L90) |
| `requireWorkflowValue` | value | [声明](../../../dist/esm/execution/state.d.ts#L22) |
| `RetrievalDefinition` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L96) |
| `RetrievalEffect` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L49) |
| `RetrievalPorts` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L56) |
| `retrievalQueryKey` | value | [声明](../../../dist/esm/utils/query-key.d.ts#L12) |
| `RetrievalReason` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L47) |
| `RetrievalReceipt` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L30) |
| `RetrievalResult` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L17) |
| `RetrievalRunner` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L87) |
| `RetrievalSource` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L13) |
| `RetrievalState` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L21) |
| `route` | value | [声明](../../../dist/esm/execution/state.d.ts#L195) |
| `runModelOperation` | value | [声明](../../../dist/esm/model/operations.d.ts#L4) |
| `RuntimeNodeReportingContext` | type | [声明](../../../dist/esm/structs/debug.d.ts#L190) |
| `scanJsonObjectFrames` | value | [声明](../../../dist/esm/support/transport/json.d.ts#L18) |
| `SchemaAdapter` | type | [声明](../../../dist/esm/structs/common.d.ts#L29) |
| `ScopeDefinition` | type | [声明](../../../dist/esm/structs/kits/domains/scopes.d.ts#L15) |
| `ScopeDescription` | type | [声明](../../../dist/esm/structs/kits/domains/scopes.d.ts#L83) |
| `ScopedReportedStepInput` | type | [声明](../../../dist/esm/structs/debug.d.ts#L117) |
| `ScopedReportedStepRecorder` | value + type | [声明](../../../dist/esm/diagnostics/sub-flow.d.ts#L55) |
| `ScopedSubFlowLogger` | value + type | [声明](../../../dist/esm/diagnostics/sub-flow.d.ts#L55) |
| `ScopedSubFlowStepInput` | type | [声明](../../../dist/esm/structs/debug.d.ts#L117) |
| `ScopeRegistry` | value + type | [声明](../../../dist/esm/kits/domains/scopes.d.ts#L17) |
| `ScopeRegistryPolicy` | type | [声明](../../../dist/esm/structs/kits/domains/scopes.d.ts#L40) |
| `SearchHit` | type | [声明](../../../dist/esm/structs/common.d.ts#L118) |
| `SemanticSlotDefinition` | type | [声明](../../../dist/esm/structs/kits/presentation/templates.d.ts#L19) |
| `serializeOutputEvents` | value | [声明](../../../dist/esm/kits/presentation/events.d.ts#L53) |
| `SessionFunctionOptions` | type | [声明](../../../dist/esm/support/model/session.d.ts#L27) |
| `SessionModelTransportRegistration` | type | [声明](../../../dist/esm/support/model/session.d.ts#L33) |
| `SseEvent` | type | [声明](../../../dist/esm/index.d.ts#L35) |
| `SseIdleTimeoutError` | value + type | [声明](../../../dist/esm/index.d.ts#L35) |
| `SseOutputEvent` | type | [声明](../../../dist/esm/structs/support/transport/sse.d.ts#L19) |
| `SseReadOptions` | type | [声明](../../../dist/esm/index.d.ts#L35) |
| `SseWriter` | type | [声明](../../../dist/esm/structs/support/transport/sse.d.ts#L12) |
| `StepOutcome` | type | [声明](../../../dist/esm/structs/execution/engine.d.ts#L26) |
| `SubFlowLog` | type | [声明](../../../dist/esm/structs/debug.d.ts#L130) |
| `SubFlowLogger` | value + type | [声明](../../../dist/esm/diagnostics/sub-flow.d.ts#L45) |
| `SubFlowStepFix` | type | [声明](../../../dist/esm/structs/debug.d.ts#L119) |
| `SubFlowStepInput` | type | [声明](../../../dist/esm/structs/debug.d.ts#L111) |
| `SubFlowValue` | type | [声明](../../../dist/esm/structs/debug.d.ts#L90) |
| `SubStepProgress` | type | [声明](../../../dist/esm/structs/debug.d.ts#L148) |
| `Support` | value | [声明](../../../dist/esm/support/index.d.ts#L10) |
| `textOutputEvents` | value | [声明](../../../dist/esm/kits/presentation/events.d.ts#L60) |
| `TextSkill` | type | [声明](../../../dist/esm/structs/kits/text-skills.d.ts#L24) |
| `TextSkillHeader` | type | [声明](../../../dist/esm/structs/kits/text-skills.d.ts#L31) |
| `TextSkillLoader` | type | [声明](../../../dist/esm/structs/kits/text-skills.d.ts#L61) |
| `TextSkillLoaderDefinition` | type | [声明](../../../dist/esm/structs/kits/text-skills.d.ts#L36) |
| `TextSkillReadPorts` | type | [声明](../../../dist/esm/structs/kits/text-skills.d.ts#L56) |
| `TextSkillRegistration` | type | [声明](../../../dist/esm/structs/kits/text-skills.d.ts#L13) |
| `TextTemplateOptions` | type | [声明](../../../dist/esm/structs/kits/presentation/templates.d.ts#L10) |
| `TimestampMs` | type | [声明](../../../dist/esm/structs/common.d.ts#L15) |
| `Tool` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L219)；Use LifecycleTool and domainToolIds. |
| `ToolCallRecord` | type | [声明](../../../dist/esm/structs/invocation.d.ts#L48) |
| `ToolCondition` | type | [声明](../../../dist/esm/structs/capabilities/model.d.ts#L29) |
| `ToolContext` | type | [声明](../../../dist/esm/structs/capabilities/model.d.ts#L18) |
| `ToolDefinition` | type | [声明](../../../dist/esm/structs/capabilities/tools.d.ts#L39) |
| `ToolDomainMembership` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L123) |
| `ToolExecutionContext` | type | [声明](../../../dist/esm/structs/capabilities/tools.d.ts#L41) |
| `ToolExecutionEvent` | type | [声明](../../../dist/esm/structs/capabilities/tools.d.ts#L67) |
| `ToolFinalizer` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L179) |
| `ToolInvocationPorts` | type | [声明](../../../dist/esm/structs/capabilities/invocation.d.ts#L51) |
| `ToolInvocationRequest` | type | [声明](../../../dist/esm/structs/capabilities/tools.d.ts#L88) |
| `ToolJournal` | type | [声明](../../../dist/esm/structs/capabilities/invocation.d.ts#L31) |
| `ToolLifecycleHooks` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L72) |
| `ToolLifecyclePolicy` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L225) |
| `ToolLifecycleProtocol` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L59) |
| `ToolLifecycleRegistry` | value + type | [声明](../../../dist/esm/kits/tools.d.ts#L20) |
| `ToolLifecycleRegistryOptions` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L231) |
| `ToolModelField` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L44) |
| `ToolNormalizer` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L177) |
| `ToolProposal` | type | [声明](../../../dist/esm/structs/capabilities/model.d.ts#L13) |
| `ToolProtocol` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L171) |
| `ToolRegistration` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L223)；Use LifecycleToolRegistration. |
| `ToolRegistry` | value + type | [声明](../../../dist/esm/capabilities/tools.d.ts#L7) |
| `ToolRegistryOptions` | type | [声明](../../../dist/esm/structs/capabilities/tools.d.ts#L99) |
| `ToolRegistryPorts` | type | [声明](../../../dist/esm/structs/capabilities/tools.d.ts#L78) |
| `ToolResult` | type | [声明](../../../dist/esm/structs/invocation.d.ts#L57) |
| `ToolRuntimeTypes` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L25) |
| `ToolsOptions` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L215)；Use ToolLifecycleRegistryOptions. |
| `transformContextText` | value | [声明](../../../dist/esm/support/context/assembly.d.ts#L39) |
| `validateContextBudget` | value | [声明](../../../dist/esm/context/fragments.d.ts#L39) |
| `validateContextFragment` | value | [声明](../../../dist/esm/context/fragments.d.ts#L26) |
| `ValidationError` | value + type | [声明](../../../dist/esm/structs/errors.d.ts#L17) |
| `waitModelOperation` | value | [声明](../../../dist/esm/model/operations.d.ts#L6) |
| `WalkRule` | type | [声明](../../../dist/esm/structs/utils/rules.d.ts#L22) |
| `walkRules` | value | [声明](../../../dist/esm/utils/rules.d.ts#L36) |
| `WorkflowChain` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L62) |
| `WorkflowChainCoverage` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L46) |
| `WorkflowChainNode` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L78) |
| `WorkflowChainNodeEvent` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L98) |
| `WorkflowChainSource` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L57) |
| `WorkflowChainTransition` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L111) |
| `WorkflowContext` | type | [声明](../../../dist/esm/structs/execution/workflow.d.ts#L26) |
| `WorkflowContractError` | value + type | [声明](../../../dist/esm/structs/errors.d.ts#L38) |
| `WorkflowEvent` | type | [声明](../../../dist/esm/structs/execution/workflow.d.ts#L119) |
| `WorkflowExtension` | type | [声明](../../../dist/esm/structs/execution/workflow.d.ts#L161) |
| `WorkflowGraph` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L6) |
| `WorkflowGraphEdge` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L37) |
| `WorkflowGraphNode` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L15) |
| `WorkflowGraphRoute` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L28) |
| `WorkflowModel` | type | [声明](../../../dist/esm/structs/execution/workflow.d.ts#L175) |
| `WorkflowNode` | type | [声明](../../../dist/esm/structs/execution/workflow.d.ts#L73) |
| `WorkflowNodeReport` | type | [声明](../../../dist/esm/structs/execution/workflow.d.ts#L66) |
| `WorkflowNodeVisit` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L78) |
| `WorkflowNodeVisitEvent` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L98) |
| `WorkflowReportedStepRecord` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L71) |
| `WorkflowRoute` | type | [声明](../../../dist/esm/structs/execution/workflow.d.ts#L50) |
| `WorkflowRunTrace` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L62) |
| `WorkflowRunTraceCoverage` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L46) |
| `WorkflowRunTraceSource` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L57) |
| `WorkflowSubflowRecord` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L71) |
| `WorkflowTransitionRecord` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L111) |
| `writeSseFrame` | value | [声明](../../../dist/esm/support/transport/sse.d.ts#L38) |

## @jangts/agent-core/engine

[合同与行为](core.md) · 53 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `AgentBranch` | type | [声明](../../../dist/esm/execution/engine.d.ts#L63) |
| `AgentCacheAddress` | type | [声明](../../../dist/esm/structs/execution/cache.d.ts#L27) |
| `AgentCacheOptions` | type | [声明](../../../dist/esm/structs/execution/cache.d.ts#L23) |
| `AgentCachePort` | type | [声明](../../../dist/esm/structs/execution/cache.d.ts#L34) |
| `AgentCheckpoint` | type | [声明](../../../dist/esm/execution/engine.d.ts#L83) |
| `AgentCheckpointRecord` | type | [声明](../../../dist/esm/execution/engine.d.ts#L94) |
| `AgentCoreEngine` | value + type | [声明](../../../dist/esm/execution/engine.d.ts#L110) |
| `AgentCoreEngineOptions` | type | [声明](../../../dist/esm/structs/execution/engine.d.ts#L37) |
| `AgentCoreEngineSetup` | type | [声明](../../../dist/esm/execution/engine.d.ts#L36) |
| `AgentModelBinding` | type | [声明](../../../dist/esm/execution/engine.d.ts#L25) |
| `AgentModelRuntime` | type | [声明](../../../dist/esm/execution/engine.d.ts#L15) |
| `AgentSnapshot` | type | [声明](../../../dist/esm/execution/engine.d.ts#L83) |
| `AgentSnapshotRecord` | type | [声明](../../../dist/esm/execution/engine.d.ts#L94) |
| `AgentWorkflow` | value + type | [声明](../../../dist/esm/execution/workflow.d.ts#L9) |
| `AgentWorkflowDefinition` | type | [声明](../../../dist/esm/structs/execution/workflow.d.ts#L103) |
| `AttemptBudget` | value + type | [声明](../../../dist/esm/execution/workflow.d.ts#L158) |
| `CacheContext` | type | [声明](../../../dist/esm/structs/execution/cache.d.ts#L51) |
| `CacheReadOptions` | type | [声明](../../../dist/esm/structs/execution/cache.d.ts#L11) |
| `CoreStep` | type | [声明](../../../dist/esm/structs/execution/engine.d.ts#L35) |
| `defineWorkflow` | value | [声明](../../../dist/esm/execution/workflow.d.ts#L151) |
| `EngineCacheOptions` | type | [声明](../../../dist/esm/structs/execution/cache.d.ts#L6) |
| `LoopEvent` | type | [声明](../../../dist/esm/structs/execution/engine.d.ts#L13) |
| `NodeAgentCache` | type | [声明](../../../dist/esm/structs/execution/cache.d.ts#L43) |
| `NodeCache` | type | [声明](../../../dist/esm/structs/execution/cache.d.ts#L15) |
| `requireWorkflowValue` | value | [声明](../../../dist/esm/execution/state.d.ts#L22) |
| `route` | value | [声明](../../../dist/esm/execution/state.d.ts#L195) |
| `StepOutcome` | type | [声明](../../../dist/esm/structs/execution/engine.d.ts#L26) |
| `WorkflowChain` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L62) |
| `WorkflowChainCoverage` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L46) |
| `WorkflowChainNode` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L78) |
| `WorkflowChainNodeEvent` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L98) |
| `WorkflowChainSource` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L57) |
| `WorkflowChainTransition` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L111) |
| `WorkflowContext` | type | [声明](../../../dist/esm/structs/execution/workflow.d.ts#L26) |
| `WorkflowContractError` | value + type | [声明](../../../dist/esm/structs/errors.d.ts#L38) |
| `WorkflowEvent` | type | [声明](../../../dist/esm/structs/execution/workflow.d.ts#L119) |
| `WorkflowExtension` | type | [声明](../../../dist/esm/structs/execution/workflow.d.ts#L161) |
| `WorkflowGraph` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L6) |
| `WorkflowGraphEdge` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L37) |
| `WorkflowGraphNode` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L15) |
| `WorkflowGraphRoute` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L28) |
| `WorkflowModel` | type | [声明](../../../dist/esm/structs/execution/workflow.d.ts#L175) |
| `WorkflowNode` | type | [声明](../../../dist/esm/structs/execution/workflow.d.ts#L73) |
| `WorkflowNodeReport` | type | [声明](../../../dist/esm/structs/execution/workflow.d.ts#L66) |
| `WorkflowNodeVisit` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L78) |
| `WorkflowNodeVisitEvent` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L98) |
| `WorkflowReportedStepRecord` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L71) |
| `WorkflowRoute` | type | [声明](../../../dist/esm/structs/execution/workflow.d.ts#L50) |
| `WorkflowRunTrace` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L62) |
| `WorkflowRunTraceCoverage` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L46) |
| `WorkflowRunTraceSource` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L57) |
| `WorkflowSubflowRecord` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L71) |
| `WorkflowTransitionRecord` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L111) |

## @jangts/agent-core/model

[合同与行为](core.md) · 18 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `BudgetError` | value + type | [声明](../../../dist/esm/structs/errors.d.ts#L29) |
| `ModelCallRequest` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L199) |
| `ModelCallTrace` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L74) |
| `ModelChildOptions` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L137) |
| `ModelChildPolicy` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L58) |
| `ModelInputMeasurement` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L231) |
| `ModelInteractionDefinition` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L67) |
| `ModelOutputEvent` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L116) |
| `ModelPrepareRequest` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L287) |
| `ModelRunner` | value + type | [声明](../../../dist/esm/model/runner.d.ts#L16) |
| `ModelRunnerOptions` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L179) |
| `ModelRunnerPorts` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L120) |
| `ModelRunnerSettings` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L157) |
| `ModelRuntimeConfig` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L45) |
| `ModelTokenBudget` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L29) |
| `ModelTransportDefinition` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L67) |
| `PreparedModelCall` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L264) |
| `ReplyGuidance` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L195) |

## @jangts/agent-core/types

[合同与行为](types.md) · 663 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `abortableStream` | type | [声明](../../../dist/esm/types.d.ts#L20) |
| `AgentBranch` | type | [声明](../../../dist/esm/execution/engine.d.ts#L63) |
| `AgentCacheAddress` | type | [声明](../../../dist/esm/structs/execution/cache.d.ts#L27) |
| `AgentCacheOptions` | type | [声明](../../../dist/esm/structs/execution/cache.d.ts#L23) |
| `AgentCachePort` | type | [声明](../../../dist/esm/structs/execution/cache.d.ts#L34) |
| `AgentCatalogPorts` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L77) |
| `AgentCheckpoint` | type | [声明](../../../dist/esm/execution/engine.d.ts#L83) |
| `AgentCheckpointRecord` | type | [声明](../../../dist/esm/execution/engine.d.ts#L94) |
| `AgentCoreEngine` | type | [声明](../../../dist/esm/execution/engine.d.ts#L110) |
| `AgentCoreEngineOptions` | type | [声明](../../../dist/esm/structs/execution/engine.d.ts#L37) |
| `AgentCoreEngineSetup` | type | [声明](../../../dist/esm/execution/engine.d.ts#L36) |
| `AgentErrorInfo` | type | [声明](../../../dist/esm/structs/errors.d.ts#L46) |
| `AgentFamily` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L86) |
| `AgentModelBinding` | type | [声明](../../../dist/esm/execution/engine.d.ts#L25) |
| `AgentModelRuntime` | type | [声明](../../../dist/esm/execution/engine.d.ts#L15) |
| `AgentOutputEvent` | type | [声明](../../../dist/esm/structs/kits/presentation/events.d.ts#L11) |
| `AgentSnapshot` | type | [声明](../../../dist/esm/execution/engine.d.ts#L83) |
| `AgentSnapshotRecord` | type | [声明](../../../dist/esm/execution/engine.d.ts#L94) |
| `AgentWorkflow` | type | [声明](../../../dist/esm/execution/workflow.d.ts#L9) |
| `AgentWorkflowDefinition` | type | [声明](../../../dist/esm/structs/execution/workflow.d.ts#L103) |
| `aggregateBranchResults` | type | [声明](../../../dist/esm/kits/aggregation.d.ts#L55) |
| `Aggregation` | type | [声明](../../../dist/esm/kits/aggregation.d.ts#L58) |
| `AnswerCheck` | type | [声明](../../../dist/esm/structs/kits/answering/flow.d.ts#L16) |
| `AnswerChecker` | type | [声明](../../../dist/esm/structs/kits/answering/checks.d.ts#L11) |
| `AnswerFlowDefinition` | type | [声明](../../../dist/esm/structs/kits/answering/flow.d.ts#L45) |
| `Answering` | type | [声明](../../../dist/esm/kits/answering/index.d.ts#L21) |
| `AnswerIssue` | type | [声明](../../../dist/esm/structs/kits/answering/flow.d.ts#L13) |
| `AnswerItem` | type | [声明](../../../dist/esm/structs/kits/answering/flow.d.ts#L19) |
| `AnswerReader` | type | [声明](../../../dist/esm/structs/kits/answering/tasks.d.ts#L38) |
| `AnswerResult` | type | [声明](../../../dist/esm/structs/kits/answering/flow.d.ts#L30) |
| `AnswerTaskBase` | type | [声明](../../../dist/esm/structs/kits/answering/tasks.d.ts#L11) |
| `AnswerTaskDefinition` | type | [声明](../../../dist/esm/structs/kits/answering/tasks.d.ts#L30) |
| `AnswerTaskPorts` | type | [声明](../../../dist/esm/structs/kits/answering/tasks.d.ts#L46) |
| `applyMemoryUpdate` | type | [声明](../../../dist/esm/kits/memory.d.ts#L131) |
| `ArtifactReference` | type | [声明](../../../dist/esm/structs/kits/artifacts.d.ts#L12) |
| `ArtifactResolver` | type | [声明](../../../dist/esm/structs/kits/artifacts.d.ts#L21) |
| `Artifacts` | type | [声明](../../../dist/esm/kits/artifacts.d.ts#L40) |
| `AsIntent` | type | [声明](../../../dist/esm/structs/capabilities/model.d.ts#L27) |
| `assembleContextPlan` | type | [声明](../../../dist/esm/context/plan.d.ts#L14) |
| `assembleFragments` | type | [声明](../../../dist/esm/context/assembly.d.ts#L14) |
| `AsyncSink` | type | [声明](../../../dist/esm/structs/common.d.ts#L21) |
| `AttemptBudget` | type | [声明](../../../dist/esm/execution/workflow.d.ts#L158) |
| `batchMemorySources` | type | [声明](../../../dist/esm/kits/memory.d.ts#L149) |
| `bindInteraction` | type | [声明](../../../dist/esm/kits/interaction/handlers.d.ts#L21) |
| `bindReviewChoiceDecision` | type | [声明](../../../dist/esm/kits/review-choice.d.ts#L9) |
| `BoundModelProvider` | type | [声明](../../../dist/esm/structs/model/chat-provider.d.ts#L51) |
| `BranchAggregationRequest` | type | [声明](../../../dist/esm/structs/kits/aggregation.d.ts#L29) |
| `BranchAggregationResult` | type | [声明](../../../dist/esm/structs/kits/aggregation.d.ts#L34) |
| `BranchResult` | type | [声明](../../../dist/esm/structs/kits/aggregation.d.ts#L19) |
| `BranchVersion` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L19) |
| `BranchVersioning` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L86) |
| `BranchVersioningDefinition` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L56) |
| `BranchVersionOperation` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L17) |
| `branchVersionOperations` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L15) |
| `BranchVersionRecord` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L36) |
| `BranchVersions` | type | [声明](../../../dist/esm/kits/family.d.ts#L19) |
| `BranchVersionStore` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L49) |
| `BreakCheck` | type | [声明](../../../dist/esm/structs/utils/rules.d.ts#L33) |
| `BreakEvent` | type | [声明](../../../dist/esm/structs/utils/rules.d.ts#L42) |
| `BreakPredicate` | type | [声明](../../../dist/esm/structs/utils/rules.d.ts#L31) |
| `BreakReason` | type | [声明](../../../dist/esm/structs/utils/rules.d.ts#L29) |
| `breakWhile` | type | [声明](../../../dist/esm/utils/rules.d.ts#L56) |
| `BreakWhileConfig` | type | [声明](../../../dist/esm/structs/utils/rules.d.ts#L49) |
| `BudgetError` | type | [声明](../../../dist/esm/structs/errors.d.ts#L29) |
| `BuiltContext` | type | [声明](../../../dist/esm/structs/context/fragments.d.ts#L45) |
| `CacheContext` | type | [声明](../../../dist/esm/structs/execution/cache.d.ts#L51) |
| `CacheReadOptions` | type | [声明](../../../dist/esm/structs/execution/cache.d.ts#L11) |
| `Candidates` | type | [声明](../../../dist/esm/kits/candidates.d.ts#L35) |
| `CandidateSelectionDefinition` | type | [声明](../../../dist/esm/structs/kits/candidates.d.ts#L16) |
| `CapabilityCatalogOptions` | type | [声明](../../../dist/esm/structs/support/capabilities.d.ts#L31) |
| `CapabilityModule` | type | [声明](../../../dist/esm/structs/support/capabilities.d.ts#L20) |
| `CapabilityToolReferences` | type | [声明](../../../dist/esm/structs/support/capabilities.d.ts#L11) |
| `CatalogDomainTool` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L12) |
| `CatalogExecutionTool` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L29) |
| `CatalogGoal` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L12) |
| `CatalogScope` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L17) |
| `CatalogTask` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L22) |
| `CatalogTool` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L29) |
| `chatCompletionFunctionOptions` | type | [声明](../../../dist/esm/support/model/chat-completions.d.ts#L22) |
| `chatCompletionMessages` | type | [声明](../../../dist/esm/support/model/chat-completions.d.ts#L47) |
| `chatCompletionParts` | type | [声明](../../../dist/esm/support/model/chat-completions.d.ts#L33) |
| `ChatProvider` | type | [声明](../../../dist/esm/structs/model/chat-provider.d.ts#L24) |
| `CheckResult` | type | [声明](../../../dist/esm/structs/common.d.ts#L52) |
| `checkReviewAdmission` | type | [声明](../../../dist/esm/kits/result-review.d.ts#L5) |
| `Command` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L93) |
| `CommandCatalog` | type | [声明](../../../dist/esm/kits/interaction/commands.d.ts#L19) |
| `CommandCatalogOptions` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L115) |
| `CommandDefinition` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L58) |
| `commandSchema` | type | [声明](../../../dist/esm/kits/interaction/command.d.ts#L41) |
| `commonPrefixLength` | type | [声明](../../../dist/esm/utils/text.d.ts#L16) |
| `CompatibleModelConfig` | type | [声明](../../../dist/esm/structs/support/model/provider.d.ts#L74) |
| `CompatibleModelPorts` | type | [声明](../../../dist/esm/structs/support/model/provider.d.ts#L98) |
| `CompatibleModelProvider` | type | [声明](../../../dist/esm/support/model/compatible-provider.d.ts#L11) |
| `CompatibleModelProviderOptions` | type | [声明](../../../dist/esm/structs/support/model/provider.d.ts#L118) |
| `compileCommands` | type | [声明](../../../dist/esm/kits/interaction/command.d.ts#L28) |
| `CompiledReplyFormat` | type | [声明](../../../dist/esm/structs/kits/presentation/formats.d.ts#L31) |
| `CompiledTool` | type | [声明](../../../dist/esm/structs/support/tools.d.ts#L43) |
| `completeMemoryReview` | type | [声明](../../../dist/esm/kits/memory.d.ts#L156) |
| `CompletionCheck` | type | [声明](../../../dist/esm/kits/completion.d.ts#L18) |
| `CompletionDecision` | type | [声明](../../../dist/esm/kits/completion.d.ts#L7) |
| `CompletionReport` | type | [声明](../../../dist/esm/kits/completion.d.ts#L24) |
| `configureBreakWhile` | type | [声明](../../../dist/esm/utils/break-observer.d.ts#L19) |
| `ContentProjection` | type | [声明](../../../dist/esm/structs/kits/projection.d.ts#L11) |
| `ContentProjectionOptions` | type | [声明](../../../dist/esm/structs/kits/projection.d.ts#L18) |
| `ContextAssemblyOptions` | type | [声明](../../../dist/esm/structs/support/context.d.ts#L35) |
| `ContextBuilder` | type | [声明](../../../dist/esm/structs/support/context.d.ts#L49) |
| `ContextBuilderOptions` | type | [声明](../../../dist/esm/structs/support/context.d.ts#L28) |
| `ContextFragment` | type | [声明](../../../dist/esm/structs/context/fragments.d.ts#L17) |
| `ContextFragmentConfig` | type | [声明](../../../dist/esm/structs/support/context.d.ts#L42) |
| `ContextFragmentUsage` | type | [声明](../../../dist/esm/structs/context/fragments.d.ts#L34) |
| `ContextJournal` | type | [声明](../../../dist/esm/context/journal.d.ts#L5) |
| `ContextLifetime` | type | [声明](../../../dist/esm/structs/context/fragments.d.ts#L15) |
| `ContextPlan` | type | [声明](../../../dist/esm/structs/context/processing.d.ts#L13) |
| `ContextProjection` | type | [声明](../../../dist/esm/structs/support/context.d.ts#L15) |
| `ContextRecord` | type | [声明](../../../dist/esm/structs/context/journal.d.ts#L26) |
| `ContextTrust` | type | [声明](../../../dist/esm/structs/context/fragments.d.ts#L13) |
| `CoreDiagnosticRecord` | type | [声明](../../../dist/esm/structs/diagnostics.d.ts#L279) |
| `CoreEvent` | type | [声明](../../../dist/esm/structs/diagnostics.d.ts#L207) |
| `coreEventCatalog` | type | [声明](../../../dist/esm/diagnostics/catalog.d.ts#L7) |
| `CoreEventDescriptor` | type | [声明](../../../dist/esm/structs/diagnostics.d.ts#L145) |
| `CoreEventName` | type | [声明](../../../dist/esm/structs/diagnostics.d.ts#L138) |
| `CoreEventPayloads` | type | [声明](../../../dist/esm/structs/diagnostics.d.ts#L17) |
| `CoreLogOutput` | type | [声明](../../../dist/esm/structs/diagnostics.d.ts#L232) |
| `CoreStep` | type | [声明](../../../dist/esm/structs/execution/engine.d.ts#L35) |
| `createDiagnostics` | type | [声明](../../../dist/esm/diagnostics/index.d.ts#L18) |
| `CreateDiagnosticsOptions` | type | [声明](../../../dist/esm/structs/diagnostics.d.ts#L266) |
| `createDomainToolRegistry` | type | [声明](../../../dist/esm/kits/domains/registry.d.ts#L105) |
| `createGoalRegistry` | type | [声明](../../../dist/esm/kits/domains/registry.d.ts#L105) |
| `createJsonInteraction` | type | [声明](../../../dist/esm/support/model/transports.d.ts#L43) |
| `createJsonTransport` | type | [声明](../../../dist/esm/support/model/transports.d.ts#L43) |
| `createModelInteraction` | type | [声明](../../../dist/esm/support/model/transports.d.ts#L6) |
| `createModelTransport` | type | [声明](../../../dist/esm/support/model/transports.d.ts#L6) |
| `createScopeRegistry` | type | [声明](../../../dist/esm/kits/domains/scopes.d.ts#L165) |
| `createTextInteraction` | type | [声明](../../../dist/esm/support/model/transports.d.ts#L24) |
| `createTextTransport` | type | [声明](../../../dist/esm/support/model/transports.d.ts#L24) |
| `DebugStepsOutput` | type | [声明](../../../dist/esm/structs/debug.d.ts#L169) |
| `DecodedModelResponseToolCall` | type | [声明](../../../dist/esm/support/model/session.d.ts#L7) |
| `DecodedModelToolResponse` | type | [声明](../../../dist/esm/support/model/session.d.ts#L16) |
| `DecodedSessionCall` | type | [声明](../../../dist/esm/support/model/session.d.ts#L7) |
| `DecodedSessionResult` | type | [声明](../../../dist/esm/support/model/session.d.ts#L16) |
| `defineAgentCatalog` | type | [声明](../../../dist/esm/kits/domains/catalog.d.ts#L16) |
| `defineAgentFamily` | type | [声明](../../../dist/esm/kits/family.d.ts#L17) |
| `defineAnswerCheckCatalog` | type | [声明](../../../dist/esm/kits/answering/checks.d.ts#L15) |
| `defineAnswerFlow` | type | [声明](../../../dist/esm/kits/answering/flow.d.ts#L17) |
| `defineAnswerReaderCatalog` | type | [声明](../../../dist/esm/kits/answering/tasks.d.ts#L10) |
| `defineAnswerTaskCatalog` | type | [声明](../../../dist/esm/kits/answering/tasks.d.ts#L30) |
| `defineArtifactCatalog` | type | [声明](../../../dist/esm/kits/artifacts.d.ts#L13) |
| `defineBranchVersioning` | type | [声明](../../../dist/esm/kits/family.d.ts#L17) |
| `defineCandidateSelection` | type | [声明](../../../dist/esm/kits/candidates.d.ts#L24) |
| `defineCommand` | type | [声明](../../../dist/esm/kits/interaction/command.d.ts#L15) |
| `defineCommandCatalog` | type | [声明](../../../dist/esm/kits/interaction/commands.d.ts#L89) |
| `defineCompletionChecks` | type | [声明](../../../dist/esm/kits/completion.d.ts#L36) |
| `defineContentProjection` | type | [声明](../../../dist/esm/kits/projection.d.ts#L15) |
| `defineContextAssembly` | type | [声明](../../../dist/esm/support/context/assembly.d.ts#L15) |
| `defineContextFragments` | type | [声明](../../../dist/esm/support/context/assembly.d.ts#L28) |
| `defineDelivery` | type | [声明](../../../dist/esm/kits/delivery.d.ts#L47)；Use defineDeliveryPipeline. |
| `defineDeliveryPipeline` | type | [声明](../../../dist/esm/kits/delivery.d.ts#L16) |
| `defineDurableTask` | type | [声明](../../../dist/esm/kits/durable.d.ts#L19) |
| `defineEvidenceChecklist` | type | [声明](../../../dist/esm/kits/evidence.d.ts#L14) |
| `defineEvidenceProjection` | type | [声明](../../../dist/esm/kits/evidence.d.ts#L40) |
| `defineInteractionProtocol` | type | [声明](../../../dist/esm/kits/interaction/transfer.d.ts#L65) |
| `defineKnowledgeCatalog` | type | [声明](../../../dist/esm/kits/knowledge/catalog.d.ts#L15) |
| `defineKnowledgePublication` | type | [声明](../../../dist/esm/kits/knowledge/publication.d.ts#L17) |
| `defineNormalization` | type | [声明](../../../dist/esm/kits/normalization.d.ts#L15) |
| `defineOutputCatalog` | type | [声明](../../../dist/esm/kits/presentation/outputs.d.ts#L16) |
| `definePolicySet` | type | [声明](../../../dist/esm/kits/policies.d.ts#L14) |
| `defineQueryAggregation` | type | [声明](../../../dist/esm/kits/aggregation.d.ts#L29) |
| `defineRecoveryChain` | type | [声明](../../../dist/esm/kits/policies.d.ts#L40) |
| `defineReflection` | type | [声明](../../../dist/esm/kits/reflection.d.ts#L16) |
| `defineReflectionLogSource` | type | [声明](../../../dist/esm/kits/reflection-log-source.d.ts#L63) |
| `defineRegistrationCatalog` | type | [声明](../../../dist/esm/support/registration.d.ts#L13) |
| `defineReplyFormats` | type | [声明](../../../dist/esm/kits/presentation/formats.d.ts#L38) |
| `defineResultReview` | type | [声明](../../../dist/esm/kits/result-review.d.ts#L3) |
| `defineRetrieval` | type | [声明](../../../dist/esm/kits/retrieval.d.ts#L18) |
| `defineReviewDecision` | type | [声明](../../../dist/esm/kits/review-decision.d.ts#L3) |
| `defineSemanticSlots` | type | [声明](../../../dist/esm/kits/presentation/templates.d.ts#L37) |
| `defineTextSkillLoader` | type | [声明](../../../dist/esm/kits/text-skills.d.ts#L16) |
| `defineTextTemplate` | type | [声明](../../../dist/esm/kits/presentation/templates.d.ts#L21) |
| `defineTreeProjection` | type | [声明](../../../dist/esm/kits/projection.d.ts#L48) |
| `defineWaitGate` | type | [声明](../../../dist/esm/kits/waiting.d.ts#L6) |
| `defineWorkflow` | type | [声明](../../../dist/esm/execution/workflow.d.ts#L151) |
| `Delivery` | type | [声明](../../../dist/esm/kits/delivery.d.ts#L41)；Use DeliveryPipeline. Same immutable namespace and implementation. |
| `DeliveryOptions` | type | [声明](../../../dist/esm/structs/kits/delivery.d.ts#L41)；Use DeliveryPipelineOptions. |
| `DeliveryPipeline` | type | [声明](../../../dist/esm/kits/delivery.d.ts#L35) |
| `DeliveryPipelineOptions` | type | [声明](../../../dist/esm/structs/kits/delivery.d.ts#L25) |
| `DeliveryPipelineStage` | type | [声明](../../../dist/esm/structs/kits/delivery.d.ts#L13) |
| `DeliveryStage` | type | [声明](../../../dist/esm/structs/kits/delivery.d.ts#L39)；Use DeliveryPipelineStage. |
| `DescribedTool` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L42) |
| `DiagnosticContext` | type | [声明](../../../dist/esm/structs/diagnostics.d.ts#L243) |
| `diagnosticError` | type | [声明](../../../dist/esm/diagnostics/index.d.ts#L27) |
| `DiagnosticIdentity` | type | [声明](../../../dist/esm/structs/diagnostics.d.ts#L150) |
| `DiagnosticSpanFields` | type | [声明](../../../dist/esm/structs/diagnostics.d.ts#L199) |
| `DomainTool` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L15) |
| `domainToolDelegates` | type | [声明](../../../dist/esm/kits/domains/catalog.d.ts#L78) |
| `DomainToolDescription` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L71) |
| `DomainToolId` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L75) |
| `DomainToolPolicy` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L44) |
| `DomainToolRegistration` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L42) |
| `DomainToolRegistry` | type | [声明](../../../dist/esm/kits/domains/registry.d.ts#L9) |
| `Durable` | type | [声明](../../../dist/esm/kits/durable.d.ts#L22) |
| `DurableAuthorizationContext` | type | [声明](../../../dist/esm/structs/kits/durable.d.ts#L97) |
| `DurableCheckpoint` | type | [声明](../../../dist/esm/structs/kits/durable.d.ts#L24) |
| `DurableReconcileContext` | type | [声明](../../../dist/esm/structs/kits/durable.d.ts#L93) |
| `DurableReconciliation` | type | [声明](../../../dist/esm/structs/kits/durable.d.ts#L72) |
| `durableReplayPolicies` | type | [声明](../../../dist/esm/structs/kits/durable.d.ts#L22) |
| `durableStatuses` | type | [声明](../../../dist/esm/structs/kits/durable.d.ts#L15) |
| `DurableStep` | type | [声明](../../../dist/esm/structs/kits/durable.d.ts#L61) |
| `DurableStepContext` | type | [声明](../../../dist/esm/structs/kits/durable.d.ts#L82) |
| `DurableStore` | type | [声明](../../../dist/esm/structs/kits/durable.d.ts#L52) |
| `DurableTask` | type | [声明](../../../dist/esm/structs/kits/durable.d.ts#L120) |
| `DurableTaskDefinition` | type | [声明](../../../dist/esm/structs/kits/durable.d.ts#L101) |
| `DurableTaskOptions` | type | [声明](../../../dist/esm/structs/kits/durable.d.ts#L113) |
| `DurationMs` | type | [声明](../../../dist/esm/structs/common.d.ts#L17) |
| `encodeSseEvent` | type | [声明](../../../dist/esm/support/transport/sse.d.ts#L25) |
| `EngineCacheOptions` | type | [声明](../../../dist/esm/structs/execution/cache.d.ts#L6) |
| `ErasedTool` | type | [声明](../../../dist/esm/structs/capabilities/tools.d.ts#L54) |
| `ErrorContext` | type | [声明](../../../dist/esm/structs/errors.d.ts#L61) |
| `Evidence` | type | [声明](../../../dist/esm/kits/evidence.d.ts#L48) |
| `EvidenceProjectionDefinition` | type | [声明](../../../dist/esm/structs/kits/evidence.d.ts#L36) |
| `EvidenceProjectionProvider` | type | [声明](../../../dist/esm/structs/kits/evidence.d.ts#L29) |
| `EvidenceProvider` | type | [声明](../../../dist/esm/structs/kits/evidence.d.ts#L21) |
| `EvidenceRequirement` | type | [声明](../../../dist/esm/structs/kits/evidence.d.ts#L12) |
| `ExecutableTool` | type | [声明](../../../dist/esm/structs/capabilities/tools.d.ts#L18) |
| `executeInvocation` | type | [声明](../../../dist/esm/capabilities/invocation.d.ts#L17) |
| `ExecutionContext` | type | [声明](../../../dist/esm/structs/common.d.ts#L95) |
| `ExecutionEventDescriptor` | type | [声明](../../../dist/esm/structs/execution/events.d.ts#L14) |
| `ExecutionObserver` | type | [声明](../../../dist/esm/structs/execution/events.d.ts#L17) |
| `ExecutionOptions` | type | [声明](../../../dist/esm/structs/common.d.ts#L86) |
| `Family` | type | [声明](../../../dist/esm/kits/family.d.ts#L19) |
| `FamilyDefinition` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L56) |
| `FamilyOperation` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L17) |
| `familyOperations` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L15) |
| `FamilyRecord` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L36) |
| `FamilyStore` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L49) |
| `FamilyVersion` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L19) |
| `FunctionCallDelta` | type | [声明](../../../dist/esm/structs/model/messages.d.ts#L114) |
| `FusedRank` | type | [声明](../../../dist/esm/kits/rank-fusion.d.ts#L11) |
| `getErrorInfo` | type | [声明](../../../dist/esm/errors.d.ts#L25) |
| `goalDelegates` | type | [声明](../../../dist/esm/kits/domains/catalog.d.ts#L78) |
| `GoalDescription` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L71) |
| `GoalId` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L75) |
| `GoalPolicy` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L44) |
| `GoalRegistry` | type | [声明](../../../dist/esm/kits/domains/registry.d.ts#L9) |
| `GoalTool` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L15) |
| `GoalToolRegistration` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L42) |
| `Id` | type | [声明](../../../dist/esm/structs/common.d.ts#L13) |
| `inspectReviewChoices` | type | [声明](../../../dist/esm/kits/review-choice.d.ts#L7) |
| `IntentOptions` | type | [声明](../../../dist/esm/structs/capabilities/model.d.ts#L20) |
| `Interaction` | type | [声明](../../../dist/esm/kits/interaction/transfer.d.ts#L11) |
| `INTERACTION_CATEGORIES` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L28) |
| `InteractionCategory` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L26) |
| `InteractionDescriptor` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L30) |
| `InteractionHandlers` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L41) |
| `InteractionProtocol` | type | [声明](../../../dist/esm/kits/interaction/transfer.d.ts#L11) |
| `InteractionProtocolDefinition` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L128) |
| `InvocationHandler` | type | [声明](../../../dist/esm/structs/capabilities/invocation.d.ts#L38) |
| `InvocationMetadata` | type | [声明](../../../dist/esm/structs/invocation.d.ts#L13) |
| `InvocationResult` | type | [声明](../../../dist/esm/structs/invocation.d.ts#L30) |
| `InvocationStatus` | type | [声明](../../../dist/esm/structs/common.d.ts#L23) |
| `isMemoryState` | type | [声明](../../../dist/esm/kits/memory.d.ts#L59) |
| `isReviewChoice` | type | [声明](../../../dist/esm/kits/review-choice.d.ts#L5) |
| `isReviewChoiceAnswer` | type | [声明](../../../dist/esm/kits/review-choice.d.ts#L3) |
| `Issue` | type | [声明](../../../dist/esm/structs/common.d.ts#L36) |
| `JsonFrameLimits` | type | [声明](../../../dist/esm/structs/support/transport/json.d.ts#L12) |
| `jsonObjectInteraction` | type | [声明](../../../dist/esm/model/interactions/json-object.d.ts#L9) |
| `JsonSchema` | type | [声明](../../../dist/esm/structs/common.d.ts#L25) |
| `JsonSchemaOptions` | type | [声明](../../../dist/esm/structs/support/schema.d.ts#L18) |
| `JsonSchemaValidator` | type | [声明](../../../dist/esm/structs/support/schema.d.ts#L11) |
| `JsonTransportPart` | type | [声明](../../../dist/esm/structs/support/transport/json.d.ts#L21) |
| `Knowledge` | type | [声明](../../../dist/esm/kits/knowledge/index.d.ts#L18) |
| `KnowledgeCandidate` | type | [声明](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L26) |
| `KnowledgeCatalog` | type | [声明](../../../dist/esm/structs/kits/knowledge.d.ts#L67) |
| `KnowledgeCatalogOptions` | type | [声明](../../../dist/esm/structs/kits/knowledge.d.ts#L60) |
| `KnowledgeDocument` | type | [声明](../../../dist/esm/structs/kits/knowledge.d.ts#L22) |
| `KnowledgePart` | type | [声明](../../../dist/esm/structs/kits/knowledge.d.ts#L20) |
| `KnowledgePublication` | type | [声明](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L76) |
| `knowledgePublicationOperations` | type | [声明](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L15) |
| `KnowledgePublicationOptions` | type | [声明](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L58) |
| `KnowledgePublicationRecord` | type | [声明](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L40) |
| `KnowledgePublicationStore` | type | [声明](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L51) |
| `KnowledgeRead` | type | [声明](../../../dist/esm/structs/kits/knowledge.d.ts#L44) |
| `KnowledgeSection` | type | [声明](../../../dist/esm/structs/kits/knowledge.d.ts#L13) |
| `KnowledgeSnapshot` | type | [声明](../../../dist/esm/structs/kits/knowledge.d.ts#L50) |
| `KnowledgeSourceReference` | type | [声明](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L17) |
| `LegacyAgentCatalogPorts` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L51) |
| `LifecycleContext` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L2) |
| `LifecycleHooks` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L72) |
| `LifecycleProtocol` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L59) |
| `LifecycleRun` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L36) |
| `LifecycleTool` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L131) |
| `LifecycleToolBase` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L112) |
| `LifecycleToolRegistration` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L133) |
| `LoopEvent` | type | [声明](../../../dist/esm/structs/execution/engine.d.ts#L13) |
| `matchRule` | type | [声明](../../../dist/esm/utils/rules.d.ts#L26) |
| `MatchRule` | type | [声明](../../../dist/esm/structs/utils/rules.d.ts#L12) |
| `MaybePromise` | type | [声明](../../../dist/esm/structs/common.d.ts#L27) |
| `memoryContext` | type | [声明](../../../dist/esm/kits/memory.d.ts#L135) |
| `MemoryEntry` | type | [声明](../../../dist/esm/kits/memory.d.ts#L24) |
| `memoryModelView` | type | [声明](../../../dist/esm/kits/memory.d.ts#L158) |
| `MemoryOperation` | type | [声明](../../../dist/esm/kits/memory.d.ts#L11) |
| `memoryReviewBatch` | type | [声明](../../../dist/esm/kits/memory.d.ts#L154) |
| `MemorySource` | type | [声明](../../../dist/esm/kits/memory.d.ts#L1) |
| `MemoryState` | type | [声明](../../../dist/esm/kits/memory.d.ts#L47) |
| `memoryUpdateInstruction` | type | [声明](../../../dist/esm/kits/memory.d.ts#L147) |
| `memoryUpdateSchema` | type | [声明](../../../dist/esm/kits/memory.d.ts#L61) |
| `mergeByKey` | type | [声明](../../../dist/esm/kits/aggregation.d.ts#L14) |
| `mergeReplyBubbles` | type | [声明](../../../dist/esm/kits/presentation/formats.d.ts#L29) |
| `ModelAssistantToolMessage` | type | [声明](../../../dist/esm/structs/model/messages.d.ts#L80) |
| `ModelBinding` | type | [声明](../../../dist/esm/kits/inference.d.ts#L15) |
| `ModelCallRecord` | type | [声明](../../../dist/esm/structs/invocation.d.ts#L35) |
| `ModelCallRequest` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L199) |
| `ModelCalls` | type | [声明](../../../dist/esm/kits/inference.d.ts#L61) |
| `ModelCallTrace` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L74) |
| `ModelCapabilities` | type | [声明](../../../dist/esm/structs/model/messages.d.ts#L45) |
| `ModelChildOptions` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L137) |
| `ModelChildPolicy` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L58) |
| `ModelChoiceIndex` | type | [声明](../../../dist/esm/structs/support/model/provider.d.ts#L113) |
| `ModelContentPart` | type | [声明](../../../dist/esm/structs/model/messages.d.ts#L28) |
| `ModelContinuation` | type | [声明](../../../dist/esm/structs/model/messages.d.ts#L37) |
| `ModelDuplex` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L51) |
| `ModelFunction` | type | [声明](../../../dist/esm/structs/model/messages.d.ts#L103) |
| `ModelImage` | type | [声明](../../../dist/esm/structs/model/messages.d.ts#L11) |
| `ModelInputMeasurement` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L231) |
| `ModelInteractionAdapter` | type | [声明](../../../dist/esm/structs/model/interactions.d.ts#L52) |
| `modelInteractionCatalog` | type | [声明](../../../dist/esm/support/model/interactions/index.d.ts#L6) |
| `ModelInteractionDefinition` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L67) |
| `ModelInteractionOptions` | type | [声明](../../../dist/esm/structs/model/messages.d.ts#L157) |
| `ModelInteractionRegistration` | type | [声明](../../../dist/esm/structs/model/interactions.d.ts#L67) |
| `ModelInvocationContext` | type | [声明](../../../dist/esm/kits/inference.d.ts#L28) |
| `ModelInvocationRequest` | type | [声明](../../../dist/esm/kits/inference.d.ts#L37) |
| `ModelLifecycleContext` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L2) |
| `ModelLifecycleRun` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L36) |
| `ModelMessage` | type | [声明](../../../dist/esm/structs/model/messages.d.ts#L66) |
| `ModelOperationAction` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L7) |
| `ModelOperationHandle` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L10) |
| `ModelOperationPorts` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L43) |
| `ModelOperationProvider` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L32) |
| `ModelOperationRequest` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L19) |
| `ModelOperationResult` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L25) |
| `ModelOperationStatus` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L8) |
| `ModelOptions` | type | [声明](../../../dist/esm/structs/model/messages.d.ts#L128) |
| `ModelOutputEvent` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L116) |
| `ModelPart` | type | [声明](../../../dist/esm/structs/model/messages.d.ts#L126) |
| `ModelPrepareRequest` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L287) |
| `modelProtocolError` | type | [声明](../../../dist/esm/utils/model-protocol.d.ts#L9) |
| `ModelProvider` | type | [声明](../../../dist/esm/structs/model/chat-provider.d.ts#L41) |
| `ModelProviderContext` | type | [声明](../../../dist/esm/structs/model/chat-provider.d.ts#L14) |
| `ModelProviderErrorCode` | type | [声明](../../../dist/esm/structs/support/model/provider.d.ts#L15) |
| `ModelProviderFailure` | type | [声明](../../../dist/esm/structs/support/model/provider.d.ts#L37) |
| `ModelRealtimeEvent` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L60) |
| `ModelRealtimeProvider` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L56) |
| `ModelResponseCollector` | type | [声明](../../../dist/esm/structs/model/interactions.d.ts#L14) |
| `ModelResponseToolCall` | type | [声明](../../../dist/esm/structs/model/session.d.ts#L11) |
| `ModelResult` | type | [声明](../../../dist/esm/structs/invocation.d.ts#L55) |
| `ModelRunner` | type | [声明](../../../dist/esm/model/runner.d.ts#L16) |
| `ModelRunnerBudgetSnapshot` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L298) |
| `modelRunnerDefaults` | type | [声明](../../../dist/esm/model/defaults.d.ts#L8) |
| `ModelRunnerOptions` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L179) |
| `ModelRunnerPorts` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L120) |
| `ModelRunnerProvider` | type | [声明](../../../dist/esm/structs/model/chat-provider.d.ts#L41) |
| `ModelRunnerSettings` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L157) |
| `ModelRuntimeConfig` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L45) |
| `ModelSelection` | type | [声明](../../../dist/esm/structs/capabilities/model.d.ts#L58) |
| `ModelSessionCall` | type | [声明](../../../dist/esm/structs/model/session.d.ts#L11) |
| `ModelSessionResult` | type | [声明](../../../dist/esm/structs/model/session.d.ts#L24) |
| `ModelStageInteractionRegistration` | type | [声明](../../../dist/esm/structs/support/model/interactions.d.ts#L15) |
| `ModelStageTransportRegistration` | type | [声明](../../../dist/esm/structs/support/model/interactions.d.ts#L15) |
| `ModelStreamEvent` | type | [声明](../../../dist/esm/structs/model/messages.d.ts#L52) |
| `ModelTokenBudget` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L29) |
| `ModelTool` | type | [声明](../../../dist/esm/structs/capabilities/model.d.ts#L31) |
| `ModelToolCall` | type | [声明](../../../dist/esm/structs/model/messages.d.ts#L18) |
| `ModelToolCatalog` | type | [声明](../../../dist/esm/structs/capabilities/model.d.ts#L88) |
| `ModelToolInteractionOptions` | type | [声明](../../../dist/esm/support/model/session.d.ts#L27) |
| `ModelToolInteractionRegistration` | type | [声明](../../../dist/esm/support/model/session.d.ts#L33) |
| `ModelToolRegistration` | type | [声明](../../../dist/esm/structs/capabilities/model.d.ts#L52) |
| `ModelToolRegistry` | type | [声明](../../../dist/esm/capabilities/model.d.ts#L4) |
| `ModelToolResponse` | type | [声明](../../../dist/esm/structs/model/session.d.ts#L24) |
| `ModelToolResultMessage` | type | [声明](../../../dist/esm/structs/model/messages.d.ts#L87) |
| `ModelToolSelection` | type | [声明](../../../dist/esm/structs/capabilities/model.d.ts#L71) |
| `ModelToolSource` | type | [声明](../../../dist/esm/structs/capabilities/model.d.ts#L80) |
| `ModelTransportDefinition` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L67) |
| `ModelTransportRegistration` | type | [声明](../../../dist/esm/structs/model/interactions.d.ts#L67) |
| `ModelUsage` | type | [声明](../../../dist/esm/structs/model/messages.d.ts#L94) |
| `NativeFunctionCall` | type | [声明](../../../dist/esm/structs/model/interactions.d.ts#L80) |
| `nativeFunctionInteraction` | type | [声明](../../../dist/esm/model/interactions/native-functions.d.ts#L8) |
| `NodeAgentCache` | type | [声明](../../../dist/esm/structs/execution/cache.d.ts#L43) |
| `NodeCache` | type | [声明](../../../dist/esm/structs/execution/cache.d.ts#L15) |
| `NodeReportingContext` | type | [声明](../../../dist/esm/structs/debug.d.ts#L140) |
| `Normalization` | type | [声明](../../../dist/esm/kits/normalization.d.ts#L37) |
| `NormalizationOptions` | type | [声明](../../../dist/esm/structs/kits/normalization.d.ts#L20) |
| `NormalizationStep` | type | [声明](../../../dist/esm/structs/kits/normalization.d.ts#L11) |
| `normalizeDiagnosticEvent` | type | [声明](../../../dist/esm/diagnostics/index.d.ts#L41) |
| `Observer` | type | [声明](../../../dist/esm/structs/common.d.ts#L19) |
| `openModelRealtime` | type | [声明](../../../dist/esm/model/realtime.d.ts#L14) |
| `OperationAction` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L7) |
| `OperationContext` | type | [声明](../../../dist/esm/structs/common.d.ts#L109) |
| `OperationStatus` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L8) |
| `OutputCatalogOptions` | type | [声明](../../../dist/esm/structs/kits/presentation/outputs.d.ts#L77) |
| `OutputComposeInput` | type | [声明](../../../dist/esm/structs/kits/presentation/outputs.d.ts#L60) |
| `OutputDefinition` | type | [声明](../../../dist/esm/structs/kits/presentation/outputs.d.ts#L33) |
| `OutputField` | type | [声明](../../../dist/esm/structs/kits/presentation/outputs.d.ts#L13) |
| `OutputIssue` | type | [声明](../../../dist/esm/structs/kits/presentation/outputs.d.ts#L56) |
| `OutputProvider` | type | [声明](../../../dist/esm/structs/kits/presentation/outputs.d.ts#L48) |
| `OutputResult` | type | [声明](../../../dist/esm/structs/kits/presentation/outputs.d.ts#L71) |
| `parseJsonFrames` | type | [声明](../../../dist/esm/support/transport/json.d.ts#L32) |
| `parseKnowledgeDocument` | type | [声明](../../../dist/esm/kits/knowledge/sections.d.ts#L18) |
| `Policies` | type | [声明](../../../dist/esm/kits/policies.d.ts#L72) |
| `Policy` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L211)；Use ToolLifecyclePolicy. |
| `PolicyAssessment` | type | [声明](../../../dist/esm/structs/kits/policies.d.ts#L22) |
| `PolicyDefinition` | type | [声明](../../../dist/esm/structs/kits/policies.d.ts#L11) |
| `PreparedModelCall` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L264) |
| `PreparedModelInteraction` | type | [声明](../../../dist/esm/structs/model/interactions.d.ts#L45) |
| `PreparedModelSelection` | type | [声明](../../../dist/esm/structs/model/interactions.d.ts#L32) |
| `PreparedModelToolInteraction` | type | [声明](../../../dist/esm/support/model/session.d.ts#L20) |
| `PreparedModelTransport` | type | [声明](../../../dist/esm/structs/model/interactions.d.ts#L45) |
| `PreparedSessionTransport` | type | [声明](../../../dist/esm/support/model/session.d.ts#L20) |
| `prepareModelToolInteraction` | type | [声明](../../../dist/esm/support/model/session.d.ts#L52) |
| `prepareSessionFunctions` | type | [声明](../../../dist/esm/support/model/session.d.ts#L52) |
| `Presentation` | type | [声明](../../../dist/esm/kits/presentation/index.d.ts#L25) |
| `projectContinuousExcerpt` | type | [声明](../../../dist/esm/kits/projection.d.ts#L34) |
| `Projection` | type | [声明](../../../dist/esm/kits/projection.d.ts#L53) |
| `ProtocolCheck` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L47) |
| `ProtocolField` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L15) |
| `ProtocolPredicate` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L45) |
| `ProtocolReason` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L43) |
| `ProtocolRegistry` | type | [声明](../../../dist/esm/utils/protocol-registry.d.ts#L16) |
| `ProtocolShape` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L138) |
| `ProviderErrorCapture` | type | [声明](../../../dist/esm/structs/support/model/provider-observer.d.ts#L63) |
| `ProviderEventDescriptor` | type | [声明](../../../dist/esm/structs/support/model/provider-observer.d.ts#L44) |
| `ProviderEventName` | type | [声明](../../../dist/esm/structs/support/model/provider-observer.d.ts#L42) |
| `ProviderEventPayloads` | type | [声明](../../../dist/esm/structs/support/model/provider-observer.d.ts#L13) |
| `ProviderObservation` | type | [声明](../../../dist/esm/structs/support/model/provider-observer.d.ts#L49) |
| `ProviderObserver` | type | [声明](../../../dist/esm/structs/support/model/provider-observer.d.ts#L56) |
| `ProviderReasoningLevel` | type | [声明](../../../dist/esm/structs/support/model/provider.d.ts#L45) |
| `ProviderReasoningStrategy` | type | [声明](../../../dist/esm/structs/support/model/provider.d.ts#L52) |
| `publishReplyEvents` | type | [声明](../../../dist/esm/kits/presentation/events.d.ts#L40) |
| `QueryAggregationOptions` | type | [声明](../../../dist/esm/structs/kits/aggregation.d.ts#L10) |
| `RankedList` | type | [声明](../../../dist/esm/kits/rank-fusion.d.ts#L2) |
| `ReadonlyCatalog` | type | [声明](../../../dist/esm/structs/common.d.ts#L60) |
| `readSse` | type | [声明](../../../dist/esm/types.d.ts#L20) |
| `RealtimeSessionOptions` | type | [声明](../../../dist/esm/model/realtime.d.ts#L4) |
| `reciprocalRankFusion` | type | [声明](../../../dist/esm/kits/rank-fusion.d.ts#L36) |
| `RecordedSubStep` | type | [声明](../../../dist/esm/structs/debug.d.ts#L94) |
| `RecoveryDefinition` | type | [声明](../../../dist/esm/structs/kits/policies.d.ts#L40) |
| `RecoveryResult` | type | [声明](../../../dist/esm/structs/kits/policies.d.ts#L31) |
| `Reflection` | type | [声明](../../../dist/esm/kits/reflection.d.ts#L18) |
| `ReflectionDefinition` | type | [声明](../../../dist/esm/structs/kits/reflection.d.ts#L108) |
| `ReflectionEvidence` | type | [声明](../../../dist/esm/structs/kits/reflection.d.ts#L20) |
| `ReflectionFinding` | type | [声明](../../../dist/esm/structs/kits/reflection.d.ts#L80) |
| `reflectionFindingKinds` | type | [声明](../../../dist/esm/structs/kits/reflection.d.ts#L78) |
| `reflectionIdentityFields` | type | [声明](../../../dist/esm/structs/kits/reflection.d.ts#L18) |
| `ReflectionLogReader` | type | [声明](../../../dist/esm/kits/reflection-log-source.d.ts#L20) |
| `ReflectionPage` | type | [声明](../../../dist/esm/structs/kits/reflection.d.ts#L54) |
| `ReflectionQuery` | type | [声明](../../../dist/esm/structs/kits/reflection.d.ts#L43) |
| `ReflectionReport` | type | [声明](../../../dist/esm/structs/kits/reflection.d.ts#L89) |
| `ReflectionSource` | type | [声明](../../../dist/esm/structs/kits/reflection.d.ts#L69) |
| `ReflectionTask` | type | [声明](../../../dist/esm/structs/kits/reflection.d.ts#L131) |
| `RegisteredDomainTool` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L82) |
| `RegisteredGoal` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L82) |
| `RegisteredInteractionOutput` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L173) |
| `RegisteredLifecycleTool` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L142) |
| `RegisteredModelTool` | type | [声明](../../../dist/esm/structs/capabilities/model.d.ts#L56) |
| `RegisteredProtocol` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L149) |
| `RegisteredScope` | type | [声明](../../../dist/esm/structs/kits/domains/scopes.d.ts#L79) |
| `RegisteredScopeEvidence` | type | [声明](../../../dist/esm/structs/kits/domains/scopes.d.ts#L67) |
| `RegisteredTool` | type | [声明](../../../dist/esm/structs/capabilities/tools.d.ts#L65) |
| `RegisteredToolDefinition` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L142) |
| `RegisteredTransportOutput` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L173) |
| `RegistrationDefinition` | type | [声明](../../../dist/esm/structs/support/registration.d.ts#L11) |
| `Registry` | type | [声明](../../../dist/esm/structs/common.d.ts#L76) |
| `REPLY_BUBBLE_BOUNDARY` | type | [声明](../../../dist/esm/kits/presentation/events.d.ts#L19) |
| `ReplyBubbleInput` | type | [声明](../../../dist/esm/structs/kits/presentation/events.d.ts#L32) |
| `replyBubbleTexts` | type | [声明](../../../dist/esm/kits/presentation/events.d.ts#L26) |
| `ReplyDeliveryOptions` | type | [声明](../../../dist/esm/structs/kits/presentation/events.d.ts#L39) |
| `ReplyFormatCheck` | type | [声明](../../../dist/esm/structs/kits/presentation/formats.d.ts#L11) |
| `replyFormatChecks` | type | [声明](../../../dist/esm/kits/presentation/formats.d.ts#L5) |
| `ReplyFormatDefinition` | type | [声明](../../../dist/esm/structs/kits/presentation/formats.d.ts#L20) |
| `ReplyFormatOptions` | type | [声明](../../../dist/esm/structs/kits/presentation/formats.d.ts#L39) |
| `ReplyGuidance` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L195) |
| `ReportedStep` | type | [声明](../../../dist/esm/structs/debug.d.ts#L57) |
| `ReportedStepInput` | type | [声明](../../../dist/esm/structs/debug.d.ts#L111) |
| `ReportedStepLog` | type | [声明](../../../dist/esm/structs/debug.d.ts#L130) |
| `ReportedStepProgress` | type | [声明](../../../dist/esm/structs/debug.d.ts#L148) |
| `ReportedStepRecord` | type | [声明](../../../dist/esm/structs/debug.d.ts#L94) |
| `ReportedStepRecorder` | type | [声明](../../../dist/esm/diagnostics/sub-flow.d.ts#L45) |
| `ReportedStepStatus` | type | [声明](../../../dist/esm/structs/debug.d.ts#L55) |
| `reportedStepStatusCatalog` | type | [声明](../../../dist/esm/structs/debug.d.ts#L19) |
| `reportedStepStatuses` | type | [声明](../../../dist/esm/structs/debug.d.ts#L53) |
| `ReportedStepUpdate` | type | [声明](../../../dist/esm/structs/debug.d.ts#L119) |
| `ReportedStepValue` | type | [声明](../../../dist/esm/structs/debug.d.ts#L90) |
| `requireWorkflowValue` | type | [声明](../../../dist/esm/execution/state.d.ts#L22) |
| `resolvePreference` | type | [声明](../../../dist/esm/kits/presentation/variants.d.ts#L34) |
| `ResultReview` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L98) |
| `ResultReviewAdmissionRequest` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L105) |
| `ResultReviewCandidate` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L30) |
| `ResultReviewCoverage` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L45) |
| `ResultReviewDefinition` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L93) |
| `ResultReviewDetector` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L59) |
| `ResultReviewFinding` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L35) |
| `ResultReviewInput` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L12) |
| `ResultReviewRequest` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L24) |
| `ResultReviewResolution` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L74) |
| `ResultReviewResult` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L53) |
| `ResultReviewScope` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L4) |
| `ResultReviewStrategy` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L82) |
| `Retrieval` | type | [声明](../../../dist/esm/kits/retrieval.d.ts#L23) |
| `RetrievalDefinition` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L96) |
| `RetrievalEffect` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L49) |
| `RetrievalPorts` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L56) |
| `retrievalQueryKey` | type | [声明](../../../dist/esm/utils/query-key.d.ts#L12) |
| `RetrievalReason` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L47) |
| `RetrievalReceipt` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L30) |
| `RetrievalResult` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L17) |
| `RetrievalRunner` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L87) |
| `RetrievalSource` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L13) |
| `RetrievalState` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L21) |
| `ReviewChoice` | type | [声明](../../../dist/esm/structs/kits/review-choice.d.ts#L21) |
| `ReviewChoiceAnswer` | type | [声明](../../../dist/esm/structs/kits/review-choice.d.ts#L16) |
| `ReviewChoiceDecision` | type | [声明](../../../dist/esm/structs/kits/review-choice.d.ts#L53) |
| `ReviewChoiceHost` | type | [声明](../../../dist/esm/structs/kits/review-choice.d.ts#L46) |
| `ReviewChoiceInput` | type | [声明](../../../dist/esm/structs/kits/review-choice.d.ts#L10) |
| `ReviewChoiceInspection` | type | [声明](../../../dist/esm/structs/kits/review-choice.d.ts#L34) |
| `ReviewDecision` | type | [声明](../../../dist/esm/structs/kits/review-decision.d.ts#L47) |
| `ReviewDecisionBinding` | type | [声明](../../../dist/esm/structs/kits/review-decision.d.ts#L5) |
| `ReviewDecisionDefinition` | type | [声明](../../../dist/esm/structs/kits/review-decision.d.ts#L26) |
| `ReviewDecisionState` | type | [声明](../../../dist/esm/structs/kits/review-decision.d.ts#L16) |
| `reviewMemorySources` | type | [声明](../../../dist/esm/kits/memory.d.ts#L133) |
| `route` | type | [声明](../../../dist/esm/execution/state.d.ts#L195) |
| `runModelOperation` | type | [声明](../../../dist/esm/model/operations.d.ts#L4) |
| `RuntimeNodeReportingContext` | type | [声明](../../../dist/esm/structs/debug.d.ts#L190) |
| `scanJsonObjectFrames` | type | [声明](../../../dist/esm/support/transport/json.d.ts#L18) |
| `SchemaAdapter` | type | [声明](../../../dist/esm/structs/common.d.ts#L29) |
| `ScopeDefinition` | type | [声明](../../../dist/esm/structs/kits/domains/scopes.d.ts#L15) |
| `ScopeDescription` | type | [声明](../../../dist/esm/structs/kits/domains/scopes.d.ts#L83) |
| `ScopedReportedStepInput` | type | [声明](../../../dist/esm/structs/debug.d.ts#L117) |
| `ScopedReportedStepRecorder` | type | [声明](../../../dist/esm/diagnostics/sub-flow.d.ts#L55) |
| `ScopedSubFlowLogger` | type | [声明](../../../dist/esm/diagnostics/sub-flow.d.ts#L55) |
| `ScopedSubFlowStepInput` | type | [声明](../../../dist/esm/structs/debug.d.ts#L117) |
| `ScopeRegistry` | type | [声明](../../../dist/esm/kits/domains/scopes.d.ts#L17) |
| `ScopeRegistryPolicy` | type | [声明](../../../dist/esm/structs/kits/domains/scopes.d.ts#L40) |
| `SearchHit` | type | [声明](../../../dist/esm/structs/common.d.ts#L118) |
| `SectionSelection` | type | [声明](../../../dist/esm/structs/kits/knowledge.d.ts#L33) |
| `SelectedTools` | type | [声明](../../../dist/esm/structs/support/tools.d.ts#L37) |
| `selectVariant` | type | [声明](../../../dist/esm/kits/presentation/variants.d.ts#L20) |
| `SemanticSlotDefinition` | type | [声明](../../../dist/esm/structs/kits/presentation/templates.d.ts#L19) |
| `serializeOutputEvents` | type | [声明](../../../dist/esm/kits/presentation/events.d.ts#L53) |
| `SessionFunctionOptions` | type | [声明](../../../dist/esm/support/model/session.d.ts#L27) |
| `SessionModelTransportRegistration` | type | [声明](../../../dist/esm/support/model/session.d.ts#L33) |
| `splitTextBlocks` | type | [声明](../../../dist/esm/kits/text-blocks.d.ts#L19) |
| `SseEvent` | type | [声明](../../../dist/esm/types.d.ts#L10) |
| `SseIdleTimeoutError` | type | [声明](../../../dist/esm/types.d.ts#L20) |
| `SseOutputEvent` | type | [声明](../../../dist/esm/structs/support/transport/sse.d.ts#L19) |
| `SseReadOptions` | type | [声明](../../../dist/esm/types.d.ts#L10) |
| `SseWriter` | type | [声明](../../../dist/esm/structs/support/transport/sse.d.ts#L12) |
| `StepOutcome` | type | [声明](../../../dist/esm/structs/execution/engine.d.ts#L26) |
| `SubFlowLog` | type | [声明](../../../dist/esm/structs/debug.d.ts#L130) |
| `SubFlowLogger` | type | [声明](../../../dist/esm/diagnostics/sub-flow.d.ts#L45) |
| `SubFlowStepFix` | type | [声明](../../../dist/esm/structs/debug.d.ts#L119) |
| `SubFlowStepInput` | type | [声明](../../../dist/esm/structs/debug.d.ts#L111) |
| `SubFlowValue` | type | [声明](../../../dist/esm/structs/debug.d.ts#L90) |
| `SubStepProgress` | type | [声明](../../../dist/esm/structs/debug.d.ts#L148) |
| `Support` | type | [声明](../../../dist/esm/support/index.d.ts#L10) |
| `TextBlock` | type | [声明](../../../dist/esm/structs/kits/text-blocks.d.ts#L11) |
| `TextBlockOptions` | type | [声明](../../../dist/esm/structs/kits/text-blocks.d.ts#L22) |
| `TextBlocks` | type | [声明](../../../dist/esm/kits/text-blocks.d.ts#L21) |
| `textOutputEvents` | type | [声明](../../../dist/esm/kits/presentation/events.d.ts#L60) |
| `TextSearch` | type | [声明](../../../dist/esm/kits/search.d.ts#L8) |
| `TextSearchHit` | type | [声明](../../../dist/esm/structs/kits/search.d.ts#L29) |
| `TextSearchOptions` | type | [声明](../../../dist/esm/structs/kits/search.d.ts#L12) |
| `TextSearchQuery` | type | [声明](../../../dist/esm/structs/kits/search.d.ts#L36) |
| `TextSearchSnapshot` | type | [声明](../../../dist/esm/structs/kits/search.d.ts#L47) |
| `TextSkill` | type | [声明](../../../dist/esm/structs/kits/text-skills.d.ts#L24) |
| `TextSkillHeader` | type | [声明](../../../dist/esm/structs/kits/text-skills.d.ts#L31) |
| `TextSkillLoader` | type | [声明](../../../dist/esm/structs/kits/text-skills.d.ts#L61) |
| `TextSkillLoaderDefinition` | type | [声明](../../../dist/esm/structs/kits/text-skills.d.ts#L36) |
| `TextSkillReadPorts` | type | [声明](../../../dist/esm/structs/kits/text-skills.d.ts#L56) |
| `TextSkillRegistration` | type | [声明](../../../dist/esm/structs/kits/text-skills.d.ts#L13) |
| `TextSkills` | type | [声明](../../../dist/esm/kits/text-skills.d.ts#L19) |
| `TextTemplateOptions` | type | [声明](../../../dist/esm/structs/kits/presentation/templates.d.ts#L10) |
| `TimestampMs` | type | [声明](../../../dist/esm/structs/common.d.ts#L15) |
| `Tool` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L219)；Use LifecycleTool and domainToolIds. |
| `ToolCallRecord` | type | [声明](../../../dist/esm/structs/invocation.d.ts#L48) |
| `ToolCatalog` | type | [声明](../../../dist/esm/structs/support/tools.d.ts#L66) |
| `ToolCatalogEntry` | type | [声明](../../../dist/esm/structs/support/tools.d.ts#L64) |
| `ToolCondition` | type | [声明](../../../dist/esm/structs/capabilities/model.d.ts#L29) |
| `ToolContext` | type | [声明](../../../dist/esm/structs/capabilities/model.d.ts#L18) |
| `ToolDefinition` | type | [声明](../../../dist/esm/structs/capabilities/tools.d.ts#L39) |
| `ToolDomainMembership` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L123) |
| `ToolExecutionContext` | type | [声明](../../../dist/esm/structs/capabilities/tools.d.ts#L41) |
| `ToolExecutionEvent` | type | [声明](../../../dist/esm/structs/capabilities/tools.d.ts#L67) |
| `ToolFinalizer` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L179) |
| `ToolInvocationPorts` | type | [声明](../../../dist/esm/structs/capabilities/invocation.d.ts#L51) |
| `ToolInvocationRequest` | type | [声明](../../../dist/esm/structs/capabilities/tools.d.ts#L88) |
| `ToolJournal` | type | [声明](../../../dist/esm/structs/capabilities/invocation.d.ts#L31) |
| `ToolJournalFinish` | type | [声明](../../../dist/esm/structs/capabilities/invocation.d.ts#L22) |
| `ToolJournalStart` | type | [声明](../../../dist/esm/structs/capabilities/invocation.d.ts#L13) |
| `ToolLifecycleHooks` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L72) |
| `ToolLifecyclePolicy` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L225) |
| `ToolLifecycleProtocol` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L59) |
| `ToolLifecycleRegistry` | type | [声明](../../../dist/esm/kits/tools.d.ts#L20) |
| `ToolLifecycleRegistryOptions` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L231) |
| `ToolModelField` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L44) |
| `ToolModelView` | type | [声明](../../../dist/esm/structs/support/tools.d.ts#L23) |
| `ToolNormalizer` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L177) |
| `ToolOutput` | type | [声明](../../../dist/esm/structs/support/tools.d.ts#L41) |
| `ToolProposal` | type | [声明](../../../dist/esm/structs/capabilities/model.d.ts#L13) |
| `ToolProtocol` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L171) |
| `ToolRegistration` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L223)；Use LifecycleToolRegistration. |
| `ToolRegistry` | type | [声明](../../../dist/esm/capabilities/tools.d.ts#L7) |
| `ToolRegistryOptions` | type | [声明](../../../dist/esm/structs/capabilities/tools.d.ts#L99) |
| `ToolRegistryPorts` | type | [声明](../../../dist/esm/structs/capabilities/tools.d.ts#L78) |
| `ToolResult` | type | [声明](../../../dist/esm/structs/invocation.d.ts#L57) |
| `ToolRuntime` | type | [声明](../../../dist/esm/structs/support/tools.d.ts#L51) |
| `ToolRuntimeTypes` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L25) |
| `ToolsOptions` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L215)；Use ToolLifecycleRegistryOptions. |
| `transformContextText` | type | [声明](../../../dist/esm/support/context/assembly.d.ts#L39) |
| `TreeProjectionOptions` | type | [声明](../../../dist/esm/structs/kits/projection.d.ts#L29) |
| `uniqueBy` | type | [声明](../../../dist/esm/kits/normalization.d.ts#L34) |
| `validateAnswerBatch` | type | [声明](../../../dist/esm/kits/answering/batch.d.ts#L19) |
| `validateContextBudget` | type | [声明](../../../dist/esm/context/fragments.d.ts#L39) |
| `validateContextFragment` | type | [声明](../../../dist/esm/context/fragments.d.ts#L26) |
| `ValidationError` | type | [声明](../../../dist/esm/structs/errors.d.ts#L17) |
| `VectorSearch` | type | [声明](../../../dist/esm/kits/vector-search.d.ts#L38) |
| `VectorSearchHit` | type | [声明](../../../dist/esm/kits/vector-search.d.ts#L19) |
| `VectorSearchQuery` | type | [声明](../../../dist/esm/kits/vector-search.d.ts#L22) |
| `VectorSearchSpace` | type | [声明](../../../dist/esm/kits/vector-search.d.ts#L12) |
| `WaitGate` | type | [声明](../../../dist/esm/structs/kits/waiting.d.ts#L47) |
| `WaitGateDefinition` | type | [声明](../../../dist/esm/structs/kits/waiting.d.ts#L33) |
| `WaitGateOptions` | type | [声明](../../../dist/esm/structs/kits/waiting.d.ts#L42) |
| `WaitIdentity` | type | [声明](../../../dist/esm/structs/kits/waiting.d.ts#L4) |
| `waitModelOperation` | type | [声明](../../../dist/esm/model/operations.d.ts#L6) |
| `WaitRecord` | type | [声明](../../../dist/esm/structs/kits/waiting.d.ts#L10) |
| `WaitStore` | type | [声明](../../../dist/esm/structs/kits/waiting.d.ts#L27) |
| `WalkRule` | type | [声明](../../../dist/esm/structs/utils/rules.d.ts#L22) |
| `walkRules` | type | [声明](../../../dist/esm/utils/rules.d.ts#L36) |
| `WorkflowChain` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L62) |
| `WorkflowChainCoverage` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L46) |
| `WorkflowChainNode` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L78) |
| `WorkflowChainNodeEvent` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L98) |
| `WorkflowChainSource` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L57) |
| `WorkflowChainTransition` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L111) |
| `WorkflowContext` | type | [声明](../../../dist/esm/structs/execution/workflow.d.ts#L26) |
| `WorkflowContractError` | type | [声明](../../../dist/esm/structs/errors.d.ts#L38) |
| `WorkflowEvent` | type | [声明](../../../dist/esm/structs/execution/workflow.d.ts#L119) |
| `WorkflowExtension` | type | [声明](../../../dist/esm/structs/execution/workflow.d.ts#L161) |
| `WorkflowFailure` | type | [声明](../../../dist/esm/structs/execution/workflow.d.ts#L156) |
| `WorkflowGraph` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L6) |
| `WorkflowGraphEdge` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L37) |
| `WorkflowGraphNode` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L15) |
| `WorkflowGraphRoute` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L28) |
| `WorkflowModel` | type | [声明](../../../dist/esm/structs/execution/workflow.d.ts#L175) |
| `WorkflowNode` | type | [声明](../../../dist/esm/structs/execution/workflow.d.ts#L73) |
| `WorkflowNodeReport` | type | [声明](../../../dist/esm/structs/execution/workflow.d.ts#L66) |
| `WorkflowNodeVisit` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L78) |
| `WorkflowNodeVisitEvent` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L98) |
| `WorkflowReportedStepRecord` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L71) |
| `WorkflowRoute` | type | [声明](../../../dist/esm/structs/execution/workflow.d.ts#L50) |
| `WorkflowRunTrace` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L62) |
| `WorkflowRunTraceCoverage` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L46) |
| `WorkflowRunTraceSource` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L57) |
| `WorkflowSubflowRecord` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L71) |
| `WorkflowTransitionRecord` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L111) |
| `writeSseFrame` | type | [声明](../../../dist/esm/support/transport/sse.d.ts#L38) |

## @jangts/agent-core/structs

[合同与行为](types.md) · 409 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `AgentCacheAddress` | type | [声明](../../../dist/esm/structs/execution/cache.d.ts#L27) |
| `AgentCacheOptions` | type | [声明](../../../dist/esm/structs/execution/cache.d.ts#L23) |
| `AgentCachePort` | type | [声明](../../../dist/esm/structs/execution/cache.d.ts#L34) |
| `AgentCatalogPorts` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L77) |
| `AgentCoreEngineOptions` | type | [声明](../../../dist/esm/structs/execution/engine.d.ts#L37) |
| `AgentErrorInfo` | type | [声明](../../../dist/esm/structs/errors.d.ts#L46) |
| `AgentFamily` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L86) |
| `AgentOutputEvent` | type | [声明](../../../dist/esm/structs/kits/presentation/events.d.ts#L11) |
| `AgentWorkflowDefinition` | type | [声明](../../../dist/esm/structs/execution/workflow.d.ts#L103) |
| `ArtifactReference` | type | [声明](../../../dist/esm/structs/kits/artifacts.d.ts#L12) |
| `ArtifactResolver` | type | [声明](../../../dist/esm/structs/kits/artifacts.d.ts#L21) |
| `AsIntent` | type | [声明](../../../dist/esm/structs/capabilities/model.d.ts#L27) |
| `AsyncSink` | type | [声明](../../../dist/esm/structs/common.d.ts#L21) |
| `BoundModelProvider` | type | [声明](../../../dist/esm/structs/model/chat-provider.d.ts#L51) |
| `BranchVersion` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L19) |
| `BranchVersioning` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L86) |
| `BranchVersioningDefinition` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L56) |
| `BranchVersionOperation` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L17) |
| `branchVersionOperations` | value | [声明](../../../dist/esm/structs/kits/family.d.ts#L15) |
| `BranchVersionRecord` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L36) |
| `BranchVersionStore` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L49) |
| `BreakCheck` | type | [声明](../../../dist/esm/structs/utils/rules.d.ts#L33) |
| `BreakEvent` | type | [声明](../../../dist/esm/structs/utils/rules.d.ts#L42) |
| `BreakPredicate` | type | [声明](../../../dist/esm/structs/utils/rules.d.ts#L31) |
| `BreakReason` | type | [声明](../../../dist/esm/structs/utils/rules.d.ts#L29) |
| `BreakWhileConfig` | type | [声明](../../../dist/esm/structs/utils/rules.d.ts#L49) |
| `BudgetError` | value + type | [声明](../../../dist/esm/structs/errors.d.ts#L29) |
| `BuiltContext` | type | [声明](../../../dist/esm/structs/context/fragments.d.ts#L45) |
| `CacheContext` | type | [声明](../../../dist/esm/structs/execution/cache.d.ts#L51) |
| `CacheReadOptions` | type | [声明](../../../dist/esm/structs/execution/cache.d.ts#L11) |
| `CandidateSelectionDefinition` | type | [声明](../../../dist/esm/structs/kits/candidates.d.ts#L16) |
| `CapabilityCatalogOptions` | type | [声明](../../../dist/esm/structs/support/capabilities.d.ts#L31) |
| `CapabilityModule` | type | [声明](../../../dist/esm/structs/support/capabilities.d.ts#L20) |
| `CapabilityToolReferences` | type | [声明](../../../dist/esm/structs/support/capabilities.d.ts#L11) |
| `CatalogDomainTool` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L12) |
| `CatalogExecutionTool` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L29) |
| `CatalogGoal` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L12) |
| `CatalogScope` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L17) |
| `CatalogTask` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L22) |
| `CatalogTool` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L29) |
| `ChatProvider` | value + type | [声明](../../../dist/esm/structs/model/chat-provider.d.ts#L24) |
| `CheckResult` | type | [声明](../../../dist/esm/structs/common.d.ts#L52) |
| `Command` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L93) |
| `CommandCatalogOptions` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L115) |
| `CommandDefinition` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L58) |
| `CompatibleModelConfig` | type | [声明](../../../dist/esm/structs/support/model/provider.d.ts#L74) |
| `CompatibleModelPorts` | type | [声明](../../../dist/esm/structs/support/model/provider.d.ts#L98) |
| `CompatibleModelProviderOptions` | type | [声明](../../../dist/esm/structs/support/model/provider.d.ts#L118) |
| `CompiledTool` | type | [声明](../../../dist/esm/structs/support/tools.d.ts#L43) |
| `ContextAssemblyOptions` | type | [声明](../../../dist/esm/structs/support/context.d.ts#L35) |
| `ContextBuilder` | type | [声明](../../../dist/esm/structs/support/context.d.ts#L49) |
| `ContextBuilderOptions` | type | [声明](../../../dist/esm/structs/support/context.d.ts#L28) |
| `ContextFragment` | type | [声明](../../../dist/esm/structs/context/fragments.d.ts#L17) |
| `ContextFragmentConfig` | type | [声明](../../../dist/esm/structs/support/context.d.ts#L42) |
| `ContextFragmentUsage` | type | [声明](../../../dist/esm/structs/context/fragments.d.ts#L34) |
| `ContextLifetime` | type | [声明](../../../dist/esm/structs/context/fragments.d.ts#L15) |
| `ContextPlan` | type | [声明](../../../dist/esm/structs/context/processing.d.ts#L13) |
| `ContextProjection` | type | [声明](../../../dist/esm/structs/support/context.d.ts#L15) |
| `ContextRecord` | type | [声明](../../../dist/esm/structs/context/journal.d.ts#L26) |
| `ContextTrust` | type | [声明](../../../dist/esm/structs/context/fragments.d.ts#L13) |
| `CoreDiagnosticRecord` | type | [声明](../../../dist/esm/structs/diagnostics.d.ts#L279) |
| `CoreEvent` | type | [声明](../../../dist/esm/structs/diagnostics.d.ts#L207) |
| `CoreEventDescriptor` | type | [声明](../../../dist/esm/structs/diagnostics.d.ts#L145) |
| `CoreEventName` | type | [声明](../../../dist/esm/structs/diagnostics.d.ts#L138) |
| `CoreEventPayloads` | type | [声明](../../../dist/esm/structs/diagnostics.d.ts#L17) |
| `CoreLogOutput` | type | [声明](../../../dist/esm/structs/diagnostics.d.ts#L232) |
| `CoreStep` | type | [声明](../../../dist/esm/structs/execution/engine.d.ts#L35) |
| `CreateDiagnosticsOptions` | type | [声明](../../../dist/esm/structs/diagnostics.d.ts#L266) |
| `DebugStepsOutput` | type | [声明](../../../dist/esm/structs/debug.d.ts#L169) |
| `DescribedTool` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L42) |
| `DiagnosticContext` | type | [声明](../../../dist/esm/structs/diagnostics.d.ts#L243) |
| `DiagnosticIdentity` | type | [声明](../../../dist/esm/structs/diagnostics.d.ts#L150) |
| `DiagnosticSpanFields` | type | [声明](../../../dist/esm/structs/diagnostics.d.ts#L199) |
| `DomainTool` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L15) |
| `DomainToolDescription` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L71) |
| `DomainToolId` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L75) |
| `DomainToolPolicy` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L44) |
| `DomainToolRegistration` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L42) |
| `DurableAuthorizationContext` | type | [声明](../../../dist/esm/structs/kits/durable.d.ts#L97) |
| `DurableCheckpoint` | type | [声明](../../../dist/esm/structs/kits/durable.d.ts#L24) |
| `DurableReconcileContext` | type | [声明](../../../dist/esm/structs/kits/durable.d.ts#L93) |
| `DurableReconciliation` | type | [声明](../../../dist/esm/structs/kits/durable.d.ts#L72) |
| `durableReplayPolicies` | value | [声明](../../../dist/esm/structs/kits/durable.d.ts#L22) |
| `durableStatuses` | value | [声明](../../../dist/esm/structs/kits/durable.d.ts#L15) |
| `DurableStep` | type | [声明](../../../dist/esm/structs/kits/durable.d.ts#L61) |
| `DurableStepContext` | type | [声明](../../../dist/esm/structs/kits/durable.d.ts#L82) |
| `DurableStore` | type | [声明](../../../dist/esm/structs/kits/durable.d.ts#L52) |
| `DurableTask` | type | [声明](../../../dist/esm/structs/kits/durable.d.ts#L120) |
| `DurableTaskDefinition` | type | [声明](../../../dist/esm/structs/kits/durable.d.ts#L101) |
| `DurableTaskOptions` | type | [声明](../../../dist/esm/structs/kits/durable.d.ts#L113) |
| `DurationMs` | type | [声明](../../../dist/esm/structs/common.d.ts#L17) |
| `EngineCacheOptions` | type | [声明](../../../dist/esm/structs/execution/cache.d.ts#L6) |
| `ErasedTool` | type | [声明](../../../dist/esm/structs/capabilities/tools.d.ts#L54) |
| `ErrorContext` | type | [声明](../../../dist/esm/structs/errors.d.ts#L61) |
| `EvidenceProjectionDefinition` | type | [声明](../../../dist/esm/structs/kits/evidence.d.ts#L36) |
| `EvidenceProjectionProvider` | type | [声明](../../../dist/esm/structs/kits/evidence.d.ts#L29) |
| `EvidenceProvider` | type | [声明](../../../dist/esm/structs/kits/evidence.d.ts#L21) |
| `EvidenceRequirement` | type | [声明](../../../dist/esm/structs/kits/evidence.d.ts#L12) |
| `ExecutableTool` | type | [声明](../../../dist/esm/structs/capabilities/tools.d.ts#L18) |
| `ExecutionContext` | type | [声明](../../../dist/esm/structs/common.d.ts#L95) |
| `ExecutionEventDescriptor` | type | [声明](../../../dist/esm/structs/execution/events.d.ts#L14) |
| `ExecutionObserver` | type | [声明](../../../dist/esm/structs/execution/events.d.ts#L17) |
| `ExecutionOptions` | type | [声明](../../../dist/esm/structs/common.d.ts#L86) |
| `FamilyDefinition` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L56) |
| `FamilyOperation` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L17) |
| `familyOperations` | value | [声明](../../../dist/esm/structs/kits/family.d.ts#L15) |
| `FamilyRecord` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L36) |
| `FamilyStore` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L49) |
| `FamilyVersion` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L19) |
| `FunctionCallDelta` | type | [声明](../../../dist/esm/structs/model/messages.d.ts#L114) |
| `GoalDescription` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L71) |
| `GoalId` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L75) |
| `GoalPolicy` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L44) |
| `GoalTool` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L15) |
| `GoalToolRegistration` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L42) |
| `Id` | type | [声明](../../../dist/esm/structs/common.d.ts#L13) |
| `IntentOptions` | type | [声明](../../../dist/esm/structs/capabilities/model.d.ts#L20) |
| `INTERACTION_CATEGORIES` | value | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L28) |
| `InteractionCategory` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L26) |
| `InteractionDescriptor` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L30) |
| `InteractionHandlers` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L41) |
| `InteractionProtocolDefinition` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L128) |
| `InvocationHandler` | type | [声明](../../../dist/esm/structs/capabilities/invocation.d.ts#L38) |
| `InvocationMetadata` | type | [声明](../../../dist/esm/structs/invocation.d.ts#L13) |
| `InvocationResult` | type | [声明](../../../dist/esm/structs/invocation.d.ts#L30) |
| `InvocationStatus` | type | [声明](../../../dist/esm/structs/common.d.ts#L23) |
| `Issue` | type | [声明](../../../dist/esm/structs/common.d.ts#L36) |
| `JsonFrameLimits` | type | [声明](../../../dist/esm/structs/support/transport/json.d.ts#L12) |
| `JsonSchema` | type | [声明](../../../dist/esm/structs/common.d.ts#L25) |
| `JsonSchemaOptions` | type | [声明](../../../dist/esm/structs/support/schema.d.ts#L18) |
| `JsonSchemaValidator` | type | [声明](../../../dist/esm/structs/support/schema.d.ts#L11) |
| `JsonTransportPart` | type | [声明](../../../dist/esm/structs/support/transport/json.d.ts#L21) |
| `KnowledgeCandidate` | type | [声明](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L26) |
| `KnowledgePublication` | type | [声明](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L76) |
| `knowledgePublicationOperations` | value | [声明](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L15) |
| `KnowledgePublicationOptions` | type | [声明](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L58) |
| `KnowledgePublicationRecord` | type | [声明](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L40) |
| `KnowledgePublicationStore` | type | [声明](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L51) |
| `KnowledgeSourceReference` | type | [声明](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L17) |
| `LegacyAgentCatalogPorts` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L51) |
| `LifecycleContext` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L2) |
| `LifecycleHooks` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L72) |
| `LifecycleProtocol` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L59) |
| `LifecycleRun` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L36) |
| `LifecycleTool` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L131) |
| `LifecycleToolBase` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L112) |
| `LifecycleToolRegistration` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L133) |
| `LoopEvent` | type | [声明](../../../dist/esm/structs/execution/engine.d.ts#L13) |
| `MatchRule` | type | [声明](../../../dist/esm/structs/utils/rules.d.ts#L12) |
| `MaybePromise` | type | [声明](../../../dist/esm/structs/common.d.ts#L27) |
| `ModelAssistantToolMessage` | type | [声明](../../../dist/esm/structs/model/messages.d.ts#L80) |
| `ModelCallRecord` | type | [声明](../../../dist/esm/structs/invocation.d.ts#L35) |
| `ModelCallRequest` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L199) |
| `ModelCallTrace` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L74) |
| `ModelCapabilities` | type | [声明](../../../dist/esm/structs/model/messages.d.ts#L45) |
| `ModelChildOptions` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L137) |
| `ModelChildPolicy` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L58) |
| `ModelChoiceIndex` | type | [声明](../../../dist/esm/structs/support/model/provider.d.ts#L113) |
| `ModelContentPart` | type | [声明](../../../dist/esm/structs/model/messages.d.ts#L28) |
| `ModelContinuation` | type | [声明](../../../dist/esm/structs/model/messages.d.ts#L37) |
| `ModelDuplex` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L51) |
| `ModelFunction` | type | [声明](../../../dist/esm/structs/model/messages.d.ts#L103) |
| `ModelImage` | type | [声明](../../../dist/esm/structs/model/messages.d.ts#L11) |
| `ModelInputMeasurement` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L231) |
| `ModelInteractionAdapter` | type | [声明](../../../dist/esm/structs/model/interactions.d.ts#L52) |
| `ModelInteractionDefinition` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L67) |
| `ModelInteractionOptions` | type | [声明](../../../dist/esm/structs/model/messages.d.ts#L157) |
| `ModelInteractionRegistration` | type | [声明](../../../dist/esm/structs/model/interactions.d.ts#L67) |
| `ModelLifecycleContext` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L2) |
| `ModelLifecycleRun` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L36) |
| `ModelMessage` | type | [声明](../../../dist/esm/structs/model/messages.d.ts#L66) |
| `ModelOperationAction` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L7) |
| `ModelOperationHandle` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L10) |
| `ModelOperationPorts` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L43) |
| `ModelOperationProvider` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L32) |
| `ModelOperationRequest` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L19) |
| `ModelOperationResult` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L25) |
| `ModelOperationStatus` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L8) |
| `ModelOptions` | type | [声明](../../../dist/esm/structs/model/messages.d.ts#L128) |
| `ModelOutputEvent` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L116) |
| `ModelPart` | type | [声明](../../../dist/esm/structs/model/messages.d.ts#L126) |
| `ModelPrepareRequest` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L287) |
| `ModelProvider` | type | [声明](../../../dist/esm/structs/model/chat-provider.d.ts#L41) |
| `ModelProviderContext` | type | [声明](../../../dist/esm/structs/model/chat-provider.d.ts#L14) |
| `ModelProviderErrorCode` | type | [声明](../../../dist/esm/structs/support/model/provider.d.ts#L15) |
| `ModelProviderFailure` | type | [声明](../../../dist/esm/structs/support/model/provider.d.ts#L37) |
| `ModelRealtimeEvent` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L60) |
| `ModelRealtimeProvider` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L56) |
| `ModelResponseCollector` | type | [声明](../../../dist/esm/structs/model/interactions.d.ts#L14) |
| `ModelResponseToolCall` | type | [声明](../../../dist/esm/structs/model/session.d.ts#L11) |
| `ModelResult` | type | [声明](../../../dist/esm/structs/invocation.d.ts#L55) |
| `ModelRunnerBudgetSnapshot` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L298) |
| `ModelRunnerOptions` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L179) |
| `ModelRunnerPorts` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L120) |
| `ModelRunnerProvider` | type | [声明](../../../dist/esm/structs/model/chat-provider.d.ts#L41) |
| `ModelRunnerSettings` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L157) |
| `ModelRuntimeConfig` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L45) |
| `ModelSelection` | type | [声明](../../../dist/esm/structs/capabilities/model.d.ts#L58) |
| `ModelSessionCall` | type | [声明](../../../dist/esm/structs/model/session.d.ts#L11) |
| `ModelSessionResult` | type | [声明](../../../dist/esm/structs/model/session.d.ts#L24) |
| `ModelStageInteractionRegistration` | type | [声明](../../../dist/esm/structs/support/model/interactions.d.ts#L15) |
| `ModelStageTransportRegistration` | type | [声明](../../../dist/esm/structs/support/model/interactions.d.ts#L15) |
| `ModelStreamEvent` | type | [声明](../../../dist/esm/structs/model/messages.d.ts#L52) |
| `ModelTokenBudget` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L29) |
| `ModelTool` | type | [声明](../../../dist/esm/structs/capabilities/model.d.ts#L31) |
| `ModelToolCall` | type | [声明](../../../dist/esm/structs/model/messages.d.ts#L18) |
| `ModelToolCatalog` | type | [声明](../../../dist/esm/structs/capabilities/model.d.ts#L88) |
| `ModelToolRegistration` | type | [声明](../../../dist/esm/structs/capabilities/model.d.ts#L52) |
| `ModelToolResponse` | type | [声明](../../../dist/esm/structs/model/session.d.ts#L24) |
| `ModelToolResultMessage` | type | [声明](../../../dist/esm/structs/model/messages.d.ts#L87) |
| `ModelToolSelection` | type | [声明](../../../dist/esm/structs/capabilities/model.d.ts#L71) |
| `ModelToolSource` | type | [声明](../../../dist/esm/structs/capabilities/model.d.ts#L80) |
| `ModelTransportDefinition` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L67) |
| `ModelTransportRegistration` | type | [声明](../../../dist/esm/structs/model/interactions.d.ts#L67) |
| `ModelUsage` | type | [声明](../../../dist/esm/structs/model/messages.d.ts#L94) |
| `NativeFunctionCall` | type | [声明](../../../dist/esm/structs/model/interactions.d.ts#L80) |
| `NodeAgentCache` | type | [声明](../../../dist/esm/structs/execution/cache.d.ts#L43) |
| `NodeCache` | type | [声明](../../../dist/esm/structs/execution/cache.d.ts#L15) |
| `NodeReportingContext` | type | [声明](../../../dist/esm/structs/debug.d.ts#L140) |
| `Observer` | type | [声明](../../../dist/esm/structs/common.d.ts#L19) |
| `OperationAction` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L7) |
| `OperationContext` | type | [声明](../../../dist/esm/structs/common.d.ts#L109) |
| `OperationStatus` | type | [声明](../../../dist/esm/structs/model/lifecycle.d.ts#L8) |
| `Policy` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L211)；Use ToolLifecyclePolicy. |
| `PolicyAssessment` | type | [声明](../../../dist/esm/structs/kits/policies.d.ts#L22) |
| `PolicyDefinition` | type | [声明](../../../dist/esm/structs/kits/policies.d.ts#L11) |
| `PreparedModelCall` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L264) |
| `PreparedModelInteraction` | type | [声明](../../../dist/esm/structs/model/interactions.d.ts#L45) |
| `PreparedModelSelection` | type | [声明](../../../dist/esm/structs/model/interactions.d.ts#L32) |
| `PreparedModelTransport` | type | [声明](../../../dist/esm/structs/model/interactions.d.ts#L45) |
| `ProtocolCheck` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L47) |
| `ProtocolField` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L15) |
| `ProtocolPredicate` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L45) |
| `ProtocolReason` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L43) |
| `ProtocolShape` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L138) |
| `ProviderErrorCapture` | type | [声明](../../../dist/esm/structs/support/model/provider-observer.d.ts#L63) |
| `ProviderEventDescriptor` | type | [声明](../../../dist/esm/structs/support/model/provider-observer.d.ts#L44) |
| `ProviderEventName` | type | [声明](../../../dist/esm/structs/support/model/provider-observer.d.ts#L42) |
| `ProviderEventPayloads` | type | [声明](../../../dist/esm/structs/support/model/provider-observer.d.ts#L13) |
| `ProviderObservation` | type | [声明](../../../dist/esm/structs/support/model/provider-observer.d.ts#L49) |
| `ProviderObserver` | type | [声明](../../../dist/esm/structs/support/model/provider-observer.d.ts#L56) |
| `ProviderReasoningLevel` | type | [声明](../../../dist/esm/structs/support/model/provider.d.ts#L45) |
| `ProviderReasoningStrategy` | type | [声明](../../../dist/esm/structs/support/model/provider.d.ts#L52) |
| `ReadonlyCatalog` | type | [声明](../../../dist/esm/structs/common.d.ts#L60) |
| `RecordedSubStep` | type | [声明](../../../dist/esm/structs/debug.d.ts#L94) |
| `RecoveryDefinition` | type | [声明](../../../dist/esm/structs/kits/policies.d.ts#L40) |
| `RecoveryResult` | type | [声明](../../../dist/esm/structs/kits/policies.d.ts#L31) |
| `ReflectionDefinition` | type | [声明](../../../dist/esm/structs/kits/reflection.d.ts#L108) |
| `ReflectionEvidence` | type | [声明](../../../dist/esm/structs/kits/reflection.d.ts#L20) |
| `ReflectionFinding` | type | [声明](../../../dist/esm/structs/kits/reflection.d.ts#L80) |
| `reflectionFindingKinds` | value | [声明](../../../dist/esm/structs/kits/reflection.d.ts#L78) |
| `reflectionIdentityFields` | value | [声明](../../../dist/esm/structs/kits/reflection.d.ts#L18) |
| `ReflectionPage` | type | [声明](../../../dist/esm/structs/kits/reflection.d.ts#L54) |
| `ReflectionQuery` | type | [声明](../../../dist/esm/structs/kits/reflection.d.ts#L43) |
| `ReflectionReport` | type | [声明](../../../dist/esm/structs/kits/reflection.d.ts#L89) |
| `ReflectionSource` | type | [声明](../../../dist/esm/structs/kits/reflection.d.ts#L69) |
| `ReflectionTask` | type | [声明](../../../dist/esm/structs/kits/reflection.d.ts#L131) |
| `RegisteredDomainTool` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L82) |
| `RegisteredGoal` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L82) |
| `RegisteredInteractionOutput` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L173) |
| `RegisteredLifecycleTool` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L142) |
| `RegisteredModelTool` | type | [声明](../../../dist/esm/structs/capabilities/model.d.ts#L56) |
| `RegisteredProtocol` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L149) |
| `RegisteredScope` | type | [声明](../../../dist/esm/structs/kits/domains/scopes.d.ts#L79) |
| `RegisteredScopeEvidence` | type | [声明](../../../dist/esm/structs/kits/domains/scopes.d.ts#L67) |
| `RegisteredTool` | type | [声明](../../../dist/esm/structs/capabilities/tools.d.ts#L65) |
| `RegisteredToolDefinition` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L142) |
| `RegisteredTransportOutput` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L173) |
| `RegistrationDefinition` | type | [声明](../../../dist/esm/structs/support/registration.d.ts#L11) |
| `Registry` | type | [声明](../../../dist/esm/structs/common.d.ts#L76) |
| `ReplyBubbleInput` | type | [声明](../../../dist/esm/structs/kits/presentation/events.d.ts#L32) |
| `ReplyDeliveryOptions` | type | [声明](../../../dist/esm/structs/kits/presentation/events.d.ts#L39) |
| `ReplyGuidance` | type | [声明](../../../dist/esm/structs/model/runtime.d.ts#L195) |
| `ReportedStep` | type | [声明](../../../dist/esm/structs/debug.d.ts#L57) |
| `ReportedStepInput` | type | [声明](../../../dist/esm/structs/debug.d.ts#L111) |
| `ReportedStepLog` | type | [声明](../../../dist/esm/structs/debug.d.ts#L130) |
| `ReportedStepProgress` | type | [声明](../../../dist/esm/structs/debug.d.ts#L148) |
| `ReportedStepRecord` | type | [声明](../../../dist/esm/structs/debug.d.ts#L94) |
| `ReportedStepRecorder` | value + type | [声明](../../../dist/esm/diagnostics/sub-flow.d.ts#L45) |
| `ReportedStepStatus` | type | [声明](../../../dist/esm/structs/debug.d.ts#L55) |
| `reportedStepStatusCatalog` | value | [声明](../../../dist/esm/structs/debug.d.ts#L19) |
| `reportedStepStatuses` | value | [声明](../../../dist/esm/structs/debug.d.ts#L53) |
| `ReportedStepUpdate` | type | [声明](../../../dist/esm/structs/debug.d.ts#L119) |
| `ReportedStepValue` | type | [声明](../../../dist/esm/structs/debug.d.ts#L90) |
| `ResultReview` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L98) |
| `ResultReviewAdmissionRequest` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L105) |
| `ResultReviewCandidate` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L30) |
| `ResultReviewCoverage` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L45) |
| `ResultReviewDefinition` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L93) |
| `ResultReviewDetector` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L59) |
| `ResultReviewFinding` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L35) |
| `ResultReviewInput` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L12) |
| `ResultReviewRequest` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L24) |
| `ResultReviewResolution` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L74) |
| `ResultReviewResult` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L53) |
| `ResultReviewScope` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L4) |
| `ResultReviewStrategy` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L82) |
| `RetrievalDefinition` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L96) |
| `RetrievalEffect` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L49) |
| `RetrievalPorts` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L56) |
| `RetrievalReason` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L47) |
| `RetrievalReceipt` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L30) |
| `RetrievalResult` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L17) |
| `RetrievalRunner` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L87) |
| `RetrievalSource` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L13) |
| `RetrievalState` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L21) |
| `ReviewChoice` | type | [声明](../../../dist/esm/structs/kits/review-choice.d.ts#L21) |
| `ReviewChoiceAnswer` | type | [声明](../../../dist/esm/structs/kits/review-choice.d.ts#L16) |
| `ReviewChoiceDecision` | type | [声明](../../../dist/esm/structs/kits/review-choice.d.ts#L53) |
| `ReviewChoiceHost` | type | [声明](../../../dist/esm/structs/kits/review-choice.d.ts#L46) |
| `ReviewChoiceInput` | type | [声明](../../../dist/esm/structs/kits/review-choice.d.ts#L10) |
| `ReviewChoiceInspection` | type | [声明](../../../dist/esm/structs/kits/review-choice.d.ts#L34) |
| `ReviewDecision` | type | [声明](../../../dist/esm/structs/kits/review-decision.d.ts#L47) |
| `ReviewDecisionBinding` | type | [声明](../../../dist/esm/structs/kits/review-decision.d.ts#L5) |
| `ReviewDecisionDefinition` | type | [声明](../../../dist/esm/structs/kits/review-decision.d.ts#L26) |
| `ReviewDecisionState` | type | [声明](../../../dist/esm/structs/kits/review-decision.d.ts#L16) |
| `RuntimeNodeReportingContext` | type | [声明](../../../dist/esm/structs/debug.d.ts#L190) |
| `SchemaAdapter` | type | [声明](../../../dist/esm/structs/common.d.ts#L29) |
| `ScopeDefinition` | type | [声明](../../../dist/esm/structs/kits/domains/scopes.d.ts#L15) |
| `ScopeDescription` | type | [声明](../../../dist/esm/structs/kits/domains/scopes.d.ts#L83) |
| `ScopedReportedStepInput` | type | [声明](../../../dist/esm/structs/debug.d.ts#L117) |
| `ScopedReportedStepRecorder` | value + type | [声明](../../../dist/esm/diagnostics/sub-flow.d.ts#L55) |
| `ScopedSubFlowLogger` | value + type | [声明](../../../dist/esm/diagnostics/sub-flow.d.ts#L55) |
| `ScopedSubFlowStepInput` | type | [声明](../../../dist/esm/structs/debug.d.ts#L117) |
| `ScopeRegistryPolicy` | type | [声明](../../../dist/esm/structs/kits/domains/scopes.d.ts#L40) |
| `SearchHit` | type | [声明](../../../dist/esm/structs/common.d.ts#L118) |
| `SelectedTools` | type | [声明](../../../dist/esm/structs/support/tools.d.ts#L37) |
| `SemanticSlotDefinition` | type | [声明](../../../dist/esm/structs/kits/presentation/templates.d.ts#L19) |
| `SseEvent` | type | [声明](../../../dist/esm/structs/index.d.ts#L27) |
| `SseOutputEvent` | type | [声明](../../../dist/esm/structs/support/transport/sse.d.ts#L19) |
| `SseReadOptions` | type | [声明](../../../dist/esm/structs/index.d.ts#L27) |
| `SseWriter` | type | [声明](../../../dist/esm/structs/support/transport/sse.d.ts#L12) |
| `StepOutcome` | type | [声明](../../../dist/esm/structs/execution/engine.d.ts#L26) |
| `SubFlowLog` | type | [声明](../../../dist/esm/structs/debug.d.ts#L130) |
| `SubFlowLogger` | value + type | [声明](../../../dist/esm/diagnostics/sub-flow.d.ts#L45) |
| `SubFlowStepFix` | type | [声明](../../../dist/esm/structs/debug.d.ts#L119) |
| `SubFlowStepInput` | type | [声明](../../../dist/esm/structs/debug.d.ts#L111) |
| `SubFlowValue` | type | [声明](../../../dist/esm/structs/debug.d.ts#L90) |
| `SubStepProgress` | type | [声明](../../../dist/esm/structs/debug.d.ts#L148) |
| `TextSkill` | type | [声明](../../../dist/esm/structs/kits/text-skills.d.ts#L24) |
| `TextSkillHeader` | type | [声明](../../../dist/esm/structs/kits/text-skills.d.ts#L31) |
| `TextSkillLoader` | type | [声明](../../../dist/esm/structs/kits/text-skills.d.ts#L61) |
| `TextSkillLoaderDefinition` | type | [声明](../../../dist/esm/structs/kits/text-skills.d.ts#L36) |
| `TextSkillReadPorts` | type | [声明](../../../dist/esm/structs/kits/text-skills.d.ts#L56) |
| `TextSkillRegistration` | type | [声明](../../../dist/esm/structs/kits/text-skills.d.ts#L13) |
| `TextTemplateOptions` | type | [声明](../../../dist/esm/structs/kits/presentation/templates.d.ts#L10) |
| `TimestampMs` | type | [声明](../../../dist/esm/structs/common.d.ts#L15) |
| `Tool` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L219)；Use LifecycleTool and domainToolIds. |
| `ToolCallRecord` | type | [声明](../../../dist/esm/structs/invocation.d.ts#L48) |
| `ToolCatalog` | type | [声明](../../../dist/esm/structs/support/tools.d.ts#L66) |
| `ToolCatalogEntry` | type | [声明](../../../dist/esm/structs/support/tools.d.ts#L64) |
| `ToolCondition` | type | [声明](../../../dist/esm/structs/capabilities/model.d.ts#L29) |
| `ToolContext` | type | [声明](../../../dist/esm/structs/capabilities/model.d.ts#L18) |
| `ToolDefinition` | type | [声明](../../../dist/esm/structs/capabilities/tools.d.ts#L39) |
| `ToolDomainMembership` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L123) |
| `ToolExecutionContext` | type | [声明](../../../dist/esm/structs/capabilities/tools.d.ts#L41) |
| `ToolExecutionEvent` | type | [声明](../../../dist/esm/structs/capabilities/tools.d.ts#L67) |
| `ToolFinalizer` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L179) |
| `ToolInvocationPorts` | type | [声明](../../../dist/esm/structs/capabilities/invocation.d.ts#L51) |
| `ToolInvocationRequest` | type | [声明](../../../dist/esm/structs/capabilities/tools.d.ts#L88) |
| `ToolJournal` | type | [声明](../../../dist/esm/structs/capabilities/invocation.d.ts#L31) |
| `ToolJournalFinish` | type | [声明](../../../dist/esm/structs/capabilities/invocation.d.ts#L22) |
| `ToolJournalStart` | type | [声明](../../../dist/esm/structs/capabilities/invocation.d.ts#L13) |
| `ToolLifecycleHooks` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L72) |
| `ToolLifecyclePolicy` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L225) |
| `ToolLifecycleProtocol` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L59) |
| `ToolLifecycleRegistryOptions` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L231) |
| `ToolModelField` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L44) |
| `ToolModelView` | type | [声明](../../../dist/esm/structs/support/tools.d.ts#L23) |
| `ToolNormalizer` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L177) |
| `ToolOutput` | type | [声明](../../../dist/esm/structs/support/tools.d.ts#L41) |
| `ToolProposal` | type | [声明](../../../dist/esm/structs/capabilities/model.d.ts#L13) |
| `ToolProtocol` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L171) |
| `ToolRegistration` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L223)；Use LifecycleToolRegistration. |
| `ToolRegistryOptions` | type | [声明](../../../dist/esm/structs/capabilities/tools.d.ts#L99) |
| `ToolRegistryPorts` | type | [声明](../../../dist/esm/structs/capabilities/tools.d.ts#L78) |
| `ToolResult` | type | [声明](../../../dist/esm/structs/invocation.d.ts#L57) |
| `ToolRuntime` | type | [声明](../../../dist/esm/structs/support/tools.d.ts#L51) |
| `ToolRuntimeTypes` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L25) |
| `ToolsOptions` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L215)；Use ToolLifecycleRegistryOptions. |
| `ValidationError` | value + type | [声明](../../../dist/esm/structs/errors.d.ts#L17) |
| `WalkRule` | type | [声明](../../../dist/esm/structs/utils/rules.d.ts#L22) |
| `WorkflowChain` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L62) |
| `WorkflowChainCoverage` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L46) |
| `WorkflowChainNode` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L78) |
| `WorkflowChainNodeEvent` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L98) |
| `WorkflowChainSource` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L57) |
| `WorkflowChainTransition` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L111) |
| `WorkflowContext` | type | [声明](../../../dist/esm/structs/execution/workflow.d.ts#L26) |
| `WorkflowContractError` | value + type | [声明](../../../dist/esm/structs/errors.d.ts#L38) |
| `WorkflowEvent` | type | [声明](../../../dist/esm/structs/execution/workflow.d.ts#L119) |
| `WorkflowExtension` | type | [声明](../../../dist/esm/structs/execution/workflow.d.ts#L161) |
| `WorkflowFailure` | type | [声明](../../../dist/esm/structs/execution/workflow.d.ts#L156) |
| `WorkflowGraph` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L6) |
| `WorkflowGraphEdge` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L37) |
| `WorkflowGraphNode` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L15) |
| `WorkflowGraphRoute` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L28) |
| `WorkflowModel` | type | [声明](../../../dist/esm/structs/execution/workflow.d.ts#L175) |
| `WorkflowNode` | type | [声明](../../../dist/esm/structs/execution/workflow.d.ts#L73) |
| `WorkflowNodeReport` | type | [声明](../../../dist/esm/structs/execution/workflow.d.ts#L66) |
| `WorkflowNodeVisit` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L78) |
| `WorkflowNodeVisitEvent` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L98) |
| `WorkflowReportedStepRecord` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L71) |
| `WorkflowRoute` | type | [声明](../../../dist/esm/structs/execution/workflow.d.ts#L50) |
| `WorkflowRunTrace` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L62) |
| `WorkflowRunTraceCoverage` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L46) |
| `WorkflowRunTraceSource` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L57) |
| `WorkflowSubflowRecord` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L71) |
| `WorkflowTransitionRecord` | type | [声明](../../../dist/esm/structs/execution/workflow-views.d.ts#L111) |

## @jangts/agent-core/context

[合同与行为](context-processing.md) · 13 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `assembleContextPlan` | value | [声明](../../../dist/esm/context/plan.d.ts#L14) |
| `assembleFragments` | value | [声明](../../../dist/esm/context/assembly.d.ts#L14) |
| `BuiltContext` | type | [声明](../../../dist/esm/structs/context/fragments.d.ts#L45) |
| `commonPrefixLength` | value | [声明](../../../dist/esm/utils/text.d.ts#L16) |
| `ContextFragment` | type | [声明](../../../dist/esm/structs/context/fragments.d.ts#L17) |
| `ContextFragmentUsage` | type | [声明](../../../dist/esm/structs/context/fragments.d.ts#L34) |
| `ContextJournal` | value + type | [声明](../../../dist/esm/context/journal.d.ts#L5) |
| `ContextLifetime` | type | [声明](../../../dist/esm/structs/context/fragments.d.ts#L15) |
| `ContextPlan` | type | [声明](../../../dist/esm/structs/context/processing.d.ts#L13) |
| `ContextRecord` | type | [声明](../../../dist/esm/structs/context/journal.d.ts#L26) |
| `ContextTrust` | type | [声明](../../../dist/esm/structs/context/fragments.d.ts#L13) |
| `validateContextBudget` | value | [声明](../../../dist/esm/context/fragments.d.ts#L39) |
| `validateContextFragment` | value | [声明](../../../dist/esm/context/fragments.d.ts#L26) |

## @jangts/agent-core/journal

[合同与行为](observability.md) · 2 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `ContextJournal` | value + type | [声明](../../../dist/esm/context/journal.d.ts#L5) |
| `ContextRecord` | type | [声明](../../../dist/esm/structs/context/journal.d.ts#L26) |

## @jangts/agent-core/events

[合同与行为](knowledge-answering.md) · 8 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `AgentOutputEvent` | type | [声明](../../../dist/esm/structs/kits/presentation/events.d.ts#L11) |
| `publishReplyEvents` | value | [声明](../../../dist/esm/kits/presentation/events.d.ts#L40) |
| `REPLY_BUBBLE_BOUNDARY` | value | [声明](../../../dist/esm/kits/presentation/events.d.ts#L19) |
| `ReplyBubbleInput` | type | [声明](../../../dist/esm/structs/kits/presentation/events.d.ts#L32) |
| `replyBubbleTexts` | value | [声明](../../../dist/esm/kits/presentation/events.d.ts#L26) |
| `ReplyDeliveryOptions` | type | [声明](../../../dist/esm/structs/kits/presentation/events.d.ts#L39) |
| `serializeOutputEvents` | value | [声明](../../../dist/esm/kits/presentation/events.d.ts#L53) |
| `textOutputEvents` | value | [声明](../../../dist/esm/kits/presentation/events.d.ts#L60) |

## @jangts/agent-core/errors

[合同与行为](types.md) · 5 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `AgentErrorInfo` | type | [声明](../../../dist/esm/structs/errors.d.ts#L46) |
| `BudgetError` | value + type | [声明](../../../dist/esm/structs/errors.d.ts#L29) |
| `ErrorContext` | type | [声明](../../../dist/esm/structs/errors.d.ts#L61) |
| `ValidationError` | value + type | [声明](../../../dist/esm/structs/errors.d.ts#L17) |
| `WorkflowContractError` | value + type | [声明](../../../dist/esm/structs/errors.d.ts#L38) |

## @jangts/agent-core/tools

[合同与行为](core.md) · 13 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `ErasedTool` | type | [声明](../../../dist/esm/structs/capabilities/tools.d.ts#L54) |
| `executeInvocation` | value | [声明](../../../dist/esm/capabilities/invocation.d.ts#L17) |
| `InvocationHandler` | type | [声明](../../../dist/esm/structs/capabilities/invocation.d.ts#L38) |
| `RegisteredTool` | type | [声明](../../../dist/esm/structs/capabilities/tools.d.ts#L65) |
| `ToolDefinition` | type | [声明](../../../dist/esm/structs/capabilities/tools.d.ts#L39) |
| `ToolExecutionContext` | type | [声明](../../../dist/esm/structs/capabilities/tools.d.ts#L41) |
| `ToolExecutionEvent` | type | [声明](../../../dist/esm/structs/capabilities/tools.d.ts#L67) |
| `ToolInvocationPorts` | type | [声明](../../../dist/esm/structs/capabilities/invocation.d.ts#L51) |
| `ToolInvocationRequest` | type | [声明](../../../dist/esm/structs/capabilities/tools.d.ts#L88) |
| `ToolJournal` | type | [声明](../../../dist/esm/structs/capabilities/invocation.d.ts#L31) |
| `ToolRegistry` | value + type | [声明](../../../dist/esm/capabilities/tools.d.ts#L7) |
| `ToolRegistryOptions` | type | [声明](../../../dist/esm/structs/capabilities/tools.d.ts#L99) |
| `ToolRegistryPorts` | type | [声明](../../../dist/esm/structs/capabilities/tools.d.ts#L78) |

## @jangts/agent-core/protocols

[合同与行为](types.md) · 1 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `ProtocolRegistry` | value + type | [声明](../../../dist/esm/utils/protocol-registry.d.ts#L16) |

## @jangts/agent-core/sse

[合同与行为](support.md) · 9 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `abortableStream` | value | [声明](../../../dist/esm/support/transport/sse.d.ts#L15) |
| `encodeSseEvent` | value | [声明](../../../dist/esm/support/transport/sse.d.ts#L25) |
| `readSse` | value | [声明](../../../dist/esm/support/transport/sse.d.ts#L13) |
| `SseEvent` | type | [声明](../../../dist/esm/support/transport/sse.d.ts#L13) |
| `SseIdleTimeoutError` | value + type | [声明](../../../dist/esm/support/transport/sse.d.ts#L13) |
| `SseOutputEvent` | type | [声明](../../../dist/esm/structs/support/transport/sse.d.ts#L19) |
| `SseReadOptions` | type | [声明](../../../dist/esm/support/transport/sse.d.ts#L13) |
| `SseWriter` | type | [声明](../../../dist/esm/structs/support/transport/sse.d.ts#L12) |
| `writeSseFrame` | value | [声明](../../../dist/esm/support/transport/sse.d.ts#L38) |

## @jangts/agent-core/json-transport

[合同与行为](support.md) · 3 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `JsonFrameLimits` | type | [声明](../../../dist/esm/structs/support/transport/json.d.ts#L12) |
| `parseJsonFrames` | value | [声明](../../../dist/esm/support/transport/json.d.ts#L32) |
| `scanJsonObjectFrames` | value | [声明](../../../dist/esm/support/transport/json.d.ts#L18) |

## @jangts/agent-core/diagnostics

[合同与行为](observability.md) · 39 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `CoreDiagnosticRecord` | type | [声明](../../../dist/esm/structs/diagnostics.d.ts#L279) |
| `CoreEvent` | type | [声明](../../../dist/esm/structs/diagnostics.d.ts#L207) |
| `coreEventCatalog` | value | [声明](../../../dist/esm/diagnostics/catalog.d.ts#L7) |
| `CoreEventDescriptor` | type | [声明](../../../dist/esm/structs/diagnostics.d.ts#L145) |
| `CoreEventName` | type | [声明](../../../dist/esm/structs/diagnostics.d.ts#L138) |
| `CoreEventPayloads` | type | [声明](../../../dist/esm/structs/diagnostics.d.ts#L17) |
| `CoreLogOutput` | type | [声明](../../../dist/esm/structs/diagnostics.d.ts#L232) |
| `createDiagnostics` | value | [声明](../../../dist/esm/diagnostics/index.d.ts#L18) |
| `CreateDiagnosticsOptions` | type | [声明](../../../dist/esm/structs/diagnostics.d.ts#L266) |
| `DebugStepsOutput` | type | [声明](../../../dist/esm/structs/debug.d.ts#L169) |
| `DiagnosticContext` | type | [声明](../../../dist/esm/structs/diagnostics.d.ts#L243) |
| `diagnosticError` | value | [声明](../../../dist/esm/diagnostics/index.d.ts#L27) |
| `DiagnosticIdentity` | type | [声明](../../../dist/esm/structs/diagnostics.d.ts#L150) |
| `DiagnosticSpanFields` | type | [声明](../../../dist/esm/structs/diagnostics.d.ts#L199) |
| `NodeReportingContext` | type | [声明](../../../dist/esm/structs/debug.d.ts#L140) |
| `normalizeDiagnosticEvent` | value | [声明](../../../dist/esm/diagnostics/index.d.ts#L41) |
| `RecordedSubStep` | type | [声明](../../../dist/esm/structs/debug.d.ts#L94) |
| `ReportedStep` | type | [声明](../../../dist/esm/structs/debug.d.ts#L57) |
| `ReportedStepInput` | type | [声明](../../../dist/esm/structs/debug.d.ts#L111) |
| `ReportedStepLog` | type | [声明](../../../dist/esm/structs/debug.d.ts#L130) |
| `ReportedStepProgress` | type | [声明](../../../dist/esm/structs/debug.d.ts#L148) |
| `ReportedStepRecord` | type | [声明](../../../dist/esm/structs/debug.d.ts#L94) |
| `ReportedStepRecorder` | value + type | [声明](../../../dist/esm/diagnostics/sub-flow.d.ts#L45) |
| `ReportedStepStatus` | type | [声明](../../../dist/esm/structs/debug.d.ts#L55) |
| `reportedStepStatusCatalog` | value | [声明](../../../dist/esm/structs/debug.d.ts#L19) |
| `reportedStepStatuses` | value | [声明](../../../dist/esm/structs/debug.d.ts#L53) |
| `ReportedStepUpdate` | type | [声明](../../../dist/esm/structs/debug.d.ts#L119) |
| `ReportedStepValue` | type | [声明](../../../dist/esm/structs/debug.d.ts#L90) |
| `RuntimeNodeReportingContext` | type | [声明](../../../dist/esm/structs/debug.d.ts#L190) |
| `ScopedReportedStepInput` | type | [声明](../../../dist/esm/structs/debug.d.ts#L117) |
| `ScopedReportedStepRecorder` | value + type | [声明](../../../dist/esm/diagnostics/sub-flow.d.ts#L55) |
| `ScopedSubFlowLogger` | value + type | [声明](../../../dist/esm/diagnostics/sub-flow.d.ts#L55) |
| `ScopedSubFlowStepInput` | type | [声明](../../../dist/esm/structs/debug.d.ts#L117) |
| `SubFlowLog` | type | [声明](../../../dist/esm/structs/debug.d.ts#L130) |
| `SubFlowLogger` | value + type | [声明](../../../dist/esm/diagnostics/sub-flow.d.ts#L45) |
| `SubFlowStepFix` | type | [声明](../../../dist/esm/structs/debug.d.ts#L119) |
| `SubFlowStepInput` | type | [声明](../../../dist/esm/structs/debug.d.ts#L111) |
| `SubFlowValue` | type | [声明](../../../dist/esm/structs/debug.d.ts#L90) |
| `SubStepProgress` | type | [声明](../../../dist/esm/structs/debug.d.ts#L148) |

## @jangts/agent-core/kits/knowledge

[合同与行为](knowledge-answering.md) · 19 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `defineKnowledgeCatalog` | value | [声明](../../../dist/esm/kits/knowledge/catalog.d.ts#L15) |
| `defineKnowledgePublication` | value | [声明](../../../dist/esm/kits/knowledge/publication.d.ts#L17) |
| `Knowledge` | value | [声明](../../../dist/esm/kits/knowledge/index.d.ts#L18) |
| `KnowledgeCandidate` | type | [声明](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L26) |
| `KnowledgeCatalog` | type | [声明](../../../dist/esm/structs/kits/knowledge.d.ts#L67) |
| `KnowledgeCatalogOptions` | type | [声明](../../../dist/esm/structs/kits/knowledge.d.ts#L60) |
| `KnowledgeDocument` | type | [声明](../../../dist/esm/structs/kits/knowledge.d.ts#L22) |
| `KnowledgePart` | type | [声明](../../../dist/esm/structs/kits/knowledge.d.ts#L20) |
| `KnowledgePublication` | type | [声明](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L76) |
| `knowledgePublicationOperations` | value | [声明](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L15) |
| `KnowledgePublicationOptions` | type | [声明](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L58) |
| `KnowledgePublicationRecord` | type | [声明](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L40) |
| `KnowledgePublicationStore` | type | [声明](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L51) |
| `KnowledgeRead` | type | [声明](../../../dist/esm/structs/kits/knowledge.d.ts#L44) |
| `KnowledgeSection` | type | [声明](../../../dist/esm/structs/kits/knowledge.d.ts#L13) |
| `KnowledgeSnapshot` | type | [声明](../../../dist/esm/structs/kits/knowledge.d.ts#L50) |
| `KnowledgeSourceReference` | type | [声明](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L17) |
| `parseKnowledgeDocument` | value | [声明](../../../dist/esm/kits/knowledge/sections.d.ts#L18) |
| `SectionSelection` | type | [声明](../../../dist/esm/structs/kits/knowledge.d.ts#L33) |

## @jangts/agent-core/kits/presentation

[合同与行为](knowledge-answering.md) · 30 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `AgentOutputEvent` | type | [声明](../../../dist/esm/structs/kits/presentation/events.d.ts#L11) |
| `CompiledReplyFormat` | type | [声明](../../../dist/esm/structs/kits/presentation/formats.d.ts#L31) |
| `defineOutputCatalog` | value | [声明](../../../dist/esm/kits/presentation/outputs.d.ts#L16) |
| `defineReplyFormats` | value | [声明](../../../dist/esm/kits/presentation/formats.d.ts#L38) |
| `defineSemanticSlots` | value | [声明](../../../dist/esm/kits/presentation/templates.d.ts#L37) |
| `defineTextTemplate` | value | [声明](../../../dist/esm/kits/presentation/templates.d.ts#L21) |
| `mergeReplyBubbles` | value | [声明](../../../dist/esm/kits/presentation/formats.d.ts#L29) |
| `OutputCatalogOptions` | type | [声明](../../../dist/esm/structs/kits/presentation/outputs.d.ts#L77) |
| `OutputComposeInput` | type | [声明](../../../dist/esm/structs/kits/presentation/outputs.d.ts#L60) |
| `OutputDefinition` | type | [声明](../../../dist/esm/structs/kits/presentation/outputs.d.ts#L33) |
| `OutputField` | type | [声明](../../../dist/esm/structs/kits/presentation/outputs.d.ts#L13) |
| `OutputIssue` | type | [声明](../../../dist/esm/structs/kits/presentation/outputs.d.ts#L56) |
| `OutputProvider` | type | [声明](../../../dist/esm/structs/kits/presentation/outputs.d.ts#L48) |
| `OutputResult` | type | [声明](../../../dist/esm/structs/kits/presentation/outputs.d.ts#L71) |
| `Presentation` | value | [声明](../../../dist/esm/kits/presentation/index.d.ts#L25) |
| `publishReplyEvents` | value | [声明](../../../dist/esm/kits/presentation/events.d.ts#L40) |
| `REPLY_BUBBLE_BOUNDARY` | value | [声明](../../../dist/esm/kits/presentation/events.d.ts#L19) |
| `ReplyBubbleInput` | type | [声明](../../../dist/esm/structs/kits/presentation/events.d.ts#L32) |
| `replyBubbleTexts` | value | [声明](../../../dist/esm/kits/presentation/events.d.ts#L26) |
| `ReplyDeliveryOptions` | type | [声明](../../../dist/esm/structs/kits/presentation/events.d.ts#L39) |
| `ReplyFormatCheck` | type | [声明](../../../dist/esm/structs/kits/presentation/formats.d.ts#L11) |
| `replyFormatChecks` | value | [声明](../../../dist/esm/kits/presentation/formats.d.ts#L5) |
| `ReplyFormatDefinition` | type | [声明](../../../dist/esm/structs/kits/presentation/formats.d.ts#L20) |
| `ReplyFormatOptions` | type | [声明](../../../dist/esm/structs/kits/presentation/formats.d.ts#L39) |
| `resolvePreference` | value | [声明](../../../dist/esm/kits/presentation/variants.d.ts#L34) |
| `selectVariant` | value | [声明](../../../dist/esm/kits/presentation/variants.d.ts#L20) |
| `SemanticSlotDefinition` | type | [声明](../../../dist/esm/structs/kits/presentation/templates.d.ts#L19) |
| `serializeOutputEvents` | value | [声明](../../../dist/esm/kits/presentation/events.d.ts#L53) |
| `textOutputEvents` | value | [声明](../../../dist/esm/kits/presentation/events.d.ts#L60) |
| `TextTemplateOptions` | type | [声明](../../../dist/esm/structs/kits/presentation/templates.d.ts#L10) |

## @jangts/agent-core/kits/answering

[合同与行为](knowledge-answering.md) · 16 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `AnswerCheck` | type | [声明](../../../dist/esm/structs/kits/answering/flow.d.ts#L16) |
| `AnswerChecker` | type | [声明](../../../dist/esm/structs/kits/answering/checks.d.ts#L11) |
| `AnswerFlowDefinition` | type | [声明](../../../dist/esm/structs/kits/answering/flow.d.ts#L45) |
| `Answering` | value | [声明](../../../dist/esm/kits/answering/index.d.ts#L21) |
| `AnswerIssue` | type | [声明](../../../dist/esm/structs/kits/answering/flow.d.ts#L13) |
| `AnswerItem` | type | [声明](../../../dist/esm/structs/kits/answering/flow.d.ts#L19) |
| `AnswerReader` | type | [声明](../../../dist/esm/structs/kits/answering/tasks.d.ts#L38) |
| `AnswerResult` | type | [声明](../../../dist/esm/structs/kits/answering/flow.d.ts#L30) |
| `AnswerTaskBase` | type | [声明](../../../dist/esm/structs/kits/answering/tasks.d.ts#L11) |
| `AnswerTaskDefinition` | type | [声明](../../../dist/esm/structs/kits/answering/tasks.d.ts#L30) |
| `AnswerTaskPorts` | type | [声明](../../../dist/esm/structs/kits/answering/tasks.d.ts#L46) |
| `defineAnswerCheckCatalog` | value | [声明](../../../dist/esm/kits/answering/checks.d.ts#L15) |
| `defineAnswerFlow` | value | [声明](../../../dist/esm/kits/answering/flow.d.ts#L17) |
| `defineAnswerReaderCatalog` | value | [声明](../../../dist/esm/kits/answering/tasks.d.ts#L10) |
| `defineAnswerTaskCatalog` | value | [声明](../../../dist/esm/kits/answering/tasks.d.ts#L30) |
| `validateAnswerBatch` | value | [声明](../../../dist/esm/kits/answering/batch.d.ts#L19) |

## @jangts/agent-core/support

[合同与行为](support.md) · 232 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `abortableStream` | value | [声明](../../../dist/esm/support/index.d.ts#L15) |
| `AggregatedToolCall` | type | [声明](../../../dist/esm/model/interactions/calls.d.ts#L13) |
| `assembleFragments` | value | [声明](../../../dist/esm/context/assembly.d.ts#L14) |
| `assessModelBudget` | value | [声明](../../../dist/esm/support/model/budget-assessment.d.ts#L39) |
| `AssociatedRegistration` | type | [声明](../../../dist/esm/structs/support/associations.d.ts#L6) |
| `AssociationOptions` | type | [声明](../../../dist/esm/structs/support/associations.d.ts#L12) |
| `AssociationSource` | type | [声明](../../../dist/esm/structs/support/associations.d.ts#L17) |
| `BackgroundModelInput` | type | [声明](../../../dist/esm/support/model/lifecycle/background.d.ts#L5) |
| `BreakCheck` | type | [声明](../../../dist/esm/structs/utils/rules.d.ts#L33) |
| `BreakEvent` | type | [声明](../../../dist/esm/structs/utils/rules.d.ts#L42) |
| `BreakPredicate` | type | [声明](../../../dist/esm/structs/utils/rules.d.ts#L31) |
| `BreakReason` | type | [声明](../../../dist/esm/structs/utils/rules.d.ts#L29) |
| `breakWhile` | value | [声明](../../../dist/esm/utils/rules.d.ts#L56) |
| `BreakWhileConfig` | type | [声明](../../../dist/esm/structs/utils/rules.d.ts#L49) |
| `BudgetAssessment` | type | [声明](../../../dist/esm/support/model/budget-assessment.d.ts#L28) |
| `BudgetAssessmentInput` | type | [声明](../../../dist/esm/support/model/budget-assessment.d.ts#L15) |
| `BuiltContext` | type | [声明](../../../dist/esm/structs/context/fragments.d.ts#L45) |
| `CapabilityCatalogOptions` | type | [声明](../../../dist/esm/structs/support/capabilities.d.ts#L31) |
| `CapabilityModule` | type | [声明](../../../dist/esm/structs/support/capabilities.d.ts#L20) |
| `CapabilityToolReferences` | type | [声明](../../../dist/esm/structs/support/capabilities.d.ts#L11) |
| `chatCompletionFunctionOptions` | value | [声明](../../../dist/esm/support/model/chat-completions.d.ts#L22) |
| `chatCompletionMessages` | value | [声明](../../../dist/esm/support/model/chat-completions.d.ts#L47) |
| `chatCompletionParts` | value | [声明](../../../dist/esm/support/model/chat-completions.d.ts#L33) |
| `commonPrefixLength` | value | [声明](../../../dist/esm/utils/text.d.ts#L16) |
| `CompatibleModelConfig` | type | [声明](../../../dist/esm/structs/support/model/provider.d.ts#L74) |
| `CompatibleModelPorts` | type | [声明](../../../dist/esm/structs/support/model/provider.d.ts#L98) |
| `CompatibleModelProvider` | value + type | [声明](../../../dist/esm/support/model/compatible-provider.d.ts#L11) |
| `CompatibleModelProviderOptions` | type | [声明](../../../dist/esm/structs/support/model/provider.d.ts#L118) |
| `CompiledTool` | type | [声明](../../../dist/esm/structs/support/tools.d.ts#L43) |
| `CompletionFailure` | type | [声明](../../../dist/esm/structs/support/model/completion.d.ts#L29) |
| `CompletionPolicy` | type | [声明](../../../dist/esm/structs/support/model/completion.d.ts#L40) |
| `completionPolicyCatalog` | value | [声明](../../../dist/esm/support/model/completion/index.d.ts#L7) |
| `CompletionRequestFacts` | type | [声明](../../../dist/esm/structs/support/model/completion.d.ts#L20) |
| `CompletionSession` | type | [声明](../../../dist/esm/structs/support/model/completion.d.ts#L31) |
| `configureBreakWhile` | value | [声明](../../../dist/esm/utils/break-observer.d.ts#L19) |
| `connectModelWebRTC` | value | [声明](../../../dist/esm/support/model/lifecycle/realtime.d.ts#L31) |
| `connectModelWebSocket` | value | [声明](../../../dist/esm/support/model/lifecycle/realtime.d.ts#L24) |
| `ContextAssemblyOptions` | type | [声明](../../../dist/esm/structs/support/context.d.ts#L35) |
| `ContextBuilder` | type | [声明](../../../dist/esm/structs/support/context.d.ts#L49) |
| `ContextBuilderOptions` | type | [声明](../../../dist/esm/structs/support/context.d.ts#L28) |
| `ContextCompressionCall` | type | [声明](../../../dist/esm/structs/support/context-processing.d.ts#L160) |
| `ContextCompressor` | type | [声明](../../../dist/esm/structs/support/context-processing.d.ts#L169) |
| `ContextFragment` | type | [声明](../../../dist/esm/structs/context/fragments.d.ts#L17) |
| `ContextFragmentConfig` | type | [声明](../../../dist/esm/structs/support/context.d.ts#L42) |
| `ContextFragmentUsage` | type | [声明](../../../dist/esm/structs/context/fragments.d.ts#L34) |
| `contextHandlerCalls` | value | [声明](../../../dist/esm/support/context/selection-policy.d.ts#L19) |
| `ContextHandlerReference` | type | [声明](../../../dist/esm/structs/support/context-processing.d.ts#L36) |
| `ContextHistoryGrouping` | type | [声明](../../../dist/esm/structs/support/context-processing.d.ts#L20) |
| `contextHistoryStrategies` | value | [声明](../../../dist/esm/support/context/strategies.d.ts#L10) |
| `ContextLifetime` | type | [声明](../../../dist/esm/structs/context/fragments.d.ts#L15) |
| `ContextModelCall` | type | [声明](../../../dist/esm/structs/support/context-processing.d.ts#L221) |
| `ContextModelRequest` | type | [声明](../../../dist/esm/structs/support/context-processing.d.ts#L208) |
| `ContextNodeResult` | type | [声明](../../../dist/esm/support/context/nodes.d.ts#L7) |
| `ContextPlan` | type | [声明](../../../dist/esm/structs/context/processing.d.ts#L13) |
| `ContextPolicy` | type | [声明](../../../dist/esm/structs/support/context-processing.d.ts#L134) |
| `contextPolicyCatalog` | value | [声明](../../../dist/esm/support/context/processing.d.ts#L181) |
| `ContextProcessingNodeDefinition` | type | [声明](../../../dist/esm/support/context/nodes.d.ts#L22) |
| `ContextProcessingOptions` | type | [声明](../../../dist/esm/structs/support/context-processing.d.ts#L225) |
| `ContextProcessingReport` | type | [声明](../../../dist/esm/structs/support/context-processing.d.ts#L177) |
| `ContextProjection` | type | [声明](../../../dist/esm/structs/support/context.d.ts#L15) |
| `ContextRecentHistory` | type | [声明](../../../dist/esm/structs/support/context-processing.d.ts#L27) |
| `ContextReduction` | type | [声明](../../../dist/esm/structs/support/context-processing.d.ts#L41) |
| `contextReductionCatalog` | value | [声明](../../../dist/esm/support/context/processing.d.ts#L31) |
| `ContextReductionNodeDefinition` | type | [声明](../../../dist/esm/support/context/nodes.d.ts#L68) |
| `ContextSelection` | type | [声明](../../../dist/esm/structs/support/context-processing.d.ts#L62) |
| `ContextSelectionCall` | type | [声明](../../../dist/esm/structs/support/context-processing.d.ts#L108) |
| `ContextSelectionCandidate` | type | [声明](../../../dist/esm/structs/support/context-processing.d.ts#L84) |
| `contextSelectionCatalog` | value | [声明](../../../dist/esm/support/context/selection-policy.d.ts#L46) |
| `ContextSelectionNodeDefinition` | type | [声明](../../../dist/esm/support/context/nodes.d.ts#L59) |
| `ContextSelectionResult` | type | [声明](../../../dist/esm/support/context/nodes.d.ts#L54) |
| `ContextSelector` | type | [声明](../../../dist/esm/structs/support/context-processing.d.ts#L126) |
| `ContextStageResult` | type | [声明](../../../dist/esm/support/context/nodes.d.ts#L45) |
| `ContextStrategy` | type | [声明](../../../dist/esm/support/context/strategies.d.ts#L63) |
| `ContextStrategyOptions` | type | [声明](../../../dist/esm/support/context/strategies.d.ts#L57) |
| `ContextStrategySettings` | type | [声明](../../../dist/esm/support/context/strategies.d.ts#L39) |
| `ContextTokenMeasurement` | type | [声明](../../../dist/esm/structs/support/context-processing.d.ts#L100) |
| `ContextTrust` | type | [声明](../../../dist/esm/structs/context/fragments.d.ts#L13) |
| `createBackgroundModelProvider` | value | [声明](../../../dist/esm/support/model/lifecycle/background.d.ts#L10) |
| `createBatchModelProvider` | value | [声明](../../../dist/esm/support/model/lifecycle/batch.d.ts#L18) |
| `createContextCompressor` | value | [声明](../../../dist/esm/support/context/compression.d.ts#L20) |
| `createContextProcessingNode` | value | [声明](../../../dist/esm/support/context/nodes.d.ts#L84) |
| `createContextReductionNode` | value | [声明](../../../dist/esm/support/context/nodes.d.ts#L107) |
| `createContextSelectionNode` | value | [声明](../../../dist/esm/support/context/nodes.d.ts#L95) |
| `createContextSelector` | value | [声明](../../../dist/esm/support/context/selection.d.ts#L16) |
| `createContextStrategy` | value | [声明](../../../dist/esm/support/context/strategies.d.ts#L85) |
| `createJsonInteraction` | value | [声明](../../../dist/esm/support/model/transports.d.ts#L43) |
| `createJsonTransport` | value | [声明](../../../dist/esm/support/model/transports.d.ts#L43) |
| `createMemoryContinuationStore` | value | [声明](../../../dist/esm/support/model/continuation.d.ts#L17) |
| `createModelInteraction` | value | [声明](../../../dist/esm/support/model/transports.d.ts#L6) |
| `createModelProvider` | value | [声明](../../../dist/esm/support/model/provider-factory.d.ts#L35) |
| `createModelStrategy` | value | [声明](../../../dist/esm/support/model/strategies.d.ts#L75) |
| `createModelTransport` | value | [声明](../../../dist/esm/support/model/transports.d.ts#L6) |
| `createOperationHttpProvider` | value | [声明](../../../dist/esm/support/model/lifecycle/http.d.ts#L17) |
| `createProviderObservationScope` | value | [声明](../../../dist/esm/support/model/observer.d.ts#L32) |
| `createRealtimeProtocolProvider` | value | [声明](../../../dist/esm/support/model/lifecycle/realtime.d.ts#L10) |
| `createReplyPreview` | value | [声明](../../../dist/esm/support/model/reply-preview.d.ts#L44) |
| `createReplyPreviewRules` | value | [声明](../../../dist/esm/support/model/preview-rules.d.ts#L44) |
| `createRequestRecovery` | value | [声明](../../../dist/esm/support/recovery.d.ts#L18) |
| `createStageModelInteraction` | value | [声明](../../../dist/esm/support/model/stage-transport.d.ts#L11) |
| `createStageModelTransport` | value | [声明](../../../dist/esm/support/model/stage-transport.d.ts#L11) |
| `createTextInteraction` | value | [声明](../../../dist/esm/support/model/transports.d.ts#L24) |
| `createTextTransport` | value | [声明](../../../dist/esm/support/model/transports.d.ts#L24) |
| `createToolCallCollector` | value | [声明](../../../dist/esm/model/interactions/calls.d.ts#L40) |
| `createWebSocketDuplex` | value | [声明](../../../dist/esm/support/model/lifecycle/realtime.d.ts#L18) |
| `DecodedModelResponseToolCall` | type | [声明](../../../dist/esm/support/model/session.d.ts#L7) |
| `DecodedModelToolResponse` | type | [声明](../../../dist/esm/support/model/session.d.ts#L16) |
| `DecodedSessionCall` | type | [声明](../../../dist/esm/support/model/session.d.ts#L7) |
| `DecodedSessionResult` | type | [声明](../../../dist/esm/support/model/session.d.ts#L16) |
| `defaultCompletionPolicy` | value | [声明](../../../dist/esm/support/model/completion/default.d.ts#L11) |
| `defineAssociatedCatalog` | value | [声明](../../../dist/esm/support/associations.d.ts#L3) |
| `defineCapabilityCatalog` | value | [声明](../../../dist/esm/support/capabilities.d.ts#L28) |
| `defineContextAssembly` | value | [声明](../../../dist/esm/support/context/assembly.d.ts#L15) |
| `defineContextFragments` | value | [声明](../../../dist/esm/support/context/assembly.d.ts#L28) |
| `defineModelTools` | value | [声明](../../../dist/esm/support/model/capabilities.d.ts#L22) |
| `defineRegistrationCatalog` | value | [声明](../../../dist/esm/support/registration.d.ts#L13) |
| `defineSchema` | value | [声明](../../../dist/esm/support/schema.d.ts#L41) |
| `defineTool` | value | [声明](../../../dist/esm/support/tools.d.ts#L16) |
| `defineToolCatalog` | value | [声明](../../../dist/esm/support/tools.d.ts#L33) |
| `encodeSseEvent` | value | [声明](../../../dist/esm/support/transport/sse.d.ts#L25) |
| `fromJsonSchema` | value | [声明](../../../dist/esm/support/schema.d.ts#L16) |
| `fromParserSchema` | value | [声明](../../../dist/esm/support/schema.d.ts#L28) |
| `HostedToolEvent` | type | [声明](../../../dist/esm/support/model/protocols/hosted.d.ts#L4) |
| `JsonFrameLimits` | type | [声明](../../../dist/esm/structs/support/transport/json.d.ts#L12) |
| `jsonObjectInteraction` | value | [声明](../../../dist/esm/model/interactions/json-object.d.ts#L9) |
| `JsonSchemaOptions` | type | [声明](../../../dist/esm/structs/support/schema.d.ts#L18) |
| `JsonSchemaValidator` | type | [声明](../../../dist/esm/structs/support/schema.d.ts#L11) |
| `matchRule` | value | [声明](../../../dist/esm/utils/rules.d.ts#L26) |
| `MatchRule` | type | [声明](../../../dist/esm/structs/utils/rules.d.ts#L12) |
| `ModelBatchItem` | type | [声明](../../../dist/esm/support/model/lifecycle/batch.d.ts#L5) |
| `ModelBatchItemResult` | type | [声明](../../../dist/esm/support/model/lifecycle/batch.d.ts#L10) |
| `modelBudgetStrategies` | value | [声明](../../../dist/esm/support/model/strategies.d.ts#L11) |
| `ModelBudgetStrategy` | type | [声明](../../../dist/esm/support/model/strategies.d.ts#L35) |
| `ModelChildrenOptions` | type | [声明](../../../dist/esm/support/model/children.d.ts#L14) |
| `ModelChildTask` | type | [声明](../../../dist/esm/support/model/children.d.ts#L5) |
| `ModelChoiceIndex` | type | [声明](../../../dist/esm/structs/support/model/provider.d.ts#L113) |
| `ModelContinuationIdentity` | type | [声明](../../../dist/esm/support/model/continuation.d.ts#L7) |
| `ModelEndpointCapabilities` | type | [声明](../../../dist/esm/support/model/protocols/capabilities.d.ts#L3) |
| `ModelInteractionAdapter` | type | [声明](../../../dist/esm/structs/model/interactions.d.ts#L52) |
| `modelInteractionCatalog` | value | [声明](../../../dist/esm/support/model/interactions/index.d.ts#L6) |
| `ModelInteractionRegistration` | type | [声明](../../../dist/esm/structs/model/interactions.d.ts#L67) |
| `ModelProtocol` | type | [声明](../../../dist/esm/support/model/protocols/requests.d.ts#L3) |
| `modelProtocolCatalog` | value | [声明](../../../dist/esm/support/model/protocols/requests.d.ts#L5) |
| `ModelProviderConfig` | type | [声明](../../../dist/esm/support/model/provider-factory.d.ts#L11) |
| `ModelProviderErrorCode` | type | [声明](../../../dist/esm/structs/support/model/provider.d.ts#L15) |
| `ModelProviderFailure` | type | [声明](../../../dist/esm/structs/support/model/provider.d.ts#L37) |
| `ModelResourceInput` | type | [声明](../../../dist/esm/support/model/resources.d.ts#L20) |
| `ModelResourcePorts` | type | [声明](../../../dist/esm/support/model/resources.d.ts#L33) |
| `ModelResourceRunner` | type | [声明](../../../dist/esm/support/model/resources.d.ts#L25) |
| `ModelResourceSource` | type | [声明](../../../dist/esm/support/model/resources.d.ts#L8) |
| `ModelResponseCollector` | type | [声明](../../../dist/esm/structs/model/interactions.d.ts#L14) |
| `ModelStageInteractionRegistration` | type | [声明](../../../dist/esm/structs/support/model/interactions.d.ts#L15) |
| `ModelStageTransportRegistration` | type | [声明](../../../dist/esm/structs/support/model/interactions.d.ts#L15) |
| `ModelStrategyOptions` | type | [声明](../../../dist/esm/support/model/strategies.d.ts#L43) |
| `ModelToolInteractionOptions` | type | [声明](../../../dist/esm/support/model/session.d.ts#L27) |
| `ModelToolInteractionRegistration` | type | [声明](../../../dist/esm/support/model/session.d.ts#L33) |
| `ModelTransportRegistration` | type | [声明](../../../dist/esm/structs/model/interactions.d.ts#L67) |
| `NativeFunctionCall` | type | [声明](../../../dist/esm/structs/model/interactions.d.ts#L80) |
| `nativeFunctionInteraction` | value | [声明](../../../dist/esm/model/interactions/native-functions.d.ts#L8) |
| `openProtocolRealtime` | value | [声明](../../../dist/esm/support/model/lifecycle/session.d.ts#L6) |
| `OperationHttpConfig` | type | [声明](../../../dist/esm/support/model/lifecycle/http.d.ts#L3) |
| `parseJsonFrames` | value | [声明](../../../dist/esm/support/transport/json.d.ts#L32) |
| `parseModelContinuation` | value | [声明](../../../dist/esm/support/model/continuation.d.ts#L15) |
| `PreparedModelSelection` | type | [声明](../../../dist/esm/structs/model/interactions.d.ts#L32) |
| `PreparedModelToolInteraction` | type | [声明](../../../dist/esm/support/model/session.d.ts#L20) |
| `PreparedSessionTransport` | type | [声明](../../../dist/esm/support/model/session.d.ts#L20) |
| `prepareModelResources` | value | [声明](../../../dist/esm/support/model/resources.d.ts#L55) |
| `prepareModelToolInteraction` | value | [声明](../../../dist/esm/support/model/session.d.ts#L52) |
| `prepareSessionFunctions` | value | [声明](../../../dist/esm/support/model/session.d.ts#L52) |
| `PreviewTool` | type | [声明](../../../dist/esm/support/model/preview-rules.d.ts#L5) |
| `processContext` | value | [声明](../../../dist/esm/support/context/processing.d.ts#L235) |
| `ProviderAssistantMessage` | type | [声明](../../../dist/esm/structs/support/model/messages.d.ts#L31) |
| `ProviderErrorCapture` | type | [声明](../../../dist/esm/structs/support/model/provider-observer.d.ts#L63) |
| `ProviderEventDescriptor` | type | [声明](../../../dist/esm/structs/support/model/provider-observer.d.ts#L44) |
| `ProviderEventName` | type | [声明](../../../dist/esm/structs/support/model/provider-observer.d.ts#L42) |
| `ProviderEventPayloads` | type | [声明](../../../dist/esm/structs/support/model/provider-observer.d.ts#L13) |
| `ProviderMessage` | type | [声明](../../../dist/esm/structs/support/model/messages.d.ts#L47) |
| `ProviderObservation` | type | [声明](../../../dist/esm/structs/support/model/provider-observer.d.ts#L49) |
| `ProviderObserver` | type | [声明](../../../dist/esm/structs/support/model/provider-observer.d.ts#L56) |
| `ProviderReasoningLevel` | type | [声明](../../../dist/esm/structs/support/model/provider.d.ts#L45) |
| `ProviderReasoningStrategy` | type | [声明](../../../dist/esm/structs/support/model/provider.d.ts#L52) |
| `ProviderSystemMessage` | type | [声明](../../../dist/esm/structs/support/model/messages.d.ts#L15) |
| `ProviderToolCall` | type | [声明](../../../dist/esm/structs/support/model/messages.d.ts#L13) |
| `ProviderToolMessage` | type | [声明](../../../dist/esm/structs/support/model/messages.d.ts#L39) |
| `ProviderUserMessage` | type | [声明](../../../dist/esm/structs/support/model/messages.d.ts#L23) |
| `readSse` | value | [声明](../../../dist/esm/support/index.d.ts#L15) |
| `realtimeFunctionResponse` | value | [声明](../../../dist/esm/support/model/lifecycle/realtime.d.ts#L14) |
| `realtimeInput` | value | [声明](../../../dist/esm/support/model/lifecycle/realtime.d.ts#L12) |
| `RealtimeProtocolConfig` | type | [声明](../../../dist/esm/support/model/lifecycle/realtime.d.ts#L3) |
| `realtimeToolResult` | value | [声明](../../../dist/esm/support/model/lifecycle/realtime.d.ts#L16) |
| `RecoveredResult` | type | [声明](../../../dist/esm/support/recovery.d.ts#L8) |
| `RegistrationDefinition` | type | [声明](../../../dist/esm/structs/support/registration.d.ts#L11) |
| `RemainingModelWork` | type | [声明](../../../dist/esm/support/model/budget-assessment.d.ts#L8) |
| `ReplyGuidanceSources` | type | [声明](../../../dist/esm/support/reply-guidance.d.ts#L4) |
| `ReplyPreviewOptions` | type | [声明](../../../dist/esm/support/model/reply-preview.d.ts#L29) |
| `ReplyPreviewRule` | type | [声明](../../../dist/esm/support/model/reply-preview.d.ts#L7) |
| `ReplyPreviewStage` | type | [声明](../../../dist/esm/support/model/preview-rules.d.ts#L25) |
| `ReplyPreviewTool` | type | [声明](../../../dist/esm/support/model/preview-rules.d.ts#L13) |
| `RequestRecovery` | type | [声明](../../../dist/esm/support/recovery.d.ts#L2) |
| `reservedContextCalls` | value | [声明](../../../dist/esm/support/context/selection-policy.d.ts#L10) |
| `resolveReplyGuidance` | value | [声明](../../../dist/esm/support/reply-guidance.d.ts#L15) |
| `retryMultipleModelCalls` | value | [声明](../../../dist/esm/model/decision-retry.d.ts#L11) |
| `runChildren` | value | [声明](../../../dist/esm/support/model/children.d.ts#L37) |
| `scanJsonObjectFrames` | value | [声明](../../../dist/esm/support/transport/json.d.ts#L18) |
| `selectContextSteps` | value | [声明](../../../dist/esm/support/context/selection-policy.d.ts#L85) |
| `SelectedTools` | type | [声明](../../../dist/esm/structs/support/tools.d.ts#L37) |
| `serializeModelContinuation` | value | [声明](../../../dist/esm/support/model/continuation.d.ts#L13) |
| `sessionCompletionPolicy` | value | [声明](../../../dist/esm/support/model/completion/session.d.ts#L16) |
| `SessionFunctionOptions` | type | [声明](../../../dist/esm/support/model/session.d.ts#L27) |
| `SessionModelTransportRegistration` | type | [声明](../../../dist/esm/support/model/session.d.ts#L33) |
| `SseEvent` | type | [声明](../../../dist/esm/support/index.d.ts#L15) |
| `SseIdleTimeoutError` | value + type | [声明](../../../dist/esm/support/index.d.ts#L15) |
| `SseOutputEvent` | type | [声明](../../../dist/esm/structs/support/transport/sse.d.ts#L19) |
| `SseReadOptions` | type | [声明](../../../dist/esm/support/index.d.ts#L15) |
| `SseWriter` | type | [声明](../../../dist/esm/structs/support/transport/sse.d.ts#L12) |
| `streamEvents` | value | [声明](../../../dist/esm/support/stream-events.d.ts#L23) |
| `ToolAssociation` | type | [声明](../../../dist/esm/structs/support/associations.d.ts#L4) |
| `ToolCallCollector` | type | [声明](../../../dist/esm/model/interactions/calls.d.ts#L22) |
| `ToolCallFailure` | type | [声明](../../../dist/esm/model/interactions/calls.d.ts#L20) |
| `ToolCatalog` | type | [声明](../../../dist/esm/structs/support/tools.d.ts#L66) |
| `ToolCatalogEntry` | type | [声明](../../../dist/esm/structs/support/tools.d.ts#L64) |
| `ToolDefinition` | type | [声明](../../../dist/esm/structs/capabilities/tools.d.ts#L39) |
| `ToolModelView` | type | [声明](../../../dist/esm/structs/support/tools.d.ts#L23) |
| `ToolOutput` | type | [声明](../../../dist/esm/structs/support/tools.d.ts#L41) |
| `ToolProposal` | type | [声明](../../../dist/esm/structs/capabilities/model.d.ts#L13) |
| `ToolRuntime` | type | [声明](../../../dist/esm/structs/support/tools.d.ts#L51) |
| `transformContextText` | value | [声明](../../../dist/esm/support/context/assembly.d.ts#L39) |
| `validateContextPolicy` | value | [声明](../../../dist/esm/support/context/processing.d.ts#L17) |
| `validateContextSelection` | value | [声明](../../../dist/esm/support/context/selection-policy.d.ts#L72) |
| `validateToolReferences` | value | [声明](../../../dist/esm/support/capabilities.d.ts#L14) |
| `WalkRule` | type | [声明](../../../dist/esm/structs/utils/rules.d.ts#L22) |
| `walkRules` | value | [声明](../../../dist/esm/utils/rules.d.ts#L36) |
| `writeSseFrame` | value | [声明](../../../dist/esm/support/transport/sse.d.ts#L38) |

## @jangts/agent-core/skills

[合同与行为](skills.md) · 3 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `TaskSkill` | type | [声明](../../../dist/esm/skills/index.d.ts#L6) |
| `TaskSkillId` | type | [声明](../../../dist/esm/skills/index.d.ts#L4) |
| `taskSkills` | value | [声明](../../../dist/esm/skills/index.d.ts#L13) |

## @jangts/agent-core/kits/normalization

[合同与行为](kits.md) · 5 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `defineNormalization` | value | [声明](../../../dist/esm/kits/normalization.d.ts#L15) |
| `Normalization` | value | [声明](../../../dist/esm/kits/normalization.d.ts#L37) |
| `NormalizationOptions` | type | [声明](../../../dist/esm/structs/kits/normalization.d.ts#L20) |
| `NormalizationStep` | type | [声明](../../../dist/esm/structs/kits/normalization.d.ts#L11) |
| `uniqueBy` | value | [声明](../../../dist/esm/kits/normalization.d.ts#L34) |

## @jangts/agent-core/kits/delivery

[合同与行为](kits.md) · 8 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `defineDelivery` | value | [声明](../../../dist/esm/kits/delivery.d.ts#L47)；Use defineDeliveryPipeline. |
| `defineDeliveryPipeline` | value | [声明](../../../dist/esm/kits/delivery.d.ts#L16) |
| `Delivery` | value | [声明](../../../dist/esm/kits/delivery.d.ts#L41)；Use DeliveryPipeline. Same immutable namespace and implementation. |
| `DeliveryOptions` | type | [声明](../../../dist/esm/structs/kits/delivery.d.ts#L41)；Use DeliveryPipelineOptions. |
| `DeliveryPipeline` | value | [声明](../../../dist/esm/kits/delivery.d.ts#L35) |
| `DeliveryPipelineOptions` | type | [声明](../../../dist/esm/structs/kits/delivery.d.ts#L25) |
| `DeliveryPipelineStage` | type | [声明](../../../dist/esm/structs/kits/delivery.d.ts#L13) |
| `DeliveryStage` | type | [声明](../../../dist/esm/structs/kits/delivery.d.ts#L39)；Use DeliveryPipelineStage. |

## @jangts/agent-core/kits/projection

[合同与行为](kits.md) · 7 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `ContentProjection` | type | [声明](../../../dist/esm/structs/kits/projection.d.ts#L11) |
| `ContentProjectionOptions` | type | [声明](../../../dist/esm/structs/kits/projection.d.ts#L18) |
| `defineContentProjection` | value | [声明](../../../dist/esm/kits/projection.d.ts#L15) |
| `defineTreeProjection` | value | [声明](../../../dist/esm/kits/projection.d.ts#L48) |
| `projectContinuousExcerpt` | value | [声明](../../../dist/esm/kits/projection.d.ts#L34) |
| `Projection` | value | [声明](../../../dist/esm/kits/projection.d.ts#L53) |
| `TreeProjectionOptions` | type | [声明](../../../dist/esm/structs/kits/projection.d.ts#L29) |

## @jangts/agent-core/kits/aggregation

[合同与行为](kits.md) · 8 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `aggregateBranchResults` | value | [声明](../../../dist/esm/kits/aggregation.d.ts#L55) |
| `Aggregation` | value | [声明](../../../dist/esm/kits/aggregation.d.ts#L58) |
| `BranchAggregationRequest` | type | [声明](../../../dist/esm/structs/kits/aggregation.d.ts#L29) |
| `BranchAggregationResult` | type | [声明](../../../dist/esm/structs/kits/aggregation.d.ts#L34) |
| `BranchResult` | type | [声明](../../../dist/esm/structs/kits/aggregation.d.ts#L19) |
| `defineQueryAggregation` | value | [声明](../../../dist/esm/kits/aggregation.d.ts#L29) |
| `mergeByKey` | value | [声明](../../../dist/esm/kits/aggregation.d.ts#L14) |
| `QueryAggregationOptions` | type | [声明](../../../dist/esm/structs/kits/aggregation.d.ts#L10) |

## @jangts/agent-core/kits/retrieval

[合同与行为](kits.md) · 12 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `defineRetrieval` | value | [声明](../../../dist/esm/kits/retrieval.d.ts#L18) |
| `Retrieval` | value | [声明](../../../dist/esm/kits/retrieval.d.ts#L23) |
| `RetrievalDefinition` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L96) |
| `RetrievalEffect` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L49) |
| `RetrievalPorts` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L56) |
| `retrievalQueryKey` | value | [声明](../../../dist/esm/utils/query-key.d.ts#L12) |
| `RetrievalReason` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L47) |
| `RetrievalReceipt` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L30) |
| `RetrievalResult` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L17) |
| `RetrievalRunner` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L87) |
| `RetrievalSource` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L13) |
| `RetrievalState` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L21) |

## @jangts/agent-core/kits/evidence

[合同与行为](kits.md) · 7 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `defineEvidenceChecklist` | value | [声明](../../../dist/esm/kits/evidence.d.ts#L14) |
| `defineEvidenceProjection` | value | [声明](../../../dist/esm/kits/evidence.d.ts#L40) |
| `Evidence` | value | [声明](../../../dist/esm/kits/evidence.d.ts#L48) |
| `EvidenceProjectionDefinition` | type | [声明](../../../dist/esm/structs/kits/evidence.d.ts#L36) |
| `EvidenceProjectionProvider` | type | [声明](../../../dist/esm/structs/kits/evidence.d.ts#L29) |
| `EvidenceProvider` | type | [声明](../../../dist/esm/structs/kits/evidence.d.ts#L21) |
| `EvidenceRequirement` | type | [声明](../../../dist/esm/structs/kits/evidence.d.ts#L12) |

## @jangts/agent-core/kits/policies

[合同与行为](kits.md) · 7 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `definePolicySet` | value | [声明](../../../dist/esm/kits/policies.d.ts#L14) |
| `defineRecoveryChain` | value | [声明](../../../dist/esm/kits/policies.d.ts#L40) |
| `Policies` | value | [声明](../../../dist/esm/kits/policies.d.ts#L72) |
| `PolicyAssessment` | type | [声明](../../../dist/esm/structs/kits/policies.d.ts#L22) |
| `PolicyDefinition` | type | [声明](../../../dist/esm/structs/kits/policies.d.ts#L11) |
| `RecoveryDefinition` | type | [声明](../../../dist/esm/structs/kits/policies.d.ts#L40) |
| `RecoveryResult` | type | [声明](../../../dist/esm/structs/kits/policies.d.ts#L31) |

## @jangts/agent-core/kits/candidates

[合同与行为](kits.md) · 3 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `Candidates` | value | [声明](../../../dist/esm/kits/candidates.d.ts#L35) |
| `CandidateSelectionDefinition` | type | [声明](../../../dist/esm/structs/kits/candidates.d.ts#L16) |
| `defineCandidateSelection` | value | [声明](../../../dist/esm/kits/candidates.d.ts#L24) |

## @jangts/agent-core/kits/text-skills

[合同与行为](kits.md) · 8 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `defineTextSkillLoader` | value | [声明](../../../dist/esm/kits/text-skills.d.ts#L16) |
| `TextSkill` | type | [声明](../../../dist/esm/structs/kits/text-skills.d.ts#L24) |
| `TextSkillHeader` | type | [声明](../../../dist/esm/structs/kits/text-skills.d.ts#L31) |
| `TextSkillLoader` | type | [声明](../../../dist/esm/structs/kits/text-skills.d.ts#L61) |
| `TextSkillLoaderDefinition` | type | [声明](../../../dist/esm/structs/kits/text-skills.d.ts#L36) |
| `TextSkillReadPorts` | type | [声明](../../../dist/esm/structs/kits/text-skills.d.ts#L56) |
| `TextSkillRegistration` | type | [声明](../../../dist/esm/structs/kits/text-skills.d.ts#L13) |
| `TextSkills` | value | [声明](../../../dist/esm/kits/text-skills.d.ts#L19) |

## @jangts/agent-core/kits/interaction

[合同与行为](kits.md) · 23 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `bindInteraction` | value | [声明](../../../dist/esm/kits/interaction/handlers.d.ts#L21) |
| `Command` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L93) |
| `CommandCatalog` | value + type | [声明](../../../dist/esm/kits/interaction/commands.d.ts#L19) |
| `CommandCatalogOptions` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L115) |
| `CommandDefinition` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L58) |
| `commandSchema` | value | [声明](../../../dist/esm/kits/interaction/command.d.ts#L41) |
| `compileCommands` | value | [声明](../../../dist/esm/kits/interaction/command.d.ts#L28) |
| `defineCommand` | value | [声明](../../../dist/esm/kits/interaction/command.d.ts#L15) |
| `defineCommandCatalog` | value | [声明](../../../dist/esm/kits/interaction/commands.d.ts#L89) |
| `defineInteractionProtocol` | value | [声明](../../../dist/esm/kits/interaction/transfer.d.ts#L65) |
| `Interaction` | value + type | [声明](../../../dist/esm/kits/interaction/transfer.d.ts#L11) |
| `INTERACTION_CATEGORIES` | value | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L28) |
| `InteractionCategory` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L26) |
| `InteractionDescriptor` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L30) |
| `InteractionHandlers` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L41) |
| `InteractionProtocol` | value + type | [声明](../../../dist/esm/kits/interaction/transfer.d.ts#L11) |
| `InteractionProtocolDefinition` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L128) |
| `ProtocolCheck` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L47) |
| `ProtocolField` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L15) |
| `ProtocolPredicate` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L45) |
| `ProtocolReason` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L43) |
| `ProtocolShape` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L138) |
| `RegisteredProtocol` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L149) |

## @jangts/agent-core/kits/domains

[合同与行为](kits.md) · 35 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `AgentCatalogPorts` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L77) |
| `CatalogDomainTool` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L12) |
| `CatalogExecutionTool` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L29) |
| `CatalogGoal` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L12) |
| `CatalogScope` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L17) |
| `CatalogTask` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L22) |
| `CatalogTool` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L29) |
| `createDomainToolRegistry` | value | [声明](../../../dist/esm/kits/domains/registry.d.ts#L105) |
| `createGoalRegistry` | value | [声明](../../../dist/esm/kits/domains/registry.d.ts#L105) |
| `createScopeRegistry` | value | [声明](../../../dist/esm/kits/domains/scopes.d.ts#L165) |
| `defineAgentCatalog` | value | [声明](../../../dist/esm/kits/domains/catalog.d.ts#L16) |
| `DescribedTool` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L42) |
| `DomainTool` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L15) |
| `domainToolDelegates` | value | [声明](../../../dist/esm/kits/domains/catalog.d.ts#L78) |
| `DomainToolDescription` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L71) |
| `DomainToolId` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L75) |
| `DomainToolPolicy` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L44) |
| `DomainToolRegistration` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L42) |
| `DomainToolRegistry` | value + type | [声明](../../../dist/esm/kits/domains/registry.d.ts#L9) |
| `goalDelegates` | value | [声明](../../../dist/esm/kits/domains/catalog.d.ts#L78) |
| `GoalDescription` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L71) |
| `GoalId` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L75) |
| `GoalPolicy` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L44) |
| `GoalRegistry` | value + type | [声明](../../../dist/esm/kits/domains/registry.d.ts#L9) |
| `GoalTool` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L15) |
| `GoalToolRegistration` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L42) |
| `LegacyAgentCatalogPorts` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L51) |
| `RegisteredDomainTool` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L82) |
| `RegisteredGoal` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L82) |
| `RegisteredScope` | type | [声明](../../../dist/esm/structs/kits/domains/scopes.d.ts#L79) |
| `RegisteredScopeEvidence` | type | [声明](../../../dist/esm/structs/kits/domains/scopes.d.ts#L67) |
| `ScopeDefinition` | type | [声明](../../../dist/esm/structs/kits/domains/scopes.d.ts#L15) |
| `ScopeDescription` | type | [声明](../../../dist/esm/structs/kits/domains/scopes.d.ts#L83) |
| `ScopeRegistry` | value + type | [声明](../../../dist/esm/kits/domains/scopes.d.ts#L17) |
| `ScopeRegistryPolicy` | type | [声明](../../../dist/esm/structs/kits/domains/scopes.d.ts#L40) |

## @jangts/agent-core/kits/tools

[合同与行为](kits.md) · 21 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `LifecycleHooks` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L72) |
| `LifecycleProtocol` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L59) |
| `LifecycleTool` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L131) |
| `LifecycleToolRegistration` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L133) |
| `Policy` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L211)；Use ToolLifecyclePolicy. |
| `RegisteredLifecycleTool` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L142) |
| `RegisteredToolDefinition` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L142) |
| `Tool` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L219)；Use LifecycleTool and domainToolIds. |
| `ToolFinalizer` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L179) |
| `ToolJournal` | type | [声明](../../../dist/esm/structs/capabilities/invocation.d.ts#L31) |
| `ToolLifecycleHooks` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L72) |
| `ToolLifecyclePolicy` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L225) |
| `ToolLifecycleProtocol` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L59) |
| `ToolLifecycleRegistry` | value + type | [声明](../../../dist/esm/kits/tools.d.ts#L20) |
| `ToolLifecycleRegistryOptions` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L231) |
| `ToolModelField` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L44) |
| `ToolNormalizer` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L177) |
| `ToolProtocol` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L171) |
| `ToolRegistration` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L223)；Use LifecycleToolRegistration. |
| `ToolRuntimeTypes` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L25) |
| `ToolsOptions` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L215)；Use ToolLifecycleRegistryOptions. |

## @jangts/agent-core/support/context

[合同与行为](support.md) · 57 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `assembleFragments` | value | [声明](../../../dist/esm/context/assembly.d.ts#L14) |
| `BuiltContext` | type | [声明](../../../dist/esm/structs/context/fragments.d.ts#L45) |
| `commonPrefixLength` | value | [声明](../../../dist/esm/utils/text.d.ts#L16) |
| `ContextAssemblyOptions` | type | [声明](../../../dist/esm/structs/support/context.d.ts#L35) |
| `ContextBuilder` | type | [声明](../../../dist/esm/structs/support/context.d.ts#L49) |
| `ContextBuilderOptions` | type | [声明](../../../dist/esm/structs/support/context.d.ts#L28) |
| `ContextCompressionCall` | type | [声明](../../../dist/esm/structs/support/context-processing.d.ts#L160) |
| `ContextCompressor` | type | [声明](../../../dist/esm/structs/support/context-processing.d.ts#L169) |
| `ContextFragment` | type | [声明](../../../dist/esm/structs/context/fragments.d.ts#L17) |
| `ContextFragmentConfig` | type | [声明](../../../dist/esm/structs/support/context.d.ts#L42) |
| `ContextFragmentUsage` | type | [声明](../../../dist/esm/structs/context/fragments.d.ts#L34) |
| `contextHandlerCalls` | value | [声明](../../../dist/esm/support/context/selection-policy.d.ts#L19) |
| `ContextHandlerReference` | type | [声明](../../../dist/esm/structs/support/context-processing.d.ts#L36) |
| `ContextHistoryGrouping` | type | [声明](../../../dist/esm/structs/support/context-processing.d.ts#L20) |
| `contextHistoryStrategies` | value | [声明](../../../dist/esm/support/context/strategies.d.ts#L10) |
| `ContextLifetime` | type | [声明](../../../dist/esm/structs/context/fragments.d.ts#L15) |
| `ContextModelCall` | type | [声明](../../../dist/esm/structs/support/context-processing.d.ts#L221) |
| `ContextModelRequest` | type | [声明](../../../dist/esm/structs/support/context-processing.d.ts#L208) |
| `ContextNodeResult` | type | [声明](../../../dist/esm/support/context/nodes.d.ts#L7) |
| `ContextPlan` | type | [声明](../../../dist/esm/structs/context/processing.d.ts#L13) |
| `ContextPolicy` | type | [声明](../../../dist/esm/structs/support/context-processing.d.ts#L134) |
| `contextPolicyCatalog` | value | [声明](../../../dist/esm/support/context/processing.d.ts#L181) |
| `ContextProcessingNodeDefinition` | type | [声明](../../../dist/esm/support/context/nodes.d.ts#L22) |
| `ContextProcessingOptions` | type | [声明](../../../dist/esm/structs/support/context-processing.d.ts#L225) |
| `ContextProcessingReport` | type | [声明](../../../dist/esm/structs/support/context-processing.d.ts#L177) |
| `ContextProjection` | type | [声明](../../../dist/esm/structs/support/context.d.ts#L15) |
| `ContextRecentHistory` | type | [声明](../../../dist/esm/structs/support/context-processing.d.ts#L27) |
| `ContextReduction` | type | [声明](../../../dist/esm/structs/support/context-processing.d.ts#L41) |
| `contextReductionCatalog` | value | [声明](../../../dist/esm/support/context/processing.d.ts#L31) |
| `ContextReductionNodeDefinition` | type | [声明](../../../dist/esm/support/context/nodes.d.ts#L68) |
| `ContextSelection` | type | [声明](../../../dist/esm/structs/support/context-processing.d.ts#L62) |
| `ContextSelectionCall` | type | [声明](../../../dist/esm/structs/support/context-processing.d.ts#L108) |
| `ContextSelectionCandidate` | type | [声明](../../../dist/esm/structs/support/context-processing.d.ts#L84) |
| `contextSelectionCatalog` | value | [声明](../../../dist/esm/support/context/selection-policy.d.ts#L46) |
| `ContextSelectionNodeDefinition` | type | [声明](../../../dist/esm/support/context/nodes.d.ts#L59) |
| `ContextSelectionResult` | type | [声明](../../../dist/esm/support/context/nodes.d.ts#L54) |
| `ContextSelector` | type | [声明](../../../dist/esm/structs/support/context-processing.d.ts#L126) |
| `ContextStageResult` | type | [声明](../../../dist/esm/support/context/nodes.d.ts#L45) |
| `ContextStrategy` | type | [声明](../../../dist/esm/support/context/strategies.d.ts#L63) |
| `ContextStrategyOptions` | type | [声明](../../../dist/esm/support/context/strategies.d.ts#L57) |
| `ContextStrategySettings` | type | [声明](../../../dist/esm/support/context/strategies.d.ts#L39) |
| `ContextTokenMeasurement` | type | [声明](../../../dist/esm/structs/support/context-processing.d.ts#L100) |
| `ContextTrust` | type | [声明](../../../dist/esm/structs/context/fragments.d.ts#L13) |
| `createContextCompressor` | value | [声明](../../../dist/esm/support/context/compression.d.ts#L20) |
| `createContextProcessingNode` | value | [声明](../../../dist/esm/support/context/nodes.d.ts#L84) |
| `createContextReductionNode` | value | [声明](../../../dist/esm/support/context/nodes.d.ts#L107) |
| `createContextSelectionNode` | value | [声明](../../../dist/esm/support/context/nodes.d.ts#L95) |
| `createContextSelector` | value | [声明](../../../dist/esm/support/context/selection.d.ts#L16) |
| `createContextStrategy` | value | [声明](../../../dist/esm/support/context/strategies.d.ts#L85) |
| `defineContextAssembly` | value | [声明](../../../dist/esm/support/context/assembly.d.ts#L15) |
| `defineContextFragments` | value | [声明](../../../dist/esm/support/context/assembly.d.ts#L28) |
| `processContext` | value | [声明](../../../dist/esm/support/context/processing.d.ts#L235) |
| `reservedContextCalls` | value | [声明](../../../dist/esm/support/context/selection-policy.d.ts#L10) |
| `selectContextSteps` | value | [声明](../../../dist/esm/support/context/selection-policy.d.ts#L85) |
| `transformContextText` | value | [声明](../../../dist/esm/support/context/assembly.d.ts#L39) |
| `validateContextPolicy` | value | [声明](../../../dist/esm/support/context/processing.d.ts#L17) |
| `validateContextSelection` | value | [声明](../../../dist/esm/support/context/selection-policy.d.ts#L72) |

## @jangts/agent-core/support/model

[合同与行为](support.md) · 114 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `AggregatedToolCall` | type | [声明](../../../dist/esm/model/interactions/calls.d.ts#L13) |
| `assessModelBudget` | value | [声明](../../../dist/esm/support/model/budget-assessment.d.ts#L39) |
| `BackgroundModelInput` | type | [声明](../../../dist/esm/support/model/lifecycle/background.d.ts#L5) |
| `BudgetAssessment` | type | [声明](../../../dist/esm/support/model/budget-assessment.d.ts#L28) |
| `BudgetAssessmentInput` | type | [声明](../../../dist/esm/support/model/budget-assessment.d.ts#L15) |
| `chatCompletionFunctionOptions` | value | [声明](../../../dist/esm/support/model/chat-completions.d.ts#L22) |
| `chatCompletionMessages` | value | [声明](../../../dist/esm/support/model/chat-completions.d.ts#L47) |
| `chatCompletionParts` | value | [声明](../../../dist/esm/support/model/chat-completions.d.ts#L33) |
| `CompatibleModelConfig` | type | [声明](../../../dist/esm/structs/support/model/provider.d.ts#L74) |
| `CompatibleModelPorts` | type | [声明](../../../dist/esm/structs/support/model/provider.d.ts#L98) |
| `CompatibleModelProvider` | value + type | [声明](../../../dist/esm/support/model/compatible-provider.d.ts#L11) |
| `CompatibleModelProviderOptions` | type | [声明](../../../dist/esm/structs/support/model/provider.d.ts#L118) |
| `CompletionFailure` | type | [声明](../../../dist/esm/structs/support/model/completion.d.ts#L29) |
| `CompletionPolicy` | type | [声明](../../../dist/esm/structs/support/model/completion.d.ts#L40) |
| `completionPolicyCatalog` | value | [声明](../../../dist/esm/support/model/completion/index.d.ts#L7) |
| `CompletionRequestFacts` | type | [声明](../../../dist/esm/structs/support/model/completion.d.ts#L20) |
| `CompletionSession` | type | [声明](../../../dist/esm/structs/support/model/completion.d.ts#L31) |
| `connectModelWebRTC` | value | [声明](../../../dist/esm/support/model/lifecycle/realtime.d.ts#L31) |
| `connectModelWebSocket` | value | [声明](../../../dist/esm/support/model/lifecycle/realtime.d.ts#L24) |
| `createBackgroundModelProvider` | value | [声明](../../../dist/esm/support/model/lifecycle/background.d.ts#L10) |
| `createBatchModelProvider` | value | [声明](../../../dist/esm/support/model/lifecycle/batch.d.ts#L18) |
| `createJsonInteraction` | value | [声明](../../../dist/esm/support/model/transports.d.ts#L43) |
| `createJsonTransport` | value | [声明](../../../dist/esm/support/model/transports.d.ts#L43) |
| `createMemoryContinuationStore` | value | [声明](../../../dist/esm/support/model/continuation.d.ts#L17) |
| `createModelInteraction` | value | [声明](../../../dist/esm/support/model/transports.d.ts#L6) |
| `createModelProvider` | value | [声明](../../../dist/esm/support/model/provider-factory.d.ts#L35) |
| `createModelStrategy` | value | [声明](../../../dist/esm/support/model/strategies.d.ts#L75) |
| `createModelTransport` | value | [声明](../../../dist/esm/support/model/transports.d.ts#L6) |
| `createOperationHttpProvider` | value | [声明](../../../dist/esm/support/model/lifecycle/http.d.ts#L17) |
| `createProviderObservationScope` | value | [声明](../../../dist/esm/support/model/observer.d.ts#L32) |
| `createRealtimeProtocolProvider` | value | [声明](../../../dist/esm/support/model/lifecycle/realtime.d.ts#L10) |
| `createReplyPreviewRules` | value | [声明](../../../dist/esm/support/model/preview-rules.d.ts#L44) |
| `createStageModelInteraction` | value | [声明](../../../dist/esm/support/model/stage-transport.d.ts#L11) |
| `createStageModelTransport` | value | [声明](../../../dist/esm/support/model/stage-transport.d.ts#L11) |
| `createTextInteraction` | value | [声明](../../../dist/esm/support/model/transports.d.ts#L24) |
| `createTextTransport` | value | [声明](../../../dist/esm/support/model/transports.d.ts#L24) |
| `createToolCallCollector` | value | [声明](../../../dist/esm/model/interactions/calls.d.ts#L40) |
| `createWebSocketDuplex` | value | [声明](../../../dist/esm/support/model/lifecycle/realtime.d.ts#L18) |
| `DecodedModelResponseToolCall` | type | [声明](../../../dist/esm/support/model/session.d.ts#L7) |
| `DecodedModelToolResponse` | type | [声明](../../../dist/esm/support/model/session.d.ts#L16) |
| `DecodedSessionCall` | type | [声明](../../../dist/esm/support/model/session.d.ts#L7) |
| `DecodedSessionResult` | type | [声明](../../../dist/esm/support/model/session.d.ts#L16) |
| `defaultCompletionPolicy` | value | [声明](../../../dist/esm/support/model/completion/default.d.ts#L11) |
| `defineModelTools` | value | [声明](../../../dist/esm/support/model/capabilities.d.ts#L22) |
| `HostedToolEvent` | type | [声明](../../../dist/esm/support/model/protocols/hosted.d.ts#L4) |
| `jsonObjectInteraction` | value | [声明](../../../dist/esm/model/interactions/json-object.d.ts#L9) |
| `ModelBatchItem` | type | [声明](../../../dist/esm/support/model/lifecycle/batch.d.ts#L5) |
| `ModelBatchItemResult` | type | [声明](../../../dist/esm/support/model/lifecycle/batch.d.ts#L10) |
| `modelBudgetStrategies` | value | [声明](../../../dist/esm/support/model/strategies.d.ts#L11) |
| `ModelBudgetStrategy` | type | [声明](../../../dist/esm/support/model/strategies.d.ts#L35) |
| `ModelChildrenOptions` | type | [声明](../../../dist/esm/support/model/children.d.ts#L14) |
| `ModelChildTask` | type | [声明](../../../dist/esm/support/model/children.d.ts#L5) |
| `ModelChoiceIndex` | type | [声明](../../../dist/esm/structs/support/model/provider.d.ts#L113) |
| `ModelContinuationIdentity` | type | [声明](../../../dist/esm/support/model/continuation.d.ts#L7) |
| `ModelEndpointCapabilities` | type | [声明](../../../dist/esm/support/model/protocols/capabilities.d.ts#L3) |
| `ModelInteractionAdapter` | type | [声明](../../../dist/esm/structs/model/interactions.d.ts#L52) |
| `modelInteractionCatalog` | value | [声明](../../../dist/esm/support/model/interactions/index.d.ts#L6) |
| `ModelInteractionRegistration` | type | [声明](../../../dist/esm/structs/model/interactions.d.ts#L67) |
| `ModelProtocol` | type | [声明](../../../dist/esm/support/model/protocols/requests.d.ts#L3) |
| `modelProtocolCatalog` | value | [声明](../../../dist/esm/support/model/protocols/requests.d.ts#L5) |
| `ModelProviderConfig` | type | [声明](../../../dist/esm/support/model/provider-factory.d.ts#L11) |
| `ModelProviderErrorCode` | type | [声明](../../../dist/esm/structs/support/model/provider.d.ts#L15) |
| `ModelProviderFailure` | type | [声明](../../../dist/esm/structs/support/model/provider.d.ts#L37) |
| `ModelResourceInput` | type | [声明](../../../dist/esm/support/model/resources.d.ts#L20) |
| `ModelResourcePorts` | type | [声明](../../../dist/esm/support/model/resources.d.ts#L33) |
| `ModelResourceRunner` | type | [声明](../../../dist/esm/support/model/resources.d.ts#L25) |
| `ModelResourceSource` | type | [声明](../../../dist/esm/support/model/resources.d.ts#L8) |
| `ModelResponseCollector` | type | [声明](../../../dist/esm/structs/model/interactions.d.ts#L14) |
| `ModelStageInteractionRegistration` | type | [声明](../../../dist/esm/structs/support/model/interactions.d.ts#L15) |
| `ModelStageTransportRegistration` | type | [声明](../../../dist/esm/structs/support/model/interactions.d.ts#L15) |
| `ModelStrategyOptions` | type | [声明](../../../dist/esm/support/model/strategies.d.ts#L43) |
| `ModelToolInteractionOptions` | type | [声明](../../../dist/esm/support/model/session.d.ts#L27) |
| `ModelToolInteractionRegistration` | type | [声明](../../../dist/esm/support/model/session.d.ts#L33) |
| `ModelTransportRegistration` | type | [声明](../../../dist/esm/structs/model/interactions.d.ts#L67) |
| `NativeFunctionCall` | type | [声明](../../../dist/esm/structs/model/interactions.d.ts#L80) |
| `nativeFunctionInteraction` | value | [声明](../../../dist/esm/model/interactions/native-functions.d.ts#L8) |
| `openProtocolRealtime` | value | [声明](../../../dist/esm/support/model/lifecycle/session.d.ts#L6) |
| `OperationHttpConfig` | type | [声明](../../../dist/esm/support/model/lifecycle/http.d.ts#L3) |
| `parseModelContinuation` | value | [声明](../../../dist/esm/support/model/continuation.d.ts#L15) |
| `PreparedModelSelection` | type | [声明](../../../dist/esm/structs/model/interactions.d.ts#L32) |
| `PreparedModelToolInteraction` | type | [声明](../../../dist/esm/support/model/session.d.ts#L20) |
| `PreparedSessionTransport` | type | [声明](../../../dist/esm/support/model/session.d.ts#L20) |
| `prepareModelResources` | value | [声明](../../../dist/esm/support/model/resources.d.ts#L55) |
| `prepareModelToolInteraction` | value | [声明](../../../dist/esm/support/model/session.d.ts#L52) |
| `prepareSessionFunctions` | value | [声明](../../../dist/esm/support/model/session.d.ts#L52) |
| `PreviewTool` | type | [声明](../../../dist/esm/support/model/preview-rules.d.ts#L5) |
| `ProviderAssistantMessage` | type | [声明](../../../dist/esm/structs/support/model/messages.d.ts#L31) |
| `ProviderErrorCapture` | type | [声明](../../../dist/esm/structs/support/model/provider-observer.d.ts#L63) |
| `ProviderEventDescriptor` | type | [声明](../../../dist/esm/structs/support/model/provider-observer.d.ts#L44) |
| `ProviderEventName` | type | [声明](../../../dist/esm/structs/support/model/provider-observer.d.ts#L42) |
| `ProviderEventPayloads` | type | [声明](../../../dist/esm/structs/support/model/provider-observer.d.ts#L13) |
| `ProviderMessage` | type | [声明](../../../dist/esm/structs/support/model/messages.d.ts#L47) |
| `ProviderObservation` | type | [声明](../../../dist/esm/structs/support/model/provider-observer.d.ts#L49) |
| `ProviderObserver` | type | [声明](../../../dist/esm/structs/support/model/provider-observer.d.ts#L56) |
| `ProviderReasoningLevel` | type | [声明](../../../dist/esm/structs/support/model/provider.d.ts#L45) |
| `ProviderReasoningStrategy` | type | [声明](../../../dist/esm/structs/support/model/provider.d.ts#L52) |
| `ProviderSystemMessage` | type | [声明](../../../dist/esm/structs/support/model/messages.d.ts#L15) |
| `ProviderToolCall` | type | [声明](../../../dist/esm/structs/support/model/messages.d.ts#L13) |
| `ProviderToolMessage` | type | [声明](../../../dist/esm/structs/support/model/messages.d.ts#L39) |
| `ProviderUserMessage` | type | [声明](../../../dist/esm/structs/support/model/messages.d.ts#L23) |
| `realtimeFunctionResponse` | value | [声明](../../../dist/esm/support/model/lifecycle/realtime.d.ts#L14) |
| `realtimeInput` | value | [声明](../../../dist/esm/support/model/lifecycle/realtime.d.ts#L12) |
| `RealtimeProtocolConfig` | type | [声明](../../../dist/esm/support/model/lifecycle/realtime.d.ts#L3) |
| `realtimeToolResult` | value | [声明](../../../dist/esm/support/model/lifecycle/realtime.d.ts#L16) |
| `RemainingModelWork` | type | [声明](../../../dist/esm/support/model/budget-assessment.d.ts#L8) |
| `ReplyPreviewStage` | type | [声明](../../../dist/esm/support/model/preview-rules.d.ts#L25) |
| `ReplyPreviewTool` | type | [声明](../../../dist/esm/support/model/preview-rules.d.ts#L13) |
| `runChildren` | value | [声明](../../../dist/esm/support/model/children.d.ts#L37) |
| `serializeModelContinuation` | value | [声明](../../../dist/esm/support/model/continuation.d.ts#L13) |
| `sessionCompletionPolicy` | value | [声明](../../../dist/esm/support/model/completion/session.d.ts#L16) |
| `SessionFunctionOptions` | type | [声明](../../../dist/esm/support/model/session.d.ts#L27) |
| `SessionModelTransportRegistration` | type | [声明](../../../dist/esm/support/model/session.d.ts#L33) |
| `ToolCallCollector` | type | [声明](../../../dist/esm/model/interactions/calls.d.ts#L22) |
| `ToolCallFailure` | type | [声明](../../../dist/esm/model/interactions/calls.d.ts#L20) |

## @jangts/agent-core/kits

[合同与行为](kits.md) · 334 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `AgentCatalogPorts` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L77) |
| `AgentFamily` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L86) |
| `AgentOutputEvent` | type | [声明](../../../dist/esm/structs/kits/presentation/events.d.ts#L11) |
| `aggregateBranchResults` | value | [声明](../../../dist/esm/kits/aggregation.d.ts#L55) |
| `Aggregation` | value | [声明](../../../dist/esm/kits/aggregation.d.ts#L58) |
| `AnswerCheck` | type | [声明](../../../dist/esm/structs/kits/answering/flow.d.ts#L16) |
| `AnswerChecker` | type | [声明](../../../dist/esm/structs/kits/answering/checks.d.ts#L11) |
| `AnswerFlowDefinition` | type | [声明](../../../dist/esm/structs/kits/answering/flow.d.ts#L45) |
| `Answering` | value | [声明](../../../dist/esm/kits/answering/index.d.ts#L21) |
| `AnswerIssue` | type | [声明](../../../dist/esm/structs/kits/answering/flow.d.ts#L13) |
| `AnswerItem` | type | [声明](../../../dist/esm/structs/kits/answering/flow.d.ts#L19) |
| `AnswerReader` | type | [声明](../../../dist/esm/structs/kits/answering/tasks.d.ts#L38) |
| `AnswerResult` | type | [声明](../../../dist/esm/structs/kits/answering/flow.d.ts#L30) |
| `AnswerTaskBase` | type | [声明](../../../dist/esm/structs/kits/answering/tasks.d.ts#L11) |
| `AnswerTaskDefinition` | type | [声明](../../../dist/esm/structs/kits/answering/tasks.d.ts#L30) |
| `AnswerTaskPorts` | type | [声明](../../../dist/esm/structs/kits/answering/tasks.d.ts#L46) |
| `applyMemoryUpdate` | value | [声明](../../../dist/esm/kits/memory.d.ts#L131) |
| `ArtifactReference` | type | [声明](../../../dist/esm/structs/kits/artifacts.d.ts#L12) |
| `ArtifactResolver` | type | [声明](../../../dist/esm/structs/kits/artifacts.d.ts#L21) |
| `Artifacts` | value | [声明](../../../dist/esm/kits/artifacts.d.ts#L40) |
| `batchMemorySources` | value | [声明](../../../dist/esm/kits/memory.d.ts#L149) |
| `bindInteraction` | value | [声明](../../../dist/esm/kits/interaction/handlers.d.ts#L21) |
| `bindReviewChoiceDecision` | value | [声明](../../../dist/esm/kits/review-choice.d.ts#L9) |
| `BranchAggregationRequest` | type | [声明](../../../dist/esm/structs/kits/aggregation.d.ts#L29) |
| `BranchAggregationResult` | type | [声明](../../../dist/esm/structs/kits/aggregation.d.ts#L34) |
| `BranchResult` | type | [声明](../../../dist/esm/structs/kits/aggregation.d.ts#L19) |
| `BranchVersion` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L19) |
| `BranchVersioning` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L86) |
| `BranchVersioningDefinition` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L56) |
| `BranchVersionOperation` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L17) |
| `branchVersionOperations` | value | [声明](../../../dist/esm/structs/kits/family.d.ts#L15) |
| `BranchVersionRecord` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L36) |
| `BranchVersions` | value | [声明](../../../dist/esm/kits/family.d.ts#L19) |
| `BranchVersionStore` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L49) |
| `Candidates` | value | [声明](../../../dist/esm/kits/candidates.d.ts#L35) |
| `CandidateSelectionDefinition` | type | [声明](../../../dist/esm/structs/kits/candidates.d.ts#L16) |
| `CatalogDomainTool` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L12) |
| `CatalogExecutionTool` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L29) |
| `CatalogGoal` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L12) |
| `CatalogScope` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L17) |
| `CatalogTask` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L22) |
| `CatalogTool` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L29) |
| `checkReviewAdmission` | value | [声明](../../../dist/esm/kits/result-review.d.ts#L5) |
| `Command` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L93) |
| `CommandCatalog` | value + type | [声明](../../../dist/esm/kits/interaction/commands.d.ts#L19) |
| `CommandCatalogOptions` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L115) |
| `CommandDefinition` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L58) |
| `commandSchema` | value | [声明](../../../dist/esm/kits/interaction/command.d.ts#L41) |
| `compileCommands` | value | [声明](../../../dist/esm/kits/interaction/command.d.ts#L28) |
| `CompiledReplyFormat` | type | [声明](../../../dist/esm/structs/kits/presentation/formats.d.ts#L31) |
| `completeMemoryReview` | value | [声明](../../../dist/esm/kits/memory.d.ts#L156) |
| `CompletionCheck` | type | [声明](../../../dist/esm/kits/completion.d.ts#L18) |
| `CompletionDecision` | type | [声明](../../../dist/esm/kits/completion.d.ts#L7) |
| `CompletionReport` | type | [声明](../../../dist/esm/kits/completion.d.ts#L24) |
| `ContentProjection` | type | [声明](../../../dist/esm/structs/kits/projection.d.ts#L11) |
| `ContentProjectionOptions` | type | [声明](../../../dist/esm/structs/kits/projection.d.ts#L18) |
| `createDomainToolRegistry` | value | [声明](../../../dist/esm/kits/domains/registry.d.ts#L105) |
| `createGoalRegistry` | value | [声明](../../../dist/esm/kits/domains/registry.d.ts#L105) |
| `createScopeRegistry` | value | [声明](../../../dist/esm/kits/domains/scopes.d.ts#L165) |
| `defineAgentCatalog` | value | [声明](../../../dist/esm/kits/domains/catalog.d.ts#L16) |
| `defineAgentFamily` | value | [声明](../../../dist/esm/kits/family.d.ts#L17) |
| `defineAnswerCheckCatalog` | value | [声明](../../../dist/esm/kits/answering/checks.d.ts#L15) |
| `defineAnswerFlow` | value | [声明](../../../dist/esm/kits/answering/flow.d.ts#L17) |
| `defineAnswerReaderCatalog` | value | [声明](../../../dist/esm/kits/answering/tasks.d.ts#L10) |
| `defineAnswerTaskCatalog` | value | [声明](../../../dist/esm/kits/answering/tasks.d.ts#L30) |
| `defineArtifactCatalog` | value | [声明](../../../dist/esm/kits/artifacts.d.ts#L13) |
| `defineBranchVersioning` | value | [声明](../../../dist/esm/kits/family.d.ts#L17) |
| `defineCandidateSelection` | value | [声明](../../../dist/esm/kits/candidates.d.ts#L24) |
| `defineCommand` | value | [声明](../../../dist/esm/kits/interaction/command.d.ts#L15) |
| `defineCommandCatalog` | value | [声明](../../../dist/esm/kits/interaction/commands.d.ts#L89) |
| `defineCompletionChecks` | value | [声明](../../../dist/esm/kits/completion.d.ts#L36) |
| `defineContentProjection` | value | [声明](../../../dist/esm/kits/projection.d.ts#L15) |
| `defineDelivery` | value | [声明](../../../dist/esm/kits/delivery.d.ts#L47)；Use defineDeliveryPipeline. |
| `defineDeliveryPipeline` | value | [声明](../../../dist/esm/kits/delivery.d.ts#L16) |
| `defineDurableTask` | value | [声明](../../../dist/esm/kits/durable.d.ts#L19) |
| `defineEvidenceChecklist` | value | [声明](../../../dist/esm/kits/evidence.d.ts#L14) |
| `defineEvidenceProjection` | value | [声明](../../../dist/esm/kits/evidence.d.ts#L40) |
| `defineInteractionProtocol` | value | [声明](../../../dist/esm/kits/interaction/transfer.d.ts#L65) |
| `defineKnowledgeCatalog` | value | [声明](../../../dist/esm/kits/knowledge/catalog.d.ts#L15) |
| `defineKnowledgePublication` | value | [声明](../../../dist/esm/kits/knowledge/publication.d.ts#L17) |
| `defineNormalization` | value | [声明](../../../dist/esm/kits/normalization.d.ts#L15) |
| `defineOutputCatalog` | value | [声明](../../../dist/esm/kits/presentation/outputs.d.ts#L16) |
| `definePolicySet` | value | [声明](../../../dist/esm/kits/policies.d.ts#L14) |
| `defineQueryAggregation` | value | [声明](../../../dist/esm/kits/aggregation.d.ts#L29) |
| `defineRecoveryChain` | value | [声明](../../../dist/esm/kits/policies.d.ts#L40) |
| `defineReflection` | value | [声明](../../../dist/esm/kits/reflection.d.ts#L16) |
| `defineReflectionLogSource` | value | [声明](../../../dist/esm/kits/reflection-log-source.d.ts#L63) |
| `defineReplyFormats` | value | [声明](../../../dist/esm/kits/presentation/formats.d.ts#L38) |
| `defineResultReview` | value | [声明](../../../dist/esm/kits/result-review.d.ts#L3) |
| `defineRetrieval` | value | [声明](../../../dist/esm/kits/retrieval.d.ts#L18) |
| `defineReviewDecision` | value | [声明](../../../dist/esm/kits/review-decision.d.ts#L3) |
| `defineSemanticSlots` | value | [声明](../../../dist/esm/kits/presentation/templates.d.ts#L37) |
| `defineTextSkillLoader` | value | [声明](../../../dist/esm/kits/text-skills.d.ts#L16) |
| `defineTextTemplate` | value | [声明](../../../dist/esm/kits/presentation/templates.d.ts#L21) |
| `defineTreeProjection` | value | [声明](../../../dist/esm/kits/projection.d.ts#L48) |
| `defineWaitGate` | value | [声明](../../../dist/esm/kits/waiting.d.ts#L6) |
| `Delivery` | value | [声明](../../../dist/esm/kits/delivery.d.ts#L41)；Use DeliveryPipeline. Same immutable namespace and implementation. |
| `DeliveryOptions` | type | [声明](../../../dist/esm/structs/kits/delivery.d.ts#L41)；Use DeliveryPipelineOptions. |
| `DeliveryPipeline` | value | [声明](../../../dist/esm/kits/delivery.d.ts#L35) |
| `DeliveryPipelineOptions` | type | [声明](../../../dist/esm/structs/kits/delivery.d.ts#L25) |
| `DeliveryPipelineStage` | type | [声明](../../../dist/esm/structs/kits/delivery.d.ts#L13) |
| `DeliveryStage` | type | [声明](../../../dist/esm/structs/kits/delivery.d.ts#L39)；Use DeliveryPipelineStage. |
| `DescribedTool` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L42) |
| `DomainTool` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L15) |
| `domainToolDelegates` | value | [声明](../../../dist/esm/kits/domains/catalog.d.ts#L78) |
| `DomainToolDescription` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L71) |
| `DomainToolId` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L75) |
| `DomainToolPolicy` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L44) |
| `DomainToolRegistration` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L42) |
| `DomainToolRegistry` | value + type | [声明](../../../dist/esm/kits/domains/registry.d.ts#L9) |
| `Durable` | value | [声明](../../../dist/esm/kits/durable.d.ts#L22) |
| `DurableAuthorizationContext` | type | [声明](../../../dist/esm/structs/kits/durable.d.ts#L97) |
| `DurableCheckpoint` | type | [声明](../../../dist/esm/structs/kits/durable.d.ts#L24) |
| `DurableReconcileContext` | type | [声明](../../../dist/esm/structs/kits/durable.d.ts#L93) |
| `DurableReconciliation` | type | [声明](../../../dist/esm/structs/kits/durable.d.ts#L72) |
| `durableReplayPolicies` | value | [声明](../../../dist/esm/structs/kits/durable.d.ts#L22) |
| `durableStatuses` | value | [声明](../../../dist/esm/structs/kits/durable.d.ts#L15) |
| `DurableStep` | type | [声明](../../../dist/esm/structs/kits/durable.d.ts#L61) |
| `DurableStepContext` | type | [声明](../../../dist/esm/structs/kits/durable.d.ts#L82) |
| `DurableStore` | type | [声明](../../../dist/esm/structs/kits/durable.d.ts#L52) |
| `DurableTask` | type | [声明](../../../dist/esm/structs/kits/durable.d.ts#L120) |
| `DurableTaskDefinition` | type | [声明](../../../dist/esm/structs/kits/durable.d.ts#L101) |
| `DurableTaskOptions` | type | [声明](../../../dist/esm/structs/kits/durable.d.ts#L113) |
| `Evidence` | value | [声明](../../../dist/esm/kits/evidence.d.ts#L48) |
| `EvidenceProjectionDefinition` | type | [声明](../../../dist/esm/structs/kits/evidence.d.ts#L36) |
| `EvidenceProjectionProvider` | type | [声明](../../../dist/esm/structs/kits/evidence.d.ts#L29) |
| `EvidenceProvider` | type | [声明](../../../dist/esm/structs/kits/evidence.d.ts#L21) |
| `EvidenceRequirement` | type | [声明](../../../dist/esm/structs/kits/evidence.d.ts#L12) |
| `Family` | value | [声明](../../../dist/esm/kits/family.d.ts#L19) |
| `FamilyDefinition` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L56) |
| `FamilyOperation` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L17) |
| `familyOperations` | value | [声明](../../../dist/esm/structs/kits/family.d.ts#L15) |
| `FamilyRecord` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L36) |
| `FamilyStore` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L49) |
| `FamilyVersion` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L19) |
| `FusedRank` | type | [声明](../../../dist/esm/kits/rank-fusion.d.ts#L11) |
| `goalDelegates` | value | [声明](../../../dist/esm/kits/domains/catalog.d.ts#L78) |
| `GoalDescription` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L71) |
| `GoalId` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L75) |
| `GoalPolicy` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L44) |
| `GoalRegistry` | value + type | [声明](../../../dist/esm/kits/domains/registry.d.ts#L9) |
| `GoalTool` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L15) |
| `GoalToolRegistration` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L42) |
| `inspectReviewChoices` | value | [声明](../../../dist/esm/kits/review-choice.d.ts#L7) |
| `Interaction` | value + type | [声明](../../../dist/esm/kits/interaction/transfer.d.ts#L11) |
| `INTERACTION_CATEGORIES` | value | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L28) |
| `InteractionCategory` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L26) |
| `InteractionDescriptor` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L30) |
| `InteractionHandlers` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L41) |
| `InteractionProtocol` | value + type | [声明](../../../dist/esm/kits/interaction/transfer.d.ts#L11) |
| `InteractionProtocolDefinition` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L128) |
| `isMemoryState` | value | [声明](../../../dist/esm/kits/memory.d.ts#L59) |
| `isReviewChoice` | value | [声明](../../../dist/esm/kits/review-choice.d.ts#L5) |
| `isReviewChoiceAnswer` | value | [声明](../../../dist/esm/kits/review-choice.d.ts#L3) |
| `Knowledge` | value | [声明](../../../dist/esm/kits/knowledge/index.d.ts#L18) |
| `KnowledgeCandidate` | type | [声明](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L26) |
| `KnowledgeCatalog` | type | [声明](../../../dist/esm/structs/kits/knowledge.d.ts#L67) |
| `KnowledgeCatalogOptions` | type | [声明](../../../dist/esm/structs/kits/knowledge.d.ts#L60) |
| `KnowledgeDocument` | type | [声明](../../../dist/esm/structs/kits/knowledge.d.ts#L22) |
| `KnowledgePart` | type | [声明](../../../dist/esm/structs/kits/knowledge.d.ts#L20) |
| `KnowledgePublication` | type | [声明](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L76) |
| `knowledgePublicationOperations` | value | [声明](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L15) |
| `KnowledgePublicationOptions` | type | [声明](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L58) |
| `KnowledgePublicationRecord` | type | [声明](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L40) |
| `KnowledgePublicationStore` | type | [声明](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L51) |
| `KnowledgeRead` | type | [声明](../../../dist/esm/structs/kits/knowledge.d.ts#L44) |
| `KnowledgeSection` | type | [声明](../../../dist/esm/structs/kits/knowledge.d.ts#L13) |
| `KnowledgeSnapshot` | type | [声明](../../../dist/esm/structs/kits/knowledge.d.ts#L50) |
| `KnowledgeSourceReference` | type | [声明](../../../dist/esm/structs/kits/knowledge-publication.d.ts#L17) |
| `LegacyAgentCatalogPorts` | type | [声明](../../../dist/esm/structs/kits/domains/catalog.d.ts#L51) |
| `LifecycleHooks` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L72) |
| `LifecycleProtocol` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L59) |
| `LifecycleTool` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L131) |
| `LifecycleToolRegistration` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L133) |
| `memoryContext` | value | [声明](../../../dist/esm/kits/memory.d.ts#L135) |
| `MemoryEntry` | type | [声明](../../../dist/esm/kits/memory.d.ts#L24) |
| `memoryModelView` | value | [声明](../../../dist/esm/kits/memory.d.ts#L158) |
| `MemoryOperation` | type | [声明](../../../dist/esm/kits/memory.d.ts#L11) |
| `memoryReviewBatch` | value | [声明](../../../dist/esm/kits/memory.d.ts#L154) |
| `MemorySource` | type | [声明](../../../dist/esm/kits/memory.d.ts#L1) |
| `MemoryState` | type | [声明](../../../dist/esm/kits/memory.d.ts#L47) |
| `memoryUpdateInstruction` | value | [声明](../../../dist/esm/kits/memory.d.ts#L147) |
| `memoryUpdateSchema` | value | [声明](../../../dist/esm/kits/memory.d.ts#L61) |
| `mergeByKey` | value | [声明](../../../dist/esm/kits/aggregation.d.ts#L14) |
| `mergeReplyBubbles` | value | [声明](../../../dist/esm/kits/presentation/formats.d.ts#L29) |
| `ModelBinding` | type | [声明](../../../dist/esm/kits/inference.d.ts#L15) |
| `ModelCalls` | value + type | [声明](../../../dist/esm/kits/inference.d.ts#L61) |
| `ModelInvocationContext` | type | [声明](../../../dist/esm/kits/inference.d.ts#L28) |
| `ModelInvocationRequest` | type | [声明](../../../dist/esm/kits/inference.d.ts#L37) |
| `Normalization` | value | [声明](../../../dist/esm/kits/normalization.d.ts#L37) |
| `NormalizationOptions` | type | [声明](../../../dist/esm/structs/kits/normalization.d.ts#L20) |
| `NormalizationStep` | type | [声明](../../../dist/esm/structs/kits/normalization.d.ts#L11) |
| `OutputCatalogOptions` | type | [声明](../../../dist/esm/structs/kits/presentation/outputs.d.ts#L77) |
| `OutputComposeInput` | type | [声明](../../../dist/esm/structs/kits/presentation/outputs.d.ts#L60) |
| `OutputDefinition` | type | [声明](../../../dist/esm/structs/kits/presentation/outputs.d.ts#L33) |
| `OutputField` | type | [声明](../../../dist/esm/structs/kits/presentation/outputs.d.ts#L13) |
| `OutputIssue` | type | [声明](../../../dist/esm/structs/kits/presentation/outputs.d.ts#L56) |
| `OutputProvider` | type | [声明](../../../dist/esm/structs/kits/presentation/outputs.d.ts#L48) |
| `OutputResult` | type | [声明](../../../dist/esm/structs/kits/presentation/outputs.d.ts#L71) |
| `parseKnowledgeDocument` | value | [声明](../../../dist/esm/kits/knowledge/sections.d.ts#L18) |
| `Policies` | value | [声明](../../../dist/esm/kits/policies.d.ts#L72) |
| `Policy` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L211)；Use ToolLifecyclePolicy. |
| `PolicyAssessment` | type | [声明](../../../dist/esm/structs/kits/policies.d.ts#L22) |
| `PolicyDefinition` | type | [声明](../../../dist/esm/structs/kits/policies.d.ts#L11) |
| `Presentation` | value | [声明](../../../dist/esm/kits/presentation/index.d.ts#L25) |
| `projectContinuousExcerpt` | value | [声明](../../../dist/esm/kits/projection.d.ts#L34) |
| `Projection` | value | [声明](../../../dist/esm/kits/projection.d.ts#L53) |
| `ProtocolCheck` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L47) |
| `ProtocolField` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L15) |
| `ProtocolPredicate` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L45) |
| `ProtocolReason` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L43) |
| `ProtocolShape` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L138) |
| `publishReplyEvents` | value | [声明](../../../dist/esm/kits/presentation/events.d.ts#L40) |
| `QueryAggregationOptions` | type | [声明](../../../dist/esm/structs/kits/aggregation.d.ts#L10) |
| `RankedList` | type | [声明](../../../dist/esm/kits/rank-fusion.d.ts#L2) |
| `reciprocalRankFusion` | value | [声明](../../../dist/esm/kits/rank-fusion.d.ts#L36) |
| `RecoveryDefinition` | type | [声明](../../../dist/esm/structs/kits/policies.d.ts#L40) |
| `RecoveryResult` | type | [声明](../../../dist/esm/structs/kits/policies.d.ts#L31) |
| `Reflection` | value | [声明](../../../dist/esm/kits/reflection.d.ts#L18) |
| `ReflectionDefinition` | type | [声明](../../../dist/esm/structs/kits/reflection.d.ts#L108) |
| `ReflectionEvidence` | type | [声明](../../../dist/esm/structs/kits/reflection.d.ts#L20) |
| `ReflectionFinding` | type | [声明](../../../dist/esm/structs/kits/reflection.d.ts#L80) |
| `reflectionFindingKinds` | value | [声明](../../../dist/esm/structs/kits/reflection.d.ts#L78) |
| `reflectionIdentityFields` | value | [声明](../../../dist/esm/structs/kits/reflection.d.ts#L18) |
| `ReflectionLogReader` | type | [声明](../../../dist/esm/kits/reflection-log-source.d.ts#L20) |
| `ReflectionPage` | type | [声明](../../../dist/esm/structs/kits/reflection.d.ts#L54) |
| `ReflectionQuery` | type | [声明](../../../dist/esm/structs/kits/reflection.d.ts#L43) |
| `ReflectionReport` | type | [声明](../../../dist/esm/structs/kits/reflection.d.ts#L89) |
| `ReflectionSource` | type | [声明](../../../dist/esm/structs/kits/reflection.d.ts#L69) |
| `ReflectionTask` | type | [声明](../../../dist/esm/structs/kits/reflection.d.ts#L131) |
| `RegisteredDomainTool` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L82) |
| `RegisteredGoal` | type | [声明](../../../dist/esm/structs/kits/domains/registry.d.ts#L82) |
| `RegisteredLifecycleTool` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L142) |
| `RegisteredProtocol` | type | [声明](../../../dist/esm/structs/kits/interaction.d.ts#L149) |
| `RegisteredScope` | type | [声明](../../../dist/esm/structs/kits/domains/scopes.d.ts#L79) |
| `RegisteredScopeEvidence` | type | [声明](../../../dist/esm/structs/kits/domains/scopes.d.ts#L67) |
| `RegisteredToolDefinition` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L142) |
| `REPLY_BUBBLE_BOUNDARY` | value | [声明](../../../dist/esm/kits/presentation/events.d.ts#L19) |
| `ReplyBubbleInput` | type | [声明](../../../dist/esm/structs/kits/presentation/events.d.ts#L32) |
| `replyBubbleTexts` | value | [声明](../../../dist/esm/kits/presentation/events.d.ts#L26) |
| `ReplyDeliveryOptions` | type | [声明](../../../dist/esm/structs/kits/presentation/events.d.ts#L39) |
| `ReplyFormatCheck` | type | [声明](../../../dist/esm/structs/kits/presentation/formats.d.ts#L11) |
| `replyFormatChecks` | value | [声明](../../../dist/esm/kits/presentation/formats.d.ts#L5) |
| `ReplyFormatDefinition` | type | [声明](../../../dist/esm/structs/kits/presentation/formats.d.ts#L20) |
| `ReplyFormatOptions` | type | [声明](../../../dist/esm/structs/kits/presentation/formats.d.ts#L39) |
| `resolvePreference` | value | [声明](../../../dist/esm/kits/presentation/variants.d.ts#L34) |
| `ResultReview` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L98) |
| `ResultReviewAdmissionRequest` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L105) |
| `ResultReviewCandidate` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L30) |
| `ResultReviewCoverage` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L45) |
| `ResultReviewDefinition` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L93) |
| `ResultReviewDetector` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L59) |
| `ResultReviewFinding` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L35) |
| `ResultReviewInput` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L12) |
| `ResultReviewRequest` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L24) |
| `ResultReviewResolution` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L74) |
| `ResultReviewResult` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L53) |
| `ResultReviewScope` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L4) |
| `ResultReviewStrategy` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L82) |
| `Retrieval` | value | [声明](../../../dist/esm/kits/retrieval.d.ts#L23) |
| `RetrievalDefinition` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L96) |
| `RetrievalEffect` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L49) |
| `RetrievalPorts` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L56) |
| `retrievalQueryKey` | value | [声明](../../../dist/esm/utils/query-key.d.ts#L12) |
| `RetrievalReason` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L47) |
| `RetrievalReceipt` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L30) |
| `RetrievalResult` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L17) |
| `RetrievalRunner` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L87) |
| `RetrievalSource` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L13) |
| `RetrievalState` | type | [声明](../../../dist/esm/structs/kits/retrieval.d.ts#L21) |
| `ReviewChoice` | type | [声明](../../../dist/esm/structs/kits/review-choice.d.ts#L21) |
| `ReviewChoiceAnswer` | type | [声明](../../../dist/esm/structs/kits/review-choice.d.ts#L16) |
| `ReviewChoiceDecision` | type | [声明](../../../dist/esm/structs/kits/review-choice.d.ts#L53) |
| `ReviewChoiceHost` | type | [声明](../../../dist/esm/structs/kits/review-choice.d.ts#L46) |
| `ReviewChoiceInput` | type | [声明](../../../dist/esm/structs/kits/review-choice.d.ts#L10) |
| `ReviewChoiceInspection` | type | [声明](../../../dist/esm/structs/kits/review-choice.d.ts#L34) |
| `ReviewDecision` | type | [声明](../../../dist/esm/structs/kits/review-decision.d.ts#L47) |
| `ReviewDecisionBinding` | type | [声明](../../../dist/esm/structs/kits/review-decision.d.ts#L5) |
| `ReviewDecisionDefinition` | type | [声明](../../../dist/esm/structs/kits/review-decision.d.ts#L26) |
| `ReviewDecisionState` | type | [声明](../../../dist/esm/structs/kits/review-decision.d.ts#L16) |
| `reviewMemorySources` | value | [声明](../../../dist/esm/kits/memory.d.ts#L133) |
| `ScopeDefinition` | type | [声明](../../../dist/esm/structs/kits/domains/scopes.d.ts#L15) |
| `ScopeDescription` | type | [声明](../../../dist/esm/structs/kits/domains/scopes.d.ts#L83) |
| `ScopeRegistry` | value + type | [声明](../../../dist/esm/kits/domains/scopes.d.ts#L17) |
| `ScopeRegistryPolicy` | type | [声明](../../../dist/esm/structs/kits/domains/scopes.d.ts#L40) |
| `SectionSelection` | type | [声明](../../../dist/esm/structs/kits/knowledge.d.ts#L33) |
| `selectVariant` | value | [声明](../../../dist/esm/kits/presentation/variants.d.ts#L20) |
| `SemanticSlotDefinition` | type | [声明](../../../dist/esm/structs/kits/presentation/templates.d.ts#L19) |
| `serializeOutputEvents` | value | [声明](../../../dist/esm/kits/presentation/events.d.ts#L53) |
| `splitTextBlocks` | value | [声明](../../../dist/esm/kits/text-blocks.d.ts#L19) |
| `TextBlock` | type | [声明](../../../dist/esm/structs/kits/text-blocks.d.ts#L11) |
| `TextBlockOptions` | type | [声明](../../../dist/esm/structs/kits/text-blocks.d.ts#L22) |
| `TextBlocks` | value | [声明](../../../dist/esm/kits/text-blocks.d.ts#L21) |
| `textOutputEvents` | value | [声明](../../../dist/esm/kits/presentation/events.d.ts#L60) |
| `TextSearch` | value + type | [声明](../../../dist/esm/kits/search.d.ts#L8) |
| `TextSearchHit` | type | [声明](../../../dist/esm/structs/kits/search.d.ts#L29) |
| `TextSearchOptions` | type | [声明](../../../dist/esm/structs/kits/search.d.ts#L12) |
| `TextSearchQuery` | type | [声明](../../../dist/esm/structs/kits/search.d.ts#L36) |
| `TextSearchSnapshot` | type | [声明](../../../dist/esm/structs/kits/search.d.ts#L47) |
| `TextSkill` | type | [声明](../../../dist/esm/structs/kits/text-skills.d.ts#L24) |
| `TextSkillHeader` | type | [声明](../../../dist/esm/structs/kits/text-skills.d.ts#L31) |
| `TextSkillLoader` | type | [声明](../../../dist/esm/structs/kits/text-skills.d.ts#L61) |
| `TextSkillLoaderDefinition` | type | [声明](../../../dist/esm/structs/kits/text-skills.d.ts#L36) |
| `TextSkillReadPorts` | type | [声明](../../../dist/esm/structs/kits/text-skills.d.ts#L56) |
| `TextSkillRegistration` | type | [声明](../../../dist/esm/structs/kits/text-skills.d.ts#L13) |
| `TextSkills` | value | [声明](../../../dist/esm/kits/text-skills.d.ts#L19) |
| `TextTemplateOptions` | type | [声明](../../../dist/esm/structs/kits/presentation/templates.d.ts#L10) |
| `Tool` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L219)；Use LifecycleTool and domainToolIds. |
| `ToolFinalizer` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L179) |
| `ToolJournal` | type | [声明](../../../dist/esm/structs/capabilities/invocation.d.ts#L31) |
| `ToolLifecycleHooks` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L72) |
| `ToolLifecyclePolicy` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L225) |
| `ToolLifecycleProtocol` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L59) |
| `ToolLifecycleRegistry` | value + type | [声明](../../../dist/esm/kits/tools.d.ts#L20) |
| `ToolLifecycleRegistryOptions` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L231) |
| `ToolModelField` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L44) |
| `ToolNormalizer` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L177) |
| `ToolProtocol` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L171) |
| `ToolRegistration` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L223)；Use LifecycleToolRegistration. |
| `ToolRuntimeTypes` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L25) |
| `ToolsOptions` | type | [声明](../../../dist/esm/structs/kits/tools.d.ts#L215)；Use ToolLifecycleRegistryOptions. |
| `TreeProjectionOptions` | type | [声明](../../../dist/esm/structs/kits/projection.d.ts#L29) |
| `uniqueBy` | value | [声明](../../../dist/esm/kits/normalization.d.ts#L34) |
| `validateAnswerBatch` | value | [声明](../../../dist/esm/kits/answering/batch.d.ts#L19) |
| `VectorSearch` | value + type | [声明](../../../dist/esm/kits/vector-search.d.ts#L38) |
| `VectorSearchHit` | type | [声明](../../../dist/esm/kits/vector-search.d.ts#L19) |
| `VectorSearchQuery` | type | [声明](../../../dist/esm/kits/vector-search.d.ts#L22) |
| `VectorSearchSpace` | type | [声明](../../../dist/esm/kits/vector-search.d.ts#L12) |
| `WaitGate` | type | [声明](../../../dist/esm/structs/kits/waiting.d.ts#L47) |
| `WaitGateDefinition` | type | [声明](../../../dist/esm/structs/kits/waiting.d.ts#L33) |
| `WaitGateOptions` | type | [声明](../../../dist/esm/structs/kits/waiting.d.ts#L42) |
| `WaitIdentity` | type | [声明](../../../dist/esm/structs/kits/waiting.d.ts#L4) |
| `WaitRecord` | type | [声明](../../../dist/esm/structs/kits/waiting.d.ts#L10) |
| `WaitStore` | type | [声明](../../../dist/esm/structs/kits/waiting.d.ts#L27) |

## @jangts/agent-core/mock

[合同与行为](mock.md) · 26 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `CallRecord` | type | [声明](../../../dist/esm/mock.d.ts#L8) |
| `encodeModelResponse` | value | [声明](../../../dist/esm/mock.d.ts#L8) |
| `Generated` | type | [声明](../../../dist/esm/mock.d.ts#L8) |
| `GenerationContext` | type | [声明](../../../dist/esm/mock.d.ts#L8) |
| `GenerationInput` | type | [声明](../../../dist/esm/mock.d.ts#L8) |
| `GenerationOptions` | type | [声明](../../../dist/esm/mock.d.ts#L8) |
| `Generator` | type | [声明](../../../dist/esm/mock.d.ts#L8) |
| `generatorNames` | value | [声明](../../../dist/esm/mock.d.ts#L8) |
| `generators` | value | [声明](../../../dist/esm/mock.d.ts#L8) |
| `HttpFault` | type | [声明](../../../dist/esm/mock.d.ts#L8) |
| `JsonValue` | type | [声明](../../../dist/esm/mock.d.ts#L8) |
| `Message` | type | [声明](../../../dist/esm/mock.d.ts#L8) |
| `MockGPT` | value + type | [声明](../../../dist/esm/mock.d.ts#L8) |
| `MockGPTError` | value + type | [声明](../../../dist/esm/mock.d.ts#L8) |
| `MockGPTOptions` | type | [声明](../../../dist/esm/mock.d.ts#L8) |
| `ModelOutput` | type | [声明](../../../dist/esm/mock.d.ts#L8) |
| `ModelRequest` | type | [声明](../../../dist/esm/mock.d.ts#L8) |
| `OutputOptions` | type | [声明](../../../dist/esm/mock.d.ts#L8) |
| `ResponseDescription` | value + type | [声明](../../../dist/esm/mock.d.ts#L8) |
| `responses` | value | [声明](../../../dist/esm/mock.d.ts#L8) |
| `routes` | value | [声明](../../../dist/esm/mock.d.ts#L8) |
| `Rule` | type | [声明](../../../dist/esm/mock.d.ts#L8) |
| `TextOptions` | type | [声明](../../../dist/esm/mock.d.ts#L8) |
| `TextSource` | type | [声明](../../../dist/esm/mock.d.ts#L8) |
| `ToolCall` | type | [声明](../../../dist/esm/mock.d.ts#L8) |
| `Usage` | type | [声明](../../../dist/esm/mock.d.ts#L8) |

## @jangts/agent-core/kits/search

[合同与行为](kits.md) · 5 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `TextSearch` | value + type | [声明](../../../dist/esm/kits/search.d.ts#L8) |
| `TextSearchHit` | type | [声明](../../../dist/esm/structs/kits/search.d.ts#L29) |
| `TextSearchOptions` | type | [声明](../../../dist/esm/structs/kits/search.d.ts#L12) |
| `TextSearchQuery` | type | [声明](../../../dist/esm/structs/kits/search.d.ts#L36) |
| `TextSearchSnapshot` | type | [声明](../../../dist/esm/structs/kits/search.d.ts#L47) |

## @jangts/agent-core/kits/text-blocks

[合同与行为](kits.md) · 4 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `splitTextBlocks` | value | [声明](../../../dist/esm/kits/text-blocks.d.ts#L19) |
| `TextBlock` | type | [声明](../../../dist/esm/structs/kits/text-blocks.d.ts#L11) |
| `TextBlockOptions` | type | [声明](../../../dist/esm/structs/kits/text-blocks.d.ts#L22) |
| `TextBlocks` | value | [声明](../../../dist/esm/kits/text-blocks.d.ts#L21) |

## @jangts/agent-core/kits/inference

[合同与行为](kits.md) · 4 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `ModelBinding` | type | [声明](../../../dist/esm/kits/inference.d.ts#L15) |
| `ModelCalls` | value + type | [声明](../../../dist/esm/kits/inference.d.ts#L61) |
| `ModelInvocationContext` | type | [声明](../../../dist/esm/kits/inference.d.ts#L28) |
| `ModelInvocationRequest` | type | [声明](../../../dist/esm/kits/inference.d.ts#L37) |

## @jangts/agent-core/kits/vector-search

[合同与行为](kits.md) · 4 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `VectorSearch` | value + type | [声明](../../../dist/esm/kits/vector-search.d.ts#L38) |
| `VectorSearchHit` | type | [声明](../../../dist/esm/kits/vector-search.d.ts#L19) |
| `VectorSearchQuery` | type | [声明](../../../dist/esm/kits/vector-search.d.ts#L22) |
| `VectorSearchSpace` | type | [声明](../../../dist/esm/kits/vector-search.d.ts#L12) |

## @jangts/agent-core/kits/rank-fusion

[合同与行为](kits.md) · 3 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `FusedRank` | type | [声明](../../../dist/esm/kits/rank-fusion.d.ts#L11) |
| `RankedList` | type | [声明](../../../dist/esm/kits/rank-fusion.d.ts#L2) |
| `reciprocalRankFusion` | value | [声明](../../../dist/esm/kits/rank-fusion.d.ts#L36) |

## @jangts/agent-core/kits/artifacts

[合同与行为](kits.md) · 4 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `ArtifactReference` | type | [声明](../../../dist/esm/structs/kits/artifacts.d.ts#L12) |
| `ArtifactResolver` | type | [声明](../../../dist/esm/structs/kits/artifacts.d.ts#L21) |
| `Artifacts` | value | [声明](../../../dist/esm/kits/artifacts.d.ts#L40) |
| `defineArtifactCatalog` | value | [声明](../../../dist/esm/kits/artifacts.d.ts#L13) |

## @jangts/agent-core/kits/durable

[合同与行为](kits.md) · 14 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `defineDurableTask` | value | [声明](../../../dist/esm/kits/durable.d.ts#L19) |
| `Durable` | value | [声明](../../../dist/esm/kits/durable.d.ts#L22) |
| `DurableAuthorizationContext` | type | [声明](../../../dist/esm/structs/kits/durable.d.ts#L97) |
| `DurableCheckpoint` | type | [声明](../../../dist/esm/structs/kits/durable.d.ts#L24) |
| `DurableReconcileContext` | type | [声明](../../../dist/esm/structs/kits/durable.d.ts#L93) |
| `DurableReconciliation` | type | [声明](../../../dist/esm/structs/kits/durable.d.ts#L72) |
| `durableReplayPolicies` | value | [声明](../../../dist/esm/structs/kits/durable.d.ts#L22) |
| `durableStatuses` | value | [声明](../../../dist/esm/structs/kits/durable.d.ts#L15) |
| `DurableStep` | type | [声明](../../../dist/esm/structs/kits/durable.d.ts#L61) |
| `DurableStepContext` | type | [声明](../../../dist/esm/structs/kits/durable.d.ts#L82) |
| `DurableStore` | type | [声明](../../../dist/esm/structs/kits/durable.d.ts#L52) |
| `DurableTask` | type | [声明](../../../dist/esm/structs/kits/durable.d.ts#L120) |
| `DurableTaskDefinition` | type | [声明](../../../dist/esm/structs/kits/durable.d.ts#L101) |
| `DurableTaskOptions` | type | [声明](../../../dist/esm/structs/kits/durable.d.ts#L113) |

## @jangts/agent-core/kits/result-review

[合同与行为](kits.md) · 15 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `checkReviewAdmission` | value | [声明](../../../dist/esm/kits/result-review.d.ts#L5) |
| `defineResultReview` | value | [声明](../../../dist/esm/kits/result-review.d.ts#L3) |
| `ResultReview` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L98) |
| `ResultReviewAdmissionRequest` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L105) |
| `ResultReviewCandidate` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L30) |
| `ResultReviewCoverage` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L45) |
| `ResultReviewDefinition` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L93) |
| `ResultReviewDetector` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L59) |
| `ResultReviewFinding` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L35) |
| `ResultReviewInput` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L12) |
| `ResultReviewRequest` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L24) |
| `ResultReviewResolution` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L74) |
| `ResultReviewResult` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L53) |
| `ResultReviewScope` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L4) |
| `ResultReviewStrategy` | type | [声明](../../../dist/esm/structs/kits/result-review.d.ts#L82) |

## @jangts/agent-core/kits/review-choice

[合同与行为](kits.md) · 10 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `bindReviewChoiceDecision` | value | [声明](../../../dist/esm/kits/review-choice.d.ts#L9) |
| `inspectReviewChoices` | value | [声明](../../../dist/esm/kits/review-choice.d.ts#L7) |
| `isReviewChoice` | value | [声明](../../../dist/esm/kits/review-choice.d.ts#L5) |
| `isReviewChoiceAnswer` | value | [声明](../../../dist/esm/kits/review-choice.d.ts#L3) |
| `ReviewChoice` | type | [声明](../../../dist/esm/structs/kits/review-choice.d.ts#L21) |
| `ReviewChoiceAnswer` | type | [声明](../../../dist/esm/structs/kits/review-choice.d.ts#L16) |
| `ReviewChoiceDecision` | type | [声明](../../../dist/esm/structs/kits/review-choice.d.ts#L53) |
| `ReviewChoiceHost` | type | [声明](../../../dist/esm/structs/kits/review-choice.d.ts#L46) |
| `ReviewChoiceInput` | type | [声明](../../../dist/esm/structs/kits/review-choice.d.ts#L10) |
| `ReviewChoiceInspection` | type | [声明](../../../dist/esm/structs/kits/review-choice.d.ts#L34) |

## @jangts/agent-core/kits/review-decision

[合同与行为](kits.md) · 5 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `defineReviewDecision` | value | [声明](../../../dist/esm/kits/review-decision.d.ts#L3) |
| `ReviewDecision` | type | [声明](../../../dist/esm/structs/kits/review-decision.d.ts#L47) |
| `ReviewDecisionBinding` | type | [声明](../../../dist/esm/structs/kits/review-decision.d.ts#L5) |
| `ReviewDecisionDefinition` | type | [声明](../../../dist/esm/structs/kits/review-decision.d.ts#L26) |
| `ReviewDecisionState` | type | [声明](../../../dist/esm/structs/kits/review-decision.d.ts#L16) |

## @jangts/agent-core/kits/waiting

[合同与行为](kits.md) · 7 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `defineWaitGate` | value | [声明](../../../dist/esm/kits/waiting.d.ts#L6) |
| `WaitGate` | type | [声明](../../../dist/esm/structs/kits/waiting.d.ts#L47) |
| `WaitGateDefinition` | type | [声明](../../../dist/esm/structs/kits/waiting.d.ts#L33) |
| `WaitGateOptions` | type | [声明](../../../dist/esm/structs/kits/waiting.d.ts#L42) |
| `WaitIdentity` | type | [声明](../../../dist/esm/structs/kits/waiting.d.ts#L4) |
| `WaitRecord` | type | [声明](../../../dist/esm/structs/kits/waiting.d.ts#L10) |
| `WaitStore` | type | [声明](../../../dist/esm/structs/kits/waiting.d.ts#L27) |

## @jangts/agent-core/kits/family

[合同与行为](kits.md) · 18 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `AgentFamily` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L86) |
| `BranchVersion` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L19) |
| `BranchVersioning` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L86) |
| `BranchVersioningDefinition` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L56) |
| `BranchVersionOperation` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L17) |
| `branchVersionOperations` | value | [声明](../../../dist/esm/structs/kits/family.d.ts#L15) |
| `BranchVersionRecord` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L36) |
| `BranchVersions` | value | [声明](../../../dist/esm/kits/family.d.ts#L19) |
| `BranchVersionStore` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L49) |
| `defineAgentFamily` | value | [声明](../../../dist/esm/kits/family.d.ts#L17) |
| `defineBranchVersioning` | value | [声明](../../../dist/esm/kits/family.d.ts#L17) |
| `Family` | value | [声明](../../../dist/esm/kits/family.d.ts#L19) |
| `FamilyDefinition` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L56) |
| `FamilyOperation` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L17) |
| `familyOperations` | value | [声明](../../../dist/esm/structs/kits/family.d.ts#L15) |
| `FamilyRecord` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L36) |
| `FamilyStore` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L49) |
| `FamilyVersion` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L19) |

## @jangts/agent-core/kits/reflection

[合同与行为](kits.md) · 14 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `defineReflection` | value | [声明](../../../dist/esm/kits/reflection.d.ts#L16) |
| `defineReflectionLogSource` | value | [声明](../../../dist/esm/kits/reflection-log-source.d.ts#L63) |
| `Reflection` | value | [声明](../../../dist/esm/kits/reflection.d.ts#L18) |
| `ReflectionDefinition` | type | [声明](../../../dist/esm/structs/kits/reflection.d.ts#L108) |
| `ReflectionEvidence` | type | [声明](../../../dist/esm/structs/kits/reflection.d.ts#L20) |
| `ReflectionFinding` | type | [声明](../../../dist/esm/structs/kits/reflection.d.ts#L80) |
| `reflectionFindingKinds` | value | [声明](../../../dist/esm/structs/kits/reflection.d.ts#L78) |
| `reflectionIdentityFields` | value | [声明](../../../dist/esm/structs/kits/reflection.d.ts#L18) |
| `ReflectionLogReader` | type | [声明](../../../dist/esm/kits/reflection-log-source.d.ts#L20) |
| `ReflectionPage` | type | [声明](../../../dist/esm/structs/kits/reflection.d.ts#L54) |
| `ReflectionQuery` | type | [声明](../../../dist/esm/structs/kits/reflection.d.ts#L43) |
| `ReflectionReport` | type | [声明](../../../dist/esm/structs/kits/reflection.d.ts#L89) |
| `ReflectionSource` | type | [声明](../../../dist/esm/structs/kits/reflection.d.ts#L69) |
| `ReflectionTask` | type | [声明](../../../dist/esm/structs/kits/reflection.d.ts#L131) |

## @jangts/agent-core/mock/node

[合同与行为](mock.md) · 4 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `createMockHandler` | value | [声明](../../../dist/esm/mock/node.d.ts#L8) |
| `createMockServer` | value | [声明](../../../dist/esm/mock/node.d.ts#L8) |
| `HandlerOptions` | type | [声明](../../../dist/esm/mock/node.d.ts#L8) |
| `ServerOptions` | type | [声明](../../../dist/esm/mock/node.d.ts#L8) |

## @jangts/agent-core/mock/web

[合同与行为](mock.md) · 5 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `isPublicAddress` | value | [声明](../../../dist/esm/mock/web.d.ts#L8) |
| `LoadedPage` | type | [声明](../../../dist/esm/mock/web.d.ts#L8) |
| `sources` | value | [声明](../../../dist/esm/mock/web.d.ts#L8) |
| `WebOptions` | type | [声明](../../../dist/esm/mock/web.d.ts#L8) |
| `WebProfile` | type | [声明](../../../dist/esm/mock/web.d.ts#L8) |

## @jangts/agent-core/support/decorators

[合同与行为](support.md) · 29 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `agent` | value | [声明](../../../dist/esm/support/decorators/index.d.ts#L47) |
| `agentPool` | value | [声明](../../../dist/esm/support/decorators/pool.d.ts#L31) |
| `Authorize` | value | [声明](../../../dist/esm/support/decorators/parsers.d.ts#L11) |
| `ClassDecoration` | type | [声明](../../../dist/esm/support/decorators/definition.d.ts#L13) |
| `DecorationOptions` | type | [声明](../../../dist/esm/support/decorators/definition.d.ts#L10) |
| `DefinitionReader` | type | [声明](../../../dist/esm/support/decorators/pool.d.ts#L12) |
| `fragment` | value | [声明](../../../dist/esm/support/decorators/index.d.ts#L43) |
| `Fragment` | type | [声明](../../../dist/esm/support/decorators/types.d.ts#L16) |
| `fragmentPool` | value | [声明](../../../dist/esm/support/decorators/pool.d.ts#L29) |
| `IdentifiedDefinition` | type | [声明](../../../dist/esm/support/decorators/pool.d.ts#L8) |
| `InstanceDecorationOptions` | type | [声明](../../../dist/esm/support/decorators/runtime.d.ts#L3) |
| `Intent` | value | [声明](../../../dist/esm/support/decorators/index.d.ts#L29) |
| `MethodDecoration` | type | [声明](../../../dist/esm/support/decorators/definition.d.ts#L14) |
| `model` | value | [声明](../../../dist/esm/support/decorators/index.d.ts#L49) |
| `modelPool` | value | [声明](../../../dist/esm/support/decorators/pool.d.ts#L33) |
| `node` | value | [声明](../../../dist/esm/support/decorators/index.d.ts#L31) |
| `Node` | type | [声明](../../../dist/esm/support/decorators/types.d.ts#L10) |
| `nodePool` | value | [声明](../../../dist/esm/support/decorators/pool.d.ts#L25) |
| `ParseInput` | value | [声明](../../../dist/esm/support/decorators/parsers.d.ts#L5) |
| `ParseOutput` | value | [声明](../../../dist/esm/support/decorators/parsers.d.ts#L7) |
| `RuntimeDecoration` | type | [声明](../../../dist/esm/support/decorators/runtime.d.ts#L7) |
| `tool` | value | [声明](../../../dist/esm/support/decorators/index.d.ts#L35) |
| `Tool` | type | [声明](../../../dist/esm/support/decorators/types.d.ts#L12) |
| `toolbox` | value | [声明](../../../dist/esm/support/decorators/toolbox.d.ts#L17) |
| `Toolbox` | type | [声明](../../../dist/esm/support/decorators/toolbox.d.ts#L10) |
| `ToolboxEntry` | type | [声明](../../../dist/esm/support/decorators/toolbox.d.ts#L8) |
| `toolPool` | value | [声明](../../../dist/esm/support/decorators/pool.d.ts#L27) |
| `WorkflowNode` | value | [声明](../../../dist/esm/support/decorators/index.d.ts#L31) |
| `WorkflowTool` | value | [声明](../../../dist/esm/support/decorators/index.d.ts#L35) |

## @jangts/agent-core/kits/completion

[合同与行为](kits.md) · 4 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `CompletionCheck` | type | [声明](../../../dist/esm/kits/completion.d.ts#L18) |
| `CompletionDecision` | type | [声明](../../../dist/esm/kits/completion.d.ts#L7) |
| `CompletionReport` | type | [声明](../../../dist/esm/kits/completion.d.ts#L24) |
| `defineCompletionChecks` | value | [声明](../../../dist/esm/kits/completion.d.ts#L36) |

## @jangts/agent-core/kits/branch-versioning

[合同与行为](kits.md) · 18 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `AgentFamily` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L86) |
| `BranchVersion` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L19) |
| `BranchVersioning` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L86) |
| `BranchVersioningDefinition` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L56) |
| `BranchVersionOperation` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L17) |
| `branchVersionOperations` | value | [声明](../../../dist/esm/structs/kits/family.d.ts#L15) |
| `BranchVersionRecord` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L36) |
| `BranchVersions` | value | [声明](../../../dist/esm/kits/family.d.ts#L19) |
| `BranchVersionStore` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L49) |
| `defineAgentFamily` | value | [声明](../../../dist/esm/kits/family.d.ts#L17) |
| `defineBranchVersioning` | value | [声明](../../../dist/esm/kits/family.d.ts#L17) |
| `Family` | value | [声明](../../../dist/esm/kits/family.d.ts#L19) |
| `FamilyDefinition` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L56) |
| `FamilyOperation` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L17) |
| `familyOperations` | value | [声明](../../../dist/esm/structs/kits/family.d.ts#L15) |
| `FamilyRecord` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L36) |
| `FamilyStore` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L49) |
| `FamilyVersion` | type | [声明](../../../dist/esm/structs/kits/family.d.ts#L19) |

## @jangts/agent-core/kits/memory

[合同与行为](kits.md) · 14 个导出符号

| 符号 | 类型／值 | 声明与说明 |
| --- | --- | --- |
| `applyMemoryUpdate` | value | [声明](../../../dist/esm/kits/memory.d.ts#L131) |
| `batchMemorySources` | value | [声明](../../../dist/esm/kits/memory.d.ts#L149) |
| `completeMemoryReview` | value | [声明](../../../dist/esm/kits/memory.d.ts#L156) |
| `isMemoryState` | value | [声明](../../../dist/esm/kits/memory.d.ts#L59) |
| `memoryContext` | value | [声明](../../../dist/esm/kits/memory.d.ts#L135) |
| `MemoryEntry` | type | [声明](../../../dist/esm/kits/memory.d.ts#L24) |
| `memoryModelView` | value | [声明](../../../dist/esm/kits/memory.d.ts#L158) |
| `MemoryOperation` | type | [声明](../../../dist/esm/kits/memory.d.ts#L11) |
| `memoryReviewBatch` | value | [声明](../../../dist/esm/kits/memory.d.ts#L154) |
| `MemorySource` | type | [声明](../../../dist/esm/kits/memory.d.ts#L1) |
| `MemoryState` | type | [声明](../../../dist/esm/kits/memory.d.ts#L47) |
| `memoryUpdateInstruction` | value | [声明](../../../dist/esm/kits/memory.d.ts#L147) |
| `memoryUpdateSchema` | value | [声明](../../../dist/esm/kits/memory.d.ts#L61) |
| `reviewMemorySources` | value | [声明](../../../dist/esm/kits/memory.d.ts#L133) |

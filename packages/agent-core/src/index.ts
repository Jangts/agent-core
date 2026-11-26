/**
 * Aggregate public entry of `@jangts/agent-core`: Core runtime contracts, one `Support`
 * namespace, and the optional Kit declaration helpers.
 *
 * Layering. Core owns the runtime contracts Apps call (engine, model runner, tools,
 * context, diagnostics) and the handler contracts Core calls back into. Support supplies
 * recommended implementations of those contracts. Kits are optional App-side libraries;
 * they are available from this root convenience surface and from `/kits` / `/kits/*`
 * subpaths. Importing a Kit is a choice, never a requirement.
 *
 * Exports are grouped by responsibility, not by dependency order. Deep subpath entries
 * (`/engine`, `/model`, `/tools`, `/context`, `/journal`, `/diagnostics`, `/kits/...`)
 * resolve to the same implementations.
 */
export * from './execution/engine.js';
export { getErrorInfo } from './errors.js';
export { BudgetError, ValidationError, type AgentErrorInfo } from './structs/errors.js';
export { definePolicySet, defineRecoveryChain } from './kits/policies.js';
export type * from './structs/kits/policies.js';
export * from './model/index.js';
export type { PreparedModelInteraction, PreparedModelSelection } from './structs/model/interactions.js';
export * from './capabilities/index.js';
export * from './context/fragments.js';
export * from './context/journal.js';
export * from './context/assembly.js';
export * from './support/context/assembly.js';
export { defineEvidenceChecklist, defineEvidenceProjection } from './kits/evidence.js';
export type {
  EvidenceRequirement,
  EvidenceProvider,
  EvidenceProjectionDefinition,
  EvidenceProjectionProvider,
} from './structs/kits/evidence.js';
export { defineCommand, commandSchema } from './kits/interaction/command.js';
export type {
  Command,
  CommandDefinition,
  ProtocolCheck,
  ProtocolField,
  ProtocolReason,
  ProtocolPredicate,
  ProtocolShape,
  RegisteredProtocol,
} from './structs/kits/interaction.js';
export * from './kits/interaction/commands.js';
export * from './kits/interaction/transfer.js';
export * from './kits/interaction/handlers.js';
export * from './kits/presentation/events.js';
export * from './support/transport/index.js';
export * from './support/model/chat-completions.js';
export * from './support/model/compatible-provider.js';
export * from './support/model/transports.js';
export * from './support/model/interactions/index.js';
export * from './utils/index.js';
export * from './kits/presentation/templates.js';
export { defineRetrieval } from './kits/retrieval.js';
export type * from './structs/kits/retrieval.js';
export { defineTextSkillLoader } from './kits/text-skills.js';
export type * from './structs/kits/text-skills.js';

export * from './diagnostics/index.js';

export * from './kits/domains/registry.js';
export * from './kits/domains/scopes.js';
export { ToolLifecycleRegistry } from './kits/tools.js';
export type * from './structs/kits/tools.js';
export * from './kits/domains/catalog.js';
export * from './support/registration.js';
export { defineCandidateSelection } from './kits/candidates.js';
export type * from './structs/kits/candidates.js';

/** App-facing helpers and their types are consumed through the root Support namespace. */
export * as Support from './support/index.js';

export type * from './structs/common.js';

export type * from './structs/invocation.js';

export type * from './structs/debug.js';

export type * from './structs/execution/events.js';

export type { ContextPlan } from './structs/context/processing.js';

export { assembleContextPlan } from './context/plan.js';

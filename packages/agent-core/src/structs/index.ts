/**
 * Public entry of the structs layer.
 *
 * Structs are the shape-only half of agent-core: declarations and frozen constant catalogs that the
 * runtime modules (`tools`, `context`, `execution`, `model`, `kits`, `support`) both implement and
 * consume. Runtime classes declared here only describe shape or initialize fields, so importing this
 * barrel never starts execution.
 *
 * Exports: a curated re-export of the shared vocabulary, error classes, diagnostics/event
 * envelopes, model and workflow contracts, and the optional Kit protocol definitions.
 */
export * from './capabilities/model.js';
export * from './model/chat-provider.js';
export * from './context/fragments.js';
export * from './errors.js';
export * from './kits/presentation/events.js';
export * from './execution/engine.js';
export * from './model/interactions.js';
export * from './context/journal.js';
export * from './support/transport/json.js';
export * from './model/messages.js';
export * from './model/session.js';
export * from './model/runtime.js';
export * from './support/model/provider.js';
export * from './kits/interaction.js';
export * from './utils/rules.js';
export * from './support/transport/sse.js';
export * from './capabilities/tools.js';
export * from './execution/workflow.js';
export * from './kits/policies.js';
export * from './kits/candidates.js';
export * from './kits/evidence.js';
export * from './kits/presentation/templates.js';
export * from './kits/retrieval.js';
export * from './kits/text-skills.js';
export * from './kits/domains/registry.js';
export * from './kits/domains/scopes.js';
export * from './kits/tools.js';
export * from './kits/domains/catalog.js';
export * from './support/registration.js';
export * from './diagnostics.js';
export * from './support/context.js';
export * from './support/model/interactions.js';
export * from './capabilities/invocation.js';
export * from './context/processing.js';
export * from './support/tools.js';
export * from './support/schema.js';

export * from './support/capabilities.js';

export * from './kits/artifacts.js';
export * from './kits/durable.js';
export * from './kits/family.js';
export * from './kits/reflection.js';
export * from './kits/knowledge-publication.js';

export * from './common.js';

export type * from './invocation.js';

export type * from './debug.js';

export type * from './execution/events.js';

export type * from './execution/cache.js';

export type * from './execution/workflow-views.js';

export * from './model/lifecycle.js';
export * from './kits/result-review.js';
export * from './kits/review-decision.js';
export * from './kits/review-choice.js';

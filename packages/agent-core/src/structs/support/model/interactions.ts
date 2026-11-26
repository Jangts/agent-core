/**
 * Stage-scoped model interaction contract.
 *
 * Place in the package: Support-side registration for interactions that expose only the tools
 * declared for each stage. Static sources are projected once; dynamic sources are re-projected at
 * the model boundary. Either way, an undeclared stage or capability is rejected rather than
 * silently omitted.
 *
 * Exports: `ModelInteractionAdapter`, `ModelInteractionRegistration`, `NativeFunctionCall` (type
 * re-exports) and `ModelStageInteractionRegistration`.
 */
import type { ModelInteractionRegistration } from '../../model/interactions.js';
export type {
  ModelInteractionAdapter,
  ModelInteractionRegistration,
  NativeFunctionCall,
} from '../../model/interactions.js';

/** Stage IDs and capability references are App-owned; this adapter only compiles their relation. */
export interface ModelStageInteractionRegistration<
  Result = unknown,
> extends ModelInteractionRegistration<Result> {
  /** Declared stages; each id is unique and lists non-empty, unique capability ids. */
  readonly stages: readonly { readonly id: string; readonly toolIds: readonly string[] }[];
}

/** @deprecated Use `ModelStageInteractionRegistration`. Retained for the 0.9 migration. */
export type { ModelStageInteractionRegistration as ModelStageTransportRegistration };
/** @deprecated Use `ModelInteractionRegistration`. */
export type { ModelInteractionRegistration as ModelTransportRegistration } from '../../model/interactions.js';

/**
 * Context fragment contract: the unit of model-visible input assembled by Core.
 *
 * Fragments carry both content and provenance. Trust and lifetime are declarations by the
 * producing module, while `maxChars` is enforced when the fragment is formatted and counted into
 * the shared input budget. A system-role fragment may only carry trusted string content.
 *
 * Exports: `ContextTrust`, `ContextLifetime`, `ContextFragment`, `ContextFragmentUsage`,
 * `BuiltContext`.
 */
import type { ModelMessage } from '../model/messages.js';

/** Who produced the content, and therefore how much it may influence the model. */
export type ContextTrust = 'instruction' | 'server' | 'user' | 'tool';

/** Declared validity window of a fragment's content. */
export type ContextLifetime = 'configuration' | 'turn' | 'step';

/** One piece of model-visible input before assembly. */
export interface ContextFragment {
  /** Unique, stable id matching `^[a-z][a-zA-Z0-9:._-]*$`; duplicates are rejected. */
  id: string;
  /** Owning source (module or registration) used to explain where the content came from. */
  sourceId: string;
  /** Producer trust level. `user` and `tool` content cannot become a system message. */
  trust: ContextTrust;
  /** Declared validity window of this content. */
  lifetime: ContextLifetime;
  /** Hard upper bound in JSON characters; must be a positive safe integer. */
  maxChars: number;
  /** Message slot the fragment occupies when assembled. */
  role: 'system' | 'user';
  /** Rendered content. A system message accepts a string only, never a record. */
  value: string | Record<string, unknown>;
}

/** Accounting entry reported for one fragment that actually entered the context. */
export interface ContextFragmentUsage {
  id: string;
  sourceId: string;
  trust: ContextTrust;
  lifetime: ContextLifetime;
  /** Characters consumed after formatting. */
  chars: number;
  /** Budget that applied to this fragment. */
  maxChars: number;
}

/** Assembled context plus the accounting needed to explain the budget decision. */
export interface BuiltContext {
  /** Messages in final model order. */
  messages: ModelMessage[];
  /** Per-fragment accounting in the same order as the fragments were merged. */
  fragmentUsage: ContextFragmentUsage[];
  /** Total counted characters across messages and usage. */
  inputChars: number;
  /** Budget the assembly was validated against; `Infinity` means unbounded. */
  maxInputChars: number;
}

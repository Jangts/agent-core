/**
 * Context plan contract: the unassembled input handed to the Core budget boundary.
 *
 * App-side nodes may still process a plan (mutate declared fragments, add protected messages)
 * before Core assembles and validates it. The plan therefore separates sendable content from the
 * trusted originals used to audit structural mutation.
 *
 * Exports: `ContextPlan`.
 */
import type { ContextFragment } from './fragments.js';
import type { ModelMessage } from '../model/messages.js';

/** Unassembled input; App-side nodes may process it before the Core budget boundary. */
export interface ContextPlan {
  /** Fragments in the order supplied by the App; assembly preserves it. */
  readonly fragments: readonly ContextFragment[];
  /** Character budget Core validates after assembly. */
  maxInputChars: number;
  /** Protected user messages (for example image inputs); text counts toward the same budget. */
  additionalMessages?: readonly (ModelMessage & { role: 'user' })[];
  /** Trusted originals for structural mutation auditing; never sent to the model. */
  originalFragments?: readonly ContextFragment[];
  /** Explicit value-mutation allowance when originals are supplied. */
  mutableFragmentIds?: readonly string[];
}

/**
 * Completion policy catalog: policies a compatible provider may be configured with.
 *
 * Registration is explicit and frozen. The module refuses to load when a key and the policy's own
 * identifier disagree, so a lookup can never return a policy under a false name.
 *
 * Main exports: `completionPolicyCatalog`, the two preset re-exports, the shared call collector
 * and their contract types.
 */
import { breakWhile } from '../../../utils/rules.js';
import { defaultCompletionPolicy } from './default.js';
import { sessionCompletionPolicy } from './session.js';
export { createToolCallCollector } from './calls.js';
export type { AggregatedToolCall, ToolCallCollector, ToolCallFailure } from './calls.js';
export { defaultCompletionPolicy } from './default.js';
export { sessionCompletionPolicy } from './session.js';
export type * from '../../../structs/support/model/completion.js';

/** Preset policies selected by an explicit port; the default is used when none is given. */
export const completionPolicyCatalog = Object.freeze({
  default: defaultCompletionPolicy,
  session: sessionCompletionPolicy,
});
for (const [id, policy] of Object.entries(completionPolicyCatalog))
  breakWhile(id !== policy.id, 'Completion policy ID does not match its registered policy');

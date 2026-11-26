/**
 * Model interaction catalog: adapters that convert model output into Core model parts.
 *
 * Adapters are selected only from explicit application capability metadata, never inferred from
 * arbitrary text. Each adapter is registered under the same ID it reports, and the catalog is
 * frozen so later imports cannot widen the available interactions.
 *
 * Main exports: `modelInteractionCatalog`, the two adapter re-exports and their contract types.
 */
import { nativeFunctionInteraction } from './native-functions.js';
import { jsonObjectInteraction } from './json-object.js';
import { breakWhile } from '../../../utils/rules.js';
export { nativeFunctionInteraction } from './native-functions.js';
export { jsonObjectInteraction } from './json-object.js';
export type {
  ModelResponseCollector,
  PreparedModelSelection,
} from '../../../structs/model/interactions.js';
export type { ModelInteractionAdapter } from '../../../structs/support/model/interactions.js';

/** Registered adapters selected only from explicit App capability metadata. */
export const modelInteractionCatalog = Object.freeze({
  'native-functions': nativeFunctionInteraction,
  'json-object': jsonObjectInteraction,
});
// Fail at module load rather than let a mismatched key register an adapter under a false ID.
for (const [id, adapter] of Object.entries(modelInteractionCatalog))
  breakWhile(id !== adapter.id, 'Model interaction ID does not match its registered adapter');

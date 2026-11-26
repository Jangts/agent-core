/**
 * Normalization Kit: ordered synchronous value transformations and stable deduplication.
 *
 * Place in the package: an optional App-side helper for cleaning model or transport input
 * before it reaches business logic. Replacement, completion detection and input ownership stay
 * explicit; this module never mutates the caller's arrays.
 *
 * Exports: `defineNormalization`, `uniqueBy`, `Normalization`, and the step/option types.
 */
import { synchronous, booleanResult } from '../utils/synchronous.js';
import type { NormalizationStep, NormalizationOptions } from '../structs/kits/normalization.js';
import { breakWhile } from '../utils/rules.js';

/**
 * Compile an ordered normalization pipeline.
 *
 * Steps run in declaration order. Each step may be skipped by its `when` predicate, receives
 * the value produced by the previous step, and `isComplete` can stop the walk early, so the
 * usual contract is "first completion wins" rather than "always run everything".
 *
 * @param definitions - Steps with unique non-blank ids and a synchronous `normalize` handler.
 * @param options - Optional completion predicate; bound to the options object.
 * @returns A frozen pipeline exposing `steps` (ids plus handlers) and `normalize`.
 * @throws TypeError At construction for blank/duplicate ids or a missing handler; from
 *   `normalize` when a predicate or handler returns a thenable or a non-boolean.
 */
export function defineNormalization<Value, Context = void>(
  definitions: readonly NormalizationStep<Value, Context>[],
  options: NormalizationOptions<Value, Context> = {},
) {
  const isComplete = options.isComplete?.bind(options);
  const predicate = (value: unknown) =>
    booleanResult(
      value,
      'Normalization predicates must be synchronous',
      'Normalization predicates must return boolean',
    );
  const ids = new Set<string>();
  const steps = Object.freeze(
    definitions.map((step) => {
      breakWhile([
        {
          occur: () => !step.id.trim() || ids.has(step.id),
          error: 'Invalid or duplicate normalization step',
          tags: ['id'],
        },
        {
          occur: () => typeof step.normalize !== 'function',
          error: 'Missing normalization handler',
          tags: ['handler'],
        },
      ]);
      ids.add(step.id);
      return Object.freeze({
        id: step.id,
        when: step.when?.bind(step),
        normalize: step.normalize.bind(step),
      });
    }),
  );
  return Object.freeze({
    steps,
    normalize(value: Value, context: Context): Value {
      for (const step of steps) {
        if (step.when && !predicate(step.when(value, context))) continue;
        value = synchronous(
          step.normalize(value, context),
          'Normalization handlers must be synchronous',
        );
        if (isComplete && predicate(isComplete(value, context))) break;
      }
      return value;
    },
  });
}

/**
 * Stable deduplication preserves the original values; the host chooses equivalence.
 *
 * The first occurrence of each key wins and the input order is kept, so callers can rely on
 * deduplication never reordering their list.
 *
 * @param values - Values in the order to retain.
 * @param key - Equivalence selector.
 * @param initial - Keys already treated as seen, for example those owned by another batch.
 * @returns The retained values as a new array.
 */
export function uniqueBy<Value, Key>(
  values: readonly Value[],
  key: (value: Value) => Key,
  initial: Iterable<Key> = [],
): Value[] {
  const seen = new Set(initial);
  return values.filter((value) => {
    const id = key(value);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export type { NormalizationStep, NormalizationOptions } from '../structs/kits/normalization.js';

/** Namespace object for callers that prefer one import over named helpers. */
export const Normalization = Object.freeze({ defineNormalization, uniqueBy });

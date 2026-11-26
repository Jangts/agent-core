/** Tool metadata validation and synchronous activation shared by registration and execution. */
import { booleanResult } from '../utils/synchronous.js';
import type { AsIntent, ToolCondition } from '../structs/capabilities/model.js';

/** Validate and snapshot discovery metadata without evaluating host predicates. */
export function snapshotIntent<Context>(
  value: AsIntent<Context> | undefined,
): AsIntent<Context> | undefined {
  if (value === undefined || value === true || typeof value === 'function') return value;
  if (typeof value === 'string') {
    if (!value.trim()) throw new TypeError('Intent description must not be blank');
    return value;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError('Invalid asIntent metadata');
  if ('delegates' in value) throw new TypeError('Intent metadata cannot own goal delegates');
  if (
    value.description !== undefined &&
    (typeof value.description !== 'string' || !value.description.trim())
  )
    throw new TypeError('Invalid intent description');
  if (value.when !== undefined && typeof value.when !== 'function')
    throw new TypeError('Invalid intent predicate');
  return Object.freeze({
    description: value.description,
    ...(value.when !== undefined ? { when: value.when } : {}),
  });
}

/** Bind an optional object-form predicate to its owning Tool, without touching other forms. */
export function bindIntent<Context>(
  value: AsIntent<Context> | undefined,
  owner: unknown,
): AsIntent<Context> | undefined {
  if (!value || typeof value !== 'object' || typeof value.when !== 'function') return value;
  return Object.freeze({ ...value, when: value.when.bind(owner) });
}

/** Check activation and reject asynchronous or nonboolean predicate results. */
export function toolActive<Context>(
  condition: ToolCondition<Context> | undefined,
  context: Context,
): boolean {
  if (condition === undefined) return true;
  if (typeof condition === 'boolean') return condition;
  if (typeof condition !== 'function') throw new TypeError('Invalid tool active condition');
  return booleanResult(
    condition(context),
    'Tool predicates must be synchronous',
    'Tool predicates must return boolean',
  );
}

/** Resolve the demand-facing description only when discovery is enabled. */
export function intentDescription<Context>(
  metadata: AsIntent<Context> | undefined,
  fallback: string,
  context: Context,
): string | undefined {
  if (metadata === undefined) return undefined;
  if (typeof metadata === 'string') return metadata;
  if (metadata === true) return fallback;
  if (typeof metadata === 'function') return toolActive(metadata, context) ? fallback : undefined;
  return toolActive(metadata.when, context) ? (metadata.description ?? fallback) : undefined;
}

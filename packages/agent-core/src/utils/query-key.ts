/**
 * Stable identity for JSON retrieval queries.
 * Object key order is ignored, array order is retained, and lossy values are rejected.
 * Exports: `retrievalQueryKey`.
 */
/**
 * Serialize finite JSON data into a stable key without silently dropping query conditions.
 * @param value - Null, boolean, string, finite number, dense array or plain data object.
 * @returns Canonical JSON with sorted object keys.
 * @throws TypeError For cycles, sparse arrays, special objects or non-JSON values at any depth.
 */
export function retrievalQueryKey(value: unknown): string {
  return JSON.stringify(canonical(value, new Set()));
}

/** Reject unsupported values uniformly, including nested values JSON.stringify would omit. */
function invalid(): never {
  throw new TypeError('Query cannot be serialized without losing data');
}

/** Track ancestors rather than all visited objects so shared acyclic values remain valid. */
function canonical(value: unknown, ancestors: Set<object>): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : invalid();
  if (typeof value !== 'object' || ancestors.has(value)) return invalid();
  const array = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if (!array && prototype !== Object.prototype && prototype !== null) return invalid();
  const keys = Reflect.ownKeys(value);
  if (
    keys.some(
      (key) =>
        typeof key !== 'string' ||
        (!Object.prototype.propertyIsEnumerable.call(value, key) && !(array && key === 'length')),
    )
  )
    return invalid();
  ancestors.add(value);
  try {
    if (array) {
      if (
        keys.length !== value.length + 1 ||
        Array.from({ length: value.length }, (_, index) => index).some(
          (index) => !Object.hasOwn(value, index),
        )
      )
        return invalid();
      return Array.from(value, (item) => canonical(item, ancestors));
    }
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical((value as Record<string, unknown>)[key], ancestors)]),
    );
  } finally {
    ancestors.delete(value);
  }
}

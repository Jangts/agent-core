/**
 * Presentation Kit: variant selection and preference resolution over App-supplied values.
 *
 * Place in the package: part of the `presentation` Kit. Copy, priorities and randomness are
 * App policy; this module only applies a deterministic rule to what it is given.
 *
 * Exports: `selectVariant`, `resolvePreference`.
 */

/**
 * Pick one variant, avoiding an immediate repeat when alternatives exist.
 *
 * When every candidate equals `previous`, the full list is used again, so a single-value set
 * still yields a result instead of failing.
 *
 * @param values - Candidate variants; an empty list returns `undefined`.
 * @param options - Previous value to avoid and a random index source in `[0, limit)`.
 * @returns The selected value, or `undefined` when there are no candidates.
 * @throws TypeError When `randomIndex` returns a non-integer or an out-of-range index.
 */
export function selectVariant<Value>(
  values: readonly Value[],
  options: { previous?: Value; randomIndex(limit: number): number },
): Value | undefined {
  if (!values.length) return undefined;
  const candidates =
    values.length > 1 ? values.filter((value) => value !== options.previous) : [...values];
  const pool = candidates.length ? candidates : [...values];
  if (pool.length === 1) return pool[0];
  const index = options.randomIndex(pool.length);
  if (!Number.isSafeInteger(index) || index < 0 || index >= pool.length)
    throw new TypeError('Invalid variant index');
  return pool[index];
}

/**
 * Resolve the preferred candidate.
 *
 * Highest `priority` wins; `order` breaks ties with the later entry first, so recency can be
 * encoded without touching priority. The input array is copied before sorting.
 *
 * @param candidates - Values with a priority and an order marker.
 * @returns The winning value, or `undefined` for an empty list.
 * @throws TypeError When any priority or order is not finite.
 */
export function resolvePreference<Value>(
  candidates: readonly { value: Value; priority: number; order: number }[],
): Value | undefined {
  if (candidates.some((item) => !Number.isFinite(item.priority) || !Number.isFinite(item.order)))
    throw new TypeError('Invalid preference priority');
  return [...candidates].sort(
    (left, right) => right.priority - left.priority || right.order - left.order,
  )[0]?.value;
}

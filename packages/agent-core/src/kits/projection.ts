/**
 * Projection Kit: fit structured values into a character budget without losing valid JSON.
 *
 * Place in the package: an optional App-side helper for context and preview budgets. Callers
 * choose the budget, the rendering strategy and the fallback text; this module only shrinks
 * values and verifies the result still fits.
 *
 * Exports: `defineContentProjection`, `projectContinuousExcerpt`, `defineTreeProjection`,
 * `Projection`, and the projection option/result types.
 */
import { booleanResult, synchronous } from '../utils/synchronous.js';
import { validateContextBudget } from '../context/fragments.js';
import type {
  ContentProjectionOptions,
  ContentProjection,
  TreeProjectionOptions,
} from '../structs/kits/projection.js';

/**
 * Compile a JSON-preserving projector.
 *
 * Keep valid JSON while reducing prose before dropping records; budgets are caller policy.
 * The candidate list is tried in order (outer `counts`, inner `lengths`), so callers control
 * whether trimming text or dropping items is preferred, and the configured fallback is used
 * only when no candidate fits.
 *
 * @param options - Candidate bounds, a synchronous renderer and a synchronous fallback factory.
 * @returns A frozen object whose `project({ value, maxChars })` returns `{ text, truncated }`.
 * @throws TypeError For a negative or non-integer `maxChars`, or a non-synchronous renderer;
 *   a `CONTEXT_BUDGET` `ValidationError` from the budget check when even the fallback is long.
 */
export function defineContentProjection(options: ContentProjectionOptions) {
  const counts = [...options.counts],
    lengths = [...options.lengths];
  const render = options.render.bind(options),
    fallback = options.fallback.bind(options);
  function shorten(value: unknown, length: number, count: number): unknown {
    // The ellipsis is explicit so a reader can tell truncated text from original text.
    if (typeof value === 'string')
      return value.length <= length ? value : value.slice(0, length) + '…';
    if (Array.isArray(value))
      return value.slice(0, count).map((child) => shorten(child, length, count));
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value).map(([key, child]) => [key, shorten(child, length, count)]),
      );
    return value;
  }
  function project({
    value,
    maxChars: limit,
  }: {
    value: unknown;
    maxChars: number;
  }): ContentProjection {
    if (!Number.isSafeInteger(limit) || limit < 0)
      throw new TypeError('Invalid projection maxChars');
    const original = JSON.stringify(value);
    if (original.length <= limit) return { text: original, truncated: false };
    for (const count of counts)
      for (const length of lengths) {
        const text = synchronous(
          render(shorten(value, length, count)),
          'Projection renderers must be synchronous',
        );
        if (text.length <= limit) return { text, truncated: true };
      }
    const text = synchronous(fallback(limit), 'Projection fallback must be synchronous');
    validateContextBudget(text.length, limit);
    return { text, truncated: true };
  }
  return Object.freeze({ project });
}

/**
 * Project a continuous excerpt of a body by binary-searching the longest prefix that fits.
 *
 * Binary-search a continuous prefix and keep an existing surrogate pair intact. `render`
 * receives the prefix length, not the text, so the caller decides how the excerpt is framed.
 *
 * @param body - Source text whose length bounds the search.
 * @param limit - Maximum rendered length in characters.
 * @param render - Synchronous renderer for a given prefix length.
 * @returns The fitting projection, or `undefined` when even the empty excerpt does not fit.
 * @throws TypeError For an invalid limit or a non-synchronous renderer; a `CONTEXT_BUDGET`
 *   `ValidationError` when the chosen excerpt still exceeds the budget.
 */
export function projectContinuousExcerpt(
  body: string,
  limit: number,
  render: (length: number) => string,
): ContentProjection | undefined {
  validateContextBudget(0, limit);
  const excerpt = (length: number) =>
    synchronous(render(length), 'Excerpt renderers must be synchronous');
  if (excerpt(0).length > limit) return;
  let low = 0,
    high = body.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (excerpt(mid).length <= limit) low = mid;
    else high = mid - 1;
  }
  if (low > 0 && low < body.length && /[\uD800-\uDBFF]/.test(body[low - 1])) low--;
  const text = excerpt(low);
  validateContextBudget(text.length, limit);
  return { text, truncated: true };
}

/**
 * Compile a depth-limited tree transform.
 *
 * Traverse synchronously in property/array order; only undefined omits a result. Because a
 * visitor returns a new value instead of mutating, an omitted branch disappears from arrays
 * and objects the same way, and `maxDepth` bounds both cycles and cost.
 *
 * @param options - Maximum depth (0 keeps only the root), optional omit predicate and optional
 *   record visitor.
 * @returns A frozen object whose `visit(value, context)` returns the projected value.
 * @throws TypeError For a negative or non-integer `maxDepth`; a predicate that is not
 *   synchronous boolean; a visitor that returns a thenable.
 */
export function defineTreeProjection<Context>(options: TreeProjectionOptions<Context>) {
  const { maxDepth } = options,
    omit = options.omit?.bind(options),
    visitRecord = options.visitRecord?.bind(options);
  if (!Number.isSafeInteger(maxDepth) || maxDepth < 0) throw new TypeError('Invalid tree maxDepth');
  function visit(value: unknown, depth: number, context: Context): unknown {
    if (depth > maxDepth) return undefined;
    if (
      omit &&
      booleanResult(
        omit(value, depth, context),
        'Tree omit predicates must return boolean synchronously',
      )
    )
      return undefined;
    if (Array.isArray(value))
      return value
        .map((item) => visit(item, depth + 1, context))
        .filter((item) => item !== undefined);
    if (value === null || typeof value !== 'object') return value;
    const record = value as Record<string, unknown>;
    synchronous(visitRecord?.(record, depth, context), 'Tree visitors must be synchronous');
    return Object.fromEntries(
      Object.entries(record).flatMap(([key, item]) => {
        const next = visit(item, depth + 1, context);
        return next === undefined ? [] : [[key, next]];
      }),
    );
  }
  const project = (value: unknown, context: Context): unknown => visit(value, 0, context);
  return Object.freeze({ visit: project });
}

export type {
  ContentProjectionOptions,
  ContentProjection,
  TreeProjectionOptions,
} from '../structs/kits/projection.js';

/** Namespace object for callers that prefer one import over named helpers. */
export const Projection = Object.freeze({
  defineContentProjection,
  projectContinuousExcerpt,
  defineTreeProjection,
});

/**
 * Aggregation Kit: fold query items and inspect settled branch patches in declared order.
 *
 * Place in the package: an optional App-side helper. Reads, selection rules and result
 * semantics stay with the host. Branch inspection is pure and never schedules or commits work.
 *
 * Exports: `mergeByKey`, `defineQueryAggregation`, `aggregateBranchResults`, `Aggregation`.
 */
import { nativeReportedStepSync } from '../diagnostics/native-sub-flow.js';
import { synchronous } from '../utils/synchronous.js';
import type {
  QueryAggregationOptions,
  BranchAggregationRequest,
  BranchAggregationResult,
  BranchResult,
} from '../structs/kits/aggregation.js';

/**
 * Merge duplicates without moving their first position; selection policy remains host-owned.
 *
 * The first occurrence of a key fixes the output position; `select` decides which item that
 * position finally holds, so callers can prefer the newest or the most complete duplicate.
 *
 * @param items - Source items in the order the caller wants to display them.
 * @param key - Key selector; items sharing a key collapse into one slot.
 * @param select - Chooses the retained item from the incoming item and the earlier choice
 *   (`undefined` on the first occurrence).
 * @returns One item per key, in first-occurrence order.
 */
export function mergeByKey<Item, Key>(
  items: Iterable<Item>,
  key: (item: Item) => Key,
  select: (item: Item, previous: Item | undefined) => Item,
): Item[] {
  const values = new Map<Key, Item>();
  for (const item of items) {
    const id = key(item);
    values.set(id, select(item, values.get(id)));
  }
  return [...values.values()];
}

/**
 * Compile one ordered read plan over a list of inputs.
 *
 * Ordered synchronous queries with optional stable-key merging; each real read stays
 * host-owned. Inputs run sequentially in the given order, so a host can rely on a
 * deterministic visit sequence. Without `key` every item is kept; with `key` the last write
 * wins per key but the position of the first occurrence is retained.
 *
 * @param options - Read handler plus optional key/merge policy; handlers are bound to the
 *   options object so method-style implementations keep their `this`.
 * @returns A frozen plan whose `collect` returns `{ total, items }`.
 * @throws TypeError From `collect` when any handler returns a thenable: the whole plan is
 *   synchronous by contract, and an async handler cannot be awaited here.
 */
export function defineQueryAggregation<Input, Item, Context>(
  options: QueryAggregationOptions<Input, Item, Context>,
) {
  const execute = options.execute.bind(options),
    keyFor = options.key?.bind(options),
    merge = options.merge?.bind(options);
  return Object.freeze({
    /**
     * Run every input in order.
     *
     * @param inputs - Query inputs; order determines both read order and result order.
     * @param context - Host context forwarded unchanged to `execute`, `key` and `merge`.
     * @returns The merged items and their count.
     */
    collect(
      inputs: readonly Input[],
      context: Context,
      execution: Partial<import('../structs/common.js').ExecutionContext> = {},
    ): { total: number; items: Item[] } {
      return nativeReportedStepSync(execution, 'aggregation', 'query-aggregation', () => {
        const rows: Item[] = [],
          merged = new Map<string, Item>();
        for (const input of inputs)
          for (const item of synchronous(
            execute(input, context),
            'Query aggregation must be synchronous',
          )) {
            if (!keyFor) {
              rows.push(item);
              continue;
            }
            const key = synchronous(
              keyFor!(item, input, context),
              'Aggregation keys must be synchronous',
            );
            merged.set(
              key,
              merge
                ? synchronous(
                    merge(item, merged.get(key), input, context),
                    'Aggregation merge must be synchronous',
                  )
                : item,
            );
          }
        const items = keyFor ? [...merged.values()] : rows;
        return { total: items.length, items };
      });
    },
  });
}

/**
 * Inspect settled branch results without scheduling work or mutating parent state.
 *
 * Every declared id must occur exactly once. Successful plain-data patches are cloned, then
 * inspected in declaration order. Any shared top-level key is a conflict, even for equal
 * values. Failed branches retain successful results but prevent producing a commit patch.
 * The caller owns independent inputs, authorization, cancellation, persistence and acceptance.
 *
 * @param request - Ordered unique branch ids and their complete, unordered settled outcomes.
 * @returns Detached results, conflicts and (only on full success) a proposed parent patch.
 * @throws TypeError For malformed identities, missing/duplicate outcomes or non-data patches;
 * structuredClone also rejects values that cannot cross a data boundary.
 */
export function aggregateBranchResults<State extends object>(
  request: BranchAggregationRequest<State>,
): BranchAggregationResult<State> {
  if (!request) throw new TypeError('Use declared branches and settled results');
  const { branches, results: outcomes } = request;
  if (!Array.isArray(branches) || !Array.isArray(outcomes))
    throw new TypeError('Use declared branches and settled results');
  const declared = [...branches],
    settled = [...outcomes];
  const ids = new Set<string>();
  for (const id of declared) {
    if (typeof id !== 'string' || !id.trim() || ids.has(id))
      throw new TypeError('Branch ids must be nonempty and unique');
    ids.add(id);
  }
  const byId = new Map<string, BranchResult<State>>();
  for (const result of settled) {
    if (!result) throw new TypeError('Each outcome must match one declared branch');
    const { id, status } = result;
    if (!ids.has(id) || byId.has(id))
      throw new TypeError('Each outcome must match one declared branch');
    if (status !== 'succeeded' && status !== 'failed')
      throw new TypeError('Use succeeded or failed branch outcomes');
    if (status === 'succeeded') {
      const patch = result.patch;
      if (
        !patch ||
        (Object.getPrototypeOf(patch) !== Object.prototype && Object.getPrototypeOf(patch) !== null)
      )
        throw new TypeError('Branch patches must be plain data objects');
      for (const key of Reflect.ownKeys(patch)) {
        const descriptor = Object.getOwnPropertyDescriptor(patch, key)!;
        if (typeof key !== 'string' || !descriptor.enumerable || !('value' in descriptor))
          throw new TypeError('Branch patches require enumerable string data properties');
      }
      // Clone only the validated outcome, without re-reading caller getters.
      byId.set(id, { id, status, patch: structuredClone(patch) });
    } else {
      byId.set(id, { id, status, error: structuredClone(result.error) });
    }
  }
  if (byId.size !== ids.size) throw new TypeError('Every declared branch needs a settled outcome');
  const results = declared.map((id) => byId.get(id)!);
  const writers = new Map<string, string[]>();
  const entries: [string, unknown][] = [];
  for (const result of results) {
    if (result.status !== 'succeeded') continue;
    for (const [key, value] of Object.entries(result.patch)) {
      const owners = writers.get(key) ?? [];
      owners.push(result.id);
      writers.set(key, owners);
      entries.push([key, value]);
    }
  }
  const conflicts = [...writers]
    .filter(([, owners]) => owners.length > 1)
    .map(([key, branches]) => ({ key, branches }));
  const status = conflicts.length
    ? 'conflict'
    : results.some((result) => result.status === 'failed')
      ? 'incomplete'
      : 'accepted';
  return {
    status,
    results,
    conflicts,
    ...(status === 'accepted' ? { patch: Object.fromEntries(entries) as Partial<State> } : {}),
  };
}

export type {
  QueryAggregationOptions,
  BranchResult,
  BranchAggregationRequest,
  BranchAggregationResult,
} from '../structs/kits/aggregation.js';

/** Namespace object for callers that prefer one import over named helpers. */
export const Aggregation = Object.freeze({
  defineQueryAggregation,
  mergeByKey,
  aggregateBranchResults,
});

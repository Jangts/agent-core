/**
 * Query aggregation contract: several ordered reads collapsed into one item list.
 *
 * Place in the package: an optional App-side helper for merging results of the same query shape
 * run against several inputs. The Kit owns ordering and optional stable-key merging; every real
 * read, the merge policy and the meaning of an item stay with the App.
 *
 * Exports: query options and settled branch request/result contracts.
 */
export interface QueryAggregationOptions<Input, Item, Context> {
  /** Reads one input. Called once per input, in caller order, and must return synchronously. */
  readonly execute: (input: Input, context: Context) => readonly Item[];
  /** Optional stable merge key. Items with the same key collapse into the first position seen. */
  readonly key?: (item: Item, input: Input, context: Context) => string;
  /** Combines a duplicate with the value merged so far; receives `undefined` for the first item. */
  readonly merge?: (item: Item, previous: Item | undefined, input: Input, context: Context) => Item;
}

/** One settled, App-owned branch outcome; patches must be structured-cloneable data. */
export type BranchResult<State extends object> =
  | { readonly id: string; readonly status: 'succeeded'; readonly patch: Partial<State> }
  | { readonly id: string; readonly status: 'failed'; readonly error: unknown };

/** A complete outcome set; declaration order, never completion order, determines inspection order. */
export interface BranchAggregationRequest<State extends object> {
  readonly branches: readonly string[];
  readonly results: readonly BranchResult<State>[];
}

/** Inspection retains successful patches even when conflict or branch failure prevents acceptance. */
export interface BranchAggregationResult<State extends object> {
  readonly status: 'accepted' | 'conflict' | 'incomplete';
  readonly results: readonly BranchResult<State>[];
  readonly conflicts: readonly { readonly key: string; readonly branches: readonly string[] }[];
  /** Present only when every branch succeeded with disjoint writes; App still owns committing it. */
  readonly patch?: Partial<State>;
}

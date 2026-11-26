/**
 * Answer flow state for the Answering Kit.
 *
 * Place in the package: mutable bookkeeping owned by the flow for one request. Cells are never
 * shared between requests, and the repair budget is consumed by the flow itself.
 *
 * Exports: `AnswerCell`, `AnswerFlowState`.
 */
import type { AnswerItem, AnswerCheck, AnswerResult } from './flow.js';

/** One item's progress through generate, check, review and repair. */
export interface AnswerCell<D, V> {
  /** Item being answered. */
  item: AnswerItem<D>;
  /** Latest generated value; absent before generation or when generation produced none. */
  value?: V;
  /** True when `value` is present, kept explicit so a valid `undefined` value is representable. */
  hasValue: boolean;
  /** Latest local check verdict. */
  local: AnswerCheck<V>;
  /** Latest review verdict. */
  review: AnswerCheck<V>;
  /** Sticky marker: a review once failed, so review must resolve before the item is accepted. */
  knownReviewFailure: boolean;
  /** Whether the most recent generation pass produced this cell's value. */
  generated?: boolean;
}
/** Whole-flow state for one request. */
export interface AnswerFlowState<D, V> {
  /** All cells of the batch, in request order. */
  cells: AnswerCell<D, V>[];
  /** Cells still being processed in the current round. */
  pending: AnswerCell<D, V>[];
  /** Repair allowance; `take()` returns false once the configured rounds are spent. */
  repairBudget: { readonly available: boolean; take(): boolean };
  /** Final results, present only after the flow completes. */
  result?: AnswerResult<D, V>[];
}

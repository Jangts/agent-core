/** Optional recipe for inspecting and selecting existing reviewed summaries. */
import type { ResultReviewResult, ResultReviewScope } from './result-review.js';
import type { ReviewDecisionBinding, ReviewDecision } from './review-decision.js';
import type { WaitRecord } from './waiting.js';
import type { OperationContext, MaybePromise } from '../common.js';

/** Host-owned existing result projection; complete is a trusted coverage assertion.
 * This bounded recipe accepts one or two nonempty summaries of at most 4000 characters.
 * General multi-result inspection remains available through ResultReview.
 */
export interface ReviewChoiceInput {
  readonly id: string;
  readonly summary: string;
  readonly complete: boolean;
}
/** A choice is a reference to an existing result, never a request to generate a new one. */
export interface ReviewChoiceAnswer {
  readonly inputId: string;
  readonly reason: string;
}
/** Local persisted recipe record, independent of Core execution state. */
export interface ReviewChoice {
  readonly version: 1;
  readonly status: 'ready' | 'waiting' | 'incomplete';
  readonly inputs: readonly ReviewChoiceInput[];
  readonly assessment: ResultReviewResult;
  readonly binding: ReviewDecisionBinding;
  readonly wait?: WaitRecord<ReviewChoiceAnswer>;
  readonly accepted?: { readonly submissionId: string; readonly result: ReviewChoiceAnswer };
}
/** The host computes content revisions, source identities and current authorization. */
export interface ReviewChoiceInspection {
  readonly scope: ResultReviewScope;
  readonly inputs: readonly ReviewChoiceInput[];
  readonly versions: readonly { readonly resourceId: string; readonly revision: string }[];
  readonly binding: ReviewDecisionBinding;
  compare(inputs: readonly ReviewChoiceInput[]): Promise<string>;
  readonly signal: AbortSignal;
}
/** All callers must hold the same host record lock through the complete operation. */
export interface ReviewChoiceHost {
  readonly signal: AbortSignal;
  authorize(): MaybePromise<void>;
  read(): Promise<ReviewChoice>;
  /** Atomic write under the caller's lock/CAS; selectedSummary only adopts an existing result. */
  save(review: ReviewChoice, selectedSummary?: string): Promise<void>;
}
export interface ReviewChoiceDecision {
  readonly context: OperationContext<{}>;
  readonly decision: ReviewDecision<ReviewChoiceAnswer, ReviewChoiceAnswer, {}>;
}

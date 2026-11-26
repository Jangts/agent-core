/** Optional result-review decision association. Real identity and atomic acceptance stay host-owned. */
import type { MaybePromise, OperationContext } from '../common.js';
import type { WaitGate, WaitIdentity, WaitRecord } from './waiting.js';

/** Stable decision inputs; content revision is distinct from a storage CAS revision. */
export interface ReviewDecisionBinding {
  readonly parentTaskId: string;
  readonly disputeId: string;
  readonly contentRevision: string;
  readonly sourceVersions: Readonly<Record<string, string>>;
  readonly policyRevision: string;
  readonly waitIdentity: WaitIdentity;
  readonly actionId: string;
  readonly deadlineAtMs: number;
}

/** A persisted acceptance receipt; pending does not mean that waiting has already been opened. */
export type ReviewDecisionState<Result> =
  | { readonly binding: ReviewDecisionBinding; readonly status: 'pending' }
  | {
      readonly binding: ReviewDecisionBinding;
      readonly status: 'accepted';
      readonly submissionId: string;
      readonly result: Result;
    };

/** All operations reauthorize. accept must compare all expected inputs and commit atomically. */
export interface ReviewDecisionDefinition<Answer, Result, App> {
  readonly binding: ReviewDecisionBinding;
  readonly gate: WaitGate<Answer, App>;
  authorize(
    binding: ReviewDecisionBinding,
    context: OperationContext<App> & {
      readonly operation: 'open' | 'respond' | 'read' | 'continue';
    },
  ): MaybePromise<void>;
  read(
    binding: ReviewDecisionBinding,
    context: OperationContext<App>,
  ): MaybePromise<ReviewDecisionState<Result>>;
  /** Atomic compare-and-accept, including deadline, current policy/sources, submission and action ID.
   * Repeated same submission returns its saved receipt; conflicts reject. This port does not imply
   * that external business effects are transactional: use idempotency or Durable reconciliation.
   */
  accept(
    request: {
      readonly binding: ReviewDecisionBinding;
      readonly submissionId: string;
      readonly answer: Answer;
    },
    context: OperationContext<App>,
  ): MaybePromise<ReviewDecisionState<Result> & { readonly status: 'accepted' }>;
  readonly now?: () => number;
}

/** Pure query never calls accept or resumes a Durable task. */
export interface ReviewDecision<Answer, Result, App> {
  open(
    request: { readonly expiresAtMs: number; readonly previousWaitId?: string },
    context: OperationContext<App>,
  ): Promise<WaitRecord<Answer>>;
  respond(
    request: { readonly submissionId: string; readonly answer: Answer },
    context: OperationContext<App>,
  ): Promise<WaitRecord<Answer>>;
  read(context: OperationContext<App>): Promise<ReviewDecisionState<Result>>;
  continue(context: OperationContext<App>): Promise<ReviewDecisionState<Result>>;
}

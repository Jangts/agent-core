/** Optional result review contracts. Hosts own scope, facts, authorization and model resources. */
import type { MaybePromise, OperationContext } from '../common.js';

/** Host-fixed common decision scope. Revisions identify content and policy, not storage CAS generations. */
export interface ResultReviewScope {
  readonly id: string;
  /** Changes when the decision materials or question change, not merely on lifecycle updates. */
  readonly contentRevision: string;
  /** Host policy version used for interpretation and later admission checks. */
  readonly policyRevision: string;
}
/** Trusted execution metadata around an unchanged, precisely typed business result. */
export interface ResultReviewInput<Value> {
  readonly id: string;
  readonly sourceId: string;
  readonly scopeId: string;
  readonly versions: readonly { readonly resourceId: string; readonly revision: string }[];
  readonly evidenceIds: readonly string[];
  readonly value: Value;
}
/** One inspection snapshot. maxCandidates limits attempts across all registered detectors (default 64). */
export interface ResultReviewRequest<Value> {
  readonly scope: ResultReviewScope;
  readonly inputs: readonly ResultReviewInput<Value>[];
  readonly maxCandidates?: number;
}
/** One detector-declared check unit referencing only inputs in the trusted scope. */
export interface ResultReviewCandidate {
  readonly id: string;
  readonly inputIds: readonly string[];
}
/** An inconsistency with source references. Confirmed means reproducible disagreement, not factual truth. */
export interface ResultReviewFinding {
  readonly id: string;
  readonly kind: string;
  readonly state: 'suspected' | 'confirmed';
  readonly inputIds: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly reason: string;
  readonly blocking: boolean;
}
/** Coverage of declared candidates, independent of findings. Complete is not a correctness guarantee. */
export interface ResultReviewCoverage {
  readonly detectorId: string;
  readonly status: 'complete' | 'partial' | 'not-run' | 'failed';
  readonly inspected: readonly string[];
  readonly skipped: readonly string[];
  readonly reason?: string;
}
/** Detached review metadata; findings and incomplete coverage may coexist. */
export interface ResultReviewResult {
  readonly scope: ResultReviewScope;
  readonly findings: readonly ResultReviewFinding[];
  readonly coverage: readonly ResultReviewCoverage[];
}
/** Optional deterministic or semantic check. Semantic handlers use host-injected current resources. */
export interface ResultReviewDetector<Value, App> {
  readonly id: string;
  /** Trusted host policy overriding model/handler blocking flags; predicates are synchronous.
   * Receives validated findings with detector-qualified ids. Omission retains handler projection.
   */
  readonly blocking?: boolean | ((finding: ResultReviewFinding) => boolean);
  candidates(request: ResultReviewRequest<Value>): readonly ResultReviewCandidate[];
  run(
    candidate: ResultReviewCandidate,
    request: ResultReviewRequest<Value>,
    context: OperationContext<App>,
  ): MaybePromise<{
    readonly findings: readonly ResultReviewFinding[];
    /** True only when the declared candidate was fully inspected, not that its claims are true. */
    readonly complete: boolean;
    readonly reason?: string;
  }>;
}
/** A bounded strategy proposal. It does not authorize a write or mutate the original findings. */
export interface ResultReviewResolution {
  readonly findingId: string;
  readonly strategyId: string;
  readonly status: 'resolved' | 'unresolved' | 'needs-answer';
  readonly reason: string;
  readonly rounds: number;
}
/** Ordered App-selected review policy, with explicit progress to bound repeated unresolved work. */
export interface ResultReviewStrategy<Value, App> {
  readonly id: string;
  when(finding: ResultReviewFinding): boolean;
  run(
    finding: ResultReviewFinding,
    request: ResultReviewRequest<Value>,
    context: OperationContext<App>,
  ): MaybePromise<{
    readonly status: ResultReviewResolution['status'];
    readonly reason: string;
    /** Stable evidence/progress marker. Omission or repetition ends further review. */
    readonly progress?: string;
  }>;
}
/** Stable detector and strategy registrations; their methods retain original receivers. */
export interface ResultReviewDefinition<Value, App> {
  readonly detectors: readonly ResultReviewDetector<Value, App>[];
  readonly strategies?: readonly ResultReviewStrategy<Value, App>[];
}
/** Inspection needs no storage. Resolution is optional and never commits host state. */
export interface ResultReview<Value, App> {
  inspect(
    request: ResultReviewRequest<Value>,
    context: OperationContext<App>,
  ): Promise<ResultReviewResult>;
  resolve(
    request: ResultReviewRequest<Value>,
    result: ResultReviewResult,
    context: OperationContext<App>,
    options?: { readonly maxRounds?: number },
  ): Promise<readonly ResultReviewResolution[]>;
}
/** Trusted host preflight requirements. Recheck current versions and authorization at atomic commit. */
export interface ResultReviewAdmissionRequest {
  readonly result: ResultReviewResult;
  readonly requiredDetectorIds: readonly string[];
  readonly contentRevision: string;
  readonly policyRevision: string;
  readonly scopeId: string;
  /** Only trusted host-accepted resolutions can remove blocking findings. */
  readonly resolvedFindingIds?: readonly string[];
}

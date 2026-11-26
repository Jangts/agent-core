/**
 * Error types and error-metadata contracts used by agent-core.
 *
 * Errors remain plain `Error` subclasses so hosts can catch them without importing a hierarchy;
 * stage and retryability metadata is attached beside the value (see `src/errors.ts`) instead of
 * replacing the original thrown value or its identity.
 *
 * Exports: `ValidationError`, `BudgetError`, `WorkflowContractError`, `AgentErrorInfo`,
 * `ErrorContext`.
 */
import type { Issue } from './common.js';

/**
 * Rejected input or output that failed one or more registered checks.
 *
 * The message is fixed; consumers should read `issues` for the actual reasons.
 */
export class ValidationError extends Error {
  /**
   * @param issues - Validation problems, stored verbatim and exposed to the catcher.
   */
  constructor(readonly issues: readonly Issue[]) {
    super('Agent validation failed');
  }
}

/**
 * A configured allowance (rounds, model calls, attempts) is exhausted.
 *
 * The optional message states which allowance ran out; `code` is the stable marker.
 */
export class BudgetError extends Error {
  readonly code = 'BUDGET';
}

/**
 * The workflow definition violates Core's execution contract, as opposed to failing business logic.
 *
 * Examples: unknown model binding, asynchronous predicate, unmatched route, missing state field.
 * It is a programming error, so callers should not treat it as retryable.
 */
export class WorkflowContractError extends Error {
  readonly code = 'WORKFLOW_CONTRACT';
  /**
   * @param message - Human-readable contract violation; preserved by `Error`.
   */
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowContractError';
  }
}

/** Stable error metadata for App diagnostics. Unknown retryability is deliberately omitted. */
export interface AgentErrorInfo {
  /** Primary code: the error's own `code`, or a derived/fallback classification. */
  readonly code: string;
  /** Every code observed while inspecting the error and its causes, primary code first. */
  readonly codes: readonly string[];
  /** Structured issues found on the error; empty when the source reported none. */
  readonly issues: readonly Readonly<Issue>[];
  /** Execution stage that recorded the error, when the boundary annotated it. */
  readonly stageId?: string;
  /** Present only when the source stated retryability; absence means unknown. */
  readonly isRetryable?: boolean;
  /** Original thrown value, kept for identity and host-specific handling. */
  readonly cause: unknown;
}
/** Boundary metadata is recorded internally, without replacing the original thrown value. */
export interface ErrorContext {
  /** Stage that first observed the error; later annotations keep the earliest value. */
  readonly stageId?: string;
  /** Codes contributed by the boundary, merged with those found on the error itself. */
  readonly codes?: readonly string[];
  /** Retryability asserted by the boundary; omitted when it cannot be determined. */
  readonly isRetryable?: boolean;
}

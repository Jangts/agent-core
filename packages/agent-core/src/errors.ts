/**
 * Error metadata boundary: records which execution stage produced a failure and exposes a
 * stable, read-only view of it for diagnostics.
 *
 * The original thrown value is never wrapped or replaced, so App code keeps its own error
 * identity and stack. Annotations live in a side table keyed by reference, which works for
 * frozen Errors and DOMException instances whose properties cannot be added.
 *
 * Exports: `recordErrorContext` (annotate at a boundary) and `getErrorInfo` (inspect).
 */
import { BudgetError, ValidationError } from './structs/errors.js';
import type { Issue } from './structs/common.js';
import type { AgentErrorInfo, ErrorContext } from './structs/errors.js';

// Side metadata preserves App error identity, including frozen Errors and DOMException.
const contexts = new WeakMap<object, ErrorContext>();
const reference = (value: unknown): value is object =>
  value !== null && (typeof value === 'object' || typeof value === 'function');

/**
 * Attach boundary metadata to a thrown value without changing that value.
 *
 * The earliest recorded stage stays authoritative on re-throw, so a failure is attributed
 * to the stage that first caught it rather than to the boundary that merely relays it.
 * Codes and retryability may still be filled in by an outer boundary that knows more.
 *
 * @param error Value being propagated. Non-object values are ignored: identity is tracked
 *   by reference, so primitives cannot carry annotations.
 * @param context Boundary annotations to merge into the existing entry, if any.
 * @returns The same reference, allowing `throw recordErrorContext(error, ctx)`.
 */
export function recordErrorContext(error: unknown, context: ErrorContext): unknown {
  if (reference(error)) {
    const previous = contexts.get(error);
    const stageId = previous?.stageId ?? context.stageId;
    contexts.set(error, { ...previous, ...context, stageId });
  }
  return error;
}

/**
 * Read classification metadata from an arbitrary thrown value.
 *
 * Returns normalized issues plus a primary code. `isRetryable` is left undefined when the
 * error neither states it nor makes a final classification, so callers do not mistake
 * "unknown" for "retryable".
 */
function inspectError(error: unknown): { code: string; issues: Issue[]; isRetryable?: boolean } {
  const source = reference(error)
    ? (error as {
        code?: unknown;
        errors?: unknown;
        issues?: unknown;
        name?: unknown;
        isRetryable?: unknown;
      })
    : {};
  const reportedIssues = source.issues;
  // Structured issues win over the older `errors` array, so an error carrying both is not
  // reported twice. Only the array shape is accepted; any other value falls through.
  const reportedErrors = Array.isArray(reportedIssues) ? undefined : source.errors;
  const raw = Array.isArray(reportedIssues)
    ? reportedIssues
    : Array.isArray(reportedErrors)
      ? reportedErrors
      : [];
  const issues: Issue[] = raw.flatMap((value) => {
    if (!value || typeof value !== 'object') return [];
    const { code, message, path: reportedPath, checkId } = value;
    if (typeof code !== 'string') return [];
    const pathItems =
      typeof reportedPath === 'string'
        ? [reportedPath]
        : Array.isArray(reportedPath)
          ? Array.from(reportedPath)
          : undefined;
    const path = pathItems?.every(
      (part: unknown) => typeof part === 'string' || typeof part === 'number',
    )
      ? pathItems
      : undefined;
    return [
      {
        code,
        message: typeof message === 'string' ? message : code,
        ...(path === undefined ? {} : { path: Object.freeze(path) }),
        ...(typeof checkId === 'string' ? { checkId } : {}),
      },
    ];
  });
  const code = source.code;
  // A string `code` or a structured issue is already a usable classification, so the error
  // `name` is only consulted as a last resort.
  const name = typeof code === 'string' || issues.length ? undefined : source.name;
  // DOMException exposes cancellation through `name` rather than `code`; the mapping keeps
  // cancellation and timeout distinguishable from genuine failures.
  const fallback =
    typeof code === 'string'
      ? code
      : (issues[0]?.code ??
        (name === 'AbortError'
          ? 'CANCELLED'
          : name === 'TimeoutError'
            ? 'TIMEOUT'
            : 'UNKNOWN_ERROR'));
  const retryable = source.isRetryable;
  // Retryability stays unknown unless the error reports it or it is provably final:
  // budget, validation, issue-bearing and cancellation failures must not be retried.
  const isRetryable =
    typeof retryable === 'boolean'
      ? retryable
      : error instanceof BudgetError ||
          error instanceof ValidationError ||
          issues.length ||
          ['CANCELLED', 'TIMEOUT', 'BUDGET'].includes(fallback)
        ? false
        : undefined;
  return { code: fallback, issues, isRetryable };
}

/**
 * Produce a frozen diagnostic view of any thrown value.
 *
 * Inspection is guarded: an exotic error (revoked proxy, throwing getter, null prototype)
 * degrades to `UNKNOWN_ERROR` instead of raising a second failure while handling the first.
 *
 * @param error Any thrown value, including non-Error values such as strings.
 * @returns Frozen info. `codes` lists every known code with the primary one first; optional
 *   fields are omitted rather than emitted as `undefined`. `cause` is the original value.
 */
export function getErrorInfo(error: unknown): AgentErrorInfo {
  const context = reference(error) ? contexts.get(error) : undefined;
  let view: ReturnType<typeof inspectError>;
  try {
    view = inspectError(error);
  } catch {
    view = { code: 'UNKNOWN_ERROR', issues: [] };
  }
  const { code: fallback, issues } = view;
  // Recorded codes describe the boundary where the error was first captured and outrank
  // codes inferred from the current shape, which may already have been flattened.
  const codes = Object.freeze([
    ...(context?.codes ?? (issues.length ? issues.map((issue) => issue.code) : [fallback])),
  ]);
  const isRetryable = context?.isRetryable ?? view.isRetryable;
  return Object.freeze({
    code: codes[0] ?? fallback,
    codes,
    issues: Object.freeze(issues.map((issue) => Object.freeze(issue))),
    ...(context?.stageId === undefined ? {} : { stageId: context.stageId }),
    ...(isRetryable === undefined ? {} : { isRetryable }),
    cause: error,
  });
}

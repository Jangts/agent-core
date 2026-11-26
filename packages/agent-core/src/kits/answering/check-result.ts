/**
 * Answering Kit: the frozen result contract shared by checkers and batch review.
 *
 * Place in the package: part of the `answering` Kit. It normalizes one check outcome and
 * rejects internally inconsistent statuses so aggregation can trust what it receives.
 *
 * Exports: `snapshotAnswerCheck`.
 */
import type { AnswerCheck } from '../../structs/kits/answering/flow.js';

/**
 * Freeze and validate one check result.
 *
 * @param check - Check outcome: status, issues and an optional replacement value.
 * @param checkId - Id stamped onto issues that do not carry their own, so the failing checker
 *   stays identifiable after aggregation.
 * @returns A frozen copy with frozen issues and paths.
 * @throws TypeError When the status is unknown, an issue is malformed, a `passed` result still
 *   reports issues, or a `failed` result reports none.
 */
export function snapshotAnswerCheck<Value>(
  check: AnswerCheck<Value>,
  checkId?: string,
): AnswerCheck<Value> {
  if (
    !check ||
    !['passed', 'failed', 'unavailable', 'not-run'].includes(check.status) ||
    !Array.isArray(check.issues) ||
    check.issues.some(
      (issue) =>
        !issue ||
        typeof issue.code !== 'string' ||
        !issue.code ||
        typeof issue.message !== 'string' ||
        (issue.path !== undefined &&
          (!Array.isArray(issue.path) ||
            issue.path.some(
              (part: unknown) => typeof part !== 'string' && typeof part !== 'number',
            ))),
    ) ||
    (check.status === 'passed' && check.issues.length) ||
    (check.status === 'failed' && !check.issues.length)
  )
    throw new TypeError('Invalid answer check result');
  return Object.freeze({
    status: check.status,
    ...('value' in check ? { value: check.value } : {}),
    issues: Object.freeze(
      check.issues.map((issue) =>
        Object.freeze({
          code: issue.code,
          message: issue.message,
          ...(issue.checkId !== undefined || checkId !== undefined
            ? { checkId: issue.checkId ?? checkId }
            : {}),
          ...(issue.path !== undefined ? { path: Object.freeze([...issue.path]) } : {}),
        }),
      ),
    ),
  });
}

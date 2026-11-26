/**
 * Answer checker contract for the Answering Kit.
 *
 * Place in the package: part of the `answering` Kit. A checker is one named validation unit over
 * a generated value; the flow owns when it runs and what a failure means for the result.
 *
 * Exports: `AnswerChecker`.
 */
import type { OperationContext, CheckResult } from '../../common.js';

/** One named check applied to a generated answer value. */
export interface AnswerChecker<Value, App> {
  /** Check id, reported with the issue and matched against a task's `checkIds`. */
  readonly id: string;
  /** Returns the verdict; `unavailable` and `not-run` are not verdicts on the value. */
  check(value: Value, context: OperationContext<App>): CheckResult<Value>;
}

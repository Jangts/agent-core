/**
 * Answering Kit: a catalog of named value checkers with one aggregated result.
 *
 * Place in the package: part of the `answering` Kit. Checkers are App business rules; this
 * module only registers them, runs a selected ordered subset and folds their statuses.
 *
 * Exports: `defineAnswerCheckCatalog`, and the answer checker types.
 */
import { nativeReportedStepSync } from '../../diagnostics/native-sub-flow.js';
import { snapshotAnswerCheck } from './check-result.js';
import { readonlyCatalog } from '../../utils/catalog.js';
import { synchronous } from '../../utils/synchronous.js';
import type { OperationContext } from '../../structs/common.js';
import type { AnswerCheck, AnswerIssue } from '../../structs/kits/answering/flow.js';
import type { AnswerChecker } from '../../structs/kits/answering/checks.js';

/**
 * Compile a checker catalog.
 *
 * A checker may return a replacement value; it is threaded into the next checker, so the
 * selected ids behave like an ordered chain rather than independent assertions.
 *
 * @param definitions - Checkers with unique ids and a synchronous `check` handler.
 * @returns A frozen catalog whose `check({ checkIds, value }, context)` folds the results.
 * @throws TypeError For a missing handler or a duplicate id; from `check` for a repeated
 *   selected id, a non-synchronous checker or an invalid check result.
 */
export function defineAnswerCheckCatalog<Value, App>(
  definitions: readonly AnswerChecker<Value, App>[],
) {
  const checks = readonlyCatalog(
    definitions.map((check) => {
      if (typeof check.check !== 'function') throw new TypeError('Invalid answer checker');
      return Object.freeze({ id: check.id, check: check.check.bind(check) });
    }),
    (id) => new TypeError(`Unknown answer checker: ${id}`),
  );
  return Object.freeze({
    ...checks,
    // Severity only escalates: `failed` wins over `unavailable`, which wins over `passed`.
    check(
      request: { checkIds: readonly string[]; value: Value },
      context: OperationContext<App>,
    ): AnswerCheck<Value> {
      context.signal.throwIfAborted();
      const issues: AnswerIssue[] = [];
      let status: AnswerCheck<Value>['status'] = 'passed',
        value = request.value;
      if (new Set(request.checkIds).size !== request.checkIds.length)
        throw new TypeError('Duplicate selected check id');
      for (const id of request.checkIds) {
        context.signal.throwIfAborted();
        const result = nativeReportedStepSync(context, 'check', id, () =>
          snapshotAnswerCheck(
            synchronous(
              checks.require(id).check(value, context),
              'Answer checkers must be synchronous',
            ),
            id,
          ),
        );
        context.signal.throwIfAborted();
        if (Object.hasOwn(result, 'value')) value = result.value!;
        issues.push(...result.issues);
        if (result.status === 'failed') status = 'failed';
        else if (status !== 'failed' && result.status !== 'passed') status = 'unavailable';
      }
      return { status, value, issues };
    },
  });
}
export type * from '../../structs/kits/answering/checks.js';

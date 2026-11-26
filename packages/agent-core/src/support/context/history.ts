/**
 * History grouping for context reductions: split structured message arrays into atomic groups.
 *
 * A group is the smallest unit a trim may remove, so "fixed" counts entries while "user-turn"
 * keeps each user message together with the assistant replies that follow it. Tool protocols are
 * rejected because they need their own grouping contract.
 *
 * Main exports: `historyGrouping`, `historyGroupingCatalog`, `historyGroups` and
 * `validateRecentHistory`.
 */
import type {
  ContextHistoryGrouping,
  ContextRecentHistory,
} from '../../structs/support/context-processing.js';
import { ValidationError } from '../../structs/errors.js';
import { breakWhile } from '../../utils/rules.js';
const invalid = (message: string) => new ValidationError([{ code: 'CONTEXT_POLICY', message }]);
const positive = (value: number | undefined) => Number.isSafeInteger(value) && value! > 0;

/**
 * Validate a grouping declaration and return it unchanged.
 *
 * @param options Grouping to validate.
 * @param options.grouping Grouping kind plus its kind-specific settings.
 * @returns The same grouping object supplied by the caller.
 * @throws {ValidationError} When the kind is unknown or its settings are invalid.
 */
export function historyGrouping(options: {
  grouping: ContextHistoryGrouping;
}): ContextHistoryGrouping {
  const grouping = options.grouping;
  breakWhile(
    !grouping || !Object.hasOwn(historyGroupingCatalog, grouping.kind),
    invalid('Unknown history grouping'),
  );
  historyGroupingCatalog[grouping.kind].validate(grouping);
  return grouping;
}
function validateFixed(grouping: ContextHistoryGrouping): void {
  if (grouping.kind !== 'fixed') throw invalid('Invalid fixed grouping');
  breakWhile(!positive(grouping.size), invalid('Invalid history group size'));
}
function fixedGroups(entries: readonly unknown[], grouping: ContextHistoryGrouping): unknown[][] {
  if (grouping.kind !== 'fixed') throw invalid('Invalid fixed grouping');
  breakWhile(entries.length % grouping.size !== 0, invalid('Incomplete context groups'));
  return Array.from({ length: entries.length / grouping.size }, (_, index) =>
    entries.slice(index * grouping.size, (index + 1) * grouping.size),
  );
}
function validateUserTurns(): void {}
function userTurns(entries: readonly unknown[]): unknown[][] {
  const groups: unknown[][] = [];
  for (const entry of entries) {
    const message = entry as { role?: unknown; content?: unknown } | null;
    breakWhile(
      !message ||
        !['user', 'assistant'].includes(message.role as string) ||
        typeof message.content !== 'string',
      invalid(
        'User-turn history requires user/assistant text messages; tool protocols need their own grouping contract',
      ),
    );
    if (message!.role === 'user') groups.push([]);
    breakWhile(
      !groups.length,
      invalid('User-turn history cannot start with an orphan assistant message'),
    );
    groups.at(-1)!.push(entry);
  }
  return groups;
}
interface GroupingHandler {
  validate(grouping: ContextHistoryGrouping): void;
  split(entries: readonly unknown[], grouping: ContextHistoryGrouping): unknown[][];
}
/**
 * Grouping kinds with their validators and splitters.
 *
 * Validation and splitting come from one declaration so a policy cannot pass validation with
 * rules that the splitter does not apply.
 */
export const historyGroupingCatalog = {
  fixed: { validate: validateFixed, split: fixedGroups },
  'user-turn': { validate: validateUserTurns, split: userTurns },
} satisfies Record<ContextHistoryGrouping['kind'], GroupingHandler>;

/**
 * Split the entries of one structured field into removable groups.
 *
 * @param value Fragment value expected to be an object holding an array at `field`.
 * @param options Field name and grouping rule to apply.
 * @returns Grouped entries in source order; an empty array yields no groups.
 * @throws {ValidationError} When the value is a string, the field is not an array, the grouping
 *   is invalid, or the entries do not satisfy the grouping contract.
 */
export function historyGroups(
  value: string | Record<string, unknown>,
  options: { field: string; grouping: ContextHistoryGrouping },
): unknown[][] {
  breakWhile(
    typeof value === 'string' || !Array.isArray(value[options.field]),
    invalid('History requires a structured array field'),
  );
  const grouping = historyGrouping(options);
  return historyGroupingCatalog[grouping.kind].split(
    (value as Record<string, unknown>)[options.field] as unknown[],
    grouping,
  );
}
/**
 * Validate a recent-history retention declaration.
 *
 * `keepGroups` may be zero (drop everything eligible); negative or fractional counts are rejected
 * because groups are indivisible.
 *
 * @param options Field, retained group count and grouping rule.
 * @throws {ValidationError} When the field is empty, `keepGroups` is invalid, or the grouping is
 *   not recognised.
 */
export function validateRecentHistory(options: ContextRecentHistory): void {
  breakWhile(
    !options.field || !Number.isSafeInteger(options.keepGroups) || options.keepGroups < 0,
    invalid('Invalid recent-history retention'),
  );
  historyGrouping(options);
}

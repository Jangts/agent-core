/**
 * Declarative rule primitives.
 *
 * Three shapes cover the enumerable decisions in this package: first-match dispatch
 * (`matchRule`), ordered mutation of shared input (`walkRules`) and reject-on-failure
 * validation (`breakWhile`). Ordinary single-condition code stays an `if`; these helpers
 * exist so multi-branch tables stay readable and their ordering is explicit.
 *
 * Exports: `matchRule`, `walkRules`, `breakWhile`, the re-exported
 * `configureBreakWhile`, and the rule types from `structs/utils/rules`.
 */
import type {
  MatchRule,
  WalkRule,
  BreakReason,
  BreakCheck,
  BreakPredicate,
} from '../structs/utils/rules.js';
import { synchronous, booleanResult } from './synchronous.js';
import { observeBreak } from './break-observer.js';

export { configureBreakWhile } from './break-observer.js';

/**
 * Dispatch to the first matching rule.
 *
 * A rule without a pattern matches unconditionally, so the table's order decides
 * precedence. The first match owns the result even when its handler returns undefined,
 * and later rules are not consulted.
 *
 * @param rules - Ordered rules; only the first match is executed.
 * @param input - Value passed to the pattern and handler.
 * @returns The handler result, or undefined when nothing matched.
 * @throws TypeError When a pattern returns a thenable or a non-boolean.
 */
export function matchRule<Input, Result>(
  rules: readonly MatchRule<Input, Result>[],
  input: Input,
): Result | undefined {
  return rules
    .find(
      (rule) =>
        rule.pattern === undefined ||
        booleanResult(rule.pattern(input), 'Rule patterns must return boolean synchronously'),
    )
    ?.handle(input);
}

/**
 * Walk every rule in order, mutating the shared input.
 *
 * Later rules observe the mutations of earlier ones, which is why traversal is strictly
 * sequential and every participant must be synchronous. Throwing stops the walk
 * immediately; remaining rules are skipped.
 *
 * @param rules - Ordered rules.
 */
export function walkRules(rules: readonly WalkRule[]): void;
/**
 * Walk every rule in order, mutating the shared input.
 *
 * @param rules - Ordered rules.
 * @param input - Mutable input shared by all hooks and handlers.
 */
export function walkRules<Input>(rules: readonly WalkRule<Input>[], input: Input): void;
export function walkRules<Input>(
  rules: readonly WalkRule<Input>[],
  input: Input = undefined as Input,
): void {
  for (const rule of rules) {
    synchronous(rule.before?.(input), 'Rule traversal hooks must be synchronous');
    if (
      rule.pattern === undefined ||
      booleanResult(rule.pattern(input), 'Rule patterns must return boolean synchronously')
    )
      synchronous(rule.handle(input), 'Rule traversal handlers must be synchronous');
  }
}

/**
 * Reject as soon as one of several conditions holds.
 *
 * Ordinary processing stays an ordinary `if`; this helper is for validation tables
 * whose entries are evaluated in order and stop at the first failure. Behaviour that
 * depends on earlier entries is expressed with a callback form.
 *
 * @param occur - Predicates, or a single predicate/array of predicates.
 * @param error - Reason thrown on the first match; defaults to an empty Error.
 * @param tags - Tags reported to the installed break observer.
 * @throws The configured reason of the first matching check.
 */
export function breakWhile(
  occur: readonly BreakPredicate[],
  error?: BreakReason,
  tags?: readonly string[],
): void;
/**
 * Reject when any predicate holds, reporting the given observer tags.
 *
 * @param occur - Predicates evaluated in order.
 * @param tags - Tags reported to the installed break observer.
 */
export function breakWhile(occur: readonly BreakPredicate[], tags: readonly string[]): void;
/**
 * Reject when any structured check holds.
 *
 * Each check may carry its own reason and tags; the first match stops the evaluation.
 *
 * @param checks - Checks evaluated in order.
 * @param tags - Call-site tags merged with each check's own tags.
 */
export function breakWhile(checks: readonly BreakCheck[], tags?: readonly string[]): void;
/**
 * Reject when a single value is truthy.
 *
 * Ordinary truthiness applies, so a function passed as a value counts as a failure;
 * use the predicate form to evaluate it instead.
 *
 * @param occur - Value tested with JavaScript truthiness.
 * @param error - Reason thrown when the value is truthy.
 * @param tags - Tags reported to the installed break observer.
 */
export function breakWhile(occur: unknown, error?: BreakReason, tags?: readonly string[]): void;
/**
 * Reject when a single value is truthy, reporting the given observer tags.
 *
 * @param occur - Value tested with JavaScript truthiness.
 * @param tags - Tags reported to the installed break observer.
 */
export function breakWhile(occur: unknown, tags: readonly string[]): void;
export function breakWhile(
  occur: unknown,
  errorOrTags?: BreakReason | readonly string[],
  tags: readonly string[] = [],
): void {
  const error = Array.isArray(errorOrTags) ? undefined : (errorOrTags as BreakReason | undefined);
  const callTags = Array.isArray(errorOrTags) ? errorOrTags : tags;
  // A single value keeps ordinary JS truthiness, including a function used as a value.
  const checks: readonly BreakCheck[] = Array.isArray(occur)
    ? typeof occur[0] === 'function' && occur.every((item) => typeof item === 'function')
      ? [{ occur, error }]
      : occur
    : [{ occur: () => occur, error }];
  for (const check of checks) {
    try {
      if (
        !check ||
        typeof check !== 'object' ||
        Array.isArray(check) ||
        !Object.hasOwn(check, 'occur') ||
        'condition' in check ||
        'conditions' in check
      )
        throw new TypeError(
          'A break check requires occur; condition and conditions were renamed to occur',
        );
      const occur = check.occur;
      if (Array.isArray(occur) && occur.some((predicate) => typeof predicate !== 'function'))
        throw new TypeError('An occur array requires predicates');
      const matched = Array.isArray(occur)
        ? occur.some((predicate) =>
            synchronous(predicate(), 'Occur predicates must be synchronous'),
          )
        : typeof occur === 'function'
          ? synchronous(occur(), 'Occur predicates must be synchronous')
          : occur;
      if (!matched) continue;
      const reason =
        typeof check.error === 'function'
          ? synchronous(check.error(), 'Break reasons must be synchronous')
          : check.error;
      throw reason === undefined
        ? new Error()
        : typeof reason === 'string'
          ? new Error(reason)
          : reason;
    } catch (failure) {
      observeBreak(failure, callTags, check);
      throw failure;
    }
  }
}

// Re-exported so callers configuring rules do not need to import the struct module.
export type {
  MatchRule,
  WalkRule,
  BreakReason,
  BreakCheck,
  BreakPredicate,
  BreakEvent,
  BreakWhileConfig,
} from '../structs/utils/rules.js';

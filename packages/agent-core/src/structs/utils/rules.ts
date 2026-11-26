/**
 * Shared rule vocabulary for ordered matching, traversal and rejection checks.
 *
 * Place in the package: Core-level primitives used by both Core and Support. They describe rule
 * lists only; the helper that executes them lives in `utils/rules.ts`, so a declaration stays
 * readable without importing behaviour.
 *
 * Exports: `MatchRule`, `WalkRule`, `BreakReason`, `BreakPredicate`, `BreakCheck`, `BreakEvent`,
 * `BreakWhileConfig`.
 */
/** Order is priority. Patterns may inspect values, types, state or regular expressions. */
export interface MatchRule<Input, Result = void> {
  /** Unique rule id used in diagnostics. */
  readonly id: string;
  readonly description: string;
  /** Omission is an unconditional match at this position, normally the final fallback. */
  readonly pattern?: (input: Readonly<Input>) => boolean;
  /** Produces the rule's result; only the first matching rule runs. */
  readonly handle: (input: Input) => Result;
}

/** Synchronous traversal; local rules may omit catalog metadata. */
export interface WalkRule<Input = void> extends Partial<MatchRule<Input, unknown>> {
  /** Runs when the rule matches; must return synchronously. */
  readonly handle: (input: Input) => unknown;
  /** Runs before matching, including when the rule does not match. */
  readonly before?: (input: Input) => void;
}

/** Lazy reasons preserve error construction and message evaluation on the rejection path only. */
export type BreakReason = Error | string | (() => Error | string);

/** Each predicate is evaluated only after the preceding predicates passed. */
export type BreakPredicate = () => unknown;

/** Each rule owns a semantic/readability group and its tags, independently of shared errors. */
export interface BreakCheck {
  /** A truthy failure, lazy predicate, or ordered OR-list of lazy predicates. */
  readonly occur: unknown;
  /** Rejection reason; omitted means the helper creates a default `Error`. */
  readonly error?: BreakReason;
  /** Tags attributed to the rejection, merged with the enclosing group's tags. */
  readonly tags?: readonly string[];
}

/** Diagnostic metadata only; rule inputs and request data are not included. */
export interface BreakEvent {
  /** The thrown value, kept for identity. */
  readonly error: unknown;
  /** Tags of the check that rejected, plus its enclosing group tags. */
  readonly tags: readonly string[];
}

/** Global rejection observer installed once per process. */
export interface BreakWhileConfig {
  /** Called before the reason is thrown; its errors are swallowed and promises are not awaited. */
  readonly onBreak?: (event: BreakEvent) => void | Promise<void>;
}

/**
 * Policy and recovery contract for the Policies Kit.
 *
 * Place in the package: an optional App-side library for policy and recovery tables. Predicates,
 * recovery handlers, kinds and descriptions are App configuration; the Kit owns registration
 * checks, evaluation order and outcome validation.
 *
 * Exports: `PolicyDefinition`, `PolicyAssessment`, `RecoveryResult`, `RecoveryDefinition`.
 */
/** One declarative policy. */
export interface PolicyDefinition<Input, Kind extends string = string> {
  /** Unique policy id; also reported as a reason when the policy matches. */
  readonly id: string;
  /** Human-readable explanation; must not be blank. */
  readonly description: string;
  /** Policy family used to deduplicate reported kinds. */
  readonly kind: Kind;
  /** Returns whether the policy applies; must be synchronous boolean. */
  when(input: Input): boolean;
}

/** Result of assessing every registered policy against one input. */
export interface PolicyAssessment<Kind extends string = string> {
  /** True when at least one policy matched. */
  readonly required: boolean;
  /** Ids of the matched policies, in registration order. */
  readonly reasons: readonly string[];
  /** Distinct kinds of the matched policies, in first-match order. */
  readonly kinds: readonly Kind[];
}

/** Outcome of one recovery handler, or of the whole chain. */
export type RecoveryResult<Value> =
  /** The handler declined; the chain continues with the next declaration. */
  { readonly handled: false } | { readonly handled: true; readonly value: Value };

/** One recovery handler in an ordered chain. */
export interface RecoveryDefinition<Input, Result> {
  /** Unique handler id. */
  readonly id: string;
  readonly description: string;
  /** Attempts recovery; must be synchronous and the first handled result wins. */
  tryRecover(input: Input): RecoveryResult<Result>;
}

/**
 * Conditional registration contract.
 *
 * Place in the package: Support-side composition for App install steps. Steps are validated once,
 * then installed in order per invocation; a predicate may only observe what earlier steps already
 * installed, so declaration order is part of the contract. No new scheduling protocol is defined.
 *
 * Exports: `RegistrationDefinition`.
 */
/** One install step. */
export interface RegistrationDefinition<Context> {
  /** Unique step id; also the catalog key. */
  readonly id: string;
  /** Installs the step when true; must be synchronous and is re-evaluated per install. */
  readonly when?: (context: Context) => boolean;
  /** Performs the installation; must return void synchronously. */
  readonly register: (context: Context) => void;
}

/**
 * Template contract for the Presentation Kit.
 *
 * Place in the package: an optional App-side text master and a semantic-key allowlist. The program
 * owns the master; inserted model text is only a value substituted into it, never a new template.
 *
 * Exports: `TextTemplateOptions`, `SemanticSlotDefinition`.
 */
/** Text template construction options. */
export interface TextTemplateOptions {
  /** Observer invoked with every rendered text. */
  readonly observe?: (result: string) => void | Promise<void>;
  /** Builds the error for a slot the caller did not supply; receives the slot name. */
  readonly errors?: { readonly missingField?: (key: string) => Error | string };
}

/** Declares the `{{namespace:key}}` slots a model may use, and how often. */
export interface SemanticSlotDefinition {
  /** Slot namespace; must match `^[a-z][a-z0-9-]*$`. */
  readonly namespace: string;
  /** Allowed keys after the namespace; any other key makes the text invalid. */
  readonly keys: readonly string[];
  /** Maximum total occurrences across the text; must be a non-negative integer. */
  readonly maxOccurrences: number;
}

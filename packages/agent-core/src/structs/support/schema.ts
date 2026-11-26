/**
 * Schema adapter contract.
 *
 * Place in the package: Support-side adapters that turn an App's JSON Schema compiler or parsing
 * library into the Core `SchemaAdapter` shape. The compiler, package and error messages stay
 * application choices; schema snapshots are frozen before they reach the compiler.
 *
 * Exports: `JsonSchemaValidator`, `JsonSchemaOptions`.
 */
/** App-owned JSON Schema compilers provide synchronous validation. */
export interface JsonSchemaValidator<Output = unknown> {
  /** Returns whether the value is valid; must be synchronous. */
  (value: unknown): value is Output;
  /** Compiler-reported details for the last failed validation, when the library exposes them. */
  readonly errors?: unknown;
}
/** Options for building an adapter from a JSON Schema compiler. */
export interface JsonSchemaOptions<Output> {
  /** Compiles a frozen schema copy into a validator; must return synchronously. */
  compile(schema: Record<string, unknown>): JsonSchemaValidator<Output>;
  /** Builds the thrown error for an invalid value; defaults to a `TypeError`. */
  error?(value: unknown, errors: unknown): Error;
}

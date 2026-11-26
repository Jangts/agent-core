/**
 * Normalization contract for the Normalization Kit.
 *
 * Place in the package: an optional App-side helper that cleans model or transport input before it
 * reaches business logic. Steps are ordered, synchronous value-to-value transformations; the Kit
 * never mutates the caller's arrays.
 *
 * Exports: `NormalizationStep`, `NormalizationOptions`.
 */
/** One ordered transformation. */
export interface NormalizationStep<Value, Context> {
  /** Unique, non-blank step id used in errors. */
  readonly id: string;
  /** Skips the step when it returns false; must be synchronous boolean. */
  readonly when?: (value: Value, context: Context) => boolean;
  /** Returns the next value; receives the output of the previous step. Must be synchronous. */
  readonly normalize: (value: Value, context: Context) => Value;
}

/** Pipeline options. */
export interface NormalizationOptions<Value, Context> {
  /** Stops the walk after the step that first returns true; later steps then do not run. */
  readonly isComplete?: (value: Value, context: Context) => boolean;
}

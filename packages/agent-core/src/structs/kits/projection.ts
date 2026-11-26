/**
 * Projection contract for the Projection Kit.
 *
 * Place in the package: an optional App-side helper that fits structured values into a character
 * budget while keeping valid JSON. Callers choose the budget, rendering strategy and fallback text;
 * the Kit only shrinks values and verifies the result fits.
 *
 * Exports: `ContentProjection`, `ContentProjectionOptions`, `TreeProjectionOptions`.
 */
/** Projection output. */
export interface ContentProjection {
  /** Rendered text that fits the requested budget. */
  readonly text: string;
  /** True when anything was shortened or replaced by the fallback. */
  readonly truncated: boolean;
}

/** Candidate strategy for content projection. */
export interface ContentProjectionOptions {
  /** Maximum array items to keep, tried in order before moving to the next length. */
  readonly counts: readonly number[];
  /** Maximum characters per string, tried in order inside each count candidate. */
  readonly lengths: readonly number[];
  /** Renders a shortened value; must be synchronous. */
  readonly render: (excerpt: unknown) => string;
  /** Builds fallback text for a limit, used when no candidate fits; must be synchronous. */
  readonly fallback: (limit: number) => string;
}

/** Depth- and record-level traversal options for tree projection. */
export interface TreeProjectionOptions<Context> {
  /** Maximum included depth; deeper values are omitted. Must be a non-negative integer. */
  readonly maxDepth: number;
  /** Drops a value when it returns true; must be synchronous boolean. */
  readonly omit?: (value: unknown, depth: number, context: Context) => boolean;
  /** Observes every retained record, for example to record which fields were kept. */
  readonly visitRecord?: (value: Record<string, unknown>, depth: number, context: Context) => void;
}

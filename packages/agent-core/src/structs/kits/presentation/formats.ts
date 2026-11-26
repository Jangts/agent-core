/**
 * Reply-format contract for the Presentation Kit.
 *
 * A format exists only where the App provides a template for the final reply. Replies without a
 * resolved format have no output-format requirement, so callers skip these checks instead of
 * re-asking the model.
 *
 * Exports: `ReplyFormatCheck`, `ReplyFormatDefinition`, `CompiledReplyFormat`, `ReplyFormatOptions`.
 */
/** One check a template declares, evaluated against the rendered bubbles. */
export interface ReplyFormatCheck {
  /** Stable check id referenced by formats. */
  readonly id: string;
  /** Human-readable statement of the template requirement. */
  readonly description: string;
  /** Returns whether the reply satisfies this requirement. */
  readonly accepts: (bubbles: readonly string[]) => boolean;
}

/** A template-bound reply format, matched against per-turn facts. */
export interface ReplyFormatDefinition<Context = unknown> {
  /** Stable format id. */
  readonly id: string;
  /** Human-readable statement of the template. */
  readonly description: string;
  /** Check ids this template requires. */
  readonly checks: readonly string[];
  /** Whether the current turn uses this template. */
  readonly when: (context: Context) => boolean;
}

/** A resolved format with its checks bound; callers only inspect replies using it. */
export interface CompiledReplyFormat {
  readonly id: string;
  readonly description: string;
  readonly checks: readonly string[];
  /** Checks the reply fails; empty means the template format is satisfied. */
  readonly inspect: (bubbles: readonly string[]) => readonly ReplyFormatCheck[];
}

/** Declaration input for `defineReplyFormats`. */
export interface ReplyFormatOptions<Context = unknown> {
  readonly formats: readonly ReplyFormatDefinition<Context>[];
  readonly checks: readonly ReplyFormatCheck[];
}

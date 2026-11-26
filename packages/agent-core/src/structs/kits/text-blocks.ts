/**
 * Text block contract for the Text Blocks Kit.
 *
 * Place in the package: an optional App-side helper for splitting long plain text into
 * structure-aware blocks before paging or retrieval. File reading, paging, search, storage
 * and prompt wording stay with the App.
 *
 * Exports: `TextBlock`, `TextBlockOptions`.
 */

/** One structure-aware block of a long text. */
export interface TextBlock {
  /** One-based position in source order; stable for a given text and target size. */
  readonly number: number;
  /** Exact source substring, including its own line endings. */
  readonly text: string;
  /** Start offset in UTF-16 code units. */
  readonly start: number;
  /** End offset (exclusive) in UTF-16 code units; `end - start === text.length`. */
  readonly end: number;
}

/** Splitting options. */
export interface TextBlockOptions {
  /** Target block size in characters; only a single over-long line may exceed it. */
  readonly targetChars: number;
}

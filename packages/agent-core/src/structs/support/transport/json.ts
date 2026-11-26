/**
 * JSON transport framing contract.
 *
 * Place in the package: Support-side helpers that locate complete JSON objects inside streamed
 * text. Framing is mechanical and never repairs or interprets fields; the caller decides which
 * outside content and frames are acceptable. Limits prevent malformed streams from consuming
 * unbounded memory.
 *
 * Exports: `JsonFrameLimits`, `JsonTransportPart`.
 */
/** Bounds applied while scanning a streamed text. */
export interface JsonFrameLimits {
  /** Maximum number of complete frames accepted. */
  maxFrames: number;
  /** Stray closing braces tolerated outside frames, covering transports that repeat a delimiter. */
  maxExtraClosings: number;
  /** Optional per-frame character cap so a single frame cannot amplify into an oversized parse. */
  maxFrameChars?: number;
}

/** One scanned span: a complete object frame or a character outside any frame. */
export type JsonTransportPart = { kind: 'frame' | 'outside'; text: string };

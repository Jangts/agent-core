/**
 * Raw model tool-response contracts: one response may carry text and several tool calls.
 *
 * These shapes are Core-only and deliberately contain no host tool resolution. Support's
 * session interaction adds `toolId`, parsed `input` and non-fatal `problem` fields in its own
 * `DecodedModelToolResponse` type.
 *
 * Exports: `ModelResponseToolCall`, `ModelToolResponse`.
 */

/** One completed tool call in a model tool response. */
export interface ModelResponseToolCall {
  /** Provider index used to join streamed fragments. */
  readonly index: number;
  /** Provider call id, echoed by the matching tool result. */
  readonly id: string;
  /** Declared function name exactly as returned by the model. */
  readonly name: string;
  /** Raw JSON argument text exactly as returned by the model. */
  readonly arguments: string;
  /** Characters counted for the output budget. */
  readonly argumentChars: number;
}

/** Complete result of one model tool response. */
export interface ModelToolResponse {
  /** Streamed assistant prose; may be empty when the response only declares calls. */
  readonly text: string;
  /** Completed calls in provider index order. */
  readonly calls: readonly ModelResponseToolCall[];
}

/** @deprecated Use `ModelResponseToolCall`. Retained for the 0.9 migration. */
export type { ModelResponseToolCall as ModelSessionCall };
/** @deprecated Use `ModelToolResponse`. Retained for the 0.9 migration. */
export type { ModelToolResponse as ModelSessionResult };

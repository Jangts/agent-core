/**
 * Presentation event contract for the Presentation Kit.
 *
 * Place in the package: an optional App-side output protocol between a validated reply and the
 * transport that displays it. Events describe already-validated text; they never represent
 * upstream model generation or an unvalidated draft.
 *
 * Exports: `AgentOutputEvent`, `ReplyBubbleInput`, `ReplyDeliveryOptions`.
 */
/** One output event of a delivered reply. */
export type AgentOutputEvent =
  /** Visible text chunk to append. */
  | { type: 'text'; text: string }
  /** Preview of the bubbles to be delivered, emitted before any text. */
  | { type: 'preview'; bubbles: string[] }
  /** Replaces everything delivered so far with `text`. */
  | { type: 'replace'; text: string }
  /** Separates the next text chunk into a new bubble. */
  | { type: 'bubble' };

/** Reply pieces accepted by the bubble helpers; non-string entries are ignored. */
export interface ReplyBubbleInput {
  /** Primary reply text. */
  text?: unknown;
  /** Additional bubbles appended after `text`, when the value is an array. */
  bubbles?: unknown;
}

/** Host-controlled delivery of already validated text; not upstream model generation. */
export interface ReplyDeliveryOptions {
  /** Characters per emitted text event; defaults to 240 and must be a positive integer. */
  chunkSize?: number;
  /** Delay between chunks in milliseconds; defaults to 0. */
  intervalMs?: number;
  /** Delay between bubbles in milliseconds; defaults to 0. */
  bubblePauseMs?: number;
  /** Upper bound on intentional pacing time; backpressure and network time are independent. */
  maxDurationMs?: number;
}

/**
 * Server-sent event transport contract.
 *
 * Place in the package: Support-side framing only. The host owns its HTTP response and lifecycle;
 * these types let Support encode frames and wait for backpressure in a cancellable way, while
 * reading is delegated to the shared streaming package.
 *
 * Exports: `SseEvent` and `SseReadOptions` (type re-exports), `SseWriter`, `SseOutputEvent`.
 */
export type { SseEvent, SseReadOptions } from '@jangts/streaming/sse';

/** Destination that reports backpressure instead of buffering without bound. */
export interface SseWriter {
  /** Writes one encoded frame; returns false when the consumer needs a drain wait. */
  write(frame: string): boolean;
  /** Resolves once the destination can accept more data, or rejects when `signal` aborts. */
  waitForDrain(signal?: AbortSignal): Promise<unknown>;
}

/** One outbound event before wire encoding. */
export interface SseOutputEvent {
  /** Event name; must not contain a line break. */
  event: string;
  /** Payload text; each line becomes its own `data:` field. */
  data: string;
}

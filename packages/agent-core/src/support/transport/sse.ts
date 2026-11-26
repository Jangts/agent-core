/**
 * Server-sent event transport: encode frames, write them with backpressure, and re-export readers.
 *
 * The host owns its HTTP response and lifecycle; these helpers only format frames and wait in a
 * cancellable way. Reading is delegated to the shared streaming package so Core and Support use
 * one parser.
 *
 * Main exports: `encodeSseEvent`, `writeSseFrame`, plus `readSse`, `abortableStream` and their
 * types.
 */
import type { SseWriter, SseOutputEvent } from '../../structs/support/transport/sse.js';
import { awaitWithSignal } from '../../utils/cancellation.js';
import { booleanResult } from '../../utils/synchronous.js';

/** Public transport facade. Applications depend on core; streaming remains an implementation dependency. */
export { readSse, SseIdleTimeoutError } from '@jangts/streaming/sse';
export type { SseEvent, SseReadOptions } from '../../structs/support/transport/sse.js';

export { abortableStream } from '@jangts/streaming/abortable-stream';

/**
 * Encode one event in the server-sent events wire format.
 *
 * Every line of `data` gets its own `data:` field, because a raw newline would start a new field.
 *
 * @param event Event name and payload to encode.
 * @returns The complete frame, terminated by a blank line.
 * @throws {TypeError} When the event name contains a newline, which would corrupt the frame.
 */
export function encodeSseEvent(event: SseOutputEvent): string {
  if (/[\r\n]/.test(event.event)) throw new TypeError('SSE event name cannot contain a newline');
  return `event: ${event.event}\n${event.data
    .split(/\r\n|\r|\n/)
    .map((line) => `data: ${line}\n`)
    .join('')}\n`;
}

/**
 * Write one encoded frame and wait for drain when the writer reports backpressure.
 *
 * The signal is re-checked around the write and the drain wait, so cancellation does not leave a
 * pending write considered successful.
 *
 * @param request Writer plus the already encoded frame.
 * @param context Execution context carrying the abort signal.
 * @returns Resolves once the frame is accepted or the writer drains.
 * @throws The signal's abort reason, or {@link TypeError} when `write` does not return a boolean
 *   synchronously.
 */
export async function writeSseFrame(
  { writer, frame }: { writer: SseWriter; frame: string },
  { signal }: import('../../structs/common.js').ExecutionContext,
): Promise<void> {
  signal.throwIfAborted();
  const ready = booleanResult(writer.write(frame), 'SSE writes must return boolean synchronously');
  signal.throwIfAborted();
  if (!ready) await awaitWithSignal(writer.waitForDrain(signal), signal);
  signal.throwIfAborted();
}

export type { SseWriter, SseOutputEvent } from '../../structs/support/transport/sse.js';

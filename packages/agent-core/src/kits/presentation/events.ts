/**
 * Presentation Kit: the reply bubble/chunk event protocol.
 *
 * Place in the package: part of the `presentation` Kit. It turns a validated reply string into
 * a paced stream of `text`/`bubble` events and can serialize that stream back into plain text.
 * Transport, styling and the actual rendering stay with the App.
 *
 * Exports: `REPLY_BUBBLE_BOUNDARY`, `replyBubbleTexts`, `publishReplyEvents`,
 * `serializeOutputEvents`, `textOutputEvents`, and the output event types.
 */
import type {
  AgentOutputEvent,
  ReplyBubbleInput,
  ReplyDeliveryOptions,
} from '../../structs/kits/presentation/events.js';
import type { ExecutionContext } from '../../structs/common.js';
import { breakWhile } from '../../utils/rules.js';

/**
 * Internal boundary between validated assistant bubbles. Never sent as visible text.
 *
 * U+001E (record separator) is a non-printing control character that ordinary replies do not
 * contain, so splitting on it cannot truncate visible prose.
 */
export const REPLY_BUBBLE_BOUNDARY = '\u001e';

/**
 * Collect the non-empty-text parts of a reply.
 *
 * @param reply - Primary text plus optional extra bubbles.
 * @returns The text and every string bubble; non-string entries are dropped.
 */
export function replyBubbleTexts(reply: ReplyBubbleInput): string[] {
  const { text, bubbles } = reply;
  return [text, ...(Array.isArray(bubbles) ? bubbles : [])].filter(
    (text): text is string => typeof text === 'string',
  );
}

/**
 * Stream one reply as paced text chunks and bubble separators.
 *
 * Publish a validated reply without exposing its internal boundary to consumers. The pacing
 * options are upper bounds, not exact timings: the pause and interval are clamped against
 * `maxDurationMs`, so added delay never exceeds the budget while every chunk is still emitted.
 *
 * @param request - Reply text (bubbles separated by `REPLY_BUBBLE_BOUNDARY`) and pacing options.
 * @param context - Execution context supplying the abort signal.
 * @returns An async stream of `text` and `bubble` events, in order.
 * @throws TypeError For a malformed request, missing signal, or invalid chunk/pacing values;
 *   aborts with the caller's signal.
 */
export async function* publishReplyEvents(
  request: { text: string; delivery?: ReplyDeliveryOptions },
  context: ExecutionContext,
): AsyncIterable<AgentOutputEvent> {
  breakWhile(
    !request || typeof request !== 'object',
    () => new TypeError('Use a named reply delivery request'),
  );
  const { text, delivery } = request,
    { signal } = context;
  breakWhile(
    typeof text !== 'string' || !signal,
    () => new TypeError('Reply delivery requires text and ExecutionContext'),
  );
  breakWhile(
    delivery !== undefined && (!delivery || typeof delivery !== 'object'),
    () => new TypeError('Reply delivery requires named options'),
  );
  const {
    chunkSize = 240,
    intervalMs = 0,
    bubblePauseMs = 0,
    maxDurationMs = 3000,
  } = delivery ?? {};
  breakWhile(
    !Number.isSafeInteger(chunkSize) || chunkSize < 1,
    () => new TypeError('Invalid output chunk size'),
  );
  for (const [name, value] of Object.entries({ intervalMs, bubblePauseMs, maxDurationMs }))
    breakWhile(!Number.isFinite(value) || value < 0, () => new TypeError(`Invalid ${name}`));
  signal.throwIfAborted();
  const bubbles = text.split(REPLY_BUBBLE_BOUNDARY).map((bubble) => Array.from(bubble));
  const chunkCount = bubbles.reduce((sum, bubble) => sum + Math.ceil(bubble.length / chunkSize), 0);
  const pause = Math.min(bubblePauseMs, maxDurationMs / Math.max(1, bubbles.length - 1));
  const interval = Math.min(
    intervalMs,
    Math.max(0, maxDurationMs - pause * (bubbles.length - 1)) /
      Math.max(1, chunkCount - bubbles.filter((bubble) => bubble.length).length),
  );
  const deadline = performance.now() + maxDurationMs;
  for (let bubble = 0; bubble < bubbles.length; bubble++) {
    if (bubble) {
      await wait(Math.min(pause, Math.max(0, deadline - performance.now())), signal);
      signal.throwIfAborted();
      yield { type: 'bubble' };
    }
    for (let i = 0; i < bubbles[bubble].length; i += chunkSize) {
      signal.throwIfAborted();
      if (i) await wait(Math.min(interval, Math.max(0, deadline - performance.now())), signal);
      signal.throwIfAborted();
      yield { type: 'text', text: bubbles[bubble].slice(i, i + chunkSize).join('') };
    }
  }
  signal.throwIfAborted();
}

async function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  if (!milliseconds) return;
  await new Promise<void>((resolve, reject) => {
    const stop = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', stop);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', stop);
      resolve();
    }, milliseconds);
    signal.addEventListener('abort', stop, { once: true });
    if (signal.aborted) stop();
  });
}

/**
 * Serialize the event protocol for callers using a text stream.
 *
 * `preview` events are dropped because they are not final text; bubbles become the boundary
 * character again, so a consumer can re-split the stream.
 *
 * @param events - Event stream carrying `text`, `bubble` or `preview` entries.
 * @returns The equivalent string chunks.
 */
export async function* serializeOutputEvents(
  events: AsyncIterable<AgentOutputEvent>,
): AsyncIterable<string> {
  for await (const event of events) {
    if (event.type === 'preview') continue;
    yield event.type === 'bubble' ? REPLY_BUBBLE_BOUNDARY : event.text;
  }
}

/**
 * Wrap already-chunked text as `text` events.
 *
 * @param chunks - Text chunks in delivery order.
 * @returns The same chunks as events.
 */
export async function* textOutputEvents(
  chunks: AsyncIterable<string>,
): AsyncIterable<AgentOutputEvent> {
  for await (const text of chunks) yield { type: 'text', text };
}

export type {
  AgentOutputEvent,
  ReplyBubbleInput,
  ReplyDeliveryOptions,
} from '../../structs/kits/presentation/events.js';

/**
 * JSON transport framing: locate complete JSON objects inside free-form streamed text.
 *
 * Framing is purely mechanical. It never repairs, truncates or interprets fields; consumers decide
 * which surrounding content and which frames they allow. Limits keep malformed or hostile streams
 * from consuming unbounded memory.
 *
 * Main exports: `scanJsonObjectFrames` and `parseJsonFrames`.
 */
import type { JsonFrameLimits, JsonTransportPart } from '../../structs/support/transport/json.js';

/** Framing is mechanical; consumers decide which outside content and frames are allowed. */
function* scan(text: string): Generator<JsonTransportPart> {
  let start = -1,
    depth = 0,
    quoted = false,
    escaped = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"' && depth) quoted = true;
    else if (char === '{') {
      if (!depth) start = i;
      depth++;
    } else if (char === '}' && depth) {
      depth--;
      if (!depth) yield { kind: 'frame', text: text.slice(start, i + 1) };
    } else if (!depth) yield { kind: 'outside', text: char };
  }
  if (depth || quoted) throw new Error('Incomplete JSON transport');
}

/**
 * Extract complete object-shaped spans from surrounding text, without parsing or selecting them.
 *
 * @param text Streamed text possibly containing JSON objects and unrelated content.
 * @returns Raw object spans in source order.
 * @throws {Error} When the text ends inside an unterminated object or string.
 */
export function scanJsonObjectFrames(text: string): string[] {
  const frames: string[] = [];
  for (const part of scan(text)) if (part.kind === 'frame') frames.push(part.text);
  return frames;
}

/**
 * Parse complete object frames under explicit count and size limits.
 *
 * Only whitespace may appear outside frames; a stray closing brace is tolerated only up to
 * `maxExtraClosings`, which covers transports that repeat the delimiter after the payload.
 *
 * @param text Streamed text to scan.
 * @param limits Frame count, size and stray-closer allowances; validated before scanning.
 * @returns Parsed frames in source order.
 * @throws {TypeError} When a limit is not a safe integer or falls outside its allowed range.
 * @throws {Error} When a limit is exceeded, content outside a frame is not whitespace, or the
 *   transport ends before at least one complete frame exists.
 */
export function parseJsonFrames(text: string, limits: JsonFrameLimits): Record<string, unknown>[] {
  if (
    !Number.isSafeInteger(limits.maxFrames) ||
    limits.maxFrames < 1 ||
    !Number.isSafeInteger(limits.maxExtraClosings) ||
    limits.maxExtraClosings < 0 ||
    (limits.maxFrameChars !== undefined &&
      (!Number.isSafeInteger(limits.maxFrameChars) || limits.maxFrameChars < 1))
  )
    throw new TypeError('Invalid JSON frame limits');
  const frames: Record<string, unknown>[] = [];
  let extraClosings = 0;
  for (const part of scan(text)) {
    if (part.kind === 'frame') {
      if (frames.length >= limits.maxFrames) throw new Error('JSON frame limit exceeded');
      if (limits.maxFrameChars !== undefined && part.text.length > limits.maxFrameChars)
        throw new Error('JSON frame size exceeded');
      frames.push(JSON.parse(part.text));
    } else if (part.text === '}') {
      if (!frames.length || ++extraClosings > limits.maxExtraClosings)
        throw new Error('Unexpected JSON closing brace');
    } else if (!/\s/.test(part.text)) throw new Error('Unexpected JSON transport content');
  }
  if (!frames.length || frames.length > limits.maxFrames)
    throw new Error('Incomplete JSON transport');
  return frames;
}

export type { JsonFrameLimits } from '../../structs/support/transport/json.js';

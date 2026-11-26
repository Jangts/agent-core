/** Read provider bodies with limits independent of the generated-output budget. */
import { awaitWithSignal } from '../../utils/cancellation.js';

const defaultResponseBytes = 16 * 1024 * 1024;
const defaultLineBytes = 1024 * 1024;

export function resolveModelResponseLimits(
  maxResponseBytes = defaultResponseBytes,
  maxLineBytes?: number,
) {
  const lineBytes = maxLineBytes ?? Math.min(defaultLineBytes, maxResponseBytes);
  if (
    !Number.isSafeInteger(maxResponseBytes) ||
    maxResponseBytes < 1 ||
    !Number.isSafeInteger(lineBytes) ||
    lineBytes < 1 ||
    lineBytes > maxResponseBytes
  )
    throw new TypeError('Invalid model HTTP response limits');
  return { maxResponseBytes, lineBytes };
}

export function cancelModelResponse(response: Response) {
  void response.body?.cancel().catch(() => {});
}

function limitError(message: string) {
  return Object.assign(new Error(message), { code: 'MODEL_RESPONSE_LIMIT' });
}

async function* readChunks(response: Response, maxBytes: number, signal: AbortSignal) {
  if (!response.body) return;
  const reader = response.body.getReader();
  let remaining = maxBytes;
  let ended = false;
  try {
    while (true) {
      signal.throwIfAborted();
      const chunk = await awaitWithSignal(reader.read(), signal);
      signal.throwIfAborted();
      if (chunk.done) {
        ended = true;
        return;
      }
      remaining -= chunk.value.byteLength;
      if (remaining < 0) throw limitError('Model HTTP response byte limit exceeded');
      yield chunk.value;
    }
  } finally {
    if (!ended) void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function parseObject(text: string): Record<string, unknown> {
  const value: unknown = JSON.parse(text);
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError('Expected a model response object');
  return value as Record<string, unknown>;
}

export async function readModelJson(response: Response, maxBytes: number, signal: AbortSignal) {
  let bytes = new Uint8Array(0);
  let used = 0;
  for await (const chunk of readChunks(response, maxBytes, signal)) {
    const needed = used + chunk.byteLength;
    if (needed > bytes.byteLength) {
      const capacity = Math.min(maxBytes, Math.max(needed, bytes.byteLength * 2, 8192));
      const grown = new Uint8Array(capacity);
      grown.set(bytes.subarray(0, used));
      bytes = grown;
    }
    bytes.set(chunk, used);
    used = needed;
  }
  return parseObject(new TextDecoder().decode(bytes.subarray(0, used)));
}

export async function readModelJsonLines(
  response: Response,
  limits: ReturnType<typeof resolveModelResponseLimits>,
  maxItems: number,
  signal: AbortSignal,
) {
  const decoder = new TextDecoder();
  const rows: Record<string, unknown>[] = [];
  let bytes = 0;
  let line = '';
  const finishLine = () => {
    const text = (line + decoder.decode()).trim();
    line = '';
    bytes = 0;
    if (!text) return;
    if (rows.length >= maxItems) throw limitError('Batch response item limit exceeded');
    rows.push(parseObject(text));
  };
  for await (const chunk of readChunks(response, limits.maxResponseBytes, signal)) {
    let start = 0;
    while (start < chunk.length) {
      const newline = chunk.indexOf(10, start);
      const end = newline < 0 ? chunk.length : newline;
      bytes += end - start;
      if (bytes > limits.lineBytes) throw limitError('Batch response line byte limit exceeded');
      line += decoder.decode(chunk.subarray(start, end), { stream: true });
      if (newline >= 0) finishLine();
      start = end + 1;
    }
  }
  finishLine();
  return rows;
}

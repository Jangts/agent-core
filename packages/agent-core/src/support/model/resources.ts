/**
 * Input resource preparation under a bound Runner's admission and cancellation boundary.
 * Hosts resolve private references; this module validates limits and creates portable data URLs.
 * No resource bytes or private references are emitted to diagnostics or the context journal.
 */
import type { ModelContentPart } from '../../structs/model/messages.js';
import { awaitWithSignal } from '../../utils/cancellation.js';
import { synchronous } from '../../utils/synchronous.js';

/** A portable source; remote URL size remains unknown unless the host measures it. */
export type ModelResourceSource =
  | { readonly kind: 'url'; readonly url: string }
  | { readonly kind: 'bytes'; readonly bytes: Uint8Array; readonly mimeType: string }
  | { readonly kind: 'reference'; readonly id: string };
/** One media item in the same order as the caller's text and other media. */
export interface ModelResourceInput {
  readonly type: 'image' | 'audio' | 'video' | 'file';
  readonly source: ModelResourceSource;
}
/** Minimal Core port, normally `runner.bind(execution)`. */
export interface ModelResourceRunner {
  runOperation<T>(
    work: (signal: AbortSignal) => Promise<T>,
    options: { calls: number; signal?: AbortSignal; action?: 'resource' },
  ): Promise<T>;
}
/** Host policy and reference resolution, shared across protocol adapters. */
export interface ModelResourcePorts {
  authorize(input: ModelResourceInput, context: { signal: AbortSignal }): void | Promise<void>;
  resolve?(
    id: string,
    context: { signal: AbortSignal },
  ): Promise<Exclude<ModelResourceSource, { kind: 'reference' }>>;
  /** Measured byte count, or undefined for a URL whose transfer size is unknown. */
  prepared?(facts: { index: number; type: ModelResourceInput['type']; bytes?: number }): void;
}

/** Validate a fetchable reference without fetching it or exposing it to observations. */
function resourceUrl(value: string): string {
  const url = new URL(value);
  if (!['https:', 'http:', 'data:'].includes(url.protocol) || url.username || url.password)
    throw new TypeError('Invalid model resource URL');
  return value;
}

/** Inline URLs have a measurable payload; remote URL transfer sizes remain unknown. */
function inlineSize(url: string): number | undefined {
  if (!url.startsWith('data:')) return undefined;
  const match = /^data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,([A-Za-z0-9+/]*={0,2})$/i.exec(url);
  if (!match || match[1].length % 4 !== 0) throw new TypeError('Invalid inline resource');
  return (match[1].length / 4) * 3 - (match[1].endsWith('==') ? 2 : match[1].endsWith('=') ? 1 : 0);
}

/** Convert bounded bytes in browser and Node runtimes without requiring Buffer. */
function dataUrl(bytes: Uint8Array, mimeType: string): string {
  if (!/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(mimeType))
    throw new TypeError('Invalid resource MIME type');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 3) {
    const value = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    chunks.push(
      alphabet[(value >>> 18) & 63] +
        alphabet[(value >>> 12) & 63] +
        (i + 1 < bytes.length ? alphabet[(value >>> 6) & 63] : '=') +
        (i + 2 < bytes.length ? alphabet[value & 63] : '='),
    );
  }
  return `data:${mimeType};base64,${chunks.join('')}`;
}

/**
 * Prepare ordered media using one bounded, zero-generation Core operation.
 * The caller supplies a request-bound Runner, then passes the resulting parts to invoke.
 * Unsupported media still fails the target provider's capability preflight before generation.
 * @throws On invalid sources, authorization failure, byte/count limits or cancellation.
 */
export async function prepareModelResources(request: {
  readonly runner: ModelResourceRunner;
  readonly inputs: readonly (ModelResourceInput | Extract<ModelContentPart, { type: 'text' }>)[];
  readonly ports: ModelResourcePorts;
  readonly maxBytes: number;
  readonly maxItems?: number;
  readonly signal?: AbortSignal;
}): Promise<readonly ModelContentPart[]> {
  const { runner, ports, maxBytes, signal } = request;
  const maxItems = request.maxItems ?? 32;
  if (
    !Number.isSafeInteger(maxBytes) ||
    maxBytes < 1 ||
    !Number.isSafeInteger(maxItems) ||
    maxItems < 1
  )
    throw new TypeError('Invalid resource limits');
  const sourceAuthorize = ports.authorize;
  if (
    !Array.isArray(request.inputs) ||
    request.inputs.length > maxItems ||
    typeof sourceAuthorize !== 'function'
  )
    throw new TypeError('Invalid model resource request');
  // Snapshot before any asynchronous host callback can mutate a later item.
  const inputs = structuredClone(request.inputs);
  const authorize = sourceAuthorize.bind(ports);
  const resolve = ports.resolve?.bind(ports);
  const prepared = ports.prepared?.bind(ports);
  for (const input of inputs) {
    if (input.type === 'text') {
      if (typeof input.text !== 'string') throw new TypeError('Invalid resource text');
      continue;
    }
    if (!['image', 'audio', 'video', 'file'].includes(input.type) || !input.source)
      throw new TypeError('Invalid resource type');
    const source = input.source;
    if (source.kind === 'url') {
      resourceUrl(source.url);
      if ((inlineSize(source.url) ?? 0) > maxBytes)
        throw new TypeError('Resource byte limit exceeded');
    } else if (source.kind === 'bytes') {
      if (!(source.bytes instanceof Uint8Array) || source.bytes.byteLength > maxBytes)
        throw new TypeError('Resource byte limit exceeded');
    } else if (source.kind !== 'reference' || !source.id || !resolve)
      throw new TypeError('Invalid resource reference');
  }
  return runner.runOperation(
    async (activeSignal) => {
      const result: ModelContentPart[] = [];
      let totalBytes = 0;
      for (const [index, input] of inputs.entries()) {
        activeSignal.throwIfAborted();
        if (input.type === 'text') {
          result.push(Object.freeze({ ...input }));
          continue;
        }
        await awaitWithSignal(
          Promise.resolve(authorize(input, { signal: activeSignal })),
          activeSignal,
        );
        const source =
          input.source.kind === 'reference'
            ? await awaitWithSignal(
                resolve!(input.source.id, { signal: activeSignal }),
                activeSignal,
              )
            : input.source;
        activeSignal.throwIfAborted();
        if (source.kind === 'url') {
          const url = resourceUrl(source.url),
            bytes = inlineSize(url);
          totalBytes += bytes ?? 0;
          if (totalBytes > maxBytes) throw new TypeError('Resource byte limit exceeded');
          result.push(Object.freeze({ type: input.type, url }));
          synchronous(
            prepared?.({ index, type: input.type, ...(bytes === undefined ? {} : { bytes }) }),
            'Resource observations must be synchronous',
          );
        } else if (source.kind === 'bytes' && source.bytes instanceof Uint8Array) {
          totalBytes += source.bytes.byteLength;
          if (totalBytes > maxBytes) throw new TypeError('Resource byte limit exceeded');
          const bytes = source.bytes.slice();
          result.push(
            Object.freeze({
              type: input.type,
              url: dataUrl(bytes, source.mimeType),
              mimeType: source.mimeType,
            }),
          );
          synchronous(
            prepared?.({ index, type: input.type, bytes: bytes.byteLength }),
            'Resource observations must be synchronous',
          );
        } else throw new TypeError('Invalid resolved resource');
      }
      activeSignal.throwIfAborted();
      return Object.freeze(result);
    },
    { calls: 0, signal, action: 'resource' },
  );
}

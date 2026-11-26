/** Unified HTTP model providers. Same Core contract, explicit protocol selection. */
import { ChatProvider, type ModelProviderContext } from '../../structs/model/chat-provider.js';
import type { ModelMessage, ModelPart, ModelStreamEvent } from '../../structs/model/messages.js';
import { modelProtocolCatalog, type ModelProtocol } from './protocols/requests.js';
import { assertProtocolCompletion, ProtocolDecoder } from './protocols/responses.js';
import { prepareModelRequest } from './protocols/preparation.js';
import {
  resolveModelCapabilities,
  type ModelEndpointCapabilities,
} from './protocols/capabilities.js';
export type { ModelEndpointCapabilities } from './protocols/capabilities.js';
import { ContinuationRecorder } from './protocols/continuation.js';
import { snapshotModelRequestBody } from './protocols/profile.js';
import {
  HostedToolDecoder,
  validateHostedTools,
  type HostedToolEvent,
} from './protocols/hosted.js';
import { normalizeModelText } from '../../model/stream-event.js';
import { awaitWithSignal } from '../../utils/cancellation.js';
import { freezeSchema } from '../../utils/object.js';
export type { HostedToolEvent } from './protocols/hosted.js';
import { readSse } from '../transport/sse.js';
import { cancelModelResponse, readModelJson, resolveModelResponseLimits } from './http-response.js';
export { modelProtocolCatalog } from './protocols/requests.js';
export type { ModelProtocol } from './protocols/requests.js';
/** Static connection settings. Credentials never appear in URLs or continuation payloads. */
export interface ModelProviderConfig {
  protocol: ModelProtocol;
  baseUrl: string;
  apiKey: string;
  model: string;
  stream?: boolean;
  maxOutputTokens?: number;
  /** Maximum bytes read from a non-SSE response, default 16 MiB. */
  maxResponseBytes?: number;
  request?: typeof fetch;
  headers?: Readonly<Record<string, string>>;
  scope?: string;
  /** Known endpoint limitations, narrowing protocol expressibility only. */
  capabilities?: ModelEndpointCapabilities;
  /** Explicit supplier extension profile. Identity, input, tools and budgets cannot be overridden. */
  requestBody?: Readonly<Record<string, unknown>>;
  /** Native provider search definitions; disabled unless explicitly configured and authorized. */
  hostedTools?: readonly Readonly<Record<string, unknown>>[];
  /** Called before each remote generation; throw or return false to deny. No implicit retry. */
  authorizeHostedTools?(
    tools: readonly Readonly<Record<string, unknown>>[],
    context: ModelProviderContext,
  ): void | boolean | Promise<void | boolean>;
  /** Awaited private observation. Errors stop consumption; remote execution is not undone. */
  onHostedToolEvent?(event: HostedToolEvent): void | Promise<void>;
}
/** Create a provider; no network activity happens during construction. */
export function createModelProvider(configuration: ModelProviderConfig): ChatProvider {
  const config = { ...configuration };
  const { maxResponseBytes } = resolveModelResponseLimits(config.maxResponseBytes);
  config.headers = Object.freeze({ ...config.headers });
  config.capabilities = structuredClone(config.capabilities);
  freezeSchema(config.capabilities);
  const endpointCapabilities = resolveModelCapabilities(config.protocol, config.capabilities);
  config.requestBody = snapshotModelRequestBody(config.requestBody);
  config.hostedTools = structuredClone(config.hostedTools ?? []);
  freezeSchema(config.hostedTools);
  const authorizeHostedTools = config.authorizeHostedTools?.bind(configuration);
  const hostedSink = config.onHostedToolEvent?.bind(configuration);
  validateHostedTools(config.protocol, config.hostedTools);
  if (config.hostedTools.length && !endpointCapabilities.tools)
    throw new TypeError('Endpoint does not support tools');
  if (config.hostedTools.length && !authorizeHostedTools)
    throw new TypeError('Hosted tools require explicit authorization');
  const descriptor = modelProtocolCatalog[config.protocol];
  if (!config.apiKey || !config.model)
    throw new TypeError('Model protocol, credentials and model are required');
  const endpoint = new URL(config.baseUrl);
  if (
    !['https:', 'http:'].includes(endpoint.protocol) ||
    endpoint.hash ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search
  )
    throw new TypeError('Model base URL must not contain credentials or query parameters');
  const request = config.request?.bind(configuration) ?? globalThis.fetch;
  return new (class extends ChatProvider {
    readonly capabilities = endpointCapabilities;
    async *stream(
      messages: readonly ModelMessage[],
      context: ModelProviderContext,
    ): AsyncIterable<ModelPart> {
      for await (const raw of this.streamEvents(messages, context)) {
        const event = normalizeModelText(raw);
        if (typeof event === 'string' || event.type === 'function-call-delta') yield event;
        else if (event.type === 'content')
          throw Object.assign(new Error('Media response requires a content-aware interaction'), {
            code: 'MODEL_PROTOCOL',
          });
        else if (event.type === 'usage') context.options?.onUsage?.(event.usage);
        else if (event.type === 'continuation')
          context.options?.onContinuation?.(event.continuation);
        else if (event.type === 'completion' && ['incomplete', 'refused'].includes(event.status))
          throw Object.assign(new Error(`Model response ${event.status}`), {
            code: 'MODEL_INCOMPLETE',
          });
      }
    }
    async *streamEvents(
      messages: readonly ModelMessage[],
      context: ModelProviderContext,
    ): AsyncIterable<ModelStreamEvent> {
      const { signal } = context;
      signal.throwIfAborted();
      messages = structuredClone(messages);
      const options = {
        ...context.options,
        continuation: context.options?.continuation
          ? structuredClone(context.options.continuation)
          : undefined,
        maxOutputTokens: context.options?.maxOutputTokens ?? config.maxOutputTokens ?? 1024,
      };
      const stream = config.stream ?? true;
      const body = prepareModelRequest({ ...config, stream }, messages, options);
      if (config.hostedTools!.length) {
        const allowed = await awaitWithSignal(
          Promise.resolve(authorizeHostedTools!(config.hostedTools!, context)),
          signal,
        );
        signal.throwIfAborted();
        if (allowed === false) throw new TypeError('Provider-side tool authorization denied');
        body.tools = [...((body.tools as unknown[]) ?? []), ...config.hostedTools!];
        if (config.protocol === 'responses')
          body.include = [...((body.include as string[]) ?? []), 'web_search_call.action.sources'];
      }
      const google = ['generate-content', 'interactions'].includes(config.protocol);
      const path =
        config.protocol === 'generate-content'
          ? `/models/${encodeURIComponent(config.model)}:${stream ? 'streamGenerateContent?alt=sse' : 'generateContent'}`
          : descriptor.path;
      const headers = new Headers(config.headers);
      headers.set('Content-Type', 'application/json');
      for (const key of ['authorization', 'x-api-key', 'x-goog-api-key']) headers.delete(key);
      if (google) headers.set('x-goog-api-key', config.apiKey);
      else if (config.protocol === 'messages') {
        headers.set('x-api-key', config.apiKey);
        headers.set('anthropic-version', '2023-06-01');
      } else headers.set('Authorization', `Bearer ${config.apiKey}`);
      const response = await request(config.baseUrl.replace(/\/+$/, '') + path, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal,
      });
      if (!response.ok) {
        cancelModelResponse(response);
        throw Object.assign(new Error(`Model HTTP ${response.status}`), {
          code:
            response.status === 401 || response.status === 403
              ? 'MODEL_AUTH'
              : response.status === 429
                ? 'MODEL_BUSY'
                : 'MODEL_UPSTREAM',
          status: response.status,
        });
      }
      const hosted = new HostedToolDecoder(config.protocol, !!config.hostedTools!.length);
      const decoder = new ProtocolDecoder(config.protocol, hosted);
      const recorder = new ContinuationRecorder();
      const deliverHosted = async () => {
        for (const event of hosted.drain()) {
          signal.throwIfAborted();
          if (hostedSink) await awaitWithSignal(Promise.resolve(hostedSink(event)), signal);
          signal.throwIfAborted();
        }
      };
      if (response.headers.get('content-type')?.includes('text/event-stream')) {
        if (!response.body) throw new Error('Missing model stream');
        for await (const event of readSse(response.body, { signal })) {
          signal.throwIfAborted();
          if (event.data === '[DONE]') break;
          const raw = JSON.parse(event.data);
          const parts = decoder.decode(raw);
          await deliverHosted();
          for (const part of parts) {
            recorder.push(part);
            yield part;
          }
        }
      } else {
        const parts = decoder.decode(await readModelJson(response, maxResponseBytes, signal), true);
        await deliverHosted();
        for (const part of parts) {
          recorder.push(part);
          yield part;
        }
      }
      assertProtocolCompletion(decoder.finished, 'Model stream ended without terminal event');
      if (decoder.replay.length && config.scope)
        yield {
          type: 'continuation',
          continuation: {
            protocol: config.protocol,
            model: config.model,
            scope: config.scope,
            version: 1,
            data: recorder.finish(
              config.baseUrl.replace(/\/+$/, ''),
              messages,
              decoder.replay,
              options.continuation?.data,
            ),
          },
        };
    }
  })();
}

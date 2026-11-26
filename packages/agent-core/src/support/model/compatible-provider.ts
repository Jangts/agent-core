/**
 * OpenAI-compatible HTTP provider: streaming chat completions over SSE.
 *
 * The provider owns the request/response lifecycle and error classification; the application
 * supplies endpoint, credentials, optional request-body extensions and user-visible error mapping.
 * Configuration is snapshotted so getters cannot change between validation and I/O, and every
 * failure is recorded with the same code that is returned to the caller.
 *
 * Main exports: `CompatibleModelProvider` and the provider configuration/error types.
 */
import { getErrorInfo, recordErrorContext } from '../../errors.js';
import { modelRunnerDefaults } from '../../model/defaults.js';
import { snapshotModelOptions } from '../../model/options.js';
import { diagnosticError } from '../../diagnostics/index.js';
import type {
  CompatibleModelConfig,
  CompatibleModelPorts,
  ModelProviderErrorCode,
  ModelChoiceIndex,
  CompatibleModelProviderOptions,
} from '../../structs/support/model/provider.js';
import { ChatProvider, type ModelProviderContext } from '../../structs/model/chat-provider.js';
import type { ModelMessage, ModelPart } from '../../structs/model/messages.js';
import type { ProviderMessage } from '../../structs/support/model/messages.js';
import {
  chatCompletionFunctionOptions,
  chatCompletionParts,
  chatCompletionMessages,
} from './chat-completions.js';
import { defaultCompletionPolicy } from './completion/default.js';
import { readSse } from '../transport/sse.js';
import { providerObservation } from './observer.js';
import type { ProviderErrorCapture } from '../../structs/support/model/provider-observer.js';
import { synchronous } from '../../utils/synchronous.js';
import { awaitWithSignal } from '../../utils/cancellation.js';

/**
 * HTTP status to provider error code.
 *
 * Unlisted statuses fall back to `MODEL_UPSTREAM`; 408, 429 and 5xx are additionally marked
 * retryable when the error context is recorded.
 */
const httpFailures: Readonly<Record<number, ModelProviderErrorCode>> = Object.freeze({
  400: 'MODEL_CONFIG',
  401: 'MODEL_AUTH',
  402: 'MODEL_BALANCE',
  403: 'MODEL_AUTH',
  404: 'MODEL_CONFIG',
  429: 'MODEL_BUSY',
});

/**
 * Request fields the adapter composes itself.
 *
 * Allowing `requestBody` to set them would let application configuration replace the model,
 * prompt, streaming mode or output budget that Core already validated.
 */
const reservedRequestFields = [
  'model',
  'messages',
  'stream',
  'max_tokens',
  'max_completion_tokens',
  'toJSON',
] as const;

function assertRequestExtensions(config: CompatibleModelConfig): void {
  if (
    config.maxOutputTokens !== undefined &&
    (!Number.isSafeInteger(config.maxOutputTokens) || config.maxOutputTokens < 1)
  ) {
    throw new TypeError('Provider maxOutputTokens must be a positive safe integer');
  }
  for (const key of reservedRequestFields) {
    if (config.requestBody && Object.hasOwn(config.requestBody, key)) {
      throw new TypeError(`Provider requestBody cannot override ${key}`);
    }
  }
}

/** Static settings compile once; dynamic configurations compile at each request boundary. */
function snapshotConfiguration(
  config: CompatibleModelConfig,
  signal?: AbortSignal,
): CompatibleModelConfig {
  const read = <ObjectType extends object, Key extends keyof ObjectType>(
    source: ObjectType,
    key: Key,
  ): ObjectType[Key] => {
    signal?.throwIfAborted();
    const value = source[key];
    signal?.throwIfAborted();
    return value;
  };
  try {
    signal?.throwIfAborted();
    if ('maxTokens' in config) throw new TypeError('Use maxOutputTokens');
    // Pin each configuration getter once. Validation and I/O consume this same snapshot.
    const baseUrl = read(config, 'baseUrl'),
      apiKey = read(config, 'apiKey'),
      model = read(config, 'model');
    const maxOutputTokens = read(config, 'maxOutputTokens'),
      temperature = read(config, 'temperature');
    const extensions = read(config, 'requestBody'),
      reasoning = read(config, 'reasoning');
    const explicit = { ...extensions };
    signal?.throwIfAborted();
    const fixed = { baseUrl, apiKey, model, maxOutputTokens, temperature, requestBody: explicit };
    assertRequestExtensions(fixed);
    let generated: Readonly<Record<string, unknown>> = {};
    if (reasoning !== undefined) {
      if (!reasoning) throw new TypeError('Invalid provider reasoning level');
      const level = read(reasoning, 'level'),
        format = read(reasoning, 'format');
      if (!['off', 'low', 'medium', 'high'].includes(level))
        throw new TypeError('Invalid provider reasoning level');
      if (format === 'custom') {
        const mapper = read(
          reasoning as Extract<
            NonNullable<CompatibleModelConfig['reasoning']>,
            { format: 'custom' }
          >,
          'map',
        );
        if (typeof mapper !== 'function') throw new TypeError('Custom reasoning requires a mapper');
        generated = synchronous(
          mapper.call(reasoning, level),
          'Reasoning mappers must be synchronous',
        );
        signal?.throwIfAborted();
        if (!generated || typeof generated !== 'object' || Array.isArray(generated))
          throw new TypeError('Reasoning mapper must return request fields');
      } else if (format === 'reasoning-effort')
        generated = { reasoning_effort: level === 'off' ? 'none' : level };
      else if (format === 'thinking')
        generated = { thinking: { type: level === 'off' ? 'disabled' : 'enabled' } };
      else if (format === 'enable-thinking') generated = { enable_thinking: level !== 'off' };
      else if (format === 'thinking-budget') {
        const configured = read(
          reasoning as Extract<
            NonNullable<CompatibleModelConfig['reasoning']>,
            { format: 'thinking-budget' }
          >,
          'budgets',
        );
        const budgets = {
          low: configured ? (read(configured, 'low') ?? 1024) : 1024,
          medium: configured ? (read(configured, 'medium') ?? 4096) : 4096,
          high: configured ? (read(configured, 'high') ?? 8192) : 8192,
        };
        if (Object.values(budgets).some((value) => !Number.isSafeInteger(value) || value < 1))
          throw new TypeError('Thinking budgets must be positive safe integers');
        generated = {
          thinking:
            level === 'off'
              ? { type: 'disabled' }
              : { type: 'enabled', budget_tokens: budgets[level] },
        };
      } else throw new TypeError('Unknown provider reasoning format');
    }
    const generatedFields = { ...generated };
    signal?.throwIfAborted();
    assertRequestExtensions({ ...fixed, requestBody: generatedFields });
    const requestBody = structuredClone({ ...generatedFields, ...explicit });
    signal?.throwIfAborted();
    // Validate the actual materialized object, never re-read the caller's getters.
    assertRequestExtensions({ ...fixed, requestBody });
    return Object.freeze({ baseUrl, apiKey, model, maxOutputTokens, temperature, requestBody });
  } catch (error) {
    signal?.throwIfAborted();
    throw error;
  }
}

/**
 * HTTP/SSE lifecycle shared by hosts. Apps supply config and user-visible error mapping only.
 *
 * A static configuration is validated and frozen in the constructor. A configuration function is
 * called once per request instead, so credentials and models may rotate between calls.
 */
export class CompatibleModelProvider extends ChatProvider {
  private readonly configuration: CompatibleModelConfig | (() => CompatibleModelConfig);
  private readonly ports: CompatibleModelPorts;
  /**
   * Create a provider.
   *
   * @param options Static or per-request configuration, optional ports and observation/error hooks.
   * @throws {TypeError} When a static configuration is invalid (for example `maxTokens`,
   *   reserved request-body fields, unsupported reasoning format or invalid budgets).
   */
  constructor(options: CompatibleModelProviderOptions) {
    super();
    const { config: configuration, ports } = options;
    this.ports = {
      request: ports?.request?.bind(ports),
      ensureJsonInstruction: ports?.ensureJsonInstruction,
      allowEmptyJson: ports?.allowEmptyJson,
      completionPolicy: ports?.completionPolicy,
      observer: options.observe?.provider,
      error: options.errors?.failure?.bind(options.errors),
    };
    if (typeof configuration === 'function') this.configuration = configuration.bind(options);
    else this.configuration = snapshotConfiguration(configuration);
  }
  private failure(code: ModelProviderErrorCode, status?: number, reason?: 'eof'): Error {
    const error =
      this.ports.error?.({
        code,
        ...(status !== undefined ? { status } : {}),
        ...(reason ? { reason } : {}),
      }) ?? Object.assign(new Error(code), { code, status, reason });
    recordErrorContext(error, {
      codes: [code],
      // Transient HTTP conditions are retryable; protocol/format failures are not.
      ...(status === undefined
        ? {}
        : { isRetryable: status === 408 || status === 429 || status >= 500 }),
    });
    return error;
  }

  /**
   * Stream one chat-completions response as Core model parts.
   *
   * The method validates the effective request and yields parts as they arrive. Whether the
   * finished stream is acceptable is decided by the configured completion policy, which defaults
   * to the legacy rules. A stream that ends without the end-of-stream marker is incomplete, not a
   * partial success.
   *
   * @param messages Prompt messages in order, including provider tool-thread messages.
   * @param context Provider context with signal, call options and diagnostics/observer ports.
   * @yields Text chunks and function-call deltas as they arrive.
   * @throws The classified provider error (see `MODEL_*` codes) or the signal's abort reason.
   */
  async *stream(
    messages: readonly (ModelMessage | ProviderMessage)[],
    context: ModelProviderContext,
  ): AsyncIterable<ModelPart> {
    const { signal } = context;
    signal.throwIfAborted();
    let options: ReturnType<typeof snapshotModelOptions>;
    let config: CompatibleModelConfig;
    try {
      const configured = context.options;
      signal.throwIfAborted();
      if (configured && 'maxTokens' in configured) throw new TypeError('Use maxOutputTokens');
      options = snapshotModelOptions(configured);
      signal.throwIfAborted();
      if (
        options.maxOutputTokens !== undefined &&
        (!Number.isSafeInteger(options.maxOutputTokens) || options.maxOutputTokens < 1)
      ) {
        throw new TypeError('maxOutputTokens must be a positive safe integer');
      }
      config =
        typeof this.configuration === 'function'
          ? snapshotConfiguration(this.configuration(), signal)
          : this.configuration;
      signal.throwIfAborted();
    } catch (error) {
      signal.throwIfAborted();
      throw error;
    }
    const maxOutputTokens = Math.min(
      options.maxOutputTokens ?? config.maxOutputTokens ?? modelRunnerDefaults.maxOutputTokens,
      config.maxOutputTokens ?? Infinity,
    );
    const thinking = config.requestBody?.thinking;
    if (
      thinking !== null &&
      typeof thinking === 'object' &&
      Object.hasOwn(thinking, 'budget_tokens')
    ) {
      const budget = (thinking as Record<string, unknown>).budget_tokens;
      if (
        typeof budget !== 'number' ||
        !Number.isSafeInteger(budget) ||
        budget < 1 ||
        budget >= maxOutputTokens
      ) {
        throw new TypeError(
          'Thinking budget_tokens must be positive and smaller than the effective output token limit',
        );
      }
    }
    const observation = providerObservation(this.ports.observer, context);
    let complete = false;
    let failure: { error: unknown } | undefined;
    try {
      if (!config.apiKey) throw this.failure('MODEL_NOT_CONFIGURED');
      // Some providers require the word "json" in the prompt before accepting a JSON response
      // format; only add the instruction when the prompt does not already mention it.
      const needsJsonInstruction =
        this.ports.ensureJsonInstruction &&
        !options.functions &&
        options.json &&
        !messages.some(
          (message) => ['system', 'user'].includes(message.role) && /json/i.test(message.content),
        );
      const requestMessages: readonly (ModelMessage | ProviderMessage)[] = needsJsonInstruction
        ? [{ role: 'system', content: '只输出合法 JSON 对象，遵循给定字段和示例。' }, ...messages]
        : messages;
      const request = this.ports.request ?? fetch;
      // Build the body once: the completion policy must judge the same fields the upstream reads.
      const body: Record<string, unknown> = {
        model: config.model,
        messages: chatCompletionMessages(requestMessages),
        stream: true,
        max_tokens: maxOutputTokens,
        ...((options.temperature ?? config.temperature) !== undefined
          ? { temperature: options.temperature ?? config.temperature }
          : {}),
        ...(!options.functions && options.json ? { response_format: { type: 'json_object' } } : {}),
        ...chatCompletionFunctionOptions(options),
        ...config.requestBody,
        ...(options.includeUsage ? { stream_options: { include_usage: true } } : {}),
      };
      const policy = this.ports.completionPolicy ?? defaultCompletionPolicy;
      const session = policy.begin(
        {
          functions: !!options.functions,
          toolChoice: body.tool_choice,
          allowEmptyText: !options.functions && !!options.json && !!this.ports.allowEmptyJson,
        },
        (code) => this.failure(code),
      );
      const observedRequest: typeof fetch = (url, init) => {
        observation.emit('provider.request', () => {
          const observed = JSON.parse(String(init?.body));
          observed.messages = observed.messages.map((message: { content: unknown }) => ({
            ...message,
            content: Array.isArray(message.content)
              ? message.content.map((part) =>
                  part.type === 'image_url'
                    ? { ...part, image_url: { url: '[image omitted]' } }
                    : part,
                )
              : message.content,
          }));
          return { url: String(url), body: observed };
        });
        signal.throwIfAborted();
        return request(url, init);
      };
      signal.throwIfAborted();
      const pendingResponse = Promise.resolve(
        observedRequest(`${config.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
          method: 'POST',
          redirect: 'error',
          signal,
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify(body),
        }),
      ).then((response) => activeResponse(response, signal));
      const response = await awaitWithSignal(pendingResponse, signal);
      observation.emit('provider.response', () => ({
        status: response.status,
        requestId: response.headers.get('x-request-id'),
        contentType: response.headers.get('content-type'),
      }));
      activeResponse(response, signal);
      if (!response.ok) {
        if (observation.enabled('provider.error-body')) {
          try {
            const capture = await captureErrorBody(response);
            observation.emit('provider.error-body', () => ({
              status: response.status,
              ...capture,
            }));
          } catch {
            /* Error capture cannot replace the HTTP failure. */
          }
        } else discardResponse(response);
        throw this.failure(httpFailures[response.status] ?? 'MODEL_UPSTREAM', response.status);
      }
      if (
        !response.body ||
        !response.headers.get('content-type')?.toLowerCase().startsWith('text/event-stream')
      ) {
        discardResponse(response);
        throw this.failure('MODEL_FORMAT');
      }
      let finished = false;
      for await (const event of readSse(response.body, { signal, waitForCancel: false })) {
        observation.emit('provider.frame', () => ({ data: event.data }));
        signal.throwIfAborted();
        if (event.data === '[DONE]') {
          session.end();
          complete = true;
          return;
        }
        let chunk: any;
        try {
          chunk = JSON.parse(event.data);
        } catch {
          throw this.failure('MODEL_FORMAT');
        }
        if (!chunk || typeof chunk !== 'object' || Array.isArray(chunk))
          throw this.failure('MODEL_FORMAT');
        if (chunk.error) throw this.failure('MODEL_UPSTREAM');
        const usage = chunk.usage;
        if (
          usage &&
          [usage.prompt_tokens, usage.completion_tokens, usage.total_tokens].every(
            (value) => Number.isInteger(value) && value >= 0,
          )
        )
          options.onUsage?.({
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
          });
        signal.throwIfAborted();
        if (chunk.choices !== undefined && !Array.isArray(chunk.choices))
          throw this.failure('MODEL_FORMAT');
        // One request produces one choice; extra choices are ignored rather than merged.
        const choice = chunk.choices?.find((item: ModelChoiceIndex) => item?.index === 0);
        if (!choice) continue;
        if (finished && (choice.delta?.content || choice.delta?.tool_calls?.length))
          throw this.failure('MODEL_PROTOCOL');
        const parts = chatCompletionParts(choice.delta);
        for (const part of parts) {
          signal.throwIfAborted();
          session.part(part);
          yield part;
        }
        if (choice.finish_reason != null) {
          if (finished) throw this.failure('MODEL_PROTOCOL');
          session.finish(choice.finish_reason);
          finished = true;
        }
      }
      throw this.failure('MODEL_INCOMPLETE', undefined, 'eof');
    } catch (error) {
      failure = { error };
      if (!signal.aborted && getErrorInfo(error).codes.every((code) => code === 'UNKNOWN_ERROR'))
        recordErrorContext(error, { codes: ['MODEL_UPSTREAM'] });
    } finally {
      observation.emit('provider.end', () => ({
        complete,
        ...(failure ? { error: diagnosticError(failure.error) } : {}),
      }));
    }
    throw failure!.error;
  }
}

/** Closing an unused body is best effort; it must not hide HTTP or cancellation failures. */
function discardResponse(response: Response): void {
  try {
    void Promise.resolve(response.body?.cancel()).catch(() => {});
  } catch {
    /* Preserve the classified failure. */
  }
}

function activeResponse(response: Response, signal: AbortSignal): Response {
  if (signal.aborted) {
    discardResponse(response);
    signal.throwIfAborted();
  }
  return response;
}

/** Bounded diagnostic read; never delays an HTTP error by more than 250ms. */
async function captureErrorBody(response: Response): Promise<ProviderErrorCapture> {
  const reader = response.body?.getReader();
  if (!reader) return { body: '', truncated: false };
  const decoder = new TextDecoder();
  let body = '';
  let bytes = 0;
  let truncated = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => resolve(undefined), 250);
  });
  try {
    while (bytes < 65536) {
      const item = await Promise.race([reader.read(), deadline]);
      if (!item) break;
      if (item.done) {
        truncated = false;
        break;
      }
      const value = item.value.subarray(0, 65536 - bytes);
      bytes += value.length;
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    return { body, truncated };
  } finally {
    if (timer) clearTimeout(timer);
    void reader.cancel().catch(() => {});
    try {
      reader.releaseLock();
    } catch {
      /* A pending read is cancelled independently. */
    }
  }
}

export type {
  ModelProviderErrorCode,
  ModelProviderFailure,
  CompatibleModelConfig,
  CompatibleModelPorts,
  CompatibleModelProviderOptions,
  ProviderReasoningLevel,
  ProviderReasoningStrategy,
} from '../../structs/support/model/provider.js';

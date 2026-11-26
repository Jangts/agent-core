/**
 * Validation and defaulting of model runner settings.
 *
 * This is the single place where App-supplied settings become trusted: removed option
 * names are rejected with a migration hint, defaults are applied, and every numeric
 * limit is range-checked before the runner binds its provider.
 *
 * Exports: `resolveModelSettings`.
 */
import { resolveInteractionAlias } from './transports.js';
import { modelRunnerDefaults } from './defaults.js';
import { breakWhile } from '../utils/rules.js';
import type {
  ModelRunnerOptions,
  ModelRunnerPorts,
  ModelRuntimeConfig,
} from '../structs/model/runtime.js';
import type { BoundModelProvider } from '../structs/model/chat-provider.js';
import { recordErrorContext } from '../errors.js';

/**
 * Validate options and fill in baseline defaults.
 *
 * Legacy names (`config`, `ports`, `observe`, `signal`, `contextPolicy` and friends) are
 * rejected rather than ignored, because silently dropping them would change behavior.
 * Returned limits are frozen; ports keep live App callbacks with their receivers bound.
 *
 * @param options - Runner options as supplied by the App.
 * @returns The bound provider, frozen runtime config, input limit, ports and token limit.
 * @throws TypeError When any option is invalid, removed or out of range.
 */
export function resolveModelSettings(options: ModelRunnerOptions): {
  provider: BoundModelProvider;
  config: ModelRuntimeConfig;
  maxInputChars: number;
  ports: ModelRunnerPorts;
  maxOutputTokens: number;
} {
  const provider = options.provider as BoundModelProvider & {
    invoke?: import('../structs/model/lifecycle.js').ModelOperationProvider['invoke'];
    connect?: import('../structs/model/lifecycle.js').ModelRealtimeProvider['connect'];
  };
  const stream = provider?.stream;
  const streamEvents = provider?.streamEvents;
  const capabilities = provider?.capabilities;
  const directInvoke = provider?.invoke;
  const directConnect = provider?.connect;
  const declaredOperations = provider?.operations;
  const declaredRealtime = provider?.realtime;
  const operations = declaredOperations ?? (directInvoke === undefined ? undefined : provider);
  const invokeOperation = operations?.invoke;
  const realtime = declaredRealtime ?? (directConnect === undefined ? undefined : provider);
  const connectRealtime = realtime?.connect;
  const invalid = (message: string): Error => {
    const error = new TypeError(message);
    recordErrorContext(error, { codes: ['MODEL_CONFIG'], isRetryable: false });
    return error;
  };
  breakWhile([
    {
      occur:
        declaredOperations !== undefined &&
        (!declaredOperations ||
          typeof declaredOperations !== 'object' ||
          Array.isArray(declaredOperations)),
      error: () => invalid('Invalid provider.operations port'),
    },
    {
      occur:
        declaredRealtime !== undefined &&
        (!declaredRealtime ||
          typeof declaredRealtime !== 'object' ||
          Array.isArray(declaredRealtime)),
      error: () => invalid('Invalid provider.realtime port'),
    },
    {
      occur: stream !== undefined && typeof stream !== 'function',
      error: () => invalid('provider.stream must be a function'),
    },
    {
      occur: streamEvents !== undefined && typeof streamEvents !== 'function',
      error: () => invalid('provider.streamEvents must be a function'),
    },
    {
      occur: operations !== undefined && typeof invokeOperation !== 'function',
      error: () => invalid('provider.operations.invoke must be a function'),
    },
    {
      occur: realtime !== undefined && typeof connectRealtime !== 'function',
      error: () => invalid('provider.realtime.connect must be a function'),
    },
    {
      occur: !stream && !streamEvents && !invokeOperation && !connectRealtime,
      error: () => invalid('provider.stream or a lifecycle port is required'),
    },
    {
      occur:
        'contextPolicy' in options ||
        'contextCompressors' in options ||
        'contextSelectors' in options,
      error: () => invalid('Configure context processing with explicit Workflow nodes'),
    },
    {
      occur: 'config' in options || 'ports' in options || 'observe' in options,
      error: () => invalid('Use named model settings and execution, sink, observe or errors'),
    },
  ]);
  const defaulted = <T>(value: T | undefined, fallback: T): T =>
    value === undefined ? fallback : value;
  const maxCalls = defaulted(options.maxCalls, modelRunnerDefaults.maxCalls);
  const config: ModelRuntimeConfig = {
    maxCalls,
    callTimeoutMs: defaulted(options.callTimeoutMs, modelRunnerDefaults.callTimeoutMs),
    maxOutputChars: defaulted(options.maxOutputChars, modelRunnerDefaults.maxOutputChars),
    usage: options.usage,
    maxTotalCalls: defaulted(options.maxTotalCalls, maxCalls),
  };
  const ports: ModelRunnerPorts = {
    interactions: resolveInteractionAlias(options.interactions, options.transports),
    diagnostics: options.execution?.diagnostics,
    maxSchemaChars: options.maxSchemaChars,
    tokenBudget: options.tokenBudget,
    onOutput: options.sink?.output?.bind(options.sink),
    inputBudgetError: options.errors?.inputBudget?.bind(options.errors),
    outputBudgetError: options.errors?.outputBudget?.bind(options.errors),
  };
  breakWhile('signal' in options, () => invalid('Use execution.signal'));
  ports.maxSchemaChars = defaulted(ports.maxSchemaChars, modelRunnerDefaults.maxSchemaChars);
  const maxInputChars = defaulted(options.maxInputChars, modelRunnerDefaults.maxInputChars);
  const maxOutputTokens = defaulted(options.maxOutputTokens, modelRunnerDefaults.maxOutputTokens);
  const integer = (value: unknown, minimum: number, infinity = false) =>
    (infinity && value === Infinity) ||
    (typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum);
  breakWhile([
    {
      occur: !integer(config.maxCalls, 0),
      error: () => invalid('maxCalls must be a nonnegative safe integer'),
    },
    {
      occur: !integer(config.maxTotalCalls, 0) || config.maxTotalCalls! < config.maxCalls,
      error: () => invalid('maxTotalCalls must be a safe integer at least maxCalls'),
    },
    {
      occur: !integer(config.callTimeoutMs, 1) || config.callTimeoutMs > 2147483647,
      error: () => invalid('callTimeoutMs must be a positive supported timeout'),
    },
    {
      occur: !integer(maxInputChars, 0, true),
      error: () => invalid('maxInputChars must be a nonnegative safe integer or Infinity'),
    },
    {
      occur: config.maxOutputChars !== undefined && !integer(config.maxOutputChars, 0, true),
      error: () => invalid('maxOutputChars must be a nonnegative safe integer or Infinity'),
    },
    {
      occur: ports.maxSchemaChars !== undefined && !integer(ports.maxSchemaChars, 1),
      error: () => invalid('maxSchemaChars must be a positive safe integer'),
    },
    {
      occur: !integer(maxOutputTokens, 1),
      error: () => invalid('maxOutputTokens must be a positive safe integer'),
    },
  ]);
  return {
    provider: Object.freeze({
      ...(stream ? { stream: stream.bind(provider) } : {}),
      ...(streamEvents ? { streamEvents: streamEvents.bind(provider) } : {}),
      ...(capabilities ? { capabilities: Object.freeze(structuredClone(capabilities)) } : {}),
      ...(invokeOperation
        ? { operations: Object.freeze({ invoke: invokeOperation.bind(operations) }) }
        : {}),
      ...(connectRealtime
        ? { realtime: Object.freeze({ connect: connectRealtime.bind(realtime) }) }
        : {}),
    }) as BoundModelProvider,
    maxOutputTokens,
    config: Object.freeze(config),
    maxInputChars,
    ports,
  };
}

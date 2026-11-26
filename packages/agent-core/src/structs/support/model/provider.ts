/**
 * OpenAI-compatible provider contract.
 *
 * Place in the package: Support-side adapter configuration. Request identity, input, streaming and
 * budgets belong to the adapter; these types only declare what the App may configure and which
 * failures the adapter reports. Nothing here performs I/O.
 *
 * Exports: `ModelProviderErrorCode`, `ModelProviderFailure`, `ProviderReasoningLevel`,
 * `ProviderReasoningStrategy`, `CompatibleModelConfig`, `CompatibleModelPorts`, `ModelChoiceIndex`,
 * `CompatibleModelProviderOptions`, plus the provider observation type re-exports.
 */
import type { CompletionPolicy } from './completion.js';
import type { ProviderObserver } from './provider-observer.js';

/** Stable failure classification reported by the compatible provider adapter. */
export type ModelProviderErrorCode =
  /** Required configuration is missing, for example an empty API key. */
  | 'MODEL_NOT_CONFIGURED'
  /** Upstream rejected the credentials (HTTP 401/403). */
  | 'MODEL_AUTH'
  /** Upstream reported exhausted balance or quota (HTTP 402). */
  | 'MODEL_BALANCE'
  /** Upstream is rate limiting or overloaded (HTTP 429). */
  | 'MODEL_BUSY'
  /** The request itself is invalid (HTTP 400/404 or configuration validation). */
  | 'MODEL_CONFIG'
  /** Unclassified upstream failure. */
  | 'MODEL_UPSTREAM'
  /** Response body could not be parsed as the expected wire format. */
  | 'MODEL_FORMAT'
  /** The stream violated the protocol, for example data after the finish marker. */
  | 'MODEL_PROTOCOL'
  /** The provider stopped because the output token limit was reached. */
  | 'MODEL_OUTPUT_LIMIT'
  /** The stream ended without a usable payload. */
  | 'MODEL_INCOMPLETE';

/** Failure detail passed to the App's error factory. */
export interface ModelProviderFailure {
  code: ModelProviderErrorCode;
  /** HTTP status when the failure came from a response. */
  status?: number;
  /** `eof` marks a stream that ended before the finish marker. */
  reason?: 'eof';
}

/** Supplier wire shape is explicit; levels express requested effort, not measured quality. */
export type ProviderReasoningLevel = 'off' | 'low' | 'medium' | 'high';
/**
 * How a reasoning level is translated into request fields.
 *
 * `requestBody` entries override generated fields, so a host can correct a provider that expects
 * a different shape.
 */
export type ProviderReasoningStrategy = { readonly level: ProviderReasoningLevel } &
  /** Uses the fixed field shape of the named format, with no extra mapping or budgets. */
  (
    | {
        readonly format: 'reasoning-effort' | 'thinking' | 'enable-thinking';
        readonly map?: never;
        readonly budgets?: never;
      }
    /** Sends `thinking.budget_tokens`; defaults are 1024/4096/8192 for low/medium/high. */
    | {
        readonly format: 'thinking-budget';
        readonly budgets?: Readonly<
          Partial<Record<Exclude<ProviderReasoningLevel, 'off'>, number>>
        >;
        readonly map?: never;
      }
    /** Delegates field generation to the App mapper; must be synchronous. */
    | {
        readonly format: 'custom';
        map(level: ProviderReasoningLevel): Readonly<Record<string, unknown>>;
        readonly budgets?: never;
      }
  );

/** Configuration of one OpenAI-compatible endpoint. */
export interface CompatibleModelConfig {
  /** Endpoint base URL, for example the chat-completions root. */
  baseUrl: string;
  /** Credential sent as a bearer token; must be non-empty at request time. */
  apiKey: string;
  /** Model name sent with the request. */
  model: string;
  /** Optional provider ceiling; otherwise use the call's limit or the Core default. */
  maxOutputTokens?: number;
  /** Provider extensions. Identity, input, streaming and budget stay in the adapter. */
  requestBody?: Readonly<Record<string, unknown>> & {
    readonly model?: never;
    readonly messages?: never;
    readonly stream?: never;
    readonly max_tokens?: never;
    readonly max_completion_tokens?: never;
    readonly toJSON?: never;
  };
  /** Sampling temperature forwarded to the provider. */
  temperature?: number;
  /** Generated reasoning fields are overridden by explicit requestBody fields. */
  reasoning?: ProviderReasoningStrategy;
}

/** Adapter ports the App may override without replacing the provider. */
export interface CompatibleModelPorts {
  /** Fetch implementation; defaults to the global `fetch`. */
  request?: typeof fetch;
  /** Builds the thrown error for a classified failure. */
  error?(failure: ModelProviderFailure): Error;
  /** Prefix a JSON instruction when the prompt does not already mention JSON. */
  ensureJsonInstruction?: boolean;
  /** Accept an empty JSON response instead of reporting `MODEL_INCOMPLETE`. */
  allowEmptyJson?: boolean;
  /** Decide whether a finished stream satisfies the request; defaults to the legacy rules. */
  completionPolicy?: CompletionPolicy;
  /** Optional Support observations, collected by the caller independently of Core diagnostics. */
  observer?: ProviderObserver;
}

/** Minimal selector shape used while filtering the provider response choices. */
export interface ModelChoiceIndex {
  index: number;
}

export type {
  ProviderObserver,
  ProviderObservation,
  ProviderEventName,
  ProviderEventPayloads,
  ProviderEventDescriptor,
  ProviderErrorCapture,
} from './provider-observer.js';

/** Construction options for a compatible provider. */
export interface CompatibleModelProviderOptions {
  /** Static configuration, or a factory evaluated at each request boundary. */
  readonly config: CompatibleModelConfig | (() => CompatibleModelConfig);
  /** Port overrides other than observation and error mapping, which have their own keys. */
  readonly ports?: Omit<CompatibleModelPorts, 'observer' | 'error'>;
  /** Provider observation sink. */
  readonly observe?: { readonly provider?: ProviderObserver };
  /** Error factory for classified failures. */
  readonly errors?: { readonly failure?: (failure: ModelProviderFailure) => Error };
}

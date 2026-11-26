/**
 * Provider boundary contract.
 *
 * A chat provider streams neutral parts for a prepared message list; everything provider-specific
 * lives behind this abstraction. The module also re-exports the message primitives so adapters can
 * depend on one entry.
 *
 * Exports: `ModelProviderContext`, `ChatProvider`, and type re-exports of `ModelMessage`,
 * `ModelImage`, `ModelUsage`, `ModelFunction`, `FunctionCallDelta`, `ModelPart`, `ModelOptions`.
 */
import type { ExecutionContext } from '../common.js';
import type {
  ModelMessage,
  ModelOptions,
  ModelPart,
  ModelStreamEvent,
  ModelCapabilities,
} from './messages.js';

/** Per-call facts a provider receives besides the messages themselves. */
export interface ModelProviderContext extends ExecutionContext {
  /** Options prepared for this call, including function schemas and JSON mode. */
  readonly options?: Readonly<ModelOptions>;
}

/**
 * Streaming model provider.
 *
 * Implementations must stop producing when `context.signal` aborts and should surface interaction
 * failures by rejecting the iteration rather than ending it silently.
 */
export abstract class ChatProvider {
  /** Optional full-event path. Legacy providers only need stream. */
  streamEvents?(
    messages: readonly ModelMessage[],
    context: ModelProviderContext,
  ): AsyncIterable<ModelStreamEvent>;
  /** Explicit endpoint capability facts, not host authorization. */
  readonly capabilities?: ModelCapabilities;
  /** Optional lifecycle protocol ports. */
  readonly operations?: import('./lifecycle.js').ModelOperationProvider;
  readonly realtime?: import('./lifecycle.js').ModelRealtimeProvider;
  /**
   * @param messages - Final message list, already budget-checked by the caller.
   * @param context - Cancellation and per-call options.
   * @returns Parts in arrival order; function-call fragments keep their provider index.
   */
  abstract stream(
    messages: readonly ModelMessage[],
    context: ModelProviderContext,
  ): AsyncIterable<ModelPart>;
}
export type {
  ModelMessage,
  ModelInteractionOptions,
  ModelContentPart,
  ModelContinuation,
  ModelCapabilities,
  ModelStreamEvent,
  ModelImage,
  ModelUsage,
  ModelFunction,
  FunctionCallDelta,
  ModelPart,
  ModelOptions,
} from './messages.js';

/** 0.9 development contract: existing generation or lifecycle ports accepted by Runner. */
export type ModelProvider =
  | ChatProvider
  | (Partial<ChatProvider> & { readonly streamEvents: NonNullable<ChatProvider['streamEvents']> })
  | import('./lifecycle.js').ModelOperationProvider
  | import('./lifecycle.js').ModelRealtimeProvider
  | {
      readonly operations: import('./lifecycle.js').ModelOperationProvider;
      readonly realtime?: import('./lifecycle.js').ModelRealtimeProvider;
    }
  | {
      readonly realtime: import('./lifecycle.js').ModelRealtimeProvider;
      readonly operations?: import('./lifecycle.js').ModelOperationProvider;
    };
/** Internal normalized snapshot; absent generation ports remain absent. */
export type BoundModelProvider = Partial<ChatProvider> & ModelProvider;

/** @deprecated Use `ModelProvider`. Retained for the 0.9 migration. */
export type { ModelProvider as ModelRunnerProvider };

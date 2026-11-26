/**
 * Model interaction contracts: how model output is turned into a business selection.
 *
 * An adapter compiles registered tools into provider options plus an instruction, and
 * decodes the streamed response into a `ModelSelection`. A interaction registration binds one adapter
 * to a capability source, so the same business registry can be served by different wire formats.
 *
 * Exports: `ModelResponseCollector`, `PreparedModelSelection`, `PreparedModelInteraction`,
 * `ModelInteractionAdapter`, `ModelInteractionRegistration`, `NativeFunctionCall`.
 */
import type { ModelOptions, ModelPart } from './messages.js';
import type {
  ModelSelection,
  ModelToolSource,
  RegisteredModelTool,
} from '../capabilities/model.js';

/** Accumulates streamed parts for one call and resolves them into the interaction's result. */
export interface ModelResponseCollector<Result = ModelSelection> {
  /** Native function call that carried the selection, when the response used one. */
  readonly call?: ModelSelection['call'];
  /** All native calls carried by a model tool response; omitted by single-selection collectors. */
  readonly calls?: readonly {
    id: string;
    name: string;
    argumentChars: number;
    toolId?: string;
  }[];
  /** Output characters accumulated so far, for output-budget accounting. */
  readonly outputChars: number;
  /** Appends one streamed part; parts arrive in provider order. */
  push(part: ModelPart): void;
  /** Finalizes the response. Throws when the accumulated content is not a valid selection. */
  finish(): Result;
}

/** Adapter output for one stage, before the caller binds capability resolution. */
export interface PreparedModelSelection<Result = unknown> {
  /** Provider options produced from the stage's tools. */
  readonly options: Pick<
    ModelOptions,
    | 'functions'
    | 'json'
    | 'toolChoice'
    | 'parallelToolCalls'
    | 'requireCompletion'
    | 'outputSchema'
    | 'continuation'
    | 'onContinuation'
    | 'onContent'
  >;
  /** Characters the compiled schemas add to the input, counted against the schema budget. */
  readonly schemaChars: number;
  /** Instruction text that teaches the model how to answer; absent when the format is native. */
  readonly instruction?: string;
  /** Creates a fresh collector for one call; never reuse a collector across calls. */
  createResponse(): ModelResponseCollector;
  /** Resolves a validated selection into the stage result. */
  resolve(selection: ModelSelection, stage: string): Result;
}

/** Prepared interaction handed to the runner, including sampling defaults. */
export interface PreparedModelInteraction<Result = unknown> {
  readonly options: Pick<
    ModelOptions,
    | 'functions'
    | 'json'
    | 'temperature'
    | 'toolChoice'
    | 'parallelToolCalls'
    | 'requireCompletion'
    | 'outputSchema'
    | 'continuation'
    | 'onContinuation'
    | 'onContent'
  >;
  readonly schemaChars: number;
  readonly instruction?: string;
  createResponse(): ModelResponseCollector<Result>;
}

/** Pluggable implementations all consume the same business registry. No automatic fallback. */
export interface ModelInteractionAdapter {
  /** Adapter id, reported when an interaction is validated or rejected. */
  readonly id: string;
  readonly features: { readonly strictArguments: boolean };
  /**
   * Compiles one stage's tools.
   *
   * @param tools - Capabilities available in this stage; must be non-empty.
   * @returns Options, instruction and collector factory; the interaction adds `resolve`.
   */
  prepare(tools: readonly RegisteredModelTool[]): Omit<PreparedModelSelection, 'resolve'>;
}

/** Binds an adapter to the tools one interaction serves. */
export interface ModelInteractionRegistration<Result = unknown> {
  /** Transport id used by call requests and reported in diagnostic events. */
  id: string;
  /** Static capability source, or a factory that selects tools per stage. */
  tools: ModelToolSource<Result> | ((stage: string) => ModelToolSource<Result>);
  /** Wire-format adapter; defaults to native function calling. */
  adapter?: ModelInteractionAdapter;
  /** Sampling defaults this interaction contributes to every call. */
  options?: import('./messages.js').ModelInteractionOptions;
  /** Reject the registration when the chosen adapter cannot enforce strict arguments. */
  requireStrictArguments?: boolean;
}

/** Request-local native call buffer; never an execution receipt. */
export interface NativeFunctionCall {
  /** Provider call id; only unique within the response. */
  id: string;
  /** Function name exactly as returned by the model. */
  name: string;
  /** Raw JSON argument text, validated only when the selection is parsed. */
  arguments: string;
}

/** @deprecated Use `PreparedModelInteraction`. Retained for the 0.9 migration. */
export type { PreparedModelInteraction as PreparedModelTransport };
/** @deprecated Use `ModelInteractionRegistration`. Retained for the 0.9 migration. */
export type { ModelInteractionRegistration as ModelTransportRegistration };

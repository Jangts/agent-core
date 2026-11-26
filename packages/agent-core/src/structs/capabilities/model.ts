/**
 * Model capability contract: the business operations a model may select during a call.
 *
 * A capability pairs one JSON schema with a resolver that turns model-supplied arguments into a
 * host value. Registration snapshots the schema and pins the resolver, so a request can project a
 * sealed subset without cloning handlers.
 *
 * Exports: `ModelTool`, `ModelToolRegistration`, `RegisteredModelTool`,
 * `ModelSelection`, `ModelToolSource`, `ModelToolCatalog`.
 */
import type { SchemaAdapter, ReadonlyCatalog } from '../common.js';

/** A model proposal, not an authorization or execution receipt. */
export interface ToolProposal {
  readonly toolId: string;
  readonly input: unknown;
}

/** Read-only host data without changing explicit any/unknown erasure into an object constraint. */
export type ToolContext<Context> = unknown extends Context ? Context : Readonly<Context>;
/** Demand-facing hints attached to one Tool; no independent identity is created. */
export interface IntentOptions<Context> {
  /** Optional demand-facing description; otherwise the tool description is reused. */
  readonly description?: string;
  /** Synchronous participation predicate. */
  readonly when?: (context: ToolContext<Context>) => boolean;
}
/** Demand-discovery metadata; it has no identity independent of its tool. */
export type AsIntent<Context> =
  true | string | ((context: ToolContext<Context>) => boolean) | IntentOptions<Context>;
/** Activation is independent of participation in demand discovery. */
export type ToolCondition<Context> = boolean | ((context: ToolContext<Context>) => boolean);

/** Common selectable model interface; resolution proposes a value without business execution. */
export interface ModelTool<Input = unknown, Output = Input, Context = any> {
  /** Unique id within its registry; never blank. */
  readonly id: string;
  /** Model-visible description explaining when the capability applies. */
  readonly description: string;
  /** Schema describing the arguments; must be an object schema. */
  readonly inputSchema: SchemaAdapter<Input>;
  /** Omitted means active. Authorization remains a separate execution boundary. */
  readonly active?: ToolCondition<Context>;
  /** Omitted means this tool is not advertised by select({ intent: true }). */
  readonly asIntent?: AsIntent<Context>;
  /**
   * Converts validated arguments into the value handed back to the caller.
   *
   * Runs inside the model call, so it must return synchronously; throwing rejects the selection.
   */
  resolve(input: Input, context: Readonly<{ stageId: string }>): Output;
}
/** Registration form: input typing is erased, output typing is preserved. */
export type ModelToolRegistration<Output = unknown> = Omit<ModelTool<any, Output>, 'resolve'> & {
  readonly resolve?: ModelTool<any, Output>['resolve'];
};
/** Frozen snapshot stored by a registry after schema validation. */
export type RegisteredModelTool<Output = unknown> = Readonly<ModelTool<unknown, Output>>;
/** A model's chosen capability together with its parsed arguments. */
export type ModelSelection = {
  /** Arguments exactly as produced by the model, before schema parsing. */
  readonly input: Record<string, unknown>;
  /** Native function call that carried the selection, when the provider used one. */
  readonly call?: { id: string; name: string; argumentChars: number };
  /** Capability the selection resolved to. */
  readonly toolId: string;
};
/** Parameters for a model-tool view. Intent discovery and explicit inclusion share one selection. */
export interface ModelToolSelection {
  /** Explicit base ids; omitted means every registered tool. */
  readonly ids?: readonly string[];
  /** Select demand-facing tools, using their discovery descriptions. */
  readonly intent?: boolean;
  /** Explicit continuations added to demand discovery, with normal tool descriptions. */
  readonly include?: readonly string[];
}

/** Minimal source a stage needs: enumerate tools and resolve one selection. */
export interface ModelToolSource<Output = unknown> {
  values(): IterableIterator<RegisteredModelTool<Output>>;
  /** Resolves one selection; throws when the capability is absent from this source. */
  resolve(selection: ModelSelection, context: Readonly<{ stageId: string }>): Output;
}

/** A compiled entity catalog also supports the minimal stage source contract. */
export type ModelToolCatalog<Output = unknown> = ReadonlyCatalog<RegisteredModelTool<Output>> &
  ModelToolSource<Output> & {
    /** Explicit selection, optionally filtered against a host context. */
    select(
      selection: readonly string[] | ModelToolSelection,
      context?: unknown,
    ): ModelToolCatalog<Output>;
  };

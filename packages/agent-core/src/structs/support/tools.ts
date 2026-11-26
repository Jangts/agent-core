/**
 * Tool catalog contract used by Support's tool assembly.
 *
 * Place in the package: an App-side projection of typed tool definitions into model tools.
 * The model may only propose `{ toolId, input }`; authorization, invocation, budgets and
 * cancellation still happen in Core's tool registry.
 *
 * Exports: `ToolDefinition` (type re-export), `ToolProposal`, `ToolModelView`, `SelectedTools`,
 * `ToolOutput`, `CompiledTool`, `ToolRuntime`, `ToolCatalogEntry`, `ToolCatalog`.
 */
import type { DecodedSessionCall } from '../../support/model/session.js';
import type { RegistrationData } from '../../utils/registration.js';

import type { ToolResult } from '../invocation.js';
import type {
  SchemaAdapter,
  OperationContext,
  ExecutionOptions,
  ReadonlyCatalog,
} from '../common.js';
import type {
  RegisteredModelTool,
  ModelSelection,
  ModelToolSelection,
} from '../capabilities/model.js';
import type { ModelToolRegistry } from '../../capabilities/model.js';
import type {
  ToolDefinition,
  ExecutableTool,
  ToolExecutionEvent,
  ToolRegistryPorts,
  ToolInvocationRequest,
} from '../capabilities/tools.js';

export type { ToolDefinition } from '../capabilities/tools.js';

/** A model's proposal to call one tool; nothing has been authorized or executed yet. */
export type { ToolProposal } from '../capabilities/model.js';
import type { ToolProposal } from '../capabilities/model.js';
/** Model capability view of a tool catalog, retaining the host context type. */
export interface ToolModelView<App = unknown> extends ModelToolRegistry {
  values(): IterableIterator<RegisteredModelTool<ToolProposal>>;
  /** Resolves a model selection into a proposal; throws for unknown or invalid selections. */
  resolve(selection: ModelSelection, context: Readonly<{ stageId: string }>): ToolProposal;
  /** Narrows the capability set to `ids`; throws for unregistered ids. */
  select(selection: readonly string[] | ModelToolSelection, context?: App): ToolModelView<App>;
}
type ResultDefinition = { readonly id: string; parseOutput(value: unknown): unknown };
/** Catalog narrowed to the given ids: each kept tool's id literal is intersected with `Id`. */
export type SelectedTools<
  Tool extends ResultDefinition,
  Id extends string,
> = Tool extends ResultDefinition
  ? [Tool['id'] & Id] extends [never]
    ? never
    : Tool & { readonly id: Tool['id'] & Id }
  : never;
/** Output type of the tool whose id matches `Id`; `never` for any other id. */
export type ToolOutput<
  Tool extends ResultDefinition,
  Id extends string,
> = Tool extends ResultDefinition
  ? Id extends Tool['id']
    ? ReturnType<Tool['parseOutput']>
    : never
  : never;
/** Tool definition type derived from a declaration literal, preserving input/output/id. */
export type CompiledTool<App, Definition> = Definition extends {
  parseOutput(value: unknown): infer Output;
}
  ? Definition extends { readonly id: infer Id extends string }
    ? ExecutableTool<
        Definition extends { inputSchema: SchemaAdapter<infer Input> } ? Input : unknown,
        Output,
        App,
        Id
      > &
        RegistrationData<Definition>
    : never
  : never;
/** Catalog bound to one App request. */
export interface ToolRuntime<Tool extends ResultDefinition = ResultDefinition, App = unknown> {
  /** Model tools filtered and bound to this runtime's App context. */
  readonly tools: ToolModelView<App>;
  /** Execution events recorded by this runtime so far, in occurrence order. */
  readonly events: readonly ToolExecutionEvent[];
  /** Synchronous invocation; rejects tools declared as asynchronous. */
  invokeSync<const Id extends Tool['id']>(
    request: ToolInvocationRequest<Id>,
  ): ToolResult<ToolOutput<Tool, Id>>;
  invokeSync(request: ToolInvocationRequest | DecodedSessionCall): ToolResult<unknown>;
  /** Asynchronous invocation; still bounded by the bound execution signal and errors. */
  invoke<const Id extends Tool['id']>(
    request: ToolInvocationRequest<Id>,
  ): Promise<ToolResult<ToolOutput<Tool, Id>>>;
  invoke(request: ToolInvocationRequest | DecodedSessionCall): Promise<ToolResult<unknown>>;
}
/** Public declaration surface of one tool, without registry internals. */
export type ToolCatalogEntry<App, Tool extends ToolDefinition<unknown, unknown, App>> =
  Tool extends ToolDefinition<unknown, unknown, App> ? Tool : never;
/** Frozen tool catalog with model tools and per-request binding. */
export interface ToolCatalog<
  App,
  Tool extends ToolDefinition<unknown, unknown, App> = ToolDefinition<unknown, unknown, App>,
> extends ReadonlyCatalog<ToolCatalogEntry<App, Tool>> {
  readonly tools: ToolModelView<App>;
  /** Narrows the catalog while preserving declaration order; throws for unknown ids. */
  select<const Ids extends readonly string[]>(
    ids: Ids,
    context?: App,
  ): ToolCatalog<App, SelectedTools<Tool, Ids[number]>>;
  /** Demand discovery and continuation inclusion share the same immutable projection. */
  select(selection: ModelToolSelection, context?: App): ToolCatalog<App, Tool>;
  /** Binds the catalog to one App request and returns an invocable runtime. */
  bind(request: {
    app: App;
    execution?: ExecutionOptions;
    errors?: Pick<ToolRegistryPorts, 'unavailable' | 'errorCode'>;
  }): ToolRuntime<Tool, App>;
}

/**
 * Tool support: turn typed application tool definitions into a Core-schedulable tool catalog.
 *
 * A tool declaration pairs an input schema with authorization, execution and output parsing. The
 * catalog projects those tools into model tools and binds them to the Core tool registry
 * when a runtime request supplies the application. Support only assembles the registration; Core
 * still performs authorization, invocation, budgets and cancellation.
 *
 * Main exports: `defineTool` and `defineToolCatalog`.
 */
import { modelDefinition } from './model/capabilities.js';
import { ModelToolRegistry } from '../capabilities/model.js';
import { createToolRegistry } from './tool-runtime.js';
import { defineSchema } from './schema.js';
import { registrationData } from '../utils/registration.js';
import { modelProtocolError } from '../utils/model-protocol.js';
import { toolInvocation } from '../utils/invocation.js';
import type { DecodedModelResponseToolCall } from './model/session.js';
import type { ToolInvocationRequest } from '../structs/capabilities/tools.js';
import { readonlyCatalog } from '../utils/catalog.js';
import { maybeAssertion } from '../utils/synchronous.js';
import { snapshotIntent, bindIntent } from '../capabilities/tool-conditions.js';
import type { ModelToolSelection } from '../structs/capabilities/model.js';
import type { OperationContext } from '../structs/common.js';
import type { ExecutableTool } from '../structs/capabilities/tools.js';
import type {
  ToolDefinition,
  ToolCatalog,
  ToolModelView,
  CompiledTool,
} from '../structs/support/tools.js';

/**
 * Validate one tool declaration and freeze a detached copy of it.
 *
 * `authorize` must settle with `void`; a rejection has to be thrown, so a returned `false` cannot
 * silently pass. Handlers are bound to the declaration object, and the input schema is
 * re-snapshotted so later mutation cannot widen the accepted input.
 *
 * @param definition Tool declaration whose `id` is preserved as a literal type.
 * @returns A frozen tool definition with a snapshotted `inputSchema`.
 * @throws {TypeError} When `id`, `kind` or `description` is blank, when a handler is missing, or
 *   when `authorize` returns a value instead of throwing.
 */
export function defineTool<Input, Output, App, const Id extends string = string>(
  definition: ToolDefinition<Input, Output, App> & { readonly id: Id },
): ExecutableTool<Input, Output, App, Id> {
  const { id, kind, description } = definition;
  if (definition.resolve !== undefined)
    throw new TypeError('Executable tools cannot declare resolve');
  if (!id?.trim() || !kind?.trim() || !description?.trim())
    throw new TypeError('Invalid tool identity');
  if (
    typeof definition.authorize !== 'function' ||
    typeof definition.execute !== 'function' ||
    typeof definition.parseOutput !== 'function'
  )
    throw new TypeError('Missing tool handler');
  const inputSchema = defineSchema(definition.inputSchema);
  const authorize = definition.authorize.bind(definition);
  if (
    definition.active !== undefined &&
    typeof definition.active !== 'boolean' &&
    typeof definition.active !== 'function'
  )
    throw new TypeError('Invalid tool active condition');
  const active =
    typeof definition.active === 'function'
      ? definition.active.bind(definition)
      : definition.active;
  const asIntent = bindIntent(
    snapshotIntent(
      typeof definition.asIntent === 'function'
        ? definition.asIntent.bind(definition)
        : definition.asIntent,
    ),
    definition,
  );
  return Object.freeze({
    ...registrationData(definition),
    id,
    kind,
    description,
    inputSchema,
    active,
    asIntent,
    authorize(input: Input, context: OperationContext<App>) {
      return maybeAssertion(
        authorize(input, context),
        'Authorization must return void; rejection must throw',
      );
    },
    execute: definition.execute.bind(definition),
    debugSteps: definition.debugSteps?.bind(definition),
    parseOutput: definition.parseOutput.bind(definition),
  });
}

/**
 * Compile tool declarations into a frozen catalog with model tools and runtime binding.
 *
 * Each tool becomes a model capability whose resolver returns `{ toolId, input }`; the model only
 * chooses among registered tools, it never invokes them directly.
 *
 * @param definitions Tool declarations in catalog order.
 * @returns A frozen catalog with `tools`, `select` and `bind`.
 * @throws {TypeError} When a tool declaration is invalid or a tool ID is duplicated.
 */
type DefinitionApp<Definition> = Definition extends {
  authorize(input: any, context: OperationContext<infer App>): unknown;
}
  ? App
  : unknown;

/** Infer the host context from existing executable definitions, without widening it to unknown. */
export function defineToolCatalog<
  const Definitions extends readonly ToolDefinition<any, any, any>[],
>(
  definitions: Definitions,
): ToolCatalog<
  DefinitionApp<Definitions[number]>,
  CompiledTool<DefinitionApp<Definitions[number]>, Definitions[number]>
>;
/** Explicit host typing remains available for contextually typed declaration lists. */
export function defineToolCatalog<
  App,
  const Definitions extends readonly ToolDefinition<any, any, App>[] = readonly ToolDefinition<
    any,
    any,
    App
  >[],
>(definitions: Definitions): ToolCatalog<App, CompiledTool<App, Definitions[number]>>;
export function defineToolCatalog<
  App,
  const Definitions extends readonly ToolDefinition<any, any, App>[] = readonly ToolDefinition<
    any,
    any,
    App
  >[],
>(definitions: Definitions): ToolCatalog<App, CompiledTool<App, Definitions[number]>> {
  const entries = definitions.map((definition) =>
    defineTool(definition as ToolDefinition<unknown, unknown, App>),
  );
  return projectTools<App, CompiledTool<App, Definitions[number]>>(
    entries as CompiledTool<App, Definitions[number]>[],
    new ModelToolRegistry(entries.map(modelDefinition)).seal() as ToolModelView<App>,
  );
}

/** Derive request views from frozen entries; registration and schema snapshots happen only once. */
function projectTools<App, Tool extends ToolDefinition<any, any, App>>(
  entries: readonly Tool[],
  tools: ToolModelView<App>,
): ToolCatalog<App, Tool> {
  const view = readonlyCatalog(entries, (id) => new TypeError(`Unknown tool: ${id}`));
  return Object.freeze({
    ...view,
    tools,
    /**
     * Narrow the catalog to the given tool IDs, preserving their declaration order.
     *
     * @param ids Registered tool IDs to keep.
     * @returns A new catalog containing only the selected tools.
     * @throws {TypeError} When an ID is not registered in this catalog.
     */
    select(selection: readonly string[] | ModelToolSelection, ...context: [] | [App]) {
      const selected = context.length
        ? tools.select(selection, context[0])
        : tools.select(selection);
      return projectTools(
        entries
          .filter((tool) => selected.has(tool.id))
          .map((tool) =>
            selected.require(tool.id).description === tool.description
              ? tool
              : Object.freeze({ ...tool, description: selected.require(tool.id).description }),
          ),
        selected,
      );
    },
    /**
     * Bind the catalog to one application runtime request.
     *
     * @param request Runtime request supplying the app and optional execution/error ports.
     * @returns A frozen runtime whose `invoke`/`invokeSync` delegate to the Core tool registry.
     * @throws {TypeError} When the request does not carry an `app`.
     */
    bind(request: Parameters<ToolCatalog<App>['bind']>[0]) {
      if (!request || !('app' in request)) throw new TypeError('A runtime request requires app');
      const registry = createToolRegistry(entries, request.app, {
        execution: request.execution,
        errors: request.errors,
      });
      const invocation = (
        call: ToolInvocationRequest | DecodedModelResponseToolCall,
      ): ToolInvocationRequest => {
        if (
          'arguments' in call &&
          (call.problem !== undefined || !call.toolId || call.input === undefined)
        ) {
          modelProtocolError('Session call is not a valid registered tool proposal');
        }
        return call as ToolInvocationRequest;
      };
      return Object.freeze({
        tools: tools.select(tools.ids(), request.app),
        get events() {
          return registry.events;
        },
        invokeSync(call: ToolInvocationRequest | DecodedModelResponseToolCall) {
          return registry.invoke(toolInvocation(invocation(call), arguments.length));
        },
        async invoke(call: ToolInvocationRequest | DecodedModelResponseToolCall) {
          return registry.invokeAsync(toolInvocation(invocation(call), arguments.length));
        },
      });
    },
  }) as unknown as ToolCatalog<App, Tool>;
}
export type * from '../structs/support/tools.js';

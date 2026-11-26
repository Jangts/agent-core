/**
 * Bridge from typed tool definitions to the Core `ToolRegistry`.
 *
 * A `ToolDefinition` is the App-facing declaration: a schema adapter plus authorize, execute
 * and parseOutput handlers. This module pins those handlers to their definition and adapts
 * them to the lower-level `ErasedTool` contract, while keeping the synchronous and
 * asynchronous boundaries explicit: `invokeAsync` awaits authorization and execution,
 * `invoke` rejects a promise from either.
 *
 * Exports: `createToolRegistry`.
 */
import { assertion, synchronous, isPromiseLike } from '../utils/synchronous.js';
import { toolActive } from './tool-conditions.js';
import { ToolRegistry } from './tools.js';
import type { ToolDefinition, ToolRegistryOptions } from '../structs/capabilities/tools.js';

/**
 * Run authorization and execution for one call, in that order.
 *
 * Authorization must resolve to undefined; a discarded boolean is treated as a contract
 * violation instead of being silently ignored. Cancellation is checked before and after each
 * phase so an aborted request never produces a successful value.
 */
function execute<Context>(
  definition: ToolDefinition<unknown, unknown, Context>,
  input: unknown,
  context: Context,
  execution: import('../structs/capabilities/tools.js').ToolExecutionContext,
  unavailable?: NonNullable<ToolRegistryOptions['errors']>['unavailable'],
): unknown {
  const { signal, mode, diagnostics, report, createStepRecorder, createSubFlowLogger } = execution;
  signal.throwIfAborted();
  if (!toolActive(definition.active, context))
    throw unavailable?.(definition.id) ?? new Error(`Tool is inactive: ${definition.id}`);
  // Re-check after the handler returned: work that completed during cancellation must not be
  // reported as a success.
  const complete = (value: unknown) => {
    signal.throwIfAborted();
    return value;
  };
  const operation = {
    app: context,
    signal,
    diagnostics,
    logger: execution.logger,
    report,
    createStepRecorder,
    createSubFlowLogger,
  };
  const authorized = (result?: unknown) => {
    assertion(result, 'Tool authorization must return void');
    signal.throwIfAborted();
    const value = definition.execute(input, operation);
    return mode === 'sync'
      ? complete(synchronous(value, 'Synchronous tools must not return a Promise'))
      : isPromiseLike(value)
        ? Promise.resolve(value).then(complete)
        : complete(value);
  };
  const allowed = definition.authorize(input, operation);
  return mode === 'sync'
    ? authorized(synchronous(allowed, 'Synchronous tool authorization must not return a Promise'))
    : isPromiseLike(allowed)
      ? Promise.resolve(allowed).then(authorized)
      : authorized(allowed);
}
/**
 * Build a sealed tool registry from typed definitions.
 *
 * @param definitions Tool declarations in registration order; ids must be unique.
 * @param context App context captured for every call made through this registry.
 * @param options Registry ports: the request-lifetime signal, diagnostics, and the error
 *   mapping used for unavailable tools and failure codes.
 * @returns The sealed registry.
 * @throws Error when the registry is sealed already or an id is duplicated.
 * @throws TypeError when a definition is invalid, raised during registration.
 */
export function createToolRegistry<Context>(
  definitions: readonly ToolDefinition<unknown, unknown, Context>[],
  context: Context,
  options: ToolRegistryOptions,
): ToolRegistry {
  const registry = new ToolRegistry(options);
  const unavailable = options.errors?.unavailable?.bind(options.errors);
  registry.registerAll(
    definitions.map((definition) => {
      // Every entry point pins the same canonical handlers, including callers
      // that use this creator directly rather than defineToolCatalog.
      const {
        id,
        kind,
        description,
        inputSchema,
        authorize,
        execute: handle,
        parseOutput,
        debugSteps,
      } = definition;
      const bound = Object.freeze({
        id,
        kind,
        description,
        inputSchema,
        active:
          typeof definition.active === 'function'
            ? definition.active.bind(definition)
            : definition.active,
        authorize: authorize.bind(definition),
        execute: handle.bind(definition),
        parseOutput: parseOutput.bind(definition),
      });
      return {
        id,
        kind,
        description,
        debugSteps: debugSteps?.bind(definition),
        // Bind to the adapter captured above, so a later replacement of the property on the
        // definition cannot change what this registry validates.
        parseInput: inputSchema.parse.bind(inputSchema),
        parseOutput: bound.parseOutput,
        execute: (
          input: unknown,
          execution: import('../structs/capabilities/tools.js').ToolExecutionContext,
        ) => execute(bound, input, context, execution, unavailable),
      };
    }),
  );
  registry.seal();
  return registry;
}

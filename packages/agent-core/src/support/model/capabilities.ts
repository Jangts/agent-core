/**
 * Model capability catalog: seal a typed declaration list into a reusable catalog.
 *
 * The catalog is a frozen snapshot, so mutating the original declaration list cannot widen the
 * result type or add tools at runtime. Resolution stays inside Core's registry; Support only
 * projects the declarations and their output type.
 *
 * Main export: `defineModelTools`.
 */
import { bindIntent, snapshotIntent } from '../../capabilities/tool-conditions.js';
import { readonlyCatalog } from '../../utils/catalog.js';
import { ModelToolRegistry } from '../../capabilities/model.js';
import type {
  ModelToolRegistration,
  RegisteredModelTool,
  ModelToolCatalog,
  ModelToolSelection,
} from '../../structs/capabilities/model.js';
import type { ToolDefinition } from '../../structs/capabilities/tools.js';
import type { ToolProposal } from '../../structs/capabilities/model.js';

/** A sealed typed snapshot. Mutating the original list cannot widen its result contract. */
type CapabilityOutput<Definition> = Definition extends { execute(...args: any[]): unknown }
  ? ToolProposal
  : Definition extends { resolve(...args: any[]): infer Output }
    ? Output
    : Definition extends {
          inputSchema: import('../../structs/common.js').SchemaAdapter<infer Input>;
        }
      ? Input
      : never;
/**
 * Build a sealed capability catalog from typed declarations.
 *
 * @param definitions Capabilities in declaration order; each needs a unique ID, a description and
 *   an object-rooted input schema.
 * @returns A frozen catalog exposing the registered definitions, lookup by ID and `resolve`.
 * @throws {TypeError} When a declaration is invalid or duplicated, or when `require` receives an
 *   unknown ID.
 * @throws {Error} When a resolver is asynchronous.
 */
export function defineModelTools<
  const Definitions extends readonly (ModelToolRegistration | ToolDefinition<any, any, any>)[],
>(definitions: Definitions): ModelToolCatalog<CapabilityOutput<Definitions[number]>> {
  type Result = CapabilityOutput<Definitions[number]>;
  const registry = new ModelToolRegistry(definitions.map(modelDefinition)).seal();
  return project<Result>(registry);
}

/** Executable tools propose raw arguments; business parsing occurs once at execution. */
export function modelDefinition(
  definition: ModelToolRegistration | ToolDefinition<any, any, any>,
): ModelToolRegistration {
  const executable = definition as Partial<ToolDefinition<any, any, any>>;
  if (typeof executable.execute !== 'function') return definition as ModelToolRegistration;
  if (typeof executable.authorize !== 'function' || typeof executable.parseOutput !== 'function')
    throw new TypeError('Missing executable tool handler');
  if (definition.resolve !== undefined)
    throw new TypeError('Executable tools cannot declare resolve');
  const id = definition.id;
  return {
    id,
    description: definition.description,
    active:
      typeof definition.active === 'function'
        ? definition.active.bind(definition)
        : definition.active,
    asIntent: bindIntent(
      snapshotIntent(
        typeof definition.asIntent === 'function'
          ? definition.asIntent.bind(definition)
          : definition.asIntent,
      ),
      definition,
    ),
    inputSchema: {
      jsonSchema: definition.inputSchema.jsonSchema,
      parse: (input: unknown) => input,
    },
    resolve: (input: unknown) => ({ toolId: id, input }),
  };
}

/** Project existing immutable entries without re-registering schemas or rebinding handlers. */
function project<Result>(registry: ModelToolRegistry): ModelToolCatalog<Result> {
  return Object.freeze({
    ...readonlyCatalog(
      registry.definitions as readonly RegisteredModelTool<Result>[],
      (id) => new TypeError(`Unknown model capability: ${id}`),
    ),
    resolve: (selection, stage) => registry.resolve(selection, stage) as Result,
    select: (selection: readonly string[] | ModelToolSelection, ...context: [] | [unknown]) =>
      project<Result>(
        context.length ? registry.select(selection, context[0]) : registry.select(selection),
      ),
  } satisfies ModelToolCatalog<Result>);
}

/**
 * Declarative catalog of model tools for a request or one stage projection.
 *
 * A capability pairs an id and description with an input schema and a synchronous resolver,
 * letting stage code parse model-supplied arguments and produce a typed value. Registration
 * snapshots the schema and pins the parser and resolver to their defining object, so later
 * mutation on the host side cannot change what a stage advertises.
 *
 * The registry is mutable until `seal()`. `select()` derives a sealed subset for a stage and
 * shares the already-frozen entries rather than re-validating or re-wrapping them.
 *
 * Exports: `ModelToolRegistry`, `modelProtocolError`, and the capability types.
 */
import { synchronous } from '../utils/synchronous.js';
import type {
  ModelTool,
  ModelToolRegistration,
  RegisteredModelTool,
  ModelSelection,
  ModelToolSource,
  ModelToolCatalog,
  ModelToolSelection,
} from '../structs/capabilities/model.js';
import { modelProtocolError } from '../utils/model-protocol.js';
import { snapshotSchemaAdapter } from '../utils/schema-adapter.js';
import { snapshotIntent, toolActive, intentDescription, bindIntent } from './tool-conditions.js';

export { modelProtocolError } from '../utils/model-protocol.js';

/** A request/stage projection is a sealed registry. Hosts filter availability before projection. */
export class ModelToolRegistry {
  /** Insertion-ordered entries; iteration order is the declaration order of the catalog. */
  private readonly definitionsById = new Map<string, RegisteredModelTool>();
  /** Sealing is one-way: stage-time code must never extend the catalog it is executing. */
  private sealed = false;

  /**
   * @param definitions Capabilities to register immediately, in iteration order.
   * @throws TypeError when a definition is invalid or its id is duplicated (raised by
   *   `register`).
   */
  constructor(definitions: Iterable<ModelToolRegistration> = []) {
    for (const definition of definitions) this.register(definition);
  }

  /**
   * Register one capability.
   *
   * @param capability Declaration with a non-empty unique id, non-empty description, an
   *   object-rooted JSON schema and a resolver.
   * @returns This registry, for chaining.
   * @throws Error when the registry is already sealed.
   * @throws TypeError when the declaration is invalid or its id is already registered.
   */
  register<Result>(capability: ModelToolRegistration<Result>): this {
    if (this.sealed) throw new Error('Model capability registry is sealed');
    // Model arguments are always a JSON object, so a non-object root can never validate.
    const schema = capability.inputSchema?.jsonSchema;
    if (
      !capability.id?.trim() ||
      !capability.description?.trim() ||
      schema?.type !== 'object' ||
      (capability.resolve !== undefined && typeof capability.resolve !== 'function') ||
      (capability.active !== undefined &&
        typeof capability.active !== 'function' &&
        typeof capability.active !== 'boolean') ||
      this.definitionsById.has(capability.id)
    )
      throw new TypeError('Invalid or duplicate model capability');
    // Clone and freeze the schema, and pin `parse`, so the stored entry is independent of
    // the definition object the host may keep mutating.
    const inputSchema = snapshotSchemaAdapter(
      capability.inputSchema,
      'Model input parsers must be synchronous',
    );
    const resolver = capability.resolve?.bind(capability) ?? ((value: unknown) => value);
    const asIntent = bindIntent(
      snapshotIntent(
        typeof capability.asIntent === 'function'
          ? capability.asIntent.bind(capability)
          : capability.asIntent,
      ),
      capability,
    );
    const active =
      typeof capability.active === 'function'
        ? capability.active.bind(capability)
        : capability.active;
    // Bind once here: a later caller cannot substitute its own receiver for the resolver.
    const resolve = (value: unknown, context: Readonly<{ stageId: string }>) =>
      synchronous(resolver(value, context), 'Model capability resolvers must be synchronous');
    this.definitionsById.set(
      capability.id,
      Object.freeze({
        id: capability.id,
        description: capability.description,
        inputSchema,
        resolve,
        ...(asIntent !== undefined ? { asIntent } : {}),
        ...(active !== undefined ? { active } : {}),
      }),
    );
    return this;
  }

  /** Frozen snapshot of the registered definitions, in insertion order. */
  get definitions(): readonly Readonly<RegisteredModelTool>[] {
    return Object.freeze([...this.definitionsById.values()]);
  }
  /** Registered ids in declaration order. */
  ids(): readonly string[] {
    return Object.freeze([...this.definitionsById.keys()]);
  }
  /** Live iterator over `[id, definition]` pairs; it reflects only entries added before sealing. */
  entries(): IterableIterator<readonly [string, RegisteredModelTool]> {
    return this.definitionsById.entries();
  }
  /**
   * Register several tools.
   *
   * @param definitions Declarations applied in iteration order.
   * @returns This registry, for chaining.
   * @throws Error or TypeError under the same conditions as `register`.
   */
  registerAll(definitions: Iterable<ModelToolRegistration>): this {
    for (const definition of definitions) this.register(definition);
    return this;
  }
  /**
   * @param id Capability id.
   * @returns The registered definition.
   * @throws TypeError when the id is not registered, which usually means a stage projection
   *   omitted it.
   */
  require(id: string): RegisteredModelTool {
    const capability = this.get(id);
    if (!capability) throw new TypeError(`Unknown model capability: ${id}`);
    return capability;
  }
  /**
   * @param id Capability id.
   * @returns Whether the id is registered in this registry.
   */
  has(id: string): boolean {
    return this.definitionsById.has(id);
  }
  /**
   * @param id Capability id.
   * @returns The registered definition, or undefined when absent.
   */
  get(id: string): RegisteredModelTool | undefined {
    return this.definitionsById.get(id);
  }
  /** Live iterator over the registered definitions. */
  values(): IterableIterator<RegisteredModelTool> {
    return this.definitionsById.values();
  }
  /**
   * Close the registry to further registration.
   *
   * Sealing is idempotent and does not affect existing entries.
   *
   * @returns This registry.
   */
  seal(): this {
    this.sealed = true;
    return this;
  }

  /**
   * Derive a sealed sub-catalog for one stage.
   *
   * @param ids Capability ids available in the stage, in projection order. May be empty and must be free of duplicates.
   * @returns A new sealed registry that reuses the immutable entries of this registry.
   * @throws TypeError when the selection contains a duplicate id.
   * @throws Error when an id was never registered.
   */
  select(
    selection: readonly string[] | ModelToolSelection = {},
    context?: unknown,
  ): ModelToolRegistry {
    const options: ModelToolSelection = Array.isArray(selection)
      ? { ids: selection }
      : (selection as ModelToolSelection);
    if (options.intent !== undefined && typeof options.intent !== 'boolean')
      throw new TypeError('Invalid intent selection');
    const ids = options.ids ?? this.ids();
    const include = options.include ?? [];
    for (const list of [ids, include]) {
      if (!Array.isArray(list) || new Set(list).size !== list.length)
        throw new TypeError('Invalid tool selection');
      for (const id of list)
        if (!this.has(id)) throw new TypeError(`Tool is not registered: ${id}`);
    }
    const explicit = new Set(include);
    const selected = new ModelToolRegistry();
    for (const id of new Set([...ids, ...include])) {
      const tool = this.require(id);
      if (arguments.length > 1 ? !toolActive(tool.active, context) : tool.active === false)
        continue;
      const description = options.intent
        ? intentDescription(tool.asIntent, tool.description, context)
        : tool.description;
      if (description === undefined && !explicit.has(id)) continue;
      const entry = arguments.length > 1 ? this.bound(tool, context) : tool;
      selected.definitionsById.set(
        id,
        description !== undefined && description !== tool.description
          ? Object.freeze({ ...entry, description })
          : entry,
      );
    }
    return selected.seal();
  }

  /** Pin the host context and recheck activation before accepting a model proposal. */
  private bound(tool: RegisteredModelTool, context: unknown): RegisteredModelTool {
    return Object.freeze({
      ...tool,
      resolve: (input: unknown, stage: Readonly<{ stageId: string }>) => {
        if (!toolActive(tool.active, context)) modelProtocolError('Tool is inactive');
        return tool.resolve(input, stage);
      },
    });
  }

  /**
   * Parse model-supplied arguments and run the selected capability.
   *
   * @param selection Capability id plus the raw `input` object produced by the model. Other
   *   fields, such as the originating call, are not interpreted here.
   * @param context Stage identity handed to the resolver.
   * @returns The resolver output.
   * @throws ValidationError when the capability is unavailable in this registry or the input
   *   is not a plain object; parser and resolver failures propagate unchanged.
   */
  resolve(selection: ModelSelection, context: Readonly<{ stageId: string }>): unknown {
    const { stageId } = context;
    // Model output is untrusted: unknown ids and non-object arguments are protocol failures,
    // not ordinary `undefined` results.
    const capability =
      this.definitionsById.get(selection.toolId) ??
      modelProtocolError('Model capability is unavailable in this stage');
    if (capability.active === false) modelProtocolError('Tool is inactive');
    if (!selection.input || typeof selection.input !== 'object' || Array.isArray(selection.input))
      modelProtocolError('Model capability input must be an object');
    return synchronous(
      capability.resolve(capability.inputSchema.parse(selection.input), { stageId }),
      'Model capability parsers must be synchronous',
    );
  }
}

export type {
  AsIntent,
  IntentOptions,
  ToolCondition,
  ToolContext,
  ToolProposal,
  ModelTool,
  ModelToolRegistration,
  RegisteredModelTool,
  ModelSelection,
  ModelToolSource,
  ModelToolCatalog,
  ModelToolSelection,
} from '../structs/capabilities/model.js';

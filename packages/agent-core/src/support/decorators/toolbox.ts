/** Batch tool registration binds JSON schemas, parser methods and handlers to one real host. */
import type { ToolDefinition } from '../../structs/capabilities/tools.js';
import type { ModelTool } from '../../structs/capabilities/model.js';
import type { JsonSchema } from '../../structs/common.js';
import { fromJsonSchema } from '../schema.js';
import type { JsonSchemaOptions } from '../../structs/support/schema.js';
import type { SchemaAdapter } from '../../structs/common.js';
import { defineTool } from '../tools.js';
import { defineModelTools } from '../model/capabilities.js';
import { synchronous, maybeAssertion } from '../../utils/synchronous.js';
import { registerDefinitions } from './pool.js';
import { toolboxParsers, toolboxAuthorization } from './parsers.js';
import type { InstanceDecorationOptions } from './runtime.js';

/** Tool metadata; schemas and executable callbacks are declared by the host class instead. */
export type ToolboxEntry =
  | Omit<
      ToolDefinition<any, any, any>,
      'id' | 'inputSchema' | 'execute' | 'authorize' | 'parseOutput' | 'resolve'
    >
  | Omit<ModelTool<any, any, any>, 'id' | 'inputSchema' | 'resolve'>;

/** Only JSON Schema belongs in inputSchemas; parsers are attached to public methods. */
export interface Toolbox {
  readonly inputSchemas: Readonly<Record<string, JsonSchema>>;
}
type ToolboxMethods<Entries> = { [Key in keyof Entries]: (input: any, context: any) => unknown };

/** Bind one declaration without copying host state or weakening original tool boundaries. */
function definition(
  host: Toolbox,
  id: string,
  entry: ToolboxEntry,
  validated?: SchemaAdapter<unknown>,
) {
  const handler = (host as unknown as Record<string, unknown>)[id];
  if (!id.trim() || ['constructor', 'inputSchemas'].includes(id) || typeof handler !== 'function')
    throw new TypeError(`Missing toolbox method: ${id}`);
  if (
    !entry ||
    typeof entry !== 'object' ||
    ['id', 'inputSchema', 'execute', 'resolve', 'authorize', 'parseOutput'].some(
      (key) => key in entry,
    )
  )
    throw new TypeError('Toolbox options contain a host-owned field');
  if (!Object.hasOwn(host.inputSchemas, id))
    throw new TypeError(`Missing toolbox JSON Schema: ${id}`);
  const parsers = toolboxParsers(host).get(id);
  if (!parsers?.input && !validated)
    throw new TypeError(`Missing @ParseInput or schema compiler: ${id}`);
  const value: Record<string, any> = {
    ...entry,
    id,
    inputSchema: {
      jsonSchema: validated?.jsonSchema ?? host.inputSchemas[id],
      parse: (raw: unknown) => {
        const checked = validated ? validated.parse(raw) : raw;
        return parsers?.input ? parsers.input(checked) : checked;
      },
    },
  };
  for (const key of Object.keys(value))
    if (typeof value[key] === 'function') value[key] = value[key].bind(host);
  if ('kind' in entry) {
    const common = toolboxAuthorization(host);
    const own = parsers?.authorize;
    if (!common && !own) throw new TypeError(`Missing toolbox authorization: ${id}`);
    if (!parsers?.output) throw new TypeError(`Missing @ParseOutput: ${id}`);
    value.authorize = (input: unknown, context: any) => {
      context.signal.throwIfAborted();
      const next = () => {
        context.signal.throwIfAborted();
        return maybeAssertion(own?.(input, context), 'Tool authorization must return void');
      };
      const result = maybeAssertion(
        common?.(input, context),
        'Tool authorization must return void',
      );
      return result ? result.then(next) : next();
    };
    value.execute = handler.bind(host);
    value.parseOutput = parsers.output;
    return defineTool(value as unknown as ToolDefinition<any, any, any>);
  }
  if (parsers?.authorize)
    throw new TypeError(`Model-only toolbox methods cannot declare execution authorization: ${id}`);
  value.resolve = (input: unknown, context: Readonly<{ stageId: string }>) => {
    const result = synchronous(
      handler.call(host, input, context),
      'Model tool resolvers must be synchronous',
    );
    return parsers?.output
      ? synchronous(parsers.output(result), 'Tool output parsers must be synchronous')
      : result;
  };
  return defineModelTools([value as unknown as ModelTool]).require(id);
}

/** Construct one host, validate all declarations and parser targets, then publish atomically. */
export function toolbox<
  const Entries extends Readonly<Record<string, ToolboxEntry>>,
  const Args extends readonly unknown[] = readonly [],
>(
  entries: Entries,
  options: InstanceDecorationOptions<Args> & Partial<JsonSchemaOptions<unknown>> = {},
) {
  return <Constructor extends new (...args: Args) => Toolbox & ToolboxMethods<Entries>>(
    target: Constructor,
    context: ClassDecoratorContext<Constructor>,
  ): void => {
    if (context?.kind !== 'class') throw new TypeError('Use standard class decorator semantics');
    if (
      !entries ||
      typeof entries !== 'object' ||
      Array.isArray(entries) ||
      !Object.keys(entries).length
    )
      throw new TypeError('Toolbox requires nonempty tool options');
    if (options.args !== undefined && !Array.isArray(options.args))
      throw new TypeError('Decorator args must be an array');
    if (options.compile !== undefined && typeof options.compile !== 'function')
      throw new TypeError('Schema compile must be a function');
    if (options.error !== undefined && !options.compile)
      throw new TypeError('Schema error requires a compiler');
    const selected = Object.entries(entries);
    const args = [...(options.args ?? [])] as unknown as Args;
    context.addInitializer(function () {
      const host = new this(...args);
      if (
        !host.inputSchemas ||
        typeof host.inputSchemas !== 'object' ||
        Array.isArray(host.inputSchemas)
      )
        throw new TypeError('Toolbox requires inputSchemas');
      const ids = new Set(selected.map(([id]) => id));
      for (const id of Object.keys(host.inputSchemas))
        if (!ids.has(id)) throw new TypeError(`Unknown toolbox schema target: ${id}`);
      for (const id of toolboxParsers(host).keys())
        if (typeof id === 'string' && !ids.has(id))
          throw new TypeError(`Unknown toolbox parser target: ${id}`);
      const compiled = new Map<JsonSchema, SchemaAdapter<unknown>>();
      const definitions = selected.map(([id, entry]) => {
        const schema = host.inputSchemas[id];
        let validated = compiled.get(schema);
        if (options.compile && !validated && schema !== undefined) {
          validated = fromJsonSchema(schema, {
            compile: options.compile.bind(options),
            error: options.error?.bind(options),
          });
          compiled.set(schema, validated);
        }
        return definition(host, id, entry, validated);
      });
      registerDefinitions('tool', definitions, options.ns);
    });
  };
}

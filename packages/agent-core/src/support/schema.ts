/**
 * Schema adapter helpers: turn JSON Schema compilers and library parsers into Core adapters.
 *
 * Support supplies the adapter shape and snapshotting; the compiler, validator package and error
 * messages remain application choices. A plain JSON Schema without a typed compiler stays unknown
 * instead of being silently treated as permissive.
 *
 * Main exports: `fromJsonSchema`, `fromParserSchema` and `defineSchema`.
 */
import { snapshotSchemaAdapter } from '../utils/schema-adapter.js';
import { freezeSchema } from '../utils/object.js';
import { booleanResult, synchronous } from '../utils/synchronous.js';
import type { ModelToolSource } from '../structs/capabilities/model.js';
import { modelProtocolError } from '../utils/model-protocol.js';
import type { SchemaAdapter, JsonSchema } from '../structs/common.js';
import type { JsonSchemaOptions } from '../structs/support/schema.js';

/**
 * Build an adapter from a caller-owned typed JSON Schema compiler.
 *
 * The schema is cloned and frozen before it reaches the compiler, so later mutation of the input
 * cannot change validation. Compilation and validation must both be synchronous.
 *
 * @param schema JSON Schema describing the accepted value.
 * @param options Compiler plus an optional error factory for rejected values.
 * @returns A frozen adapter exposing `jsonSchema` and a `parse` that returns the input as `Value`.
 * @throws {TypeError} When the compiler is asynchronous or does not return a validator, or when no
 *   custom error applies; also when the validator is asynchronous or does not return a boolean.
 */
export function fromJsonSchema<Value = unknown>(
  schema: JsonSchema,
  options: JsonSchemaOptions<Value>,
): SchemaAdapter<Value> {
  const jsonSchema = structuredClone(schema);
  freezeSchema(jsonSchema);
  const validate = synchronous(options.compile(jsonSchema), 'Schema compilers must be synchronous');
  if (typeof validate !== 'function')
    throw new TypeError('Schema compilers must return a validator');
  const error = options.error?.bind(options);
  return snapshotSchemaAdapter({
    jsonSchema,
    parse(value: unknown): Value {
      const valid = booleanResult(
        validate(value),
        'Schema validators must be synchronous',
        'Schema validators must return boolean',
      );
      if (!valid)
        throw (
          synchronous(
            error?.(value, validate.errors),
            'Schema error factories must be synchronous',
          ) ?? new TypeError('Input does not match JSON Schema')
        );
      return value as Value;
    },
  });
}

/**
 * Wrap a library schema that already parses values (for example Zod or Valibot style).
 *
 * `parse` is delegated unchanged, so the library keeps ownership of coercion and error reporting;
 * only the JSON Schema projection is produced here.
 *
 * @param schema Object exposing a `parse` method.
 * @param options Converter that projects the schema into JSON Schema.
 * @returns A frozen adapter whose `parse` returns the wrapped parser's result type.
 * @throws {TypeError} When the JSON Schema conversion is asynchronous.
 */
export function fromParserSchema<Schema extends { parse(value: unknown): unknown }>(
  schema: Schema,
  options: { toJsonSchema(schema: Schema): JsonSchema },
): SchemaAdapter<ReturnType<Schema['parse']>> {
  return snapshotSchemaAdapter({
    jsonSchema: synchronous(options.toJsonSchema(schema), 'Schema conversion must be synchronous'),
    parse: schema.parse.bind(schema) as (value: unknown) => ReturnType<Schema['parse']>,
  });
}
/**
 * Re-snapshot an existing adapter without changing its behavior.
 *
 * Used to detach a caller-owned adapter from later mutation before it is exposed or reused.
 *
 * @param definition Adapter to copy.
 * @returns A frozen adapter with the same validation and parsing behavior.
 */
export function defineSchema<Value>(
  definition: SchemaAdapter<Value> & {
    /** Optional registered tools for a name/input envelope; no business parser is run here. */
    readonly tools?: Pick<ModelToolSource, 'values'>;
  },
): SchemaAdapter<Value> {
  if (!definition.tools) return snapshotSchemaAdapter(definition);
  const tools = [...definition.tools.values()];
  const ids = new Set(tools.map((tool) => tool.id));
  if (ids.size !== tools.length) throw new TypeError('Duplicate schema tool ids');
  const schema = definition.jsonSchema;
  if (schema.type !== 'object') throw new TypeError('A tool envelope requires an object schema');
  const parse = definition.parse.bind(definition);
  return snapshotSchemaAdapter({
    jsonSchema: {
      ...schema,
      required: [
        ...new Set([
          ...(Array.isArray(schema.required) ? (schema.required as string[]) : []),
          'name',
          'input',
        ]),
      ],
      properties: {
        ...(schema.properties as Record<string, unknown>),
        input: (schema.properties as Record<string, unknown> | undefined)?.input ?? {
          type: 'object',
        },
        name: { type: 'string', ...(ids.size ? { enum: [...ids] } : {}) },
      },
      ...(tools.length
        ? {
            anyOf: tools.map((tool) => ({
              properties: { name: { const: tool.id }, input: tool.inputSchema.jsonSchema },
            })),
          }
        : { not: {} }),
    },
    parse(value: unknown) {
      if (
        !value ||
        typeof value !== 'object' ||
        Array.isArray(value) ||
        !ids.has((value as { name: string }).name) ||
        !(value as { input: unknown }).input ||
        typeof (value as { input: unknown }).input !== 'object' ||
        Array.isArray((value as { input: unknown }).input)
      )
        modelProtocolError('Tool is unavailable in this prepared schema');
      return parse(value);
    },
  });
}
export type * from '../structs/support/schema.js';

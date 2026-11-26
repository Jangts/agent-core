/**
 * Presentation Kit: declarative output contracts for text, master, record and group outputs.
 *
 * Place in the package: part of the `presentation` Kit. A definition decides which fields the
 * model generates, which are bound to App providers, which are constants and which select a
 * semantic key; this module validates those declarations and composes the final value.
 *
 * Exports: `defineOutputCatalog`, and the output definition/field/provider/result types.
 */
import { nativeReportedStepSync } from '../../diagnostics/native-sub-flow.js';
import { snapshotSchemaAdapter } from '../../utils/schema-adapter.js';
import type { OperationContext } from '../../structs/common.js';
import { readonlyCatalog } from '../../utils/catalog.js';
import { synchronous } from '../../utils/synchronous.js';
import { defineTextTemplate } from './templates.js';
import { freezeSchema } from '../../utils/object.js';
import { observeSafely } from '../../utils/observer.js';
import type {
  OutputDefinition,
  OutputField,
  OutputProvider,
  OutputComposeInput,
  OutputIssue,
  OutputResult,
  OutputCatalogOptions,
} from '../../structs/kits/presentation/outputs.js';

function snapshotValue<T>(value: T): T {
  const copy = structuredClone(value);
  freezeSchema(copy);
  return copy;
}
const textValueSchema = snapshotSchemaAdapter({
  jsonSchema: { type: 'string' },
  parse(value: unknown) {
    if (typeof value !== 'string') throw new TypeError('Invalid output field value');
    return value;
  },
});
function parseField(field: OutputField, value: unknown): unknown {
  return field.valueSchema!.parse(value);
}
// Object-prototype names are excluded so a field id can never shadow `__proto__` or replace a
// prototype member when values are assembled into a dictionary.
const validId = (id: string) =>
  typeof id === 'string' &&
  /^[A-Za-z][A-Za-z0-9_.-]*$/.test(id) &&
  !['__proto__', 'constructor', 'prototype'].includes(id);

/**
 * Compile output definitions into one catalog.
 *
 * Compilation is where most mistakes surface: group membership is checked for cycles, master
 * templates must have exactly one slot per field, and every `bound`/`semantic` field must name
 * a registered provider. Composition then trusts the compiled catalog.
 *
 * @param definitions - Output definitions with unique ids and a supported `kind`.
 * @param options - Provider list and an optional observer for composed results.
 * @returns A frozen catalog extended with `toModelSchema`, `check` and `compose`.
 * @throws TypeError For an invalid id or kind, a malformed group, mismatched master slots,
 *   an invalid field owner or semantic keys, or an unknown provider id.
 */
export function defineOutputCatalog<App = unknown>(
  definitions: readonly OutputDefinition[],
  options: OutputCatalogOptions<App> = {},
) {
  const providers = options.providers ?? [],
    observe = options.observe?.bind(options);
  const providerMap = new Map<string, OutputProvider<App>>();
  for (const provider of providers) {
    const { id, resolve } = provider;
    if (!validId(id) || providerMap.has(id) || typeof resolve !== 'function')
      throw new TypeError('Invalid output provider');
    providerMap.set(id, Object.freeze({ id, resolve: resolve.bind(provider) }));
  }
  const catalog = new Map<string, OutputDefinition>();
  const masters = new Map<string, ReturnType<typeof defineTextTemplate>>();
  for (const definition of definitions) {
    const { id, kind, fields: fieldDefinitions, master, maxItems, allowedOutputIds } = definition;
    if (!validId(id) || catalog.has(id) || !['text', 'master', 'record', 'group'].includes(kind))
      throw new TypeError('Invalid output definition');
    const fields = fieldDefinitions?.map((field) => {
      const { id, owner, required, valueSchema, providerId, constantValue, semanticKeys } = field;
      return Object.freeze({
        id,
        owner,
        required,
        valueSchema:
          valueSchema === undefined ? textValueSchema : snapshotSchemaAdapter(valueSchema),
        providerId,
        constantValue: owner === 'constant' ? snapshotValue(constantValue) : undefined,
        semanticKeys: semanticKeys === undefined ? undefined : Object.freeze([...semanticKeys]),
      });
    });
    const entry = Object.freeze({
      id,
      kind,
      master,
      maxItems,
      fields: fields ? Object.freeze(fields) : undefined,
      allowedOutputIds:
        allowedOutputIds === undefined ? undefined : Object.freeze([...allowedOutputIds]),
    });
    if (entry.kind === 'group') {
      if (
        entry.fields?.length ||
        entry.master !== undefined ||
        !entry.allowedOutputIds?.length ||
        new Set(entry.allowedOutputIds).size !== entry.allowedOutputIds.length ||
        !Number.isSafeInteger(entry.maxItems) ||
        entry.maxItems! < 1
      )
        throw new TypeError('Invalid output group');
    } else {
      if (
        !fields?.length ||
        new Set(fields.map((field) => field.id)).size !== fields.length ||
        (entry.kind === 'text' && (fields.length !== 1 || fields[0].required === false))
      )
        throw new TypeError('Invalid output fields');
      for (const field of fields) {
        if (
          !validId(field.id) ||
          !['generated', 'bound', 'constant', 'semantic'].includes(field.owner)
        )
          throw new TypeError('Invalid output ownership');
        if (['bound', 'semantic'].includes(field.owner) && !providerMap.has(field.providerId!))
          throw new TypeError(`Unknown output provider: ${field.providerId}`);
        if (
          field.owner === 'semantic' &&
          (!field.semanticKeys?.length ||
            new Set(field.semanticKeys).size !== field.semanticKeys.length ||
            field.semanticKeys.some((key) => typeof key !== 'string' || !key))
        )
          throw new TypeError('Invalid semantic output keys');
      }
      if (entry.kind === 'master') {
        if (typeof entry.master !== 'string') throw new TypeError('Missing output master');
        const template = defineTextTemplate(entry.master);
        if (
          template.slots.length !== fields.length ||
          template.slots.some((id) => !fields.some((field) => field.id === id))
        )
          throw new TypeError('Output master fields do not match slots');
        masters.set(entry.id, template);
      }
    }
    catalog.set(entry.id, entry);
  }
  const get = (id: string) => {
    const entry = catalog.get(id);
    if (!entry) throw new TypeError(`Unknown output: ${id}`);
    return entry;
  };
  const visited = new Set<string>(),
    visiting = new Set<string>();
  function checkRefs(id: string) {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new TypeError('Cyclic output group');
    visiting.add(id);
    for (const child of get(id).allowedOutputIds ?? []) checkRefs(child);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of catalog.keys()) checkRefs(id);
  // Both callers reject groups before asking for their validated nonempty fields.
  const modelFields = (entry: OutputDefinition) =>
    entry.fields!.filter((field) => ['generated', 'semantic'].includes(field.owner));
  function toModelSchema(id: string) {
    const entry = get(id);
    if (entry.kind === 'group') throw new TypeError('Output groups require program-assigned items');
    const fields = modelFields(entry);
    return {
      type: 'object',
      properties: Object.fromEntries(
        fields.map((field) => [
          field.id,
          field.owner === 'semantic'
            ? { type: 'string', enum: [...field.semanticKeys!] }
            : field.valueSchema!.jsonSchema,
        ]),
      ),
      required: fields.filter((field) => field.required !== false).map((field) => field.id),
      additionalProperties: false,
    };
  }
  function inspect(id: string, value: unknown, signal?: AbortSignal) {
    signal?.throwIfAborted();
    const entry = get(id);
    if (entry.kind === 'group') throw new TypeError('Inspect individual group items');
    const issues: OutputIssue[] = [],
      values: Record<string, unknown> = Object.create(null);
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return {
        values,
        issues: [{ path: [id], code: 'OUTPUT_SHAPE', message: 'Expected an output object' }],
      };
    const input = value as Record<string, unknown>,
      fields = modelFields(entry);
    for (const key of Object.keys(input))
      if (!fields.some((field) => field.id === key))
        issues.push({
          path: [id, key],
          code: 'OUTPUT_FOREIGN_FIELD',
          message: 'Unknown generated field',
        });
    for (const field of fields) {
      signal?.throwIfAborted();
      if (!Object.hasOwn(input, field.id)) {
        if (field.required !== false)
          issues.push({
            path: [id, field.id],
            code: 'OUTPUT_MISSING',
            message: 'Required generated field is missing',
          });
        continue;
      }
      const value = input[field.id];
      signal?.throwIfAborted();
      try {
        if (field.owner === 'semantic') {
          if (typeof value !== 'string' || !field.semanticKeys!.includes(value))
            throw new TypeError('Unknown semantic key');
          values[field.id] = value;
        } else values[field.id] = parseField(field, value);
      } catch (error) {
        signal?.throwIfAborted();
        if (
          error &&
          typeof error === 'object' &&
          'name' in error &&
          ['AbortError', 'TimeoutError'].includes(String(error.name))
        )
          throw error;
        issues.push({
          path: [id, field.id],
          code: 'OUTPUT_VALUE',
          message: 'Generated field does not match its schema',
        });
      }
      signal?.throwIfAborted();
    }
    return { values, issues };
  }
  function composeInternal(
    id: string,
    input: OutputComposeInput,
    context: OperationContext<App>,
  ): OutputResult {
    context.signal.throwIfAborted();
    const entry = get(id),
      { generated, items } = input;
    context.signal.throwIfAborted();
    if (entry.kind === 'group') {
      if (
        Object.keys(generated ?? {}).length ||
        !Array.isArray(items) ||
        items.length > entry.maxItems!
      )
        throw new TypeError('Invalid output group items');
      const assigned = items.map((item: NonNullable<OutputComposeInput['items']>[number]) => ({
        id: item.id,
        outputId: item.outputId,
        input: item.input,
      }));
      if (new Set(assigned.map((item) => item.id)).size !== assigned.length)
        throw new TypeError('Invalid output group items');
      const value = assigned.map((item) => {
        context.signal.throwIfAborted();
        if (!validId(item.id) || !entry.allowedOutputIds!.includes(item.outputId))
          throw new TypeError('Invalid output group reference');
        return Object.freeze({
          id: item.id,
          ...composeInternal(item.outputId, item.input, context),
        });
      });
      context.signal.throwIfAborted();
      return Object.freeze({ outputId: id, kind: entry.kind, value: Object.freeze(value) });
    }
    const checked = inspect(id, generated ?? {}, context.signal);
    context.signal.throwIfAborted();
    if (checked.issues.length)
      throw Object.assign(new TypeError('Output contract rejected generated fields'), {
        issues: checked.issues,
      });
    const values: Record<string, unknown> = Object.create(null);
    for (const field of entry.fields!) {
      context.signal.throwIfAborted();
      if (
        ['generated', 'semantic'].includes(field.owner) &&
        !Object.hasOwn(checked.values, field.id) &&
        field.required === false
      ) {
        if (entry.kind === 'master') values[field.id] = '';
        continue;
      }
      const value =
        field.owner === 'constant'
          ? field.constantValue
          : ['bound', 'semantic'].includes(field.owner)
            ? synchronous(
                providerMap.get(field.providerId!)!.resolve(
                  {
                    key:
                      field.owner === 'semantic' ? (checked.values[field.id] as string) : undefined,
                  },
                  context,
                ),
                'Output providers must be synchronous',
              )
            : checked.values[field.id];
      context.signal.throwIfAborted();
      if (value === undefined && field.required === false) {
        if (entry.kind === 'master') values[field.id] = '';
        continue;
      }
      values[field.id] = field.owner === 'generated' ? value : parseField(field, value);
      context.signal.throwIfAborted();
    }
    const value =
      entry.kind === 'master'
        ? masters.get(id)!.render(values as Record<string, string>)
        : entry.kind === 'text'
          ? values[entry.fields![0].id]
          : Object.freeze(values);
    if ((entry.kind === 'text' || entry.kind === 'master') && typeof value !== 'string')
      throw new TypeError('Text output requires a string value');
    const result = Object.freeze({ outputId: id, kind: entry.kind, value });
    context.signal.throwIfAborted();
    observeSafely(observe, result);
    return result;
  }
  return Object.freeze({
    ...readonlyCatalog(catalog.values(), (id) => new TypeError(`Unknown output: ${id}`)),
    /** JSON schema of the fields a model must generate for this output. */
    toModelSchema,
    /**
     * Validate a generated value without composing it.
     *
     * @param request - Output id and the candidate value.
     * @returns `passed` or `failed` with the collected issues and accepted values.
     */
    check(request: { outputId: string; value: unknown }) {
      const result = inspect(request.outputId, request.value);
      return {
        status: result.issues.length ? ('failed' as const) : ('passed' as const),
        value: result.values,
        issues: result.issues,
      };
    },
    /**
     * Compose the final output value from generated fields, providers and constants.
     *
     * @param request - Output id and the generated/group input.
     * @param context - Operation context; cancellation is checked between every step.
     * @returns The frozen composed result, also forwarded to the observer.
     * @throws TypeError For a malformed request, missing context, rejected generated fields
     *   (carrying `issues`), a non-synchronous provider, or a text output that is not a string.
     */
    compose(
      request: { outputId: string; input: OutputComposeInput },
      context: OperationContext<App>,
    ) {
      if (!request || typeof request !== 'object')
        throw new TypeError('Use a named output request');
      if (!context?.signal) throw new TypeError('Output composition requires OperationContext');
      return nativeReportedStepSync(context, 'output', request.outputId, () =>
        composeInternal(request.outputId, request.input, context),
      );
    },
  });
}
export type {
  OutputDefinition,
  OutputField,
  OutputProvider,
  OutputComposeInput,
  OutputIssue,
  OutputResult,
  OutputCatalogOptions,
} from '../../structs/kits/presentation/outputs.js';

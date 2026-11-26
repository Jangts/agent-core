/**
 * Interaction Kit: compile a single command protocol from field declarations.
 *
 * Place in the package: part of the `interaction` Kit. Parsing is synchronous and never
 * executes a registered tool; it only validates the shape and applies an optional formatter.
 *
 * Exports: `defineCommand`, `compileCommands`, `commandSchema`, and the protocol types.
 */
import { pinCommandDefinition } from '../../utils/interaction-definition.js';
import type {
  Command,
  CommandDefinition,
  ProtocolCheck,
  ProtocolField,
  ProtocolReason,
  ProtocolShape,
} from '../../structs/kits/interaction.js';
import { assertion, booleanResult, synchronous } from '../../utils/synchronous.js';
import { freezeSchema } from '../../utils/object.js';
import { breakWhile } from '../../utils/rules.js';
import { INTERACTION_CATEGORIES } from '../../structs/kits/interaction.js';

function reason<Value, Args extends unknown[]>(
  error: ProtocolReason<Value, Args> | undefined,
  value: Value,
  args: Args,
) {
  return () =>
    typeof error === 'function'
      ? error(value, ...args)
      : (error ?? new TypeError('Invalid protocol value'));
}

/**
 * Compile declarations once. Parsing is synchronous and never executes a registered tool.
 *
 * Two schemas are produced from one declaration: `modelJsonSchema` marks only fields the model
 * must fill, while `inputJsonSchema` marks every required field. A discriminator, when present,
 * is prepended as a required constant field.
 *
 * @param definition - Fields, discriminator, checks, tags, error wording and optional
 *   formatter; predicates and formatters are bound to this object.
 * @returns A frozen command with `keys`, `assert`, `parse` and the three schemas.
 * @throws TypeError For an unknown category, a duplicate field or discriminator field, a check
 *   that still uses the retired `condition`/`conditions` names, or a non-synchronous predicate.
 */
export function defineCommand<
  Value extends object = Record<string, unknown>,
  Result = Value,
  Args extends unknown[] = [],
>(definition: CommandDefinition<Value, Result, Args>): Command<Value, Result, Args> {
  breakWhile(
    definition.category !== undefined && !INTERACTION_CATEGORIES.includes(definition.category),
    'Invalid interaction category',
  );
  const fields: Record<string, ProtocolField> = Object.fromEntries(
    Object.entries(fieldDefinitions(definition.fields)).map(([name, field]) => [
      name,
      {
        jsonSchema: field.jsonSchema === undefined ? undefined : structuredClone(field.jsonSchema),
        required: field.required,
        modelRequired: field.modelRequired,
        owned: field.owned,
      },
    ]),
  );
  for (const name of definition.ownedFields ?? []) {
    if (!Object.hasOwn(fields, name))
      Object.defineProperty(fields, name, { value: {}, enumerable: true });
  }
  const discriminator = definition.discriminator && {
    field: definition.discriminator.field,
    value: definition.discriminator.value,
  };
  breakWhile(
    discriminator && Object.hasOwn(fields, discriminator.field),
    'Duplicate protocol discriminator field',
  );
  const entries: [string, ProtocolField][] = [
    ...(discriminator
      ? [
          [
            discriminator.field,
            { required: true, jsonSchema: { type: 'string', enum: [discriminator.value] } },
          ] as [string, ProtocolField],
        ]
      : []),
    ...Object.entries(fields),
  ];
  const checks: readonly ProtocolCheck<Value, Args>[] = (definition.checks ?? []).map((check) => {
    if (!check || check.occur === undefined || 'condition' in check || 'conditions' in check)
      throw new TypeError('Protocol checks require occur');
    const bind = (predicate: ProtocolCheck<Value, Args>['when']) => predicate?.bind(check);
    if (
      typeof check.occur !== 'function' &&
      (!Array.isArray(check.occur) ||
        check.occur.some((predicate) => typeof predicate !== 'function'))
    )
      throw new TypeError('Protocol occur requires a predicate or predicate array');
    return Object.freeze({
      occur:
        typeof check.occur === 'function'
          ? check.occur.bind(check)
          : Object.freeze(check.occur.map((predicate) => predicate.bind(check))),
      when: bind(check.when),
      error: typeof check.error === 'function' ? check.error.bind(check) : check.error,
      tags: Object.freeze([...(check.tags ?? [])]),
    });
  });
  const tags = [...(definition.tags ?? [])];
  const additionalProperties = definition.additionalProperties ?? false;
  const optionalPresence = definition.optionalPresence ?? 'own';
  const error =
    typeof definition.error === 'function' ? definition.error.bind(definition) : definition.error;
  const refine = definition.refine?.bind(definition),
    format = definition.format?.bind(definition);
  const parameters = Object.fromEntries(
    Object.entries(fields).map(([name, field]) => [name, field.jsonSchema ?? {}]),
  );
  const schema = {
    type: 'object',
    properties: Object.fromEntries(entries.map(([name, field]) => [name, field.jsonSchema ?? {}])),
    required: entries
      .filter(([, field]) => field.required && field.modelRequired !== false)
      .map(([name]) => name),
    additionalProperties,
  };
  const inputJsonSchema = {
    ...schema,
    required: entries.filter(([, field]) => field.required).map(([name]) => name),
  };
  freezeSchema(inputJsonSchema);
  freezeSchema(fields);
  freezeSchema(parameters);
  freezeSchema(schema);

  const keys = (value: Record<string, unknown>) =>
    entries
      .filter(
        ([name, field]) =>
          field.required ||
          (optionalPresence === 'defined' ? value[name] !== undefined : Object.hasOwn(value, name)),
      )
      .map(([name]) => name);
  const validate = (value: Value, ...args: Args): void => {
    const fail = reason(error, value, args);
    breakWhile(!value || typeof value !== 'object' || Array.isArray(value), fail, tags);
    const record = value as Record<string, unknown>;
    const expected = keys(record);
    breakWhile(
      [
        {
          occur: () => expected.some((name) => !Object.hasOwn(record, name)),
          error: fail,
          tags: ['required-fields'],
        },
        {
          occur: () =>
            !additionalProperties && Object.keys(record).some((name) => !expected.includes(name)),
          error: fail,
          tags: ['unknown-fields'],
        },
        {
          occur: () => discriminator && record[discriminator.field] !== discriminator.value,
          error: fail,
          tags: ['discriminator'],
        },
        ...checks.map((check) => ({
          occur: () => {
            if (
              check.when &&
              !booleanResult(
                check.when(value, ...args),
                'Protocol when predicates must return boolean synchronously',
              )
            )
              return false;
            return typeof check.occur === 'function'
              ? synchronous(
                  check.occur(value, ...args),
                  'Protocol occur predicates must be synchronous',
                )
              : check.occur.some((occur) =>
                  synchronous(
                    occur(value, ...args),
                    'Protocol occur predicates must be synchronous',
                  ),
                );
          },
          error: reason(check.error ?? error, value, args),
          tags: check.tags,
        })),
      ],
      tags,
    );
    assertion(refine?.(value, ...args), 'Protocol refinements must return void synchronously');
  };
  return Object.freeze({
    ...(definition.category !== undefined ? { category: definition.category } : {}),
    ...(definition.version !== undefined ? { version: definition.version } : {}),
    ...(definition.description !== undefined ? { description: definition.description } : {}),
    ...(definition.terminal !== undefined ? { terminal: definition.terminal } : {}),
    fieldSchemas: parameters,
    modelJsonSchema: schema,
    inputJsonSchema,
    keys,
    assert: validate,
    modes: definition.modes && Object.freeze([...definition.modes]),
    ownedFields: Object.freeze([
      ...new Set([
        ...(definition.ownedFields ?? []),
        ...Object.entries(fields)
          .filter(([, field]) => field.owned)
          .map(([name]) => name),
      ]),
    ]),
    parse(value: Value, ...args: Args): Result {
      validate(value, ...args);
      return format
        ? synchronous(format(value, ...args), 'Protocol formatters must be synchronous')
        : (value as unknown as Result);
    },
  });
}

function fieldDefinitions(
  fields: CommandDefinition<object>['fields'],
): Record<string, ProtocolField> {
  if (!Array.isArray(fields)) return fields as Record<string, ProtocolField>;
  breakWhile(new Set(fields).size !== fields.length, 'Duplicate protocol field');
  return Object.fromEntries(fields.map((name) => [name, {}]));
}

/**
 * Compile a whole catalog with shared envelope fields.
 *
 * Applications declare only their own data and handlers. Defaults are merged in this order:
 * unrelated default keys, then the command's own keys, with `fields`, `checks` and `tags`
 * concatenated so shared envelope checks always run before per-command checks.
 *
 * @param definitions - Commands keyed by their wire id.
 * @param defaults - Shared envelope definition; its discriminator field is removed per command.
 * @returns A frozen record from id to compiled command.
 * @throws TypeError From `defineCommand` for the first invalid declaration.
 */
export function compileCommands<
  Value extends object,
  Result = Value,
  Args extends unknown[] = [],
  Id extends string = string,
>(
  definitions: Readonly<Record<Id, CommandDefinition<Value, Result, Args>>>,
  defaults: Partial<CommandDefinition<Value, Result, Args>> = {},
): Readonly<Record<Id, Command<Value, Result, Args>>> {
  defaults = pinCommandDefinition(defaults);
  return Object.freeze(
    Object.fromEntries(
      Object.entries(definitions).map(([id, value]) => {
        const definition = pinCommandDefinition(value as CommandDefinition<Value, Result, Args>);
        const envelopeFields = { ...fieldDefinitions(defaults.fields ?? {}) };
        if (definition.discriminator) delete envelopeFields[definition.discriminator.field];
        return [
          id,
          defineCommand({
            ...defaults,
            ...definition,
            fields: { ...envelopeFields, ...fieldDefinitions(definition.fields!) },
            checks: [...(defaults.checks ?? []), ...(definition.checks ?? [])],
            tags: [...(defaults.tags ?? []), ...(definition.tags ?? [])],
          }),
        ];
      }),
    ),
  ) as Readonly<Record<Id, Command<Value, Result, Args>>>;
}

/**
 * Build a JSON schema for one command id.
 *
 * Prefer compiled schemas; retain the existing open-schema contract for dynamic host protocols.
 * A protocol without `fieldSchemas` falls back to an open object that only pins the
 * discriminator, which keeps legacy hosts working without weakening compiled ones.
 *
 * @param id - Command id used as the discriminator value.
 * @param protocol - Compiled command, or a shape carrying only `fieldSchemas`/`keys`.
 * @param discriminator - Field name carrying the command id; defaults to `type`.
 * @returns The compiled model schema, or a generated open schema.
 */
export function commandSchema(
  id: string,
  protocol: ProtocolShape,
  discriminator = 'type',
): Record<string, unknown> {
  if (protocol.modelJsonSchema) return protocol.modelJsonSchema;
  return {
    type: 'object',
    properties: { [discriminator]: { type: 'string', enum: [id] }, ...protocol.fieldSchemas },
    required: protocol.fieldSchemas ? protocol.keys({ [discriminator]: id }) : [discriminator],
    additionalProperties: !protocol.fieldSchemas,
  };
}

export type {
  Command,
  CommandDefinition,
  ProtocolCheck,
  ProtocolField,
  ProtocolReason,
  ProtocolPredicate,
  ProtocolShape,
  RegisteredProtocol,
} from '../../structs/kits/interaction.js';

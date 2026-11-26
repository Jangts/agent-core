/**
 * Interaction Kit: the web/AI payload family with selector normalization.
 *
 * Place in the package: part of the `interaction` Kit and its main entry. HTTP/SSE framing and
 * the actual command execution remain separate ports; this class only validates the envelope,
 * accepts selector aliases and delegates parsing to the sealed command catalog.
 *
 * Exports: `InteractionProtocol`, `defineInteractionProtocol`, and its definition type.
 */
import { pinCommandDefinition } from '../../utils/interaction-definition.js';
import type {
  ProtocolReason,
  CommandDefinition,
  InteractionProtocolDefinition,
} from '../../structs/kits/interaction.js';
import { breakWhile } from '../../utils/rules.js';
import { defineCommandCatalog, CommandCatalog } from './commands.js';
import { defineCommand, commandSchema } from './command.js';
import { bindInteraction } from './handlers.js';
import { INTERACTION_CATEGORIES } from '../../structs/kits/interaction.js';

/**
 * Web/AI payload family. HTTP/SSE framing and actual command execution remain separate ports.
 *
 * Every command registered here gets the envelope's discriminator forced to its own id, so a
 * payload cannot claim one command while carrying another command's data.
 */
export class InteractionProtocol<
  Value extends object = Record<string, unknown>,
  Result = Value,
  Args extends unknown[] = [],
  Id extends string = string,
> {
  static readonly define: typeof defineInteractionProtocol = defineInteractionProtocol;
  static readonly Commands = CommandCatalog;
  static readonly defineCommand = defineCommand;
  static readonly commandSchema = commandSchema;
  static readonly bind = bindInteraction;
  static readonly categories = INTERACTION_CATEGORIES;

  /** Field carrying the command id in a payload. */
  readonly commandField: string;
  /** Accepted selector names: the command field first, then any declared aliases. */
  readonly commandSelectors: readonly string[];
  /** Sealed catalog of the compiled commands. */
  readonly commands: CommandCatalog<Value, Result, Args, Id>;
  private readonly selectionError?: ProtocolReason<Value, Args>;

  /**
   * @param definition - Command definitions plus envelope, selector aliases and error wording.
   * @throws An error for a blank or duplicate selector, a conflicting per-command discriminator
   *   (it must match the envelope field and the command's own id).
   */
  constructor(definition: InteractionProtocolDefinition<Value, Result, Args, Id>) {
    const {
      commands,
      commandField,
      commandAliases,
      modeField,
      unknownError,
      modeError,
      ownershipError,
    } = definition;
    const {
      discriminator: _discriminator,
      modes: _modes,
      ownedFields: _ownedFields,
      ...envelope
    } = pinCommandDefinition(definition);
    const selectionError =
      typeof definition.selectionError === 'function'
        ? definition.selectionError.bind(definition)
        : definition.selectionError;
    breakWhile(!commandField.trim(), 'Missing transfer command field');
    this.commandField = commandField;
    this.commandSelectors = Object.freeze([commandField, ...(commandAliases ?? [])]);
    breakWhile([
      {
        occur: () => this.commandSelectors.some((field) => !field.trim()),
        error: 'Missing transfer selector',
      },
      {
        occur: () => new Set(this.commandSelectors).size !== this.commandSelectors.length,
        error: 'Duplicate transfer selector',
      },
    ]);
    this.selectionError = selectionError;
    const registered = Object.fromEntries(
      Object.entries(commands).map(([id, value]) => {
        const command = pinCommandDefinition(value as CommandDefinition<Value, Result, Args>);
        breakWhile(
          command.discriminator &&
            (command.discriminator.field !== commandField || command.discriminator.value !== id),
          'Conflicting transfer command discriminator',
        );
        return [id, { ...command, discriminator: { field: commandField, value: id } }];
      }),
    ) as Readonly<Record<Id, CommandDefinition<Value, Result, Args>>>;
    this.commands = defineCommandCatalog(registered, envelope, {
      modeField,
      unknownError,
      modeError,
      ownershipError,
      tags: envelope.tags,
    });
  }

  /** JSON schema for the model, expressed as a union of the per-command schemas. */
  get modelJsonSchema(): Record<string, unknown> {
    return { anyOf: [...this.commands.values()].map((command) => command.modelJsonSchema) };
  }

  /** Strict JSON schema for transport input, expressed as a union of per-command schemas. */
  get inputJsonSchema(): Record<string, unknown> {
    return { anyOf: [...this.commands.values()].map((command) => command.inputJsonSchema) };
  }

  /**
   * Parse a payload and return only the result.
   *
   * @param value - Raw payload.
   * @param args - Extra arguments forwarded to the command parser.
   * @throws The same errors as `receive`.
   */
  parse(value: Value, ...args: Args): Result {
    return this.receive(value, ...args).result;
  }

  /**
   * Retain the selected command id separately from a formatter's output.
   *
   * @param value - Raw payload; aliases are normalized when more than one selector is allowed.
   * @param args - Extra arguments forwarded to the command parser.
   * @returns The selected command id and its parsed result.
   * @throws A configured error for a malformed or ambiguous selector, or the catalog's
   *   command/mode/ownership errors.
   */
  receive(value: Value, ...args: Args): { id: Id; result: Result } {
    const normalized = this.normalizeSelector(value, args);
    const id = (normalized as Record<string, unknown>)[this.commandField] as Id;
    return { id, result: this.commands.parse(id, normalized, ...args) };
  }

  private normalizeSelector(value: Value, args: Args): Value {
    // Preserve the original no-alias parsing path; alias handling is an explicit host choice.
    if (this.commandSelectors.length === 1) return value;
    const fail = () =>
      typeof this.selectionError === 'function'
        ? this.selectionError(value, ...args)
        : (this.selectionError ?? new TypeError('Invalid transfer selector'));
    breakWhile(!value || typeof value !== 'object' || Array.isArray(value), fail);
    const record = value as Record<string, unknown>;
    const selectors = this.commandSelectors.filter((field) => Object.hasOwn(record, field));
    breakWhile([
      { occur: () => selectors.length !== 1, error: fail, tags: ['selector-count'] },
      {
        occur: () => typeof record[selectors[0]] !== 'string',
        error: fail,
        tags: ['selector-value'],
      },
    ]);
    const normalized = { ...record, [this.commandField]: record[selectors[0]] };
    if (selectors[0] !== this.commandField) delete normalized[selectors[0]];
    return normalized as Value;
  }
}

/**
 * Construct a protocol from one definition.
 *
 * @param definition - Commands, envelope and selector configuration.
 * @returns A new protocol instance.
 * @throws The same errors as the constructor.
 */
export function defineInteractionProtocol<
  Value extends object = Record<string, unknown>,
  Result = Value,
  Args extends unknown[] = [],
  Id extends string = string,
>(
  definition: InteractionProtocolDefinition<Value, Result, Args, Id>,
): InteractionProtocol<Value, Result, Args, Id> {
  return new InteractionProtocol(definition);
}

export type { InteractionProtocolDefinition } from '../../structs/kits/interaction.js';

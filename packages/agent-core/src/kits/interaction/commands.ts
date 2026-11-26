/**
 * Interaction Kit: the sealed command catalog shared by every receiving host.
 *
 * Place in the package: part of the `interaction` Kit. It owns mode checks and cross-protocol
 * field-ownership checks that every host must apply identically; the commands themselves are
 * compiled elsewhere.
 *
 * Exports: `CommandCatalog`, `defineCommandCatalog`, and `CommandCatalogOptions`.
 */
import type {
  Command,
  CommandDefinition,
  CommandCatalogOptions,
  InteractionCategory,
  InteractionDescriptor,
} from '../../structs/kits/interaction.js';
import { breakWhile } from '../../utils/rules.js';
import { ProtocolRegistry } from '../../utils/protocol-registry.js';
import { compileCommands } from './command.js';

/**
 * Mode and cross-protocol field ownership checks are shared by all receiving hosts.
 *
 * The catalog seals itself as soon as construction finishes, so a run cannot register a new
 * command later; `set` remains available only for the superclass installation pass.
 */
export class CommandCatalog<
  Value extends object = Record<string, unknown>,
  Result = Value,
  Args extends unknown[] = [],
  Id extends string = string,
> extends ProtocolRegistry<Command<Value, Result, Args> & { readonly id: Id }> {
  /** Compile and construct a catalog from definitions in one call. */
  static readonly define: typeof defineCommandCatalog = defineCommandCatalog;
  /** Compile a set of definitions with shared envelope fields. */
  static readonly compile = compileCommands;

  private sealed = false;
  private readonly options: Readonly<CommandCatalogOptions & { tags: readonly string[] }>;

  /**
   * @param definitions - Compiled `[id, command]` pairs, installed in iteration order.
   * @param options - Mode field, error wording and diagnostic tags used by `parse`.
   */
  constructor(
    definitions: Iterable<readonly [Id, Command<Value, Result, Args>]>,
    options: CommandCatalogOptions = {},
  ) {
    // Map installation calls this class's set, which normalizes each registered identity.
    super(
      definitions as Iterable<readonly [Id, Command<Value, Result, Args> & { readonly id: Id }]>,
    );
    this.options = Object.freeze({ ...options, tags: Object.freeze([...(options.tags ?? [])]) });
    this.sealed = true;
  }
  /**
   * Install one compiled command during construction.
   *
   * @throws Error When the id already exists or construction has finished.
   */
  override set(id: string, command: Command<Value, Result, Args>): this {
    if (this.has(id)) throw new Error(`Duplicate protocol: ${id}`);
    if (this.sealed) throw new Error('Command catalog is sealed');
    return super.set(
      id,
      Object.freeze({
        ...command,
        id: id as Id,
        fieldSchemas: command.fieldSchemas,
        modelJsonSchema: command.modelJsonSchema,
        inputJsonSchema: command.inputJsonSchema,
        category: command.category,
        version: command.version,
        description: command.description,
        terminal: command.terminal,
        modes: command.modes && Object.freeze([...command.modes]),
        ownedFields: Object.freeze([...command.ownedFields]),
        keys: command.keys.bind(command),
        assert: command.assert.bind(command),
        parse: command.parse.bind(command),
      }),
    );
  }
  /**
   * Removal is not supported.
   *
   * @throws Error Always, because the catalog is sealed.
   */
  override delete(_id: string): boolean {
    throw new Error('Command catalog is sealed');
  }
  /**
   * Clearing is not supported.
   *
   * @throws Error Always, because the catalog is sealed.
   */
  override clear(): void {
    throw new Error('Command catalog is sealed');
  }

  /** Compiled commands in registration order. */
  get definitions(): readonly Readonly<Command<Value, Result, Args> & { id: Id }>[] {
    return Object.freeze([...this.values()]);
  }
  /** Explicit dictionary projection; definitions always remains an ordered array. */
  toRecord(): Readonly<Record<Id, Command<Value, Result, Args>>> {
    return Object.freeze(Object.fromEntries(this)) as unknown as Readonly<
      Record<Id, Command<Value, Result, Args>>
    >;
  }

  /**
   * The same declarations drive purpose-specific menus, documentation and handler binding.
   *
   * @param category - Restrict to one interaction category; omit for every command.
   * @returns Plain descriptors in registration order, without schemas or handlers.
   */
  manifest(category?: InteractionCategory): readonly InteractionDescriptor[] {
    return Object.freeze(
      [...this]
        .filter(([, command]) => category === undefined || command.category === category)
        .map(([id, { category, description, terminal, modes }]) =>
          Object.freeze({ id, category, description, terminal, modes }),
        ),
    );
  }

  /**
   * Validate and parse one payload as the named command.
   *
   * Checks run before the command's own parser: the id must exist, the mode (when configured)
   * must be allowed, and no other command may claim a field that this payload sets. The last
   * rule prevents one command from silently consuming another command's data.
   *
   * @param id - Command id selected by the caller.
   * @param value - Raw payload.
   * @param args - Extra arguments forwarded to the command parser.
   * @returns The parsed result for that command.
   * @throws A configured error for an unknown command, a disallowed mode or a field owned by
   *   another command; the command's own error for a shape violation.
   */
  parse(id: string, value: Value, ...args: Args): Result {
    const protocol = this.get(id);
    breakWhile(!protocol, this.options.unknownError ?? 'Unknown command', [
      ...this.options.tags,
      'command-selection',
    ]);
    const record = value as Record<string, unknown>;
    const modeField = this.options.modeField;
    breakWhile(
      modeField && !protocol!.modes?.includes(record?.[modeField] as string),
      this.options.modeError ?? 'Unsupported command mode',
      [...this.options.tags, 'command-mode'],
    );
    const ownershipTags = [...this.options.tags, 'field-ownership'];
    for (const [owner, other] of this) {
      breakWhile(
        owner !== id && other.ownedFields.some((field) => record?.[field] !== undefined),
        this.options.ownershipError ?? 'Field belongs to another command',
        ownershipTags,
      );
    }
    return protocol!.parse(value, ...args);
  }
}

/**
 * Compile definitions and wrap them in a sealed catalog.
 *
 * @param definitions - Command definitions keyed by wire id.
 * @param defaults - Shared envelope definition merged into every command.
 * @param options - Mode field, error wording and diagnostic tags.
 * @returns A sealed catalog ready for `manifest`, `parse` and handler binding.
 * @throws TypeError From compilation for the first invalid definition.
 */
export function defineCommandCatalog<
  Value extends object,
  Result = Value,
  Args extends unknown[] = [],
  Id extends string = string,
>(
  definitions: Readonly<Record<Id, CommandDefinition<Value, Result, Args>>>,
  defaults: Partial<CommandDefinition<Value, Result, Args>> = {},
  options: CommandCatalogOptions = {},
): CommandCatalog<Value, Result, Args, Id> {
  const compiled = compileCommands(definitions, defaults);
  return new CommandCatalog<Value, Result, Args, Id>(
    Object.entries(compiled) as [Id, Command<Value, Result, Args>][],
    options,
  );
}

export type { CommandCatalogOptions } from '../../structs/kits/interaction.js';

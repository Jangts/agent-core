/**
 * Interaction protocol contract: the validated payload family exchanged with a client.
 *
 * Place in the package: an optional App-side library for command-shaped values. A declaration
 * produces both the model-visible schema and the runtime input schema from one field list, so
 * validation, routing and documentation cannot drift. HTTP/SSE framing and command execution stay
 * in separate ports; nothing here executes a registered tool.
 *
 * Exports: `ProtocolField`, `InteractionCategory`, `INTERACTION_CATEGORIES`,
 * `InteractionDescriptor`, `InteractionHandlers`, `ProtocolReason`, `ProtocolPredicate`,
 * `ProtocolCheck`, `CommandDefinition`, `Command`, `CommandCatalogOptions`,
 * `InteractionProtocolDefinition`, `ProtocolShape`, `RegisteredProtocol`.
 */
/** Field presence, schema and ownership are declared together; schemas describe model input. */
export interface ProtocolField {
  /** Property schema; missing means the provider accepts any value. */
  readonly jsonSchema?: Readonly<Record<string, unknown>>;
  /** Required on input; such a field may be optional for the model. */
  readonly required?: boolean;
  /** Required from the model; such a field may be optional on input. */
  readonly modelRequired?: boolean;
  /** Written by the program, never supplied by the model. */
  readonly owned?: boolean;
}

/** Interaction purpose, never an authorization level or an assertion of execution success. */
export type InteractionCategory = 'query' | 'action' | 'presentation' | 'input' | 'receipt';
/** Frozen list of accepted categories, used for validation and enumeration. */
export const INTERACTION_CATEGORIES: readonly InteractionCategory[] = Object.freeze([
  'query',
  'action',
  'presentation',
  'input',
  'receipt',
]);

/** Catalog metadata for one command, independent of its field shape. */
export interface InteractionDescriptor {
  readonly id: string;
  /** Declared purpose; validated against the frozen category list. */
  readonly category?: InteractionCategory;
  readonly description?: string;
  /** Marks a command that ends the interaction. */
  readonly terminal?: boolean;
  /** App-declared modes in which the command is available. */
  readonly modes?: readonly string[];
}

/** Handler map keyed by command id; each handler receives the parsed value and App context. */
export type InteractionHandlers<Id extends string, Value, Context, Output> = Readonly<
  Record<Id, (value: Value, context: Context) => Output>
>;

/** Lazy rejection wording: a fixed message, a pre-built error, or a factory bound to the value. */
export type ProtocolReason<Value, Args extends unknown[]> =
  Error | string | ((value: Value, ...args: Args) => Error | string);
/** Predicate evaluated during validation; any truthy result counts as a failure. */
export type ProtocolPredicate<Value, Args extends unknown[]> = (
  value: Value,
  ...args: Args
) => unknown;

/** One declarative rejection rule. */
export interface ProtocolCheck<Value, Args extends unknown[]> {
  /** Runs the check only when it returns true; must be synchronous. */
  readonly when?: (value: Value, ...args: Args) => boolean;
  /** Failing predicate or ordered OR-list; evaluation stops at the first failure. */
  readonly occur: ProtocolPredicate<Value, Args> | readonly ProtocolPredicate<Value, Args>[];
  /** Rejection wording; omitted means a default `TypeError`. */
  readonly error?: ProtocolReason<Value, Args>;
  /** Diagnostic tags attached to the rejection. */
  readonly tags?: readonly string[];
}

/** Declarative command shape before compilation. */
export interface CommandDefinition<
  Value extends object,
  Result = Value,
  Args extends unknown[] = [],
> {
  /** Declared purpose; validated against the frozen category list. */
  readonly category?: InteractionCategory;
  /** Protocol version, used to reject incompatible registrations. */
  readonly version?: number;
  readonly description?: string;
  /** Marks a command that ends the interaction. */
  readonly terminal?: boolean;
  /** Constant field identifying the command; its value is forced to the command id. */
  readonly discriminator?: { readonly field: string; readonly value: string };
  /** Field declarations by name, or an ordered list of field names. */
  readonly fields: Readonly<Record<string, ProtocolField>> | readonly string[];
  /** Fields the program writes; may name fields not declared in `fields`. */
  readonly ownedFields?: readonly string[];
  /** Whether fields outside the declaration are rejected; defaults to the compiler policy. */
  readonly additionalProperties?: boolean;
  /** 'defined' rejects an explicitly undefined optional property; 'own' preserves its presence. */
  readonly optionalPresence?: 'own' | 'defined';
  /** App-declared modes in which the command is available. */
  readonly modes?: readonly string[];
  /** Rejection wording for the command as a whole. */
  readonly error?: ProtocolReason<Value, Args>;
  /** Diagnostic tags attached to rejections from this command. */
  readonly tags?: readonly string[];
  /** Declarative rejection rules, evaluated in order after the structural checks. */
  readonly checks?: readonly ProtocolCheck<Value, Args>[];
  /** Domain checks/bindings only; invoked after structural and declarative checks. */
  readonly refine?: (value: Value, ...args: Args) => void;
  /** Formats the validated value into the command result. */
  readonly format?: (value: Value, ...args: Args) => Result;
}

/** Compiled command. */
export interface Command<Value extends object, Result = Value, Args extends unknown[] = []> {
  readonly category?: InteractionCategory;
  readonly version?: number;
  readonly description?: string;
  readonly terminal?: boolean;
  /** Per-field schemas, including the forced discriminator field. */
  readonly fieldSchemas: Record<string, unknown>;
  /** Schema for model output; only `modelRequired` fields are required here. */
  readonly modelJsonSchema: Record<string, unknown>;
  /** Schema for runtime input; every `required` field is required here. */
  readonly inputJsonSchema: Record<string, unknown>;
  readonly modes?: readonly string[];
  /** Field names the program owns; the model must not supply them. */
  readonly ownedFields: readonly string[];
  /** Selector values carried by `value`, used to resolve the command before parsing. */
  keys(value: Record<string, unknown>): string[];
  /** Validates without formatting; throws on the first failed check. */
  assert(value: Value, ...args: Args): void;
  /** Validates and returns the formatted result. */
  parse(value: Value, ...args: Args): Result;
}

/** Envelope-level options for a command catalog. */
export interface CommandCatalogOptions {
  /** Field carrying the mode selector, when modes are used. */
  readonly modeField?: string;
  /** Rejection wording for an unknown command selector. */
  readonly unknownError?: Error | string;
  /** Rejection wording for a command used outside its declared modes. */
  readonly modeError?: Error | string;
  /** Rejection wording for a model-supplied owned field. */
  readonly ownershipError?: Error | string;
  /** Diagnostic tags attached to every rejection from this catalog. */
  readonly tags?: readonly string[];
}

/** Transfer envelope plus its registered command family; no change to HTTP or SSE framing. */
export type InteractionProtocolDefinition<
  Value extends object,
  Result = Value,
  Args extends unknown[] = [],
  Id extends string = string,
> = Omit<
  Partial<CommandDefinition<Value, Result, Args>>,
  'discriminator' | 'modes' | 'ownedFields'
> &
  CommandCatalogOptions & {
    /** Field carrying the command id; also the canonical key in normalized output. */
    readonly commandField: string;
    /** Accepted only on input. Schema and normalized output always use commandField. */
    readonly commandAliases?: readonly string[];
    /** Rejection wording when a payload selects no command. */
    readonly selectionError?: ProtocolReason<Value, Args>;
    readonly commands: Readonly<Record<Id, CommandDefinition<Value, Result, Args>>>;
  };

/** Custom protocols may derive dynamic keys without supplying a compiled schema. */
export interface ProtocolShape {
  /** Optional schema for model output. */
  readonly modelJsonSchema?: Record<string, unknown>;
  /** Optional schema for runtime input. */
  readonly inputJsonSchema?: Record<string, unknown>;
  /** Optional per-field schemas. */
  readonly fieldSchemas?: Record<string, unknown>;
  /** Selector values carried by `value`. */
  keys(value: Record<string, unknown>): string[];
}

/** Runtime extension contract; hosts retain their own version values and validation context. */
export interface RegisteredProtocol<Args extends unknown[] = []> extends ProtocolShape {
  readonly version?: number;
  readonly description?: string;
  readonly terminal?: boolean;
  /** Structural validation for an already resolved command value. */
  assert?(value: Record<string, unknown>, ...args: Args): void;
}

/**
 * Package-wide vocabulary shared by every agent-core contract.
 *
 * These aliases and envelopes are the neutral layer between App-owned business types and the
 * Core runtime modules: identifiers stay opaque, application identities are deliberately absent,
 * and every catalog or result shape is read-only so a registered snapshot cannot be mutated later.
 *
 * Exports: `Id`, `TimestampMs`, `DurationMs`, `Observer`, `AsyncSink`, `InvocationStatus`,
 * `JsonSchema`, `MaybePromise`, `SchemaAdapter`, `Issue`, `CheckResult`, `ReadonlyCatalog`,
 * `Registry`, `ExecutionOptions`, `ExecutionContext`, `OperationContext`, `SearchHit`.
 */

/** Opaque identifier. Format and meaning belong to the App or to the registering module. */
export type Id = string;
/** Wall-clock instant in milliseconds since the Unix epoch. */
export type TimestampMs = number;
/** Elapsed time in milliseconds; never an absolute instant. */
export type DurationMs = number;
/** Notification callback. A rejected promise propagates to the emitter. */
export type Observer<Event> = (event: Readonly<Event>) => void | Promise<void>;
/** Awaitable sink for an ordered stream. A rejection propagates to the emitter. */
export type AsyncSink<Event> = (event: Readonly<Event>) => Promise<void>;
/** Terminal state of one invocation; `cancelled` is distinct from a failure. */
export type InvocationStatus = 'success' | 'error' | 'cancelled';
/** JSON Schema as consumed by the App's validator; Core never interprets its contents. */
export type JsonSchema = Readonly<Record<string, unknown>>;
/** A value that may already be resolved or still pending. */
export type MaybePromise<Value> = Value | Promise<Value>;

/** Compiled schema pair: the JSON form shown to the model and the runtime parser. */
export interface SchemaAdapter<Value = unknown> {
  /** Schema advertised to the model and used for documentation. */
  readonly jsonSchema: JsonSchema;
  /** Validates or coerces untrusted input into `Value`; throws when the input is invalid. */
  parse(input: unknown): Value;
}

/** One validation problem, locatable by code and, when available, by field path. */
export interface Issue {
  /** Stable machine-readable reason code; the primary key for programmatic handling. */
  readonly code: string;
  /** Human-readable description; not guaranteed stable for matching. */
  readonly message: string;
  /** Path of the offending field inside the checked value, outermost segment first. */
  readonly path?: readonly (string | number)[];
  /** Registered check that produced the issue, when the check belongs to a catalog. */
  readonly checkId?: string;
}

/**
 * Verdict of one registered check.
 *
 * `unavailable` and `not-run` are not verdicts on the value: they state that the check could not
 * produce an answer, so callers must not treat them as failures.
 */
export interface CheckResult<Value = never> {
  readonly status: 'passed' | 'failed' | 'unavailable' | 'not-run';
  /** Problems found; expected to be empty when the status is `passed`. */
  readonly issues: readonly Issue[];
  /** Checked or produced value; present only when the check yields one. */
  readonly value?: Value;
}

/** Read-only projection of a definition set; the implementation owns ordering and validation. */
export interface ReadonlyCatalog<Definition extends { readonly id: string }> {
  /** Definitions in registration order; each entry is frozen by the implementation. */
  readonly definitions: readonly Readonly<Definition>[];
  /** Ids in the same order as `definitions`. */
  ids(): readonly string[];
  values(): IterableIterator<Readonly<Definition>>;
  entries(): IterableIterator<readonly [string, Readonly<Definition>]>;
  has(id: string): boolean;
  /** Returns the definition or `undefined`; the caller decides whether absence is an error. */
  get(id: string): Readonly<Definition> | undefined;
  /** Returns the definition or throws; use when the id is a required reference. */
  require(id: string): Readonly<Definition>;
}

/** Mutable catalog. Registrations append; `seal` freezes the set against later writes. */
export interface Registry<
  Definition extends { readonly id: string },
> extends ReadonlyCatalog<Definition> {
  /** Adds one definition; implementations reject blank or duplicate ids. */
  register(definition: Definition): this;
  registerAll(definitions: Iterable<Definition>): this;
  /** Rejects every later registration on this instance. */
  seal(): this;
}

/** Optional controls accepted by any public Core call. */
export interface ExecutionOptions {
  /** Cancellation for the whole call; children must not extend it. */
  readonly signal?: AbortSignal;
  /** Diagnostic scope that records the call; omission disables recording. */
  readonly diagnostics?: import('./diagnostics.js').DiagnosticContext;
  /** Live observation of the same facts that diagnostics would record. */
  readonly observe?: import('./execution/events.js').ExecutionObserver;
}

/** Required execution facts available inside a running call. */
export interface ExecutionContext {
  /** Explicit optional recorder for this operation; never inferred from diagnostics. */
  readonly logger?: import('./debug.js').ReportedStepLog;
  /** Non-optional cancellation signal; never `undefined` once execution has started. */
  readonly signal: AbortSignal;
  /** Diagnostic scope of the enclosing call, when recording is enabled. */
  readonly diagnostics?: import('./diagnostics.js').DiagnosticContext;
}

/**
 * Execution context plus the App-owned host object.
 *
 * `app` carries services, identity and per-request dependencies supplied by the host; Core treats
 * it as opaque and must not depend on application-specific fields.
 */
export interface OperationContext<App = unknown> extends ExecutionContext {
  readonly app: unknown extends App ? App : Readonly<App>;
}

/**
 * One search result.
 *
 * `score` semantics stay algorithm-specific (direction and scale are not part of this contract),
 * and `document` may be a projection that only exposes stored fields rather than the full record.
 */
export interface SearchHit<Document> {
  readonly id: string;
  readonly score: number;
  readonly document: Readonly<Document>;
}

/**
 * Retrieval contract for the Retrieval Kit.
 *
 * Place in the package: an optional App-side library for one query round-trip. Data access,
 * authorization, state and result semantics are host ports; the Kit owns the fixed order — state,
 * preparation, assertions, duplicate/budget checks, authorization, adapter call, result validation,
 * source naming and declared effects.
 *
 * Exports: `RetrievalSource`, `RetrievalResult`, `RetrievalState`, `RetrievalReceipt`,
 * `RetrievalReason`, `RetrievalEffect`, `RetrievalPorts`, `RetrievalRunner`, `RetrievalDefinition`.
 */
/** Request-local citation reference; the App may separately carry its content entity id. */
export interface RetrievalSource {
  sourceId: string;
}

/** Adapter output for one accepted query; the Kit renames each source before returning it. */
export interface RetrievalResult<Source extends RetrievalSource> {
  sources: Source[];
}

/** Request-owned state. Clearing current evidence must not replenish spent budgets or seen keys. */
export interface RetrievalState<Source extends RetrievalSource> {
  /** Successful queries so far; compared against the current limit. */
  queryCount: number;
  /** Query keys already attempted, including rejected ones, so retries count as duplicates. */
  readonly seen: Set<string>;
  /** Sources from successful queries, in acceptance order. */
  readonly sources: Source[];
}

/** Facts of one accepted query. */
export interface RetrievalReceipt<
  Query,
  Source extends RetrievalSource,
  Result extends RetrievalResult<Source>,
> {
  /** Query after `prepare`, exactly as executed. */
  readonly query: Query;
  /** Deduplication key reserved before the adapter call. */
  readonly key: string;
  /** One-based position of this query within the request. */
  readonly sequence: number;
  /** Adapter start instant in epoch milliseconds. */
  readonly startedAtMs: number;
  /** Adapter output before source naming; rejected results never produce a receipt. */
  readonly rawResult: Result;
  /** Same result with every `sourceId` replaced by the Kit-assigned name. */
  readonly result: Result;
  /** Domain attachments are computed from real results, not model-supplied receipts. */
  readonly extensions: Record<string, unknown>;
}

/** Lazy rejection wording: a fixed message, a pre-built error, or a factory bound to the query. */
export type RetrievalReason<Query, Context> =
  Error | string | ((query: Query, context: Context) => Error | string);

/** One effect applied after a successful query, in declaration order. */
export interface RetrievalEffect<
  Query,
  Source extends RetrievalSource,
  Result extends RetrievalResult<Source>,
  Context,
> {
  readonly id: string;
  readonly description: string;
  /** Applies the effect synchronously; a throw stops later effects without rollback. */
  handle(receipt: RetrievalReceipt<Query, Source, Result>, context: Context): void;
}

/** Host ports and policy for one retrieval kind. */
export interface RetrievalPorts<
  Query,
  Source extends RetrievalSource,
  Result extends RetrievalResult<Source>,
  Context,
> {
  readonly id: string;
  readonly description: string;
  readonly tags?: readonly string[];
  /** Normalizes the query before assertions run; must be synchronous. */
  readonly prepare?: (query: Query, context: Context) => Query;
  /** Rejects a malformed query; must be synchronous and return void. */
  readonly assertInput: (query: Query, context: Context) => void;
  /** Returns the request-owned state that holds counters and sources. */
  readonly state: (context: Context) => RetrievalState<Source>;
  /** Maximum accepted queries for the current state. */
  readonly limit: (context: Context) => number;
  /** Deduplication key; defaults to a canonical serialization of the query. */
  readonly key?: (query: Query) => string;
  readonly errors?: {
    readonly duplicate?: RetrievalReason<Query, Context>;
    readonly budget?: RetrievalReason<Query, Context>;
  };
  /** Resource authorization runs after duplicate/budget checks and before reserving a key. */
  readonly authorize?: (query: Query, context: Context) => void;
  /** Performs the actual read; must be synchronous. Throwing does not refund the query key. */
  readonly execute: (query: Query, context: Context) => Result;
  /** Validates the adapter result; a throw leaves the query counted as seen but not successful. */
  readonly assertResult?: (result: Result, query: Query, context: Context) => void;
  /** Names a source; the assigned value replaces `sourceId` in the receipt result. */
  readonly sourceId?: (source: Source, query: Query, sequence: number, context: Context) => string;
  readonly effects?: readonly RetrievalEffect<Query, Source, Result, Context>[];
  /** Clock override for receipt timestamps; defaults to `Date.now`. */
  readonly now?: () => number;
}

/** Compiled retrieval runner. */
export interface RetrievalRunner<
  Query,
  Source extends RetrievalSource,
  Result extends RetrievalResult<Source>,
  Context,
> {
  readonly id: string;
  readonly description: string;
  /** Effects that run after every accepted query. */
  readonly effects: readonly RetrievalEffect<Query, Source, Result, Context>[];
  /** Executes one query in the fixed lifecycle order and returns its receipt. */
  run(input: Query, context: Context): RetrievalReceipt<Query, Source, Result>;
}
/** Retrieval ports specialized to an App operation context. */
export type RetrievalDefinition<
  Query,
  Source extends RetrievalSource,
  Result extends RetrievalResult<Source>,
  App,
> = RetrievalPorts<Query, Source, Result, import('../common.js').OperationContext<App>>;

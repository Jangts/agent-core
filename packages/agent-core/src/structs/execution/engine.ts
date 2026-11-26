/**
 * Agent loop contract: one bounded step executed repeatedly until it completes.
 *
 * The engine owns round counting, cancellation and budget exhaustion; the App supplies a `CoreStep`
 * that decides whether the loop continues or finishes. Loop facts are emitted as `loop.event` so
 * a host can observe progress without reading engine internals.
 *
 * Exports: `LoopEvent`, `StepOutcome`, `CoreStep`, `AgentCoreEngineOptions`.
 */
import type { ExecutionContext, ExecutionOptions, MaybePromise } from '../common.js';
import type { CacheContext, EngineCacheOptions, AgentCachePort } from './cache.js';
import type { WorkflowEvent } from './workflow.js';

/** Progress fact for one loop round, correlated with the enclosing diagnostics span. */
export interface LoopEvent {
  /** Unique id of this fact. */
  readonly eventId: string;
  /** `enter` opens a round, `continue`/`complete` close it, `error` reports failure. */
  readonly type: 'enter' | 'continue' | 'complete' | 'error';
  /** Zero-based round index; a new round starts only when the step asks to continue. */
  readonly roundIndex: number;
  /** Phase that failed on `error`: boundary checks, the step itself, or budget accounting. */
  readonly phase?: 'boundary' | 'run' | 'budget';
  /** Stable error classification when `type` is `error`. */
  readonly errorCode?: string;
}

/** Decision a step returns to the engine. */
export type StepOutcome<Value> =
  /** Run another round; consumes one round from the budget. */
  { readonly type: 'continue' } | { readonly type: 'complete'; readonly value: Value };
/** One loop iteration. Must be re-entrant: the same step object runs every round. */
export type CoreStep<Result> = (
  roundIndex: number,
  context: ExecutionContext & import('../debug.js').RuntimeNodeReportingContext & CacheContext,
) => MaybePromise<StepOutcome<Result>>;

/** Engine construction options. */
export interface AgentCoreEngineOptions {
  /** Engine-local LRU bounds; not copied as cache data when forking. */
  cache?: EngineCacheOptions;
  /** Borrowed App service cache; forks must explicitly provide their own port. */
  agentCache?: AgentCachePort;
  /** Round budget; must be a positive safe integer. Defaults to 8 rounds. */
  maxRounds?: number;
  /** Cancellation and diagnostics shared by every round. */
  execution?: ExecutionOptions;
  /** Builds the error thrown when the round budget is exhausted (defaults to a `BudgetError`). */
  errors?: { exhausted?: () => Error };
}

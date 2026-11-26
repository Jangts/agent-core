/**
 * Durable task contract for the Durable Kit.
 *
 * Place in the package: an optional App-side library for sequential work that must survive a
 * restart. The Kit owns step ordering, attempt and model-call accounting, deadline checks,
 * checkpoint validation and the exclusive-store protocol; the store, its atomicity and the real
 * side effects stay with the App. Core itself never imports this module.
 *
 * Exports: `durableStatuses`, `durableReplayPolicies`, `DurableCheckpoint`, `DurableStore`,
 * `DurableStep`, `DurableStepContext`, `DurableTaskDefinition`, `DurableTaskOptions`,
 * `DurableTask`.
 */
import type { OperationContext } from '../common.js';

/** Checkpoint lifecycle values, in the order a task passes through them. */
export const durableStatuses = ['ready', 'running', 'completed', 'cancelled'] as const;
/**
 * How an interrupted step is resumed.
 *
 * `safe` re-runs `run` (the step must tolerate repeating its side effect); `reconcile` requires a
 * `reconcile` handler because the previous attempt may have taken effect already.
 */
export const durableReplayPolicies = ['safe', 'reconcile'] as const;

/** Persisted task progress; the only state a resume reads back. */
export interface DurableCheckpoint<State> {
  /** Checkpoint format version; other versions are rejected on load. */
  version: 2;
  /** Identity of the last save; older v2 checkpoints may omit it. New saves always set it. */
  commitId?: string;
  /** Definition that produced the checkpoint; a mismatch invalidates it. */
  definitionId: string;
  /** Definition revision that produced the checkpoint; a mismatch invalidates it. */
  revision: string;
  /** Zero-based index of the next step to run. */
  nextStepIndex: number;
  /** Attempts already spent; one is spent per step entry. */
  attemptCount: number;
  /** Total attempts allowed for the whole task. */
  maxAttempts: number;
  /** Execution deadline; expiry blocks new work, not authorized reads or reconciliation. */
  deadlineAtMs: number;
  status: (typeof durableStatuses)[number];
  /** App-owned task state; only `isState` decides whether it is still valid. */
  state: State;
  /** Durable, conservative reservations. An interrupted attempt never refunds its allowance. */
  modelBudget?: { maxCalls: number; reservedCalls: number; maxCallsPerAttempt: number };
}
/** App implements an exclusive lock across every writer and validates/serializes stored state. */
export interface DurableStore<State> {
  /** Runs `operation` under the exclusive lock for `id`; other writers must wait or fail. */
  exclusive<T>(id: string, operation: () => Promise<T>): Promise<T>;
  /** Returns the stored checkpoint, or `undefined` when the task has never been saved. */
  load(id: string): Promise<DurableCheckpoint<State> | undefined>;
  /** Persists a checkpoint; must be durable before the promise resolves. */
  save(id: string, checkpoint: DurableCheckpoint<State>): Promise<void>;
}
/** One step of a durable task. */
export interface DurableStep<State, App> {
  /** Unique step id used in errors and diagnostics. */
  readonly id: string;
  /** Resume behaviour when a previous attempt was interrupted mid-step. */
  readonly replayPolicy: (typeof durableReplayPolicies)[number];
  /** Executes the step and returns the complete next state. */
  run(state: Readonly<State>, context: DurableStepContext<App>): Promise<State>;
  /** Read-only confirmation of an interrupted operation; must never retry its side effect. */
  reconcile?(
    state: Readonly<State>,
    context: DurableReconcileContext<App>,
  ): Promise<DurableReconciliation<State>>;
}
/** Confirmation does not grant a new execution attempt or refund an old reservation. */
export type DurableReconciliation<State> =
  | { readonly kind: 'completed'; readonly state: State }
  | { readonly kind: 'not-executed' }
  | { readonly kind: 'unknown'; readonly reason?: string };

/** Execution facts handed to a durable step. */
export interface DurableStepContext<App> extends OperationContext<App> {
  readonly taskId: string;
  readonly stepId: string;
  /** Stable across attempts; hosts must not reuse a task id for unrelated work. */
  readonly operationId: string;
  /** One-based attempt number currently executing (already counted and persisted). */
  readonly attemptCount: number;
  /** App binds its real Runner to this reserved per-attempt maximum, keeping request limits. */
  readonly maxModelCalls?: number;
}
/** Read-only confirmation has its own request lifetime and grants no model allowance. */
export interface DurableReconcileContext<App> extends DurableStepContext<App> {
  readonly maxModelCalls: 0;
}
/** Authorization is evaluated for the current operation, never restored from a checkpoint. */
export interface DurableAuthorizationContext<App> extends OperationContext<App> {
  readonly operation: 'execute' | 'reconcile' | 'read';
}

/** Task definition, including the App hooks that guard every resume. */
export interface DurableTaskDefinition<State, App> {
  readonly id: string;
  /** Definition revision; stored in the checkpoint so resumed work matches its code. */
  readonly revision: string;
  /** Steps in execution order; the checkpoint stores an index into this list. */
  readonly steps: readonly DurableStep<State, App>[];
  /** Validates a loaded checkpoint state before any step runs. */
  isState(state: unknown): state is State;
  /** Recheck current identity, source versions and grants on every explicit resume. */
  authorize?(
    checkpoint: Readonly<DurableCheckpoint<State>>,
    context: DurableAuthorizationContext<App>,
  ): import('../common.js').MaybePromise<void>;
}
/** Runtime options for a compiled durable task. */
export interface DurableTaskOptions<State = unknown> {
  /** Clock override for deadlines and timestamps; defaults to `Date.now`. */
  readonly now?: () => number;
  /** Default store; a call may pass its own store instead. */
  readonly store?: DurableStore<State>;
}
/** Compiled task: resumes from the store and returns the final state. */
export interface DurableTask<State, App> {
  /**
   * Runs or resumes the task.
   *
   * @param request - Task id and an optional store overriding the definition's default.
   * @param context - App host object, cancellation and diagnostics.
   * @returns The completed state; a completed checkpoint returns a detached copy.
   */
  run(
    request: { readonly taskId: string; readonly store?: DurableStore<State> },
    context: import('../common.js').OperationContext<App>,
  ): Promise<State>;
}

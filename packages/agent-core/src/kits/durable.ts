/**
 * Durable Kit: replay-safe sequential task execution on top of an App-owned checkpoint store.
 *
 * Place in the package: an optional App-side library for work that must survive a restart.
 * The Kit owns step ordering, attempt and model-call accounting, deadline checks, checkpoint
 * validation and the exclusive-store protocol; the store, its atomicity and the real side
 * effects stay with the App. Core itself never imports this module.
 *
 * Exports: `defineDurableTask`, `Durable`, the checkpoint/step/store types, and the
 * `durableStatuses` / `durableReplayPolicies` enumerations.
 */
import { booleanResult } from '../utils/synchronous.js';
import { awaitWithSignal, awaitAssertion, createDeadlineSignal } from '../utils/cancellation.js';
import { durableStatuses, durableReplayPolicies } from '../structs/kits/durable.js';
import type {
  DurableCheckpoint,
  DurableStep,
  DurableStore,
  DurableTask,
  DurableTaskDefinition,
  DurableTaskOptions,
} from '../structs/kits/durable.js';
import type { OperationContext } from '../structs/common.js';
import { AgentCoreEngine } from '../execution/engine.js';
import { invocationId } from '../utils/invocation.js';

/**
 * Compile a durable task definition into a resumable runner.
 *
 * Each `run` call locks the task id in the store, loads the checkpoint and resumes at
 * `nextStepIndex`. A checkpoint from another definition id or revision, or one that fails the
 * predicates below, is rejected instead of being repaired, because silently accepting it would
 * replay App side effects under a different contract.
 *
 * @param definition - Task identity, state predicate, ordered steps and optional authorization.
 * @param options - Fallback store plus optional clock; both are bound to their owners.
 * @returns A frozen task with `run({ taskId, store? }, context)`.
 * @throws TypeError At construction for an invalid identity, step list, replay policy or
 *   duplicate step id; from `run` for a malformed request/context/store, an invalid
 *   checkpoint, or a step whose returned state fails the predicate. Also throws when the
 *   deadline passed, the attempt budget is exhausted, or the model-call budget cannot fund
 *   one more attempt.
 */
export function defineDurableTask<State, App>(
  definition: DurableTaskDefinition<State, App>,
  options: DurableTaskOptions<State> = {},
): DurableTask<State, App> {
  if (!definition || typeof definition !== 'object')
    throw new TypeError('Use isState and replayPolicy');
  const { id: definitionId, revision, steps: definitions, isState } = definition;
  const clock = options.now;
  if (
    typeof definitionId !== 'string' ||
    !definitionId.trim() ||
    typeof revision !== 'string' ||
    !revision.trim() ||
    typeof isState !== 'function' ||
    !Array.isArray(definitions) ||
    !definitions.length ||
    (clock !== undefined && typeof clock !== 'function')
  )
    throw new TypeError('Invalid durable task');
  const now = clock?.bind(options) ?? Date.now,
    validate = isState.bind(definition);
  const authorize = definition.authorize?.bind(definition);
  const boundStore = options.store && {
    exclusive: options.store.exclusive.bind(options.store),
    load: options.store.load.bind(options.store),
    save: options.store.save.bind(options.store),
  };
  const steps = Object.freeze(
    definitions.map((step: DurableStep<State, App>) => {
      if (!step || typeof step !== 'object')
        throw new TypeError('Use replayPolicy and OperationContext');
      const { id, replayPolicy, run, reconcile } = step;
      if (replayPolicy === 'reconcile' && typeof reconcile !== 'function')
        throw new TypeError('Durable task reconciliation handler is required');
      if (
        typeof id !== 'string' ||
        !id.trim() ||
        !durableReplayPolicies.includes(replayPolicy) ||
        typeof run !== 'function' ||
        (reconcile !== undefined && typeof reconcile !== 'function')
      )
        throw new TypeError('Invalid durable step');
      const bound = { id, run: run.bind(step) };
      return replayPolicy === 'reconcile'
        ? Object.freeze({ ...bound, replayPolicy, reconcile: reconcile!.bind(step) })
        : Object.freeze({ ...bound, replayPolicy });
    }),
  );
  if (new Set(steps.map((step) => step.id)).size !== steps.length)
    throw new TypeError('Duplicate durable step id');

  return Object.freeze({
    /**
     * Resume or start one durable task.
     *
     * @param request - Task id plus an optional per-call store that overrides the bound one.
     * @param context - Operation context supplying app, signal and diagnostics.
     * @returns The final state, cloned so the caller cannot mutate the stored checkpoint.
     * @throws As described for `defineDurableTask`; an already-completed task returns its state
     *   without running any step.
     */
    async run(
      request: { readonly taskId: string; readonly store?: DurableStore<State> },
      context: OperationContext<App>,
    ): Promise<State> {
      if (
        !request ||
        typeof request !== 'object' ||
        typeof request.taskId !== 'string' ||
        !request.taskId.trim()
      )
        throw new TypeError('Use a named durable task request');
      if (!context?.signal) throw new TypeError('Durable tasks require OperationContext');
      const { taskId } = request,
        store = request.store ?? boundStore,
        { app, signal, diagnostics } = context;
      signal.throwIfAborted();
      if (
        !store ||
        typeof store.exclusive !== 'function' ||
        typeof store.load !== 'function' ||
        typeof store.save !== 'function'
      )
        throw new TypeError('Invalid durable store');
      const exclusive = store.exclusive.bind(store),
        load = store.load.bind(store),
        save = store.save.bind(store);
      signal.throwIfAborted();
      return exclusive(taskId, async () => {
        signal.throwIfAborted();
        const loaded = await awaitWithSignal(load(taskId), signal);
        signal.throwIfAborted();
        if (!loaded) throw new TypeError('Invalid durable checkpoint');
        const checked = (value: DurableCheckpoint<State>) => {
          const record = snapshotCheckpoint(value);
          if (
            record.definitionId !== definitionId ||
            record.revision !== revision ||
            !booleanResult(
              validate(record.state),
              'Durable state predicates must return boolean synchronously',
            ) ||
            !Number.isSafeInteger(record.nextStepIndex) ||
            record.nextStepIndex < 0 ||
            record.nextStepIndex > steps.length ||
            !Number.isSafeInteger(record.attemptCount) ||
            record.attemptCount < 0 ||
            !Number.isSafeInteger(record.maxAttempts) ||
            record.maxAttempts < 1 ||
            record.attemptCount > record.maxAttempts ||
            record.attemptCount < record.nextStepIndex ||
            (record.status === 'running' && record.attemptCount <= record.nextStepIndex) ||
            !Number.isFinite(record.deadlineAtMs) ||
            !durableStatuses.includes(record.status) ||
            (record.status === 'completed') !== (record.nextStepIndex === steps.length)
          )
            throw new TypeError('Invalid durable checkpoint');
          return record;
        };
        let record = checked(loaded);
        const deadline = record.deadlineAtMs;
        if (record.modelBudget) {
          const { maxCalls, reservedCalls, maxCallsPerAttempt } = record.modelBudget;
          if (
            !Number.isSafeInteger(maxCalls) ||
            maxCalls < 1 ||
            !Number.isSafeInteger(reservedCalls) ||
            reservedCalls < 0 ||
            reservedCalls > maxCalls ||
            !Number.isSafeInteger(maxCallsPerAttempt) ||
            maxCallsPerAttempt < 1 ||
            maxCallsPerAttempt > maxCalls
          )
            throw new TypeError('Invalid durable model budget');
        }
        let saving: Promise<void> | undefined;
        // Save a detached snapshot. A rejected acknowledgement is confirmed only by its
        // unique commit identity, never by a similar state or step position.
        const persist = async () => {
          record = { ...record, commitId: invocationId() };
          const expected = snapshotCheckpoint(record);
          saving = (async () => {
            try {
              await save(taskId, snapshotCheckpoint(expected));
            } catch (error) {
              try {
                const read = await load(taskId);
                if (read && checked(read).commitId === expected.commitId) return;
              } catch {
                // Keep the original storage failure, including when read-back fails.
              }
              throw error;
            }
          })();
          await saving;
        };
        const authorizeOperation = async (
          operation: 'execute' | 'reconcile' | 'read',
          operationSignal: AbortSignal,
        ) => {
          if (authorize)
            await awaitAssertion(
              () =>
                authorize(snapshotCheckpoint(record), {
                  app,
                  signal: operationSignal,
                  diagnostics,
                  operation,
                }),
              operationSignal,
              'Durable authorization must return void',
            );
          operationSignal.throwIfAborted();
        };
        const advance = async (nextState: State, executionSignal?: AbortSignal) => {
          if (
            !booleanResult(
              validate(nextState),
              'Durable state predicates must return boolean synchronously',
            )
          )
            throw new TypeError('Invalid durable step state');
          signal.throwIfAborted();
          const state = structuredClone(nextState);
          if (executionSignal) assertActive(executionSignal, deadline, now);
          else signal.throwIfAborted();
          record = {
            ...record,
            state,
            nextStepIndex: record.nextStepIndex + 1,
            status: record.nextStepIndex + 1 === steps.length ? 'completed' : 'ready',
          };
          await persist();
          signal.throwIfAborted();
        };
        try {
          if (record.status === 'completed') {
            await authorizeOperation('read', signal);
            return structuredClone(record.state);
          }
          if (record.status === 'cancelled') {
            // Terminal status is still private task data, not an authorization bypass.
            await authorizeOperation('read', signal);
            throw new Error('Durable task cancelled');
          }
          const engine = new AgentCoreEngine<State>({
            // An initial read-only reconciliation may close one persisted attempt;
            // it consumes no new execution attempt or model reservation.
            maxRounds: Math.max(
              1,
              Math.min(Number.MAX_SAFE_INTEGER, record.maxAttempts - record.attemptCount + 1),
            ),
            execution: { signal, diagnostics },
          });
          return await engine.run(async (_index, execution) => {
            signal.throwIfAborted();
            const step = steps[record.nextStepIndex];
            const identity = {
              taskId,
              stepId: step.id,
              operationId: JSON.stringify([definitionId, revision, taskId, step.id]),
            };
            if (record.status === 'running' && step.replayPolicy === 'reconcile') {
              await authorizeOperation('reconcile', signal);
              const result = await awaitWithSignal(
                step.reconcile(structuredClone(record.state), {
                  ...identity,
                  app,
                  signal: execution.signal,
                  diagnostics: execution.diagnostics,
                  attemptCount: record.attemptCount,
                  maxModelCalls: 0,
                }),
                signal,
              );
              signal.throwIfAborted();
              if (
                !result ||
                typeof result !== 'object' ||
                !['completed', 'not-executed', 'unknown'].includes(result.kind)
              )
                throw new TypeError('Invalid durable reconciliation result');
              if (result.kind === 'unknown') {
                if (result.reason !== undefined && typeof result.reason !== 'string')
                  throw new TypeError('Invalid durable reconciliation reason');
                throw Object.assign(new Error('Durable operation remains unresolved'), {
                  code: 'DURABLE_UNRESOLVED',
                  reason: result.reason,
                });
              }
              if (result.kind === 'completed') {
                await advance(result.state);
                return record.nextStepIndex === steps.length
                  ? { type: 'complete' as const, value: structuredClone(record.state) }
                  : { type: 'continue' as const };
              }
              // Stable confirmation that the old attempt did not execute is not a refund.
              record = { ...record, status: 'ready' };
              await persist();
            }
            assertActive(signal, deadline, now);
            if (record.attemptCount >= record.maxAttempts)
              throw new Error('Durable task budget exhausted');
            const modelBudget = record.modelBudget;
            if (
              modelBudget &&
              modelBudget.maxCalls - modelBudget.reservedCalls < modelBudget.maxCallsPerAttempt
            )
              throw new Error('Durable model budget exhausted');
            const lifetime = createDeadlineSignal(deadline, signal, now);
            const activeSignal = lifetime.signal;
            try {
              await authorizeOperation('execute', activeSignal);
              assertActive(activeSignal, deadline, now);
              record = {
                ...record,
                attemptCount: record.attemptCount + 1,
                status: 'running',
                ...(modelBudget
                  ? {
                      modelBudget: {
                        ...modelBudget,
                        reservedCalls: modelBudget.reservedCalls + modelBudget.maxCallsPerAttempt,
                      },
                    }
                  : {}),
              };
              await persist();
              assertActive(activeSignal, deadline, now);
              const nextState = await awaitWithSignal(
                step.run(structuredClone(record.state), {
                  ...identity,
                  app,
                  signal: activeSignal,
                  diagnostics: execution.diagnostics,
                  attemptCount: record.attemptCount,
                  maxModelCalls: record.modelBudget?.maxCallsPerAttempt,
                }),
                activeSignal,
              );
              assertActive(activeSignal, deadline, now);
              await advance(nextState, activeSignal);
              assertActive(activeSignal, deadline, now);
              return record.nextStepIndex === steps.length
                ? { type: 'complete' as const, value: structuredClone(record.state) }
                : { type: 'continue' as const };
            } finally {
              lifetime.dispose();
            }
          });
        } finally {
          // Engine may stop waiting on cancellation, but an already-started save
          // (including confirmation read-back) retains the store lock until settled.
          await saving?.catch(() => {});
        }
      });
    },
  });
}

function assertActive(signal: AbortSignal, deadlineAtMs: number, now: () => number): void {
  signal.throwIfAborted();
  if (deadlineAtMs <= now()) throw new Error('Durable task expired');
  signal.throwIfAborted();
}

export type * from '../structs/kits/durable.js';

/** Namespace object for callers that prefer one import over named helpers. */
export const Durable = Object.freeze({ defineDurableTask });
/** Allowed checkpoint lifecycle states; re-exported so hosts can validate their own stores. */
export { durableStatuses, durableReplayPolicies } from '../structs/kits/durable.js';

function snapshotCheckpoint<State>(record: DurableCheckpoint<State>): DurableCheckpoint<State> {
  const { version } = record;
  // Only checkpoint layout 2 is readable; older layouts are not upgraded in place.
  if (version !== 2) throw new TypeError('Unsupported durable checkpoint version');
  const {
    definitionId,
    revision,
    nextStepIndex,
    attemptCount,
    maxAttempts,
    deadlineAtMs,
    status,
    state,
    modelBudget,
    commitId,
  } = record;
  if (commitId !== undefined && (typeof commitId !== 'string' || !commitId.trim()))
    throw new TypeError('Invalid durable commit identity');
  if (
    modelBudget !== undefined &&
    (!modelBudget || typeof modelBudget !== 'object' || Array.isArray(modelBudget))
  )
    throw new TypeError('Invalid durable model budget');
  return {
    version,
    ...(commitId !== undefined ? { commitId } : {}),
    definitionId,
    revision,
    nextStepIndex,
    attemptCount,
    maxAttempts,
    deadlineAtMs,
    status,
    state: structuredClone(state),
    ...(modelBudget !== undefined
      ? {
          modelBudget: {
            maxCalls: modelBudget.maxCalls,
            reservedCalls: modelBudget.reservedCalls,
            maxCallsPerAttempt: modelBudget.maxCallsPerAttempt,
          },
        }
      : {}),
  };
}

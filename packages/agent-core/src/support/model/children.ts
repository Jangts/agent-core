/**
 * Child model-task group: run several Core child calls with bounded concurrency.
 *
 * Each task receives a Core child runner created from the parent's limits, so budgets, timeouts,
 * interactions and cancellation remain Core behavior. This module only schedules the group and
 * orders acceptance and commit; it is optional app-side composition, not another scheduler
 * protocol.
 *
 * Main exports: `runChildren` and its task/option types.
 */
import { resolveInteractionAlias } from '../../model/transports.js';
import type { ModelRunner } from '../../model/runner.js';
import type { ModelChildOptions } from '../../structs/model/runtime.js';
import type { MaybePromise } from '../../structs/common.js';
import { awaitWithSignal, awaitAssertion, combineSignals } from '../../utils/cancellation.js';
import { assertion } from '../../utils/synchronous.js';
import { breakWhile } from '../../utils/rules.js';

/** One child call in a group: its own limits plus the work to run with the child runner. */
export interface ModelChildTask<Value> extends ModelChildOptions {
  /**
   * Work executed with the child runner bound to this task's limits.
   *
   * The supplied signal also aborts when a sibling fails, so long work should observe it.
   */
  run(model: ModelRunner, signal: AbortSignal): MaybePromise<Value>;
}
/** Group options: worker count, extra cancellation and accept/commit hooks. */
export interface ModelChildrenOptions<Value> {
  /** Parallel workers; defaults to, and may not exceed, the parent's concurrency limit. */
  readonly concurrency?: number;
  /** Optional caller cancellation, combined with the parent signal and group failure. */
  readonly signal?: AbortSignal;
  /** Called as each task finishes, before commit; must settle with `void`. */
  accept?(value: Value, id: string): MaybePromise<void>;
  /** Called in declaration order after every result is accepted; App owns atomicity/receipts. */
  commit?(value: Value, id: string): MaybePromise<void>;
}

/**
 * Run child tasks concurrently and return their values in declaration order.
 *
 * The first failure aborts the remaining group, but an already in-flight commit is still awaited
 * because cancellation does not mean the write was rolled back.
 *
 * @param parent Parent runner supplying child creation, limits and cancellation.
 * @param tasks Tasks to run; IDs must be unique and non-blank.
 * @param options Concurrency, extra cancellation and accept/commit hooks.
 * @returns Frozen values in declaration order.
 * @throws {Error} When the concurrency, a task declaration or a duplicate ID is invalid.
 * @throws The first task's error, or the combined signal's abort reason.
 */
export async function runChildren<Value>(
  parent: Pick<ModelRunner, 'createChild' | 'childLimits' | 'signal'> &
    Partial<Pick<ModelRunner, 'bind'>>,
  tasks: readonly ModelChildTask<Value>[],
  options: ModelChildrenOptions<Value> = {},
): Promise<readonly Value[]> {
  const runner = parent.bind?.({ signal: options.signal }) ?? parent;
  const concurrency = options.concurrency ?? runner.childLimits.maxConcurrentCalls;
  breakWhile(
    !Number.isSafeInteger(concurrency) ||
      concurrency < 1 ||
      concurrency > runner.childLimits.maxConcurrentCalls,
    'Child group concurrency exceeds the parent policy',
  );
  const accept = options.accept?.bind(options),
    commit = options.commit?.bind(options);
  const definitions = tasks.map((task) => {
    const {
      id,
      maxCalls,
      reserveCalls,
      timeoutMs,
      interactions: canonicalInteractions,
      transports: legacyInteractions,
      diagnostics,
      signal,
      run,
    } = task;
    const interactions = resolveInteractionAlias(canonicalInteractions, legacyInteractions);
    breakWhile(
      typeof id !== 'string' || !id.trim() || typeof run !== 'function',
      'Invalid child task',
    );
    return {
      id,
      maxCalls,
      reserveCalls,
      timeoutMs,
      interactions: interactions === undefined ? undefined : [...interactions],
      diagnostics,
      signal,
      run: run.bind(task),
    };
  });
  breakWhile(
    new Set(definitions.map((task) => task.id)).size !== definitions.length,
    'Duplicate child task id',
  );
  // One group controller so the first failure cancels every sibling worker at once.
  const cancellation = new AbortController();
  const signal = combineSignals(runner.signal, cancellation.signal, options.signal);
  signal.throwIfAborted();
  const values = new Array<Value>(definitions.length);
  let next = 0,
    failure: { error: unknown } | undefined;
  const worker = async () => {
    while (!failure && next < definitions.length) {
      const index = next++,
        definition = definitions[index];
      try {
        signal.throwIfAborted();
        const child = runner.createChild({
          ...definition,
          signal: combineSignals(signal, definition.signal),
        });
        const value = await awaitWithSignal(definition.run(child, child.signal), child.signal);
        child.signal.throwIfAborted();
        if (accept)
          await awaitAssertion(
            () => accept(value, definition.id),
            child.signal,
            'Child acceptance must return void',
          );
        child.signal.throwIfAborted();
        // Index by declaration position so completion order never changes the result order.
        values[index] = value;
      } catch (error) {
        if (!failure) {
          failure = { error };
          cancellation.abort(error);
        }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, definitions.length) }, worker));
  if (failure) throw failure.error;
  signal.throwIfAborted();
  if (commit)
    for (let index = 0; index < definitions.length; index++) {
      signal.throwIfAborted();
      // Do not abandon an in-flight commit: cancellation never means it was rolled back.
      const result = await commit(values[index], definitions[index].id);
      signal.throwIfAborted();
      assertion(result, 'Child commit must return void');
    }
  return Object.freeze(values);
}

/**
 * Cancellation and deadline plumbing shared by the model runner and the engine.
 *
 * Every helper here treats an abort signal as a pure lifetime bound: it may only
 * shorten waiting, never extend it, and it never replaces a caller-supplied parent
 * signal. Exports: `isTimeoutReason`, `combineSignals`, `awaitWithSignal`,
 * `awaitAssertion` and `createDeadlineSignal`.
 */
import { assertion } from './synchronous.js';

/**
 * Detect a deadline expiry as opposed to any other cancellation.
 *
 * The reason of an aborted signal is an arbitrary thrown value, including hostile
 * objects whose `name` getter throws, so the lookup is guarded.
 *
 * @param reason - Value delivered as `signal.reason`.
 * @returns True when the reason is named `TimeoutError`.
 */
export function isTimeoutReason(reason: unknown): boolean {
  try {
    return (reason as { name?: unknown } | null | undefined)?.name === 'TimeoutError';
  } catch {
    return false;
  }
}

/**
 * Merge optional signals into one lifetime bound.
 *
 * Duplicates are removed first so a signal appearing both as an execution parent and
 * as a request signal does not allocate a redundant composite. When nothing is
 * supplied a fresh, never-aborting signal is returned, which keeps callers free of
 * undefined checks.
 *
 * @param sources - Candidate signals in precedence-free order; `undefined` entries are ignored.
 * @returns A signal that aborts as soon as any supplied signal aborts.
 */
export function combineSignals(...sources: readonly (AbortSignal | undefined)[]): AbortSignal {
  const signals = [
    ...new Set(sources.filter((signal): signal is AbortSignal => signal !== undefined)),
  ];
  return signals.length > 1
    ? AbortSignal.any(signals)
    : (signals[0] ?? new AbortController().signal);
}

/**
 * Race a pending value against an abort signal.
 *
 * Abandoning the wait does not cancel the underlying work: a late rejection is still
 * consumed to avoid an unhandled rejection, and the abort listener is always removed.
 *
 * @param value - Value or promise to await; `undefined` keeps the same await semantics.
 * @param signal - Optional lifetime bound; without it the value is awaited unchanged.
 * @returns The resolved value.
 * @throws The signal reason when aborted, or the rejection of `value`.
 */
export async function awaitWithSignal<Value>(
  value: Value | PromiseLike<Value>,
  signal?: AbortSignal,
): Promise<Value> {
  if (!signal) return value;
  let abort: () => void;
  try {
    return await new Promise<Value>((resolve, reject) => {
      abort = () => reject(signal.reason);
      signal.addEventListener('abort', abort, { once: true });
      Promise.resolve(value).then(resolve, reject);
      if (signal.aborted) abort();
    });
  } finally {
    signal.removeEventListener('abort', abort!);
  }
}

/**
 * Run an assertion that may be asynchronous, bounded by a signal.
 *
 * Only a `void` result counts as success, so a hook that discards its decision as a
 * boolean is rejected rather than silently treated as passing. The signal is checked
 * before and after the hook so a decision produced after cancellation is discarded.
 *
 * @param check - Hook invoked once; may return a promise.
 * @param signal - Lifetime bound for the hook and its result.
 * @param message - Message for the TypeError raised when the hook does not return void.
 * @returns A promise resolved once the assertion passed.
 * @throws The signal reason when aborted, the hook's rejection, or the assertion TypeError.
 */
export async function awaitAssertion(
  check: () => unknown,
  signal: AbortSignal,
  message: string,
): Promise<void> {
  signal.throwIfAborted();
  const result = await awaitWithSignal(check(), signal);
  signal.throwIfAborted();
  assertion(result, message);
}

/**
 * Abort at an absolute wall-clock deadline, combined with a parent signal.
 *
 * Timers above the platform maximum are chunked instead of being clamped, so the
 * persisted deadline is never shortened. The deadline is recomputed from the clock on
 * each chunk, which keeps the effective expiry correct across timer drift.
 *
 * @param deadline - Absolute deadline in epoch milliseconds.
 * @param parent - Additional lifetime bound, typically the execution signal.
 * @param now - Clock source; injectable for tests.
 * @returns The combined `signal` and a `dispose` function that cancels the pending timer.
 */
export function createDeadlineSignal(deadline: number, parent: AbortSignal, now = Date.now) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    const remaining = deadline - now();
    if (remaining <= 0) controller.abort(new Error('Execution deadline expired'));
    else timer = setTimeout(schedule, Math.min(remaining, 2147483647));
  };
  schedule();
  return {
    signal: combineSignals(parent, controller.signal),
    dispose() {
      if (timer !== undefined) clearTimeout(timer);
    },
  };
}

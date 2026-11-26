/**
 * Request recovery boundary for Apps: execute once, preserve the App-owned work record, then
 * recover without replaying side effects. The final local fallback needs no model allowance.
 * It does not turn cancellation into an answer or mark the underlying task successful.
 */
import { synchronous } from '../utils/synchronous.js';
import { awaitWithSignal } from '../utils/cancellation.js';

/** App-supplied recovery implementations share one truthful work-record snapshot. */
export interface RequestRecovery<Input, Result> {
  readonly execute: (input: Input, signal: AbortSignal) => Promise<Result>;
  readonly recover?: (input: Input, error: unknown, signal: AbortSignal) => Promise<Result>;
  readonly fallback: (input: Input, errors: readonly unknown[]) => Result;
}
/** Recovery status is separate from the App's business completion status. */
export interface RecoveredResult<Result> {
  readonly value: Result;
  readonly source: 'execution' | 'recovery' | 'fallback';
  readonly errors: readonly unknown[];
}

/**
 * Bind the original receivers once and return an ordinary App function.
 * Supply an outer request signal; an execution-only deadline belongs inside execute, so recovery
 * is not attempted with an already expired signal. Local fallback exceptions remain visible.
 */
export function createRequestRecovery<Input, Result>(options: RequestRecovery<Input, Result>) {
  const execute = options.execute.bind(options);
  const recover = options.recover?.bind(options);
  const fallback = options.fallback.bind(options);
  return async (input: Input, signal: AbortSignal): Promise<RecoveredResult<Result>> => {
    signal.throwIfAborted();
    const errors: unknown[] = [];
    try {
      const value = await awaitWithSignal(execute(input, signal), signal);
      signal.throwIfAborted();
      return { value, source: 'execution', errors };
    } catch (error) {
      signal.throwIfAborted();
      errors.push(error);
    }
    if (recover) {
      try {
        const value = await awaitWithSignal(recover(input, errors[0], signal), signal);
        signal.throwIfAborted();
        return { value, source: 'recovery', errors };
      } catch (error) {
        signal.throwIfAborted();
        errors.push(error);
      }
    }
    const value = synchronous(
      fallback(input, Object.freeze([...errors])),
      'Request fallback must be synchronous',
    );
    signal.throwIfAborted();
    return { value, source: 'fallback', errors };
  };
}

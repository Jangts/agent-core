/**
 * Guards for contracts that require synchronous participants.
 *
 * Handlers, predicates and parsers are declared synchronous by contract. Detecting an
 * accidental async implementation early is cheaper than debugging an interleaved
 * execution, so every such call site passes its result through these helpers.
 *
 * Exports: `isPromiseLike`, `synchronous`, `assertion`, `maybeAssertion` and
 * `booleanResult`.
 */
/**
 * Test for a thenable without invoking it.
 *
 * @param value - Candidate value.
 * @returns True when the value carries a callable `then`.
 */
export function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

/**
 * Reject an accidentally asynchronous callback.
 *
 * A thenable is consumed before throwing so its eventual rejection cannot surface as an
 * unhandled rejection. Any side effects the callback already started cannot be undone.
 *
 * @param value - Result of the callback.
 * @param message - Message for the TypeError raised when the result is thenable.
 * @returns The same value, narrowed to a non-thenable.
 * @throws TypeError When the value is a thenable.
 */
export function synchronous<Value>(value: Value, message: string): Value {
  if (isPromiseLike(value)) {
    void Promise.resolve(value).catch(() => {});
    throw new TypeError(message);
  }
  return value;
}

/**
 * Require an assertion hook to finish with `undefined`.
 *
 * Returning a boolean is a common mistake that would silently pass; requiring `void`
 * makes a discarded decision fail loudly.
 *
 * @param value - Result of the assertion hook.
 * @param message - Message for the TypeError.
 * @throws TypeError When the result is thenable or not `undefined`.
 */
export function assertion(value: unknown, message: string): void {
  if (synchronous(value, message) !== undefined) throw new TypeError(message);
}

/**
 * Accept a synchronous assertion or await an actually asynchronous one.
 *
 * Only a thenable is awaited; synchronous results are validated immediately so callers
 * that rely on ordering do not yield to the event loop unnecessarily.
 *
 * @param value - Result of the assertion hook.
 * @param message - Message for the TypeError.
 * @returns Nothing, or a promise resolved once the awaited assertion passed.
 * @throws TypeError When the hook does not finish with `undefined`.
 */
export function maybeAssertion(value: unknown, message: string): void | Promise<void> {
  if (isPromiseLike(value))
    return Promise.resolve(value).then((result) => assertion(result, message));
  assertion(value, message);
}

/**
 * Require a synchronous boolean decision.
 *
 * Truthiness is not accepted: routing must receive an explicit `true` or `false` so a
 * predicate that forgets to return a value is reported instead of silently skipping.
 *
 * @param value - Result of the predicate.
 * @param message - Message for the thenable TypeError.
 * @param invalidMessage - Message for the non-boolean TypeError; defaults to `message`.
 * @returns The validated boolean.
 * @throws TypeError When the result is thenable or not boolean.
 */
export function booleanResult(value: unknown, message: string, invalidMessage = message): boolean {
  const result = synchronous(value, message);
  if (typeof result !== 'boolean') throw new TypeError(invalidMessage);
  return result;
}

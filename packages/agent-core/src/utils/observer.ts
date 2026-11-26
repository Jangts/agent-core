/**
 * Defensive delivery of observed values to App-supplied observers.
 *
 * Observation is optional and must never influence the observed operation, so the
 * value is cloned, failures are swallowed and returned promises are consumed.
 *
 * Exports: `observeSafely`.
 */
/**
 * Deliver a detached copy of a value to an observer.
 *
 * The clone prevents an observer from mutating execution state through a shared
 * reference. A value that cannot be structured-cloned is skipped entirely rather
 * than handed over by reference.
 *
 * @param observe - Observer callback, if one is installed.
 * @param value - Value to clone and deliver.
 * @returns Nothing; the observer may run asynchronously after this returns.
 */
export function observeSafely<Value>(
  observe: ((value: Value) => void | Promise<void>) | undefined,
  value: Value,
): void {
  if (!observe) return;
  try {
    const pending = observe(structuredClone(value));
    if (pending) void Promise.resolve(pending).catch(() => {});
  } catch {
    /* Observation is independent of the operation. */
  }
}

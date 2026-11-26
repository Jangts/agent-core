/**
 * Process-wide diagnostic outlet for `breakWhile` rejections.
 *
 * `rules.ts` owns the decision itself; this module only reports the rejection a host
 * asked to observe. Reporting is optional and strictly fire-and-forget, so a faulty
 * observer cannot change validation semantics.
 *
 * Exports: `configureBreakWhile` (install the observer) and `observeBreak` (notify it).
 */
import type { BreakCheck, BreakWhileConfig } from '../structs/utils/rules.js';

let onBreak: BreakWhileConfig['onBreak'];
// Re-entrancy guard: an observer that itself calls breakWhile would otherwise recurse
// until the stack overflows.
let notifying = false;

/**
 * Install the host-owned break observer.
 *
 * No logging or persistence is enabled by default; passing no argument (or an empty
 * config) removes any previously installed observer.
 *
 * @param config - Observation configuration; `onBreak` receives one frozen event per rejection.
 */
export function configureBreakWhile(config: BreakWhileConfig = {}): void {
  onBreak = config.onBreak;
}

/**
 * Notify the installed observer about a rejection.
 *
 * The original interruption is authoritative: observer failures, and rejections of the
 * promise an observer returns, are swallowed.
 *
 * @param error - The value that is about to be thrown by `breakWhile`.
 * @param tags - Call-site tags supplied by the caller of `breakWhile`.
 * @param rule - The failing check, whose own tags are merged into the reported set.
 */
export function observeBreak(
  error: unknown,
  tags: readonly string[],
  rule: Pick<BreakCheck, 'tags'>,
): void {
  if (!onBreak || notifying) return;
  notifying = true;
  try {
    const mergedTags = Object.freeze([...new Set([...tags, ...(rule.tags ?? [])])]);
    const pending = onBreak(Object.freeze({ error, tags: mergedTags }));
    if (pending) void Promise.resolve(pending).catch(() => {});
  } catch {
    // Observation is optional and cannot affect validation or error delivery.
  } finally {
    notifying = false;
  }
}

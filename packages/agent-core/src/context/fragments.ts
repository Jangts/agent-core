/**
 * Per-fragment validation and the shared input budget.
 *
 * On the fragment-based input path, each fragment declares where its text came from
 * (`sourceId`), how far it may be trusted, its lifetime, and a hard character budget. These
 * checks run before concatenation, so an oversized or mistrusted fragment fails instead of
 * being silently truncated or promoted into an instruction.
 *
 * Exports: `validateContextFragment`, `validateContextBudget`, and a shared text helper.
 */
import type { ContextFragment } from '../structs/context/fragments.js';
import { ValidationError } from '../structs/errors.js';
import { breakWhile } from '../utils/rules.js';

/**
 * Validate one fragment and return the text it contributes to the model input.
 *
 * @param fragment Declaration to check.
 * @param ids Optional accumulator of ids already seen. Callers validating a batch pass the
 *   same set for every fragment so duplicates are detected across the whole input.
 * @param checkBudget Whether this fragment's own `maxChars` is enforced. Disable only when the
 *   same serialized text has already been checked against the identical limit.
 * @returns The exact text the fragment contributes: the value when it is a string, otherwise
 *   the JSON form used for structured fields.
 * @throws Error when identity, trust, lifetime, role, the `maxChars` declaration or the value
 *   shape is invalid, or when untrusted content is declared as a system instruction.
 * @throws ValidationError when the serialized text exceeds `maxChars`; text is never truncated.
 */
export function validateContextFragment(
  fragment: ContextFragment,
  ids: Set<string> = new Set(),
  checkBudget = true,
): string {
  // Ids are stable keys in usage records and protected-context errors, so they start with a
  // lowercase letter and admit only characters that are safe in both positions.
  if (
    !/^[a-z][a-zA-Z0-9:._-]*$/.test(fragment.id) ||
    ids.has(fragment.id) ||
    !fragment.sourceId ||
    !['instruction', 'server', 'user', 'tool'].includes(fragment.trust) ||
    !['configuration', 'turn', 'step'].includes(fragment.lifetime) ||
    !['system', 'user'].includes(fragment.role) ||
    !Number.isSafeInteger(fragment.maxChars) ||
    fragment.maxChars < 1
  )
    throw new Error('Invalid context fragment');
  // Consumed before the later checks: a failed fragment must not leave its id reusable by a
  // retry through the same accumulator.
  ids.add(fragment.id);
  if (
    fragment.role === 'system' &&
    (fragment.trust === 'user' || fragment.trust === 'tool' || typeof fragment.value !== 'string')
  )
    throw new Error('Untrusted context cannot become a system instruction');
  if (
    typeof fragment.value !== 'string' &&
    (!fragment.value || typeof fragment.value !== 'object' || Array.isArray(fragment.value))
  )
    throw new Error('Invalid context value');
  // Structured values are measured as the JSON text that will be sent, so the declared budget
  // describes the payload rather than the in-memory object.
  const serialized =
    typeof fragment.value === 'string' ? fragment.value : JSON.stringify(fragment.value);
  if (checkBudget && serialized.length > fragment.maxChars)
    throw new ValidationError([
      {
        code: 'CONTEXT_BUDGET',
        message: `上下文片段 ${fragment.id} 超过预算；不截断原问题、约束与证据。`,
      },
    ]);
  return serialized;
}

/**
 * Enforce the character budget of the whole model input.
 *
 * @param inputChars Characters that will be sent; must be a non-negative safe integer.
 * @param maxInputChars Budget limit. `Infinity` is accepted as an explicit "no limit", which
 *   is why it is allowed in place of a safe integer.
 * @param exceeded Optional factory for the over-budget error. Support may pass one to keep its
 *   own message; Core otherwise raises a `CONTEXT_BUDGET` ValidationError.
 * @returns Nothing.
 * @throws TypeError when either count is not a non-negative integer.
 * @throws Error when the budget is exceeded: the `exceeded` result, or a ValidationError.
 */
export function validateContextBudget(
  inputChars: number,
  maxInputChars: number,
  exceeded?: (limit: number) => Error,
): void {
  breakWhile(
    !Number.isSafeInteger(inputChars) || inputChars < 0,
    () => new TypeError('Invalid context input size'),
  );
  breakWhile(
    maxInputChars !== Infinity && (!Number.isSafeInteger(maxInputChars) || maxInputChars < 0),
    () => new TypeError('Invalid context budget'),
  );
  if (inputChars > maxInputChars)
    throw (
      exceeded?.(maxInputChars) ??
      new ValidationError([
        { code: 'CONTEXT_BUDGET', message: `Model input exceeds ${maxInputChars} characters` },
      ])
    );
}

export { commonPrefixLength } from '../utils/text.js';
export type {
  ContextTrust,
  ContextLifetime,
  ContextFragment,
  ContextFragmentUsage,
  BuiltContext,
} from '../structs/context/fragments.js';

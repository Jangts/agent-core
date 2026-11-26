/**
 * Assembly of a `ContextPlan`: the Core-side step between App context processing and the
 * model input budget.
 *
 * A plan may carry trusted originals and an explicit mutation allow-list; when it does, the
 * current fragments are audited before assembly. Assembly itself only validates, merges and
 * measures. Reduction, grouping and model selection happen in App-side nodes before this
 * point.
 *
 * Exports: `assembleContextPlan`.
 */
import { auditContextChange } from './audit.js';
import { breakWhile } from '../utils/rules.js';
import { assembleFragments } from './assembly.js';
import { validateContextBudget } from './fragments.js';
import type { ContextPlan } from '../structs/context/processing.js';
import type { BuiltContext } from '../structs/context/fragments.js';

/**
 * Build the model input for a context plan.
 *
 * @param plan Fragments, their budget, optional protected user messages, and the optional
 *   originals/allow-list used for the structural audit.
 * @returns The assembled context, including appended user messages and the final character
 *   count that was checked against the budget.
 * @throws ValidationError when the audit fails, a fragment is invalid or over its budget, or
 *   the combined input exceeds the budget.
 * @throws Error when an additional message is not a user message.
 */
export function assembleContextPlan(plan: ContextPlan): BuiltContext {
  // Audit first: a structural violation must surface as a policy error rather than be masked
  // by a later budget or field-merge failure on fragments the plan did not allow to change.
  if (plan.originalFragments)
    auditContextChange(
      plan.originalFragments,
      plan.fragments,
      new Set(plan.mutableFragmentIds ?? []),
    );
  const context = assembleFragments([...plan.fragments], plan.maxInputChars);
  // Detach caller-owned messages: the built context must not change if the plan object is
  // reused or mutated after assembly.
  const additional = structuredClone([...(plan.additionalMessages ?? [])]);
  // Only user messages may be appended: the system instruction is fixed by the fragments above.
  breakWhile(
    additional.some((message) => message.role !== 'user' || typeof message.content !== 'string'),
    'Additional context must be user messages',
  );
  context.messages.push(...additional);
  // The per-fragment budget already passed; this re-check covers the appended messages, which
  // are outside every fragment's limit.
  context.inputChars += additional.reduce((sum, message) => sum + message.content.length, 0);
  validateContextBudget(context.inputChars, context.maxInputChars);
  return context;
}

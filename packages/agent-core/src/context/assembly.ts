/**
 * Assemble validated fragments into the messages sent to the model.
 *
 * The order is fixed: system text first, then one user message carrying structured fields as
 * JSON. Fragment metadata stays program-side in `fragmentUsage` and never becomes an
 * instruction. The finished message list is measured against the overall budget, so a caller
 * sees the same character count a transport will deliver.
 *
 * Exports: `assembleFragments`, plus a shared text helper and the fragment types.
 */
import { validateContextFragment, validateContextBudget } from './fragments.js';
import type {
  BuiltContext,
  ContextFragment,
  ContextFragmentUsage,
} from '../structs/context/fragments.js';
import { ValidationError } from '../structs/errors.js';
import type { ModelMessage } from '../structs/model/messages.js';

/**
 * Build the model input from fragments.
 *
 * Metadata remains program-side: data never becomes a system instruction.
 *
 * @param fragments Fragments in carriage order; ids must be unique across the list.
 * @param maxInputChars Total character budget for the resulting messages.
 * @returns Messages, per-fragment usage and the measured input size.
 * @throws Error when a fragment is invalid or duplicated, a user fragment carries a string
 *   value, or two user fragments declare the same field.
 * @throws ValidationError when a fragment or the assembled input exceeds its budget.
 */
export function assembleFragments(
  fragments: ContextFragment[],
  maxInputChars: number,
): BuiltContext {
  const ids = new Set<string>();
  // One merged object lets duplicate field names be rejected rather than silently overwritten.
  const fields: Record<string, unknown> = {};
  const system: string[] = [];
  const usage: ContextFragmentUsage[] = [];
  for (const fragment of fragments) {
    const serialized = validateContextFragment(fragment, ids);
    if (fragment.role === 'system') system.push(serialized);
    else {
      if (typeof fragment.value === 'string')
        throw new Error('User context must declare structured fields');
      for (const [key, value] of Object.entries(fragment.value)) {
        if (Object.hasOwn(fields, key)) throw new Error(`Duplicate context field: ${key}`);
        // defineProperty keeps names such as `__proto__` as own data instead of letting an
        // assignment reach the object prototype.
        Object.defineProperty(fields, key, { value, enumerable: true });
      }
    }
    usage.push({
      id: fragment.id,
      sourceId: fragment.sourceId,
      trust: fragment.trust,
      lifetime: fragment.lifetime,
      chars: serialized.length,
      maxChars: fragment.maxChars,
    });
  }
  // Blank-line separation keeps independently declared instructions readable and attributable
  // while still arriving as one system message.
  const messages: ModelMessage[] = [
    { role: 'system', content: system.join('\n\n') },
    { role: 'user', content: JSON.stringify(fields) },
  ];
  // Measured on the exact strings above, so the count matches what the transport will send.
  const inputChars = messages.reduce((sum, message) => sum + message.content.length, 0);
  validateContextBudget(
    inputChars,
    maxInputChars,
    () =>
      new ValidationError([
        {
          code: 'CONTEXT_BUDGET',
          message: `上下文超过${maxInputChars}字符；不截断原问题、约束与证据。`,
        },
      ]),
  );
  return { messages, fragmentUsage: usage, inputChars, maxInputChars };
}

export { commonPrefixLength } from '../utils/text.js';

export type {
  ContextTrust,
  ContextLifetime,
  ContextFragment,
  ContextFragmentUsage,
  BuiltContext,
} from '../structs/context/fragments.js';

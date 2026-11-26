/** Validate trusted reply defaults and render the same short instruction for every interaction. */
import type { ReplyGuidance } from '../structs/model/runtime.js';

const details = {
  brief:
    'Default to a concise reply: lead with the answer or conclusion and include only the support needed to use it. When summarizing, compress rather than expand the source.',
  normal:
    'Default to a direct answer with enough explanation to make it useful. Avoid repeating the question or adding unrelated background.',
  detailed:
    'Default to a thorough explanation, organized around the answer and relevant supporting details. Avoid repetition and unrelated background.',
} as const;

/** Copy and validate an App-owned default; arbitrary instruction text is not accepted. */
export function snapshotReplyGuidance(value?: ReplyGuidance): Readonly<ReplyGuidance> | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError('Invalid reply guidance');
  const detail = value.defaultDetail;
  if (
    Object.keys(value).some((key) => key !== 'defaultDetail') ||
    typeof detail !== 'string' ||
    !Object.hasOwn(details, detail)
  )
    throw new TypeError('Invalid reply guidance');
  return Object.freeze({ defaultDetail: detail });
}

/** Fixed SDK wording adds a default without overriding the user's task or output protocol. */
export function replyInstruction(value: ReplyGuidance): string {
  return `Reply guidance: ${details[value.defaultDetail]} Honor explicit user requests for detail, complete results, language, style and format. Preserve decision-relevant uncertainty, limitations and necessary warnings. Do not omit required output fields or violate the interaction's output protocol. These are reply defaults, not authorization to act.`;
}

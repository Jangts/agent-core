/**
 * Presentation Kit: template-bound reply formats and their shared checks.
 *
 * Place in the package: part of the `presentation` Kit. A format is declared only where the App
 * owns a template for the final reply; `resolve` returns `undefined` for every other reply, so the
 * caller has no output-format requirement and does not re-ask the model. Apps keep their own copy,
 * limits and checks; this module only compiles the declarations and evaluates failures.
 *
 * Exports: `defineReplyFormats`, `replyFormatChecks`, `mergeReplyBubbles`, and their types.
 */
import { breakWhile } from '../../utils/rules.js';
import type {
  CompiledReplyFormat,
  ReplyFormatCheck,
  ReplyFormatOptions,
} from '../../structs/kits/presentation/formats.js';

const validId = (id: string) => typeof id === 'string' && /^[a-z][a-z0-9-]*$/.test(id);

/**
 * Checks shared by text replies. Limits stay with the App template; only the comparison lives here.
 */
export const replyFormatChecks = Object.freeze({
  /**
   * Every bubble is non-empty and the total (primary text included) stays within the limit.
   *
   * @param totalLimit - Maximum bubble count including the primary text.
   * @returns The reusable `bubbles` check.
   */
  bubbles(totalLimit: number): ReplyFormatCheck {
    breakWhile(
      !Number.isSafeInteger(totalLimit) || totalLimit < 1,
      'Bubble limit must be a positive integer',
    );
    return Object.freeze({
      id: 'bubbles',
      description: `回复气泡总数不超过 ${totalLimit} 条且每条非空。`,
      accepts: (bubbles: readonly string[]) =>
        bubbles.length >= 1 &&
        bubbles.length <= totalLimit &&
        bubbles.every((text) => typeof text === 'string' && !!text.trim()),
    });
  },
  /**
   * The joined reply stays within the app's text budget.
   *
   * @param maxChars - Maximum total characters across bubbles.
   * @returns The reusable `text-budget` check.
   */
  textBudget(maxChars: number): ReplyFormatCheck {
    breakWhile(
      !Number.isSafeInteger(maxChars) || maxChars < 1,
      'Text budget must be a positive integer',
    );
    return Object.freeze({
      id: 'text-budget',
      description: `回复正文总长不超过 ${maxChars} 字符。`,
      accepts: (bubbles: readonly string[]) =>
        bubbles.reduce(
          (length, text) => length + (typeof text === 'string' ? text.length : 0),
          0,
        ) <= maxChars,
    });
  },
});

/**
 * Normalize a reply that has no declared format: drop blank bubbles and merge overflow into the
 * last allowed one. Text content is preserved.
 *
 * @param bubbles - Primary text followed by follow-up bubbles.
 * @param limit - Maximum number of bubbles to keep.
 * @returns Non-empty bubbles within the limit.
 */
export function mergeReplyBubbles(bubbles: readonly string[], limit: number): string[] {
  breakWhile(!Number.isSafeInteger(limit) || limit < 1, 'Bubble limit must be a positive integer');
  const kept = bubbles.map((text) => text.trim()).filter(Boolean);
  // 超出部分按原顺序合并到最后一条允许的气泡，不改变正文内容。
  if (kept.length > limit) kept.push(kept.splice(limit - 1).join('\n\n'));
  return kept;
}

/**
 * Compile reply formats so that checks run only for templates the current turn uses.
 *
 * @param options - Declared formats and the checks their ids refer to.
 * @returns A frozen catalog with `resolve(context)`.
 * @throws TypeError For duplicate or invalid ids, a format without checks, an unknown check id,
 *   or a non-function `when`/`accepts`.
 */
export function defineReplyFormats<Context = unknown>(options: ReplyFormatOptions<Context>) {
  const { formats, checks } = options;
  breakWhile(!formats?.length || !checks?.length, 'Reply formats require formats and checks');
  const checkMap = new Map<string, ReplyFormatCheck>();
  for (const check of checks) {
    breakWhile(
      !validId(check.id) || checkMap.has(check.id) || typeof check.accepts !== 'function',
      'Invalid reply format check',
    );
    checkMap.set(check.id, Object.freeze({ ...check, accepts: check.accepts.bind(check) }));
  }
  const seen = new Set<string>();
  const compiled: (CompiledReplyFormat & { when: (context: Context) => boolean })[] = formats.map(
    (format) => {
      breakWhile(
        !validId(format.id) ||
          seen.has(format.id) ||
          typeof format.when !== 'function' ||
          !format.checks?.length ||
          format.checks.some((id) => !checkMap.has(id)),
        'Invalid reply format',
      );
      seen.add(format.id);
      const required = Object.freeze([...format.checks]);
      return Object.freeze({
        id: format.id,
        description: format.description,
        checks: required,
        when: format.when,
        inspect(bubbles: readonly string[]) {
          return required.map((id) => checkMap.get(id)!).filter((check) => !check.accepts(bubbles));
        },
      });
    },
  );
  return Object.freeze({
    /** The template this turn uses, or `undefined` when it has no output-format requirement. */
    resolve(context: Context): CompiledReplyFormat | undefined {
      return compiled.find((format) => format.when(context));
    },
  });
}
export type {
  CompiledReplyFormat,
  ReplyFormatCheck,
  ReplyFormatDefinition,
  ReplyFormatOptions,
} from '../../structs/kits/presentation/formats.js';

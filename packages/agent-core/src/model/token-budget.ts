/**
 * Token accounting for inputs that must fit a context window.
 *
 * Character limits alone cannot protect a provider call, so a host that supplies a
 * token counter also declares the context window and a safety margin. The limit
 * reserves room for the requested output before any input is counted.
 *
 * Exports: `validateModelTokenBudget`, `modelInputTokenLimit`, `countModelInput`,
 * `enforceModelInputTokens` and `modelInputMessages`.
 */
import type { ModelTokenBudget } from '../structs/model/runtime.js';
import type { ModelMessage, ModelOptions } from '../structs/model/messages.js';
import { ValidationError } from '../structs/errors.js';
import { breakWhile } from '../utils/rules.js';
import { synchronous } from '../utils/synchronous.js';
const invalid = (message: string) => new ValidationError([{ code: 'MODEL_TOKEN_BUDGET', message }]);

/**
 * Validate a host-supplied token budget contract.
 *
 * @param budget - Budget to check: counter id, context window, optional safety margin, counter.
 * @throws ValidationError When any field is missing or out of range.
 */
export function validateModelTokenBudget(budget: ModelTokenBudget): void {
  breakWhile(
    !budget.counterId ||
      !Number.isSafeInteger(budget.contextWindowTokens) ||
      budget.contextWindowTokens < 1 ||
      !Number.isSafeInteger(budget.safetyMarginTokens ?? 0) ||
      (budget.safetyMarginTokens ?? 0) < 0 ||
      typeof budget.countTokens !== 'function',
    invalid('Invalid model token budget'),
  );
}
/**
 * Compute how many input tokens remain for one call.
 *
 * The requested output tokens and the safety margin are subtracted from the context
 * window, so a call that reserves more than the window is rejected before counting.
 *
 * @param budget - Declared context window and safety margin.
 * @param outputTokens - Tokens reserved for the completion.
 * @returns The positive input token allowance.
 * @throws ValidationError When the reservation is invalid or leaves no input capacity.
 */
export function modelInputTokenLimit(budget: ModelTokenBudget, outputTokens: number): number {
  const limit = budget.contextWindowTokens - outputTokens - (budget.safetyMarginTokens ?? 0);
  breakWhile(
    !Number.isSafeInteger(outputTokens) || outputTokens < 1 || limit < 1,
    invalid('No input capacity after reserving output and safety margin'),
  );
  return limit;
}
/**
 * Count the tokens of a prepared request.
 *
 * The counter observes a request, so both messages and declarations are cloned before
 * being handed over: accidental mutations by the counter must not rewrite the provider
 * input. The returned count must itself be a nonnegative safe integer.
 *
 * @param budget - Budget supplying the counter.
 * @param messages - Effective messages, including the merged instruction.
 * @param options - Function declarations and JSON mode as they will be sent.
 * @returns The token count reported by the host counter.
 * @throws ValidationError When the counter returns an unusable number.
 */
export function countModelInput(
  budget: ModelTokenBudget,
  messages: readonly ModelMessage[],
  options: Pick<ModelOptions, 'functions' | 'json' | 'outputSchema'>,
): number {
  // A counter observes a request; accidental mutations must not rewrite the provider input.
  const snapshot = messages.map((message) => ({
    ...message,
    ...(message.parts ? { parts: structuredClone(message.parts) } : {}),
    ...(message.images ? { images: message.images.map((image) => ({ ...image })) } : {}),
    ...(message.toolCalls ? { toolCalls: message.toolCalls.map((call) => ({ ...call })) } : {}),
  }));
  const count = synchronous(
    budget.countTokens({
      messages: snapshot,
      functions: options.functions ? structuredClone(options.functions) : undefined,
      json: options.json,
      ...(options.outputSchema ? { outputSchema: structuredClone(options.outputSchema) } : {}),
    }),
    'Token counters must be synchronous',
  );
  breakWhile(
    !Number.isSafeInteger(count) || count < 0,
    invalid('Token counter must return a nonnegative integer'),
  );
  return count;
}
/**
 * Enforce the measured input against its token allowance.
 *
 * @param count - Measured input tokens.
 * @param limit - Allowance from `modelInputTokenLimit`.
 * @throws ValidationError When the input exceeds the allowance.
 */
export function enforceModelInputTokens(count: number, limit: number): void {
  breakWhile(
    count > limit,
    invalid(`Model input uses ${count} tokens; available input budget is ${limit}`),
  );
}
/**
 * Merge an interaction instruction into the message list.
 *
 * An existing system message keeps its position and receives the instruction as a new
 * paragraph; otherwise a system message is prepended. Reusing the same function for
 * preflight measurement and the provider call is what makes instructions count exactly
 * once.
 *
 * @param base - Caller messages; not mutated.
 * @param instruction - Optional instruction to merge.
 * @returns A new message array.
 */
export function modelInputMessages(
  base: readonly ModelMessage[],
  instruction?: string,
): ModelMessage[] {
  if (!instruction) return [...base];
  const index = base.findIndex((message) => message.role === 'system');
  return index < 0
    ? [{ role: 'system', content: instruction }, ...base]
    : base.map((message, position) =>
        position === index
          ? {
              ...message,
              content: `${message.content}\n\n${instruction}`,
              ...(message.parts
                ? { parts: [...message.parts, { type: 'text' as const, text: instruction }] }
                : {}),
            }
          : message,
      );
}

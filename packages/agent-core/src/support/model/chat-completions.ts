/**
 * OpenAI-compatible chat-completions wire mapping.
 *
 * Pure format conversion: request fields, streamed deltas and message payloads. Credentials, HTTP,
 * retries and business policy stay with the host; nothing here reads configuration or performs I/O.
 *
 * Main exports: `chatCompletionFunctionOptions`, `chatCompletionParts` and
 * `chatCompletionMessages`.
 */
import type {
  ModelImage,
  ModelMessage,
  ModelOptions,
  ModelPart,
} from '../../structs/model/messages.js';
import type { ProviderMessage, ProviderToolCall } from '../../structs/support/model/messages.js';
import { ValidationError } from '../../structs/errors.js';

/**
 * Build the tool-selection request fields for a function-calling stage.
 *
 * The adapter expects exactly one function call per response, so tool use is required and parallel
 * calls are disabled.
 *
 * @param options Model options; absent `functions` means the stage has no tools.
 * @returns Tool fields to merge into the request body, or an empty object.
 * @throws {TypeError} When `functions` is present but empty.
 */
export function chatCompletionFunctionOptions(options: ModelOptions): Record<string, unknown> {
  if (!options.functions) return {};
  if (!options.functions.length) throw new TypeError('Empty model function catalog');
  if (
    options.toolChoice !== undefined &&
    !['auto', 'required', 'none'].includes(options.toolChoice)
  )
    throw new TypeError('Invalid toolChoice');
  if (
    options.parallelToolCalls !== undefined &&
    options.parallelToolCalls !== 'omit' &&
    typeof options.parallelToolCalls !== 'boolean'
  )
    throw new TypeError('Invalid parallelToolCalls');
  return {
    tools: options.functions.map((fn) => ({ type: 'function', function: fn })),
    tool_choice: options.toolChoice ?? 'required',
    ...(options.parallelToolCalls === 'omit'
      ? {}
      : { parallel_tool_calls: options.parallelToolCalls ?? false }),
  };
}

/**
 * Convert one streamed `choice.delta` into Core model parts.
 *
 * Text is emitted only when non-empty; each tool-call fragment carries its index so Core can
 * reassemble arguments that arrive across chunks.
 *
 * @param delta Raw `delta` value from a chat-completions chunk.
 * @returns Text and function-call-delta parts; an unrelated shape yields an empty array.
 * @throws {ValidationError} When `tool_calls` or one of its entries has an invalid shape.
 */
export function chatCompletionParts(delta: unknown): ModelPart[] {
  const fail = (): never => {
    throw new ValidationError([
      { code: 'MODEL_PROTOCOL', message: 'Invalid function call stream' },
    ]);
  };
  if (!delta || typeof delta !== 'object' || Array.isArray(delta)) return [];
  const value = delta as Record<string, unknown>;
  const parts: ModelPart[] = [];
  if (typeof value.content === 'string' && value.content) parts.push(value.content);
  if (value.tool_calls !== undefined) {
    if (!Array.isArray(value.tool_calls)) fail();
    for (const item of value.tool_calls as unknown[]) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) fail();
      const call = item as Record<string, unknown>;
      if (
        !Number.isInteger(call.index) ||
        (call.index as number) < 0 ||
        (call.id !== undefined && (typeof call.id !== 'string' || !call.id)) ||
        (call.type !== undefined && call.type !== 'function')
      )
        fail();
      if (
        call.function !== undefined &&
        (!call.function || typeof call.function !== 'object' || Array.isArray(call.function))
      )
        fail();
      const fn = (call.function ?? {}) as Record<string, unknown>;
      if (
        (fn.name !== undefined && typeof fn.name !== 'string') ||
        (fn.arguments !== undefined && typeof fn.arguments !== 'string')
      )
        fail();
      parts.push({
        type: 'function-call-delta',
        index: call.index as number,
        ...(call.id !== undefined ? { id: call.id as string } : {}),
        ...(fn.name !== undefined ? { name: fn.name as string } : {}),
        ...(fn.arguments !== undefined ? { arguments: fn.arguments as string } : {}),
      });
    }
  }
  return parts;
}

/**
 * Map Core and provider messages to chat-completions message payloads.
 *
 * Only declared message fields are sent. Assistant tool declarations become nested
 * `tool_calls`, and tool results become `tool_call_id`; both are rewritten explicitly rather than
 * forwarded as-is. Messages with images become a content-block array; images are accepted only on
 * user messages and only as `http(s)` or `data:image` URLs.
 *
 * @param messages Messages in prompt order, either Core messages or provider tool-thread messages.
 * @returns Wire messages with `images` removed and content blocks where needed.
 * @throws {TypeError} When a role and field do not belong together, or an image URL or detail level
 *   is invalid.
 */
export function chatCompletionMessages(messages: readonly (ModelMessage | ProviderMessage)[]) {
  return messages.map((message) => {
    const {
      role,
      content,
      images,
      toolCalls,
      toolCallId,
    }: {
      role: string;
      content: string;
      images?: readonly ModelImage[];
      toolCalls?: readonly ProviderToolCall[];
      toolCallId?: string;
    } = message;
    if (!['system', 'user', 'assistant', 'tool'].includes(role) || typeof content !== 'string')
      throw new TypeError('Invalid provider message role or content');
    if (toolCallId !== undefined && role !== 'tool')
      throw new TypeError('Tool results require the tool role');
    if (role === 'tool' && (typeof toolCallId !== 'string' || !toolCallId))
      throw new TypeError('Tool results require a tool call id');
    if (toolCalls !== undefined && role !== 'assistant')
      throw new TypeError('Tool calls require an assistant message');
    const wire: Record<string, unknown> = { role, content };
    if (toolCallId !== undefined) wire.tool_call_id = toolCallId;
    if (toolCalls !== undefined)
      wire.tool_calls = toolCalls.map((call) => {
        if (
          !call ||
          typeof call.id !== 'string' ||
          !call.id ||
          typeof call.name !== 'string' ||
          !call.name ||
          typeof call.arguments !== 'string'
        )
          throw new TypeError('Invalid tool call');
        return {
          id: call.id,
          type: 'function',
          function: { name: call.name, arguments: call.arguments },
        };
      });
    if (!images?.length) return wire;
    if (role !== 'user') throw new TypeError('Images require a user message');
    for (const image of images) {
      if (
        !image.url ||
        !/^(https?:\/\/|data:image\/)/i.test(image.url) ||
        (image.detail !== undefined && !['auto', 'low', 'high', 'original'].includes(image.detail))
      )
        throw new TypeError('Invalid model image');
    }
    return {
      ...wire,
      content: [
        { type: 'text', text: content },
        ...images.map((image) => ({ type: 'image_url', image_url: image })),
      ],
    };
  });
}

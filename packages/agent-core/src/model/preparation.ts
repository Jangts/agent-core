/**
 * One-shot preparation and measurement of a model request.
 *
 * Preparation freezes the interaction's options, instruction and response factory before
 * any counting happens; measurement then derives every size from that same snapshot.
 * Splitting the two phases is what guarantees that the numbers checked against the
 * budget are the numbers actually sent to the provider.
 *
 * Exports: `prepareModelInteraction` and `preparedInputSize`.
 */
import { snapshotReplyGuidance, replyInstruction } from './reply-guidance.js';
import { modelInputMessages } from './token-budget.js';
import { synchronous } from '../utils/synchronous.js';
import { freezeSchema } from '../utils/object.js';
import { snapshotModelOptions } from './options.js';
import type { ModelInteractionDefinition } from '../structs/model/runtime.js';
import type { PreparedModelInteraction } from '../structs/model/interactions.js';
import type { ModelMessage, ModelImage, ModelToolCall } from '../structs/model/messages.js';
import { breakWhile } from '../utils/rules.js';

// Only snapshots owned and frozen by this module are reusable across measurements.
// Keyed by the frozen options object so a repeated measure of the same prepared call
// does not re-serialize a large function schema.
const functionSizes = new WeakMap<object, number>();

/**
 * Validate and freeze one image reference.
 *
 * `detail` is restricted to the values understood by every supported provider so the
 * wire payload never carries an unvalidated hint.
 *
 * @param image - Candidate image reference.
 * @returns A frozen image object without an undefined `detail`.
 * @throws TypeError When the shape or `detail` value is invalid.
 */
function snapshotImage(image: ModelImage): ModelImage {
  breakWhile(
    !image || typeof image !== 'object' || Array.isArray(image),
    () => new TypeError('Invalid model image'),
  );
  const { url, detail } = image;
  breakWhile(
    typeof url !== 'string' ||
      !url ||
      (detail !== undefined && !['auto', 'low', 'high', 'original'].includes(detail)),
    () => new TypeError('Invalid model image'),
  );
  return Object.freeze({ url, ...(detail === undefined ? {} : { detail }) });
}

/**
 * Validate and freeze one assistant tool declaration.
 *
 * @param call - Candidate tool call.
 * @returns A frozen tool call with only the declared fields.
 * @throws TypeError When the id, name or raw arguments are invalid.
 */
function snapshotToolCall(call: ModelToolCall): ModelToolCall {
  breakWhile(
    !call || typeof call !== 'object' || Array.isArray(call),
    () => new TypeError('Invalid model tool call'),
  );
  const { id, name, arguments: args } = call;
  breakWhile(
    typeof id !== 'string' || !id || typeof name !== 'string' || !name || typeof args !== 'string',
    () => new TypeError('Invalid model tool call'),
  );
  return Object.freeze({ id, name, arguments: args });
}

/**
 * Snapshot a dynamic interaction once, preserving its collector factory receiver.
 *
 * The interaction gets the stage id so it can specialize its instruction. Its options
 * are copied, its function declarations cloned, and the whole snapshot frozen before
 * the response factory is bound to the prepared source.
 *
 * @param interaction - Registered interaction definition.
 * @param stageId - Stage the call belongs to.
 * @returns A frozen prepared interaction reused for measurement and the provider call.
 * @throws TypeError When preparation is asynchronous or produces an invalid shape.
 */
export function prepareModelInteraction(
  interaction: ModelInteractionDefinition,
  stageId: string,
  replyGuidance?: import('../structs/model/runtime.js').ReplyGuidance,
): PreparedModelInteraction & {
  readonly replyGuidance?: import('../structs/model/runtime.js').ReplyGuidance;
} {
  const source = synchronous(
    interaction.prepare(stageId),
    'Model interaction preparation must be synchronous',
  );
  if (!source) throw new TypeError('Invalid prepared model interaction');
  const { schemaChars, instruction, createResponse } = source;
  if (
    !Number.isSafeInteger(schemaChars) ||
    schemaChars < 0 ||
    typeof createResponse !== 'function' ||
    (instruction !== undefined && typeof instruction !== 'string')
  )
    throw new TypeError('Invalid prepared model interaction');
  const options = snapshotModelOptions(source.options);
  if (options.functions) options.functions = structuredClone(options.functions);
  if (options.outputSchema) options.outputSchema = structuredClone(options.outputSchema);
  if (options.continuation) options.continuation = structuredClone(options.continuation);
  freezeSchema(options);
  const guidance = snapshotReplyGuidance(replyGuidance);
  const guidanceText = guidance ? replyInstruction(guidance) : undefined;
  const prepared = Object.freeze({
    ...(guidance ? { replyGuidance: guidance } : {}),
    options,
    schemaChars,
    instruction: guidanceText
      ? [instruction, guidanceText].filter(Boolean).join('\n\n')
      : instruction,
    createResponse: createResponse.bind(source),
  });
  if (options.functions)
    functionSizes.set(options.functions, JSON.stringify(options.functions).length);
  return prepared;
}

/**
 * Measure a prepared request into its character accounting.
 *
 * Each message is read once into a frozen snapshot before any sum is computed, so
 * caller mutations and extra getters cannot change the request between accounting,
 * output backpressure and provider I/O.
 *
 * The instruction is merged into the effective messages exactly once, mirroring what
 * the provider receives; `instructionChars` is therefore derived from that merge rather
 * than measured separately. `transportChars` is the larger of the interaction's declared
 * schema size and the instruction plus in-message schema size, because an interaction may
 * declare native declarations instead of embedding them.
 *
 * @param base - Caller messages; must be a message array.
 * @param prepared - Result of `prepareModelInteraction` for the same call.
 * @returns Frozen effective messages plus per-part and total character counts.
 * @throws TypeError When the message array or any message is invalid.
 */
export function preparedInputSize(
  base: readonly ModelMessage[],
  prepared: PreparedModelInteraction,
) {
  // Read only protocol fields, once. Caller mutations and extra getters cannot
  // change the request between accounting, output backpressure and Provider I/O.
  breakWhile(!Array.isArray(base), () => new TypeError('Model messages must be an array'));
  const snapshot = Array.from(base, (message) => {
    breakWhile(
      !message || typeof message !== 'object' || Array.isArray(message),
      () => new TypeError('Invalid model message'),
    );
    const { role, content, images, toolCalls, toolCallId, parts } = message;
    const assistant = role === 'assistant';
    const tool = role === 'tool';
    breakWhile(
      !['system', 'user', 'assistant', 'tool'].includes(role) ||
        typeof content !== 'string' ||
        (images !== undefined && (!Array.isArray(images) || role !== 'user')) ||
        (toolCalls !== undefined && (!Array.isArray(toolCalls) || !assistant)) ||
        (toolCallId !== undefined &&
          (!tool || typeof toolCallId !== 'string' || toolCallId.length === 0)) ||
        (tool && (typeof toolCallId !== 'string' || toolCallId.length === 0)),
      () => new TypeError('Invalid model message'),
    );
    return Object.freeze({
      role,
      content,
      ...(parts === undefined ? {} : { parts: snapshotContent(parts) }),
      ...(images === undefined ? {} : { images: Object.freeze(Array.from(images, snapshotImage)) }),
      ...(toolCalls === undefined
        ? {}
        : { toolCalls: Object.freeze(Array.from(toolCalls, snapshotToolCall)) }),
      ...(toolCallId === undefined ? {} : { toolCallId }),
    });
  });
  const messages = Object.freeze(
    modelInputMessages(snapshot, prepared.instruction).map((message) => Object.freeze(message)),
  );
  const contentChars = snapshot.reduce((sum, message) => sum + message.content.length, 0);
  const messageChars = snapshot.reduce(
    (sum, message) =>
      sum +
      (message.parts?.reduce(
        (total, part) => total + (part.type === 'text' ? part.text.length : part.url.length),
        0,
      ) ?? 0) +
      message.content.length +
      (message.toolCalls?.reduce(
        (callSum, call) => callSum + call.id.length + call.name.length + call.arguments.length,
        0,
      ) ?? 0) +
      (message.toolCallId?.length ?? 0),
    0,
  );
  const instructionChars =
    messages.reduce((sum, message) => sum + message.content.length, 0) - contentChars;
  const functions = prepared.options.functions;
  const schemaChars = functions
    ? (functionSizes.get(functions) ?? JSON.stringify(functions).length)
    : 0;
  const outputSchemaChars = prepared.options.outputSchema
    ? JSON.stringify(prepared.options.outputSchema).length
    : 0;
  const transportChars = Math.max(
    prepared.schemaChars,
    instructionChars + schemaChars + outputSchemaChars,
  );
  return {
    messages,
    messageChars,
    instructionChars,
    schemaChars: schemaChars + outputSchemaChars,
    transportChars,
    inputChars: messageChars + instructionChars + schemaChars + outputSchemaChars,
  };
}

/** Clone and validate ordered content without retaining mutable host objects. */
function snapshotContent(
  parts: readonly import('../structs/model/messages.js').ModelContentPart[],
): readonly import('../structs/model/messages.js').ModelContentPart[] {
  if (!Array.isArray(parts)) throw new TypeError('Invalid model content parts');
  return Object.freeze(
    parts.map((part): import('../structs/model/messages.js').ModelContentPart => {
      if (!part || typeof part !== 'object') throw new TypeError('Invalid model content part');
      if (part.type === 'text') {
        if (typeof part.text !== 'string') throw new TypeError('Invalid text content');
        return Object.freeze({ type: 'text' as const, text: part.text });
      }
      if (
        !['image', 'audio', 'video', 'file'].includes(part.type) ||
        typeof part.url !== 'string' ||
        !part.url ||
        (part.mimeType !== undefined && typeof part.mimeType !== 'string')
      )
        throw new TypeError('Invalid media content');
      return Object.freeze({
        type: part.type,
        url: part.url,
        ...(part.mimeType === undefined ? {} : { mimeType: part.mimeType }),
      });
    }),
  );
}

/** @deprecated Use prepareModelInteraction. */
export { prepareModelInteraction as prepareModelTransport };

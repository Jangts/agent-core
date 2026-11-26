/**
 * Redaction of model messages before they are observed or persisted.
 *
 * Diagnostics may keep message text, but image bytes and raw tool arguments must never leave
 * the process, even when full content logging is enabled.
 *
 * Exports: `modelMessageDiagnostics`.
 */
import type { ModelMessage } from '../structs/model/messages.js';

/**
 * Replace every image payload and raw tool argument with a placeholder.
 *
 * Only the `url` is substituted; the `detail` hint is kept because it is small and
 * explains how the image was interpreted. Tool call ids and names remain because they
 * identify the proposal; raw arguments are redacted. The input array is not mutated.
 *
 * @param messages - Messages about to be reported.
 * @returns New message objects with redacted images and tool arguments.
 */
export function modelMessageDiagnostics(messages: readonly ModelMessage[]): ModelMessage[] {
  return messages.map((message) => ({
    ...message,
    ...(message.parts
      ? {
          parts: message.parts.map((part) =>
            part.type === 'text' ? part : { type: part.type, url: '[media omitted]' },
          ),
        }
      : {}),
    ...(message.images
      ? {
          images: message.images.map((image) => ({ ...image, url: '[image omitted]' })),
        }
      : {}),
    ...(message.toolCalls
      ? {
          toolCalls: message.toolCalls.map((call) => ({
            id: call.id,
            name: call.name,
            arguments: '[tool arguments omitted]',
          })),
        }
      : {}),
  }));
}

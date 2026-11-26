/**
 * Detached copies of context input objects.
 *
 * A snapshot reads plain metadata once and deep-clones the value, so later caller mutation cannot
 * change a plan that is already being processed. Prototype getters are read normally, because they
 * are valid implementation choices.
 *
 * Main exports: `snapshotFragment` and `snapshotMessage`.
 */
import type { ContextFragment } from '../../structs/context/fragments.js';
import type { ModelMessage } from '../../structs/model/messages.js';

/**
 * Copy one fragment with a cloned value.
 *
 * @param fragment Fragment to copy; getters are read once per field.
 * @returns A new plain fragment with the same metadata and a deep-cloned value.
 */
export function snapshotFragment(fragment: ContextFragment): ContextFragment {
  const { id, sourceId, trust, lifetime, maxChars, role, value } = fragment;
  return { id, sourceId, trust, lifetime, maxChars, role, value: structuredClone(value) };
}
/**
 * Copy one model message and validate its image descriptors.
 *
 * @param message Message to copy.
 * @returns A new message with only the supported fields; `detail` is preserved when present.
 * @throws {TypeError} When `images` is not an array, or an image has no URL string or an
 *   unsupported `detail` value.
 */
export function snapshotMessage(message: ModelMessage): ModelMessage {
  const { role, content, images, toolCalls, toolCallId } = message;
  if (images !== undefined && !Array.isArray(images))
    throw new TypeError('Context images must be an array');
  return {
    role,
    content,
    ...(images === undefined
      ? {}
      : {
          images: images.map((image) => {
            const { url, detail } = image;
            if (
              typeof url !== 'string' ||
              (detail !== undefined && !['auto', 'low', 'high', 'original'].includes(detail))
            )
              throw new TypeError('Invalid context image');
            return { url, ...(detail === undefined ? {} : { detail }) };
          }),
        }),
    ...(toolCalls === undefined
      ? {}
      : {
          toolCalls: toolCalls.map((call) => ({
            id: call.id,
            name: call.name,
            arguments: call.arguments,
          })),
        }),
    ...(toolCallId === undefined ? {} : { toolCallId }),
  };
}

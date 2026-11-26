/** Provider extensions may adjust supplier behavior without replacing Core-owned request fields. */
import { freezeSchema } from '../../../utils/object.js';
const protectedFields = new Set([
  'model',
  'input',
  'messages',
  'contents',
  'system',
  'system_instruction',
  'systemInstruction',
  'stream',
  'stream_options',
  'tools',
  'tool_choice',
  'toolConfig',
  'generationConfig',
  'generation_config',
  'max_tokens',
  'max_completion_tokens',
  'max_output_tokens',
  'maxOutputTokens',
  'response_format',
  'text',
  'instructions',
  'parallel_tool_calls',
  'output_format',
  'prompt',
  'cachedContent',
  'cached_content',
  'conversation',
  'conversation_id',
  'thread_id',
  'background',
  'n',
  'candidateCount',
  'candidate_count',
  'include',
  'store',
  'previous_response_id',
  'previous_interaction_id',
  'metadata',
  'user',
  'user_id',
  'apiKey',
  'api_key',
  'baseUrl',
  'protocol',
  'headers',
  'request',
  'toJSON',
  '__proto__',
  'constructor',
  'prototype',
]);
/** Snapshot and validate once. No function, getter or mutable caller object reaches request assembly. */
export function snapshotModelRequestBody(
  input: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new TypeError('Provider requestBody must be an object');
  const snapshot = structuredClone(input);
  for (const [key, value] of Object.entries(snapshot)) {
    if (protectedFields.has(key))
      throw new TypeError(`Provider requestBody cannot override ${key}`);
    if (key === 'output_config') {
      if (
        !value ||
        typeof value !== 'object' ||
        Array.isArray(value) ||
        Object.keys(value).some((name) => name !== 'effort')
      )
        throw new TypeError('Provider requestBody.output_config may only set effort');
    }
  }
  freezeSchema(snapshot);
  return snapshot;
}
/** Apply validated extension data while preserving generated output_config.format. */
export function extendModelRequest(
  body: Record<string, unknown>,
  extensions: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return {
    ...body,
    ...extensions,
    ...(extensions.output_config
      ? {
          output_config: {
            ...((body.output_config as object) ?? {}),
            ...(extensions.output_config as object),
          },
        }
      : {}),
  };
}

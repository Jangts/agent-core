/**
 * Model interaction creators for plain text and typed JSON values.
 *
 * Both produce Core `ModelInteractionDefinition` objects with an ID, so a runner can select them by
 * name. Neither invokes a model: preparation, response assembly and parsing stay in Core.
 *
 * Main exports: `createTextInteraction`, `createJsonInteraction`, `createModelInteraction` and the
 * interaction registration type.
 */
import { snapshotSchemaAdapter } from '../../utils/schema-adapter.js';
import { snapshotModelOptions } from '../../model/options.js';
import { modelProtocolError } from '../../utils/model-protocol.js';
import { createPlainTextInteraction } from '../../model/transports.js';
import type { ModelOptions } from '../../structs/model/messages.js';
import type { ModelInteractionDefinition } from '../../structs/model/runtime.js';
import { createModelInteraction as createSelectionTransport } from '../../model/selection-transport.js';
import {
  createModelToolInteraction,
  type ModelToolInteractionRegistration,
  type DecodedModelToolResponse,
} from './session.js';
import type { ModelInteractionRegistration } from '../../structs/model/interactions.js';

/** Select a response shape while retaining the same source, preparation and runner contract. */
export function createModelInteraction<
  Result = DecodedModelToolResponse,
  const Id extends string = string,
>(
  registration: ModelToolInteractionRegistration & { readonly id: Id },
): ModelInteractionDefinition<DecodedModelToolResponse> & { readonly id: Id };
export function createModelInteraction<Result, const Id extends string = string>(
  registration: ModelInteractionRegistration<Result> & {
    readonly id: Id;
    readonly response?: 'selection';
  },
): ModelInteractionDefinition<Result> & { readonly id: Id };
export function createModelInteraction(
  registration:
    | (ModelInteractionRegistration & { readonly response?: 'selection' })
    | ModelToolInteractionRegistration,
): ModelInteractionDefinition {
  if (registration.response === 'tools' || registration.response === 'session') {
    if (registration.adapter !== undefined || registration.requireStrictArguments !== undefined)
      throw new TypeError(
        'Session responses use native calls and do not accept a selection adapter',
      );
    return createModelToolInteraction(registration);
  }
  if (registration.response !== undefined && registration.response !== 'selection')
    throw new TypeError('Invalid model response shape');
  return createSelectionTransport(registration);
}

export {
  prepareModelToolInteraction,
  type PreparedModelToolInteraction,
  type DecodedModelResponseToolCall,
  type DecodedModelToolResponse,
  type ModelToolInteractionOptions,
  type ModelToolInteractionRegistration,
} from './session.js';

/**
 * Create a plain-text interaction that trims the assembled response.
 *
 * @param definition Transport ID and optional temperature.
 * @returns A frozen Core interaction definition typed as string output.
 */
export function createTextInteraction<const Id extends string>(definition: {
  readonly id: Id;
  readonly options?: Pick<ModelOptions, 'temperature'>;
  readonly trim?: boolean;
}): ModelInteractionDefinition<string> & { readonly id: Id } {
  return createPlainTextInteraction(definition.id, definition.options, definition.trim);
}
export type { ModelInteractionRegistration } from '../../structs/support/model/interactions.js';

/**
 * Create a typed JSON interaction without a capability-selection envelope.
 *
 * The interaction embeds the JSON Schema in the instruction and requires the response to be one
 * complete JSON value. The returned response parser rejects native call events and invalid JSON,
 * then validates the value through the supplied schema.
 *
 * @param definition Transport ID, output schema and optional temperature/json settings.
 * @returns A frozen Core interaction definition typed as `Output`.
 * @throws {TypeError} When the ID is blank or the schema adapter cannot be snapshotted.
 */
export function createJsonInteraction<Output, const Id extends string = string>(definition: {
  readonly id: Id;
  readonly outputSchema: import('../../structs/common.js').SchemaAdapter<Output>;
  readonly options?: Pick<ModelOptions, 'temperature' | 'json'>;
}): ModelInteractionDefinition<Output> & { readonly id: Id } {
  const { id, outputSchema, options } = definition;
  if (typeof id !== 'string' || !id.trim()) throw new TypeError('JSON interaction requires an ID');
  const schema = snapshotSchemaAdapter(outputSchema);
  const settings = Object.freeze({
    ...snapshotModelOptions({ temperature: options?.temperature, json: options?.json ?? true }),
  });
  const instruction =
    'Return exactly one complete JSON value matching this JSON Schema: ' +
    JSON.stringify(schema.jsonSchema) +
    '\nReturn the value itself, without prose, fences, a schema document or a capability-selection envelope.';
  return Object.freeze({
    id,
    prepare() {
      return {
        options: settings,
        instruction,
        schemaChars: instruction.length,
        createResponse() {
          let raw = '';
          return {
            get outputChars() {
              return raw.length;
            },
            push(part: import('../../structs/model/messages.js').ModelPart) {
              if (typeof part !== 'string')
                modelProtocolError('JSON value interaction does not accept native call events');
              raw += part;
            },
            finish(): Output {
              let value: unknown;
              try {
                value = JSON.parse(raw);
              } catch {
                modelProtocolError('JSON value interaction requires complete JSON');
              }
              return schema.parse(value);
            },
          };
        },
      };
    },
  });
}

/** @deprecated Use `createModelInteraction`. Retained for the 0.9 migration. */
export { createModelInteraction as createModelTransport };
/** @deprecated Use `createTextInteraction`. Retained for the 0.9 migration. */
export { createTextInteraction as createTextTransport };
/** @deprecated Use `createJsonInteraction`. Retained for the 0.9 migration. */
export { createJsonInteraction as createJsonTransport };
/** @deprecated Use `DecodedModelResponseToolCall`. */
export type { DecodedModelResponseToolCall as DecodedSessionCall } from './session.js';
/** @deprecated Use `DecodedModelToolResponse`. */
export type { DecodedModelToolResponse as DecodedSessionResult } from './session.js';
/** @deprecated Use `PreparedModelToolInteraction`. */
export type { PreparedModelToolInteraction as PreparedSessionTransport } from './session.js';
/** @deprecated Use `ModelToolInteractionOptions`. */
export type { ModelToolInteractionOptions as SessionFunctionOptions } from './session.js';
/** @deprecated Use `ModelToolInteractionRegistration`. */
export type { ModelToolInteractionRegistration as SessionModelTransportRegistration } from './session.js';
/** @deprecated Use `prepareModelToolInteraction`. */
export { prepareModelToolInteraction as prepareSessionFunctions } from './session.js';
/** @deprecated Use `ModelInteractionRegistration`. */
export type { ModelInteractionRegistration as ModelTransportRegistration } from '../../structs/support/model/interactions.js';

/**
 * Interaction adapter for providers without native tool calling.
 *
 * Instead of function declarations, the capability list is embedded in the instruction
 * and the model must answer with one JSON envelope. The envelope belongs to this
 * adapter, not to application messages, so switching adapters never changes App code.
 *
 * Exports: `jsonObjectInteraction`.
 */
import { modelProtocolError } from '../../utils/model-protocol.js';
import { object, parse } from './arguments.js';
import type { ModelInteractionAdapter } from '../../structs/model/interactions.js';
import type { RegisteredModelTool } from '../../structs/capabilities/model.js';
import type { ModelPart } from '../../structs/model/messages.js';

/**
 * Adapter that reads a single capability call out of a JSON object response.
 *
 * `strictArguments` is false because the wire format carries no schema enforcement; the
 * adapter validates the envelope shape itself and leaves argument validation to the
 * capability's own schema.
 */
export const jsonObjectInteraction: ModelInteractionAdapter = Object.freeze({
  id: 'json-object',
  features: Object.freeze({ strictArguments: false }),
  /**
   * Build the instruction and response collector for one stage.
   *
   * @param tools - Capabilities registered for this stage; must be non-empty.
   * @returns JSON mode options, the measured instruction and the collector factory.
   */
  prepare(tools: readonly RegisteredModelTool[]) {
    const declarations = tools.map(({ id, description, inputSchema }) => ({
      id,
      description,
      input: inputSchema.jsonSchema,
    }));
    // Keep the wire shape after potentially long schemas so it cannot be mistaken
    // for a schema definition or a bare capability argument object.
    const instruction =
      'Registered tools: ' +
      JSON.stringify(declarations) +
      '\nReturn exactly one JSON object with exactly these two fields: {"name":"registered id","input":{...}}. ' +
      'Choose tool name from ' +
      JSON.stringify(tools.map((capability) => capability.id)) +
      "; input is the chosen tool's actual argument object matching its input schema. " +
      'Do not return the schema, response_format, an array, multiple calls, prose or fences. The outer object must contain name and input.';
    return {
      options: { json: true },
      schemaChars: instruction.length,
      instruction,
      createResponse() {
        let raw = '';
        return {
          get outputChars() {
            return raw.length;
          },
          push(part: ModelPart) {
            if (typeof part !== 'string')
              modelProtocolError('JSON interaction does not accept native call events');
            raw += part;
          },
          finish() {
            const value = parse(raw);
            if (
              Object.keys(value).length !== 2 ||
              typeof value.name !== 'string' ||
              !Object.hasOwn(value, 'input')
            )
              modelProtocolError('Invalid model selection envelope');
            return { toolId: value.name, input: object(value.input) };
          },
        };
      },
    };
  },
});

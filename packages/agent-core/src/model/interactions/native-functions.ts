/**
 * Default interaction adapter: native function calling.
 *
 * Declarations are sent as provider functions and the streamed function-call delta is
 * reassembled into exactly one proposal. A call is a proposal, never proof of execution:
 * this adapter only decodes it, and the core decides what to run.
 *
 * Exports: `nativeFunctionInteraction`.
 */
import { modelProtocolError } from '../../utils/model-protocol.js';
import { parse, wireName } from './arguments.js';
import type { ModelInteractionAdapter } from '../../structs/model/interactions.js';
import type { RegisteredModelTool } from '../../structs/capabilities/model.js';
import type { ModelPart } from '../../structs/model/messages.js';
import { createToolCallCollector } from './calls.js';

/**
 * Adapter that decodes a streamed native function call.
 *
 * `strictArguments` is false because declarations are sent with `strict: false`; the
 * adapter therefore validates the argument payload itself via `parse`.
 */
export const nativeFunctionInteraction: ModelInteractionAdapter = Object.freeze({
  id: 'native-functions',
  features: Object.freeze({ strictArguments: false }),
  /**
   * Build native declarations, the instruction and the response collector.
   *
   * Wire names are derived from capability ids and must stay unique after mapping;
   * a collision would make it impossible to resolve the proposed name back to an id.
   *
   * @param tools - Capabilities registered for this stage; must be non-empty.
   * @returns Function declarations, the measured instruction and the collector factory.
   * @throws TypeError When two capability ids map to the same wire name.
   */
  prepare(tools: readonly RegisteredModelTool[]) {
    const names = new Map(tools.map((capability) => [wireName(capability.id), capability.id]));
    if (names.size !== tools.length) throw new TypeError('Model wire name collision');
    const functions = tools.map((capability) => ({
      name: wireName(capability.id),
      description: capability.description,
      parameters: capability.inputSchema.jsonSchema,
      strict: false,
    }));
    const instruction =
      'Submit exactly one registered capability through its tool call. Protocol examples describe call arguments, not assistant prose. A call is a proposal, not proof of execution.';
    return {
      options: { json: false, functions },
      schemaChars: JSON.stringify(functions).length + instruction.length,
      instruction,
      createResponse() {
        const collector = createToolCallCollector();
        let raw = '';
        return {
          get outputChars() {
            return (
              raw.length +
              collector.calls.reduce(
                (sum, call) => sum + call.id.length + call.name.length + call.arguments.length,
                0,
              )
            );
          },
          push(part: ModelPart) {
            if (typeof part === 'string') {
              raw += part;
              return;
            }
            if (!part || typeof part !== 'object' || Array.isArray(part))
              modelProtocolError('Expected a native model call');
            const { type, index } = part;
            if (type !== 'function-call-delta') modelProtocolError('Expected a native model call');
            if (index !== 0)
              modelProtocolError('Expected exactly one model call', 'MODEL_MULTIPLE_CALLS');
            collector.push(part);
          },
          finish() {
            const calls = collector.complete();
            if (calls.length !== 1)
              modelProtocolError('Expected exactly one model call', 'MODEL_MULTIPLE_CALLS');
            if (raw.trim()) modelProtocolError('Expected one complete model call without prose');
            const completed = calls[0]!;
            const capability =
              names.get(completed.name) ??
              modelProtocolError(
                'Model call is not registered for this stage',
                'MODEL_UNREGISTERED_CALL',
              );
            return {
              toolId: capability,
              input: parse(completed.arguments),
              call: {
                id: completed.id,
                name: completed.name,
                argumentChars: completed.arguments.length,
              },
            };
          },
        };
      },
    };
  },
});

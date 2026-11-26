/**
 * Context compressor factory: one model-backed compression handler for context reductions.
 *
 * The application owns the prompt and the output contract; the actual model call goes through the
 * Core call port supplied with each compression request, so budgets, cancellation and diagnostics
 * stay under Core control.
 *
 * Main export: `createContextCompressor`.
 */
import { resolveInteractionAlias } from '../../model/transports.js';
import { breakWhile } from '../../utils/rules.js';
import { synchronous } from '../../utils/synchronous.js';
import type {
  ContextCompressionCall,
  ContextCompressor,
} from '../../structs/support/context-processing.js';
import type { ContextFragment } from '../../structs/context/fragments.js';

/**
 * Build a compressor that asks a model to rewrite one fragment.
 *
 * The request pairs a system instruction with a user message carrying the fragment ID, its current
 * value and the target character count. Only the model's parsed value is returned; the caller
 * decides whether the result fits the reduction contract.
 *
 * @param options Compressor declaration.
 * @param options.id Handler ID referenced by `compress` reduction steps; must be unique per policy.
 * @param options.instruction System prompt describing the compression task and output format.
 * @param options.modelId Optional model override; defaults to the stage's prepared model.
 * @param options.interaction Registered model interaction ID used for the compression call.
 * @param options.maxOutputTokens Output reservation for the compression call.
 * @param options.parse Converts the model value into the fragment value type; must be synchronous.
 * @returns A frozen `ContextCompressor` whose `compress` performs the model call.
 * @throws {Error} When `parse` is not a function, or when the parser returns a thenable.
 */
export function createContextCompressor(
  options: {
    id: string;
    instruction: string;
    modelId?: string;
    maxOutputTokens: number;
    parse(value: unknown): ContextFragment['value'];
  } & (
    | { readonly interaction: string; readonly transport?: string }
    | {
        readonly interaction?: string;
        /** @deprecated Use interaction. */ readonly transport: string;
      }
  ),
): ContextCompressor {
  const { id, instruction, modelId, maxOutputTokens } = options;
  breakWhile(typeof options.parse !== 'function', 'Context compressor requires a result parser');
  const interaction = resolveInteractionAlias(options.interaction, options.transport);
  if (typeof interaction !== 'string' || !interaction.trim())
    throw new TypeError('Context compressor requires an interaction ID');
  const parse = options.parse.bind(options);
  return Object.freeze({
    id,
    async compress(call: ContextCompressionCall) {
      const result = await call.callModel({
        // Suffix the stage ID so compressor calls are attributable in diagnostics and budgets.
        stageId: `${call.stageId}:compress:${id}`,
        modelId,
        input: [
          { role: 'system', content: instruction },
          {
            role: 'user',
            content: JSON.stringify({
              sourceId: call.fragment.sourceId,
              value: call.fragment.value,
              targetChars: call.targetChars,
            }),
          },
        ],
        maxOutputTokens,
        interaction,
        transport: interaction,
      });
      return synchronous(parse(result.value), 'Context result parsers must be synchronous');
    },
  });
}

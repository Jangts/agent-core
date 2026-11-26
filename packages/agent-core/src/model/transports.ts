/**
 * Transport definitions and the built-in plain-text interaction.
 *
 * A interaction owns the wire-level request shape (options, declarations, instruction)
 * and the collector that decodes streamed parts into one result. The runner never
 * interprets provider output itself, so adding a protocol means adding an interaction
 * rather than branching in the core.
 *
 * Exports: `createPlainTextInteraction` and `normalizeModelInteraction`.
 */
import { synchronous } from '../utils/synchronous.js';
import { ValidationError } from '../structs/errors.js';
import { snapshotModelOptions } from './options.js';
import type { ModelOptions, ModelPart } from '../structs/model/messages.js';
import type { ModelInteractionDefinition } from '../structs/model/runtime.js';
import type { ModelResponseCollector } from '../structs/model/interactions.js';

/**
 * Collector that concatenates plain text into one decoded value.
 *
 * A non-string part means the provider emitted a native call event, which a plain-text
 * stage cannot represent; that is reported as a protocol violation instead of being
 * stringified.
 *
 * @param decode - Final conversion from accumulated raw text to the result.
 * @returns A collector reporting the buffered character count.
 */
function textResponse<Result>(decode: (raw: string) => Result): ModelResponseCollector<Result> {
  let raw = '';
  return {
    get outputChars() {
      return raw.length;
    },
    push(part: ModelPart) {
      if (typeof part !== 'string')
        throw new ValidationError([
          { code: 'MODEL_PROTOCOL', message: 'Text interaction does not accept model calls' },
        ]);
      raw += part;
    },
    finish: () => synchronous(decode(raw), 'Model result parsers must be synchronous'),
  };
}
/**
 * Build an interaction that expects a single plain-text completion.
 *
 * JSON mode is forced off because a text stage has no envelope to parse, and the final
 * text is trimmed so interaction-specific whitespace never reaches the caller.
 *
 * @param id - Unique interaction id, also used as the typed handle in `ModelRunner`.
 * @param options - Shared per-turn output, continuation and sampling options.
 * @param trim - Trim surrounding whitespace from the final text; defaults to true.
 * @returns A frozen interaction definition.
 */
export function createPlainTextInteraction<const Id extends string>(
  id: Id,
  options: import('../structs/model/messages.js').ModelInteractionOptions = {},
  trim = true,
): ModelInteractionDefinition<string> & { readonly id: Id } {
  const settings = Object.freeze({ ...snapshotModelOptions(options), json: false });
  return Object.freeze({
    id,
    prepare: (_stageId: string) => ({
      options: settings,
      schemaChars: 0,
      createResponse: () => textResponse((raw) => (trim ? raw.trim() : raw)),
    }),
  });
}
/**
 * Freeze an interaction and pin its preparation receiver.
 *
 * Binding at registration means a later caller cannot swap the definition's identity
 * or detach `prepare` from the object that specializes it.
 *
 * @param definition - Transport supplied by the App or by a factory.
 * @returns A frozen definition with a bound `prepare`.
 * @throws TypeError When the id is blank or `prepare` is missing.
 */
export function normalizeModelInteraction<Result>(
  definition: ModelInteractionDefinition<Result>,
): ModelInteractionDefinition<Result> {
  if (!definition.id?.trim() || typeof definition.prepare !== 'function')
    throw new TypeError('Invalid model interaction');
  return Object.freeze({ id: definition.id, prepare: definition.prepare.bind(definition) });
}

/** @deprecated Use `createPlainTextInteraction`. Retained for the 0.9 migration. */
export { createPlainTextInteraction as createPlainTextTransport };
/** @deprecated Use `normalizeModelInteraction`. Retained for the 0.9 migration. */
export { normalizeModelInteraction as normalizeModelTransport };

/** Resolve a renamed input once; distinct explicitly supplied aliases are never silently preferred. */
export function resolveInteractionAlias<Value>(
  canonical: Value | undefined,
  legacy: Value | undefined,
): Value | undefined {
  if (canonical !== undefined && legacy !== undefined && canonical !== legacy)
    throw new TypeError('Conflicting interaction and legacy transport options');
  return canonical === undefined ? legacy : canonical;
}

/**
 * Adapt an interaction adapter plus capability catalog into an interaction.
 *
 * This is the seam between "how a provider expresses a call" and "what the core
 * accepts": whatever the wire format, the interaction must yield one capability id and
 * one argument object. Capability availability is checked against the catalog captured
 * at preparation time, so a late registration cannot be called.
 *
 * Exports: `createModelInteraction`.
 */
import { synchronous } from '../utils/synchronous.js';
import type { ModelInteractionRegistration } from '../structs/model/interactions.js';
import type { ModelInteractionDefinition } from '../structs/model/runtime.js';
import { nativeFunctionInteraction } from './interactions/native-functions.js';
import { snapshotModelOptions } from './options.js';
import { modelProtocolError } from '../utils/model-protocol.js';

/**
 * Compose a registered selection interaction.
 *
 * The capability source may be a static catalog or a function of the stage id; the
 * resulting definitions are captured when `prepare` runs and are used both to build
 * the instruction and to reject unknown capability ids at finish time.
 *
 * `requireStrictArguments` is a registration-time assertion: an interaction cannot demand
 * strict arguments from an adapter that does not support them.
 *
 * @param registration - Adapter, capability source, options and the interaction id.
 * @returns A frozen interaction definition whose result is the resolved capability output.
 * @throws TypeError When strict arguments are unsupported or preparation is invalid.
 */
export function createModelInteraction<Result, const Id extends string = string>(
  registration: ModelInteractionRegistration<Result> & { readonly id: Id },
): ModelInteractionDefinition<Result> & { readonly id: Id } {
  const adapter = registration.adapter ?? nativeFunctionInteraction;
  if (registration.requireStrictArguments && !adapter.features.strictArguments)
    throw new TypeError(`Model interaction does not support strict arguments: ${adapter.id}`);
  const source = registration.tools,
    createSource = typeof source === 'function' ? source.bind(registration) : undefined;
  const prepare = adapter.prepare.bind(adapter),
    options = Object.freeze(snapshotModelOptions(registration.options));
  return Object.freeze({
    id: registration.id,
    prepare(stageId: string) {
      const catalog = createSource
        ? synchronous(createSource(stageId), 'Model capability sources must be synchronous')
        : (source as import('../structs/capabilities/model.js').ModelToolSource<Result>);
      const definitions = [...catalog.values()];
      if (!definitions.length) throw new TypeError('Model stage requires registered tools');
      const toolIds = new Set(definitions.map((capability) => capability.id));
      const prepared = synchronous(
        prepare(definitions),
        'Model interaction preparation must be synchronous',
      );
      const createResponse = prepared.createResponse.bind(prepared),
        resolve = catalog.resolve.bind(catalog);
      return {
        options: { ...options, ...snapshotModelOptions(prepared.options) },
        schemaChars: prepared.schemaChars,
        instruction: prepared.instruction,
        createResponse() {
          const buffer = createResponse();
          let call: import('../structs/capabilities/model.js').ModelSelection['call'];
          return {
            get outputChars() {
              return buffer.outputChars;
            },
            get call() {
              return call;
            },
            push: buffer.push.bind(buffer),
            finish() {
              const selection = synchronous(
                buffer.finish(),
                'Model selection parsers must be synchronous',
              );
              call = selection.call;
              if (!toolIds.has(selection.toolId))
                modelProtocolError('Model capability is unavailable in this prepared call');
              return synchronous(
                resolve(selection, { stageId }),
                'Model result parsers must be synchronous',
              );
            },
          };
        },
      };
    },
  });
}

/** @deprecated Use `createModelInteraction`. Retained for the 0.9 migration. */
export { createModelInteraction as createModelTransport };

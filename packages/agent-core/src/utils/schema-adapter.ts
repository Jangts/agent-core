/**
 * Snapshot helper for registered schema adapters.
 *
 * An adapter owns a JSON schema and a parser. Both must be detached from the App object
 * that supplied them, both must be immutable afterwards, and the parser must stay
 * synchronous, because schema snapshots are reused across requests and diagnostics.
 *
 * Exports: `snapshotSchemaAdapter`.
 */
import { freezeSchema } from './object.js';
import { synchronous } from './synchronous.js';
import type { SchemaAdapter } from '../structs/common.js';

/**
 * Detach a schema adapter into a frozen, synchronous definition.
 *
 * The JSON schema is cloned and deep-frozen; the parser is bound to the original
 * definition so a method keeps its receiver, then wrapped so a thenable result is
 * rejected rather than awaited.
 *
 * @param definition - Adapter to snapshot.
 * @param asyncError - Message used when the parser returns a thenable.
 * @returns A frozen adapter with a cloned schema and a synchronous parser.
 * @throws TypeError When `jsonSchema` is missing or not a plain object.
 */
export function snapshotSchemaAdapter<Value>(
  definition: SchemaAdapter<Value>,
  asyncError = 'Schema parsers must be synchronous',
): SchemaAdapter<Value> {
  const { jsonSchema } = definition;
  if (!jsonSchema || typeof jsonSchema !== 'object' || Array.isArray(jsonSchema)) {
    throw new TypeError('A schema adapter requires jsonSchema');
  }
  const snapshot = structuredClone(jsonSchema);
  freezeSchema(snapshot);
  const parse = definition.parse.bind(definition);
  return Object.freeze({
    jsonSchema: snapshot,
    parse: (input: unknown) => synchronous(parse(input), asyncError),
  });
}

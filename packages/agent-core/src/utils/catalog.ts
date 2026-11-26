/**
 * Immutable id-keyed catalog snapshot.
 *
 * Modules that own registrable definitions (tools, tools, prompts) publish the
 * snapshot produced here instead of exposing their mutable `Map`, so later mutations
 * by the owner cannot be observed and no consumer can mutate the registry.
 *
 * Exports: `readonlyCatalog`.
 */
import type { ReadonlyCatalog } from '../structs/common.js';

/**
 * Build a frozen catalog from an iterable of definitions.
 *
 * Ids must be non-empty after trimming and unique; both violations surface as a
 * TypeError during construction rather than on first lookup.
 *
 * @param definitions - Definitions to snapshot; iteration order is preserved in `definitions`.
 * @param missing - Factory for the error thrown by `require` when an id is absent.
 * @returns A frozen catalog; `get` is unguarded while `require` throws via `missing`.
 * @throws TypeError When an id is blank or duplicated.
 */
export function readonlyCatalog<Definition extends { readonly id: string }>(
  definitions: Iterable<Readonly<Definition>>,
  missing: (id: string) => Error,
): ReadonlyCatalog<Definition> {
  const byId = new Map<string, Readonly<Definition>>();
  for (const definition of definitions) {
    if (!definition.id?.trim() || byId.has(definition.id))
      throw new TypeError('Invalid or duplicate catalog id');
    byId.set(definition.id, definition);
  }
  const snapshot = Object.freeze([...byId.values()]);
  return Object.freeze({
    definitions: snapshot,
    ids: () => Object.freeze([...byId.keys()]),
    values: () => byId.values(),
    entries: () => byId.entries(),
    has: (id: string) => byId.has(id),
    get: (id: string) => byId.get(id),
    require(id: string) {
      const value = byId.get(id);
      if (value === undefined) throw missing(id);
      return value;
    },
  });
}

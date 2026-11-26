/**
 * Snapshot one interaction command definition before it is registered.
 *
 * Definitions are often plain objects composed with prototype methods or getters.
 * Copying the known contract fields explicitly keeps those inherited members while
 * dropping any other implementation helper, which is not part of the runtime contract.
 *
 * Exports: `pinCommandDefinition`.
 */
import type { CommandDefinition } from '../structs/kits/interaction.js';

/**
 * Produce a detached copy of the contract fields of a command definition.
 *
 * Callbacks are rebound to the original definition so `this` keeps pointing at the
 * source object; `undefined` entries are dropped so optional fields stay absent.
 *
 * @param definition - Source definition, possibly carrying inherited members.
 * @returns A new partial definition containing only the declared contract fields.
 */
export function pinCommandDefinition<Value extends object, Result, Args extends unknown[]>(
  definition: Partial<CommandDefinition<Value, Result, Args>>,
): Partial<CommandDefinition<Value, Result, Args>> {
  const snapshot = {
    ...definition,
    fields: definition.fields,
    category: definition.category,
    version: definition.version,
    description: definition.description,
    terminal: definition.terminal,
    discriminator: definition.discriminator,
    ownedFields: definition.ownedFields,
    additionalProperties: definition.additionalProperties,
    optionalPresence: definition.optionalPresence,
    modes: definition.modes,
    tags: definition.tags,
    checks: definition.checks,
    error:
      typeof definition.error === 'function' ? definition.error.bind(definition) : definition.error,
    refine: definition.refine?.bind(definition),
    format: definition.format?.bind(definition),
  };
  return Object.fromEntries(Object.entries(snapshot).filter(([, value]) => value !== undefined));
}

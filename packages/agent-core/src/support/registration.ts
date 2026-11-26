/**
 * Conditional registration support: compile an ordered list of install steps for an application.
 *
 * Steps are validated and bound once, then installed per invocation. Predicates run at install
 * time and only see what previous steps already installed, so ordering is part of the contract.
 * This is app-side composition for Core-facing handlers; it defines no new scheduling protocol.
 *
 * Main export: `defineRegistrationCatalog`.
 */
import { readonlyCatalog } from '../utils/catalog.js';
import { synchronous, booleanResult } from '../utils/synchronous.js';
import type { RegistrationDefinition } from '../structs/support/registration.js';
import { breakWhile } from '../utils/rules.js';

/**
 * Compile an ordered installation plan.
 *
 * Predicates observe the effects of preceding installations at request time; a predicate that
 * throws rejects the install instead of being treated as `false`. Callbacks are bound to their
 * declaring definition so implementations may rely on `this`.
 *
 * @param definitions Registration steps in execution order.
 * @returns A frozen catalog plus `install(context)`, which runs enabled steps sequentially.
 * @throws {Error} When a `register` handler is missing or a `when` predicate is not a function.
 */
export function defineRegistrationCatalog<Context>(
  definitions: readonly RegistrationDefinition<Context>[],
) {
  const catalog = readonlyCatalog(
    definitions.map((definition) => {
      const { id, when, register } = definition;
      breakWhile(
        [
          {
            occur: typeof register !== 'function',
            error: 'Missing registration handler',
            tags: ['handler'],
          },
          {
            occur: when !== undefined && typeof when !== 'function',
            error: 'Invalid registration predicate',
            tags: ['predicate'],
          },
        ],
        ['agent-core', 'registration'],
      );
      return Object.freeze({
        id,
        when: when?.bind(definition),
        register: register.bind(definition),
      });
    }),
    (id) => new TypeError(`Unknown registration: ${id}`),
  );
  return Object.freeze({
    ...catalog,
    /**
     * Run every enabled step in declaration order against `context`.
     *
     * Stops at the first failing predicate or handler; earlier installations are not rolled back.
     *
     * @param context Value passed to each predicate and registration handler.
     * @throws {TypeError} When a predicate is asynchronous or does not return a boolean, or when
     *   a handler is asynchronous.
     */
    install(context: Context): void {
      for (const entry of catalog.definitions) {
        const enabled = entry.when
          ? booleanResult(
              entry.when(context),
              'Registration predicates must be synchronous',
              'Registration predicates must return boolean',
            )
          : true;
        if (enabled) {
          synchronous(entry.register(context), 'Registration handlers must be synchronous');
        }
      }
    },
  });
}

export type { RegistrationDefinition } from '../structs/support/registration.js';

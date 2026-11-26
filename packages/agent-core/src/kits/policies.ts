/**
 * Policies Kit: assess which declared policies apply, and run ordered recovery handlers.
 *
 * Place in the package: an optional App-side library for policy and recovery tables. Policy
 * predicates, recovery handlers, kinds and descriptions are App configuration; this module
 * owns registration checks, evaluation order and outcome validation.
 *
 * Exports: `definePolicySet`, `defineRecoveryChain`, `Policies`, and the policy types.
 */
import { nativeReportedStepSync } from '../diagnostics/native-sub-flow.js';
import { readonlyCatalog } from '../utils/catalog.js';
import { synchronous, booleanResult } from '../utils/synchronous.js';
import type {
  PolicyDefinition,
  RecoveryDefinition,
  RecoveryResult,
} from '../structs/kits/policies.js';
import { breakWhile } from '../utils/rules.js';

/**
 * Compile a policy set that reports every matching reason.
 *
 * Collect every matching reason; a configured mode cannot silently override a mandatory
 * policy. `assess` returns the matched ids and deduplicated kinds rather than a single verdict,
 * so callers keep the ordering information they need for messages and diagnostics.
 *
 * @param definitions - Policies with unique ids, descriptions and a synchronous `when`.
 * @returns A frozen catalog extended with `assess(input)`.
 * @throws TypeError For blank/duplicate ids, a blank description, a missing `when`, or a
 *   predicate that is not synchronous boolean.
 */
export function definePolicySet<Input, Kind extends string>(
  definitions: readonly PolicyDefinition<Input, Kind>[],
) {
  const catalog = registerPolicies(definitions, 'when');
  return Object.freeze({
    ...readonlyCatalog(catalog, (id) => new TypeError(`Unknown policy: ${id}`)),
    assess(input: Input) {
      const matched = catalog.filter((policy) => booleanMatch(policy.when(input)));
      return {
        required: matched.length > 0,
        reasons: matched.map((policy) => policy.id),
        kinds: [...new Set(matched.map((policy) => policy.kind))],
      };
    },
  });
}

/**
 * Compile an ordered recovery chain.
 *
 * A handler reports whether it handled the input; handled undefined values remain explicit.
 * The first handler that reports `handled` ends the walk, so declaration order is the
 * precedence, and `{ handled: false }` is the only way to fall through.
 *
 * @param definitions - Recovery handlers with unique ids, descriptions and `tryRecover`.
 * @returns A frozen catalog extended with `tryRecover(input)`.
 * @throws TypeError For blank/duplicate ids, a missing handler, or an outcome that lacks a
 *   boolean `handled` or omits `value` while claiming to have handled the input.
 */
export function defineRecoveryChain<Input, Result>(
  definitions: readonly RecoveryDefinition<Input, Result>[],
) {
  const catalog = registerPolicies(definitions, 'tryRecover').map((definition) => {
    return Object.freeze({
      id: definition.id,
      description: definition.description,
      tryRecover(input: Input): RecoveryResult<Result> {
        const value = synchronous(
          definition.tryRecover(input),
          'Recovery handlers must be synchronous',
        );
        const result = value as RecoveryResult<Result>;
        if (
          !result ||
          typeof result !== 'object' ||
          typeof result.handled !== 'boolean' ||
          (result.handled && !('value' in result))
        )
          throw new TypeError('Invalid recovery outcome');
        return result;
      },
    });
  });
  const tryRecover = (
    input: Input,
    execution: Partial<import('../structs/common.js').ExecutionContext> = {},
  ): RecoveryResult<Result> => {
    for (const policy of catalog) {
      const result = nativeReportedStepSync(execution, 'recovery', policy.id, () =>
        policy.tryRecover(input),
      );
      if (result.handled) return result;
    }
    return { handled: false };
  };
  return Object.freeze({
    ...readonlyCatalog(catalog, (id) => new TypeError(`Unknown recovery policy: ${id}`)),
    tryRecover,
  });
}

function registerPolicies<
  Entry extends { readonly id: string; readonly description: string },
  Key extends keyof Entry,
>(definitions: readonly Entry[], handler: Key): readonly Readonly<Entry>[] {
  const ids = new Set<string>();
  return Object.freeze(
    definitions.map((definition) => {
      breakWhile(
        [
          {
            occur: () => !definition.id.trim() || !definition.description.trim(),
            error: 'Invalid policy declaration',
            tags: ['metadata'],
          },
          {
            occur: () => ids.has(definition.id),
            error: () => `Duplicate policy: ${definition.id}`,
            tags: ['id'],
          },
          {
            occur: () => typeof definition[handler] !== 'function',
            error: () => `Missing policy handler: ${definition.id}`,
            tags: ['handler'],
          },
        ],
        ['agent-core', 'policy-registration'],
      );
      ids.add(definition.id);
      return Object.freeze({
        ...definition,
        id: definition.id,
        description: definition.description,
        ...('kind' in definition ? { kind: definition.kind } : {}),
        [handler]: (definition[handler] as (...args: never[]) => unknown).bind(definition),
      });
    }),
  );
}

export type {
  PolicyDefinition,
  PolicyAssessment,
  RecoveryDefinition,
  RecoveryResult,
} from '../structs/kits/policies.js';

/** Namespace object for callers that prefer one import over named helpers. */
export const Policies = Object.freeze({ definePolicySet, defineRecoveryChain });

function booleanMatch(value: unknown): boolean {
  return booleanResult(
    value,
    'Policy predicates must be synchronous',
    'Policy predicates must return boolean',
  );
}

/**
 * Evidence Kit: check completion requirements against observations and narrow observations.
 *
 * Place in the package: an optional App-side library for "did we actually observe enough"
 * logic. This module only compares observations with registered providers; what counts as
 * evidence, where observations come from and how they are stored remain App-owned.
 *
 * Exports: `defineEvidenceChecklist`, `defineEvidenceProjection`, `Evidence`, and the
 * evidence requirement/provider/projection types.
 */
import { synchronous, booleanResult } from '../utils/synchronous.js';
import type {
  EvidenceProvider,
  EvidenceRequirement,
  EvidenceProjectionDefinition,
  EvidenceProjectionProvider,
} from '../structs/kits/evidence.js';
import { breakWhile } from '../utils/rules.js';

/**
 * Compile a reusable completion checklist over actual observations.
 *
 * A requirement is satisfied when at least one observation satisfies the provider registered
 * for its `kind`; `isComplete` requires every requirement to be satisfied, and `missing`
 * returns those that are not. Hosts define evidence semantics.
 *
 * @param definitions - One provider per evidence kind, each with an `isSatisfied` predicate.
 * @returns A frozen checklist exposing `isSatisfied`, `isComplete` and `missing`.
 * @throws TypeError For duplicate kinds, missing predicates, or an unknown requirement kind;
 *   predicates must return a boolean synchronously.
 */
export function defineEvidenceChecklist<Observation, Requirement extends EvidenceRequirement>(
  definitions: readonly EvidenceProvider<Observation, Requirement>[],
) {
  const providers = new Map<string, EvidenceProvider<Observation, Requirement>>();
  for (const definition of definitions) {
    const predicate = definition.isSatisfied;
    breakWhile([
      {
        occur: () => providers.has(definition.kind),
        error: () => `Duplicate evidence kind: ${definition.kind}`,
      },
      {
        occur: () => typeof predicate !== 'function',
        error: () => `Missing evidence provider: ${definition.kind}`,
      },
    ]);
    providers.set(
      definition.kind,
      Object.freeze({
        kind: definition.kind,
        description: definition.description,
        isSatisfied: predicate.bind(definition),
      }),
    );
  }
  const satisfied = (observations: readonly Observation[], requirement: Requirement): boolean => {
    const provider = providers.get(requirement.kind);
    breakWhile(!provider, () => `Unknown evidence kind: ${requirement.kind}`);
    return observations.some((observation) =>
      booleanResult(
        provider!.isSatisfied(observation, requirement),
        'Evidence predicates must be synchronous',
        'Evidence predicates must return boolean',
      ),
    );
  };
  return Object.freeze({
    isSatisfied: (request: { observations: readonly Observation[]; requirement: Requirement }) =>
      satisfied(request.observations, request.requirement),
    isComplete: (request: {
      observations: readonly Observation[];
      requirements: readonly Requirement[];
    }) => request.requirements.every((requirement) => satisfied(request.observations, requirement)),
    missing({
      observations,
      requirements,
    }: {
      observations: readonly Observation[];
      requirements: readonly Requirement[];
    }) {
      return requirements.filter((requirement) => !satisfied(observations, requirement));
    },
  });
}

/**
 * Compile a projection that keeps only the sources a caller asked to see.
 *
 * No selection retains the complete evidence; a selection narrows registered source-bearing
 * results. Observations whose tool has no provider pass through untouched, so the projection
 * can only ever remove sources it knows how to name.
 *
 * @param definition - Source id selector, optional tool id selector, and per-tool providers.
 * @returns A frozen object whose `project({ observations, sourceIds })` returns new values.
 * @throws TypeError For a provider without both handlers; selectors and handlers must be
 *   synchronous.
 */
export function defineEvidenceProjection<Observation, Source>(
  definition: EvidenceProjectionDefinition<Observation, Source>,
) {
  const sourceId = definition.sourceId.bind(definition);
  const toolId =
    definition.toolId?.bind(definition) ??
    ((observation: Observation) => {
      // Fallback tool selector: accept either the current `toolId` field or the legacy `tool`.
      const value = observation as { toolId?: string; tool?: string };
      return value.toolId ?? value.tool!;
    });
  const providers = new Map<string, EvidenceProjectionProvider<Observation, Source>>();
  for (const [tool, provider] of Object.entries(definition.providers)) {
    breakWhile(
      ![provider.sources, provider.withSources].every((handler) => typeof handler === 'function'),
      `Invalid evidence projection: ${tool}`,
    );
    providers.set(
      tool,
      Object.freeze({
        sources: provider.sources.bind(provider),
        withSources: provider.withSources.bind(provider),
      }),
    );
  }
  return Object.freeze({
    project({
      observations,
      sourceIds = [],
    }: {
      observations: Observation[];
      sourceIds?: readonly string[];
    }): Observation[] {
      // Unknown/empty claims still need review against every available candidate.
      if (!sourceIds.length) return observations;
      return observations.map((observation) => {
        const provider = providers.get(
          synchronous(toolId(observation), 'Evidence tool selectors must be synchronous'),
        );
        if (!provider) return observation;
        const sources = synchronous(
          provider.sources(observation),
          'Evidence source projection must be synchronous',
        ).filter((source) =>
          sourceIds.includes(
            synchronous(sourceId(source), 'Evidence source selectors must be synchronous'),
          ),
        );
        return synchronous(
          provider.withSources(observation, sources),
          'Evidence observations must be synchronous',
        );
      });
    },
  });
}

export type {
  EvidenceRequirement,
  EvidenceProvider,
  EvidenceProjectionDefinition,
  EvidenceProjectionProvider,
} from '../structs/kits/evidence.js';

/** Namespace object for callers that prefer one import over named helpers. */
export const Evidence = Object.freeze({ defineEvidenceChecklist, defineEvidenceProjection });

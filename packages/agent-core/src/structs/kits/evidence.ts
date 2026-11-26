/**
 * Evidence contract for the Evidence Kit.
 *
 * Place in the package: an optional App-side library for "did we actually observe enough" logic.
 * A requirement may only be satisfied by an observation; a model's claim that it succeeded is
 * never itself evidence. What counts as evidence and where observations come from stay App-owned.
 *
 * Exports: `EvidenceRequirement`, `EvidenceProvider`, `EvidenceProjectionProvider`,
 * `EvidenceProjectionDefinition`.
 */
/** Requirements describe evidence that must already exist, never a model's assertion of success. */
export interface EvidenceRequirement {
  /** Evidence kind; selects the provider that adjudicates satisfaction. */
  readonly kind: string;
  /** Identity inside that kind, for example a document or record id. */
  readonly id: string;
  /** Optional operation the evidence must cover; interpreted by the provider. */
  readonly operation?: string;
}

/** Adjudicates one evidence kind against real observations. */
export interface EvidenceProvider<Observation, Requirement extends EvidenceRequirement> {
  /** Kind this provider answers; one provider per kind. */
  readonly kind: Requirement['kind'];
  readonly description: string;
  /** Returns whether one observation satisfies one requirement; must be synchronous boolean. */
  isSatisfied(observation: Observation, requirement: Requirement): boolean;
}

/** Describes which sources an observation can cite, and how to narrow it to cited ones. */
export interface EvidenceProjectionProvider<Observation, Source> {
  /** All sources the observation currently carries. */
  sources(observation: Observation): readonly Source[];
  /** Returns a copy of the observation restricted to `sources`. */
  withSources(observation: Observation, sources: Source[]): Observation;
}

/** Projection configuration, keyed by the tool that produced an observation. */
export interface EvidenceProjectionDefinition<Observation, Source> {
  /** One provider per tool id; observations without a provider pass through unchanged. */
  readonly providers: Readonly<Record<string, EvidenceProjectionProvider<Observation, Source>>>;
  /** Stable citation id for a source. */
  readonly sourceId: (source: Source) => string;
  /** Selects the tool id of an observation; defaults to its `toolId` (or legacy `tool`) field. */
  readonly toolId?: (observation: Observation) => string;
}

/**
 * Scope registry contract for the Domain Tools Kit.
 *
 * Place in the package: an optional App-side catalog of scope definitions. A scope binds an intent
 * to the sources and tools it may use; the registry validates identity, aliases, required bindings
 * and allowed categories, while resolution and business meaning stay with the App.
 *
 * Exports: `ScopeDefinition`, `ScopeRegistryPolicy`, `RegisteredScopeEvidence`, `RegisteredScope`,
 * `ScopeDescription`.
 */
import type { EvidenceRequirement } from '../evidence.js';
import type { BreakReason } from '../../utils/rules.js';
import type { RegistrationData, RegistrationProjection } from '../../../utils/registration.js';

/** One declarable scope. Ids and aliases share one namespace and must be unique. */
export interface ScopeDefinition {
  /** Unique scope id, matched against the policy's `idPattern` when configured. */
  id: string;
  /** Non-blank description. */
  description: string;
  /** Scope category; validated against `policy.categories` when that is set. */
  category: string;
  /** Goals this scope serves; required when the policy sets `requireGoals`. */
  domainToolIds?: readonly string[];
  /** @deprecated Use domainToolIds. */
  goalIds?: readonly string[];
  /** Referenced query scopes, resolved by the App. */
  queryScopeIds?: readonly string[];
  /** Referenced knowledge topics, resolved by the App. */
  knowledgeTopicIds?: readonly string[];
  /** Referenced tool ids; required when the policy sets `requireTools`. */
  toolIds?: readonly string[];
  /** Alternate names accepted by lookup; must not collide with ids or other aliases. */
  aliases?: readonly string[];
  /** App-declared context tier, passed through for the App's own policy. */
  contextTier?: string;
  /** Evidence requirements that must be satisfied before this scope may answer. */
  evidence?: readonly EvidenceRequirement[];
}

/** Registration rules for one scope registry. */
export interface ScopeRegistryPolicy<Definition extends ScopeDefinition> {
  /** Require at least one Tool id per scope. */
  readonly requireDomainTools?: boolean;
  /** @deprecated Use requireDomainTools. */
  readonly requireGoals?: boolean;
  /** Require at least one query scope or knowledge topic per scope. */
  readonly requireSources?: boolean;
  /** Require at least one tool id per scope. */
  readonly requireTools?: boolean;
  /** Pattern every id and alias must match. */
  readonly idPattern?: RegExp;
  /** Allowed `category` values; `undefined` accepts any value. */
  readonly categories?: readonly string[];
  /** Extra App assertion, called after the built-in checks; must return void synchronously. */
  readonly assertDefinition?: (definition: Definition) => void;
  /** Replaces the default intent membership test; must return boolean synchronously. */
  readonly acceptsDomainTool?: (definition: Readonly<Definition>, domainToolId: string) => boolean;
  /** @deprecated Use acceptsDomainTool. */
  readonly acceptsGoal?: (definition: Readonly<Definition>, goal: string) => boolean;
  /** Diagnostic tags attached to registration rejections. */
  readonly tags?: readonly string[];
  readonly errors?: { readonly sealed?: BreakReason; readonly invalid?: BreakReason };
}

/** Registered evidence entry: public data only, frozen by the registry. */
export type RegisteredScopeEvidence<Definition extends ScopeDefinition> = Readonly<
  RegistrationData<NonNullable<Definition['evidence']>[number]>
>;
type ScopeListKey = 'goalIds' | 'queryScopeIds' | 'knowledgeTopicIds' | 'toolIds' | 'aliases';
type RegisteredScopeLists<Definition extends ScopeDefinition> = {
  readonly [Key in ScopeListKey]: [NonNullable<Definition[Key]>] extends [never]
    ? readonly []
    : NonNullable<Definition[Key]> extends readonly string[]
      ? Readonly<NonNullable<Definition[Key]>>
      : readonly string[];
};
type RegisteredEvidenceList<Values extends readonly EvidenceRequirement[]> = {
  readonly [Index in keyof Values]: Readonly<RegistrationData<Values[Index]>>;
};
type ScopeEvidenceList<Definition extends ScopeDefinition> = [
  NonNullable<Definition['evidence']>,
] extends [never]
  ? readonly []
  : NonNullable<Definition['evidence']> extends readonly EvidenceRequirement[]
    ? RegisteredEvidenceList<NonNullable<Definition['evidence']>>
    : readonly RegisteredScopeEvidence<Definition>[];
/** Frozen registration view: every list is a frozen copy, evidence entries are projected. */
export type RegisteredScope<Definition extends ScopeDefinition> = Readonly<
  Omit<RegistrationProjection<Definition, ScopeDefinition>, ScopeListKey | 'evidence'> &
    RegisteredScopeLists<Definition> & {
      evidence: ScopeEvidenceList<Definition>;
    }
>;

/** Plain description with mutable arrays, for documentation and model-facing catalogs. */
export type ScopeDescription<Definition extends ScopeDefinition> = Omit<
  RegisteredScope<Definition>,
  'goalIds' | 'queryScopeIds' | 'knowledgeTopicIds' | 'toolIds' | 'aliases' | 'evidence'
> & {
  goalIds: string[];
  queryScopeIds: string[];
  knowledgeTopicIds: string[];
  toolIds: string[];
  aliases: string[];
  evidence: RegisteredScopeEvidence<Definition>[];
};

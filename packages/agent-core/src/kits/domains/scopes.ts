import { domainAlias, domainProjection } from './compatibility.js';
/**
 * Domain Tools Kit: an ordered, sealable registry of scope declarations and their aliases.
 *
 * Place in the package: part of the domain Tool Kit. Categories, extra fields and intent
 * acceptance policy are App configuration; this class owns validation, alias normalization,
 * relationship lookups and sealing.
 *
 * Exports: `ScopeRegistry`, `createScopeRegistry`, and the scope registry types.
 */
import type {
  ScopeDefinition,
  ScopeDescription,
  ScopeRegistryPolicy,
  RegisteredScope,
  RegisteredScopeEvidence,
} from '../../structs/kits/domains/scopes.js';
import { assertion, booleanResult } from '../../utils/synchronous.js';
import { breakWhile } from '../../utils/rules.js';
import { registrationData } from '../../utils/registration.js';

/**
 * Generic scope relationships; categories, intent policy and extra fields belong to the host.
 *
 * A scope is addressable by its id or by any of its aliases; aliases resolve to the declaring
 * scope, and a name may be claimed only once across both namespaces.
 */
export class ScopeRegistry<Definition extends ScopeDefinition = ScopeDefinition> {
  /** Create and seal a complete scope catalog in one call. */
  static readonly create: typeof createScopeRegistry = createScopeRegistry;

  private readonly byId = new Map<string, RegisteredScope<Definition>>();
  private readonly sources = new Map<string, Definition>();
  private readonly aliases = new Map<string, string>();
  private sealed = false;
  private readonly policy: ScopeRegistryPolicy<Definition>;
  /**
   * @param policy - Optional id pattern, categories, required-binding switches, intent
   *   acceptance override, error wording and assertion hook; lists are copied on construction.
   */
  constructor(policy: ScopeRegistryPolicy<Definition> = {}) {
    const pattern = policy.idPattern;
    const errorPorts = policy.errors,
      { sealed, invalid } = errorPorts ?? {};
    const listFields = ['categories', 'tags'] as const;
    const lists = Object.fromEntries(
      listFields.map((key) => {
        const value = policy[key];
        return [key, value === undefined ? undefined : Object.freeze([...value])];
      }),
    ) as Pick<ScopeRegistryPolicy<Definition>, (typeof listFields)[number]>;
    this.policy = Object.freeze({
      ...registrationData(policy, [
        'idPattern',
        'assertDefinition',
        'acceptsGoal',
        'errors',
        ...listFields,
      ]),
      ...lists,
      idPattern: pattern ? new RegExp(pattern.source, pattern.flags) : undefined,
      errors:
        errorPorts &&
        Object.freeze({
          sealed: typeof sealed === 'function' ? sealed.bind(errorPorts) : sealed,
          invalid: typeof invalid === 'function' ? invalid.bind(errorPorts) : invalid,
        }),
      assertDefinition: policy.assertDefinition?.bind(policy),
      acceptsGoal: domainAlias<(definition: Readonly<Definition>, id: string) => boolean>(
        policy,
        'acceptsDomainTool',
        'acceptsGoal',
      )?.bind(policy),
      requireGoals: domainAlias<boolean>(policy, 'requireDomainTools', 'requireGoals'),
    });
  }

  /**
   * Validate, freeze and add one scope together with its aliases.
   *
   * Every name is checked for conflicts before any of them is stored, so a rejected scope
   * leaves no partial alias entry behind.
   *
   * @param input - Scope declaration; the raw object is retained for `acceptsGoal` overrides
   *   while the compiled copy serves lookups.
   * @returns This registry, for chaining.
   * @throws A configured error for a sealed registry, an invalid name/description/category,
   *   a missing required binding, duplicate Tool ids or an already-claimed name.
   */
  register(input: Definition): this {
    const definition = {
      ...registrationData(input, [
        'id',
        'description',
        'category',
        'goalIds',
        'queryScopeIds',
        'knowledgeTopicIds',
        'toolIds',
        'aliases',
        'evidence',
        'contextTier',
      ]),
      id: input.id,
      description: input.description,
      category: input.category,
      goalIds: domainAlias<readonly string[]>(input, 'domainToolIds', 'goalIds') ?? [],
      domainToolIds: domainAlias<readonly string[]>(input, 'domainToolIds', 'goalIds') ?? [],
      queryScopeIds: input.queryScopeIds ?? [],
      knowledgeTopicIds: input.knowledgeTopicIds ?? [],
      toolIds: input.toolIds ?? [],
      aliases: input.aliases,
      evidence: input.evidence,
      contextTier: input.contextTier,
    };
    const names = [definition.id, ...(definition.aliases ?? [])];
    const policy = this.policy,
      tags = policy.tags ?? [];
    const invalid = policy.errors?.invalid ?? 'Invalid scope definition';
    const validName = (name: string) => {
      if (typeof name !== 'string' || !name.trim()) return false;
      if (!policy.idPattern) return true;
      policy.idPattern.lastIndex = 0;
      return policy.idPattern.test(name);
    };
    breakWhile(
      [
        {
          occur: () => this.sealed,
          error: policy.errors?.sealed ?? 'Scope registry is sealed',
          tags: ['sealed'],
        },
        {
          occur: [
            () => !names.every(validName),
            () => !definition.description.trim(),
            () =>
              policy.categories !== undefined && !policy.categories.includes(definition.category),
          ],
          error: invalid,
          tags: ['identity'],
        },
        {
          occur: () => policy.requireGoals === true && !definition.goalIds.length,
          error: invalid,
          tags: ['goals', 'required'],
        },
        {
          occur: [
            () =>
              policy.requireSources === true &&
              !definition.queryScopeIds.length &&
              !definition.knowledgeTopicIds.length,
            () => policy.requireTools === true && !definition.toolIds.length,
          ],
          error: invalid,
          tags: ['capability-bindings'],
        },
        {
          occur: [
            () => definition.goalIds.some((intent) => typeof intent !== 'string'),
            () => new Set(definition.goalIds).size !== definition.goalIds.length,
          ],
          error: invalid,
          tags: ['goals', 'values'],
        },
      ],
      tags,
    );
    assertion(
      policy.assertDefinition?.(input),
      'Registry definition assertions must return void synchronously',
    );
    breakWhile(
      names.some((name) => this.byId.has(name) || this.aliases.has(name)),
      invalid,
      [...tags, 'duplicate'],
    );
    const frozen = Object.freeze({
      ...definition,
      goalIds: Object.freeze([...definition.goalIds]),
      domainToolIds: Object.freeze([...definition.goalIds]),
      toolIds: Object.freeze([...definition.toolIds]),
      queryScopeIds: Object.freeze([...definition.queryScopeIds]),
      knowledgeTopicIds: Object.freeze([...definition.knowledgeTopicIds]),
      aliases: Object.freeze([...(definition.aliases ?? [])]),
      evidence: Object.freeze(
        [...(definition.evidence ?? [])].map((item) => Object.freeze(registrationData(item))),
      ),
    }) as RegisteredScope<Definition>;
    this.byId.set(definition.id, frozen);
    this.sources.set(definition.id, input);
    for (const alias of definition.aliases ?? []) this.aliases.set(alias, definition.id);
    return this;
  }

  /** Register every scope in iteration order. */
  registerAll(definitions: Iterable<Definition>): this {
    for (const definition of definitions) this.register(definition);
    return this;
  }
  /** Finalize the registry; no registration is accepted afterwards. */
  seal(): this {
    this.sealed = true;
    return this;
  }
  /** Registered scopes in registration order. */
  get definitions() {
    return Object.freeze([...this.byId.values()]);
  }
  /** Registered scope ids in registration order; aliases are not included. */
  ids(): readonly string[] {
    return Object.freeze([...this.byId.keys()]);
  }
  /** Iterate the registered scopes. */
  values() {
    return this.byId.values();
  }
  /** Iterate `[id, scope]` pairs. */
  entries() {
    return this.byId.entries();
  }
  /**
   * Registered scope for an id or alias.
   *
   * @throws TypeError When the name resolves to nothing.
   */
  require(id: string) {
    const value = this.get(id);
    if (!value) throw new TypeError(`Unknown scope: ${id}`);
    return value;
  }
  /** Resolve an alias to its scope id; unknown names are returned unchanged. */
  normalize(scope: string): string {
    return this.aliases.get(scope) ?? scope;
  }
  /** Registered scope for an id or alias, or `undefined` for a null/unknown name. */
  get(scope?: string | null): RegisteredScope<Definition> | undefined {
    return scope ? this.byId.get(this.normalize(scope)) : undefined;
  }
  /** Whether the name resolves to a registered scope. */
  has(scope?: string | null): boolean {
    return !!this.get(scope);
  }
  /**
   * Whether a scope accepts an intent.
   *
   * The App may override the declared `goalIds` through `acceptsGoal`; without an
   * override the membership check applies.
   */
  acceptsGoal(scope: string, goal: string): boolean {
    const definition = this.get(scope);
    if (!definition) return false;
    const ids: readonly string[] = definition.goalIds;
    return this.policy.acceptsGoal
      ? booleanResult(
          this.policy.acceptsGoal(this.sources.get(this.normalize(scope))!, goal),
          'Scope intent predicates must return boolean synchronously',
        )
      : ids.includes(goal);
  }
  /** Whether the scope declares this query scope; a null scope accepts nothing. */
  acceptsQuery(scope: string | null, queryScope: string): boolean {
    const ids: readonly string[] = this.get(scope)?.queryScopeIds ?? [];
    return !!scope && ids.includes(queryScope);
  }
  /** Whether the scope belongs to the given App category. */
  is(scope: string | null | undefined, category: Definition['category']): boolean {
    return this.get(scope)?.category === category;
  }
  /** Every query scope declared by any registered scope, deduplicated. */
  queryScopeIds(): string[] {
    return [...new Set([...this.byId.values()].flatMap((item) => item.queryScopeIds))];
  }
  /** Knowledge topic ids of one scope; copied so callers cannot mutate the registry. */
  topics(scope?: string | null): string[] {
    return [...(this.get(scope)?.knowledgeTopicIds ?? [])];
  }
  /** Evidence declarations of one scope; copied so callers cannot mutate the registry. */
  evidence(scope?: string | null): RegisteredScopeEvidence<Definition>[] {
    return [...(this.get(scope)?.evidence ?? [])];
  }
  /** Canonical domain membership predicate. */
  acceptsDomainTool(scope: string, domainToolId: string): boolean {
    return this.acceptsGoal(scope, domainToolId);
  }
  /** Canonical scope descriptions; legacy describe retains its shape. */
  describeDomainScopes(ids?: readonly string[]) {
    return this.describe(ids).map(domainProjection);
  }
  /** Declared context tier of one scope, if any. */
  contextTier(scope?: string | null): Definition['contextTier'] | undefined {
    return this.get(scope)?.contextTier;
  }
  /**
   * Copy the scopes that accept at least one of the given goals.
   *
   * @param goals - Goal ids to filter by; omit to include every registered scope.
   * @returns Descriptions whose arrays are copied so callers cannot mutate registry state.
   */
  describe(goals?: readonly string[]): ScopeDescription<Definition>[] {
    const selected = goals ? new Set(goals) : undefined;
    return [...this.byId.values()]
      .filter((item) => !selected || item.goalIds.some((goal) => selected.has(goal)))
      .map((item) => ({
        ...item,
        goalIds: [...item.goalIds],
        queryScopeIds: [...item.queryScopeIds],
        knowledgeTopicIds: [...item.knowledgeTopicIds],
        toolIds: [...item.toolIds],
        aliases: [...item.aliases],
        evidence: [...item.evidence],
      })) as ScopeDescription<Definition>[];
  }
}

/**
 * Create and seal a complete catalog; use the constructor for incremental installation.
 *
 * @param definitions - Scope declarations registered in iteration order.
 * @param policy - Optional registry policy forwarded to the constructor.
 * @returns A sealed registry.
 * @throws A configured error for the first invalid or duplicate declaration.
 */
export function createScopeRegistry<Definition extends ScopeDefinition>(
  definitions: Iterable<Definition>,
  policy: ScopeRegistryPolicy<Definition> = {},
): ScopeRegistry<Definition> {
  return new ScopeRegistry(policy).registerAll(definitions).seal();
}

export type {
  ScopeDefinition,
  ScopeDescription,
  ScopeRegistryPolicy,
  RegisteredScope,
  RegisteredScopeEvidence,
} from '../../structs/kits/domains/scopes.js';

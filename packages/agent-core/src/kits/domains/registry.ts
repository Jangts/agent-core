import { domainAlias, domainProjection } from './compatibility.js';
/**
 * Domain Tools Kit: an ordered, sealable registry of domain Tool declarations.
 *
 * Place in the package: part of the domain Tool Kit. Goal semantics and the allowed vocabulary
 * (scope modes, target modes, context tiers, delegates, actions) are App configuration; this class
 * owns the common lifecycle — validation, ordering, duplicate detection and sealing.
 *
 * Exports: `DomainToolRegistry`, `createDomainToolRegistry`, and the domain Tool registry types.
 */
import { bindIntent, snapshotIntent } from '../../capabilities/tool-conditions.js';
import type {
  DomainTool,
  DomainToolRegistration,
  DomainToolDescription,
  DomainToolPolicy,
  DomainToolId,
  RegisteredDomainTool,
} from '../../structs/kits/domains/registry.js';
import { assertion } from '../../utils/synchronous.js';
import { breakWhile } from '../../utils/rules.js';
import { registrationData } from '../../utils/registration.js';
import { ModelToolRegistry } from '../../capabilities/model.js';

/**
 * Goal semantics and allowed values are configuration; the registry owns their common lifecycle.
 *
 * Registration order is preserved by `ids`, `definitions`, `values` and `entries`; once
 * `seal()` is called the set is final and further registration is rejected.
 */
export class DomainToolRegistry<
  Definition extends DomainToolRegistration = DomainToolRegistration,
> {
  /** Create and seal a complete catalog in one call. */
  static readonly create: typeof createDomainToolRegistry = createDomainToolRegistry;

  private readonly byId = new Map<string, RegisteredDomainTool<Definition>>();
  private sealed = false;
  private modelView?: ModelToolRegistry;
  private readonly policy: DomainToolPolicy<Definition>;
  /**
   * @param policy - Optional id pattern, vocabulary lists, error wording and assertion hook.
   *   Lists and the pattern are copied so later mutation of the input cannot weaken checks.
   */
  constructor(policy: DomainToolPolicy<Definition> = {}) {
    const pattern = policy.idPattern;
    const errorPorts = policy.errors,
      { sealed, invalid, duplicate } = errorPorts ?? {};
    const listFields = [
      'scopeModes',
      'targetModes',
      'contextTiers',
      'actions',
      'delegates',
      'handoffValues',
      'tags',
    ] as const;
    const lists = Object.fromEntries(
      listFields.map((key) => {
        const value = policy[key];
        return [key, value === undefined ? undefined : Object.freeze([...value])];
      }),
    ) as Pick<DomainToolPolicy<Definition>, (typeof listFields)[number]>;
    this.policy = Object.freeze({
      ...registrationData(policy, ['idPattern', 'assertDefinition', 'errors', ...listFields]),
      ...lists,
      idPattern: pattern ? new RegExp(pattern.source, pattern.flags) : undefined,
      errors:
        errorPorts &&
        Object.freeze({
          sealed: typeof sealed === 'function' ? sealed.bind(errorPorts) : sealed,
          invalid: typeof invalid === 'function' ? invalid.bind(errorPorts) : invalid,
          duplicate: duplicate?.bind(errorPorts),
        }),
      assertDefinition: policy.assertDefinition?.bind(policy),
    });
  }

  /**
   * Validate, freeze and add one domain Tool.
   *
   * Checks run in a fixed order — sealed, identity, context contract, auxiliary actions,
   * handoff, plan, delegates — so the reported violation is stable when several rules fail.
   *
   * @param input - Goal declaration; the App's own assertion receives this original object,
   *   not the compiled copy, so helpers and prototype methods keep working.
   * @returns This registry, for chaining.
   * @throws A configured error for a sealed registry, invalid identity or vocabulary values,
   *   empty/duplicate delegates, or a duplicate Tool id.
   */
  register(input: Definition): this {
    const id: Definition['id'] = input.id;
    const definition = {
      ...registrationData(input, [
        'id',
        'description',
        'delegates',
        'scopePolicy',
        'targetPolicy',
        'contextTier',
        'planIntent',
        'auxiliaryActions',
        'preparedHandoff',
      ]),
      id,
      description: input.description,
      delegates: input.delegates ?? [],
      scopePolicy: domainAlias<string>(input, 'scopeMode', 'scopePolicy'),
      scopeMode: domainAlias<string>(input, 'scopeMode', 'scopePolicy'),
      targetPolicy: domainAlias<string>(input, 'targetMode', 'targetPolicy'),
      targetMode: domainAlias<string>(input, 'targetMode', 'targetPolicy'),
      contextTier: input.contextTier,
      planIntent: domainAlias<string>(input, 'planningAction', 'planIntent'),
      planningAction: domainAlias<string>(input, 'planningAction', 'planIntent'),
      auxiliaryActions: input.auxiliaryActions,
      preparedHandoff: input.preparedHandoff,
    };
    const policy = this.policy;
    const invalid = policy.errors?.invalid ?? 'Invalid goal Tool definition';
    const tags = policy.tags ?? [];
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
          error: policy.errors?.sealed ?? 'Goal registry is sealed',
          tags: ['sealed'],
        },
        {
          occur: [() => !validName(definition.id), () => !definition.description.trim()],
          error: invalid,
          tags: ['identity'],
        },
        {
          occur: [
            () =>
              policy.scopeModes !== undefined &&
              !policy.scopeModes.includes(definition.scopePolicy!),
            () =>
              policy.targetModes !== undefined &&
              !policy.targetModes.includes(definition.targetPolicy!),
            () =>
              policy.contextTiers !== undefined &&
              !policy.contextTiers.includes(definition.contextTier!),
          ],
          error: invalid,
          tags: ['context-contract'],
        },
        {
          occur: [
            () => definition.auxiliaryActions !== undefined && !definition.auxiliaryActions.length,
            () =>
              definition.auxiliaryActions !== undefined &&
              definition.auxiliaryActions.some(
                (action) => policy.actions !== undefined && !policy.actions.includes(action),
              ),
            () =>
              definition.auxiliaryActions !== undefined &&
              new Set(definition.auxiliaryActions).size !== definition.auxiliaryActions.length,
          ],
          error: invalid,
          tags: ['auxiliary-actions'],
        },
        {
          occur: () =>
            definition.preparedHandoff !== undefined &&
            policy.handoffValues !== undefined &&
            !policy.handoffValues.includes(definition.preparedHandoff),
          error: invalid,
          tags: ['handoff'],
        },
        {
          occur: () =>
            policy.actions !== undefined && !policy.actions.includes(definition.planIntent!),
          error: invalid,
          tags: ['plan'],
        },
        {
          occur: [
            () => input.delegates !== undefined && !definition.delegates.length,
            () =>
              definition.delegates.some(
                (delegate) =>
                  policy.delegates !== undefined && !policy.delegates.includes(delegate),
              ),
            () => new Set(definition.delegates).size !== definition.delegates.length,
          ],
          error: invalid,
          tags: ['delegates'],
        },
      ],
      tags,
    );
    // App assertions may use implementation helpers; never pass a compiled view as the source
    // instance.
    assertion(
      policy.assertDefinition?.(input),
      'Registry definition assertions must return void synchronously',
    );
    breakWhile(
      this.byId.has(definition.id),
      () =>
        policy.errors?.duplicate?.(definition.id) ?? new Error(`Duplicate tool: ${definition.id}`),
      [...tags, 'duplicate'],
    );
    this.byId.set(
      definition.id,
      Object.freeze({
        ...definition,
        ...new ModelToolRegistry([
          {
            id: input.id,
            description: input.description,
            active: typeof input.active === 'function' ? input.active.bind(input) : input.active,
            asIntent: bindIntent(
              snapshotIntent(
                typeof input.asIntent === 'function' ? input.asIntent.bind(input) : input.asIntent,
              ),
              input,
            ),
            inputSchema: input.inputSchema ?? {
              jsonSchema: { type: 'object' },
              parse(value: unknown) {
                if (!value || typeof value !== 'object' || Array.isArray(value))
                  throw new TypeError('Tool input must be an object');
                return value;
              },
            },
            resolve:
              input.resolve?.bind(input) ?? ((value: unknown) => ({ toolId: id, input: value })),
          },
        ]).require(input.id),
        delegates: Object.freeze([...definition.delegates]),
        ...(definition.auxiliaryActions
          ? { auxiliaryActions: Object.freeze([...definition.auxiliaryActions]) }
          : {}),
      }) as RegisteredDomainTool<Definition>,
    );
    this.modelView = undefined;
    return this;
  }

  /** Register every domain Tool in iteration order. */
  registerAll(definitions: Iterable<Definition>): this {
    for (const definition of definitions) this.register(definition);
    return this;
  }
  /** Registered domain Tool for `id`, or `undefined` when it is absent. */
  get(goal: string): RegisteredDomainTool<Definition> | undefined {
    return this.byId.get(goal);
  }
  /** Whether a Tool id is registered. */
  has(goal: string): boolean {
    return this.byId.has(goal);
  }
  /** Registered Tool ids in registration order. */
  ids(): readonly DomainToolId<Definition>[] {
    return Object.freeze([...this.byId.keys()]) as readonly DomainToolId<Definition>[];
  }
  /** Registered goals in registration order. */
  get definitions(): readonly RegisteredDomainTool<Definition>[] {
    return Object.freeze([...this.byId.values()]);
  }
  /** Iterate the registered goals. */
  values() {
    return this.byId.values();
  }
  /** Resolve a grouped transport's selected Tool through that Tool's own parser and resolver. */
  resolve(
    selection: import('../../structs/capabilities/model.js').ModelSelection,
    context: Readonly<{ stageId: string }>,
  ): unknown {
    return this.models().resolve(selection, context);
  }
  /** Explicit node selection uses the same immutable model projection. */
  select(
    selection: readonly string[] | import('../../structs/capabilities/model.js').ModelToolSelection,
    ...context: [] | [unknown]
  ): ModelToolRegistry {
    return context.length
      ? this.models().select(selection, context[0])
      : this.models().select(selection);
  }
  /** Cache only immutable declarations; request activation is evaluated by each projection. */
  private models(): ModelToolRegistry {
    return (this.modelView ??= new ModelToolRegistry(this.byId.values()).seal());
  }
  /** Iterate `[id, tool]` pairs. */
  entries() {
    return this.byId.entries();
  }
  /**
   * Registered domain Tool for `id`.
   *
   * @throws TypeError When the id is not registered.
   */
  require(id: string): RegisteredDomainTool<Definition> {
    const value = this.byId.get(id);
    if (!value) throw new TypeError(`Unknown tool: ${id}`);
    return value;
  }
  /**
   * Copy the selected goals out of the registry.
   *
   * @param goals - Ids to include; the default is every registered id, in registry order.
   * @returns Descriptions whose arrays are copied so callers cannot mutate registry state.
   */
  describe(goals: readonly string[] = this.ids()): DomainToolDescription<Definition>[] {
    const selected = new Set(goals);
    return [...this.byId.values()]
      .filter((item) => selected.has(item.id))
      .map((item) => ({
        ...item,
        delegates: [...item.delegates],
      })) as DomainToolDescription<Definition>[];
  }
  /** Canonical domain metadata; the 0.9 describe view remains available separately. */
  describeDomainTools(ids: readonly string[] = this.ids()) {
    return this.describe(ids).map(domainProjection);
  }
  /** Finalize the registry; no registration is accepted afterwards. */
  seal(): this {
    this.sealed = true;
    return this;
  }
}

/**
 * Create and seal a complete catalog; use the constructor for incremental installation.
 *
 * @param definitions - Goal declarations registered in iteration order.
 * @param policy - Optional registry policy forwarded to the constructor.
 * @returns A sealed registry.
 * @throws A configured error for the first invalid or duplicate declaration.
 */
export function createDomainToolRegistry<Definition extends DomainToolRegistration>(
  definitions: Iterable<Definition>,
  policy: DomainToolPolicy<Definition> = {},
): DomainToolRegistry<Definition> {
  return new DomainToolRegistry(policy).registerAll(definitions).seal();
}

export type {
  DomainTool,
  DomainToolRegistration,
  DomainToolDescription,
  DomainToolPolicy,
  DomainToolId,
  RegisteredDomainTool,
} from '../../structs/kits/domains/registry.js';

/** @deprecated Use the DomainTool names; compatibility exports remain for 1.x. */
export type {
  DomainToolRegistration as GoalToolRegistration,
  DomainToolDescription as GoalDescription,
  DomainToolPolicy as GoalPolicy,
  RegisteredDomainTool as RegisteredGoal,
  DomainToolId as GoalId,
  DomainTool as GoalTool,
};

/** @deprecated Use DomainToolRegistry and createDomainToolRegistry. Same implementation. */
export { DomainToolRegistry as GoalRegistry, createDomainToolRegistry as createGoalRegistry };

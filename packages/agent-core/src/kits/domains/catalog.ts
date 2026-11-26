import { domainAlias, domainProjection } from './compatibility.js';
/**
 * Domain Tools Kit: project registered goals, scopes and tools into one task-facing catalog.
 *
 * Place in the package: part of the domain Tool Kit. It reads the actual registries supplied by
 * the App instead of maintaining a parallel capability list, so an intent is only advertised
 * when its tools, scopes and availability agree.
 *
 * Exports: `defineAgentCatalog`, and the catalog intent/scope/port types.
 */
import { booleanResult } from '../../utils/synchronous.js';
import { toolActive } from '../../capabilities/tool-conditions.js';
import type { ModelTool } from '../../structs/capabilities/model.js';
import type {
  AgentCatalogPorts,
  CatalogDomainTool,
  CatalogScope,
} from '../../structs/kits/domains/catalog.js';

/**
 * Compile a catalog projection over the App's live registries.
 *
 * The actual registries determine availability and relationships. No parallel capability list
 * exists: `goalIds` filters by tool support, `modelCatalog` narrows to the currently accepted
 * task when `restrictToTask` is enabled, and scope tool ids are filtered to tools that exist.
 *
 * @param ports - Sources for Tool ids, goals, scopes, the current task, the tool registry
 *   and the `restrictToTask` switch.
 * @returns A frozen projection with `goalIds`, `goalDelegates`, `goalCatalog`,
 *   `scopeCatalog` and `modelCatalog`.
 * @throws TypeError When a supplied predicate does not return a boolean synchronously.
 */
export function defineAgentCatalog<
  App,
  Id extends string,
  Goal extends CatalogDomainTool<Id>,
  Scope extends CatalogScope,
>(ports: AgentCatalogPorts<App, Id, Goal, Scope>) {
  const idSource = domainAlias<(app: App) => readonly Id[]>(ports, 'domainToolIds', 'goalIds');
  const domainSource = domainAlias<(ids?: readonly Id[]) => readonly Goal[]>(
    ports,
    'domainTools',
    'goals',
  );
  const executionSource = domainAlias<
    import('../../structs/kits/domains/catalog.js').LegacyAgentCatalogPorts<
      App,
      Id,
      Goal,
      Scope
    >['tools'] & { supportsDomainTool?: (id: Id, app: App) => boolean }
  >(ports, 'executionTools', 'tools');
  if (!idSource || !domainSource || !executionSource)
    throw new TypeError('Domain and execution catalog ports are required');
  const membership = domainAlias<(id: Id, app: App) => boolean>(
    executionSource,
    'supportsDomainTool',
    'supportsGoal',
  );
  if (!membership) throw new TypeError('A domain support predicate is required');
  const ids = idSource.bind(ports),
    goals = domainSource.bind(ports),
    scopes = ports.scopes.bind(ports),
    task = (app: App) => {
      const value = ports.currentTask.call(ports, app);
      if (!value) return value;
      const goalId = domainAlias<Id>(value, 'domainToolId', 'goalId');
      if (goalId === undefined) throw new TypeError('A current domain tool id is required');
      return { ...value, goalId };
    };
  const tools = {
    values: executionSource.values.bind(executionSource),
    protocols: executionSource.protocols?.bind(executionSource),
    has: executionSource.has.bind(executionSource),
    supports: membership.bind(executionSource),
    describe: executionSource.describe.bind(executionSource),
  };
  const restrict = ports.restrictToTask !== false;
  const boolean = (value: unknown) =>
    booleanResult(
      value,
      'Catalog predicates must be synchronous',
      'Catalog predicates must return boolean',
    );
  /** Whether one goal is active and its demand metadata currently participates. */
  const goalAvailable = (goal: Goal, app: App): boolean => {
    const tool = goal as Goal & Partial<ModelTool<unknown, unknown, App>>;
    if (!toolActive(tool.active, app)) return false;
    const metadata = tool.asIntent;
    if (metadata === undefined || metadata === true || typeof metadata === 'string') return true;
    if (typeof metadata === 'function') return toolActive(metadata, app);
    return toolActive(metadata.when, app);
  };
  const goalIds = (app: App) => ids(app).filter((id) => boolean(tools.supports(id, app)));
  const projectDelegates = (app?: App) =>
    domainToolDelegates(goals(), tools.values(), tools.protocols?.(), app);
  const goalCatalog = (app: App) => {
    const selected = goalIds(app),
      described = tools.describe('model', app),
      delegates = projectDelegates(app);
    return goals(selected)
      .filter((goal) => goalAvailable(goal, app))
      .map((goal) => {
        const {
          inputSchema: _schema,
          resolve: _resolve,
          active: _active,
          asIntent: _asIntent,
          ...metadata
        } = goal as Goal & Partial<ModelTool<unknown, unknown, App>>;
        const demandDescription =
          typeof _asIntent === 'string'
            ? _asIntent
            : typeof _asIntent === 'object' && _asIntent !== null
              ? _asIntent.description
              : undefined;
        return {
          ...metadata,
          ...(demandDescription ? { description: demandDescription } : {}),
          delegates: delegates.get(goal.id) ?? [...goal.delegates],
          scopeIds: scopes([goal.id]).map((scope) => scope.id),
          toolIds: described
            .filter((tool) => tool.goalIds.includes(goal.id))
            .map((tool) => tool.id),
        };
      });
  };
  const scopeCatalog = (app: App) =>
    scopes(goalCatalog(app).map((goal) => goal.id)).map((scope) => ({
      ...scope,
      toolIds: scope.toolIds.filter(tools.has),
    }));
  return Object.freeze({
    domainToolIds: goalIds,
    domainToolDelegates: projectDelegates,
    domainToolCatalog: (app: App) => goalCatalog(app).map(domainProjection),
    domainScopeCatalog: (app: App) => scopeCatalog(app).map(domainProjection),
    goalIds,
    goalDelegates: projectDelegates,
    goalCatalog,
    scopeCatalog,
    modelCatalog(app: App) {
      const accepted = restrict ? task(app) : undefined,
        selected = goalIds(app).filter((id) => !accepted || id === accepted.goalId),
        available = goalCatalog(app).filter((intent) => selected.includes(intent.id));
      return {
        availableGoalIds: available.map((intent) => intent.id),
        availableGoals: available.map((intent) =>
          accepted ? { ...intent, scopeIds: accepted.scopeId ? [accepted.scopeId] : [] } : intent,
        ),
        availableScopes: scopeCatalog(app).filter(
          (scope) => !accepted || scope.id === accepted.scopeId,
        ),
        availableTools: tools
          .describe('model', app)
          .filter((tool) => !accepted || tool.goalIds.includes(accepted.goalId)),
      };
    },
  });
}

/** Derive allowed next steps from tool membership and installed protocols; explicit constraints stay closed. */
export function domainToolDelegates<App>(
  goals: readonly CatalogDomainTool[],
  tools: Iterable<import('../../structs/kits/domains/catalog.js').CatalogExecutionTool<App>>,
  protocols?: Iterable<readonly [string, { readonly terminal?: boolean }]>,
  context?: App,
): Map<string, string[]> {
  const registered = [...tools];
  const byId = new Map(registered.map((tool) => [tool.id, tool]));
  const available = protocols ? new Map(protocols) : undefined;
  const terminal = available
    ? [...available].filter(([, protocol]) => protocol.terminal).map(([id]) => id)
    : [];
  const active = (id: string) => {
    if (available && !available.has(id)) return false;
    const tool = byId.get(id);
    return !tool || context === undefined || toolActive(tool.active, context);
  };
  return new Map(
    goals.map((goal) => [
      goal.id,
      goal.delegates.length
        ? goal.delegates.filter(active)
        : [
            ...new Set([
              ...registered
                .filter(
                  (tool) =>
                    (available ? available.has(tool.id) : !!tool.lifecycle?.call) &&
                    active(tool.id) &&
                    (domainAlias<'all' | readonly string[]>(tool, 'domainToolIds', 'goalIds') ===
                      'all' ||
                      (
                        domainAlias<readonly string[]>(tool, 'domainToolIds', 'goalIds') ?? []
                      ).includes(goal.id)),
                )
                .map((tool) => tool.id),
              ...terminal,
            ]),
          ],
    ]),
  );
}

export type * from '../../structs/kits/domains/catalog.js';

/** @deprecated Use domainToolDelegates. */
export { domainToolDelegates as goalDelegates };

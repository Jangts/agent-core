/**
 * Validated workflow catalog and round accounting.
 *
 * A workflow is declared as data (nodes plus routes) and validated before any handler
 * runs: references must resolve, every node must be reachable from the entry, and every
 * cycle must cross a round boundary so the engine's budget stays authoritative. This
 * module owns the catalog; `engine.ts` owns traversal and execution.
 *
 * Exports: `AgentWorkflow`, `defineWorkflow`, `AttemptBudget`, the re-exported
 * `requireWorkflowValue` and `route`, and the workflow contract types.
 */
import { projectWorkflowGraph } from './workflow-graph.js';
import { projectWorkflowRunTrace } from './workflow-chain.js';
import type {
  WorkflowGraph,
  WorkflowRunTrace,
  WorkflowRunTraceSource,
} from '../structs/execution/workflow-views.js';
import { WorkflowContractError } from '../structs/errors.js';
import type {
  AgentWorkflowDefinition,
  WorkflowExtension,
  WorkflowNode,
  WorkflowRoute,
} from '../structs/execution/workflow.js';

/**
 * Derive unique route ids for one node.
 *
 * Explicit ids are reserved before any suffix is generated, so a generated `~2` id can
 * never collide with an id that is already declared later in the same node. The first
 * occurrence keeps its id; later duplicates are renamed deterministically in order.
 *
 * @param routes - Routes of one node, in declaration order.
 * @returns One id per route, using undefined where the route declared none.
 */
function assignRouteIds<State, Result, Runtime>(
  routes: readonly WorkflowRoute<State, Result, Runtime>[],
) {
  const reserved = new Set(routes.map((route) => route.id));
  const used = new Set<string>();
  return routes.map(({ id }) => {
    if (id === undefined) return undefined;
    if (used.has(id)) {
      const base = id;
      for (let suffix = 2; reserved.has(id) || used.has(id); suffix++) id = `${base}~${suffix}`;
    }
    used.add(id);
    return id;
  });
}

/**
 * Reject node fields that were renamed.
 *
 * Accepting `round` or `onError` silently would change budget and recovery behavior, so
 * the older names are reported instead of being mapped.
 *
 * @param node - Node about to be registered.
 * @throws TypeError When a renamed field is present.
 */
function validateNodeFields(node: { readonly id: string }): void {
  if ('round' in node || 'onError' in node)
    throw new TypeError(`Use startsRound and onErrorNodeId: ${node.id}`);
}

/**
 * Executable catalog: validate references and bounded cycles before any handler runs.
 *
 * Validation happens once, at construction, so traversal can assume every target exists
 * and every cycle is budget-bounded.
 */
export class AgentWorkflow<State, Result, Runtime = undefined> {
  /** Workflow id, also used in diagnostics and error messages. */
  readonly id: string;
  /** First node visited; always starts a round. */
  readonly entryNodeId: string;
  /** Optional revision passed through to diagnostics. */
  readonly revision?: string;
  /** Optional result guard; when present it must return exactly true. */
  readonly isResult?: (result: Result) => boolean;
  private readonly traceSource?: WorkflowRunTraceSource;
  private readonly nodes = new Map<string, WorkflowNode<State, Result, Runtime>>();

  /**
   * Build and validate a workflow.
   *
   * The entry node must start a round, because otherwise a workflow could loop forever
   * without consuming the round budget. Renamed top-level fields are rejected as well.
   *
   * @param definition - Nodes, entry, id, optional revision and result guard.
   * @throws TypeError When the definition, a node, a route or a graph invariant is invalid.
   */
  constructor(definition: AgentWorkflowDefinition<State, Result, Runtime>) {
    if ('entry' in definition || 'validateResult' in definition)
      throw new TypeError('Use entryNodeId and isResult');
    const entry = definition.entryNodeId ?? definition.nodes[0]?.id;
    if (!definition.id?.trim() || !entry?.trim() || !definition.nodes.length) {
      throw new TypeError('Invalid workflow');
    }
    if (definition.traceSource !== undefined && definition.chainSource !== undefined)
      throw new TypeError('Use traceSource or legacy chainSource, not both');
    this.traceSource = (definition.traceSource ?? definition.chainSource)?.bind(definition);
    this.id = definition.id;
    this.entryNodeId = entry;
    this.revision = definition.revision;
    this.isResult = definition.isResult?.bind(definition);
    for (const node of definition.nodes) this.register(node);
    if (!this.require(this.entryNodeId).startsRound)
      throw new TypeError('Workflow entry must start a bounded round');
    this.checkReferences();
    this.checkReachability();
    this.checkBoundedCycles();
  }

  /**
   * Derive an extended workflow without mutating this catalog.
   *
   * Every node is copied with its callbacks rebound, so the new catalog keeps the same
   * entry and result guard and can be composed repeatedly. Route overrides are keyed by
   * node id and must name a node that exists after the merge.
   *
   * @param extension - Extension patch, or another workflow whose definitions are merged.
   * @param routes - Route overrides keyed by node id.
   * @returns A new, fully re-validated workflow.
   * @throws TypeError When an override names an unknown node or a node is invalid.
   */
  add(
    extension: WorkflowExtension<State, Result, Runtime> | AgentWorkflow<State, Result, Runtime>,
    routes: WorkflowExtension<State, Result, Runtime>['routes'] = {},
  ): AgentWorkflow<State, Result, Runtime> {
    const patch =
      extension instanceof AgentWorkflow ? { nodes: extension.definitions, routes } : extension;
    for (const node of patch.nodes) validateNodeFields(node);
    const nodes = [...this.definitions, ...patch.nodes];
    for (const id of Object.keys(patch.routes ?? {})) {
      if (!nodes.some((node) => node.id === id))
        throw new TypeError(`Unknown workflow route source: ${id}`);
    }
    return new AgentWorkflow({
      id: this.id,
      revision: patch.revision,
      traceSource: this.traceSource,
      entryNodeId: this.entryNodeId,
      isResult: this.isResult,
      nodes: nodes.map((node) => ({
        id: node.id,
        description: node.description,
        name: node.name,
        startsRound: node.startsRound,
        onErrorNodeId: node.onErrorNodeId,
        onErrorRouteId: node.onErrorRouteId,
        requires: node.requires,
        provides: node.provides,
        run: node.run?.bind(node),
        report: node.report?.bind(node),
        routes: Object.hasOwn(patch.routes ?? {}, node.id) ? patch.routes![node.id] : node.routes,
      })),
    });
  }

  /** Export topology from the registered snapshot without executing callbacks. */
  toGraph(): WorkflowGraph {
    return projectWorkflowGraph(this.id, this.entryNodeId, this.revision, this.definitions);
  }

  /** Read an authorized run through the bound App source, or an explicit per-call source. */
  /** @deprecated Use toTrace. Reads the same authorized run projection. */
  toChain(runId: string, source?: WorkflowRunTraceSource): Promise<WorkflowRunTrace> {
    return this.toTrace(runId, source);
  }

  async toTrace(
    runId: string,
    source: WorkflowRunTraceSource | undefined = this.traceSource,
  ): Promise<WorkflowRunTrace> {
    if (!runId.trim()) throw new TypeError('A runId is required');
    if (!source) throw new TypeError('Workflow traceSource (legacy chainSource) is not configured');
    return projectWorkflowRunTrace(this.id, runId, await source(runId));
  }

  /**
   * Look up a node that must exist.
   *
   * @param id - Node id.
   * @returns The registered node.
   * @throws TypeError When the node is unknown.
   */
  require(id: string): WorkflowNode<State, Result, Runtime> {
    const node = this.nodes.get(id);
    if (!node) throw new TypeError(`Unknown workflow node: ${id}`);
    return node;
  }

  /** Frozen snapshot of all nodes, in registration order. */
  get definitions(): readonly Readonly<WorkflowNode<State, Result, Runtime>>[] {
    return Object.freeze([...this.nodes.values()]);
  }
  /** @returns A frozen array of node ids in registration order. */
  ids(): readonly string[] {
    return Object.freeze([...this.nodes.keys()]);
  }
  /** @returns An iterator over the registered nodes. */
  values() {
    return this.nodes.values();
  }
  /** @returns An iterator over id/node pairs. */
  entries() {
    return this.nodes.entries();
  }
  /**
   * @param id - Node id.
   * @returns Whether the node is registered.
   */
  has(id: string): boolean {
    return this.nodes.has(id);
  }
  /**
   * @param id - Node id.
   * @returns The node, or undefined when it is not registered.
   */
  get(id: string) {
    return this.nodes.get(id);
  }

  /**
   * Produce a serializable description of every node and route.
   *
   * Used by documentation and registration listings; it reports resolved ids and which
   * routes are terminal or conditional, never the handler implementations.
   *
   * @returns An array of plain description objects in registration order.
   */
  describe() {
    return [...this.nodes.values()].map((node) => ({
      id: node.id,
      description: node.description,
      ...(node.name ? { name: node.name } : {}),
      startsRound: node.startsRound === true,
      onErrorNodeId: node.onErrorNodeId,
      requires: node.requires ?? [],
      provides: node.provides ?? [],
      routes: node.routes.map((route) => ({
        ...(route.id !== undefined ? { id: route.id } : {}),
        ...(route.description !== undefined ? { description: route.description } : {}),
        ...(route.conditionId !== undefined ? { conditionId: route.conditionId } : {}),
        targetNodeId: route.targetNodeId,
        terminal: !!route.complete,
        conditional: !!route.when,
      })),
    }));
  }

  /**
   * Validate and freeze one node, then add it to the catalog.
   *
   * A route must be either a jump with a target or a completion, never both; an
   * unconditional route must be last, because it would shadow every later route. Route
   * ids and condition ids are resolved here so the engine never interpolates templates at
   * run time.
   *
   * @param node - Node supplied by the workflow definition.
   * @throws TypeError When the node, a route or a state contract is invalid.
   */
  private register(node: WorkflowNode<State, Result, Runtime>): void {
    const declaredRoutes = node.routes;
    if (
      !node.id?.trim() ||
      !node.description?.trim() ||
      this.nodes.has(node.id) ||
      !declaredRoutes.length ||
      (node.run !== undefined && typeof node.run !== 'function')
    ) {
      throw new TypeError('Invalid or duplicate workflow node');
    }
    validateNodeFields(node);
    if (node.onErrorRouteId !== undefined && (!node.onErrorRouteId.trim() || !node.onErrorNodeId))
      throw new TypeError(`Invalid workflow error route identity: ${node.id}`);
    const ids = assignRouteIds(declaredRoutes);
    for (const [index, route] of declaredRoutes.entries()) {
      if (
        'to' in route ||
        (route.id !== undefined && !route.id.trim()) ||
        (route.conditionId !== undefined && (!route.conditionId.trim() || !route.when))
      )
        throw new TypeError(`Invalid workflow route identity: ${node.id}`);
      const hasTarget = typeof route.targetNodeId === 'string';
      const hasCompletion = typeof route.complete === 'function';
      const shadowsFollowingRoutes = !route.when && index !== declaredRoutes.length - 1;
      if (
        hasTarget === hasCompletion ||
        shadowsFollowingRoutes ||
        (route.when !== undefined && typeof route.when !== 'function')
      ) {
        throw new TypeError(`Invalid or unreachable workflow route: ${node.id}`);
      }
    }
    for (const fields of [node.requires, node.provides]) {
      if (
        fields &&
        (fields.some((field) => typeof field !== 'string' || !field.trim()) ||
          new Set(fields).size !== fields.length)
      ) {
        throw new TypeError(`Invalid workflow state contract: ${node.id}`);
      }
    }
    const routes = Object.freeze(
      declaredRoutes.map((route, index) => {
        const id = ids[index];
        const conditionId = route.conditionId?.replace(/\{(nid|rid)\}/g, (_, key) => {
          if (key === 'nid') return node.id;
          if (id === undefined)
            throw new TypeError(`Condition ID references a missing route ID: ${node.id}`);
          return id;
        });
        const common = {
          id,
          description: route.description,
          conditionId,
          when: route.when?.bind(route),
        };
        return Object.freeze(
          route.complete
            ? { ...common, complete: route.complete.bind(route) }
            : { ...common, targetNodeId: route.targetNodeId! },
        );
      }),
    );
    // The entry node starts a round unless it says otherwise; any other node starts one
    // only when it declares it explicitly.
    const startsRound = node.startsRound ?? (node.id === this.entryNodeId ? true : undefined);
    this.nodes.set(
      node.id,
      Object.freeze({
        id: node.id,
        description: node.description,
        name: node.name,
        report: node.report?.bind(node),
        startsRound,
        onErrorRouteId: node.onErrorRouteId,
        onErrorNodeId: node.onErrorNodeId,
        run: node.run?.bind(node),
        routes,
        requires: node.requires ? Object.freeze([...node.requires]) : undefined,
        provides: node.provides ? Object.freeze([...node.provides]) : undefined,
      }),
    );
  }

  /**
   * Collect every node a visit can hand control to.
   *
   * Error targets are included so a recovery node is treated as reachable and is subject
   * to the same cycle rule as a normal transition.
   *
   * @param node - Node whose outgoing edges are collected.
   * @returns Target node ids, including the error node.
   */
  private targets(node: WorkflowNode<State, Result, Runtime>): string[] {
    const targets = node.routes.flatMap((route) =>
      route.targetNodeId !== undefined ? [route.targetNodeId] : [],
    );
    if (node.onErrorNodeId !== undefined) targets.push(node.onErrorNodeId);
    return targets;
  }

  /**
   * Require every route target to name a registered node.
   *
   * @throws TypeError When any target is unknown.
   */
  private checkReferences(): void {
    for (const node of this.nodes.values()) {
      for (const target of this.targets(node)) this.require(target);
    }
  }

  /**
   * Require every node to be reachable from the entry.
   *
   * An unreachable node is a declaration mistake: it would never run, yet it still
   * appears in listings and documentation.
   *
   * @throws TypeError When any node cannot be reached.
   */
  private checkReachability(): void {
    const reachable = new Set<string>();
    const visit = (id: string) => {
      if (reachable.has(id)) return;
      reachable.add(id);
      for (const target of this.targets(this.require(id))) visit(target);
    };
    visit(this.entryNodeId);
    if (reachable.size !== this.nodes.size) throw new TypeError('Unreachable workflow node');
  }

  /**
   * Require every cycle to cross a round boundary.
   *
   * @throws TypeError When a cycle can be traversed without ever starting a new round.
   */
  private checkBoundedCycles(): void {
    // Graph traversal is procedural: every possible cycle, including error routes,
    // must cross a round boundary so the engine can enforce the shared budget.
    const active = new Set<string>();
    const visited = new Set<string>();
    const visit = (id: string) => {
      const node = this.require(id);
      if (node.startsRound || visited.has(id)) return;
      if (active.has(id)) throw new TypeError('Workflow cycle bypasses the round budget');
      active.add(id);
      for (const target of this.targets(node)) visit(target);
      active.delete(id);
      visited.add(id);
    };
    for (const id of this.nodes.keys()) visit(id);
  }
}

/**
 * Build a validated workflow from a definition.
 *
 * @param definition - Workflow definition; validated like the constructor argument.
 * @returns A validated, immutable workflow catalog.
 * @throws TypeError When the definition is invalid.
 */
export function defineWorkflow<State, Result, Runtime = undefined>(
  definition: AgentWorkflowDefinition<State, Result, Runtime>,
): AgentWorkflow<State, Result, Runtime> {
  return new AgentWorkflow(definition);
}

/**
 * Successful acquisitions consume attempts; a refused acquisition never grants another.
 *
 * `available` is a snapshot of the counter, not a reservation: a caller must still call
 * `take` and honor its boolean result before acting.
 */
export class AttemptBudget {
  private consumed = 0;

  /**
   * @param limit - Total attempts allowed; must be a nonnegative integer.
   * @throws TypeError When `limit` is not a nonnegative integer.
   */
  constructor(readonly limit: number) {
    if (!Number.isInteger(limit) || limit < 0)
      throw new TypeError('Attempt limit must be a nonnegative integer');
  }

  /** Attempts consumed so far. */
  get used(): number {
    return this.consumed;
  }
  /** Whether at least one attempt remains unspent. */
  get available(): boolean {
    return this.consumed < this.limit;
  }

  /**
   * Consume one attempt if one remains.
   *
   * @returns True when the attempt was granted, false when the budget is exhausted.
   */
  take(): boolean {
    if (!this.available) return false;
    this.consumed++;
    return true;
  }
}

// Re-exported so workflow authors get state helpers and route builders from one module.
export { requireWorkflowValue, route } from './state.js';

// Re-exported so workflow authors do not import the struct module directly.
export type {
  WorkflowContext,
  WorkflowModel,
  WorkflowRoute,
  WorkflowNode,
  WorkflowNodeReport,
  WorkflowExtension,
  AgentWorkflowDefinition,
  WorkflowEvent,
} from '../structs/execution/workflow.js';

export { WorkflowContractError } from '../structs/errors.js';

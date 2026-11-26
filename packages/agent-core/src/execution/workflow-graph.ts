/** Project the validated catalog to pure topology without evaluating route conditions. */
import type { WorkflowNode } from '../structs/execution/workflow.js';
import type { WorkflowGraph, WorkflowGraphEdge } from '../structs/execution/workflow-views.js';

/** Edge identity depends on topology, never on a route label or callback. */
export function projectWorkflowGraph<S, R, C>(
  workflowId: string,
  entryNodeId: string,
  revision: string | undefined,
  definitions: readonly WorkflowNode<S, R, C>[],
): WorkflowGraph {
  const edges = new Map<string, WorkflowGraphEdge & { routeOrders: number[] }>();
  const nodes = definitions.map((node, order) => {
    const edgeFor = (kind: WorkflowGraphEdge['kind'], targetNodeId?: string) => {
      const id = JSON.stringify([node.id, kind, targetNodeId ?? null]);
      if (!edges.has(id))
        edges.set(id, {
          id,
          kind,
          sourceNodeId: node.id,
          targetNodeId,
          routeOrders: [],
          ...(kind === 'error' ? { errorRouteId: node.onErrorRouteId } : {}),
        });
      return edges.get(id)!;
    };
    const routes = node.routes.map((route, order) => {
      const edge = edgeFor(route.complete ? 'complete' : 'transition', route.targetNodeId);
      edge.routeOrders.push(order);
      return {
        order,
        routeId: route.id,
        description: route.description,
        conditional: !!route.when,
        conditionId: route.conditionId,
        edgeId: edge.id,
      };
    });
    if (node.onErrorNodeId) edgeFor('error', node.onErrorNodeId);
    return {
      id: node.id,
      name: node.name ?? node.id,
      description: node.description,
      order,
      startsRound: !!node.startsRound,
      requires: [...(node.requires ?? [])],
      provides: [...(node.provides ?? [])],
      routes,
      incomingEdgeIds: [] as string[],
      outgoingEdgeIds: [] as string[],
    };
  });
  const byId = new Map(nodes.map((node) => [node.id, node]));
  for (const edge of edges.values()) {
    byId.get(edge.sourceNodeId)!.outgoingEdgeIds.push(edge.id);
    if (edge.targetNodeId) byId.get(edge.targetNodeId)!.incomingEdgeIds.push(edge.id);
  }
  return freezeView({
    schemaVersion: 1,
    workflowId,
    revision,
    entryNodeId,
    nodes,
    edges: [...edges.values()],
  });
}

/** Freeze detached JSON data recursively so callers cannot alter another consumer's view. */
export function freezeView<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeView(child);
    Object.freeze(value);
  }
  return value;
}

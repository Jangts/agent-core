/** Compare two registered workflow snapshots and trace changed declarations to their direct users. */
import { unverified } from '../workflow-inspector/evidence.mjs';
import { project, validate } from '../workflow-inspector/snapshot.mjs';

const sections = [
  {
    name: 'nodes',
    select: ({ graph }) => graph.nodes,
    id: 'id',
    skip: ['order', 'incomingEdgeIds', 'outgoingEdgeIds'],
  },
  { name: 'edges', select: ({ graph }) => graph.edges, id: 'id', skip: ['routeOrders'] },
  { name: 'matrixIntents', select: ({ lifecycleMatrix }) => lifecycleMatrix?.intents, id: 'id' },
  { name: 'matrixBindings', select: ({ lifecycleMatrix }) => lifecycleMatrix?.bindings, id: 'id' },
  { name: 'tools', select: ({ tools }) => tools, id: 'id' },
  { name: 'bindings', select: ({ nodeCapabilities }) => nodeCapabilities, id: 'nodeId' },
  { name: 'handlers', select: ({ nodeMetadata }) => nodeMetadata, id: 'nodeId' },
  {
    name: 'conditions',
    select: ({ routeConditions }) =>
      routeConditions?.map((item) => ({
        ...item,
        key: JSON.stringify([item.sourceNodeId, item.order]),
      })),
    id: 'key',
  },
];

function staticSnapshot(input) {
  const snapshot = project(
    input && Object.hasOwn(input, 'graph') ? { ...input, chain: undefined } : input,
  );
  validate(snapshot);
  return snapshot;
}

/** Ignore JSON object key order while keeping route priority and array content significant. */
function canonical(value) {
  return JSON.stringify(value, (_, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((key) => [key, item[key]]),
        )
      : item,
  );
}

function compareSection({ select, id, skip = [] }, before, after) {
  const oldItems = select(before),
    newItems = select(after);
  if (oldItems === undefined || newItems === undefined)
    return {
      compared: false,
      beforeSupplied: oldItems !== undefined,
      afterSupplied: newItems !== undefined,
    };
  const previous = new Map(oldItems.map((item) => [item[id], item]));
  const current = new Map(newItems.map((item) => [item[id], item]));
  const added = [...current.keys()].filter((key) => !previous.has(key)).sort();
  const removed = [...previous.keys()].filter((key) => !current.has(key)).sort();
  const modified = [];
  for (const key of [...current.keys()].sort()) {
    const oldItem = previous.get(key),
      newItem = current.get(key);
    if (!oldItem) continue;
    const fields = [...new Set([...Object.keys(oldItem), ...Object.keys(newItem)])]
      .sort()
      .filter(
        (field) =>
          field !== id &&
          !skip.includes(field) &&
          canonical(oldItem[field]) !== canonical(newItem[field]),
      );
    if (fields.length) modified.push({ id: key, fields });
  }
  return { compared: true, added, removed, modified };
}

function changedIds(section) {
  return new Set(
    section.compared
      ? [...section.added, ...section.removed, ...section.modified.map(({ id }) => id)]
      : [],
  );
}

/** Report declaration changes and direct references, without predicting which routes will execute. */
export function compareWorkflows(baseline, candidate) {
  const before = staticSnapshot(baseline),
    after = staticSnapshot(candidate);
  if (before.graph.workflowId !== after.graph.workflowId)
    throw new TypeError('Snapshots must describe the same workflow');
  const changes = Object.fromEntries(
    sections.map((section) => [section.name, compareSection(section, before, after)]),
  );
  const entry =
    before.graph.entryNodeId !== after.graph.entryNodeId
      ? { before: before.graph.entryNodeId, after: after.graph.entryNodeId }
      : undefined;
  const direct = new Set([
    ...changedIds(changes.nodes),
    ...changedIds(changes.bindings),
    ...changedIds(changes.handlers),
    ...(entry ? [entry.before, entry.after] : []),
  ]);
  const changedEdges = changedIds(changes.edges);
  const changedTools = changedIds(changes.tools);
  const changedMatrixBindings = changedIds(changes.matrixBindings);
  const changedMatrixIntents = changedIds(changes.matrixIntents);
  const changedConditions = changedIds(changes.conditions);
  for (const snapshot of [before, after]) {
    for (const edge of snapshot.graph.edges) {
      if (!changedEdges.has(edge.id)) continue;
      direct.add(edge.sourceNodeId);
      if (edge.targetNodeId !== undefined) direct.add(edge.targetNodeId);
    }
    for (const item of snapshot.nodeCapabilities ?? []) {
      if (
        item.tools?.some(({ toolId }) => changedTools.has(toolId)) ||
        item.adapters?.some(({ toolIds }) => toolIds?.some((id) => changedTools.has(id)))
      )
        direct.add(item.nodeId);
    }
    for (const binding of snapshot.lifecycleMatrix?.bindings ?? []) {
      if (
        changedMatrixBindings.has(binding.id) ||
        changedTools.has(binding.toolId) ||
        binding.intentIds.some((id) => changedMatrixIntents.has(id))
      )
        direct.add(binding.nodeId);
    }
    for (const item of snapshot.routeConditions ?? []) {
      if (changedConditions.has(JSON.stringify([item.sourceNodeId, item.order])))
        direct.add(item.sourceNodeId);
    }
  }
  return {
    workflowId: before.graph.workflowId,
    evidence: { level: 'static-only', unverified: [...unverified] },
    entry,
    changes,
    directlyAffectedNodes: [...direct].sort(),
    hasChanges:
      Boolean(entry) || Object.values(changes).some((section) => changedIds(section).size > 0),
  };
}

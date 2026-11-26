/**
 * Project public graph, App declarations and authorized run metadata into report data.
 * The field lists below define the report boundary. Reference checks consume that projection.
 */
const text = (value) => typeof value === 'string';
const id = (value) => text(value) && value.trim().length > 0;
const boolean = (value) => typeof value === 'boolean';
const integer = (value) => Number.isSafeInteger(value) && value >= 0;
const number = (value) => Number.isFinite(value) && value >= 0;
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const oneOf =
  (...values) =>
  (value) =>
    values.includes(value);
const list = (parse) => (value, path) => {
  if (!Array.isArray(value)) throw new TypeError(`${path} must be an array`);
  return Array.from({ length: value.length }, (_, index) =>
    parse(read(value, index, path), `${path}[${index}]`),
  );
};
const read = (value, key, path) => {
  const field = Object.getOwnPropertyDescriptor(value, key);
  if (field && !Object.hasOwn(field, 'value'))
    throw new TypeError(`${path}.${key} must be a data property`);
  return field?.value;
};
const field = (accept) => (value, path) => {
  if (!accept(value)) throw new TypeError(`Invalid ${path}`);
  return value;
};
const requiredId = field(id);
const label = field(text);
const order = field(integer);
const flag = field(boolean);
const elapsed = field(number);
const ids = list(requiredId);

/** Keep declared JSON Schema intact. Read data properties only and never evaluate or resolve it. */
function schemaData(value, path, depth = 0) {
  if (depth > 64) throw new TypeError(`${path} is too deeply nested`);
  if (value === null || text(value) || boolean(value) || Number.isFinite(value)) return value;
  if (Array.isArray(value))
    return list((item, location) => schemaData(item, location, depth + 1))(value, path);
  if (!record(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
    throw new TypeError(`${path} must contain JSON data`);
  return Object.fromEntries(
    Object.keys(value).map((key) => [
      key,
      schemaData(read(value, key, path), `${path}.${key}`, depth + 1),
    ]),
  );
}

const schema = (value, path) => {
  field((item) => record(item) || boolean(item))(value, path);
  return schemaData(value, path);
};

const shape =
  (required, optional = {}) =>
  (value, path) => {
    field(record)(value, path);
    const pairs = Object.entries(required).map(([key, parse]) => [
      key,
      parse(read(value, key, path), `${path}.${key}`),
    ]);
    for (const [key, parse] of Object.entries(optional)) {
      const item = read(value, key, path);
      if (item !== undefined) pairs.push([key, parse(item, `${path}.${key}`)]);
    }
    return Object.fromEntries(pairs);
  };

const route = shape(
  { order, conditional: flag, edgeId: requiredId },
  {
    routeId: label,
    conditionId: label,
    description: label,
  },
);
const graph = shape(
  {
    schemaVersion: field(oneOf(1)),
    workflowId: requiredId,
    entryNodeId: requiredId,
    nodes: list(
      shape({
        id: requiredId,
        name: label,
        description: label,
        order,
        startsRound: flag,
        requires: ids,
        provides: ids,
        routes: list(route),
        incomingEdgeIds: ids,
        outgoingEdgeIds: ids,
      }),
    ),
    edges: list(
      shape(
        {
          id: requiredId,
          kind: field(oneOf('transition', 'error', 'complete')),
          sourceNodeId: requiredId,
          routeOrders: list(order),
        },
        { targetNodeId: requiredId, errorRouteId: label },
      ),
    ),
  },
  { revision: label },
);

const tool = shape(
  { id: requiredId },
  {
    registered: flag,
    description: label,
    kind: label,
    source: label,
    parameters: schema,
  },
);
const nodeCapability = shape(
  { nodeId: requiredId },
  {
    kind: label,
    role: label,
    tools: list(shape({ toolId: requiredId }, { access: label })),
    adapters: list(
      shape({ id: requiredId }, { description: label, toolIds: ids, parameters: schema }),
    ),
  },
);
const nodeMetadata = shape(
  { nodeId: requiredId },
  {
    handler: label,
    source: label,
    input: schema,
    output: schema,
    completion: label,
  },
);
const routeCondition = shape(
  { sourceNodeId: requiredId, order },
  {
    conditionSource: label,
    source: label,
  },
);
const status = field(oneOf('unknown', 'running', 'success', 'error', 'cancelled'));
const visitEvent = shape(
  {
    eventId: requiredId,
    producerSequence: order,
    occurredAtMs: elapsed,
    type: field(oneOf('enter', 'transition', 'complete', 'error', 'progress')),
  },
  { phase: label, routeId: label, conditionId: label, errorCode: label, errorEventId: label },
);
const subflowRecord = shape(
  { stepId: requiredId, sequence: order },
  {
    origin: field(oneOf('reported')),
    operation: field(oneOf('write', 'fix')),
    targetStepId: requiredId,
    revision: order,
    createdAtMs: elapsed,
    startedAtMs: elapsed,
    endedAtMs: elapsed,
    name: label,
    kind: label,
    type: label,
    subnodeId: label,
    status: label,
    usedModel: flag,
    parentStepId: requiredId,
    nextStepIds: ids,
    relatedDefinitionId: label,
    relatedInvocationId: label,
    sourceEventId: label,
    producerSequence: order,
  },
);
const chain = shape({
  schemaVersion: field(oneOf(1)),
  workflowId: requiredId,
  runId: requiredId,
  coverage: shape({
    complete: field(oneOf(true, false, 'unknown')),
    content: field(oneOf('included', 'omitted', 'mixed', 'unknown')),
    issues: list(shape({ code: requiredId }, { spanId: label, eventId: label, count: order })),
  }),
  nodes: list(
    shape(
      {
        spanId: requiredId,
        nodeId: requiredId,
        status,
        firstEventSequence: order,
        lastEventSequence: order,
        events: list(visitEvent),
        subflow: list(subflowRecord),
      },
      {
        workflowInvocationId: label,
        definitionRevision: label,
        name: label,
        description: label,
        kind: label,
        roundIndex: order,
        usedModel: flag,
        enteredAtMs: elapsed,
        endedAtMs: elapsed,
        durationMs: elapsed,
      },
    ),
  ),
  transitions: list(
    shape(
      {
        eventId: requiredId,
        producerSequence: order,
        occurredAtMs: elapsed,
        sourceSpanId: requiredId,
        type: field(oneOf('transition', 'complete')),
      },
      {
        targetSpanId: requiredId,
        targetNodeId: requiredId,
        routeOrder: order,
        routeId: label,
        conditionId: label,
        errorEventId: label,
      },
    ),
  ),
});

const lifecycleMatrix = shape({
  intents: list(shape({ id: requiredId, toolIds: ids }, { description: label })),
  bindings: list(
    shape({
      id: requiredId,
      nodeId: requiredId,
      toolId: requiredId,
      hook: requiredId,
      handler: requiredId,
      mode: field(oneOf('selected', 'all')),
      intentIds: ids,
    }),
  ),
});

const projection = shape(
  { graph },
  {
    generatedAt: label,
    configurationHash: label,
    sources: ids,
    tools: list(tool),
    nodeCapabilities: list(nodeCapability),
    nodeMetadata: list(nodeMetadata),
    routeConditions: list(routeCondition),
    lifecycleMatrix,
    chain,
  },
);

/** Importing a trusted declaration uses only public toGraph() and, when supplied, catalog.values(). */
export function fromDefinition(definition) {
  const {
    workflow,
    toolCatalog,
    tools,
    nodeCapabilities,
    nodeMetadata,
    routeConditions,
    lifecycleMatrix,
  } = definition;
  if (typeof workflow?.toGraph !== 'function')
    throw new TypeError('Export workflow or inspection.workflow with the public toGraph() method');
  if (toolCatalog !== undefined && tools !== undefined)
    throw new TypeError('Use toolCatalog or tools for one tool inventory');

  const inventory =
    toolCatalog === undefined
      ? tools
      : Array.from(toolCatalog.values(), (entry) => ({
          id: entry.id,
          description: entry.description,
          kind: entry.kind,
          parameters: entry.inputSchema?.jsonSchema,
          registered: true,
        }));
  return project({
    graph: workflow.toGraph(),
    tools: inventory,
    nodeCapabilities,
    nodeMetadata,
    routeConditions,
    lifecycleMatrix,
  });
}

/** Accept a bare WorkflowGraph or a documented inspection snapshot. */
export function project(value) {
  return projection(
    record(value) && Object.hasOwn(value, 'graph') ? value : { graph: value },
    'snapshot',
  );
}

function index(items, key, location) {
  const result = new Map(items.map((item) => [item[key], item]));
  if (result.size !== items.length) throw new TypeError(`Duplicate ${location}`);
  return result;
}

function sameItems(actual, expected) {
  const members = new Set(actual);
  return (
    actual.length === expected.length &&
    members.size === expected.length &&
    expected.every((value) => members.has(value))
  );
}

/** Validate static references against the actual graph and inventory, preserving observational gaps. */
export function validate(snapshot, selectedRunId) {
  const {
    graph,
    tools,
    nodeCapabilities = [],
    nodeMetadata = [],
    routeConditions = [],
    chain,
  } = snapshot;
  const nodes = index(graph.nodes, 'id', 'node ID');
  const edges = index(graph.edges, 'id', 'edge ID');
  const catalog = tools && index(tools, 'id', 'tool ID');
  const topology = new Map(graph.nodes.map(({ id }) => [id, { incoming: [], outgoing: [] }]));
  if (!nodes.has(graph.entryNodeId)) throw new TypeError('The graph entry node is missing');

  const edgeOrders = new Map();
  for (const edge of edges.values()) {
    if (
      !nodes.has(edge.sourceNodeId) ||
      (edge.kind === 'complete' ? edge.targetNodeId !== undefined : !nodes.has(edge.targetNodeId))
    )
      throw new TypeError(`Invalid endpoints for edge ${edge.id}`);
    topology.get(edge.sourceNodeId).outgoing.push(edge.id);
    if (edge.targetNodeId !== undefined) topology.get(edge.targetNodeId).incoming.push(edge.id);
    edgeOrders.set(edge.id, []);
  }
  for (const [ordinal, node] of graph.nodes.entries()) {
    if (ordinal !== node.order) throw new TypeError(`Invalid node order for ${node.id}`);
    const { incoming, outgoing } = topology.get(node.id);
    if (!sameItems(node.incomingEdgeIds, incoming) || !sameItems(node.outgoingEdgeIds, outgoing))
      throw new TypeError(`Incident edges do not match node ${node.id}`);
    for (const [position, route] of node.routes.entries()) {
      const edge = edges.get(route.edgeId);
      if (route.order !== position || edge?.sourceNodeId !== node.id || edge.kind === 'error')
        throw new TypeError(`Invalid route reference for ${node.id} at ${position}`);
      edgeOrders.get(edge.id).push(position);
    }
  }
  for (const edge of edges.values()) {
    const orders = edgeOrders.get(edge.id);
    if (
      (edge.kind !== 'error' && !orders.length) ||
      edge.routeOrders.length !== orders.length ||
      edge.routeOrders.some((value, position) => value !== orders[position])
    )
      throw new TypeError(`Route priorities do not match edge ${edge.id}`);
  }
  const warnings = new Set();
  function assertTool(toolId, owner) {
    const item = catalog?.get(toolId);
    if (catalog && !item) throw new TypeError(`Unknown tool ${toolId} in ${owner}`);
    if (item?.registered !== true)
      warnings.add(
        `${toolId} in ${owner}: ${item?.registered === false ? 'declared, unregistered' : 'registration unknown'}`,
      );
  }

  for (const entries of [nodeCapabilities, nodeMetadata]) {
    for (const nodeId of index(entries, 'nodeId', 'node metadata').keys()) {
      if (!nodes.has(nodeId)) throw new TypeError(`Metadata refers to unknown node ${nodeId}`);
    }
  }
  for (const capability of nodeCapabilities) {
    const bindings = capability.tools ?? [];
    for (const toolId of index(bindings, 'toolId', 'node tool binding').keys())
      assertTool(toolId, capability.nodeId);
    for (const adapter of index(capability.adapters ?? [], 'id', 'node adapter').values()) {
      if (!adapter.toolIds) continue;
      if (new Set(adapter.toolIds).size !== adapter.toolIds.length)
        throw new TypeError(`Duplicate tool in adapter ${adapter.id}`);
      for (const toolId of adapter.toolIds)
        assertTool(toolId, `${capability.nodeId}/${adapter.id}`);
    }
  }
  if (snapshot.lifecycleMatrix) {
    const matrix = snapshot.lifecycleMatrix;
    const intents = index(matrix.intents, 'id', 'matrix intent');
    for (const intent of intents.values()) {
      if (new Set(intent.toolIds).size !== intent.toolIds.length)
        throw new TypeError(`Duplicate tool in matrix intent ${intent.id}`);
      for (const toolId of intent.toolIds) assertTool(toolId, `intent ${intent.id}`);
    }
    for (const binding of index(matrix.bindings, 'id', 'matrix binding').values()) {
      if (!nodes.has(binding.nodeId)) throw new TypeError(`Unknown matrix node ${binding.nodeId}`);
      assertTool(binding.toolId, binding.id);
      if (!binding.intentIds.length || new Set(binding.intentIds).size !== binding.intentIds.length)
        throw new TypeError(`Invalid matrix intent scope in ${binding.id}`);
      for (const intentId of binding.intentIds) {
        const intent = intents.get(intentId);
        if (!intent?.toolIds.includes(binding.toolId))
          throw new TypeError(`Invalid matrix pairing ${intentId}/${binding.toolId}`);
      }
    }
  }
  const conditions = new Set();
  for (const condition of routeConditions) {
    const key = JSON.stringify([condition.sourceNodeId, condition.order]);
    if (
      conditions.has(key) ||
      !nodes.get(condition.sourceNodeId)?.routes[condition.order]?.conditional
    )
      throw new TypeError(`Invalid condition reference ${key}`);
    conditions.add(key);
  }
  if (chain) {
    if (!selectedRunId || selectedRunId !== chain.runId)
      throw new TypeError('Select the exact run with --run-id');
    if (chain.workflowId !== graph.workflowId)
      throw new TypeError('Run and graph belong to different workflows');
    index(chain.nodes, 'spanId', 'run span');
  } else if (selectedRunId) {
    throw new TypeError('--run-id requires a chain in the input or --chain file');
  }
  return [...warnings];
}

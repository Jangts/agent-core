/** Describe inspection evidence without treating optional App metadata as a quality requirement. */
export const unverified = [
  'architecture suitability and business completion',
  'dynamic authorization and side-effect outcomes',
  'request recovery and persistence outside the workflow',
  'real-model semantic quality and production behavior',
];

/** Count unknown declarations separately from structural errors and recorded source coverage. */
export function describeEvidence(snapshot) {
  const declarations = Object.fromEntries(
    ['tools', 'nodeCapabilities', 'nodeMetadata', 'routeConditions', 'lifecycleMatrix'].map(
      (key) => [key, snapshot[key] === undefined ? 'not-supplied' : 'supplied'],
    ),
  );
  const metadata = new Map((snapshot.nodeMetadata ?? []).map((item) => [item.nodeId, item]));
  const capabilities = new Map(
    (snapshot.nodeCapabilities ?? []).map((item) => [item.nodeId, item]),
  );
  const unknown = {
    nodeHandlers: snapshot.graph.nodes.filter(({ id }) => metadata.get(id)?.handler === undefined)
      .length,
    nodeCompletion: snapshot.graph.nodes.filter(
      ({ id }) => metadata.get(id)?.completion === undefined,
    ).length,
    nodeToolBindings: snapshot.graph.nodes.filter(
      ({ id }) => capabilities.get(id)?.tools === undefined,
    ).length,
    toolRegistration: (snapshot.tools ?? []).filter(({ registered }) => registered === undefined)
      .length,
  };
  return {
    level: snapshot.chain ? 'static-and-recorded-run' : 'static-only',
    declarations,
    projection:
      'Only documented fields are inspected; unknown fields and event payloads are omitted.',
    unknown,
    run: snapshot.chain
      ? { runId: snapshot.chain.runId, coverage: snapshot.chain.coverage }
      : { status: 'not-supplied' },
    matrix: snapshot.lifecycleMatrix
      ? {
          bindings: snapshot.lifecycleMatrix.bindings.length,
          observation:
            'Declared candidates only; relatedDefinitionId links reported subflow records, not proof of authorization or completion.',
        }
      : { status: 'not-supplied' },
    unverified: [...unverified],
  };
}

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describeEvidence } from '../development/scripts/workflow-inspector/evidence.mjs';
import { project, validate } from '../development/scripts/workflow-inspector/snapshot.mjs';
import { compareWorkflows } from '../development/scripts/workflow-diff/diff.mjs';

const graph = {
  schemaVersion: 1, workflowId: 'minimal', entryNodeId: 'answer',
  nodes: [{ id: 'answer', name: 'answer', description: '', order: 0, startsRound: false,
    requires: [], provides: [], routes: [], incomingEdgeIds: [], outgoingEdgeIds: [] }], edges: [],
};

test('valid legacy declarations remain valid while missing metadata stays unknown', () => {
  const snapshot = project(graph);
  assert.deepEqual(validate(snapshot), []);
  const evidence = describeEvidence(snapshot);
  assert.equal(evidence.level, 'static-only');
  assert.equal(evidence.declarations.tools, 'not-supplied');
  assert.equal(evidence.unknown.nodeToolBindings, 1);
  assert.equal(evidence.unknown.nodeCompletion, 1);
  snapshot.nodeCapabilities = [{ nodeId: 'answer', tools: [] }];
  assert.equal(describeEvidence(snapshot).unknown.nodeToolBindings, 0);
  assert.equal(describeEvidence(snapshot).run.status, 'not-supplied');
  assert.ok(evidence.unverified.includes('request recovery and persistence outside the workflow'));
});

test('unknown extensions are not exported or mistaken for verified behavior', () => {
  const input = { graph, businessSuccess: true };
  assert.equal(project(input).businessSuccess, undefined);
  const diff = compareWorkflows(input, input);
  assert.equal(diff.hasChanges, false);
  assert.equal(diff.changes.handlers.compared, false);
  assert.equal(diff.evidence.level, 'static-only');
  const invalid = structuredClone(input);
  invalid.graph.entryNodeId = 'absent';
  assert.throws(() => compareWorkflows(input, invalid), /entry node is missing/);
});

test('record coverage stays unknown without claiming request completion', () => {
  const snapshot = project({ graph, chain: {
    schemaVersion: 1, workflowId: 'minimal', runId: 'run', nodes: [], transitions: [],
    coverage: { complete: 'unknown', content: 'omitted', issues: [{ code: 'read-limit' }] },
  } });
  assert.deepEqual(validate(snapshot, 'run'), []);
  const evidence = describeEvidence(snapshot);
  assert.equal(evidence.level, 'static-and-recorded-run');
  assert.equal(evidence.run.coverage.complete, 'unknown');
  assert.deepEqual(evidence.run.coverage.issues, [{ code: 'read-limit' }]);
  assert.throws(() => validate(snapshot, 'another'), /exact run/);
});

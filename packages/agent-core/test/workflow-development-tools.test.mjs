import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { AgentCoreEngine, defineWorkflow } from '@jangts/agent-core';
import { inspection } from '../development/examples/workflow-inspection.mjs';
import { scenarios } from '../development/examples/workflow-scenarios.mjs';
import { fromDefinition } from '../development/scripts/workflow-inspector/snapshot.mjs';
import { compareWorkflows } from '../development/scripts/workflow-diff/diff.mjs';
import { runScenario } from '../development/scripts/workflow-scenarios/scenario.mjs';

test('diff ignores provenance and JSON object key order and reports incomplete inventories', () => {
  const before = fromDefinition(inspection);
  const after = structuredClone(before);
  const parameters = after.tools[0].parameters;
  after.tools[0].parameters = Object.fromEntries(Object.entries(parameters).reverse());
  after.graph.revision = 'another revision';
  after.configurationHash = 'different hash';
  assert.equal(compareWorkflows(before, after).hasChanges, false);

  const unknown = compareWorkflows(before, after.graph);
  assert.deepEqual(unknown.changes.tools, { compared: false, beforeSupplied: true, afterSupplied: false });
  assert.deepEqual(unknown.directlyAffectedNodes, []);
});

test('diff detects route priority and traces adapter-only schema changes to the owning node', () => {
  const before = fromDefinition(inspection);
  before.tools.push({ id: 'adapter-only', parameters: { type: 'object', additionalProperties: true } });
  before.nodeCapabilities[1].adapters[0].toolIds.push('adapter-only');
  const after = structuredClone(before);
  after.tools.at(-1).parameters.additionalProperties = false;
  const [first, second] = after.graph.nodes[0].routes;
  after.graph.nodes[0].routes = [{ ...second, order: 0 }, { ...first, order: 1 }];
  after.routeConditions.find(({ sourceNodeId }) => sourceNodeId === 'receive').order = 1;
  const diff = compareWorkflows(before, after);
  assert.deepEqual(diff.changes.nodes.modified, [{ id: 'receive', fields: ['routes'] }]);
  assert.deepEqual(diff.changes.tools.modified, [{ id: 'adapter-only', fields: ['parameters'] }]);
  assert.deepEqual(diff.directlyAffectedNodes, ['receive', 'review']);
  assert.deepEqual(diff.changes.edges.modified, []);
  assert.deepEqual(diff.changes.conditions.added, ['["receive",1]']);
  const schemaOnly = structuredClone(before);
  schemaOnly.tools.at(-1).parameters.additionalProperties = false;
  assert.deepEqual(compareWorkflows(before, schemaOnly).directlyAffectedNodes, ['review']);
});

test('scenario CLI runs the real Engine and emits the observed authorization recovery', () => {
  const cli = fileURLToPath(new URL('../development/scripts/workflow-scenarios/cli.mjs', import.meta.url));
  const fixture = fileURLToPath(new URL('../development/examples/workflow-scenarios.mjs', import.meta.url));
  const output = execFileSync(process.execPath, [cli, '--fixture', fixture, '--json'], { encoding: 'utf8' });
  const reports = JSON.parse(output);
  assert.deepEqual(reports.map(({ id, passed, modelCalls }) => [id, passed, modelCalls]), [
    ['authorized', true, 1], ['denied', true, 0],
  ]);
  assert.ok(reports[1].events.some(({ type, targetNodeId }) => type === 'error' && targetNodeId === 'denied'));
  assert.ok(!output.includes('The service is ready.'));
});

test('scenario fails on unused replies and unexpected model calls', async () => {
  await assert.rejects(runScenario({ ...scenarios[1], replies: ['unused'] }), /Expected 1 scripted model calls but observed 0/);
  await assert.rejects(runScenario({ ...scenarios[0], replies: [] }), /Expected 0 scripted model calls but observed 1/);
});

test('scenario checks expected Engine rejection and aborts the real execution on deadline', async () => {
  const errorWorkflow = defineWorkflow({
    id: 'reject', nodes: [{
      id: 'entry', description: 'Reject', run() { throw new Error('fixture rejection'); },
      routes: [{ complete: () => true }],
    }],
  });
  await runScenario({
    id: 'reject',
    setup: ({ execution }) => ({ agent: new AgentCoreEngine({ workflow: errorWorkflow, execution }), state: {} }),
    verifyError: ({ error, events }) => {
      assert.match(error.message, /fixture rejection/);
      assert.ok(events.some(({ type, phase }) => type === 'error' && phase === 'run'));
    },
  });

  let aborted;
  const idle = defineWorkflow({
    id: 'idle', nodes: [{
      id: 'entry', description: 'Wait for fixture cancellation',
      run(_state, { signal }) {
        return new Promise((resolve) => signal.addEventListener('abort', () => {
          aborted = true;
          resolve();
        }, { once: true }));
      },
      routes: [{ complete: () => true }],
    }],
  });
  await assert.rejects(runScenario({
    id: 'deadline', timeoutMs: 80,
    setup: ({ execution }) => ({ agent: new AgentCoreEngine({ workflow: idle, execution }), state: {} }),
    verify() { assert.fail('a timed out workflow cannot succeed'); },
  }), /Scenario timed out: deadline/);
  assert.equal(aborted, true);
});

test('a cancelled caller stops a scenario before the App fixture is set up', async () => {
  const cancelled = new Error('test cancelled');
  const signal = AbortSignal.abort(cancelled);
  await assert.rejects(
    runScenario({
      id: 'cancelled-caller',
      setup() { assert.fail('a cancelled test must not initialize App dependencies'); },
      verify() { assert.fail('a cancelled test must not verify a result'); },
    }, { signal }),
    (error) => error === cancelled,
  );
});

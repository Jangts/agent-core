import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentCoreEngine, defineWorkflow } from '../dist/esm/index.js';
import * as reporting from '../dist/esm/diagnostics/index.js';
import * as versions from '../dist/esm/kits/family.js';

const definition = extra => ({ id: 'naming', nodes: [{ id: 'done', description: 'Done', routes: [{ complete: () => 'ok' }] }], ...extra });

test('canonical and legacy recording/version names share runtime identity', () => {
  assert.equal(reporting.ReportedStepRecorder, reporting.SubFlowLogger);
  assert.equal(reporting.ScopedReportedStepRecorder, reporting.ScopedSubFlowLogger);
  assert.equal(versions.defineBranchVersioning, versions.defineAgentFamily);
  assert.equal(versions.BranchVersions, versions.Family);
  assert.equal(versions.BranchVersions.defineBranchVersioning, versions.Family.defineAgentFamily);
});

test('snapshot methods preserve old record shape and cloned data across both entry families', () => {
  const engine = new AgentCoreEngine({ workflow: defineWorkflow(definition()) });
  const value = { nested: { n: 1 } };
  const snapshot = engine.snapshot(value);
  value.nested.n = 9;
  assert.equal(snapshot.read().nested.n, 1);
  const exported = engine.exportCheckpoint(snapshot);
  assert.deepEqual(Object.keys(exported).sort(), ['data', 'id', 'source']);
  assert.equal(engine.restoreSnapshot(exported).id, snapshot.id);
  assert.deepEqual(engine.exportSnapshot(engine.restoreCheckpoint(exported)), exported);
  const child = engine.fork({ at: snapshot });
  assert.equal(child.branch.forkPointId, snapshot.id);
});

test('trace source alias preserves receiver and rejects competing configuration', async () => {
  const events = ['enter', 'complete'].map((type, index) => ({
    version: 2,
    eventId: `naming-${index}`,
    producerSequence: index + 1,
    occurredAtMs: index + 1,
    type: 'workflow.event',
    runId: 'r',
    spanId: 'visit-done',
    nodeId: 'done',
    nodeRole: 'workflow-node',
    definitionId: 'naming',
    workflowInvocationId: 'invocation-naming',
    payload: { event: {
      eventId: `naming-${index}`,
      workflowId: 'naming',
      workflowInvocationId: 'invocation-naming',
      nodeId: 'done',
      roundIndex: 0,
      type,
    } },
  }));
  const source = async () => ({ events, coverage: { complete: true, content: 'included', issues: [] } });
  assert.throws(() => defineWorkflow(definition({ traceSource: source, chainSource: source })), /not both/);
  const config = definition({ marker: 42, async traceSource() { assert.equal(this.marker, 42); return source(); } });
  const workflow = defineWorkflow(config);
  assert.deepEqual(await workflow.toTrace('r'), await workflow.toChain('r'));
  const legacy = defineWorkflow(definition({ chainSource: source }));
  assert.deepEqual(await legacy.toTrace('r'), await workflow.toTrace('r'));
});

test('step runtime exposes canonical and legacy factories over one recorder', async () => {
  const engine = new AgentCoreEngine();
  await engine.run((_round, context) => {
    const recorder = context.createStepRecorder();
    assert.equal(recorder, context.createSubFlowLogger());
    return { type: 'complete', value: 'ok' };
  });
});

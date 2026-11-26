import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCollaborationProbe } from '../development/examples/collaboration-probe.mjs';

test('collaboration preserves parent limits across waiting and reconciles a lost action response', async () => {
  assert.deepEqual(await runCollaborationProbe(), {
    processes: 5, consumed: 3, limit: 3, writes: 1, attempts: 1,
    queryUnchanged: true, originalDeadlinePreserved: true,
  });
});

test('ordinary and recommended decision association preserve the same response-loss semantics', async () => {
  const { runDecisionAdapterComparison } = await import('../development/examples/collaboration-probe.mjs');
  const { ordinary, recommended } = await runDecisionAdapterComparison();
  assert.deepEqual(recommended, ordinary);
  assert.equal(ordinary.writes, 1);
});

// Locks durable, family and artifact failure branches: malformed definitions, invalid checkpoints,
// merge conflicts and missing resolvers must all fail before any side effect.
// Covers `defineDurableTask`, `defineAgentFamily`, `defineArtifactCatalog` and `ModelCalls`;
// `node --test` against dist/esm.
import test from 'node:test';
import assert from 'node:assert/strict';
import { defineDurableTask } from '../dist/esm/kits/durable.js';
import { defineAgentFamily } from '../dist/esm/kits/family.js';
import { defineArtifactCatalog } from '../dist/esm/kits/artifacts.js';
import { ModelCalls } from '../dist/esm/kits/inference.js';
const context = () => ({ app: {}, signal: new AbortController().signal });
// Valid checkpoint baseline; each test patches one field to break exactly one rule.
const initial = () => ({
  version: 2,
  definitionId: 'task',
  revision: '1',
  nextStepIndex: 0,
  attemptCount: 0,
  maxAttempts: 2,
  deadlineAtMs: Date.now() + 10000,
  status: 'ready',
  state: {},
});
const definition = () => ({
  id: 'task',
  revision: '1',
  isState: (value) => typeof value === 'object',
  steps: [{ id: 'step', replayPolicy: 'safe', run: (value) => value }],
});
const store = (record) => ({
  load: async () => record,
  save: async () => {},
  exclusive: async (_id, run) => run(),
});
test('durable definitions and stores reject malformed executable or storage contracts before loading', async () => {
  assert.throws(() => defineDurableTask(null));
  // Null step, duplicate ids and an unknown replay policy are all rejected.
  for (const steps of [
    [null],
    [
      { id: 'step', replayPolicy: 'safe', run() {} },
      { id: 'step', replayPolicy: 'safe', run() {} },
    ],
    [{ id: 'step', replayPolicy: 'unknown', run() {} }],
  ])
    assert.throws(() => defineDurableTask({ ...definition(), steps }));
  const task = defineDurableTask(definition());
  await assert.rejects(
    task.run({ taskId: 'task', store: store(initial()) }, {}),
    /OperationContext/,
  );
  // A backing store missing `exclusive` or `save` is incomplete.
  for (const backing of [undefined, {}, { exclusive() {}, load() {} }])
    await assert.rejects(task.run({ taskId: 'task', store: backing }, context()), /store/);
  await assert.rejects(
    task.run({ taskId: 'task', store: store(undefined) }, context()),
    /checkpoint/,
  );
});
test('durable checkpoints enforce every persisted counter and model allowance before effects', async () => {
  const task = defineDurableTask(definition());
  // Each patch breaks exactly one persisted invariant; modelBudget variants follow in the spread.
  for (const patch of [
    { version: 1 },
    { definitionId: 'other' },
    { nextStepIndex: -1 },
    { nextStepIndex: 2 },
    { attemptCount: -1 },
    { maxAttempts: 0 },
    { attemptCount: 3 },
    { nextStepIndex: 1, attemptCount: 0 },
    { deadlineAtMs: NaN },
    { status: 'unknown' },
    { status: 'completed' },
    { state: 7 },
    ...[
      null,
      [],
      true,
      { maxCalls: 0, reservedCalls: 0, maxCallsPerAttempt: 1 },
      { maxCalls: 2, reservedCalls: -1, maxCallsPerAttempt: 1 },
      { maxCalls: 2, reservedCalls: 3, maxCallsPerAttempt: 1 },
      { maxCalls: 2, reservedCalls: 0, maxCallsPerAttempt: 0 },
      { maxCalls: 2, reservedCalls: 0, maxCallsPerAttempt: 3 },
    ].map((modelBudget) => ({ modelBudget })),
  ])
    await assert.rejects(
      task.run({ taskId: 'task', store: store({ ...initial(), ...patch }) }, context()),
    );
  await assert.rejects(
    task.run(
      {
        taskId: 'task',
        store: store({
          ...initial(),
          modelBudget: { maxCalls: 1, reservedCalls: 1, maxCallsPerAttempt: 1 },
        }),
      },
      context(),
    ),
    /model budget exhausted/,
  );
  const invalid = defineDurableTask({
    ...definition(),
    steps: [{ id: 'step', replayPolicy: 'safe', run: () => 7 }],
  });
  await assert.rejects(
    invalid.run({ taskId: 'task', store: store(initial()) }, context()),
    /step state/,
  );
});
test('family merge conflicts and mismatched bases never save or promote a candidate', async () => {
  let record;
  const family = defineAgentFamily({
    store: {
      load: async () => record,
      compareAndSwap: async (_id, _revision, value) => {
        record = value;
        return true;
      },
    },
    isState: () => true,
    authorize() {},
    validate() {},
    merge: () => ({ conflicts: ['field'] }),
  });
  const branch = { agentId: 'agent', branchId: 'base', agentVersionId: '0' };
  let current = await family.create({ id: 'family', branch, state: {} }, context());
  const base = current.activeId;
  const fork = async (parentId, parent, id) =>
    family.fork(
      {
        id: 'family',
        revision: record.revision,
        parentId,
        state: {},
        branch: {
          agentId: 'agent',
          branchId: id,
          agentVersionId: id,
          parentBranchId: parent.branchId,
          parentAgentVersionId: parent.agentVersionId,
        },
      },
      context(),
    );
  current = await fork(base, branch, 'one');
  const one = current.versions.at(-1);
  current = await fork(base, branch, 'two');
  const two = current.versions.at(-1);
  const conflict = await family.merge(
    { id: 'family', revision: current.revision, baseId: base, targetId: one.id, sourceId: two.id },
    context(),
  );
  assert.equal(conflict.saved, false);
  assert.deepEqual(conflict.conflicts, ['field']);
  // Two forks appended to root; the conflicted merge added no version.
  assert.equal(record.versions.length, 3);
  await assert.rejects(
    family.merge(
      { id: 'family', revision: record.revision, baseId: one.id, targetId: base, sourceId: two.id },
      context(),
    ),
    /shared base/,
  );
  current = await fork(one.id, one.branch, 'three');
  await assert.rejects(
    family.merge(
      {
        id: 'family',
        revision: current.revision,
        baseId: base,
        targetId: current.versions.at(-1).id,
        sourceId: two.id,
      },
      context(),
    ),
    /shared base/,
  );
});
test('artifact and model service declarations require an actual resolver and request context', async () => {
  for (const definition of [null, 7]) assert.throws(() => defineArtifactCatalog([definition]));
  const artifacts = defineArtifactCatalog([{ id: 'read', resolve: () => 7 }]);
  // A registered resolver still requires an OperationContext.
  await assert.rejects(artifacts.resolve(null, context()));
  const calls = new ModelCalls([{ id: 'read', identity: 'one', invoke: (value) => value }]);
  for (const binding of [
    { id: '', identity: 'one', invoke() {} },
    { id: 'read', identity: '', invoke() {} },
    { id: 'read', identity: 'one', invoke: 7 },
  ])
    assert.throws(() => new ModelCalls([binding]));
  await assert.rejects(calls.invoke(null, context()));
});

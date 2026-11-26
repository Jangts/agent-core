// Locks Kit persistence boundaries: requests are snapshotted before async authorization, callbacks
// cannot mutate stored records, provenance is checked before writing, and journal ids never collide.
// Covers `defineAgentFamily`, `defineKnowledgePublication`, `defineDurableTask` and
// `ContextJournal`; `node --test` with in-memory stores.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ContextJournal } from '../dist/esm/index.js';
import { defineAgentFamily } from '../dist/esm/kits/family.js';
import { defineDurableTask } from '../dist/esm/kits/durable.js';
import { defineKnowledgePublication } from '../dist/esm/kits/knowledge/index.js';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const operation = (signal) => ({ app: {}, signal: signal ?? new AbortController().signal });
const branch = (id) => ({ agentId: 'agent', branchId: id, agentVersionId: '1' });
// Root plus two forks, so merge and promote have real candidates to choose between.
const familyRecord = () => ({
  id: 'family',
  revision: 1,
  activeId: 'root',
  expiresAtMs: Date.now() + 60000,
  versions: [
    { id: 'root', branch: branch('main'), state: { goal: 'root' }, createdAtMs: 1 },
    ...['a', 'b'].map((id) => ({
      id,
      parentId: 'root',
      baseId: 'root',
      branch: { ...branch(id), parentBranchId: 'main', parentAgentVersionId: '1' },
      state: { goal: id },
      createdAtMs: 2,
    })),
  ],
});

test('family creation snapshots identity and state before its first asynchronous read', async () => {
  const gate = deferred();
  let saved;
  const family = defineAgentFamily({
    isState: () => true,
    authorize() {},
    validate() {},
    store: {
      load: () => gate.promise,
      async compareAndSwap(id, expected, record) {
        saved = { id, expected, record };
        return true;
      },
    },
  });
  const request = { id: 'original', branch: branch('main'), state: { goal: 'original' } };
  const pending = family.create(request, operation());
  // Mutating the request while load is pending must not alter the captured snapshot.
  request.id = 'changed';
  request.branch.branchId = 'changed';
  request.state.goal = 'changed';
  gate.resolve();
  await pending;
  assert.equal(saved.id, 'original');
  assert.equal(saved.record.versions[0].branch.branchId, 'main');
  assert.equal(saved.record.versions[0].state.goal, 'original');
});

for (const action of ['fork', 'merge', 'promote'])
  test(`family ${action} pins its request across asynchronous authorization`, async () => {
    const gate = deferred(),
      entered = deferred();
    let saved;
    const family = defineAgentFamily({
      isState: () => true,
      authorize() {
        entered.resolve();
        return gate.promise;
      },
      validate() {},
      merge: ({ source }) => ({ value: source, conflicts: [] }),
      store: {
        load: async () => familyRecord(),
        async compareAndSwap(_id, _revision, next) {
          saved = next;
          return true;
        },
      },
    });
    const request =
      action === 'fork'
        ? {
            id: 'family',
            revision: 1,
            parentId: 'root',
            branch: { ...branch('new'), parentBranchId: 'main', parentAgentVersionId: '1' },
            state: { goal: 'original' },
          }
        : action === 'merge'
          ? { id: 'family', revision: 1, baseId: 'root', targetId: 'root', sourceId: 'a' }
          : { id: 'family', revision: 1, expectedActiveId: 'root', candidateId: 'a' };
    const pending = family[action](request, operation());
    await entered.promise;
    if (action === 'fork') {
      request.branch.branchId = 'changed';
      request.state.goal = 'changed';
    } else if (action === 'merge') request.sourceId = 'b';
    else request.candidateId = 'b';
    gate.resolve();
    await pending;
    if (action === 'fork') {
      assert.equal(saved.versions.at(-1).branch.branchId, 'new');
      assert.equal(saved.versions.at(-1).state.goal, 'original');
    } else if (action === 'merge') assert.equal(saved.versions.at(-1).state.goal, 'a');
    else assert.equal(saved.activeId, 'a');
  });

test('family validation and authorization cannot mutate live store data or the pending commit', async () => {
  const record = familyRecord();
  let saved;
  const family = defineAgentFamily({
    isState(value) {
      value.checked = true;
      return true;
    },
    authorize(_operation, value) {
      value.versions[0].state.goal = 'authorizer mutation';
    },
    validate() {},
    store: {
      load: async () => record,
      async compareAndSwap(_id, _revision, next) {
        saved = next;
        return true;
      },
    },
  });
  await family.promote(
    { id: 'family', revision: 1, candidateId: 'a', expectedActiveId: 'root' },
    operation(),
  );
  // Callbacks receive copies, so neither the live record nor the pending commit is mutated.
  assert.equal(record.versions[0].state.checked, undefined);
  assert.equal(record.versions[0].state.goal, 'root');
  assert.equal(saved.versions[0].state.goal, 'root');
});

const document = (id) => ({ id, revision: '1', parts: ['body'] });
const publicationRecord = () => ({
  revision: 2,
  publishedRevision: 0,
  documents: [],
  candidates: ['a', 'b'].map((id) => ({
    id,
    baseRevision: 0,
    document: document(id),
    sources: [{ id: 'manual', revision: '1' }],
    createdAtMs: 1,
    expiresAtMs: Date.now() + 60000,
  })),
});
for (const action of ['propose', 'publish', 'reject'])
  // Each action must pin its request across a gated, asynchronous authorization.
  test(`publication ${action} pins provenance and selected candidate across authorization`, async () => {
    const gate = deferred(),
      entered = deferred();
    let saved, verified;
    const publication = defineKnowledgePublication({
      authorize() {
        entered.resolve();
        return gate.promise;
      },
      verifySources(sources) {
        verified = sources;
      },
      store: {
        load: async () => publicationRecord(),
        async compareAndSwap(_revision, next) {
          saved = next;
          return true;
        },
      },
    });
    const request =
      action === 'propose'
        ? { revision: 2, document: document('c'), sources: [{ id: 'original', revision: '1' }] }
        : { revision: 2, candidateId: 'a' };
    const pending = publication[action](request, operation());
    await entered.promise;
    if (action === 'propose') request.sources[0].id = 'changed';
    else request.candidateId = 'b';
    gate.resolve();
    await pending;
    if (action === 'propose') {
      assert.equal(verified[0].id, 'original');
      assert.equal(saved.candidates.at(-1).sources[0].id, 'original');
    } else if (action === 'publish')
      assert.deepEqual(
        saved.documents.map((item) => item.id),
        ['a'],
      );
    else
      assert.deepEqual(
        saved.candidates.map((item) => item.id),
        ['b'],
      );
  });

test('publication rejects missing provenance entries before verification or persistence', async () => {
  let verified = 0,
    written = 0;
  const publication = defineKnowledgePublication({
    authorize() {},
    verifySources() {
      verified++;
    },
    store: {
      load: async () => ({ revision: 0, publishedRevision: 0, documents: [], candidates: [] }),
      async compareAndSwap() {
        written++;
        return true;
      },
    },
  });
  await assert.rejects(
    publication.propose(
      // A sparse provenance array: the absent entry is rejected before verification.
      { revision: 0, document: document('one'), sources: new Array(1) },
      operation(),
    ),
    /provenance/,
  );
  assert.equal(verified, 0);
  assert.equal(written, 0);
});

test('durable cancellation stops a stalled initial read without releasing an in-flight write', async () => {
  const control = new AbortController(),
    gate = deferred(),
    entered = deferred(),
    reason = Error('cancel read');
  let locked = false,
    saves = 0,
    timer;
  const task = defineDurableTask(
    {
      id: 'task',
      revision: '1',
      isState: () => true,
      steps: [{ id: 'step', replayPolicy: 'safe', run: (state) => state }],
    },
    {
      store: {
        async exclusive(_id, run) {
          locked = true;
          try {
            return await run();
          } finally {
            locked = false;
          }
        },
        load() {
          entered.resolve();
          return gate.promise;
        },
        async save() {
          saves++;
        },
      },
    },
  );
  const pending = task.run({ taskId: 'one' }, operation(control.signal));
  await entered.promise;
  control.abort(reason);
  try {
    // Race a 250ms timer so a hung read fails the test instead of hanging it.
    await assert.rejects(
      Promise.race([
        pending,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(Error('read hung')), 250);
        }),
      ]),
      (error) => error === reason,
    );
    assert.equal(locked, false);
    assert.equal(saves, 0);
  } finally {
    clearTimeout(timer);
    // Settle the stalled read after the assertions so nothing stays pending.
    gate.reject(Error('late read'));
    await pending.catch(() => {});
  }
});

test('journal rejects duplicate model receipts and collisions with existing tool invocations', () => {
  const invocation = (id) => ({ invocationId: id, startedAtMs: 1, durationMs: 0 });
  // Collisions are checked from both sides: model then model, and tool then model.
  for (const first of ['model', 'tool']) {
    const journal = new ContextJournal();
    if (first === 'model')
      journal.model({ stageId: 'answer', value: 'answer', invocation: invocation('same') });
    else journal.beginTool({ toolId: 'read', input: {}, invocation: invocation('same') });
    assert.throws(
      () =>
        journal.model({ stageId: 'answer', value: 'duplicate', invocation: invocation('same') }),
      /Duplicate/,
    );
    assert.equal(journal.snapshot().length, 1);
    assert.throws(
      () => journal.model({ stageId: 'answer', value: () => {}, invocation: invocation('retry') }),
      { name: 'DataCloneError' },
    );
    journal.model({ stageId: 'answer', value: 'retry', invocation: invocation('retry') });
    // The failed clone added no record; only the successful retry did.
    assert.equal(journal.snapshot().length, 2);
  }
});

// Locks Kit authorization and durability guards: auth hooks must return void (sync or async),
// deadlines and cancellation must release exclusive locks, and journal indices stay ordered.
// Covers `defineKnowledgePublication`, `defineAgentFamily`, `defineDurableTask`, `defineReflection`,
// `defineReflectionLogSource` and `ContextJournal`; `node --test` with in-memory stores.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ContextJournal, ModelRunner } from '../dist/esm/index.js';
import { defineAgentFamily } from '../dist/esm/kits/family.js';
import { defineDurableTask } from '../dist/esm/kits/durable.js';
import { defineKnowledgePublication } from '../dist/esm/kits/knowledge/index.js';
import { defineReflection, defineReflectionLogSource } from '../dist/esm/kits/reflection.js';

const context = () => ({ app: {}, signal: new AbortController().signal });
const clone = (value) => structuredClone(value);
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const branch = { agentId: 'agent', branchId: 'main', agentVersionId: '1' };
// Minimal valid durable checkpoint; each test patches one field to isolate a rule.
const checkpoint = () => ({
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
// A candidate with provenance so publish and reject have a real target.
const publicationRecord = () => ({
  revision: 1,
  publishedRevision: 0,
  documents: [],
  candidates: [
    {
      id: 'candidate',
      baseRevision: 0,
      document: { id: 'guide', revision: '1', parts: ['body'] },
      sources: [{ id: 'manual', revision: '1' }],
      createdAtMs: Date.now(),
      expiresAtMs: Date.now() + 10000,
    },
  ],
});

test('publication mutations reject non-void authorization and provenance verification before saving', async () => {
  // Any non-void return is rejected, including falsy values that could look like "denied".
  for (const invalid of [false, true, null, 0, 'denied'])
    for (const asynchronous of [false, true]) {
      const denied = () => (asynchronous ? Promise.resolve(invalid) : invalid);
      for (const operation of ['propose', 'publish', 'reject']) {
        const data = publicationRecord();
        let saves = 0;
        const publication = defineKnowledgePublication({
          store: {
            load: async () => clone(data),
            compareAndSwap: async () => {
              saves++;
              return true;
            },
          },
          authorize: denied,
          verifySources() {},
        });
        const request =
          operation === 'propose'
            ? {
                revision: 1,
                document: { id: 'new', revision: '1', parts: [] },
                sources: [{ id: 'manual', revision: '1' }],
              }
            : { revision: 1, candidateId: 'candidate' };
        await assert.rejects(
          publication[operation](request, context()),
          /authorization must return void/,
        );
        // Rejection happens before any compare-and-swap write.
        assert.equal(saves, 0);
      }
      for (const operation of ['propose', 'publish']) {
        let saves = 0;
        const publication = defineKnowledgePublication({
          store: {
            load: async () => publicationRecord(),
            compareAndSwap: async () => {
              saves++;
              return true;
            },
          },
          authorize() {},
          verifySources: denied,
        });
        const request =
          operation === 'propose'
            ? {
                revision: 1,
                document: { id: 'new', revision: '1', parts: [] },
                sources: [{ id: 'manual', revision: '1' }],
              }
            : { revision: 1, candidateId: 'candidate' };
        await assert.rejects(
          publication[operation](request, context()),
          /provenance validation must return void/,
        );
        assert.equal(saves, 0);
      }
    }
});

test('family operations enforce authorization and candidate validation for sync and async hooks', async () => {
  for (const hook of ['authorize', 'validate'])
    for (const asynchronous of [false, true]) {
      let data,
        denied = false,
        saves = 0;
      const family = defineAgentFamily({
        store: {
          load: async () => clone(data),
          compareAndSwap: async (_, expected, next) => {
            assert.equal(data?.revision, expected);
            saves++;
            data = clone(next);
            return true;
          },
        },
        isState: (value) => !!value,
        authorize() {
          if (hook === 'authorize' && denied) return asynchronous ? Promise.resolve(false) : false;
        },
        validate() {
          if (hook === 'validate' && denied) return asynchronous ? Promise.resolve(false) : false;
        },
        merge: async ({ source }) => ({ value: source, conflicts: [] }),
      });
      const root = await family.create({ id: 'family', branch, state: {} }, context());
      const forkBranch = {
        agentId: 'agent',
        branchId: 'fork',
        agentVersionId: '2',
        parentBranchId: 'main',
        parentAgentVersionId: '1',
      };
      const forked = await family.fork(
        {
          id: 'family',
          revision: root.revision,
          parentId: root.activeId,
          branch: forkBranch,
          state: {},
        },
        context(),
      );
      const candidateId = forked.versions.at(-1).id;
      const requests = {
        create: { id: 'another', branch, state: {} },
        fork: {
          id: 'family',
          revision: forked.revision,
          parentId: root.activeId,
          branch: { ...forkBranch, branchId: 'another' },
          state: {},
        },
        merge: {
          id: 'family',
          revision: forked.revision,
          baseId: root.activeId,
          targetId: root.activeId,
          sourceId: candidateId,
        },
        promote: {
          id: 'family',
          revision: forked.revision,
          candidateId,
          expectedActiveId: root.activeId,
        },
      };
      denied = true;
      for (const [operation, request] of Object.entries(requests)) {
        // A missing record for create must be checked by the store first.
        if (operation === 'create') {
          const existing = data;
          data = undefined;
          await assert.rejects(
            family.create(request, context()),
            new RegExp(`${hook === 'authorize' ? 'authorization' : 'validation'} must return void`),
          );
          data = existing;
        } else
          await assert.rejects(
            family[operation](request, context()),
            new RegExp(`${hook === 'authorize' ? 'authorization' : 'validation'} must return void`),
          );
      }
      // Only create and fork wrote; every denied operation stopped before a save.
      assert.equal(saves, 2);
    }
});

test('durable authorization rejects invalid results before reserving attempts or running work', async () => {
  for (const asynchronous of [false, true]) {
    let saves = 0,
      runs = 0;
    const task = defineDurableTask(
      {
        id: 'task',
        revision: '1',
        isState: () => true,
        authorize: () => (asynchronous ? Promise.resolve(false) : false),
        steps: [
          {
            id: 'work',
            replayPolicy: 'safe',
            async run(state) {
              runs++;
              return state;
            },
          },
        ],
      },
      {
        store: {
          exclusive: (_, run) => run(),
          load: async () => checkpoint(),
          save: async () => {
            saves++;
          },
        },
      },
    );
    await assert.rejects(task.run({ taskId: 'one' }, context()), /authorization must return void/);
    assert.equal(saves, 0);
    assert.equal(runs, 0);
  }
});

test('durable deadlines cancel a stalled authorization and release its exclusive lock without saving', async () => {
  let locked = false,
    saves = 0,
    authorizationSignal;
  // Short deadline so a stalled authorization is cancelled rather than awaited forever.
  const record = { ...checkpoint(), deadlineAtMs: Date.now() + 50 };
  const task = defineDurableTask(
    {
      id: 'task',
      revision: '1',
      isState: () => true,
      authorize(_record, { signal }) {
        authorizationSignal = signal;
        return new Promise(() => {});
      },
      steps: [
        {
          id: 'work',
          replayPolicy: 'safe',
          async run() {
            assert.fail('expired authorization cannot execute');
          },
        },
      ],
    },
    {
      store: {
        async exclusive(_, run) {
          locked = true;
          try {
            return await run();
          } finally {
            locked = false;
          }
        },
        load: async () => record,
        save: async () => {
          saves++;
        },
      },
    },
  );
  await assert.rejects(task.run({ taskId: 'one' }, context()), /deadline expired/);
  assert.equal(authorizationSignal.aborted, true);
  // The exclusive lock is released even though authorization never resolved.
  assert.equal(locked, false);
  assert.equal(saves, 0);
});

test('durable cancellation waits for an already-started checkpoint save before unlocking', async () => {
  // Cancel while the first (running) save or the second (completed) save is stalled.
  for (const saveIndex of [1, 2]) {
    const control = new AbortController(),
      entered = deferred(),
      gate = deferred();
    let data = checkpoint(),
      locked = false,
      saves = 0,
      settled = false;
    const task = defineDurableTask(
      {
        id: 'task',
        revision: '1',
        isState: () => true,
        steps: [
          {
            id: 'work',
            replayPolicy: 'safe',
            async run() {
              return { complete: true };
            },
          },
        ],
      },
      {
        store: {
          async exclusive(_, run) {
            locked = true;
            try {
              return await run();
            } finally {
              locked = false;
            }
          },
          load: async () => clone(data),
          async save(_, record) {
            if (++saves === saveIndex) {
              entered.resolve();
              await gate.promise;
            }
            data = clone(record);
          },
        },
      },
    );
    const pending = task.run({ taskId: 'one' }, { app: {}, signal: control.signal });
    const rejected = assert.rejects(pending, { name: 'AbortError' }).then(() => {
      settled = true;
    });
    await entered.promise;
    control.abort();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(locked, true);
    assert.equal(settled, false);
    gate.resolve();
    await rejected;
    assert.equal(locked, false);
    assert.equal(saves, saveIndex);
    // The in-flight save still lands; cancellation never rolls back a started write.
    assert.equal(data.status, saveIndex === 1 ? 'running' : 'completed');
  }
});

test('reflection and log-source authorization reject invalid results without reading evidence', async () => {
  for (const asynchronous of [false, true]) {
    const deny = () => (asynchronous ? Promise.resolve(false) : false);
    let calls = 0,
      reads = 0;
    const model = new ModelRunner({
      maxCalls: 4,
      provider: {
        async *stream() {
          calls++;
          yield '{"name":"history.query","input":{"limit":1}}';
        },
      },
    });
    const source = {
      id: 'source',
      description: 'source',
      authorize() {},
      async query() {
        reads++;
        assert.fail('unauthorized read');
      },
    };
    await assert.rejects(
      defineReflection({ model, source, authorize: deny }).run('Review', context()),
      /authorization must return void/,
    );
    assert.equal(calls, 0);
    // A rejected reflection authorization never reaches the model.
    const report = await defineReflection({
      model,
      source: { ...source, authorize: deny },
      authorize() {},
    }).run('Review', context());
    assert.equal(report.status, 'incomplete');
    assert.equal(reads, 0);
    const logs = defineReflectionLogSource({
      id: 'logs',
      authorize: deny,
      reader: {
        async listRuns() {
          reads++;
          assert.fail('unauthorized log read');
        },
        async readEvents() {
          reads++;
          assert.fail('unauthorized event read');
        },
      },
    });
    await assert.rejects(logs.authorize({}, context()), /authorization must return void/);
    await assert.rejects(logs.query({ limit: 1 }, context()), /authorization must return void/);
    assert.equal(reads, 0);
  }
});

test('cached publication reads remain isolated, detect changed content and recheck source permissions/expiry', async () => {
  let data = publicationRecord(),
    verifies = 0,
    granted = true,
    now = Date.now();
  data.candidates[0].sources[0].expiresAtMs = now + 1000;
  const publication = defineKnowledgePublication({
    store: {
      load: async () => data,
      compareAndSwap: async (revision, next) => {
        assert.equal(data.revision, revision);
        data = next;
        return true;
      },
    },
    now: () => now,
    authorize() {},
    verifySources() {
      verifies++;
      if (!granted) throw Error('revoked');
    },
  });
  const first = await publication.read(context());
  first.candidates[0].document.parts[0] = 'caller mutation';
  assert.equal((await publication.read(context())).candidates[0].document.parts[0], 'body');
  granted = false;
  await assert.rejects(
    publication.publish({ revision: 1, candidateId: 'candidate' }, context()),
    /revoked/,
  );
  assert.equal(verifies, 1);
  assert.equal(data.publishedRevision, 0);
  const valid = clone(data);
  data.candidates[0].document.parts = [null];
  // Sparse arrays and null entries are rejected by document validation.
  await assert.rejects(publication.read(context()), /Invalid/);
  data.candidates[0].document.parts = new Array(1);
  await assert.rejects(publication.read(context()), /Invalid/);
  data = valid;
  await publication.read(context());
  granted = true;
  // Advance past the source expiry window.
  now += 1001;
  await assert.rejects(
    publication.publish({ revision: 1, candidateId: 'candidate' }, context()),
    /expired/,
  );
  assert.equal(data.publishedRevision, 0);
});

test('journal invocation indices preserve sequence, model/tool collisions and retry after an uncloneable receipt', () => {
  const journal = new ContextJournal();
  const invocation = (id) => ({ invocationId: id, startedAtMs: Date.now(), durationMs: 0 });
  journal.model({ stageId: 'answer', value: 'answer', invocation: invocation('model') });
  // Model and tool invocations share one id space, so a collision must throw.
  assert.throws(
    () => journal.beginTool({ toolId: 'tool', input: {}, invocation: invocation('model') }),
    /Duplicate/,
  );
  const first = journal.beginTool({ toolId: 'tool', input: {}, invocation: invocation('first') });
  const second = journal.beginTool({ toolId: 'tool', input: {}, invocation: invocation('second') });
  assert.throws(
    () => journal.finishTool({ invocationId: first, status: 'success', value: () => {} }),
    { name: 'DataCloneError' },
  );
  journal.finishTool({ invocationId: second, status: 'success', value: 2 });
  journal.finishTool({ invocationId: first, status: 'error', value: 1 });
  assert.throws(
    () => journal.finishTool({ invocationId: first, status: 'success', value: 3 }),
    /receipt/,
  );
  assert.throws(
    () => journal.finishTool({ invocationId: 'unknown', status: 'success', value: 3 }),
    /receipt/,
  );
  const records = journal.snapshot();
  // A failed finish does not consume a sequence number, so the next record is contiguous.
  assert.deepEqual(
    records.map((record) => record.producerSequence),
    [1, 2, 3, 4, 5],
  );
  assert.deepEqual(
    records.filter((record) => record.type === 'tool-result').map((record) => record.invocationId),
    ['second', 'first'],
  );
});

/*
 * Contract for carrying agent state across restarts and releases: checkpoints,
 * family branches, durable task budgets, knowledge publication and reflection.
 *
 * The file groups the ways state outlives one process. A portable checkpoint is
 * bound to its exact branch/version identity and never restores execution
 * authority; family activation is compare-and-swap protected and revalidates its
 * sources; a durable task's reserved model calls survive a crash and authorization
 * is re-checked before a completed result is delivered; a published knowledge
 * revision only becomes readable after promotion; and reflection keeps working on
 * metadata only, with read-only tools bound once.
 *
 * Runs on `dist/esm` with in-memory stores that clone on load/save, plus a fake
 * provider that returns canned capability calls.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentCoreEngine, ModelRunner } from '../dist/esm/index.js';
import { defineAgentFamily } from '../dist/esm/kits/family.js';
import { defineDurableTask } from '../dist/esm/kits/durable.js';
import { defineKnowledgePublication } from '../dist/esm/kits/knowledge/index.js';
import { defineReflection, defineReflectionLogSource } from '../dist/esm/kits/reflection.js';
const ctx = () => ({ app: {}, signal: new AbortController().signal });
const branch = { agentId: 'app', branchId: 'main', agentVersionId: 'v1' };
const fork = {
  agentId: 'app',
  branchId: 'fork',
  agentVersionId: 'v2',
  parentBranchId: 'main',
  parentAgentVersionId: 'v1',
};
const clone = (value) => structuredClone(value);
test('portable checkpoint restores only its exact branch and never restores execution authority', () => {
  const engine = new AgentCoreEngine({ branch }),
    record = engine.exportCheckpoint(engine.checkpoint({ value: 1 }));
  const restarted = new AgentCoreEngine({ branch });
  assert.deepEqual(restarted.restoreCheckpoint(record).read(), { value: 1 });
  assert.throws(() => new AgentCoreEngine().restoreCheckpoint(record), /identity/);
  // Re-labelling the record with another branch must be refused: the checkpoint is
  // bound to the identity it was exported from.
  record.source = fork;
  assert.throws(() => restarted.restoreCheckpoint(record), /identity/);
});
test('family activation is explicit, CAS protected and revalidates current sources', async () => {
  let data,
    valid = true;
  const store = {
    load: async () => clone(data),
    compareAndSwap: async (_id, expected, next) => {
      if (data?.revision !== expected) return false;
      data = clone(next);
      return true;
    },
  };
  const family = defineAgentFamily({
    store,
    isState: (value) => typeof value?.goal === 'string',
    authorize() {},
    validate() {
      if (!valid) throw Error('source changed');
    },
    merge: async ({ source }) => ({ value: source, conflicts: [] }),
  });
  const first = await family.create({ id: 'one', branch, state: { goal: 'start' } }, ctx());
  assert.equal(typeof first.expiresAtMs, 'number');
  assert.equal(typeof first.versions[0].createdAtMs, 'number');
  assert.equal(Object.hasOwn(first, 'expiresAt'), false);
  const second = await family.fork(
    {
      id: 'one',
      revision: 1,
      parentId: first.activeId,
      branch: fork,
      state: { goal: 'candidate' },
    },
    ctx(),
  );
  assert.equal(second.activeId, first.activeId);
  const candidateId = second.versions.at(-1).id;
  valid = false;
  await assert.rejects(
    family.promote(
      { id: 'one', revision: 2, candidateId, expectedActiveId: first.activeId },
      ctx(),
    ),
    /source changed/,
  );
  valid = true;
  const promoted = await family.promote(
    { id: 'one', revision: 2, candidateId, expectedActiveId: first.activeId },
    ctx(),
  );
  assert.equal(promoted.activeId, candidateId);
  // Replaying the same promotion request uses a stale revision, which must be a
  // conflict rather than a second activation.
  await assert.rejects(
    family.promote(
      { id: 'one', revision: 2, candidateId, expectedActiveId: first.activeId },
      ctx(),
    ),
    /conflict/,
  );
  data.versions[0].state = null;
  await assert.rejects(family.read('one', ctx()), /state/);
});
test('durable reservations survive a restart and authorization runs before completed delivery', async () => {
  let data = {
    version: 2,
    definitionId: 'work',
    revision: '1',
    nextStepIndex: 0,
    attemptCount: 0,
    maxAttempts: 4,
    deadlineAtMs: Date.now() + 60000,
    status: 'ready',
    state: { done: false },
    modelBudget: { maxCalls: 4, reservedCalls: 0, maxCallsPerAttempt: 2 },
  };
  const store = {
    exclusive: (_id, run) => run(),
    load: async () => clone(data),
    save: async (_id, value) => {
      data = clone(value);
    },
  };
  let authorized = true,
    attempts = 0;
  const task = () =>
    defineDurableTask(
      {
        id: 'work',
        revision: '1',
        isState: (v) => typeof v?.done === 'boolean',
        authorize() {
          if (!authorized) throw Error('revoked');
        },
        steps: [
          {
            id: 'review',
            replayPolicy: 'safe',
            async run(_state, context) {
              assert.equal(context.maxModelCalls, 2);
              if (++attempts === 1) throw Error('crash');
              return { done: true };
            },
          },
        ],
      },
      { store },
    );
  await assert.rejects(task().run({ taskId: 'one' }, ctx()), /crash/);
  // The first attempt's reservation survives the crash: 2 calls are spent, not reset.
  assert.equal(data.modelBudget.reservedCalls, 2);
  assert.deepEqual(await task().run({ taskId: 'one' }, ctx()), { done: true });
  assert.equal(data.modelBudget.reservedCalls, 4);
  authorized = false;
  // Revoked authorization stops the run before the finished step is delivered, so no
  // third attempt happens.
  await assert.rejects(task().run({ taskId: 'one' }, ctx()), /revoked/);
  assert.equal(attempts, 2);
});
test('publication keeps candidates out of reads, recompiles and rejects stale provenance/base', async () => {
  let data = {
      revision: 0,
      publishedRevision: 0,
      documents: [{ id: 'guide', revision: '1', parts: ['old'] }],
      candidates: [],
    },
    valid = true;
  const publication = defineKnowledgePublication({
    store: {
      load: async () => clone(data),
      compareAndSwap: async (revision, next) => {
        if (data.revision !== revision) return false;
        data = clone(next);
        return true;
      },
    },
    authorize() {},
    verifySources() {
      if (!valid) throw Error('source changed');
    },
    requiredReads: [{ documentId: 'guide', selection: { mode: 'document' } }],
  });
  const sourceExpiresAtMs = Date.now() + 60000;
  const proposed = await publication.propose(
    {
      revision: 0,
      document: { id: 'guide', revision: '2', parts: ['new'] },
      sources: [{ id: 'manual', revision: '1', expiresAtMs: sourceExpiresAtMs }],
    },
    ctx(),
  );
  assert.equal(proposed.candidates[0].expiresAtMs, sourceExpiresAtMs);
  assert.equal(typeof proposed.candidates[0].createdAtMs, 'number');
  // A proposal is staged: reads still return the published revision until promotion.
  assert.equal(proposed.documents[0].revision, '1');
  const candidateId = proposed.candidates[0].id;
  valid = false;
  await assert.rejects(publication.publish({ revision: 1, candidateId }, ctx()), /source changed/);
  valid = true;
  await publication.publish({ revision: 1, candidateId }, ctx());
  assert.equal(data.documents[0].revision, '2');
  await assert.rejects(
    publication.propose(
      {
        revision: 2,
        document: { id: 'guide', revision: '2', parts: ['changed without revision'] },
        sources: [{ id: 'manual', revision: '1' }],
      },
      ctx(),
    ),
    /new document revision/,
  );
});
test('reflection uses real query tools, strips bodies and distinguishes incomplete evidence', async () => {
  let step = 0;
  const inputs = [];
  const provider = {
    async *stream(messages) {
      inputs.push(JSON.stringify(messages));
      yield JSON.stringify(
        ++step === 1
          ? { name: 'history.query', input: { limit: 2 } }
          : {
              name: 'review.finish',
              input: {
                findings: [{ kind: 'observed', claim: 'Model ended', evidenceIds: ['e1'] }],
                limitations: ['Only metadata'],
              },
            },
      );
    },
  };
  const model = new ModelRunner({ execution: {}, provider, maxCalls: 4, maxSchemaChars: 30000 });
  const reflection = defineReflection({
    model,
    authorize() {},
    source: {
      id: 'fixture',
      description: 'own metadata',
      authorize() {},
      async query() {
        return {
          items: [
            {
              id: 'e1',
              runId: 'r',
              type: 'model.end',
              parentSpanId: 'actual-parent',
              payload: 'SECRET BODY',
              question: 'PRIVATE',
            },
          ],
          coverage: { consistency: 'best-effort', complete: false, gaps: ['capture incomplete'] },
        };
      },
    },
  });
  const report = await reflection.run('Review my run', ctx());
  assert.equal(report.status, 'completed');
  assert.equal(report.persisted, false);
  assert.equal(typeof report.createdAtMs, 'number');
  assert.equal(Object.hasOwn(report, 'createdAt'), false);
  assert.equal(report.evidence[0].parentSpanId, 'actual-parent');
  // Span metadata is kept while bodies are stripped, so neither the prompt sent to
  // the model nor the returned report can leak the source payload.
  assert.equal(inputs.join('').includes('SECRET BODY'), false);
  assert.equal(JSON.stringify(report).includes('PRIVATE'), false);
  assert.ok(report.limitations.includes('capture incomplete'));
  assert.equal(model.totalCallCount, 2);
});
test('reflection rejects fabricated evidence and never replays a write tool', async () => {
  const model = new ModelRunner({ execution: {},
    maxCalls: 3,
    provider: {
      async *stream() {
        yield JSON.stringify({
          name: 'review.finish',
          input: {
            findings: [{ kind: 'observed', claim: 'Invented', evidenceIds: ['unknown'] }],
            limitations: [],
          },
        });
      },
    },
  });
  const definition = {
    model,
    authorize() {},
    source: {
      id: 'own',
      description: 'own',
      authorize() {},
      query() {
        assert.fail();
      },
    },
  };
  // Reflection may only observe, so declaring a write tool is refused at definition
  // time rather than filtered later.
  assert.throws(
    () => defineReflection({ ...definition, tools: [{ id: 'write', kind: 'write' }] }),
    /read-only/,
  );
  const result = await defineReflection(definition).run('Review', ctx());
  assert.equal(result.status, 'incomplete');
  assert.deepEqual(result.findings, []);
});
test('log reflection source pins discovery scope and drops every payload before model consumption', async () => {
  let authorized = true,
    read = 0;
  const source = defineReflectionLogSource({
    id: 'own',
    traceId: 'own-turn',
    authorize() {
      if (!authorized) throw Error('revoked');
    },
    reader: {
      async listRuns(query) {
        assert.equal(query.traceId, 'own-turn');
        return {
          items: [
            {
              path: 'own/run',
              manifest: { runId: 'r', expiresAt: Date.now() + 10000, secret: 'PRIVATE' },
            },
          ],
          status: 'end',
          coverage: { exhausted: true },
          issues: [],
          issuesOmitted: 0,
        };
      },
      async readEvents(query) {
        read++;
        assert.deepEqual(query.sources, ['core']);
        return {
          items: [
            {
              runId: 'r',
              sequence: 1,
              spanId: 'span',
              parentSpanId: 'parent',
              occurredAtMs: 123,
              type: 'model.end',
              payload: {
                state: {
                  status: 'success',
                  inputChars: 12,
                  codes: ['ACTUAL_CODE'],
                  messages: 'PRIVATE',
                },
              },
            },
          ],
          status: 'end',
          coverage: { exhausted: true },
          issues: [],
          issuesOmitted: 0,
        };
      },
    },
  });
  // Only runs discovered through this source's own trace may be read; a foreign path
  // is refused before the reader is touched.
  await assert.rejects(source.query({ run: 'foreign/run', limit: 1 }, ctx()), /not discovered/);
  assert.equal(read, 0);
  const runs = await source.query({ limit: 1 }, ctx());
  assert.ok(!JSON.stringify(runs).includes('PRIVATE'));
  const page = await source.query({ run: 'own/run', limit: 1 }, ctx());
  assert.equal(page.items[0].inputChars, 12);
  assert.ok(!JSON.stringify(page).includes('PRIVATE'));
  assert.equal(page.items[0].parentSpanId, 'parent');
  assert.equal(page.items[0].occurredAtMs, 123);
  assert.equal(page.items[0].code, 'ACTUAL_CODE');
  authorized = false;
  await assert.rejects(source.query({ run: 'own/run', limit: 1 }, ctx()), /revoked/);
  assert.equal(read, 1);
});
test('reflection with no discretionary calls preserves parent delivery and returns an honest incomplete report', async () => {
  const model = new ModelRunner({ execution: {},
    maxCalls: 1,
    provider: {
      async *stream() {
        assert.fail('must not call');
      },
    },
  });
  const result = await defineReflection({
    model,
    authorize() {},
    source: {
      id: 'own',
      description: 'own',
      authorize() {},
      query() {
        assert.fail('must not read');
      },
    },
  }).run('Review', ctx());
  assert.equal(result.status, 'incomplete');
  assert.equal(model.totalCallCount, 0);
  assert.equal(model.remainingCalls, 1);
});

test('reflection projects coverage fields instead of forwarding private source metadata', async () => {
  let step = 0;
  const inputs = [];
  const model = new ModelRunner({ execution: {},
    maxCalls: 4,
    maxSchemaChars: 30000,
    provider: {
      async *stream(messages) {
        inputs.push(JSON.stringify(messages));
        yield JSON.stringify(
          ++step === 1
            ? { name: 'history.query', input: { limit: 1 } }
            : { name: 'review.finish', input: { findings: [], limitations: [] } },
        );
      },
    },
  });
  const result = await defineReflection({
    model,
    authorize() {},
    source: {
      id: 'own',
      description: 'metadata',
      authorize() {},
      async query() {
        return {
          items: [],
          coverage: {
            consistency: 'snapshot',
            complete: true,
            gaps: [],
            privateBody: 'PRIVATE_SOURCE_BODY',
          },
        };
      },
    },
  }).run('Review', ctx());
  assert.equal(result.status, 'completed');
  assert.equal(inputs.join('').includes('PRIVATE_SOURCE_BODY'), false);
  assert.deepEqual(result.coverage, [{ consistency: 'snapshot', complete: true, gaps: [] }]);
});

test('reflection binds read-tool handlers once instead of accepting later replacement', async () => {
  let step = 0,
    reads = 0,
    writes = 0;
  const model = new ModelRunner({ execution: {},
    maxCalls: 4,
    maxSchemaChars: 30000,
    provider: {
      async *stream() {
        yield JSON.stringify(
          ++step === 1
            ? { name: 'custom.read', input: {} }
            : { name: 'review.finish', input: { findings: [], limitations: [] } },
        );
      },
    },
  });
  const read = {
    id: 'custom.read',
    kind: 'read',
    description: 'Read a metric',
    inputSchema: { jsonSchema: { type: 'object' }, parse: (value) => value },
    authorize() {},
    execute() {
      reads++;
      return {};
    },
    parseOutput: (value) => value,
  };
  const tools = [read];
  const reflection = defineReflection({
    model,
    tools,
    authorize() {},
    source: {
      id: 'own',
      description: 'metadata',
      authorize() {},
      async query() {
        assert.fail();
      },
    },
  });
  // The read-only handler and its receiver were captured at definition time; mutating
  // the same object afterwards must not reach the catalog.
  read.kind = 'write';
  read.execute = () => {
    writes++;
    return {};
  };
  tools.push({ ...read, id: 'custom.write' });
  const result = await reflection.run('Review', ctx());
  assert.equal(result.status, 'completed');
  assert.equal(reads, 1);
  assert.equal(writes, 0);
});

test('reflection does not register tools appended after its read-only catalog is checked', async () => {
  let writes = 0;
  const model = new ModelRunner({ execution: {},
    maxCalls: 3,
    maxSchemaChars: 30000,
    provider: {
      async *stream() {
        yield JSON.stringify({ name: 'late.write', input: {} });
      },
    },
  });
  const tools = [];
  const reflection = defineReflection({
    model,
    tools,
    authorize() {},
    source: {
      id: 'own',
      description: 'metadata',
      authorize() {},
      async query() {
        assert.fail();
      },
    },
  });
  tools.push({
    id: 'late.write',
    kind: 'write',
    description: 'Not registered',
    inputSchema: { jsonSchema: { type: 'object' }, parse: (value) => value },
    authorize() {},
    execute() {
      writes++;
      return {};
    },
    parseOutput: (value) => value,
  });
  assert.equal((await reflection.run('Review', ctx())).status, 'incomplete');
  assert.equal(writes, 0);
});

/*
 * Contracts for the three optional App-side Kits: exact vector search, rank fusion and
 * the model invocation catalog.
 *
 * The Kits stay usable independently of Core, so the suite drives them through their
 * public entry points only. It pins the retrieval semantics (filter before ranking, one
 * hit per group, unit-length vectors), the fusion semantics (ranks only, deterministic
 * tie-breaking) and the invocation semantics (budget, timeout, cancellation and
 * assertion ordering).
 *
 * Main exports: none. The file only registers `node:test` cases.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { VectorSearch } from '@jangts/agent-core/kits/vector-search';
import { reciprocalRankFusion } from '@jangts/agent-core/kits/rank-fusion';
import { ModelCalls } from '@jangts/agent-core/kits/inference';

// The CommonJS entry points of the Kits must expose the same exports as the ESM ones.
const require = createRequire(import.meta.url);

test('model calls accept application-defined data, validate receipts and bound ignored cancellation', async () => {
  const calls = new ModelCalls([
    {
      id: 'arbitrary-service',
      identity: 'weights-A',
      invoke: async (input) => ({ answer: input.value * 2 }),
      // The output assertion runs before the result is reported.
      assertOutput: (output) => assert.equal(typeof output.answer, 'number'),
    },
  ]);
  assert.equal(calls.identity('arbitrary-service'), 'weights-A');
  assert.deepEqual(
    (
      await calls.invoke(
        { modelId: 'arbitrary-service', input: { value: 3 }, timeoutMs: 100 },
        { signal: new AbortController().signal },
      )
    ).value,
    { answer: 6 },
  );
  // A binding id may only be registered once.
  assert.throws(
    () =>
      new ModelCalls([
        { id: 'x', identity: 'a', invoke: async (x) => x },
        { id: 'x', identity: 'b', invoke: async (x) => x },
      ]),
    /Duplicate/,
  );
  const never = new ModelCalls([
    { id: 'slow', identity: 'one', invoke: async () => new Promise(() => {}) },
  ]);
  // The timer keeps the event loop alive long enough for the timeout to fire.
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    await assert.rejects(
      never.invoke(
        { modelId: 'slow', input: null, timeoutMs: 20 },
        { signal: new AbortController().signal },
      ),
    );
  } finally {
    clearTimeout(keepAlive);
  }
  let invoked = false;
  const stopped = new AbortController();
  stopped.abort();
  const guarded = new ModelCalls([
    {
      id: 'x',
      identity: 'one',
      invoke: async () => {
        invoked = true;
      },
    },
  ]);
  // An already aborted signal stops the call before the binding runs.
  await assert.rejects(
    guarded.invoke({ modelId: 'x', input: null, timeoutMs: 100 }, { signal: stopped.signal }),
  );
  assert.equal(invoked, false);
});

test('cosine retrieval filters before ranking, groups document chunks, normalizes and rejects incompatible values', () => {
  const index = new VectorSearch({ identity: 'application-chosen-model', dimensions: 2 });
  index.upsert({ document: { id: 'public:1', group: 'public', visible: true }, vector: [2, 0] });
  index.upsert({ document: { id: 'public:2', group: 'public', visible: true }, vector: [1, 0.1] });
  index.upsert({ document: { id: 'private', group: 'private', visible: false }, vector: [1, 0] });
  index.upsert({ document: { id: 'second', group: 'second', visible: true }, vector: [0, 1] });
  const hits = index.search({
    vector: [1, 0],
    limit: 3,
    filter: (doc) => doc.visible,
    groupBy: (doc) => doc.group,
  });
  // The invisible document is filtered out, and grouping keeps only the best hit
  // of each group, so `public:2` is dropped in favour of `public:1`.
  assert.deepEqual(
    hits.map((hit) => hit.id),
    ['public:1', 'second'],
  );
  // Cosine similarity of [1, 0] and [2, 0] is 1.
  assert.equal(hits[0].score, 1);
  assert.throws(() => index.upsert({ document: { id: 'bad' }, vector: [1] }), /dimensions/);
  assert.throws(() => index.upsert({ document: { id: 'zero' }, vector: [0, 0] }), /Zero/);
  assert.throws(() => index.search({ vector: [NaN, 0], limit: 1, filter: () => true }));
  index.remove('public:1');
  assert.equal(
    index.search({ vector: [1, 0], limit: 1, filter: (d) => d.visible })[0].id,
    'public:2',
  );
  index.clear();
  assert.deepEqual(index.search({ vector: [1, 0], limit: 3, filter: () => true }), []);
});

test('RRF merges ranks without mixing incompatible raw scores, deduplicates and breaks ties deterministically', () => {
  const result = reciprocalRankFusion(
    [
      // The repeated `b` counts only at its first position.
      { sourceId: 'lexical', ids: ['a', 'b', 'b', 'c'] },
      { sourceId: 'semantic', ids: ['b', 'd', 'a'] },
    ],
    { limit: 4 },
  );
  assert.deepEqual(
    result.map((r) => r.id),
    ['b', 'a', 'd', 'c'],
  );
  assert.equal(result[0].contributions.length, 2);
  // Score is the sum of `1 / (k + rank)` with the default k of 60.
  assert.equal(result[0].score, 1 / 62 + 1 / 61);
  // Two lists with the same source id would double-count, so they are rejected.
  assert.throws(
    () =>
      reciprocalRankFusion(
        [
          { sourceId: 'x', ids: [] },
          { sourceId: 'x', ids: [] },
        ],
        { limit: 2 },
      ),
    /Invalid/,
  );
  assert.throws(() => reciprocalRankFusion([], { limit: 0 }));
});

test('optional inference/vector/fusion kits have matching CommonJS exports', () => {
  assert.equal(typeof require('@jangts/agent-core/kits/vector-search').VectorSearch, 'function');
  assert.equal(typeof require('@jangts/agent-core/kits/inference').ModelCalls, 'function');
  assert.equal(
    typeof require('@jangts/agent-core/kits/rank-fusion').reciprocalRankFusion,
    'function',
  );
});

test('vector space getters and query methods preserve the configured space and receiver', () => {
  // The space and the query may be class instances; the Kit reads them
  // structurally so prototype getters and private fields stay usable.
  class Space {
    get identity() {
      return 'class-model';
    }
    get dimensions() {
      return 2;
    }
  }
  class Query {
    #scope = 'public';
    get vector() {
      return [1, 0];
    }
    get limit() {
      return 2;
    }
    filter(document) {
      return document.scope === this.#scope;
    }
    groupBy(document) {
      return this.#scope + document.id;
    }
  }
  const search = new VectorSearch(new Space());
  assert.deepEqual(search.space, { identity: 'class-model', dimensions: 2 });
  search.upsert({ document: { id: 'public', scope: 'public' }, vector: [1, 0] });
  search.upsert({ document: { id: 'private', scope: 'private' }, vector: [1, 0] });
  assert.deepEqual(
    search.search(new Query()).map((hit) => hit.id),
    ['public'],
  );
});

test('model binding timeouts reject unsupported values before executing a model', async () => {
  let calls = 0;
  const models = new ModelCalls([
    {
      id: 'model',
      identity: 'local',
      invoke() {
        calls++;
        return 1;
      },
    },
  ]);
  // Only whole milliseconds up to the platform timer ceiling are accepted.
  for (const timeoutMs of [0, -1, 0.5, Infinity, 2147483648]) {
    await assert.rejects(
      models.invoke(
        { modelId: 'model', input: null, timeoutMs },
        { signal: new AbortController().signal },
      ),
      /timeoutMs/,
    );
  }
  assert.equal(calls, 0);
});

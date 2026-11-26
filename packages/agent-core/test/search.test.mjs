/**
 * Locks down the `TextSearch` Kit through both the ESM and CommonJS entries: caller
 * filtering, result limits, stored-field projection, portable snapshots, upsert
 * replacement, deletion vacuuming and per-consumer configuration isolation. Runs under
 * node --test with fixture documents and no external search backend.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { TextSearch as EsmSearch } from '@jangts/agent-core/kits/search';
const require = createRequire(import.meta.url);
const { TextSearch } = require('@jangts/agent-core/kits/search');
const definition = {
  indexRevision: 'test-docs-v1',
  fields: ['title', 'text'],
  storedFields: ['title', 'scope', 'revision'],
  boost: { title: 3 },
};
const documents = [
  {
    id: 'one',
    title: 'Loan checklist',
    text: 'Income materials and credit documents',
    scope: 'public',
    revision: 1,
  },
  {
    id: 'two',
    title: 'Loan worksheet',
    text: 'Income information for simulation',
    scope: 'test',
    revision: 1,
  },
];

test('CJS and ESM search enforce caller filtering and result limits, without returning indexed body', () => {
  for (const Constructor of [TextSearch, EsmSearch]) {
    const index = new Constructor(definition);
    documents.forEach((doc) => index.upsert(doc));
    const all = index.search({ query: 'loan', limit: 1, filter: () => true });
    // limit caps the hit list even though both documents match.
    assert.equal(all.length, 1);
    const publicOnly = index.search({
      query: 'loan',
      limit: 6,
      filter: (r) => r.scope === 'public',
    });
    assert.deepEqual(
      publicOnly.map((r) => r.id),
      ['one'],
    );
    // Indexed-but-unstored fields are never returned; only declared storedFields survive.
    assert.equal(publicOnly[0].document.text, undefined);
    assert.equal(publicOnly[0].document.title, 'Loan checklist');
    assert.ok(publicOnly[0].score > 0);
    // An unfiltered search, an oversized limit and a blank query are all invalid.
    assert.throws(() => index.search({ query: 'loan', limit: 6 }), /filter/);
    assert.throws(() => index.search({ query: 'loan', limit: 1001, filter: () => true }), /limit/);
    assert.throws(() => index.search({ query: ' ', limit: 6, filter: () => true }), /nonempty/);
  }
});

test('snapshot roundtrip is bidirectional between module formats and rejects changed app schemas and malformed data', () => {
  const index = new TextSearch(definition);
  documents.forEach((doc) => index.upsert(doc));
  const snapshot = JSON.parse(JSON.stringify(index.snapshot()));
  const esm = EsmSearch.restore(definition, snapshot);
  const cjs = TextSearch.restore(definition, esm.snapshot());
  assert.deepEqual(
    cjs.search({ query: 'credit', limit: 6, filter: (r) => r.scope === 'public' }).map((r) => r.id),
    ['one'],
  );
  // Snapshots bind to the index revision and stored-field declaration, so a schema drift
  // cannot be restored over existing data.
  assert.throws(
    () => TextSearch.restore({ ...definition, indexRevision: 'test-docs-v2' }, snapshot),
    /Incompatible/,
  );
  assert.throws(
    () => TextSearch.restore({ ...definition, storedFields: ['title'] }, snapshot),
    /Incompatible/,
  );
  assert.throws(() => TextSearch.restore(definition, { ...snapshot, serializedIndex: 'broken' }));
});

test('upserts replace prior searchable content; deletion vacuums checkpoints and clear removes everything', async () => {
  const index = new TextSearch(definition);
  index.upsert(documents[0]);
  index.upsert({ ...documents[0], title: 'Mortgage rules', text: 'uniqueerasedterm', revision: 2 });
  // An upsert replaces the earlier terms instead of accumulating them, so the old body is
  // no longer searchable while the new revision is.
  assert.equal(index.search({ query: 'credit', limit: 6, filter: () => true }).length, 0);
  assert.equal(
    index.search({ query: 'mortgage', limit: 6, filter: () => true })[0].document.revision,
    2,
  );
  assert.equal(await index.remove('one'), true);
  assert.equal(await index.remove('one'), false);
  // Removal vacuums the erased term out of the serialized index rather than tombstoning it.
  assert.ok(!index.snapshot().serializedIndex.includes('uniqueerasedterm'));
  documents.forEach((doc) => index.upsert(doc));
  index.clear();
  assert.equal(index.search({ query: 'loan', limit: 6, filter: () => true }).length, 0);
});

test('application tokenizer and configuration snapshots remain independent between consumers', () => {
  const options = {
    indexRevision: 'character-v1',
    fields: ['text'],
    storedFields: ['scope'],
    tokenize: (text) => Array.from(text),
  };
  const chinese = new TextSearch(options);
  // Mutating the caller's options after construction must not change the live index.
  options.fields.push('missing');
  options.storedFields.push('text');
  chinese.upsert({ id: 'cn', text: '产品材料', scope: 'banker' });
  const hit = chinese.search({ query: '材', limit: 3, filter: (d) => d.scope === 'banker' })[0];
  assert.equal(hit.id, 'cn');
  assert.equal(hit.document.text, undefined);
  const second = new TextSearch(definition);
  // A second consumer starts empty: configuration may be shared but documents are not.
  assert.equal(second.search({ query: 'loan', limit: 3, filter: () => true }).length, 0);
  assert.equal(require('@jangts/agent-core/kits').TextSearch, TextSearch);
});

test('invalid declarations and indexed fields fail before replacing an existing document', () => {
  for (const options of [
    { ...definition, indexRevision: '' },
    { ...definition, fields: [] },
    { ...definition, storedFields: ['score'] },
    { ...definition, fields: ['text', 'text'] },
    { ...definition, boost: { missing: 3 } },
    { ...definition, boost: { title: -1 } },
  ])
    assert.throws(() => new TextSearch(options));
  const index = new TextSearch(definition);
  index.upsert(documents[0]);
  // A document with a non-string indexed field is rejected and the previous document stays.
  assert.throws(() => index.upsert({ ...documents[0], text: 123 }), /document/);
  assert.equal(index.search({ query: 'credit', limit: 3, filter: () => true })[0].id, 'one');
});

test('tokenizer failure leaves the index intact and a corrected upsert can be retried', () => {
  const failure = new Error('could not tokenize body');
  const fields = [];
  const options = {
    ...definition,
    tokenize(text, field) {
      assert.equal(this, options);
      fields.push(field);
      if (text === 'fail') throw failure;
      if (text === 'invalid') return [1];
      if (text === 'nonarray') return {};
      return text.split(' ');
    },
  };
  const index = new EsmSearch(options);
  index.upsert(documents[0]);
  const before = index.snapshot();
  const replacement = { ...documents[0], title: 'Mortgage rules', text: 'fail' };
  fields.length = 0;
  assert.throws(() => index.upsert(replacement), (error) => error === failure);
  assert.deepEqual(fields, ['title', 'text']);
  assert.deepEqual(index.snapshot(), before);
  for (const text of ['invalid', 'nonarray']) {
    assert.throws(() => index.upsert({ id: 'new', title: 'New document', text }), /array of strings/);
    assert.deepEqual(index.snapshot(), before);
  }

  const restored = EsmSearch.restore(options, before);
  fields.length = 0;
  restored.upsert({ ...replacement, text: 'mortgage' });
  restored.upsert({ id: 'new', text: 'mortgage' });
  assert.deepEqual(fields, ['title', 'text', 'text']);
  const hits = restored.search({ query: 'mortgage', limit: 3, filter: () => true });
  assert.deepEqual(hits.map((hit) => hit.id).sort(), ['new', 'one']);
  assert.equal(fields.at(-1), undefined);
});

test('snapshot fingerprint follows current configuration and rejects other versions', () => {
  const search = new TextSearch(definition);
  documents.forEach((document) => search.upsert(document));
  const current = search.snapshot();
  assert.deepEqual(JSON.parse(current.configurationFingerprint), {
    indexRevision: definition.indexRevision,
    fields: definition.fields,
    storedFields: definition.storedFields,
    boost: definition.boost,
    combineWith: 'OR',
  });
  assert.throws(
    () =>
      TextSearch.restore(definition, {
        version: 1,
        engine: 'minisearch-7',
        schema: current.configurationFingerprint,
        index: current.serializedIndex,
      }),
    /Incompatible/,
  );
  assert.throws(() => TextSearch.restore(definition, { ...current, version: 3 }), /Incompatible/);
});

test('text settings and query filters support class getters and private state', () => {
  class Settings {
    #scope = 'public';
    get indexRevision() {
      return 'class-tokenizer-v1';
    }
    get fields() {
      return ['text'];
    }
    get storedFields() {
      return ['scope'];
    }
    tokenize(value) {
      assert.equal(this.#scope, 'public');
      return Array.from(value);
    }
  }
  class Query {
    #scope = 'public';
    get query() {
      return '材';
    }
    get limit() {
      return 3;
    }
    filter(document) {
      return document.scope === this.#scope;
    }
  }
  const settings = new Settings(),
    search = new TextSearch(settings);
  search.upsert({ id: 'one', text: '材料', scope: 'public' });
  search.upsert({ id: 'private', text: '材料', scope: 'private' });
  assert.deepEqual(
    search.search(new Query()).map((hit) => hit.id),
    ['one'],
  );
  assert.deepEqual(
    TextSearch.restore(settings, search.snapshot())
      .search(new Query())
      .map((hit) => hit.id),
    ['one'],
  );
});

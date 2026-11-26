/*
 * Branch coverage for the declarative catalogs and registries: domain Tools, scopes,
 * commands, knowledge, aggregation, search and the agent catalog.
 *
 * These registries are the app-facing declaration surface, so the cases focus on
 * what a declarant may legitimately omit or customise (error factories, custom
 * predicates, optional fields, keyless aggregation) and on the exact point where
 * a malformed declaration must be refused. Two behaviours are easy to break and
 * are pinned on purpose: registration-time patterns must be stateless even when
 * written as global-flag regexes, and ranking ties must be deterministic.
 *
 * Runs on `dist/esm` with in-memory documents and indexes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { GoalRegistry, ScopeRegistry, defineAgentCatalog } from '../dist/esm/kits/domains/index.js';
import { defineCommand, compileCommands } from '../dist/esm/kits/interaction/command.js';
import { CommandCatalog } from '../dist/esm/kits/interaction/commands.js';
import { defineKnowledgeCatalog } from '../dist/esm/kits/knowledge/catalog.js';
import { compileKnowledgeDocument } from '../dist/esm/kits/knowledge/sections.js';
import { defineQueryAggregation } from '../dist/esm/kits/aggregation.js';
import { TextSearch } from '../dist/esm/kits/search.js';
import { VectorSearch } from '../dist/esm/kits/vector-search.js';
import { reciprocalRankFusion } from '../dist/esm/kits/rank-fusion.js';
const domainTool = { id: 'read', description: 'Read', delegates: ['read'] };
const scope = { id: 'docs', description: 'Docs', category: 'docs' };
test('domain Tool metadata policies retain custom error factories, patterns and optional contracts', () => {
  const invalid = Error('invalid'),
    sealed = Error('sealed'),
    duplicate = Error('duplicate');
  for (const errors of [
    { invalid, sealed, duplicate: () => duplicate },
    { invalid: () => invalid, sealed: () => sealed },
  ]) {
    // The pattern carries the `g` flag, so a shared instance keeps `lastIndex`
    // between checks; repeated registration must still behave identically.
    const registry = new GoalRegistry({ idPattern: /^read$/g, errors });
    registry.register({ ...domainTool, auxiliaryActions: ['extra'] });
    assert.throws(
      () => registry.register(domainTool),
      (error) => error === duplicate || /Duplicate/.test(error.message),
    );
    registry.seal();
    assert.throws(
      () => registry.register({ ...domainTool, id: 'other' }),
      (error) => error === sealed,
    );
  }
  const bare = new GoalRegistry();
  bare.register(domainTool);
  assert.equal(bare.get('missing')?.delegates.includes('read') ?? false, false);
  assert.throws(() => bare.require('missing'));
  assert.equal([...bare.entries()].length, 1);
  assert.throws(() =>
    new GoalRegistry({ idPattern: /^read$/ }).register({ ...domainTool, id: 'other' }),
  );
  const constrained = new GoalRegistry({
    scopeModes: ['required'],
    targetModes: ['none'],
    contextTiers: ['full'],
    actions: ['read'],
    delegates: ['read'],
    handoffValues: ['ready'],
  });
  const valid = {
    ...domainTool,
    scopePolicy: 'required',
    targetPolicy: 'none',
    contextTier: 'full',
    planIntent: 'read',
    auxiliaryActions: ['read'],
    preparedHandoff: 'ready',
  };
  for (const patch of [
    { scopePolicy: 'bad' },
    { targetPolicy: 'bad' },
    { contextTier: 'bad' },
    { auxiliaryActions: [] },
    { auxiliaryActions: ['bad'] },
    { auxiliaryActions: ['read', 'read'] },
    { preparedHandoff: 'bad' },
    { planIntent: 'bad' },
    { delegates: ['bad'] },
  ])
    assert.throws(() => constrained.register({ ...valid, ...patch }));
  constrained.register(valid);
});
test('scope projections handle absent lookups and enforce category, goal, source and tool requirements', () => {
  const registry = new ScopeRegistry();
  registry.register({
    ...scope,
    goalIds: ['read'],
    queryScopeIds: ['query'],
    aliases: ['alias'],
    contextTier: 'full',
  });
  assert.equal(registry.require('alias').id, 'docs');
  assert.throws(() => registry.require('missing'));
  assert.equal(registry.has(null), false);
  assert.equal(registry.acceptsGoal('missing', 'read'), false);
  assert.equal(registry.acceptsQuery(null, 'query'), false);
  assert.equal(registry.acceptsQuery('missing', 'query'), false);
  assert.equal(registry.is(null, 'docs'), false);
  assert.deepEqual(registry.topics(), []);
  assert.deepEqual(registry.evidence(), []);
  assert.equal(registry.contextTier(), undefined);
  assert.deepEqual(registry.queryScopeIds(), ['query']);
  assert.deepEqual(registry.describe([]), []);
  assert.equal(registry.describe(['read']).length, 1);
  assert.equal([...registry.entries()].length, 1);
  const custom = new ScopeRegistry({ acceptsGoal: (_definition, id) => id === 'dynamic' });
  custom.register(scope);
  assert.equal(custom.acceptsGoal('docs', 'dynamic'), true);
  for (const policy of [
    { categories: ['other'] },
    { requireGoals: true },
    { requireSources: true },
    { requireTools: true },
    { idPattern: /^other$/ },
  ])
    assert.throws(() => new ScopeRegistry(policy).register(scope));
  for (const errors of [
    { invalid: Error('invalid'), sealed: Error('sealed') },
    { invalid: () => Error('invalid'), sealed: () => Error('sealed') },
  ]) {
    const restricted = new ScopeRegistry({ errors });
    assert.throws(() => restricted.register({ ...scope, description: '' }));
    restricted.register(scope);
    restricted.seal();
    assert.throws(() => restricted.register(scope));
  }
});
test('command definitions reject wrong categories, checks and field ownership and preserve error receivers', () => {
  assert.throws(() => defineCommand({ category: 'invalid', fields: [] }));
  for (const check of [
    null,
    {},
    { occur: 1 },
    { occur: [1] },
    { occur: () => false, condition: () => false },
  ])
    assert.throws(() => defineCommand({ fields: [], checks: [check] }));
  const failure = Error('invalid');
  const commands = compileCommands({
    one: {
      fields: ['value'],
      error() {
        return failure;
      },
    },
  });
  assert.throws(
    () => commands.one.parse({ unknown: 1 }),
    (error) => error === failure,
  );
  const catalog = new CommandCatalog([['one', defineCommand({ fields: [] })]]);
  assert.throws(() => catalog.set('two', defineCommand({ fields: [] })));
  assert.throws(() => catalog.delete('one'));
  assert.throws(() => catalog.clear());
  // `optionalPresence: 'defined'` keeps an explicitly undefined value, which is
  // different from an omitted field; `additionalProperties` then allows extras.
  const optional = defineCommand({
    fields: { value: {} },
    optionalPresence: 'defined',
    additionalProperties: true,
  });
  assert.deepEqual(optional.parse({ value: undefined }), { value: undefined });
});
test('knowledge reads reject malformed budgets, trees, requests, selections and sections', () => {
  const document = {
    id: 'docs',
    revision: 'one',
    parts: ['text', { id: 'section', parts: ['nested'] }],
  };
  assert.throws(() => defineKnowledgeCatalog([document], { maxChars: 0 }));
  assert.throws(() => defineKnowledgeCatalog([document, document]));
  const catalog = defineKnowledgeCatalog([document]);
  for (const request of [
    null,
    { documentId: 'docs' },
    { documentId: 'docs', selection: { mode: 'bad' } },
    { documentId: 'docs', selection: { mode: 'self', sectionIds: [] } },
    { documentId: 'docs', selection: { mode: 'self', sectionIds: ['section', 'section'] } },
    { documentId: 'docs', selection: { mode: 'self', sectionIds: ['missing'] } },
  ])
    assert.throws(() => catalog.read(request));
  assert.throws(() => catalog.sectionIds('missing'));
  assert.throws(() =>
    catalog.assertSelection({ documentId: 'missing', selection: { mode: 'document' } }),
  );
  for (const parts of [{}, [null], [{ id: '', parts: [] }]])
    assert.throws(() => compileKnowledgeDocument({ ...document, parts }));
});
test('query aggregation, text/vector ranking and fusion retain no-key, replacement and tie paths', () => {
  assert.deepEqual(defineQueryAggregation({ execute: (value) => [value] }).collect([1, 2], {}), {
    total: 2,
    items: [1, 2],
  });
  // A constant key collapses every row into one slot, and the surviving row keeps
  // the position of the first occurrence.
  assert.deepEqual(
    defineQueryAggregation({ execute: (value) => [value], key: () => 'same' }).collect([1, 2], {})
      .items,
    [2],
  );
  const config = { indexRevision: 'one', fields: ['body'], storedFields: [] };
  for (const patch of [{ tokenize: 7 }, { combineWith: 'INVALID' }])
    assert.throws(() => new TextSearch({ ...config, ...patch }));
  const text = new TextSearch({ ...config, tokenize: (value) => value.split(' ') });
  text.upsert({ id: 'one', body: 'before' });
  text.upsert({ id: 'one', body: 'after' });
  assert.equal(text.search({ query: 'after', limit: 1, filter: () => true }).length, 1);
  const vector = new VectorSearch({ identity: 'one', dimensions: 1 });
  vector.upsert({ document: { id: 'b' }, vector: [1] });
  vector.upsert({ document: { id: 'a' }, vector: [1] });
  // Equal scores must not depend on insertion order: insertion was b then a, and
  // the tie is resolved to ['a', 'b'].
  assert.deepEqual(
    vector.search({ vector: [1], limit: 2, minScore: 0, filter: () => true }).map((hit) => hit.id),
    ['a', 'b'],
  );
  for (const minScore of [-2, 2, NaN])
    assert.throws(() => vector.search({ vector: [1], limit: 1, minScore, filter: () => true }));
  assert.deepEqual(
    reciprocalRankFusion(
      [
        { sourceId: 'one', ids: ['b', 'a'] },
        { sourceId: 'two', ids: ['a', 'b'] },
      ],
      { limit: 2 },
    ).map((hit) => hit.id),
    ['a', 'b'],
  );
});
test('agent catalogs retain task narrowing, optional availability and dynamic definition fallback', () => {
  const tools = [
    { id: 'all', goalIds: 'all', lifecycle: { call() {} } },
    {
      id: 'conditional',
      goalIds: ['read'],
      lifecycle: { call() {} },
      active: () => false,
    },
  ];
  const ports = {
    goalIds: () => ['read'],
    goals: () => [domainTool],
    scopes: () => [{ ...scope, toolIds: ['all', 'missing'] }],
    currentTask: () => ({ goalId: 'read' }),
    tools: {
      values: () => tools.values(),
      has: (id) => id === 'all',
      supportsGoal: () => true,
      describe: () => [{ id: 'all', goalIds: ['read'] }],
    },
  };
  const catalog = defineAgentCatalog(ports);
  // Without a selection context the declaration list is returned as declared,
  // including a tool whose `available` returns false; a call with context filters
  // by availability.
  assert.deepEqual(catalog.goalDelegates().get('read'), ['read']);
  assert.deepEqual(catalog.goalDelegates({}).get('read'), ['read']);
  const model = catalog.modelCatalog({});
  assert.deepEqual(model.availableGoals[0].scopeIds, []);
  assert.deepEqual(model.availableScopes, []);
  assert.equal(
    defineAgentCatalog({ ...ports, restrictToTask: false }).modelCatalog({}).availableScopes.length,
    1,
  );
  const dynamic = defineAgentCatalog({
    ...ports,
    goals: (selected) => (selected ? [domainTool] : []),
  });
  assert.deepEqual(dynamic.goalCatalog({})[0].delegates, ['read']);
});

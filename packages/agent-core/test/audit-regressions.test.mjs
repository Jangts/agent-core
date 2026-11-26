/*
 * Regression suite for defect classes found by a code audit: budget/character
 * accounting, accidental O(n^2) work, prototype pollution, asynchronous
 * callbacks slipping past synchronous contracts, cancellation with late values,
 * path traversal in Skill loading and sealed registries leaking state.
 *
 * Each case reproduces the original failure shape, so a rewrite that reintroduces
 * the bug fails here even if the public API still looks fine. Several cases patch
 * `JSON.stringify` or `globalThis.structuredClone` temporarily to count work
 * rather than assert on timing.
 *
 * Runs on the built `dist/esm` modules with local fakes only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Support, ModelRunner, ModelToolRegistry } from '../dist/esm/index.js';
import { contextReductionCatalog } from '../dist/esm/support/context/processing.js';
import { defineCommand } from '../dist/esm/kits/interaction/command.js';
import { parseJsonFrames, scanJsonObjectFrames } from '../dist/esm/support/transport/json.js';
import { definePolicySet, defineRecoveryChain } from '../dist/esm/kits/policies.js';
import { defineEvidenceChecklist } from '../dist/esm/kits/evidence.js';
import { defineTextSkillLoader } from '../dist/esm/kits/text-skills.js';
import { retryMultipleModelCalls } from '../dist/esm/model/decision-retry.js';
import { ValidationError } from '../dist/esm/structs/errors.js';
import { commonPrefixLength } from '../dist/esm/utils/text.js';
import { auditContextChange } from '../dist/esm/context/audit.js';

test('context audit treats null as an empty field set in both rewrite directions', () => {
  const entry = { id: 'facts', role: 'user', trust: 'data' };
  const mutable = new Set(['facts']);
  for (const [before, after] of [[null, {}], [{}, null]]) {
    assert.doesNotThrow(() => auditContextChange([{ ...entry, value: before }],
      [{ ...entry, value: after }], mutable));
  }
  assert.throws(() => auditContextChange([{ ...entry, value: null }], [{ ...entry, value: { added: true } }], mutable),
    error => error.issues.some(issue => issue.message === 'Context fields must be preserved'));
});

test('JSON frame character limits validate bounds and apply to each frame', () => {
  const limits = { maxFrames: 2, maxExtraClosings: 0 };
  for (const maxFrameChars of [0, 1.5]) {
    assert.throws(() => parseJsonFrames('{}', { ...limits, maxFrameChars }), /Invalid JSON frame limits/);
  }
  assert.deepEqual(parseJsonFrames('{} {}', { ...limits, maxFrameChars: 2 }), [{}, {}]);
  assert.throws(() => parseJsonFrames('{"x":1}', { ...limits, maxFrameChars: 6 }), /JSON frame size exceeded/);
});

test('linear history trimming preserves exact JSON budgets, complete turns and unrelated fields', async () => {
  // Content mixes quotes, a backslash, a newline and multi-byte characters, so
  // byte counts and character budgets disagree and escaping must stay exact.
  const entries = Array.from({ length: 120 }, (_, index) => ({
    role: index % 3 === 0 ? 'user' : 'assistant',
    content: `item-${index}:"\\\n🙂中`,
  }));
  for (const grouping of [{ kind: 'fixed', size: 3 }, { kind: 'user-turn' }])
    for (const keepGroups of [0, 1, 40]) {
      const groups = Array.from({ length: 40 }, (_, index) =>
        entries.slice(index * 3, index * 3 + 3),
      );
      const record = { before: '"', history: entries, after: '🙂' };
      // Targets sit on the hard boundaries: the empty-history floor, a mid-range
      // value, and the untrimmed length where nothing may be removed.
      for (const targetChars of [
        1,
        JSON.stringify({ ...record, history: [] }).length,
        300,
        JSON.stringify(record).length,
      ]) {
        const retained = [...groups];
        while (
          retained.length > keepGroups &&
          JSON.stringify({ ...record, history: retained.flat() }).length > targetChars
        )
          retained.shift();
        const fragment = { value: record };
        const value = await contextReductionCatalog.trim.run({
          step: { kind: 'trim', field: 'history', grouping, targetChars, keepGroups },
          fragment,
        });
        assert.deepEqual(value, { ...record, history: retained.flat() });
        assert.equal(record.history, entries);
      }
    }
});

test('history trimming does not serialize the whole remaining history per removed group', async () => {
  const history = Array.from({ length: 3000 }, (_, index) => ({
    role: 'user',
    content: String(index),
  }));
  const stringify = JSON.stringify;
  let fullReads = 0;
  // Each removed group must not re-serialize the whole remaining history; counting
  // full-history stringify calls keeps the trim loop linear.
  JSON.stringify = function (value, ...args) {
    if (value?.history?.length > 100) fullReads++;
    return stringify(value, ...args);
  };
  try {
    const value = await contextReductionCatalog.trim.run({
      fragment: { value: { history } },
      step: {
        kind: 'trim',
        field: 'history',
        grouping: { kind: 'user-turn' },
        targetChars: 80,
        keepGroups: 1,
      },
    });
    assert.ok(value.history.length < 3);
    assert.ok(
      fullReads <= 1,
      'whole-history serialization must remain bounded independently of removed groups',
    );
  } finally {
    JSON.stringify = stringify;
  }
});

test('prepared schema size is reused without trusting mutable unprepared inputs', () => {
  const runner = new ModelRunner({
    provider: {
      async *stream() {
        yield 'ok';
      },
    },
    transports: [
      {
        id: 'schema',
        prepare() {
          return {
            options: {
              functions: [
                {
                  name: 'answer',
                  parameters: { type: 'object', description: 'schema'.repeat(1000) },
                },
              ],
            },
            schemaChars: 1,
            createResponse() {
              return { outputChars: 0, push() {}, finish() {} };
            },
          };
        },
      },
    ],
  });
  const prepared = runner.prepare({ transport: 'schema' });
  const stringify = JSON.stringify;
  let schemaReads = 0;
  JSON.stringify = function (value, ...args) {
    if (Array.isArray(value) && value[0]?.name === 'answer') schemaReads++;
    return stringify(value, ...args);
  };
  // Re-measuring must reuse the prepared schema size; `schemaReads === 0` below
  // proves the mutable parameters were never serialized again.
  try {
    for (let i = 0; i < 100; i++) assert.ok(prepared.measure('question').schemaChars > 6000);
  } finally {
    JSON.stringify = stringify;
  }
  assert.equal(schemaReads, 0);
});

test('JSON framing enforces its frame limit before parsing further untrusted frames', () => {
  // Braces inside a JSON string do not delimit frames.
  assert.deepEqual(scanJsonObjectFrames('prefix {"x":"}"} suffix {}'), ['{"x":"}"}', '{}']);
  // The frame limit is enforced before any further untrusted text is parsed.
  assert.throws(
    () => parseJsonFrames('{} {invalid}', { maxFrames: 1, maxExtraClosings: 0 }),
    /frame limit/,
  );
  // A `__proto__` key must survive as an own data property: the parser may not
  // drop it, and it must not reach `Object.prototype`.
  assert.deepEqual(
    parseJsonFrames('{"__proto__":{"polluted":true}}', { maxFrames: 1, maxExtraClosings: 0 })[0]
      .__proto__,
    { polluted: true },
  );
  assert.equal({}.polluted, undefined);
  const command = defineCommand({ fields: [], ownedFields: ['__proto__'] });
  assert.ok(Object.hasOwn(command.fieldSchemas, '__proto__'));
  assert.deepEqual(
    command.parse(JSON.parse('{"__proto__":"data"}')),
    JSON.parse('{"__proto__":"data"}'),
  );
});

test('mandatory policies accumulate reasons and preserve receiver, async and declaration boundaries', () => {
  class Policy {
    id = 'required';
    description = 'Mandatory review';
    kind = 'review';
    when(input) {
      return input === this.id;
    }
  }
  const set = definePolicySet([
    new Policy(),
    { id: 'second', description: 'Second reason', kind: 'review', when: () => true },
  ]);
  assert.deepEqual(set.assess('required'), {
    required: true,
    reasons: ['required', 'second'],
    kinds: ['review'],
  });
  assert.deepEqual(definePolicySet([]).assess(null), { required: false, reasons: [], kinds: [] });
  assert.throws(() => set.require('missing'), /Unknown policy/);
  for (const definitions of [
    [new Policy(), new Policy()],
    [{ id: '', description: 'x', kind: 'x', when: () => true }],
  ])
    assert.throws(() => definePolicySet(definitions));
  for (const when of [
    () => 'yes',
    async () => {
      throw new Error('late');
    },
  ])
    assert.throws(() =>
      definePolicySet([{ id: 'invalid', description: 'Invalid', kind: 'x', when }]).assess(null),
    );
});

test('recovery is ordered, distinguishes handled undefined and rejects invalid/async outcomes', () => {
  const calls = [];
  const chain = defineRecoveryChain([
    {
      id: 'skip',
      description: 'Skip',
      tryRecover() {
        calls.push('skip');
        return { handled: false };
      },
    },
    {
      id: 'done',
      description: 'Done',
      tryRecover() {
        calls.push(this.id);
        return { handled: true, value: undefined };
      },
    },
    {
      id: 'late',
      description: 'Late',
      tryRecover() {
        assert.fail('must stop');
      },
    },
  ]);
  assert.deepEqual(chain.tryRecover(null), { handled: true, value: undefined });
  assert.deepEqual(calls, ['skip', 'done']);
  assert.deepEqual(defineRecoveryChain([]).tryRecover(null), { handled: false });
  assert.throws(() => chain.require('unknown'), /Unknown recovery/);
  for (const value of [null, {}, { handled: true }, { handled: 1 }])
    assert.throws(() =>
      defineRecoveryChain([{ id: 'bad', description: 'Bad', tryRecover: () => value }]).tryRecover(
        null,
      ),
    );
  assert.throws(() =>
    defineRecoveryChain([
      {
        id: 'bad',
        description: 'Bad',
        tryRecover: async () => {
          throw new Error('late');
        },
      },
    ]).tryRecover(null),
  );
});

test('evidence completion uses real observations and rejects unknown, duplicate and asynchronous providers', () => {
  class Provider {
    kind = 'receipt';
    description = 'Actual receipt';
    isSatisfied(value, requirement) {
      return value.kind === this.kind && value.id === requirement.id;
    }
  }
  const checklist = defineEvidenceChecklist([new Provider()]);
  const observations = [{ kind: 'receipt', id: 'one' }],
    requirements = [
      { kind: 'receipt', id: 'one' },
      { kind: 'receipt', id: 'two' },
    ];
  assert.equal(checklist.isSatisfied({ observations, requirement: requirements[0] }), true);
  assert.equal(checklist.isComplete({ observations, requirements }), false);
  assert.deepEqual(checklist.missing({ observations, requirements }), [requirements[1]]);
  assert.throws(
    () => checklist.isComplete({ observations: [], requirements: [{ kind: 'unknown' }] }),
    /Unknown evidence/,
  );
  assert.throws(() => defineEvidenceChecklist([new Provider(), new Provider()]), /Duplicate/);
  assert.throws(() => defineEvidenceChecklist([{ kind: 'missing' }]), /Missing evidence/);
  for (const isSatisfied of [
    () => 1,
    async () => {
      throw new Error('late');
    },
  ])
    assert.throws(() =>
      defineEvidenceChecklist([{ kind: 'bad', isSatisfied }]).isSatisfied({
        observations: [{}],
        requirement: { kind: 'bad' },
      }),
    );
});

test('text Skill loader validates paths, headers, tool lists and budgets before exposing instructions', () => {
  const loader = defineTextSkillLoader({ maxInstructionChars: 100, maxDescriptionChars: 20 });
  const entry = { id: 'read', entry: 'read/SKILL.md', kind: 'text-workflow', toolIds: ['lookup'] };
  const document = '---\nname: read\ndescription: Reading\n---\nText instructions';
  const ports = {
    read(path) {
      assert.equal(path, entry.entry);
      return document;
    },
  };
  const result = loader.load({ entries: [entry] }, ports);
  assert.equal(result[0].description, 'Reading');
  assert.ok(Object.isFrozen(result[0].toolIds));
  for (const limits of [
    { maxInstructionChars: 0, maxDescriptionChars: 10 },
    { maxInstructionChars: 1.5, maxDescriptionChars: 10 },
  ])
    assert.throws(() => defineTextSkillLoader(limits));
  assert.throws(() => loader.load(null, ports));
  assert.throws(() => loader.load({ entries: {} }, ports));
  for (const raw of [
    null,
    [],
    { ...entry, id: '../escape' },
    { ...entry, entry: '../SKILL.md' },
    { ...entry, kind: 'code' },
    { ...entry, toolIds: ['x', 'x'] },
    { ...entry, toolIds: [1] },
    { ...entry, toolIds: null },
  ]) {
    let reads = 0;
    assert.throws(() =>
      loader.load(
        { entries: [raw] },
        {
          read() {
            reads++;
            return document;
          },
        },
      ),
    );
    // Rejected entries fail validation before the reader is ever called, so a bad
    // entry can neither read outside its directory nor surprise the caller.
    assert.equal(reads, 0);
  }
  assert.throws(() => loader.load({ entries: [entry, entry] }, ports));
  for (const text of [
    'plain',
    document.replace('name: read', 'name: other'),
    document.replace('Reading', 'x'.repeat(21)),
    document + 'x'.repeat(100),
  ])
    assert.throws(() => loader.load({ entries: [entry] }, { read: () => text }));
  assert.throws(() =>
    loader.load(
      { entries: [entry] },
      {
        read: async () => {
          throw new Error('late');
        },
      },
    ),
  );
  assert.throws(() =>
    defineTextSkillLoader({
      maxInstructionChars: 100,
      maxDescriptionChars: 20,
      parseHeader: async () => {
        throw new Error('late');
      },
    }).load({ entries: [entry] }, ports),
  );
});

test('retry only retries parallel call rejections and preserves original/fallback failures', async () => {
  assert.equal(
    await retryMultipleModelCalls({
      invoke: async () => 7,
      retry() {
        assert.fail();
      },
    }),
    7,
  );
  const ordinary = new Error('original');
  await assert.rejects(
    retryMultipleModelCalls({
      invoke: async () => {
        throw ordinary;
      },
      retry() {
        assert.fail();
      },
    }),
    (error) => error === ordinary,
  );
  // Only the "multiple parallel calls" validation failure is retryable; every other
  // rejection is propagated with its original identity.
  const parallel = new ValidationError([{ code: 'MODEL_MULTIPLE_CALLS', message: 'multiple' }]);
  assert.equal(
    await retryMultipleModelCalls({
      invoke: async () => {
        throw parallel;
      },
      retry: async (error) => {
        assert.equal(error, parallel);
        return 8;
      },
    }),
    8,
  );
  await assert.rejects(
    retryMultipleModelCalls({
      invoke: async () => {
        throw parallel;
      },
      retry: async () => {
        throw ordinary;
      },
    }),
    (error) => error === ordinary,
  );
});

test('shared prefix measurement handles long, unequal, Unicode and empty inputs', () => {
  for (const [left, right, expected] of [
    ['', 'x', 0],
    ['same', 'same', 4],
    ['abc', 'ab', 2],
    ['🙂x', '🙂y', 2],
    ['a'.repeat(30000) + 'x', 'a'.repeat(30000) + 'y', 30000],
  ])
    assert.equal(commonPrefixLength(left, right), expected);
});

test('context assembly pins handlers, transforms all text and rejects async budgets and factories', () => {
  const fragment = (id, value) => ({
    id,
    value,
    sourceId: 'test',
    trust: 'user',
    role: 'user',
    lifetime: 'turn',
    maxChars: 100,
  });
  const definitions = [
    { kind: 'fragment', id: 'question', format: (input) => ({ question: input }) },
    { kind: 'contributions', placement: 'extra' },
  ];
  const builder = Support.defineContextAssembly(definitions, {
    fragment,
    contributions: {
      extra() {
        return [fragment('extra', { extra: 'more' })];
      },
    },
    maxInputChars: () => 200,
    transform: (value) => Support.transformContextText(value, (text) => text.toUpperCase()),
  });
  const context = builder.build({ input: 'hello' });
  assert.deepEqual(JSON.parse(context.messages[1].content), { question: 'HELLO', extra: 'MORE' });
  assert.equal(builder.plan({ input: 'hello' }).maxInputChars, 200);
  assert.throws(() =>
    Support.defineContextAssembly([definitions[0], definitions[0]], { fragment }),
  );
  assert.throws(() =>
    Support.defineContextAssembly([{ kind: 'fragment', id: 'missing' }], { fragment }),
  );
  assert.throws(() =>
    Support.defineContextAssembly([definitions[1]], { fragment, contributions: {} }),
  );
  assert.throws(() =>
    Support.defineContextAssembly([definitions[0]], {
      fragment,
      maxInputChars: async () => {
        throw new Error('late');
      },
    }).build({ input: 'x' }),
  );
  assert.throws(() =>
    Support.defineContextAssembly([definitions[0]], {
      fragment: async () => {
        throw new Error('late');
      },
      maxInputChars: 200,
    }).build({ input: 'x' }),
  );
  assert.equal(
    Support.transformContextText({ value: 'plain' }, (text) => text + '!').value,
    'plain!',
  );
});

test('oversized Skills never enter a header parser and asynchronous entry selectors are observed', () => {
  const entry = { id: 'read', entry: 'read/SKILL.md', kind: 'text-workflow', toolIds: [] };
  let parsed = 0;
  const settings = {
    maxInstructionChars: 10,
    maxDescriptionChars: 20,
    parseHeader() {
      parsed++;
      return { id: 'read', description: 'Read' };
    },
  };
  const loader = defineTextSkillLoader(settings);
  for (const content of ['x'.repeat(11), null, {}])
    assert.throws(() => loader.load({ entries: [entry] }, { read: () => content }));
  assert.equal(parsed, 0);
  const asyncLoader = defineTextSkillLoader({
    ...settings,
    entryFor: async () => {
      throw new Error('late');
    },
  });
  assert.throws(() =>
    asyncLoader.load(
      { entries: [entry] },
      {
        read() {
          assert.fail('must not read');
        },
      },
    ),
  );
});

test('capability lookup helpers preserve sealed registration and unknown-ID failures', () => {
  const registry = new ModelToolRegistry([
    {
      id: 'one',
      description: 'One',
      inputSchema: { jsonSchema: { type: 'object' }, parse: (value) => value },
      resolve: (value) => value,
    },
  ]);
  assert.equal(registry.has('one'), true);
  assert.equal(registry.has('missing'), false);
  assert.equal(registry.get('one'), registry.require('one'));
  assert.equal([...registry.entries()].length, 1);
  assert.throws(() => registry.require('missing'));
  assert.equal(registry.seal(), registry);
  const clone = globalThis.structuredClone;
  let clones = 0;
  globalThis.structuredClone = (...args) => {
    clones++;
    return clone(...args);
  };
  try {
    for (let i = 0; i < 100; i++) {
      const selected = registry.select(['one']);
      assert.deepEqual(
        selected.resolve({ toolId: 'one', input: { value: i } }, { stageId: 'test' }),
        { value: i },
      );
      assert.ok(Object.isFrozen(selected.get('one').inputSchema.jsonSchema));
      assert.throws(() => selected.register(registry.get('one')), /sealed/);
    }
  } finally {
    globalThis.structuredClone = clone;
  }
  // Schemas are sealed and frozen at registration, so repeated selection neither
  // clones them nor allows a caller to mutate a shared definition.
  assert.equal(clones, 0);
});

test('async answer readers respect cancellation and never deliver a late value', async () => {
  const { defineAnswerTaskCatalog, defineAnswerReaderCatalog } =
    await import('../dist/esm/kits/answering/tasks.js');
  const create = (read) =>
    defineAnswerTaskCatalog(
      [
        {
          id: 'read',
          description: 'Read',
          readerId: 'source',
          outputId: 'text',
          checkIds: [],
          goalIds: ['read'],
          inputSchema: { jsonSchema: {}, parse: (value) => value },
        },
      ],
      {
        readers: defineAnswerReaderCatalog([{ id: 'source', read }]),
        outputs: { ids: () => ['text'] },
        checks: { ids: () => [] },
      },
    );
  assert.equal(
    await create(async () => 'actual').readAsync(
      { taskId: 'read', input: {} },
      { app: {}, signal: new AbortController().signal },
    ),
    'actual',
  );
  const controller = new AbortController(),
    reason = new Error('stop');
  let release;
  const pending = create(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  ).readAsync({ taskId: 'read', input: {} }, { app: {}, signal: controller.signal });
  controller.abort(reason);
  await assert.rejects(pending, (error) => error === reason);
  release('late');
});

test('ESM retrieval preserves validation, authorization, budget, receipts and ordered effects', async () => {
  const { defineRetrieval, retrievalQueryKey } = await import('../dist/esm/kits/retrieval.js');
  const state = { queryCount: 0, seen: new Set(), sources: [] },
    effects = [];
  const definition = {
    id: 'read',
    description: 'Read',
    state: ({ app }) => app,
    limit: () => 1,
    assertInput() {},
    authorize() {},
    execute: (query) => ({ sources: [{ sourceId: query.id }] }),
    effects: [
      {
        id: 'receipt',
        description: 'Receipt',
        handle: (receipt) => {
          effects.push(receipt.result.sources[0].sourceId);
        },
      },
    ],
  };
  const context = { app: state, signal: new AbortController().signal },
    reader = defineRetrieval(definition);
  const result = reader.run({ id: 'source' }, context);
  assert.equal(result.sequence, 1);
  assert.deepEqual(effects, ['read:q1:source']);
  // The same query cannot run twice (it is already recorded in state), and the
  // `limit` of 1 rejects a second distinct query as an exhausted budget.
  assert.throws(() => reader.run({ id: 'source' }, context), /already attempted/);
  assert.throws(() => reader.run({ id: 'other' }, context), /budget exhausted/);
  assert.throws(() =>
    defineRetrieval({ ...definition, effects: [definition.effects[0], definition.effects[0]] }),
  );
  assert.throws(() => defineRetrieval({ ...definition, id: '' }));
  assert.equal(retrievalQueryKey({ b: [1], a: 2 }), retrievalQueryKey({ a: 2, b: [1] }));
  assert.throws(() => retrievalQueryKey(undefined));
  const denied = defineRetrieval({
    ...definition,
    authorize() {
      throw new Error('denied');
    },
  });
  const empty = { queryCount: 0, seen: new Set(), sources: [] };
  assert.throws(() => denied.run({ id: 'source' }, { ...context, app: empty }), /denied/);
  assert.equal(empty.seen.size, 0);
});

test('ESM search removal vacuums stale entries and vector clear releases its corpus', async () => {
  const { TextSearch } = await import('../dist/esm/kits/search.js');
  const { VectorSearch } = await import('../dist/esm/kits/vector-search.js');
  const search = new TextSearch({
    indexRevision: 'audit',
    fields: ['body'],
    storedFields: ['body'],
  });
  search.upsert({ id: 'one', body: 'unique term' });
  assert.equal(await search.remove('one'), true);
  assert.equal(await search.remove('one'), false);
  assert.deepEqual(search.search({ query: 'unique', limit: 1, filter: () => true }), []);
  await assert.rejects(search.remove(''), /Invalid/);
  search.clear();
  const vectors = new VectorSearch({ identity: 'audit', dimensions: 2 });
  vectors.upsert({ document: { id: 'one' }, vector: [1, 0] });
  vectors.clear();
  assert.deepEqual(vectors.search({ vector: [1, 0], limit: 1, filter: () => true }), []);
});

test('reply preview paths are resolved per string and malformed or over-budget drafts are retracted', async () => {
  const events = [],
    preview = Support.createReplyPreview({
      rules: [{ toolId: 'answer' }],
      sink: (value) => {
        events.push(value);
      },
    });
  const start = () =>
    preview({ invocationId: 'call', type: 'model.start', payload: { stageId: 'reply' } });
  const send = (argumentsText, name) =>
    preview({
      invocationId: 'call',
      type: 'model.output',
      payload: {
        stageId: 'reply',
        part: {
          type: 'function-call-delta',
          index: 0,
          ...(name ? { name } : {}),
          arguments: argumentsText,
        },
      },
    });
  await start();
  const stringify = JSON.stringify;
  let pathReads = 0;
  JSON.stringify = function (value, ...args) {
    if (Array.isArray(value) && value.length === 1 && value[0] === 'text') pathReads++;
    return stringify(value, ...args);
  };
  try {
    await send('{"text":"' + 'x'.repeat(6000) + '"}', 'answer');
  } finally {
    JSON.stringify = stringify;
  }
  assert.ok(pathReads <= 3);
  assert.equal(events.at(-1)[0].length, 6000);
  for (const raw of [
    '{"number":true,"list":[null,3],"text":"ok"}',
    '{"text":"bad\\q"}',
    '{"text":"bad\\uZZZZ"}',
    '{"text":"a","text":"b"}',
    '{"text" "bad"}',
    '{"text":"x"]',
    '{"text":"x"},',
    '{"text":' + '['.repeat(34),
  ]) {
    await start();
    await send(raw, 'answer');
    if (raw.startsWith('{"number"')) assert.deepEqual(events.at(-1), ['ok']);
    else assert.deepEqual(events.at(-1), []);
  }
  await start();
  await send('{"text":"draft', 'answer');
  await send('hidden', 'suffix');
  assert.deepEqual(events.at(-1), []);
  await start();
  await send('x'.repeat(16001), 'answer');
  assert.deepEqual(events.at(-1), []);
});

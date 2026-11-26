// Locks the knowledge, presentation and answering kits together: document parsing and selection,
// declarative output ownership, task compilation and batch repair, without leaking Kit events.
// Covers dist/esm kits (knowledge, presentation, answering) plus `createDiagnostics`; `node --test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createDiagnostics } from '../dist/esm/diagnostics/index.js';
import {
  parseKnowledgeDocument,
  defineKnowledgeCatalog,
} from '../dist/esm/kits/knowledge/index.js';
import {
  defineOutputCatalog,
  selectVariant,
  resolvePreference,
} from '../dist/esm/kits/presentation/index.js';
import {
  defineAnswerTaskCatalog,
  defineAnswerReaderCatalog,
  defineAnswerCheckCatalog,
  defineAnswerFlow,
  validateAnswerBatch,
} from '../dist/esm/kits/answering/index.js';
// Convenience item with a stable id and source status for batch flows.
const input = (id, data = id, source = 'ready') => ({
  id,
  inputIds: [id],
  data,
  sourceStatus: source,
});
const execution = (signal = new AbortController().signal, app = undefined) => ({ signal, app });

test('knowledge catalog rejects a missing request before selecting content', () => {
  const catalog = defineKnowledgeCatalog([]);
  assert.throws(() => catalog.assertSelection(null), /Invalid knowledge request/);
  assert.throws(() => catalog.read(null, execution()), /Invalid knowledge request/);
  assert.throws(() => catalog.read({}, execution()), /Unknown knowledge document/);
});
// Default flow ports; each test overrides only the behavior it probes.
const base = (overrides) => ({
  maxItems: 4,
  maxRepairs: 1,
  canInvoke: () => true,
  generate: async ({ items }) => new Map(items.map((item) => [item.id, 'value-' + item.id])),
  check: ({ value }) => ({ status: 'passed', value, issues: [] }),
  fallback: ({ item }) => ({ handled: true, value: 'source-' + item.id }),
  ...overrides,
});

test('document contract preserves parent self/subtree order, strips anchors, freezes snapshots and rejects invalid references', () => {
  // Nested sections let `self` and `subtree` selection be distinguished by markers.
  const parsed = parseKnowledgeDocument({
    id: 'manual',
    revision: 'r1',
    text: 'Title\n<!-- agent-section:install -->\nBefore\n<!-- agent-section:limits -->\nLimits\n<!-- /agent-section:limits -->\nAfter\n<!-- /agent-section:install -->\nEnd',
  });
  const catalog = defineKnowledgeCatalog([parsed]);
  const self = catalog.read({
    documentId: 'manual',
    selection: { mode: 'self', sectionIds: ['install'] },
  });
  assert.match(self.content, /Before/);
  assert.match(self.content, /After/);
  assert.doesNotMatch(self.content, /Limits|agent-section/);
  const tree = catalog.read({
    documentId: 'manual',
    selection: { mode: 'subtree', sectionIds: ['install'] },
  });
  assert.ok(tree.content.indexOf('Before') < tree.content.indexOf('Limits'));
  assert.ok(tree.content.indexOf('Limits') < tree.content.indexOf('After'));
  assert.match(
    catalog.read({ documentId: 'manual', selection: { mode: 'document' } }).content,
    /End/,
  );
  // The catalog snapshots parts, so mutating the parsed source must not change reads.
  parsed.parts.splice(0);
  assert.match(
    catalog.read({ documentId: 'manual', selection: { mode: 'self', sectionIds: ['limits'] } })
      .content,
    /Limits/,
  );
  assert.ok(Object.isFrozen(self));
  assert.ok(Object.isFrozen(self.selection.sectionIds));
  assert.throws(() =>
    catalog.read({ documentId: 'manual', selection: { mode: 'self', sectionIds: ['absent'] } }),
  );
  assert.throws(() =>
    parseKnowledgeDocument({ id: 'a', revision: '1', text: '<!-- agent-section:open -->' }),
  );
  assert.throws(() =>
    parseKnowledgeDocument({ id: 'a', revision: '1', text: '<!-- /agent-section:foreign -->' }),
  );
  assert.throws(() =>
    defineKnowledgeCatalog([
      {
        id: 'a',
        revision: '1',
        parts: [
          { id: 'x', parts: [] },
          { id: 'x', parts: [] },
        ],
      },
    ]),
  );
  const limited = defineKnowledgeCatalog([{ id: 'a', revision: '1', parts: ['too big'] }], {
    maxChars: 2,
  });
  assert.throws(
    () => limited.read({ documentId: 'a', selection: { mode: 'document' } }),
    RangeError,
  );
});

test('a structured source adapter is accepted without the bundled text parser', () => {
  const catalog = defineKnowledgeCatalog([
    {
      id: 'policy',
      revision: 'current',
      parts: [{ id: 'eligible', parts: ['Approved source text'] }],
    },
  ]);
  assert.equal(
    catalog.read({ documentId: 'policy', selection: { mode: 'self', sectionIds: ['eligible'] } })
      .content,
    'Approved source text',
  );
});

test('output ownership drives model schema, real binding, single master substitution and partial inspection', () => {
  const definitions = [
    {
      id: 'answer',
      kind: 'master',
      master: '{{owner}}\n{{body}}',
      fields: [
        { id: 'owner', owner: 'bound', providerId: 'owner' },
        { id: 'body', owner: 'generated' },
      ],
    },
  ];
  const output = defineOutputCatalog(definitions, {
    providers: [{ id: 'owner', resolve: (_input, { app }) => app.owner }],
  });
  assert.deepEqual(Object.keys(output.toModelSchema('answer').properties), ['body']);
  assert.ok(
    output
      .check({ outputId: 'answer', value: { owner: 'forged', body: 'real' } })
      .issues.some((issue) => issue.code === 'OUTPUT_FOREIGN_FIELD'),
  );
  assert.equal(
    output.check({ outputId: 'answer', value: { body: 'valid', other: 'bad' } }).value.body,
    'valid',
  );
  const value = output.compose(
    { outputId: 'answer', input: { generated: { body: '{{owner}} remains text' } } },
    execution(undefined, { owner: 'private-bound' }),
  ).value;
  // Substitution is single-pass: a marker inside generated text stays literal.
  assert.equal(value, 'private-bound\n{{owner}} remains text');
  definitions[0].master = 'changed';
  assert.equal(
    output.compose(
      { outputId: 'answer', input: { generated: { body: 'x' } } },
      execution(undefined, { owner: 'y' }),
    ).value,
    'y\nx',
  );
  assert.throws(() =>
    output.compose(
      { outputId: 'answer', input: { generated: { body: 'x', owner: 'forged' } } },
      execution(undefined, { owner: 'real' }),
    ),
  );
  assert.throws(() =>
    defineOutputCatalog([
      {
        id: 'bad',
        kind: 'master',
        master: '{{absent}}',
        fields: [{ id: 'body', owner: 'generated' }],
      },
    ]),
  );
});

test('records, groups and private semantic values compose through the same output interface', () => {
  let resolved = 0;
  const output = defineOutputCatalog(
    [
      {
        id: 'reply',
        kind: 'record',
        fields: [
          { id: 'text', owner: 'generated' },
          {
            id: 'name',
            owner: 'semantic',
            semanticKeys: ['friendly'],
            required: false,
            providerId: 'private-name',
          },
          { id: 'kind', owner: 'constant', constantValue: 'reply' },
        ],
      },
      { id: 'batch', kind: 'group', allowedOutputIds: ['reply'], maxItems: 2 },
    ],
    {
      providers: [
        {
          id: 'private-name',
          resolve: () => {
            resolved++;
            return 'private real name';
          },
        },
      ],
    },
  );
  assert.doesNotMatch(JSON.stringify(output.toModelSchema('reply')), /private real name/);
  const plain = output.compose(
    { outputId: 'reply', input: { generated: { text: 'hello' } } },
    execution(undefined, null),
  );
  assert.equal(resolved, 0);
  // Optional semantic fields do not resolve their provider unless requested.
  assert.equal(plain.value.kind, 'reply');
  assert.equal(Object.hasOwn(plain.value, 'name'), false);
  const grouped = output.compose(
    {
      outputId: 'batch',
      input: {
        items: [
          {
            id: 'first',
            outputId: 'reply',
            input: { generated: { text: 'hello', name: 'friendly' } },
          },
        ],
      },
    },
    execution(undefined, null),
  );
  assert.equal(grouped.value[0].value.name, 'private real name');
  assert.equal(resolved, 1);
  assert.throws(() =>
    output.compose(
      { outputId: 'batch', input: { items: [{ id: 'first', outputId: 'foreign', input: {} }] } },
      execution(undefined, null),
    ),
  );
  assert.throws(() =>
    defineOutputCatalog([{ id: 'cycle', kind: 'group', maxItems: 1, allowedOutputIds: ['cycle'] }]),
  );
});

test('task compilation checks readers, outputs and checks; normalized data from any adapter can be scheduled', () => {
  const output = defineOutputCatalog([
    { id: 'text', kind: 'text', fields: [{ id: 'body', owner: 'generated' }] },
  ]);
  const definitions = [
    {
      id: 'explain',
      description: 'Explain a manual',
      readerId: 'manual',
      outputId: 'text',
      checkIds: ['accuracy'],
      goalIds: ['explain'],
      inputSchema: {
        jsonSchema: { type: 'object' },
        parse: (value) => {
          if (!value.section) throw new TypeError('missing section');
          return value;
        },
      },
      metadata: { version: 1 },
    },
  ];
  const ports = {
    outputs: output,
    checks: defineAnswerCheckCatalog([
      { id: 'accuracy', check: (value) => ({ status: 'passed', value, issues: [] }) },
    ]),
    readers: defineAnswerReaderCatalog([
      { id: 'manual', read: (parameters, { app }) => app[parameters.section] },
    ]),
  };
  const catalog = defineAnswerTaskCatalog(definitions, ports);
  assert.equal(
    catalog.read(
      { taskId: 'explain', input: { section: 'intro' } },
      execution(undefined, { intro: 'actual' }),
    ),
    'actual',
  );
  definitions[0].metadata.version = 9;
  // Definitions are snapshotted at compilation, so later mutation has no effect.
  assert.equal(catalog.require('explain').metadata.version, 1);
  assert.throws(() => catalog.read({ taskId: 'explain', input: {} }, execution(undefined, {})));
  assert.throws(() => defineAnswerTaskCatalog([{ ...definitions[0], outputId: 'unknown' }], ports));
  assert.throws(() => defineAnswerTaskCatalog([{ ...definitions[0], readerId: 'unknown' }], ports));
  assert.throws(() =>
    defineAnswerTaskCatalog([{ ...definitions[0], checkIds: ['unknown'] }], ports),
  );
});

test('answer batch preserves accepted values, repairs only missing/failed items and delivers sanitized values', async () => {
  const generations = [];
  let reviewed = [];
  const checks = defineAnswerCheckCatalog([
    { id: 'trim', check: (value) => ({ status: 'passed', value: value.trim(), issues: [] }) },
  ]);
  const flow = defineAnswerFlow(
    base({
      generate: async ({ items, repairs: errors }) => {
        generations.push(items.map((item) => item.id));
        return errors ? new Map([['b', ' repaired ']]) : new Map([['a', ' clean ']]);
      },
      check: ({ item, value }, context) =>
        checks.check({ checkIds: ['trim'], value }, { ...context, app: item }),
      review: async ({ items }) => {
        reviewed.push(items.map((value) => value.item.id));
        return new Map(items.map(({ item }) => [item.id, { status: 'passed', issues: [] }]));
      },
    }),
  );
  const results = await flow.run(
    { inputIds: ['a', 'b'], items: [input('a'), input('b')] },
    execution(),
  );
  assert.deepEqual(generations, [['a', 'b'], ['b']]);
  // Only the item that failed or went missing is reviewed and regenerated.
  assert.deepEqual(reviewed, [['a'], ['b']]);
  assert.deepEqual(
    results.map((result) => [result.value, result.status]),
    [
      ['clean', 'accepted'],
      ['repaired', 'accepted'],
    ],
  );
});

test('a known review error is not cleared by an unavailable recheck or a failed repair', async () => {
  // A known review failure must fall back even when the recheck or the repair call fails.
  for (const failRepair of [false, true]) {
    let calls = 0,
      reviews = 0;
    const flow = defineAnswerFlow(
      base({
        generate: async () => {
          if (++calls === 2 && failRepair) throw new Error('model unavailable');
          return new Map([['a', 'candidate']]);
        },
        review: async () => {
          if (++reviews > 1) throw new Error('review unavailable');
          return new Map([
            ['a', { status: 'failed', issues: [{ code: 'FACT', message: 'incorrect fact' }] }],
          ]);
        },
      }),
    );
    const [result] = await flow.run({ inputIds: ['a'], items: [input('a')] }, execution());
    assert.equal(result.status, 'fallback');
    assert.equal(result.value, 'source-a');
  }
});

test('contract violations cannot be recovered as business answers; required and optional review have distinct states', async () => {
  await assert.rejects(
    defineAnswerFlow(base({ generate: async () => new Map([['foreign', 'x']]) })).run(
      { inputIds: ['a'], items: [input('a')] },
      execution(),
    ),
    /ownership/,
  );
  await assert.rejects(
    defineAnswerFlow(base({ check: () => ({ status: 'failed' }) })).run(
      { inputIds: ['a'], items: [input('a')] },
      execution(),
    ),
    /check result/,
  );
  await assert.rejects(
    defineAnswerFlow(
      base({ review: async () => new Map([['foreign', { status: 'passed', issues: [] }]]) }),
    ).run({ inputIds: ['a'], items: [input('a')] }, execution()),
    /ownership/,
  );
  for (const reviewPolicy of ['required', 'optional']) {
    // Required review downgrades to fallback when unavailable; optional still accepts.
    const [result] = await defineAnswerFlow(base({ maxRepairs: 0, reviewPolicy })).run(
      { inputIds: ['a'], items: [input('a')] },
      execution(),
    );
    assert.equal(result.status, reviewPolicy === 'required' ? 'fallback' : 'accepted');
    assert.equal(result.checks.review.status, 'unavailable');
  }
  assert.throws(() => validateAnswerBatch(['a', 'b'], [input('a')], 2), /cover/);
});

test('zero budget, unavailable sources and cancellation never start extra model work', async () => {
  let called = 0;
  const flow = defineAnswerFlow(
    base({
      canInvoke: () => false,
      generate: async () => {
        called++;
        return new Map();
      },
    }),
  );
  const result = await flow.run(
    { inputIds: ['a', 'b'], items: [input('a'), input('b', 'b', 'conflict')] },
    execution(),
  );
  assert.equal(called, 0);
  assert.ok(result.every((result) => result.status === 'fallback'));
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    defineAnswerFlow(base()).run(
      { inputIds: ['a'], items: [input('a')] },
      execution(controller.signal),
    ),
  );
});

test('presentation helpers use caller state and handles zero/one candidates and ordered preferences', () => {
  assert.equal(
    selectVariant([], {
      randomIndex: () => {
        throw new Error();
      },
    }),
    undefined,
  );
  assert.equal(
    selectVariant(['one'], {
      previous: 'one',
      randomIndex: () => {
        throw new Error();
      },
    }),
    'one',
  );
  // randomIndex 0 picks 'a', which equals `previous`, so selection advances to 'b'.
  assert.equal(selectVariant(['a', 'b'], { previous: 'a', randomIndex: () => 0 }), 'b');
  assert.equal(
    resolvePreference([
      { value: 'entry', priority: 1, order: 4 },
      { value: 'explicit-old', priority: 2, order: 1 },
      { value: 'explicit-new', priority: 2, order: 2 },
    ]),
    'explicit-new',
  );
  const require = createRequire(import.meta.url);
  assert.equal(
    typeof require('@jangts/agent-core/kits/knowledge').defineKnowledgeCatalog,
    'function',
  );
  assert.equal(
    typeof require('@jangts/agent-core/kits/knowledge').parseKnowledgeDocument,
    'function',
  );
  assert.equal(typeof require('@jangts/agent-core/kits/answering').defineAnswerFlow, 'function');
});

test('Kit observations belong to the caller and do not enter Core diagnostics', () => {
  const coreEvents = [],
    snapshots = [];
  const diagnostics = createDiagnostics({
    output: { write: (event) => coreEvents.push(event) },
    runId: 'run',
  });
  const catalog = defineKnowledgeCatalog([{ id: 'doc', revision: '1', parts: ['source'] }], {
    observe: (snapshot) => snapshots.push(snapshot),
    diagnostics,
  });
  const snapshot = catalog.read({ documentId: 'doc', selection: { mode: 'document' } });
  assert.deepEqual(snapshots[0], snapshot);
  assert.notEqual(snapshots[0], snapshot);
  snapshots[0].content = 'observer mutation';
  assert.equal(snapshot.content, 'source');
  assert.equal(coreEvents.length, 0);
  const independent = defineKnowledgeCatalog([{ id: 'doc', revision: '1', parts: ['source'] }], {
    observe() {
      throw new Error('caller storage unavailable');
    },
  });
  assert.equal(
    independent.read({ documentId: 'doc', selection: { mode: 'document' } }).content,
    'source',
  );
});

test('a reusable answer flow isolates concurrent repair budgets, previous values and Loop contexts', async () => {
  const contexts = [];
  class Definition {
    maxItems = 1;
    maxRepairs = 1;
    reviewPolicy = 'off';
    #suffix = ':repaired';
    canInvoke({ app }) {
      return app.calls < 2;
    }
    async generate({ items, repairs, previous }, { app, diagnostics }) {
      await Promise.resolve();
      contexts.push({
        name: app.name,
        runId: diagnostics.identity.runId,
        spanId: diagnostics.identity.spanId,
      });
      app.calls++;
      const id = items[0].id;
      return new Map([[id, repairs ? previous.get(id) + this.#suffix : app.name]]);
    }
    check({ value }) {
      return {
        status: value.endsWith(this.#suffix) ? 'passed' : 'failed',
        issues: value.endsWith(this.#suffix) ? [] : [{ code: 'REPAIR', message: 'repair once' }],
      };
    }
    fallback() {
      assert.fail('both requests should complete within their own repair budget');
    }
  }
  const definition = new Definition(),
    flow = defineAnswerFlow(definition);
  definition.generate = definition.check = () => {
    throw new Error('replaced');
  };
  const one = { name: 'one', calls: 0 },
    two = { name: 'two', calls: 0 };
  const [first, second] = await Promise.all(
    [one, two].map((app) =>
      flow.run(
        { inputIds: ['same'], items: [input('same')] },
        {
          app,
          signal: new AbortController().signal,
          diagnostics: createDiagnostics({ runId: app.name }),
        },
      ),
    ),
  );
  assert.deepEqual([first[0].value, second[0].value], ['one:repaired', 'two:repaired']);
  assert.deepEqual([one.calls, two.calls], [2, 2]);
  assert.ok(contexts.every((context) => context.runId === context.name && context.spanId));
  // Two concurrent runs times two attempts each produce four independent spans.
  assert.equal(new Set(contexts.map((context) => context.spanId)).size, 4);
});

test('answer cancellation consumes late generator rejection and never invokes fallback', async () => {
  const controller = new AbortController(),
    reason = new Error('stop answer');
  let begin,
    rejectGeneration,
    fallbacks = 0;
  const started = new Promise((resolve) => {
    begin = resolve;
  });
  const generation = new Promise((_resolve, reject) => {
    rejectGeneration = reject;
  });
  const flow = defineAnswerFlow(
    base({
      generate: () => {
        begin();
        return generation;
      },
      fallback() {
        fallbacks++;
        return { handled: false };
      },
    }),
  );
  const pending = flow.run({ inputIds: ['a'], items: [input('a')] }, execution(controller.signal));
  await started;
  controller.abort(reason);
  await assert.rejects(pending, (error) => error === reason);
  // A rejection arriving after abort must be swallowed, not surfaced or turned into a fallback.
  rejectGeneration(new Error('late generation failure'));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fallbacks, 0);
});

test('checker catalogs and flow checks share required issue arrays and preserve getter sanitizers', async () => {
  class Result {
    #value = undefined;
    get status() {
      return 'passed';
    }
    get issues() {
      return [];
    }
    get value() {
      return this.#value;
    }
  }
  const checks = defineAnswerCheckCatalog([{ id: 'sanitize', check: () => new Result() }]);
  assert.equal(
    checks.check({ checkIds: ['sanitize'], value: 'original' }, execution()).value,
    undefined,
  );
  const [result] = await defineAnswerFlow(
    base({ reviewPolicy: 'off', check: () => new Result() }),
  ).run({ inputIds: ['a'], items: [input('a')] }, execution());
  assert.equal(result.status, 'accepted');
  assert.equal(result.value, undefined);
  const invalid = defineAnswerCheckCatalog([
    { id: 'invalid', check: () => ({ status: 'passed' }) },
  ]);
  assert.throws(
    () => invalid.check({ checkIds: ['invalid'], value: 1 }, execution()),
    /check result/,
  );
  await assert.rejects(
    defineAnswerFlow(base({ check: () => ({ status: 'passed' }) })).run(
      { inputIds: ['a'], items: [input('a')] },
      execution(),
    ),
    /check result/,
  );
});

test('knowledge catalogs bind limits and observers while accepting structural documents and requests', () => {
  class Section {
    get id() {
      return 'intro';
    }
    get parts() {
      return ['Source'];
    }
  }
  class Document {
    get id() {
      return 'class-doc';
    }
    get revision() {
      return 'r1';
    }
    get parts() {
      return [new Section()];
    }
  }
  class Options {
    #reads = 0;
    get maxChars() {
      return 6;
    }
    observe(snapshot) {
      assert.equal(snapshot.content, 'Source');
      this.#reads++;
    }
    get reads() {
      return this.#reads;
    }
  }
  class Request {
    get documentId() {
      return 'class-doc';
    }
    get selection() {
      return { mode: 'self', sectionIds: ['intro'] };
    }
  }
  const options = new Options(),
    catalog = defineKnowledgeCatalog([new Document()], options);
  assert.deepEqual(catalog.sectionIds('class-doc'), ['intro']);
  assert.equal(catalog.read(new Request()).content, 'Source');
  assert.equal(options.reads, 1);
  for (const name of ['sections', 'validate']) assert.equal(Object.hasOwn(catalog, name), false);
  const mutableOptions = { maxChars: 3 };
  const bounded = defineKnowledgeCatalog([new Document()], mutableOptions);
  mutableOptions.maxChars = 1000;
  // Options are snapshotted, so later mutation cannot raise the bound.
  assert.throws(() => bounded.read(new Request()), /budget/);
  assert.throws(() => catalog.read({ document: 'class-doc', select: { mode: 'document' } }));
});

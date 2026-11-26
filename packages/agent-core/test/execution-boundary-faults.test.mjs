/*
 * Fault handling at the execution boundaries: engine setup, loop and workflow
 * completion, context selection, answer generation, output catalogs, model
 * measurement and the compatible provider.
 *
 * The recurring question is what a failure is allowed to do. Configuration
 * mistakes and invalid counters fail at construction, a thrown reason keeps its
 * identity and its timeout classification, and a non-validation failure (for
 * example a broken serializer) must not be reported as a validation error or
 * silently swallowed. Conversely, instrumentation, an uncloneable report payload
 * or a failing log sink must not suppress a completed business result.
 *
 * Runs on `dist/esm` with fake providers, in-memory sinks and SSE `Response`
 * objects; one case mocks `JSON.stringify` through the test context.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AgentCoreEngine,
  ModelRunner,
  Support,
  CompatibleModelProvider,
  createDiagnostics,
  defineWorkflow,
  getErrorInfo,
} from '../dist/esm/index.js';
import { createSubFlowLogger } from '../dist/esm/diagnostics/sub-flow.js';
import { defineContentProjection } from '../dist/esm/kits/projection.js';
import { VectorSearch } from '../dist/esm/kits/vector-search.js';
import { defineAnswerFlow } from '../dist/esm/kits/answering/flow.js';
import { defineOutputCatalog } from '../dist/esm/kits/presentation/outputs.js';
import { preparedInputSize } from '../dist/esm/model/preparation.js';
import { beginContextProcessing, chooseSteps } from '../dist/esm/support/context/processing.js';
import { chatCompletionParts } from '../dist/esm/support/model/chat-completions.js';
const signal = () => new AbortController().signal;
const provider = {
  async *stream() {
    yield 'ok';
  },
};
const done = () =>
  defineWorkflow({
    id: 'flow',
    nodes: [{ id: 'one', description: 'One', routes: [{ complete: () => 7 }] }],
  });
const context = () => ({ app: {}, signal: signal() });
const f = (value) => ({
  id: 'history',
  sourceId: 'app',
  trust: 'user',
  role: 'user',
  lifetime: 'turn',
  maxChars: 1000,
  value,
});
const step = {
  id: 'trim',
  kind: 'trim',
  fragmentId: 'history',
  targetChars: 1,
  field: 'messages',
  keepGroups: 1,
  grouping: { kind: 'user-turn' },
};

test('engine construction and forks enforce configured model and App ownership', () => {
  // A model reference that does not resolve, or a model entry without a provider,
  // must fail while the engine is built rather than on first use.
  for (const config of [
    { models: {}, model: 'missing' },
    { models: { one: { provider } }, model: {} },
    { model: 'missing' },
  ])
    assert.throws(() => new AgentCoreEngine(config));
  const engine = new AgentCoreEngine({ workflow: done(), app: {} });
  assert.throws(() => engine.fork({ at: engine.checkpoint({}) }), /restored App/);
  assert.throws(
    () => engine.fork({ at: engine.checkpoint({}), resume: () => ({}) }),
    /restored App/,
  );
});

test('loop boundary rejects primitive outcomes and retains parent timeout classification', async () => {
  await assert.rejects(
    new AgentCoreEngine().run(() => 1),
    /explicit/,
  );
  const reason = new DOMException('deadline', 'TimeoutError');
  const events = [],
    diagnostics = createDiagnostics({ output: { write: (event) => events.push(event) } });
  // The timeout reason is rethrown as-is by both the engine and the runner, while the
  // recorded code differs per boundary (TIMEOUT event vs ROUND_TIMEOUT classification).
  await assert.rejects(
    new AgentCoreEngine({ execution: { signal: AbortSignal.abort(reason), diagnostics } }).run(() =>
      assert.fail(),
    ),
    (error) => error === reason,
  );
  assert.equal(events.at(-1).payload.errorCode, 'TIMEOUT');
  await assert.rejects(
    new ModelRunner({ provider, execution: { signal: AbortSignal.abort(reason) } }).invoke('x'),
    (error) => error === reason,
  );
  assert.equal(getErrorInfo(reason).code, 'ROUND_TIMEOUT');
});

test('workflow preparations cannot be reassigned between configured models and report failures do not suppress completion', async () => {
  const workflow = defineWorkflow({
    id: 'models',
    nodes: [
      {
        id: 'one',
        description: 'One',
        run(_state, ctx) {
          const prepared = ctx.model.prepare({ modelId: 'one' });
          return ctx.model.invoke({ modelId: 'two', input: 'x', prepared });
        },
        routes: [{ complete: () => 7 }],
      },
    ],
  });
  await assert.rejects(
    new AgentCoreEngine({ workflow, models: { one: { provider }, two: { provider } } }).run({}),
    /another execution or model/,
  );
  const records = [],
    diagnostics = createDiagnostics({ output: { write: (event) => records.push(event) } });
  const reporting = defineWorkflow({
    id: 'reports',
    nodes: [
      {
        id: 'one',
        description: 'One',
        // A function in the report payload cannot be cloned; dropping the report must
        // not stop the node from completing.
        report: () => ({ payload: { uncloneable() {} } }),
        routes: [{ complete: () => 7 }],
      },
    ],
  });
  assert.equal(
    await new AgentCoreEngine({ workflow: reporting, execution: { diagnostics } }).run({}),
    7,
  );
  assert.ok(records.some((event) => event.payload.event?.type === 'complete'));
  const observed = [],
    broken = createDiagnostics({
      output: {
        write() {
          throw Error('log unavailable');
        },
      },
      observe: { event: (event) => observed.push(event) },
    });
  broken.emit('model.start', () => ({ stageId: 's' }));
  // Output and observer are independent sinks: one throwing must not disable the other.
  assert.equal(observed.length, 1);
});

test('reported completion assigns an end time and projections retain already short prose', () => {
  const logger = createSubFlowLogger(
    {},
    () => true,
    () => true,
    () => {},
  );
  logger.write({ name: 'done', kind: 'read', status: 'success' });
  assert.equal(typeof logger.readAll()[0].endedAtMs, 'number');
  const projection = defineContentProjection({
    counts: [1],
    lengths: [5],
    render: JSON.stringify,
    fallback: () => '{}',
  });
  const result = projection.project({ value: { a: 'x', b: 'y'.repeat(100) }, maxChars: 30 });
  assert.equal(JSON.parse(result.text).a, 'x');
  assert.equal(result.truncated, true);
});

test('vector grouping filters, validates group keys and chooses deterministic ties', () => {
  const search = new VectorSearch({ identity: 'space', dimensions: 1 });
  for (const id of ['z', 'a', 'b']) search.upsert({ document: { id }, vector: [1] });
  assert.deepEqual(search.search({ vector: [1], limit: 3, filter: () => false }), []);
  assert.deepEqual(search.search({ vector: [-1], limit: 3, filter: () => true, minScore: 0 }), []);
  // Grouping keeps one hit per group; equal scores make ['a'] the deterministic winner.
  assert.deepEqual(
    search
      .search({ vector: [1], limit: 3, filter: () => true, groupBy: () => 'same' })
      .map((hit) => hit.id),
    ['a'],
  );
  assert.throws(
    () => search.search({ vector: [1], limit: 3, filter: () => true, groupBy: () => 7 }),
    /groups/,
  );
});

test('repair generation failure preserves fallback delivery and reports its actual phase', async () => {
  const stages = [];
  let attempts = 0;
  const flow = defineAnswerFlow({
    maxItems: 1,
    maxRepairs: 1,
    canInvoke: () => true,
    reviewPolicy: 'off',
    generate() {
      if (attempts++) throw Error('repair unavailable');
      return new Map([['i', 'bad']]);
    },
    check: () => ({ status: 'failed', issues: [{ code: 'BAD', message: 'bad' }] }),
    fallback: () => ({ handled: false }),
    observe: (report) => stages.push(report.stageId),
  });
  const result = await flow.run(
    { inputIds: ['q'], items: [{ id: 'i', inputIds: ['q'], data: {}, sourceStatus: 'ready' }] },
    context(),
  );
  assert.equal(result[0].status, 'blocked');
  assert.ok(stages.includes('repair-unavailable'));
  const unavailable = defineAnswerFlow({
    maxItems: 1,
    maxRepairs: 0,
    canInvoke: () => true,
    generate() {
      throw Error('initial unavailable');
    },
    check() {
      assert.fail();
    },
    fallback: () => ({ handled: false }),
    observe: (report) => stages.push(report.stageId),
  });
  const missing = await unavailable.run(
    { inputIds: ['q'], items: [{ id: 'i', inputIds: ['q'], data: {}, sourceStatus: 'ready' }] },
    context(),
  );
  assert.equal(missing[0].status, 'blocked');
  assert.ok(stages.includes('generation-unavailable'));
});

test('output catalogs enforce provider, master and required semantic contracts', () => {
  const text = { id: 'text', kind: 'text', fields: [{ id: 'body', owner: 'generated' }] };
  for (const providers of [
    [{ id: '', resolve() {} }],
    [{ id: 'p', resolve: 7 }],
    [
      { id: 'p', resolve() {} },
      { id: 'p', resolve() {} },
    ],
  ])
    assert.throws(() => defineOutputCatalog([text], { providers }), /provider/);
  assert.throws(() => defineOutputCatalog([{ ...text, kind: 'master' }]), /Missing output master/);
  const catalog = defineOutputCatalog(
    [
      text,
      { id: 'group', kind: 'group', fields: [], maxItems: 1, allowedOutputIds: ['text'] },
      {
        id: 'semantic',
        kind: 'text',
        fields: [{ id: 'body', owner: 'semantic', providerId: 'p', semanticKeys: ['yes'] }],
      },
      {
        id: 'master',
        kind: 'master',
        master: '{{body}}',
        fields: [{ id: 'body', owner: 'generated', required: false }],
      },
    ],
    { providers: [{ id: 'p', resolve: () => 'ok' }] },
  );
  assert.equal(catalog.check({ outputId: 'text', value: {} }).issues[0].code, 'OUTPUT_MISSING');
  for (const body of ['unknown', 7])
    assert.equal(
      catalog.check({ outputId: 'semantic', value: { body } }).issues[0].code,
      'OUTPUT_VALUE',
    );
  assert.equal(catalog.compose({ outputId: 'master', input: {} }, context()).value, '');
});

test('model measurement rejects invalid counters, measures uncached declarations and defaults invalid error factories', async () => {
  assert.throws(
    () =>
      new ModelRunner({
        provider,
        tokenBudget: { counterId: 'tokens', contextWindowTokens: 4096, countTokens: 7 },
      }),
  );
  const functions = [{ name: 'read', parameters: { type: 'object' } }];
  assert.equal(
    preparedInputSize([], { schemaChars: 0, options: { functions } }).schemaChars,
    JSON.stringify(functions).length,
  );
  await assert.rejects(
    new ModelRunner({
      provider,
      maxOutputChars: 1,
      errors: { outputBudget: () => undefined },
    }).invoke('x'),
    (error) => error.issues[0].code === 'OUTPUT_LIMIT',
  );
  assert.throws(() => chatCompletionParts({ tool_calls: 7 }));
});

test('context selection handles incompatible histories and preserves non-validation failures', async (t) => {
  const ports = {
    stageId: 's',
    signal: signal(),
    compressors: [],
    callModel() {
      assert.fail();
    },
  };
  const make = (value) => {
    const state = beginContextProcessing(
      { fragments: [f(value)], maxInputChars: 1000 },
      { mode: 'reduce', steps: [step] },
      ports,
    );
    state.report.decisions = [];
    return state;
  };
  assert.deepEqual(await chooseSteps(make({ messages: [1] }), [step], { mode: 'auto' }), []);
  const work = make({
    messages: [
      { role: 'user', content: 'old' },
      { role: 'user', content: 'recent' },
    ],
  });
  const stringify = JSON.stringify,
    failure = Error('serializer failure');
  // A serializer failure raised inside selection must surface as itself instead of
  // being converted into a validation or budget error.
  t.mock.method(JSON, 'stringify', (value, ...args) => {
    if (Array.isArray(value)) throw failure;
    return stringify(value, ...args);
  });
  await assert.rejects(chooseSteps(work, [step], { mode: 'auto' }), (error) => error === failure);
  t.mock.restoreAll();
  const fragment = f({ messages: [] });
  assert.equal(
    beginContextProcessing(
      { fragments: [fragment], originalFragments: [fragment], maxInputChars: 1000 },
      { mode: 'validate' },
      ports,
    ).fragments.length,
    1,
  );
  const compressor = { id: 'c', maxCalls: 0, compress: () => ({}) };
  assert.equal(
    Support.createContextStrategy({ steps: [], compressors: [compressor, compressor] }).compressors
      .length,
    1,
  );
  assert.equal(
    Support.createContextProcessingNode({
      id: 'context',
      description: 'Context',
      policy: { mode: 'reduce', steps: [], selection: { mode: 'sequence' } },
      plan() {},
      update() {},
      routes: [],
    }).id,
    'context',
  );
});

const config = { baseUrl: 'https://mock.invalid', apiKey: 'mock', model: 'mock' };
const frames = (values) =>
  new Response(
    values
      .map((value) => `data: ${typeof value === 'string' ? value : JSON.stringify(value)}\n\n`)
      .join(''),
    { headers: { 'content-type': 'text/event-stream' } },
  );
const frame = (delta, finish_reason = null) => ({ choices: [{ index: 0, delta, finish_reason }] });
test('provider reasoning adapters validate mapper results and explicitly disable thinking budgets', async () => {
  for (const reasoning of [
    null,
    { level: 'invalid', format: 'thinking' },
    { level: 'low', format: 'custom' },
    { level: 'low', format: 'custom', map: () => [] },
  ])
    assert.throws(
      () => new CompatibleModelProvider({ config: { ...config, reasoning } }),
      /reasoning|mapper|Reasoning/i,
    );
  let body;
  const model = new CompatibleModelProvider({
    config: { ...config, reasoning: { level: 'off', format: 'thinking-budget' } },
    ports: {
      request: async (_url, init) => {
        body = JSON.parse(init.body);
        return frames([frame({ content: 'ok' }, 'stop'), '[DONE]']);
      },
    },
  });
  assert.deepEqual(await Array.fromAsync(model.stream([], { signal: signal() })), ['ok']);
  assert.deepEqual(body.thinking, { type: 'disabled' });
});
test('provider diagnostics tolerate reader construction errors and validate every terminal choice', async () => {
  const broken = new CompatibleModelProvider({
    config,
    observe: { provider: { write() {} } },
    ports: {
      request: async () => ({
        ok: false,
        status: 503,
        headers: new Headers(),
        body: {
          getReader() {
            throw Error('reader failed');
          },
        },
      }),
    },
  });
  await assert.rejects(Array.fromAsync(broken.stream([], { signal: signal() })), /MODEL_UPSTREAM/);
  const valid = new CompatibleModelProvider({
    config,
    ports: {
      request: async () =>
        frames([frame({ content: 'ok' }, 'stop'), frame({ tool_calls: [] }), '[DONE]']),
    },
  });
  assert.deepEqual(await Array.fromAsync(valid.stream([], { signal: signal() })), ['ok']);
  const invalid = new CompatibleModelProvider({
    config,
    // 'content_filter' terminates the stream without producing content, so the call
    // must be reported as incomplete rather than as a successful empty answer.
    ports: { request: async () => frames([frame({ content: 'ok' }, 'content_filter')]) },
  });
  await assert.rejects(
    Array.fromAsync(invalid.stream([], { signal: signal() })),
    /MODEL_INCOMPLETE/,
  );
});

/*
 * Defensive-branch coverage for registries, route helpers, engine setup, model
 * preparation, answer validation, delivery/projection and the context policy
 * catalogs.
 *
 * The goal is that every rejection path fails with its own declared error and
 * before any side effect, rather than surfacing later as an incidental
 * `TypeError`. Configured error factories are checked by identity, so a caller
 * that injects its own errors keeps getting them back.
 *
 * Runs on `dist/esm` with inline fakes; nothing reaches a provider.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as Core from '../dist/esm/index.js';
import {
  ModelRunner,
  ModelToolRegistry,
  ToolRegistry,
  Support,
  AgentCoreEngine,
  defineWorkflow,
  route,
} from '../dist/esm/index.js';
import { ProtocolRegistry } from '../dist/esm/utils/protocol-registry.js';
import { awaitWithSignal } from '../dist/esm/utils/cancellation.js';
import { observeSafely } from '../dist/esm/utils/observer.js';
import { snapshotSchemaAdapter } from '../dist/esm/utils/schema-adapter.js';
import { snapshotAnswerCheck } from '../dist/esm/kits/answering/check-result.js';
import { defineAnswerCheckCatalog } from '../dist/esm/kits/answering/checks.js';
import { validateAnswerBatch } from '../dist/esm/kits/answering/batch.js';
import { defineDelivery } from '../dist/esm/kits/delivery.js';
import { defineContentProjection } from '../dist/esm/kits/projection.js';
import { selectVariant, resolvePreference } from '../dist/esm/kits/presentation/variants.js';
import { contextSelectionCatalog } from '../dist/esm/support/context/selection-policy.js';
import * as Processing from '../dist/esm/support/context/processing.js';
import { snapshotMessage } from '../dist/esm/support/context/snapshot.js';
import { nativeFunctionInteraction } from '../dist/esm/model/interactions/native-functions.js';
import { jsonObjectInteraction } from '../dist/esm/model/interactions/json-object.js';
const execution = () => ({ app: {}, signal: new AbortController().signal });
const provider = {
  async *stream() {
    yield 'ok';
  },
};
const schema = { jsonSchema: { type: 'object' }, parse: (value) => value };
const capability = {
  id: 'answer',
  description: 'Answer',
  inputSchema: schema,
  resolve: (value) => value,
};
test('registries reject unavailable names, malformed values and duplicate declarations at their boundaries', async () => {
  const protocols = new ProtocolRegistry([['one', 1]]);
  assert.equal(protocols.require('one'), 1);
  assert.throws(() => protocols.require('missing'));
  for (const [key, value] of [
    ['', 1],
    ['bad', null],
    ['bad', undefined],
    ['one', 2],
  ])
    assert.throws(() => protocols.set(key, value));
  const modelTools = new ModelToolRegistry([capability]);
  for (const selected of [
    { toolId: 'missing', input: {} },
    ...[null, [], 'input'].map((input) => ({ toolId: 'answer', input })),
  ])
    assert.throws(() => modelTools.resolve(selected, { stageId: 'test' }));
  assert.throws(() =>
    new ToolRegistry().register({
      id: '',
      kind: 'read',
      parseInput() {},
      parseOutput() {},
      execute() {},
    }),
  );
  const tools = new ToolRegistry();
  const tool = {
    id: 'read',
    kind: 'read',
    parseInput: (value) => value,
    parseOutput: (value) => value,
    execute: (value) => value,
  };
  tools.register(tool);
  assert.throws(() => tools.register(tool));
  assert.throws(() => tools.require('missing'));
  // An injected error factory must be used verbatim, not wrapped or replaced.
  const expected = Error('unavailable');
  assert.throws(
    () => new ToolRegistry({ errors: { unavailable: () => expected } }).require('missing'),
    (error) => error === expected,
  );
  for (const jsonSchema of [null, [], false])
    assert.throws(() => snapshotSchemaAdapter({ jsonSchema, parse: (value) => value }));
  assert.equal(await awaitWithSignal(7), 7);
  // A failing observer is contained: it must not reject the surrounding work.
  observeSafely(async () => {
    throw Error('observer failure');
  }, {});
  assert.throws(() => Core.breakWhile([{ occur: [true] }]));
});
test('route helpers retain explicit identities, non-string keys and completion contracts', () => {
  // Field keys may be symbols or objects rather than dotted strings, so route
  // helpers cannot assume `string` keys.
  const key = Symbol('key'),
    object = {};
  for (const value of [object, () => {}, Symbol('value')])
    assert.equal(route.toIfEqual('next', key, value).when({ [key]: value }), true);
  const equal = route.toIfEqual('next', key, object, { id: 'named', conditionId: 'condition' });
  assert.equal(equal.id, 'named');
  assert.equal(route.toIfEqualWith('next', key, 'right').when({ [key]: 1, right: 1 }), true);
  assert.equal(
    route
      .toIfEqualWith('next', 'left', key, { id: 'named', conditionId: 'condition' })
      .when({ left: 1, [key]: 1 }),
    true,
  );
  assert.equal(
    route.toIfNotEmpty('next', key, { id: 'array', conditionId: 'check' }).when({ [key]: [1] }),
    true,
  );
  assert.equal(
    route.toIfDefined('next', key, { id: 'defined', conditionId: 'check' }).when({ [key]: 0 }),
    true,
  );
  assert.equal(route.deliver('answer', { id: 'finish' }).complete({ answer: false }), false);
  assert.equal(
    route.deliverIfReady('answer', { id: 'finish', conditionId: 'check' }).when({ answer: 0 }),
    true,
  );
  const completed = route.deliverWhenComplete('outcome', { id: 'finish', conditionId: 'check' });
  assert.equal(completed.complete({ outcome: { type: 'complete', value: 0 } }), 0);
  assert.throws(() => completed.complete({ outcome: { type: 'continue' } }));
});
test('engine setup, fork dependencies and workflow migration errors fail before execution', async () => {
  const engine = new AgentCoreEngine();
  assert.throws(() => engine.workflow);
  assert.throws(() => engine.switchModel({ provider }));
  assert.throws(() => engine.bindModel({ provider, execution: {} }));
  assert.throws(() => engine.bindToolRuntime(null));
  assert.throws(() => engine.bindToolRuntime(7));
  await assert.rejects(engine.run({}));
  assert.throws(() => engine.fork({ at: engine.checkpoint({}) }));
  const workflow = defineWorkflow({
    id: 'flow',
    nodes: [{ id: 'start', description: 'Start', run() {}, routes: [{ complete: () => 'ok' }] }],
  });
  const bound = new AgentCoreEngine({ workflow, app: {} });
  const at = bound.checkpoint({});
  assert.throws(() => bound.fork({ at, routes: {} }));
  assert.throws(() => bound.fork({ at }));
  for (const patch of [
    { entry: 'start' },
    { validateResult() {} },
    { id: '' },
    { entryNodeId: ' ' },
  ])
    assert.throws(() => defineWorkflow({ id: 'flow', nodes: workflow.definitions, ...patch }));
  assert.throws(() => workflow.add({ nodes: [], routes: { missing: [] } }));
  assert.throws(() =>
    defineWorkflow({ id: 'flow', nodes: [{ ...workflow.definitions[0], onErrorRouteId: 'bad' }] }),
  );
  const named = workflow.add({ nodes: [], routes: {}, revision: 'two' });
  assert.equal(named.revision, 'two');
});
test('model preparation rejects invalid dynamic collectors, declarations and foreign diagnostics', async () => {
  for (const prepared of [
    null,
    { schemaChars: -1, options: {}, createResponse() {} },
    { schemaChars: 0, options: {}, instruction: 7, createResponse() {} },
    { schemaChars: 0, options: {}, createResponse: 7 },
  ]) {
    const runner = new ModelRunner({ execution: {},
      provider,
      transports: [{ id: 'bad', prepare: () => prepared }],
    });
    assert.throws(() => runner.prepare({ transport: 'bad' }));
  }
  const runner = new ModelRunner({ execution: {}, provider });
  assert.equal(runner.lastCall, undefined);
  assert.throws(() => runner.prepare({ stageId: '' }));
  assert.throws(() => runner.prepare({ transport: 'missing' }));
  assert.throws(() => runner.prepare({ transport: { id: 'foreign', prepare() {} } }));
  const invalid = new ModelRunner({ execution: {},
    provider,
    transports: [
      { id: 'bad', prepare: () => ({ options: {}, schemaChars: 0, createResponse: () => ({}) }) },
    ],
  });
  await assert.rejects(invalid.invoke({ input: 'x', transport: 'bad' }), /collector/);
  const configured = new ModelRunner({
    provider,
    execution: { diagnostics: Core.createDiagnostics({ runId: 'configured' }) },
  });
  await assert.rejects(
    configured.invoke({ input: 'x', diagnostics: Core.createDiagnostics({ runId: 'foreign' }) }),
    /different run/,
  );
  const native = nativeFunctionInteraction.prepare([capability]);
  assert.throws(() => native.createResponse().push({ type: 'other', index: 0 }));
  assert.throws(() => nativeFunctionInteraction.prepare([capability, capability]));
  assert.throws(() =>
    jsonObjectInteraction
      .prepare([capability])
      .createResponse()
      .push({ type: 'function-call-delta', index: 0 }),
  );
  assert.throws(() =>
    Support.createModelTransport({
      id: 'empty',
      tools: new ModelToolRegistry(),
    }).prepare('test'),
  );
  assert.throws(() => Support.createJsonTransport({ id: '', outputSchema: schema }));
});
test('answer batch and check validation reject each malformed contract and preserve issue metadata', () => {
  const item = { id: 'one', inputIds: ['one'], sourceStatus: 'ready' };
  for (const [ids, items, limit] of [
    [[], [item], 1],
    [['one', 'one'], [item], 1],
    [[1], [item], 1],
    [['one'], [], 1],
    [['one'], [item, item], 2],
    [['one'], [item], 0],
    [['one'], [{ ...item, id: '' }], 1],
    [['one'], [{ ...item, sourceStatus: 'bad' }], 1],
    [['one'], [{ ...item, inputIds: [] }], 1],
    [['one'], [{ ...item, inputIds: ['one', 'one'] }], 1],
    [['one'], [{ ...item, inputIds: ['other'] }], 1],
  ])
    assert.throws(() => validateAnswerBatch(ids, items, limit));
  for (const issue of [
    null,
    { code: '', message: '' },
    { code: 1, message: '' },
    { code: 'x', message: 1 },
    { code: 'x', message: '', path: 1 },
    { code: 'x', message: '', path: [{}] },
  ])
    assert.throws(() => snapshotAnswerCheck({ status: 'failed', issues: [issue] }));
  const check = snapshotAnswerCheck(
    { status: 'failed', issues: [{ code: 'x', message: 'x', checkId: 'own', path: ['a', 0] }] },
    'parent',
  );
  assert.equal(check.issues[0].checkId, 'own');
  assert.throws(() => defineAnswerCheckCatalog([{ id: 'bad', check: null }]));
  const catalog = defineAnswerCheckCatalog(
    ['failed', 'unavailable', 'passed'].map((status) => ({
      id: status,
      check: (value) => ({
        status,
        value,
        issues: status === 'failed' ? [{ code: 'x', message: 'x' }] : [],
      }),
    })),
  );
  // Status precedence follows declaration order: the first non-passing check
  // decides, so an 'unavailable' result outranks a later 'passed'.
  assert.equal(
    catalog.check({ checkIds: ['unavailable', 'passed'], value: 1 }, execution()).status,
    'unavailable',
  );
  assert.equal(
    catalog.check({ checkIds: ['failed', 'unavailable'], value: 1 }, execution()).status,
    'failed',
  );
  assert.throws(() => catalog.check({ checkIds: ['passed', 'passed'], value: 1 }, execution()));
  assert.throws(() => catalog.check({ checkIds: ['missing'], value: 1 }, execution()));
});
test('delivery, projection and presentation retain finite limits and reject malformed results', () => {
  const settings = (stages) => ({
    stages,
    createState: () => ({}),
    missingResult: () => Error('missing'),
  });
  for (const stages of [[{ id: '' }], [{ id: 'x' }, { id: 'x' }], [{ id: 'x', handle: 7 }]])
    assert.throws(() => defineDelivery(settings(stages)));
  for (const outcome of [null, { type: 'other' }, { type: 'complete' }])
    assert.throws(() =>
      defineDelivery(settings([{ id: 'x', handle: () => outcome }])).deliver({}, execution()),
    );
  for (const index of [-1, 1.2, 2])
    assert.throws(() => selectVariant(['a', 'b'], { randomIndex: () => index }));
  // Duplicate variant labels collapse to one entry, so the pick cannot depend on
  // which identical index was chosen.
  assert.equal(selectVariant(['same', 'same'], { previous: 'same', randomIndex: () => 1 }), 'same');
  assert.throws(() => resolvePreference([{ value: 1, priority: NaN, order: 1 }]));
  const projection = defineContentProjection({
    counts: [1],
    lengths: [1],
    render: JSON.stringify,
    fallback: () => '',
  });
  assert.throws(() => projection.project({ value: {}, maxChars: -1 }));
  assert.ok(projection.project({ value: { x: [true, null, 7, 'long'] }, maxChars: 12 }).truncated);
});
test('context policy catalog handlers reject incompatible dispatch and malformed images', async () => {
  for (const [mode, handler] of Object.entries(contextSelectionCatalog))
    if (mode !== 'sequence') {
      assert.throws(() => handler.validate({ mode: 'wrong' }, []));
      await assert.rejects(handler.choose({ selection: { mode: 'wrong' }, candidates: [] }));
    }
  assert.throws(() =>
    Processing.contextPolicyCatalog.reduce.validate({ mode: 'audit' }, new Set()),
  );
  assert.throws(() =>
    Processing.contextPolicyCatalog.audit.validate({ mode: 'reduce' }, new Set()),
  );
  for (const [kind, operation] of Object.entries(Processing.contextReductionCatalog)) {
    assert.throws(() => operation.validate({ kind: 'wrong' }, new Set()));
    await assert.rejects(operation.run({ step: { kind: 'wrong' } }));
  }
  assert.throws(() => Processing.watermarks({ policy: { mode: 'audit' } }));
  assert.throws(() => Processing.auditApp({ policy: { mode: 'reduce' } }));
  assert.throws(() =>
    Processing.validateReductionTargets({ policy: { mode: 'audit' }, fragments: [] }),
  );
  await assert.rejects(Processing.contextPolicyCatalog.reduce.run({ policy: { mode: 'audit' } }));
  for (const images of [{}, [null], [{ url: 7 }], [{ url: 'x', detail: 'bad' }]])
    assert.throws(() => snapshotMessage({ role: 'user', content: '', images }));
});

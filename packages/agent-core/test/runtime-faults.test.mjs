/**
 * Locks down less-travelled fault branches: workflow extension and async result
 * predicates, metadata-only diagnostics, policy catalogs, answer-flow configuration and
 * repair budgets, text-skill error boundaries, retrieval keys, family clocks and durable
 * saves. Runs under node --test with in-memory stores and node:test mocks.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AgentCoreEngine,
  defineWorkflow,
  ModelRunner,
  Support,
  createDiagnostics,
} from '../dist/esm/index.js';
import { defineAnswerFlow } from '../dist/esm/kits/answering/flow.js';
import { AttemptBudget } from '../dist/esm/execution/workflow.js';
import { definePolicySet, defineRecoveryChain } from '../dist/esm/kits/policies.js';
import { defineTextSkillLoader } from '../dist/esm/kits/text-skills.js';
import { defineRetrieval } from '../dist/esm/kits/retrieval.js';
import { defineAgentFamily } from '../dist/esm/kits/family.js';
import { defineDurableTask } from '../dist/esm/kits/durable.js';
import { createModelStrategy } from '../dist/esm/support/model/strategies.js';
import { chatCompletionParts } from '../dist/esm/support/model/chat-completions.js';
const ctx = () => ({ app: {}, signal: new AbortController().signal });
const provider = {
  async *stream() {
    yield 'ok';
  },
};
test('workflow extension without route patches preserves all routes and rejects asynchronous result validation', async () => {
  const workflow = defineWorkflow({
    id: 'flow',
    nodes: [{ id: 'one', description: 'One', routes: [{ complete: () => 7 }] }],
  });
  assert.equal(await new AgentCoreEngine({ workflow: workflow.add({ nodes: [] }) }).run({}), 7);
  const invalid = defineWorkflow({
    id: 'invalid',
    isResult: async () => true,
    nodes: [{ id: 'one', description: 'One', routes: [{ complete: () => 7 }] }],
  });
  // Result predicates are synchronous by contract, so an async predicate is refused.
  await assert.rejects(new AgentCoreEngine({ workflow: invalid }).run({}), /result predicates/);
  assert.throws(() => new AgentCoreEngine({ maxRounds: 0 }), /positive/);
});
test('metadata diagnostics keep parsed identity and report errors without private content', () => {
  const output = [],
    diagnostics = createDiagnostics({ output: { write: (event) => output.push(event) } });
  diagnostics.emit('node.progress', () => ({
    subStep: { stepId: 's' },
    reportError: 'INVALID',
    payload: () => {},
  }));
  diagnostics.emit('model.parsed', () => ({ stageId: 's', callSequence: 1, value: () => {} }));
  assert.equal(output[0].payload.reportError, 'INVALID');
  assert.equal(output[0].payload.subStep.stepId, 's');
  // Function-valued metadata is dropped, so parsed values stay serializable and private.
  assert.deepEqual(output[1].payload, { stageId: 's', callSequence: 1 });
});
test('policy catalogs validate raw handlers before binding and preserve their receiver', () => {
  for (const define of [definePolicySet, defineRecoveryChain])
    assert.throws(() => define([{ id: 'x', description: 'X' }]), /Missing policy handler/);
  const policy = {
    id: 'x',
    description: 'X',
    kind: 'required',
    when() {
      return this.id === 'x';
    },
  };
  assert.equal(definePolicySet([policy]).assess({}).required, true);
});
test('answer flows validate configuration and unavailable review entries and malformed fallbacks', async (t) => {
  const definition = {
    maxItems: 1,
    maxRepairs: 0,
    canInvoke: () => true,
    generate: async () => new Map([['i', 'ok']]),
    check: () => ({ status: 'passed', issues: [] }),
    fallback: () => ({ handled: false }),
  };
  for (const patch of [
    { maxItems: 0 },
    { maxRepairs: -1 },
    { reviewPolicy: 'unknown' },
    { generate: null },
    { review: 1 },
  ])
    assert.throws(() => defineAnswerFlow({ ...definition, ...patch }), TypeError);
  const request = {
    inputIds: ['q'],
    items: [{ id: 'i', inputIds: ['q'], sourceStatus: 'ready', data: {} }],
  };
  const result = await defineAnswerFlow({ ...definition, review: async () => new Map() }).run(
    request,
    ctx(),
  );
  assert.equal(result[0].checks.review.status, 'unavailable');
  for (const fallback of [() => null, () => ({ handled: 'yes' }), () => ({ handled: true })])
    await assert.rejects(
      defineAnswerFlow({
        ...definition,
        check: () => ({
          status: 'failed',
          issues: [{ code: 'INVALID', message: 'Invalid answer' }],
        }),
        fallback,
      }).run(request, ctx()),
      /fallback outcome/,
    );
  t.mock.method(AttemptBudget.prototype, 'take', function () {
    return false;
  });
  t.mock.getter(AttemptBudget.prototype, 'available', () => true);
  // Report an available budget that refuses every take, which must be distinguishable from
  // a genuinely exhausted flow (`repair budget` versus `flow exhausted` below).
  await assert.rejects(
    defineAnswerFlow({
      ...definition,
      maxRepairs: 1,
      check: () => ({ status: 'failed', issues: [{ code: 'INVALID', message: 'Invalid answer' }] }),
    }).run(request, ctx()),
    /repair budget/,
  );
  t.mock.restoreAll();
  t.mock.method(AttemptBudget.prototype, 'take', function () {
    return true;
  });
  await assert.rejects(
    defineAnswerFlow({
      ...definition,
      maxRepairs: 1,
      check: () => ({ status: 'failed', issues: [{ code: 'INVALID', message: 'Invalid answer' }] }),
    }).run(request, ctx()),
    /flow exhausted/,
  );
});
test('text skill loader uses configured value errors independently for each boundary', () => {
  const errors = {
      catalog: Error('catalog'),
      registration: Error('registration'),
      document: Error('document'),
    },
    loader = defineTextSkillLoader({ maxInstructionChars: 100, maxDescriptionChars: 50, errors }),
    ports = { read: () => '' };
  // Each stage owns a distinct error, so callers can tell catalog, registration and document
  // failures apart.
  assert.throws(
    () => loader.load({ entries: null }, ports),
    (e) => e === errors.catalog,
  );
  assert.throws(
    () => loader.load({ entries: [null] }, ports),
    (e) => e === errors.registration,
  );
  assert.throws(
    () =>
      loader.load(
        { entries: [{ id: 'read', entry: 'read/SKILL.md', kind: 'text-workflow', toolIds: [] }] },
        ports,
      ),
    (e) => e === errors.document,
  );
});
test('retrieval supports a custom key and plain duplicate error without changing reservation order', () => {
  const state = { seen: new Set(), queryCount: 0, sources: [] },
    duplicate = Error('again');
  const retrieval = defineRetrieval({
    id: 'r',
    description: 'R',
    key: () => 'key',
    state: () => state,
    limit: () => 2,
    assertInput() {},
    execute: () => ({ sources: [] }),
    errors: { duplicate },
  });
  retrieval.run('a', ctx());
  assert.throws(
    () => retrieval.run('b', ctx()),
    (e) => e === duplicate,
  );
  assert.equal(state.queryCount, 1);
});
test('family clocks and failed durable saves preserve authoritative errors', async () => {
  let saved;
  const family = defineAgentFamily({
    now: () => 100,
    isState: () => true,
    authorize() {},
    validate() {},
    store: {
      load: () => undefined,
      compareAndSwap: (_id, _rev, next) => {
        saved = next;
        return true;
      },
    },
  });
  await family.create(
    { id: 'f', branch: { agentId: 'a', branchId: 'b', agentVersionId: 'v' }, state: {} },
    ctx(),
  );
  // The family clock supplies the version timestamp instead of wall time.
  assert.equal(saved.versions[0].createdAtMs, 100);
  const error = Error('save failed'),
    record = {
      version: 2,
      definitionId: 'task',
      revision: '1',
      nextStepIndex: 0,
      attemptCount: 0,
      maxAttempts: 1,
      deadlineAtMs: Date.now() + 10000,
      status: 'ready',
      state: {},
    };
  const task = defineDurableTask(
    {
      id: 'task',
      revision: '1',
      isState: () => true,
      steps: [
        {
          id: 's',
          replayPolicy: 'safe',
          run() {
            assert.fail();
          },
        },
      ],
    },
    {
      store: {
        exclusive: (_id, run) => run(),
        load: async () => record,
        save: async () => {
          throw error;
        },
      },
    },
  );
  // A save failure must surface as the store's own error object, not a wrapped one.
  await assert.rejects(task.run({ taskId: 't' }, ctx()), (e) => e === error);
});
test('model and adapter option boundaries retain native protocol validation', async () => {
  await assert.rejects(new ModelRunner({ provider }).invoke({ input: null }), /required/);
  assert.throws(() => createModelStrategy({ model: { provider }, budget: [] }), /budget strategy/);
  const bound = Support.defineToolCatalog([
    {
      id: 'read',
      kind: 'read',
      description: 'Read',
      inputSchema: { jsonSchema: { type: 'object' }, parse: (v) => v },
      authorize() {},
      execute: (v) => v,
      parseOutput: (v) => v,
      debugSteps: () => [{ name: 'Read', kind: 'read' }],
    },
  ]).bind({ app: {} });
  assert.equal(bound.invokeSync({ toolId: 'read', input: 1 }).value, 1);
  assert.deepEqual(chatCompletionParts([]), []);
  const preview = Support.createReplyPreview({ rules: [{ toolId: 'answer' }], sink() {} });
  await preview({ type: 'model.start', invocationId: 'i', payload: { stageId: 's' } });
  await preview({
    type: 'model.output',
    invocationId: 'i',
    payload: { part: { index: 0, name: 'answer', arguments: '{"text":x y}' } },
  });
});

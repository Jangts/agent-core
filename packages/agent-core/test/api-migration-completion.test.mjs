/*
 * Completeness checks for the Core API after the layer migration: each case
 * pins a runtime guarantee that callers already relied on, in its new shape.
 *
 * Covered guarantees: nested tool calls and context compressions bill against
 * one budget; a failed model attempt is closed exactly once in diagnostics and
 * in the journal; assertion/authorization callbacks return nothing and cannot
 * be satisfied by a truthy value; protocol callbacks keep their registered
 * receiver; journal receipts keep a single ordering across producers.
 *
 * Runs on `dist/esm` with in-process fake providers and fakes for diagnostics
 * output, so no network is involved.
 */
import { contextRunner } from './context-workflow.fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDiagnostics,
  ModelRunner,
  Support,
  ToolRegistry,
  ContextJournal,
  BudgetError,
  getErrorInfo,
} from '../dist/esm/index.js';
import { defineInteractionProtocol } from '../dist/esm/kits/interaction/index.js';
import { defineRetrieval } from '../dist/esm/kits/retrieval.js';
import { ModelCalls } from '../dist/esm/kits/inference.js';
import { definePolicySet } from '../dist/esm/kits/policies.js';

const signal = () => new AbortController().signal;

test('nested actual invocations share parent invocation identity and terminal status without exposing writable state', async () => {
  const records = [],
    diagnostics = createDiagnostics({
      runId: 'r',
      output: { write: (event) => records.push(event) },
    });
  const registry = new ToolRegistry({ execution: { diagnostics } });
  registry.register({
    id: 'inner',
    kind: 'read',
    parseInput: (x) => x,
    parseOutput: (x) => x,
    execute: (x) => x,
  });
  registry.register({
    id: 'outer',
    kind: 'read',
    parseInput: (x) => x,
    parseOutput: (x) => x,
    execute: (x, context) =>
      registry.invoke({ toolId: 'inner', input: x, diagnostics: context.diagnostics }).value,
  });
  const result = registry.invoke({ toolId: 'outer', input: 7 });
  // The inner call inherits the parent's invocation id so a single tool.action can
  // be traced across nesting instead of appearing as an unrelated call.
  const inner = records.find(
    (event) => event.type === 'tool.call' && event.definitionId === 'inner',
  );
  assert.equal(inner.parentInvocationId, result.invocation.invocationId);
  const [innerReceipt, outerReceipt] = registry.events;
  assert.equal(innerReceipt.parentInvocationId, outerReceipt.invocationId);
  assert.ok(Number.isFinite(innerReceipt.startedAtMs));
  assert.equal(innerReceipt.status, 'success');
  assert.equal(result.value, 7);
});

test('context model call uses the same result envelope, execution context and remaining call allowance', async () => {
  const diagnostics = createDiagnostics(),
    calls = [];
  const model = contextRunner({
    provider: {
      async *stream(messages, context) {
        calls.push(context);
        yield messages[0].content === 'compress' ? 'short' : 'answer';
      },
    },
    execution: { diagnostics },
    maxCalls: 2,
    contextPolicy: {
      mode: 'reduce',
      targetInputChars: 30,
      steps: [
        {
          id: 'reduce',
          kind: 'compress',
          fragmentId: 'history',
          targetChars: 25,
          handlerId: 'compressor',
        },
      ],
    },
    contextCompressors: [
      {
        id: 'compressor',
        async compress(request, context) {
          assert.equal(request.stageId, 'reply');
          assert.ok(context.signal);
          assert.ok(context.diagnostics);
          const result = await request.callModel({
            stageId: 'compress',
            input: [{ role: 'user', content: 'compress' }],
            transport: 'core:plain-text',
            maxOutputTokens: 10,
          });
          assert.equal(result.invocation.status, 'success');
          // The compression call is the first consumed model call of this
          // invocation, so it must already be reflected in the shared counter.
          assert.equal(result.invocation.callSequence, 1);
          return { history: result.value };
        },
      },
    ],
  });
  const result = await model.invoke({
    stageId: 'reply',
    input: {
      maxInputChars: 40,
      fragments: [
        {
          id: 'history',
          sourceId: 'history',
          trust: 'user',
          role: 'user',
          lifetime: 'turn',
          maxChars: 300,
          value: { history: 'x'.repeat(100) },
        },
      ],
    },
  });
  assert.equal(result.value, 'answer');
  // Compression plus answer consume the whole maxCalls budget, so the next
  // invocation must fail before reaching the provider.
  assert.equal(model.callCount, 2);
  assert.equal(calls.length, 2);
  await assert.rejects(
    model.invoke({
      input: {
        maxInputChars: 40,
        fragments: [
          {
            id: 'history',
            sourceId: 'history',
            trust: 'user',
            role: 'user',
            lifetime: 'turn',
            maxChars: 300,
            value: { history: 'short' },
          },
        ],
      },
    }),
    (error) => error instanceof BudgetError && error.code === getErrorInfo(error).code,
  );
});

test('a malformed response factory still closes the admitted model attempt exactly once', async () => {
  const calls = [];
  let providerCalls = 0;
  const model = new ModelRunner({
    provider: {
      async *stream() {
        providerCalls++;
      },
    },
    transports: [
      {
        id: 'broken',
        prepare: () => ({
          options: {},
          schemaChars: 0,
          createResponse: () => {
            throw new Error('factory failed');
          },
        }),
      },
    ],
    execution: {
      observe: {
        event: (fact) => {
          if (fact.type === 'model.end') calls.push(fact.payload.state);
        },
      },
    },
  });
  await assert.rejects(model.invoke({ input: 'question', transport: 'broken' }), /factory failed/);
  // A transport that fails while creating the response never reaches the
  // provider, yet the admitted attempt is counted and closed exactly once.
  assert.equal(providerCalls, 0);
  assert.equal(model.callCount, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].status, 'error');
  // A failed attempt must not leave a journal record behind.
  assert.equal(model.journal.snapshot().length, 0);
});

test('assertion callbacks cannot accidentally authorize work by returning booleans', async () => {
  let executions = 0;
  const models = new ModelCalls([
    {
      id: 'm',
      identity: 'local',
      assertInput: () => false,
      invoke: () => {
        executions++;
        return 'x';
      },
    },
  ]);
  await assert.rejects(
    models.invoke({ modelId: 'm', input: {}, timeoutMs: 100 }, { signal: signal() }),
    /assertions/,
  );
  const state = { queryCount: 0, seen: new Set(), sources: [] };
  const retrieval = defineRetrieval({
    id: 'read',
    description: 'read',
    assertInput() {},
    state: ({ app }) => app,
    limit: () => 1,
    authorize: () => false,
    execute: () => {
      executions++;
      return { sources: [] };
    },
  });
  assert.throws(() => retrieval.run({}, { app: state, signal: signal() }), /authorization/);
  assert.equal(executions, 0);
  assert.equal(state.seen.size, 0);
  assert.equal(state.queryCount, 0);
});

test('protocol callback receivers are pinned and asynchronous predicates/refinements cannot pass validation', async () => {
  class Command {
    #suffix = '!';
    fields = {
      text: { required: true, jsonSchema: { type: 'string' } },
      internal: { required: true, modelRequired: false },
    };
    format(value) {
      return value.text + this.#suffix;
    }
  }
  const command = new Command(),
    protocol = defineInteractionProtocol({ commandField: 'type', commands: { reply: command } });
  command.format = () => 'replaced';
  assert.equal(protocol.parse({ type: 'reply', text: 'ok', internal: true }), 'ok!');
  assert.ok(protocol.inputJsonSchema.anyOf[0].required.includes('internal'));
  assert.ok(!protocol.modelJsonSchema.anyOf[0].required.includes('internal'));
  for (const spec of [
    {
      refine: async () => {
        throw new Error('late');
      },
    },
    { checks: [{ occur: async () => false }] },
    { checks: [{ when: () => 1, occur: () => false }] },
  ]) {
    const invalid = defineInteractionProtocol({
      commandField: 'type',
      commands: { reply: { fields: {}, ...spec } },
    });
    assert.throws(() => invalid.parse({ type: 'reply' }), /synchronous|boolean/);
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
});

test('journal model and tool receipts share ordering and invocation metadata', () => {
  const journal = new ContextJournal();
  journal.model({
    stageId: 'reply',
    value: 'hello',
    invocation: { invocationId: 'model-1', startedAtMs: 0, durationMs: 0 },
  });
  const id = journal.beginTool({ toolId: 'read', input: {} });
  journal.finishTool({ invocationId: id, status: 'cancelled', value: 'stopped' });
  const snapshot = journal.snapshot();
  assert.deepEqual(
    snapshot.map((record) => record.producerSequence),
    [1, 2, 3],
  );
  assert.deepEqual(
    snapshot.map((record) => record.type),
    ['model', 'tool', 'tool-result'],
  );
  assert.equal(snapshot.at(-1).status, 'cancelled');
  assert.equal(snapshot.at(-1).invocationId, snapshot[1].invocationId);
  assert.equal(snapshot[0].value, 'hello');
  assert.equal('callId' in snapshot[1], false);
  assert.ok(snapshot.every((record) => Number.isFinite(record.startedAtMs)));
});

test('policy collections expose the same ordered query surface as other catalogs', () => {
  const policies = definePolicySet([
    { id: 'review', description: 'review', kind: 'check', when: () => true },
  ]);
  assert.deepEqual(policies.ids(), ['review']);
  assert.equal(policies.get('missing'), undefined);
  assert.throws(() => policies.require('missing'), /Unknown policy/);
  assert.equal(policies.definitions[0], policies.require('review'));
  assert.deepEqual(
    [...policies.entries()].map(([id]) => id),
    ['review'],
  );
});

test('answer generation distinguishes a present undefined value from an omitted map entry', async () => {
  const { defineAnswerFlow } = await import('../dist/esm/kits/answering/index.js');
  let checks = 0;
  const flow = defineAnswerFlow({
    maxItems: 2,
    maxRepairs: 0,
    reviewPolicy: 'off',
    canInvoke: () => true,
    generate: async () => new Map([['present', undefined]]),
    check: () => {
      checks++;
      return { status: 'passed', issues: [] };
    },
    fallback: () => ({ handled: false }),
  });
  const results = await flow.run(
    {
      inputIds: ['a', 'b'],
      items: [
        { id: 'present', inputIds: ['a'], sourceStatus: 'ready', data: {} },
        { id: 'missing', inputIds: ['b'], sourceStatus: 'ready', data: {} },
      ],
    },
    { app: {}, signal: signal() },
  );
  assert.equal(checks, 1);
  assert.equal(results[0].status, 'accepted');
  assert.equal(results[0].value, undefined);
  assert.equal(results[1].status, 'blocked');
  assert.ok(results[1].issues.some((issue) => issue.code === 'ANSWER_MISSING'));
});

test('metadata capture retains real tool boundaries without evaluating bodies or reported steps', () => {
  const records = [];
  let reports = 0;
  const diagnostics = createDiagnostics({
    runId: 'r',
    output: {
      accepts: (descriptor) => descriptor.content === 'metadata',
      write: (record) => records.push(record),
    },
  });
  const registry = new ToolRegistry({ execution: { diagnostics } });
  registry.register({
    id: 'read',
    kind: 'read',
    parseInput: (x) => x,
    parseOutput: (x) => x,
    execute: () => 'private value',
    debugSteps: (_value, context) => {
      reports++;
      return context.createSubFlowLogger();
    },
  });
  registry.invoke({ toolId: 'read', input: 'private input' });
  assert.deepEqual(
    records.map((record) => record.type),
    ['tool.call', 'tool.result'],
  );
  assert.equal('input' in records[0].payload, false);
  assert.equal('value' in records[1].payload, false);
  assert.equal(records[1].payload.status, 'success');
  assert.deepEqual(records[1].subSteps, []);
  assert.equal(reports, 0);
});

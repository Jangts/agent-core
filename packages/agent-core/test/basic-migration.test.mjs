/*
 * Baseline migration contract: the named-request form is the only supported
 * call shape, and the diagnostics identity it emits keeps working end to end.
 *
 * Covers `ModelRunner`, `ToolRegistry`, `Support` tool catalogs, `ModelCalls`,
 * diagnostics spans and `AgentCoreEngine` workflow visits. The point of the file
 * is that legacy field names (`stage`, `transportId`) and positional extra
 * arguments are rejected while values, budgets and span ancestry are unchanged.
 *
 * Runs on `dist/esm` with a single always-succeeding fake provider and a fake
 * diagnostics output that collects events in memory.
 */
import { contextRunner } from './context-workflow.fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDiagnostics,
  ModelRunner,
  ToolRegistry,
  Support,
  AgentCoreEngine,
  defineWorkflow,
} from '../dist/esm/index.js';
import { ModelCalls } from '../dist/esm/kits/inference.js';

const provider = {
  async *stream() {
    yield 'ok';
  },
};
test('named model and tool requests normalize to existing execution and reject mixed fields', async () => {
  const model = new ModelRunner({ execution: {},
    provider,
    maxCalls: 3,
    transports: [Support.createTextTransport({ id: 'text' })],
  });
  assert.equal(
    (await model.invoke({ input: 'x', stageId: 'reply', transport: 'text' })).value,
    'ok',
  );
  await assert.rejects(model.invoke({ input: 'x', stageId: 'new', stage: 'old' }), /Use stageId/);
  await assert.rejects(
    model.invoke({ input: 'x', transportId: 'text', transport: 'text' }),
    /Use transport/,
  );
  assert.equal(model.callCount, 1);
  const tools = new ToolRegistry().register({
    id: 'double',
    kind: 'pure',
    parseInput: (x) => x,
    execute: (x) => x * 2,
    parseOutput: (x) => x,
  });
  assert.equal(tools.invoke({ toolId: 'double', input: 3 }).value, 6);
  assert.equal((await tools.invokeAsync({ toolId: 'double', input: 4 })).value, 8);
  assert.throws(() => tools.invoke({ toolId: 'double', input: 1 }, 2), /one tool request/);
  assert.throws(() => tools.invoke({ toolId: 'double' }), /one tool request/);
  // Rejected requests must not emit receipts: only the two accepted invocations count.
  assert.equal(tools.events.length, 2);
});

test('typed Support runtime and external ModelCalls accept named requests without changing value', async () => {
  const catalog = Support.defineToolCatalog([
    Support.defineTool({
      id: 'read',
      kind: 'read',
      description: 'read',
      inputSchema: Support.defineSchema({
        jsonSchema: { type: 'object' },
        parse: (value) => value,
      }),
      authorize() {},
      execute: (value) => value.value,
      parseOutput: (value) => value,
    }),
  ]);
  const runtime = catalog.bind({ app: {}, execution: { signal: new AbortController().signal } });
  assert.equal((await runtime.invoke({ toolId: 'read', input: { value: 'text' } })).value, 'text');
  await assert.rejects(runtime.invoke({ toolId: 'read', input: 1 }, 2), /one tool request/);
  const models = new ModelCalls([{ id: 'other', identity: 'weights', invoke: async (x) => x * 2 }]);
  assert.equal(
    (
      await models.invoke(
        { modelId: 'other', input: 3, timeoutMs: 100 },
        { signal: new AbortController().signal },
      )
    ).value,
    6,
  );
});

test('Core diagnostics give stable scalar identities and preserve shared order across children', () => {
  const events = [],
    root = createDiagnostics({
      output: { write: (e) => events.push(e) },
      runId: 'run',
      spanId: 'root',
    });
  const child = root.child('call', {
    invocationId: 'invocation',
    definitionKind: 'tool',
    definitionId: 'read',
  });
  child.emit('tool.call', () => ({ toolId: 'read', invocationId: 'invocation', input: {} }));
  child.emit('tool.result', () => ({
    toolId: 'read',
    invocationId: 'invocation',
    result: 1,
    durationMs: 0,
  }));
  assert.deepEqual(
    events.map((e) => e.producerSequence),
    [1, 2],
  );
  // Event ids stay unique while `producerSequence` is shared with the parent, so a
  // child span cannot break the ordering observers rely on.
  assert.equal(new Set(events.map((e) => e.eventId)).size, 2);
  for (const event of events) {
    assert.equal(event.runId, 'run');
    assert.equal(event.spanId, 'root/call');
    assert.equal(event.parentSpanId, 'root');
    assert.equal(event.invocationId, 'invocation');
    assert.equal(event.definitionId, 'read');
    assert.equal(event.version, 2);
    assert.equal(Number.isFinite(event.occurredAtMs), true);
  }
  assert.ok(Object.isFrozen(child.identity));
  assert.ok(createDiagnostics({ output: { write() {} } }).identity.runId);
});

test('model result, log records and nested compression calls share real invocation ancestry', async () => {
  const events = [],
    diagnostics = createDiagnostics({ output: { write: (e) => events.push(e) }, runId: 'run' });
  const model = contextRunner({
    provider,
    maxCalls: 2,
    transports: [Support.createTextTransport({ id: 'text' })],
    contextPolicy: {
      mode: 'reduce',
      targetInputChars: 40,
      steps: [
        {
          id: 'compress',
          kind: 'compress',
          fragmentId: 'history',
          targetChars: 20,
          handlerId: 'compress',
        },
      ],
    },
    contextCompressors: [
      {
        id: 'compress',
        async compress(call) {
          return {
            history: (
              await call.callModel({
                stageId: 'compress',
                input: [{ role: 'user', content: 'shorten' }],
                maxOutputTokens: 10,
                transport: 'text',
              })
            ).value,
          };
        },
      },
    ],
    execution: { diagnostics: diagnostics },
  });
  const result = await model.invoke({
    stageId: 'reply',
    transport: 'text',
    input: {
      maxInputChars: 40,
      fragments: [
        {
          id: 'history',
          sourceId: 'test',
          trust: 'user',
          role: 'user',
          lifetime: 'turn',
          maxChars: 200,
          value: { history: 'x'.repeat(100) },
        },
      ],
    },
  });
  const completed = events.filter((e) => e.type === 'model.end');
  assert.equal(completed.length, 2);
  const outer = completed.find((e) => e.invocationId === result.invocation.invocationId);
  const inner = completed.find((e) => e.invocationId !== result.invocation.invocationId);
  // The outer event span is exactly the invocation's span; the nested compression
  // call shares the caller's workflow-node parent instead of nesting under it.
  assert.equal(outer.spanId, result.invocation.spanId);
  const parent = events.find((e) => e.spanId === inner.parentSpanId);
  const outerParent = events.find((event) => event.spanId === outer.parentSpanId);
  assert.equal(parent.nodeRole, 'workflow-node');
  assert.equal(outerParent.nodeRole, 'workflow-node');
  assert.equal(parent.parentSpanId, outerParent.parentSpanId);
  assert.equal(inner.workflowInvocationId, outer.workflowInvocationId);
  assert.equal(inner.runId, outer.runId);
});

test('workflow visits use distinct spans and report declared route and condition IDs', async () => {
  const events = [],
    diagnostics = createDiagnostics({ output: { write: (e) => events.push(e) }, runId: 'run' });
  const model = new ModelRunner({ provider, maxCalls: 2, execution: { diagnostics: diagnostics } });
  const flow = defineWorkflow({
    id: 'flow',
    revision: 'r1',
    entryNodeId: 'round',
    isResult: (value) => value === 'ok',
    nodes: [
      {
        id: 'round',
        description: 'Round',
        startsRound: true,
        async run(state, context) {
          const result = await model.invoke({ input: 'x', diagnostics: context.diagnostics });
          return { count: state.count + 1, text: result.value };
        },
        routes: [
          {
            id: 'done',
            conditionId: 'count-two',
            when: (state) => state.count === 2,
            complete: (state) => state.text,
          },
          { id: 'repeat', targetNodeId: 'round' },
        ],
      },
    ],
  });
  assert.equal(
    await new AgentCoreEngine({ maxRounds: 2, execution: { diagnostics } })
      .bindWorkflow(flow)
      .run({ count: 0 }),
    'ok',
  );
  const workflow = events.filter((e) => e.type === 'workflow.event');
  const enters = workflow.filter((e) => e.payload.event.type === 'enter');
  // Each loop round is a new span even though the node id repeats; reusing a span
  // would merge two visits into one trace node.
  assert.notEqual(enters[0].spanId, enters[1].spanId);
  assert.equal(enters[0].definitionId, 'flow');
  assert.equal(enters[0].definitionRevision, 'r1');
  assert.equal(enters[0].nodeId, 'round');
  assert.equal(workflow.at(-1).payload.event.routeId, 'done');
  assert.equal(workflow.at(-1).payload.event.conditionId, 'count-two');
  const models = events.filter((e) => e.type === 'model.prepare');
  // Model calls must be parented to the enter span of the round that issued them,
  // in the same order as the visits.
  assert.deepEqual(
    models.map((e) => e.parentSpanId),
    enters.map((e) => e.spanId),
  );
});

test('invalid route identities and async predicates fail without routing through business recovery', async () => {
  assert.throws(
    () =>
      defineWorkflow({
        id: 'flow',
        entryNodeId: 'round',
        nodes: [
          {
            id: 'round',
            description: 'Round',
            startsRound: true,
            routes: [
              { id: ' ', when: () => false, targetNodeId: 'round' },
              { id: 'same', complete: () => 1 },
            ],
          },
        ],
      }),
    /route identity/,
  );
  let recovered = false;
  const flow = defineWorkflow({
    id: 'flow',
    entryNodeId: 'round',
    nodes: [
      {
        id: 'round',
        description: 'Round',
        startsRound: true,
        onErrorNodeId: 'recovery',
        routes: [
          { when: () => Promise.reject(new Error('late')), complete: () => 1 },
          { complete: () => 2 },
        ],
      },
      {
        id: 'recovery',
        description: 'Recovery',
        run() {
          recovered = true;
        },
        routes: [{ complete: () => 3 }],
      },
    ],
  });
  await assert.rejects(
    new AgentCoreEngine().bindWorkflow(flow).run({}),
    /predicates must be synchronous/,
  );
  // An async predicate is a contract violation, not a business error: it must fail
  // the run instead of being handed to `onErrorNodeId` recovery.
  assert.equal(recovered, false);
  await new Promise((resolve) => setImmediate(resolve));
});

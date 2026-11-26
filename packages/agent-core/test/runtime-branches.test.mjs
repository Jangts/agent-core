/**
 * Locks down runtime branch boundaries across registry views, engine/model/tool binding,
 * workflow transitions and Support helpers: every unsupported input must fail at its own
 * boundary with a stable diagnostic. Runs under node --test over built dist/esm modules
 * with in-memory fixtures and no provider network.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AgentCoreEngine,
  defineWorkflow,
  ModelRunner,
  ModelToolRegistry,
  ToolRegistry,
  Support,
  createDiagnostics,
  executeInvocation,
  validateContextFragment,
  assembleContextPlan,
} from '../dist/esm/index.js';
import { GoalRegistry, ScopeRegistry } from '../dist/esm/kits/domains/index.js';
import {
  defineAnswerTaskCatalog,
  defineAnswerReaderCatalog,
} from '../dist/esm/kits/answering/tasks.js';
import { ModelCalls } from '../dist/esm/kits/inference.js';
import { CommandCatalog } from '../dist/esm/kits/interaction/commands.js';
import { defineCommand, commandSchema } from '../dist/esm/kits/interaction/command.js';
import { bindInteraction } from '../dist/esm/kits/interaction/handlers.js';
import { ModelCallBudget } from '../dist/esm/model/call-budget.js';
import { createPlainTextTransport, normalizeModelTransport } from '../dist/esm/model/transports.js';

test('text transport can retain surrounding whitespace when its caller opts out of trimming', () => {
  const collector = createPlainTextTransport('verbatim', {}, false).prepare('test').createResponse();
  collector.push('  text\n');
  assert.equal(collector.finish(), '  text\n');
});
import { historyGroupingCatalog } from '../dist/esm/support/context/history.js';
import { parseJsonFrames } from '../dist/esm/support/transport/json.js';
const schema = { jsonSchema: { type: 'object' }, parse: (value) => value };
const provider = {
  async *stream() {
    yield 'ok';
  },
};
const execution = () => ({ app: {}, signal: new AbortController().signal });
const tool = {
  id: 'read',
  kind: 'read',
  description: 'Read',
  parseInput: (value) => value,
  parseOutput: (value) => value,
  execute: (value) => value,
};
test('public registry views agree on identity, availability and snapshot contents', () => {
  const capability = {
    id: 'read',
    description: 'Read',
    inputSchema: schema,
    resolve: (value) => value,
  };
  const modelTools = new ModelToolRegistry();
  modelTools.registerAll([capability]);
  assert.deepEqual(modelTools.ids(), ['read']);
  const tools = new ToolRegistry().register(tool);
  assert.deepEqual(tools.ids(), ['read']);
  const intents = new GoalRegistry().register({
    id: 'read',
    description: 'Read',
    delegates: ['read'],
  });
  assert.equal(intents.has('read'), true);
  assert.equal(intents.definitions.length, 1);
  assert.equal([...intents.values()].length, 1);
  const scopes = new ScopeRegistry().register({
    id: 'docs',
    description: 'Docs',
    category: 'docs',
  });
  assert.deepEqual(scopes.ids(), ['docs']);
  assert.equal(scopes.definitions.length, 1);
  assert.equal([...scopes.values()].length, 1);
  const workflow = defineWorkflow({
    id: 'flow',
    nodes: [{ id: 'read', description: 'Read', routes: [{ complete: () => 7 }] }],
  });
  assert.equal(workflow.has('read'), true);
  assert.equal([...workflow.values()].length, 1);
  assert.equal([...workflow.entries()].length, 1);
  const calls = new ModelCalls([{ id: 'read', identity: 'weights', invoke: (value) => value }]);
  assert.equal(calls.definitions.length, 1);
  assert.deepEqual(calls.ids(), ['read']);
  assert.equal(calls.has('read'), true);
  assert.equal(calls.get('read').identity, 'weights');
  assert.equal([...calls.values()].length, 1);
  assert.equal([...calls.entries()].length, 1);
  const commands = new CommandCatalog([['read', defineCommand({ fields: [] })]]);
  assert.equal(commands.definitions.length, 1);
  assert.throws(() => commands.delete('read'));
  assert.throws(() => commands.clear());
});
test('a bound request runtime exposes the same live call counters to every workflow phase', async () => {
  const runner = new ModelRunner({ execution: {}, provider, maxCalls: 3 }),
    counters = [];
  const engine = new AgentCoreEngine().bindModelRuntime(runner).bindWorkflow(
    defineWorkflow({
      id: 'flow',
      nodes: [
        {
          id: 'read',
          description: 'Read',
          async run(_state, { model }) {
            counters.push([model.remainingCalls, model.callCount, model.totalCallCount]);
            await model.invoke({ input: 'question' });
            counters.push([model.remainingCalls, model.callCount, model.totalCallCount]);
          },
          routes: [{ complete: () => 'ok' }],
        },
      ],
    }),
  );
  assert.equal(await engine.run({}), 'ok');
  // Counter order is [remainingCalls, callCount, totalCallCount]; the node sees the live
  // values before and after its single call.
  assert.deepEqual(counters, [
    [3, 0, 0],
    [2, 1, 1],
  ]);
  await assert.rejects(
    new AgentCoreEngine().run(() => ({ type: 'complete', value: 7 }), { modelId: 'unknown' }),
  );
  const noModel = new AgentCoreEngine({
    workflow: defineWorkflow({
      id: 'flow',
      nodes: [
        {
          id: 'read',
          description: 'Read',
          run: (_state, ctx) => ctx.model.invoke({ input: 'x' }),
          routes: [{ complete: () => 7 }],
        },
      ],
    }),
  });
  await assert.rejects(noModel.run({}), /modelId/);
  const noTools = new AgentCoreEngine({
    workflow: defineWorkflow({
      id: 'flow',
      nodes: [
        {
          id: 'read',
          description: 'Read',
          run: (_state, ctx) => ctx.tools.invoke({ toolId: 'read', input: {} }),
          routes: [{ complete: () => 7 }],
        },
      ],
    }),
  });
  await assert.rejects(noTools.run({}), /tool runtime/);
});
test('workflow async predicates/completions, foreign preparations and class report transitions fail at their own boundary', async () => {
  // Route predicates and completions are synchronous by contract; a truthy return or a
  // rejected promise must both be refused rather than awaited.
  for (const when of [() => 7, () => Promise.reject(Error('late predicate'))]) {
    const workflow = defineWorkflow({
      id: 'flow',
      nodes: [
        {
          id: 'read',
          description: 'Read',
          routes: [{ when, conditionId: 'test', complete: () => 7 }],
        },
      ],
    });
    await assert.rejects(new AgentCoreEngine({ workflow }).run({}), /predicates/);
  }
  const asyncComplete = defineWorkflow({
    id: 'flow',
    nodes: [
      {
        id: 'read',
        description: 'Read',
        routes: [{ complete: () => Promise.reject(Error('late completion')) }],
      },
    ],
  });
  await assert.rejects(new AgentCoreEngine({ workflow: asyncComplete }).run({}), /completions/);
  const foreign = new ModelRunner({ execution: {}, provider }).prepare();
  const workflow = defineWorkflow({
    id: 'flow',
    nodes: [
      {
        id: 'read',
        name: 'Named',
        description: 'Read',
        run: (_state, ctx) => ctx.model.invoke({ input: 'x', prepared: foreign }),
        routes: [{ id: 'finish', description: 'Finish', complete: () => 7 }],
      },
    ],
  });
  await assert.rejects(
    new AgentCoreEngine({ workflow, model: { provider } }).run({}),
    /another execution/,
  );
  // A preparation created by another runner must not be reusable here.
  const records = [],
    diagnostics = createDiagnostics({ output: { write: (event) => records.push(event) } });
  const reporting = defineWorkflow({
    id: 'flow',
    nodes: [
      {
        id: 'read',
        name: 'Named',
        description: 'Read',
        run: () => ({ value: 1 }),
        report: (update) => ({ payload: update }),
        routes: [{ id: 'next', description: 'Next', targetNodeId: 'finish' }],
      },
      { id: 'finish', description: 'Finish', routes: [{ complete: () => 7 }] },
    ],
  });
  const extended = reporting.add({ nodes: [], routes: {} });
  assert.equal(extended.describe()[0].name, 'Named');
  assert.equal(
    await new AgentCoreEngine({ workflow: extended, execution: { diagnostics } }).run({}),
    7,
  );
  assert.ok(records.some((event) => event.payload.payload?.value === 1));
});
test('metadata-only and identity-free diagnostic implementations preserve tool and workflow behavior', async () => {
  const output = [],
    diagnostic = createDiagnostics({
      output: {
        accepts: ({ content }) => content === 'metadata',
        write: (event) => output.push(event),
      },
    });
  executeInvocation(
    { id: 'read', call() {} },
    { private: 'input' },
    {},
    { diagnostics: () => diagnostic },
  );
  assert.throws(() =>
    executeInvocation(
      {
        id: 'read',
        call() {
          throw Error('failed');
        },
      },
      {},
      {},
      { diagnostics: () => diagnostic },
    ),
  );
  const tools = new ToolRegistry({ execution: { diagnostics: diagnostic } }).register({
    ...tool,
    execute() {
      throw Error('failed');
    },
  });
  assert.throws(() => tools.invoke({ toolId: 'read', input: {} }));
  const flat = {
    enabled: () => false,
    emit() {},
    deliver: async (_type, _payload, _sink) => {},
    child() {
      return this;
    },
    withObserver() {
      return this;
    },
  };
  const workflow = defineWorkflow({
    id: 'flat',
    nodes: [
      { id: 'one', description: 'One', routes: [{ targetNodeId: 'two' }] },
      { id: 'two', description: 'Two', routes: [{ complete: () => 7 }] },
    ],
  });
  assert.equal(
    await new AgentCoreEngine({ workflow, execution: { diagnostics: flat } }).run({}),
    7,
  );
  // Only the 'metadata' content channel may observe events; private inputs never surface.
  assert.ok(output.every((event) => !JSON.stringify(event.payload).includes('private')));
});
test('fragment, history, schema and response helpers reject incomplete or incorrectly dispatched contracts', () => {
  const fragment = {
    id: 'data',
    sourceId: 'test',
    trust: 'user',
    lifetime: 'turn',
    role: 'user',
    maxChars: 100,
    value: { data: 1 },
  };
  // Each patch violates one fragment contract: id shape, enum membership, or size/value.
  for (const patch of [
    { id: 'INVALID' },
    { trust: 'unknown' },
    { lifetime: 'unknown' },
    { role: 'unknown' },
    { maxChars: 0 },
    { value: null },
    { value: [] },
    { maxChars: 1 },
  ])
    assert.throws(() => validateContextFragment({ ...fragment, ...patch }));
  const limited = [{ ...fragment }];
  assert.throws(() =>
    assembleContextPlan({
      originalFragments: limited,
      fragments: [{ ...fragment, value: { data: 2 } }],
      maxInputChars: 100,
    }),
  );
  // A mutable fragment may rewrite its value, but turning a null value into an object still
  // changes the declared field set and must not slip past the structural audit.
  const nullable = { ...fragment, value: null };
  assert.throws(
    () =>
      assembleContextPlan({
        originalFragments: [nullable],
        fragments: [{ ...nullable, value: { injected: true } }],
        maxInputChars: 100,
        mutableFragmentIds: ['data'],
      }),
    (error) => error.issues?.some((issue) => issue.message === 'Context fields must be preserved'),
  );
  for (const method of ['validate', 'split'])
    assert.throws(() =>
      method === 'validate'
        ? historyGroupingCatalog.fixed.validate({ kind: 'user-turn' })
        : historyGroupingCatalog.fixed.split([], { kind: 'user-turn' }),
    );
  assert.throws(() => parseJsonFrames('{}', { maxFrames: 0, maxExtraClosings: 0 }));
  assert.throws(() => parseJsonFrames(' ', { maxFrames: 1, maxExtraClosings: 0 }));
  assert.throws(() => normalizeModelTransport({ id: '', prepare() {} }));
  assert.throws(() =>
    createPlainTextTransport('text')
      .prepare('test')
      .createResponse()
      .push({ type: 'function-call-delta' }),
  );
  const budget = new ModelCallBudget(0);
  assert.throws(() => budget.take());
});
test('answer reader catalogs preserve task descriptions, custom validation and missing-reader errors', () => {
  assert.throws(() => defineAnswerReaderCatalog([{ id: 'bad', read: 7 }]));
  const readers = defineAnswerReaderCatalog([{ id: 'reader', read: (value) => value }]);
  assert.throws(() => readers.require('missing'));
  const task = {
    id: 'task',
    description: 'Task',
    inputSchema: schema,
    readerId: 'reader',
    outputId: 'output',
    goalIds: ['read'],
    checkIds: [],
  };
  const catalog = defineAnswerTaskCatalog([task], {
    readers,
    outputs: { ids: () => ['output'] },
    checks: { ids: () => [] },
    assertDefinition() {},
  });
  assert.deepEqual(catalog.describe()[0].inputJsonSchema, schema.jsonSchema);
  assert.throws(() => catalog.require('missing'));
  assert.throws(() => Support.defineContextFragments([]).build({ input: {} }));
  assert.deepEqual(commandSchema('read', { keys: () => ['kind'] }), {
    type: 'object',
    properties: { type: { type: 'string', enum: ['read'] } },
    required: ['type'],
    additionalProperties: true,
  });
  const protocol = {
    commands: { manifest: () => [{ id: 'one', modes: ['smart'] }] },
    receive: (value) => ({ id: 'one', result: value }),
  };
  assert.equal(bindInteraction(protocol, { one: (value) => value }).dispatch(7, {}), 7);
});

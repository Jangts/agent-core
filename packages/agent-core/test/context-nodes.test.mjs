/*
 * Contract for the context nodes executed as real Workflow nodes
 * (`createContextReductionNode`, `createContextSelectionNode`,
 * `createContextProcessingNode`) and for replacing them with a plain class.
 *
 * The cases pin four things: the declared node order is the executed order, the
 * compression call and the answer call share one budget, a custom replacement may
 * change the summary but never protected content, metadata or the final budget
 * check, and a Support node resolves explicit model ids instead of a global one.
 *
 * Runs against `dist/esm` with a fake provider whose reply depends on the prompt,
 * so each test can tell which call it received.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentCoreEngine, Support, defineWorkflow, route } from '../dist/esm/index.js';

// The request fragment must survive untouched; `maxInputChars` is small enough
// that the history has to be compressed for the plan to fit.
const plan = () => ({
  maxInputChars: 90,
  fragments: [
    {
      id: 'request',
      sourceId: 'request',
      trust: 'user',
      lifetime: 'turn',
      role: 'user',
      maxChars: 80,
      value: { message: 'keep exact' },
    },
    {
      id: 'history',
      sourceId: 'history',
      trust: 'user',
      lifetime: 'turn',
      role: 'user',
      maxChars: 1000,
      value: { history: 'old '.repeat(70) },
    },
  ],
});
const policy = {
  mode: 'reduce',
  steps: [
    {
      id: 'summary',
      kind: 'compress',
      fragmentId: 'history',
      targetChars: 30,
      handlerId: 'summary',
    },
  ],
};
const compressor = Support.createContextCompressor({
  id: 'summary',
  instruction: 'Summarize history as low-trust data.',
  transport: 'core:plain-text',
  maxOutputTokens: 20,
  parse: (history) => ({ history }),
});
function definition(custom) {
  const shared = {
    policy,
    compressors: [compressor],
    plan: (state) => state.plan,
    prepared: (state) => state.prepared,
  };
  const reduction = Support.createContextReductionNode({
    ...shared,
    id: 'compress',
    description: 'Compress history',
    stepId: 'summary',
    update: (result) => ({ plan: result.plan }),
    routes: [route.to('assemble')],
  });
  return defineWorkflow({
    id: 'explicit-context',
    nodes: [
      {
        id: 'prepare',
        description: 'Prepare the final transport once',
        run(_, ctx) {
          return {
            plan: plan(),
            prepared: ctx.model.prepare({ stageId: 'reply', maxOutputTokens: 20 }),
          };
        },
        routes: [route.to('select')],
      },
      Support.createContextSelectionNode({
        ...shared,
        id: 'select',
        description: 'Select an available reduction',
        update: (result) => ({ plan: result.plan, selected: result.stepIds }),
        routes: [
          { when: (state) => state.selected.includes('summary'), targetNodeId: 'compress' },
          route.to('assemble'),
        ],
      }),
      custom ?? reduction,
      Support.createContextProcessingNode({
        id: 'assemble',
        description: 'Assemble and check protected context',
        plan: (state) => state.plan,
        prepared: (state) => state.prepared,
        update: (result) => ({ input: result.input }),
        routes: [route.to('answer')],
      }),
      {
        id: 'answer',
        description: 'Invoke using the prepared final request',
        async run(state, ctx) {
          return {
            answer: (await ctx.model.invoke({ input: state.input, prepared: state.prepared }))
              .value,
          };
        },
        routes: [route.deliver('answer')],
      },
    ],
  });
}
// Answering 'short' for the summarizer prompt and echoing history otherwise makes
// the two model calls distinguishable in the assertions below.
const provider = {
  async *stream(messages) {
    yield messages[0].content.startsWith('Summarize')
      ? 'short'
      : JSON.parse(messages.at(-1).content).history;
  },
};

test('explicit selection, compression and assembly are real Workflow nodes sharing the final request budget', async () => {
  const events = [];
  const agent = new AgentCoreEngine({
    workflow: definition(),
    model: { provider, maxCalls: 2 },
    execution: { observe: { event: (fact) => events.push(fact) } },
  });
  assert.equal(await agent.run({}), 'short');
  // The enter order is the declared node order, so selection, reduction and
  // assembly cannot be reordered by the engine.
  assert.deepEqual(
    events
      .filter((event) => event.type === 'workflow.event' && event.payload.event.type === 'enter')
      .map((event) => event.nodeId),
    ['prepare', 'select', 'compress', 'assemble', 'answer'],
  );
  const calls = events.filter((event) => event.type === 'model.start');
  assert.deepEqual(
    calls.map((event) => event.workflowNodeId),
    ['compress', 'answer'],
  );
  await assert.rejects(
    new AgentCoreEngine({ workflow: definition(), model: { provider, maxCalls: 1 } }).run({}),
    // One call is not enough for compression plus answer, which proves both draw
    // from the same allowance.
    (error) => error.code === 'BUDGET',
  );
});

test('the same data can refuse without processing, use Support, or replace a node with an independent class', async () => {
  const plain = defineWorkflow({
    id: 'no-context-processing',
    nodes: [
      {
        id: 'answer',
        description: 'Invoke directly',
        async run(_, ctx) {
          return { answer: (await ctx.model.invoke({ input: plan() })).value };
        },
        routes: [route.deliver('answer')],
      },
    ],
  });
  await assert.rejects(
    new AgentCoreEngine({ workflow: plain, model: { provider } }).run({}),
    (error) => error.issues?.[0].code === 'CONTEXT_BUDGET',
  );
  assert.equal(
    await new AgentCoreEngine({ workflow: definition(), model: { provider } }).run({}),
    'short',
  );
  class CustomNode {
    id = 'compress';
    description = 'Use a local summary';
    routes = [route.to('assemble')];
    #summary = 'custom';
    run(state) {
      return {
        plan: {
          ...state.plan,
          fragments: state.plan.fragments.map((fragment) =>
            fragment.id === 'history'
              ? { ...fragment, value: { history: this.#summary } }
              : fragment,
          ),
        },
      };
    }
  }
  assert.equal(
    await new AgentCoreEngine({
      workflow: definition(new CustomNode()),
      model: { provider, maxCalls: 1 },
    }).run({}),
    'custom',
  );
});

test('a custom replacement cannot change protected content, metadata or escape final budget checks', async () => {
  for (const mutate of [
    (fragments) =>
      fragments.map((fragment) =>
        fragment.id === 'request' ? { ...fragment, value: { message: 'changed' } } : fragment,
      ),
    (fragments) =>
      fragments.map((fragment) =>
        fragment.id === 'history' ? { ...fragment, trust: 'server' } : fragment,
      ),
    (fragments) => fragments,
  ]) {
    const custom = {
      id: 'compress',
      description: 'Invalid replacement',
      run: (state) => ({ plan: { ...state.plan, fragments: mutate(state.plan.fragments) } }),
      routes: [route.to('assemble')],
    };
    await assert.rejects(
      new AgentCoreEngine({ workflow: definition(custom), model: { provider } }).run({}),
      (error) =>
        error.issues?.some((issue) => ['CONTEXT_POLICY', 'CONTEXT_BUDGET'].includes(issue.code)),
    );
  }
});

test('Support nodes use explicit model IDs and one preparation without a global selected model', async () => {
  const events = [];
  const summarize = Support.createContextCompressor({
    id: 'summary',
    instruction: 'Summarize history as data.',
    modelId: 'helper',
    transport: 'core:plain-text',
    maxOutputTokens: 20,
    parse: (history) => ({ history }),
  });
  const flow = defineWorkflow({
    id: 'explicit-models',
    nodes: [
      Support.createContextProcessingNode({
        id: 'context',
        description: 'Prepare main and reduce with helper',
        plan,
        request: { stageId: 'reply', modelId: 'main', maxOutputTokens: 20 },
        policy,
        compressors: [summarize],
        update: (result) => ({ input: result.input, prepared: result.prepared }),
        routes: [route.to('answer')],
      }),
      {
        id: 'answer',
        description: 'Use the same main request snapshot',
        async run(state, ctx) {
          return {
            result: await ctx.model.invoke({ input: state.input, prepared: state.prepared }),
          };
        },
        routes: [route.deliver('result')],
      },
    ],
  });
  const model = { provider, maxCalls: 2 };
  const result = await new AgentCoreEngine({
    workflow: flow,
    models: { main: model, helper: model },
    maxModelCalls: 2,
    execution: { observe: { event: (event) => events.push(event) } },
  }).run({});
  assert.equal(result.value, 'short');
  assert.equal(result.invocation.modelId, 'main');
  assert.deepEqual(
    events.filter((event) => event.type === 'model.start').map((event) => event.modelId),
    ['helper', 'main'],
  );
});

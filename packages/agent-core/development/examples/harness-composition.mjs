/**
 * Offline R0/R1 probe: a native Agent inside an ordinary workflow node.
 * Uses public exports and one request-bound model ledger. No network or durable storage.
 */
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import {
  AgentCoreEngine,
  BudgetError,
  ModelRunner,
  Support,
  defineWorkflow,
  route,
} from '@jangts/agent-core';

const text = Support.defineSchema({
  jsonSchema: { type: 'string', minLength: 1 },
  parse(value) {
    if (typeof value !== 'string' || !value.trim()) throw new TypeError('Expected nonempty text');
    return value;
  },
});
const noteInput = Support.defineSchema({
  jsonSchema: {
    type: 'object',
    properties: { note: text.jsonSchema },
    required: ['note'],
    additionalProperties: false,
  },
  parse(value) {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.keys(value).length !== 1
    )
      throw new TypeError('Expected a note object');
    return { note: text.parse(value.note) };
  },
});

/** Validate delivery separately from the confirmed tool receipt. */
function parseDelivery(value, receipt) {
  const result = JSON.parse(value);
  if (result?.receipt !== receipt || typeof result?.message !== 'string' || !result.message.trim())
    throw new TypeError('Delivery must reference the confirmed receipt');
  return result;
}

/** R0 needs only a Provider and a single invocation. */
export async function runMinimal() {
  const model = new ModelRunner({
    provider: {
      async *stream() {
        yield 'hello';
      },
    },
  });
  const result = await model.invoke('hello');
  assert.equal(result.value, 'hello');
  return result.value;
}

/**
 * Assemble one request. The App supplies authorization and a local side-effect port.
 * Counters are observations only: ModelRunner enforces the actual shared allowance.
 */
export function createComposition({ canSave = true, provider, signal, saveNote, observe } = {}) {
  const calls = { provider: [], authorization: 0, saves: 0, repairs: 0 };
  const receipts = new Map();
  const denied = new Error('Saving is not authorized');
  const execution = { signal: signal ?? new AbortController().signal, observe };
  const responses = new Map([
    ['prepare', 'note'],
    ['choose', 'save'],
    ['after:receipt-1', 'Saved receipt-1'],
    ['repair:receipt-1', JSON.stringify({ receipt: 'receipt-1', message: 'Saved' })],
  ]);
  const selectedProvider = provider ?? {
    async *stream(messages) {
      const input = messages.at(-1).content;
      if (!responses.has(input)) throw new Error(`Unexpected offline prompt: ${input}`);
      yield responses.get(input);
    },
  };
  const model = new ModelRunner({
    execution,
    maxCalls: 4,
    provider: {
      async *stream(messages, options) {
        const input = messages.at(-1).content;
        calls.provider.push(input);
        yield* selectedProvider.stream(messages, options);
      },
    },
  });
  const catalog = Support.defineToolCatalog([
    {
      id: 'save_note',
      kind: 'write',
      description: 'Save one note in the request-local example store',
      inputSchema: noteInput,
      authorize(_, { app }) {
        calls.authorization++;
        if (!app.canSave) throw denied;
      },
      async execute({ note }, context) {
        calls.saves++;
        const receipt = `receipt-${calls.saves}`;
        // An App port may complete after cancellation; Core cannot undo its side effect.
        await saveNote?.(note, { ...context, receipt });
        receipts.set(receipt, note);
        return receipt;
      },
      parseOutput: text.parse,
    },
  ]);
  const childWorkflow = defineWorkflow({
    id: 'bounded-note-agent',
    nodes: [
      {
        id: 'decide',
        description: 'Choose an authorized operation or return the final draft',
        startsRound: true,
        async run(state, ctx) {
          const input = state.receipt ? `after:${state.receipt}` : 'choose';
          return { decision: (await ctx.model.invoke({ input })).value };
        },
        routes: [
          {
            when: (state) => state.decision === 'save' && !state.receipt,
            targetNodeId: 'save',
          },
          {
            when: (state) => !!state.receipt,
            complete: (state) => ({ receipt: state.receipt, draft: state.decision }),
          },
        ],
      },
      {
        id: 'save',
        description: 'Execute the registered tool after App authorization',
        async run(state, ctx) {
          const result = await ctx.tools.invoke({
            toolId: 'save_note',
            input: { note: state.note },
          });
          return { receipt: result.value };
        },
        routes: [{ targetNodeId: 'decide' }],
      },
    ],
  });
  let childModel;
  const parentWorkflow = defineWorkflow({
    id: 'harness-composition',
    nodes: [
      {
        id: 'prepare',
        description: 'Prepare the child input using the same request model',
        async run(_, ctx) {
          return { note: (await ctx.model.invoke({ input: 'prepare' })).value };
        },
        routes: [{ targetNodeId: 'agent' }],
      },
      {
        id: 'agent',
        description: 'Wrap a complete bounded native Agent in an ordinary node',
        async run(state, ctx) {
          childModel = model.createChild({
            id: 'note-agent',
            maxCalls: 2,
            reserveCalls: 1,
            timeoutMs: 5000,
            signal: ctx.signal,
            diagnostics: ctx.diagnostics,
          });
          const childExecution = { signal: childModel.execution.signal };
          const tools = catalog.bind({ app: { canSave }, execution: childExecution });
          const child = new AgentCoreEngine({ maxRounds: 2, execution: childExecution })
            .bindWorkflow(childWorkflow)
            .bindModelRuntime(childModel)
            .bindToolRuntime(tools);
          return { childResult: await child.run({ note: state.note }) };
        },
        routes: [{ targetNodeId: 'check' }],
      },
      {
        id: 'check',
        description: 'Check delivery after retaining the confirmed child result',
        onErrorNodeId: 'repair',
        run(state) {
          return { delivery: parseDelivery(state.childResult.draft, state.childResult.receipt) };
        },
        routes: [route.deliver('delivery')],
      },
      {
        id: 'repair',
        description: 'Repair only delivery; this parent has no tool runtime',
        async run(state, ctx) {
          // A formatting failure never routes back to the child or the save operation.
          calls.repairs++;
          const { receipt } = state.childResult;
          const result = await ctx.model.invoke({ input: `repair:${receipt}` });
          return { delivery: parseDelivery(result.value, receipt) };
        },
        routes: [route.deliver('delivery')],
      },
    ],
  });
  const parent = new AgentCoreEngine({ maxRounds: 1, execution })
    .bindWorkflow(parentWorkflow)
    .bindModelRuntime(model);
  return {
    parent,
    model,
    calls,
    receipts,
    denied,
    get childModel() {
      return childModel;
    },
  };
}

/** Exercise the thin slice and report measured facts, not full harness acceptance. */
export async function runComposition() {
  const allowed = createComposition();
  const delivery = await allowed.parent.run({});
  assert.deepEqual(delivery, { receipt: 'receipt-1', message: 'Saved' });
  assert.deepEqual(allowed.calls.provider, [
    'prepare',
    'choose',
    'after:receipt-1',
    'repair:receipt-1',
  ]);
  assert.equal(allowed.calls.authorization, 1);
  assert.equal(allowed.calls.saves, 1);
  assert.equal(allowed.calls.repairs, 1);
  assert.equal(allowed.receipts.get(delivery.receipt), 'note');
  assert.equal(allowed.model.callCount, 2);
  assert.equal(allowed.childModel.callCount, 2);
  assert.equal(allowed.model.totalCallCount, 4);
  // An attempted fifth call must be rejected before reaching the Provider.
  await assert.rejects(allowed.model.invoke('over-budget'), BudgetError);
  assert.equal(allowed.calls.provider.length, 4);
  assert.equal(allowed.model.totalCallCount, 4);

  const rejected = createComposition({ canSave: false });
  await assert.rejects(rejected.parent.run({}), (error) => error === rejected.denied);
  assert.equal(rejected.calls.authorization, 1);
  assert.equal(rejected.calls.saves, 0);
  assert.equal(rejected.calls.repairs, 0);
  assert.equal(rejected.receipts.size, 0);
  assert.equal(rejected.model.totalCallCount, 2);
  return {
    delivery,
    allowed: {
      ...allowed.calls,
      parentCalls: allowed.model.callCount,
      childCalls: allowed.childModel.callCount,
      totalCalls: allowed.model.totalCallCount,
    },
    denied: { ...rejected.calls, totalCalls: rejected.model.totalCallCount },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify({ r0: await runMinimal(), r1Probe: await runComposition() }, null, 2));
}

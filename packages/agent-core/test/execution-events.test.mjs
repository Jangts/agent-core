// Locks the live execution-event contract: observation cannot mutate, block or fail a run, event
// identity and spans stay consistent across consumers, and cancellation retracts late progress.
// Covers `AgentCoreEngine`, `ModelRunner`, `ToolRegistry` and `createDiagnostics` from dist/esm.
// Runs with `node --test` using in-process providers and workflow fixtures, with no transport mocks.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AgentCoreEngine,
  ModelRunner,
  ToolRegistry,
  createDiagnostics,
  defineWorkflow,
  route,
} from '../dist/esm/index.js';

// Deferred gates let a test pause a run mid-step and assert state before completion.
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const tool = {
  id: 'lookup',
  kind: 'read',
  parseInput: (value) => value,
  parseOutput: (value) => value,
  execute: () => 'original receipt',
};
const observe = (events) => ({ accepts: () => true, event: (event) => events.push(event) });

test('one live request observes model, tool and real node progress with persistence disabled', async () => {
  const events = [],
    sinks = [],
    gate = deferred(),
    entered = deferred();
  let providerCalls = 0;
  // Same Core contract, no Support or logging factory is required.
  const flow = defineWorkflow({
    id: 'answer-with-context',
    nodes: [
      {
        id: 'decide',
        description: 'Request the tool',
        async run(_, ctx) {
          const result = await ctx.model.invoke({ input: 'lookup the service' });
          return { decision: result.value };
        },
        routes: [route.to('lookup')],
      },
      {
        id: 'lookup',
        description: 'Read the actual receipt',
        async run(_, ctx) {
          return { receipt: (await ctx.tools.invoke({ toolId: 'lookup', input: {} })).value };
        },
        routes: [route.to('compress')],
      },
      {
        id: 'compress',
        description: 'Reduce the receipt before continuing',
        async run(state, ctx) {
          ctx.report({ payload: { phase: 'started', beforeChars: state.receipt.length } });
          entered.resolve();
          await gate.promise;
          const receipt = state.receipt.replace('original ', '');
          ctx.report({ payload: { phase: 'reduced', afterChars: receipt.length } });
          return { receipt };
        },
        routes: [route.to('answer')],
      },
      {
        id: 'answer',
        description: 'Answer using the reduced receipt',
        async run(state, ctx) {
          return { answer: (await ctx.model.invoke({ input: state.receipt })).value };
        },
        routes: [route.deliver('answer')],
      },
    ],
  });
  const engine = new AgentCoreEngine({
    workflow: flow,
    execution: { observe: observe(events) },
    model: {
      provider: {
        async *stream(messages) {
          providerCalls++;
          yield messages.at(-1).content;
        },
      },
      sink: { output: (event) => sinks.push(event) },
    },
  }).bindToolRuntime(new ToolRegistry().register(tool));
  const pending = engine.run({});
  await entered.promise;
  assert.equal(providerCalls, 1);
  // Only the progress reported before the gate; the trailing report has not run yet.
  assert.equal(events.filter((event) => event.type === 'node.progress').length, 1);
  assert.ok(events.some((event) => event.type === 'tool.result'));
  assert.equal(
    events.some(
      (event) => event.type === 'workflow.event' && event.payload.event.nodeId === 'answer',
    ),
    false,
  );
  gate.resolve();
  assert.equal(await pending, 'receipt');
  assert.equal(providerCalls, 2);
  // One run owns a single runId across model, tool and node events.
  const ids = new Set(events.map((event) => event.runId));
  assert.equal(ids.size, 1);
  const starts = events.filter((event) => event.type === 'model.start');
  assert.equal(starts[0].workflowNodeId, 'decide');
  assert.equal(starts[1].workflowNodeId, 'answer');
  for (const delivered of sinks) {
    const observed = events.find((event) => event.eventId === delivered.eventId);
    assert.deepEqual(delivered, observed);
  }
  const toolStart = events.find((event) => event.type === 'tool.call'),
    toolEnd = events.find((event) => event.type === 'tool.result');
  assert.equal(toolStart.invocationId, toolEnd.invocationId);
  assert.equal(toolStart.workflowNodeId, 'lookup');
});

test('live observation cannot block execution, fail it, or mutate another consumer', async () => {
  const stored = [],
    seen = [];
  const diagnostics = createDiagnostics({ output: { write: (event) => stored.push(event) } });
  const runner = new ModelRunner({
    provider: {
      async *stream() {
        yield 'answer';
      },
    },
    execution: {
      diagnostics,
      observe: {
        accepts: () => true,
        event(event) {
          seen.push(structuredClone(event));
          event.payload.stageId = 'mutated';
          if (event.type === 'model.start') throw new Error('observer');
          return new Promise(() => {});
        },
      },
    },
  });
  // A throwing observer returning a never-settling promise must not delay or fail the call.
  assert.equal((await runner.invoke('request')).value, 'answer');
  assert.ok(seen.some((event) => event.type === 'model.start'));
  // Diagnostics keeps its own copy, so observer mutation must not leak into the log.
  for (const event of stored) assert.notEqual(event.payload.stageId, 'mutated');
  assert.equal(
    stored.find((event) => event.type === 'model.start').eventId,
    seen.find((event) => event.type === 'model.start').eventId,
  );
});

test('metadata log and observer do not inherit another consumer content permission', async () => {
  const stored = [],
    seen = [];
  const diagnostics = createDiagnostics({
    output: {
      accepts: (descriptor) => descriptor.content === 'metadata',
      write: (event) => stored.push(event),
    },
  });
  const registry = new ToolRegistry({
    execution: { diagnostics, observe: observe(seen) },
  }).register(tool);
  registry.invoke({ toolId: 'lookup', input: 'private input' });
  assert.equal(seen.find((event) => event.type === 'tool.call').payload.input, 'private input');
  assert.equal('input' in stored.find((event) => event.type === 'tool.call').payload, false);
  assert.equal('value' in stored.find((event) => event.type === 'tool.result').payload, false);
  const metadata = [];
  new ToolRegistry({ execution: { observe: { event: (event) => metadata.push(event) } } })
    .register(tool)
    .invoke({ toolId: 'lookup', input: 'private' });
  assert.equal(JSON.stringify(metadata).includes('private'), false);
});

test('node progress stops after cancellation and never commits a late result', async () => {
  const control = new AbortController(),
    events = [],
    entered = deferred(),
    gate = deferred();
  let report;
  const state = {};
  const workflow = defineWorkflow({
    id: 'cancel',
    nodes: [
      {
        id: 'work',
        description: 'Wait',
        async run(_, ctx) {
          report = ctx.report;
          ctx.report({ payload: 'entered' });
          entered.resolve();
          await gate.promise;
          ctx.report({ payload: 'late' });
          return { value: 'late' };
        },
        routes: [route.deliver('value')],
      },
    ],
  });
  const pending = new AgentCoreEngine({
    workflow,
    execution: { signal: control.signal, observe: observe(events) },
  }).run(state);
  await entered.promise;
  control.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  // Reports issued after abort are ignored instead of reviving node progress.
  report({ payload: 'after' });
  gate.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  // A late result is never committed to the caller's state.
  assert.deepEqual(state, {});
  assert.equal(events.filter((event) => event.type === 'node.progress').length, 1);
  assert.ok(
    events.some(
      (event) => event.type === 'workflow.event' && event.payload.event.errorCode === 'CANCELLED',
    ),
  );
});

test('reusable engine isolates concurrent runs and repeated visits without a log scope', async () => {
  const events = [];
  const workflow = defineWorkflow({
    id: 'repeat',
    nodes: [
      {
        id: 'work',
        description: 'Visit twice',
        startsRound: true,
        async run(state, ctx) {
          await Promise.resolve();
          ctx.report({ payload: state.request });
          return { visits: (state.visits ?? 0) + 1 };
        },
        routes: [
          { when: (state) => state.visits === 2, complete: (state) => state.request },
          route.to('work'),
        ],
      },
    ],
  });
  const engine = new AgentCoreEngine({ workflow, execution: { observe: observe(events) } });
  assert.deepEqual(
    await Promise.all([engine.run({ request: 'a' }), engine.run({ request: 'b' })]),
    ['a', 'b'],
  );
  const progress = events.filter((event) => event.type === 'node.progress');
  assert.equal(new Set(progress.map((event) => event.runId)).size, 2);
  // Two concurrent runs, each visiting the same node twice, yield four distinct spans.
  assert.equal(new Set(progress.map((event) => event.spanId)).size, 4);
  for (const request of ['a', 'b'])
    assert.equal(
      new Set(
        progress.filter((event) => event.payload.payload === request).map((event) => event.runId),
      ).size,
      1,
    );
});

test('model output delivery retains backpressure, cancellation, and the actual failure', async () => {
  const gate = deferred(),
    seen = deferred();
  let parts = 0;
  const runner = new ModelRunner({ execution: {},
    provider: {
      async *stream() {
        parts++;
        yield 'a';
        parts++;
        yield 'b';
      },
    },
    sink: {
      output: async (event) => {
        if (event.type === 'model.output' && event.payload.part === 'a') {
          seen.resolve();
          await gate.promise;
        }
      },
    },
  });
  const pending = runner.invoke('request');
  await seen.promise;
  // Delivery backpressure pauses provider iteration after the first withheld part.
  assert.equal(parts, 1);
  gate.resolve();
  assert.equal((await pending).value, 'ab');
  const failure = new Error('delivery failure');
  const broken = new ModelRunner({ execution: {},
    provider: {
      async *stream() {
        yield 'answer';
      },
    },
    sink: {
      output(event) {
        if (event.type === 'model.parsed') throw failure;
      },
    },
  });
  await assert.rejects(broken.invoke('request'), (error) => error === failure);
  // Failed output delivery leaves no committed journal entry.
  assert.deepEqual(broken.journal.snapshot(), []);
});

test('metadata-only progress never reads private payload/subs getters', async () => {
  const events = [];
  let reads = 0;
  const privateReport = {
    get payload() {
      reads++;
      throw new Error('private payload');
    },
    get subs() {
      reads++;
      throw new Error('private subs');
    },
  };
  const workflow = defineWorkflow({
    id: 'private-report',
    nodes: [
      {
        id: 'work',
        description: 'Report privately',
        run(_, context) {
          context.report(privateReport);
        },
        routes: [{ complete: () => 'done' }],
      },
    ],
  });
  assert.equal(
    await new AgentCoreEngine({
      workflow,
      execution: { observe: { event: (event) => events.push(event) } },
    }).run({}),
    'done',
  );
  // Metadata-only progress must never read the private payload or subs getters.
  assert.equal(reads, 0);
  assert.ok(events.some((event) => event.type === 'workflow.event'));
});

test('listeners share fact identity with independently filtered copies and pinned receivers', async () => {
  const logs = [],
    metadata = [],
    content = [];
  let logReads = 0;
  class Listener {
    #events;
    constructor(events, allowContent) {
      this.#events = events;
      this.allowContent = allowContent;
    }
    accepts({ event, content }) {
      return event === 'tool.call' && (content === 'metadata' || this.allowContent);
    }
    event(event) {
      this.#events.push(structuredClone(event));
      event.payload.input = 'mutated by consumer';
      return Promise.reject(new Error('ignored async observation'));
    }
  }
  const first = new Listener(metadata, false),
    second = new Listener(content, true);
  const scope = createDiagnostics({
    output: {
      accepts: ({ content }) => content === 'metadata',
      write(event) {
        logs.push(event);
        logReads++;
      },
    },
  })
    .withObserver(first)
    .withObserver(second);
  // Methods replaced after registration must not be consulted.
  first.event = () => {
    throw new Error('replacement must not be used');
  };
  second.accepts = () => false;
  const registry = new ToolRegistry({ execution: { diagnostics: scope } }).register(tool);
  registry.invoke({ toolId: 'lookup', input: 'secret' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(metadata.length, 1);
  assert.equal(content.length, 1);
  assert.ok(logReads > 0);
  assert.equal(content[0].payload.input, 'secret');
  assert.equal('input' in metadata[0].payload, false);
  assert.equal('input' in logs.find((event) => event.type === 'tool.call').payload, false);
  // Every consumer shares one fact identity even though their filters differ.
  assert.equal(content[0].eventId, metadata[0].eventId);
  assert.equal(content[0].eventId, logs.find((event) => event.type === 'tool.call').eventId);
});

test('Engine pins observer methods at assembly and hung output delivery remains cancellable', async () => {
  const events = [];
  class Listener {
    #events = events;
    event(event) {
      this.#events.push(event);
    }
  }
  const listener = new Listener();
  const workflow = defineWorkflow({
    id: 'pin',
    nodes: [{ id: 'done', description: 'Complete', routes: [{ complete: () => true }] }],
  });
  const engine = new AgentCoreEngine({ workflow, execution: { observe: listener } });
  listener.event = () => {
    throw new Error('replaced');
  };
  assert.equal(await engine.run({}), true);
  assert.ok(events.length > 0);
  const control = new AbortController(),
    entered = deferred();
  const runner = new ModelRunner({
    execution: { signal: control.signal },
    provider: {
      async *stream() {
        yield 'part';
      },
    },
    sink: {
      output(event) {
        if (event.type === 'model.output') {
          entered.resolve();
          return new Promise(() => {});
        }
      },
    },
  });
  const pending = runner.invoke('request');
  await entered.promise;
  control.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.deepEqual(runner.journal.snapshot(), []);
});

test('structured class results retain identity and sinks cannot mutate the returned value', async () => {
  class Result {
    #value = 'answer';
    read() {
      return this.#value;
    }
  }
  const result = new Result(),
    events = [];
  const runner = new ModelRunner({ execution: {},
    provider: {
      async *stream() {
        yield 'answer';
      },
    },
    transports: [
      {
        id: 'custom',
        prepare() {
          return {
            options: {},
            schemaChars: 0,
            createResponse: () => ({
              outputChars: 0,
              push() {},
              finish: () => ({ result, text: 'answer' }),
            }),
          };
        },
      },
    ],
    sink: {
      output: (event) => {
        events.push(event);
        if (event.type === 'model.parsed') event.payload.value.text = 'mutated';
      },
    },
  });
  const actual = await runner.invoke({ input: 'request', transport: 'custom' });
  assert.equal(actual.value.text, 'answer');
  // Structured class results keep their identity; the sink cannot replace the returned value.
  assert.equal(actual.value.result, result);
  assert.equal(actual.value.result.read(), 'answer');
  assert.ok(events.some((event) => event.type === 'model.parsed'));
});

test('model delivery retains automatic Workflow identity without logging or a process observer', async () => {
  const events = [];
  let reads = 0;
  const workflow = defineWorkflow({
    id: 'delivery-only',
    nodes: [
      {
        id: 'answer',
        description: 'Deliver model content',
        async run(_, context) {
          context.report({
            get payload() {
              reads++;
              throw new Error('No content consumer');
            },
          });
          return { result: (await context.model.invoke({ input: 'hello' })).value };
        },
        routes: [route.deliver('result')],
      },
    ],
  });
  const agent = new AgentCoreEngine({
    workflow,
    model: {
      provider: {
        async *stream() {
          yield 'answer';
        },
      },
      sink: { output: (event) => events.push(event) },
    },
  });
  assert.equal(await agent.run({}), 'answer');
  assert.equal(reads, 0);
  assert.ok(events.length > 0);
  assert.ok(
    events.every((event) => event.workflowNodeId === 'answer' && !!event.workflowInvocationId),
  );
  assert.equal(new Set(events.map((event) => event.runId)).size, 1);
  assert.equal(await agent.run({}), 'answer');
  // A second run gets a new runId; the first run's identity is not reused.
  assert.equal(new Set(events.map((event) => event.runId)).size, 2);
});

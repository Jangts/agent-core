// Locks engine-to-runtime binding: one shared budget with live counters, pinned runtime methods,
// overlap and lifetime cancellation, and explicit model restoration on fork.
// Covers `AgentCoreEngine.bindModelRuntime`, `ModelRunner` and workflow model injection;
// `node --test` against dist/esm.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AgentCoreEngine,
  ModelRunner,
  createDiagnostics,
  defineWorkflow,
  route,
} from '../dist/esm/index.js';

const workflow = defineWorkflow({
  id: 'bound-runtime',
  nodes: [
    {
      id: 'answer',
      description: 'Use the request model',
      async run(state, { model }) {
        return { result: (await model.invoke({ input: state.input })).value };
      },
      routes: [route.deliver('result')],
    },
  ],
});

test('a bound request runtime preserves one budget and live counters with automatic node scope', async () => {
  const events = [],
    diagnostics = createDiagnostics({ observe: { event: (event) => events.push(event) } });
  const model = new ModelRunner({
    provider: {
      async *stream(messages) {
        yield messages.at(-1).content;
      },
    },
    maxCalls: 2,
    execution: { diagnostics },
  });
  await model.invoke('service call');
  const agent = new AgentCoreEngine({ workflow }).bindModelRuntime(model);
  assert.equal(await agent.run({ input: 'node call' }), 'node call');
  // A direct call before binding already spent one of the two budgeted calls.
  assert.equal(model.callCount, 2);
  // Node identity is attached automatically to model events emitted inside a node.
  assert.equal(events.findLast((event) => event.type === 'model.start').workflowNodeId, 'answer');
  assert.equal(new Set(events.map((event) => event.runId)).size, 1);
  await assert.rejects(agent.run({ input: 'no new quota' }), (error) => error.code === 'BUDGET');
  assert.equal(model.callCount, 2);
});

test('structured runtimes pin their canonical methods and preserve private receivers', async () => {
  class Runtime {
    #model = new ModelRunner({ execution: {},
      provider: {
        async *stream() {
          yield 'private';
        },
      },
    });
    get execution() {
      return this.#model.execution;
    }
    get remainingCalls() {
      return this.#model.remainingCalls;
    }
    get callCount() {
      return this.#model.callCount;
    }
    get totalCallCount() {
      return this.#model.totalCallCount;
    }
    invoke(request) {
      return this.#model.invoke(request);
    }
    prepare(request) {
      return this.#model.prepare(request);
    }
  }
  const runtime = new Runtime();
  const agent = new AgentCoreEngine({ workflow }).bindModelRuntime(runtime);
  // Replacing runtime methods after binding must not affect the engine.
  runtime.invoke = () => {
    throw new Error('replaced');
  };
  runtime.prepare = runtime.invoke;
  assert.equal(await agent.run({ input: 'hello' }), 'private');
  assert.equal(runtime.callCount, 1);
  assert.throws(() => agent.bindModel({ provider: {} }), /already/);
  const checkpoint = agent.checkpoint({});
  // A bound runtime cannot be serialized, so a fork must restore it explicitly.
  assert.throws(() => agent.fork({ at: checkpoint }), /restored request model/);
  assert.equal(
    await agent
      .fork({ at: checkpoint, resume: () => ({ model: new Runtime() }) })
      .run({ input: 'fork' }),
    'private',
  );
});

test('runtime lifetime cancellation and overlap guard prevent a second request sharing mutable execution', async () => {
  let entered;
  const ready = new Promise((resolve) => {
    entered = resolve;
  });
  const control = new AbortController();
  const model = new ModelRunner({
    provider: {
      async *stream() {
        entered();
        await new Promise(() => {});
      },
    },
    execution: { signal: control.signal },
  });
  const agent = new AgentCoreEngine({ workflow }).bindModelRuntime(model);
  const pending = agent.run({ input: 'one' });
  await ready;
  // A bound runtime refuses overlapping runs that would share mutable execution.
  await assert.rejects(agent.run({ input: 'two' }), /concurrent/);
  control.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(model.callCount, 1);
});

test('a shorter run signal reaches the bound runtime provider without cancelling its original lifetime', async () => {
  let enter, providerSignal;
  const entered = new Promise((resolve) => {
    enter = resolve;
  });
  const model = new ModelRunner({ execution: {},
    provider: {
      async *stream(_, context) {
        providerSignal = context.signal;
        enter();
        await new Promise(() => {});
      },
    },
  });
  const control = new AbortController();
  const pending = new AgentCoreEngine({ workflow })
    .bindModelRuntime(model)
    .run({ input: 'shorter' }, { signal: control.signal });
  await entered;
  control.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(providerSignal.aborted, true);
  // The shorter run signal must not cancel the runtime's own lifetime signal.
  assert.equal(model.signal.aborted, false);
});

test('a fork may explicitly restore a request runtime instead of inheriting static model configuration', async () => {
  const original = new AgentCoreEngine({
    workflow,
    models: {
      original: {
        provider: {
          async *stream() {
            yield 'original';
          },
        },
      },
    },
  });
  const replacement = new ModelRunner({ execution: {},
    maxCalls: 1,
    provider: {
      async *stream() {
        yield 'restored';
      },
    },
  });
  const fork = original.fork({
    at: original.checkpoint({}),
    resume: () => ({ model: replacement }),
  });
  assert.equal(await fork.run({ input: 'fork' }), 'restored');
  // The fork's budget belongs to the replacement runner, independent of the parent.
  await assert.rejects(fork.run({ input: 'same budget' }), (error) => error.code === 'BUDGET');
  // The parent keeps its own runtime and quota untouched.
  assert.equal(await original.run({ input: 'parent unchanged' }), 'original');
});

test('a custom runtime that does not implement budget adjustment fails without spending a call', async () => {
  const model = new ModelRunner({ execution: {}, provider: { async *stream() { assert.fail('model ran'); } } });
  const runtime = { execution: model.execution, invoke: model.invoke.bind(model), prepare: model.prepare.bind(model) };
  const needsAdjustment = defineWorkflow({
    id: 'adjustment',
    nodes: [{
      id: 'plan', description: 'Request more calls',
      run(_state, context) { return { result: context.model.adjustCallBudget({ newLimit: 10 }) }; },
      routes: [route.deliver('result')],
    }],
  });
  await assert.rejects(new AgentCoreEngine({ workflow: needsAdjustment }).bindModelRuntime(runtime).run({}),
    /Model runtime does not support budget adjustment/);
  assert.equal(model.totalCallCount, 0);
});

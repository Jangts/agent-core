/*
 * Contracts for the workflow-and-tool-chain example and for the model binding rules
 * the Core engine applies around it.
 *
 * The example file is imported directly, so this suite proves that the published
 * development example keeps working against the package entry points. The remaining
 * cases pin the model binding guarantees: concurrent runs keep independent budgets, a
 * model switch only affects later runs, configured models share one engine-level
 * budget, custom transports keep their receiver, and compiled bindings freeze nested
 * configuration before a delayed call happens.
 *
 * Main exports: none. The file only registers `node:test` cases.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { BudgetError, createDiagnostics, Support } from '@jangts/agent-core';
import { runExample } from '../development/examples/workflow-tool-chain.mjs';

test('Workflow replies or runs a three-tool chain within one model round', async () => {
  const events = [];
  const diagnostics = createDiagnostics({ output: { write: (event) => events.push(event) } });
  // A greeting needs no tools; the status query runs three tools after one model round.
  assert.deepEqual(await runExample('你好'), { value: '你好！', calls: { model: 1, tools: [] } });
  assert.deepEqual(await runExample('查询状态', { diagnostics }), {
    value: '演示服务运行正常，延迟 12ms',
    calls: { model: 1, tools: ['get_service', 'get_metrics', 'summarize_status'] },
  });
  assert.equal(events.filter((event) => event.type === 'tool.result').length, 3);
});

test('bound model configuration gives concurrent runs independent call budgets', async () => {
  const { AgentCoreEngine, defineWorkflow } = await import('@jangts/agent-core');
  const events = [];
  const diagnostics = createDiagnostics({ output: { write: (event) => events.push(event) } });
  const workflow = defineWorkflow({
    id: 'echo',
    nodes: [
      {
        id: 'model',
        description: 'Echo the request',
        async run({ input }, { model }) {
          const { value } = await model.invoke({ input });
          return { value };
        },
        routes: [{ complete: (state) => state.value }],
      },
    ],
  });
  const agent = new AgentCoreEngine({ execution: { diagnostics } })
    .bindWorkflow(workflow)
    .bindModel({
      maxCalls: 1,
      provider: {
        async *stream(messages) {
          yield messages.at(-1).content;
        },
      },
    });
  // Two runs overlap; each must consume its own single allowed call.
  assert.deepEqual(await Promise.all([agent.run({ input: 'A' }), agent.run({ input: 'B' })]), [
    'A',
    'B',
  ]);
  const nodes = events.filter(
    (event) => event.type === 'workflow.event' && event.payload.event.type === 'enter',
  );
  const calls = events.filter((event) => event.type === 'model.end');
  assert.equal(calls.length, 2);
  // Distinct parent spans prove the calls belonged to separate runs.
  assert.equal(new Set(calls.map((call) => call.parentSpanId)).size, 2);
  assert.ok(calls.every((call) => nodes.some((node) => call.parentSpanId === node.spanId)));
});

test('switchModel changes future runs even when an earlier run has not called its model yet', async () => {
  const { AgentCoreEngine, defineWorkflow } = await import('@jangts/agent-core');
  let resume;
  const pause = new Promise((resolve) => {
    resume = resolve;
  });
  const model = (value) => ({
    maxCalls: 1,
    provider: {
      async *stream() {
        yield value;
      },
    },
  });
  const workflow = defineWorkflow({
    id: 'model-switch',
    nodes: [
      {
        id: 'answer',
        description: 'Answer using the model bound at run start',
        async run({ wait }, { model: scopedModel }) {
          // The first run waits before it calls the model, so the switch happens
          // while that run is still pending.
          if (wait) await pause;
          return { result: (await scopedModel.invoke({ input: 'hello' })).value };
        },
        routes: [{ complete: (state) => state.result }],
      },
    ],
  });
  const agent = new AgentCoreEngine({ workflow, model: model('first') });
  const started = agent.run({ wait: true });
  agent.switchModel(model('second'));
  try {
    // A run started after the switch uses the new model.
    assert.equal(await agent.run({}), 'second');
    // The engine keeps one workflow and one model binding; rebinding is refused.
    assert.throws(() => agent.bindWorkflow(workflow), /already has a bound workflow/);
    assert.throws(() => agent.bindModel(model('third')), /already has a bound model/);
  } finally {
    resume();
  }
  // The already running request keeps the model it was started with.
  assert.equal(await started, 'first');
});

test('configured models can be selected per run and per call with one shared budget', async () => {
  const { AgentCoreEngine, defineWorkflow } = await import('@jangts/agent-core');
  const config = (value) => ({
    maxCalls: 3,
    provider: {
      async *stream() {
        yield value;
      },
    },
  });
  const workflow = defineWorkflow({
    id: 'many-models',
    nodes: [
      {
        id: 'answer',
        description: 'Compare two configured models',
        async run({ extra }, { model }) {
          const first = await model.invoke({ input: 'first' });
          // A call may address another configured model by id.
          const second = await model.invoke({ modelId: 'deep', input: 'second' });
          // The engine-level budget of two calls is exhausted by the two calls above.
          if (extra) await model.invoke({ input: 'over budget' });
          return { result: [first.value, second.value] };
        },
        routes: [{ complete: (state) => state.result }],
      },
    ],
  });
  const agent = new AgentCoreEngine({
    workflow,
    models: { fast: config('fast'), deep: config('deep') },
    model: 'fast',
    maxModelCalls: 2,
  });
  // The default model id must exist in the configured registry.
  assert.throws(
    () => new AgentCoreEngine({ workflow, models: { fast: config('fast') }, model: 'missing' }),
    /Unknown configured model/,
  );
  assert.deepEqual(await agent.run({}), ['fast', 'deep']);
  assert.deepEqual(await agent.run({}, { modelId: 'deep' }), ['deep', 'deep']);
  await assert.rejects(agent.run({ extra: true }), BudgetError);
  await assert.rejects(agent.run({}, { modelId: 'missing' }), /Unknown configured model/);
  agent.switchModel('deep');
  assert.deepEqual(await agent.run({}), ['deep', 'deep']);
});

test('workflow model calls accept a registered custom transport object with its receiver intact', async () => {
  const { AgentCoreEngine, defineWorkflow } = await import('@jangts/agent-core');
  class Transport {
    id = 'custom';
    #prefix = 'custom:';
    prepare() {
      let value = '';
      return {
        options: {},
        schemaChars: 0,
        createResponse: () => ({
          get outputChars() {
            return value.length;
          },
          push(part) {
            value += part;
          },
          // The private field is read through the instance receiver, so the
          // transport must not be copied or detached from its owner.
          finish: () => this.#prefix + value,
        }),
      };
    }
  }
  const transport = new Transport();
  const workflow = defineWorkflow({
    id: 'custom',
    nodes: [
      {
        id: 'model',
        description: 'Invoke registered custom transport',
        async run(_, { model }) {
          return { result: (await model.invoke({ input: 'hello', transport })).value };
        },
        routes: [{ complete: (state) => state.result }],
      },
    ],
  });
  const agent = new AgentCoreEngine({
    workflow,
    model: {
      transports: [transport],
      provider: {
        async *stream() {
          yield 'answer';
        },
      },
    },
  });
  assert.equal(await agent.run({}), 'custom:answer');
});

test('Engine model bindings preserve prototype getters and bind budgets once for every installation path', async () => {
  const { AgentCoreEngine, defineWorkflow } = await import('@jangts/agent-core');
  // The three ways an App can install a model binding must behave identically.
  for (const path of ['constructor', 'late', 'registered']) {
    let calls = 0;
    class Binding {
      allowance = 1;
      #provider = {
        async *stream() {
          calls++;
          yield 'answer';
        },
      };
      get provider() {
        return this.#provider;
      }
      get maxCalls() {
        return this.allowance;
      }
    }
    const binding = new Binding();
    const engine =
      path === 'constructor'
        ? new AgentCoreEngine({ model: binding })
        : path === 'registered'
          ? new AgentCoreEngine({ models: { selected: binding }, model: 'selected' })
          : new AgentCoreEngine().bindModel(binding);
    // The allowance is raised after installation; the binding must already have
    // captured the value of 1 when it was compiled.
    binding.allowance = 10;
    const workflow = defineWorkflow({
      id: 'bound-model',
      nodes: [
        {
          id: 'invoke',
          description: 'Use bound model',
          async run(_state, { model }) {
            assert.equal((await model.invoke({ input: 'one' })).value, 'answer');
            await model.invoke({ input: 'two' });
          },
          routes: [{ complete: () => 'unreachable' }],
        },
      ],
    });
    await assert.rejects(engine.bindWorkflow(workflow).run({}), BudgetError);
    assert.equal(calls, 1, path);
  }
});

test('compiled model bindings fix nested configuration before delayed calls and survive forks with fresh budgets', async () => {
  const { AgentCoreEngine, defineWorkflow } = await import('@jangts/agent-core');
  // Four installation paths; `switch` replaces an already bound model.
  for (const path of ['constructor', 'late', 'registered', 'switch']) {
    const counts = { provider: 0, transport: 0, compressor: 0, selector: 0 };
    const traces = [];
    class Provider {
      #answer = 'answer';
      async *stream(messages) {
        counts.provider++;
        // The compiled context must already carry the compressed history.
        assert.equal(JSON.parse(messages.at(-1).content).history, 'short');
        yield this.#answer;
      }
    }
    class Transport {
      id = 'compiled';
      #prefix = 'custom:';
      prepare() {
        counts.transport++;
        let value = '';
        return {
          options: {},
          schemaChars: 0,
          createResponse: () => ({
            get outputChars() {
              return value.length;
            },
            push(part) {
              value += part;
            },
            finish: () => this.#prefix + value,
          }),
        };
      }
    }
    class Counter {
      counterId = 'fixed';
      contextWindowTokens = 12;
      #tokens = 2;
      countTokens() {
        return this.#tokens;
      }
    }
    class Compressor {
      id = 'summarize';
      maxCalls = 0;
      #summary = 'short';
      async compress() {
        counts.compressor++;
        return { history: this.#summary };
      }
    }
    class Selector {
      id = 'choose';
      maxCalls = 0;
      #step = 'summary';
      async select() {
        counts.selector++;
        return [this.#step];
      }
    }
    class Policy {
      #mode = 'reduce';
      get mode() {
        return this.#mode;
      }
      selection = { mode: 'model', handlerId: 'choose' };
      steps = [
        {
          id: 'summary',
          kind: 'compress',
          fragmentId: 'history',
          targetChars: 30,
          handlerId: 'summarize',
        },
      ];
    }
    const provider = new Provider(),
      transport = new Transport(),
      tokenBudget = new Counter();
    const contextPolicy = new Policy(),
      compressor = new Compressor(),
      selector = new Selector();
    const binding = {
      provider,
      transports: [transport],
      tokenBudget,
      maxCalls: 1,
      maxOutputTokens: 2,
    };
    const observedExecution = {
      observe: {
        event: (event) => {
          // The model end event carries the compiled request state.
          if (event.type === 'model.end') traces.push(event.payload.state);
        },
      },
    };
    const agent =
      path === 'constructor'
        ? new AgentCoreEngine({ model: binding, execution: observedExecution })
        : path === 'registered'
          ? new AgentCoreEngine({
              models: { selected: binding },
              model: 'selected',
              execution: observedExecution,
            })
          : path === 'switch'
            ? new AgentCoreEngine({
                model: { provider },
                execution: observedExecution,
              }).switchModel(binding)
            : new AgentCoreEngine({ execution: observedExecution }).bindModel(binding);
    let resume;
    const pause = new Promise((resolve) => {
      resume = resolve;
    });
    const workflow = defineWorkflow({
      id: 'compiled-model',
      nodes: [
        {
          id: 'wait',
          description: 'Delay this request',
          async run({ wait }) {
            // Only the first run pauses, so the mutation below happens while the
            // binding is already installed but not yet used.
            if (wait) await pause;
          },
          routes: [{ targetNodeId: 'context' }],
        },
        Support.createContextProcessingNode({
          id: 'context',
          description: 'Process context with fixed strategy bindings',
          policy: contextPolicy,
          compressors: [compressor],
          selectors: [selector],
          request: { transport },
          plan: () => ({
            maxInputChars: 64,
            fragments: [
              {
                id: 'history',
                sourceId: 'test',
                role: 'user',
                trust: 'user',
                lifetime: 'turn',
                maxChars: 1000,
                value: { history: 'long history '.repeat(30) },
              },
            ],
          }),
          update: (context) => ({ context }),
          routes: [{ targetNodeId: 'answer' }],
        }),
        {
          id: 'answer',
          description: 'Use fixed model dependencies',
          async run({ context, extra }, { model }) {
            const result = await model.invoke({ input: context.input, prepared: context.prepared });
            // One more call would exceed the single allowed model call.
            if (extra) await model.invoke({ input: context.input, transport });
            return { result: result.value };
          },
          routes: [{ complete: (state) => state.result }],
        },
      ],
    });
    agent.bindWorkflow(workflow);
    tokenBudget.contextWindowTokens = 11;
    contextPolicy.steps[0].targetChars = 1000;
    const started = agent.run({ wait: true });
    // Every dependency of the binding is replaced after installation; the
    // compiled binding must keep using the captured originals.
    const replaced = () => {
      throw new Error('Replaced source callback must not run');
    };
    tokenBudget.contextWindowTokens = 1;
    tokenBudget.countTokens = replaced;
    contextPolicy.selection.handlerId = 'missing';
    contextPolicy.steps[0].handlerId = 'missing';
    provider.stream = replaced;
    transport.prepare = replaced;
    transport.id = 'changed-after-binding';
    compressor.compress = replaced;
    selector.select = replaced;
    // A fork gets its own budget, so both branches can complete independently.
    const branch = agent.fork({ at: agent.checkpoint({}) });
    try {
      assert.deepEqual(
        await Promise.all([agent.run({}), branch.run({})]),
        ['custom:answer', 'custom:answer'],
        path,
      );
    } finally {
      resume();
    }
    assert.equal(await started, 'custom:answer', path);
    await assert.rejects(agent.run({ extra: true }), BudgetError);
    // Four runs in total (the delayed one, two completed runs and the run that
    // exceeds the model budget) each perform every step exactly once.
    assert.deepEqual(counts, { provider: 4, transport: 4, compressor: 4, selector: 4 }, path);
    assert.equal(traces.length, 4, path);
    // 10 is the compiled input limit (window 12 minus 2 reserved output
    // tokens), not the window value of 1 that was written afterwards.
    assert.ok(
      traces.every((trace) => trace.inputTokenLimit === 10),
      path,
    );
    // Compilation must not freeze the App's own instances.
    assert.equal(Object.isFrozen(provider), false);
    assert.equal(Object.isFrozen(transport), false);
  }
});

test('CoreStep accepts structural class outcomes with prototype getters and explicit undefined', async () => {
  const { AgentCoreEngine, WorkflowContractError } = await import('@jangts/agent-core');
  // Outcome classes expose `type` and `value` through prototype getters, so the
  // engine must read them structurally instead of checking own properties.
  class Continue {
    get type() {
      return 'continue';
    }
  }
  class Complete {
    #value;
    get type() {
      return 'complete';
    }
    get value() {
      return this.#value;
    }
  }
  const visits = [];
  assert.equal(
    await new AgentCoreEngine({ maxRounds: 2 }).run((round) => {
      visits.push(round);
      return round === 0 ? new Continue() : new Complete();
    }),
    undefined,
  );
  assert.deepEqual(visits, [0, 1]);
  // A plain object outcome is not a CoreStep outcome and must be refused.
  await assert.rejects(
    new AgentCoreEngine().run(() => ({ type: 'complete' })),
    WorkflowContractError,
  );
  const controller = new AbortController(),
    reason = new Error('Cancelled by result getter');
  class Cancelled extends Complete {
    get value() {
      // Cancelling while the outcome is read must win over the returned value.
      controller.abort(reason);
      return 'late';
    }
  }
  await assert.rejects(
    new AgentCoreEngine({ execution: { signal: controller.signal } }).run(() => new Cancelled()),
    (error) => error === reason,
  );
});

test('CoreStep run options compose request cancellation and preserve its original reason', async () => {
  const { AgentCoreEngine, WorkflowContractError } = await import('@jangts/agent-core');
  const cancelled = new AbortController(),
    before = new Error('Cancelled before the step');
  cancelled.abort(before);
  let calls = 0;
  // A request signal that is already aborted stops the step before it runs.
  await assert.rejects(
    new AgentCoreEngine().run(
      () => {
        calls++;
        return { type: 'complete', value: 'late' };
      },
      { signal: cancelled.signal },
    ),
    (error) => error === before,
  );
  assert.equal(calls, 0);
  // The step receives a composed signal; whichever source aborts first decides.
  for (const source of ['request', 'engine']) {
    const configured = new AbortController(),
      request = new AbortController();
    const reason = new Error(`${source} cancelled while the step runs`);
    await assert.rejects(
      new AgentCoreEngine({ execution: { signal: configured.signal } }).run(
        async (_round, { signal }) => {
          (source === 'request' ? request : configured).abort(reason);
          await Promise.resolve();
          assert.equal(signal.aborted, true);
          assert.equal(signal.reason, reason);
          return { type: 'complete', value: 'late' };
        },
        { signal: request.signal },
      ),
      (error) => error === reason,
    );
  }
  // A model id is meaningless without a workflow, so the run is refused before
  // the step executes.
  await assert.rejects(
    new AgentCoreEngine().run(
      () => {
        calls++;
        return { type: 'complete', value: 'unexpected' };
      },
      { modelId: 'configured-only-for-workflows' },
    ),
    WorkflowContractError,
  );
  assert.equal(calls, 0);
});

/*
 * Boundary contract shared by every public entry point: cancellation, rejection
 * identity and budget validation must behave the same no matter which adapter
 * the App calls.
 *
 * The file deliberately drives the real adapters (`AgentCoreEngine` loop and
 * workflow, `ModelRunner`, `ModelCalls`, `ToolRegistry`, Support catalogs,
 * children, artifacts and durable tasks) instead of testing each one in
 * isolation, so a new entry point that skips a check shows up here.
 *
 * Runs on `dist/esm` with fake providers, in-memory stores and diagnostics
 * outputs; no network or filesystem access.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AgentCoreEngine,
  ModelRunner,
  ToolRegistry,
  Support,
  assembleFragments,
  createDiagnostics,
  defineWorkflow,
} from '../dist/esm/index.js';
import { ModelCalls } from '../dist/esm/kits/inference.js';
import { defineDurableTask } from '../dist/esm/kits/durable.js';
import { defineArtifactCatalog } from '../dist/esm/kits/artifacts.js';
import { createToolRegistry } from '../dist/esm/capabilities/tool-runtime.js';

const tool = (run) => ({
  id: 'tool',
  kind: 'read',
  description: 'Tool',
  inputSchema: { jsonSchema: { type: 'object' }, parse: (value) => value },
  authorize() {},
  execute: run,
  parseOutput: (value) => value,
});

// Public entry-point matrix: each case runs its real adapter and execution path.
const cancelledEntries = [
  {
    id: 'loop',
    run(signal, called) {
      return new AgentCoreEngine().run(
        () => {
          called();
          return { type: 'complete', value: true };
        },
        { signal },
      );
    },
  },
  {
    id: 'workflow',
    run(signal, called) {
      return new AgentCoreEngine({
        workflow: defineWorkflow({
          id: 'cancelled',
          nodes: [
            { id: 'work', description: 'Work', run: called, routes: [{ complete: () => true }] },
          ],
        }),
      }).run({}, { signal });
    },
  },
  {
    id: 'model-runner',
    run(signal, called) {
      return new ModelRunner({ execution: {},
        provider: {
          async *stream() {
            called();
            yield 'answer';
          },
        },
      }).invoke({ input: 'question', signal });
    },
  },
  {
    id: 'model-binding',
    run(signal, called) {
      return new ModelCalls([{ id: 'custom', identity: 'custom', invoke: called }]).invoke(
        { modelId: 'custom', input: {}, timeoutMs: 1000 },
        { signal },
      );
    },
  },
  {
    id: 'tool-registry',
    run(signal, called) {
      return new ToolRegistry()
        .register({
          id: 'tool',
          kind: 'read',
          parseInput: (value) => {
            called();
            return value;
          },
          execute: called,
          parseOutput: (value) => value,
        })
        .invokeAsync({ toolId: 'tool', input: {}, signal });
    },
  },
  {
    id: 'tool-catalog',
    run(signal, called) {
      return Support.defineToolCatalog([tool(called)])
        .bind({ app: {} })
        .invoke({ toolId: 'tool', input: {}, signal });
    },
  },
  {
    id: 'children',
    run(signal, called) {
      return Support.runChildren(
        new ModelRunner({ execution: {},
          provider: {
            async *stream() {
              called();
            },
          },
        }),
        [
          {
            id: 'child',
            maxCalls: 1,
            reserveCalls: 0,
            timeoutMs: 1000,
            transports: [],
            run: called,
          },
        ],
        { signal },
      );
    },
  },
  {
    id: 'artifact',
    run(signal, called) {
      return defineArtifactCatalog([{ id: 'resolver', resolve: called }]).resolve(
        { resolverId: 'resolver', artifactId: 'one' },
        { app: {}, signal },
      );
    },
  },
  {
    id: 'durable',
    run(signal, called) {
      return defineDurableTask(
        {
          id: 'task',
          revision: '1',
          isState: () => true,
          steps: [{ id: 'step', replayPolicy: 'safe', run: called }],
        },
        { store: { exclusive: called, load: called, save: called } },
      ).run({ taskId: 'one' }, { app: {}, signal });
    },
  },
];
// A pre-aborted signal must surface the frozen reason itself (not a wrapper) and
// must stop before any handler, provider or store callback is reached.
for (const entry of cancelledEntries)
  test(`pre-cancellation retains the exact reason and never enters ${entry.id}`, async () => {
    const controller = new AbortController(),
      reason = Object.freeze(Error('cancelled'));
    let calls = 0;
    controller.abort(reason);
    await assert.rejects(
      Promise.resolve().then(() =>
        entry.run(controller.signal, () => {
          calls++;
        }),
      ),
      (error) => error === reason,
    );
    assert.equal(calls, 0);
  });

test('execution boundaries retain rejection identity even without an Error object', async () => {
  // Falsy and non-Error throwables must propagate unchanged instead of being
  // replaced by a generic error.
  for (const reason of [undefined, null, false, 0, '', Error('failure')]) {
    const operations = [
      () =>
        new AgentCoreEngine().run(() => {
          throw reason;
        }),
      () =>
        new ModelCalls([
          {
            id: 'custom',
            identity: 'custom',
            invoke() {
              throw reason;
            },
          },
        ]).invoke(
          { modelId: 'custom', input: {}, timeoutMs: 1000 },
          { signal: new AbortController().signal },
        ),
      () =>
        Support.streamEvents(
          async (emit) => {
            await emit('before failure');
            throw reason;
          },
          { signal: new AbortController().signal },
        ),
    ];
    for (const [index, operation] of operations.entries()) {
      let rejected = false;
      try {
        if (index === 2) {
          const seen = [];
          for await (const value of operation()) seen.push(value);
        } else await operation();
      } catch (error) {
        rejected = true;
        assert.equal(error, reason);
      }
      assert.equal(rejected, true);
    }
  }
});

test('invalid BuiltContext budgets fail measurement and execution without Provider I/O or spending calls', async () => {
  // Every non-finite, fractional, negative, null or string limit is rejected in the
  // same place, and only one `runtime.rejected` event is emitted per attempt.
  for (const maxInputChars of [NaN, undefined, null, -1, -Infinity, 0.5, '1']) {
    let calls = 0;
    const events = [];
    const runner = new ModelRunner({
      maxInputChars: 1,
      execution: {
        diagnostics: createDiagnostics({
          output: {
            write: (event) => {
              events.push(event);
            },
          },
        }),
      },
      provider: {
        async *stream() {
          calls++;
          yield 'answer';
        },
      },
    });
    const input = {
      messages: [{ role: 'user', content: 'too large' }],
      fragmentUsage: [],
      inputChars: 9,
      maxInputChars,
    };
    assert.throws(() => runner.prepare().measure(input), /Invalid context budget/);
    await assert.rejects(runner.invoke({ input }), /Invalid context budget/);
    assert.equal(calls, 0);
    assert.equal(runner.callCount, 0);
    assert.equal(events.filter((event) => event.type === 'runtime.rejected').length, 1);
    assert.equal(
      events.some((event) => event.type === 'model.start'),
      false,
    );
  }
});

test('valid context limits can only narrow the Runner budget, including Infinity and zero', async () => {
  const model = new ModelRunner({ execution: {},
    maxInputChars: 2,
    provider: {
      async *stream() {
        yield 'answer';
      },
    },
  });
  const input = (content, maxInputChars) => ({
    messages: [{ role: 'user', content }],
    fragmentUsage: [],
    inputChars: content.length,
    maxInputChars,
  });
  // A caller may only narrow the Runner ceiling of 2: both a larger limit and
  // `Infinity` are capped by it, while 0 remains a valid (empty) budget.
  for (const limit of [Infinity, 100])
    await assert.rejects(
      model.invoke({ input: input('too large', limit) }),
      (error) => error.issues?.[0].code === 'CONTEXT_BUDGET',
    );
  await assert.rejects(
    model.invoke({ input: input('xx', 1) }),
    (error) => error.issues?.[0].code === 'CONTEXT_BUDGET',
  );
  assert.equal((await model.invoke({ input: input('', 0) })).value, 'answer');
  assert.equal((await model.invoke({ input: input('xx', Infinity) })).value, 'answer');
});

test('message shape cannot falsify character counts or reach Provider I/O through typed-field lookalikes', async () => {
  // Typed-field lookalikes (a fake `length`, a coercing `toJSON`, a sparse image
  // list) must be rejected by measurement rather than fool it into a small size.
  const malformed = [
    [{ role: 'user', content: { length: 1, toJSON: () => 'x'.repeat(10000) } }],
    [{ role: 'user', content: 1 }],
    [{ role: 'unknown', content: '' }],
    [null],
    new Array(1),
    [{ role: 'user', content: '', images: {} }],
    [{ role: 'user', content: '', images: new Array(1) }],
    [{ role: 'user', content: '', images: [{ url: { toString: () => 'image' } }] }],
    [{ role: 'user', content: '', images: [{ url: 'image', detail: 'unknown' }] }],
  ];
  for (const input of malformed) {
    let calls = 0;
    const model = new ModelRunner({ execution: {},
      maxInputChars: 1,
      provider: {
        async *stream() {
          calls++;
          yield 'answer';
        },
      },
    });
    assert.throws(() => model.prepare().measure(input), /Invalid model/);
    await assert.rejects(model.invoke({ input }), /Invalid model/);
    assert.equal(calls, 0);
    assert.equal(model.callCount, 0);
  }
});

test('assembly and Support builders share the same valid limit domain', () => {
  const builder = Support.defineContextFragments([], { maxInputChars: 100 });
  for (const limit of [NaN, -1, 0.5, -Infinity, '1']) {
    assert.throws(() => assembleFragments([], limit), /Invalid context budget/);
    assert.throws(
      () => builder.plan({ input: {}, maxInputChars: limit }),
      /Invalid context budget/,
    );
    assert.throws(
      () => builder.build({ input: {}, maxInputChars: limit }),
      /Invalid context budget/,
    );
  }
  assert.doesNotThrow(() => builder.plan({ input: {}, maxInputChars: 0 }));
  assert.doesNotThrow(() => builder.build({ input: {}, maxInputChars: Infinity }));
});

test('internal tool creator pins canonical methods and their private receivers', async () => {
  class Definition {
    #prefix = 'original';
    id = 'tool';
    kind = 'read';
    description = 'Read';
    inputSchema = { jsonSchema: { type: 'object' }, parse: (value) => value };
    authorize() {
      assert.equal(this.#prefix, 'original');
    }
    execute() {
      return this.#prefix;
    }
    parseOutput(value) {
      return `${this.#prefix}:${value}`;
    }
  }
  const source = new Definition(),
    registry = createToolRegistry([source], {}, {});
  source.authorize =
    source.execute =
    source.parseOutput =
    source.inputSchema.parse =
      () => {
        throw Error('replaced');
      };
  assert.equal(
    (await registry.invokeAsync({ toolId: 'tool', input: {} })).value,
    'original:original',
  );
  const denial = Error('denied'),
    denied = {
      ...tool(() => 'write'),
      authorize() {
        throw denial;
      },
    };
  const guarded = createToolRegistry([denied], {}, {});
  denied.authorize = () => {};
  await assert.rejects(
    guarded.invokeAsync({ toolId: 'tool', input: {} }),
    (error) => error === denial,
  );
});

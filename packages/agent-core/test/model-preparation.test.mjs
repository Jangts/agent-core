// Locks prepared model requests: measurement and sending share one transport snapshot, later input
// may still fail the budget, prepared handles are owner-bound and single-use, and schema chars are
// counted once. Covers `ModelRunner.prepare`, engine model binding and budgets; `node --test`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentCoreEngine, ModelRunner, defineWorkflow, route } from '../dist/esm/index.js';

// Minimal response collector that tracks its own character count.
const collect = () => {
  let raw = '';
  return {
    get outputChars() {
      return raw.length;
    },
    push(part) {
      raw += part;
    },
    finish: () => raw,
  };
};

test('measurement and sending reuse one dynamic transport snapshot including instruction, schema and output reservation', async () => {
  let preparations = 0,
    requests = 0;
  const counted = [],
    sent = [],
    functions = [{ name: 'answer', description: 'original', parameters: { type: 'object' } }];
  class Prepared {
    #prefix = 'instruction-1';
    get instruction() {
      return this.#prefix;
    }
    schemaChars = 30;
    options = { functions };
    createResponse() {
      assert.equal(this.#prefix, 'instruction-1');
      return collect();
    }
  }
  const transport = {
    id: 'dynamic',
    prepare() {
      preparations++;
      return new Prepared();
    },
  };
  const runner = new ModelRunner({ execution: {},
    provider: {
      async *stream(messages, context) {
        requests++;
        sent.push({ messages, options: context.options });
        yield 'answer';
      },
    },
    transports: [transport],
    maxInputChars: 2000,
    maxOutputTokens: 20,
    tokenBudget: {
      counterId: 'test-exact',
      contextWindowTokens: 1000,
      safetyMarginTokens: 10,
      countTokens(request) {
        counted.push(structuredClone(request));
        return (
          request.messages.reduce((sum, message) => sum + message.content.length, 0) +
          JSON.stringify(request.functions).length
        );
      },
    },
  });
  const prepared = runner.prepare({ stageId: 'reply', transport });
  const first = prepared.measure('question'),
    second = prepared.measure('question again');
  // Two measurements and one invoke all share a single preparation.
  assert.equal(preparations, 1);
  assert.equal(requests, 0);
  assert.equal(runner.callCount, 0);
  assert.equal(first.schemaChars, JSON.stringify(functions).length);
  assert.equal(first.instructionChars, 'instruction-1'.length);
  assert.equal(
    first.inputChars,
    'question'.length + 'instruction-1'.length + JSON.stringify(functions).length,
  );
  // 1000 window minus the 10-token safety margin minus 20 reserved output tokens.
  assert.equal(first.inputTokenLimit, 970);
  assert.ok(first.withinBudget);
  assert.ok(second.inputTokens > first.inputTokens);
  functions[0].description = 'changed after measurement';
  assert.equal((await runner.invoke({ input: 'question', prepared })).value, 'answer');
  assert.equal(preparations, 1);
  assert.equal(requests, 1);
  assert.deepEqual(sent[0].messages, counted[0].messages);
  // The prepared snapshot keeps the original function schema, not the mutated one.
  assert.equal(sent[0].options.functions[0].description, 'original');
  assert.equal(sent[0].options.maxOutputTokens, 20);
  assert.equal(runner.lastCall.inputTokens, first.inputTokens);
  assert.equal(runner.lastCall.inputChars, first.inputChars);
  await assert.rejects(runner.invoke({ input: 'again', prepared }), /already used/);
  // A prepared request is single-use so measurement and send cannot diverge.
  assert.throws(() => prepared.measure('again'), /already been used/);
});

test('measurement is advisory about candidate input; final enforcement rejects a larger input without spending a call', async () => {
  let requests = 0;
  const runner = new ModelRunner({ execution: {},
    provider: {
      async *stream() {
        requests++;
        yield 'answer';
      },
    },
    maxInputChars: 12,
    transports: [
      {
        id: 'instruction',
        prepare: () => ({
          schemaChars: 0,
          options: {},
          instruction: 'prefix',
          createResponse: collect,
        }),
      },
    ],
  });
  const prepared = runner.prepare({ transport: 'instruction' });
  const measurement = prepared.measure('short');
  assert.ok(measurement.withinBudget);
  // Without a token counter, measurement reports characters only.
  assert.equal(measurement.counterId, undefined);
  assert.equal(measurement.inputTokens, undefined);
  await assert.rejects(
    runner.invoke({ input: 'longer than the actual limit', prepared }),
    (error) => error.issues?.[0].code === 'CONTEXT_BUDGET',
  );
  assert.equal(requests, 0);
  assert.equal(runner.callCount, 0);
});

test('prepared calls reject foreign owners and setting changes, and retain cancellation', async () => {
  const provider = {
      async *stream() {
        yield 'answer';
      },
    },
    control = new AbortController();
  const runner = new ModelRunner({ provider, execution: { signal: control.signal } });
  const other = new ModelRunner({ execution: {}, provider }),
    prepared = runner.prepare({ stageId: 'fixed', maxOutputTokens: 12 });
  await assert.rejects(other.invoke({ input: 'question', prepared }), /foreign/);
  // Prepared settings are frozen; overriding maxOutputTokens is rejected.
  await assert.rejects(
    runner.invoke({ input: 'question', prepared, maxOutputTokens: 13 }),
    /cannot be replaced/,
  );
  control.abort();
  assert.throws(() => prepared.measure('question'), { name: 'AbortError' });
  await assert.rejects(runner.invoke({ input: 'question', prepared }), { name: 'AbortError' });
});

test('Workflow preparation crosses ordinary nodes and shares the same multi-model request budget', async () => {
  let preparations = 0,
    calls = 0;
  const transport = {
    id: 'reply',
    prepare() {
      preparations++;
      return { options: {}, schemaChars: 0, instruction: 'fixed', createResponse: collect };
    },
  };
  const provider = {
    async *stream() {
      calls++;
      yield 'answer';
    },
  };
  const workflow = defineWorkflow({
    id: 'prepared-workflow',
    nodes: [
      {
        id: 'prepare',
        description: 'Measure candidate input',
        run(_, ctx) {
          const prepared = ctx.model.prepare({ transport, modelId: 'main' });
          return { prepared, input: 'question', measurement: prepared.measure('question') };
        },
        routes: [route.to('reduce')],
      },
      {
        id: 'reduce',
        description: 'Use the shared quota for a processing model',
        async run(_, ctx) {
          await ctx.model.invoke({ input: 'reduce', modelId: 'helper' });
        },
        routes: [route.to('answer')],
      },
      {
        id: 'answer',
        description: 'Send using the exact original preparation',
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
  const engine = new AgentCoreEngine({
    workflow,
    models: { main: { provider, transports: [transport] }, helper: { provider } },
    model: 'helper',
    maxModelCalls: 2,
  });
  assert.equal(await engine.run({}), 'answer');
  assert.equal(calls, 2);
  assert.equal(preparations, 1);
  // Helper and main model calls share the single engine-wide budget of two.
  await assert.rejects(
    new AgentCoreEngine({
      workflow,
      models: { main: { provider, transports: [transport] }, helper: { provider } },
      model: 'helper',
      maxModelCalls: 1,
    }).run({}),
    (error) => error.code === 'BUDGET',
  );
});

test('schemas embedded in instructions consume their own allowance once and cannot underreport transport size', async () => {
  const instruction = 'schema '.repeat(100),
    sent = [];
  const transport = {
    id: 'json-like',
    prepare: () => ({
      options: { json: true },
      schemaChars: instruction.length,
      instruction,
      createResponse: collect,
    }),
  };
  const runner = new ModelRunner({ execution: {},
    provider: {
      async *stream(messages) {
        sent.push(messages);
        yield 'answer';
      },
    },
    transports: [transport],
    maxInputChars: 5,
    maxSchemaChars: 1000,
  });
  const prepared = runner.prepare({ transport });
  const measured = prepared.measure('hello');
  // An instruction-embedded schema is charged to transport chars, not double-counted.
  assert.equal(measured.schemaChars, 0);
  assert.equal(measured.transportChars, instruction.length);
  assert.equal(measured.inputChars, instruction.length + 5);
  assert.equal(measured.withinBudget, true);
  assert.equal((await runner.invoke({ input: 'hello', prepared })).value, 'answer');
  assert.equal(runner.lastCall.inputChars, measured.inputChars);
  assert.equal(sent.length, 1);
  const dishonest = new ModelRunner({ execution: {},
    provider: {
      async *stream() {
        assert.fail('unbounded declarations must not reach Provider');
      },
    },
    maxSchemaChars: 10,
    transports: [
      {
        id: 'underreported',
        prepare: () => ({ options: {}, schemaChars: 0, instruction, createResponse: collect }),
      },
    ],
  });
  const blocked = dishonest.prepare({ transport: 'underreported' });
  // Under-reporting schemaChars is caught by the schema budget check.
  assert.equal(blocked.measure('hello').withinBudget, false);
  await assert.rejects(
    dishonest.invoke({ input: 'hello', prepared: blocked }),
    (error) => error.issues?.[0].code === 'MODEL_SCHEMA_BUDGET',
  );
});

test('typed message preparation verifies the media contract and preserves instruction order', async () => {
  const { preparedInputSize } = await import('../dist/esm/model/preparation.js');
  const prepared = { options: {}, schemaChars: 0, instruction: 'Follow the output schema.' };
  for (const [parts, reason] of [
    [{}, /Invalid model content parts/], [[null], /Invalid model content part/],
    [[{ type: 'text', text: 7 }], /Invalid text content/],
    [[{ type: 'file', url: 'https://assets.invalid/report', mimeType: 7 }], /Invalid media content/],
  ]) assert.throws(() => preparedInputSize([{ role: 'user', content: '', parts }], prepared), reason);
  const result = preparedInputSize([
    { role: 'system', content: '', parts: [{ type: 'text', text: 'Host instruction.' }] },
    { role: 'user', content: '', parts: [{ type: 'file', url: 'https://assets.invalid/report', mimeType: 'application/pdf' }] },
  ], prepared);
  assert.deepEqual(result.messages[0].parts, [
    { type: 'text', text: 'Host instruction.' }, { type: 'text', text: prepared.instruction },
  ]);
  assert.equal(result.messages[1].parts[0].mimeType, 'application/pdf');
});

test('prepared calls reject option replacement and typed interactions require their registered instance', async () => {
  const interaction = { id: 'reply', prepare() { return { options: {}, schemaChars: 0, createResponse: collect }; } };
  const runner = new ModelRunner({ execution: {}, interactions: [interaction], provider: {
    async *stream() { yield 'done'; },
  } });
  await assert.rejects(runner.invoke({ input: 'question', interaction: { ...interaction } }),
    /registered interaction instance/);
  const prepared = runner.prepare({ interaction });
  await assert.rejects(runner.invoke({ input: 'question', prepared, modelOptions: { includeUsage: true } }),
    /Prepared model options cannot be replaced/);
  assert.equal(runner.totalCallCount, 0);
  assert.equal((await runner.invoke({ input: 'question', prepared })).value, 'done');
});

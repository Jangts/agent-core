// Locks the public integration surface: the Support tool catalog and transports must agree with a
// real `ModelRunner` on schema projection, authorization, cancellation and call budgets.
// Uses `context-workflow.fixture` plus dist/esm exports; runs with `node --test`.
import { contextRunner } from './context-workflow.fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ModelRunner, Support, ValidationError } from '../dist/esm/index.js';
const provider = {
  async *stream() {
    yield 'ok';
  },
};
const signal = () => new AbortController().signal;
// One shared baseline keeps budget and timeout assertions comparable; transports go last so that
// callers can still override them.
function options(extra = {}) {
  return {
    provider,
    maxCalls: 1,
    callTimeoutMs: 1000,
    execution: { signal: signal() },
    maxInputChars: 100,
    ...extra,
    transports: [Support.createTextTransport({ id: 'text' })],
  };
}
const request = {
  stageId: 'reply',
  input: [{ role: 'user', content: 'hi' }],
  maxOutputTokens: 20,
  transport: 'text',
};
const code = (expected) => (error) => error.issues?.some((item) => item.code === expected);

test('named model calls preserve budgets and journal across constructor forms', async () => {
  const model = new ModelRunner(options());
  assert.equal((await model.invoke(request)).value, 'ok');
  assert.equal(model.callCount, 1);
  assert.equal(model.journal.snapshot().length, 1);
  // maxCalls is spent per accepted call, so the second invoke fails without changing the count.
  await assert.rejects(model.invoke(request));
  assert.equal(model.callCount, 1);
  const legacy = new ModelRunner({
    provider: provider,
    ...options(),
    execution: { signal: signal() },
    maxInputChars: 100,
  });
  assert.equal((await legacy.invoke(request)).value, 'ok');
});
test('named calls retain input rejection and cancellation without provider execution', async () => {
  let called = 0;
  const model = new ModelRunner(
    options({
      provider: {
        async *stream() {
          called++;
        },
      },
    }),
  );
  // 'x'.repeat(101) is one character past maxInputChars 100 from the shared baseline.
  await assert.rejects(
    model.invoke({ ...request, input: [{ role: 'user', content: 'x'.repeat(101) }] }),
    code('CONTEXT_BUDGET'),
  );
  const control = new AbortController();
  control.abort(new Error('cancelled'));
  await assert.rejects(
    new ModelRunner(options({ execution: { signal: control.signal } })).invoke(request),
    /cancelled/,
  );
  assert.equal(called, 0);
});
function denyUnlessAllowed({ app }) {
  if (!app.allowed)
    throw new ValidationError([{ code: 'TOOL_AUTH', message: 'Tool authorization denied' }]);
}
function catalog({
  parseInput = (value) => {
    if (!value || typeof value.value !== 'number') throw new Error('invalid input');
    return value.value;
  },
  ...overrides
} = {}) {
  return Support.defineToolCatalog([
    Support.defineTool({
      id: 'double',
      kind: 'math',
      description: 'Double a number',
      inputSchema: Support.defineSchema({
        jsonSchema: {
          type: 'object',
          additionalProperties: false,
          properties: { value: { type: 'number' } },
          required: ['value'],
        },
        parse: parseInput,
      }),
      authorize: (_input, context) => denyUnlessAllowed(context),
      execute: (input) => input * 2,
      parseOutput(value) {
        if (typeof value !== 'number') throw new Error('invalid output');
        return value;
      },
      ...overrides,
    }),
  ]);
}
test('one declarative catalog creates matching model proposals and validated executions', async () => {
  let executions = 0,
    parsed = 0;
  const tools = catalog({
    parseInput(value) {
      parsed++;
      if (!value || typeof value.value !== 'number') throw new Error('invalid input');
      return value.value;
    },
    execute(input) {
      executions++;
      return input * 2;
    },
  });
  const proposal = tools.tools.resolve(
    { toolId: 'double', input: { value: 4 } },
    { stageId: 'choose' },
  );
  assert.deepEqual(proposal, { toolId: 'double', input: { value: 4 } });
  assert.equal(executions, 0);
  assert.equal(parsed, 0);
  const runtime = tools.bind({ app: { allowed: true }, execution: { signal: signal() } });
  assert.equal((await runtime.invoke({ toolId: proposal.toolId, input: proposal.input })).value, 8);
  assert.equal(parsed, 1);
  assert.equal(executions, 1);
  assert.equal(runtime.events[0].status, 'success');
});
test('authorization uses server context per runtime and false denies execution', async () => {
  let executed = 0;
  const tools = catalog({
    execute: (input) => {
      executed++;
      return input * 2;
    },
  });
  const denied = tools.bind({ app: { allowed: false }, execution: { signal: signal() } });
  await assert.rejects(
    denied.invoke({ toolId: 'double', input: { value: 2, allowed: true } }),
    code('TOOL_AUTH'),
  );
  assert.equal(executed, 0);
  assert.equal(denied.events[0].status, 'error');
  const allowed = tools.bind({ app: { allowed: true }, execution: { signal: signal() } });
  assert.equal((await allowed.invoke({ toolId: 'double', input: { value: 2 } })).value, 4);
  assert.equal(allowed.events.length, 1);
  assert.equal(denied.events.length, 1);
});
test('async authorization and execution complete before output checking and receipts', async () => {
  const stages = [];
  const tools = catalog({
    async authorize() {
      await Promise.resolve();
      stages.push('authorize');
    },
    async execute(input) {
      await Promise.resolve();
      stages.push('execute');
      return input * 2;
    },
    parseOutput(value) {
      stages.push('output');
      return value;
    },
  });
  const runtime = tools.bind({ app: {}, execution: { signal: signal() } });
  assert.equal((await runtime.invoke({ toolId: 'double', input: { value: 5 } })).value, 10);
  assert.deepEqual(stages, ['authorize', 'execute', 'output']);
  assert.equal(runtime.events[0].status, 'success');
});
test('invalid input and output do not create successful tool receipts', async () => {
  let executed = 0;
  const runtime = catalog({
    execute: (input) => {
      executed++;
      return input;
    },
  }).bind({ app: { allowed: true }, execution: { signal: signal() } });
  await assert.rejects(
    runtime.invoke({ toolId: 'double', input: { value: 'bad' } }),
    /invalid input/,
  );
  assert.equal(executed, 0);
  const output = catalog({ execute: () => 'bad' }).bind({
    app: { allowed: true },
    execution: { signal: signal() },
  });
  await assert.rejects(output.invoke({ toolId: 'double', input: { value: 1 } }), /invalid output/);
  assert.ok([...runtime.events, ...output.events].every((event) => event.status === 'error'));
});
test('cancellation after authorization prevents execution, and late output never passes validation', async () => {
  for (const phase of ['authorize', 'execute']) {
    const control = new AbortController();
    let output = 0;
    let executions = 0;
    const runtime = catalog({
      async authorize() {
        if (phase === 'authorize') control.abort(new Error('cancelled'));
      },
      async execute(input) {
        executions++;
        if (phase === 'execute') control.abort(new Error('cancelled'));
        return input;
      },
      parseOutput(value) {
        output++;
        return value;
      },
    }).bind({ app: {}, execution: { signal: control.signal } });
    await assert.rejects(runtime.invoke({ toolId: 'double', input: { value: 1 } }), /cancelled/);
    assert.equal(executions, phase === 'authorize' ? 0 : 1);
    assert.equal(output, 0);
    assert.equal(runtime.events[0].status, 'cancelled');
  }
});
test('selection projects the same catalog into schemas and execution, and frozen declarations resist mutation', async () => {
  const tools = catalog();
  assert.throws(() => tools.select(['missing']), /not registered/);
  assert.throws(() => tools.select(['double', 'double']), /selection/);
  const selected = tools.select(['double']);
  assert.deepEqual(
    [...selected.tools.values()].map((item) => item.id),
    ['double'],
  );
  await assert.rejects(
    selected
      .bind({ app: { allowed: true }, execution: { signal: signal() } })
      .invoke({ toolId: 'missing', input: {} }),
    /not registered/,
  );
  assert.throws(() => {
    tools.definitions[0].inputSchema.jsonSchema.required.push('forged');
  }, TypeError);
  assert.throws(
    () => Support.defineToolCatalog([tools.definitions[0], tools.definitions[0]]),
    /duplicate/,
  );
});

test('a full native proposal, authorized execution and named reply use one model budget', async () => {
  const tools = catalog();
  const runtime = tools.bind({ app: { allowed: true }, execution: { signal: signal() } });
  const input = [{ role: 'user', content: 'Double four' }];
  const seen = [];
  const model = new ModelRunner({
    provider: {
      async *stream(messages, { signal: _signal, options: options = {} }) {
        seen.push(messages);
        if (options.functions)
          yield {
            type: 'function-call-delta',
            index: 0,
            id: 'call-1',
            name: options.functions[0].name,
            arguments: '{"value":4}',
          };
        else yield '8';
      },
    },
    execution: { signal: signal() },
    maxInputChars: 4000,
    maxCalls: 2,
    callTimeoutMs: 1000,
    maxSchemaChars: 4000,
    transports: [
      Support.createModelTransport({ id: 'tool', tools: runtime.tools }),
      Support.createTextTransport({ id: 'text' }),
    ],
  });
  const proposal = (
    await model.invoke({ stageId: 'choose', input, maxOutputTokens: 100, transport: 'tool' })
  ).value;
  assert.equal(runtime.events.length, 0);
  // A proposal does not execute the tool; the caller must invoke it explicitly.
  const result = (await runtime.invoke({ toolId: proposal.toolId, input: proposal.input })).value;
  assert.equal(result, 8);
  assert.equal(runtime.events[0].status, 'success');
  assert.equal(
    (
      await model.invoke({
        stageId: 'reply',
        input: [{ role: 'user', content: JSON.stringify({ result }) }],
        maxOutputTokens: 100,
        transport: 'text',
      })
    ).value,
    '8',
  );
  assert.equal(model.callCount, 2);
  assert.equal(seen.length, 2);
});
test('class handlers retain receivers and replacing a declaration method cannot bypass its registered authorization', async () => {
  class Definition {
    id = 'double';
    kind = 'math';
    description = 'Double';
    factor = 2;
    inputSchema = Support.defineSchema({
      jsonSchema: { type: 'object' },
      parse(value) {
        return value.value;
      },
    });
    authorize(_input, context) {
      denyUnlessAllowed(context);
    }
    execute(value) {
      return value * this.factor;
    }
    parseOutput(value) {
      return value;
    }
  }
  const definition = new Definition();
  const declared = Support.defineTool(definition);
  const tools = Support.defineToolCatalog([declared]);
  definition.authorize = () => {};
  await assert.rejects(
    tools
      .bind({ app: { allowed: false }, execution: { signal: signal() } })
      .invoke({ toolId: 'double', input: { value: 2 } }),
    code('TOOL_AUTH'),
  );
  assert.equal(
    (
      await tools
        .bind({ app: { allowed: true }, execution: { signal: signal() } })
        .invoke({ toolId: 'double', input: { value: 2 } })
    ).value,
    4,
  );
});

test('call lifecycle reports actual successes and failures once and isolates observers', async () => {
  const traces = [];
  const settings = options();
  settings.maxCalls = 2;
  settings.execution.observe = {
    event: (event) => {
      if (event.type !== 'model.end') return;
      const trace = event.payload.state;
      traces.push(trace);
      trace.status = 'observer-change';
      throw new Error('observer failed');
    },
  };
  let count = 0;
  settings.provider = {
    async *stream() {
      if (++count === 2) throw new Error('upstream failed');
      yield 'ok';
    },
  };
  const model = new ModelRunner(settings);
  assert.equal((await model.invoke(request)).value, 'ok');
  assert.equal(model.lastCall.status, 'success');
  await assert.rejects(model.invoke(request), /upstream failed/);
  assert.equal(traces.length, 2);
  assert.equal(model.lastCall.status, 'error');
  await assert.rejects(model.invoke(request));
  assert.equal(traces.length, 2, 'budget rejection is not an actual model call');
});
test('call lifecycle includes compression subcalls without requiring application overrides', async () => {
  const traces = [];
  const settings = options();
  settings.maxCalls = 3;
  settings.execution.observe = {
    event: (event) => {
      if (event.type === 'model.end') traces.push(event.payload.state);
    },
  };
  settings.contextPolicy = {
    mode: 'reduce',
    steps: [
      {
        id: 'summarize',
        kind: 'compress',
        fragmentId: 'history',
        targetChars: 40,
        handlerId: 'summary',
      },
    ],
  };
  settings.contextCompressors = [
    Support.createContextCompressor({
      id: 'summary',
      instruction: 'Summarize',
      transport: 'text',
      maxOutputTokens: 20,
      parse: (value) => ({ history: value }),
    }),
  ];
  settings.maxInputChars = 1000;
  const model = contextRunner(settings);
  (
    await model.invoke({
      ...request,
      input: {
        fragments: [
          {
            id: 'history',
            sourceId: 'test',
            trust: 'user',
            role: 'user',
            lifetime: 'turn',
            maxChars: 1000,
            value: { history: 'x'.repeat(200) },
          },
        ],
        maxInputChars: 50,
      },
    })
  ).value;
  assert.equal(traces.length, 2);
  assert.equal(model.callCount, 2);
  assert.match(traces[0].stageId, /compress/);
  assert.equal(traces[1].stageId, 'reply');
});
test('custom protocols can use the compiled Core registry with unchanged synchronous tool behavior', () => {
  const tools = catalog();
  const registry = tools.bind({ app: { allowed: true }, execution: { signal: signal() } });
  assert.equal(registry.invokeSync({ toolId: 'double', input: { value: 4 } }).value, 8);
  assert.equal(registry.events[0].status, 'success');
  assert.throws(
    () =>
      tools
        .bind({ app: { allowed: false }, execution: { signal: signal() } })
        .invokeSync({ toolId: 'double', input: { value: 4 } }),
    code('TOOL_AUTH'),
  );
});

test('typed registered transports resolve through capability validation and reject foreign handles', async () => {
  const definitions = [
    {
      id: 'reply',
      description: 'Reply',
      inputSchema: { jsonSchema: { type: 'object' }, parse: (value) => value },
      resolve(value) {
        if (typeof value.text !== 'string') throw new Error('invalid reply');
        return { text: value.text.trim() };
      },
    },
  ];
  const tools = Support.defineModelTools(definitions);
  definitions[0].parse = () => 'forged';
  const transport = Support.createModelTransport({ id: 'reply', tools });
  let argumentsText = '{"text":" ok "}';
  const settings = options({
    provider: {
      async *stream() {
        yield {
          type: 'function-call-delta',
          index: 0,
          id: 'call-typed',
          name: 'reply',
          arguments: argumentsText,
        };
      },
    },
  });
  settings.maxCalls = 2;
  settings.transports = [transport];
  settings.maxSchemaChars = 2000;
  settings.maxInputChars = 2000;
  const model = new ModelRunner(settings);
  await assert.rejects(
    model.invoke({ ...request, transport: { ...transport } }),
    /registered transport instance/,
  );
  assert.equal(model.callCount, 0);
  assert.deepEqual((await model.invoke({ ...request, transport })).value, { text: 'ok' });
  argumentsText = '{"text":12}';
  await assert.rejects(model.invoke({ ...request, transport }), /invalid reply/);
});

test('schema adapters derive model schema and parse once before authorization', async () => {
  let compilations = 0;
  let parses = 0;
  const seen = [];
  const schema = { type: 'object', properties: { value: { type: 'number' } } };
  const inputSchema = Support.fromJsonSchema(schema, {
    compile: (compiled) => {
      compilations++;
      assert.equal(Object.isFrozen(compiled.properties), true);
      return (value) => {
        parses++;
        return typeof value?.value === 'number';
      };
    },
    error: () => new Error('application schema error'),
  });
  schema.properties.value.type = 'string';
  const tool = Support.defineTool({
    id: 'adapter',
    kind: 'math',
    description: 'Math',
    inputSchema,
    authorize(input, context) {
      seen.push(['authorize', input]);
      denyUnlessAllowed(context);
    },
    execute(input) {
      seen.push(['execute', input]);
      return input.value * 2;
    },
    parseOutput: (value) => value,
  });
  const runtime = Support.defineToolCatalog([tool]).bind({
    app: { allowed: true },
    execution: { signal: signal() },
  });
  assert.equal(tool.inputSchema.jsonSchema.properties.value.type, 'number');
  await assert.rejects(
    runtime.invoke({ toolId: 'adapter', input: { value: '2' } }),
    /application schema error/,
  );
  assert.deepEqual(seen, []);
  assert.equal((await runtime.invoke({ toolId: 'adapter', input: { value: 2 } })).value, 4);
  assert.equal(compilations, 1);
  assert.equal(parses, 2);
  const parser = { type: 'object', parse: (value) => ({ value: Number(value.value) }) };
  const derived = Support.fromParserSchema(parser, {
    toJsonSchema: (value) => ({ type: value.type }),
  });
  assert.deepEqual(derived.parse({ value: '3' }), { value: 3 });
  assert.throws(
    () =>
      Support.fromParserSchema({ parse: async () => ({}) }, { toJsonSchema: () => ({}) }).parse({}),
    /synchronous/,
  );
  assert.throws(
    () => Support.fromJsonSchema({}, { compile: () => async () => true }).parse({}),
    /synchronous/,
  );
});

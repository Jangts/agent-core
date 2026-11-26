// Locks the model interaction adapters: native function calls and JSON-object selections must
// resolve the same registered capability and reject malformed or foreign selections alike.
// Covers `ModelToolRegistry`, `createModelTransport`, both interaction adapters and
// `ModelRunner`; runs with `node --test` against dist/esm.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ModelRunner,
  ModelToolRegistry,
  createModelTransport,
  nativeFunctionInteraction,
  jsonObjectInteraction,
} from '../dist/esm/index.js';
const signal = () => new AbortController().signal;
// Strict object schema with no extra properties, so selection input is fully validated.
const input = {
  type: 'object',
  properties: { n: { type: 'number' } },
  required: ['n'],
  additionalProperties: false,
};
// Minimal native function-call delta; index 0 is the only call in these tests.
const delta = (name, args) => ({
  type: 'function-call-delta',
  index: 0,
  id: 'call-1',
  name,
  arguments: args,
});
const runner = (provider, tools, adapter, trace = { steps: [] }) =>
  new ModelRunner({
    provider: provider,
    maxCalls: 2,
    callTimeoutMs: 100,
    maxOutputChars: 2000,
    execution: { signal: signal() },
    maxInputChars: 1000,
    maxSchemaChars: 5000,
    transports: [createModelTransport({ id: 'selection', tools, adapter })],
  });

test('one unchanged registration resolves the same business object through both implementations', async () => {
  let parsed = 0;
  let executed = 0;
  const declaration = {
    id: 'calculate',
    description: 'Calculate from checked input',
    inputSchema: { jsonSchema: input, parse: (value) => value },
    resolve(value) {
      parsed++;
      assert.equal(typeof value.n, 'number');
      return { checked: value.n };
    },
    execute(checked) {
      executed++;
      return checked.checked * 2;
    },
  };
  const tools = new ModelToolRegistry([declaration]).seal();
  for (const adapter of [nativeFunctionInteraction, jsonObjectInteraction]) {
    const trace = { steps: [] };
    const provider = {
      async *stream(messages, { signal: _signal, options: options = {} }) {
        assert.equal(
          messages.at(-1).content,
          'request',
          'core instructions do not move the request or promote its trust',
        );
        if (options.functions) yield delta(options.functions[0].name, '{"n":21}');
        else {
          assert.equal(options.json, true);
          assert.match(messages[0].content, /"name"/);
          yield '{"name":"calculate","input":{"n":21}}';
        }
      },
    };
    const model = runner(provider, tools, adapter, trace);
    const result = (
      await model.invoke({
        stageId: 'business',
        input: [{ role: 'user', content: 'request' }],
        maxOutputTokens: 100,
        transport: 'selection',
      })
    ).value;
    assert.deepEqual(result, { checked: 21 });
    assert.equal(executed, parsed - 1, 'model parsing itself has no execution effect');
    // Existing application handlers still own execution after their authorization checks.
    assert.equal(declaration.execute(result), 42);
    assert.equal(model.lastCall.status, 'success');
  }
  assert.equal(parsed, 2);
  assert.equal(executed, 2);
});

test('registry owns uniqueness, snapshotting, sealing and stage selection independently of adapters', () => {
  const declaration = {
    id: 'a',
    description: 'test',
    inputSchema: { jsonSchema: structuredClone(input), parse: (value) => value },
    resolve: (value) => value,
  };
  const registry = new ModelToolRegistry([declaration]);
  declaration.inputSchema.jsonSchema.properties.n.type = 'string';
  assert.equal(registry.get('a').inputSchema.jsonSchema.properties.n.type, 'number');
  assert.throws(() => {
    registry.get('a').inputSchema.jsonSchema.properties.n.type = 'string';
  }, TypeError);
  assert.throws(() => registry.register(declaration), /duplicate/);
  assert.throws(() => registry.select(['missing']), /not registered/);
  assert.throws(() => registry.select(['a', 'a']));
  const selected = registry.select(['a']);
  assert.equal(selected.has('a'), true);
  assert.throws(() => selected.register({ ...declaration, id: 'b' }), /sealed/);
});

test('foreign, malformed and ambiguous JSON selections cannot reach business parsers or trigger adapter fallback', async () => {
  // Each raw is a protocol violation: empty, unknown capability, wrong input type, trailing document
  // and a fenced block.
  for (const raw of [
    '{}',
    '{"name":"unknown","input":{}}',
    '{"name":"a","input":[]}',
    '{"name":"a","input":{}}{}',
    '```json\n{}\n```',
  ]) {
    let parsed = 0;
    let calls = 0;
    const registry = new ModelToolRegistry([
      {
        id: 'a',
        description: 'test',
        inputSchema: { jsonSchema: input, parse: (value) => value },
        resolve: (value) => {
          parsed++;
          return value;
        },
      },
    ]);
    await assert.rejects(
      runner(
        {
          async *stream() {
            calls++;
            yield raw;
          },
        },
        registry,
        jsonObjectInteraction,
      ).invoke({ stageId: 'x', input: [], maxOutputTokens: 10, transport: 'selection' }),
      (error) => error.issues[0].code === 'MODEL_PROTOCOL',
    );
    assert.equal(parsed, 0);
    // A single provider call: a rejected selection never triggers adapter fallback.
    assert.equal(calls, 1);
  }
});

test('native names are formatted by core while arbitrary business IDs round-trip unchanged', async () => {
  // Business ids are arbitrary text; Core must map them to provider-safe wire names.
  const id = '业务.检查/很长的名称'.repeat(10);
  const registry = new ModelToolRegistry([
    {
      id,
      description: 'test',
      inputSchema: { jsonSchema: input, parse: (value) => value },
      resolve: (value) => ({ id, ...value }),
    },
  ]);
  const result = (
    await runner(
      {
        async *stream(_messages, { signal: _signal, options: options = {} }) {
          const name = options.functions[0].name;
          assert.match(name, /^[a-zA-Z0-9_-]{1,64}$/);
          assert.notEqual(name, id);
          yield delta(name, '{"n":2}');
        },
      },
      registry,
      nativeFunctionInteraction,
    ).invoke({ stageId: 'x', input: [], maxOutputTokens: 10, transport: 'selection' })
  ).value;
  assert.deepEqual(result, { id, n: 2 });
  // The original id round-trips even though the wire name was rewritten.
});

test('unsupported strict requirements fail at construction, never silently downgrade', () => {
  const registry = new ModelToolRegistry([
    {
      id: 'a',
      description: 'test',
      inputSchema: { jsonSchema: input, parse: (value) => value },
      resolve: (value) => value,
    },
  ]);
  // Neither adapter can express strict arguments, so both must fail at construction.
  for (const adapter of [nativeFunctionInteraction, jsonObjectInteraction])
    assert.throws(
      () =>
        createModelTransport({
          id: 'selection',
          tools: registry,
          adapter,
          requireStrictArguments: true,
        }),
      /does not support/,
    );
});

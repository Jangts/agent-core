// Locks the JSON value transport: schema, options and parser receiver are snapshotted at creation,
// each response gets an isolated collector, and only whole JSON values pass validation.
// Covers `Support.createJsonTransport` and `ModelRunner`; `node --test` against dist/esm.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ModelRunner, Support } from '../dist/esm/index.js';

// Accepts any decoded JSON value; used where the test is not about schema shape.
const identity = { jsonSchema: {}, parse: (value) => value };

test('JSON value transport snapshots schema, options and parser receiver without wrapping the value', async () => {
  class Schema {
    #prefix = 'bound:';
    jsonSchema = {
      type: 'object',
      properties: { summary: { type: 'string' } },
      required: ['summary'],
    };
    parse(value) {
      if (!value || typeof value.summary !== 'string') throw new Error('summary required');
      return { summary: this.#prefix + value.summary };
    }
  }
  const schema = new Schema(),
    options = { temperature: 0 };
  const transport = Support.createJsonTransport({ id: 'summary', outputSchema: schema, options });
  schema.jsonSchema.properties.secret = { type: 'string' };
  schema.parse = () => assert.fail('original parser must stay bound');
  options.temperature = 1;
  const prepared = transport.prepare('summary');
  assert.equal(prepared.options.json, true);
  assert.equal(prepared.options.temperature, 0);
  // The schema is embedded in the instruction, so its size equals the instruction length.
  assert.equal(prepared.schemaChars, prepared.instruction.length);
  assert.equal(prepared.instruction.includes('secret'), false);
  const runner = new ModelRunner({
    provider: {
      async *stream() {
        yield '{"summary":';
        yield '"short"}';
      },
    },
    transports: [transport],
  });
  assert.deepEqual((await runner.invoke({ input: 'summarize', transport })).value, {
    summary: 'bound:short',
  });
});

test('each JSON response has an isolated collector and preserves all valid JSON value kinds', () => {
  const transport = Support.createJsonTransport({ id: 'json', outputSchema: identity });
  const prepared = transport.prepare('json'),
    first = prepared.createResponse(),
    second = prepared.createResponse();
  first.push('{"a":');
  second.push('[1,2]');
  first.push('true}');
  assert.deepEqual(first.finish(), { a: true });
  assert.deepEqual(second.finish(), [1, 2]);
  // Falsy and scalar JSON values must survive; a collector cannot treat them as missing.
  for (const value of [null, false, 0, 'text']) {
    const collector = prepared.createResponse();
    collector.push(JSON.stringify(value));
    assert.equal(collector.finish(), value);
  }
});

test('JSON transport rejects partial JSON, multiple documents, function calls and async schema parsers', async () => {
  const prepared = Support.createJsonTransport({ id: 'json', outputSchema: identity }).prepare(
    'json',
  );
  // Partial, concatenated and fenced documents are protocol errors, never repaired.
  for (const text of ['', '{"x":', '{}{}', '```json\n{}\n```']) {
    const collector = prepared.createResponse();
    collector.push(text);
    assert.throws(
      () => collector.finish(),
      (error) => error.issues?.[0].code === 'MODEL_PROTOCOL',
    );
  }
  // JSON mode never accepts native function-call frames.
  assert.throws(
    () => prepared.createResponse().push({ type: 'function-call-delta', index: 0 }),
    (error) => error.issues?.[0].code === 'MODEL_PROTOCOL',
  );
  const asyncPrepared = Support.createJsonTransport({
    id: 'async',
    outputSchema: {
      jsonSchema: {},
      async parse() {
        throw new Error('late rejection');
      },
    },
  }).prepare('async');
  const collector = asyncPrepared.createResponse();
  collector.push('{}');
  assert.throws(() => collector.finish(), /synchronous/);
  // Let the rejected async parser settle so the run leaks no unhandled rejection.
  await new Promise((resolve) => setImmediate(resolve));
});

test('Runner budgets and cancellation still govern JSON transport calls', async () => {
  const transport = Support.createJsonTransport({ id: 'json', outputSchema: identity });
  let calls = 0;
  const runner = new ModelRunner({
    provider: {
      async *stream() {
        calls++;
        yield '{"x":"large"}';
      },
    },
    transports: [transport],
    maxOutputChars: 3,
  });
  await assert.rejects(runner.invoke({ input: 'x', transport }));
  assert.equal(calls, 1);
  const controller = new AbortController();
  controller.abort('stopped');
  const cancelled = new ModelRunner({
    provider: {
      async *stream() {
        calls++;
        yield '{}';
      },
    },
    transports: [transport],
    execution: { signal: controller.signal },
  });
  await assert.rejects(cancelled.invoke({ input: 'x', transport }), (error) => error === 'stopped');
  assert.equal(calls, 1);
  const bounded = new ModelRunner({
    provider: {
      async *stream() {
        calls++;
      },
    },
    transports: [transport],
    maxSchemaChars: 1,
  });
  await assert.rejects(bounded.invoke({ input: 'x', transport }));
  assert.equal(calls, 1);
});

test('JSON decoding remains available when a provider requires text mode for scalar or array results', async () => {
  // Text mode is kept for providers that reject response_format json_object.
  const transport = Support.createJsonTransport({
    id: 'scalar',
    options: { json: false },
    outputSchema: {
      jsonSchema: { type: 'number' },
      parse(value) {
        if (typeof value !== 'number') throw new Error('number required');
        return value;
      },
    },
  });
  const model = new ModelRunner({
    provider: {
      async *stream(_messages, { options }) {
        assert.equal(options.json, false);
        yield '42';
      },
    },
    transports: [transport],
  });
  assert.equal((await model.invoke({ input: 'number', transport })).value, 42);
});

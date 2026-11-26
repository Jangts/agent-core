import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ModelRunner } from '../dist/esm/model/runner.js';
import { getErrorInfo } from '../dist/esm/index.js';
import { createModelTransport } from '../dist/esm/support/model/index.js';
import { prepareSessionFunctions } from '../dist/esm/support/model/session.js';
import { defineToolCatalog } from '../dist/esm/support/tools.js';

const catalog = defineToolCatalog([
  {
    id: 'lookup',
    kind: 'read',
    description: 'Look up a value',
    inputSchema: {
      jsonSchema: { type: 'object', additionalProperties: true },
      parse: (value) => (value ?? {}),
    },
    authorize() {},
    execute: () => ({ ok: true }),
    parseOutput: (value) => value,
  },
]);

test('session transport returns text and every completed call', async () => {
  const transport = createModelTransport({ response: 'session', id: 'session', tools: catalog.tools });
  const provider = {
    async *stream() {
      yield '先查一下。';
      yield {
        type: 'function-call-delta',
        index: 0,
        id: 'call-1',
        name: 'lookup',
        arguments: '{"q":1}',
      };
      yield {
        type: 'function-call-delta',
        index: 1,
        id: 'call-2',
        name: 'lookup',
        arguments: '{}',
      };
      yield {
        type: 'function-call-delta',
        index: 2,
        id: 'call-3',
        name: 'unavailable',
        arguments: '{}',
      };
    },
  };
  const traces = [];
  const runner = new ModelRunner({
    provider,
    maxCalls: 1,
    execution: { signal: new AbortController().signal },
    transports: [transport],
    sink: {
      output(event) {
        if (event.type === 'model.end') traces.push(event.payload.state);
      },
    },
  });
  const result = await runner.invoke({
    input: [{ role: 'user', content: '查询' }],
    transport,
  });

  assert.equal(result.value.text, '先查一下。');
  assert.equal(result.value.calls.length, 3);
  assert.deepEqual(
    result.value.calls.map((call) => call.toolId),
    ['lookup', 'lookup', undefined],
  );
  assert.deepEqual(
    result.value.calls.map((call) => call.input),
    [{ q: 1 }, {}, undefined],
  );
  assert.deepEqual(
    traces[0].calls.map((call) => call.id),
    ['call-1', 'call-2', 'call-3'],
  );
  assert.equal(result.value.calls[2].problem, 'unknown-tool');
  assert.equal(Object.hasOwn(traces[0].calls[2], 'toolId'), false);
});

test('session transport marks unknown tools and invalid arguments without failing the round', () => {
  const transport = createModelTransport({ response: 'session', id: 'session', tools: catalog.tools });
  const response = transport.prepare('stage').createResponse();
  response.push({ type: 'function-call-delta', index: 0, id: 'call-1', name: 'missing', arguments: '{}' });
  response.push({ type: 'function-call-delta', index: 1, id: 'call-2', name: 'lookup', arguments: '{' });
  const result = response.finish();

  assert.equal(result.calls[0].problem, 'unknown-tool');
  assert.equal(result.calls[1].problem, 'invalid-arguments');
});

test('session transport snapshots stage options and rejects invalid registration or colliding names', () => {
  assert.throws(() => createModelTransport({ response: 'session', id: ' ', tools: catalog.tools }),
    /requires an ID/);
  const [tool] = catalog.tools.values();
  assert.throws(() => prepareSessionFunctions([tool, tool]), /wire name collision/);
  const stages = [];
  const registration = {
    response: 'session', id: 'staged-session',
    options: { temperature: 0, parallelToolCalls: false, toolChoice: 'required' },
    tools(stage) { assert.equal(this, registration); stages.push(stage); return catalog.tools; },
  };
  const transport = createModelTransport(registration);
  registration.options.temperature = 1;
  const prepared = transport.prepare('lookup-stage');
  assert.deepEqual(stages, ['lookup-stage']);
  assert.equal(prepared.options.temperature, 0);
  assert.equal(prepared.options.parallelToolCalls, false);
  assert.equal(prepared.options.toolChoice, 'required');
  assert.deepEqual(prepared.options.functions.map(({name}) => name), ['lookup']);
  assert.throws(() => createModelTransport({ ...registration, adapter: () => {} }), /do not accept a selection adapter/);
  assert.throws(() => createModelTransport({ ...registration, response: 'unknown' }), /Invalid model response shape/);
});

test('session collector withholds incomplete call metadata and decodes blank and non-object arguments', () => {
  const transport = createModelTransport({ response: 'session', id: 'session', tools: catalog.tools });
  const response = transport.prepare('stage').createResponse();
  const first = { type: 'function-call-delta', index: 0, id: 'blank' };
  response.push(first);
  assert.equal(response.calls, undefined);
  response.push({ type: first.type, index: 0, name: 'lookup' });
  response.push({ type: first.type, index: 1, id: 'array', name: 'lookup', arguments: '[]' });
  assert.deepEqual(response.calls.map(c => c.id), ['blank', 'array']);
  const result = response.finish();
  assert.deepEqual(result.calls[0].input, {});
  assert.equal(result.calls[1].problem, 'invalid-arguments');
  const empty = transport.prepare('stage').createResponse();
  empty.push('   ');
  assert.throws(() => empty.finish(), error => getErrorInfo(error).codes.includes('MODEL_INCOMPLETE'));
});

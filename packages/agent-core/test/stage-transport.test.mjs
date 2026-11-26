/**
 * Locks down `Support.createStageModelTransport`: static stage validation, snapshotted
 * stage references, per-stage capability isolation, deferred dynamic sources, resolver
 * and registration receivers, and both wire adapters. Runs under node --test with a
 * fixture response collector and no network.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ModelToolRegistry, ModelRunner, Support } from '../dist/esm/index.js';

const resolve = (prepared, capability, adapter = 'native-functions') => {
  const response = prepared.createResponse();
  response.push(
    adapter === 'json-object'
      ? JSON.stringify({ name: capability, input: {} })
      : { type: 'function-call-delta', index: 0, id: 'c1', name: capability, arguments: '{}' },
  );
  return response.finish();
};

const capability = (id) => ({
  id,
  description: id,
  inputSchema: { jsonSchema: { type: 'object', properties: {} }, parse: (value) => value },
  resolve: (value) => ({ id, value }),
});
const source = (...ids) => new ModelToolRegistry(ids.map(capability)).seal();
const stage = (id, ...tools) => ({ id, toolIds: tools });
const registration = (extra = {}) => ({
  id: 'structured',
  tools: source('read', 'reply'),
  stages: [stage('query', 'read'), stage('finish', 'reply')],
  ...extra,
});

test('static stage references reject missing tools, repeated IDs and empty selections before invocation', () => {
  // The error names the offending stage and capability so a typo is easy to locate.
  assert.throws(
    () => Support.createStageModelTransport(registration({ stages: [stage('query', 'missing')] })),
    /query -> missing/,
  );
  // Empty stage list, empty capability list, repeated capability and repeated stage id are
  // all invalid declarations.
  for (const stages of [
    [],
    [stage('query')],
    [stage('query', 'read', 'read')],
    [stage('query', 'read'), stage('query', 'reply')],
  ]) {
    assert.throws(() => Support.createStageModelTransport(registration({ stages })));
  }
});

test('stages snapshot references and prohibit cross-stage capability resolution', () => {
  const stages = [stage('query', 'read'), stage('finish', 'reply')];
  const transport = Support.createStageModelTransport(registration({ stages }));
  stages[0].toolIds.push('reply');
  stages[0].id = 'changed';
  const query = transport.prepare('query');
  assert.deepEqual(resolve(query, 'read'), { id: 'read', value: {} });
  // Each prepared stage only resolves its own tools, so 'reply' is unknown here.
  assert.throws(() => resolve(query, 'reply'));
  assert.throws(() => transport.prepare('missing'), /Unregistered model stage/);
});

test('boolean inactive tools are excluded from a prepared stage even without a host context', () => {
  const tools = new ModelToolRegistry([
    { ...capability('read'), active: false },
    capability('reply'),
  ]).seal();
  const transport = Support.createStageModelTransport({
    id: 'structured',
    tools,
    stages: [stage('query', 'read', 'reply')],
  });
  const query = transport.prepare('query');
  assert.deepEqual(query.options.functions?.map((item) => item.name), ['reply']);
});

test('dynamic sources are deferred, refreshed, and checked before sending a request', async () => {
  let lookups = 0,
    sent = 0;
  let current = source('read');
  const transport = Support.createStageModelTransport(
    registration({
      stages: [stage('query', 'read')],
      tools: () => {
        lookups++;
        return current;
      },
    }),
  );
  assert.equal(lookups, 0);
  assert.throws(() => transport.prepare('missing'));
  assert.equal(lookups, 0);
  transport.prepare('query');
  current = source('reply');
  const model = new ModelRunner({ execution: {},
    provider: {
      async *stream() {
        sent++;
      },
    },
    transports: [transport],
  });
  // The dynamic source is re-read before dispatch, so a capability that disappeared is
  // reported and no model call or provider write happens.
  await assert.rejects(
    model.invoke({ stageId: 'query', input: 'hello', transport }),
    /query -> read/,
  );
  assert.equal(sent, 0);
  assert.equal(model.callCount, 0);
  assert.equal(lookups, 2);
});

test('stage projection preserves a custom source resolver and both wire adapters', () => {
  const catalog = source('read', 'reply');
  const custom = {
    values: () => catalog.values(),
    resolve(selection, currentStage) {
      return { custom: this === custom, selection, currentStage };
    },
  };
  for (const adapter of [Support.nativeFunctionInteraction, Support.jsonObjectInteraction]) {
    const transport = Support.createStageModelTransport(
      registration({ tools: custom, adapter }),
    );
    const result = resolve(transport.prepare('query'), 'read', adapter.id);
    // `this === custom` proves the custom resolver is called on its own receiver.
    assert.equal(result.custom, true);
    assert.deepEqual(result.currentStage, { stageId: 'query' });
  }
});

test('dynamic capability factories retain their registration receiver', () => {
  const definition = registration({
    tools() {
      return this.catalog;
    },
  });
  definition.catalog = source('read', 'reply');
  const transport = Support.createStageModelTransport(definition);
  assert.equal(resolve(transport.prepare('query'), 'read').id, 'read');
});

test('stage transport reads class configuration and enforces strict adapter requirements', () => {
  class Registration {
    #catalog = source('read');
    get id() {
      return 'structured';
    }
    get stages() {
      return [stage('query', 'read')];
    }
    get adapter() {
      return Support.jsonObjectInteraction;
    }
    get options() {
      return { temperature: 0.4 };
    }
    tools() {
      return this.#catalog;
    }
  }
  class StrictRegistration extends Registration {
    get requireStrictArguments() {
      return true;
    }
  }
  const transport = Support.createStageModelTransport(new Registration());
  const prepared = transport.prepare('query');
  assert.equal(transport.id, 'structured');
  assert.equal(prepared.options.temperature, 0.4);
  assert.equal(resolve(prepared, 'read', 'json-object').id, 'read');
  assert.throws(
    () => Support.createStageModelTransport(new StrictRegistration()),
    /does not support strict arguments/,
  );
});

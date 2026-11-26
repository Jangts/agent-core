import test from 'node:test';
import assert from 'node:assert/strict';
import { ModelRunner, Support } from '../dist/esm/index.js';

function runner() {
  return new ModelRunner({ provider: { async *stream() { yield 'ok'; } } }).bind({ signal: new AbortController().signal });
}

test('resource preparation preserves mixed order, snapshots bytes, and uses no generation allowance', async () => {
  const model = runner();
  const bytes = new Uint8Array([1, 2, 3]);
  const facts = [];
  const pending = Support.prepareModelResources({ runner: model, maxBytes: 10,
    inputs: [{ type: 'text', text: 'before' }, { type: 'image', source: { kind: 'bytes', bytes, mimeType: 'image/png' } }, { type: 'text', text: 'after' }],
    ports: { authorize() { bytes[0] = 255; }, prepared(value) { facts.push(value); } },
  });
  const parts = await pending;
  assert.deepEqual(parts.map(p => p.type), ['text', 'image', 'text']);
  assert.equal(parts[1].url, 'data:image/png;base64,AQID');
  assert.equal(facts[0].bytes, 3);
  assert.equal(model.remainingCalls, 8);
  assert.equal((await model.invoke('hello')).value, 'ok');
});

test('resources check aggregate bytes, unknown URL size and current authorization', async () => {
  const model = runner();
  const facts = [];
  const ports = { authorize() {}, async resolve() { return { kind: 'bytes', bytes: new Uint8Array(6), mimeType: 'application/pdf' }; }, prepared(fact) { facts.push(fact); } };
  await assert.rejects(Support.prepareModelResources({ runner: model, maxBytes: 10, ports,
    inputs: [1, 2].map(id => ({ type: 'file', source: { kind: 'reference', id: String(id) } })),
  }), /byte limit/);
  const value = await Support.prepareModelResources({ runner: model, maxBytes: 10, ports,
    inputs: [{ type: 'image', source: { kind: 'url', url: 'https://assets.invalid/a.png' } }],
  });
  assert.equal(value[0].type, 'image');
  assert.equal(facts.at(-1).bytes, undefined);
  await assert.rejects(Support.prepareModelResources({ runner: model, maxBytes: 10, inputs: [{ type: 'file', source: { kind: 'reference', id: 'private' } }],
    ports: { async resolve() { assert.fail('not authorized'); }, authorize() { throw new Error('denied'); } },
  }), /denied/);
});

test('resource resolution observes abort without generating a model call', async () => {
  const model = runner();
  const controller = new AbortController();
  const pending = Support.prepareModelResources({ runner: model, maxBytes: 10, signal: controller.signal,
    inputs: [{ type: 'file', source: { kind: 'reference', id: 'private' } }],
    ports: { authorize() {}, async resolve() { controller.abort(new Error('cancel resource')); return { kind: 'url', url: 'https://assets.invalid/file.pdf' }; } },
  });
  await assert.rejects(pending, /cancel resource/);
  assert.equal(model.remainingCalls, 8);
});

test('continuation store isolates scope, clones values and rejects live resource handles', () => {
  const store = Support.createMemoryContinuationStore();
  const value = { version: 1, protocol: 'messages', model: 'fixture', scope: 'account:a/chat:1', data: { signature: 'opaque', parts: [] } };
  store.save(value);
  value.data.signature = 'mutated';
  assert.equal(store.load(value).data.signature, 'opaque');
  assert.equal(store.load({ ...value, scope: 'account:b/chat:1' }), undefined);
  const serialized = Support.serializeModelContinuation({ ...value, data: { responseId: 'r1' } });
  assert.throws(() => Support.parseModelContinuation(serialized, { ...value, model: 'different' }), /identity/);
  assert.throws(() => Support.serializeModelContinuation({ ...value, data: new Map() }), /resource handles/);
  assert.throws(() => Support.serializeModelContinuation({ ...value, data: { missing: undefined } }), /JSON values/);
  assert.throws(() => Support.serializeModelContinuation({ ...value, data: 'long' }, 3), /size limit/);
});

test('inline data URLs participate in resource byte limits before resolution', async () => {
  let resolved = false;
  await assert.rejects(Support.prepareModelResources({ runner: runner(), maxBytes: 2,
    inputs: [{type:'image',source:{kind:'url',url:'data:image/png;base64,AQID'}}],
    ports: {authorize() {}, async resolve() { resolved = true; }},
  }), /byte limit/);
  assert.equal(resolved, false);
});

test('malformed resource requests and unsafe URLs fail before authorization and generation', async () => {
  const model = runner();
  const base = { runner: model, maxBytes: 4, ports: { authorize() { assert.fail('invalid input authorized'); } } };
  const image = source => [{ type: 'image', source }];
  const invalid = [
    [{ maxBytes: 0, inputs: [] }, /Invalid resource limits/],
    [{ maxItems: -1, inputs: [] }, /Invalid resource limits/],
    [{ maxItems: 1, inputs: [{ type: 'text', text: '' }, { type: 'text', text: '' }] }, /Invalid model resource request/],
    [{ inputs: [{ type: 'text', text: 1 }] }, /Invalid resource text/],
    [{ inputs: [{ type: 'unsupported' }] }, /Invalid resource type/],
    [{ inputs: image({ kind: 'url', url: 'ftp://assets.invalid/p' }) }, /Invalid model resource URL/],
    [{ inputs: image({ kind: 'url', url: 'https://user:pass@assets.invalid/p' }) }, /Invalid model resource URL/],
    [{ inputs: image({ kind: 'url', url: 'data:image/png;base64,A' }) }, /Invalid inline resource/],
    [{ inputs: image({ kind: 'bytes', bytes: new Uint8Array(5), mimeType: 'image/png' }) }, /Resource byte limit/],
    [{ inputs: image({ kind: 'reference', id: 'document' }) }, /Invalid resource reference/],
  ];
  for (const [patch, error] of invalid) await assert.rejects(Support.prepareModelResources({ ...base, ...patch }), error);
  assert.equal(model.totalCallCount, 0);
});

test('resource preparation measures both base64 padding lengths and rejects invalid resolutions', async () => {
  const model = runner();
  const inputs = [
    { type: 'image', source: { kind: 'bytes', bytes: Uint8Array.of(1), mimeType: 'image/png' } },
    { type: 'file', source: { kind: 'reference', id: 'one' } },
    { type: 'file', source: { kind: 'reference', id: 'two' } },
  ];
  const total = [];
  const resolved = {
    one: { kind: 'url', url: 'data:application/pdf;base64,Ag==' },
    two: { kind: 'url', url: 'data:application/pdf;base64,AwQ=' },
  };
  const ports = { authorize() {}, async resolve(id) { return resolved[id]; }, prepared(fact) { total.push(fact.bytes); } };
  const request = { runner: model, maxBytes: 4, inputs, ports };
  const parts = await Support.prepareModelResources(request);
  assert.deepEqual(parts.map(x => x.url), ['data:image/png;base64,AQ==', resolved.one.url, resolved.two.url]);
  assert.deepEqual(total, [1, 1, 2]);
  await assert.rejects(Support.prepareModelResources({ ...request, maxBytes: 3 }), /Resource byte limit/);
  for (const [invalid, error] of [
    [{ kind: 'reference', id: 'nested' }, /Invalid resolved resource/],
    [{ kind: 'bytes', bytes: Uint8Array.of(1), mimeType: 'bad MIME' }, /Invalid resource MIME type/],
  ]) {
    resolved.one = invalid;
    await assert.rejects(Support.prepareModelResources(request), error);
  }
  assert.equal(model.totalCallCount, 0);
});

test('continuation deletion is scoped and malformed envelopes fail before use', () => {
  const model = { protocol: 'responses', model: 'fixture', scope: 'alice' };
  const value = { version: 1, ...model, data: { count: 0, chunks: [1, true, null] } };
  const store = Support.createMemoryContinuationStore();
  store.save(value);
  store.save({ ...value, scope: 'bob' });
  assert.deepEqual(store.load(model), value);
  assert.equal(store.delete(model), true);
  assert.equal(store.delete(model), false);
  assert.deepEqual(store.load({ ...model, scope: 'bob' }).data, value.data);
  assert.throws(() => Support.serializeModelContinuation(value, 0), /Invalid continuation size limit/);
  assert.throws(() => Support.serializeModelContinuation(undefined), /Invalid continuation envelope/);
  assert.throws(() => Support.serializeModelContinuation({ ...value, version: 2 }), /Invalid continuation envelope/);
  assert.throws(() => Support.serializeModelContinuation({ ...value, data: Infinity }), /JSON values/);
  assert.throws(() => Support.parseModelContinuation('long', model, 1), /Invalid continuation size/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../dist/app.js';
import { defineKnowledgeCatalog } from '@jangts/agent-core/kits/knowledge';
const encode = (capability, input) => JSON.stringify({ name: capability, input });

test('empty knowledge can reply without credentials or network', async () => {
  const app = createApp({ provider: { async *stream() { yield encode('reply', { text: '离线接线完成，尚无应用资料。', sourceIds: [] }); } } });
  assert.deepEqual(await app.run('检查接线'), { text: '离线接线完成，尚无应用资料。', sources: [], calls: 1 });
});
test('registered read is authorized and the final reply cites the actual version', async () => {
  let calls = 0, authorized = 0;
  // Deliberate test fixture, never copied into the application's initial knowledge catalog.
  const knowledge = defineKnowledgeCatalog([{ id: 'fixture', revision: 'test-1', parts: ['隔离测试资料'] }]);
  const app = createApp({ knowledge, authorizeRead(input) { assert.equal(input.documentId, 'fixture'); authorized++; },
    provider: { async *stream() { yield ++calls === 1 ? encode('knowledge.read', { documentId: 'fixture' }) : encode('reply', { text: '依据隔离测试资料回答。', sourceIds: ['fixture'] }); } } });
  const result = await app.run('读取测试来源');
  assert.equal(authorized, 1); assert.equal(result.calls, 2); assert.deepEqual(result.sources, [{ documentId: 'fixture', revision: 'test-1' }]);
});
test('missing authorization and invented sources cannot complete a request', async () => {
  const knowledge = defineKnowledgeCatalog([{ id: 'private', revision: '1', parts: ['private fixture'] }]);
  await assert.rejects(createApp({ knowledge, provider: { async *stream() { yield encode('knowledge.read', { documentId: 'private' }); } } }).run('读取'), /authorize/);
  await assert.rejects(createApp({ provider: { async *stream() { yield encode('reply', { text: '没有实际来源', sourceIds: ['invented'] }); } } }).run('核对'), /not read/);
});
test('invalid input and cancellation do not spend a model call', async () => {
  let calls = 0;
  const app = createApp({ provider: { async *stream() { calls++; throw Error('must not call'); } } });
  await assert.rejects(app.run('x'.repeat(801)), /800/);
  const controller = new AbortController(); controller.abort(); await assert.rejects(app.run('检查', { signal: controller.signal })); assert.equal(calls, 0);
});

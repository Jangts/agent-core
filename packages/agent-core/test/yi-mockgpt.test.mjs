import test from 'node:test';
import assert from 'node:assert/strict';
import { ModelRunner, Support } from '../dist/esm/index.js';

let peerUrl;
try {
  peerUrl = import.meta.resolve('@jangts/mock-gpt');
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND' && error.code !== 'MODULE_NOT_FOUND') throw error;
}
// A missing optional peer skips; a broken installed peer or its dependency must fail.
const peer = peerUrl === undefined ? undefined : await import(peerUrl);
const options = { skip: peer ? false : 'Optional @jangts/mock-gpt peer is not installed' };

for (const [protocol, version] of [
  ['chat-completions', 'v1'],
  ['responses', 'v1'],
  ['messages', 'v1'],
  ['generate-content', 'v1beta'],
  ['interactions', 'v1beta'],
]) {
  for (const stream of [false, true]) {
    test(`real MockGPT.fetch integration: ${protocol} ${stream ? 'byte-fragmented SSE' : 'complete HTTP'} Unicode text`, options, async () => {
      const mock = new peer.MockGPT({ rules: [{ generator: peer.responses.text('你好🙂', { chunkSize: 1, wireChunkSize: 1 }) }] });
      const provider = Support.createModelProvider({
        protocol, baseUrl: `https://mock.invalid/${version}`, apiKey: 'fixture', model: 'mock', stream, request: mock.fetch,
      });
      assert.equal((await new ModelRunner({ provider }).invoke('hello')).value, '你好🙂');
    });
  }
}

test('real MockGPT.fetch integration: one authorized tool execution and two model turns', options, async () => {
  const mock = new peer.MockGPT({ rules: [{
    generator: ({ request }) => request.messages.some(message => message.role === 'tool')
      ? peer.responses.text('found')
      : peer.responses.toolCalls([{ name: 'lookup', arguments: { q: 'x' } }]),
  }] });
  const provider = Support.createModelProvider({ protocol: 'chat-completions', baseUrl: 'https://mock.invalid/v1', apiKey: 'fixture', model: 'mock', request: mock.fetch });
  const execution = { signal: new AbortController().signal };
  let executions = 0, authorizations = 0;
  const catalog = Support.defineToolCatalog([{
    id: 'lookup', description: 'Read a synthetic value', kind: 'read',
    inputSchema: { jsonSchema: { type: 'object', properties: { q: { type: 'string' } }, required: ['q'] }, parse(value) {
      if (value?.q !== 'x') throw new TypeError('Expected synthetic query');
      return value;
    } },
    authorize(_input, context) { assert.equal(context.app.subject, 'synthetic-reader'); authorizations++; },
    execute() { executions++; return 'found'; },
    parseOutput(value) { assert.equal(value, 'found'); return value; },
  }]);
  const tools = catalog.bind({ app: { subject: 'synthetic-reader' }, execution });
  const transport = Support.createModelTransport({ id: 'session', response: 'session', tools: tools.tools });
  const runner = new ModelRunner({ provider, transports: [transport], maxCalls: 2 }).bind(execution);
  const first = await runner.invoke({ input: 'find x', transport });
  assert.equal(first.value.calls.length, 1);
  const call = first.value.calls[0];
  const result = await tools.invoke(call);
  const second = await runner.invoke({ input: [
    { role: 'user', content: 'find x' },
    { role: 'assistant', content: '', toolCalls: [{ id: call.id, name: call.name, arguments: call.arguments }] },
    { role: 'tool', content: result.value, toolCallId: call.id },
  ], transport });
  assert.equal(second.value.text, 'found');
  assert.equal(executions, 1);
  assert.equal(authorizations, 1);
  assert.equal(runner.totalCallCount, 2);
});

test('real MockGPT.fetch coverage: an unknown route returns 404', options, async () => {
  const mock = new peer.MockGPT({ rules: [{ generator: 'unused' }] });
  const response = await mock.fetch('https://mock.invalid/v1/unknown-model-route', { method: 'POST', body: '{}' });
  assert.equal(response.status, 404);
  await response.body?.cancel();
});

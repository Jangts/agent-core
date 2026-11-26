import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBatchModelProvider } from '../dist/esm/support/model/lifecycle/batch.js';

const settings = { baseUrl: 'https://example.test/v1', apiKey: 'fixture', model: 'model' };
const context = { signal: new AbortController().signal };
const identity = (protocol, itemIds = ['a', 'b', 'c']) => ({ operationId: 'operation', scope: 'owner', protocol, itemIds });
const item = (id = 'a') => ({ id, messages: [{ role: 'user', content: 'ping' }] });
const csv = rows => new Response(rows.map(row => JSON.stringify(row)).join('\n'));
const chatResult = (text, reason = 'stop') => ({ choices: [{
  message: { role: 'assistant', content: text }, finish_reason: reason,
}] });

test('Anthropic and Gemini batch submit portable messages directly and preserve native item keys', async () => {
  const cases = [
    ['anthropic-batch', '/v1/messages/batches', 'x-api-key', body => {
      assert.equal(body.requests[0].custom_id, 'a');
      assert.deepEqual(body.requests[0].params.messages[0].content, [{ type: 'text', text: 'ping' }]);
      return { id: 'anthropic-job', processing_status: 'in_progress' };
    }],
    ['gemini-batch', '/v1/models/model:batchGenerateContent', 'x-goog-api-key', body => {
      const [input] = body.batch.input_config.requests.requests;
      assert.equal(input.metadata.key, 'a');
      assert.equal(input.request.contents[0].parts[0].text, 'ping');
      return { name: 'batches/gemini-job', metadata: { state: 'JOB_STATE_RUNNING' } };
    }],
  ];
  for (const [protocol, path, auth, reply] of cases) {
    const seen = [];
    const provider = createBatchModelProvider({ ...settings, protocol, request: async (url, init) => {
      seen.push([new URL(url).pathname, init.method, init.headers[auth]]);
      return Response.json(reply(JSON.parse(init.body)));
    } });
    const handle = identity(protocol, ['a']);
    await assert.rejects(provider.invoke({ action: 'submit', handle, payload: { items: [item('bad')] } }, context),
      /items must match reserved IDs/);
    assert.deepEqual(seen, []);
    assert.equal((await provider.invoke({ action: 'submit', handle, payload: { items: [item()] } }, context)).status, 'running');
    assert.deepEqual(seen, [[path, 'POST', 'fixture']]);
  }
  assert.throws(() => createBatchModelProvider({ ...settings, protocol: 'responses' }), /Batch protocol required/);
});

test('OpenAI batch upload failure stops submission, and Chat items use the Chat endpoint', async () => {
  let cancelCount = 0;
  const replies = [
    new Response(new ReadableStream({ cancel() { cancelCount++; } }), { status: 503 }),
    Response.json({ id: 123 }),
    Response.json({ id: 'uploaded' }),
  ];
  const urls = [];
  const provider = createBatchModelProvider({
    ...settings, protocol: 'openai-batch', completionProtocol: 'chat-completions',
    request: async (url, init) => {
      urls.push(new URL(url).pathname);
      if (url.endsWith('/files')) {
        assert.equal(init.body.get('purpose'), 'batch');
        const doc = JSON.parse(await init.body.get('file').text());
        assert.equal(doc.url, '/v1/chat/completions');
        assert.equal(doc.custom_id, 'a');
        return replies.shift();
      }
      const body = JSON.parse(init.body);
      assert.equal(body.input_file_id, 'uploaded');
      assert.equal(body.endpoint, '/v1/chat/completions');
      return Response.json({ status: 'validating', id: 'job' });
    },
  });
  const request = { action: 'submit', handle: identity('openai-batch', ['a']), payload: { items: [item()] } };
  await assert.rejects(provider.invoke(request, context), /Batch input upload failed/);
  await assert.rejects(provider.invoke(request, context), /Batch input ID missing/);
  assert.equal((await provider.invoke(request, context)).handle.remoteId, 'job');
  assert.deepEqual(urls, ['/v1/files', '/v1/files', '/v1/files', '/v1/batches']);
  assert.equal(cancelCount, 1);
});

test('Anthropic per-item terminal status and provider errors remain independent of the batch status', async () => {
  const remoteError = { type: 'overloaded_error', message: 'retry later' };
  const usage = { input_tokens: 2, output_tokens: 3 };
  const message = (stop_reason) => ({ content: [{ type: 'text', text: 'answer' }], stop_reason, usage });
  const rows = [
    { custom_id: 'a', result: { type: 'succeeded', message: message('end_turn') } },
    { custom_id: 'b', result: { type: 'succeeded', message: message('max_tokens') } },
    { custom_id: 'c', result: { type: 'errored', error: remoteError } },
  ];
  const provider = createBatchModelProvider({ ...settings, protocol: 'anthropic-batch', request: async (url, init) => {
    assert.equal(new URL(url).pathname, '/v1/messages/batches/job/results');
    assert.equal(init.headers['x-api-key'], 'fixture');
    return csv(rows);
  } });
  const handle = { ...identity('anthropic-batch', ['a', 'b', 'c', 'missing']), remoteId: 'job' };
  const result = await provider.invoke({ action: 'read', handle }, context);
  assert.equal(result.status, 'completed');
  assert.equal(result.value[0].status, 'completed');
  assert.equal(result.value[0].value.includes('answer'), true);
  assert.deepEqual(result.value[0].usage, usage);
  assert.deepEqual(result.value.slice(1), [
    { id: 'b', status: 'failed', error: { code: 'BATCH_ITEM_INCOMPLETE' }, usage },
    { id: 'c', status: 'failed', error: remoteError },
    { id: 'missing', status: 'failed', error: { code: 'BATCH_ITEM_MISSING' } },
  ]);
});

test('OpenAI batch rejects unknown or duplicate IDs and preserves unsuccessful HTTP item results', async () => {
  let rows;
  const errorResponse = { status_code: 429, body: { error: 'busy' } };
  const successful = { custom_id: 'a', response: { status_code: 200, body: chatResult('completed') } };
  const provider = createBatchModelProvider({
    ...settings, protocol: 'openai-batch', completionProtocol: 'chat-completions',
    request: async (url) => url.endsWith('/content') ? csv(rows)
      : Response.json({ status: 'completed', output_file_id: 'output' }),
  });
  const read = { action: 'read', handle: { ...identity('openai-batch'), remoteId: 'job' } };
  for (const invalid of [[successful, successful], [{ ...successful, custom_id: 'unreserved' }]]) {
    rows = invalid;
    await assert.rejects(provider.invoke(read, context), /Invalid batch result identity/);
  }
  rows = [successful, { custom_id: 'b', response: errorResponse }];
  const result = await provider.invoke(read, context);
  assert.equal(result.value[0].value[0], 'completed');
  assert.deepEqual(result.value[1], { id: 'b', status: 'failed', error: errorResponse });

  let cancelled = 0;
  const failing = createBatchModelProvider({
    ...settings, protocol: 'openai-batch',
    request: async url => url.endsWith('/content')
      ? new Response(new ReadableStream({ cancel() { cancelled++; } }), { status: 504 })
      : Response.json({ status: 'completed', output_file_id: 'output' }),
  });
  await assert.rejects(failing.invoke(read, context), /Batch output download failed/);
  assert.equal(cancelled, 1);
});

test('Gemini inline batch validates collection shape, cardinality and media download name', async () => {
  let response, downloads = 0;
  const provider = createBatchModelProvider({
    ...settings, protocol: 'gemini-batch',
    request: async url => {
      if (new URL(url).pathname.startsWith('/download/')) {
        downloads++;
        return new Response(null, { status: 404 });
      }
      return Response.json({ metadata: { state: 'JOB_STATE_SUCCEEDED' }, response });
    },
  });
  const read = { action: 'read', handle: { ...identity('gemini-batch', ['a']), remoteId: 'batches/job' } };
  const row = {
    metadata: { key: 'a' },
    response: { candidates: [{ content: { parts: [{ text: 'answer' }] }, finishReason: 'STOP' }] },
  };
  for (const inlinedResponses of [[row], { inlinedResponses: [row] }]) {
    response = { inlinedResponses };
    const result = await provider.invoke(read, context);
    assert.equal(result.value[0].id, 'a');
    assert.equal(result.value[0].value[0], 'answer');
  }
  response = { inlined_responses: { bad: true } };
  await assert.rejects(provider.invoke(read, context), /Invalid batch response items/);
  response = { inlined_responses: [row, row] };
  await assert.rejects(provider.invoke(read, context), { code: 'MODEL_RESPONSE_LIMIT' });
  response = { responsesFile: 'not-a-provider-file' };
  await assert.rejects(provider.invoke(read, context), /Invalid batch output file name/);
  assert.equal(downloads, 0);
  response = { responsesFile: 'files/output' };
  await assert.rejects(provider.invoke(read, context), /Batch output download failed/);
  assert.equal(downloads, 1);
});

test('an empty completed Gemini batch yields a missing result for each reserved ID', async () => {
  const provider = createBatchModelProvider({
    ...settings, protocol: 'gemini-batch',
    request: async () => Response.json({ metadata: { state: 'JOB_STATE_SUCCEEDED' }, response: {} }),
  });
  const handle = { ...identity('gemini-batch', ['expected']), remoteId: 'batches/job' };
  const result = await provider.invoke({ action: 'read', handle }, context);
  assert.deepEqual(result.value, [{ id: 'expected', status: 'failed', error: { code: 'BATCH_ITEM_MISSING' } }]);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modelRequest } from '../dist/esm/support/model/protocols/requests.js';
import { ProtocolDecoder } from '../dist/esm/support/model/protocols/responses.js';

const messages = (role, parts) => ({ role, content: '', parts });
const url = 'https://assets.example.test/resource';
const pdf = 'data:application/pdf;base64,AQ==';
const audio = 'data:audio/pcm;base64,AQ==';
const image = { type: 'image', url };
const file = { type: 'file', url };
const schema = { type: 'object', properties: {} };
const tools = [{ name: 'lookup', description: 'Retrieve a record', parameters: schema }];
const wire = (protocol, input, options = {}, stream = false) => modelRequest(protocol, 'model', input, options, stream);
const completion = parts => parts.find(part => part?.type === 'completion')?.status;

test('request encoders retain the native shape of file and media inputs', () => {
  const pdfInput = messages('user', [{ type: 'file', url: pdf }]);
  assert.deepEqual(wire('chat-completions', [pdfInput]).messages[0].content,
    [{ type: 'file', file: { filename: 'attachment.pdf', file_data: pdf } }]);
  assert.throws(() => wire('chat-completions', [messages('user', [file])]), /inline PDF/);
  const input = messages('user', [{ type: 'text', text: 'explain' }, image, file, { type: 'file', url: audio }]);
  assert.deepEqual(wire('responses', [input]).input[0].content, [
    { type: 'input_text', text: 'explain' }, { type: 'input_image', image_url: url },
    { type: 'input_file', file_url: url }, { type: 'input_file', filename: 'attachment', file_data: audio },
  ]);
  assert.deepEqual(wire('messages', [messages('user', [image, pdfInput.parts[0]])]).messages[0].content, [
    { type: 'image', source: { type: 'url', url } },
    { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'AQ==' } },
  ]);
  const gemini = messages('user', [{ type: 'audio', url: audio }, { ...file, mimeType: 'application/pdf' }]);
  assert.deepEqual(wire('generate-content', [gemini]).contents[0].parts, [
    { inlineData: { mimeType: 'audio/pcm', data: 'AQ==' } },
    { fileData: { mimeType: 'application/pdf', fileUri: url } },
  ]);
  assert.deepEqual(wire('interactions', [gemini, messages('user', [image])]).input.map(x => x.content), [
    [{ type: 'audio', mime_type: 'audio/pcm', data: 'AQ==' }, { type: 'document', uri: url, mime_type: 'application/pdf' }],
    [{ type: 'image', uri: url }],
  ]);
  assert.throws(() => wire('responses', [messages('system', [image])]), /System instructions must be text/);
});

test('request encoders apply tool and JSON controls in the supplier format', () => {
  const options = { functions: tools, outputSchema: schema, toolChoice: 'required', parallelToolCalls: false };
  const chat = wire('chat-completions', [], { ...options, includeUsage: true, parallelToolCalls: 'omit' }, true);
  assert.deepEqual(chat.stream_options, { include_usage: true });
  assert.equal(chat.parallel_tool_calls, undefined);
  assert.deepEqual(chat.response_format.json_schema.schema, schema);
  const responses = wire('responses', [], options);
  assert.equal(responses.parallel_tool_calls, false);
  assert.deepEqual(responses.text.format.schema, schema);
  assert.deepEqual(wire('responses', [], { json: true }).text.format, { type: 'json_object' });
  assert.deepEqual(wire('messages', [], { ...options, outputSchema: undefined, json: true }).tool_choice,
    { type: 'any', disable_parallel_tool_use: true });
  assert.deepEqual(wire('messages', [], { json: true }).output_config.format.schema,
    { type: 'object', additionalProperties: true });
  const gemini = wire('generate-content', [], options);
  assert.equal(gemini.toolConfig.functionCallingConfig.mode, 'ANY');
  assert.deepEqual(gemini.generationConfig.responseJsonSchema, schema);
  const disabled = wire('generate-content', [], { functions: tools, json: true, toolChoice: 'none' });
  assert.equal(disabled.toolConfig.functionCallingConfig.mode, 'NONE');
  assert.equal(disabled.generationConfig.responseMimeType, 'application/json');
  assert.equal(disabled.generationConfig.responseJsonSchema, undefined);
});

test('tool replies retain call IDs and use native supported parts', () => {
  const call = { id: 'call-1', name: 'lookup', arguments: '{}' };
  const history = [
    { role: 'assistant', content: '', toolCalls: [call] },
    { ...messages('tool', [{ type: 'text', text: 'tool result' }, image]), toolCallId: call.id },
  ];
  const responses = wire('responses', history).input.at(-1);
  assert.deepEqual(responses, { call_id: call.id, type: 'function_call_output', output: [
    { type: 'input_text', text: 'tool result' }, { type: 'input_image', image_url: url },
  ] });
  const anthropic = wire('messages', history).messages[1].content[0];
  assert.equal(anthropic.tool_use_id, call.id);
  assert.deepEqual(anthropic.content[1], { type: 'image', source: { type: 'url', url } });
  assert.throws(() => wire('generate-content', history), /Media tool results require a supported protocol/);
});

test('wire decoders preserve refusal semantics and reject deltas after a terminal event', () => {
  const chat = new ProtocolDecoder('chat-completions');
  const tool = { id: 'call', function: { name: 'lookup', arguments: '{}' } };
  assert.deepEqual(chat.decode({ choices: [{ delta: { tool_calls: [tool] } }] })[0], {
    type: 'function-call-delta', id: 'call', name: 'lookup', index: 0, arguments: '{}',
  });
  assert.equal(completion(chat.decode({ choices: [{ delta: { refusal: 'disallowed' }, finish_reason: 'stop' }] })), 'refused');
  assert.throws(() => chat.decode({ choices: [{ delta: { tool_calls: [tool] } }] }), { code: 'MODEL_PROTOCOL' });
  assert.throws(() => new ProtocolDecoder('responses').decode({ error: { message: 'unavailable' } }), { code: 'MODEL_UPSTREAM' });
  const response = new ProtocolDecoder('responses');
  assert.deepEqual(response.decode({ type: 'response.refusal.delta', delta: 'cannot comply' }), []);
  assert.equal(completion(response.decode({ type: 'response.completed', response: { status: 'completed' } })), 'refused');
  assert.throws(() => response.decode({ type: 'response.output_item.done', item: { type: 'message' } }), /Hosted tool payload after terminal/);
  const google = new ProtocolDecoder('generate-content');
  assert.equal(completion(google.decode({ promptFeedback: { blockReason: 'SAFETY' } })), 'refused');
  assert.throws(() => google.decode({ candidates: [{ content: { parts: [{ text: 'late' }] } }] }), { code: 'MODEL_PROTOCOL' });
});

test('Responses decoder distinguishes incomplete and failed responses and rejects unsupported items', () => {
  const decode = (value, full = false) => new ProtocolDecoder('responses').decode(value, full);
  assert.equal(completion(decode({}, true)), 'incomplete');
  assert.equal(completion(decode({ type: 'response.incomplete', response: {} })), 'incomplete');
  assert.throws(() => decode({ type: 'response.failed' }), /Model response failed/);
  assert.throws(() => decode({ type: 'response.output_item.added', item: { type: 'unknown' } }), /Unsupported Responses output/);
  assert.throws(() => decode({ status: 'completed', output: [{ type: 'message', content: [{ type: 'unknown' }] }] }, true),
    /Unsupported Responses content/);
  const result = decode({ status: 'completed', output: [{ type: 'function_call', call_id: 'lookup', name: 'lookup' }] }, true);
  assert.equal(result[0].arguments, '{}');
  assert.equal(completion(result), 'tool-calls');
});

test('Messages decoder accumulates usage and preserves initial text and private tool arguments', () => {
  const decoder = new ProtocolDecoder('messages');
  const initial = decoder.decode({ type: 'message_start', message: { usage: { input_tokens: 5 } } });
  assert.deepEqual(initial[0].usage, { promptTokens: 5, completionTokens: 0, totalTokens: 5 });
  assert.deepEqual(decoder.decode({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: 'initial' } }), ['initial']);
  assert.deepEqual(decoder.decode({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: ' more' } }), [' more']);
  decoder.decode({ type: 'content_block_stop', index: 0 });
  decoder.decode({ type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 'a', name: 'lookup' } });
  decoder.decode({ type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{"a":' } });
  decoder.decode({ type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '2}' } });
  decoder.decode({ type: 'content_block_stop', index: 1 });
  assert.deepEqual(decoder.replay, [{ type: 'text', text: 'initial more' }, { type: 'tool_use', id: 'a', name: 'lookup', input: { a: 2 } }]);
  assert.throws(() => decoder.decode({ type: 'content_block_delta', index: 0, delta: { type: 'unknown' } }), /Unsupported Messages delta/);
  assert.equal(completion(new ProtocolDecoder('messages').decode({ content: [] }, true)), 'incomplete');
  assert.throws(() => new ProtocolDecoder('messages').decode({ content: [{ type: 'unknown' }] }, true), /Unsupported Messages content/);
});

test('Gemini wire decoders support media and keep tool IDs and usage consistent', () => {
  const decoder = new ProtocolDecoder('generate-content');
  const normalized = decoder.decode({
    usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 3 },
    candidates: [{ content: { parts: [
      { inlineData: { data: 'AQ==', mimeType: 'audio/pcm' } },
      { inlineData: { data: 'Ag==' } }, { functionCall: { name: 'lookup', args: { query: 'a' } } },
    ] }, finishReason: 'STOP' }],
  });
  assert.equal(normalized[0].usage.totalTokens, 7);
  assert.deepEqual(normalized.slice(1, 3).map(x => x.content.type), ['audio', 'file']);
  assert.equal(normalized[2].content.url, 'data:application/octet-stream;base64,Ag==');
  assert.equal(normalized[3].id, 'call_2');
  assert.equal(completion(normalized), 'tool-calls');
  assert.deepEqual(new ProtocolDecoder('generate-content').decode({ candidates: [{ content: {} }] }), []);
  assert.throws(() => new ProtocolDecoder('generate-content').decode({
    candidates: [{ content: { parts: [{ unsupported: true }] } }],
  }), /Unsupported generateContent part/);
});

test('Interactions wire validates native step types, media and terminal variants', () => {
  const media = { type: 'document', mime_type: 'application/pdf', data: 'AQ==' };
  const decoder = new ProtocolDecoder('interactions');
  const parts = decoder.decode({ steps: [
    { type: 'model_output' },
    { type: 'model_output', content: [media] },
  ], usage: { total_input_tokens: 4, total_output_tokens: 2 }, status: 'completed' }, true);
  assert.equal(parts[0].usage.totalTokens, 6);
  assert.deepEqual(parts[1].content, { type: 'file', mimeType: 'application/pdf', url: pdf });
  assert.equal(completion(parts), 'completed');
  assert.equal(completion(new ProtocolDecoder('interactions').decode({}, true)), 'incomplete');
  assert.throws(() => new ProtocolDecoder('interactions').decode({ steps: [{ type: 'unknown' }] }, true), /Unsupported Interactions step/);
  for (const [delta, error] of [
    [{ type: 'unknown' }, /Unsupported Interactions delta/],
    [{ type: 'image' }, /Media output has no usable resource/],
  ]) assert.throws(() => new ProtocolDecoder('interactions').decode({ type: 'step.delta', delta }), error);
  const stream = new ProtocolDecoder('interactions');
  assert.throws(() => stream.decode({ type: 'step.start', step: { type: 'unknown' } }), /Unsupported Interactions step/);
  assert.deepEqual(stream.decode({ type: 'step.delta', delta: { type: 'image', uri: url } })[0].content,
    { type: 'image', url, mimeType: undefined });
  assert.deepEqual(stream.decode({ type: 'step.delta', delta: { type: 'thought_summary' } }), []);
  assert.equal(completion(stream.decode({ type: 'interaction.completed' })), 'completed');
});

test('portable request validation reports the failing schema path and unsupported capability', async () => {
  const { prepareModelRequest } = await import('../dist/esm/support/model/protocols/preparation.js');
  const { resolveModelCapabilities } = await import('../dist/esm/support/model/protocols/capabilities.js');
  const config = { protocol: 'responses', model: 'fixture', baseUrl: 'https://example.test/v1' };
  const cases = [
    [{ outputSchema: [] }, /Invalid schema: output/],
    [{ outputSchema: { properties: [] } }, /Invalid schema properties: output/],
    [{ outputSchema: { type: 'array', items: { unsupported: true } } }, /output.items.unsupported/],
    [{ functions: [tools[0], tools[0]] }, /duplicate portable function name/],
    [{ functions: [{ ...tools[0], parameters: { type: 'array' } }] }, /Function parameters must be object/],
  ];
  for (const [options, error] of cases) assert.throws(() => prepareModelRequest(config, [], options), error);
  assert.throws(() => prepareModelRequest({ ...config, protocol: 'constructor' }, []), /Unknown model protocol/);
  assert.throws(() => resolveModelCapabilities('constructor'), /Unknown model protocol/);
  assert.throws(() => resolveModelCapabilities('responses', { tools: 'yes' }), /Invalid endpoint capability/);
  assert.equal(resolveModelCapabilities('responses', { jsonSchema: true }).jsonSchema, true);
  assert.equal(resolveModelCapabilities('responses', { jsonSchema: false }).jsonSchema, false);
  assert.throws(() => resolveModelCapabilities('responses', { modalities: ['audio'] }),
    /Endpoint modalities cannot widen protocol capabilities/);

  const continuation = { version: 1, protocol: 'responses', model: 'fixture', scope: 'one', data: {} };
  assert.throws(() => prepareModelRequest(config, [], { continuation }), /requires an explicit identity scope/);
  const toolReply = { ...messages('tool', [image]), toolCallId: 'id' };
  assert.throws(() => prepareModelRequest({ ...config, protocol: 'generate-content' }, [toolReply]),
    /Media tool results require a supported protocol/);
});

test('native hosted tool events require authorization and remain private observations', async () => {
  const { HostedToolDecoder, validateHostedTools } = await import('../dist/esm/support/model/protocols/hosted.js');
  assert.throws(() => validateHostedTools('chat-completions', [{ type: 'web_search' }]), /Unsupported hosted tool/);
  assert.equal(new HostedToolDecoder('chat-completions', true).accept({ type: 'text' }), false);
  const unconfigured = new HostedToolDecoder('responses', false);
  const done = { type: 'response.web_search_call.completed', item_id: 'lookup' };
  assert.throws(() => unconfigured.intercept(done, []), /Unconfigured provider-side tool/);
  assert.throws(() => unconfigured.intercept({ type: 'response.output_text.annotation.added' }, []),
    /Unconfigured provider-side citations/);
  const decoder = new HostedToolDecoder('responses', true);
  assert.equal(decoder.intercept({}, []), false);
  assert.equal(decoder.intercept(done, []), true);
  assert.equal(decoder.intercept({ type: 'response.output_text.annotation.added', annotation: {} }, []), true);
  assert.deepEqual(decoder.drain().map(event => [event.phase, event.source, event.type]), [
    ['completed', 'provider', 'response.web_search_call.completed'],
    ['sources', 'provider', 'response.output_text.annotation.added'],
  ]);
  assert.deepEqual(decoder.drain(), []);
});

test('nonstream providers distinguish authentication, overload and invalid SSE bodies', async () => {
  const { createModelProvider } = await import('../dist/esm/support/model/provider-factory.js');
  const cfg = { protocol: 'responses', model: 'fixture', apiKey: 'key', baseUrl: 'https://example.test/v1' };
  assert.throws(() => createModelProvider({ ...cfg, protocol: 'constructor' }), /Unknown model protocol/);
  for (const patch of [{ model: '' }, { apiKey: '' }])
    assert.throws(() => createModelProvider({ ...cfg, ...patch }), /protocol, credentials and model/);
  assert.throws(() => createModelProvider({ ...cfg, baseUrl: 'https://user@example.test/?token=fixture' }), /must not contain/);
  assert.throws(() => createModelProvider({ ...cfg, hostedTools: [{ type: 'web_search' }], capabilities: { tools: false } }),
    /Endpoint does not support tools/);
  const signal = new AbortController().signal;
  const collect = async function (provider, options, legacy = false) {
    const values = [];
    for await (const event of provider[legacy ? 'stream' : 'streamEvents']([], { signal, options })) values.push(event);
    return values;
  };
  for (const [status, code] of [[401, 'MODEL_AUTH'], [429, 'MODEL_BUSY'], [503, 'MODEL_UPSTREAM']]) {
    let closed = 0;
    const network = async () => new Response(new ReadableStream({ cancel() { closed++; } }), { status });
    await assert.rejects(collect(createModelProvider({ ...cfg, request: network })), { status, code });
    assert.equal(closed, 1);
  }
  const sse = createModelProvider({
    ...cfg, request: async () => new Response(null, { headers: { 'content-type': 'text/event-stream' } }),
  });
  await assert.rejects(collect(sse), /Missing model stream/);
  const prior = globalThis.fetch;
  let response = { status: 'completed', usage: { input_tokens: 1, output_tokens: 2 } };
  globalThis.fetch = async () => Response.json(response);
  try {
    const provider = createModelProvider(cfg);
    const usage = [];
    assert.deepEqual(await collect(provider, { onUsage: fact => usage.push(fact) }, true), []);
    assert.deepEqual(usage, [{ promptTokens: 1, completionTokens: 2, totalTokens: 3 }]);
    response = { status: 'incomplete' };
    await assert.rejects(collect(provider, {}, true), { code: 'MODEL_INCOMPLETE' });
  } finally { globalThis.fetch = prior; }
});

test('background operations validate portable input and normalize terminal tool calls', async () => {
  const { createBackgroundModelProvider } = await import('../dist/esm/support/model/lifecycle/background.js');
  const { snapshotModelRequestBody, extendModelRequest } = await import('../dist/esm/support/model/protocols/profile.js');
  const config = { protocol: 'responses', baseUrl: 'https://example.test/v1', model: 'fixture', apiKey: 'fixture' };
  assert.throws(() => snapshotModelRequestBody(null), /Provider requestBody must be an object/);
  assert.deepEqual(extendModelRequest({}, { output_config: { effort: 'low' } }), { output_config: { effort: 'low' } });
  let requested = 0;
  const operation = createBackgroundModelProvider({
    ...config,
    request: async () => {
      requested++;
      return Response.json({
        id: 'remote', status: 'completed',
        output: [{ type: 'function_call', call_id: 'c1', name: 'lookup', arguments: '{}' }],
      });
    },
  });
  const handle = { operationId: 'one', scope: 'owner', protocol: 'responses', itemIds: ['one'] };
  const context = { signal: new AbortController().signal };
  await assert.rejects(operation.invoke({ action: 'submit', handle, payload: {} }, context), /Background messages required/);
  assert.equal(requested, 0);
  const result = await operation.invoke({ action: 'submit', handle, payload: { messages: [{ role: 'user', content: 'lookup' }] } }, context);
  assert.equal(result.handle.remoteId, 'remote');
  assert.equal(result.status, 'completed');
  assert.deepEqual(result.value, [{ type: 'function-call-delta', index: 0, id: 'c1', name: 'lookup', arguments: '{}' }]);
});

test('file and image outputs preserve known types, and unsupported media stays a protocol error', () => {
  assert.deepEqual(wire('chat-completions', [messages('user', [image])]).messages[0].content,
    [{ type: 'image_url', image_url: { url } }]);
  const raw = { status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'document', data: 'AQ==' }] }] };
  assert.equal(new ProtocolDecoder('interactions').decode(raw, true)[0].content.url, 'data:application/octet-stream;base64,AQ==');
  raw.steps[0].content[0].type = 'unknown';
  assert.throws(() => new ProtocolDecoder('interactions').decode(raw, true), /Unsupported model content/);
  const anthropic = new ProtocolDecoder('messages');
  anthropic.decode({ type: 'content_block_start', index: 0, content_block: { type: 'text' } });
  anthropic.decode({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'first' } });
  anthropic.decode({ type: 'content_block_stop', index: 0 });
  assert.equal(anthropic.replay[0].text, 'first');
  anthropic.decode({ type: 'content_block_start', index: 1, content_block: { type: 'thinking' } });
  anthropic.decode({ type: 'content_block_delta', index: 1, delta: { type: 'thinking_delta', thinking: 'private' } });
  anthropic.decode({ type: 'content_block_stop', index: 1 });
  assert.equal(anthropic.replay[1].thinking, 'private');
});

test('native response replay checks the assistant anchor and bounds opaque response size', async () => {
  const { ContinuationRecorder, replayNativeTurns } = await import('../dist/esm/support/model/protocols/continuation.js');
  const prompt = { role: 'user', content: 'ask' };
  const assistant = { role: 'assistant', content: 'answer' };
  const recorder = new ContinuationRecorder();
  recorder.push('answer');
  const native = [{ type: 'message', content: [{ type: 'output_text', text: 'answer' }] }];
  const saved = recorder.finish(url, [prompt], native);
  const rest = [prompt, assistant, { role: 'user', content: 'another question' }];
  const body = wire('responses', rest);
  replayNativeTurns('responses', body, rest, saved);
  assert.deepEqual(body.input[1], native[0]);
  const bad = { ...saved, turns: [{ ...saved.turns[0], anchor: { ...saved.turns[0].anchor, parts: [] } }] };
  assert.throws(() => replayNativeTurns('responses', wire('responses', rest), rest, bad), /assistant anchor mismatch/);
  assert.throws(() => recorder.finish(url, [prompt], [{ type: 'reasoning', encrypted_content: 'a'.repeat(1048576) }]),
    /continuation exceeds/);
});

test('native collectors reject malformed call fragments before committing a proposal', async () => {
  const { createToolCallCollector } = await import('../dist/esm/model/interactions/calls.js');
  const { nativeFunctionInteraction } = await import('../dist/esm/model/interactions/native-functions.js');
  const call = createToolCallCollector(message => { throw Error(message); });
  assert.throws(() => call.push({ type: 'function-call-delta', index: 0, id: 1 }), /Invalid model call fields/);
  assert.deepEqual(call.calls, []);
  const collector = nativeFunctionInteraction.prepare([]).createResponse();
  assert.throws(() => collector.push(null), error =>
    error.issues?.some(issue => issue.message.includes('Expected a native model call')));
});

test('background completion without output carries no replay handle', async () => {
  const { createBackgroundModelProvider } = await import('../dist/esm/support/model/lifecycle/background.js');
  const provider = createBackgroundModelProvider({
    protocol: 'responses', baseUrl: 'https://example.test/v1', model: 'fixture', apiKey: 'fixture',
    request: async () => Response.json({ status: 'completed', output: [] }),
  });
  const handle = { operationId: 'id', remoteId: 'remote', scope: 'user', protocol: 'responses', itemIds: ['item'] };
  assert.deepEqual(await provider.invoke({ action: 'read', handle }, { signal: new AbortController().signal }),
    { handle, status: 'completed', value: [] });
});

test('malformed Messages responses identify a missing content collection before accepting the terminal', () => {
  for (const content of [undefined, null, { type: 'text', text: 'unsupported' }]) {
    const decoder = new ProtocolDecoder('messages');
    assert.throws(() => decoder.decode({ content, stop_reason: 'end_turn' }, true), /Expected Messages content blocks/);
    assert.equal(decoder.finished, false);
    assert.deepEqual(decoder.replay, []);
  }
});

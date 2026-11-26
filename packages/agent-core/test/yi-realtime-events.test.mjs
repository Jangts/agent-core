import test from 'node:test';
import assert from 'node:assert/strict';
import { ModelRunner, Support } from '../dist/esm/index.js';

test('realtime native media cannot overwrite normalized event type or generation', async () => {
  let closed = false;
  const transport = { async send() {}, async close() { closed = true; },
    frames: (async function* () {
      yield {serverContent:{modelTurn:{parts:[{inlineData:{data:'AA==',mimeType:'audio/pcm',type:'completed',generation:999,privateExtra:'omitted'}}]}}};
      yield {serverContent:{turnComplete:true}};
    })(),
  };
  const provider = { async connect() { return transport; } };
  const runner = new ModelRunner({provider,maxCalls:1}).bind({});
  const session = await Support.openProtocolRealtime({protocol:'gemini-live',setup:{},connect:provider.connect},
    {run:runner.runOperation.bind(runner),maxFrames:5,maxFrameChars:1000,authorize(){}});
  const events=[];
  for await (const event of session.events()) events.push(event);
  assert.deepEqual(events[0],{generation:0,type:'media',data:'AA==',mimeType:'audio/pcm'});
  assert.equal(events[1].type,'completed');
  assert.equal(closed,true);
  assert.equal(runner.remainingCalls,1);
});

const signal = new AbortController().signal;
const runner = async (work, options = {}) => work(options.signal ?? signal);
async function sessionFor(protocol, input, { setup = {}, authorize = () => {}, send = () => {} } = {}) {
  const sent = [];
  let closed = 0;
  const session = await Support.openProtocolRealtime({
    protocol, setup, async connect() {
      return {
        frames: (async function* () { yield* input; })(),
        async send(frame) { sent.push(frame); await send(frame); },
        close() { closed++; },
      };
    },
  }, { run: runner, authorize, maxFrames: 40, maxFrameChars: 2000 });
  return { session, sent, get closed() { return closed; } };
}

test('realtime rejects automatic or concurrent provider turns before connecting', async () => {
  const cases = [
    ['openai-realtime', { audio: { input: { turn_detection: { type: 'server_vad' } } } }, /Automatic generation/],
    ['gemini-live', { realtimeInputConfig: { automaticActivityDetection: { disabled: false } } }, /Automatic generation/],
    ['gemini-live', { tools: [{ functionDeclarations: [{ name: 'lookup', behavior: 'NON_BLOCKING' }] }] }, /Nonblocking tools/],
  ];
  for (const [protocol, setup, message] of cases)
    await assert.rejects(Support.openProtocolRealtime({
      protocol, setup, connect() { assert.fail('unsupported setup connected'); },
    }, { run: runner, authorize() {}, maxFrames: 40, maxFrameChars: 2000 }), message);
});

test('OpenAI audio and tool events retain generation, call identity and terminal status', async () => {
  const id = 'r', response_id = id;
  const setup = { audio: { input: { turn_detection: null, format: { type: 'audio/pcm' } } } };
  const f = await sessionFor('openai-realtime', [
    { type: 'response.created', response: { id } },
    { type: 'response.output_item.added', response_id, item: { type: 'message' } },
    { type: 'response.output_audio.delta', response_id, delta: 'AQ==' },
    { type: 'response.output_item.added', response_id, item: { type: 'function_call', call_id: 't', name: 'lookup' } },
    { type: 'response.function_call_arguments.done', response_id, call_id: 't', arguments: '{}' },
    { type: 'response.done', response: { id, status: 'completed' } },
    { type: 'response.created', response: { id: 'follow' } },
    { type: 'response.done', response: { id: 'follow', status: 'completed', usage: { total_tokens: 3 } } },
  ], { setup });
  await f.session.audio('Ag==');
  assert.equal(f.session.generation, 0);
  await f.session.commitAudio();
  const events = f.session.events();
  assert.deepEqual((await events.next()).value, { type: 'audio', generation: 1, data: 'AQ==' });
  const proposal = (await events.next()).value;
  assert.deepEqual(proposal, { type: 'tool', generation: 1, id: 't', name: 'lookup', arguments: '{}' });
  await f.session.tool('t', 'lookup', { text: 'result' }, 1);
  await assert.rejects(f.session.tool('t', 'lookup', { text: 'duplicate' }, 1), /already provided/);
  await f.session.respond();
  assert.equal(f.session.generation, 1);
  assert.equal((await events.next()).value.type, 'tool-wait');
  assert.deepEqual((await events.next()).value, { type: 'completed', generation: 2, usage: { total_tokens: 3 } });
  assert.equal((await events.next()).done, true);
  assert.equal(f.sent[1].type, 'input_audio_buffer.append');
  assert.equal(f.sent.filter(event => event.item?.type === 'function_call_output').length, 1);
  assert.equal(f.closed, 1);
});

test('OpenAI frames fail closed on upstream errors, unknown events and invalid generation results', async () => {
  const cases = [
    [{ type: 'error' }, /Realtime upstream error/],
    [{ type: 'response.output_item.added', item: { type: 'unknown' } }, /Unsupported realtime output item/],
    [{ type: 'response.function_call_arguments.done', call_id: 'missing' }, /Realtime tool identity missing/],
    [{ type: 'response.done', response: { id: 'r', status: 'failed' } }, /Realtime generation did not complete/],
    [{ type: 'unknown' }, /Unsupported realtime event/],
  ];
  for (const [event, message] of cases) {
    const f = await sessionFor('openai-realtime', [
      { type: 'response.created', response: { id: 'r' } }, { response_id: 'r', ...event },
    ]);
    await f.session.text('question');
    await assert.rejects(f.session.events().next(), message);
    assert.equal(f.closed, 1);
  }
});

test('Gemini audio, required tool arguments and invalid media remain generation-bound', async () => {
  const f = await sessionFor('gemini-live', [
    { serverContent: { modelTurn: { parts: [{ inlineData: { data: 'AQ==' } }] } } },
    { toolCall: { functionCalls: [{ id: 'tool', name: 'lookup' }] } },
    { serverContent: { turnComplete: true } },
  ]);
  await f.session.audio('Ag==');
  assert.deepEqual(f.sent[1], { realtimeInput: { audio: { data: 'Ag==', mimeType: 'audio/pcm;rate=16000' } } });
  await f.session.commitAudio();
  const events = [];
  for await (const event of f.session.events()) events.push(event);
  assert.deepEqual(events.map(event => event.type), ['media', 'tool-wait', 'tool', 'tool-wait']);
  assert.deepEqual(events[0], { type: 'media', data: 'AQ==', generation: 1 });
  assert.equal(events[2].arguments, '{}');
  for (const [event, message] of [
    [{ serverContent: { modelTurn: { parts: [{ inlineData: { data: 99 } }] } } }, /Invalid realtime media content/],
    [{ serverContent: { modelTurn: { parts: [{ unknown: true }] } } }, /Unsupported realtime content part/],
    [{ toolCall: { functionCalls: [{ name: 'missing ID' }] } }, /Realtime tool identity missing/],
  ]) {
    const failed = await sessionFor('gemini-live', [event]);
    await failed.session.text('question');
    await assert.rejects(failed.session.events().next(), message);
    assert.equal(failed.closed, 1);
  }
});

test('authorization resolving after interruption cannot submit a stale tool result', async () => {
  const authorized = Promise.withResolvers(), entered = Promise.withResolvers();
  const f = await sessionFor('openai-realtime', [
    { type: 'response.created', response: { id: 'r' } },
    { type: 'response.function_call_arguments.done', response_id: 'r', call_id: 't', name: 'lookup', arguments: '{}' },
  ], { async authorize(action) { if (action === 'tool') { entered.resolve(); await authorized.promise; } } });
  await f.session.text('question');
  const events = f.session.events();
  const proposal = (await events.next()).value;
  const pending = f.session.tool(proposal.id, proposal.name, 'stale', proposal.generation);
  await entered.promise;
  await f.session.interrupt();
  authorized.resolve();
  await assert.rejects(pending, /Stale realtime generation/);
  assert.equal(f.sent.some(event => event.item?.type === 'function_call_output'), false);
  await events.return();
});

test('concurrent approvals for one realtime proposal cannot replace its submitted result', async () => {
  const bothAuthorizing = Promise.withResolvers(), approval = Promise.withResolvers();
  const sending = Promise.withResolvers(), finishSend = Promise.withResolvers();
  let approvals = 0;
  const f = await sessionFor('openai-realtime', [
    { type: 'response.created', response: { id: 'r' } },
    { type: 'response.function_call_arguments.done', response_id: 'r', call_id: 't', name: 'lookup', arguments: '{}' },
    { type: 'response.done', response: { id: 'r', status: 'completed' } },
  ], {
    async authorize(action) {
      if (action !== 'tool') return;
      if (++approvals === 2) bothAuthorizing.resolve();
      if (approvals <= 2) await approval.promise;
    },
    async send(frame) {
      if (frame.item?.type !== 'function_call_output') return;
      sending.resolve();
      await finishSend.promise;
    },
    setup: { tools: [{ type: 'function', name: 'lookup' }] },
  });
  await f.session.text('question');
  const events = f.session.events();
  const call = (await events.next()).value;
  const first = f.session.tool(call.id, call.name, 'first');
  const second = assert.rejects(f.session.tool(call.id, call.name, 'replacement'), /already provided/);
  await bothAuthorizing.promise;
  approval.resolve();
  await Promise.all([first, second]);
  const wait = events.next();
  await sending.promise;
  const overlap = f.session.respond();
  finishSend.resolve();
  assert.equal((await wait).value.type, 'tool-wait');
  await overlap;
  const outputs = f.sent.filter(frame => frame.item?.type === 'function_call_output');
  assert.deepEqual(outputs.map(frame => JSON.parse(frame.item.output)), ['first']);
  await events.return();
});

test('realtime isolates uncorrelated OpenAI responses and accepts Gemini declaration aliases', async () => {
  const gemini = await sessionFor('gemini-live', [], { setup: { tools: [{ function_declarations: [{ name: 'lookup' }] }] } });
  assert.deepEqual(gemini.sent[0].setup.tools[0].function_declarations, [{ name: 'lookup' }]);
  await gemini.session.close();
  const f = await sessionFor('openai-realtime', [
    { type: 'response.created', response: { id: 'accepted' } },
    { type: 'response.created', response: { id: 'unmatched' } },
    { type: 'session.updated' },
    { type: 'response.output_text.delta', response_id: 'unmatched', delta: 'discard' },
    { type: 'response.output_text.delta', response_id: 'accepted', delta: 'accept' },
  ]);
  await f.session.text('question');
  const events = f.session.events();
  assert.deepEqual((await events.next()).value, { generation: 1, type: 'text', text: 'accept' });
  assert.equal((await events.next()).done, true);
});

test('Gemini exposes a stable tool proposal even if transport state changes after the wait event', async () => {
  const call = { id: 'lookup-1', name: 'lookup', args: { number: 1 } };
  const f = await sessionFor('gemini-live', [{ toolCall: { functionCalls: [call] } }]);
  await f.session.text('question');
  const events = f.session.events();
  assert.equal((await events.next()).value.type, 'tool-wait');
  call.id = 'changed-id';
  call.args.number = 2;
  assert.deepEqual((await events.next()).value, {
    generation: 1, type: 'tool', id: 'lookup-1', name: 'lookup', arguments: '{"number":1}',
  });
  await events.return();
});

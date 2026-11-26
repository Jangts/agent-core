/*
 * Completion policies, shared call aggregation and provider tool messages.
 *
 * The default policy must reproduce the framing rules that existed before policies were
 * configurable; the session policy judges the effective `tool_choice` of the request body. Both
 * share one collector, and direct Provider use maps tool threads explicitly instead of forwarding
 * host fields to the wire.
 *
 * Runs on `dist/esm`; `model.invalid` is never contacted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CompatibleModelProvider,
  Support,
  chatCompletionMessages,
  getErrorInfo,
} from '../dist/esm/index.js';
import { chatCompletionFunctionOptions } from '../dist/esm/support/model/chat-completions.js';

const config = {
  baseUrl: 'https://model.invalid/v1/',
  apiKey: 'fixture-secret',
  model: 'fixture-model',
  maxOutputTokens: 1000,
};
const signal = () => new AbortController().signal;
const failure = (code) => Object.assign(new Error(code), { code });
const frames = (events) =>
  new Response(
    events
      .map(
        (event) => 'data: ' + (typeof event === 'string' ? event : JSON.stringify(event)) + '\n\n',
      )
      .join(''),
    { headers: { 'content-type': 'text/event-stream' } },
  );
const text = (value, finish) => ({
  choices: [{ index: 0, delta: { content: value }, ...(finish ? { finish_reason: finish } : {}) }],
});
const call = (index, fields, finish) => ({
  choices: [
    {
      index: 0,
      delta: { tool_calls: [{ index, type: 'function', ...fields }] },
      ...(finish ? { finish_reason: finish } : {}),
    },
  ],
});
const start = (policy, facts) => policy.begin(facts, failure);

test('wire options validate tool selection and distinguish omitted parallel settings', () => {
  const functions = [{ name: 'lookup', description: 'Lookup', parameters: { type: 'object' } }];
  assert.throws(() => chatCompletionFunctionOptions({ functions, toolChoice: 'invalid' }), /Invalid toolChoice/);
  assert.throws(() => chatCompletionFunctionOptions({ functions, parallelToolCalls: 'invalid' }), /Invalid parallelToolCalls/);
  assert.deepEqual(chatCompletionFunctionOptions({ functions, toolChoice: 'auto', parallelToolCalls: 'omit' }), {
    tools: [{ type: 'function', function: functions[0] }],
    tool_choice: 'auto',
  });
  assert.throws(() => chatCompletionMessages([{
    role: 'assistant', content: '', toolCalls: [{ id: '', name: 'lookup', arguments: '{}' }],
  }]), /Invalid tool call/);
});
const expectCode = (code, run) =>
  assert.throws(run, (error) => getErrorInfo(error).codes.includes(code) || error.code === code);

test('completion policy catalog registers each preset under its own identifier', () => {
  assert.deepEqual(Object.keys(Support.completionPolicyCatalog).sort(), ['default', 'session']);
  for (const [id, policy] of Object.entries(Support.completionPolicyCatalog))
    assert.equal(policy.id, id);
  assert.equal(Support.completionPolicyCatalog.default, Support.defaultCompletionPolicy);
  assert.equal(Support.completionPolicyCatalog.session, Support.sessionCompletionPolicy);
});

test('default policy keeps the rules that existed before policies were configurable', () => {
  const policy = Support.defaultCompletionPolicy;
  const plain = start(policy, { functions: false, allowEmptyText: false });
  plain.part('你好');
  plain.finish('stop');
  plain.end();

  expectCode('MODEL_PROTOCOL', () => {
    const session = start(policy, { functions: false, allowEmptyText: false });
    session.part({ type: 'function-call-delta', index: 0, id: 'a', name: 'lookup' });
  });
  expectCode('MODEL_INCOMPLETE', () => {
    const session = start(policy, { functions: true, allowEmptyText: false });
    session.part({ type: 'function-call-delta', index: 0, id: 'a', name: 'lookup' });
    session.finish('stop');
  });
  expectCode('MODEL_OUTPUT_LIMIT', () => {
    start(policy, { functions: true, allowEmptyText: false }).finish('length');
  });
  expectCode('MODEL_INCOMPLETE', () => {
    const session = start(policy, { functions: false, allowEmptyText: false });
    session.part('partial');
    session.end();
  });
  const empty = start(policy, { functions: false, allowEmptyText: true });
  empty.finish('stop');
  empty.end();
});

test('session policy judges the effective tool_choice', () => {
  const policy = Support.sessionCompletionPolicy;
  const completed = start(policy, { functions: false, toolChoice: 'auto', allowEmptyText: false });
  completed.part('准备调用');
  completed.part({ type: 'function-call-delta', index: 0, id: 'a', name: 'lookup', arguments: '{}' });
  completed.finish('tool_calls');
  completed.end();

  expectCode('MODEL_PROTOCOL', () => {
    const session = start(policy, { functions: false, toolChoice: 'auto', allowEmptyText: false });
    session.part({ type: 'function-call-delta', index: 0, id: 'a', name: 'lookup' });
    session.finish('stop');
  });
  expectCode('MODEL_INCOMPLETE', () => {
    const session = start(policy, { functions: false, toolChoice: 'auto', allowEmptyText: false });
    session.finish('stop');
  });
  expectCode('MODEL_INCOMPLETE', () => {
    start(policy, { functions: false, toolChoice: 'required', allowEmptyText: false }).finish('stop');
  });
  expectCode('MODEL_PROTOCOL', () => {
    const session = start(policy, {
      functions: false,
      toolChoice: { type: 'function', function: { name: 'lookup' } },
      allowEmptyText: false,
    });
    session.part({ type: 'function-call-delta', index: 0, id: 'a', name: 'other', arguments: '{}' });
    session.finish('tool_calls');
  });
  expectCode('MODEL_PROTOCOL', () => {
    const session = start(policy, { functions: false, toolChoice: 'none', allowEmptyText: false });
    session.part({ type: 'function-call-delta', index: 0, id: 'a', name: 'lookup' });
  });
  expectCode('MODEL_CONFIG', () =>
    start(policy, { functions: false, toolChoice: 'stop', allowEmptyText: false }),
  );
  expectCode('MODEL_PROTOCOL', () => {
    const session = start(policy, { functions: false, allowEmptyText: false });
    session.part({ type: 'function-call-delta', index: 0, id: 'a', name: 'lookup' });
  });
});

test('shared collector aggregates interleaved calls and rejects conflicts and gaps', () => {
  const collector = Support.createToolCallCollector((message) => {
    throw new Error(message);
  });
  collector.push({ type: 'function-call-delta', index: 1, id: 'b', name: 'second' });
  collector.push({ type: 'function-call-delta', index: 0, id: 'a', name: 'first', arguments: '{"x":' });
  collector.push('prose');
  collector.push({ type: 'function-call-delta', index: 0, arguments: '1}' });
  collector.push({ type: 'function-call-delta', index: 1, arguments: '{}' });
  assert.deepEqual(collector.complete(), [
    { index: 0, id: 'a', name: 'first', arguments: '{"x":1}' },
    { index: 1, id: 'b', name: 'second', arguments: '{}' },
  ]);
  assert.throws(
    () => {
      const incomplete = Support.createToolCallCollector((message) => {
        throw new Error(message);
      });
      incomplete.push({ type: 'function-call-delta', index: 0, id: 'a' });
      incomplete.complete();
    },
    /Incomplete/,
  );
  assert.throws(
    () => {
      const conflicting = Support.createToolCallCollector((message) => {
        throw new Error(message);
      });
      conflicting.push({ type: 'function-call-delta', index: 0, id: 'a', name: 'first' });
      conflicting.push({ type: 'function-call-delta', index: 0, id: 'b' });
    },
    /Conflicting/,
  );
  assert.throws(
    () => {
      const duplicated = Support.createToolCallCollector((message) => {
        throw new Error(message);
      });
      duplicated.push({ type: 'function-call-delta', index: 0, id: 'a', name: 'first' });
      duplicated.push({ type: 'function-call-delta', index: 1, id: 'a', name: 'second' });
    },
    /Duplicate/,
  );
  assert.throws(
    () => {
      const gap = Support.createToolCallCollector((message) => {
        throw new Error(message);
      });
      gap.push({ type: 'function-call-delta', index: 0, id: 'a', name: 'first' });
      gap.push({ type: 'function-call-delta', index: 1, id: 'b' });
      gap.complete();
    },
    /Incomplete/,
  );
});

test('session completion distinguishes malformed selection, missing content and output limits', () => {
  const policy = Support.sessionCompletionPolicy;
  const begin = (facts = {}) => start(policy, { functions: false, allowEmptyText: false, ...facts });
  for (const toolChoice of [
    { type: 'function', function: null },
    { type: 'function', function: { name: '' } },
    { type: 'other', function: { name: 'lookup' } },
  ]) expectCode('MODEL_CONFIG', () => begin({ toolChoice }));
  expectCode('MODEL_INCOMPLETE', () => begin().end());
  expectCode('MODEL_OUTPUT_LIMIT', () => begin().finish('length'));
  expectCode('MODEL_INCOMPLETE', () => begin().finish('tool_calls'));
  expectCode('MODEL_OUTPUT_LIMIT', () => begin({ toolChoice: 'auto' }).finish('length'));
  expectCode('MODEL_INCOMPLETE', () => begin({ toolChoice: 'auto' }).finish('content_filter'));
  expectCode('MODEL_INCOMPLETE', () => begin({ toolChoice: 'required' }).finish('tool_calls'));
  expectCode('MODEL_PROTOCOL', () => {
    const session = begin({ toolChoice: 'auto' });
    session.part({ type: 'function-call-delta', index: 0, id: 'unfinished' });
    session.finish('tool_calls');
  });
  expectCode('MODEL_INCOMPLETE', () => begin({ toolChoice: 'none' }).finish('stop'));
  const prose = begin({ toolChoice: 'none' });
  prose.part('Completed');
  prose.finish('stop');
  prose.end();
  for (const facts of [{ functions: false }, { functions: true }]) {
    const session = begin(facts);
    session.finish(facts.functions ? 'tool_calls' : 'stop');
    expectCode('MODEL_INCOMPLETE', () => session.end());
  }
  const inherited = begin({ functions: true });
  inherited.part({ type: 'function-call-delta', index: 0, id: 'call', name: 'lookup' });
  inherited.finish('tool_calls');
  inherited.end();
});

test('direct call collector rejects unexpected inputs before opening a call slot', () => {
  const collector = Support.createToolCallCollector(message => { throw new TypeError(message); });
  assert.throws(() => collector.push(null), /Expected a native model call/);
  assert.throws(() => collector.push({ type: 'unknown', index: 0 }), /Expected a native model call/);
  assert.throws(() => collector.push({ type: 'function-call-delta', index: -1 }), /Invalid model call index/);
  assert.deepEqual(collector.complete(), []);
});

test('tool thread messages map explicitly to wire fields', () => {
  assert.deepEqual(
    chatCompletionMessages([
      { role: 'user', content: '查一下' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'call-1', name: 'lookup', arguments: '{"q":1}' }],
      },
      { role: 'tool', content: '{"ok":true}', toolCallId: 'call-1' },
    ]),
    [
      { role: 'user', content: '查一下' },
      {
        role: 'assistant',
        content: '',
        tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'lookup', arguments: '{"q":1}' } }],
      },
      { role: 'tool', content: '{"ok":true}', tool_call_id: 'call-1' },
    ],
  );
  assert.throws(() => chatCompletionMessages([{ role: 'user', content: 'x', toolCallId: 'a' }]), /tool role/);
  assert.throws(() => chatCompletionMessages([{ role: 'tool', content: 'x' }]), /tool call id/);
  assert.throws(
    () =>
      chatCompletionMessages([
        { role: 'user', content: 'x', toolCalls: [{ id: 'a', name: 'n', arguments: '{}' }] },
      ]),
    /assistant/,
  );
  assert.throws(
    () =>
      chatCompletionMessages([
        {
          role: 'tool',
          content: 'x',
          toolCallId: 'a',
          images: [{ url: 'https://example.invalid/image.png' }],
        },
      ]),
    /user message/,
  );
});

test('tool thread mapping drops undeclared wire fields and host metadata', () => {
  const input = {
    role: 'user', content: 'hello',
    tool_calls: [{ id: 'injected', type: 'function', function: { name: 'lookup', arguments: '{}' } }],
    tool_call_id: 'injected', name: 'host-name', privateContext: 'private',
  };
  assert.deepEqual(chatCompletionMessages([input]), [{ role: 'user', content: 'hello' }]);
  assert.throws(() => chatCompletionMessages([{ role: 'tool', content: 'x', tool_call_id: 'raw' }]), /tool call id/);
  assert.deepEqual(chatCompletionMessages([{
    role: 'tool', content: 'x', toolCallId: 'valid', tool_call_id: 'injected',
  }]), [{ role: 'tool', content: 'x', tool_call_id: 'valid' }]);
});

test('dynamic tool results require a nonempty string ID', () => {
  for (const toolCallId of [undefined, null, '', 1, true, {}, []]) {
    assert.throws(() => chatCompletionMessages([{ role: 'tool', content: 'x', toolCallId }]), /tool call id/);
  }
  for (const message of [{ role: 'unknown', content: 'x' }, { role: 'user', content: null }]) {
    assert.throws(() => chatCompletionMessages([message]), /role or content/);
  }
});

test('a provider configured with the session policy accepts concurrent calls the default rejects', async () => {
  const events = [
    call(0, { id: 'a', function: { name: 'lookup', arguments: '{"q":' } }),
    call(1, { id: 'b', function: { name: 'other', arguments: '{}' } }),
    call(0, { function: { arguments: '1}' } }),
    call(1, {}, 'tool_calls'),
    '[DONE]',
  ];
  const invoke = async (completionPolicy) => {
    const provider = new CompatibleModelProvider({
      config: () => ({ ...config, requestBody: { tool_choice: 'auto' } }),
      ports: { request: async () => frames(events), ...(completionPolicy ? { completionPolicy } : {}) },
    });
    return Array.fromAsync(
      provider.stream([{ role: 'user', content: '并行查' }], { signal: signal() }),
    );
  };
  const parts = await invoke(Support.sessionCompletionPolicy);
  assert.equal(parts.length, 4);
  await assert.rejects(invoke(), (error) => getErrorInfo(error).codes.includes('MODEL_PROTOCOL'));
});

test('provider accepts a tool thread and sends it as wire messages', async () => {
  let body;
  const provider = new CompatibleModelProvider({
    config: () => ({ ...config, requestBody: { tool_choice: 'auto' } }),
    ports: {
      completionPolicy: Support.sessionCompletionPolicy,
      request: async (_url, request) => {
        body = JSON.parse(request.body);
        return frames([text('完成', 'stop'), '[DONE]']);
      },
    },
  });
  const messages = [
    { role: 'user', content: '查一下' },
    { role: 'assistant', content: '', toolCalls: [{ id: 'call-1', name: 'lookup', arguments: '{}' }] },
    { role: 'tool', content: '{"ok":true}', toolCallId: 'call-1' },
  ];
  assert.deepEqual(
    await Array.fromAsync(provider.stream(messages, { signal: signal() })),
    ['完成'],
  );
  assert.deepEqual(body.messages.at(-1), {
    role: 'tool',
    content: '{"ok":true}',
    tool_call_id: 'call-1',
  });
  assert.deepEqual(body.messages.at(-2).tool_calls, [
    { id: 'call-1', type: 'function', function: { name: 'lookup', arguments: '{}' } },
  ]);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { ModelRunner } from '../dist/esm/index.js';
import { modelMessageDiagnostics } from '../dist/esm/model/message-diagnostics.js';
import { countModelInput } from '../dist/esm/model/token-budget.js';
import { snapshotMessage } from '../dist/esm/support/context/snapshot.js';

const collect = () => {
  let raw = '';
  return {
    get outputChars() {
      return raw.length;
    },
    push(part) {
      raw += String(part);
    },
    finish: () => raw,
  };
};

const transport = {
  id: 'thread',
  prepare() {
    return { options: {}, schemaChars: 0, createResponse: collect };
  },
};

test('tool-thread snapshots preserve correlation while isolating raw arguments and diagnostics', () => {
  const proposal = { id: 'call-1', name: 'lookup', arguments: '{"reference":1}' };
  const messages = [
    { role: 'assistant', content: '', toolCalls: [proposal] },
    { role: 'tool', content: 'found', toolCallId: 'call-1' },
  ];
  const snapshots = messages.map(snapshotMessage);
  assert.deepEqual(snapshots, messages);
  assert.notEqual(snapshots[0].toolCalls[0], proposal);
  const diagnostics = modelMessageDiagnostics(messages);
  assert.deepEqual(diagnostics[0].toolCalls, [{ id: 'call-1', name: 'lookup', arguments: '[tool arguments omitted]' }]);
  assert.equal(diagnostics[1].toolCallId, 'call-1');
  assert.equal(countModelInput({
    countTokens({messages: observed}) {
      observed[0].toolCalls[0].arguments = '{}';
      return 7;
    },
  }, messages, {}), 7);
  assert.equal(proposal.arguments, '{"reference":1}');
});

test('tool thread is preserved, sent to the provider and counted in input characters', async () => {
  let received;
  const runner = new ModelRunner({
    provider: {
      async *stream(messages) {
        received = messages;
        yield 'ok';
      },
    },
    transports: [transport],
  });
  const messages = [
    { role: 'user', content: '查一下' },
    {
      role: 'assistant',
      content: '',
      toolCalls: [{ id: 'call-1', name: 'lookup', arguments: '{"q":1}' }],
    },
    { role: 'tool', content: '{"ok":true}', toolCallId: 'call-1' },
  ];
  const measurement = runner.prepare({ stageId: 'reply', transport }).measure(messages);
  const toolChars =
    'call-1'.length + 'lookup'.length + '{"q":1}'.length + 'call-1'.length;
  assert.equal(
    measurement.messageChars,
    messages.reduce((sum, message) => sum + message.content.length, 0) + toolChars,
  );

  await runner.invoke({ input: messages, transport });
  assert.deepEqual(received[1].toolCalls, messages[1].toolCalls);
  assert.equal(received[2].toolCallId, 'call-1');
});

test('tool thread rejects invalid role and field combinations', () => {
  const runner = new ModelRunner({
    provider: {
      async *stream() {
        yield 'ok';
      },
    },
    transports: [transport],
  });
  const prepared = runner.prepare({ stageId: 'reply', transport });
  assert.throws(() => prepared.measure([{ role: 'tool', content: 'x' }]), /Invalid model message/);
  assert.throws(
    () => prepared.measure([{ role: 'system', content: 'x', toolCallId: 'call-1' }]),
    /Invalid model message/,
  );
  assert.throws(
    () =>
      prepared.measure([
        { role: 'assistant', content: 'x', toolCalls: [{ id: '', name: 'lookup', arguments: '' }] },
      ]),
    /Invalid model tool call/,
  );
});

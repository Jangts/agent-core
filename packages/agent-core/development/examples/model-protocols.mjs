/**
 * One authorized tool loop across five model protocols, using deterministic wire fixtures.
 * Pass a real connection's request/endpoint/key/model explicitly to exercise a remote service.
 */
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { ModelRunner, Support } from '@jangts/agent-core';

const protocols = ['chat-completions', 'responses', 'messages', 'generate-content', 'interactions'];
/** Official response shapes for the same read-only task; no network or credentials are used. */
function fixture(protocol, tool) {
  const text = 'Inventory: 7';
  const call = { id: 'lookup_1', name: 'lookup', arguments: '{}' };
  return {
    'chat-completions': { choices: [{ index: 0, message: tool ? { content: '', tool_calls: [{ id: call.id, type: 'function', function: { name: call.name, arguments: call.arguments } }] } : { content: text }, finish_reason: tool ? 'tool_calls' : 'stop' }] },
    responses: { status: 'completed', output: tool ? [{ type: 'function_call', call_id: call.id, name: call.name, arguments: call.arguments }] : [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] }] },
    messages: { content: tool ? [{ type: 'tool_use', id: call.id, name: call.name, input: {} }] : [{ type: 'text', text }], stop_reason: tool ? 'tool_use' : 'end_turn' },
    'generate-content': { candidates: [{ index: 0, content: { role: 'model', parts: tool ? [{ functionCall: { id: call.id, name: call.name, args: {} } }] : [{ text }] }, finishReason: 'STOP' }] },
    interactions: { status: tool ? 'requires_action' : 'completed', steps: tool ? [{ type: 'function_call', id: call.id, name: call.name, arguments: {} }] : [{ type: 'model_output', content: [{ type: 'text', text }] }] },
  }[protocol];
}

/** Keep tools, authorization, history, result access and stopping conditions identical. */
export async function runModelProtocolExample(protocol, connection) {
  if (!protocols.includes(protocol)) throw new TypeError('Unknown example protocol');
  let requests = 0;
  const provider = Support.createModelProvider({
    protocol, baseUrl: 'https://fixture.invalid/v1', apiKey: 'fixture-only', model: 'fixture-model',
    scope: 'example:reader/conversation:1', stream: false,
    request: async () => Response.json(fixture(protocol, requests++ === 0)),
    ...connection,
  });
  const execution = { signal: new AbortController().signal };
  let reads = 0;
  const catalog = Support.defineToolCatalog([{
    id: 'lookup', kind: 'read', description: 'Read inventory',
    inputSchema: {
      jsonSchema: { type: 'object', properties: {}, additionalProperties: false },
      parse(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length)
          throw new TypeError('Expected an empty lookup input');
        return {};
      },
    },
    authorize(_input, context) {
      if (context.app.subject !== 'reader') throw new Error('Inventory access denied');
    },
    execute() { reads++; return { inventory: 7 }; },
    parseOutput(value) {
      if (value?.inventory !== 7) throw new TypeError('Invalid inventory response');
      return value;
    },
  }]);
  const tools = catalog.bind({ app: { subject: 'reader' }, execution });
  const interaction = Support.createModelInteraction({ id: 'conversation', response: 'tools', tools: tools.tools });
  const runner = new ModelRunner({ provider, interactions: [interaction], maxCalls: 3 }).bind(execution);
  const messages = [{ role: 'user', content: 'Read inventory and answer with the quantity.' }];
  let continuation;
  for (let turn = 0; turn < 3; turn++) {
    const result = await runner.invoke({ input: messages, interaction,
      modelOptions: { continuation, onContinuation(value) { continuation = value; } },
    });
    if (!result.value.calls.length) return { text: result.value.text, reads, calls: runner.totalCallCount };
    messages.push({ role: 'assistant', content: result.value.text,
      toolCalls: result.value.calls.map(({ id, name, arguments: args }) => ({ id, name, arguments: args })),
    });
    for (const proposal of result.value.calls) {
      const receipt = await tools.invoke(proposal);
      messages.push({ role: 'tool', content: JSON.stringify(receipt.value), toolCallId: proposal.id });
    }
  }
  throw new Error('Example generation limit reached');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const protocol of protocols) {
    const result = await runModelProtocolExample(protocol);
    assert.deepEqual(result, { text: 'Inventory: 7', reads: 1, calls: 2 });
    console.log(`${protocol}: ${result.text}; ${result.reads} authorized read, ${result.calls} model calls`);
  }
}

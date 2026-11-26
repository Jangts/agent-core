/** Run the tutorial offline and check that both configuration styles produce equivalent contracts. */
import assert from 'node:assert/strict';
import { independentConfiguration } from './independent.mjs';
import { associatedConfiguration } from './associated.mjs';
import { runCase, taskTransport } from './workflow.mjs';
import { wrappedConfiguration } from './protocol.mjs';

const separate = independentConfiguration();
const linked = associatedConfiguration();
assert.deepEqual(
  linked.tools.select({ intent: true }, {}).ids(),
  separate.tools.select({ intent: true }, {}).ids(),
);
const rawFunctions = (configuration) =>
  taskTransport(configuration.tools).prepare('choose-operation').options.functions;
assert.deepEqual(rawFunctions(linked), rawFunctions(separate));
assert.deepEqual(
  linked.tools.resolve(
    { toolId: 'search_notes', input: { query: ' 咖啡 ' } },
    { stageId: 'choose-operation' },
  ),
  separate.tools.resolve(
    { toolId: 'search_notes', input: { query: ' 咖啡 ' } },
    { stageId: 'choose-operation' },
  ),
);
for (const [question, name, input] of [
  ['帮我找咖啡相关的笔记', 'search_notes', { query: '咖啡' }],
  ['读一下n1这篇笔记', 'read_note', { noteId: 'n1' }],
]) {
  const a = await runCase(separate, question, name, input);
  const b = await runCase(linked, question, name, input);
  assert.deepEqual(a.submitted, b.submitted);
  assert.deepEqual(a.result, b.result);
  console.log(JSON.stringify({ question, result: b.result }));
}
const a = await runCase(wrappedConfiguration(separate), '帮我找咖啡相关的笔记', 'tool_request', {
  name: 'search_notes',
  input: { query: '咖啡' },
});
const b = await runCase(wrappedConfiguration(linked), '帮我找咖啡相关的笔记', 'tool_request', {
  name: 'search_notes',
  input: { query: '咖啡' },
});
assert.deepEqual(a.submitted, b.submitted);
assert.deepEqual(a.result, b.result);
console.log('PASS: discovery, model functions, messages and execution results match.');
console.log('PASS: name/input envelope uses the same workflow and execution contract.');

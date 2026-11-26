// @ts-check
import { ModelRunner, Support } from '@jangts/agent-core';
import { defineKnowledgeCatalog } from '@jangts/agent-core/kits/knowledge';

/** @typedef {{ canCalculate: boolean }} App */
/** @param {unknown} input */
function parseNumber(input) {
  if (
    !input ||
    typeof input !== 'object' ||
    !('value' in input) ||
    typeof input.value !== 'number' ||
    !Number.isFinite(input.value)
  )
    throw new TypeError('A finite value is required');
  return input.value;
}
const tool = Support.defineTool({
  id: 'double',
  kind: 'pure',
  description: 'Calculate twice the supplied finite number.',
  inputSchema: Support.defineSchema({
    jsonSchema: {
      type: 'object',
      required: ['value'],
      additionalProperties: false,
      properties: { value: { type: 'number' } },
    },
    parse: parseNumber,
  }),
  authorize(
    input,
    /** @type {import('@jangts/agent-core/types').OperationContext<App>} */ context,
  ) {
    if (!context.app.canCalculate) throw new Error('Access denied');
  },
  execute: (input) => input * 2,
  parseOutput(input) {
    if (typeof input !== 'number' || !Number.isFinite(input)) throw new TypeError('Invalid result');
    return input;
  },
});
const catalog = Support.defineToolCatalog([tool]);
const interaction = Support.createModelInteraction({
  id: 'calculation',
  tools: catalog.tools,
});
/** @type {import('@jangts/agent-core/types').ChatProvider} */
const provider = {
  async *stream() {
    // An offline provider proposes a tool. It never executes the operation itself.
    yield {
      type: 'function-call-delta',
      index: 0,
      id: 'proposal',
      name: 'double',
      arguments: '{"value":21}',
    };
  },
};
const execution = { signal: new AbortController().signal };
const model = new ModelRunner({ provider, interactions: [interaction], execution, maxCalls: 1 });
const runtime = catalog.bind({ app: { canCalculate: true }, execution });
const context = Support.defineContextFragments(
  [
    {
      id: 'request',
      sourceId: 'cli',
      role: 'user',
      trust: 'user',
      lifetime: 'turn',
      maxChars: 500,
      format: (/** @type {string} */ input) => ({ request: input }),
    },
  ],
  { maxInputChars: 1000 },
);
const proposed = await model.invoke({
  stageId: 'choose',
  interaction: 'calculation',
  input: context.build({ input: 'Calculate twice 21.' }),
});
const executed = await runtime.invoke({
  toolId: proposed.value.toolId,
  input: proposed.value.input,
});
if (executed.value !== 42 || executed.invocation.status !== 'success')
  throw new Error('Unexpected execution');
const knowledge = defineKnowledgeCatalog([
  { id: 'manual', revision: 'r1', parts: ['Values must be finite.'] },
]);
const snapshot = knowledge.read({ documentId: 'manual', selection: { mode: 'document' } });
if (!snapshot.content.includes('finite')) throw new Error('Missing evidence');
console.log(executed.value);

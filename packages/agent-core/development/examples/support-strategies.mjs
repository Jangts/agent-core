/**
 * Example: compose Support strategies — model budgets, context fragments, selection and compression.
 *
 * Every produced object is a normal Core contract, so Core needs no strategy-specific branch.
 */
import assert from 'node:assert/strict';
import { ModelRunner, Support } from '@jangts/agent-core';

const quick = {
  async *stream() {
    yield 'quick';
  },
};
const deliberate = {
  async *stream() {
    yield 'deliberate';
  },
};
// Same Core settings: first use a definition, then refer to a registered definition.
const basic = Support.createModelStrategy({ model: { provider: quick }, budget: 'small' });
assert.equal((await new ModelRunner(basic).invoke('hello')).value, 'quick');
const models = { fast: { provider: quick }, thorough: { provider: deliberate } };
const configured = Support.createModelStrategy({
  model: 'fast',
  models,
  budget: 'small',
  reasoning: 'high',
  reasoningOptions: { high: { provider: deliberate } },
  maxCalls: 1,
});
assert.equal((await new ModelRunner(configured).invoke('hello')).value, 'deliberate');
assert.equal(configured.maxCalls, 1);
assert.equal(configured.maxOutputTokens, 512);

const fragment = {
  id: 'history',
  sourceId: 'chat',
  role: 'user',
  trust: 'user',
  lifetime: 'turn',
  maxChars: 1000,
};
const builder = Support.defineContextFragments(
  [{ ...fragment, format: () => ({ messages: [{ role: 'user', content: 'original' }] }) }],
  { maxInputChars: 2000 },
);
const input = builder.build({
  input: {},
  mutableFragmentIds: [],
  originalFragments: builder.fragments({}),
  additionalMessages: [{ role: 'user', content: 'attachment', images: [{ url: 'fixture' }] }],
});
assert.equal(input.messages.at(-1).images[0].url, 'fixture');
const strategy = Support.createContextStrategy(
  [
    { kind: 'recent', fragment, field: 'messages', keepGroups: 1 },
    {
      kind: 'recent',
      fragment: { id: 'receipts', maxChars: 1000 },
      field: 'messages',
      keepGroups: 0,
    },
  ],
  {
    selection: { mode: 'auto', maxTrimLossRatio: 0.2, reserveCalls: 1 },
    triggerChars: 1800,
    targetInputChars: 1200,
  },
);
assert.equal(strategy.policy.steps.length, 2);
console.log('Support strategies implement the same Core contracts.');

// Execute the continuity recommendation, including its model call and the final answer.
const summarizer = new ModelRunner({
  execution: {},
  provider: {
    async *stream() {
      yield 'old summary';
    },
  },
  maxCalls: 2,
});
const compressor = Support.createContextCompressor({
  id: 'summary',
  instruction: 'Summarize older messages.',
  interaction: 'core:plain-text',
  maxOutputTokens: 128,
  parse(value) {
    return { messages: [{ role: 'user', content: String(value) }] };
  },
});
const continuity = Support.createContextStrategy({
  kind: 'continuity',
  fragment,
  field: 'messages',
  compressor,
  targetChars: 220,
  keepGroups: 1,
});
const current = [
  { role: 'user', content: 'current question' },
  { role: 'assistant', content: 'current answer' },
];
const processed = await Support.processContext(
  {
    maxInputChars: 400,
    fragments: [
      {
        ...fragment,
        value: {
          messages: [
            { role: 'user', content: 'old '.repeat(150) },
            { role: 'assistant', content: 'old answer '.repeat(60) },
            ...current,
          ],
        },
      },
    ],
  },
  continuity.policy,
  {
    stageId: 'summary',
    signal: summarizer.signal,
    compressors: continuity.compressors,
    selectors: continuity.selectors,
    remainingCalls: () => summarizer.remainingCalls,
    callModel: (request) => summarizer.invoke(request),
  },
);
const messages = JSON.parse(
  processed.context.messages.find((message) => message.role === 'user').content,
).messages;
assert.equal(messages[0].content, 'old summary');
assert.deepEqual(messages.slice(1), current);
assert.equal((await summarizer.invoke({ input: processed.context })).value, 'old summary');
assert.equal(summarizer.totalCallCount, 2);

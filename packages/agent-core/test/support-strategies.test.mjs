/**
 * Locks down Support context strategies: `recent` and `continuity` share one fragment and
 * node contract, exact overrides win over presets, and preview rules require explicit
 * capability/stage qualification with bounded schema traversal. Runs under node --test with
 * a fixture workflow whose provider echoes the last context message.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentCoreEngine, Support, defineWorkflow, route } from '../dist/esm/index.js';

const history = () => [
  { role: 'user', content: 'old '.repeat(50) },
  { role: 'assistant', content: 'old answer '.repeat(30) },
  { role: 'user', content: 'keep the correction' },
  { role: 'assistant', content: 'kept' },
];
const metadata = {
  id: 'history',
  sourceId: 'chat',
  trust: 'user',
  lifetime: 'turn',
  role: 'user',
  maxChars: 300,
};
const plan = () => ({
  maxInputChars: 180,
  fragments: [{ ...metadata, value: { history: history() } }],
});
const summarize = {
  id: 'summary',
  maxCalls: 0,
  async compress() {
    return { history: [{ role: 'user', content: 'old summary' }] };
  },
};
function agent(strategy) {
  return new AgentCoreEngine({
    workflow: defineWorkflow({
      id: 'strategy',
      nodes: [
        Support.createContextProcessingNode({
          id: 'context',
          description: 'Use the recommended strategy',
          ...strategy,
          plan,
          update: (result) => ({ input: result.input, prepared: result.prepared }),
          routes: [route.to('answer')],
        }),
        {
          id: 'answer',
          description: 'Return the actual context',
          async run(state, ctx) {
            return {
              result: (await ctx.model.invoke({ input: state.input, prepared: state.prepared }))
                .value,
            };
          },
          routes: [route.deliver('result')],
        },
      ],
    }),
    model: {
      provider: {
        async *stream(messages) {
          yield messages.at(-1).content;
        },
      },
    },
  });
}

test('recent and continuity strategies reuse the same fragment and node contract, with exact overrides', async () => {
  const recent = Support.createContextStrategy({
    kind: 'recent',
    fragment: metadata,
    field: 'history',
    targetChars: 120,
  });
  assert.equal(recent.policy.steps[0].id, 'history.window');
  // The window keeps only the last two turns at targetChars 120, so the older turns are
  // dropped and the correction pair survives intact.
  assert.deepEqual(JSON.parse(await agent(recent).run({})).history, history().slice(2));
  const continuity = Support.createContextStrategy({
    kind: 'continuity',
    fragment: metadata,
    field: 'history',
    compressor: summarize,
    targetChars: 150,
  });
  assert.equal(continuity.policy.steps[0].handlerId, summarize.id);
  const actual = JSON.parse(await agent(continuity).run({})).history;
  // Continuity replaces older turns with the compressor summary and keeps the recent pair.
  assert.equal(actual[0].content, 'old summary');
  assert.deepEqual(actual.slice(1), history().slice(2));
  const exact = Support.createContextStrategy({
    kind: 'recent',
    fragment: metadata,
    field: 'history',
    targetChars: 99,
    keepGroups: 0,
    grouping: { kind: 'fixed', size: 2 },
  });
  assert.equal(exact.policy.steps[0].targetChars, 99);
  assert.equal(exact.policy.steps[0].keepGroups, 0);
  assert.deepEqual(exact.policy.steps[0].grouping, { kind: 'fixed', size: 2 });
  const defaults = Support.createContextStrategy({
    kind: 'recent',
    fragment: metadata,
    field: 'history',
  });
  // Without an explicit target the strategy falls back to the fragment budget and keeps one
  // protected group.
  assert.equal(defaults.policy.steps[0].targetChars, metadata.maxChars);
  assert.equal(defaults.policy.steps[0].keepGroups, 1);
  assert.throws(
    () =>
      Support.createContextStrategy({
        kind: 'recent',
        fragment: metadata,
        field: 'history',
        selection: { mode: 'fixed', kind: 'compress' },
      }),
    /no matching operation/,
  );
});

test('preview rules require explicit capability and stage qualification and validate source references', () => {
  const tools = [
    {
      id: 'answer',
      jsonSchema: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          status: { type: 'string' },
          secret: { type: 'string' },
        },
      },
      preview: { paths: [['text']], when: { path: ['status'], values: ['done'] } },
    },
    { id: 'tool', jsonSchema: { type: 'object', properties: { text: { type: 'string' } } } },
  ];
  const stages = [
    { id: 'answer', toolIds: ['answer', 'tool'], preview: 'tools' },
    { id: 'review', toolIds: ['answer'] },
    { id: 'plain', preview: 'text' },
  ];
  // Only stages opting into `preview: 'tools'` and declaring the capability get a
  // rule; the text stage contributes just its id, and unqualified tools are skipped.
  assert.deepEqual(Support.createReplyPreviewRules({ tools, stages }), [
    {
      stageId: 'answer',
      toolId: 'answer',
      paths: [['text']],
      when: { path: ['status'], values: ['done'] },
    },
    { stageId: 'plain' },
  ]);
  for (const invalid of [
    { tools, stages: [{ id: 'unknown', toolIds: ['foreign'] }] },
    { tools: [...tools, tools[0]], stages },
    { tools, stages: [...stages, stages[0]] },
    {
      tools: [{ ...tools[0], preview: { paths: [['missing']] } }],
      stages: [stages[0]],
    },
  ])
    assert.throws(() => Support.createReplyPreviewRules(invalid));
  const projected = Support.createReplyPreviewRules({ tools, stages });
  tools[0].preview.paths[0][0] = 'secret';
  // Rules snapshot their paths, so mutating the source declaration after creation cannot
  // widen what the preview exposes.
  assert.deepEqual(projected[0].paths, [['text']]);
});

test('qualified preview schema traversal handles local references, alternatives and arrays without exposing other strings', () => {
  // Paths may cross $defs/$ref, anyOf and array items, with `*` denoting every element.
  const jsonSchema = {
    $defs: {
      reply: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          bubbles: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    type: 'object',
    properties: {
      next: { anyOf: [{ type: 'object', properties: { reply: { $ref: '#/$defs/reply' } } }] },
    },
  };
  const rules = Support.createReplyPreviewRules({
    tools: [
      { id: 'answer', jsonSchema, preview: { paths: [['next', 'reply', 'bubbles', '*']] } },
    ],
    stages: [{ id: 'reply', toolIds: ['answer'], preview: 'tools' }],
  });
  assert.deepEqual(rules[0].paths, [['next', 'reply', 'bubbles', '*']]);
});

/*
 * Compaction contract for the context processing pipeline: what may be summarized,
 * what must stay verbatim, and when reduction may or may not run.
 *
 * The fixture history and plan are shaped like a real Banker session, where a
 * later user correction overrides older goals, so trimming and compression must
 * keep the recent turns and every explicit correction intact while dropping old
 * bulk. Budgets are enforced twice: the character budget in `maxInputChars` and a
 * token budget supplied through a deterministic counter stub.
 *
 * Runs on `dist/esm`; the provider records the messages it receives and never
 * leaves the process.
 */
import { contextRunner } from './context-workflow.fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ModelRunner,
  Support,
  ModelToolRegistry,
  createDiagnostics,
} from '../dist/esm/index.js';
const fragment = (id, value) => ({
  id,
  value,
  sourceId: 'test',
  role: 'user',
  trust: 'user',
  lifetime: 'turn',
  maxChars: 20000,
});
const message = (role, content) => ({ role, content });
// Two large old turns, then a correction and an unconfirmed action, then an
// unfinished user turn: only the first two may ever be summarized away.
const history = () => [
  message('user', '旧目标与背景。'.repeat(60)),
  message('assistant', '旧分析。'.repeat(60)),
  message('user', '更正：额度80万；期限12个月，未经确认不要提交。'),
  message('assistant', '已记下更正，尚未提交。'),
  message('assistant', '还需要核实收入。'),
  message('user', '继续刚才的待办。'),
];
const plan = () => ({
  fragments: [
    fragment('request', { message: '继续处理' }),
    fragment('history', { history: history() }),
  ],
  maxInputChars: 500,
});
const recent = { field: 'history', keepGroups: 2, grouping: { kind: 'user-turn' } };
const compression = {
  id: 'compact',
  kind: 'compress',
  fragmentId: 'history',
  targetChars: 350,
  handlerId: 'summarize',
  preserve: recent,
};
const trim = { id: 'trim', kind: 'trim', fragmentId: 'history', targetChars: 300, ...recent };
const code = (expected) => (error) => error.issues?.some((item) => item.code === expected);
// A deterministic character counter, not a tokenizer: it keeps token-budget
// assertions stable and charges a fixed 500 units per image.
const units = {
  counterId: 'test-units-not-tokenizer',
  contextWindowTokens: 2000,
  countTokens: ({ messages, functions }) =>
    messages.reduce(
      (sum, item) => sum + item.content.length + (item.images?.length ?? 0) * 500,
      0,
    ) + (functions ? JSON.stringify(functions).length : 0),
};
function runner(policy, { compressors = [], tokenBudget, transports, extraPorts = {} } = {}) {
  const sent = [];
  const events = [];
  const diagnostics = createDiagnostics({
    output: { write: (fact) => events.push({ event: fact.type, payload: fact.payload }) },
  });
  const model = contextRunner({
    provider: {
      async *stream(messages) {
        sent.push(messages);
        yield 'reply';
      },
    },
    maxCalls: 5,
    callTimeoutMs: 1000,
    execution: { ...{ signal: new AbortController().signal }, diagnostics: diagnostics },
    maxInputChars: 20000,
    tokenBudget,
    ...extraPorts,
    transports: transports ?? [Support.createTextTransport({ id: 'text' })],
    contextPolicy: policy,
    contextCompressors: compressors,
  });
  return { model, sent, events };
}
const localSummary = {
  id: 'summarize',
  maxCalls: 0,
  async compress() {
    return { history: [message('user', '旧对话摘要：继续整理资料；此前结论尚待核实。')] };
  },
};

test('user-turn trimming keeps multiple assistant messages and an unfinished user turn intact', async () => {
  const input = plan();
  const copy = structuredClone(input);
  const { model, sent } = runner({ mode: 'reduce', steps: [trim] });
  (await model.invoke({ stageId: 'reply', input: input, maxOutputTokens: 20, transport: 'text' }))
    .value;
  assert.deepEqual(JSON.parse(sent[0][1].content).history, history().slice(2));
  assert.deepEqual(input, copy);
});
test('compression only receives old turns; Banker corrections, numbers and pending actions remain verbatim', async () => {
  let received;
  const input = plan();
  const compressor = {
    ...localSummary,
    async compress(call) {
      received = call;
      return localSummary.compress(call);
    },
  };
  const { model, sent } = runner(
    { mode: 'reduce', steps: [compression] },
    { compressors: [compressor] },
  );
  (await model.invoke({ stageId: 'reply', input: input, maxOutputTokens: 20, transport: 'text' }))
    .value;
  assert.deepEqual(received.fragment.value.history, history().slice(0, 2));
  assert.ok(received.targetChars < compression.targetChars);
  const result = JSON.parse(sent[0][1].content).history;
  assert.deepEqual(result.slice(1), history().slice(2));
  assert.equal(result[1].content, '更正：额度80万；期限12个月，未经确认不要提交。');
});
test('Jangts recent navigation correction survives a second compaction with an older summary', async () => {
  const input = plan();
  input.fragments[1].value.history = [
    message('user', '上次摘要：用户曾在音乐栏目找文章。'.repeat(50)),
    message('user', '纠正：我现在在作品里的文字页，继续阅读这篇。'),
    message('assistant', '保持在文字页继续阅读。'),
  ];
  const step = { ...compression, preserve: { ...recent, keepGroups: 1 } };
  const { model, sent } = runner(
    { mode: 'reduce', steps: [step] },
    { compressors: [localSummary] },
  );
  (await model.invoke({ stageId: 'reply', input: input, maxOutputTokens: 20, transport: 'text' }))
    .value;
  assert.deepEqual(
    JSON.parse(sent[0][1].content).history.slice(-2),
    input.fragments[1].value.history.slice(-2),
  );
});
test('an irreducible recent tail is rejected without sending it to the summarizer or dropping it', async () => {
  const input = plan();
  input.fragments[1].value.history = history().slice(2);
  // A budget smaller than the protected tail: the step must fail rather than send
  // the protected turns to the summarizer or drop them.
  input.maxInputChars = 40;
  const { model, sent } = runner(
    { mode: 'reduce', steps: [compression] },
    {
      compressors: [
        {
          ...localSummary,
          compress() {
            throw new Error('must preserve');
          },
        },
      ],
    },
  );
  await assert.rejects(
    model.invoke({ stageId: 'reply', input: input, maxOutputTokens: 20, transport: 'text' }),
    code('CONTEXT_BUDGET'),
  );
  assert.equal(sent.length, 0);
});
test('summary output cannot overwrite adjacent metadata or return a string in place of retained history', async () => {
  const input = plan();
  input.fragments[1].value.topic = 'original topic';
  for (const result of [
    { history: 'lossy string', topic: 'original topic' },
    { history: [], topic: 'changed' },
  ]) {
    const { model, sent } = runner(
      { mode: 'reduce', steps: [compression] },
      {
        compressors: [
          {
            ...localSummary,
            async compress() {
              return result;
            },
          },
        ],
      },
    );
    await assert.rejects(
      model.invoke({ stageId: 'reply', input: input, maxOutputTokens: 20, transport: 'text' }),
      code('CONTEXT_POLICY'),
    );
    assert.equal(sent.length, 0);
  }
});
test('user-turn boundaries reject orphan assistant or tool messages rather than split protocols', async () => {
  for (const first of [
    message('assistant', 'orphan'),
    { role: 'tool', content: 'unpaired result' },
  ]) {
    const input = plan();
    input.fragments[1].value.history.unshift(first);
    await assert.rejects(
      runner({ mode: 'reduce', steps: [trim] }).model.invoke({
        stageId: 'reply',
        input: input,
        maxOutputTokens: 20,
        transport: 'text',
      }),
      code('CONTEXT_POLICY'),
    );
  }
});
test('trigger and target watermarks avoid premature work, then reclaim a full buffer after activation', async () => {
  const entries = ['a'.repeat(80), 'b'.repeat(80), 'q', 'a'];
  const make = () => [
    fragment('first', { first: entries }),
    fragment('second', { second: entries }),
  ];
  const fragments = make();
  const reduced = (first, second) => [fragment('first', { first }), fragment('second', { second })];
  const measure = (values) => Support.assembleFragments(values, 20000).inputChars;
  const afterOne = measure(reduced(entries.slice(2), entries));
  const afterBoth = measure(reduced(entries.slice(2), entries.slice(2)));
  // `triggerChars` sits just above the size after reducing only the first fragment,
  // and `targetInputChars` equals the size after reducing both: one step must run,
  // then the policy stops instead of trimming further.
  const policy = {
    mode: 'reduce',
    triggerChars: afterOne + 10,
    targetInputChars: afterBoth,
    steps: [
      {
        id: 'one',
        kind: 'trim',
        fragmentId: 'first',
        field: 'first',
        grouping: { kind: 'fixed', size: 2 },
        keepGroups: 1,
        targetChars: 40,
      },
      {
        id: 'two',
        kind: 'trim',
        fragmentId: 'second',
        field: 'second',
        grouping: { kind: 'fixed', size: 2 },
        keepGroups: 1,
        targetChars: 40,
      },
    ],
  };
  const active = runner(policy);
  (
    await active.model.invoke({
      stageId: 'reply',
      input: { fragments: fragments, maxInputChars: 20000 },
      maxOutputTokens: 20,
      transport: 'text',
    })
  ).value;
  assert.equal(active.model.lastCall.inputChars, afterBoth);
  const inactive = runner(policy);
  (
    await inactive.model.invoke({
      stageId: 'reply',
      input: { fragments: reduced(entries.slice(2), entries), maxInputChars: 20000 },
      maxOutputTokens: 20,
      transport: 'text',
    })
  ).value;
  assert.equal(inactive.model.lastCall.inputChars, afterOne);
});
test('token pressure triggers processing even while the character budget fits', async () => {
  const input = plan();
  input.maxInputChars = 20000;
  const { model, events } = runner(
    { mode: 'reduce', triggerTokens: 450, targetInputTokens: 350, steps: [trim] },
    {
      tokenBudget: { ...units, contextWindowTokens: 600, safetyMarginTokens: 30 },
    },
  );
  (await model.invoke({ stageId: 'reply', input: input, maxOutputTokens: 20, transport: 'text' }))
    .value;
  assert.ok(model.lastCall.inputTokens <= 350);
  assert.equal(model.lastCall.inputTokenLimit, 550);
  const report = events.find(
    (item) => item.event === 'node.progress' && item.payload.payload?.phase === 'processed',
  ).payload.payload.report;
  assert.ok(report.tokens.before > 450);
  assert.ok(report.tokens.after <= 350);
  assert.equal(report.tokens.counterId, units.counterId);
});
test('token preflight includes actual interaction instructions and native function declarations', async () => {
  let counted;
  const tools = new ModelToolRegistry([
    {
      id: 'reply',
      description: 'Reply',
      inputSchema: { jsonSchema: { type: 'object', properties: {} }, parse: (value) => value },
      resolve: (value) => value,
    },
  ]).seal();
  const { model, sent } = runner(undefined, {
    tokenBudget: {
      ...units,
      contextWindowTokens: 100,
      countTokens: (input) => {
        counted = input;
        return units.countTokens(input);
      },
    },
    transports: [Support.createModelTransport({ id: 'native', tools })],
    extraPorts: { maxSchemaChars: 10000 },
  });
  await assert.rejects(
    model.invoke({
      stageId: 'reply',
      input: [message('user', 'hi')],
      maxOutputTokens: 20,
      transport: 'native',
    }),
    code('MODEL_TOKEN_BUDGET'),
  );
  assert.ok(counted.functions.length > 0);
  assert.match(counted.messages[0].content, /registered capability/);
  assert.equal(model.callCount, 0);
  assert.equal(sent.length, 0);
});
test('protected images are counted through the counter and cannot be dropped to satisfy a budget', async () => {
  const input = plan();
  input.additionalMessages = [
    { role: 'user', content: '原件', images: [{ url: 'data:image/png;base64,test' }] },
  ];
  const { model, sent } = runner(
    { mode: 'reduce', steps: [trim] },
    { tokenBudget: { ...units, contextWindowTokens: 550 } },
  );
  await assert.rejects(
    model.invoke({ stageId: 'reply', input: input, maxOutputTokens: 20, transport: 'text' }),
    code('MODEL_TOKEN_BUDGET'),
  );
  assert.equal(sent.length, 0);
  assert.equal(input.additionalMessages[0].images.length, 1);
});
test('invalid counters, missing measurement and conflicting watermarks fail before model calls', async () => {
  for (const invalid of [NaN, -1, 1.5]) {
    const { model, sent } = runner(undefined, {
      tokenBudget: { ...units, countTokens: () => invalid },
    });
    await assert.rejects(
      model.invoke({
        stageId: 'reply',
        input: [message('user', 'hi')],
        maxOutputTokens: 20,
        transport: 'text',
      }),
      code('MODEL_TOKEN_BUDGET'),
    );
    assert.equal(sent.length, 0);
  }
  const missing = runner({ mode: 'reduce', triggerTokens: 100, steps: [] });
  await assert.rejects(
    missing.model.invoke({
      stageId: 'reply',
      input: plan(),
      maxOutputTokens: 20,
      transport: 'text',
    }),
    code('CONTEXT_POLICY'),
  );
  assert.throws(
    () => runner({ mode: 'reduce', triggerChars: 200, targetInputChars: 300, steps: [] }),
    code('CONTEXT_POLICY'),
  );
  const reserved = runner(undefined, {
    tokenBudget: { ...units, contextWindowTokens: 30, safetyMarginTokens: 20 },
  });
  await assert.rejects(
    reserved.model.invoke({
      stageId: 'reply',
      input: [message('user', 'hi')],
      maxOutputTokens: 20,
      transport: 'text',
    }),
    code('MODEL_TOKEN_BUDGET'),
  );
  assert.equal(reserved.sent.length, 0);
});

test('a counting callback cannot rewrite provider text or image inputs', async () => {
  const input = [
    { role: 'user', content: '原文', images: [{ url: 'data:image/png;base64,original' }] },
  ];
  const { model, sent } = runner(undefined, {
    tokenBudget: {
      ...units,
      countTokens({ messages }) {
        messages[0].content = 'changed';
        messages[0].images[0].url = 'changed';
        return 10;
      },
    },
  });
  (await model.invoke({ stageId: 'reply', input: input, maxOutputTokens: 20, transport: 'text' }))
    .value;
  assert.deepEqual(sent[0], input);
  assert.equal(input[0].content, '原文');
  assert.equal(input[0].images[0].url, 'data:image/png;base64,original');
});

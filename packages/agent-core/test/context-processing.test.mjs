/*
 * End-to-end context processing through the App-style fixture runner: from a
 * ContextPlan and a policy to the exact messages the provider receives.
 *
 * The file works as one story. A plan that does not fit is rejected without
 * truncation; a reducing policy trims whole groups and leaves the current request
 * untouched; compression and model-driven selection spend from the same call
 * budget as the reply; audit mode only accepts declared changes; and every report
 * describes what changed without carrying fragment content. Selection modes
 * (fixed, auto, model) are compared for which step they pick and when they must
 * refuse.
 *
 * Runs on `dist/esm` via `contextRunner`, with a fake provider that records the
 * messages it is sent and answers with a fixed string.
 */
import { contextRunner } from './context-workflow.fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ModelRunner, Support, BudgetError } from '../dist/esm/index.js';

const fragment = (id, value, extra = {}) => ({
  id,
  value,
  sourceId: 'test',
  role: 'user',
  trust: 'user',
  lifetime: 'turn',
  maxChars: 10000,
  ...extra,
});
const history = () =>
  fragment('history', {
    history: ['old question'.repeat(30), 'old answer'.repeat(30), 'new question', 'new answer'],
  });
const request = () => fragment('request', { message: 'keep this exact request' });
// 180 characters is below the assembled plan but well above the request fragment,
// so only the history can be reduced.
const plan = () => ({ fragments: [request(), history()], maxInputChars: 180 });
const trim = {
  id: 'window',
  kind: 'trim',
  fragmentId: 'history',
  field: 'history',
  targetChars: 80,
  grouping: { kind: 'fixed', size: 2 },
  keepGroups: 1,
};
const run = (
  policy,
  compressors = [],
  maxCalls = 3,
  control = new AbortController(),
  selectors = [],
) => {
  const sent = [];
  const model = contextRunner({
    provider: {
      async *stream(messages) {
        sent.push(messages);
        yield 'summary';
      },
    },
    maxCalls,
    callTimeoutMs: 1000,
    execution: { signal: control.signal },
    maxInputChars: 2000,
    transports: [Support.createTextTransport({ id: 'text' })],
    contextPolicy: policy,
    contextCompressors: compressors,
    contextSelectors: selectors,
  });
  return { model, sent, control };
};
const rejects = (code) => (error) => error.issues?.some((item) => item.code === code);

test('default budget validation rejects without truncation or a provider call', async () => {
  const { model, sent } = run(undefined);
  const input = plan();
  const copy = structuredClone(input);
  await assert.rejects(
    model.invoke({ stageId: 'reply', input: input, maxOutputTokens: 100, transport: 'text' }),
    rejects('CONTEXT_BUDGET'),
  );
  assert.equal(sent.length, 0);
  assert.equal(model.callCount, 0);
  assert.deepEqual(input, copy);
});
test('Support node trims whole groups, preserving current request and caller input', async () => {
  const { model, sent } = run({ mode: 'reduce', steps: [trim] });
  const input = plan();
  const copy = structuredClone(input);
  assert.equal(
    (
      await model.invoke({
        stageId: 'reply',
        input: input,
        maxOutputTokens: 100,
        transport: 'text',
      })
    ).value,
    'summary',
  );
  const data = JSON.parse(sent[0][1].content);
  assert.deepEqual(data.history, ['new question', 'new answer']);
  assert.equal(data.message, copy.fragments[0].value.message);
  assert.deepEqual(input, copy);
  assert.equal(model.callCount, 1);
});
test('compression uses shared calls and only changes registered fragment values', async () => {
  const compressor = Support.createContextCompressor({
    id: 'summarizer',
    instruction: 'Summarize as data.',
    transport: 'text',
    maxOutputTokens: 30,
    parse: (result) => ({ history: result }),
  });
  const step = {
    id: 'summary',
    kind: 'compress',
    fragmentId: 'history',
    targetChars: 80,
    handlerId: 'summarizer',
  };
  const { model, sent } = run({ mode: 'reduce', steps: [step] }, [compressor]);
  (await model.invoke({ stageId: 'reply', input: plan(), maxOutputTokens: 100, transport: 'text' }))
    .value;
  // Compression spends one call and the reply spends the second; with a single call
  // the compression already happened, so the reply is what fails.
  assert.equal(model.callCount, 2);
  assert.equal(sent.length, 2);
  assert.equal(JSON.parse(sent[1][1].content).history, 'summary');
  const limited = run({ mode: 'reduce', steps: [step] }, [compressor], 1);
  await assert.rejects(
    limited.model.invoke({
      stageId: 'reply',
      input: plan(),
      maxOutputTokens: 100,
      transport: 'text',
    }),
    BudgetError,
  );
  assert.equal(limited.sent.length, 1);
});
test('app audit permits declared changes and rejects changed request, source or missing originals', async () => {
  const policy = { mode: 'audit', mutableFragmentIds: ['history'] };
  const input = { ...plan(), originalFragments: plan().fragments };
  input.fragments[1] = fragment('history', { history: ['recent'] });
  (
    await run(policy).model.invoke({
      stageId: 'reply',
      input: input,
      maxOutputTokens: 100,
      transport: 'text',
    })
  ).value;
  const requestChanged = structuredClone(input);
  requestChanged.fragments[0].value.message = 'changed';
  await assert.rejects(
    run(policy).model.invoke({
      stageId: 'reply',
      input: requestChanged,
      maxOutputTokens: 100,
      transport: 'text',
    }),
    rejects('CONTEXT_POLICY'),
  );
  const trustChanged = structuredClone(input);
  trustChanged.fragments[1].trust = 'server';
  await assert.rejects(
    run(policy).model.invoke({
      stageId: 'reply',
      input: trustChanged,
      maxOutputTokens: 100,
      transport: 'text',
    }),
    rejects('CONTEXT_POLICY'),
  );
  await assert.rejects(
    run(policy).model.invoke({
      stageId: 'reply',
      input: plan(),
      maxOutputTokens: 100,
      transport: 'text',
    }),
    rejects('CONTEXT_POLICY'),
  );
});
test('App context Workflow requires the declared plan rather than bypassing its nodes', async () => {
  await assert.rejects(
    run({ mode: 'reduce', steps: [trim] }).model.invoke({
      stageId: 'reply',
      input: [{ role: 'user', content: 'hi' }],
      maxOutputTokens: 100,
      transport: 'text',
    }),
    rejects('CONTEXT_POLICY'),
  );
});
test('fragment budget triggers reduction even when total fits', async () => {
  const input = plan();
  // The total budget is generous, but this fragment's own `maxChars` of 100 is
  // exceeded, which alone must trigger the trim.
  input.maxInputChars = 2000;
  input.fragments[1].maxChars = 100;
  const { model, sent } = run({ mode: 'reduce', steps: [trim] });
  (await model.invoke({ stageId: 'reply', input: input, maxOutputTokens: 100, transport: 'text' }))
    .value;
  assert.equal(JSON.parse(sent[0][1].content).history.length, 2);
});
test('cancelled compressor is abandoned even if its handler ignores the signal', async () => {
  const control = new AbortController();
  const step = {
    id: 'summary',
    kind: 'compress',
    fragmentId: 'history',
    targetChars: 80,
    handlerId: 'hung',
  };
  const { model, sent } = run(
    { mode: 'reduce', steps: [step] },
    [
      {
        id: 'hung',
        compress() {
          control.abort(new Error('cancelled'));
          return new Promise(() => {});
        },
      },
    ],
    3,
    control,
  );
  await assert.rejects(
    model.invoke({ stageId: 'reply', input: plan(), maxOutputTokens: 100, transport: 'text' }),
    /cancelled/,
  );
  assert.equal(sent.length, 0);
});
test('remaining oversize context and malformed groups fail without provider calls', async () => {
  const shortfall = run({ mode: 'reduce', steps: [{ ...trim, keepGroups: 2 }] });
  await assert.rejects(
    shortfall.model.invoke({
      stageId: 'reply',
      input: plan(),
      maxOutputTokens: 100,
      transport: 'text',
    }),
    rejects('CONTEXT_BUDGET'),
  );
  assert.equal(shortfall.sent.length, 0);
  const input = plan();
  input.fragments[1].value.history.pop();
  await assert.rejects(
    run({ mode: 'reduce', steps: [trim] }).model.invoke({
      stageId: 'reply',
      input: input,
      maxOutputTokens: 100,
      transport: 'text',
    }),
    rejects('CONTEXT_POLICY'),
  );
});
test('configuration rejects duplicate steps, missing compressors and protected targets', async () => {
  assert.throws(() => run({ mode: 'reduce', steps: [trim, trim] }), rejects('CONTEXT_POLICY'));
  assert.throws(
    () =>
      run({
        mode: 'reduce',
        steps: [
          {
            id: 'x',
            kind: 'compress',
            fragmentId: 'history',
            targetChars: 80,
            handlerId: 'absent',
          },
        ],
      }),
    rejects('CONTEXT_POLICY'),
  );
  const input = plan();
  input.fragments.unshift(
    fragment('instructions', 'private instruction', { role: 'system', trust: 'instruction' }),
  );
  await assert.rejects(
    run({ mode: 'reduce', steps: [{ ...trim, fragmentId: 'instructions' }] }).model.invoke({
      stageId: 'reply',
      input: input,
      maxOutputTokens: 100,
      transport: 'text',
    }),
    rejects('CONTEXT_POLICY'),
  );
});
test('Support plan defers budgets; processing reports contain metadata only', async () => {
  const builder = Support.defineContextFragments([{ ...history(), format: () => history().value }]);
  const input = builder.plan({ input: {}, maxInputChars: 100 });
  const { context, report } = await Support.processContext(
    input,
    { mode: 'reduce', steps: [trim] },
    {
      stageId: 'reply',
      signal: new AbortController().signal,
      compressors: [],
      callModel() {
        throw new Error('unused');
      },
    },
  );
  assert.ok(context.inputChars <= 100);
  assert.equal(report.changes[0].kind, 'trim');
  // Reports describe the change, never the content that was reduced.
  assert.equal(JSON.stringify(report).includes('question'), false);
});

test('protected image messages survive processing and their text consumes budget', async () => {
  const input = {
    ...plan(),
    additionalMessages: [
      { role: 'user', content: 'image attached', images: [{ url: 'data:image/png;base64,test' }] },
    ],
  };
  const { model, sent } = run({ mode: 'reduce', steps: [trim] });
  (await model.invoke({ stageId: 'reply', input: input, maxOutputTokens: 100, transport: 'text' }))
    .value;
  assert.deepEqual(sent[0].at(-1), input.additionalMessages[0]);
  const tooLarge = { ...input, additionalMessages: [{ role: 'user', content: 'x'.repeat(200) }] };
  await assert.rejects(
    run({ mode: 'reduce', steps: [trim] }).model.invoke({
      stageId: 'reply',
      input: tooLarge,
      maxOutputTokens: 100,
      transport: 'text',
    }),
    rejects('CONTEXT_BUDGET'),
  );
});
test('reduction failures and illegal compressor output never reach reply provider', async () => {
  const step = {
    id: 'summary',
    kind: 'compress',
    fragmentId: 'history',
    targetChars: 80,
    handlerId: 'bad',
  };
  const error = new Error('summary failed');
  const failed = run({ mode: 'reduce', steps: [step] }, [
    {
      id: 'bad',
      async compress() {
        throw error;
      },
    },
  ]);
  await assert.rejects(
    failed.model.invoke({
      stageId: 'reply',
      input: plan(),
      maxOutputTokens: 100,
      transport: 'text',
    }),
    (item) => item === error,
  );
  assert.equal(failed.sent.length, 0);
  const illegal = run({ mode: 'reduce', steps: [step] }, [
    {
      id: 'bad',
      async compress() {
        return { injected: 'new field' };
      },
    },
  ]);
  await assert.rejects(
    illegal.model.invoke({
      stageId: 'reply',
      input: plan(),
      maxOutputTokens: 100,
      transport: 'text',
    }),
    rejects('CONTEXT_POLICY'),
  );
});

test('class-based compressors retain their receiver', async () => {
  class Compressor {
    id = 'class';
    value = 'class summary';
    async compress() {
      return { history: this.value };
    }
  }
  const step = {
    id: 'summary',
    kind: 'compress',
    fragmentId: 'history',
    targetChars: 80,
    handlerId: 'class',
  };
  const { model, sent } = run({ mode: 'reduce', steps: [step] }, [new Compressor()]);
  (await model.invoke({ stageId: 'reply', input: plan(), maxOutputTokens: 100, transport: 'text' }))
    .value;
  assert.equal(JSON.parse(sent[0][1].content).history, 'class summary');
});
test('preparation timeout rejects a stalled compressor without a model call', async () => {
  const step = {
    id: 'summary',
    kind: 'compress',
    fragmentId: 'history',
    targetChars: 80,
    handlerId: 'stalled',
  };
  const model = contextRunner({
    provider: {
      async *stream() {
        throw new Error('must not call provider');
      },
    },
    maxCalls: 3,
    callTimeoutMs: 10,
    execution: { signal: new AbortController().signal },
    maxInputChars: 2000,
    transports: [Support.createTextTransport({ id: 'text' })],
    contextPolicy: { mode: 'reduce', steps: [step] },
    contextCompressors: [{ id: 'stalled', compress: () => new Promise(() => {}) }],
  });
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    await assert.rejects(
      model.invoke({ stageId: 'reply', input: plan(), maxOutputTokens: 100, transport: 'text' }),
      { name: 'TimeoutError' },
    );
  } finally {
    clearTimeout(keepAlive);
  }
  assert.equal(model.callCount, 0);
});

const summaryStep = {
  id: 'summary',
  kind: 'compress',
  fragmentId: 'history',
  targetChars: 80,
  handlerId: 'summarizer',
};
const localCompressor = {
  id: 'summarizer',
  maxCalls: 0,
  async compress() {
    return { history: 'preserved summary' };
  },
};
const selectingPolicy = (selection) => ({ mode: 'reduce', selection, steps: [trim, summaryStep] });

test('fixed operation selects the configured kind regardless of step ordering', async () => {
  const policy = {
    ...selectingPolicy({ mode: 'fixed', kind: 'trim' }),
    steps: [summaryStep, trim],
  };
  const { model, sent } = run(policy, [
    {
      ...localCompressor,
      compress() {
        throw new Error('must not compress');
      },
    },
  ]);
  (await model.invoke({ stageId: 'reply', input: plan(), maxOutputTokens: 100, transport: 'text' }))
    .value;
  assert.deepEqual(JSON.parse(sent[0][1].content).history, ['new question', 'new answer']);
});
test('automatic selection compresses high-loss history and trims within the configured loss bound', async () => {
  const compressed = run(selectingPolicy({ mode: 'auto' }), [localCompressor]);
  (
    await compressed.model.invoke({
      stageId: 'reply',
      input: plan(),
      maxOutputTokens: 100,
      transport: 'text',
    })
  ).value;
  assert.equal(JSON.parse(compressed.sent[0][1].content).history, 'preserved summary');
  // Allowing a full trim loss makes trimming the cheaper option, so the same policy
  // now trims where the default chose compression.
  const trimmed = run(selectingPolicy({ mode: 'auto', maxTrimLossRatio: 1 }), [localCompressor]);
  (
    await trimmed.model.invoke({
      stageId: 'reply',
      input: plan(),
      maxOutputTokens: 100,
      transport: 'text',
    })
  ).value;
  assert.equal(JSON.parse(trimmed.sent[0][1].content).history.length, 2);
});
test('auto filters unaffordable compression, reserves reply calls and never silently exceeds the loss bound', async () => {
  const paid = {
    ...localCompressor,
    maxCalls: 1,
    compress() {
      throw new Error('must not compress');
    },
  };
  const trimmed = run(selectingPolicy({ mode: 'auto', maxTrimLossRatio: 1 }), [paid], 1);
  (
    await trimmed.model.invoke({
      stageId: 'reply',
      input: plan(),
      maxOutputTokens: 100,
      transport: 'text',
    })
  ).value;
  assert.equal(trimmed.model.callCount, 1);
  const refused = run(selectingPolicy({ mode: 'auto' }), [paid], 1);
  await assert.rejects(
    refused.model.invoke({
      stageId: 'reply',
      input: plan(),
      maxOutputTokens: 100,
      transport: 'text',
    }),
    rejects('CONTEXT_BUDGET'),
  );
  assert.equal(refused.sent.length, 0);
});
test('model selection and compression consume the same budget while preserving the reply call', async () => {
  const selector = Support.createContextSelector({
    id: 'chooser',
    instruction: 'Choose registered step IDs.',
    transport: 'text',
    maxOutputTokens: 50,
    parse: () => ['summary'],
  });
  const compressor = Support.createContextCompressor({
    id: 'summarizer',
    instruction: 'Summarize data.',
    transport: 'text',
    maxOutputTokens: 50,
    parse: (value) => ({ history: value }),
  });
  const { model, sent } = run(
    selectingPolicy({ mode: 'model', handlerId: 'chooser' }),
    [compressor],
    3,
    new AbortController(),
    [selector],
  );
  (await model.invoke({ stageId: 'reply', input: plan(), maxOutputTokens: 100, transport: 'text' }))
    .value;
  assert.equal(model.callCount, 3);
  assert.equal(sent.length, 3);
  // Selection, compression and reply each consume one call from the same budget;
  // the selector never sees the protected request fragment.
  const selectionData = JSON.parse(sent[0][1].content);
  assert.equal(selectionData.excerpts.length, 0);
  assert.equal(JSON.stringify(selectionData).includes('keep this exact request'), false);
  assert.equal(JSON.parse(sent[2][1].content).history, 'summary');
});
test('model selector rejects foreign, repeated and cumulatively unaffordable steps', async () => {
  for (const ids of [['foreign'], ['window', 'window']]) {
    const { model, sent } = run(
      selectingPolicy({ mode: 'model', handlerId: 'chooser' }),
      [localCompressor],
      3,
      new AbortController(),
      [
        {
          id: 'chooser',
          maxCalls: 0,
          async select() {
            return ids;
          },
        },
      ],
    );
    await assert.rejects(
      model.invoke({ stageId: 'reply', input: plan(), maxOutputTokens: 100, transport: 'text' }),
      rejects('CONTEXT_POLICY'),
    );
    assert.equal(sent.length, 0);
  }
  const policy = {
    mode: 'reduce',
    selection: { mode: 'model', handlerId: 'chooser' },
    steps: [summaryStep, { ...summaryStep, id: 'another' }],
  };
  const { model, sent } = run(
    policy,
    [{ ...localCompressor, maxCalls: 1 }],
    2,
    new AbortController(),
    [
      {
        id: 'chooser',
        maxCalls: 0,
        async select() {
          return ['summary', 'another'];
        },
      },
    ],
  );
  await assert.rejects(
    model.invoke({ stageId: 'reply', input: plan(), maxOutputTokens: 100, transport: 'text' }),
    rejects('CONTEXT_POLICY'),
  );
  assert.equal(sent.length, 0);
});
test('selectors and compressors cannot spend calls reserved for the reply or exceed declared ceilings', async () => {
  const selector = {
    id: 'chooser',
    maxCalls: 0,
    async select(call) {
      await call.callModel({
        stageId: 'illegal',
        input: [{ role: 'user', content: 'choose' }],
        maxOutputTokens: 50,
        transport: 'text',
      });
      return ['window'];
    },
  };
  const selected = run(
    selectingPolicy({ mode: 'model', handlerId: 'chooser' }),
    [localCompressor],
    2,
    new AbortController(),
    [selector],
  );
  await assert.rejects(
    selected.model.invoke({
      stageId: 'reply',
      input: plan(),
      maxOutputTokens: 100,
      transport: 'text',
    }),
    BudgetError,
  );
  assert.equal(selected.sent.length, 0);
  const compressor = {
    ...localCompressor,
    maxCalls: 1,
    async compress(call) {
      await call.callModel({
        stageId: 'summary1',
        input: [{ role: 'user', content: 'summarize' }],
        maxOutputTokens: 50,
        transport: 'text',
      });
      await call.callModel({
        stageId: 'summary2',
        input: [{ role: 'user', content: 'again' }],
        maxOutputTokens: 50,
        transport: 'text',
      });
      return { history: 'summary' };
    },
  };
  const compressed = run(selectingPolicy({ mode: 'auto' }), [compressor], 3);
  await assert.rejects(
    compressed.model.invoke({
      stageId: 'reply',
      input: plan(),
      maxOutputTokens: 100,
      transport: 'text',
    }),
    BudgetError,
  );
  assert.equal(compressed.sent.length, 1);
});
test('below-threshold context never invokes a selector and invalid selection configuration is rejected', async () => {
  const { model } = run(
    selectingPolicy({ mode: 'model', handlerId: 'chooser' }),
    [localCompressor],
    3,
    new AbortController(),
    [
      {
        id: 'chooser',
        select() {
          throw new Error('must not select');
        },
      },
    ],
  );
  const input = plan();
  input.maxInputChars = 3000;
  (await model.invoke({ stageId: 'reply', input: input, maxOutputTokens: 100, transport: 'text' }))
    .value;
  assert.equal(model.callCount, 1);
  for (const selection of [
    { mode: 'auto', maxTrimLossRatio: -1 },
    { mode: 'auto', reserveCalls: 0 },
    { mode: 'fixed', kind: 'unknown' },
    { mode: 'model', handlerId: 'missing' },
  ])
    assert.throws(
      () => run(selectingPolicy(selection), [localCompressor]),
      rejects('CONTEXT_POLICY'),
    );
});
test('automatic selection recomputes candidates after each change and reports decisions without content', async () => {
  const input = plan();
  input.fragments.push(fragment('more', { history: history().value.history }));
  const policy = {
    mode: 'reduce',
    selection: { mode: 'auto' },
    steps: [summaryStep, { ...summaryStep, id: 'more-summary', fragmentId: 'more' }],
  };
  // Different top-level fields avoid assembly collisions.
  input.fragments[2].value = { more: input.fragments[2].value.history };
  const compressor = {
    ...localCompressor,
    async compress(call) {
      return Object.fromEntries(Object.keys(call.fragment.value).map((key) => [key, 'summary']));
    },
  };
  const { context, report } = await Support.processContext(input, policy, {
    stageId: 'reply',
    signal: new AbortController().signal,
    compressors: [compressor],
    callModel() {
      throw new Error('unused');
    },
    remainingCalls: () => 1,
  });
  assert.equal(report.decisions.length, 2);
  assert.equal(report.changes.length, 2);
  assert.ok(context.inputChars <= input.maxInputChars);
  assert.equal(JSON.stringify(report).includes('old question'), false);
});

test('default auto threshold chooses a small-loss trim without invoking compression', async () => {
  const input = plan();
  const entries = ['old', 'ok', 'recent question'.repeat(20), 'recent answer'.repeat(20)];
  const targetChars = JSON.stringify({ history: entries.slice(2) }).length;
  input.fragments[1] = fragment('history', { history: entries }, { maxChars: targetChars });
  input.maxInputChars = 2000;
  const policy = {
    mode: 'reduce',
    selection: { mode: 'auto' },
    steps: [{ ...trim, targetChars }, summaryStep],
  };
  const { model, sent } = run(policy, [
    {
      ...localCompressor,
      compress() {
        throw new Error('must trim');
      },
    },
  ]);
  (await model.invoke({ stageId: 'reply', input: input, maxOutputTokens: 100, transport: 'text' }))
    .value;
  assert.deepEqual(JSON.parse(sent[0][1].content).history, entries.slice(2));
});
test('model selection excerpts obey a total cap and exclude protected request fragments', async () => {
  const chooser = Support.createContextSelector({
    id: 'chooser',
    instruction: 'Choose.',
    transport: 'text',
    maxOutputTokens: 50,
    maxExcerptChars: 16,
    parse: () => ['summary'],
  });
  const { model, sent } = run(
    selectingPolicy({ mode: 'model', handlerId: 'chooser' }),
    [localCompressor],
    3,
    new AbortController(),
    [chooser],
  );
  (await model.invoke({ stageId: 'reply', input: plan(), maxOutputTokens: 100, transport: 'text' }))
    .value;
  const data = JSON.parse(sent[0][1].content);
  // `maxExcerptChars: 16` is a total cap across all excerpts, not a per-excerpt limit.
  assert.equal(
    data.excerpts.reduce((sum, item) => sum + item.excerpt.length, 0),
    16,
  );
  assert.ok(data.excerpts.every((item) => item.fragmentId === 'history'));
  assert.equal(JSON.stringify(data).includes('keep this exact request'), false);
});
test('a stalled selector is cancelled and a selector requiring reserved budget is never invoked', async () => {
  const control = new AbortController();
  const stalled = run(
    selectingPolicy({ mode: 'model', handlerId: 'chooser' }),
    [localCompressor],
    3,
    control,
    [
      {
        id: 'chooser',
        select() {
          control.abort(new Error('selection cancelled'));
          return new Promise(() => {});
        },
      },
    ],
  );
  await assert.rejects(
    stalled.model.invoke({
      stageId: 'reply',
      input: plan(),
      maxOutputTokens: 100,
      transport: 'text',
    }),
    /selection cancelled/,
  );
  assert.equal(stalled.sent.length, 0);
  const limited = run(
    selectingPolicy({ mode: 'model', handlerId: 'chooser' }),
    [localCompressor],
    1,
    new AbortController(),
    [
      {
        id: 'chooser',
        select() {
          throw new Error('must not select');
        },
      },
    ],
  );
  await assert.rejects(
    limited.model.invoke({
      stageId: 'reply',
      input: plan(),
      maxOutputTokens: 100,
      transport: 'text',
    }),
    BudgetError,
  );
  assert.equal(limited.model.callCount, 0);
});

test('multiple automatic trim candidates cannot bypass the cumulative per-fragment loss bound', async () => {
  const input = plan();
  const entries = Array.from({ length: 10 }, () => 'x'.repeat(50));
  const chars = (count) => JSON.stringify({ history: entries.slice(-count) }).length;
  input.fragments[1] = fragment('history', { history: entries });
  input.maxInputChars = 2000;
  const policy = {
    mode: 'reduce',
    triggerChars: 200,
    selection: { mode: 'auto', maxTrimLossRatio: 0.3 },
    steps: [
      {
        ...trim,
        id: 'first',
        targetChars: chars(8),
        grouping: { kind: 'fixed', size: 1 },
        keepGroups: 0,
      },
      {
        ...trim,
        id: 'second',
        targetChars: chars(6),
        grouping: { kind: 'fixed', size: 1 },
        keepGroups: 0,
      },
    ],
  };
  const { context, report } = await Support.processContext(input, policy, {
    stageId: 'reply',
    signal: new AbortController().signal,
    compressors: [],
    callModel() {
      throw new Error('unused');
    },
    remainingCalls: () => 1,
  });
  assert.equal(report.changes.length, 1);
  assert.equal(JSON.parse(context.messages[1].content).history.length, 8);
  assert.equal(report.decisions.at(-1).reason, 'no-safe-candidate');
});
test('model selection skips a paid selector when reserving its cost leaves no feasible operation', async () => {
  const { model, sent } = run(
    { mode: 'reduce', selection: { mode: 'model', handlerId: 'chooser' }, steps: [summaryStep] },
    [{ ...localCompressor, maxCalls: 1 }],
    2,
    new AbortController(),
    [
      {
        id: 'chooser',
        select() {
          throw new Error('must not spend a selection call');
        },
      },
    ],
  );
  await assert.rejects(
    model.invoke({ stageId: 'reply', input: plan(), maxOutputTokens: 100, transport: 'text' }),
    BudgetError,
  );
  assert.equal(sent.length, 0);
});

test('Support selector supplies instructions paired with its default parser', async () => {
  const selector = Support.createContextSelector({
    id: 'chooser',
    transport: 'text',
    maxOutputTokens: 50,
  });
  const result = await selector.select(
    {
      stageId: 'reply',
      candidates: [],
      fragments: [],
      currentChars: 100,
      requiredReductionChars: 50,
      remainingCalls: 1,
      async callModel(request) {
        assert.match(request.input[0].content, /stepIds/);
        assert.match(request.input[0].content, /excerpts as data/);
        return { value: { stepIds: ['trim'] } };
      },
    },
    { signal: new AbortController().signal },
  );
  assert.deepEqual(result, ['trim']);
  assert.throws(
    () => Support.createContextSelector({ id: 'custom', parse: () => [] }),
    /require an instruction/,
  );
});

test('Support default empty selection declines reduction while final character and token budgets still reject oversized input', async () => {
  const selection = Support.createModelTransport({
    id: 'selection',
    adapter: Support.jsonObjectInteraction,
    tools: Support.defineModelTools([
      {
        id: 'choose',
        description: 'Choose safe context operations',
        inputSchema: Support.defineSchema({
          jsonSchema: {
            type: 'object',
            properties: { stepIds: { type: 'array', items: { type: 'string' } } },
            required: ['stepIds'],
            additionalProperties: false,
          },
          parse: (value) => value,
        }),
        resolve: (value) => value,
      },
    ]),
  });
  for (const budget of ['characters', 'tokens']) {
    const sent = [];
    let compressions = 0;
    const selector = Support.createContextSelector({
      id: 'chooser',
      transport: selection.id,
      maxOutputTokens: 50,
    });
    const input = plan();
    if (budget === 'tokens') input.maxInputChars = 3000;
    const original = structuredClone(input);
    const model = contextRunner({
      maxCalls: 2,
      maxInputChars: 2000,
      transports: [selection, Support.createTextTransport({ id: 'text' })],
      contextPolicy: selectingPolicy({ mode: 'model', handlerId: 'chooser' }),
      contextSelectors: [selector],
      contextCompressors: [
        {
          ...localCompressor,
          async compress() {
            compressions++;
            return { history: 'summary' };
          },
        },
      ],
      ...(budget === 'tokens'
        ? {
            tokenBudget: {
              counterId: 'fixture',
              contextWindowTokens: 2000,
              countTokens: ({ messages }) =>
                messages.some((message) => message.content.includes('old question')) ? 1950 : 10,
            },
          }
        : {}),
      provider: {
        async *stream(messages) {
          sent.push(messages);
          assert.equal(sent.length, 1, 'Oversized reply input must not reach the provider');
          assert.match(messages[0].content, /empty array if no selection is suitable/);
          assert.ok(JSON.parse(messages[1].content).candidates.length > 0);
          yield '{"name":"choose","input":{"stepIds":[]}}';
        },
      },
    });
    await assert.rejects(
      model.invoke({ stageId: 'reply', input, maxOutputTokens: 100, transport: 'text' }),
      rejects(budget === 'tokens' ? 'MODEL_TOKEN_BUDGET' : 'CONTEXT_BUDGET'),
    );
    assert.equal(compressions, 0);
    assert.equal(sent.length, 1);
    assert.equal(model.callCount, 1, 'Only the accepted selector call consumes budget');
    assert.deepEqual(input, original);
  }
});

test('nested context calls reject invalid output token limits before reaching the provider', async () => {
  const compressor = {
    id: 'summarizer',
    async compress(call) {
      await call.callModel({
        stageId: 'summary',
        input: [],
        maxOutputTokens: 0,
        transport: 'text',
      });
      return { history: 'summary' };
    },
  };
  const { model, sent } = run({ mode: 'reduce', steps: [summaryStep] }, [compressor]);
  await assert.rejects(
    model.invoke({ stageId: 'reply', input: plan(), transport: 'text' }),
    /maxOutputTokens must be a positive safe integer/,
  );
  assert.equal(sent.length, 0);
  assert.equal(model.callCount, 0);
});

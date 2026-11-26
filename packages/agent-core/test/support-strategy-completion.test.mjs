/**
 * Locks down Support strategy composition: plan/build keeping Core plan fields and image
 * budgets, multi-fragment history strategies with model selection and watermarks, model
 * strategy presets and reasoning overrides, setting pass-through, and history presets. Runs
 * under node --test with in-memory definitions and a fixture provider.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ModelRunner, Support } from '../dist/esm/index.js';

const provider = {
  async *stream() {
    yield 'ready';
  },
};
const metadata = {
  id: 'history',
  sourceId: 'chat',
  role: 'user',
  trust: 'user',
  lifetime: 'turn',
  maxChars: 1000,
};
const definition = {
  ...metadata,
  format: () => ({ messages: [{ role: 'user', content: 'current' }] }),
};

test('Support plan and build preserve all Core plan fields and enforce audit and image budgets', () => {
  const builder = Support.defineContextFragments([definition], { maxInputChars: 1000 });
  const additionalMessages = [
    { role: 'user', content: 'attachment', images: [{ url: 'fixture' }] },
  ];
  const originalFragments = builder.fragments({});
  const mutableFragmentIds = ['history'];
  const request = { input: {}, additionalMessages, originalFragments, mutableFragmentIds };
  const plan = builder.plan(request);
  assert.equal(plan.additionalMessages, additionalMessages);
  assert.equal(plan.mutableFragmentIds, mutableFragmentIds);
  assert.equal(plan.originalFragments, originalFragments);
  const input = builder.build(request);
  assert.deepEqual(input.messages.at(-1), additionalMessages[0]);
  // Attachments are copied into the built input, so the caller's array cannot be mutated
  // through the result.
  assert.notEqual(input.messages.at(-1), additionalMessages[0]);
  // A one-character budget cannot fit the formatted fragment plus attachment.
  assert.throws(() => builder.build({ ...request, maxInputChars: 1 }));
  const edited = Support.defineContextFragments(
    [{ ...definition, format: () => ({ messages: [] }) }],
    { maxInputChars: 1000 },
  );
  assert.throws(() => edited.build({ ...request, mutableFragmentIds: [] }));
  // With the history fragment declared mutable, the edited formatted output is allowed.
  assert.ok(edited.build(request));
});

test('history strategies compose multiple fragments and accept model selection and exact watermarks', () => {
  class Selector {
    id = 'chooser';
    maxCalls = 0;
    #id = 'history.window';
    async select() {
      return [this.#id];
    }
  }
  const selector = new Selector();
  const strategy = Support.createContextStrategy(
    [
      { kind: 'recent', fragment: metadata, field: 'messages', keepGroups: 0 },
      { kind: 'recent', fragment: { id: 'other', maxChars: 500 }, field: 'messages' },
    ],
    {
      selection: { mode: 'model', handlerId: 'chooser', reserveCalls: 1 },
      selectors: [selector],
      triggerChars: 1500,
      targetInputChars: 1000,
      triggerTokens: 500,
      targetInputTokens: 400,
    },
  );
  assert.deepEqual(
    strategy.policy.steps.map((step) => step.id),
    ['history.window', 'other.window'],
  );
  // Step ids are derived from the fragment id, so multiple fragments stay distinguishable.
  assert.equal(strategy.policy.steps[0].keepGroups, 0);
  assert.equal(strategy.policy.targetInputTokens, 400);
  assert.equal(strategy.selectors[0], selector);
  assert.equal(strategy.policy.selection.reserveCalls, 1);
  const exact = [
    {
      id: 'custom',
      kind: 'trim',
      fragmentId: 'history',
      field: 'messages',
      targetChars: 10,
      keepGroups: 0,
      grouping: { kind: 'user-turn' },
    },
  ];
  const override = Support.createContextStrategy({
    kind: 'recent',
    fragment: metadata,
    field: 'messages',
    steps: exact,
    selection: { mode: 'auto', reserveCalls: 1 },
  });
  assert.deepEqual(override.policy.steps, exact);
  assert.throws(() =>
    Support.createContextStrategy({
      kind: 'recent',
      fragment: metadata,
      field: 'messages',
      selection: { mode: 'model', handlerId: 'missing' },
    }),
  );
  assert.throws(() => Support.createContextStrategy([]));
});

test('model strategies select only declared models and reasoning implementations, with ordered exact overrides', async () => {
  const reasoned = {
    async *stream() {
      yield 'reasoned';
    },
  };
  const models = { fast: { provider, maxCalls: 3 }, deliberate: { provider } };
  const options = Support.createModelStrategy({
    model: 'fast',
    models,
    budget: 'small',
    reasoning: 'high',
    reasoningOptions: { high: { provider: reasoned, maxCalls: 4 } },
    maxCalls: 1,
  });
  assert.equal(options.provider, reasoned);
  assert.equal(options.maxCalls, 1);
  // 512 is the preset output ceiling when the strategy does not name one.
  assert.equal(options.maxOutputTokens, 512);
  assert.equal((await new ModelRunner(options).invoke('hello')).value, 'reasoned');
  assert.equal(Support.createModelStrategy({ model: models.fast, budget: 'large' }).maxCalls, 3);
  const disabled = Support.createModelStrategy({
    model: models.fast,
    budget: { maxCalls: 0, maxInputChars: 0, maxOutputChars: 0 },
  });
  assert.equal(disabled.maxCalls, 0);
  assert.equal(disabled.maxInputChars, 0);
  assert.equal(disabled.maxOutputChars, 0);
  // Prototype names are not model ids; unknown reasoning levels and negative budgets fail.
  for (const invalid of [
    { model: 'missing', models },
    { model: 'toString', models },
    { model: models.fast, models },
    { model: models.fast, reasoning: 'unknown' },
    { model: models.fast, budget: 'unknown' },
    { model: models.fast, budget: { maxCalls: -1 } },
  ])
    assert.throws(() => Support.createModelStrategy(invalid));
});

test('strategy composition retains every Core setting and structural option getters', async () => {
  const transports = [Support.createTextTransport({ id: 'text' })];
  const execution = { signal: new AbortController().signal };
  const sink = { output() {} },
    errors = {
      outputBudget() {
        return new Error('limit');
      },
    };
  const children = { maxDepth: 2, maxConcurrentCalls: 2, maxChildren: 3 };
  const tokenBudget = {
    counterId: 'fixture',
    contextWindowTokens: 1000,
    countTokens() {
      return 1;
    },
  };
  class Definition {
    get provider() {
      return provider;
    }
    get transports() {
      return transports;
    }
    get maxCalls() {
      return 0;
    }
    get maxInputChars() {
      return Infinity;
    }
    get execution() {
      return execution;
    }
    get sink() {
      return sink;
    }
    get errors() {
      return errors;
    }
    get children() {
      return children;
    }
    get tokenBudget() {
      return tokenBudget;
    }
    get maxSchemaChars() {
      return 1234;
    }
    get usage() {
      return true;
    }
  }
  const config = Support.createModelStrategy({ model: new Definition() });
  for (const [key, value] of Object.entries({
    transports,
    execution,
    sink,
    errors,
    children,
    tokenBudget,
  }))
    assert.equal(config[key], value);
  assert.equal(config.maxInputChars, Infinity);
  assert.equal(config.maxCalls, 0);
  assert.equal(config.maxSchemaChars, 1234);
  assert.equal(config.usage, true);
  // The composed settings are frozen, but Support does not take ownership of the provider.
  assert.ok(Object.isFrozen(config));
  assert.equal(Object.isFrozen(provider), false);
});

test('history presets express local space and retention choices while exact values remain authoritative', () => {
  // Presets scale the fragment budget by 1/4, 1/2 and 3/4 and retain 1, 3 and 6 groups.
  for (const [preset, ratio, groups] of [
    ['compact', 0.25, 1],
    ['balanced', 0.5, 3],
    ['extended', 0.75, 6],
  ]) {
    const strategy = Support.createContextStrategy({
      kind: 'recent',
      fragment: metadata,
      field: 'messages',
      preset,
    });
    assert.equal(strategy.policy.steps[0].targetChars, metadata.maxChars * ratio);
    assert.equal(strategy.policy.steps[0].keepGroups, groups);
    const exact = Support.createContextStrategy({
      kind: 'recent',
      fragment: metadata,
      field: 'messages',
      preset,
      targetChars: 123,
      keepGroups: 0,
    });
    assert.equal(exact.policy.steps[0].targetChars, 123);
    assert.equal(exact.policy.steps[0].keepGroups, 0);
  }
  assert.throws(() =>
    Support.createContextStrategy({
      kind: 'recent',
      fragment: metadata,
      field: 'messages',
      preset: 'unknown',
    }),
  );
});

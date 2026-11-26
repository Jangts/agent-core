/**
 * Locks down reasoning/thinking wire-format mapping in Support's provider: explicit level
 * to field mapping, no capability guessing, static snapshotting, dynamic receivers, and
 * the rules that keep reasoning from overriding request identity or output limits. Runs
 * under node --test with a fixture request port that captures the JSON body.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Support } from '../dist/esm/index.js';

const config = { baseUrl: 'https://fixture.invalid', apiKey: 'fixture', model: 'explicit-model' };
function fixture(source) {
  const bodies = [];
  const provider = new Support.CompatibleModelProvider({
    config: source,
    ports: {
      async request(_url, init) {
        bodies.push(JSON.parse(init.body));
        return new Response(
          'data: {"choices":[{"index":0,"delta":{"content":"done"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
          { headers: { 'content-type': 'text/event-stream' } },
        );
      },
    },
  });
  return {
    bodies,
    invoke: (signal = new AbortController().signal, maxOutputTokens = 16000) =>
      Array.fromAsync(
        provider.stream([{ role: 'user', content: 'question' }], {
          signal,
          options: { maxOutputTokens },
        }),
      ),
  };
}

test('explicit reasoning wire formats map requested levels without guessing model tools', async () => {
  // Each level maps to one exact wire field; model and max_tokens must stay untouched,
  // proving reasoning never rewrites request identity or limits.
  for (const [reasoning, expected] of [
    [{ format: 'reasoning-effort', level: 'off' }, { reasoning_effort: 'none' }],
    [{ format: 'reasoning-effort', level: 'high' }, { reasoning_effort: 'high' }],
    [{ format: 'thinking', level: 'low' }, { thinking: { type: 'enabled' } }],
    [{ format: 'thinking', level: 'off' }, { thinking: { type: 'disabled' } }],
    [{ format: 'enable-thinking', level: 'off' }, { enable_thinking: false }],
    // An explicit budget wins over the format's default 4096 token allocation.
    [
      { format: 'thinking-budget', level: 'medium' },
      { thinking: { type: 'enabled', budget_tokens: 4096 } },
    ],
    [
      { format: 'thinking-budget', level: 'high', budgets: { high: 12000 } },
      { thinking: { type: 'enabled', budget_tokens: 12000 } },
    ],
  ]) {
    const { bodies, invoke } = fixture({ ...config, reasoning });
    await invoke();
    for (const [key, value] of Object.entries(expected)) assert.deepEqual(bodies[0][key], value);
    assert.equal(bodies[0].model, config.model);
    assert.equal(bodies[0].max_tokens, 16000);
  }
});

test('explicit request fields override generated reasoning and static settings are snapshotted', async () => {
  const reasoning = { format: 'thinking-budget', level: 'high', budgets: { high: 3000 } };
  const source = {
    ...config,
    reasoning,
    requestBody: { thinking: { type: 'enabled', budget_tokens: 2000 } },
  };
  const { bodies, invoke } = fixture(source);
  // Mutating the source after construction must not leak: explicit request fields win and
  // the static snapshot keeps the original 2000-token budget.
  source.requestBody.thinking.budget_tokens = 9999;
  reasoning.budgets.high = 9999;
  await invoke();
  assert.equal(bodies[0].thinking.budget_tokens, 2000);
});

test('dynamic definitions and custom mapper class receivers are honored at each request', async () => {
  class Reasoning {
    format = 'custom';
    level = 'low';
    #calls = 0;
    map(level) {
      this.#calls++;
      return { custom_reasoning: { level, calls: this.#calls } };
    }
  }
  const reasoning = new Reasoning();
  const { bodies, invoke } = fixture(() => ({ ...config, reasoning }));
  await invoke();
  reasoning.level = 'high';
  await invoke();
  // The mapper runs per request on the declared receiver, so private call counts accrue
  // across the two invocations instead of being snapshotted once.
  assert.deepEqual(
    bodies.map((body) => body.custom_reasoning),
    [
      { level: 'low', calls: 1 },
      { level: 'high', calls: 2 },
    ],
  );
});

test('reasoning cannot override request identity, input or limits and invalid formats fail early', async () => {
  // Attempting to map any reserved request key must fail both at construction and per call,
  // and the per-call path must reject before a body is produced.
  for (const key of [
    'model',
    'messages',
    'stream',
    'max_tokens',
    'max_completion_tokens',
    'toJSON',
  ]) {
    const reasoning = {
      format: 'custom',
      level: 'high',
      map() {
        return { [key]: 'invalid' };
      },
    };
    assert.throws(() => fixture({ ...config, reasoning }), /cannot override/);
    const dynamic = fixture(() => ({ ...config, reasoning }));
    await assert.rejects(dynamic.invoke(), /cannot override/);
    assert.equal(dynamic.bodies.length, 0);
  }
  for (const reasoning of [
    { format: 'unknown', level: 'high' },
    { format: 'thinking', level: 'unknown' },
    { format: 'thinking-budget', level: 'low', budgets: { low: 0 } },
    { format: 'custom', level: 'high', map: async () => ({}) },
  ]) {
    assert.throws(() => fixture({ ...config, reasoning }));
  }
});

test('pre-cancellation skips dynamic strategy resolution and request I/O', async () => {
  let resolved = 0;
  const { bodies, invoke } = fixture(() => {
    resolved++;
    return { ...config, reasoning: { format: 'thinking', level: 'high' } };
  });
  const controller = new AbortController(),
    reason = new Error('stop');
  controller.abort(reason);
  // A pre-aborted signal must short-circuit before resolving the dynamic definition.
  await assert.rejects(invoke(controller.signal), (error) => error === reason);
  assert.equal(resolved, 0);
  assert.equal(bodies.length, 0);
});

test('thinking budgets respect the final Core and provider output limits without request I/O', async () => {
  for (const source of [
    { ...config, reasoning: { format: 'thinking-budget', level: 'high' } },
    { ...config, requestBody: { thinking: { type: 'enabled', budget_tokens: 8192 } } },
    {
      ...config,
      reasoning: { format: 'thinking-budget', level: 'low' },
      requestBody: { thinking: { budget_tokens: 8192 } },
    },
  ]) {
    for (const dynamic of [false, true]) {
      const sample = fixture(dynamic ? () => source : source);
      await assert.rejects(sample.invoke(undefined, 8192), /smaller than/);
      assert.equal(sample.bodies.length, 0);
    }
  }
  const capped = fixture({
    ...config,
    maxOutputTokens: 1000,
    reasoning: { format: 'thinking-budget', level: 'low' },
  });
  await assert.rejects(capped.invoke(), /smaller than/);
  assert.equal(capped.bodies.length, 0);
  // The budget must be strictly below the output ceiling, so 1025/1024 is the smallest
  // accepted pair while any equal or larger budget is refused.
  const exact = fixture({
    ...config,
    maxOutputTokens: 1025,
    reasoning: { format: 'thinking-budget', level: 'low' },
  });
  await exact.invoke();
  assert.equal(exact.bodies[0].max_tokens, 1025);
  assert.equal(exact.bodies[0].thinking.budget_tokens, 1024);
  // Zero, negative, fractional, non-finite, null and string budgets are all refused
  // before dispatch.
  for (const budget_tokens of [0, -1, 1.5, NaN, null, '100']) {
    const invalid = fixture({ ...config, requestBody: { thinking: { budget_tokens } } });
    await assert.rejects(invalid.invoke(), /budget_tokens/);
    assert.equal(invalid.bodies.length, 0);
  }
});

test('thinking budget maps accept structural getters without reading unrelated metadata', async () => {
  // Only the selected level is read; unrelated getters must never be touched, which is what
  // the throwing `metadata` accessor proves.
  class Budgets {
    get high() {
      return 2000;
    }
    get metadata() {
      assert.fail('unused strategy metadata is not a wire field');
    }
  }
  const { bodies, invoke } = fixture({
    ...config,
    reasoning: { format: 'thinking-budget', level: 'high', budgets: new Budgets() },
  });
  await invoke();
  assert.equal(bodies[0].thinking.budget_tokens, 2000);
});

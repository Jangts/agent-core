// Locks the dependency-free Core baseline: raw prompts, bounded defaults, cancellation, budget
// errors and the shipped minimal example, in both the ESM and CommonJS builds.
// Covers `ModelRunner`, `modelRunnerDefaults`, `AgentCoreEngine` and
// `development/examples/minimal-core.mjs`; `node --test` against dist.
import { textTransport } from './text-transport.fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import {
  AgentCoreEngine,
  BudgetError,
  ModelRunner,
  modelRunnerDefaults,
  getErrorInfo,
} from '../dist/esm/index.js';
// Leading and trailing whitespace proves the plain text result is trimmed.
const provider = {
  async *stream() {
    yield '  hello  ';
  },
};

test('Core alone accepts raw prompts with bounded defaults in ESM and CommonJS', async () => {
  const require = createRequire(import.meta.url);
  // The same assertions run against the ESM export and the CommonJS require.
  for (const api of [{ ModelRunner, modelRunnerDefaults }, require('../dist/cjs/index.js')]) {
    let seen;
    const model = new api.ModelRunner({ execution: {},
      provider: {
        async *stream(messages, { signal: signal, options: options = {} }) {
          seen = { messages, signal, options };
          yield '  hello  ';
        },
      },
    });
    assert.equal((await model.invoke('  original prompt  ')).value, 'hello');
    assert.deepEqual(seen.messages, [{ role: 'user', content: '  original prompt  ' }]);
    assert.ok(seen.signal instanceof AbortSignal);
    assert.equal(seen.options.maxOutputTokens, api.modelRunnerDefaults.maxOutputTokens);
    assert.equal(model.lastCall.stageId, api.modelRunnerDefaults.stage);
    assert.equal(model.callCount, 1);
  }
});
test('optional settings and named prompts override only the declared defaults', async () => {
  const calls = [];
  const model = new ModelRunner({ execution: {},
    provider: {
      async *stream(messages, { signal: _signal, options: options = {} }) {
        calls.push({ messages, options });
        yield 'ok';
      },
    },
    maxCalls: 2,
    maxOutputTokens: 20,
  });
  (await model.invoke({ input: 'question', instructions: 'custom instruction', stageId: 'custom' }))
    .value;
  (
    await model.invoke({
      input: 'another',
      instructions: 'another instruction',
      maxOutputTokens: 30,
    })
  ).value;
  assert.deepEqual(calls[0].messages, [
    { role: 'system', content: 'custom instruction' },
    { role: 'user', content: 'question' },
  ]);
  assert.deepEqual(calls[1].messages, [
    { role: 'system', content: 'another instruction' },
    { role: 'user', content: 'another' },
  ]);
  assert.equal(calls[0].options.maxOutputTokens, 20);
  assert.equal(calls[1].options.maxOutputTokens, 30);
  await assert.rejects(
    model.invoke('exhausted'),
    (error) => error instanceof BudgetError && getErrorInfo(error).code === 'BUDGET',
  );
});
test('custom transports stay opt-in and cannot replace the default text result', async () => {
  const transport = textTransport('number', () => 42, {});
  const model = new ModelRunner({ execution: {}, provider, transports: [transport] });
  assert.equal((await model.invoke('plain')).value, 'hello');
  assert.equal((await model.invoke({ input: 'number', transport })).value, 42);
  assert.equal((await model.invoke({ input: [], transport: 'number' })).value, 42);
  // The reserved default transport id cannot be re-registered by an application.
  assert.throws(
    () => new ModelRunner({ execution: {}, provider, transports: [{ ...transport, id: 'core:plain-text' }] }),
    /duplicate/,
  );
});
test('minimal calls keep cancellation, budget validation and the default stage', async () => {
  const model = new ModelRunner({ execution: {}, provider });
  await model.invoke('hello');
  assert.equal(model.journal.snapshot()[0].stageId, 'model');
  // One character past the default input budget is rejected before any provider call.
  await assert.rejects(
    model.invoke('x'.repeat(modelRunnerDefaults.maxInputChars + 1)),
    (error) => getErrorInfo(error).code === 'CONTEXT_BUDGET',
  );
  // Rejected requests are not charged against the call budget.
  assert.equal(model.callCount, 1);
  const control = new AbortController();
  const reason = new Error('cancelled');
  control.abort(reason);
  const cancelled = new ModelRunner({ provider, execution: { signal: control.signal } });
  await assert.rejects(
    cancelled.invoke('hello'),
    (error) => error === reason && getErrorInfo(error).code === 'CANCELLED',
  );
  for (const request of [
    // Ambiguous or legacy request shapes are configuration errors, not prompts.
    { prompt: 'x', input: [] },
    { prompt: 42 },
    { input: [], instructions: 'ambiguous' },
    { prompt: 'x', maxOutputTokens: 0 },
  ])
    await assert.rejects(
      model.invoke(request),
      (error) => getErrorInfo(error).code === 'MODEL_CONFIG',
    );
});
test('Core accepts basic input while context strategy belongs to explicit App nodes', async () => {
  assert.throws(
    () => new ModelRunner({ execution: {}, provider, contextPolicy: { mode: 'reduce', steps: [] } }),
    (error) => getErrorInfo(error).code === 'MODEL_CONFIG',
  );
  const model = new ModelRunner({ execution: {}, provider });
  assert.equal((await model.invoke('hello')).value, 'hello');
  assert.equal(model.callCount, 1);
});
test('the basic engine has bounded defaults without a custom exhaustion factory', async () => {
  assert.equal(
    await new AgentCoreEngine().run(async () => ({ type: 'complete', value: 'done' })),
    'done',
  );
  let steps = 0;
  await assert.rejects(
    new AgentCoreEngine().run(async () => {
      steps++;
      return { type: 'continue' };
    }),
    BudgetError,
  );
  // The default round budget is eight; the ninth continuation exhausts it.
  assert.equal(steps, 8);
  const exhausted = new Error('custom exhaustion');
  await assert.rejects(
    new AgentCoreEngine({ maxRounds: 1, errors: { exhausted: () => exhausted } }).run(async () => ({
      type: 'continue',
    })),
    (error) => error === exhausted,
  );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    new AgentCoreEngine({ execution: { signal: controller.signal } }).run(async () => ({
      type: 'complete',
      value: 'never',
    })),
    { name: 'AbortError' },
  );
  assert.throws(() => new AgentCoreEngine({ maxSteps: 3 }), /Use maxRounds/);
});
test('the shipped offline demo imports no Support and runs against the public Core API', async () => {
  const source = await readFile(
    new URL('../development/examples/minimal-core.mjs', import.meta.url),
    'utf8',
  );
  // The demo must not import Support; it only uses the public Core API.
  assert.doesNotMatch(source, /\bSupport\b/);
  const output = [];
  const original = console.log;
  try {
    console.log = (value) => output.push(value);
    await import('../development/examples/minimal-core.mjs');
  } finally {
    console.log = original;
  }
  assert.deepEqual(output, ['收到：你好，Core']);
  // The demo prints exactly one line through the public API.
});

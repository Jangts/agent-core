// Locks ModelRunner boundary guarantees: detached messages and image metadata, frozen prepared
// transports, terminal sink tolerance, cancellation retraction and preview/wire-name agreement.
// Covers `ModelRunner`, `ModelToolRegistry`, `createModelTransport`, `Support` and the
// JSON-object interaction; `node --test` against dist/esm.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ModelRunner,
  ModelToolRegistry,
  createModelTransport,
  Support,
} from '../dist/esm/index.js';
import { jsonObjectInteraction } from '../dist/esm/model/interactions/json-object.js';

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
// Minimal capability with one string field, used for selection cases.
const capability = (id) => ({
  id,
  description: id,
  inputSchema: {
    jsonSchema: { type: 'object', properties: { text: { type: 'string' } } },
    parse: (value) => value,
  },
  resolve: (value) => value,
});

test('input accounting, token counting and Provider I/O share detached messages and image metadata', async () => {
  // Raw message arrays and pre-built request objects must behave identically.
  for (const built of [false, true]) {
    const messages = [
      {
        role: 'user',
        content: 'ok',
        images: [{ url: 'https://example.invalid/original', detail: 'low' }],
      },
    ];
    const counted = [],
      sent = [],
      events = [];
    const runner = new ModelRunner({ execution: {},
      maxInputChars: 2,
      maxOutputTokens: 1,
      tokenBudget: {
        counterId: 'exact',
        contextWindowTokens: 10,
        countTokens({ messages: input }) {
          counted.push(structuredClone(input));
          // The counter mutates the caller array to prove it sees a detached copy.
          messages[0].content = 'x'.repeat(10000);
          return input.reduce((sum, item) => sum + item.content.length, 0);
        },
      },
      provider: {
        async *stream(input) {
          sent.push(structuredClone(input));
          yield 'answer';
        },
      },
      sink: {
        output(event) {
          events.push(event);
          // Sink mutation must not alter what the provider ultimately receives.
          if (event.type === 'model.start') messages[0].role = 'system';
        },
      },
    });
    const input = built
      ? { messages, fragmentUsage: [], inputChars: 2, maxInputChars: 2 }
      : messages;
    const pending = runner.invoke({ input });
    messages[0].content = 'changed';
    messages[0].images[0].url = 'https://example.invalid/changed';
    messages[0].images.push({ url: 'https://example.invalid/extra' });
    messages.push({ role: 'system', content: 'late instruction' });
    await pending;
    // Token counting and provider I/O must observe identical detached messages.
    assert.deepEqual(sent, counted);
    assert.deepEqual(sent[0], [
      {
        role: 'user',
        content: 'ok',
        images: [{ url: 'https://example.invalid/original', detail: 'low' }],
      },
    ]);
    assert.equal(runner.lastCall.inputChars, 2);
    assert.equal(runner.lastCall.inputTokens, 2);
    assert.equal(events.at(-1).type, 'model.end');
    assert.equal(events.at(-1).payload.state.status, 'success');
  }
});

test('prepared JSON selections cannot acquire a capability registered after preparation', async () => {
  let resolutions = 0;
  const registry = new ModelToolRegistry([capability('safe')]);
  const source = {
    values: () => registry.values(),
    resolve(selection, context) {
      resolutions++;
      return registry.resolve(selection, context);
    },
  };
  const transport = createModelTransport({
    id: 'json',
    tools: source,
    adapter: jsonObjectInteraction,
  });
  let selected = 'later';
  const runner = new ModelRunner({ execution: {},
    transports: [transport],
    provider: {
      async *stream() {
        yield JSON.stringify({ name: selected, input: { text: 'answer' } });
      },
    },
  });
  const prepared = runner.prepare({ transport });
  // Registering after prepare must not widen the frozen selection.
  registry.register(capability('later'));
  await assert.rejects(
    runner.invoke({ input: 'question', prepared }),
    (error) => error.issues?.[0].code === 'MODEL_PROTOCOL',
  );
  // Rejected before resolving, so the business parser never ran.
  assert.equal(resolutions, 0);
  assert.deepEqual((await runner.invoke({ input: 'fresh preparation', transport })).value, {
    text: 'answer',
  });
  selected = 'safe';
  assert.deepEqual((await runner.invoke({ input: 'known capability', transport })).value, {
    text: 'answer',
  });
  assert.equal(resolutions, 2);
});

test('terminal sink notifications preserve the committed result when the terminal consumer fails', async () => {
  const seen = [];
  const runner = new ModelRunner({ execution: {},
    provider: {
      async *stream() {
        yield 'answer';
      },
    },
    sink: {
      output(event) {
        seen.push(event);
        if (event.type === 'model.end') throw Error('terminal consumer unavailable');
      },
    },
  });
  assert.equal((await runner.invoke('question')).value, 'answer');
  // A failing terminal consumer is swallowed; the result and journal stay committed.
  assert.deepEqual(
    seen.map((event) => event.type),
    ['model.start', 'model.output', 'model.parsed', 'model.end'],
  );
  assert.equal(seen.at(-1).payload.state.status, 'success');
  assert.equal(runner.journal.snapshot().length, 1);
});

test('cancelled and timed-out calls notify the preview sink and retract their drafts', async () => {
  for (const timeout of [false, true]) {
    const control = new AbortController(),
      entered = deferred(),
      previews = [],
      events = [];
    const preview = Support.createReplyPreview({
      rules: [{ stageId: 'reply' }],
      sink(value) {
        previews.push(value);
        if (value.length) entered.resolve();
      },
    });
    const runner = new ModelRunner({
      callTimeoutMs: timeout ? 40 : 1000,
      execution: { signal: control.signal },
      provider: {
        async *stream() {
          yield 'draft';
          await new Promise(() => {});
        },
      },
      sink: {
        async output(event) {
          events.push(event);
          await preview(event);
        },
      },
    });
    const keepAlive = setTimeout(() => {}, 2000);
    try {
      const pending = runner.invoke({ input: 'question', stageId: 'reply' });
      const rejected = assert.rejects(pending, { name: timeout ? 'TimeoutError' : 'AbortError' });
      await entered.promise;
      if (!timeout) control.abort();
      await rejected;
      // The displayed draft is retracted by an empty preview after cancellation or timeout.
      assert.deepEqual(previews, [['draft'], []]);
      assert.equal(events.at(-1).type, 'model.end');
      assert.equal(events.at(-1).payload.state.status, 'cancelled');
      assert.equal(events.filter((event) => event.type === 'model.end').length, 1);
    } finally {
      clearTimeout(keepAlive);
    }
  }
});

test('a stalled terminal consumer cannot hang success, cancellation or replace an original failure', async () => {
  // A terminal consumer that never settles must not hang the call or mask the original error.
  for (const outcome of ['success', 'error', 'cancelled']) {
    const control = new AbortController(),
      original = Error('original failure'),
      terminal = [];
    const runner = new ModelRunner({
      execution: { signal: control.signal },
      provider: {
        async *stream() {
          yield 'draft';
          if (outcome === 'error') throw original;
          if (outcome === 'cancelled') {
            control.abort(original);
            await new Promise(() => {});
          }
        },
      },
      sink: {
        output(event) {
          if (event.type === 'model.end') {
            terminal.push(event);
            return new Promise(() => {});
          }
        },
      },
    });
    const keepAlive = setTimeout(() => {}, 2000);
    try {
      const pending = runner.invoke('question');
      if (outcome === 'success') assert.equal((await pending).value, 'draft');
      else await assert.rejects(pending, (error) => error === original);
      assert.equal(terminal.length, 1);
      assert.equal(terminal[0].payload.state.status, outcome);
    } finally {
      clearTimeout(keepAlive);
    }
  }
});

test('generated preview rules use the same native wire names as capability transport', async () => {
  // Dots, non-ASCII and over-long ids all make wire-name mapping non-trivial.
  for (const id of ['answer.reply', '中文回复', 'reply'.repeat(20)]) {
    const definition = capability(id),
      tools = new ModelToolRegistry([definition]).seal(),
      previews = [];
    const rules = Support.createReplyPreviewRules({
      stages: [{ id: 'reply', preview: 'tools', toolIds: [id] }],
      tools: [{ id, jsonSchema: definition.inputSchema.jsonSchema, preview: true }],
    });
    const transport = createModelTransport({ id: 'native', tools });
    const runner = new ModelRunner({ execution: {},
      transports: [transport],
      provider: {
        async *stream(_, { options }) {
          yield {
            type: 'function-call-delta',
            index: 0,
            id: 'call',
            name: options.functions[0].name,
            arguments: '{"text":"visible"}',
          };
        },
      },
      sink: {
        output: Support.createReplyPreview({
          rules,
          sink: (value) => {
            previews.push(value);
          },
        }),
      },
    });
    assert.deepEqual(
      (await runner.invoke({ input: 'question', stageId: 'reply', transport })).value,
      { text: 'visible' },
    );
    assert.deepEqual(previews.at(-1), ['visible']);
  }
});

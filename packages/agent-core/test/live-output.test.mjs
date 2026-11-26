// Locks ReplyPreview streaming: fragments are emitted before the model completes, partial JSON is
// never shown, drafts are retracted on protocol rejection or cancellation, and preview rules are
// snapshotted at compile time. Covers `Support.createReplyPreview`/`createReplyPreviewRules`,
// `ModelRunner`, `MockGPT` and `streamEvents`; `node --test` against dist/esm.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ModelRunner,
  ModelToolRegistry,
  CompatibleModelProvider,
  Support,
} from '../dist/esm/index.js';
import { MockGPT, responses } from '../dist/esm/mock.js';
const signal = () => new AbortController().signal;
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const registry = new ModelToolRegistry([
  {
    id: 'answer',
    description: 'Prose',
    inputSchema: { jsonSchema: { type: 'object' }, parse: (value) => value },
    resolve: (value) => value,
  },
]).seal();
const transport = Support.createModelTransport({ id: 'answer', tools: registry });

let fixtureSequence = 0;
// Builds synthetic Core events so the preview sink can be driven without a real provider.
function outputFact({ phase, callSequence, stageId, part, parsed }) {
  const type = { start: 'model.start', part: 'model.output', end: 'model.end' }[phase];
  const invocationId = `fixture-${callSequence}`;
  return {
    version: 2,
    eventId: `fixture-event-${++fixtureSequence}`,
    producerSequence: fixtureSequence,
    occurredAtMs: Date.now(),
    runId: 'fixture',
    spanId: invocationId,
    invocationId,
    type,
    subSteps: [],
    subStepsDropped: 0,
    subStepsTruncated: false,
    payload: {
      callSequence,
      stageId,
      ...(phase === 'part' ? { part, partIndex: fixtureSequence } : {}),
      ...(phase === 'end' ? { state: { status: parsed ? 'success' : 'error', callSequence } } : {}),
    },
  };
}

const delta = (argumentsText, name) => ({
  type: 'function-call-delta',
  index: 0,
  id: 'call-1',
  ...(name ? { name } : {}),
  arguments: argumentsText,
});

test('real MockGPT wire/provider delivers fragmented names and prose before the model completes', async () => {
  const gate = deferred(),
    seen = deferred();
  let ended = false;
  const mock = new MockGPT({
    rules: [
      {
        generator: responses.toolCalls(
          [{ name: 'answer', arguments: { text: '边生成边显示😀', bubbles: ['第二个气泡'] } }],
          // One character per JSON and wire chunk exercises the worst fragmentation case.
          { chunkSize: 1, wireChunkSize: 1 },
        ),
      },
    ],
  });
  const actual = new CompatibleModelProvider({
    config: { baseUrl: 'https://mock.invalid/v1', apiKey: 'mock', model: 'mock' },
    ports: { request: mock.fetch },
  });
  const provider = {
    async *stream(...args) {
      for await (const part of actual.stream(...args)) {
        yield part;
        // Pause the provider mid-arguments to prove the preview arrives before completion.
        if (typeof part !== 'string' && part.arguments?.includes('边')) await gate.promise;
      }
      ended = true;
    },
  };
  const previews = [];
  const runner = new ModelRunner({
    provider,
    transports: [transport],
    sink: {
      output: Support.createReplyPreview({
        rules: [{ toolId: 'answer' }],
        sink: (bubbles) => {
          previews.push(bubbles);
          if (bubbles.join('').includes('边')) seen.resolve();
        },
      }),
    },
  });
  const pending = runner.invoke({ input: 'hello', transport: 'answer' });
  await seen.promise;
  // The preview was already delivered while the model stream was still open.
  assert.equal(ended, false);
  assert.ok(previews.some((b) => b[0] === '边'));
  gate.resolve();
  assert.equal((await pending).value.text, '边生成边显示😀');
  assert.deepEqual(previews.at(-1), ['边生成边显示😀', '第二个气泡']);
  assert.equal(mock.activeRequests, 0);
});

test('every single-character boundary preserves JSON escapes, nested prose and bubble order', async () => {
  const previews = [];
  const project = Support.createReplyPreview({
    rules: [
      {
        toolId: 'answer',
        paths: [
          ['reply', 'text'],
          ['reply', 'bubbles', '*'],
        ],
      },
    ],
    sink: (value) => previews.push(value),
  });
  await project(outputFact({ phase: 'start', callSequence: 1, stageId: 'test' }));
  await project(
    outputFact({ phase: 'part', callSequence: 1, stageId: 'test', part: delta('', 'answer') }),
  );
  const raw =
    '{"secret":"do not show","reply":{"text":"a\\n\\u4e2d\\ud83d\\ude00\\\"\\\\z","bubbles":["二", "三"]}}';
  // Each character is fed separately; escapes and surrogate pairs must recombine.
  for (const ch of raw)
    await project(outputFact({ phase: 'part', callSequence: 1, stageId: 'test', part: delta(ch) }));
  assert.deepEqual(previews.at(-1), ['a\n中😀"\\z', '二', '三']);
  assert.ok(
    previews.every(
      (b) => !b.join('').includes('do not show') && !/[\ud800-\udfff]/u.test(b.join('')),
    ),
  );
});

test('tools, raw prose and multiple native calls cannot masquerade as an approved reply', async () => {
  const previews = [];
  const project = Support.createReplyPreview({
    rules: [{ toolId: 'answer' }],
    sink: (b) => previews.push(b),
  });
  await project(outputFact({ phase: 'start', callSequence: 1, stageId: 'decision' }));
  await project(
    outputFact({
      phase: 'part',
      callSequence: 1,
      stageId: 'decision',
      part: delta('{"text":"SECRET"}', 'tool'),
    }),
  );
  assert.equal(previews.length, 0);
  await project(outputFact({ phase: 'start', callSequence: 2, stageId: 'decision' }));
  await project(
    outputFact({
      phase: 'part',
      callSequence: 2,
      stageId: 'decision',
      part: delta('{"text":"draft', 'answer'),
    }),
  );
  await project(
    outputFact({
      phase: 'part',
      callSequence: 2,
      stageId: 'decision',
      part: { ...delta('x'), index: 1 },
    }),
  );
  assert.deepEqual(previews.at(-1), []);
  await project(outputFact({ phase: 'start', callSequence: 3, stageId: 'decision' }));
  await project(
    outputFact({ phase: 'part', callSequence: 3, stageId: 'decision', part: 'raw secret' }),
  );
  await project(
    outputFact({
      phase: 'part',
      callSequence: 3,
      stageId: 'decision',
      part: delta('{"text":"hidden"}', 'answer'),
    }),
  );
  assert.ok(
    previews.every((b) => !b.join('').includes('SECRET') && !b.join('').includes('hidden')),
  );
});

test('protocol rejection retracts a displayed draft; final model validation still rejects incomplete JSON', async () => {
  const previews = [];
  const runner = new ModelRunner({
    provider: {
      async *stream() {
        yield delta('{"text":"provisional', 'answer');
      },
    },
    transports: [transport],
    sink: {
      output: Support.createReplyPreview({
        rules: [{ toolId: 'answer' }],
        sink: (b) => previews.push(b),
      }),
    },
  });
  await assert.rejects(runner.invoke({ input: 'test', transport: 'answer' }));
  assert.ok(previews.some((b) => b[0] === 'provisional'));
  assert.deepEqual(previews.at(-1), []);
});

test('output budget is enforced before the delivery sink and sink backpressure stops provider consumption', async () => {
  const gate = deferred(),
    seen = deferred();
  let consumed = 0;
  const runner = new ModelRunner({
    maxOutputChars: 2,
    provider: {
      async *stream() {
        consumed++;
        yield 'a';
        consumed++;
        yield 'bc';
      },
    },
    sink: {
      output: async (event) => {
        if (event.type === 'model.output') {
          assert.equal(event.payload.part, 'a');
          seen.resolve();
          await gate.promise;
        }
      },
    },
  });
  const pending = runner.invoke('test');
  await seen.promise;
  assert.equal(consumed, 1);
  gate.resolve();
  await assert.rejects(pending);
  assert.equal(consumed, 2);
});

test('single-slot event bridge delivers before operation completion and closes pending producer on cancellation', async () => {
  const control = new AbortController();
  let ended = false;
  const stream = Support.streamEvents(
    async (emit) => {
      try {
        await emit('first');
        await emit('second');
      } finally {
        ended = true;
      }
    },
    { signal: control.signal },
  );
  const iterator = stream[Symbol.asyncIterator]();
  assert.equal((await iterator.next()).value, 'first');
  assert.equal(ended, false);
  control.abort();
  await assert.rejects(iterator.next(), { name: 'AbortError' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(ended, true);
});

test('call timeout still terminates when a delivery sink stops draining', async () => {
  const runner = new ModelRunner({
    callTimeoutMs: 20,
    provider: {
      async *stream() {
        yield 'a';
      },
    },
    sink: {
      output: (event) => (event.type === 'model.output' ? new Promise(() => {}) : undefined),
    },
  });
  // AbortSignal.timeout is unref-ed; retain one bounded test handle while testing a stalled consumer.
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    await assert.rejects(runner.invoke('test'), { name: 'TimeoutError' });
  } finally {
    clearTimeout(keepAlive);
  }
});

test('out-of-order JSON fields and interleaved call lifecycles never relabel later bubbles or mix drafts', async () => {
  const seen = [];
  const project = Support.createReplyPreview({
    rules: [{ toolId: 'answer', stageId: 'reply' }],
    sink: (b) => seen.push(b),
  });
  const event = (call, value) =>
    project(outputFact({ callSequence: call, stageId: 'reply', ...value }));
  await event(1, { phase: 'start' });
  await event(1, { phase: 'part', part: delta('{"bubbles":["second"],', 'answer') });
  assert.ok(seen.every((b) => b.length === 0));
  await event(1, { phase: 'part', part: delta('"text":"first"}') });
  assert.deepEqual(seen.at(-1), ['first', 'second']);
  await event(2, { phase: 'start' });
  await event(1, { phase: 'part', part: delta('old fragments') });
  await event(2, { phase: 'part', part: delta('{"text":"new"}', 'answer') });
  await event(1, { phase: 'end', parsed: false });
  assert.deepEqual(seen.at(-1), ['new']);
  await project(outputFact({ phase: 'start', callSequence: 3, stageId: 'review' }));
  await project(
    outputFact({
      phase: 'part',
      callSequence: 3,
      stageId: 'review',
      part: delta('{"text":"not allowed here"}', 'answer'),
    }),
  );
  assert.deepEqual(seen.at(-1), []);
});

test('preview waits for the complete eligible field and never exposes continued planning', async () => {
  const seen = [];
  const preview = Support.createReplyPreview({
    rules: [{ toolId: 'answer', when: { path: ['outcome'], values: ['done'] } }],
    sink: (value) => seen.push(value),
  });
  const send = (value) => preview(outputFact({ callSequence: 1, stageId: 'reply', ...value }));
  await send({ phase: 'start' });
  await send({
    phase: 'part',
    part: delta('{"text":"unexecuted plan","outcome":"pending"}', 'answer'),
  });
  assert.ok(seen.every((value) => value.length === 0));
  await preview(outputFact({ phase: 'start', callSequence: 2, stageId: 'reply' }));
  await preview(
    outputFact({
      phase: 'part',
      callSequence: 2,
      stageId: 'reply',
      part: delta('{"text":"delivered","outcome":"don', 'answer'),
    }),
  );
  assert.ok(seen.every((value) => value.length === 0));
  await preview(
    outputFact({ phase: 'part', callSequence: 2, stageId: 'reply', part: delta('e"}') }),
  );
  assert.deepEqual(seen.at(-1), ['delivered']);
});

test('preview rule getters preserve stage and field restrictions through compilation', async () => {
  class Rule {
    get toolId() {
      return 'answer';
    }
    get stageId() {
      return 'reply';
    }
    get paths() {
      return [['body']];
    }
  }
  const seen = [];
  const preview = Support.createReplyPreview({
    rules: [new Rule()],
    sink: (value) => seen.push(value),
  });
  await preview(outputFact({ phase: 'start', callSequence: 1, stageId: 'reply' }));
  await preview(
    outputFact({
      phase: 'part',
      callSequence: 1,
      stageId: 'reply',
      part: delta('{"text":"private","body":"visible"}', 'answer'),
    }),
  );
  assert.deepEqual(seen.at(-1), ['visible']);
  await preview(outputFact({ phase: 'start', callSequence: 2, stageId: 'review' }));
  await preview(
    outputFact({
      phase: 'part',
      callSequence: 2,
      stageId: 'review',
      part: delta('{"body":"hidden"}', 'answer'),
    }),
  );
  assert.deepEqual(seen.at(-1), []);
});

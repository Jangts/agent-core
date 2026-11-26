// Locks collector output accounting and native stream validation: invalid counts, truncated
// finalization and malformed frames must fail as protocol or limit errors before success delivery.
// Covers `ModelRunner`, `createModelTransport` and error codes; `node --test` against dist/esm.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ModelRunner,
  ModelToolRegistry,
  createModelTransport,
  getErrorInfo,
} from '../dist/esm/index.js';

// Codes are additive, so match membership rather than one exact code.
const protocolFailure = (error) => getErrorInfo(error).codes.includes('MODEL_PROTOCOL');

test('collector output accounting rejects invalid counts before successful delivery', async () => {
  // NaN, infinity, negatives, fractions and unsafe integers are all invalid char counts.
  for (const counts of [[NaN], [Infinity], [-1], [0.5], [Number.MAX_SAFE_INTEGER + 1]]) {
    let parsed = 0;
    const events = [];
    const transport = {
      id: 'meter',
      prepare() {
        let index = -1;
        return {
          options: {},
          schemaChars: 0,
          createResponse: () => ({
            get outputChars() {
              return index < 0 ? 0 : counts[index];
            },
            push() {
              index++;
            },
            finish() {
              parsed++;
              return 'untrusted';
            },
          }),
        };
      },
    };
    const model = new ModelRunner({ execution: {},
      maxOutputChars: Infinity,
      transports: [transport],
      provider: {
        async *stream() {
          for (const _count of counts) yield 'x';
        },
      },
      sink: {
        output: (event) => {
          events.push(event);
        },
      },
    });
    await assert.rejects(model.invoke({ input: 'question', transport }), protocolFailure);
    // Rejection happens before the collector's finish and parse run.
    assert.equal(parsed, 0);
    assert.equal(model.journal.snapshot().length, 0);
    assert.equal(events.at(-1).payload.state.status, 'error');
    assert.ok(!events.some((event) => event.type === 'model.parsed'));
  }
});

test('collectors may release their buffer during finalization while traces retain peak output size', async () => {
  const transport = {
    id: 'normalizing',
    prepare() {
      let size = 0;
      return {
        options: {},
        schemaChars: 0,
        createResponse: () => ({
          get outputChars() {
            return size;
          },
          push(part) {
            size += part.length;
          },
          finish() {
            // A collector may free its buffer; the peak size must still be recorded.
            size = 0;
            return 'answer';
          },
        }),
      };
    },
  };
  const model = new ModelRunner({ execution: {},
    maxOutputChars: 4,
    transports: [transport],
    provider: {
      async *stream() {
        yield 'text';
      },
    },
  });
  assert.equal((await model.invoke({ input: 'question', transport })).value, 'answer');
  // lastCall keeps the peak output size, not the post-finalization zero.
  assert.equal(model.lastCall.outputChars, 4);
});

test('empty streams and collector finalization cannot bypass output accounting', async () => {
  // Invalid counts can appear at start or at finish; 2 exceeds the maxOutputChars of 1.
  for (const timing of ['initial', 'finish'])
    for (const outputChars of [NaN, -1, 2]) {
      const transport = {
        id: 'meter',
        prepare() {
          let finished = false;
          return {
            options: {},
            schemaChars: 0,
            createResponse: () => ({
              get outputChars() {
                return timing === 'initial' || finished ? outputChars : 0;
              },
              push() {},
              finish() {
                finished = true;
                return 'answer';
              },
            }),
          };
        },
      };
      const model = new ModelRunner({ execution: {},
        maxOutputChars: 1,
        transports: [transport],
        provider: { async *stream() {} },
      });
      await assert.rejects(model.invoke({ input: 'question', transport }), (error) =>
        getErrorInfo(error).codes.includes(outputChars === 2 ? 'OUTPUT_LIMIT' : 'MODEL_PROTOCOL'),
      );
      assert.equal(model.journal.snapshot().length, 0);
    }
});

test('native collectors reject malformed Provider fields before resolving a capability', async () => {
  const valid = {
    type: 'function-call-delta',
    index: 0,
    id: 'call',
    name: 'answer',
    arguments: '{"text":"answer"}',
  };
  // null, non-object and wrongly typed id/name/arguments frames, one per iteration.
  for (const part of [
    null,
    [],
    7,
    { ...valid, id: 7 },
    { ...valid, id: '' },
    { ...valid, name: 7 },
    { ...valid, arguments: {} },
  ]) {
    let resolved = 0;
    const tools = new ModelToolRegistry([
      {
        id: 'answer',
        description: 'Answer',
        inputSchema: { jsonSchema: { type: 'object' }, parse: (value) => value },
        resolve(value) {
          resolved++;
          return value;
        },
      },
    ]).seal();
    const transport = createModelTransport({ id: 'native', tools });
    const model = new ModelRunner({ execution: {},
      maxOutputChars: Infinity,
      transports: [transport],
      provider: {
        async *stream() {
          yield part;
        },
      },
    });
    await assert.rejects(model.invoke({ input: 'question', transport }), protocolFailure);
    // Malformed frames fail before any capability resolution.
    assert.equal(resolved, 0);
    assert.equal(model.lastCall.status, 'error');
  }
});

test('valid native streams retain output limits and explicit unlimited configuration', async () => {
  const tools = new ModelToolRegistry([
    {
      id: 'answer',
      description: 'Answer',
      inputSchema: { jsonSchema: { type: 'object' }, parse: (value) => value },
      resolve: (value) => value,
    },
  ]).seal();
  const transport = createModelTransport({ id: 'native', tools });
  // The 10k-char payload arrives in two frames so accumulation is checked against the limit.
  const text = 'x'.repeat(10000);
  const provider = {
    async *stream() {
      yield { type: 'function-call-delta', index: 0, id: 'call', name: 'answer' };
      yield { type: 'function-call-delta', index: 0, arguments: JSON.stringify({ text }) };
    },
  };
  const limited = new ModelRunner({ execution: {}, maxOutputChars: 1, transports: [transport], provider });
  await assert.rejects(limited.invoke({ input: 'question', transport }), (error) =>
    getErrorInfo(error).codes.includes('OUTPUT_LIMIT'),
  );
  const unlimited = new ModelRunner({ execution: {},
    maxOutputChars: Infinity,
    transports: [transport],
    provider,
  });
  assert.deepEqual((await unlimited.invoke({ input: 'question', transport })).value, { text });
  assert.ok(Number.isSafeInteger(unlimited.lastCall.outputChars));
});

test('optional call metadata cannot replace success or the original failure, and always permits terminal delivery', async () => {
  for (const outcome of ['success', 'error', 'cancelled']) {
    const control = new AbortController(),
      original = Error('original failure'),
      events = [];
    let callReads = 0;
    let callsReads = 0;
    const transport = {
      id: 'metadata',
      prepare: () => ({
        options: {},
        schemaChars: 0,
        createResponse: () => ({
          outputChars: 0,
          push() {},
          finish() {
            if (outcome === 'error') throw original;
            return 'answer';
          },
          get call() {
            // Optional metadata is read once and cannot replace the recorded outcome.
            callReads++;
            throw Error('metadata getter failed');
          },
          get calls() {
            callsReads++;
            throw Error('native calls metadata getter failed');
          },
        }),
      }),
    };
    const model = new ModelRunner({
      execution: { signal: control.signal },
      transports: [transport],
      provider: {
        async *stream() {
          yield 'text';
          if (outcome === 'cancelled') control.abort(original);
        },
      },
      sink: {
        output: (event) => {
          events.push(event);
        },
      },
    });
    const pending = model.invoke({ input: 'question', transport });
    if (outcome === 'success') assert.equal((await pending).value, 'answer');
    else await assert.rejects(pending, (error) => error === original);
    // The metadata getter is attempted exactly once per call, then terminal delivery proceeds.
    assert.equal(callReads, 1);
    assert.equal(callsReads, 1);
    assert.equal(events.filter((event) => event.type === 'model.end').length, 1);
    assert.equal(events.at(-1).payload.state.status, outcome);
  }
});

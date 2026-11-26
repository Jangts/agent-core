/*
 * Emission contract for diagnostics: payloads are lazy, output failures are
 * contained, and provider observations stay out of Core events.
 *
 * Recording must cost nothing when it is not wanted, so a payload factory is only
 * evaluated after an output or observer has accepted the event. A failing sink may
 * not fail the model call, a malformed native argument is still captured before its
 * parse error is reported, and the compatible provider writes per-call observations
 * that never reach Core diagnostics or leak the API key.
 *
 * Runs on `dist/esm` with in-memory sinks and fake providers.
 */
import { textTransport } from './text-transport.fixture.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDiagnostics,
  ModelRunner,
  createModelTransport,
  ModelToolRegistry,
  CompatibleModelProvider,
} from '../dist/esm/index.js';

test('no output and rejected content never evaluate payload factories', () => {
  // Both cases assert laziness: no output configured, and a metadata-only sink asked
  // for private content. Neither may build the payload or throw.
  let constructed = 0;
  const disabled = createDiagnostics();
  disabled.emit('model.prepare', () => {
    constructed++;
    throw new Error('must not run');
  });
  const metadata = createDiagnostics({
    output: { accepts: (d) => d.content === 'metadata', write() {} },
  });
  metadata.emit('model.output', () => {
    constructed++;
    return { stageId: 'x', partIndex: 0, part: 'private' };
  });
  assert.equal(constructed, 0);
});

test('malformed native arguments are captured before parsing failure and failed output is isolated', async () => {
  const events = [];
  const diagnostics = createDiagnostics({
    output: { write: (event) => events.push(event) },
    runId: 'run',
  });
  const provider = {
    async *stream() {
      yield {
        type: 'function-call-delta',
        index: 0,
        id: 'c',
        name: 'answer',
        arguments: '{invalid',
      };
    },
  };
  const tools = new ModelToolRegistry([
    {
      id: 'answer',
      description: 'answer',
      inputSchema: { jsonSchema: { type: 'object' }, parse: (value) => value },
      resolve: (value) => value,
    },
  ]).seal();
  const runner = new ModelRunner({
    provider: provider,
    maxCalls: 1,
    callTimeoutMs: 500,
    execution: { ...{ signal: new AbortController().signal }, diagnostics: diagnostics },
    maxInputChars: 1000,
    maxSchemaChars: 2000,
    transports: [createModelTransport({ id: 'native', tools })],
  });
  await assert.rejects(
    runner.invoke({ stageId: 'draft', input: [], maxOutputTokens: 100, transport: 'native' }),
  );
  // The raw argument text is recorded before the JSON parse fails, so the failure
  // can be diagnosed; the closing `model.end` then carries the error state.
  assert.equal(events.find((e) => e.type === 'model.output').payload.part.arguments, '{invalid');
  assert.equal(events.at(-1).type, 'model.end');
  assert.equal(events.at(-1).payload.state.status, 'error');
  const failing = createDiagnostics({
    output: {
      // The sink itself (for example a disk writer) rejects; the answer is unaffected.
      write: async () => {
        throw new Error('disk');
      },
    },
  });
  const plain = new ModelRunner({
    provider: {
      async *stream() {
        yield 'safe';
      },
    },
    maxCalls: 1,
    callTimeoutMs: 500,
    execution: { ...{ signal: new AbortController().signal }, diagnostics: failing },
    maxInputChars: 1000,
    transports: [textTransport('text', (text) => text, {})],
  });
  assert.equal(
    (await plain.invoke({ stageId: 'draft', input: [], maxOutputTokens: 10, transport: 'text' }))
      .value,
    'safe',
  );
});

test('Support provider observations capture wire failures per call without entering Core diagnostics', async () => {
  const streams = [[], []];
  // Observation state is keyed by the per-call options object, so two concurrent
  // calls cannot write into one list.
  const outputs = new WeakMap(),
    coreEvents = [];
  const provider = new CompatibleModelProvider({
    config: () => ({
      apiKey: 'fixture',
      baseUrl: 'https://model.invalid/v1',
      model: 'test',
      maxOutputTokens: 100,
    }),
    observe: {
      provider: {
        write(event, options) {
          outputs.get(options).push(event);
        },
      },
    },
    ports: {
      request: async () =>
        new Response('data: {bad-json}\n\n', { headers: { 'content-type': 'text/event-stream' } }),
    },
  });
  await Promise.all(
    streams.map(async (events, index) => {
      const options = {
        signal: new AbortController().signal,
        diagnostics: createDiagnostics({
          output: { write: (e) => coreEvents.push(e) },
          runId: 'r' + index,
        }),
      };
      outputs.set(options, events);
      await assert.rejects(
        Array.fromAsync(provider.stream([{ role: 'user', content: 'q' + index }], options)),
      );
      assert.equal(events[0].payload.body.messages[0].content, 'q' + index);
      assert.equal(events.find((e) => e.event === 'provider.frame').payload.data, '{bad-json}');
      assert.equal(events.at(-1).payload.complete, false);
      assert.doesNotMatch(JSON.stringify(events), /Bearer fixture/);
    }),
  );
  assert.deepEqual(coreEvents, []);
});

test('without output the runner does not serialize diagnostic copies and rejections stay observable when enabled', async () => {
  // `toJSON` throws: if a snapshot were taken without an output this call would fail.
  const message = {
    role: 'user',
    content: 'question',
    toJSON() {
      throw new Error('diagnostic snapshot must not run');
    },
  };
  const provider = {
    async *stream() {
      yield 'answer';
    },
  };
  const runner = new ModelRunner({
    provider: provider,
    maxCalls: 1,
    callTimeoutMs: 500,
    execution: { signal: new AbortController().signal },
    maxInputChars: 1000,
    transports: [textTransport('text', (value) => value, {})],
  });
  assert.equal(
    (
      await runner.invoke({
        stageId: 'draft',
        input: [message],
        maxOutputTokens: 10,
        transport: 'text',
      })
    ).value,
    'answer',
  );
  assert.equal(runner.priorInputs.size, 0);
  const events = [];
  const blocked = new ModelRunner({
    provider: provider,
    maxCalls: 0,
    callTimeoutMs: 500,
    execution: {
      ...{ signal: new AbortController().signal },
      diagnostics: createDiagnostics({ output: { write: (event) => events.push(event) } }),
    },
    maxInputChars: 1000,
    transports: [textTransport('text', (value) => value, {})],
  });
  await assert.rejects(
    blocked.invoke({ stageId: 'draft', input: [], maxOutputTokens: 10, transport: 'text' }),
  );
  assert.equal(events[0].type, 'runtime.rejected');
});

test('a diagnostic output can implement its contract with prototype methods and private state', () => {
  class Output {
    #records = [];
    accepts({ content }) {
      return content === 'metadata' && this.#records.length === 0;
    }
    write(event) {
      this.#records.push(event);
    }
    get records() {
      return this.#records;
    }
  }
  const output = new Output();
  const diagnostics = createDiagnostics({ output, runId: 'custom' });
  const child = diagnostics.child('step');
  child.emit('loop.event', () => ({ eventId: 'first', type: 'enter', roundIndex: 0 }));
  child.emit('loop.event', () => assert.fail('filtered payload must stay lazy'));
  assert.equal(output.records.length, 1);
  assert.equal(output.records[0].parentSpanId, 'run');
});

test('diagnostic errors expose one normalized issue list for external error formats', async () => {
  const { diagnosticError, getErrorInfo } = await import('../dist/esm/index.js');
  const original = Object.assign(new Error('external'), {
    errors: [{ code: 'EXTERNAL', message: 'invalid', path: 'field', extra: 'application-detail' }],
  });
  const result = diagnosticError(original);
  assert.equal(Object.hasOwn(result, 'errors'), false);
  assert.deepEqual(result.issues, [{ code: 'EXTERNAL', message: 'invalid', path: ['field'] }]);
  assert.equal(getErrorInfo(original).cause, original);
  assert.equal(original.errors[0].extra, 'application-detail');
});

// Locks `CompatibleModelProvider` SSE handling and request validation: error envelopes, duplicate
// finish, empty JSON, diagnostics on failed bodies, cancellation and body cleanup.
// `node --test` with hand-built `Response` objects; no network is used.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CompatibleModelProvider, ModelRunner, createDiagnostics } from '../dist/esm/index.js';
const config = { baseUrl: 'https://mock.invalid', apiKey: 'mock', model: 'mock' };
const signal = () => new AbortController().signal;
// Build a minimal OpenAI-style SSE frame entry.
const frame = (delta, finish_reason = null) => ({ choices: [{ index: 0, delta, finish_reason }] });
const sse = (chunks) =>
  new Response(
    chunks
      .map((value) => `data: ${typeof value === 'string' ? value : JSON.stringify(value)}\n\n`)
      .join(''),
    { headers: { 'content-type': 'text/event-stream' } },
  );
// One content frame plus the [DONE] sentinel is a complete successful stream.
const success = () => sse([frame({ content: 'ok' }, 'stop'), '[DONE]']);
const collect = (provider, options = {}, messages = []) =>
  Array.fromAsync(provider.stream(messages, { signal: signal(), options }));
test('Provider configuration and option migration errors reject before dispatch', async () => {
  // maxTokens is a removed name; it must fail instead of being silently ignored.
  assert.throws(
    () => new CompatibleModelProvider({ config: { ...config, maxTokens: 7 } }),
    /maxOutputTokens/,
  );
  await assert.rejects(
    collect(new CompatibleModelProvider({ config: () => ({ ...config, maxTokens: 7 }) })),
    /maxOutputTokens/,
  );
  await assert.rejects(
    collect(new CompatibleModelProvider({ config }), { maxTokens: 7 }),
    /maxOutputTokens/,
  );
  await assert.rejects(
    collect(new CompatibleModelProvider({ config: { ...config, apiKey: '' } })),
    /MODEL_NOT_CONFIGURED/,
  );
});
test('Provider adds JSON instructions only when required and can use the default fetch port', async (t) => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    requests.push(JSON.parse(init.body));
    return success();
  });
  const provider = new CompatibleModelProvider({ config, ports: { ensureJsonInstruction: true } });
  for (const messages of [
    [],
    [{ role: 'user', content: 'JSON' }],
    [{ role: 'assistant', content: 'JSON' }],
  ])
    await collect(provider, { json: true }, messages);
  // A JSON system instruction is prepended only when no user message opens the conversation.
  assert.equal(requests[0].messages[0].role, 'system');
  assert.equal(requests[1].messages.length, 1);
  assert.equal(requests[2].messages[0].role, 'system');
  assert.deepEqual(requests[0].response_format, { type: 'json_object' });
});
test('Provider distinguishes upstream error envelopes, duplicate finish and allowed empty JSON', async () => {
  for (const [chunks, code] of [
    // An error envelope maps to MODEL_UPSTREAM; a second finish_reason is a protocol error.
    [[{ error: { message: 'upstream' } }], 'MODEL_UPSTREAM'],
    [[frame({ content: 'ok' }, 'stop'), frame({}, 'stop')], 'MODEL_PROTOCOL'],
  ]) {
    await assert.rejects(
      collect(new CompatibleModelProvider({ config, ports: { request: async () => sse(chunks) } })),
      (error) => error.code === code,
    );
  }
  assert.deepEqual(
    await collect(
      new CompatibleModelProvider({
        config,
        // Empty JSON is only permitted when explicitly opted in.
        ports: { request: async () => sse([frame({}, 'stop'), '[DONE]']), allowEmptyJson: true },
      }),
      { json: true },
    ),
    [],
  );
});
test('HTTP diagnostics tolerate absent bodies, stalled reads and failing body cleanup', async () => {
  const observations = [];
  const provider = (body) =>
    new CompatibleModelProvider({
      config,
      observe: { provider: { accepts: () => true, write: (event) => observations.push(event) } },
      ports: { request: async () => ({ status: 503, ok: false, headers: new Headers(), body }) },
    });
  await assert.rejects(collect(provider(null)), /MODEL_UPSTREAM/);
  // A 503 with no body still records a diagnostic with an empty, untruncated body.
  assert.ok(
    observations.some(
      (event) =>
        event.event === 'provider.error-body' &&
        event.payload.body === '' &&
        event.payload.truncated === false,
    ),
  );
  let cancelled = 0;
  await assert.rejects(
    collect(
      provider({
        getReader() {
          return {
            read: () => new Promise(() => {}),
            cancel() {
              cancelled++;
              return Promise.reject(Error('cleanup'));
            },
            releaseLock() {
              throw Error('pending read');
            },
          };
        },
      }),
    ),
    /MODEL_UPSTREAM/,
  );
  // cancel() is attempted once even though it fails; the upstream error still wins.
  assert.equal(cancelled, 1);
  const controller = new AbortController(),
    reason = Error('cancelled');
  const late = new CompatibleModelProvider({
    config,
    ports: {
      request: async () => {
        controller.abort(reason);
        return {
          body: {
            cancel() {
              throw Error('cleanup');
            },
          },
        };
      },
    },
  });
  await assert.rejects(
    Array.fromAsync(late.stream([], { signal: controller.signal })),
    (error) => error === reason,
  );
});
test('false-valued provider and model failures remain visible in terminal diagnostics', async () => {
  const observed = [];
  const provider = new CompatibleModelProvider({
    config,
    observe: { provider: { accepts: () => true, write: (event) => observed.push(event) } },
    ports: {
      request: async () => {
        throw false;
      },
    },
  });
  await collect(provider).then(
    () => assert.fail(),
    (error) => assert.equal(error, false),
  );
  // A non-Error falsy rejection keeps its exact value but is stringified for diagnostics.
  assert.equal(
    observed.find((event) => event.event === 'provider.end').payload.error.message,
    'false',
  );
  const output = [],
    runner = new ModelRunner({ execution: {},
      provider: {
        async *stream() {
          throw false;
        },
      },
      sink: { output: (event) => output.push(event) },
    });
  await runner.invoke('question').then(
    () => assert.fail(),
    (error) => assert.equal(error, false),
  );
  assert.equal(output.find((event) => event.type === 'model.end').payload.error.message, 'false');
});
test('dynamic preparation cannot spend a shared parent call twice and late input cancellation skips the Provider', async () => {
  const parent = new ModelRunner({ execution: {},
    maxCalls: 1,
    children: { maxConcurrentCalls: 2 },
    provider: {
      async *stream() {
        yield 'ok';
      },
    },
  });
  let taken;
  const child = parent.createChild({
    id: 'child',
    maxCalls: 1,
    reserveCalls: 0,
    timeoutMs: 1000,
    transports: [
      {
        id: 'dynamic',
        prepare() {
          // Preparation spends the only parent call, leaving none for the child invocation.
          taken = parent.invoke('reserve');
          return {
            schemaChars: 0,
            options: {},
            createResponse() {
              assert.fail('budget already consumed');
            },
          };
        },
      },
    ],
  });
  await assert.rejects(
    child.invoke({ input: 'x', transport: 'dynamic' }),
    (error) => error.code === 'BUDGET',
  );
  await taken;
  assert.equal(child.callCount, 0);
  const controller = new AbortController(),
    reason = Error('late cancellation');
  const runner = new ModelRunner({
    provider: {
      async *stream() {
        assert.fail();
      },
    },
    execution: { signal: controller.signal },
  });
  await assert.rejects(
    runner.invoke({
      input: [
        {
          role: 'user',
          get content() {
            controller.abort(reason);
            return 'valid';
          },
        },
      ],
    }),
    (error) => error === reason,
  );
});
test('model diagnostics fail independently from input budgets and the committed value', async (t) => {
  const events = [],
    original = JSON.stringify;
  // Break only the diagnostic serializer so budgets and the value stay unaffected.
  t.mock.method(JSON, 'stringify', (value, ...args) => {
    if (value?.messages && value?.interaction) throw Error('diagnostic serializer failed');
    return original(value, ...args);
  });
  const runner = new ModelRunner({
    provider: {
      async *stream() {
        yield 'ok';
      },
    },
    execution: {
      diagnostics: createDiagnostics({ output: { write: (event) => events.push(event) } }),
    },
  });
  const result = await runner.invoke({
    input: {
      messages: [{ role: 'user', content: 'question' }],
      fragmentUsage: [],
      inputChars: 8,
      maxInputChars: 100,
    },
  });
  assert.equal(result.value, 'ok');
  assert.equal(runner.lastCall.context.stablePrefixChars, 0);
  const failure = Error('input budget');
  await assert.rejects(
    new ModelRunner({ execution: {},
      provider: {
        async *stream() {
          assert.fail();
        },
      },
      maxInputChars: 1,
      errors: { inputBudget: () => failure },
    }).invoke('long'),
    (error) => error === failure,
  );
});
test('model calls reject legacy or invalid request fields using their registered configuration errors', async () => {
  const runner = new ModelRunner({ execution: {},
    provider: {
      async *stream() {
        assert.fail();
      },
    },
  });
  // Legacy names (`stage`, `transportId`, `prompt`) are configuration errors, not aliases.
  for (const patch of [
    { stage: 'old' },
    { stageId: '' },
    { transportId: 'old' },
    { transport: '' },
    { prompt: 'old' },
    { instructions: 7 },
    { input: [], instructions: 'not allowed' },
  ])
    await assert.rejects(runner.invoke({ input: 'question', ...patch }));
});

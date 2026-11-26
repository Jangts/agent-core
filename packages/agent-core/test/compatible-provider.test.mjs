/*
 * Wire contract for `CompatibleModelProvider`: OpenAI-compatible streaming and
 * the failure classifications the rest of the stack relies on.
 *
 * The framing rules are the important part. A stream is only complete when the
 * terminal frame arrives after content; a usage-only frame, `[DONE]`, a repeated
 * finish reason, late content, malformed JSON or a truncated tool stream are all
 * separate protocol errors. HTTP statuses map to a small code set without
 * forwarding response bodies or the API key, and host extensions
 * (`requestBody`) may add fields but never override bound input, model or budget.
 *
 * Runs on `dist/esm` with fake `Response` objects; `model.invalid` is never
 * contacted and `fixture-secret` is a placeholder.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { CompatibleModelProvider, getErrorInfo } from '../dist/esm/index.js';
const signal = () => new AbortController().signal;
const config = {
  baseUrl: 'https://model.invalid/v1/',
  apiKey: 'fixture-secret',
  model: 'fixture-model',
  maxOutputTokens: 1000,
};
// Each event becomes one `data:` line followed by a blank line; strings are sent
// raw so `[DONE]` and deliberately invalid JSON reach the parser untouched.
const frames = (events) =>
  new Response(
    events
      .map(
        (event) => 'data: ' + (typeof event === 'string' ? event : JSON.stringify(event)) + '\n\n',
      )
      .join(''),
    { headers: { 'content-type': 'text/event-stream' } },
  );
const content = (text, finish_reason) => ({
  choices: [{ index: 0, delta: { content: text }, ...(finish_reason ? { finish_reason } : {}) }],
});
const collect = (provider) =>
  Array.fromAsync(
    provider.stream([{ role: 'user', content: 'hello' }], {
      signal: signal(),
      options: { includeUsage: true },
    }),
  );

test('shared provider owns request formatting, usage-only frames, Unicode and normal completion', async () => {
  let body;
  let usage;
  const provider = new CompatibleModelProvider({
    config: () => config,
    ports: {
      request: async (url, request) => {
        assert.equal(url, 'https://model.invalid/v1/chat/completions');
        assert.equal(request.redirect, 'error');
        body = JSON.parse(request.body);
        return frames([
          content('你好🙂'),
          content('', 'stop'),
          // A usage-only frame (empty choices) is legal and must only feed usage,
          // not be read as a content or termination frame.
          { choices: [], usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 } },
          '[DONE]',
        ]);
      },
    },
  });
  assert.deepEqual(
    await Array.fromAsync(
      provider.stream([], {
        signal: signal(),
        options: {
          includeUsage: true,
          maxOutputTokens: 2000,
          onUsage: (value) => {
            usage = value;
          },
        },
      }),
    ),
    ['你好🙂'],
  );
  // The per-call option cannot raise the configured ceiling of 1000 tokens.
  assert.equal(body.max_tokens, 1000);
  assert.equal(body.fixture_option, undefined);
  assert.equal(usage.totalTokens, 3);
});

test('completion state rejects EOF, repeated termination, late content, malformed chunks and data after failure', async () => {
  // Each row is a distinct framing defect; the four allowed codes keep a truncated
  // stream distinguishable from malformed JSON or a hard output-length stop.
  for (const events of [
    [content('partial')],
    [content('x', 'stop')],
    [content('x'), '[DONE]'],
    [content('x', 'stop'), content('y'), '[DONE]'],
    [content('x', 'stop'), content('', 'stop'), '[DONE]'],
    ['invalid-json'],
    [null],
    [{ choices: {} }],
    [content('x', 'length'), '[DONE]'],
  ]) {
    let failure;
    const provider = new CompatibleModelProvider({
      config: () => config,
      errors: {
        failure: (value) => {
          failure = value;
          return Object.assign(new Error(value.code), value);
        },
      },
      ports: { request: async () => frames(events) },
    });
    await assert.rejects(collect(provider));
    assert.ok(
      ['MODEL_INCOMPLETE', 'MODEL_PROTOCOL', 'MODEL_FORMAT', 'MODEL_OUTPUT_LIMIT'].includes(
        failure.code,
      ),
    );
  }
});

test('HTTP classification exposes only codes/status and never forwards private bodies or credentials', async () => {
  for (const [status, code] of [
    [401, 'MODEL_AUTH'],
    [403, 'MODEL_AUTH'],
    [402, 'MODEL_BALANCE'],
    [400, 'MODEL_CONFIG'],
    [404, 'MODEL_CONFIG'],
    [429, 'MODEL_BUSY'],
    [500, 'MODEL_UPSTREAM'],
  ]) {
    const provider = new CompatibleModelProvider({
      config: () => config,
      ports: { request: async () => new Response('private database body and secret', { status }) },
    });
    // The upstream body must not reach the error message, only the status/code pair.
    await assert.rejects(
      collect(provider),
      (error) =>
        error.code === code && error.status === status && !error.message.includes('secret'),
    );
  }
});

test('wire extensions are explicit host configuration and never inferred from provider metadata', async () => {
  let requests = 0;
  for (const requestBody of [undefined, { fixture_option: { mode: 'custom' } }]) {
    const provider = new CompatibleModelProvider({
      config: () => ({ ...config, provider: 'foreign-vendor', requestBody }),
      ports: {
        request: async (_url, request) => {
          requests++;
          assert.deepEqual(JSON.parse(request.body).fixture_option, requestBody?.fixture_option);
          return frames([content('hi', 'stop'), '[DONE]']);
        },
      },
    });
    await collect(provider);
  }
  assert.equal(requests, 2);
});

test('raw transport and body stream failures keep their identity and are classified as upstream', async () => {
  for (const bodyFailure of [false, true]) {
    const failure = new Error('synthetic transport failure');
    const provider = new CompatibleModelProvider({
      config: config,
      ports: {
        request: async () => {
          if (!bodyFailure) throw failure;
          return new Response(
            new ReadableStream({
              start(controller) {
                controller.error(failure);
              },
            }),
            { headers: { 'content-type': 'text/event-stream' } },
          );
        },
      },
    });
    await assert.rejects(
      collect(provider),
      (error) => error === failure && getErrorInfo(error).codes.includes('MODEL_UPSTREAM'),
    );
  }
});

test('Support provider rejects request extensions that replace bound input or budget', async () => {
  for (const key of [
    'model',
    'messages',
    'stream',
    'max_tokens',
    'max_completion_tokens',
    'toJSON',
  ]) {
    const invalid = { ...config, requestBody: { [key]: 'override' } };
    assert.throws(() => new CompatibleModelProvider({ config: invalid }), /cannot override/);
    let requests = 0;
    const provider = new CompatibleModelProvider({
      config: () => invalid,
      ports: {
        request: async () => {
          requests++;
          return frames([]);
        },
      },
    });
    await assert.rejects(collect(provider), /cannot override/);
    // The conflict is detected while building the request, so the transport port is
    // never invoked.
    assert.equal(requests, 0);
  }
});

test('Support provider accepts a request port implemented with prototype methods and private state', async () => {
  class Connection {
    #calls = 0;
    async request() {
      this.#calls++;
      return frames([content(String(this.#calls), 'stop'), '[DONE]']);
    }
  }
  const provider = new CompatibleModelProvider({ config, ports: new Connection() });
  assert.deepEqual(await collect(provider), ['1']);
  assert.deepEqual(await collect(provider), ['2']);
});

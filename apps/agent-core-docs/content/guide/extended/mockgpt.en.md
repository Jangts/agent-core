---
title: Offline verification with MockGPT
description: Wire MockGPT into a normal ChatProvider, tool loop and HTTP tests to cover streaming, failures and cancellation without a real model.
---

# Offline verification with MockGPT

MockGPT is the SDK's built-in model simulator. It returns fixed content, generator output or explicit failures according to declared rules, so you can verify protocols, tool selection, streaming, failures and cancellation. It does not perform real inference and must not be used to judge answer quality.

The API, generators and error codes live in [MockGPT API](/manual/api/mock). This article covers how to use it, where to plug it in, and what to assert. Examples use TypeScript; remove the type annotations for JavaScript.

## Three ways to connect

| What you want to verify | Entry point | Notes |
| --- | --- | --- |
| A piece of generation logic | `new MockGPT({ rules }).generate(...)` | Creates no HTTP object; returns a generated value |
| Core model calls | `Support.CompatibleModelProvider` + `mock.fetch` | Core only sees a normal `ChatProvider` |
| An existing HTTP client | `createMockServer` or `createMockHandler` | Speaks the Chat Completions route; can mount on an existing server |
| A browser or custom client | Inject `mock.fetch` as `fetch` | No global network interception |

### Generate directly

```ts
import { MockGPT } from '@jangts/agent-core/mock';

const mock = new MockGPT({
  rules: [{ prompt: 'hello', generator: 'Offline reply.' }],
});
const output = await mock.generate({
  model: 'demo',
  messages: [{ role: 'user', content: 'hello' }],
});
console.log(output);
```

`generate` only produces a value. For status codes, SSE or transport failures, use a `responses` description and let the caller interpret it.

### Drive Core model calls

```ts
import { ModelRunner, Support } from '@jangts/agent-core';
import { MockGPT } from '@jangts/agent-core/mock';

const mock = new MockGPT({ rules: [{ prompt: 'hello', generator: 'Offline reply' }] });
const provider = new Support.CompatibleModelProvider({
  config: { baseUrl: 'https://mock.local/v1', apiKey: 'offline-example', model: 'demo' },
  ports: { request: mock.fetch },
});
const model = new ModelRunner({ provider });
const result = await model.invoke({ input: 'hello' });
console.log(result.value, result.invocation.status);
```

Core never knows MockGPT is involved. Budgets, cancellation and protocol parsing still take the normal path, so you are testing the real call chain rather than a parallel test-only branch.

### Run as an HTTP server

```ts
import { createMockServer } from '@jangts/agent-core/mock/node';
import { MockGPT } from '@jangts/agent-core/mock';

const mock = new MockGPT({ rules: [{ generator: 'Offline reply' }] });
const server = createMockServer({ mock });
const address = await server.listen({ port: 0 });
console.log(address.url);
await server.close();
```

Only `POST /v1/chat/completions` and `/chat/completions` are supported, with `n=1`. The server binds to loopback by default. Configure `allowedHosts` and `allowedOrigins` explicitly when a proxy or cross-origin client is involved; wildcards are not supported.

## Describe protocols with rules

- Rules match in declaration order; the first rule that satisfies every condition and has remaining hits wins.
- `prompt` accepts an exact string or a regular expression. `model` limits the model name. `when(request)` is a synchronous boolean predicate. `times` caps hits.
- When nothing matches, `fallback` is used. Without either, the call fails with `MOCK_RULE_NOT_FOUND`; it never forwards to a real model.
- A generator can be a fixed value, a function, or a `responses.*` description. Callbacks receive `request`, `match`, `callIndex`, `ruleIndex`, `signal`, `random`, `clock` and `report`.

```ts
import { MockGPT, generators } from '@jangts/agent-core/mock';

const mock = new MockGPT({
  rules: [
    { prompt: /summar/, generator: generators.summary({ maxChars: 120 }) },
    { prompt: 'user profile', generator: ({ callIndex }) => ({ callIndex }) },
  ],
  fallback: 'No matching rule.',
});
```

Keep one rule per verifiable behavior. Fewer, sharper rules make failures easier to locate than one broad regular expression.

## Cover failures, streaming and cancellation

```ts
import { MockGPT, responses } from '@jangts/agent-core/mock';

const mock = new MockGPT({
  rules: [
    { prompt: 'rate limit', generator: responses.httpError(429, { error: { message: 'limited' } }) },
    { prompt: 'network down', generator: responses.reject('simulated network failure') },
    { prompt: 'slow', generator: responses.text('streaming output', { chunkSize: 1, intervalMs: 10 }) },
    {
      prompt: 'interrupt',
      generator: responses.text('truncated', { chunkSize: 1, interruptAfter: 2 }),
    },
    {
      prompt: 'lookup order',
      generator: responses.toolCalls([{ name: 'lookup', arguments: { id: 'demo' } }]),
    },
  ],
});
```

- `responses.toolCalls` proposes a tool call; it never executes one. Authorization and execution remain the App's tool registry work.
- `interruptAfter` stops after the given frame without sending a successful terminator.
- `delayMs` controls the first-byte delay and `intervalMs` the frame interval. Neither changes real timeout settings.
- Cancellation flows through `generate(input, { signal })` or the request signal. External side effects that already happened are not rolled back.

## Write regression tests

Test protocols and boundaries, not wording. Useful assertions include:

- `mock.counts` and `mock.records`: rule hits, call status and error codes.
- `mock.activeRequests`: streams that have not finished.
- The `generate` result: text, JSON or a `ResponseDescription` snapshot.
- The `Response` status, SSE frames and interruption behavior from `mock.fetch`.

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { MockGPT, responses } from '@jangts/agent-core/mock';

test('fails explicitly when no rule matches', async () => {
  const mock = new MockGPT({ rules: [] });
  await assert.rejects(
    mock.generate({ model: 'demo', messages: [{ role: 'user', content: 'hello' }] }),
    (error) => (error as { code?: string }).code === 'MOCK_RULE_NOT_FOUND',
  );
});

test('a tool proposal produces no execution result', async () => {
  const mock = new MockGPT({
    rules: [
      {
        prompt: 'lookup order',
        generator: responses.toolCalls([{ name: 'lookup', arguments: { id: 'demo' } }]),
      },
    ],
  });
  const output = await mock.generate({
    model: 'demo',
    messages: [{ role: 'user', content: 'lookup order' }],
  });
  assert.equal(mock.records.at(-1)?.status, 'completed');
  assert.ok(JSON.stringify(output).includes('lookup'));
});
```

Do not assert real semantic quality, un-fixed call order, or random details inside a generator. MockGPT cannot prove those facts.

## Determinism

A fixed `seed` reproduces output only when call order, `clock` and callback state stay fixed too. Give concurrent tests separate instances rather than sharing records and rule counts. `reset()` is rejected with `MOCK_ACTIVE` while requests are still active.

## Boundaries

- **No network by default**: `sources.web` is an explicit opt-in; leave it off in regular tests.
- **No forwarding**: when no rule matches, the call fails instead of quietly hitting a real endpoint.
- **No quality judgment**: fixed replies and text algorithms verify structure, not meaning.
- **No authorization**: tool proposals, HTTP statuses and model output are not permissions.
- **No global fetch interception**: bind `mock.fetch` explicitly so other requests in the process are unaffected.

## Common mistakes

| Symptom | Cause | Fix |
| --- | --- | --- |
| The first rule always wins | Rules are ordered | Put the more specific rule first, or add `model` / `when` |
| Results differ between runs | `seed` is fixed but order, clock or external state is not | Fix call order and `clock`; isolate instances |
| Tests reach the real network | A web source or real fetch was injected | Disable web sources and inject only `mock.fetch` |
| A tool actually ran | `toolCalls` was treated as an execution result | Execution still belongs to the App's tool registry and authorization |

## Next

- Understand tool calls and receipts: [Tool integration](/manual/basic-usage).
- Fold offline checks into the full integration review: [Acceptance](/manual/acceptance).
- Check generators, response descriptions and HTTP details: [MockGPT API](/manual/api/mock).

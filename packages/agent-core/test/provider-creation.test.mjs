/**
 * Locks down `CompatibleModelProvider` construction and request shaping: static
 * connections are snapshotted, dynamic config callbacks stay live, prototype getters are
 * accepted, and invalid output allowances fail before any HTTP dispatch. Uses node --test
 * with a captured request body and a fixture SSE response instead of a real provider.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CompatibleModelProvider,
  ModelRunner,
  modelRunnerDefaults,
  Support,
} from '../dist/esm/index.js';
const connection = () => ({
  baseUrl: 'https://model.invalid/v1',
  apiKey: 'fixture-key',
  model: 'fixture-model',
});
function requestSpy(bodies) {
  return async (url, init) => {
    bodies.push({ url, body: JSON.parse(init.body) });
    return new Response(
      'data: {"choices":[{"index":0,"delta":{"content":"hello"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
      { headers: { 'content-type': 'text/event-stream' } },
    );
  };
}
test('a static connection and Core runner perform the minimal real-provider path with default limits', async () => {
  const bodies = [];
  const provider = new CompatibleModelProvider({
    config: connection(),
    ports: { request: requestSpy(bodies) },
  });
  assert.equal((await new ModelRunner({ provider }).invoke('hello')).value, 'hello');
  assert.equal(bodies[0].url, 'https://model.invalid/v1/chat/completions');
  assert.equal(bodies[0].body.model, 'fixture-model');
  // An omitted ceiling defers to the per-call limit; an explicit ceiling still caps it.
  assert.equal(bodies[0].body.max_tokens, modelRunnerDefaults.maxOutputTokens);
  assert.equal(CompatibleModelProvider, Support.CompatibleModelProvider);
});
test('omitting a provider ceiling respects per-call limits; explicit ceilings still cap calls', async () => {
  for (const ceiling of [undefined, 20]) {
    const bodies = [];
    const provider = new CompatibleModelProvider({
      config: { ...connection(), maxOutputTokens: ceiling },
      ports: { request: requestSpy(bodies) },
    });
    (await new ModelRunner({ provider }).invoke({ input: 'hello', maxOutputTokens: 2000 })).value;
    assert.equal(bodies[0].body.max_tokens, ceiling ?? 2000);
  }
});
test('static connections snapshot configuration while existing callbacks stay dynamic', async () => {
  const bodies = [];
  const config = connection();
  const provider = new CompatibleModelProvider({
    config: config,
    ports: { request: requestSpy(bodies) },
  });
  config.model = 'changed';
  (await new ModelRunner({ provider }).invoke('hello')).value;
  // Static connections capture their fields at construction, so the mutation is ignored.
  assert.equal(bodies[0].body.model, 'fixture-model');
  const dynamic = new CompatibleModelProvider({
    config: () => config,
    ports: { request: requestSpy(bodies) },
  });
  (await new ModelRunner({ provider: dynamic }).invoke('hello')).value;
  assert.equal(bodies[1].body.model, 'changed');
});

test('provider configuration and call options accept prototype getters', async () => {
  const bodies = [];
  class Connection {
    get baseUrl() {
      return 'https://model.invalid/v1';
    }
    get apiKey() {
      return 'fixture';
    }
    get model() {
      return 'fixture-model';
    }
    get maxOutputTokens() {
      return 80;
    }
  }
  class Options {
    get maxOutputTokens() {
      return 30;
    }
  }
  const provider = new CompatibleModelProvider({
    config: new Connection(),
    ports: { request: requestSpy(bodies) },
  });
  // Prototype getters are legal configuration sources; the per-call option wins over the
  // provider-level ceiling (30 < 80).
  await Array.fromAsync(
    provider.stream([], { signal: new AbortController().signal, options: new Options() }),
  );
  assert.equal(bodies[0].body.model, 'fixture-model');
  assert.equal(bodies[0].body.max_tokens, 30);
});

test('provider rejects invalid static, dynamic and direct-call output allowances before HTTP', async () => {
  // Every non-positive or non-integral allowance must fail in all three declaration shapes.
  for (const maxOutputTokens of [0, -1, NaN, Infinity, 1.5]) {
    let calls = 0;
    const ports = {
      request: async () => {
        calls++;
        throw new Error('unexpected HTTP');
      },
    };
    assert.throws(
      () => new CompatibleModelProvider({ config: { ...connection(), maxOutputTokens }, ports }),
      /positive safe integer/,
    );
    const dynamic = new CompatibleModelProvider({
      config: () => ({ ...connection(), maxOutputTokens }),
      ports,
    });
    await assert.rejects(
      Array.fromAsync(dynamic.stream([], { signal: new AbortController().signal })),
      /positive safe integer/,
    );
    const provider = new CompatibleModelProvider({ config: connection(), ports });
    await assert.rejects(
      Array.fromAsync(
        provider.stream([], { signal: new AbortController().signal, options: { maxOutputTokens } }),
      ),
      /positive safe integer/,
    );
    // Validation happens before the request port runs: zero dispatches in all cases.
    assert.equal(calls, 0);
  }
});

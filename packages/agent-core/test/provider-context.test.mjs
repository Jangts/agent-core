/**
 * Locks down how Support provider observation attaches to the caller's execution context.
 * Covers `Support.createProviderObservationScope`, `Support.CompatibleModelProvider`
 * observation and `ModelRunner` invocation spans. Runs under node --test against the built
 * dist/esm output with a fixture SSE transport, so no network is involved.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ModelRunner, Support, createDiagnostics } from '../dist/esm/index.js';

const response = () =>
  new Response(
    'data: {"choices":[{"index":0,"delta":{"content":"done"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
    {
      headers: { 'content-type': 'text/event-stream' },
    },
  );

test('provider observations retain the original context and attached owner without an options diagnostic field', async () => {
  const observed = [],
    delivered = [];
  const scope = Support.createProviderObservationScope({
    write(owner, event, spanId) {
      delivered.push({ owner, event, spanId });
    },
  });
  // The throwing getter proves execution diagnostics are read from the context, never
  // from noncontract option metadata that happens to reuse the field name.
  class Options {
    get maxOutputTokens() {
      return 20;
    }
    get diagnostics() {
      throw new Error('Noncontract options metadata must not replace the execution context');
    }
  }
  const diagnostics = scope.attach(createDiagnostics({ runId: 'owner' }), 'owner').child('model');
  const context = { signal: new AbortController().signal, diagnostics, options: new Options() };
  const provider = new Support.CompatibleModelProvider({
    config: { baseUrl: 'https://fixture.invalid', apiKey: 'fixture', model: 'fixture' },
    ports: { request: async () => response() },
    observe: {
      provider: {
        accepts: scope.observer.accepts.bind(scope.observer),
        write(event, actual) {
          observed.push(actual);
          return scope.observer.write(event, actual);
        },
      },
    },
  });
  assert.deepEqual(await Array.fromAsync(provider.stream([], context)), ['done']);
  assert.ok(observed.length > 0);
  // Observers must receive the very same context object, not a structural copy.
  assert.ok(observed.every((actual) => actual === context));
  // Each observation keeps the attached owner and the exact child span identity.
  assert.ok(
    delivered.every(
      (value) => value.owner === 'owner' && value.spanId === diagnostics.identity.spanId,
    ),
  );
  assert.equal(delivered.at(-1).event.payload.complete, true);
});

test('Runner invocation spans preserve per-request provider ownership through the execution context', async () => {
  const delivered = [],
    contexts = [];
  const scope = Support.createProviderObservationScope({
    write(owner, event, spanId) {
      delivered.push({ owner, event, spanId });
    },
  });
  const provider = new Support.CompatibleModelProvider({
    config: { baseUrl: 'https://fixture.invalid', apiKey: 'fixture', model: 'fixture' },
    ports: { request: async () => response() },
    observe: {
      provider: {
        accepts: scope.observer.accepts.bind(scope.observer),
        write(event, context) {
          contexts.push(context);
          return scope.observer.write(event, context);
        },
      },
    },
  });
  await Promise.all(
    ['one', 'two'].map(async (owner) => {
      const diagnostics = scope.attach(createDiagnostics({ runId: owner }), owner).child('node');
      const model = new ModelRunner({ provider, execution: { diagnostics } });
      assert.equal((await model.invoke('question')).value, 'done');
    }),
  );
  for (const owner of ['one', 'two']) {
    const events = delivered.filter((value) => value.owner === owner);
    assert.ok(events.length > 0);
    // Runner-issued spans are nested under the run and the invoking node.
    assert.ok(events.every((value) => value.spanId.startsWith('run/node/')));
    assert.equal(events.at(-1).event.payload.complete, true);
  }
  // Diagnostics stay on the context and must not leak into the provider option bag.
  assert.ok(
    contexts.every((context) => context.diagnostics && !('diagnostics' in context.options)),
  );
});

// Locks provider configuration snapshotting: getters and dynamic `requestBody` are read once,
// protected request keys cannot be overridden, and cancellation during resolution keeps its reason.
// Covers `Support.CompatibleModelProvider`; `node --test` with an in-memory request port.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Support } from '../dist/esm/index.js';
const base = { baseUrl: 'https://fixture.invalid', apiKey: 'fixture', model: 'expected' };
// One content frame plus [DONE], enough to complete a call.
const response = () =>
  new Response(
    'data: {"choices":[{"index":0,"delta":{"content":"ok"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
    { headers: { 'content-type': 'text/event-stream' } },
  );
function fixture(config) {
  const bodies = [];
  const provider = new Support.CompatibleModelProvider({
    config,
    ports: {
      async request(_url, init) {
        bodies.push(JSON.parse(init.body));
        return response();
      },
    },
  });
  return {
    bodies,
    invoke: (signal) =>
      Array.fromAsync(
        provider.stream([], {
          signal: signal ?? new AbortController().signal,
          options: { maxOutputTokens: 7 },
        }),
      ),
  };
}

test('dynamic request extensions are read once and cannot change between validation and I/O', async () => {
  let reads = 0;
  const source = {
    ...base,
    get requestBody() {
      // The first read is a stable config; later reads would override model and max_tokens.
      return ++reads <= 12 ? {} : { model: 'overridden', max_tokens: 99999 };
    },
  };
  const { bodies, invoke } = fixture(() => source);
  await invoke();
  assert.equal(reads, 1);
  assert.equal(bodies[0].model, 'expected');
  assert.equal(bodies[0].max_tokens, 7);
});

test('static and dynamic getters snapshot one coherent provider configuration', async () => {
  for (const dynamic of [false, true]) {
    const reads = {};
    const source = Object.defineProperties(
      {},
      Object.fromEntries(
        Object.entries({
          ...base,
          maxOutputTokens: 5,
          temperature: 0,
          requestBody: {},
          reasoning: { format: 'reasoning-effort', level: 'low' },
        }).map(([key, value]) => [
          key,
          {
            get() {
              reads[key] = (reads[key] ?? 0) + 1;
              return reads[key] === 1 ? value : key === 'maxOutputTokens' ? -1 : value;
            },
          },
        ]),
      ),
    );
    const { bodies, invoke } = fixture(dynamic ? () => source : source);
    await invoke();
    // Every getter is read exactly once; a second maxOutputTokens read would yield -1.
    assert.ok(Object.values(reads).every((count) => count === 1));
    assert.equal(bodies[0].max_tokens, 5);
    assert.equal(bodies[0].temperature, 0);
  }
});

test('materialized mapper fields cannot hide protected keys in getters', async () => {
  const source = {
    ...base,
    reasoning: {
      format: 'custom',
      level: 'high',
      map() {
        return {
          get model() {
            return 'bad';
          },
        };
      },
    },
  };
  const dynamic = fixture(() => source);
  // Mapper output is materialized but may not override protected request keys.
  await assert.rejects(dynamic.invoke(), /cannot override model/);
  assert.equal(dynamic.bodies.length, 0);
});

test('cancellation in configuration resolution, getters or mapper retains the exact reason and skips I/O', async () => {
  // Abort in each resolution phase must surface the same reason and avoid any request.
  for (const phase of ['config', 'getter', 'mapper', 'mapper-throw', 'extension']) {
    const controller = new AbortController(),
      reason = new Error(phase);
    let mapperCalls = 0;
    const source = {
      ...base,
      reasoning: {
        format: 'custom',
        level: 'high',
        map() {
          mapperCalls++;
          if (phase.startsWith('mapper')) {
            controller.abort(reason);
            if (phase === 'mapper-throw') throw new Error('later error');
          }
          return { model: 'bad' };
        },
      },
    };
    if (phase === 'getter')
      Object.defineProperty(source, 'model', {
        get() {
          controller.abort(reason);
          return 'expected';
        },
      });
    if (phase === 'extension')
      source.requestBody = {
        get arbitrary() {
          controller.abort(reason);
          return true;
        },
      };
    const sample = fixture(() => {
      if (phase === 'config') controller.abort(reason);
      return source;
    });
    await assert.rejects(sample.invoke(controller.signal), (error) => error === reason);
    assert.equal(sample.bodies.length, 0);
    assert.equal(mapperCalls, phase.startsWith('mapper') ? 1 : 0);
  }
});

test('option getters that cancel cannot replace the original reason with option validation errors', async () => {
  // An option getter may abort and then return an invalid value or throw; the abort reason wins.
  for (const phase of ['invalid-limit', 'throwing-getter', 'context-getter']) {
    const controller = new AbortController(),
      reason = new Error(phase);
    let configurations = 0,
      requests = 0;
    const provider = new Support.CompatibleModelProvider({
      config() {
        configurations++;
        return base;
      },
      ports: {
        async request() {
          requests++;
          return response();
        },
      },
    });
    const context = {
      signal: controller.signal,
      options: {
        get maxOutputTokens() {
          controller.abort(reason);
          if (phase === 'throwing-getter') throw new Error('secondary option error');
          return -1;
        },
      },
    };
    if (phase === 'context-getter')
      Object.defineProperty(context, 'options', {
        get() {
          controller.abort(reason);
          return { maxOutputTokens: -1 };
        },
      });
    await assert.rejects(
      Array.fromAsync(provider.stream([], context)),
      (error) => error === reason,
    );
    // A cancelled option read never reaches config resolution or the request port.
    assert.equal(configurations, 0);
    assert.equal(requests, 0);
  }
});

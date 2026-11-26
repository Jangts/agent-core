// Locks the optional MockGPT endpoint as consumed through the real `CompatibleModelProvider` and
// `ModelRunner`, including failure classification and request cleanup.
// Runs with `node --test`; no network or HTTP server is involved.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ModelRunner, CompatibleModelProvider } from '../dist/esm/index.js';
import { MockGPT, responses } from '../dist/esm/mock.js';
// A non-routable base URL proves the mock port supplies all I/O.
const config = { baseUrl: 'https://mock.invalid/v1', apiKey: 'mock', model: 'demo' };
test('MockGPT is an optional API endpoint consumed through the real Provider and ModelRunner', async () => {
  const mock = new MockGPT({ rules: [{ prompt: '你好', generator: '你好！' }] });
  const runner = new ModelRunner({
    provider: new CompatibleModelProvider({ config: config, ports: { request: mock.fetch } }),
  });
  assert.equal((await runner.invoke('你好')).value, '你好！');
  // The request record reaches a terminal state once its response is consumed.
  assert.equal(mock.records[0].status, 'completed');
});
test('real Provider retains failure classification when simulated HTTP and truncated streams fail', async () => {
  const mock = new MockGPT({
    rules: [
      // 429 must surface as MODEL_BUSY, not a generic upstream error.
      { prompt: 'busy', generator: responses.httpError(429) },
      // A stream cut off after one chunk must reject instead of yielding a partial answer.
      { generator: responses.text('partial', { interruptAfter: 1 }) },
    ],
  });
  const provider = new CompatibleModelProvider({ config: config, ports: { request: mock.fetch } });
  await assert.rejects(
    Array.fromAsync(
      provider.stream([{ role: 'user', content: 'busy' }], {
        signal: new AbortController().signal,
      }),
    ),
    (error) => error.code === 'MODEL_BUSY',
  );
  await assert.rejects(
    Array.fromAsync(
      provider.stream([{ role: 'user', content: 'truncated' }], {
        signal: new AbortController().signal,
      }),
    ),
  );
  // No request remains in flight after a rejected stream.
  assert.equal(mock.activeRequests, 0);
});

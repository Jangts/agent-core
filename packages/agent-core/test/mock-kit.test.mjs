// Locks the Mock Kit re-export surface: `@jangts/agent-core/mock` (plus /node and /web) must
// mirror `@jangts/mock-gpt` key for key in both ESM and CommonJS, and support direct generation.
// `node --test`; compares the two packages' public exports without network access.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

test('Mock Kit exposes the complete root, Node and web APIs in both module formats', async () => {
  // Root, Node and web entry points must expose the same surface.
  for (const suffix of ['', '/node', '/web']) {
    const kit = await import(`@jangts/agent-core/mock${suffix}`);
    const original = await import(`@jangts/mock-gpt${suffix}`);
    assert.deepEqual(Object.keys(kit).sort(), Object.keys(original).sort());
    for (const key of Object.keys(original)) assert.equal(kit[key], original[key]);
    const common = require(`@jangts/agent-core/mock${suffix}`);
    const source = require(`@jangts/mock-gpt${suffix}`);
    // CommonJS loads the same objects rather than parallel implementations.
    assert.deepEqual(Object.keys(common).sort(), Object.keys(source).sort());
    for (const key of Object.keys(source)) assert.equal(common[key], source[key]);
  }
});

test('Mock Kit supports direct generation without an HTTP server', async () => {
  const { MockGPT } = await import('@jangts/agent-core/mock');
  const mock = new MockGPT({ rules: [{ prompt: '状态', generator: { status: 'ready' } }] });
  // Non-string generators are returned as structured values, not JSON text.
  assert.deepEqual(
    await mock.generate({ model: 'demo', messages: [{ role: 'user', content: '状态' }] }),
    { status: 'ready' },
  );
});

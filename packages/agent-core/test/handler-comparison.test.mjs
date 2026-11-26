import test from 'node:test';
import assert from 'node:assert/strict';
import { runHandlerComparison } from '../development/examples/harness-handler-comparison.mjs';
test('ordinary handlers and workflow composition preserve the same controlled task behavior', async () => {
  const result = await runHandlerComparison();
  assert.equal(result.sameDelivery, true);
  assert.equal(result.sameProviderSequence, true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { runModelProtocolExample } from '../development/examples/model-protocols.mjs';
for (const protocol of ['chat-completions', 'responses', 'messages', 'generate-content', 'interactions']) {
  test(`public ${protocol} example shares the same authorized loop and scoped state`, async () => {
    assert.deepEqual(await runModelProtocolExample(protocol), { text: 'Inventory: 7', reads: 1, calls: 2 });
  });
}

import { runBackgroundExample } from '../development/examples/model-lifecycles.mjs';
for (const protocol of ['responses', 'interactions']) {
  test(`public ${protocol} background example shares reservation, query and output shape`, async () => {
    assert.deepEqual(await runBackgroundExample(protocol), {status:'completed',submissions:1,records:1,remainingCalls:1});
  });
}

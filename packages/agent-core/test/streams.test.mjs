/**
 * Locks down `streamEvents` delivery acknowledgement: consumer return rejects the pending
 * delivery so the producer never records it as consumed, while normal consumption
 * acknowledges exactly once. Runs under node --test with an in-memory async producer.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { streamEvents } from '../dist/esm/support/stream-events.js';
test('consumer return rejects the pending delivery and never acknowledges it as consumed', async () => {
  let committed = false,
    cancelled = false;
  const stream = streamEvents(
    async (emit) => {
      try {
        await emit('final reply');
        committed = true;
      } catch {
        cancelled = true;
      }
    },
    { signal: new AbortController().signal },
  )[Symbol.asyncIterator]();
  assert.deepEqual(await stream.next(), { value: 'final reply', done: false });
  await stream.return();
  // Let both microtask continuations settle: the producer must observe rejection, not commit.
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(committed, false);
  assert.equal(cancelled, true);
});
test('normal consumption acknowledges delivery once', async () => {
  let committed = 0;
  const output = [];
  for await (const event of streamEvents(
    async (emit) => {
      await emit('reply');
      committed++;
    },
    { signal: new AbortController().signal },
  ))
    output.push(event);
  assert.deepEqual(output, ['reply']);
  assert.equal(committed, 1);
});

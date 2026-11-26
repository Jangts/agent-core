/**
 * Locks down `publishReplyEvents`: chunking by Unicode code point, explicit bubble
 * boundaries, pacing that yields to the event loop, cancellation during a delay, a zero
 * pacing budget that never waits, and rejection of invalid pacing configuration before
 * any text is emitted. Runs under node --test with a caller-supplied abort signal.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publishReplyEvents, REPLY_BUBBLE_BOUNDARY } from '../dist/esm/kits/presentation/events.js';
const signal = () => new AbortController().signal;
test('validated reply delivery preserves Unicode, bubble ordering and zero-delay delivery', async () => {
  // chunkSize 1 splits by code point, so the surrogate pair stays a single text event.
  const result = await Array.fromAsync(
    publishReplyEvents(
      { text: '甲🙂乙' + REPLY_BUBBLE_BOUNDARY + '第二段', delivery: { chunkSize: 1 } },
      { signal: signal() },
    ),
  );
  // The boundary emits an explicit bubble marker at its exact position in the sequence.
  assert.deepEqual(result, [
    { type: 'text', text: '甲' },
    { type: 'text', text: '🙂' },
    { type: 'text', text: '乙' },
    { type: 'bubble' },
    { type: 'text', text: '第' },
    { type: 'text', text: '二' },
    { type: 'text', text: '段' },
  ]);
});
test('pacing places later text on a later turn of the event loop', async () => {
  const stream = publishReplyEvents(
    { text: '甲乙丙', delivery: { chunkSize: 1, intervalMs: 20, maxDurationMs: 100 } },
    { signal: signal() },
  );
  assert.deepEqual((await stream.next()).value, { type: 'text', text: '甲' });
  let ready = false;
  const pending = stream.next().then((value) => {
    ready = true;
    return value;
  });
  // A 1 ms sleep is shorter than the 20 ms interval, so the next chunk must still be
  // pending: pacing yields instead of draining the whole reply in one turn.
  await new Promise((resolve) => setTimeout(resolve, 1));
  assert.equal(ready, false);
  assert.deepEqual((await pending).value, { type: 'text', text: '乙' });
  await stream.return();
});
test('abort during a pacing delay stops further text and releases its timer', async () => {
  const controller = new AbortController();
  const stream = publishReplyEvents(
    { text: '甲乙', delivery: { chunkSize: 1, intervalMs: 10000, maxDurationMs: 10000 } },
    { signal: controller.signal },
  );
  await stream.next();
  const pending = stream.next();
  controller.abort(new DOMException('Stopped', 'AbortError'));
  // The 10 s interval would hang the test if abort did not clear the pending timer.
  await assert.rejects(pending, { name: 'AbortError' });
});
test('zero pacing budget never waits, including between bubbles', async () => {
  let fired = false;
  const timer = setTimeout(() => {
    fired = true;
  }, 0);
  try {
    const events = await Array.fromAsync(
      publishReplyEvents(
        {
          text: 'ab' + REPLY_BUBBLE_BOUNDARY + 'cd',
          delivery: { chunkSize: 1, intervalMs: 1000, bubblePauseMs: 1000, maxDurationMs: 0 },
        },
        { signal: signal() },
      ),
    );
    // A zero max duration overrides the 1000 ms interval and bubble pause: the 0 ms timer
    // scheduled before consumption must not fire, and the reply still emits all 4 chunks
    // plus the bubble marker.
    assert.equal(fired, false);
    assert.equal(events.length, 5);
  } finally {
    clearTimeout(timer);
  }
});
test('invalid pacing configurations fail before any text is emitted', async () => {
  for (const options of [
    { chunkSize: 0 },
    { intervalMs: -1 },
    { bubblePauseMs: NaN },
    { maxDurationMs: Infinity },
  ])
    await assert.rejects(
      Array.fromAsync(publishReplyEvents({ text: 'abc', delivery: options }, { signal: signal() })),
      TypeError,
    );
});

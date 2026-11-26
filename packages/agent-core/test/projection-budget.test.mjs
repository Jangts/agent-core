// Locks content projection budget behavior: an over-budget fallback is an error rather than
// oversized output, and continuous excerpts validate limits and require sync renderers.
// Covers `defineContentProjection` and `projectContinuousExcerpt`; `node --test` against dist/esm.
import test from 'node:test';
import assert from 'node:assert/strict';
import { defineContentProjection, projectContinuousExcerpt } from '../dist/esm/kits/projection.js';

test('content projection refuses an over-budget fallback instead of returning oversized context', () => {
  const projection = defineContentProjection({
    counts: [],
    lengths: [],
    render: JSON.stringify,
    // The fallback is 'too large' (9 chars), which maxChars 1 cannot fit.
    fallback: () => 'too large',
  });
  assert.throws(
    () => projection.project({ value: 'long input', maxChars: 1 }),
    (error) => error.issues?.[0].code === 'CONTEXT_BUDGET',
  );
  // Exactly the fallback length fits, so projection reports a truncated fallback.
  assert.deepEqual(projection.project({ value: 'long input', maxChars: 9 }), {
    text: 'too large',
    truncated: true,
  });
});

test('continuous excerpts reject invalid limits and accidental async renderers', async () => {
  // NaN, negatives, fractions, undefined and strings are all invalid limits.
  for (const limit of [NaN, -1, 0.5, undefined, '2']) {
    assert.throws(
      () => projectContinuousExcerpt('abc', limit, (length) => 'abc'.slice(0, length)),
      /budget/,
    );
  }
  assert.throws(
    () => projectContinuousExcerpt('abc', 2, () => Promise.reject(Error('late render'))),
    /synchronous/,
  );
  // Let the rejected renderer settle so no unhandled rejection escapes the test.
  await new Promise((resolve) => setImmediate(resolve));
});

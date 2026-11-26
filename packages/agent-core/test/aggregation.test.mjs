import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateBranchResults, Aggregation } from '../dist/esm/kits/aggregation.js';
import { verifyParallelHarness } from '../development/examples/harness-parallel.mjs';

const success = (id, patch) => ({ id, status: 'succeeded', patch });

test('branch patches follow declaration order and detach caller-owned data', () => {
  const patch = { left: { label: 'left' } };
  const value = aggregateBranchResults({ branches: ['left', 'right'], results: [
    success('right', { right: 2 }), success('left', patch),
  ] });
  assert.equal(Aggregation.aggregateBranchResults, aggregateBranchResults);
  assert.equal(value.status, 'accepted');
  assert.deepEqual(value.results.map(row => row.id), ['left', 'right']);
  patch.left.label = 'changed';
  assert.equal(value.patch.left.label, 'left');
  assert.deepEqual(value.patch, { left: { label: 'left' }, right: 2 });
});

test('equal-value conflicts also reject, independent of arrival order', () => {
  const results = [success('a', { answer: 1 }), success('b', { answer: 1 })];
  const inspect = rows => aggregateBranchResults({ branches: ['a', 'b'], results: rows });
  const result = inspect(results);
  assert.deepEqual(result, inspect([...results].reverse()));
  assert.equal(result.status, 'conflict');
  assert.deepEqual(result.conflicts, [{ key: 'answer', branches: ['a', 'b'] }]);
  assert.equal(Object.hasOwn(result, 'patch'), false);
});

test('failed branches preserve successful patches without accepting partial parent state', () => {
  const result = aggregateBranchResults({ branches: ['a', 'b'], results: [
    success('a', { evidence: 'kept' }), { id: 'b', status: 'failed', error: new Error('offline') },
  ] });
  assert.equal(result.status, 'incomplete');
  assert.equal(result.results[0].patch.evidence, 'kept');
  assert.equal(result.results[1].error.message, 'offline');
  assert.equal(Object.hasOwn(result, 'patch'), false);
});

test('unrecognized, duplicated and missing outcomes cannot accidentally authorize acceptance', () => {
  for (const request of [
    { branches: ['a', 'a'], results: [] },
    { branches: [' '], results: [] },
    { branches: ['a'], results: [] },
    { branches: ['a'], results: [success('b', {})] },
    { branches: ['a'], results: [success('a', {}), success('a', {})] },
    { branches: ['a'], results: [{ id: 'a', status: 'pending' }] },
  ]) assert.throws(() => aggregateBranchResults(request), TypeError);
});

test('patch data boundary rejects accessors and handles prototype-named keys safely', () => {
  let invoked = false;
  const accessor = Object.defineProperty({}, 'x', { enumerable: true, get() { invoked = true; } });
  for (const patch of [accessor, [], new Date(), { [Symbol('x')]: 1 }, Object.defineProperty({}, 'x', { value: 1 })])
    assert.throws(() => aggregateBranchResults({ branches: ['a'], results: [success('a', patch)] }), TypeError);
  assert.equal(invoked, false);
  const patch = JSON.parse('{"__proto__":{"polluted":true}}');
  const result = aggregateBranchResults({ branches: ['a'], results: [success('a', patch)] });
  assert.equal(Object.getPrototypeOf(result.patch), Object.prototype);
  assert.equal(Object.hasOwn(result.patch, '__proto__'), true);
  assert.equal({}.polluted, undefined);
});

test('native parallel example exercises shared limits, conflicts, partial retention and late isolation', async () => {
  const result = await verifyParallelHarness();
  assert.equal(result.accepted.totalCalls, 2);
  assert.equal(result.limited.totalCalls, 1);
  assert.deepEqual(result.cancelled.parentState, {});
});


test('outcome identity and request getters are read once before detaching results', () => {
  const counts = { branches: 0, results: 0, id: 0, status: 0, patch: 0 };
  const outcome = {
    get id() { counts.id++; return counts.id === 1 ? 'a' : 'foreign'; },
    get status() { counts.status++; return counts.status === 1 ? 'succeeded' : 'failed'; },
    get patch() { counts.patch++; return { answer: 1 }; },
  };
  const result = aggregateBranchResults({
    get branches() { counts.branches++; return ['a']; },
    get results() { counts.results++; return [outcome]; },
  });
  assert.equal(result.status, 'accepted');
  assert.equal(result.results[0].id, 'a');
  assert.deepEqual(result.patch, { answer: 1 });
  assert.deepEqual(counts, { branches: 1, results: 1, id: 1, status: 1, patch: 1 });
});

test('caller getters cannot rewrite the declared branch order during aggregation', () => {
  const branches = ['a', 'b'];
  const result = aggregateBranchResults({ branches, results: [
    { get id() { branches.reverse(); return 'a'; }, status: 'succeeded', patch: { a: 1 } },
    success('b', { b: 2 }),
  ] });
  assert.deepEqual(result.results.map(row => row.id), ['a', 'b']);
});

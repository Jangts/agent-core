/*
 * Contract for `Support.runChildren`: how a parent model runs several child tasks
 * whose results are committed through one callback.
 *
 * Two invariants matter and are each covered here. A commit signals success only
 * by returning void, so a sibling that returns `false` must abort the group
 * instead of silently discarding the boolean; and each child's transport list is
 * fixed before any sibling runs, so a sibling that mutates its own array cannot
 * change what a later child may call. Cancellation during a commit waits for that
 * commit to finish and keeps the caller's reason.
 *
 * Runs on `dist/esm` with a fake provider that yields one value.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ModelRunner, Support } from '../dist/esm/index.js';
const provider = {
  async *stream() {
    yield 'ready';
  },
};
const task = (id, run, transports) => ({
  id,
  run,
  transports,
  maxCalls: 1,
  reserveCalls: 0,
  timeoutMs: 1000,
});

test('a request-scoped parent port can dispatch children without a bind method', async () => {
  const runner = new ModelRunner({ execution: {}, provider, maxCalls: 1 });
  const parent = {
    signal: runner.signal,
    childLimits: runner.childLimits,
    createChild: runner.createChild.bind(runner),
  };
  const result = await Support.runChildren(parent, [
    task('answer', async child => (await child.invoke('hello')).value),
  ]);
  assert.deepEqual(result, ['ready']);
  assert.equal(runner.totalCallCount, 1);
});

test('a commit must finish with void and cannot signal rejection by returning a discarded boolean', async () => {
  const committed = [];
  const parent = new ModelRunner({ execution: {}, provider });
  await assert.rejects(
    Support.runChildren(parent, [task('one', () => 1), task('two', () => 2)], {
      commit(value) {
        committed.push(value);
        return false;
      },
    }),
    /Child commit must return void/,
  );
  assert.deepEqual(committed, [1]);
});

// The second child must still be able to use the transport it declared, even
// though the first child's handler emptied the shared array.
test('pending child task transport lists are fixed before any sibling can mutate the input', async () => {
  const parent = new ModelRunner({ execution: {}, provider });
  const transports = [Support.createTextTransport({ id: 'pending' })];
  const values = await Support.runChildren(parent, [
    task('first', () => {
      transports.length = 0;
      return 'first';
    }),
    task(
      'second',
      async (model) => (await model.invoke({ input: 'hello', transport: 'pending' })).value,
      transports,
    ),
  ]);
  assert.deepEqual(values, ['first', 'ready']);
  assert.equal(parent.totalCallCount, 1);
});

test('cancellation during commit waits for its actual completion and preserves the original reason', async () => {
  const control = new AbortController(),
    reason = new Error('stopped'),
    committed = [];
  let release, enter;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const entered = new Promise((resolve) => {
    enter = resolve;
  });
  const parent = new ModelRunner({ execution: {}, provider });
  const pending = Support.runChildren(parent, [task('one', () => 1), task('two', () => 2)], {
    signal: control.signal,
    async commit(value) {
      committed.push(value);
      enter();
      await gate;
      return false;
    },
  });
  const outcome = pending.catch((error) => error);
  await entered;
  control.abort(reason);
  // Releasing the commit after the abort must not change the reported reason, and
  // the in-flight commit still counts as applied.
  release();
  assert.equal(await outcome, reason);
  assert.deepEqual(committed, [1]);
});

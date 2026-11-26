// Locks multi-level child budgets and `Support.runChildren` ordering: every ancestor reserve
// survives, capacity is shared, cancellation is directional and commits stay in declaration order.
// Covers `ModelRunner` children and `Support.runChildren`; `node --test` against dist/esm.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ModelRunner, BudgetError, Support } from '../dist/esm/index.js';
const provider = {
  async *stream() {
    yield 'ok';
  },
};
const child = (parent, id, options = {}) =>
  parent.createChild({
    id,
    maxCalls: 10,
    reserveCalls: 1,
    timeoutMs: 1000,
    transports: [],
    ...options,
  });
// Let pending microtasks and macrotasks run before asserting intermediate state.
const turn = () => new Promise((resolve) => setImmediate(resolve));

test('nested budgets preserve every ancestor reserve and never create new allowance', async () => {
  const root = new ModelRunner({ execution: {}, provider, maxCalls: 5, children: { maxDepth: 2 } });
  const a = child(root, 'a'),
    b = child(a, 'b');
  // Depth counts the root as zero, so b is the last legal child.
  assert.throws(() => child(b, 'too-deep'), /depth/);
  for (let i = 0; i < 3; i++) await b.invoke('nested');
  // Each ancestor reserve must stay available for its own final call.
  await assert.rejects(b.invoke('cannot take parent delivery'), BudgetError);
  assert.equal(root.totalCallCount, 3);
  await a.invoke('parent delivery');
  await root.invoke('root delivery');
  assert.equal(root.totalCallCount, 5);
  assert.equal(a.totalCallCount, 4);
  assert.equal(b.totalCallCount, 3);
  assert.equal(root.callCount, 1);
  assert.equal(a.callCount, 1);
  assert.equal(b.callCount, 3);
});

test('request capacity is shared by siblings while one runner never overlaps its own mutable state', async () => {
  const finish = [];
  const root = new ModelRunner({ execution: {},
    maxCalls: 5,
    children: { maxConcurrentCalls: 2 },
    provider: {
      async *stream() {
        await new Promise((resolve) => finish.push(resolve));
        yield 'ok';
      },
    },
  });
  const a = child(root, 'a'),
    b = child(root, 'b'),
    c = child(root, 'c');
  const first = a.invoke('first'),
    second = b.invoke('second');
  await turn();
  // maxConcurrentCalls 2 lets two siblings enter the provider, and no more.
  assert.equal(finish.length, 2);
  assert.equal(root.totalCallCount, 2);
  await assert.rejects(c.invoke('capacity'), /capacity/);
  // A single runner cannot overlap with itself even through separate siblings.
  await assert.rejects(a.invoke('same runner'), /same model runner/);
  assert.equal(root.totalCallCount, 2);
  finish.forEach((resolve) => resolve());
  await Promise.all([first, second]);
  assert.equal(a.journal.snapshot().length, 1);
  assert.equal(b.journal.snapshot().length, 1);
  assert.equal(c.journal.snapshot().length, 0);
});

test('child cancellation is local, root cancellation reaches every active descendant', async () => {
  const stop = new AbortController();
  const root = new ModelRunner({ execution: {},
    maxCalls: 5,
    children: { maxConcurrentCalls: 2, maxDepth: 2 },
    provider: {
      async *stream(messages) {
        // Only the 'wait' request stalls; the sibling must still be able to complete.
        if (messages.some((message) => message.content === 'wait')) await new Promise(() => {});
        yield 'ok';
      },
    },
  });
  const a = child(root, 'a', { signal: stop.signal }),
    b = child(root, 'b');
  const waiting = a.invoke('wait');
  await turn();
  stop.abort(new Error('child stopped'));
  await assert.rejects(waiting, /child stopped/);
  assert.equal((await b.invoke('other')).value, 'ok');
  assert.equal(root.signal.aborted, false);
  assert.equal(a.journal.snapshot().length, 0);
});

test('child policy snapshots defaults and bounds the total number of created descendants', () => {
  const policy = { maxDepth: 2, maxChildren: 2 };
  const root = new ModelRunner({ execution: {}, provider, children: policy });
  // Mutating the policy object after construction must not change the recorded limits.
  policy.maxDepth = 0;
  policy.maxChildren = 100;
  const a = child(root, 'a');
  child(a, 'b');
  assert.throws(() => child(root, 'c'), /capacity/);
  assert.equal(root.childLimits.maxDepth, 2);
  // An unspecified concurrency limit defaults to one.
  assert.equal(root.childLimits.maxConcurrentCalls, 1);
  for (const children of [{ maxDepth: -1 }, { maxConcurrentCalls: 0 }, { maxChildren: 0 }, null])
    assert.throws(() => new ModelRunner({ execution: {}, provider, children }), /policy/);
});

test('the Support group accepts all outputs before ordered commits despite completion order', async () => {
  const root = new ModelRunner({ execution: {}, provider, maxCalls: 5, children: { maxConcurrentCalls: 2 } });
  const completed = [],
    accepted = [],
    committed = [];
  let finish;
  const first = new Promise((resolve) => {
    finish = resolve;
  });
  const task = (id, run) => ({
    id,
    maxCalls: 1,
    reserveCalls: 1,
    timeoutMs: 1000,
    transports: [],
    run,
  });
  const pending = Support.runChildren(
    root,
    [
      task('first', async (model) => {
        await first;
        await model.invoke('one');
        completed.push('first');
        return 1;
      }),
      task('second', async (model) => {
        await model.invoke('two');
        completed.push('second');
        finish();
        return 2;
      }),
    ],
    {
      accept(value) {
        accepted.push(value);
      },
      commit(value, id) {
        assert.equal(accepted.length, 2);
        committed.push(id);
      },
    },
  );
  assert.deepEqual(await pending, [1, 2]);
  // 'second' finishes first, but commits still follow declaration order.
  assert.deepEqual(completed, ['second', 'first']);
  assert.deepEqual(committed, ['first', 'second']);
});

test('failed acceptance cancels siblings and late results never reach commits', async () => {
  const root = new ModelRunner({ execution: {}, provider, children: { maxConcurrentCalls: 2 } });
  let late;
  const committed = [];
  const task = (id, run) => ({
    id,
    maxCalls: 1,
    reserveCalls: 1,
    timeoutMs: 1000,
    transports: [],
    run,
  });
  await assert.rejects(
    Support.runChildren(
      root,
      [
        task(
          'slow',
          () =>
            new Promise((resolve) => {
              late = resolve;
            }),
        ),
        task('bad', () => 'bad'),
      ],
      {
        accept(value) {
          if (value === 'bad') throw new Error('not accepted');
        },
        commit(value) {
          committed.push(value);
        },
      },
    ),
    /not accepted/,
  );
  late('too late');
  // A rejected acceptance cancels siblings; the late result must never commit.
  await turn();
  assert.deepEqual(committed, []);
});

test('child cancellation during asynchronous acceptance prevents committing its result', async () => {
  const root = new ModelRunner({ execution: {}, provider });
  const stop = new AbortController(),
    reason = new Error('child acceptance stopped');
  let release, entered;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const accepting = new Promise((resolve) => {
    entered = resolve;
  });
  const committed = [];
  const pending = Support.runChildren(
    root,
    [
      {
        id: 'one',
        maxCalls: 1,
        reserveCalls: 1,
        timeoutMs: 1000,
        transports: [],
        signal: stop.signal,
        run: () => 'result',
      },
    ],
    {
      async accept() {
        entered();
        await gate;
      },
      commit(value) {
        committed.push(value);
      },
    },
  );
  const outcome = pending.then(
    () => 'completed',
    (error) => error,
  );
  try {
    await accepting;
    stop.abort(reason);
    // Cancellation rejects the group before the asynchronous acceptance finishes.
    assert.equal(await Promise.race([outcome, turn().then(() => 'still waiting')]), reason);
    assert.deepEqual(committed, []);
    assert.equal(root.signal.aborted, false);
  } finally {
    release();
    await outcome;
  }
  assert.deepEqual(committed, []);
});

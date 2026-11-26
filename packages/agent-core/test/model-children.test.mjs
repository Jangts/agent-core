// Locks child ModelRunner isolation: separate journals and sinks, a shared parent allowance,
// sibling concurrency and deadline rules, and unique spans within one run.
// Covers `ModelRunner.createChild` and diagnostics identity; `node --test` against dist/esm.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ModelRunner, BudgetError, createDiagnostics } from '../dist/esm/index.js';

const provider = {
  async *stream() {
    yield 'answer';
  },
};
// Child budget is generous; the parent allowance is what these tests exhaust.
const child = (model, more = {}) =>
  model.createChild({
    id: 'analysis',
    maxCalls: 10,
    reserveCalls: 1,
    timeoutMs: 1000,
    transports: [],
    ...more,
  });

test('children isolate journal and sinks while sibling attempts consume the same parent allowance', async () => {
  let output = 0;
  const model = new ModelRunner({ execution: {},
    provider,
    maxCalls: 4,
    sink: {
      output: async () => {
        output++;
      },
    },
  });
  const a = child(model),
    b = child(model);
  await a.invoke('one');
  await b.invoke('two');
  await a.invoke('three');
  assert.equal(output, 0);
  assert.equal(a.journal.snapshot().length, 2);
  assert.equal(b.journal.snapshot().length, 1);
  // The parent journal stays empty; children record their own calls.
  assert.equal(model.journal.snapshot().length, 0);
  assert.equal(model.callCount, 0);
  assert.equal(model.totalCallCount, 3);
  // Siblings spend the same total, so b cannot exceed the parent's maxCalls of four.
  await assert.rejects(b.invoke('overspend'), BudgetError);
  assert.equal(model.totalCallCount, 3);
  assert.equal((await model.invoke('deliver')).value, 'answer');
  assert.equal(model.totalCallCount, 4);
  await assert.rejects(model.invoke('over'), BudgetError);
  // Children cannot create grandchildren.
  assert.throws(() => child(a), /Nested/);
});

test('failed attempts stay charged, and parent cancellation reaches every child without committing late values', async () => {
  const abort = new AbortController();
  const model = new ModelRunner({
    provider: {
      async *stream() {
        yield 'partial';
        await new Promise(() => {});
      },
    },
    maxCalls: 3,
    execution: { signal: abort.signal },
  });
  const a = child(model);
  const pending = a.invoke('read');
  await new Promise((resolve) => setTimeout(resolve, 10));
  abort.abort(new Error('stopped'));
  await assert.rejects(pending, /stopped/);
  // A cancelled attempt stays charged against the parent.
  assert.equal(model.totalCallCount, 1);
  assert.equal(a.journal.snapshot().length, 0);
  await assert.rejects(child(model).invoke('again'), /stopped/);
  assert.equal(model.totalCallCount, 1);
});

test('one request rejects concurrent model I/O across siblings before spending or replacing active state', async () => {
  let finish,
    first = true;
  const model = new ModelRunner({ execution: {},
    provider: {
      async *stream() {
        if (first) {
          first = false;
          await new Promise((resolve) => {
            finish = resolve;
          });
        }
        yield 'done';
      },
    },
    maxCalls: 4,
  });
  const a = child(model),
    b = child(model);
  const pending = a.invoke('one');
  await new Promise((resolve) => setTimeout(resolve, 0));
  // One model runner (here shared through siblings) rejects overlapping I/O.
  await assert.rejects(b.invoke('two'), /Concurrent/);
  assert.equal(model.totalCallCount, 1);
  finish();
  await pending;
  assert.equal(await b.invoke('three').then((result) => result.value), 'done');
});

test('a child deadline drops late output while the parent remains usable', async () => {
  let first = true;
  const model = new ModelRunner({ execution: {},
    provider: {
      async *stream() {
        if (first) {
          first = false;
          await new Promise((resolve) => setTimeout(resolve, 30));
        }
        yield 'done';
      },
    },
    maxCalls: 3,
  });
  const a = child(model, { timeoutMs: 5 });
  await assert.rejects(a.invoke('slow'), (error) => error.name === 'TimeoutError');
  assert.equal(a.journal.snapshot().length, 0);
  // The child deadline must not abort the parent runner.
  assert.equal(model.signal.aborted, false);
  assert.equal((await model.invoke('deliver')).value, 'done');
  assert.equal(model.totalCallCount, 2);
});

test('child execution contexts have unique spans in the same run and reject foreign observation parents', () => {
  const diagnostics = createDiagnostics({ runId: 'request' });
  const model = new ModelRunner({ provider, execution: { diagnostics } });
  const a = child(model),
    b = child(model);
  assert.equal(a.execution.diagnostics.identity.runId, 'request');
  assert.notEqual(a.execution.diagnostics.identity.spanId, b.execution.diagnostics.identity.spanId);
  assert.equal(a.execution.diagnostics.identity.parentSpanId, diagnostics.identity.spanId);
  // A child may not join a different run id.
  assert.throws(
    () => child(model, { diagnostics: createDiagnostics({ runId: 'foreign' }) }),
    /another run/,
  );
});

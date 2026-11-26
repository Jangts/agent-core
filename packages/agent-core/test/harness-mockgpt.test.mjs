import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BudgetError, CompatibleModelProvider } from '@jangts/agent-core';
import { MockGPT, responses } from '@jangts/agent-core/mock';
import { createComposition } from '../development/examples/harness-composition.mjs';

function endpoint(override = []) {
  const mock = new MockGPT({
    rules: [
      ...override,
      { prompt: 'prepare', generator: 'note' },
      { prompt: 'choose', generator: 'save' },
      { prompt: 'after:receipt-1', generator: 'Saved receipt-1' },
      { prompt: 'repair:receipt-1', generator: '{"receipt":"receipt-1","message":"Saved"}' },
    ],
  });
  const provider = new CompatibleModelProvider({
    config: { baseUrl: 'https://mock.invalid/v1', apiKey: 'offline-fixture', model: 'demo' },
    ports: { request: mock.fetch },
  });
  return { mock, provider };
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test('MockGPT HTTP streaming shares parent budget and repairs delivery without saving twice', async () => {
  const { mock, provider } = endpoint();
  const app = createComposition({ provider });
  assert.deepEqual(await app.parent.run({}), { receipt: 'receipt-1', message: 'Saved' });
  assert.equal(app.model.callCount, 2);
  assert.equal(app.childModel.callCount, 2);
  assert.equal(app.model.totalCallCount, mock.records.length);
  assert.equal(mock.records.length, 4);
  assert.ok(mock.records.every((record) => record.status === 'completed'));
  assert.equal(app.calls.authorization, 1);
  assert.equal(app.calls.saves, 1);
  assert.equal(app.calls.repairs, 1);
  assert.equal(app.receipts.get('receipt-1'), 'note');
  await assert.rejects(app.model.invoke('exhausted'), BudgetError);
  assert.equal(mock.records.length, 4);
  assert.equal(mock.activeRequests, 0);
});

test('MockGPT-selected save still requires App authorization', async () => {
  const { mock, provider } = endpoint();
  const app = createComposition({ provider, canSave: false });
  await assert.rejects(app.parent.run({}), (error) => error === app.denied);
  assert.equal(app.calls.authorization, 1);
  assert.equal(app.calls.saves, 0);
  assert.equal(app.calls.repairs, 0);
  assert.equal(app.receipts.size, 0);
  assert.equal(mock.records.length, 2);
  assert.equal(app.model.totalCallCount, 2);
  assert.equal(mock.activeRequests, 0);
});

test('failed child HTTP attempt remains charged and never reaches save or delivery repair', async () => {
  const { mock, provider } = endpoint([{ prompt: 'choose', generator: responses.httpError(429) }]);
  const app = createComposition({ provider });
  await assert.rejects(app.parent.run({}), (error) => error.code === 'MODEL_BUSY');
  assert.equal(app.model.callCount, 1);
  assert.equal(app.childModel.callCount, 1);
  assert.equal(app.model.totalCallCount, 2);
  assert.equal(mock.records.length, 2);
  assert.equal(app.calls.authorization, 0);
  assert.equal(app.calls.saves, 0);
  assert.equal(app.calls.repairs, 0);
  assert.equal(mock.activeRequests, 0);
});

test('cancelled MockGPT child generation cannot commit its late choice', { timeout: 5000 }, async () => {
  const entered = deferred(), release = deferred();
  const { mock, provider } = endpoint([{
    prompt: 'choose',
    async generator() {
      entered.resolve();
      await release.promise;
      return 'save';
    },
  }]);
  const abort = new AbortController();
  const app = createComposition({ provider, signal: abort.signal });
  const state = {};
  const running = app.parent.run(state);
  const stopped = new Error('cancel child generation');
  try {
    await entered.promise;
    const rejection = assert.rejects(running, (error) => error === stopped);
    abort.abort(stopped);
    await rejection;
    release.resolve();
    await new Promise((done) => setImmediate(done));
    assert.equal(app.model.totalCallCount, 2);
    assert.equal(app.childModel.callCount, 1);
    assert.equal(app.childModel.journal.snapshot().length, 0);
    assert.equal(app.calls.authorization, 0);
    assert.equal(app.calls.saves, 0);
    assert.equal(state.childResult, undefined);
    assert.equal(state.delivery, undefined);
    assert.equal(mock.records.at(-1).status, 'cancelled');
    assert.equal(mock.activeRequests, 0);
  } finally {
    release.resolve();
  }
});

test('a late noncooperative save may happen externally but cannot become a successful child result', { timeout: 5000 }, async () => {
  const entered = deferred(), release = deferred(), portFinished = deferred();
  const { mock, provider } = endpoint();
  const abort = new AbortController();
  const external = new Map();
  const app = createComposition({
    provider,
    signal: abort.signal,
    async saveNote(note, { receipt }) {
      entered.resolve();
      await release.promise;
      external.set(receipt, note);
      portFinished.resolve();
    },
  });
  const state = {};
  const running = app.parent.run(state);
  const stopped = new Error('cancel pending save');
  try {
    await entered.promise;
    const rejection = assert.rejects(running, (error) => error === stopped);
    abort.abort(stopped);
    await rejection;
    release.resolve();
    await portFinished.promise;
    await new Promise((done) => setImmediate(done));
    assert.equal(external.get('receipt-1'), 'note');
    assert.equal(app.calls.saves, 1);
    assert.equal(app.calls.repairs, 0);
    assert.equal(state.childResult, undefined);
    assert.equal(state.delivery, undefined);
    assert.equal(app.model.totalCallCount, 2);
    assert.equal(mock.records.length, 2);
    assert.equal(mock.activeRequests, 0);
  } finally {
    release.resolve();
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runModelOperation, waitModelOperation } from '../dist/esm/model/operations.js';
import { createOperationHttpProvider } from '../dist/esm/support/model/lifecycle/http.js';

const identity = {
  operationId: 'request', scope: 'owner', protocol: 'responses', itemIds: ['item'],
};
const known = { ...identity, remoteId: 'remote' };
const signal = new AbortController().signal;
const context = { signal };
const settings = { protocol: 'responses', baseUrl: 'https://example.test/v1', apiKey: 'fixture', model: 'model' };
function fixture() {
  const calls = [], saves = [], grants = [], reservations = [];
  const ports = {
    async run(work, options) {
      calls.push(options);
      return work(options.signal ?? signal);
    },
    authorize(action, handle) { grants.push([action, handle.scope]); },
    async reserve(handle) { reservations.push(handle.operationId); return true; },
    async save(result) { saves.push(result); },
  };
  return { ports, calls, saves, grants, reservations };
}

test('invalid operation identity is rejected before authorization or reservation', async () => {
  const { ports, calls, saves, grants, reservations } = fixture();
  for (const patch of [{ operationId: '' }, { scope: '' }, { protocol: '' }, { itemIds: [] }, { itemIds: ['item', 'item'] }]) {
    await assert.rejects(runModelOperation({ invoke() { assert.fail('invalid identity reached provider'); } },
      { action: 'submit', handle: { ...identity, ...patch } }, ports), /Invalid operation identity/);
  }
  assert.deepEqual([calls, saves, grants, reservations], [[], [], [], []]);
});

test('an authorized query with no remote identity preserves the uncertain reservation', async () => {
  const { ports, calls, saves, grants, reservations } = fixture();
  const result = await runModelOperation({ invoke() { assert.fail('unknown remote identity reached provider'); } },
    { action: 'query', handle: identity, cleanup: true }, ports);
  assert.deepEqual(result, { handle: identity, status: 'unknown' });
  assert.deepEqual(grants, [['query', 'owner']]);
  assert.deepEqual(calls.map(({ action, calls, cleanup }) => [action, calls, cleanup]), [['authorize', 0, true]]);
  assert.deepEqual([saves, reservations], [[], []]);
});

test('cleanup releases remote operations but does not bypass submission admission', async () => {
  const state = fixture();
  const aborted = new AbortController();
  const reason = Error('already aborted');
  aborted.abort(reason);
  await assert.rejects(runModelOperation({ invoke() { assert.fail('aborted submission reached provider'); } },
    { action: 'submit', handle: identity, cleanup: true }, state.ports, aborted.signal), error => error === reason);
  assert.deepEqual(state.calls.map(({ action, calls, cleanup }) => [action, calls, cleanup]), [
    ['authorize', 0, false], ['submit', 1, false],
  ]);
  assert.deepEqual(state.saves, [{ handle: identity, status: 'failed' }]);
  const provider = { async invoke({ handle }) { return { handle, status: 'cancelled' }; } };
  const cancellation = await runModelOperation(provider, { action: 'cancel', handle: known }, state.ports);
  assert.equal(cancellation.status, 'cancelled');
  assert.deepEqual(state.calls.slice(2).map(({ calls, cleanup }) => [calls, cleanup]), [[0, true], [0, true]]);
});

test('bounded polling stops on terminal status, cancels sleep and rejects exhausted queries', async () => {
  const state = fixture();
  const pending = { handle: known, status: 'queued' };
  let invoked = 0;
  const provider = { async invoke() {
    return invoked++ === 0 ? pending : { handle: known, status: 'completed', value: 'answer' };
  } };
  for (const limits of [{ maxQueries: 0, intervalMs: 0 }, { maxQueries: 2, intervalMs: -1 }])
    await assert.rejects(waitModelOperation(provider, { handle: known }, state.ports, limits), /Invalid wait bounds/);
  assert.equal(invoked, 0);
  assert.equal((await waitModelOperation(provider, { handle: known }, state.ports,
    { maxQueries: 4, intervalMs: 0, signal })).value, 'answer');
  assert.equal(invoked, 2);
  await assert.rejects(waitModelOperation({ async invoke() { return pending; } }, { handle: known },
    state.ports, { maxQueries: 1, intervalMs: 0 }), /query limit reached/);
  const controller = new AbortController();
  const reason = Error('cancel poll sleep');
  let queries = 0;
  await assert.rejects(waitModelOperation({ async invoke() {
    queries++;
    setImmediate(() => controller.abort(reason));
    return pending;
  } }, { handle: known }, state.ports, { maxQueries: 2, intervalMs: 60_000, signal: controller.signal }),
  error => error === reason);
  assert.equal(queries, 1);
  assert.equal(state.calls.every(call => call.calls === 0), true);
});

test('HTTP operation configuration and identity are checked before any network work', async () => {
  for (const patch of [{ protocol: 'unregistered' }, { protocol: 'constructor' }, { apiKey: '' }])
    assert.throws(() => createOperationHttpProvider({ ...settings, ...patch }), /endpoint is not configured/);
  const request = async () => assert.fail('invalid operation reached HTTP');
  const provider = createOperationHttpProvider({ ...settings, request });
  for (const [patch, message] of [
    [{ endpoint: 'https://elsewhere.test/v1' }, /endpoint mismatch/],
    [{ model: 'other' }, /model mismatch/],
    [{ protocol: 'interactions' }, /protocol mismatch/],
    [{ remoteId: undefined }, /Remote operation ID required/],
  ]) await assert.rejects(provider.invoke({ action: 'query', handle: { ...known, ...patch } }, context), message);
  const gemini = createOperationHttpProvider({ ...settings, protocol: 'gemini-batch', model: undefined, request });
  await assert.rejects(gemini.invoke({ action: 'submit', handle: { ...identity, protocol: 'gemini-batch' } }, context),
    /Batch model required/);
});

test('HTTP operation retains supplier identities and maps cancel routes and legacy states', async () => {
  const seen = [];
  const request = async (url, init) => {
    seen.push([url, init.method, init.headers, init.body]);
    if (url.endsWith('remote/cancel')) return Response.json({ status: 'canceled' });
    if (url.endsWith(':cancel')) return Response.json({ metadata: { state: 'JOB_STATE_CANCELLED' } });
    if (url.endsWith('messages/batches/remote')) return Response.json({ processing_status: 'ended', usage: { input_tokens: 2 } });
    if (url.includes(':batchGenerateContent')) return Response.json({ name: 'batches/123', metadata: { state: 'JOB_STATE_RUNNING' } });
    return Response.json({ status: 'constructor' });
  };
  const responses = createOperationHttpProvider({ ...settings, request });
  assert.equal((await responses.invoke({ action: 'cancel', handle: known }, context)).status, 'cancelled');
  assert.equal((await responses.invoke({ action: 'query', handle: known }, context)).status, 'unknown');
  const batch = createOperationHttpProvider({ ...settings, protocol: 'gemini-batch', model: 'name / a', request });
  const dispatched = [];
  const job = await batch.invoke({ action: 'submit', handle: { ...identity, protocol: 'gemini-batch' }, payload: { items: [] } },
    { ...context, markDispatched() { dispatched.push(true); } });
  assert.deepEqual(dispatched, [true]);
  assert.equal(job.handle.remoteId, 'batches/123');
  assert.equal(job.status, 'running');
  assert.equal((await batch.invoke({ action: 'cancel', handle: job.handle }, context)).status, 'cancelled');
  const anthropic = createOperationHttpProvider({ ...settings, protocol: 'anthropic-batch', request });
  const read = await anthropic.invoke({ action: 'query', handle: { ...known, protocol: 'anthropic-batch' } }, context);
  assert.equal(read.status, 'completed');
  assert.equal(read.handle.remoteId, 'remote');
  assert.deepEqual(read.usage, { input_tokens: 2 });
  assert.deepEqual(seen.map(([url, method]) => [new URL(url).pathname, method]), [
    ['/v1/responses/remote/cancel', 'POST'], ['/v1/responses/remote', 'GET'],
    ['/v1/models/name%20%2F%20a:batchGenerateContent', 'POST'], ['/v1/batches/123:cancel', 'POST'],
    ['/v1/messages/batches/remote', 'GET'],
  ]);
  assert.equal(seen[4][2]['anthropic-version'], '2023-06-01');
  assert.equal(seen[4][2]['x-api-key'], 'fixture');
});

test('HTTP operations reject bad status and JSON without losing cleanup errors to the caller', async () => {
  let cancelled = 0;
  const responses = [
    new Response(new ReadableStream({ cancel() { cancelled++; throw Error('transport cancelled'); } }), { status: 503 }),
    new Response(null, { status: 204 }),
    Response.json(['unexpected array']),
    Response.json({}),
  ];
  const provider = createOperationHttpProvider({ ...settings, request: async () => responses.shift() });
  const query = { action: 'query', handle: known };
  await assert.rejects(provider.invoke(query, context), { status: 503 });
  assert.equal(cancelled, 1);
  await assert.rejects(provider.invoke(query, context), SyntaxError);
  await assert.rejects(provider.invoke(query, context), /Expected a model response object/);
  assert.deepEqual(await provider.invoke({ action: 'submit', handle: identity }, context),
    { handle: identity, status: 'unknown', value: {} });
});

test('a query that settles after cancellation does not arm another polling interval', async () => {
  const state = fixture();
  const controller = new AbortController();
  const reason = Error('completed after cancellation');
  let queries = 0;
  await assert.rejects(waitModelOperation({ async invoke() {
    queries++;
    controller.abort(reason);
    return { handle: known, status: 'running' };
  } }, { handle: known }, state.ports, { maxQueries: 3, intervalMs: 60_000, signal: controller.signal }),
  error => error === reason);
  assert.equal(queries, 1);
});

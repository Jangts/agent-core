import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defineWaitGate } from '../dist/esm/kits/waiting.js';

const identity = { taskId: 'task', waitId: 'generation-1', subject: 'owner' };

function fixture() {
  const records = new Map();
  let chain = Promise.resolve(), saves = 0, time = 10;
  const calls = [];
  const store = {
    exclusive(_id, operation) {
      const result = chain.then(operation);
      chain = result.catch(() => {});
      return result;
    },
    async load(id) { return structuredClone(records.get(id)); },
    async save(id, record) { saves++; records.set(id, structuredClone(record)); },
  };
  const definition = {
    id: 'approval', revision: '1',
    isAnswer(value) { return value?.approved === true; },
    authorize(identity, context) {
      calls.push(context.operation);
      if (!context.app.allowed || context.app.subject !== identity.subject) throw new Error('denied');
    },
  };
  const create = (change = {}) => defineWaitGate({ ...definition, ...change }, { store, now: () => time });
  const context = { app: { subject: 'owner', allowed: true }, signal: new AbortController().signal };
  return { records, store, create, context, calls, setTime(value) { time = value; }, get saves() { return saves; } };
}

test('waiting survives a new instance, clones data and consumes concurrent duplicate submissions once', async () => {
  const f = fixture(), gate = f.create();
  const opened = await gate.open({ identity, expiresAtMs: 100 }, f.context);
  opened.identity.subject = 'mutated';
  assert.equal((await gate.read(identity, f.context)).identity.subject, 'owner');
  const answer = { approved: true, note: { text: 'yes' } };
  const reply = { identity, submissionId: 'reply-1', answer };
  const results = await Promise.all([f.create().respond(reply, f.context), gate.respond(reply, f.context)]);
  assert.deepEqual(results[0], results[1]);
  assert.equal(results[0].status, 'resolved');
  assert.equal(f.saves, 2);
  answer.note.text = 'changed';
  results[0].submission.answer.note.text = 'changed';
  assert.equal((await gate.read(identity, f.context)).submission.answer.note.text, 'yes');
  f.setTime(200);
  const repeated = await gate.respond({ ...reply, answer: { note: { text: 'yes' }, approved: true } }, f.context);
  assert.equal(repeated.status, 'resolved');
  assert.equal(f.saves, 2);
});

test('conflicting submissions, old identities, expiry and cross-subject answers reject', async () => {
  const f = fixture(), gate = f.create();
  await gate.open({ identity, expiresAtMs: 100 }, f.context);
  await assert.rejects(gate.respond({ identity, submissionId: 'invalid', answer: { approved: false } }, f.context), TypeError);
  f.setTime(100);
  await assert.rejects(gate.respond({ identity, submissionId: 'expired', answer: { approved: true } }, f.context), (e) => e.code === 'WAIT_EXPIRED');
  f.setTime(50);
  await assert.rejects(gate.respond({ identity: { ...identity, waitId: 'old' }, submissionId: 'old', answer: { approved: true } }, f.context), (e) => e.code === 'WAIT_IDENTITY');
  await assert.rejects(gate.respond({ identity: { ...identity, subject: 'visitor' }, submissionId: 'other', answer: { approved: true } }, f.context), /denied/);
  await gate.respond({ identity, submissionId: 'reply', answer: { approved: true } }, f.context);
  await assert.rejects(gate.respond({ identity, submissionId: 'different', answer: { approved: true } }, f.context), (e) => e.code === 'WAIT_CONFLICT');
  await assert.rejects(gate.respond({ identity, submissionId: 'reply', answer: { approved: true, changed: true } }, f.context), (e) => e.code === 'WAIT_CONFLICT');
});

test('read, repeat response, cancel and open reauthorize current App grants', async () => {
  const f = fixture(), gate = f.create();
  await gate.open({ identity, expiresAtMs: 100 }, f.context);
  f.context.app.allowed = false;
  await assert.rejects(gate.read(identity, f.context), /denied/);
  await assert.rejects(gate.cancel(identity, f.context), /denied/);
  await assert.rejects(gate.open({ identity, expiresAtMs: 100 }, f.context), /denied/);
  f.context.app.allowed = true;
  const reply = { identity, submissionId: 'reply', answer: { approved: true } };
  await gate.respond(reply, f.context);
  f.context.app.allowed = false;
  await assert.rejects(gate.respond(reply, f.context), /denied/);
  assert.deepEqual(f.calls, ['open', 'read', 'cancel', 'open', 'respond', 'respond']);
});

test('explicit terminal-slot rotation rejects stale answers and does not replace pending waits', async () => {
  const f = fixture(), gate = f.create();
  await gate.open({ identity, expiresAtMs: 100 }, f.context);
  const next = { ...identity, waitId: 'generation-2' };
  await assert.rejects(gate.open({ identity: next, previousWaitId: identity.waitId, expiresAtMs: 100 }, f.context), (e) => e.code === 'WAIT_CONFLICT');
  assert.equal((await gate.cancel(identity, f.context)).status, 'cancelled');
  assert.equal((await gate.cancel(identity, f.context)).status, 'cancelled');
  await assert.rejects(gate.respond({ identity, submissionId: 'late', answer: { approved: true } }, f.context), (e) => e.code === 'WAIT_CANCELLED');
  await gate.open({ identity: next, previousWaitId: identity.waitId, expiresAtMs: 100 }, f.context);
  await assert.rejects(gate.respond({ identity, submissionId: 'old', answer: { approved: true } }, f.context), (e) => e.code === 'WAIT_IDENTITY');
  await assert.rejects(gate.open({ identity, previousWaitId: identity.waitId, expiresAtMs: 100 }, f.context), (e) => e.code === 'WAIT_CONFLICT');
});

test('JSON-only records, definition revisions and aborted operations are rejected safely', async () => {
  const f = fixture(), gate = f.create();
  await gate.open({ identity, expiresAtMs: 100 }, f.context);
  await assert.rejects(f.create({ revision: '2' }).read(identity, f.context), (e) => e.code === 'WAIT_DEFINITION');
  const permissive = f.create({ isAnswer: () => true });
  for (const answer of [new Map(), { value: undefined }, { value: NaN }, { value: 1n }]) {
    await assert.rejects(permissive.respond({ identity, submissionId: 'invalid', answer }, f.context), TypeError);
  }
  let getterCalls = 0;
  const getter = { get value() { getterCalls++; return true; } };
  const symbol = { [Symbol('hidden')]: true };
  const hidden = Object.defineProperty({}, 'hidden', { value: true });
  const cyclic = {}; cyclic.self = cyclic;
  for (const answer of [getter, symbol, hidden, cyclic, new (class Answer {})(), new Array(1)]) {
    await assert.rejects(permissive.respond({ identity, submissionId: 'invalid', answer }, f.context), TypeError);
  }
  assert.equal(getterCalls, 0);
  const abort = new AbortController(); abort.abort(new Error('stop'));
  await assert.rejects(gate.cancel(identity, { ...f.context, signal: abort.signal }), /stop/);
  assert.equal((await gate.read(identity, f.context)).status, 'pending');
});

test('lost response acknowledgement is resolved by retrying the same persisted submission', async () => {
  const f = fixture();
  let loseAcknowledgement = true;
  const original = f.store.save;
  f.store.save = async (key, record) => {
    await original(key, record);
    if (record.status === 'resolved' && loseAcknowledgement) {
      loseAcknowledgement = false;
      throw new Error('acknowledgement lost');
    }
  };
  const gate = f.create();
  await gate.open({ identity, expiresAtMs: 100 }, f.context);
  const request = { identity, submissionId: 'answer', answer: { approved: true } };
  await assert.rejects(gate.respond(request, f.context), /acknowledgement lost/);
  assert.equal((await f.create().respond(request, f.context)).status, 'resolved');
  assert.equal(f.saves, 2);
});


test('identity and construction getters are captured once before validation and binding', async () => {
  const f = fixture();
  const counts = { id: 0, revision: 0, isAnswer: 0, authorize: 0, store: 0, now: 0 };
  const definition = {
    get id() { counts.id++; return 'approval'; },
    get revision() { counts.revision++; return '1'; },
    get isAnswer() { counts.isAnswer++; return value => value?.approved === true; },
    get authorize() { counts.authorize++; return (id, context) => {
      if (context.app.subject !== id.subject) throw new Error('denied');
    }; },
  };
  const gate = defineWaitGate(definition, {
    get store() { counts.store++; return f.store; },
    get now() { counts.now++; return () => 10; },
  });
  assert.deepEqual(counts, { id: 1, revision: 1, isAnswer: 1, authorize: 1, store: 1, now: 1 });
  const reads = { taskId: 0, waitId: 0, subject: 0 };
  const requestIdentity = Object.fromEntries(Object.keys(reads).map(key => [key, identity[key]]));
  for (const key of Object.keys(reads)) Object.defineProperty(requestIdentity, key, {
    enumerable: true, get() { reads[key]++; return reads[key] === 1 ? identity[key] : undefined; },
  });
  const opened = await gate.open({ identity: requestIdentity, expiresAtMs: 100 }, f.context);
  assert.deepEqual(opened.identity, identity);
  assert.deepEqual(reads, { taskId: 1, waitId: 1, subject: 1 });
});

test('cancellation during a save retains the lock until persistence settles', async () => {
  const f = fixture();
  const original = f.store.save;
  let entered, release;
  const saving = new Promise(resolve => { entered = resolve; });
  const finish = new Promise(resolve => { release = resolve; });
  f.store.save = async (...args) => { entered(); await finish; await original(...args); };
  const gate = f.create();
  const controller = new AbortController();
  const opening = gate.open({ identity, expiresAtMs: 100 }, { ...f.context, signal: controller.signal });
  await saving;
  controller.abort(new Error('cancelled'));
  let readFinished = false;
  const reading = gate.read(identity, f.context).then(value => { readFinished = true; return value; });
  await Promise.resolve();
  assert.equal(readFinished, false);
  const rejected = assert.rejects(opening, /cancelled/);
  release();
  await rejected;
  assert.equal((await reading).status, 'pending');
  assert.equal(f.saves, 1);
});


test('R2 reconciles a persisted write in a new process without repeating the operation', async () => {
  const { runDurableExample } = await import('../development/examples/harness-durable.mjs');
  const result = await runDurableExample();
  assert.equal(result.waiting.result.status, 'waiting');
  assert.equal(result.uncertain.result.status, 'unknown');
  assert.equal(result.completed.result.status, 'completed');
  assert.deepEqual(result.queried.result, result.completed.result);
  assert.equal(new Set([result.waiting.pid, result.uncertain.pid, result.completed.pid, result.queried.pid]).size, 4);
  assert.equal(result.artifactWrites, 1);
  assert.equal(result.savedWrites, 1);
  assert.equal(result.confirmationCount, 1);
});

test('malformed gate setup and request identity fail closed before touching storage', async () => {
  const f = fixture(), gate = f.create();
  assert.throws(() => defineWaitGate(undefined, undefined), /Invalid wait gate/);
  assert.throws(() => f.create({ revision: '' }), /Invalid wait gate/);
  for (const value of [undefined, { ...identity, taskId: ' ' }])
    await assert.rejects(gate.read(value, f.context), /Invalid wait identity/);
  await assert.rejects(gate.read(identity, { signal: f.context.signal }), /OperationContext/);
  for (const request of [
    { identity, expiresAtMs: 0.5 },
    { identity, expiresAtMs: -1 },
    { identity, expiresAtMs: 100, previousWaitId: ' ' },
  ]) await assert.rejects(gate.open(request, f.context), /Invalid wait opening/);
  await assert.rejects(gate.respond({ identity, submissionId: ' ', answer: {} }, f.context), /Invalid wait submission/);
  assert.equal(f.saves, 0);
  assert.deepEqual(f.calls, []);
});

test('reopening is idempotent, does not extend expiry and cannot fabricate a predecessor', async () => {
  const f = fixture(), gate = f.create();
  await assert.rejects(gate.read(identity, f.context), { code: 'WAIT_MISSING' });
  await assert.rejects(gate.open({ identity, expiresAtMs: 10 }, f.context), { code: 'WAIT_EXPIRED' });
  await assert.rejects(gate.open({ identity, expiresAtMs: 20, previousWaitId: 'absent' }, f.context), { code: 'WAIT_CONFLICT' });
  const first = await gate.open({ identity, expiresAtMs: 20 }, f.context);
  await assert.rejects(gate.open({ identity, expiresAtMs: 21 }, f.context), { code: 'WAIT_CONFLICT' });
  assert.deepEqual(await gate.open({ identity, expiresAtMs: 20 }, f.context), first);
  assert.equal(f.saves, 1);
  const request = { identity, submissionId: 'answer', answer: { approved: true, choices: [true, { y: 2, x: 1 }] } };
  const resolved = await gate.respond(request, f.context);
  assert.deepEqual(await gate.respond({ ...request, answer: { choices: [true, { x: 1, y: 2 }], approved: true } }, f.context), resolved);
  await assert.rejects(gate.respond({ ...request, answer: { ...request.answer, choices: [false] } }, f.context), { code: 'WAIT_CONFLICT' });
  await assert.rejects(gate.cancel(identity, f.context), { code: 'WAIT_CONFLICT' });
  assert.equal(f.saves, 2);
});

test('corrupt stored waits and malformed array answers never mutate storage', async () => {
  const f = fixture(), gate = f.create();
  const record = await gate.open({ identity, expiresAtMs: 20 }, f.context);
  const [key] = f.records.keys();
  for (const [patch, message] of [
    [{ expiresAtMs: -1 }, /Invalid wait record/],
    [{ status: 'resolved' }, /Invalid wait submission/],
    [{ submission: { id: 'unexpected', answer: { approved: true } } }, /Invalid wait submission/],
  ]) {
    f.records.set(key, { ...record, ...patch });
    await assert.rejects(gate.read(identity, f.context), message);
  }
  f.records.set(key, record);
  const subclass = new (class extends Array {})();
  const sparse = [, true];
  sparse.extra = 'never persisted';
  const proxy = new Proxy([true], {});
  for (const choices of [subclass, sparse, proxy])
    await assert.rejects(gate.respond({ identity, submissionId: 'answer', answer: { approved: true, choices } },
      f.context), /Wait data must be JSON serializable/);
  assert.equal(f.saves, 1);
  assert.equal((await gate.read(identity, f.context)).status, 'pending');
});

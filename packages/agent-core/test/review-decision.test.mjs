import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defineReviewDecision } from '../dist/esm/kits/review-decision.js';
import { defineWaitGate } from '../dist/esm/kits/waiting.js';

function fixture() {
  let now = 1, record, accepted, calls = 0, allowed = true;
  const binding = { parentTaskId: 'parent', disputeId: 'd', contentRevision: '1', sourceVersions: { source: '1' }, policyRevision: '1', waitIdentity: { taskId: 'parent/d/1', waitId: 'w', subject: 'owner' }, actionId: 'select-1', deadlineAtMs: 100 };
  const context = { app: {}, signal: new AbortController().signal };
  const authorize = () => { if (!allowed) throw new Error('Denied'); };
  const gate = defineWaitGate({ id: 'decision', revision: '1', isAnswer: (v) => v?.choice === 'a', authorize }, { now: () => now, store: { async exclusive(_key, action) { return action(); }, async load() { return record; }, async save(_key, value) { record = value; } } });
  const definition = {
    binding, gate, authorize, now: () => now,
    read() { return accepted ?? { binding, status: 'pending' }; },
    accept({ binding: expected, submissionId }) { calls++; accepted = { binding: expected, status: 'accepted', submissionId, result: { selected: 'existing-result-a' } }; return accepted; },
  };
  return { binding, context, definition, gate, get calls() { return calls; }, clock: (v) => now = v, deny: () => allowed = false };
}

test('decision read is pure; repeat continuation queries the accepted receipt after expiry', async () => {
  const f = fixture(), decision = defineReviewDecision(f.definition);
  await decision.open({ expiresAtMs: 90 }, f.context);
  await decision.respond({ submissionId: 's', answer: { choice: 'a' } }, f.context);
  assert.equal((await decision.read(f.context)).status, 'pending');
  assert.equal(f.calls, 0);
  const first = await decision.continue(f.context);
  f.clock(101);
  assert.deepEqual(await decision.continue(f.context), first);
  assert.equal(f.calls, 1);
  f.deny();
  await assert.rejects(decision.read(f.context), /Denied/);
});

test('changed source/content/policy/action and mismatched accepted submission reject', async () => {
  for (const key of ['contentRevision', 'policyRevision', 'actionId']) {
    const f = fixture(), decision = defineReviewDecision(f.definition);
    f.binding[key] = 'changed';
    await assert.rejects(decision.read(f.context), { code: 'REVIEW_DECISION_STALE' });
  }
  const f = fixture(), decision = defineReviewDecision(f.definition);
  await decision.open({ expiresAtMs: 90 }, f.context);
  await decision.respond({ submissionId: 's', answer: { choice: 'a' } }, f.context);
  f.definition.accept = () => { throw new Error('Bound original method must remain'); };
  assert.equal((await decision.continue(f.context)).submissionId, 's');
});

test('execution expiry blocks first acceptance but not pure reads', async () => {
  const f = fixture(), decision = defineReviewDecision(f.definition);
  await decision.open({ expiresAtMs: 90 }, f.context);
  await decision.respond({ submissionId: 's', answer: { choice: 'a' } }, f.context);
  f.clock(101);
  await assert.rejects(decision.continue(f.context), { code: 'REVIEW_DECISION_EXPIRED' });
  assert.equal((await decision.read(f.context)).status, 'pending');
  assert.equal(f.calls, 0);
});

test('unrelated accepted receipt and changed source version cannot be admitted', async () => {
  const f = fixture();
  f.definition.accept = ({ binding }) => ({ binding, status: 'accepted', submissionId: 'another-submission', result: 'wrong' });
  const decision = defineReviewDecision(f.definition);
  await decision.open({ expiresAtMs: 90 }, f.context);
  await decision.respond({ submissionId: 's', answer: { choice: 'a' } }, f.context);
  await assert.rejects(decision.continue(f.context), { code: 'REVIEW_DECISION_CONFLICT' });
  const g = fixture(), stale = defineReviewDecision(g.definition);
  g.binding.sourceVersions.source = '2';
  await assert.rejects(stale.read(g.context), { code: 'REVIEW_DECISION_STALE' });
});

test('pure query cannot project an accepted receipt belonging to a different submission', async () => {
  const f = fixture();
  const decision = defineReviewDecision(f.definition);
  await decision.open({ expiresAtMs: 90 }, f.context);
  await decision.respond({ submissionId: 's', answer: { choice: 'a' } }, f.context);
  await decision.continue(f.context);
  // Rebind the host read port with corrupt cross-record data; the actual gate is unchanged.
  f.definition.read = () => ({ binding: f.binding, status: 'accepted', submissionId: 'other', result: 'wrong' });
  const corrupted = defineReviewDecision(f.definition);
  await assert.rejects(corrupted.read(f.context), { code: 'REVIEW_DECISION_CONFLICT' });
  assert.equal(f.calls, 1);
});

test('cancellation inside a custom gate read prevents the first atomic acceptance', async () => {
  const f = fixture(), controller = new AbortController();
  const context = { ...f.context, signal: controller.signal };
  f.definition.gate = {
    ...f.gate,
    async read() {
      controller.abort(new Error('Cancelled while reading gate'));
      return { status: 'resolved', identity: f.binding.waitIdentity, submission: { id: 's', answer: { choice: 'a' } } };
    },
  };
  const decision = defineReviewDecision(f.definition);
  await assert.rejects(decision.continue(context), /Cancelled while reading gate/);
  assert.equal(f.calls, 0);
});

test('cancellation after acceptance starts waits for persistence to settle', async () => {
  const f = fixture(), controller = new AbortController();
  const context = { ...f.context, signal: controller.signal };
  let release, started, settled = false;
  const began = new Promise(resolve => { started = resolve; });
  f.definition.accept = async ({ binding, submissionId }) => {
    started();
    await new Promise(resolve => { release = resolve; });
    settled = true;
    return { binding, status: 'accepted', submissionId, result: 'persisted' };
  };
  const decision = defineReviewDecision(f.definition);
  await decision.open({ expiresAtMs: 90 }, context);
  await decision.respond({ submissionId: 's', answer: { choice: 'a' } }, context);
  const continuing = decision.continue(context);
  await began;
  controller.abort(new Error('Cancelled after acceptance started'));
  assert.equal(settled, false);
  release();
  await assert.rejects(continuing, /Cancelled after acceptance started/);
  assert.equal(settled, true);
});

test('invalid persisted decisions and out-of-contract expiry fail before gate mutation', async () => {
  const f = fixture();
  assert.throws(() => defineReviewDecision(undefined), { code: 'REVIEW_DECISION_BINDING' });
  for (const patch of [{ deadlineAtMs: -1 }, { sourceVersions: { source: '' } }])
    assert.throws(() => defineReviewDecision({ ...f.definition, binding: { ...f.binding, ...patch } }),
      { code: 'REVIEW_DECISION_BINDING' });
  assert.throws(() => defineReviewDecision({ ...f.definition, accept: undefined }), /Invalid review decision ports/);
  const decision = defineReviewDecision(f.definition);
  await assert.rejects(decision.open({ expiresAtMs: 101 }, f.context), { code: 'REVIEW_DECISION_EXPIRED' });
  await assert.rejects(f.gate.read(f.binding.waitIdentity, f.context), { code: 'WAIT_MISSING' });
  await decision.open({ expiresAtMs: 90 }, f.context);
  assert.equal((await decision.continue(f.context)).status, 'pending');
  assert.equal(f.calls, 0);
  for (const patch of [{ status: 'complete' }, { status: 'accepted', submissionId: ' ' }]) {
    const corrupted = defineReviewDecision({ ...f.definition, read: () => ({ binding: f.binding, ...patch }) });
    await assert.rejects(corrupted.read(f.context), { code: 'REVIEW_DECISION_STATE' });
  }
  const forged = defineReviewDecision({
    ...f.definition, read: () => ({ binding: f.binding, status: 'accepted', submissionId: 'unconfirmed' }),
  });
  await assert.rejects(forged.continue(f.context), { code: 'REVIEW_DECISION_CONFLICT' });
  assert.equal(f.calls, 0);
});

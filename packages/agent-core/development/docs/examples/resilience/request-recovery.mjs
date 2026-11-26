/** Offline request recovery with an App-owned receipt and a counted write port. */
import assert from 'node:assert/strict';
import { Support } from '@jangts/agent-core';
import { defineCompletionChecks } from '@jangts/agent-core/kits/completion';

function createRequest({ save, compose, repair, optionalAudit }) {
  const checks = defineCompletionChecks([
    {
      id: 'detail-format',
      required: true,
      check: ({ detail }) =>
        detail.startsWith('Report: ')
          ? { kind: 'ready' }
          : { kind: 'repair', target: 'format', reason: 'Use the report detail format' },
    },
    {
      id: 'optional-audit',
      required: false,
      check: optionalAudit,
    },
  ]);

  async function acceptDetail(record, detail, signal) {
    const report = await checks.run({ detail }, signal);
    record.checks.push(...report.observations);
    if (report.decision.kind !== 'ready') throw new Error(report.decision.reason);
    return { status: 'saved', receipt: record.receipt, detail };
  }

  return Support.createRequestRecovery({
    async execute(record, signal) {
      record.receipt = await save(signal);
      signal.throwIfAborted();
      const detail = await compose(record.receipt, signal);
      return acceptDetail(record, detail, signal);
    },
    async recover(record, error, signal) {
      if (!record.receipt)
        throw new Error('A confirmed receipt is required for repair', { cause: error });
      const detail = await repair(record.receipt, signal);
      return acceptDetail(record, detail, signal);
    },
    fallback(record) {
      record.fallbacks++;
      return record.receipt
        ? { status: 'saved', receipt: record.receipt, detail: 'Report detail is unavailable.' }
        : { status: 'unconfirmed', detail: 'The save could not be confirmed.' };
    },
  });
}

const ready = () => ({ kind: 'ready' });
function fixture(overrides = {}) {
  const controller = new AbortController();
  const record = { receipt: undefined, checks: [], fallbacks: 0, writes: 0, repairs: 0 };
  const request = createRequest({
    async save() {
      record.writes++;
      if (overrides.loseAcknowledgement) throw new Error('Write acknowledgement lost');
      return { id: 'report-17' };
    },
    compose: overrides.compose ?? (() => 'Unstructured detail'),
    async repair(receipt, signal) {
      record.repairs++;
      return overrides.repair ? overrides.repair(receipt, signal) : `Report: ${receipt.id}`;
    },
    optionalAudit: overrides.optionalAudit ?? ready,
  });
  return { record, controller, run: () => request(record, controller.signal) };
}

const recovered = fixture();
const repaired = await recovered.run();
assert.equal(repaired.source, 'recovery');
assert.deepEqual(repaired.value.receipt, { id: 'report-17' });
assert.equal(recovered.record.writes, 1);
assert.equal(recovered.record.repairs, 1);

const unavailable = fixture({
  repair() {
    throw new Error('Repair unavailable');
  },
});
const fallback = await unavailable.run();
assert.equal(fallback.source, 'fallback');
assert.equal(fallback.value.status, 'saved');
assert.equal(fallback.value.receipt.id, 'report-17');
assert.equal(fallback.errors.length, 2);
assert.equal(unavailable.record.writes, 1);

const uncertain = fixture({ loseAcknowledgement: true });
const unknown = await uncertain.run();
assert.equal(unknown.source, 'fallback');
assert.equal(unknown.value.status, 'unconfirmed');
assert.equal(unknown.value.receipt, undefined);
assert.equal(uncertain.record.repairs, 0);
assert.equal(uncertain.record.writes, 1);

const optional = fixture({
  compose: () => 'Report: report-17',
  optionalAudit() {
    throw new Error('Auxiliary check unavailable');
  },
});
assert.equal((await optional.run()).source, 'execution');
assert.equal(
  optional.record.checks.find((check) => check.id === 'optional-audit').error.message,
  'Auxiliary check unavailable',
);

const cancelled = fixture({
  compose() {
    cancelled.controller.abort(new DOMException('Cancelled after confirmed save', 'AbortError'));
    return 'Report: report-17';
  },
});
await assert.rejects(cancelled.run(), /Cancelled after confirmed save/);
assert.equal(cancelled.record.receipt.id, 'report-17');
assert.equal(cancelled.record.writes, 1);
assert.equal(cancelled.record.repairs, 0);
assert.equal(cancelled.record.fallbacks, 0);

console.log('PASS format repair preserves the write receipt');
console.log('PASS fallback preserves the receipt and both failure causes');
console.log('PASS an unconfirmed write remains unknown without replay');
console.log('PASS an optional check failure is recorded and delivery proceeds');
console.log('PASS cancellation skips repair and fallback after the confirmed write');

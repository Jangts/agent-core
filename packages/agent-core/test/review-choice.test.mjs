import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectReviewChoices, isReviewChoice, isReviewChoiceAnswer, bindReviewChoiceDecision } from '../dist/esm/kits/review-choice.js';

function options() {
  return {
    scope: { id: 'parent', contentRevision: '1', policyRevision: 'policy-1' },
    inputs: [{ id: 'a', summary: 'proposal a', complete: true }, { id: 'b', summary: 'proposal b', complete: true }],
    versions: [{ resourceId: 'z', revision: '1' }, { resourceId: 'a', revision: '1' }],
    binding: { parentTaskId: 'parent', disputeId: 'd', contentRevision: '1', sourceVersions: { z: '1', a: '1' }, policyRevision: 'policy-1', actionId: 'select-1', deadlineAtMs: Date.now() + 60000, waitIdentity: { taskId: 'parent/d/1', waitId: 'w', subject: 'owner' } },
    signal: new AbortController().signal,
    async compare() { return JSON.stringify({ conflict: true, reason: 'mutually exclusive proposals' }); },
  };
}

test('choice recipe resolves only an existing complete result, repeat answers remain idempotent', async () => {
  const input = options();
  let stored = await inspectReviewChoices(input), writes = 0;
  const initial = structuredClone(stored);
  const host = { signal: input.signal, authorize() {}, async read() { return structuredClone(stored); }, async save(record, summary) { stored = record; if (summary !== undefined) { assert.equal(summary, 'proposal a'); writes++; } } };
  const { decision, context } = bindReviewChoiceDecision(stored, host);
  await decision.open({ expiresAtMs: input.binding.deadlineAtMs }, context);
  const request = { submissionId: 's', answer: { inputId: 'a', reason: 'owner preference' } };
  await decision.respond(request, context);
  assert.equal((await decision.read(context)).status, 'pending');
  await decision.continue(context);
  await decision.respond(request, context);
  await decision.continue(context);
  assert.equal(writes, 1);
  assert.ok(isReviewChoice(stored));
  assert.equal(initial.status, 'waiting');
  await assert.rejects(decision.respond({ ...request, answer: { inputId: 'b', reason: 'changed' } }, context), { code: 'WAIT_CONFLICT' });
});

test('incomplete members and failed comparisons cannot be selected', async () => {
  const input = options(); input.inputs[1].complete = false;
  input.compare = async () => { throw new Error('Must not run for incomplete evidence'); };
  const result = await inspectReviewChoices(input);
  assert.equal(result.status, 'incomplete');
  assert.equal(isReviewChoiceAnswer(result, { inputId: 'a', reason: 'ignore missing' }), false);
  const invalid = options(); invalid.compare = async () => '{broken';
  const failed = await inspectReviewChoices(invalid);
  assert.equal(failed.status, 'incomplete');
  assert.equal(failed.assessment.coverage[0].status, 'failed');
});

test('malformed persistence, forged ready, unknown references and unmatched wait reject', async () => {
  const original = await inspectReviewChoices(options());
  const variants = [
    { ...original, status: 'ready' }, { ...original, assessment: { findings: [], coverage: [] } },
    { ...original, binding: { ...original.binding, actionId: '' } },
    { ...original, inputs: [original.inputs[0], original.inputs[0]] },
    { ...original, assessment: { ...original.assessment, findings: [{ ...original.assessment.findings[0], inputIds: ['unknown'] }] } },
    { ...original, assessment: { ...original.assessment, coverage: [{ detectorId: 'semantic', status: 'complete', inspected: [], skipped: [] }] } },
    { ...original, accepted: { submissionId: 'forged', result: { inputId: 'a', reason: 'forged' } } },
  ];
  for (const value of [null, {}, [], ...variants]) assert.equal(isReviewChoice(value), false);
});

test('changed source binding is rejected before waiting or selection', async () => {
  const input = options(), stored = await inspectReviewChoices(input);
  const { decision, context } = bindReviewChoiceDecision(stored, { signal: input.signal, authorize() {}, async read() { return { ...stored, binding: { ...stored.binding, sourceVersions: { z: '2', a: '1' } } }; }, async save() { assert.fail('No write on stale source'); } });
  await assert.rejects(decision.open({ expiresAtMs: input.binding.deadlineAtMs }, context), { code: 'REVIEW_DECISION_STALE' });
});

test('complete lone or compatible opinions do not require a choice', async () => {
  const single = options();
  single.inputs.pop();
  single.compare = () => assert.fail('one opinion invokes no comparison');
  const lone = await inspectReviewChoices(single);
  assert.equal(lone.status, 'ready');
  assert.equal(isReviewChoice(lone), true);
  assert.deepEqual(lone.assessment.findings, []);
  const compatible = options();
  compatible.compare = async () => '{"conflict":false,"reason":"same conclusion"}';
  const result = await inspectReviewChoices(compatible);
  assert.equal(result.status, 'ready');
  for (const malformed of [
    { ...result, status: 'waiting' }, { ...result, status: 'incomplete' },
  ]) assert.equal(isReviewChoice(malformed), false);
});

test('choice inspection rejects malformed associations and marks incomplete model comparison', async () => {
  const missing = options();
  missing.inputs = [];
  await assert.rejects(inspectReviewChoices(missing), /Invalid review choice inputs/);
  const mismatched = options();
  mismatched.versions[0].revision = '2';
  await assert.rejects(inspectReviewChoices(mismatched), /Invalid review choice association/);
  const badOutput = options();
  badOutput.compare = async () => '{"conflict":"false","reason":"malformed"}';
  const result = await inspectReviewChoices(badOutput);
  assert.equal(result.status, 'incomplete');
  assert.match(result.assessment.coverage[0].reason, /Invalid review comparison/);
  assert.throws(() => bindReviewChoiceDecision({}, {}), /Invalid review choice/);
});

test('choice restoration rejects forged coverage, wait data and accepted answers', async () => {
  const input = options();
  let stored = await inspectReviewChoices(input);
  const host = {
    signal: input.signal, authorize() {}, async read() { return structuredClone(stored); },
    async save(value) { stored = value; },
  };
  const { decision, context } = bindReviewChoiceDecision(stored, host);
  await decision.open({ expiresAtMs: input.binding.deadlineAtMs }, context);
  const pending = structuredClone(stored);
  await decision.respond({ submissionId: 's', answer: { inputId: 'a', reason: 'chosen' } }, context);
  const resolved = structuredClone(stored);
  const malformed = [
    { ...resolved, accepted: { submissionId: ' ', result: { inputId: 'a', reason: 'chosen' } } },
    { ...resolved, accepted: { submissionId: 's', result: { inputId: 'unknown', reason: 'chosen' } } },
    { ...pending, wait: { ...pending.wait, expiresAtMs: -1 } },
    { ...pending, wait: { ...pending.wait, submission: { id: 's' } } },
    { ...resolved, wait: { ...resolved.wait, submission: { id: '' } } },
    { ...resolved, accepted: { submissionId: 'other', result: { inputId: 'a', reason: 'chosen' } } },
    { ...resolved, assessment: { ...resolved.assessment, coverage: [{ detectorId: 'semantic', status: 'complete', inspected: ['unrelated'], skipped: [] }] } },
  ];
  for (const record of malformed) assert.equal(isReviewChoice(record), false);
  stored = malformed[0];
  await assert.rejects(decision.read(context), /Invalid stored review choice/);
});

test('acceptance verifies the current resolved answer after reading the wait and reauthorizing', async () => {
  const input = options();
  let stored = await inspectReviewChoices(input);
  let replaceAfter = 0;
  let reads = 0;
  let replacement;
  let writes = 0;
  const host = {
    signal: input.signal, authorize() {},
    async read() {
      if (replaceAfter && ++reads === replaceAfter) stored = replacement;
      return structuredClone(stored);
    },
    async save(value) { writes++; stored = structuredClone(value); },
  };
  const { decision, context } = bindReviewChoiceDecision(stored, host);
  await decision.open({ expiresAtMs: input.binding.deadlineAtMs }, context);
  const submitted = { inputId: 'a', reason: 'chosen' };
  await decision.respond({ submissionId: 'first', answer: submitted }, context);
  const snapshot = structuredClone(stored);
  const writeCount = writes;
  for (const [record, error] of [
    [{ ...snapshot, binding: { ...snapshot.binding, sourceVersions: { z: '2', a: '1' } } }, /REVIEW_CHOICE_STALE/],
    [{ ...snapshot, wait: { ...snapshot.wait, status: 'pending', submission: undefined } }, /REVIEW_CHOICE_STALE/],
    [{ ...snapshot, wait: { ...snapshot.wait, submission: { id: 'first', answer: { inputId: 'b', reason: 'changed' } } } },
      /REVIEW_CHOICE_STALE/],
    [{ ...snapshot, status: 'ready',
      wait: { ...snapshot.wait, submission: { id: 'other', answer: { inputId: 'b', reason: 'other' } } },
      accepted: { submissionId: 'other', result: { inputId: 'b', reason: 'other' } } }, /REVIEW_CHOICE_CONFLICT/],
  ]) {
    stored = structuredClone(snapshot);
    reads = 0;
    replaceAfter = 3;
    replacement = record;
    assert.equal(isReviewChoice(record), true);
    await assert.rejects(decision.continue(context), error);
    assert.equal(writes, writeCount);
    assert.deepEqual(stored, record);
  }
  stored = structuredClone(snapshot);
  reads = 0;
  replacement = { ...snapshot, status: 'ready', accepted: { submissionId: 'first', result: submitted } };
  assert.equal((await decision.continue(context)).submissionId, 'first');
  assert.equal(writes, writeCount);
});

test('choice snapshots reject duplicate findings and prototype-dependent wait identities', async () => {
  const input = options();
  const record = await inspectReviewChoices(input);
  assert.equal(isReviewChoice({
    ...record, assessment: { ...record.assessment, findings: [record.assessment.findings[0], record.assessment.findings[0]] },
  }), false);
  const { decision, context } = bindReviewChoiceDecision(record, {
    signal: input.signal, authorize() {}, async read() { return record; }, async save(next) { Object.assign(record, next); },
  });
  await decision.open({ expiresAtMs: input.binding.deadlineAtMs }, context);
  const malformed = { ...record, wait: { ...record.wait, identity: ['parent', 'wait', 'owner'] } };
  assert.equal(isReviewChoice(malformed), false);
});

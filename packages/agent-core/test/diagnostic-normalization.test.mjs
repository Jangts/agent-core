/*
 * Storage contract for diagnostic envelopes: which envelope versions are accepted
 * and what normalization guarantees.
 *
 * A diagnostic record is persisted and later read back, so normalization has to be
 * a pure, idempotent conversion into a detached copy (later mutation of the input
 * must not change the output), and only v2 canonical envelopes may pass. The
 * legacy v1 shape, renumbered sequences, missing identities and unknown node roles
 * are rejected instead of being guessed, and reported sub-steps must be one-based.
 *
 * Runs on `dist/esm` with hand-built records and one real diagnostics emitter.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiagnostics, normalizeDiagnosticEvent } from '../dist/esm/index.js';

const record = (overrides) => ({
  version: 2,
  eventId: 'event',
  type: 'model.output',
  runId: 'run',
  spanId: 'run/model',
  producerSequence: 1,
  occurredAtMs: 17,
  payload: { stageId: 'reply', partIndex: 0, part: 'text' },
  subSteps: [],
  subStepsDropped: 0,
  subStepsTruncated: false,
  ...overrides,
});

test('current diagnostic envelopes preserve storage metadata and normalize into detached records', () => {
  const input = record({
    source: 'core',
    sequence: 7,
    recordedAtMs: 20,
    subSteps: [
      {
        stepId: 'reported',
        origin: 'reported',
        sequence: 1,
        name: 'Reported work',
        kind: 'check',
        status: 'success',
      },
    ],
  });
  const normalized = normalizeDiagnosticEvent(input);
  assert.deepEqual(normalized, input);
  assert.deepEqual(normalizeDiagnosticEvent(normalized), normalized);
  assert.equal(normalized.sequence, 7);
  assert.equal('sourceVersion' in normalized, false);
  // Normalization returns a detached copy: mutating the source afterwards must not
  // change what was stored.
  input.payload.part = 'changed';
  input.subSteps[0].name = 'changed';
  assert.equal(normalized.payload.part, 'text');
  assert.equal(normalized.subSteps[0].name, 'Reported work');
  assert.deepEqual(
    normalizeDiagnosticEvent(
      record({ subSteps: undefined, subStepsDropped: undefined, subStepsTruncated: undefined }),
    ),
    record(),
  );
});

test('only v2 canonical envelopes and one-based reported steps are accepted', () => {
  const legacy = {
    schemaVersion: 1,
    event: 'model.output',
    runId: 'run',
    spanId: 'span',
    sequence: 1,
    occurredAt: '2026-11-04T00:00:00.000Z',
    payload: { stage: 'reply', index: 0, part: 'text' },
  };
  for (const input of [legacy, record({ version: 1 }), record({ version: 9 })]) {
    assert.throws(() => normalizeDiagnosticEvent(input), /Unsupported diagnostic version/);
  }
  for (const input of [
    record({ type: undefined, event: 'model.output' }),
    record({ producerSequence: undefined, sequence: 1 }),
    record({ producerSequence: 0 }),
    record({ occurredAtMs: undefined, occurredAt: '2026-11-04T00:00:00.000Z' }),
  ])
    assert.throws(() => normalizeDiagnosticEvent(input), /Invalid diagnostic envelope/);
  assert.throws(
    () => normalizeDiagnosticEvent(record({ eventId: undefined })),
    /Invalid diagnostic event identity/,
  );
  assert.throws(
    () => normalizeDiagnosticEvent(record({ parentSpanId: 9 })),
    /Invalid diagnostic identity/,
  );
  assert.throws(
    () => normalizeDiagnosticEvent(record({ nodeRole: 'unknown' })),
    /Invalid diagnostic node role/,
  );
  // Reported sub-steps are one-based (sequence 0 is invalid) and must carry the
  // 'reported' origin; 'actual' belongs to steps Core observed itself.
  for (const subSteps of [
    'invalid',
    [{ stepId: 'step', origin: 'reported', sequence: 0, name: 'Step', kind: 'check' }],
    [{ stepId: 'step', origin: 'actual', sequence: 1, name: 'Step', kind: 'check' }],
  ])
    assert.throws(
      () => normalizeDiagnosticEvent(record({ subSteps })),
      /Invalid reported diagnostic steps/,
    );
});

test('current workflow diagnostics keep canonical event identity and payload without rewriting fields', () => {
  const events = [];
  const diagnostics = createDiagnostics({
    runId: 'run',
    output: { write: (event) => events.push(event) },
  });
  const payload = {
    event: {
      eventId: 'transition',
      workflowId: 'workflow',
      workflowInvocationId: 'invocation',
      nodeId: 'prepare',
      roundIndex: 0,
      targetNodeId: 'reply',
      type: 'transition',
    },
    payload: { detail: 'application value' },
  };
  diagnostics.child('workflow').emit('workflow.event', () => payload);
  const normalized = normalizeDiagnosticEvent(events[0]);
  assert.deepEqual(normalized, events[0]);
  assert.equal(normalized.eventId, 'transition');
  assert.deepEqual(normalized.payload, payload);
  assert.equal('workflow' in normalized.payload.event, false);
  assert.equal('round' in normalized.payload.event, false);
});

/*
 * Contracts for the reporting side of diagnostics: the sub-flow logger, node
 * reports, stored envelope size limits and the provider observation scope.
 *
 * Reported facts are append-only while a run is in progress: a rejected write must
 * not leave anything behind, an ended step cannot be re-timed, and successors can
 * be added but never removed. Node reports likewise cannot retract a `usedModel`
 * fact. The observation scope must keep ownership of its sink while observers are
 * composed and children are created.
 *
 * Runs on `dist/esm` with in-memory sinks; no transport is involved.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSubFlowLogger, payloadSnapshot } from '../dist/esm/diagnostics/sub-flow.js';
import { normalizeDiagnosticEvent } from '../dist/esm/diagnostics/index.js';
import { NodeReports } from '../dist/esm/execution/reporting.js';
import { createProviderObservationScope } from '../dist/esm/support/model/observer.js';
import { createDiagnostics } from '../dist/esm/index.js';
const logger = () =>
  createSubFlowLogger(
    {},
    () => true,
    () => true,
    () => {},
  );
test('reported subflows reject every malformed metadata category before mutation', () => {
  const log = logger();
  for (const input of [
    { name: '', kind: 'k' },
    { name: 'n', kind: 'k', status: 'foreign' },
    { name: 'n', kind: 'k', usedModel: 'yes' },
    { name: 'n', kind: 'k', startedAtMs: -1 },
    { name: 'n', kind: 'k', status: 'success', startedAtMs: 5, endedAtMs: 4 },
    { name: 'n', kind: 'k', status: 'running', endedAtMs: 5 },
    { name: 'n', kind: 'k', status: 'planned', startedAtMs: 5 },
    { name: 'n', kind: 'k', nextStepIds: [''] },
    { name: 'n', kind: 'k', nextStepIds: ['x', 'x'] },
    { name: 'n', kind: 'k', nextStepIds: ['foreign'] },
  ])
    assert.equal(log.write(input), -1);
  // Every rejection above must leave the log empty: validation happens before the
  // record is appended.
  assert.deepEqual(log.readAll(), []);
  const first = log.write({ name: 'first', kind: 'read', status: 'running', startedAtMs: 1 });
  log.fix(first, { status: 'success', endedAtMs: 2 });
  // Ending time is monotonic: a corrected end may not precede the recorded start.
  assert.equal(log.fix(first, { endedAtMs: 3 }), false);
  const second = log.write({ name: 'second', kind: 'read', nextStepIds: [first] });
  // Successors may be added later but never emptied: the relation is write-once.
  assert.equal(log.fix(second, { nextStepIds: [] }), false);
  // 65537 characters exceeds the 64 KiB string limit; the array case exceeds the
  // 4096-entry limit. Both are rejected before any snapshot is stored.
  assert.throws(() => payloadSnapshot({ text: 'x'.repeat(65537) }), /large/);
  assert.throws(() => payloadSnapshot({ array: Array(4097).fill(null) }), /large/);
});
test('diagnostic normalization enforces serialized substep size and node reports preserve model-use facts', () => {
  const event = {
    version: 2,
    type: 'node.progress',
    runId: 'r',
    spanId: 's',
    eventId: 'e',
    producerSequence: 1,
    occurredAtMs: 1,
    payload: {},
    subSteps: [
      {
        origin: 'reported',
        stepId: 'step',
        name: 'n',
        kind: 'k',
        sequence: 1,
        summary: 'x'.repeat(65537),
      },
    ],
  };
  assert.throws(() => normalizeDiagnosticEvent(event), /size limit/);
  const reports = new NodeReports();
  assert.throws(() => reports.receive(null), /report/);
  reports.receive({ usedModel: true });
  // A `usedModel` fact cannot be retracted once reported.
  assert.throws(() => reports.receive({ usedModel: false }), /model use/);
  reports.close();
  assert.throws(() => reports.createSubFlowLogger(), /closed/);
});
test('provider observation scopes retain ownership across observer composition without requiring a sink predicate', () => {
  const output = [],
    scope = createProviderObservationScope({ write: (...args) => output.push(args) });
  const flat = {
    enabled: () => true,
    emit() {},
    deliver() {},
    child() {
      return this;
    },
    withObserver() {
      return this;
    },
  };
  const context = scope
    .attach(flat, 'owner')
    .withObserver({ event() {} })
    .child('call');
  assert.equal(
    scope.observer.accepts(
      { event: 'provider.end', content: 'metadata' },
      { diagnostics: context },
    ),
    true,
  );
  scope.observer.write(
    { event: 'provider.end', payload: { complete: true } },
    { diagnostics: context },
  );
  assert.equal(output[0][0], 'owner');
  assert.equal(output[0][2], 'run/call');
  const identified = scope
    .attach(createDiagnostics({ runId: 'r' }), 'identified')
    .withObserver({ event() {} });
  assert.equal(
    scope.observer.accepts(
      { event: 'provider.frame', content: 'content' },
      { diagnostics: identified },
    ),
    true,
  );
});

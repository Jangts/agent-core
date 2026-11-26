import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createMatrixReference, inspection } from '../development/docs/examples/lifecycle-matrix.mjs';
import { fromDefinition, project, validate } from '../development/scripts/workflow-inspector/snapshot.mjs';
import { describeEvidence } from '../development/scripts/workflow-inspector/evidence.mjs';
import { compareWorkflows } from '../development/scripts/workflow-diff/diff.mjs';
import { render } from '../development/scripts/workflow-inspector/report.mjs';

const run = async (options = {}) => {
  const ref = createMatrixReference(options);
  return { ...ref, result: await ref.engine.run(ref.state) };
};
test('one proposal selects intent and tool; real all/selected hooks match the exported matrix', async () => {
  const { result, ledger, workflow } = await run();
  assert.equal(result.partial, false);
  assert.equal(result.evidence.source, 'monitor:7');
  assert.equal(ledger.calls.length, 1);
  assert.deepEqual(ledger.tools, ['read']);
  assert.deepEqual(ledger.hooks.map(h => h.bindingId), inspection.lifecycleMatrix.bindings.map(b => b.id).sort((a,b) => {
    const stage = id => ['inspect','authorize','complete','present'].indexOf(id.split('/')[0]);
    return stage(a) - stage(b);
  }));
  const runId = ledger.events.find(e => e.runId).runId;
  const chain = await workflow.toChain(runId);
  assert.equal(chain.nodes.flatMap(v => v.subflow).filter(s => s.relatedDefinitionId?.includes('/')).length >= 6, true);
});
test('greeting bypasses the matrix without another model decision', async () => {
  const { result, ledger } = await run({ greeting: true });
  assert.equal(result.answer, 'Hello!');
  assert.equal(ledger.calls.length, 1);
  assert.deepEqual(ledger.tools, []);
  assert.deepEqual(ledger.hooks, []);
});
for (const options of [{ proposal: { intent: 'status', next: { type: 'note' } } }, { denied: true }, { proposal: { intent: 'greeting', next: { type: 'read' } } }, { proposal: { intent: 'unknown', next: { type: 'read' } } }]) {
  test(`denial or invalid pairing never executes a tool: ${JSON.stringify(options)}`, async () => {
    const { result, ledger } = await run(options);
    assert.equal(result.partial, true);
    assert.equal(result.evidence, undefined);
    assert.deepEqual(ledger.tools, []);
    assert.equal(ledger.calls.length, 1);
  });
}
for (const option of ['modelFailure','toolFailure','optionalFailure']) test(`${option} has truthful recovery without replay`, async () => {
  const { result, ledger } = await run({ [option]: true });
  assert.equal(result.partial, true);
  assert.equal(ledger.calls.length, 1);
  if (option === 'optionalFailure') {
    assert.equal(result.answer, 'online (monitor:7)');
    assert.equal(result.evidence.source, 'monitor:7');
  } else assert.equal(result.evidence, undefined);
  assert.ok(ledger.tools.length <= 1);
});
test('cancellation terminates rather than being swallowed by recovery', async () => {
  const ref = createMatrixReference({ cancel: true });
  await assert.rejects(ref.engine.run(ref.state));
  assert.equal(ref.state.answer, undefined);
});
test('matrix projection checks references and rejects invalid or duplicate scopes, without changing legacy inputs', () => {
  const snapshot = fromDefinition(inspection);
  assert.deepEqual(validate(snapshot), []);
  assert.equal(describeEvidence(snapshot).declarations.lifecycleMatrix, 'supplied');
  assert.equal(describeEvidence(project(snapshot.graph)).matrix.status, 'not-supplied');
  for (const mutate of [
    s => s.lifecycleMatrix.bindings[0].nodeId = 'absent',
    s => s.lifecycleMatrix.bindings[0].toolId = 'absent',
    s => s.lifecycleMatrix.bindings[0].intentIds = ['greeting'],
    s => s.lifecycleMatrix.bindings.push(s.lifecycleMatrix.bindings[0]),
    s => s.lifecycleMatrix.bindings[0].intentIds = [],
  ]) { const candidate = structuredClone(snapshot); mutate(candidate); assert.throws(() => validate(project(candidate))); }
  const next = structuredClone(snapshot);
  next.lifecycleMatrix.bindings[0].handler = 'changedHandler';
  const diff = compareWorkflows(snapshot, next);
  assert.equal(diff.hasChanges, true);
  assert.deepEqual(diff.directlyAffectedNodes, ['inspect']);
  assert.deepEqual(diff.changes.matrixBindings.modified[0].fields, ['handler']);
});
test('portable report links declared cells to observed spans and exposes missing coverage', async () => {
  const ref = await run({ optionalFailure: true });
  const runId = ref.ledger.events.find(e => e.runId).runId;
  const snapshot = project({ ...fromDefinition(ref.inspection), chain: await ref.workflow.toChain(runId) });
  const dom = new JSDOM(render({ snapshot, warnings: validate(snapshot, runId), evidence: describeEvidence(snapshot) }), { runScripts: 'dangerously' });
  try {
    const document = dom.window.document;
    assert.equal(document.querySelectorAll('#matrix tr').length, 7);
    const row = document.querySelector('#matrix tr:nth-child(2)');
    assert.match(row.textContent, /inspectDecision/);
    row.querySelector('td:last-child button').click();
    assert.match(document.getElementById('inspector').textContent, /关联运行记录/);
    assert.match(document.getElementById('inspector').textContent, /inspect\/read\/inspect/);
  } finally { dom.window.close(); }
});

test('matrix declarations remain unknown without a run and tools reverse-link their lifecycle nodes', () => {
  const snapshot = fromDefinition(inspection);
  const dom = new JSDOM(render({ snapshot, warnings: validate(snapshot), evidence: describeEvidence(snapshot) }), {
    runScripts: 'dangerously', beforeParse(window) {
      window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
      window.HTMLDialogElement.prototype.close = function () { this.open = false; };
    },
  });
  try {
    const document = dom.window.document;
    assert.match(document.getElementById('matrix').textContent, /未观察到/);
    const note = [...document.querySelectorAll('#tools button')].find(button => button.textContent.includes('note'));
    assert.ok(note); note.click();
    const detail = document.getElementById('toolDetail');
    assert.match(detail.textContent, /inspect/);
    assert.match(detail.textContent, /present/);
    const target = [...detail.querySelectorAll('button')].find(button => button.textContent === 'present');
    target.click();
    assert.equal(document.querySelector('#graph .node.selected').getAttribute('aria-label'), 'present');
  } finally { dom.window.close(); }
});

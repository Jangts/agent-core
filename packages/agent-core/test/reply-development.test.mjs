import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectReplies } from '../development/skills/agent-core-reply-development/scripts/check-replies.mjs';
import { agentTests as facts } from '../development/skills/agent-core-reply-development/examples/facts-and-reference.mjs';
import { agentTests as presentation } from '../development/skills/agent-core-reply-development/examples/presentation-and-style.mjs';

const cli = fileURLToPath(new URL('../development/skills/agent-core-reply-development/scripts/check-replies.mjs', import.meta.url));
function snapshot() {
  return {
    version: 1, subject: { id: 'app', revision: '2' },
    entries: [{ id: 'explain', source: 'actual/catalog#explain', outputs: ['total'] }],
    references: [{ id: 'tone', source: 'copy/tone', revision: '3', purposes: ['style'] }],
    cases: [{ id: 'explain', entryId: 'explain', approach: 'model', referenceIds: ['tone'],
      expected: { kind: 'criteria', source: 'cases/explain' }, evidence: {}, claims: [] }],
  };
}
function receipt() {
  return { status: 'passed', subjectRevision: '2', proof: 'actual-run/42', assertions: 2 };
}
for (const entry of [...facts, ...presentation])
  test('reply example: ' + entry.id, async () => entry.run({ signal: new AbortController().signal }));

test('a fully model-driven untemplated case needs no program fields or fixed answer', () => {
  const input = snapshot();
  const report = inspectReplies(input);
  assert.equal(report.structuralStatus, 'consistent');
  assert.deepEqual(report.issues, []);
  assert.equal(report.reportedEvidence.semantic['not-run'], 1);
  input.cases[0].expected = { kind: 'none' };
  assert.equal(inspectReplies(input).structuralStatus, 'consistent');
});

test('adding answer content never upgrades semantic, model, UI or style evidence', () => {
  const input = snapshot();
  input.cases[0].expected = { kind: 'extracted', source: 'guide/paragraph', text: 'An answer exists.' };
  const report = inspectReplies(input);
  for (const phase of ['semantic', 'style', 'model', 'ui'])
    assert.equal(report.reportedEvidence[phase]['not-run'], 1);
  input.cases[0].claims = ['semantic'];
  assert.ok(inspectReplies(input).issues.some(({ code }) => code === 'CLAIM_UNSUPPORTED'));
});

test('actual declaration additions and unknown producer outputs remain visible', () => {
  const input = snapshot();
  input.entries.push({ id: 'new-entry', source: 'actual/catalog#new-entry' });
  input.cases[0].outputIds = ['someone-elses-total'];
  input.cases[0].referenceIds.push('missing-reference');
  const codes = new Set(inspectReplies(input).issues.map(({ code }) => code));
  for (const code of ['ENTRY_UNCOVERED', 'OUTPUT_UNKNOWN', 'REFERENCE_UNKNOWN']) assert.ok(codes.has(code));
});

test('claims require matching subject and only the reference revisions used by that receipt', () => {
  const input = snapshot();
  input.cases[0].evidence = { offline: receipt(), style: { ...receipt(), referenceRevisions: { tone: 'old' } } };
  input.cases[0].claims = ['offline', 'style'];
  let report = inspectReplies(input);
  assert.ok(report.issues.some(({ code }) => code === 'REFERENCE_STALE'));
  assert.equal(report.issues.filter(({ code }) => code === 'CLAIM_UNSUPPORTED').length, 1);
  input.cases[0].evidence.offline.subjectRevision = 'old';
  report = inspectReplies(input);
  assert.ok(report.issues.some(({ code }) => code === 'EVIDENCE_STALE'));
});

test('empty checks, missing receipts, failed and unrun records cannot support pass claims', () => {
  for (const evidence of [{ ...receipt(), assertions: 0 }, { ...receipt(), proof: '' },
    { ...receipt(), status: 'failed' }, { ...receipt(), status: 'not-run' }]) {
    const input = snapshot();
    input.cases[0].evidence = { offline: evidence };
    input.cases[0].claims = ['offline'];
    assert.ok(inspectReplies(input).issues.some(({ code }) => code === 'CLAIM_UNSUPPORTED'));
  }
});

test('reported human review can follow extraction without pretending the tool verified it', () => {
  const input = snapshot();
  input.cases[0].expected = { kind: 'extracted', source: 'guide' };
  input.cases[0].evidence = { semantic: receipt() };
  input.cases[0].claims = ['semantic'];
  const report = inspectReplies(input);
  assert.equal(report.structuralStatus, 'consistent');
  assert.equal(report.reportedEvidence.semantic.passed, 1);
  assert.match(report.limits.join(' '), /remain unverified/);
});

test('unsupported approach, duplicate identities and unjustified not-applicable records fail explicitly', () => {
  const input = snapshot();
  input.cases[0].approach = 'program-required';
  assert.throws(() => inspectReplies(input), /approach/);
  input.cases[0].approach = 'model';
  input.cases.push(input.cases[0]);
  assert.throws(() => inspectReplies(input), /unique/);
  input.cases.pop();
  input.cases[0].evidence = { ui: { status: 'not-applicable' } };
  assert.throws(() => inspectReplies(input), /reason/);
  input.cases[0].evidence.ui.reason = 'No UI in this scope';
  assert.equal(inspectReplies(input).structuralStatus, 'consistent');
});

test('JSON references are opaque: the CLI does not import a referenced executable', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'reply-inspection-'));
  try {
    const bomb = path.join(dir, 'bomb.mjs');
    await writeFile(bomb, "throw new Error('THIS MUST NEVER RUN');");
    const input = snapshot();
    input.references[0].source = bomb;
    const file = path.join(dir, 'input.json');
    await writeFile(file, JSON.stringify(input));
    const result = spawnSync(process.execPath, [cli, '--input', file], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).scope, 'supplied-snapshot-only');
    await writeFile(file, Buffer.from([0xff]));
    assert.equal(spawnSync(process.execPath, [cli, '--input', file]).status, 2);
    await writeFile(file, ' '.repeat(2 * 1024 * 1024 + 1));
    assert.equal(spawnSync(process.execPath, [cli, '--input', file]).status, 2);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

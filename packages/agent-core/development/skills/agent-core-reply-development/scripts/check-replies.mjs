/**
 * Inspect an App-exported reply snapshot without loading App code or resolving its references.
 * Results concern declared relationships and reported evidence, never answer truth or live coverage.
 * CLI reads one bounded local JSON file; imports expose the pure inspectReplies function only.
 */
import { open } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const phases = ['source', 'semantic', 'style', 'offline', 'model', 'ui'];
const statuses = ['not-run', 'passed', 'failed', 'unknown', 'not-applicable'];
const approaches = ['model', 'program', 'hybrid'];
const purposes = ['facts', 'expression', 'style', 'expected'];
const maxBytes = 2 * 1024 * 1024;
const text = (value) =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= 2048;
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
function requireValue(condition, message) {
  if (!condition) throw new TypeError(message);
}
function records(value, label) {
  requireValue(Array.isArray(value) && value.length <= 10000, label + ' must be a bounded array');
  return value;
}
function strings(value, label) {
  const items = records(value, label);
  requireValue(
    items.every(text) && new Set(items).size === items.length,
    label + ' needs unique strings',
  );
  return items;
}
function index(items, label) {
  const result = new Map();
  for (const item of records(items, label)) {
    requireValue(
      object(item) && text(item.id) && !result.has(item.id),
      label + ' needs unique ids',
    );
    result.set(item.id, item);
  }
  return result;
}

/** Inspect only the supplied snapshot. A receipt is a declaration, not proof re-executed here. */
export function inspectReplies(snapshot) {
  requireValue(object(snapshot) && snapshot.version === 1, 'Expected reply snapshot version 1');
  requireValue(
    object(snapshot.subject) && text(snapshot.subject.id) && text(snapshot.subject.revision),
    'subject needs id and revision',
  );
  const entries = index(snapshot.entries, 'entries');
  const references = index(snapshot.references ?? [], 'references');
  const cases = index(snapshot.cases, 'cases');
  for (const entry of entries.values()) {
    requireValue(text(entry.source), 'Entry source must identify its actual declaration');
    strings(entry.outputs ?? [], 'entry outputs');
  }
  for (const ref of references.values()) {
    requireValue(text(ref.source) && text(ref.revision), 'Reference needs source and revision');
    const uses = strings(ref.purposes, 'reference purposes');
    requireValue(
      uses.length > 0 && uses.every((use) => purposes.includes(use)),
      'Unknown reference purpose',
    );
  }
  const issues = [];
  const add = (code, severity, caseId, message) => issues.push({ code, severity, caseId, message });
  const counts = Object.fromEntries(
    phases.map((phase) => [phase, Object.fromEntries(statuses.map((status) => [status, 0]))]),
  );
  const covered = new Set();
  for (const item of cases.values()) {
    requireValue(approaches.includes(item.approach), 'Unknown processing approach');
    requireValue(
      object(item.expected) &&
        ['fixed', 'conditional', 'example', 'extracted', 'criteria', 'none'].includes(
          item.expected.kind,
        ),
      'Expected answer kind must be explicit',
    );
    if (item.expected.kind !== 'none')
      requireValue(
        text(item.expected.source),
        'Expected answer needs a source or criteria location',
      );
    const outputs = strings(item.outputIds ?? [], 'case outputIds');
    const refs = strings(item.referenceIds ?? [], 'case referenceIds');
    const claims = strings(item.claims ?? [], 'case claims');
    requireValue(
      claims.every((phase) => phases.includes(phase)),
      'Unknown evidence claim',
    );
    const entry = entries.get(item.entryId);
    if (!entry) add('ENTRY_UNKNOWN', 'error', item.id, 'The case does not name a supplied entry.');
    else {
      covered.add(entry.id);
      for (const id of outputs)
        if (!(entry.outputs ?? []).includes(id))
          add('OUTPUT_UNKNOWN', 'error', item.id, 'Output is not declared by this producer: ' + id);
    }
    for (const id of refs)
      if (!references.has(id))
        add('REFERENCE_UNKNOWN', 'error', item.id, 'Reference was not supplied: ' + id);
    requireValue(
      item.evidence === undefined || object(item.evidence),
      'evidence must be an object',
    );
    requireValue(
      Object.keys(item.evidence ?? {}).every((phase) => phases.includes(phase)),
      'Unknown evidence phase',
    );
    for (const phase of phases) {
      const receipt = item.evidence?.[phase];
      const status = receipt?.status ?? 'not-run';
      requireValue(statuses.includes(status), 'Unknown evidence status');
      if (receipt !== undefined)
        requireValue(object(receipt), 'Evidence receipt must be an object');
      if (status === 'not-applicable')
        requireValue(text(receipt.reason), 'Not-applicable evidence needs a reason');
      if (receipt?.assertions !== undefined)
        requireValue(
          Number.isSafeInteger(receipt.assertions) && receipt.assertions >= 0,
          'Invalid assertion count',
        );
      if (receipt?.referenceRevisions !== undefined)
        requireValue(object(receipt.referenceRevisions), 'referenceRevisions must be an object');
      let usable = status === 'passed';
      if (usable) {
        if (!text(receipt.proof)) {
          add(
            'PROOF_MISSING',
            'warning',
            item.id,
            phase + ': reported pass has no receipt location.',
          );
          usable = false;
        }
        if (receipt.subjectRevision !== snapshot.subject.revision) {
          add(
            'EVIDENCE_STALE',
            'warning',
            item.id,
            phase + ': receipt is not for the current subject revision.',
          );
          usable = false;
        }
        if (receipt.assertions === 0 || (phase === 'offline' && !(receipt.assertions > 0))) {
          add(
            'EMPTY_CHECKS',
            'warning',
            item.id,
            phase + ': a reported pass without assertions does not verify behavior.',
          );
          usable = false;
        }
        for (const [id, revision] of Object.entries(receipt.referenceRevisions ?? {})) {
          if (
            !refs.includes(id) ||
            !references.has(id) ||
            references.get(id).revision !== revision
          ) {
            add(
              'REFERENCE_STALE',
              'warning',
              item.id,
              phase + ': receipt reference changed or is outside this case: ' + id,
            );
            usable = false;
          }
        }
      }
      counts[phase][status]++;
      if (claims.includes(phase) && !usable)
        add(
          'CLAIM_UNSUPPORTED',
          'error',
          item.id,
          phase + ': the supplied record cannot support this pass claim.',
        );
    }
  }
  for (const entry of entries.values())
    if (!covered.has(entry.id))
      add('ENTRY_UNCOVERED', 'warning', undefined, 'No case maps the supplied entry: ' + entry.id);
  return {
    scope: 'supplied-snapshot-only',
    structuralStatus: issues.some((issue) => issue.severity === 'error') ? 'issues' : 'consistent',
    entries: entries.size,
    cases: cases.size,
    mappedEntries: covered.size,
    reportedEvidence: counts,
    issues,
    limits: [
      'No App code, provider, model, database or reference was executed or read.',
      'Receipt contents, semantic correctness, style suitability and actual App coverage remain unverified.',
    ],
  };
}

/** Read at most maxBytes + 1, even if a file grows after it is opened. */
async function readSnapshot(filename) {
  const file = await open(filename, 'r');
  try {
    const stat = await file.stat();
    requireValue(
      stat.isFile() && stat.size <= maxBytes,
      'Input must be a JSON file no larger than 2 MiB',
    );
    const buffer = Buffer.alloc(maxBytes + 1);
    let size = 0;
    while (size < buffer.length) {
      const { bytesRead } = await file.read(buffer, size, buffer.length - size, null);
      if (!bytesRead) break;
      size += bytesRead;
    }
    requireValue(size <= maxBytes, 'Input exceeded 2 MiB');
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, size)));
  } finally {
    await file.close();
  }
}

async function main() {
  const { values } = parseArgs({
    options: { input: { type: 'string' }, help: { type: 'boolean', short: 'h' } },
  });
  if (values.help) {
    console.log(
      'Usage: node check-replies.mjs --input snapshot.json\nInspects supplied JSON only; never executes an App or verifies answer semantics.',
    );
    return;
  }
  requireValue(text(values.input), 'Use --input with a local JSON snapshot');
  const report = inspectReplies(await readSnapshot(values.input));
  console.log(JSON.stringify(report, null, 2));
  if (report.structuralStatus === 'issues') process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 2;
  });

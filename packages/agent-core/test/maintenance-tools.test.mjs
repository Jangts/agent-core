// Locks the agent-core-app maintenance scripts: knowledge config byte snapshots, revision tracking,
// required-read enforcement and candidate preparation that never mutates active files.
// Covers `development/skills/agent-core-app/scripts/lib/knowledge.mjs` and `prepare-source.mjs`;
// `node --test` with temp directories and the real CLI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, readdir, rm, open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  readApplicationKnowledge,
  compileApplicationKnowledge,
} from '../development/skills/agent-core-app/scripts/lib/knowledge.mjs';

const run = promisify(execFile);
const tool = fileURLToPath(
  new URL('../development/skills/agent-core-app/scripts/prepare-source.mjs', import.meta.url),
);
// Wraps text in the only agent section, so required reads have a stable target.
const source = (text) => `<!-- agent-section:terms -->\n${text}\n<!-- /agent-section:terms -->\n`;
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'agent-maintenance-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const policy = {
    schemaVersion: 1,
    maxDocumentBytes: 1024,
    // 50 chars fits "Approved terms" but not the patched limit of 1 used later.
    maxReadChars: 50,
    documents: [{ id: 'guide', file: 'guide.knowledge.md', locale: 'zh-CN' }],
    requiredReads: [{ documentId: 'guide', selection: { mode: 'self', sectionIds: ['terms'] } }],
  };
  await writeFile(join(directory, 'knowledge.config.json'), JSON.stringify(policy, null, 2) + '\n');
  await writeFile(join(directory, 'guide.knowledge.md'), source('Approved terms'));
  return { directory, policy, url: pathToFileURL(directory + sep) };
}

test('validation and proposal baseline keep the actual configuration byte snapshot', async (t) => {
  const f = await fixture(t);
  const bytes = await readFile(join(f.directory, 'knowledge.config.json'));
  const snapshot = await readApplicationKnowledge(f.url);
  await writeFile(
    join(f.directory, 'knowledge.config.json'),
    JSON.stringify({ ...f.policy, maxReadChars: 1 }),
  );
  const catalog = compileApplicationKnowledge(snapshot.documents, snapshot.policy);
  assert.equal(catalog.read(f.policy.requiredReads[0]).content, 'Approved terms');
  // The baseline is the exact config bytes, not a normalized form.
  assert.equal(snapshot.baseConfigSha256, hash(bytes));
  const current = await readApplicationKnowledge(f.url);
  // Any config change, even maxReadChars, must change the baseline hash.
  assert.notEqual(current.baseConfigSha256, snapshot.baseConfigSha256);
  assert.throws(() => compileApplicationKnowledge(current.documents, current.policy), RangeError);
});

test('source revisions change, and canonical required reads reject missing chapters or excess content', async (t) => {
  const f = await fixture(t);
  const original = await readApplicationKnowledge(f.url);
  await writeFile(join(f.directory, 'guide.knowledge.md'), source('Revised terms'));
  const changed = await readApplicationKnowledge(f.url);
  assert.notEqual(changed.documents[0].revision, original.documents[0].revision);
  // Source edits change document revisions but leave the config fingerprint untouched.
  assert.equal(changed.baseConfigSha256, original.baseConfigSha256);
  compileApplicationKnowledge(changed.documents, changed.policy);
  assert.throws(
    () => compileApplicationKnowledge(changed.documents, { ...changed.policy, maxReadChars: 1 }),
    RangeError,
  );
  await writeFile(
    join(f.directory, 'guide.knowledge.md'),
    '<!-- agent-section:terms -->\nUnclosed',
  );
  // An unclosed section is a parse error, not a tolerated document.
  await assert.rejects(readApplicationKnowledge(f.url));
  await writeFile(join(f.directory, 'guide.knowledge.md'), 'Missing required chapter');
  const missing = await readApplicationKnowledge(f.url);
  assert.throws(() => compileApplicationKnowledge(missing.documents, missing.policy));
  await writeFile(join(f.directory, 'guide.knowledge.md'), source('x'.repeat(1024)));
  // The section wrapper pushes the file past maxDocumentBytes, so reading must fail.
  await assert.rejects(readApplicationKnowledge(f.url), RangeError);
});

test('candidate preparation preserves active files and refuses invalid replacement references', async (t) => {
  const f = await fixture(t);
  const config = await readFile(join(f.directory, 'knowledge.config.json'));
  const active = await readFile(join(f.directory, 'guide.knowledge.md'));
  const supplied = join(f.directory, 'revision.md');
  await writeFile(supplied, source('Candidate terms'));
  const { stdout } = await run(process.execPath, [
    tool,
    f.directory,
    '--source',
    supplied,
    '--id',
    'guide',
  ]);
  const result = JSON.parse(stdout);
  const proposal = JSON.parse(await readFile(join(result.candidate, 'proposal.json'), 'utf8'));
  assert.equal(proposal.baseConfigSha256, hash(config));
  assert.equal(
    proposal.baseDocuments[0].revision,
    (await readApplicationKnowledge(f.url)).documents[0].revision,
  );
  assert.equal(proposal.published, false);
  // Preparation writes a candidate directory only; active files stay byte-identical.
  assert.equal(result.activeFilesChanged, false);
  assert.deepEqual(await readFile(join(f.directory, 'knowledge.config.json')), config);
  assert.deepEqual(await readFile(join(f.directory, 'guide.knowledge.md')), active);
  const candidates = join(f.directory, '.local', 'knowledge-candidates');
  const before = await readdir(candidates);
  await writeFile(supplied, 'The referenced chapter was removed');
  await assert.rejects(
    run(process.execPath, [tool, f.directory, '--source', supplied, '--id', 'guide']),
  );
  // A rejected source must not leave a partial candidate behind.
  assert.deepEqual(await readdir(candidates), before);
});

test(
  'configuration changed while reading a supplied source cannot relabel the validated proposal',
  { skip: process.platform === 'win32', timeout: 10000 },
  async (t) => {
    const f = await fixture(t);
    const configPath = join(f.directory, 'knowledge.config.json');
    const original = await readFile(configPath);
    const fifo = join(f.directory, 'source.fifo');
    await run('mkfifo', [fifo]);
    const pending = run(process.execPath, [tool, f.directory, '--source', fifo, '--id', 'guide'], {
      timeout: 8000,
    });
    t.after(() => pending.child.kill());
    // A writer can open only after prepare-source has read its policy and opened this source.
    const writer = await open(fifo, 'w');
    try {
      await writeFile(configPath, JSON.stringify({ ...f.policy, maxReadChars: 1 }));
      await writer.writeFile(source('Candidate terms'));
    } finally {
      await writer.close();
    }
    const { candidate } = JSON.parse((await pending).stdout);
    const proposal = JSON.parse(await readFile(join(candidate, 'proposal.json'), 'utf8'));
    assert.equal(proposal.baseConfigSha256, hash(original));
    assert.notEqual(proposal.baseConfigSha256, hash(await readFile(configPath)));
    assert.equal(proposal.published, false);
  },
);

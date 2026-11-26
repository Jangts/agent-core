/*
 * Contract for the project scaffolder behind the `agent-core-app` skill
 * (`development/skills/agent-core-app/scripts/create-app.mjs`).
 *
 * The scaffolder writes into a user's directory, so the cases pin its safety
 * rules: planning never touches disk, `--write` only fills an empty real
 * directory and commits the whole project or nothing, `--check` compares against
 * the template receipt without reading symlink targets or invented paths, an
 * invalid source leaves no target behind, and concurrent runs produce exactly one
 * winner. User-supplied text is embedded verbatim rather than re-rendered.
 *
 * Runs on the real filesystem inside an OS temp directory created per test and
 * removed in `t.after`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdtemp,
  readFile,
  writeFile,
  mkdir,
  readdir,
  rm,
  symlink,
  lstat,
  cp,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createApplication } from '../development/skills/agent-core-app/scripts/create-app.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'agent-core-create-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('CLI can be invoked through a symlink', async (t) => {
  const root = await fixture(t);
  const cli = fileURLToPath(new URL('../development/skills/agent-core-app/scripts/create-app.mjs', import.meta.url));
  const link = join(root, 'create-app.mjs');
  const target = join(root, 'app');
  await symlink(cli, link);
  const result = execFileSync(process.execPath, [link, target, '--write'], { encoding: 'utf8' });
  assert.equal(JSON.parse(result).status, 'created');
});

test('planning is read-only and explicit creation preserves data-only purpose and an empty catalog', async (t) => {
  const root = await fixture(t),
    target = join(root, 'new-app');
  // A quote, a newline and a template placeholder: the purpose must be embedded
  // verbatim, so it has to be escaped and must not be re-substituted.
  const purpose = '只处理用户提供的资料。"\n__SDK_VERSION__';
  const plan = await createApplication([target, '--name', '@example/my-app', '--purpose', purpose]);
  assert.equal(plan.status, 'planned');
  // Planning reports what it would write and must leave the root untouched.
  assert.deepEqual(await readdir(root), []);
  const result = await createApplication([
    target,
    '--name',
    '@example/my-app',
    '--purpose',
    purpose,
    '--write',
  ]);
  assert.equal(result.status, 'created');
  assert.equal(result.modelCalled, false);
  assert.equal(result.installedDependencies, false);
  const manifest = JSON.parse(await readFile(join(target, 'package.json')));
  assert.equal(manifest.name, '@example/my-app');
  assert.deepEqual(Object.keys(manifest.dependencies), ['@jangts/agent-core']);
  const config = await readFile(join(target, 'src/config.ts'), 'utf8');
  assert.ok(config.includes(JSON.stringify(purpose)));
  assert.deepEqual(
    JSON.parse(await readFile(join(target, 'knowledge/knowledge.config.json'))).documents,
    [],
  );
  const check = await createApplication([target, '--check']);
  assert.ok(
    check.files.every((file) => file.state === 'unchanged' && file.templateChanged === false),
  );
  assert.deepEqual(await readdir(root), ['new-app']);
});
test('existing files, symlink targets and invalid names are rejected without partial writes', async (t) => {
  const root = await fixture(t),
    target = join(root, 'existing');
  await mkdir(target);
  await writeFile(join(target, 'keep.txt'), 'user work');
  await assert.rejects(createApplication([target, '--write']), /empty real directory/);
  assert.equal(await readFile(join(target, 'keep.txt'), 'utf8'), 'user work');
  assert.deepEqual(await readdir(target), ['keep.txt']);
  const link = join(root, 'link');
  await symlink(target, link, 'dir');
  await assert.rejects(createApplication([link, '--write']), /empty real directory/);
  await assert.rejects(createApplication([link, '--check']), /real directory/);
  await assert.rejects(
    createApplication([join(root, 'new'), '--name', '../escape', '--write']),
    /package name/,
  );
  assert.deepEqual((await readdir(root)).sort(), ['existing', 'link']);
});
test('concurrent initialization commits one whole project and cannot replace the winner', async (t) => {
  const root = await fixture(t),
    target = join(root, 'app');
  const results = await Promise.allSettled(
    ['first-app', 'second-app'].map((name) =>
      createApplication([target, '--name', name, '--write']),
    ),
  );
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  // Whichever run wins owns the whole tree; the loser must not leave a mixed project.
  const winner = results.find((result) => result.status === 'fulfilled').value;
  assert.equal(JSON.parse(await readFile(join(target, 'package.json'))).name, winner.inputs.name);
  assert.ok(
    (await createApplication([target, '--check'])).files.every(
      (file) => file.state === 'unchanged',
    ),
  );
});
test('real source is prepared with the shared compiler as an unpublished candidate from exact original bytes', async (t) => {
  const root = await fixture(t),
    target = join(root, 'sources'),
    source = join(root, 'provided.md');
  const bytes = Buffer.from(
    '<!-- agent-section:intro -->\n实际提供的来源文本。\n<!-- /agent-section:intro -->\n',
  );
  await writeFile(source, bytes);
  const result = await createApplication([target, '--source', source, '--id', 'guide', '--write']);
  assert.equal(result.published, false);
  assert.ok((await lstat(result.candidate)).isDirectory());
  assert.deepEqual(await readFile(join(result.candidate, 'source.knowledge.md')), bytes);
  const proposal = JSON.parse(await readFile(join(result.candidate, 'proposal.json')));
  assert.equal(proposal.contentSha256, result.source.sha256);
  assert.equal(proposal.originalName, 'provided.md');
  assert.equal(proposal.published, false);
  assert.deepEqual(
    JSON.parse(await readFile(join(target, 'knowledge/knowledge.config.json'))).documents,
    [],
  );
  assert.deepEqual(await readFile(source), bytes);
});
test('invalid source leaves no target and empty targets can be initialized atomically', async (t) => {
  const root = await fixture(t),
    source = join(root, 'invalid.md'),
    target = join(root, 'empty');
  await writeFile(source, '<!-- agent-section:intro -->\nUnclosed');
  await assert.rejects(
    createApplication([target, '--source', source, '--id', 'guide', '--write']),
    /Unclosed/,
  );
  assert.deepEqual(await readdir(root), ['invalid.md']);
  await mkdir(target);
  await createApplication([target, '--write']);
  assert.ok((await readdir(target)).includes('src'));
});
test('comparison detects customizations and refuses to read symlink destinations or arbitrary receipt paths', async (t) => {
  const root = await fixture(t),
    target = join(root, 'app');
  await createApplication([target, '--write']);
  await writeFile(join(target, 'src/config.ts'), 'user configuration');
  await rm(join(target, 'src/app.ts'));
  await symlink(join(root, 'private-unavailable'), join(target, 'src/app.ts'));
  const receiptPath = join(target, 'agent-core.template.json'),
    receipt = JSON.parse(await readFile(receiptPath));
  // A path injected into the receipt must be reported as unknown, never read; the
  // same rule keeps `.env` and other secrets out of the comparison.
  receipt.files.push({ path: '.env', sha256: '0'.repeat(64) });
  await writeFile(receiptPath, JSON.stringify(receipt));
  const result = await createApplication([target, '--check']);
  assert.equal(result.files.find((file) => file.path === 'src/config.ts').state, 'modified');
  assert.equal(result.files.find((file) => file.path === 'src/app.ts').state, 'symlink');
  assert.equal(result.files.find((file) => file.path === '.env').state, 'not-in-current-template');
  assert.deepEqual(result.changedFiles, []);
  assert.equal(await readFile(join(target, 'src/config.ts'), 'utf8'), 'user configuration');
});
test('copied resource resolver cannot treat a generated project ancestor as a bundled SDK', async (t) => {
  const root = await fixture(t),
    copied = join(root, 'copied', 'scripts');
  await mkdir(copied, { recursive: true });
  const resources = fileURLToPath(
    new URL('../development/skills/agent-core-app/scripts/resources.mjs', import.meta.url),
  );
  await cp(resources, join(copied, 'sdk-resources.mjs'));
  const { resolveSdkResources } = await import(pathToFileURL(join(copied, 'sdk-resources.mjs')));
  await assert.rejects(resolveSdkResources(join(root, 'missing')), /Cannot resolve/);
});

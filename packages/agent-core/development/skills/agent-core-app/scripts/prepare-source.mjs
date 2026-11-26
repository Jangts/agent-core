/*
 * Prepare a knowledge candidate from a supplied source file.
 *
 * The script belongs to the App's development skills (开发技能). It never touches the
 * active knowledge files: it validates the new document against the current catalog
 * and writes a self-contained candidate directory that a later publication step can
 * approve. The candidate records the base configuration hash and the revisions of the
 * documents it was prepared against, so the publication can detect a stale base.
 *
 * Main exports: none. The file runs as a command and prints one JSON receipt.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { readSuppliedSource } from './lib/source.mjs';
import { readApplicationKnowledge, compileApplicationKnowledge } from './lib/knowledge.mjs';

const args = process.argv.slice(2);
if (args.length !== 5 || args[1] !== '--source' || args[3] !== '--id')
  throw new Error('Usage: node prepare-source.mjs PROJECT --source UTF8_FILE --id DOCUMENT_ID');
const project = resolve(args[0]),
  // A trailing separator makes the directory a base URL, so relative entries
  // resolve inside the project instead of against the file system root.
  directory = pathToFileURL(project + sep);
const { documents, policy, baseConfigSha256 } = await readApplicationKnowledge(directory);
// A document with the same id is replaced rather than added.
const previous = documents.find((item) => item.id === args[4]);
const source = await readSuppliedSource(
  resolve(args[2]),
  args[4],
  policy.maxDocumentBytes,
  // The locale of the replaced document is carried over, so the revision stays
  // comparable across the replacement.
  previous?.locale,
);
// The candidate must fit the catalog together with the other documents, so the
// whole set is compiled before anything is written.
compileApplicationKnowledge(
  [...documents.filter((item) => item.id !== args[4]), source.document],
  policy,
);
const target = join(
  project,
  '.local',
  'knowledge-candidates',
  // The random suffix keeps two candidates for the same document apart.
  args[4].replace(/[^a-z0-9_.-]/g, '_') + '-' + randomUUID(),
);
await mkdir(target, { recursive: true });
// `wx` fails instead of overwriting an existing file.
await writeFile(join(target, 'source.knowledge.md'), source.bytes, { flag: 'wx' });
await writeFile(
  join(target, 'proposal.json'),
  JSON.stringify(
    {
      schemaVersion: 1,
      status: 'candidate',
      document: args[4],
      action: previous ? 'replace' : 'add',
      originalName: source.name,
      locale: source.document.locale,
      contentSha256: source.digest,
      revision: source.document.revision,
      baseConfigSha256,
      baseDocuments: documents.map((item) => ({ id: item.id, revision: item.revision })),
      published: false,
    },
    null,
    2,
  ) + '\n',
  { flag: 'wx' },
);
// The receipt states that nothing was published and no active file was changed.
console.log(JSON.stringify({ candidate: target, published: false, activeFilesChanged: false }));

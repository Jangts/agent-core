/**
 * Read-only planning entry for the `agent-core-app` Skill.
 *
 * Reports whether a project exists, which SDK it resolves, the state of its knowledge catalog and
 * the SDK tools/docs that may be used next. It never evaluates project code, calls a model or
 * writes files; the printed JSON is guidance for the agent, not a permission grant.
 *
 * Usage: `node plan.mjs PROJECT [--source UTF8_FILE]`.
 */
import { stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveSdkResources } from './resources.mjs';

// Agent-oriented, read-only planning. Never evaluates project code or calls a model.
const args = process.argv.slice(2);
if (![1, 3].includes(args.length) || (args.length === 3 && args[1] !== '--source'))
  throw new Error('Usage: node plan.mjs PROJECT [--source UTF8_FILE]');
const project = resolve(args[0]);
let exists = true;
try {
  if (!(await stat(project)).isDirectory()) throw new TypeError('PROJECT must be a directory');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  exists = false;
}
const { sdk, tools, docs, knowledgeLoader } = await resolveSdkResources(project);
let documents = [];
let knowledgeConfigured = false;
let knowledgeStatus = 'unconfigured';
let baseConfigSha256;
if (exists) {
  try {
    await stat(resolve(project, 'knowledge.config.json'));
    knowledgeConfigured = true;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (knowledgeConfigured) {
    const { readApplicationKnowledge, compileApplicationKnowledge } = await import(
      pathToFileURL(knowledgeLoader)
    );
    const snapshot = await readApplicationKnowledge(pathToFileURL(project + sep));
    const catalog = compileApplicationKnowledge(snapshot.documents, snapshot.policy);
    documents = snapshot.policy.documents.map((item) => ({ id: item.id, file: item.file }));
    knowledgeStatus = catalog.ids().length ? 'valid' : 'empty-awaiting-source';
    baseConfigSha256 = snapshot.baseConfigSha256;
  }
}
console.log(
  JSON.stringify(
    {
      project,
      mode: exists ? 'integrate-or-maintain' : 'create-application',
      sdk,
      knowledgeConfigured,
      knowledgeStatus,
      baseConfigSha256,
      suppliedSource: args[2] ? resolve(args[2]) : null,
      factsPolicy: 'Use only supplied source; with ideas only, keep knowledge files empty.',
      documents,
      tools,
      docs,
      changedFiles: [],
      published: false,
    },
    null,
    2,
  ),
);

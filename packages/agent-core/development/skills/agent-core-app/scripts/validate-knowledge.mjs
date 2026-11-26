/*
 * Validate the active knowledge catalog of one project.
 *
 * The script belongs to the App's development skills (开发技能). It loads the App-owned
 * configuration and document files, compiles them into a Knowledge catalog and reports
 * the resulting document ids. An empty catalog is reported as a distinct status, so a
 * project that has not received its first source is not confused with a broken one.
 *
 * Main exports: none. The file runs as a command and prints one JSON receipt.
 */
import { pathToFileURL } from 'node:url';
import { resolve, sep } from 'node:path';
import { loadApplicationKnowledge } from './lib/knowledge.mjs';

if (process.argv.length !== 3) throw new Error('Usage: node validate-knowledge.mjs PROJECT');
// A trailing separator turns the project path into a base URL, so the document
// entries resolve inside the project directory.
const directory = pathToFileURL(resolve(process.argv[2]) + sep);
const catalog = await loadApplicationKnowledge(directory);
console.log(
  JSON.stringify({
    status: catalog.ids().length ? 'valid' : 'empty-awaiting-source',
    documents: catalog.ids(),
  }),
);

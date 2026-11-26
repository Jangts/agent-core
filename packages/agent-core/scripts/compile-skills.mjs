/**
 * Embed the distributable SKILL.md documents in a typed module for both package builds.
 * Applications can select an instruction body without filesystem access at request time.
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';

const source = new URL('../skills/', import.meta.url);
const output = new URL('../src/skills/catalog.generated.ts', import.meta.url);
const header = /^---\nname: ([a-z][a-z0-9-]*)\ndescription: ([^\n]+)\n---\n([\s\S]*)$/;

/** Read one document and check that its public identity agrees with its directory. */
async function readSkill(id) {
  const text = await readFile(new URL(`${id}/SKILL.md`, source), 'utf8');
  const match = header.exec(text.replaceAll('\r\n', '\n'));
  if (!match || match[1] !== id || !match[2].trim() || !match[3].trim())
    throw new Error(`Invalid task skill: ${id}/SKILL.md`);
  return { description: match[2].trim(), instructions: match[3].trim() };
}

const entries = await readdir(source, { withFileTypes: true });
const ids = entries
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const lines = [
  '// Generated from the package SKILL.md documents by scripts/compile-skills.mjs.',
  'export const taskSkillDocuments = {',
];
for (const id of ids) {
  const skill = await readSkill(id);
  lines.push(
    `  '${id}': Object.freeze({`,
    `    description: ${JSON.stringify(skill.description)},`,
    `    instructions: ${JSON.stringify(skill.instructions)},`,
    '  }),',
  );
}
lines.push('};', '');
await writeFile(output, lines.join('\n'));

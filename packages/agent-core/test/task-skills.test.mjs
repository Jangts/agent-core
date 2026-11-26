import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { taskSkills } from '@jangts/agent-core/skills';

test('both public entries expose the methods and bodies from the distributable documents', async () => {
  const commonjs = createRequire(import.meta.url)('@jangts/agent-core/skills').taskSkills;
  assert.deepEqual(commonjs, taskSkills);
  const directory = new URL('../skills/', import.meta.url);
  const entries = await readdir(directory, { withFileTypes: true });
  const ids = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  assert.deepEqual(Object.keys(taskSkills).sort(), ids);
  for (const id of ids) {
    const document = (await readFile(new URL(`${id}/SKILL.md`, directory), 'utf8')).replaceAll('\r\n', '\n');
    const { description, instructions } = taskSkills[id];
    const header = `---\nname: ${id}\ndescription: ${description}\n---\n`;
    assert.ok(document.startsWith(header));
    assert.equal(document.slice(header.length).trim(), instructions);
  }
});

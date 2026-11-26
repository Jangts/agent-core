import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';

/*
 * Locks down the published offline examples under `development/examples/`.
 *
 * Every example script shipped for readers must stay runnable with no network
 * access and no credentials, so each file is executed as a child process and
 * must finish cleanly. `mock-provider.mjs` is excluded because it is a shared
 * helper module, not a standalone example.
 *
 * Runs on the built `dist/` output via plain `node`; no mock transport needed.
 */
const execute = promisify(execFile);
const directory = new URL('../development/examples/', import.meta.url);
const examples = (await readdir(directory)).filter(
  (name) => name.endsWith('.mjs') && name !== 'mock-provider.mjs',
);
for (const name of examples)
  test(`published offline example runs: ${name}`, async () => {
    const { stderr } = await execute(process.execPath, [fileURLToPath(new URL(name, directory))], {
      timeout: 10000,
      maxBuffer: 1024 * 1024,
    });
    assert.equal(stderr, '');
  });

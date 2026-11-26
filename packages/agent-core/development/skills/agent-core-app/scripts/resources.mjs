/**
 * Locate the SDK installation and the Skill assets it ships.
 *
 * The Skill never downloads or copies files: it resolves the `@jangts/agent-core` installation the
 * target project already depends on, or — only when this Skill runs from inside the distributed
 * SDK — the bundled sibling assets. Every returned path is verified to be a regular file so a
 * broken or foreign package cannot silently supply a different asset.
 *
 * Exports: `resolveSdkResources`.
 */
import { createRequire } from 'node:module';
import { readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const packageName = '@jangts/agent-core';
const assets = {
  tools: {
    'create-app': 'skills/agent-core-app/scripts/create-app.mjs',
    'validate-knowledge': 'skills/agent-core-app/scripts/validate-knowledge.mjs',
    'prepare-source': 'skills/agent-core-app/scripts/prepare-source.mjs',
  },
  docs: {
    guide: 'docs/README.md',
    api: 'docs/api/README.md',
    maintenance: 'docs/maintenance.md',
    flow: 'docs/flows/knowledge-maintenance.md',
    gettingStarted: 'docs/getting-started.md',
    knowledge: 'docs/knowledge.md',
    createApp: 'docs/create-app.md',
    materials: 'docs/materials.md',
    memory: 'docs/memory-and-learning.md',
    answering: 'docs/api/knowledge-answering.md',
    acceptance: 'docs/acceptance.md',
  },
};

async function packageAt(directory) {
  try {
    const manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
    return manifest.name === packageName ? manifest : undefined;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function installedPackage(project) {
  // Node resolves the public entry without loading it or evaluating App code.
  const require = createRequire(pathToFileURL(join(project, '__agent_core_resolution__.cjs')));
  let entry;
  try {
    entry = require.resolve(packageName);
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
    // A broken installed entry must not silently select a different SDK version.
    for (const directory of require.resolve.paths(packageName) ?? []) {
      try {
        await stat(join(directory, packageName));
      } catch (missing) {
        if (missing.code === 'ENOENT') continue;
        throw missing;
      }
      throw error;
    }
    return;
  }
  for (let directory = dirname(entry); ; directory = dirname(directory)) {
    const manifest = await packageAt(directory);
    if (manifest)
      return { root: directory, version: manifest.version, source: 'project-dependency' };
    if (dirname(directory) === directory)
      throw new Error(`Cannot locate ${packageName} manifest for resolved entry ${entry}`);
  }
}

async function requiredFile(root, relative) {
  const filename = join(root, 'development', relative);
  if (!(await stat(filename)).isFile()) throw new Error(`SDK resource is not a file: ${filename}`);
  return filename;
}

/**
 * Resolve the SDK root and every Skill resource path for one project.
 *
 * @param project Project directory used to resolve the installed SDK.
 * @returns `sdk` (`root`, `version`, `source`), the `tools`/`docs` file paths and `knowledgeLoader`.
 * @throws {Error} When the SDK cannot be resolved, or a declared resource is missing or not a file.
 */
export async function resolveSdkResources(project) {
  let sdk = await installedPackage(resolve(project));
  if (!sdk) {
    // Only the Skill distributed inside the SDK can use sibling assets.
    const root = fileURLToPath(new URL('../../../../', import.meta.url));
    const bundled =
      resolve(fileURLToPath(import.meta.url)) ===
      resolve(root, 'development/skills/agent-core-app/scripts/resources.mjs');
    const manifest = bundled ? await packageAt(root) : undefined;
    if (!manifest)
      throw new Error(
        `Cannot resolve ${packageName} from ${project}. Install the SDK and its real dependencies in the existing App, or use the Skill inside the distributed SDK.`,
      );
    sdk = { root, version: manifest.version, source: 'bundled-sdk' };
  }
  const resources = {};
  for (const [group, entries] of Object.entries(assets)) {
    resources[group] = Object.fromEntries(
      await Promise.all(
        Object.entries(entries).map(async ([name, relative]) => [
          name,
          await requiredFile(sdk.root, relative),
        ]),
      ),
    );
  }
  const knowledgeLoader = await requiredFile(
    sdk.root,
    'skills/agent-core-app/scripts/lib/knowledge.mjs',
  );
  return { sdk, ...resources, knowledgeLoader };
}

/**
 * Scaffold or compare an App that uses `@jangts/agent-core`.
 *
 * Resolves the SDK the target project depends on, renders the selected template into a staging
 * directory and only then renames it into place, so a failed or concurrent run never leaves a
 * half-written app. `--check` compares the managed files against the recorded receipt instead of
 * writing. Nothing here installs dependencies, calls a model or publishes content.
 *
 * Usage: see `usage` below; run directly or import `createApplication`.
 */
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  rmdir,
  writeFile,
} from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveSdkResources } from './resources.mjs';

const execute = promisify(execFile),
  receiptName = 'agent-core.template.json';
const usage =
  'node create-app.mjs TARGET [--name PACKAGE_NAME] [--purpose TEXT] [--template node-ts] [--sdk-from PROJECT] [--source UTF8_FILE --id DOCUMENT_ID] [--write | --check]';
const hash = (value) => createHash('sha256').update(value).digest('hex');
const pathInside = (value) =>
  typeof value === 'string' &&
  !!value &&
  !isAbsolute(value) &&
  !value.includes('\\') &&
  value.split('/').every((part) => !!part && !['.', '..'].includes(part));
async function exists(path) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
function inputs(name, purpose) {
  if (
    typeof name !== 'string' ||
    name.length > 214 ||
    !/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(name)
  )
    throw new TypeError('Use a lowercase npm package name');
  if (typeof purpose !== 'string' || purpose.length > 800 || !purpose.trim())
    throw new TypeError('Use a purpose of 1–800 characters');
  return { name, purpose: purpose.trim() };
}
function parse(args, cwd) {
  if (!args.length || args[0].startsWith('--')) throw new TypeError(usage);
  const values = {},
    switches = new Set(['--write', '--check']),
    options = new Set(['--name', '--purpose', '--template', '--sdk-from', '--source', '--id']);
  for (let index = 1; index < args.length; index++) {
    const key = args[index];
    if (Object.hasOwn(values, key)) throw new TypeError(`Duplicate option: ${key}`);
    if (switches.has(key)) values[key] = true;
    else if (options.has(key) && args[index + 1] !== undefined && !args[index + 1].startsWith('--'))
      values[key] = args[++index];
    else throw new TypeError(usage);
  }
  if (
    (values['--write'] && values['--check']) ||
    !!values['--source'] !== !!values['--id'] ||
    (values['--check'] &&
      ['--name', '--purpose', '--source', '--id'].some((key) => Object.hasOwn(values, key)))
  )
    throw new TypeError(usage);
  return { target: resolve(cwd, args[0]), values };
}
async function emptyTarget(target) {
  const item = await exists(target);
  if (item && (!item.isDirectory() || item.isSymbolicLink() || (await readdir(target)).length))
    throw new Error(
      'TARGET must be absent or an empty real directory; existing files are preserved',
    );
}
async function templateResources(resources, id) {
  const root = join(resources.sdk.root, 'development/skills/agent-core-app');
  const catalog = JSON.parse(await readFile(join(root, 'templates/catalog.json'), 'utf8'));
  if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.templates))
    throw new Error('Unsupported template catalog');
  const template = catalog.templates.find((item) => item.id === id);
  if (
    !template ||
    typeof template.revision !== 'string' ||
    !pathInside(template.directory) ||
    !Array.isArray(template.files) ||
    template.files.some(
      (file) =>
        !pathInside(file.source) ||
        !pathInside(file.target) ||
        !['template', 'skill'].includes(file.origin),
    ) ||
    new Set(template.files.map((file) => file.target)).size !== template.files.length ||
    template.files.some((file) => file.target === receiptName)
  )
    throw new Error('Invalid or unknown template');
  return { root, template };
}
async function render(resources, definition, input) {
  const manifest = JSON.parse(await readFile(join(resources.sdk.root, 'package.json'), 'utf8'));
  if (
    manifest.name !== '@jangts/agent-core' ||
    manifest.version !== resources.sdk.version ||
    typeof manifest.devDependencies?.typescript !== 'string'
  )
    throw new Error('SDK manifest does not describe the selected template dependencies');
  const configuration = {
    name: input.name,
    purpose: input.purpose,
    maxCalls: 4,
    maxRounds: 8,
    callTimeoutMs: 30000,
    maxInputChars: 48000,
    maxOutputChars: 8000,
  };
  const substitutions = {
    __APP_CONFIG__: JSON.stringify(configuration, null, 2),
    __PACKAGE_NAME__: JSON.stringify(input.name),
    __SDK_VERSION__: JSON.stringify(manifest.version),
    __TYPESCRIPT_VERSION__: JSON.stringify(manifest.devDependencies.typescript),
  };
  return Promise.all(
    definition.template.files.map(async (file) => {
      const source =
        file.origin === 'skill'
          ? join(definition.root, file.source)
          : join(definition.root, 'templates', definition.template.directory, file.source);
      const info = await lstat(source);
      if (!info.isFile() || info.isSymbolicLink())
        throw new Error('Template assets must be regular files');
      let content = new TextDecoder('utf-8', { fatal: true }).decode(await readFile(source));
      // One pass: user-provided purpose text cannot become another substitution instruction.
      if (file.origin === 'template')
        content = content.replace(
          /__APP_CONFIG__|__PACKAGE_NAME__|__SDK_VERSION__|__TYPESCRIPT_VERSION__/g,
          (token) => substitutions[token],
        );
      const bytes = Buffer.from(content);
      return { path: file.target, bytes, sha256: hash(bytes) };
    }),
  );
}
async function compare(target, resources, definition) {
  const directory = await lstat(target);
  if (!directory.isDirectory() || directory.isSymbolicLink())
    throw new Error('TARGET must be a real directory');
  const receiptPath = join(target, receiptName),
    info = await lstat(receiptPath);
  if (!info.isFile() || info.isSymbolicLink())
    throw new Error('Template receipt must be a regular file');
  const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
  if (
    receipt.schemaVersion !== 1 ||
    receipt.template?.id !== definition.template.id ||
    !Array.isArray(receipt.files) ||
    receipt.files.some((file) => !pathInside(file.path) || !/^[a-f0-9]{64}$/.test(file.sha256)) ||
    new Set(receipt.files.map((file) => file.path)).size !== receipt.files.length
  )
    throw new Error('Invalid template receipt');
  const files = await render(
    resources,
    definition,
    inputs(receipt.inputs?.name, receipt.inputs?.purpose),
  );
  const baseline = new Map(receipt.files.map((file) => [file.path, file.sha256])),
    currentTemplate = new Map(files.map((file) => [file.path, file.sha256]));
  const changes = [];
  for (const path of [...new Set([...baseline.keys(), ...currentTemplate.keys()])].sort()) {
    if (!currentTemplate.has(path)) {
      changes.push({
        path,
        state: 'not-in-current-template',
        baselineSha256: baseline.get(path),
        templateChanged: true,
      });
      continue;
    }
    // Reject symlinks at every managed path component, without reading their destinations.
    let blocked = false;
    for (let index = 1; index <= path.split('/').length; index++) {
      const part = await exists(join(target, ...path.split('/').slice(0, index)));
      if (part?.isSymbolicLink()) {
        blocked = true;
        break;
      }
    }
    const item = blocked ? undefined : await exists(join(target, path));
    const actual = item?.isFile() ? hash(await readFile(join(target, path))) : undefined;
    changes.push({
      path,
      state: blocked
        ? 'symlink'
        : actual === undefined
          ? 'missing'
          : actual === baseline.get(path)
            ? 'unchanged'
            : 'modified',
      baselineSha256: baseline.get(path),
      currentSha256: actual,
      templateSha256: currentTemplate.get(path),
      templateChanged: currentTemplate.get(path) !== baseline.get(path),
    });
  }
  return {
    status: 'checked',
    target,
    installed: { template: receipt.template, sdk: receipt.sdk },
    available: {
      template: { id: definition.template.id, revision: definition.template.revision },
      sdk: { name: manifestName, version: resources.sdk.version },
    },
    files: changes,
    changedFiles: [],
  };
}
const manifestName = '@jangts/agent-core';
/**
 * Create or check a generated application directory.
 *
 * @param args CLI arguments: `TARGET` plus optional flags described by `usage`.
 * @param cwd Directory relative paths are resolved against; defaults to the process cwd.
 * @returns A plan (`--write` omitted), a comparison (`--check`) or the creation result.
 * @throws {TypeError} When arguments, names, the target or the source file are invalid.
 * @throws {Error} When the template, receipt or SDK manifest is unsupported or inconsistent.
 */
export async function createApplication(args, cwd = process.cwd()) {
  const { target, values } = parse(args, cwd);
  if (basename(target) === '.local')
    throw new TypeError(
      'Choose an application directory outside the temporary .local directory itself',
    );
  const resources = await resolveSdkResources(resolve(cwd, values['--sdk-from'] ?? '.'));
  const definition = await templateResources(resources, values['--template'] ?? 'node-ts');
  if (values['--check']) return compare(target, resources, definition);
  await emptyTarget(target);
  const defaultName =
    basename(target)
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^[._-]+|[._-]+$/g, '') || 'agent-app';
  const input = inputs(
    values['--name'] ?? defaultName,
    values['--purpose'] ?? '依据当前问题和获准读取的资料提供帮助。',
  );
  const files = await render(resources, definition, input);
  let source;
  if (values['--source']) {
    const path = resolve(cwd, values['--source']);
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 32000)
      throw new TypeError('Source must be a regular UTF-8 file within 32000 bytes');
    const library = await import(
      pathToFileURL(join(dirname(resources.knowledgeLoader), 'source.mjs'))
    );
    source = await library.readSuppliedSource(path, values['--id'], 32000);
    const knowledge = await import(pathToFileURL(resources.knowledgeLoader));
    const policy = JSON.parse(
      files.find((file) => file.path === 'knowledge/knowledge.config.json').bytes.toString('utf8'),
    );
    knowledge.compileApplicationKnowledge([source.document], policy);
  }
  const receipt = {
    schemaVersion: 1,
    template: { id: definition.template.id, revision: definition.template.revision },
    sdk: { name: manifestName, version: resources.sdk.version },
    inputs: input,
    files: files.map(({ path, sha256 }) => ({ path, sha256 })),
  };
  const plan = {
    status: 'planned',
    target,
    ...receipt,
    files: [...receipt.files, { path: receiptName }],
    source: source
      ? {
          documentId: values['--id'],
          originalName: source.name,
          sha256: source.digest,
          status: 'candidate-only',
        }
      : null,
    changedFiles: [],
    installedDependencies: false,
    modelCalled: false,
    published: false,
  };
  if (!values['--write']) return plan;
  const parent = dirname(target),
    temporary = join(parent, '.local');
  await mkdir(parent, { recursive: true });
  let madeTemporary = false,
    staging;
  try {
    try {
      await mkdir(temporary);
      madeTemporary = true;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    const info = await lstat(temporary);
    if (!info.isDirectory() || info.isSymbolicLink())
      throw new Error('Temporary directory must be a real directory');
    staging = await mkdtemp(join(temporary, 'agent-core-create-'));
    for (const file of files) {
      await mkdir(dirname(join(staging, file.path)), { recursive: true });
      await writeFile(join(staging, file.path), file.bytes, { flag: 'wx' });
    }
    let candidate;
    if (source) {
      const snapshot = join(staging, '.local/initial-source', source.name);
      await mkdir(dirname(snapshot), { recursive: true });
      await writeFile(snapshot, source.bytes, { flag: 'wx' });
      const output = await execute(process.execPath, [
        resources.tools['prepare-source'],
        join(staging, 'knowledge'),
        '--source',
        snapshot,
        '--id',
        values['--id'],
      ]);
      candidate = relative(staging, JSON.parse(output.stdout).candidate);
      if (!pathInside(candidate.split(sep).join('/')))
        throw new Error('Candidate escaped the generated project');
      await rm(join(staging, '.local/initial-source'), { recursive: true });
      await rmdir(join(staging, '.local'));
    }
    await writeFile(
      join(staging, receiptName),
      JSON.stringify({ ...receipt, createdAtMs: Date.now() }, null, 2) + '\n',
      { flag: 'wx' },
    );
    // Recheck before the atomic directory rename; a concurrent writer's non-empty target is preserved.
    await emptyTarget(target);
    await rename(staging, target);
    staging = undefined;
    return {
      ...plan,
      status: 'created',
      changedFiles: [...files.map((file) => file.path), receiptName],
      ...(candidate ? { candidate: join(target, candidate) } : {}),
    };
  } finally {
    if (staging) await rm(staging, { recursive: true });
    if (madeTemporary) await rmdir(temporary).catch(() => {});
  }
}
// Node resolves symlinks for the module URL, while argv preserves the invoked path.
const modulePath = fileURLToPath(import.meta.url);
const entry = process.argv[1] && resolve(process.argv[1]);
if (entry && (entry === modulePath || (await realpath(entry).catch(() => undefined)) === modulePath)) {
  try {
    console.log(JSON.stringify(await createApplication(process.argv.slice(2)), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

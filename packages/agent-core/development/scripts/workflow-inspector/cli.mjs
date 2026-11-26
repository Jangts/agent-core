/**
 * CLI for exporting, checking and viewing App workflow definitions.
 * Watch samples explicit files, reloads trusted definitions in a fresh process and publishes valid reports.
 */
import { fork } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, relative, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { render } from './report.mjs';
import { describeEvidence } from './evidence.mjs';
import { project, validate } from './snapshot.mjs';

const loader = fileURLToPath(new URL('./load-entry.mjs', import.meta.url));
const inputChoice = ['entry', 'input'];
const chainChoice = ['trace', 'chain', 'run-id'];
const commands = {
  export: { accepts: [...inputChoice, ...chainChoice, 'source'], input: inputChoice },
  check: { accepts: ['input', ...chainChoice], input: ['input'] },
  inspect: {
    accepts: [...inputChoice, ...chainChoice, 'source', 'output'],
    input: inputChoice,
    output: true,
  },
  watch: {
    accepts: ['entry', ...chainChoice, 'source', 'output', 'serve'],
    input: ['entry'],
    output: true,
  },
};
const options = Object.fromEntries(
  ['entry', 'input', 'trace', 'chain', 'run-id', 'source', 'output', 'serve'].map((name) => [
    name,
    { type: 'string', multiple: name === 'source' },
  ]),
);
options.help = { type: 'boolean', short: 'h' };

function usage() {
  console.log(`Jangts Agent Core workflow inspector

  export  --entry <module>                 Write a checked JSON snapshot to stdout
  check   --input <snapshot.json>          Validate graph, tool and run references
  inspect --entry <module> --output <report.html>
  inspect --input <snapshot.json> --output <report.html>
  watch   --entry <module> --output <report.html> [--source <file> ...] [--serve <port>]

--source also records definitions used by export and inspect. Monitor dependent source files explicitly.
--trace <run.json> --run-id <id> attaches one authorized WorkflowRunTrace.
The legacy --chain option remains accepted. An input snapshot containing chain also requires --run-id.
Use a trusted declaration-only JavaScript module exporting workflow or inspection.`);
}

function inputs() {
  const { positionals, values } = parseArgs({ options, allowPositionals: true });
  if (values.help || positionals.length === 0) return undefined;
  const [command] = positionals;
  if (positionals.length !== 1 || !Object.hasOwn(commands, command))
    throw new TypeError('Choose export, check, inspect or watch');
  const mode = commands[command];
  for (const name of Object.keys(values)) {
    if (!mode.accepts.includes(name))
      throw new TypeError(`--${name} is unavailable with ${command}`);
  }
  if (mode.input.filter((name) => values[name]).length !== 1)
    throw new TypeError(`Provide exactly one of ${mode.input.map((key) => '--' + key).join(', ')}`);
  if (mode.output && !values.output?.endsWith('.html'))
    throw new TypeError('--output must be an HTML file');
  if (values.source && !values.entry) throw new TypeError('--source requires --entry');
  if (values.entry && !/\.(?:mjs|cjs|js)$/.test(values.entry))
    throw new TypeError('--entry must be a JavaScript module');
  if (values.trace !== undefined && values.chain !== undefined && values.trace !== values.chain)
    throw new TypeError('Conflicting --trace and legacy --chain inputs');
  values.chain = values.trace ?? values.chain;
  delete values.trace;
  if (values.chain && !values['run-id']) throw new TypeError('--trace requires --run-id');
  const port = values.serve === undefined ? undefined : Number(values.serve);
  if (port !== undefined && (!Number.isInteger(port) || port < 1 || port > 65535))
    throw new TypeError('--serve must be a TCP port between 1 and 65535');

  const sources = [
    ...new Set(
      [values.entry, ...(values.source ?? [])].filter(Boolean).map((file) => resolve(file)),
    ),
  ].sort();
  const files = [
    ...new Set(
      [
        ...sources,
        values.chain && resolve(values.chain),
        values.input && resolve(values.input),
      ].filter(Boolean),
    ),
  ];
  if (values.output && files.includes(resolve(values.output)))
    throw new TypeError('The output must be separate from input files');
  return { command, ...values, sources, files, port };
}

/** Fingerprint only the explicitly selected files and their relative paths. */
async function fingerprint(files) {
  const hash = createHash('sha256');
  for (const file of files) {
    if (!(await stat(file)).isFile())
      throw new TypeError(`Expected a source file: ${relative(process.cwd(), file)}`);
    const bytes = await readFile(file);
    hash.update(JSON.stringify([relative(process.cwd(), file), bytes.length]));
    hash.update(bytes);
  }
  return hash.digest('hex');
}

function loadEntry(entry) {
  return new Promise((resolveResult, reject) => {
    const child = fork(loader, [resolve(entry)], {
      execArgv: [],
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    });
    let timer = setTimeout(
      () => finish(new Error('Inspection entry did not finish exporting')),
      20_000,
    );
    function finish(error, snapshot) {
      if (!timer) return;
      clearTimeout(timer);
      timer = undefined;
      child.kill();
      if (error) reject(error);
      else resolveResult(snapshot);
    }
    child.once('error', (error) => finish(error));
    child.once('exit', () => finish(new Error('Inspection entry exited without a snapshot')));
    child.once('message', ({ error, snapshot }) => finish(error && new Error(error), snapshot));
  });
}

async function readJson(file) {
  if (!(await stat(file)).isFile()) throw new TypeError(`Expected a JSON file: ${file}`);
  return JSON.parse(await readFile(file, 'utf8'));
}

async function buildReport(request, startingHash) {
  let snapshot = request.entry
    ? project(await loadEntry(request.entry))
    : project(await readJson(request.input));
  if (request.chain) {
    if (snapshot.chain) throw new TypeError('Choose either an embedded chain or --chain');
    snapshot = project({ ...snapshot, chain: await readJson(request.chain) });
  }
  const warnings = validate(snapshot, request['run-id']);
  if (request.entry) {
    snapshot.generatedAt = new Date().toISOString();
    snapshot.sources = request.sources.map((file) => relative(process.cwd(), file));
    snapshot.configurationHash = await fingerprint(request.sources);
    if (startingHash !== (await fingerprint(request.files))) {
      throw Object.assign(
        new Error('Inspection files changed during export. Retry with a stable working copy.'),
        {
          code: 'SOURCE_CHANGED',
        },
      );
    }
  }
  const inputSha256 = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
  return { snapshot, warnings, inputSha256, evidence: describeEvidence(snapshot) };
}

async function writeReport(output, report) {
  const target = resolve(output);
  const temporary = `${target}.${randomUUID()}.tmp`;
  await mkdir(dirname(target), { recursive: true });
  try {
    await writeFile(temporary, render(report), { flag: 'wx' });
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
}

/** Expose only the current report and projected JSON at an explicit loopback address. */
async function serve(port, state) {
  const host = `127.0.0.1:${port}`;
  const server = createServer((request, response) => {
    const route = request.headers.host === host && request.method === 'GET' && request.url;
    const isSnapshot = route === '/snapshot.json';
    const available = state.report && (!isSnapshot || !state.error);
    const found = route === '/' || isSnapshot;
    response.writeHead(!found ? 404 : available ? 200 : 503, {
      'content-type':
        found && !isSnapshot && available
          ? 'text/html; charset=utf-8'
          : 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'cross-origin-resource-policy': 'same-origin',
    });
    const body = !found
      ? { error: 'Not found' }
      : available
        ? state.report
        : { error: state.error ? 'Latest export failed.' : 'Waiting for the first snapshot.' };
    response.end(
      found && !isSnapshot && available
        ? render({ ...body, stale: Boolean(state.error) }, true)
        : JSON.stringify(body),
    );
  });
  await new Promise((ready, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', ready);
  });
  console.log(`http://${host}/`);
  return server;
}

/** Keep the last valid artifact through failed exports or atomic saves of watched files. */
async function watch(request) {
  const state = { report: undefined, error: undefined };
  const cancel = new AbortController();
  const stop = () => cancel.abort();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  let server;
  let previousHash;
  try {
    if (request.port !== undefined) server = await serve(request.port, state);
    while (!cancel.signal.aborted) {
      try {
        const digest = await fingerprint(request.files);
        if (digest !== previousHash) {
          previousHash = digest;
          const report = await buildReport(request, digest);
          if (cancel.signal.aborted) break;
          await writeReport(request.output, report);
          state.report = report;
          state.error = undefined;
          for (const warning of report.warnings) console.error(warning);
          console.log(`Updated ${request.output}`);
        }
      } catch (error) {
        if (state.error !== error.message)
          console.error(`Export failed; report may be stale: ${error.message}`);
        state.error = error.message;
        // Retry unreadable files after they reappear, even if their bytes are unchanged.
        if (['ENOENT', 'EACCES', 'SOURCE_CHANGED'].includes(error.code)) previousHash = undefined;
      }
      await delay(700, undefined, { signal: cancel.signal });
    }
  } catch (error) {
    if (!cancel.signal.aborted || error.name !== 'AbortError') throw error;
  } finally {
    server?.close();
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
  }
}

async function main() {
  const request = inputs();
  if (!request) return usage();
  if (request.command === 'watch') return watch(request);
  const report = await buildReport(
    request,
    request.entry ? await fingerprint(request.files) : undefined,
  );
  for (const warning of report.warnings) console.error(warning);
  if (request.command === 'export') console.log(JSON.stringify(report.snapshot, null, 2));
  else if (request.command === 'check') {
    console.log(`Checked ${report.snapshot.graph.workflowId}`);
    console.log('Static references only; no architecture or behavior acceptance is implied.');
    console.log(JSON.stringify(report.evidence));
  } else {
    await writeReport(request.output, report);
    console.log(request.output);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

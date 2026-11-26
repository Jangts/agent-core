import assert from 'node:assert/strict';
import { once } from 'node:events';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import { defineWorkflow } from '@jangts/agent-core';
import { inspection } from '../development/examples/workflow-inspection.mjs';

const entry = new URL('../development/examples/workflow-inspection.mjs', import.meta.url);
const cli = fileURLToPath(new URL('../development/scripts/workflow-inspector/cli.mjs', import.meta.url));
const temp = fileURLToPath(new URL('../.tmp/', import.meta.url));
const run = (...args) => execFileSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 10_000 });
const reject = (pattern, ...args) => {
  const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 10_000 });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, pattern);
};
async function workspace(t) {
  await mkdir(temp, { recursive: true });
  const directory = await mkdtemp(join(temp, 'workflow-inspector-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test('inspector projects the actual registrations and writes a safe offline report', async (t) => {
  const dir = await workspace(t);
  const exported = JSON.parse(run('export', '--entry', fileURLToPath(entry)));
  assert.deepEqual(exported.graph, JSON.parse(JSON.stringify(inspection.workflow.toGraph())));
  assert.deepEqual(exported.tools.map(({ id, registered }) => [id, registered]), [['lookup', true], ['explain', true]]);
  assert.deepEqual(exported.graph.edges.find(edge => edge.sourceNodeId === 'receive').routeOrders, [0, 1]);
  assert.ok(exported.graph.edges.some(edge => edge.kind === 'error'));
  assert.ok(exported.graph.edges.some(edge => edge.kind === 'complete'));
  assert.ok(exported.graph.edges.some(edge => edge.sourceNodeId === 'review' && edge.targetNodeId === 'receive'));
  assert.deepEqual(exported.nodeCapabilities[1].adapters.map(adapter => adapter.toolIds), [['lookup'], ['explain']]);

  const input = join(dir, 'snapshot.json');
  const html = join(dir, 'report.html');
  exported.graph.nodes[0].description = '</script><script>alert(1)</script>';
  exported.graph.nodes[0].secret = 'omit-this-private-field';
  await writeFile(input, JSON.stringify(exported));
  run('inspect', '--input', input, '--output', html);
  const body = await readFile(html, 'utf8');
  const scripts = [...body.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 2);
  assert.doesNotThrow(() => new Script(scripts[1][1]));
  const report = JSON.parse(scripts[0][1]);
  assert.equal(report.live, false);
  assert.equal(report.evidence.level, 'static-only');
  assert.equal(report.evidence.run.status, 'not-supplied');
  assert.match(report.evidence.projection, /unknown fields/);
  assert.equal(report.snapshot.graph.nodes[0].description, exported.graph.nodes[0].description);
  assert.ok(!body.includes('omit-this-private-field'));
  exported.nodeCapabilities[1].adapters[0].toolIds = ['missing'];
  await writeFile(input, JSON.stringify(exported));
  reject(/Unknown tool missing/, 'check', '--input', input);
  exported.nodeCapabilities[1].adapters[0].toolIds = ['lookup'];
  exported.graph.nodes[0].routes[0].order = 8;
  await writeFile(input, JSON.stringify(exported));
  reject(/Invalid route reference/, 'check', '--input', input);
});

test('export inspects pure registration without invoking handlers, conditions or chain sources', async (t) => {
  const dir = await workspace(t);
  const definition = join(dir, 'definition.mjs');
  const core = import.meta.resolve('@jangts/agent-core');
  await writeFile(definition, `
import { defineWorkflow } from ${JSON.stringify(core)};
function unexpected() { throw Error('execution is outside inspection'); }
export const workflow = defineWorkflow({ id: 'readonly', chainSource: unexpected, nodes: [
  { id: 'entry', description: 'Entry', startsRound: true, run: unexpected, routes: [
    { when: unexpected, complete: unexpected }, { complete: unexpected },
  ] },
] });
`);
  assert.equal(JSON.parse(run('export', '--entry', definition)).graph.workflowId, 'readonly');
  const commonjs = join(dir, 'definition.cjs');
  await writeFile(commonjs, `module.exports = {
    workflow: { toGraph: () => (${JSON.stringify(inspection.workflow.toGraph())}) },
  };`);
  assert.equal(JSON.parse(run('export', '--entry', commonjs)).graph.workflowId, inspection.workflow.id);
});

test('authorized chain projection keeps span identities, historical nodes and incomplete coverage', async (t) => {
  const dir = await workspace(t);
  const runId = 'authorized-run';
  const workflowId = inspection.workflow.id;
  function event(sequence, spanId, nodeId, type, extra = {}) {
    const eventId = `e${sequence}`;
    return {
      version: 2, eventId, producerSequence: sequence, occurredAtMs: sequence, runId, spanId, nodeId,
      type: 'workflow.event', nodeRole: 'workflow-node', definitionId: workflowId,
      definitionRevision: 'historical', workflowInvocationId: 'invoke',
      payload: {
        event: { workflowId, eventId, nodeId, type, roundIndex: 1, workflowInvocationId: 'invoke', ...extra },
        payload: { secret: 'omitted-run-content' },
      },
    };
  }
  const events = [
    event(1, 'one', 'receive', 'enter'),
    event(2, 'one', 'receive', 'transition', { targetSpanId: 'old', targetNodeId: 'retired' }),
    event(3, 'old', 'retired', 'enter'),
    event(4, 'old', 'retired', 'transition', { targetSpanId: 'two', targetNodeId: 'receive' }),
    event(5, 'two', 'receive', 'enter'),
  ];
  const workflow = defineWorkflow({
    id: workflowId,
    nodes: [{ id: 'stub', description: 'Fixture', routes: [{ complete: () => true }] }],
    chainSource: async (selectedRun) => {
      assert.equal(selectedRun, runId);
      return { events, coverage: { complete: false, content: 'mixed', issues: [{ code: 'partial' }] } };
    },
  });
  const chain = await workflow.toChain(runId);
  const chainFile = join(dir, 'run.json');
  await writeFile(chainFile, JSON.stringify(chain));
  reject(/Select the exact run/, 'export', '--entry', fileURLToPath(entry), '--chain', chainFile, '--run-id', 'another-run');
  const output = run('export', '--entry', fileURLToPath(entry), '--chain', chainFile, '--run-id', runId);
  const snapshot = JSON.parse(output);
  assert.deepEqual(snapshot.chain.nodes.map(n => [n.spanId, n.nodeId]), [
    ['one', 'receive'], ['old', 'retired'], ['two', 'receive'],
  ]);
  assert.deepEqual(snapshot.chain.transitions, JSON.parse(JSON.stringify(chain.transitions)));
  assert.deepEqual(snapshot.chain.coverage, JSON.parse(JSON.stringify(chain.coverage)));
  assert.ok(!output.includes('omitted-run-content'));
});

async function waitFor(check) {
  const until = Date.now() + 10_000;
  while (Date.now() < until) {
    if (await check()) return;
    await delay(40);
  }
  assert.fail('Watch did not reach the expected state');
}

test('watch reloads explicitly listed dependencies and keeps the last valid snapshot on failure', async (t) => {
  const dir = await workspace(t);
  const definition = join(dir, 'definition.mjs');
  const revision = join(dir, 'revision.mjs');
  const report = join(dir, 'report.html');
  await writeFile(definition, `
import { inspection as example } from ${JSON.stringify(entry.href)};
import { revision } from './revision.mjs';
export const workflow = { toGraph: () => ({ ...example.workflow.toGraph(), revision }) };
`);
  await writeFile(revision, 'export const revision = "first"');
  const child = spawn(process.execPath, [cli, 'watch', '--entry', definition, '--source', revision, '--output', report]);
  child.stdout.resume();
  const closed = once(child, 'close');
  t.after(async () => { child.kill('SIGTERM'); await closed; });

  let errors = '';
  child.stderr.on('data', (data) => { errors += data; });
  const read = () => readFile(report, 'utf8').catch(() => '');
  await waitFor(async () => (await read()).includes('"revision":"first"'));
  const first = await read();
  await writeFile(revision, 'export const invalid = ;');
  await waitFor(() => errors.includes('Export failed; report may be stale'));
  assert.equal(await read(), first);
  await writeFile(revision, 'export const revision = "second"');
  await waitFor(async () => (await read()).includes('"revision":"second"'));
});

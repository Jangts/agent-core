/** Register App-owned feature, node, and tool cases with Node's test runner. */
import { resolve } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { runScenario } from '../../../scripts/workflow-scenarios/scenario.mjs';

const layers = new Set(['feature', 'node', 'tool']);

/** Validate the full suite before executing any test handler, then apply the requested selectors. */
function selectTests(cases, selectedLayers, selectedIds) {
  if (!Array.isArray(cases) || !cases.length)
    throw new TypeError('The fixture must export a non-empty agentTests array');
  const casesById = new Map();
  for (const entry of cases) {
    if (
      !entry ||
      typeof entry.id !== 'string' ||
      !entry.id.trim() ||
      typeof entry.run !== 'function'
    )
      throw new TypeError('Each Agent test needs a non-empty id and a run() handler');
    if (!layers.has(entry.layer)) throw new TypeError(`Invalid test layer for ${entry.id}`);
    if (casesById.has(entry.id)) throw new TypeError(`Duplicate Agent test ${entry.id}`);
    const timeoutMs = entry.timeoutMs === undefined ? 5000 : entry.timeoutMs;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2_147_483_647)
      throw new TypeError(`Invalid timeoutMs for ${entry.id}`);
    casesById.set(entry.id, { ...entry, timeoutMs });
  }
  for (const layer of selectedLayers)
    if (!layers.has(layer)) throw new TypeError(`Unknown test layer ${layer}`);
  for (const id of selectedIds) {
    const entry = casesById.get(id);
    if (!entry) throw new TypeError(`Unknown Agent test ${id}`);
    if (selectedLayers.size && !selectedLayers.has(entry.layer))
      throw new TypeError(`Agent test ${id} is outside the selected layers`);
  }
  const selected = [...casesById.values()].filter(
    ({ id, layer }) =>
      (!selectedLayers.size || selectedLayers.has(layer)) &&
      (!selectedIds.size || selectedIds.has(id)),
  );
  if (!selected.length) throw new TypeError('No Agent tests match the selected layers');
  return selected;
}

async function main() {
  const { values } = parseArgs({
    options: {
      fixture: { type: 'string' },
      layer: { type: 'string', multiple: true },
      case: { type: 'string', multiple: true },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    console.log(
      'Usage: node test-agent.mjs [--fixture cases.mjs] [--layer feature|node|tool] [--case id]',
    );
    return;
  }
  const fixture =
    values.fixture === undefined
      ? new URL('../examples/agent-tests.mjs', import.meta.url)
      : pathToFileURL(resolve(values.fixture));
  const { agentTests } = await import(fixture);
  for (const entry of selectTests(agentTests, new Set(values.layer), new Set(values.case))) {
    test(`${entry.layer}/${entry.id}`, { timeout: entry.timeoutMs }, ({ signal }) =>
      entry.run({
        signal,
        runScenario: (scenario) =>
          runScenario(
            { id: entry.id, ...scenario, timeoutMs: scenario?.timeoutMs ?? entry.timeoutMs },
            { signal },
          ),
      }),
    );
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

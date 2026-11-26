/** Run selected offline JavaScript fixtures sequentially and propagate failures to CI. */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { runScenario, validateScenario } from './scenario.mjs';

async function main() {
  const { values } = parseArgs({
    options: {
      fixture: { type: 'string' },
      case: { type: 'string', multiple: true },
      json: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    console.log('Usage: node cli.mjs --fixture cases.mjs [--case id ...] [--json]');
    return;
  }
  if (!values.fixture) throw new TypeError('Provide a trusted --fixture JavaScript module');
  const imported = await import(pathToFileURL(resolve(values.fixture)));
  const scenarios = imported.scenarios ?? imported.default?.scenarios ?? imported.default;
  if (!Array.isArray(scenarios) || !scenarios.length)
    throw new TypeError('The fixture must export a non-empty scenario array');
  const cases = new Map();
  for (const scenario of scenarios) {
    validateScenario(scenario);
    if (cases.has(scenario.id)) throw new TypeError(`Duplicate scenario ${scenario.id}`);
    cases.set(scenario.id, scenario);
  }
  const selected = [...new Set(values.case ?? cases.keys())];
  for (const id of selected) {
    if (!cases.has(id)) throw new TypeError(`Unknown scenario ${id}`);
  }

  const results = [];
  for (const id of selected) {
    try {
      results.push({ ...(await runScenario(cases.get(id))), passed: true });
    } catch (error) {
      results.push({
        id,
        passed: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  if (values.json) console.log(JSON.stringify(results, null, 2));
  else
    for (const result of results) {
      console.log(
        result.passed
          ? `PASS ${result.id} (${result.modelCalls} model calls)`
          : `FAIL ${result.id}  ${result.message}`,
      );
    }
  if (results.some(({ passed }) => !passed)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

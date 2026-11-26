/** Display a reviewable workflow diff or machine-readable changes for CI. */
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { compareWorkflows } from './diff.mjs';

async function main() {
  const { values } = parseArgs({
    options: {
      before: { type: 'string' },
      after: { type: 'string' },
      json: { type: 'boolean' },
      'fail-on-change': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    console.log(
      'Usage: node cli.mjs --before baseline.json --after candidate.json [--json] [--fail-on-change]',
    );
    return;
  }
  if (!values.before || !values.after) throw new TypeError('Provide --before and --after');
  const snapshots = await Promise.all(
    [values.before, values.after].map(async (file) => JSON.parse(await readFile(file, 'utf8'))),
  );
  const report = compareWorkflows(...snapshots);
  if (values.json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(report.workflowId);
    console.log(
      'Declared references only; unchanged declarations do not establish unchanged behavior.',
    );
    if (report.entry) console.log(`entry  ${report.entry.before} → ${report.entry.after}`);
    for (const [name, section] of Object.entries(report.changes)) {
      if (!section.compared) {
        const missing = [
          !section.beforeSupplied && 'before',
          !section.afterSupplied && 'after',
        ].filter(Boolean);
        console.log(`? ${name}  declaration missing in ${missing.join(' and ')}`);
        continue;
      }
      for (const id of section.added) console.log(`+ ${name}  ${id}`);
      for (const id of section.removed) console.log(`- ${name}  ${id}`);
      for (const { id, fields } of section.modified)
        console.log(`~ ${name}  ${id}  [${fields.join(', ')}]`);
    }
    if (report.directlyAffectedNodes.length)
      console.log(`Directly affected nodes  ${report.directlyAffectedNodes.join(', ')}`);
    if (!report.hasChanges) console.log('No changes in the compared declarations.');
  }
  if (values['fail-on-change'] && report.hasChanges) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

/**
 * Validate the repository-only concept decisions against actual public source exports.
 * The catalog is maintenance input, never a runtime registration or authorization source.
 * --write records the finite public contract surface; default mode detects surface drift.
 */
import ts from 'typescript';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const contractsDirectory = fileURLToPath(
  new URL('../../../docs/maintenance/iterations/1.0.0/public-contracts/', import.meta.url),
);
const catalogPath = path.join(contractsDirectory, '1.0.0-concepts.json');
const snapshotPath = path.join(contractsDirectory, '1.0.0-public-contracts.json');
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
const program = ts.createProgram(parsed.fileNames, {
  ...parsed.options,
  noEmit: false,
  declaration: true,
  emitDeclarationOnly: true,
});
const checker = program.getTypeChecker();

/** Follow each declared package entry to source, rather than reading possibly stale dist. */
function publicSurface() {
  return Object.fromEntries(
    Object.entries(manifest.exports)
      .map(([entry, target]) => {
        const declaration = target.types;
        if (!declaration?.startsWith('./dist/esm/') || !declaration.endsWith('.d.ts'))
          throw new Error(`Unrecognized source mapping for ${entry}`);
        const filename = path.join(
          root,
          declaration.replace('./dist/esm/', 'src/').replace(/\.d\.ts$/, '.ts'),
        );
        const source = program.getSourceFile(filename);
        const module = source && checker.getSymbolAtLocation(source);
        if (!module) throw new Error(`Missing public source for ${entry}: ${filename}`);
        return [
          entry,
          checker
            .getExportsOfModule(module)
            .map((symbol) => symbol.name)
            .sort(),
        ];
      })
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

const entries = publicSurface();
const ids = new Set();
for (const concept of catalog.concepts) {
  if (ids.has(concept.id) || !/^N\d{2}$/.test(concept.id))
    throw new Error(`Invalid concept id ${concept.id}`);
  ids.add(concept.id);
  if (!['change', 'retain'].includes(concept.decision) || !concept.reason || !concept.owner)
    throw new Error(`Incomplete decision ${concept.id}`);
  for (const { entry, name } of concept.publicSymbols)
    if (!entries[entry]?.includes(name))
      throw new Error(`${concept.id}: ${entry} does not export ${name}`);
}
if (ids.size !== 20) throw new Error('The finite N01–N20 decision scope is incomplete');
// Hash emitted shapes, including transitively referenced types. A same-named export whose
// signature changed must not pass a name-only inventory check. Emission stays in memory.
const declarations = {};
const emitted = program.emit(undefined, (filename, contents) => {
  if (!filename.endsWith('.d.ts')) return;
  const relative = path.relative(path.join(root, 'dist/esm'), filename).split(path.sep).join('/');
  declarations[relative] = createHash('sha256').update(contents).digest('hex');
});
if (emitted.emitSkipped) throw new Error('Cannot inventory declaration shapes');
const snapshot = {
  schemaVersion: 1,
  packageName: manifest.name,
  entries,
  declarations: Object.fromEntries(
    Object.entries(declarations).sort(([a], [b]) => a.localeCompare(b)),
  ),
};
const encoded = `${JSON.stringify(snapshot, null, 2)}\n`;
if (process.argv.includes('--write')) await writeFile(snapshotPath, encoded);
else if ((await readFile(snapshotPath, 'utf8')) !== encoded)
  throw new Error(
    'Public surface changed: review decisions, then regenerate check-concepts --write',
  );
console.log(
  JSON.stringify({
    concepts: ids.size,
    entries: Object.keys(entries).length,
    declarations: Object.values(entries).reduce((total, values) => total + values.length, 0),
    sha256: createHash('sha256').update(encoded).digest('hex'),
  }),
);

/**
 * Generate the public-symbol reference for the Agent Core documentation site.
 *
 * Emits declarations from the current sources into memory, then type-checks those in-memory
 * declarations against the workspace `paths` aliases, so the table follows the same public entries
 * as the package build without reading stale `dist` files or trusting external dependency
 * locations. Output is Markdown: one section per `package.json` export, each symbol linked to the
 * shipped declaration that actually re-exports it.
 *
 * Usage: `node api-reference.mjs [--output FILE] [--language zh|en]` (defaults to `development/docs/api/reference.md`).
 */
import ts from 'typescript';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Derive declaration snapshots from current sources, without building or trusting stale dist files.
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const args = process.argv.slice(2);
const referenceArgs = new Map();
for (let index = 0; index < args.length; index += 2) {
  const key = args[index],
    value = args[index + 1];
  if (!['--output', '--language'].includes(key) || !value || referenceArgs.has(key))
    throw new Error('Usage: node api-reference.mjs [--output FILE] [--language zh|en]');
  referenceArgs.set(key, value);
}
const language = referenceArgs.get('--language') ?? 'zh';
if (!['zh', 'en'].includes(language)) throw new Error('Language must be zh or en');
const english = language === 'en';
const referenceDirectory = path.join(root, 'development/docs/api');
const output = referenceArgs.has('--output')
  ? path.resolve(referenceArgs.get('--output'))
  : path.join(referenceDirectory, english ? 'reference.en.md' : 'reference.md');
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const configPath = path.join(root, 'tsconfig.json');
const config = ts.readConfigFile(configPath, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
// Match workspace imports to their source exports; documentation must follow the same
// public aliases as the package build, including types re-exported from other packages.
const workspaceRoot = path.resolve(root, '../..');
const paths = {};
const packages = [];
for (const entry of await readdir(path.join(workspaceRoot, 'packages'), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const directory = path.join(workspaceRoot, 'packages', entry.name);
  packages.push(directory);
  let manifest;
  try {
    manifest = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') continue;
    throw error;
  }
  for (const [entry, target] of Object.entries(manifest.exports ?? {})) {
    if (!target?.types) continue;
    paths[manifest.name + (entry === '.' ? '' : entry.slice(1))] = [
      path.join(directory, target.types.replace('./dist/esm/', 'src/').replace(/\.d\.ts$/, '.ts')),
    ];
  }
}
const declarations = Object.values(pkg.exports).map((target) => path.join(root, target.types));
const emitted = new Map();
const sourceProgram = ts.createProgram(parsed.fileNames, {
  ...parsed.options,
  paths,
  rootDir: workspaceRoot,
  declaration: true,
  emitDeclarationOnly: true,
  noEmit: false,
  noEmitOnError: false,
});
sourceProgram.emit(
  undefined,
  (filename, text, _bom, _error, sourceFiles) => {
    const source = sourceFiles?.[0]?.fileName;
    const directory =
      source &&
      packages.find((directory) => source.startsWith(path.join(directory, 'src') + path.sep));
    const target = directory
      ? path.join(
          directory,
          'dist/esm',
          path.relative(path.join(directory, 'src'), source).replace(/\.tsx?$/, '.d.ts'),
        )
      : filename;
    emitted.set(path.resolve(target), text);
  },
  undefined,
  true,
);
for (const filename of declarations)
  if (!emitted.has(filename)) throw new Error(`Cannot generate public declaration: ${filename}`);
const options = { ...parsed.options, noEmit: true };
const host = ts.createCompilerHost(options);
const diskRead = host.readFile.bind(host),
  diskExists = host.fileExists.bind(host);
host.readFile = (filename) => emitted.get(path.resolve(filename)) ?? diskRead(filename);
host.fileExists = (filename) => emitted.has(path.resolve(filename)) || diskExists(filename);
host.getSourceFile = (filename, languageVersion) => {
  const text = host.readFile(filename);
  return text === undefined
    ? undefined
    : ts.createSourceFile(filename, text, languageVersion, true);
};
const program = ts.createProgram(declarations, options, host);
const checker = program.getTypeChecker();
const resolvedSymbol = (symbol) =>
  symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
function declarationLink(declaration) {
  const file = declaration.getSourceFile(),
    line = file.getLineAndCharacterOfPosition(declaration.getStart()).line + 1;
  const target = path.relative(referenceDirectory, file.fileName).split(path.sep).join('/');
  return `[${english ? 'Declaration' : '声明'}](${target}#L${line})`;
}
function exportedDeclaration(source, exported) {
  // External symbols may resolve outside this package. Link to the actual shipped
  // re-export instead of inventing a dependency's install location or source URL.
  for (const statement of source.statements) {
    if (!ts.isExportDeclaration(statement) || !statement.moduleSpecifier) continue;
    if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      const specifier = statement.exportClause.elements.find(
        (item) => item.name.text === exported.name,
      );
      if (specifier) return specifier;
    }
    if (
      statement.exportClause &&
      ts.isNamespaceExport(statement.exportClause) &&
      statement.exportClause.name.text === exported.name
    )
      return statement.exportClause;
    const module = checker.getSymbolAtLocation(statement.moduleSpecifier);
    if (
      module &&
      checker
        .getExportsOfModule(module)
        .some((symbol) => resolvedSymbol(symbol) === resolvedSymbol(exported))
    )
      return statement;
  }
  throw new Error(`Cannot locate shipped declaration for ${exported.name} in ${source.fileName}`);
}
const pages = {
  '.': 'core.md',
  './types': 'types.md',
  './structs': 'types.md',
  './engine': 'core.md',
  './model': 'core.md',
  './context': 'context-processing.md',
  './journal': 'observability.md',
  './diagnostics': 'observability.md',
  './errors': 'types.md',
  './tools': 'core.md',
  './protocols': 'types.md',
  './events': 'knowledge-answering.md',
  './skills': english ? 'skills.en.md' : 'skills.md',
  './mock': 'mock.md',
  './mock/node': 'mock.md',
  './mock/web': 'mock.md',
};
const lines = english
  ? [
      '# Public symbol reference',
      '',
      'Symbols are listed by `package.json.exports` and the TypeScript declarations shipped with the package; parameters, overloads and return types follow the linked declarations.',
      '',
      'Symbols of this package link to the declarations shipped with the package; external symbols link to the declaration from which this package actually re-exports them, and the full type is provided by the installed dependency referenced by that declaration, without assuming the location of that dependency on disk. Aggregate entries from the same source point to the same implementation; usage is described in each chapter. Shared runtime types can be imported from `@jangts/agent-core/types`, which has no runtime values; each sub-entry also exports its own related types, and MockGPT types are imported from the corresponding mock entry.',
      '',
    ]
  : [
      '# 公开符号参考',
      '',
      '符号按 `package.json.exports` 和随包 TypeScript 声明列出；参数、重载和返回类型以链接的声明为准。',
      '',
      '本包符号链接到随包交付的声明；外部符号链接到本包实际转出它的声明，完整类型由该声明引用的已安装依赖提供，不假定依赖的磁盘位置。同源聚合入口指向同一实现，用法见各章。共享运行类型可从 `@jangts/agent-core/types` 导入，该入口没有运行时值；各子入口也导出自身相关类型，MockGPT 类型从对应 mock 入口导入。',
      '',
    ];
for (const [entry, target] of Object.entries(pkg.exports)) {
  const relative = target.types;
  const filename = path.join(root, relative),
    source = program.getSourceFile(filename);
  if (!source) throw new Error(`Missing export source: ${entry} -> ${relative}`);
  const module = checker.getSymbolAtLocation(source);
  const symbols = checker.getExportsOfModule(module).sort((a, b) => a.name.localeCompare(b.name));
  const chapter =
    pages[entry] ??
    (entry.startsWith('./support') || ['./sse', './json-transport'].includes(entry)
      ? 'support.md'
      : ['./kits/knowledge', './kits/answering', './kits/presentation'].includes(entry)
        ? 'knowledge-answering.md'
        : 'kits.md');
  lines.push(
    `## ${entry === '.' ? '@jangts/agent-core' : '@jangts/agent-core/' + entry.slice(2)}`,
    '',
    `[${english ? 'Contracts and behavior' : '合同与行为'}](${chapter}) · ${symbols.length} ${english ? 'exported symbols' : '个导出符号'}`,
    '',
    english
      ? '| Symbol | Type／value | Declaration and notes |'
      : '| 符号 | 类型／值 | 声明与说明 |',
    '| --- | --- | --- |',
  );
  for (const exported of symbols) {
    let symbol = exported;
    if (symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    const declaration = symbol.declarations?.find((d) =>
      d.getSourceFile().fileName.startsWith(root + path.sep),
    );
    const typeOnly = entry === './types' || !(symbol.flags & ts.SymbolFlags.Value);
    const link = declarationLink(declaration ?? exportedDeclaration(source, exported));
    const deprecated = [...exported.getJsDocTags(checker), ...symbol.getJsDocTags(checker)].find(
      (tag) => tag.name === 'deprecated',
    );
    const note = deprecated
      ? ts.displayPartsToString(deprecated.text).replaceAll('|', '\\|').replace(/\n/g, ' ')
      : '';
    lines.push(
      `| \`${exported.name}\` | ${typeOnly ? 'type' : 'value' + (symbol.flags & ts.SymbolFlags.Type ? ' + type' : '')} | ${link}${note ? '；' + note : ''} |`,
    );
  }
  lines.push('');
}
await writeFile(output, lines.join('\n'));

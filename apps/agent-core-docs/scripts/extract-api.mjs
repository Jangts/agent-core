// Agent Core 文档站的公开 API 抽取：读取 SDK 的 tsconfig 与 package.json exports，
// 用 TypeScript 编译器生成声明并汇总符号、成员、签名、引用关系与配方清单。
// 输出由 generate.mjs 渲染为 API 页面；本文件不执行 SDK 业务代码。
import ts from 'typescript';
import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { sdkDirectory, sdkRoot, workspaceRoot, siteRoot, posix, slug } from './paths.mjs';
import { domainOf } from './domains.mjs';

const format =
  ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope;
// 源码归属决定 API 阅读分组，同一个符号的聚合导出沿用原分组。
const apiLayers = [
  { pattern: /\/support\//, layer: 'support' },
  { pattern: /\/src\/skills\//, layer: 'skills' },
  { pattern: /\/kits\/|\/mock-gpt\/|\/mock(?:\/|\.ts$)/, layer: 'kit' },
];
const privateMember = (node) =>
  (node.name && ts.isPrivateIdentifier(node.name)) ||
  node.modifiers?.some(
    (item) =>
      item.kind === ts.SyntaxKind.PrivateKeyword || item.kind === ts.SyntaxKind.ProtectedKeyword,
  );
const display = (parts) => ts.displayPartsToString(parts ?? []).trim();
// TypeScript's escaped symbol names contain per-program IDs; public names come from declarations.
const propertyName = (symbol, declaration) =>
  declaration?.name && ts.isComputedPropertyName(declaration.name)
    ? declaration.name.getText()
    : symbol.name;

/** Find the dependency installation selected for this workspace in the root lockfile. */
async function installedTypes(name, lock, requiredVersion) {
  const location = [`${sdkDirectory}/node_modules/${name}`, `node_modules/${name}`].find(
    (candidate) => lock.packages?.[candidate]?.version,
  );
  const version = lock.packages?.[location]?.version;
  if (!version || (requiredVersion && version !== requiredVersion))
    throw new Error(`Agent Core has no matching lock entry for ${name}${requiredVersion ? '@' + requiredVersion : ''}.`);
  const root = path.join(workspaceRoot, location);
  const installHint = `Run npm ci in the Agent Core repository at ${workspaceRoot}.`;
  try {
    const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
    if (manifest.name !== name || manifest.version !== version)
      throw new Error(`Expected ${name}@${version}, found ${manifest.name}@${manifest.version}.`);
    return { packageName: name.slice('@jangts/'.length), root: await realpath(path.join(root, 'dist/esm')) };
  } catch (cause) {
    throw new Error(`Cannot use installed ${name}@${version} declarations. ${installHint}`, { cause });
  }
}

function relativeFile(root, filename) {
  const relative = path.relative(root, filename);
  if (relative && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) return relative;
}

/**
 * 抽取 SDK 全部公开入口的符号、成员、签名与源码快照。
 * 通过临时声明输出解析类型，不运行 SDK 代码。
 * @returns {Promise<object>} 版本号、按名称排序的符号记录、公开模块清单、源码快照与生成的声明文本。
 * @throws {Error} 公开入口找不到源码、模块符号或无法解析公开声明时抛出。
 */
export async function extractApi() {
  const [pkg, lock] = await Promise.all([
    readFile(path.join(sdkRoot, 'package.json'), 'utf8').then(JSON.parse),
    readFile(path.join(workspaceRoot, 'package-lock.json'), 'utf8').then(JSON.parse),
  ]);
  const dependencyTypes = await Promise.all([
    installedTypes('@jangts/mock-gpt', lock, pkg.peerDependencies['@jangts/mock-gpt']),
    installedTypes('@jangts/streaming', lock),
  ]);
  const dependencyOrigin = (filename) => {
    for (const { packageName, root } of dependencyTypes) {
      const relative = relativeFile(root, filename);
      // Keep public route identities for re-exports backed by shipped declarations.
      if (relative?.endsWith('.d.ts'))
        return `packages/${packageName}/src/${posix(relative).replace(/\.d\.ts$/, '.ts')}`;
    }
  };
  const originOf = (filename) => {
    const relative = relativeFile(path.join(sdkRoot, 'src'), filename);
    return relative ? `${sdkDirectory}/src/${posix(relative)}` : dependencyOrigin(filename);
  };
  const config = ts.readConfigFile(path.join(sdkRoot, 'tsconfig.json'), ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, sdkRoot);
  const options = {
    ...parsed.options,
    declaration: true,
    emitDeclarationOnly: true,
    noEmit: false,
    noEmitOnError: false,
  };
  const program = ts.createProgram(parsed.fileNames, options);
  const checker = program.getTypeChecker();
  const emitted = [];
  program.emit(
    undefined,
    (filename, text, _bom, _onError, sourceFiles) => {
      if (!filename.endsWith('.d.ts') || sourceFiles?.length !== 1) return;
      const origin = originOf(sourceFiles[0].fileName);
      if (origin) emitted.push({ origin, text });
    },
    undefined,
    true,
  );
  const resolved = (symbol) =>
    symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  const symbolKey = (input) => {
    const symbol = resolved(input);
    if (symbol.flags & ts.SymbolFlags.TypeParameter) return;
    const node = symbol.valueDeclaration ?? symbol.declarations?.[0];
    const origin = node && originOf(node.getSourceFile().fileName);
    if (!origin) return;
    return `${origin}:${symbol.flags & ts.SymbolFlags.Module ? 'namespace' : symbol.name}`;
  };
  const textOf = (type, node) => checker.typeToString(type, node, format);
  const docs = (symbol) =>
    symbol.declarations?.some((node) => node.jsDoc?.length)
      ? display(symbol.getDocumentationComment(checker))
      : '';
  const properties = (type, node, includeClass = false) => {
    if (
      type.flags &
      (ts.TypeFlags.Any |
        ts.TypeFlags.Unknown |
        ts.TypeFlags.TypeParameter |
        ts.TypeFlags.StringLike |
        ts.TypeFlags.NumberLike |
        ts.TypeFlags.BooleanLike |
        ts.TypeFlags.Never |
        ts.TypeFlags.Void)
    )
      return [];
    if (checker.isArrayType(type) || checker.isTupleType(type)) return [];
    // Named class instances have their own reference page. Expanding them at
    // every return site repeats the entire class, including all its methods.
    if (!includeClass && type.getSymbol()?.flags & ts.SymbolFlags.Class) return [];
    return checker
      .getPropertiesOfType(type)
      .filter(
        (symbol) =>
          !symbol.declarations?.some(privateMember) &&
          symbol.declarations?.some((node) => originOf(node.getSourceFile().fileName)),
      )
      .map((symbol) => {
        const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0] ?? node;
        return {
          name: propertyName(symbol, declaration),
          type: textOf(checker.getTypeOfSymbolAtLocation(symbol, declaration), declaration),
          optional: !!(symbol.flags & ts.SymbolFlags.Optional),
          readonly:
            !!declaration?.modifiers?.some((x) => x.kind === ts.SyntaxKind.ReadonlyKeyword) ||
            (ts.isGetAccessorDeclaration(declaration) &&
              !symbol.declarations?.some(ts.isSetAccessorDeclaration)),
          description: docs(symbol),
        };
      });
  };
  const variants = (type, node) =>
    type.isUnion()
      ? type.types.map((branch) => ({
          type: textOf(branch, node),
          fields: properties(branch, node),
        }))
      : [];
  const typeParameters = (parameters, location) =>
    (parameters ?? []).map((parameter) => ({
      name: parameter.symbol.name,
      constraint: parameter.getConstraint() ? textOf(parameter.getConstraint(), location) : '',
      default: parameter.getDefault() ? textOf(parameter.getDefault(), location) : '',
    }));
  const signatures = (type, location, construct = false) =>
    (construct ? type.getConstructSignatures() : type.getCallSignatures()).map((signature) => {
      const result = checker.getReturnTypeOfSignature(signature);
      const awaited = checker.getAwaitedType(result) ?? result;
      return {
        text: checker.signatureToString(
          signature,
          location,
          format,
          construct ? ts.SignatureKind.Construct : ts.SignatureKind.Call,
        ),
        construct,
        typeParameters: typeParameters(signature.typeParameters, location),
        parameters: signature.parameters.map((parameter) => {
          const node = parameter.valueDeclaration ?? parameter.declarations?.[0] ?? location;
          const type = checker.getTypeOfSymbolAtLocation(parameter, node);
          return {
            name: parameter.name,
            type: textOf(type, node),
            optional:
              !!(parameter.flags & ts.SymbolFlags.Optional) ||
              !!node.questionToken ||
              !!node.initializer,
            rest: !!node.dotDotDotToken,
            description: docs(parameter),
            fields: type.isUnion() ? [] : properties(type, node),
            variants: variants(type, node),
          };
        }),
        returns: textOf(result, location),
        awaited: textOf(awaited, location),
        outputFields: awaited.isUnion() ? [] : properties(awaited, location),
        outputVariants: variants(awaited, location),
        description: signature.declaration?.jsDoc?.length
          ? display(signature.getDocumentationComment(checker))
          : '',
      };
    });
  const records = new Map();
  const modules = [];
  for (const [entry, target] of Object.entries(pkg.exports)) {
    const sourceName = path.join(
      sdkRoot,
      target.types.replace('./dist/esm/', 'src/').replace(/\.d\.ts$/, '.ts'),
    );
    const source = program.getSourceFile(sourceName);
    if (!source) throw new Error(`Public export has no source: ${entry}: ${sourceName}`);
    const module = checker.getSymbolAtLocation(source);
    if (!module) throw new Error(`Public export has no module: ${entry}`);
    const namespaceType = checker.getTypeOfSymbolAtLocation(module, source);
    const exports = checker.getExportsOfModule(module);
    const item = { entry, name: pkg.name + (entry === '.' ? '' : entry.slice(1)), symbols: [] };
    for (const exported of exports) {
      const symbol = resolved(exported);
      const node = symbol.valueDeclaration ?? symbol.declarations?.[0];
      if (!node) throw new Error(`Cannot resolve public declaration: ${entry}:${exported.name}`);
      const origin = originOf(node.getSourceFile().fileName);
      const namespace = !!(symbol.flags & ts.SymbolFlags.Module);
      const publicName = exported.name;
      const key = `${origin}:${namespace ? 'namespace' : symbol.name}`;
      let record = records.get(key);
      if (!record) {
        const type = checker.getTypeOfSymbolAtLocation(symbol, node);
        const instance =
          symbol.flags &
          (ts.SymbolFlags.Class | ts.SymbolFlags.Interface | ts.SymbolFlags.TypeAlias)
            ? checker.getDeclaredTypeOfSymbol(symbol)
            : type;
        const callableType = symbol.flags & ts.SymbolFlags.Value ? type : instance;
        const memberTypes = [];
        const addMembers = (value, isStatic, prefix = '', depth = 0) => {
          for (const member of checker.getPropertiesOfType(value)) {
            const declaration = member.valueDeclaration ?? member.declarations?.[0];
            if (!declaration || privateMember(declaration) || member.name === 'prototype') continue;
            if (!originOf(declaration.getSourceFile().fileName)) continue;
            const memberType = checker.getTypeOfSymbolAtLocation(member, declaration);
            const name = prefix + propertyName(member, declaration);
            const calls = [
              ...signatures(memberType, declaration, true),
              ...signatures(memberType, declaration),
            ];
            if (calls.length)
              memberTypes.push({
                name,
                static: isStatic,
                description: docs(member),
                signatures: calls,
              });
            // Workflow.route exposes the same public route generator namespace.
            if (depth === 0 && member.name === 'route')
              addMembers(memberType, true, name + '.', depth + 1);
          }
        };
        const callableNamespace = namespace && type.getCallSignatures().length > 0;
        if (!namespace || callableNamespace) {
          addMembers(type, !!(symbol.flags & ts.SymbolFlags.Class));
          if (instance !== type) addMembers(instance, false);
        }
        const line = node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line + 1;
        const references = new Set();
        const addSymbol = (value) => {
          const key = value && symbolKey(value);
          if (key) references.add(key);
        };
        const visitedTypes = new Set();
        const addType = (value, depth = 0) => {
          if (
            !value ||
            depth > 3 ||
            visitedTypes.has(value) ||
            value.flags & ts.TypeFlags.TypeParameter
          )
            return;
          visitedTypes.add(value);
          addSymbol(value.aliasSymbol ?? value.getSymbol());
          for (const child of value.aliasTypeArguments ?? []) addType(child, depth + 1);
          if (value.isUnionOrIntersection())
            for (const child of value.types) addType(child, depth + 1);
          if (value.objectFlags & ts.ObjectFlags.Reference)
            for (const child of checker.getTypeArguments(value)) addType(child, depth + 1);
        };
        const collectSignature = (value) => {
          for (const signature of [
            ...value.getCallSignatures(),
            ...value.getConstructSignatures(),
          ]) {
            addType(checker.getReturnTypeOfSignature(signature));
            for (const parameter of signature.parameters)
              addType(
                checker.getTypeOfSymbolAtLocation(parameter, parameter.valueDeclaration ?? node),
              );
          }
        };
        const visitContract = (value) => {
          if (privateMember(value) || ts.isBlock(value)) return;
          if (ts.isTypeReferenceNode(value)) addSymbol(checker.getSymbolAtLocation(value.typeName));
          if (ts.isExpressionWithTypeArguments(value))
            addSymbol(checker.getSymbolAtLocation(value.expression));
          if (ts.isTypeQueryNode(value)) addSymbol(checker.getSymbolAtLocation(value.exprName));
          ts.forEachChild(value, visitContract);
        };
        for (const declaration of symbol.declarations ?? []) visitContract(declaration);
        addType(instance);
        collectSignature(callableType);
        for (const member of checker.getPropertiesOfType(instance)) {
          const location = member.valueDeclaration ?? member.declarations?.[0];
          if (!location || privateMember(location)) continue;
          const memberType = checker.getTypeOfSymbolAtLocation(member, location);
          addType(memberType);
          collectSignature(memberType);
        }
        record = {
          key,
          id: slug(publicName),
          name: publicName,
          aliases: [],
          imports: [],
          origin,
          line,
          kind:
            namespace && !callableNamespace
              ? 'namespace'
              : symbol.flags & ts.SymbolFlags.Class
                ? 'class'
                : symbol.flags & ts.SymbolFlags.Interface
                  ? 'interface'
                  : symbol.flags & ts.SymbolFlags.TypeAlias
                    ? 'type'
                    : type.getCallSignatures().length
                      ? 'function'
                      : 'constant',
          description: docs(symbol),
          typeParameters: (node.typeParameters ?? []).map((parameter) => ({
            name: parameter.name.text,
            constraint: parameter.constraint?.getText() ?? '',
            default: parameter.default?.getText() ?? '',
          })),
          bases:
            node.heritageClauses?.flatMap((clause) => clause.types.map((type) => type.getText())) ??
            [],
          typeExpression: ts.isTypeAliasDeclaration(node) ? node.type.getText() : '',
          valueType: textOf(type, node),
          indexSignatures: checker.getIndexInfosOfType(instance).map((info) => ({
            name: `[key: ${textOf(info.keyType, node)}]`,
            type: textOf(info.type, node),
            readonly: info.isReadonly,
            optional: false,
            description: '',
          })),
          signatures:
            namespace && !callableNamespace
              ? []
              : [...signatures(callableType, node, true), ...signatures(callableType, node)],
          staticFields:
            symbol.flags & ts.SymbolFlags.Class
              ? properties(type, node, true).filter(
                  (field) =>
                    !memberTypes.some((member) => member.static && member.name === field.name),
                )
              : [],
          fields: namespace || instance.isUnion() ? [] : properties(instance, node, true),
          fieldVariants: variants(instance, node),
          members: memberTypes,
          children: namespace
            ? checker
                .getExportsOfModule(symbol)
                .map((child) => resolved(child).name)
                .sort()
            : [],
          references: [...references],
        };
        records.set(key, record);
      }
      if (!record.aliases.includes(exported.name)) record.aliases.push(exported.name);
      // The module namespace exposes values, including aliases, but omits `export type *`.
      record.imports.push({
        module: item.name,
        exported: exported.name,
        entry,
        typeOnly: checker.getPropertyOfType(namespaceType, publicName) !== exported,
      });
      item.symbols.push(key);
    }
    modules.push(item);
  }
  const names = new Map();
  for (const record of records.values()) names.set(record.id, (names.get(record.id) ?? 0) + 1);
  for (const record of records.values()) {
    if (names.get(record.id) > 1) record.id += '-' + slug(record.origin.replace(/\/src\//, '/'));
  }
  // Case-only names in the same source (toolbox / Toolbox) also need distinct URLs.
  const qualifiedNames = new Map();
  for (const record of records.values())
    qualifiedNames.set(record.id, (qualifiedNames.get(record.id) ?? 0) + 1);
  const usedIds = new Set();
  for (const record of records.values()) {
    if (qualifiedNames.get(record.id) > 1) record.id += '-' + record.kind;
    if (usedIds.has(record.id)) throw new Error(`Public API route collision: ${record.id}`);
    usedIds.add(record.id);
    record.runtime = record.imports.some((item) => !item.typeOnly);
    record.layer = apiLayers.find(({ pattern }) => pattern.test(record.origin))?.layer ?? 'core';
    record.domain = domainOf(record.origin);
    record.url = `/api/${record.layer}/${record.domain.id}/${record.id}`;
    const candidates = record.imports.filter((item) => !item.typeOnly || !record.runtime);
    record.preferredImport = [...(candidates.length ? candidates : record.imports)].sort((a, b) => {
      const score = (value) =>
        value.entry === './types' || value.entry === './structs' || value.entry === './kits'
          ? 100
          : value.entry === '.'
            ? 50
            : value.entry.split('/').length;
      return score(a) - score(b);
    })[0];
  }
  const sourceFiles = [];
  for (const file of program.getSourceFiles()) {
    const origin = file.isDeclarationFile ? dependencyOrigin(file.fileName) : originOf(file.fileName);
    if (!origin) continue;
    sourceFiles.push({ origin, text: file.text });
    if (file.isDeclarationFile)
      emitted.push({ origin, declarationPath: file.fileName, text: file.text });
  }
  return {
    version: pkg.version,
    records: [...records.values()].sort((a, b) => a.name.localeCompare(b.name)),
    modules,
    sourceFiles,
    emitted,
  };
}

/**
 * 读取 Core & Support、Tool Kit 和 SKILLs 的正式示例入口。
 * 拆分文件只是实现细节，统一入口保证配方 ID 不重复。
 * @returns {Promise<object[]>} 全部配方对象，含 id、layer、matches、examples 与 policies。
 * @throws {Error} 配方缺少 ID 或 ID 重复时抛出。
 */
export async function readRecipeModules() {
  const directory = path.join(siteRoot, 'content/recipes');
  const entries = await readdir(directory).catch(() => []);
  const files = entries.filter((name) =>
    ['core-support.mjs', 'kits.mjs', 'skills.mjs'].includes(name),
  );
  const recipes = [];
  for (const file of files)
    recipes.push(
      ...(
        await import(`${new URL('file:' + path.join(directory, file)).href}?snapshot=${Date.now()}`)
      ).default,
    );
  const ids = new Set();
  for (const recipe of recipes) {
    if (!recipe.id || ids.has(recipe.id))
      throw new Error(`Duplicate/missing recipe ID: ${recipe.id}`);
    ids.add(recipe.id);
  }
  return recipes;
}

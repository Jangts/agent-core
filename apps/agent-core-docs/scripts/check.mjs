// Agent Core 文档站的构建产物检查：核对覆盖率报告与站点内目录一致，验证 API 页面结构、
// 文章示例、搜索索引、Mermaid 语法、静态资源引用与 SDK 发布边界，防止生成内容或内部路径外泄。
import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
import { pathToFileURL } from 'node:url';
import { outputRoot, siteOutputRoot, sdkRoot, siteRoot } from './paths.mjs';

// 与构建保持一致：旧 /en/ 跳转页与静态链接校验都基于同一个基础路径。
const siteBase = process.env.AGENT_CORE_DOCS_BASE ?? '/';

const exists = (filename) =>
  access(filename).then(
    () => true,
    () => false,
  );
async function filesIn(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await filesIn(filename)));
    else result.push(filename);
  }
  return result;
}

// Articles may introduce a runnable example through its guide instead of repeating one CLI.
// Inspect body links only, so the shared navigation cannot satisfy this requirement.
const sdkFiles = JSON.parse(await readFile(path.join(sdkRoot, 'package.json'), 'utf8')).files;
async function hasRelatedScript(html, followLinks = true) {
  const dom = new JSDOM(html);
  try {
    const body = dom.window.document.querySelector('.vp-doc');
    if (!body) return false;
    const scripts =
      body.textContent.match(
        /\bdevelopment\/(?:docs\/examples|scripts|examples|skills)\/[A-Za-z0-9/_-]+\.mjs\b/g,
      ) ?? [];
    for (const script of scripts) {
      if (
        sdkFiles.some((entry) => script === entry || script.startsWith(entry + '/')) &&
        (await exists(path.join(sdkRoot, script)))
      )
        return true;
    }
    if (followLinks) {
      for (const anchor of body.querySelectorAll('a[href]')) {
        const url = new URL(anchor.getAttribute('href'), 'https://docs.invalid');
        if (
          url.origin !== 'https://docs.invalid' ||
          !url.pathname.startsWith(siteBase) ||
          !url.pathname.endsWith('.html')
        )
          continue;
        const filename = path.join(siteOutputRoot, url.pathname.slice(siteBase.length));
        if (
          (await exists(filename)) &&
          (await hasRelatedScript(await readFile(filename, 'utf8'), false))
        )
          return true;
      }
    }
    return false;
  } finally {
    dom.window.close();
  }
}

const report = JSON.parse(await readFile(path.join(outputRoot, 'coverage.json'), 'utf8'));
const shippedCatalog = JSON.parse(
  await readFile(path.join(siteOutputRoot, 'api-catalog.json'), 'utf8'),
);
assert.deepEqual(
  shippedCatalog,
  report,
  'The website contains a stale API catalog; build it again',
);
const files = await filesIn(siteOutputRoot);
assert.ok(report.publicSymbols > 0 && report.exportedModules > 0, 'Public API catalog is empty');
assert.deepEqual(
  report.undocumentedRuntime,
  [],
  'A public runtime symbol is missing scenario examples',
);
assert.equal(
  new Set(report.symbolPages.map((page) => page.url)).size,
  report.publicSymbols,
  'Symbol routes collide',
);
assert.ok(
  report.articles.length >= 7,
  'The article collection must contain at least 7 entries',
);
for (const article of report.articles) {
  for (const locale of ['zh', 'en']) {
    const html = await readFile(
      path.join(siteOutputRoot, locale, 'articles', article.id + '.html'),
      'utf8',
    );
    assert.ok(html.includes(article.title[locale]), `Missing article: ${locale}/${article.id}`);
    assert.ok(html.includes('/development/skills/'), `Missing related Skill: ${article.id}`);
    assert.ok(
      await hasRelatedScript(html),
      `Missing related shipped script or runnable guide: ${locale}/${article.id}`,
    );
  }
}
const enRoute = (route) => route.replace(/^\/zh\//, '/en/');
for (const page of report.symbolPages) {
  for (const [locale, labels] of [
    ['zh', ['定义', '导入']],
    ['en', ['Definition', 'Import']],
  ]) {
    const route = locale === 'zh' ? page.url : enRoute(page.url);
    const filename = path.join(siteOutputRoot, route.slice(1) + '.html');
    assert.ok(await exists(filename), `Missing ${locale} public API page: ${page.name}`);
    const html = await readFile(filename, 'utf8');
    assert.ok(
      html.includes(labels[0]) && html.includes(labels[1]),
      `Missing ${locale} API definition: ${page.name}`,
    );
    assert.ok(
      !html.includes('声明由当前源码在内存中生成'),
      `Build internals leaked into API documentation: ${page.name}`,
    );
    assert.ok(
      !html.replace(/<[^>]*>/g, '').includes('export declare class'),
      `A whole class declaration replaced API documentation: ${page.name}`,
    );
    assert.ok(
      !/new (?:AgentCoreEngine|ModelRunner)new/.test(html),
      `Malformed constructor signature: ${page.name}`,
    );
    assert.ok(
      !page.name.includes('/Users/') && !page.name.includes('"/'),
      `Local path used as public name: ${page.name}`,
    );
    assert.ok(
      page.members.every((member) => !member.includes('__@')),
      `Internal compiler symbol used as a public member: ${page.name}`,
    );
    for (const member of page.members)
      assert.ok(
        html.includes(
          `id="member-${member
            .replace(/[^a-zA-Z0-9_-]+/g, '-')
            .replace(/^-|-$/g, '')
            .toLowerCase()}"`,
        ),
        `Missing member anchor: ${page.name}.${member} (${locale})`,
      );
  }
}
for (const article of ['design', 'mechanism', 'first-app']) {
  for (const locale of ['zh', 'en']) {
    const html = await readFile(path.join(siteOutputRoot, locale, `guide/${article}.html`), 'utf8');
    assert.ok(
      html.includes('TypeScript') || html.includes('app.ts'),
      `Article missing TS examples: ${article} (${locale})`,
    );
    assert.ok(
      html.includes('JavaScript') || html.includes('app.mjs'),
      `Article missing JS examples: ${article} (${locale})`,
    );
  }
}
const firstApp = await readFile(path.join(siteOutputRoot, 'zh/guide/first-app.html'), 'utf8');
assert.ok(
  firstApp.includes('NestJS') && firstApp.includes('Node'),
  'Host integration examples are missing',
);
const firstAppEnglish = await readFile(
  path.join(siteOutputRoot, 'en/guide/first-app.html'),
  'utf8',
);
assert.ok(
  firstAppEnglish.includes('NestJS') && firstAppEnglish.includes('Node'),
  'English host integration examples are missing',
);
const rootEntry = await readFile(path.join(siteOutputRoot, 'index.html'), 'utf8');
assert.ok(
  rootEntry.includes('auto-lang.js'),
  'Root path must include the browser-language entry script',
);
assert.ok(
  !rootEntry.includes('VPHero'),
  'Root path must not render a language home page; it is only an entry',
);
assert.ok(
  !files.some((filename) => /\.(?:md|mts|mjs|ts|vue)$/.test(filename)),
  'Website source leaked into static output',
);
assert.ok(
  !(await exists(path.join(siteOutputRoot, 'declarations'))),
  'Raw declaration pages must not be published',
);
assert.ok(
  !(await exists(path.join(sdkRoot, 'development/site'))),
  'Website output must not be inside the SDK',
);
const pkg = JSON.parse(await readFile(path.join(sdkRoot, 'package.json'), 'utf8'));
assert.equal(report.version, pkg.version, 'Generated API catalog has an outdated SDK version');
assert.equal(shippedCatalog.version, pkg.version, 'Website has an outdated SDK version');
assert.deepEqual(
  [...pkg.files].sort(),
  [
    'dist',
    'skills',
    'development/docs',
    'development/articles',
    'development/skills',
    'development/scripts/workflow-inspector',
    'development/scripts/workflow-diff',
    'development/scripts/workflow-scenarios',
    'development/examples/workflow-inspection.mjs',
    'development/examples/workflow-scenarios.mjs',
    'development/examples/harness-composition.mjs',
    'development/examples/harness-composition.md',
    'development/examples/harness-composition.en.md',
    'development/examples/harness-parallel.mjs',
    'development/examples/harness-parallel.md',
    'development/examples/harness-parallel.en.md',
    'development/examples/harness-durable.mjs',
    'development/examples/harness-durable.md',
    'development/examples/harness-durable.en.md',
    'development/examples/harness-handler-comparison.mjs',
    'development/examples/harness-handler-comparison.md',
    'development/examples/harness-handler-comparison.en.md',
    'development/examples/model-protocols.mjs',
    'development/examples/model-lifecycles.mjs',
    'development/examples/collaboration-probe.mjs',
    'CHANGELOG.md',
    'LICENSE',
    'NOTICE',
  ].sort(),
  'SDK distribution boundary differs',
);

// Load the exact serialized browser index, not a second hand-built search corpus.
const requireFromVitePress = createRequire(import.meta.resolve('vitepress/package.json'));
const MiniSearch = requireFromVitePress('minisearch');
async function loadIndex(locale) {
  const indexFile = files.find(
    (filename) =>
      path.basename(filename).startsWith(`@localSearchIndex${locale}.`) && filename.endsWith('.js'),
  );
  assert.ok(indexFile, `Browser-local search index was not built for ${locale}`);
  const source = ts.createSourceFile(
    indexFile,
    await readFile(indexFile, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const literal = source.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => statement.declarationList.declarations)
    .map((declaration) => declaration.initializer)
    .find((node) => node && ts.isStringLiteralLike(node));
  assert.ok(literal, `Cannot locate the VitePress search payload for ${locale}`);
  return JSON.parse(literal.text);
}
const searchQueries = {
  zh: ['AgentCoreEngine', 'toIfEqualWith', '预算', '压缩', 'NestJS', '工作流检查器'],
  en: ['AgentCoreEngine', 'toIfEqualWith', 'budget', 'Workflow', 'NestJS', 'workflow inspector'],
};
let browserSearchDocuments = 0;
for (const [locale, lang] of [
  ['zh', 'zh-CN'],
  ['en', 'en-US'],
]) {
  const payload = await loadIndex(locale);
  const search = MiniSearch.loadJS(payload, {
    fields: ['title', 'titles', 'text'],
    storeFields: ['title', 'titles'],
    tokenize: (text) =>
      Array.from(new Intl.Segmenter(lang, { granularity: 'word' }).segment(text), (part) =>
        part.segment.toLowerCase(),
      ).filter((term) => /[\p{L}\p{N}_]/u.test(term)),
    searchOptions: { prefix: true, fuzzy: 0.15 },
  });
  browserSearchDocuments += search.documentCount;
  for (const query of searchQueries[locale])
    assert.ok(search.search(query).length, `Local search (${locale}) has no result for ${query}`);
}
const relative = (filename) => path.relative(siteOutputRoot, filename).split(path.sep).join('/');
const localizedPages = files
  .filter((filename) => filename.endsWith('.html'))
  .map(relative)
  .filter((filename) => filename.startsWith('zh/'));
const englishPages = files
  .filter((filename) => filename.endsWith('.html'))
  .map(relative)
  .filter((filename) => filename.startsWith('en/'));
assert.deepEqual(
  englishPages.sort(),
  localizedPages.map((filename) => 'en/' + filename.slice(3)).sort(),
  'Chinese and English page sets differ: languages must stay in sibling directories',
);
const rootPages = files
  .filter((filename) => filename.endsWith('.html'))
  .map(relative)
  .filter((filename) => !filename.startsWith('zh/') && !filename.startsWith('en/'));
assert.deepEqual(
  rootPages.sort(),
  ['404.html', 'index.html'],
  'Only the English home page and 404 may live at the site root',
);
// Mermaid's sanitizer needs a DOM even for grammar parsing. This is an isolated
// in-memory DOM, not a browser preview, SVG rendering, or network request.
const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
let diagramCount = 0;
try {
  const requireFromApp = createRequire(pathToFileURL(path.join(siteRoot, 'package.json')));
  const { default: mermaid } = await import(pathToFileURL(requireFromApp.resolve('mermaid')));
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
  for (const filename of [
    path.join(siteRoot, 'content/guide/design.md'),
    path.join(siteRoot, 'content/guide/mechanism.md'),
    path.join(siteRoot, 'content/guide/design.en.md'),
    path.join(siteRoot, 'content/guide/mechanism.en.md'),
    path.join(sdkRoot, 'development/docs/mechanisms.md'),
    path.join(sdkRoot, 'development/docs/mechanisms.en.md'),
  ]) {
    for (const match of (await readFile(filename, 'utf8')).matchAll(
      /```mermaid\s*\n([\s\S]*?)```/g,
    )) {
      await mermaid.parse(match[1]);
      diagramCount++;
    }
  }
} finally {
  dom.window.close();
  delete globalThis.window;
  delete globalThis.document;
}
for (const filename of files.filter((file) => file.endsWith('.html'))) {
  const html = await readFile(filename, 'utf8');
  for (const [, target] of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    if (/^(?:[a-z]+:|\/\/)/i.test(target)) continue;
    const url = new URL(
      target,
      'https://docs.invalid' + '/' + path.relative(siteOutputRoot, filename),
    );
    const base = siteBase;
    if (!url.pathname.startsWith(base)) continue;
    const relative = decodeURIComponent(url.pathname.slice(base.length));
    const destination = path.join(
      siteOutputRoot,
      relative,
      url.pathname.endsWith('/') ? 'index.html' : '',
    );
    assert.ok(
      await exists(destination),
      `Broken static asset/link: ${path.relative(siteOutputRoot, filename)} -> ${target}`,
    );
  }
}
console.log(
  JSON.stringify(
    {
      sdkVersion: shippedCatalog.version,
      modules: report.exportedModules,
      symbols: report.publicSymbols,
      members: report.publicMembers,
      recipes: report.recipes,
      policies: report.policies,
      htmlPages: files.filter((file) => file.endsWith('.html')).length,
      browserSearchDocuments,
      searchQueries,
      locales: ['zh', 'en'],
      diagrams: diagramCount,
      base: process.env.AGENT_CORE_DOCS_BASE ?? '/',
      sdkWebsiteOutput: false,
      sourceSha256: report.sourceSha256,
    },
    null,
    2,
  ),
);

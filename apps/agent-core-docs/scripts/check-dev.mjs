// Agent Core 文档站的开发态检查：在临时目录以 middleware 模式启动 VitePress，
// 校验 Mermaid 组件确实走预构建缓存且可解析，不监听端口、不打开浏览器、不动运行中的开发缓存。
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, symlink, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { outputRoot, siteRoot, contentRoot } from './paths.mjs';

// Exercise VitePress's actual dev plugins and import analysis, without opening
// a port or browser, and without touching a running dev server's optimizer cache.
const requireFromSite = createRequire(path.join(siteRoot, 'package.json'));
const { createServer } = await import(pathToFileURL(requireFromSite.resolve('vitepress')));
await mkdir(outputRoot, { recursive: true });
const testRoot = await mkdtemp(path.join(outputRoot, 'dev-check-'));
const cacheDir = path.join(testRoot, 'cache');
let server;
let dom;
try {
  await mkdir(path.join(testRoot, '.vitepress'));
  await writeFile(
    path.join(testRoot, '.vitepress/config.mts'),
    `
import source from ${JSON.stringify(path.join(siteRoot, '.vitepress/config.mts'))};
export default async () => {
  const config = await source();
  config.cacheDir = ${JSON.stringify(cacheDir)};
  return config;
};
`,
  );
  await symlink(
    path.join(siteRoot, '.vitepress/theme'),
    path.join(testRoot, '.vitepress/theme'),
    'dir',
  );
  server = await createServer(testRoot, { middlewareMode: true, hmr: false, ws: false });
  assert.equal(server.httpServer, null, 'The dev check must not listen on a port');
  assert.equal(server.config.server.ws, false, 'The dev check must not open a WebSocket port');
  assert.equal(server.config.server.watch, null, 'Generated content must not enter VitePress HMR');
  assert.equal(
    server.config.root,
    path.resolve(contentRoot),
    'Check the real generated-content root',
  );

  const client = path.join(
    path.dirname(requireFromSite.resolve('vitepress/package.json')),
    'dist/client/app/index.js',
  );
  const clientModule = await server.transformRequest('/@fs/' + client);
  const componentUrl = clientModule?.code.match(/import\s+Mermaid\s+from\s+["']([^"']+)["']/)?.[1];
  assert.ok(componentUrl, 'VitePress did not register the Mermaid component');
  const componentModule = await server.transformRequest(componentUrl);
  const helperUrl = componentModule?.code.match(
    /from\s+["']([^"']+\/mermaid\.ts(?:\?[^"']*)?)["']/,
  )?.[1];
  assert.ok(helperUrl, 'The actual Mermaid helper import is missing');
  const transformed = await server.transformRequest(helperUrl);
  assert.ok(transformed, 'Mermaid helper was not transformed by VitePress');
  const imported = transformed.code.match(/import\s+mermaid\s+from\s+["']([^"']+)["']/)?.[1];
  assert.ok(imported, 'The actual Mermaid import is missing');
  assert.ok(
    imported.includes('/cache/deps/mermaid.js'),
    `Mermaid bypassed prebundling: ${imported}`,
  );
  assert.ok(!transformed.code.includes('/fastdom/fastdom.js'), 'Raw CommonJS reached the browser');
  const optimized = await server.transformRequest(imported);
  assert.ok(optimized, 'The optimized Mermaid module is not loadable');

  const optimizedFile = path.resolve('/', decodeURI(imported.split('?')[0].slice('/@fs/'.length)));
  assert.ok(optimizedFile.startsWith(cacheDir + path.sep), 'Use the isolated dev cache');
  const metadataFile = path.join(cacheDir, 'deps/_metadata.json');
  const metadata = JSON.parse(await readFile(metadataFile, 'utf8'));
  assert.equal(
    path.resolve(path.dirname(metadataFile), metadata.optimized.mermaid.src),
    requireFromSite.resolve('mermaid'),
    "The optimizer must use the app's actual Mermaid package",
  );
  // Import exactly the module served to the browser. Native ESM linking detects
  // missing default exports; parsing also exercises Mermaid's dynamic chunks.
  dom = new JSDOM('<!doctype html><html><body></body></html>');
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  const { default: mermaid } = await import(pathToFileURL(optimizedFile));
  assert.equal(typeof mermaid.initialize, 'function');
  assert.equal(typeof mermaid.render, 'function');
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
  await mermaid.parse('flowchart LR\n  Input --> Agent --> Output');
  await mermaid.parse('sequenceDiagram\n  App->>Core: run\n  Core-->>App: result');
  console.log(
    JSON.stringify(
      {
        check: 'VitePress dev imports',
        mermaid: requireFromSite.resolve('mermaid'),
        optimized: true,
        diagrams: 2,
        networkListener: false,
      },
      null,
      2,
    ),
  );
} finally {
  dom?.window.close();
  delete globalThis.window;
  delete globalThis.document;
  await server?.close();
  await rm(testRoot, { recursive: true, force: true });
}

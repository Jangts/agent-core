/**
 * 文档站热重载检查的子进程：在隔离目录复制页面、启动无监听的 VitePress
 * 中间件服务，验证本地搜索索引、Markdown 高亮与实际页面模块都能在重载后编译。
 * 由 check-reload.mjs 拉起并通过 IPC 回报统计，避免污染主进程的模块缓存。
 */
import assert from 'node:assert/strict';
import { cp, mkdir, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { createServer, createMarkdownRenderer } from 'vitepress';

const [root, sourceRoot] = process.argv.slice(2);
const requireFromVitePress = createRequire(import.meta.resolve('vitepress/package.json'));
const MiniSearch = requireFromVitePress('minisearch');
let server;
try {
  const pages = path.join(root, 'pages');
  // 每次检查前重建副本，确保验证的是当前源文件而不是上次残留。
  await rm(path.join(root, 'pages'), { recursive: true, force: true });
  await mkdir(pages, { recursive: true });
  await cp(sourceRoot, pages, { recursive: true });
  // 关闭 HMR 与文件监听，只保留中间件请求处理，避免子进程持有真实端口。
  server = await createServer(root, { middlewareMode: true, hmr: false, ws: false, watch: null });
  assert.equal(server.httpServer, null);
  // 搜索索引由虚拟模块提供；完整站点读取中文语言索引，小型隔离用例读取根索引。
  const localeKey = process.argv.includes('--full') ? 'zh' : 'root';
  const loaded = await server.pluginContainer.load(`/@localSearchIndex${localeKey}`);
  const code = typeof loaded === 'string' ? loaded : loaded.code;
  const serialized = JSON.parse(code.replace(/^export default\s+/, '').replace(/;\s*$/, ''));
  const index = MiniSearch.loadJSON(serialized, {
    fields: ['title', 'titles', 'text'],
    storeFields: ['title', 'titles'],
  });
  const ids = Object.values(JSON.parse(serialized).documentIds);
  // 同一文档 ID 不能重复，否则搜索结果会指向错误页面。
  assert.equal(ids.length, new Set(ids).size);
  // 完整站点中所有页面位于 /zh 或 /en；小型隔离用例仍使用根路径。
  const locale = process.argv.includes('--full') ? '/zh' : '';
  assert.ok(ids.includes(`${locale}/api/core/common/agenterrorinfo.html#agenterrorinfo`));
  const md = await createMarkdownRenderer(path.join(root, 'pages'));
  // Shiki 走按需加载，重载后仍需可用，否则代码块会退化成纯文本。
  const highlighted = md.render('# Highlight\n\n```ts\nconst value: string = "ready";\n```');
  assert.ok(highlighted.includes('shiki'), 'Shiki is not usable after reload');
  const page = process.argv.includes('--full')
    ? '/zh/guide/design.md'
    : '/api/core/common/agenterrorinfo.md';
  // 真正编译一个 Markdown 模块，确认重载后转换链没有失效。
  const transformed = await server.transformRequest(page);
  assert.ok(transformed?.code.includes('__pageData'), 'The actual Markdown module did not compile');
  const close = () => {
    void server.close().then(() => process.exit(0));
  };
  process.on('message', (message) => {
    if (message === 'quit') close();
  });
  process.once('SIGTERM', close);
  // 用 IPC 回报关键统计；父进程据此判断索引与高亮是否可用。
  process.send({
    pid: process.pid,
    documentCount: index.documentCount,
    highlighted: true,
    alpha: index.search('alphaupdate').length,
    beta: index.search('betaupdate').length,
    extra: index.search('ExtraPage').length,
  });
} catch (error) {
  console.error(error);
  await server?.close();
  process.exit(1);
}

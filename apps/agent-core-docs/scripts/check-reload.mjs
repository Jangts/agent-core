// Agent Core 文档站的开发重启检查：用真实文件写入与独立 VitePress worker 验证变更合并、
// 增量生成、页面删除、退出清理与搜索索引更新；全部以 middleware 模式运行，不监听端口。
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { EventEmitter, once } from 'node:events';
import { cp, mkdir, mkdtemp, rm, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as pause } from 'node:timers/promises';
import { startDocsDevelopment } from './dev.mjs';
import { outputRoot, contentRoot } from './paths.mjs';

// Real filesystem bursts and real VitePress/MiniSearch/Shiki workers. All servers
// use middleware mode with WebSockets disabled; no port or browser is opened.
await mkdir(outputRoot, { recursive: true });
const temporary = await mkdtemp(path.join(outputRoot, 'reload-check-'));
const root = path.join(temporary, 'site');
const sources = path.join(temporary, 'sources');
const config = path.join(root, '.vitepress');
const worker = fileURLToPath(new URL('./check-reload-worker.mjs', import.meta.url));
const messages = new EventEmitter();
messages.on('error', () => {});
const errors = [];
const children = [];
const stderr = [];
const full = process.argv.includes('--full');
// 完整站点所有页面位于语言目录下；隔离用例不启用语言配置，仍写入根目录。
const testPage = path.join(
  sources,
  ...(full
    ? ['zh', 'api', 'core', 'common', 'agenterrorinfo.md']
    : ['api', 'core', 'common', 'agenterrorinfo.md']),
);
const extraPage = path.join(sources, ...(full ? ['zh', 'extra.md'] : ['extra.md']));
let development;
function ready() {
  return once(messages, 'ready', { signal: AbortSignal.timeout(full ? 45000 : 20000) }).then(
    ([message]) => message,
  );
}
const page = (word) =>
  '# AgentErrorInfo\n\n' + word + '\n\n```ts\nconst error: string = "example";\n```\n';
try {
  await mkdir(config, { recursive: true });
  await mkdir(path.dirname(testPage), { recursive: true });
  if (full) await cp(contentRoot, sources, { recursive: true });
  await writeFile(testPage, page('baseline'));
  const mermaid = fileURLToPath(import.meta.resolve('vitepress-plugin-mermaid'));
  await writeFile(
    path.join(config, 'config.mts'),
    `import { withMermaid } from ${JSON.stringify(mermaid)};
  export default withMermaid({
    srcDir: 'pages', cacheDir: ${JSON.stringify(path.join(root, 'cache'))}, useWebFonts: false,
    ${
      full
        ? `locales: {
      en: { label: 'English', lang: 'en-US', link: '/en/' },
      zh: { label: '简体中文', lang: 'zh-CN', link: '/zh/' },
    },`
        : ''
    }
    markdown: { theme: { light: 'github-light', dark: 'github-dark' } },
    themeConfig: { search: { provider: 'local' } },
    mermaid: { securityLevel: 'strict', htmlLabels: false, startOnLoad: false },
  });`,
  );
  const initialReady = ready();
  development = await startDocsDevelopment({
    inputs: [{ directory: sources }, { directory: config }],
    delay: 100,
    onError: (error) => {
      errors.push(error.message);
      messages.emit('error', error);
    },
    launch() {
      for (const previous of children)
        assert.ok(
          previous.exitCode !== null || previous.signalCode !== null,
          'A new VitePress process started before the previous one exited',
        );
      const child = spawn(process.execPath, [worker, root, sources, ...(full ? ['--full'] : [])], {
        stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
      });
      child.stderr.on('data', (data) => stderr.push(String(data)));
      child.on('message', (message) => messages.emit('ready', message));
      children.push(child);
      return child;
    },
  });
  const initial = await initialReady;
  await pause(250);
  assert.equal(children.length, 1, 'Vite config temporary files caused a restart loop');

  const updatedReady = ready();
  for (let i = 0; i < 6; i++) await writeFile(testPage, page('alphaupdate'));
  await writeFile(extraPage, '# ExtraPage\n\nAn additional API page.\n');
  const updated = await updatedReady;
  await pause(250);
  assert.equal(children.length, 2, 'A change burst was not coalesced into one restart');
  assert.ok(updated.alpha > 0 && updated.extra > 0);
  assert.ok(updated.documentCount > initial.documentCount);

  const removedReady = ready();
  await unlink(extraPage);
  for (let i = 0; i < 6; i++) await writeFile(testPage, page('betaupdate'));
  const removed = await removedReady;
  await pause(250);
  assert.equal(children.length, 3);
  assert.ok(removed.beta > 0);
  assert.equal(removed.alpha, 0);
  assert.equal(removed.extra, 0);
  assert.equal(removed.documentCount, initial.documentCount);
  assert.equal(new Set([initial.pid, updated.pid, removed.pid]).size, 3);
  assert.ok([initial, updated, removed].every((result) => result.highlighted));
  const exited = once(children.at(-1), 'close');
  children.at(-1).send('quit');
  await exited;
  await writeFile(testPage, page('afterquit'));
  await pause(250);
  assert.equal(children.length, 3, 'A normal quit left a background source watcher running');
  assert.deepEqual(errors, []);
  assert.ok(
    !/duplicate ID|has been disposed|restart failed/.test(stderr.join('')),
    stderr.join(''),
  );
  console.log(
    JSON.stringify(
      {
        scope: full ? 'full generated website' : 'isolated fixture',
        initialDocuments: initial.documentCount,
        generations: children.length,
        coalescedBursts: 2,
        searchUpdatesAndRemoval: 'passed',
        highlighter: 'passed',
        quitCleanup: 'passed',
        networkListener: false,
      },
      null,
      2,
    ),
  );
} finally {
  await development?.close();
  await rm(temporary, { recursive: true, force: true });
}

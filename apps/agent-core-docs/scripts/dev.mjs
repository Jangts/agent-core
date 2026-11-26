// Agent Core 文档站的本地开发编排：监听站点、SDK 源码与手册变化，每次生成都先停止
// 上一代 VitePress 进程再重启，避免 HMR 与生成内容互相覆盖；也作为 check-reload 的被测入口。
import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { siteRoot, sdkRoot, articleSourceRoot, workspaceRoot } from './paths.mjs';
const directories = [
  ...['.vitepress', 'content', 'src', 'scripts'].map((name) => path.join(siteRoot, name)),
  path.join(sdkRoot, 'src'),
  path.join(sdkRoot, 'development/docs'),
  articleSourceRoot,
  path.join(sdkRoot, 'development/skills'),
];
const sources = [
  ...directories.map((directory) => ({ directory, recursive: true })),
  ...[siteRoot, sdkRoot].map((directory) => ({
    directory,
    recursive: false,
    accepts: (filename) => ['package.json', 'tsconfig.json'].includes(filename),
  })),
  {
    directory: workspaceRoot,
    recursive: false,
    accepts: (filename) => filename === 'package-lock.json',
  },
];

function launchVitePress() {
  const require = createRequire(import.meta.url);
  const cli = path.join(
    path.dirname(require.resolve('vitepress/package.json')),
    'bin/vitepress.js',
  );
  return spawn(
    process.execPath,
    [cli, 'dev', siteRoot, '--host', '127.0.0.1', ...process.argv.slice(2)],
    { cwd: siteRoot, stdio: 'inherit' },
  );
}

const ignored = (filename) =>
  filename.includes('.timestamp-') || path.basename(filename) === '.DS_Store';

async function sourceRevision(inputs) {
  const files = [];
  async function collect(directory, recursive, accepts, prefix = '') {
    const entries = await readdir(directory, { withFileTypes: true }).catch((error) => {
      if (error.code === 'ENOENT') return [];
      throw error;
    });
    await Promise.all(
      entries.map(async (entry) => {
        const relative = path.join(prefix, entry.name);
        const filename = path.join(directory, entry.name);
        if (ignored(relative)) return;
        if (entry.isDirectory()) {
          if (recursive) await collect(filename, true, accepts, relative);
        } else if (!accepts || accepts(relative)) {
          const info = await stat(filename, { bigint: true }).catch((error) => {
            if (error.code === 'ENOENT') return;
            throw error;
          });
          if (info) files.push(`${filename}:${info.ino}:${info.mtimeNs}:${info.size}`);
        }
      }),
    );
  }
  await Promise.all(
    inputs.map((input) => collect(input.directory, input.recursive !== false, input.accepts)),
  );
  return files.sort().join('\n');
}

// Each generation owns a fresh VitePress index and Shiki instance. Stop the
// previous process before generating pages; never restart the inner Vite server.
/**
 * 启动文档站开发循环：监听 source 变化，生成内容后以独立 VitePress 进程提供预览。
 * 每次变更先关闭上一代进程再生成，保证索引与高亮实例不复用旧内容。
 * @param {object} [options] 开发可选配置。
 * @param {() => import('node:child_process').ChildProcess} [options.launch] 启动 VitePress 的方式，测试可替换为受控子进程。
 * @param {readonly { directory: string, recursive?: boolean, accepts?: (filename: string) => boolean }[]} [options.inputs] 监听目录及文件过滤规则，默认为站点与 SDK 源码。
 * @param {number} [options.delay] 变更合并窗口（毫秒），避免逐次写入触发多次重启。
 * @param {(error: Error) => void} [options.onError] 监听、生成或子进程异常的接收回调。
 * @returns {{ close: () => Promise<void> }} 关闭监听并等待当前子进程退出。
 */
export async function startDocsDevelopment({
  launch = launchVitePress,
  inputs = sources,
  delay = 400,
  onError = (error) => console.error('[agent-core-docs]', error),
} = {}) {
  let current;
  let timer;
  let draining;
  let pending = false;
  let closed = false;
  let closing;
  let revision;
  const watchers = [];

  function start() {
    const child = launch();
    const entry = { child, stopping: false };
    entry.exited = new Promise((resolve) =>
      child.once('close', (code, signal) => {
        if (!entry.stopping && !closed) {
          if (code === 0) void close().catch(onError);
          else
            onError(
              new Error(`VitePress exited (${signal ?? code}); waiting for a source change.`),
            );
        }
        resolve();
      }),
    );
    child.on('error', onError);
    current = entry;
  }

  async function stop() {
    const entry = current;
    current = undefined;
    if (!entry) return;
    entry.stopping = true;
    if (entry.child.exitCode === null && entry.child.signalCode === null)
      entry.child.kill('SIGTERM');
    await entry.exited;
  }

  function drain() {
    if (draining) return draining;
    draining = (async () => {
      while (pending && !closed) {
        pending = false;
        const next = await sourceRevision(inputs);
        if (next === revision) continue;
        await stop();
        if (closed) break;
        // Changes received while closing are included in the next generation.
        revision = await sourceRevision(inputs);
        pending = false;
        clearTimeout(timer);
        start();
      }
    })().finally(() => {
      draining = undefined;
    });
    return draining;
  }

  function changed(filename, accepts) {
    if (closed || !filename) return;
    filename = String(filename);
    // Vite bundles its config into a temporary module during each startup.
    if (ignored(filename) || (accepts && !accepts(filename))) return;
    pending = true;
    clearTimeout(timer);
    timer = setTimeout(() => {
      void drain().catch(onError);
    }, delay);
  }

  try {
    for (const { directory, recursive = true, accepts } of inputs) {
      const watcher = watch(directory, { recursive }, (_event, filename) =>
        changed(filename, accepts),
      );
      watcher.on('error', onError);
      watchers.push(watcher);
    }
    revision = await sourceRevision(inputs);
    start();
  } catch (error) {
    for (const watcher of watchers) watcher.close();
    throw error;
  }

  function close() {
    return (closing ??= (async () => {
      closed = true;
      pending = false;
      clearTimeout(timer);
      for (const watcher of watchers) watcher.close();
      await draining;
      await stop();
    })());
  }
  return { close };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const development = await startDocsDevelopment();
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.once(signal, () => {
      void development.close().then(
        () => process.exit(0),
        (error) => {
          console.error(error);
          process.exit(1);
        },
      );
    });
}

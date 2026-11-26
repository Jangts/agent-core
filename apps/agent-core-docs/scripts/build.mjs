// 双语文档站的构建入口：VitePress 需要同时打包两套语言的全部页面，
// 默认 4GB 堆在服务端打包阶段会耗尽，因此固定提高 Node 堆上限后再启动官方 CLI。
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const cli = path.join(path.dirname(require.resolve('vitepress/package.json')), 'bin/vitepress.js');
const siteRoot = fileURLToPath(new URL('..', import.meta.url));

const child = spawn(process.execPath, ['--max-old-space-size=8192', cli, 'build', '.'], {
  cwd: siteRoot,
  stdio: 'inherit',
});
child.on('error', (error) => {
  console.error(error);
  process.exit(1);
});
child.on('close', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
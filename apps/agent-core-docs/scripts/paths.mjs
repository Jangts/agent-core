// Agent Core 文档站的公共路径与命名工具：集中定义站点、SDK、输出目录的位置，
// 并提供 POSIX 路径与 URL 片段转换，避免各脚本各写一套相对路径推导。
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/** 文档站根目录（apps/agent-core-docs），用于定位 .vitepress、content 与 package.json。 */
export const siteRoot = fileURLToPath(new URL('../', import.meta.url));
/** 仓库根目录，供脚本读取 packages/、.tmp/ 等 workspace 级路径。 */
export const workspaceRoot = path.resolve(siteRoot, '../..');
/** Agent Core 项目根目录，公开 API 抽取与手册读取都基于它。 */
export const sdkDirectory = 'packages/agent-core';
export const sdkRoot = path.join(workspaceRoot, sdkDirectory);
/** SDK 技术文章源稿目录。 */
export const articleSourceRoot = path.join(sdkRoot, 'development/article-sources');
// VitePress dev regenerates on source changes. Its snapshot and optimizer must
// never replace the files being read by an independent static build.
export const outputRoot = path.join(
  workspaceRoot,
  '.tmp/agent-core-docs',
  ...(process.argv[2] === 'dev' ? ['development'] : []),
);
/** 生成站点 dist 目录：check.mjs 在此校验产物与资源引用。 */
export const siteOutputRoot = path.join(siteRoot, 'dist');
/** 生成 Markdown 内容根目录（outputRoot/content），VitePress 以此为实际内容源。 */
export const contentRoot = path.join(outputRoot, 'content');
/**
 * 把当前平台的路径分隔符统一换成 `/`，用于生成跨平台一致的文档 URL 与路径键。
 * @param {string} value 待转换的路径。
 * @returns {string} 使用 `/` 分隔的路径。
 */
export const posix = (value) => value.split(path.sep).join('/');
/**
 * 生成适合作为 URL 片段或文件名的小写 slug：非字母数字字符折叠为 `-`，并去掉首尾连接符。
 * @param {string} value 原始名称或路径。
 * @returns {string} 仅含小写字母、数字、`_` 与 `-` 的片段。
 */
export const slug = (value) =>
  value
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

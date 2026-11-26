// 语言路由映射：各语言位于同级目录（/en/ 与 /zh/）；根路径直接渲染英文首页。
// 站点配置、head 链接与导航切换组件共用本文件，避免各自维护一套路径规则。

/** @type {readonly string[]} */
export const localeIds = ['zh', 'en'];

/**
 * 取得页面所属语言。根路径的英文首页副本（index.md）按英文处理。
 * @param {string} relativePath 相对 srcDir 的 Markdown 路径，例如 en/guide/design.md。
 * @returns {'zh' | 'en'} 中文或英文。
 */
export function localeOfPath(relativePath) {
  return relativePath.startsWith('zh/') ? 'zh' : 'en';
}

/**
 * 把相对 Markdown 路径转换为静态站点路由，保留语言目录（/en/、/zh/）。
 * @param {string} relativePath 相对 srcDir 的 Markdown 路径。
 * @returns {string} 以 / 开头、带 .html（目录首页除外）的路由。
 */
export function routeFromRelative(relativePath) {
  const withoutExtension = relativePath.replace(/\.md$/, '');
  const trimmed = withoutExtension.replace(/(^|\/)index$/, '$1');
  if (!trimmed) return '/';
  return trimmed.endsWith('/') ? '/' + trimmed : '/' + trimmed + '.html';
}

/**
 * 计算同一页面在两种语言中的路由。
 * @param {string} relativePath 当前页面相对 srcDir 的 Markdown 路径。
 * @returns {{ zh: string, en: string }} 中文与英文路由。
 */
export function alternateRoutes(relativePath) {
  const rest = relativePath.replace(/^(?:en|zh)\//, '');
  return {
    zh: routeFromRelative('zh/' + rest),
    en: routeFromRelative('en/' + rest),
  };
}
// 读取 content/recipes/en 下的英文配方说明。覆盖表以 recipe id 为键，只包含正文与策略标题；
// 示例代码、matches 和 layer 仍以中文源模块为唯一来源，生成器负责逐项校验对应关系。
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { siteRoot } from './paths.mjs';

/**
 * 加载全部英文配方覆盖表。
 * @returns {Promise<Map<string, object>>} recipe id 到英文说明的映射。
 * @throws {Error} 两个文件声明同一 recipe id 时抛出。
 */
export async function readRecipeTranslations() {
  const directory = path.join(siteRoot, 'content/recipes/en');
  const entries = (await readdir(directory).catch(() => []))
    .filter((name) => name.endsWith('.en.mjs'))
    .sort();
  const translations = new Map();
  for (const entry of entries) {
    const filename = path.join(directory, entry);
    const module = await import(`${new URL('file:' + filename).href}?snapshot=${Date.now()}`);
    for (const [id, value] of Object.entries(module.default ?? {})) {
      if (translations.has(id))
        throw new Error(`Duplicate English recipe translation: ${id} (${entry})`);
      translations.set(id, { ...value, source: entry });
    }
  }
  return translations;
}

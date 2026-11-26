import reviewAndLifecycle from './kit-review-and-lifecycle.mjs';
/**
 * Kit 示例聚合入口：把按能力拆分的示例模块合并为一份有序清单。
 * 文档生成脚本通过本文件读取 Kit 配方，拆文件仅为便于维护，
 * 不在站点导航中单独出现。
 */
import processing from './kit-processing.mjs';
import knowledge from './kit-knowledge.mjs';
import catalogs from './kit-catalogs.mjs';
import search from './kit-search.mjs';
import stateAndMock from './kit-state-and-mock.mjs';
import { kitRecipes } from './advanced-agents.mjs';
import { memoryRecipes } from './memory-and-replies.mjs';

export default [
  ...reviewAndLifecycle,
  // 顺序决定生成页面中的示例排列，保持 Kit 主题从资料、目录到运行能力。
  ...knowledge,
  ...memoryRecipes,
  ...catalogs,
  ...processing,
  ...search,
  ...stateAndMock,
  ...kitRecipes,
];

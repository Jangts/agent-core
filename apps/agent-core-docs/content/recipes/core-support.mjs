import modelLifecycles from './model-lifecycles.mjs';
// Agent Core 文档站配方总汇：按 Core 执行、模型、策略、Support、Core 扩展与高级场景顺序
// 拼接为一份数组，作为 /recipes 页面与符号页关联示例的唯一来源。
import decorators from './decorators.mjs';
import reliability from './reliability.mjs';
import execution from './core-execution.mjs';
import model from './core-model.mjs';
import strategies from './model-strategies.mjs';
import support from './support-recipes.mjs';
import extras from './core-extras.mjs';
import { supportRecipes } from './advanced-agents.mjs';
import { replyRecipes } from './memory-and-replies.mjs';

// Editorial explanations complement the generated declarations; they are not a second API inventory.
export default [
  ...modelLifecycles,
  ...execution,
  ...model,
  ...strategies,
  ...support,
  ...replyRecipes,
  ...extras,
  ...supportRecipes,
  ...decorators,
  ...reliability,
];

// Reading groups only: these do not define or modify any SDK runtime contract.
// Each group carries both languages so the same source path produces one page set per locale.
const groups = [
  {
    id: 'reliability',
    titles: { zh: '资源与可靠交付', en: 'Resources & reliable delivery' },
    pattern: /budget-assessment|completion\.ts$|support\/recovery\.ts$/,
  },
  {
    id: 'methods',
    titles: { zh: '任务方法', en: 'Task methods' },
    pattern: /\/src\/skills\//,
  },
  {
    id: 'mock',
    titles: { zh: 'MockGPT · 模拟模型与调试', en: 'MockGPT · Mock models & debugging' },
    pattern: /\/mock-gpt\/|\/mock(?:\/|\.ts$)/,
  },
  {
    id: 'result-review',
    titles: { zh: '结果评审与裁决', en: 'Result review & decisions' },
    pattern: /result-review|review-decision|review-choice/,
  },
  {
    id: 'family',
    titles: { zh: '分支与版本管理', en: 'Branches & versioning' },
    pattern: /(?:\/|^)family(?:\.|\/)/,
  },
  {
    id: 'reflection',
    titles: { zh: '日志复盘与证据报告', en: 'Log review & evidence reports' },
    pattern: /reflection/,
  },
  {
    id: 'execution',
    titles: { zh: '执行与工作流', en: 'Execution & workflows' },
    pattern: /execution|workflow/,
  },
  {
    id: 'model',
    titles: { zh: '模型与交互', en: 'Models & interaction' },
    pattern: /model|providers|interaction/,
  },
  {
    id: 'context',
    titles: { zh: '上下文与日志', en: 'Context & journals' },
    pattern: /context|journal/,
  },
  {
    id: 'diagnostics',
    titles: { zh: '过程观察与诊断', en: 'Observation & diagnostics' },
    pattern: /diagnostics|events|(?:\/|^)debug\./,
  },
  {
    id: 'tools',
    titles: { zh: '工具与能力', en: 'Tools & capabilities' },
    pattern: /capabilities|tools/,
  },
  {
    id: 'knowledge',
    titles: { zh: '知识、问答与呈现', en: 'Knowledge, answering & presentation' },
    pattern: /knowledge|answering|presentation/,
  },
  {
    id: 'intents',
    titles: { zh: '意图与范围', en: 'Intents & scopes' },
    pattern: /intents|scopes/,
  },
  {
    id: 'retrieval',
    titles: { zh: '检索与证据', en: 'Retrieval & evidence' },
    pattern: /search|retrieval|fusion|evidence/,
  },
  {
    id: 'artifacts',
    titles: { zh: '产物与恢复', en: 'Artifacts & recovery' },
    pattern: /durable|artifacts|waiting/,
  },
  {
    id: 'transport',
    titles: { zh: '传输与流', en: 'Transport & streaming' },
    pattern: /transport|sse|stream/,
  },
  {
    id: 'configuration',
    titles: { zh: '配置、清单与策略', en: 'Configuration, catalogs & policies' },
    pattern: /schema|registration|catalog|rules|polic/,
  },
];
/**
 * 按源码路径把公开符号归入文档站的分组（mock、family、execution 等），未命中任何规则时归入 common。
 * 仅决定阅读分组与侧边栏，不影响 SDK 运行时合同。
 * @param {string} origin 相对仓库根的源码路径。
 * @returns {{ id: string, titles: { zh: string, en: string } }} 分组标识与两种语言的显示名称。
 */
export const domainOf = (origin) =>
  groups.find((group) => group.pattern.test(origin)) ?? {
    id: 'common',
    titles: { zh: '共同合同与辅助入口', en: 'Shared contracts & helpers' },
  };

/** Order the example catalogue by the guarantees an App needs to verify. */
const resilienceGroups = [
  {
    title: { zh: '请求退化后还能交付什么', en: 'What a degraded request can still deliver' },
    ids: [
      'reliable-completion',
      'attempts-errors',
      'tool-registry',
      'kit-evidence',
      'kit-answer-flow',
    ],
  },
  {
    title: { zh: '预算、上下文与证据范围', en: 'Bound budgets, context, and evidence' },
    ids: [
      'reasonable-budget',
      'model-child',
      'child-composition',
      'prepared-model-call',
      'context-policy',
      'context-selection',
      'kit-retrieval',
      'memory-snapshot-update',
      'memory-source-review',
    ],
  },
  {
    title: { zh: '外部效果、等待与并发', en: 'Reconcile effects, waits, and concurrency' },
    ids: [
      'kit-durable',
      'review-waiting-decision',
      'review-detection-admission',
      'review-choice-binding',
      'branch-settled-aggregation',
      'agent-family',
      'knowledge-publication',
    ],
  },
  {
    title: { zh: '协议故障、观测与回归', en: 'Diagnose protocol faults and regressions' },
    ids: [
      'explicit-model-retry',
      'model-background-batch',
      'model-realtime-session',
      'model-realtime-wire',
      'mock-protocol-lifecycle-catalogs',
      'execution-observation',
      'execution-reflection',
    ],
  },
];

export function groupRecipes(recipes, layers, locale) {
  const remaining = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const resilience = resilienceGroups.map(({ title, ids }) => ({
    title: title[locale],
    recipes: ids.map((id) => {
      const recipe = remaining.get(id);
      if (!recipe) throw new Error(`Unknown or repeated resilience example: ${id}`);
      remaining.delete(id);
      return recipe;
    }),
  }));
  const api = Object.entries(layers)
    .map(([layer, title]) => ({
      title,
      recipes: [...remaining.values()].filter((recipe) => recipe.layer === layer),
      collapsed: true,
    }))
    .filter((group) => group.recipes.length);
  return [...resilience, ...api];
}

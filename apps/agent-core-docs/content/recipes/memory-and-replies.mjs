/** Public examples for memory snapshot boundaries and request-scoped reply guidance. */
export const memoryRecipes = [
  {
    id: 'memory-snapshot-update',
    title: '从已授权来源生成和读取记忆快照',
    layer: 'kit',
    matches: [
      'memoryUpdateInstruction', 'memoryUpdateSchema', 'batchMemorySources',
      'memoryModelView', 'applyMemoryUpdate', 'isMemoryState', 'memoryContext',
    ],
    summary: '分批准备提取输入，校验候选，并只投影当前请求可用的记忆。',
    details: '应用负责来源筛选和语义校验。引文只用于核对用户原文。事务用原快照版本同时更新记忆和处理水位；本例只演示一次已筛选来源的内存变换。',
    examples: [{
      title: '准备提取并处理一个候选偏好',
      level: '基础',
      environment: 'Node.js',
      ts: `import { applyMemoryUpdate, batchMemorySources, isMemoryState, memoryContext,
  memoryModelView, memoryUpdateInstruction, memoryUpdateSchema } from '@jangts/agent-core/kits/memory';

const schema = memoryUpdateSchema(['preference', 'goal']);
const source = { id: 'turn-1', question: 'Please use short replies.', createdAt: 100 };
const previous = undefined;
const batch = batchMemorySources([source], 101).batches[0] ?? [];
const extractionInput = {
  instruction: memoryUpdateInstruction,
  previous: memoryModelView(previous, batch),
  sources: batch,
};
const { operations } = schema.parse({ operations: [{
  action: 'upsert', key: 'reply-length', kind: 'preference', scope: 'account',
  claim: 'Prefer short replies.', sourceId: source.id, quote: source.question, validUntil: null,
}] });
const next = applyMemoryUpdate(previous, operations, extractionInput.sources, 120);
if (!isMemoryState(next)) throw new Error('Invalid memory snapshot');
console.log(memoryContext(next, 'reply', 120).summary);`,
    }],
  },
  {
    id: 'memory-source-review',
    title: '按来源可用性和实际检查结果复核记忆',
    layer: 'kit',
    matches: ['reviewMemorySources', 'memoryReviewBatch', 'completeMemoryReview'],
    summary: '区分可用来源、待复核来源和已经完成的语义检查。',
    details: '应用传入实际查过的来源可用性，再用有界批次安排语义复核。只按已实际验过的来源 ID 记完成。删除或不可用的来源如何影响对外使用，由应用的记忆策略决定。',
    examples: [{
      title: '组装有界复核输入与完成记录',
      level: '配置',
      environment: 'Node.js',
      ts: `import { completeMemoryReview, memoryReviewBatch, reviewMemorySources,
  type MemorySource, type MemoryState } from '@jangts/agent-core/kits/memory';

export async function review(state: MemoryState, sources: readonly MemorySource[],
  checkedAvailability: ReadonlyMap<string, boolean>, reviewDay: number, now: number,
  check: (selected: readonly MemorySource[]) => Promise<readonly string[]>) {
  const updated = reviewMemorySources(state, checkedAvailability, now);
  const selected = memoryReviewBatch(updated, sources, reviewDay);
  const selectedIds = new Set(selected.map(source => source.id));
  const inspectedIds = await check(selected);
  return completeMemoryReview(updated,
    inspectedIds.filter(id => selectedIds.has(id)), reviewDay, now);
}`,
    }],
  },
];

export const replyRecipes = [
  {
    id: 'reply-guidance-for-current-call',
    title: '为当前用户答复选择详略',
    layer: 'support',
    matches: ['resolveReplyGuidance'],
    summary: '由应用选择默认、节点、适用工具和调用配置，将结果传给用户答复调用。',
    details: '工具默认互相冲突时，由调用方明确选择。本例使用固定 Provider 验证接线。真实模型对详略的遵从需要使用真实样本检查。',
    examples: [{
      title: '显式解决适用工具的详略冲突',
      level: '基础',
      environment: 'Node.js',
      ts: `import { ModelRunner, Support } from '@jangts/agent-core';

const replyGuidance = Support.resolveReplyGuidance({
  defaults: { defaultDetail: 'normal' },
  tools: [{ defaultDetail: 'brief' }, { defaultDetail: 'detailed' }],
  call: { defaultDetail: 'detailed' },
});
const runner = new ModelRunner({ provider: { async *stream() { yield 'Verified receipt.'; } } });
const result = await runner.invoke({ input: 'Explain the verified receipt.', replyGuidance });
console.log(replyGuidance?.defaultDetail, result.value);`,
    }],
  },
];

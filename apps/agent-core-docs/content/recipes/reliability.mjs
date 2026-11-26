/** Public reliability examples share the SDK's executable documentation contracts. */
export default [
  {
    id: 'reasonable-budget',
    title: '评估必要工作并调整请求额度',
    layer: 'support',
    matches: [
      'assessModelBudget',
      'BudgetAssessmentInput',
      'BudgetAssessment',
      'RemainingModelWork',
      'ModelRunnerBudgetSnapshot',
      'ModelRunner.adjustCallBudget',
      'ModelRunner.callBudget',
    ],
    summary: '先处理上下文和重复工作，再为必要执行分配合理资源。',
    details:
      '预算评估不调用模型、不授予权限。动态分配保留实际消耗和祖先约束；初始估计不足不直接触发部分交付。',
    examples: [
      {
        title: '纯评估和受控调整',
        level: '基础',
        environment: 'Node.js',
        ts: `import { ModelRunner, Support } from '@jangts/agent-core';
const model = new ModelRunner({ provider: { async *stream() { yield 'done'; } }, maxCalls: 1, maxTotalCalls: 8, execution: { signal: new AbortController().signal } });
const plan = Support.assessModelBudget({ budget: model.callBudget, work: { execution: 2, review: 1, delivery: 1, recovery: 1 } });
if (plan.action === 'expand') model.adjustCallBudget({ limit: plan.suggestedLimit!, reason: plan.reason });
console.log((await model.invoke('request')).value);`,
      },
    ],
  },
  {
    id: 'reliable-completion',
    title: '定向修复与保留已确认的成果',
    layer: 'kit',
    matches: [
      'defineCompletionChecks',
      'CompletionCheck',
      'CompletionDecision',
      'CompletionReport',
      'createRequestRecovery',
      'RequestRecovery',
      'RecoveredResult',
    ],
    summary: '查看必需检查和附属检查怎样影响交付，以及保存后答复失败怎样保留回执。',
    details:
      '业务成果和面向用户的交付分别记录。附属检查失败仍可交付已确认成果。主操作或修复失败时可基于真实回执收束。用户取消传播到外层。',
    examples: [
      {
        title: '保留附属检查错误并接纳主结果',
        level: '基础',
        environment: 'Node.js',
        ts: `import assert from 'node:assert/strict';
import { defineCompletionChecks } from '@jangts/agent-core/kits/completion';

const checks = defineCompletionChecks<{ detail: string }>([
  { id: 'format', required: true, check: ({ detail }) => detail.startsWith('Report: ')
    ? { kind: 'ready' }
    : { kind: 'repair', target: 'format', reason: 'Expected a report detail' } },
  { id: 'audit', required: false, check() { throw new Error('Optional audit unavailable'); } },
]);
const report = await checks.run({ detail: 'Report: report-17' }, new AbortController().signal);
assert.equal(report.decision.kind, 'ready');
assert.equal(report.observations[1].id, 'audit');
assert.ok(report.observations[1].error instanceof Error);`,
      },
      {
        title: '用已确认回执收束答复',
        level: '基础',
        environment: 'Node.js',
        ts: `import assert from 'node:assert/strict';
import { Support } from '@jangts/agent-core';

let writes = 0;
const run = Support.createRequestRecovery<{ receiptId?: string }, string>({
  async execute(record) {
    writes++;
    record.receiptId = 'report-17'; // Receipt from the simulated write port.
    throw new Error('Explanation failed after saving');
  },
  fallback(record) {
    return record.receiptId ? 'Saved ' + record.receiptId : 'Could not confirm saving';
  },
});
const result = await run({}, new AbortController().signal);
assert.equal(result.source, 'fallback');
assert.equal(result.value, 'Saved report-17');
assert.equal(writes, 1);`,
      },
    ],
  },
];

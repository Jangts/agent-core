# 资源、完成检查与请求恢复

Core管理请求计账和执行保证；Support提供可选预算评估与请求恢复；Completion Kit表达应用自己的完成检查和修复方向。不要求所有应用接入统一任务状态框架。

## 动态调用额度

```ts
import { ModelRunner, Support } from '@jangts/agent-core';

const model = new ModelRunner({
  provider: { async *stream() { yield 'A result'; } },
  maxCalls: 2,
  maxTotalCalls: 12,
  execution: { signal: new AbortController().signal },
});
const assessment = Support.assessModelBudget({
  budget: model.callBudget,
  work: { execution: 3, review: 1, delivery: 1, recovery: 1 },
});
if (assessment.action === 'expand') {
  model.adjustCallBudget({ limit: assessment.suggestedLimit!, reason: assessment.reason });
}
const result = await model.invoke({ input: 'Complete the requested task.' });
console.log(result.value, model.callBudget);
```

maxCalls为初始分配，maxTotalCalls为宿主授权的固定上限，默认等于maxCalls。adjustCallBudget同步调整当前请求，不清零已消耗次数，不改变身份、模型窗口、期限或父级预留。新额度须为不小于已消耗且不超过上限的安全整数，reason须为宿主提供的非空原因。callBudget返回分离的只读快照，含limit、ceiling、used、有效remaining及revisions；它不是货币账单。应用将这些事实接入现有诊断，Core不指定存储也不自动采集正文。

共享Runner须先bind再读写请求状态。普通工作流使用context.model.callBudget和context.model.adjustCallBudget；自定义结构运行时可以不实现这些成员，调用不支持的调整会产生工作流合同错误。子运行只能在自己的原始局部上限内调整，不能给祖先扩容。多模型选择也不会将一个模型的额度变成另一个模型的资源，须明确调整当前运行时。

## 评估剩余必要工作

assessModelBudget是纯推荐，不调用模型、不授予权限。work包含剩余执行、必要复核、交付和恢复的调用数，包含工具内与子模型的实际工作。估计可复用业务声明和已经取得的进展，不默认增加模型分类阶段。

| 实际情况 | 推荐动作 |
| --- | --- |
| 用户目标已满足 | deliver，直接交付 |
| 缺少用户信息或授权 | clarify，提出必要问题 |
| 存在真实外部阻塞 | partial，交代已完成部分 |
| 重复工作没有进展 | replan，先修正方案 |
| 上下文有压力且可选择或压缩 | reduce-context，处理后重评 |
| 剩余工作适配当前有效额度 | continue |
| 必要工作超过初始分配但适配授权上限 | expand |
| 输入、分配或方案仍不可行 | replan；只有alternativesExhausted后才partial |

低初始额度不是提前结束可行任务的理由。压缩不能退回已用调用数。先程序投影和成果复用，再按需摘要，保留原文回查、授权、最新纠正和关键事实。上下文缩减与调用扩容是不同决定。任务价值、期限和真实费用约束由应用明确提供。

## 定向完成检查

```ts
import { defineCompletionChecks } from '@jangts/agent-core/kits/completion';

const checks = defineCompletionChecks<{ text: string }>([
  { id: 'profile', required: false, check: () => ({ kind: 'ready' }) },
  { id: 'content', required: true, check: value => value.text.trim()
    ? { kind: 'ready' }
    : { kind: 'repair', target: 'content', reason: 'Compose from existing evidence' } },
]);
const report = await checks.run({ text: 'Confirmed result' }, new AbortController().signal);
console.log(report.decision, report.observations);
```

ready、repair、clarify、partial表达处理结果，不替应用宣称业务成功。repair区分content、format和evidence，应用将结果映射为普通工作流路由。必要拒绝停止后续检查，必要异常保留为恢复边输入；附属拒绝和异常保存在observations中，不否决主结果。取消继续传播。检查尽量无副作用，实际写入由业务通过幂等和真实回执保障。是否必须保存记忆取决于用户任务，不由库全局决定。

## 独立请求恢复

```ts
import { Support } from '@jangts/agent-core';

const run = Support.createRequestRecovery<{ artifacts: string[] }, string>({
  async execute(record) {
    record.artifacts.push('Verified report');
    throw new Error('An execution dependency is unavailable');
  },
  fallback(record) {
    return record.artifacts.length
      ? `Available work: ${record.artifacts.join(', ')}. The remaining part is unresolved.`
      : 'I could not obtain a reliable result this time.';
  },
});
const result = await run({ artifacts: [] }, new AbortController().signal);
console.log(result.source, result.value, result.errors);
```

execute只执行一次。可选recover使用已有工作记录组织说明，恢复失败后进入不依赖模型的同步fallback。方法保留原接收者，返回source区分execution、recovery和fallback，并携带技术错误供应用诊断。恢复不是任务重放，也不代表业务已全部成功；应用自己的fallback再抛错时仍保留失败。

外层signal须仍有效；执行专属超时放在execute内部，避免让过期信号提前取消收尾。用户主动取消不进入恢复或fallback。应用为recover设置合适期限，本辅助不会编造新期限或后台授权。进程退出、网络中断后的交付依靠宿主持久状态和重连查询，不能保证立即投递。结果未知的写入须先对账，不能盲目重试。

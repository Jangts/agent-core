# 多 Agent 结果评审与裁决

结果评审是 App 可选的结果对照能力。Core 继续拥有调用、父子预算与取消保证；App 定义共同决策范围、证据权威性、裁决权、真实授权和原子存储。意见一致不证明事实正确，复核确认只说明在给定条件下存在不一致。

## 从仅检测开始

```ts
import { defineResultReview, checkReviewAdmission } from '@jangts/agent-core/kits/result-review';

const review = defineResultReview<number, {}>({
  detectors: [{
    id: 'values',
    blocking: true,
    candidates: request => [{ id: 'comparison', inputIds: request.inputs.map(input => input.id) }],
    run(candidate, request) {
      const different = new Set(request.inputs.map(input => input.value)).size > 1;
      return {
        complete: true,
        findings: different ? [{
          id: 'different-values', kind: 'value-difference', state: 'confirmed',
          inputIds: candidate.inputIds, evidenceIds: [], reason: 'Values differ.', blocking: true,
        }] : [],
      };
    },
  }],
});
const scope = { id: 'comparison', contentRevision: '1', policyRevision: '1' };
const signal = new AbortController().signal;
const result = await review.inspect({
  scope,
  inputs: [1, 2].map((value, index) => ({
    id: String(index), sourceId: String(index), scopeId: scope.id,
    versions: [], evidenceIds: [], value,
  })),
}, { app: {}, signal });
const admission = checkReviewAdmission({
  result, requiredDetectorIds: ['values'], scopeId: scope.id,
  contentRevision: scope.contentRevision, policyRevision: scope.policyRevision,
});
```

`signal` 是本次调用的取消信号。输入的 `value` 保留业务精确类型；仅检测无需数据库、等待门或持久总账，也不隐式调用模型。检测器和策略方法绑定原接收者，支持普通对象与原型方法。

宿主固定 scope、输入和来源版本；模型不能改名、换条件或伪造引用来缩小检测范围。候选只能引用声明输入，发现只能引用对应候选及输入已有的证据 ID。证据引用存在仍不代表内容真实。版本差异应由 App 的确定性检测器登记，再对齐语义条件；不能因不可比而静默忽略。

## 发现、覆盖与有界复核

`findings` 与 `coverage` 正交：同一结果可以既有确认分歧，也有未检查候选。每个检测器记录 `complete / partial / not-run / failed`、已检查和跳过的候选及停止原因。`maxCandidates` 默认 64，设为 0 会保留跳过覆盖；检测失败不变成无分歧。畸形输出拒绝，取消和超时传播。

语义检测器应使用 App 注入的当前 Runner 或受控 child，沿用共享预算。可信定义可用 `blocking: true` 或同步谓词覆盖模型返回的阻塞标记。检测完成不等于结论正确，模型不得决定真实工具权限。

可选 `strategies` 通过 `when/run` 对指定发现定向复核。`review.resolve(request, result, context, { maxRounds })` 默认每项最多两轮；无新进展标识或进展重复时退出，返回 `resolved / unresolved / needs-answer`，不强制共识。App 还应约束证据读取、总模型额度和时限。

`checkReviewAdmission` 检查 scope、内容及策略修订、必需检测覆盖与阻塞发现。默认全部阻塞发现未解决；只有可信宿主接纳的 `resolvedFindingIds` 才可解除相应阻塞。它是纯预检，不是授权凭据：真实提交仍须原子重验当前版本、覆盖依据、策略及权限。

## 等待答复与继续

`defineReviewDecision` 从 `@jangts/agent-core/kits/review-decision` 导入，关联父任务、争议内容修订、资料版本、策略修订、等待身份、稳定动作 ID 和原始截止时间。传入已有 WaitGate 及 App 的 `authorize/read/accept` 端口。

- `open` 幂等建立等待，等待期限不能超过原始执行期限。
- `respond` 仅接收答复，不隐式接纳或执行动作。
- `read` 只读现有事实，不恢复任务或分配额度；已接纳回执须与等待提交关联。
- `continue` 在当前授权下显式接纳已答复结果，首次接纳检查原始期限；重复继续可读取已保存回执。

`accept` 必须在宿主锁／CAS 下比较完整绑定、当前来源和策略、submissionId 及动作身份，并持久保存幂等回执。两个 Kit 不自动组成事务；保存确认丢失先读回或对账，不盲目重发外部动作。取消不撤销已发生的副作用。

Waiting 按 gate 定义 ID 与 taskId 保存单槽。并行争议应使用独立槽，并关联父任务；waitId 是代次。内容修订与记录 CAS 修订分别维护，旧内容答复不能应用到新争议。Waiting 的 `resolved` 只表示已收到答复，不表示争议已关闭或获得执行授权。

## 选择已有结果的配方

`@jangts/agent-core/kits/review-choice` 提供 `inspectReviewChoices`、`isReviewChoice`、`isReviewChoiceAnswer` 和 `bindReviewChoiceDecision`。输入是一至两个宿主已获得的有界摘要及可信 `complete` 覆盖标记；更多结果使用通用 ResultReview。`compare` 返回严格 JSON `{ conflict, reason }`。有分歧且检查完整时保存待选择结果；缺证据、检测失败或未覆盖保持 `incomplete`，不能用人工选择绕过。

选择答案仅引用已有 inputId 及理由。配方共用答案验证、等待关联和接纳校验，App 仍负责内容摘要的 hash、可信身份、当前资料版本和真实存储锁。调用方必须在同一记录排他范围内完成整个接线操作；不会自动提供跨进程锁。

裁决只采用已有结果，不生成新回答，也不新增模型额度。若恢复后需要新的模型阶段，须从父级持久总账原子分配，保留原期限与累计消费；不能为新 taskId 创建满额账本。仅检测路径仍不需要持久总账。

跨进程与同故障接线对照见随包的 `development/examples/collaboration-probe.mjs`。它验证受控进程重建与响应丢失，不证明断电持久性或外部系统 exactly-once。精确声明见[公开符号参考](reference.md)。

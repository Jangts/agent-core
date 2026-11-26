# 让完成检查触发定向修复

报告已有合法的操作回执，显示字段却未通过格式校验。若完成检查只返回一个布尔值，流程很难知道是否应重查资料、重写正文，还是只修一个字段。让检查带上足够的决策信息。

## 把检查结果交给有职责的阶段

用 `defineCompletionChecks` 登记检查及其 `required` 属性。按任务读取检查报告，把 `ready` 交付，把 `clarify` 作为当前用户问题，把 `partial` 交给可用成果路径。对于 `repair`，按 `target` 选择所需阶段。

| 目标 | 应修复的材料 | 保留 |
| --- | --- | --- |
| `format` | 结构、渲染或可解析字段 | 已确认事实和操作回执 |
| `content` | 从已有证据组织的解释 | 已读来源和写入状态 |
| `evidence` | 缺失或失效的来源 | 仍适用的其他来源 |

必要校验拒绝时停止常规交付。必要检查抛错进入失败处理。附属检查的失败应留下诊断，在可用的主结果仍成立时允许交付。检查最好无副作用，确需写入时由应用使用相应授权和幂等保障。

## 观测修复前后的业务计数

运行 `node node_modules/@jangts/agent-core/development/examples/harness-composition.mjs`。案例在一次写入后注入格式失败，仅修交付并保留回执。接入自己的工作流后，断言 `format` 不重复读取或写入，证据修复只读取失效项。限制修复尝试并验证无进展时如何结束。[完成检查合同](../../docs/api/reliability.md) · [稳健性检查 Skill](../../skills/agent-core-resilience-review/SKILL.md)

[技术分享目录](../README.md)

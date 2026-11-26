# 跨进程等待审批与恢复操作

退款提议需要管理员确认。人可能几小时后答复，原请求和进程可能已结束。批准后发起退款，支付端可能已成功但确认响应丢失。设计时要把收答复、授权执行、核对操作作为不同的持久事实。

## 保存等待及答复的身份

用 Waiting 定义接受的答复、权限与截止时间。一个 gate 定义和 taskId 对应一个槽，waitId 标记特定一轮等待。重复打开仍按原来的截止时间处理。提交时核对 waitId 和权限，保存答复事实。进程重建后可以读取已提交答复。后续操作由显式恢复入口按当前授权启动。等待已解决只表明收到可接受的答复。

## 为实际操作选择恢复策略

用 Durable 记录定义版本、任务进度、截止时间和已用尝试。确定可安全重放的分析可使用 `safe`。可能已产生外部写入的步骤使用 `reconcile`，按稳定的 operationId 查询实际业务回执。核对没有模型额度。返回 `completed` 时保存已确认状态。明确 `not-executed` 后，按原执行期限、额度及当前授权再决定是否执行。`unknown` 保留不确定性。

operationId 在同一个逻辑操作的恢复中保持稳定。每次 Durable 保存用新的 commitId 标明具体提交。保存回包丢失时，在宿主排他范围内读回匹配的 commitId。多个进程运行时，应用提供真实并发控制、原子存储和业务幂等。取消和超时不能证明远端退款已回滚。

运行 `node node_modules/@jangts/agent-core/development/examples/harness-durable.mjs`，观察多个进程重建等待记录、提交后确认丢失和读回。用自己的存储复测并发写入、期限与权限变化。[持久等待案例](../../examples/harness-durable.md) · [稳健性检查 Skill](../../skills/agent-core-resilience-review/SKILL.md)

[技术分享目录](../README.md)

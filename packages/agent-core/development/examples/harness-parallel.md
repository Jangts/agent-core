# 受控并行与显式结果接纳

`harness-parallel.mjs` 使用离线确定性 Provider、两个原生子 Runner 和普通 Workflow 节点。它不提供队列、图调度器或跨进程恢复。

父请求先绑定 Runner，再通过 `createChild` 派生两个子 Runner。子调用共享真实祖先账本和并发上限；样例同时核对 Provider 实际进入次数与累计消费。每个分支接收单独克隆的输入，不共享可变父状态。

`aggregateBranchResults({ branches, results })` 是可选 Aggregation Kit 的纯函数。`branches` 声明稳定身份及检查顺序；每个身份必须恰有一个已结束结果。成功分支返回 `{ id, status: 'succeeded', patch }`，失败分支返回 `{ id, status: 'failed', error }`。输入结果和补丁必须可 structuredClone；补丁为普通数据对象。

所有分支成功且写入的顶层字段互不重叠时，返回 `status: 'accepted'` 与建议补丁。任何两个分支写同字段都会返回 `conflict`，即使值相等。失败产生 `incomplete`；存在冲突时优先报告 `conflict`，失败事实仍在结果集中。拒绝时不返回可提交补丁，成功成果仍保留在按声明顺序排列的 `results`。结果仅为数据快照，App 拥有检查、保存、访问控制和最终接纳。

这项复用的独立价值是：集中校验完整身份集合、拒绝重复或缺失结果、统一冲突诊断，并保留部分成果。它不启动异步任务，不调用模型，不决定重试，不检查当前身份或授权。只需要简单数组且不需要这些约束时，可以直接写普通 handler。已有同步查询聚合接口不变。

样例的完成门闩明确控制两个完成顺序，无需 sleep：

- 正常分支写不同字段，父节点接纳两份结果。
- 两个分支都写父级 `answer`，交换完成顺序仍得到相同冲突和稳定拒绝。
- 右分支失败时，左侧成果保留，父状态不部分提交。
- 父取消后，故意不合作的分支仍返回成功；父节点提交前检查取消，Core 再次阻止迟到补丁提交。保留成果不等于被父运行接纳，也不表示外部副作用已撤销。
- 总额度缩为一次时，Provider 只进入一次；第二分支失败并保留首份成果。不是仅比较相同配置数字。

在 Agent Core 项目根目录运行 `npm run build` 后执行 `node development/examples/harness-parallel.mjs`；定向回归为 `node --test test/aggregation.test.mjs`。使用项目要求的 Node 22.12 或更高版本。

范围限制：单 App 请求内并行；顶层字段冲突；无自动深合并、幂等或恢复。App 若选择只接纳部分成果，应另外明确该政策，不能把本函数的失败状态默认为成功。结果存储、保留期限及再读取权限由 App 决定。

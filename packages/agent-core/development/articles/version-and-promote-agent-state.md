# 保存分支版本并显式晋升

客服应用想试用一套新的问答流程，同时保留当前生效的规则。应用可以为候选规则保存一个新分支，验证证据和授权后显式晋升。请求正在执行到哪个节点，属于另一类运行事实。

## 保存需要恢复的数据

用 Engine 的 `exportSnapshot` 将宿主提供的可序列化状态与完整分支身份一起导出。加载时先构造匹配身份的实例，再 `restoreSnapshot`，并由应用接入当前工具、权限和请求依赖。快照只保存数据。恢复到待审批或外部写入阶段时，需要通过持久任务的记录追踪进度。

## 让候选与当前版本同时可读

`defineBranchVersioning` 管理版本集。以当前版本为基础 `fork`，或使用应用提供的三方合并函数生成候选。同一字段有真实分歧时记录冲突，让其进入明确裁决。晋升时传入版本集 revision、候选 ID 和 expectedActiveId，重新核对来源及权限。宿主 store 的 `compareAndSwap` 原子提交全部版本和 activeId，从而阻止两个并发审批覆盖彼此。

在测试里，让两个候选都从同一个活动版本出发。一个晋升成功后，另一个持有旧基线时应该拒绝。发布者权限撤回后，也应保持原有活动版本。可运行 `node node_modules/@jangts/agent-core/development/docs/examples/branch-promotion.mjs`，核对候选保存及旧基线拒绝。[示例源码](../docs/examples/branch-promotion.mjs) · [分支与晋升](../docs/api/advanced-agents.md) · [变更评审 Skill](../skills/agent-core-workflow-change-review/SKILL.md)

[技术分享目录](README.md)

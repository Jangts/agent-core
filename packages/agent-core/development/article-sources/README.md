# 技术分享

这组文章从实际任务出发，介绍如何组织 Agent Core 工作流、维护输入与状态，以及验证正常交付和故障恢复。每篇围绕一个设计决定，给出 SDK 合同和可运行案例。

## 工作流设计

- [节点和工具怎样划分职责](workflow-design/nodes-and-tools.md) · 用服务说明任务选择用例式、探索式或矩阵式组织。
- [从能力目录准备一次模型决策](workflow-design/one-phase-one-declaration.md) · 用同一份声明生成选择范围，核对实际执行授权。
- [共享预算下的子任务组合](workflow-design/compose-bounded-subtasks.md) · 选用普通 handler 或子 Agent，处理并发失败与状态冲突。
- [保存分支版本并显式晋升](workflow-design/version-and-promote-agent-state.md) · 区分运行快照、候选版本和生效版本。

## 上下文与答复

- [按任务阶段构造提示与上下文](context-and-replies/prompts-and-context.md) · 给指令、用户输入、历史和工具结果分配位置。
- [控制输入长度与交付范围](context-and-replies/compression-or-partial.md) · 选择投影、按需读取、摘要或部分交付。
- [用证据维护个人记忆快照](context-and-replies/personal-memory-snapshots.md) · 处理更新、同时间顺序、撤回与过期。
- [组织答复的事实、格式和参考](context-and-replies/reply-organization.md) · 把业务事实验证与文案组织接入相应调用。

## 执行与恢复

- [按剩余工作调整调用预算](execution-and-recovery/reasonable-dynamic-budgets.md) · 按成果进展评估额度，同时保留调用账本。
- [请求失败后交付已经确认的结果](execution-and-recovery/reliable-request-recovery.md) · 区分步骤修复、请求恢复和程序收尾。
- [让完成检查触发定向修复](execution-and-recovery/targeted-completion-repair.md) · 把内容、格式和证据问题送回相应责任方。
- [复用证据并核对操作回执](execution-and-recovery/evidence-and-operation-receipts.md) · 区分资料读取、业务执行和消息送达。
- [跨进程等待审批与恢复操作](execution-and-recovery/approval-and-durable-recovery.md) · 保存审批事实，核对可能已生效的写入。
- [评审分歧并接受现有成果](execution-and-recovery/review-and-accept-results.md) · 区分发现、覆盖率、人工答复与最终接受。

## 接入与验证

- [选择模型协议与调用生命周期](integration-and-verification/choose-model-lifecycles.md) · 为直接响应、后台任务、批处理与实时会话选择合同。
- [用运行记录定位第一处错误决定](integration-and-verification/observe-real-execution.md) · 从路由、调用和回执追溯故障。
- [用故障验证任务如何收尾](integration-and-verification/test-completion-under-faults.md) · 按行为不变量设计离线故障用例。

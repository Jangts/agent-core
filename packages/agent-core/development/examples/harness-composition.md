# 有界 Agent 组合

[English](harness-composition.en.md) · [示例源码](harness-composition.mjs)

示例展示单次模型调用，以及父工作流包装有界子 Agent、保留工具回执并定向修复交付的组合。只使用 `@jangts/agent-core` 公开入口、确定性 Provider 和请求内存储，不访问网络或读取凭据。

在 `main/` 使用 Node **22.12 或更高版本**，且工作区包产物已经存在时运行：

```sh
node development/examples/harness-composition.mjs
```

示例不构建源码。产物缺失或过旧时停止并报告；源码改动不会自动进入本次运行。无需配置模型服务。

## 导入与离线验证

导入模块不会自动运行示例或输出日志。`runMinimal()` 演示最小调用，`runComposition()` 执行默认探路及断言；`createComposition({ provider, signal, canSave, saveNote })` 返回一次请求的 App 装配。省略参数使用内置确定性 Provider、独立请求 signal、允许保存和请求内 Map。

传入 `provider` 可替换模型端口，`signal` 绑定取消，`canSave: false` 演示授权拒绝。可选 `saveNote(note, context)` 是 App 保存端口，context 包含请求生命周期及示例回执；端口返回后才记录本地回执。保存端口可能在取消后完成，调用方须自行确认真实副作用。

定向验证使用真实 MockGPT 公共入口及 `CompatibleModelProvider`，由 `mock.fetch` 提供 HTTP／SSE，无网络请求。需要工作区已有可选 `@jangts/mock-gpt` 包和产物：

```sh
node --test test/harness-composition.test.mjs test/harness-mockgpt.test.mjs
```

案例覆盖共享预算、授权拒绝、格式修复不重放保存、HTTP 429 失败调用计账、取消后模型迟到选择不提交，以及非合作保存端口的迟到写入不成为成功子结果。它们验证指定故障点，不代表所有取消时序均已覆盖。

## 调用链

单次调用直接创建 `ModelRunner({ provider })`。父子工作流使用同一请求显式绑定的父 Runner：

1. 父 Workflow 用一次模型调用准备输入。
2. 普通父节点通过 `createChild` 派生子 Runner，再交给子 Engine 的 `bindModelRuntime`。子 Agent 有自己的状态、最多两轮的决策循环和工具目录；模型决定保存，工具授权后执行，再返回草稿与回执。
3. 父节点提交子结果，随后检查交付格式。草稿故意不符合 JSON 合同。
4. 检查节点通过 `onErrorNodeId` 进入一次定向修复。修复节点只读取确认回执，不返回子 Agent，也没有父级工具 runtime。

父 Runner 总额度为 4，子 Runner 最多调用 2 次，并保留父级 1 次容量用于修复。父准备与修复共 2 次，加子调用 2 次；示例断言实际 Provider 次数与父 `totalCallCount` 都是 4，并尝试第 5 次调用，要求在 Provider 前被 `BudgetError` 拒绝。观察计数不承担额度控制。

第二条路径拒绝工具授权，断言授权检查 1 次、保存 0 次、修复 0 次、总模型消费 2 次。授权拒绝通过抛出错误表达，模型文本或工具 schema 都不能授权。

## 接线边界

- App 持有父 Runner 的请求级引用，通过闭包派生子 Runner；`WorkflowContext.model` 没有 `createChild`。仅重建相同配置的 Runner 不共享预算。
- 父 Engine 与 Runner 绑定同一请求 signal，子 Runner 额外绑定节点 signal 和超时；子工具使用同一子生命周期。定向测试覆盖上述两个取消时点，未穷举其他竞态。
- 默认不配置持久诊断输出端口；可选 observer 回归覆盖父子元数据关联与单次事件交付，未验证完整流式内容归属或诊断存储。
- 保存端口是本次请求内的 Map。一次保存只证明当前路由的格式修复没有重放工具，不证明持久化、幂等、崩溃恢复或外部 exactly-once。
- 确定性响应只验证程序路径，不证明真实模型的工具选择、语义质量、抗注入或格式修复质量。
- 尚未覆盖持久等待、跨进程恢复、并行汇合、资源退出故障或外部 LangChain 接入。没有新增 Core API，也没有把普通节点包装提升为专用 Agent 节点协议。

执行成功时输出 `r0` 与 `r1Probe` 的交付、调用序列和父子消费事实；任何断言失败会非零退出。运行结果以实际使用的 Node 和包产物为准。

可向 `createComposition` 传入 `observe` 观察元数据；回归核对四次独立模型开始、一次工具调用和同一 run 身份，并验证同一个 observer 同时经 Runner 与 Engine 接入不会重复收事件。

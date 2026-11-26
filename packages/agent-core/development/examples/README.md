# 最小接入示例

从仓库根目录运行，使用 Node.js >= 22.12 和已经编译的 workspace 包。示例只导入公开 API，不导入 SDK 的 src 或应用实现。未准备依赖／产物时，按仓库流程先运行 `npm ci`、`npm run build:packages`。

| 示例 | 内容 | 运行命令 |
| --- | --- | --- |
| [harness-handler-comparison.mjs](harness-handler-comparison.mjs) | 同任务普通 handler／图组合对照，核对授权、预算与交付；[中文](harness-handler-comparison.md)／[English](harness-handler-comparison.en.md) | `node development/examples/harness-handler-comparison.mjs` |
| [harness-parallel.mjs](harness-parallel.mjs) | 独立子任务、真实结果冲突、确定性汇合和取消晚到；[中文](harness-parallel.md)／[English](harness-parallel.en.md) | `node development/examples/harness-parallel.mjs` |
| [harness-durable.mjs](harness-durable.mjs) | 三个进程重建等待门闩和持久任务、确认后保存及只读结果查询；[中文](harness-durable.md)／[English](harness-durable.en.md) | `node development/examples/harness-durable.mjs` |
| [harness-composition.mjs](harness-composition.mjs) | 单次模型调用、普通父节点包装有界子 Agent、父子共享账本、工具授权与仅修复交付；[中文](harness-composition.md)／[English](harness-composition.en.md) | `node development/examples/harness-composition.mjs` |
| [support-strategies.mjs](support-strategies.mjs) | 同一模型合同由推荐预算增加模型代指、显式推理配置与精确覆盖；完整上下文计划和多历史策略 | `node development/examples/support-strategies.mjs` |
| [context-nodes.mjs](context-nodes.mjs) | 相同输入从超限拒绝，到显式选择／压缩／装配节点，再替换独立类实现 | `node development/examples/context-nodes.mjs` |
| [execution-progress.mjs](execution-progress.mjs) | 同一业务从最小运行增加统一进度监听；关闭日志仍即时收到模型、工具与自定义节点事实 | `node development/examples/execution-progress.mjs` |
| [unified-api.mjs](unified-api.mjs) | 同源schema、固定结果、工具提议与实际授权执行；checkJs与离线回归覆盖 | `node development/examples/unified-api.mjs` |
| [minimal-core.mjs](minimal-core.mjs) | Core 单步调度 + 函数 Provider | `node development/examples/minimal-core.mjs` |
| [core-with-mock.mjs](core-with-mock.mjs) | Core 单步调度 + MockGPT 模型调用 | `node development/examples/core-with-mock.mjs` |
| [miniapp.mjs](miniapp.mjs) | Core 工作流分派两个意图，工具值直接返回 | `node development/examples/miniapp.mjs` |
| [answer-flow.mjs](answer-flow.mjs) | 同一回答流程从生成／检查逐步加入复核与局部修复 | `node development/examples/answer-flow.mjs` |
| [work-with-kit.mjs](work-with-kit.mjs) | Core 调度生成／检查节点，Candidates Kit 检查候选 | `node development/examples/work-with-kit.mjs` |

`mock-provider.mjs` 是前两个 MockGPT 示例共用的装配入口。注入 `mock.fetch`，不启动 HTTP 服务、不请求网络，不需要环境变量或真实密钥；`offline-example` 只是满足 Provider 配置的占位值。

## Miniapp

这里的 miniapp 是最小命令行应用。集中声明两个意图：

- `greet`：直接返回问候，工具调用为 0 次。
- `status`：调用 `get_status`，直接取工具结果的 `value` 返回，工具调用为 1 次。

应用声明 `recognize → greet/status` 节点和路由，由 `engine.bindWorkflow(workflow).run(state)` 执行节点、判断路由、提交状态并结束，不再通过应用侧 `find + handle` 分发。工具仍由应用注册，实际调用通过 Core 的 `ToolRegistry` 执行。每个问题只调用一次模型进行意图选择；状态工具之后没有模型复核、改写或格式加工。Core 仍执行必要的输入校验和调用记账。MockGPT 返回原生工具提议，由模型传输解析为意图；模型的选择只产生意图 ID，Core 按已登记路由进入对应节点。Mock 只覆盖两个明确问句，不具备真实语义理解，其他问句会因规则未命中而报错。

预期输出：

```text
你好 → 你好！（工具调用 0 次）
Core 调度： recognize → greet
服务状态怎么样？ → 服务运行正常（工具调用 1 次）
Core 调度： recognize → status
模型调用： 2
```

## Work with Kit

选择参数最少的 Candidates Kit：配置 `field` 和 `maxCandidates` 即可。函数 Provider 模拟必要的模型回答数据，不配置 MockGPT。ModelRunner 返回 `{ value, invocation }`；Core 先调度 `generate` 节点取得模型数据，再调度 `select` 节点解析 JSON 并把业务值交给 Kit。Kit 检查候选信封及数量，应用检查候选的 `text` 字段。Core 不感知或依赖该 Kit。

[工作流节点省写](workflow-node-invoke.mjs)用同一个服务查询演示从顺序节点过渡到条件路由。运行 `node development/examples/workflow-node-invoke.mjs`。

## Organization comparison / 组织方式对照

[English](../docs/examples/organization-comparison.en.md) · [中文](../docs/examples/organization-comparison.md) · [Runnable source / 可运行源码](../docs/examples/organization-comparison.mjs)

The same offline task in two Core workflows, with fault and recovery assertions. / 同一离线任务的两种 Core 工作流，包含故障与恢复断言。

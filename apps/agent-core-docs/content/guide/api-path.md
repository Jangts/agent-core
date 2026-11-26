# 按 API 搭建应用

按应用的调用链学习：先得到一次模型结果，再执行真实工具，最后用工作流组织多阶段任务。Core 定义执行合同，Support 构造接入实现，Kit 在 App handler 内提供可选业务能力。

## 1. ModelRunner：生成结果与请求生命周期

`new ModelRunner({ provider })` 可以复用；每次顶层 `invoke` 拥有独立的预算、取消和记录。需要一次请求内多次调用时，先 `runner.bind(execution)`，在绑定实例读取统计和 Journal。共享宿主没有“当前请求”，不能在宿主读取请求统计。Engine 为每次 run 绑定共享 Runner；已经绑定的 Runner 保留原有累计额度，不通过再次绑定重置。

`invoke` 成功返回 `{ value, invocation }`，失败抛错。完整结果从 `value` 读取；实时片段通过 `sink.output` 接收。子类重写方法保留真实实例，使用 `this.bind(request.execution)` 读取本次执行记录；请求数据不要写入共享实例字段。

阅读：[模型合同](/manual/api/core) → [模型协议与生命周期](/manual/api/model-protocols) → [请求、调用链与 Journal](/manual/api/observability)。

## 2. 工具：声明、授权与真实执行

使用 `Support.defineToolCatalog` 集中声明工具，再 `catalog.bind({ app, execution })` 绑定请求依赖。`tools.invoke({ toolId, input })` 执行输入解析、授权、业务处理和结果检查，成功同样返回 `{ value, invocation }`。模型选出的工具名和参数只是提议，必须经过真实执行边界。

类组织使用 `@toolbox` 集中配置工具，类上的同名 handler 实现业务；`ParseInput`、`ParseOutput` 负责转换，`Authorize` 提供共同及附加权限检查。JSON Schema 在可选输入转换前验证，共同授权先于附加授权；注册失败不能留下部分工具。

阅读：[工具接入](/manual/basic-usage) → [Support](/manual/api/support) → [装饰器](/manual/api/decorators)。

## 3. 工作流：状态提交、路由与结束

使用 `defineWorkflow` 或 `AgentWorkflow` 组装节点。节点返回 state patch，提交之后路由读取最新状态；`route.to` 继续，`route.deliver` 完成交付。路由按声明顺序匹配。节点内调用 `context.model.invoke` 与 `context.tools.invoke`，保留预算、取消、授权及回执。

对象节点与 `@node` 产出遵守相同合同。`@agent` 注册真实 Engine 子类实例，`@model` 注册真实 Runner 子类实例；构造参数显式传入。用 `nodePool.pick(ids, ns)` 明确图的节点与顺序，不依赖导入顺序编排业务。

阅读：[Workflow](/manual/api/workflow) → [类与命名空间](/manual/api/decorators) → [图与执行链](/manual/api/workflow-views)。

## 4. 设置上下文、预算和恢复边界

用 `Support.defineContextFragments` 声明来源、信任与限长。在需要测量实际输入时，用同一个准备句柄测量和调用。只有面向用户的回复步骤才按需传入 `replyGuidance`。

`maxCalls` 是请求初始分配，`maxTotalCalls` 是宿主上限。按剩余工作评估后，可以在绑定的请求上调整分配，已用次数和上游预留仍然生效。保留实际执行回执，让格式修复或程序化收尾复用已经确认的成果。未知写入进入回执核对。

[上下文处理](/manual/api/context-processing) · [资源、完成检查与恢复](/manual/api/reliability) · [答复组织](/articles/reply-organization)

## 5. App handler：按需使用 Kit

知识、回答检查、检索、产物与持久任务由 App 按场景选择。Kit 的局部合同不会成为 Core 所有应用的必需状态；身份、事实来源、持久化和副作用权限归 App。

阅读：[知识回答](/manual/api/knowledge-answering) → [Kit](/manual/api/kits) → [完整离线示例](/manual/examples/offline-agent)。使用 `/mock` 入口时另行安装 `@jangts/mock-gpt`。

需要个人记忆、跨进程恢复或接受评审结果时，分别从[记忆快照](/manual/memory-and-learning)、[有界子任务与持久任务](/manual/api/advanced-agents)及[结果评审与裁决](/manual/api/result-review)进入。App 提供相应的数据范围、当前授权和存储端口。

## 查找精确声明

[公开 API 目录](/api/)按当前源码导出提供签名与重载；[模块目录](/api/modules)按导入入口查找。用[API 手册](/manual/api/)理解行为，再查符号页确认参数，不把类型清单当成入门教程。

[按稳健性选择示例](/recipes/) · [升级现有接入](/manual/upgrading)

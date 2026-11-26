# Agent Core API

本手册按模块说明当前 SDK。精确类型和全部重载见[公开符号参考](reference.md)。

规范名称与长期边界见[概念与命名](../concepts.md)、[兼容与维护](../compatibility.md)和[升级指南](../upgrading.md)。

Core 定义运行接口和执行保证，Support 提供推荐实现与配置策略，Kit 提供 App 可选的业务能力。纯算法使用各自的输入输出合同。

App 还可以按任务选用通用 SKILLs，将方法正文接入自己的 handler。[通用任务 SKILLs](skills.md)

第一次接触这些配置时，先读[独立配置与关联配置：完整代码对照](configuration-in-workflow.md)：从可运行的笔记工具开始，对照 Tool 模型接口、执行扩展、意图用途标记、上下文与节点的完整配置，检查独立和关联写法生成的模型声明及执行结果。

## 从这七条规律开始

1. 实体用 `id`，指向实体用 `toolId`、`documentId` 等；`name` 是显示名。
2. `jsonSchema` 总是只读 JSON Schema；`inputSchema` 总是 `SchemaAdapter<T>`，其中的 `parse` 负责真实解析。
3. `is/can/has` 返回布尔；`assert/authorize` 通过时返回 void、失败抛错；`check` 返回问题报告；`parse` 返回转换后的值。
4. `define` 构造或校验定义型对象；已有 defineDurableTask、defineWaitGate 也绑定端口并返回可调用实例，不为词法统一增加包装层。`create/new` 按各自合同建立适配器或实例。请求状态、signal和预算按真实生命周期绑定。
5. 输入在前、上下文在后。复杂调用用命名请求；`get(id)` 缺失返回 undefined，`require(id)` 缺失抛错。
6. invoke成功统一返回`{ value, invocation }`；输入短写只归一输入，文本和结构化值都放在value里，失败统一抛错。
7. observer 是不阻断业务的观察；sink 是需要等待的交付。两者不因都返回 Promise 而具有相同语义。

## 导入与阅读顺序

```ts
import { AgentCoreEngine, ModelRunner, Support } from '@jangts/agent-core';
import { defineKnowledgeCatalog } from '@jangts/agent-core/kits/knowledge';
import { defineAnswerFlow } from '@jangts/agent-core/kits/answering';
import type { SchemaAdapter, OperationContext, Issue } from '@jangts/agent-core';
```

Core 服务及共同合同从根入口，接入辅助从 `Support`，Kit 从各自独立入口使用具名函数或构造器。全量 `/kits` 与单项入口转出同一实现。

| 顺序 | 文档 | 学到什么 |
| --- | --- | --- |
| 1 | [共同类型与规则](types.md) | 身份、schema、校验、错误、上下文、集合、所有权 |
| | [工作流入门](workflow.md) | Agent 绑定、节点、路由和派生 |
| 2 | [Core](core.md) | 模型调用、能力、工具执行、工作流和事件 |
| 3 | [Support](support.md) | schema、工具与能力清单、传输和上下文装配 |
| | [上下文处理](context-processing.md) | 预算、水位、压缩与原文保护 |
| | [模型协议与生命周期](model-protocols.md) | Provider 协议、续接、后台任务、批处理和实时会话 |
| | [资源、完成检查与恢复](reliability.md) | 请求预算、定向修复和已确认成果 |
| 4 | [知识、回答与展示](knowledge-answering.md) | 取证、检查、局部修正、程序绑定输出 |
| 5 | [其余 Kit](kits.md) | 意图、交互、检索、规则、产物和持久任务 |
| | [个人记忆](../memory-and-learning.md) | 有来源的快照、作用域、纠正与撤回 |
| | [结果评审与裁决](result-review.md) | 多 Agent 分歧、独立覆盖、动作准入及等待接纳 |
| | [复盘、分支和资料发布](advanced-agents.md) | 有界子任务、元数据证据、持久版本与来源校验 |
| 6 | [连贯示例](examples.md) | 用同一套合同声明工具、调用模型并执行真实操作 |

日志与Journal的统一事实源、调用链关联及关系表映射见[请求、调用链与Journal](observability.md)。

## 单页速查

| 任务 | 首选接口 | 结果 |
| --- | --- | --- |
| 一次模型调用 | `runner.invoke({ stageId, input, interaction })` | ModelResult：value为完整解析值，原始分片只进sink |
| 执行工具 | `tools.invoke({ toolId, input })` | ToolResult：value为已解析、授权、执行并检查的实际结果 |
| 编译工作流 | `defineWorkflow(definition)` | 不绑定请求的 `Workflow` |
| 运行工作流 | `agent.run(state)` | 满足最终结果合同的值 |
| 声明工具 | `Support.defineTool(definition)` | 与模型schema同源的类型化定义 |
| 创建请求工具实例 | `catalog.bind({ app, execution })` | 生命周期仅限本次请求的 `ToolRuntime` |
| 取得登记项 | `catalog.get(id)` / `catalog.require(id)` | 可缺失查询／必须存在查询 |
| 检查值 | `checker.check(value, context)` | `CheckResult`，不是boolean或异常别名 |
| 读取资料 | `knowledge.read({ documentId, selection })` | 带版本、选择和身份的快照 |
| 恢复持久任务 | `task.run({ taskId }, context)` | 已确认最终状态的副本。未预先绑定存储时，在请求中传入 `store` |

同步算法继续同步。源schema、权限、预算、取消和最终提交检查不会因为采用这些辅助接口而放宽。App 自己的业务状态不升级为所有 Kit 的必需字段。

## 模拟模型

[MockGPT Kit](mock.md) 说明 `@jangts/agent-core/mock` 及其 `/node`、`/web` 入口：规则与生成器、直接返回值、HTTP/SSE、工具提议、网页来源、错误、取消与预算。

- [装饰器与定义池](decorators.md)

开发辅助接口不参与任务执行；工作流的静态拓扑与按 run 查询的执行链见[工作流图与运行轨迹](workflow-views.md)。

- [资源、完成检查与请求恢复](reliability.md)

模型协议与生命周期：[统一接入指南](model-protocols.md)。

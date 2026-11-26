# 第三方 App 开发指南

本指南介绍如何使用 Agent Core 的公开接口开发 App，包含 API、接入示例、Skill 和 App 资料维护说明。英文版本从 [English](README.en.md) 开始，各页对应同目录的 `*.en.md`。

> [API 手册](api/README.md) · [公开符号参考](api/reference.md)

> [概念与命名](concepts.md) · [兼容与维护](compatibility.md) · [升级指南](upgrading.md)

Agent Core 通过公开接口接入应用，可配合不同的服务框架、数据库、模型供应商和前端使用。

API 参考也是这套开发文档的一部分：[API 首页](api/README.md)、[Core](api/core.md)、[Support](api/support.md)、[Kit](api/kits.md)。本指南解释如何组合这些接口和承担应用责任；接口签名、参数、返回、异常以对应 API 页为准。

## 从要完成的任务开始

先看[工作机制图解](mechanisms.md)，了解总体协作、任务与节点的区别、工作流推进、模型与工具调用时序，以及 App 知识回答示例。

先提供一个 ChatProvider，再调用 `new ModelRunner({ provider }).invoke('你好')`。Core 自己提供普通文本路径和默认运行设置，Support 与 Kit 都是可选项。工具、上下文处理、持久化和复杂编排在需要时逐步接入。

| 要完成的事 | 推荐入口 |
| --- | --- |
| 从空目录创建可运行的 Agent App | [创建应用](create-app.md) |
| 安装到已有项目、配置模型连接 | [安装与接入](getting-started.md) |
| 生成一次回复 | [模型调用](basic-usage.md#一次模型调用) |
| 集中声明工具、授权、执行并回传结果 | [工具接入](basic-usage.md#工具只声明一次) |
| 理解原始模型流与完整交付的区别 | [流式边界](basic-usage.md#streams-previews-and-logs) |
| 编排条件循环和多阶段任务 | [注册与编排](registration.md) |
| 设计节点、检查注册图与评审工作流变更 | [工作流开发与验证](workflow-development.md)、[工作流检查器](workflow-inspector.md) |
| 设计或检查答复、风格及参考使用 | [答复怎样组织](../articles/reply-organization.md)、[开发 Skill](../skills/agent-core-reply-development/SKILL.md) |
| 复用任务方法或让编码助手参与 App 开发 | [任务 Skills](api/skills.md)、[开发者 Skills](agent-development.md) |
| 管理提示词、上下文来源和处理职责 | [提示词与上下文](../articles/prompts-and-context.md) |
| 控制上下文长度与压缩 | [上下文策略](api/context-processing.md) |
| 根据已有资料生成并检查答案 | [知识资料](knowledge.md)、[知识回答合同](api/knowledge-answering.md) |
| 处理用户材料与持久化 | [材料边界](materials.md)、[记忆与持续积累](memory-and-learning.md) |
| 接入日志、取消和失败处理 | [交付与运维](operations.md) |
| 核验完整接入 | [接入检查](acceptance.md) |

局部接入方式见 [示例](examples.md)，应用数据字段设计见 [记录示例](records.md)。人工准备和迭代见 [维护手册](maintenance.md)，编码 Agent 的共用流程与 Skill 见 [Agent 辅助开发](agent-development.md)。这些资产不会被库自动扫描、安装、发布或写入数据库。

## 运行接口与复用方法

Core 拥有执行服务及调用／回调合同，例如工作流状态提交、模型调用预算、工具输入→执行→输出和真实调用回执。Support 帮 App 构造这些调用和被调度实现。Kit 由 App 自主选择，拥有自己的局部业务模型和规范。

`Support` 是接入支持的统一命名空间，内部包含多个模块。单个可选能力模块称一个 Kit；多个 Kit 由 `/kits` 汇总。一个 Kit 内部可以有自己的辅助函数和通用工具。

任务 Skills 为 App handler 提供可复用的任务说明。开发者 Skills 和 Node.js 工具用于设计、检查和验证 App 工作流，入口见[工作流开发与验证](workflow-development.md)。

```text
App 的鉴权、存储、资料加载和运行配置
    → Support 装配模型与上下文
    → Core 执行已登记的工作流、模型调用和工具
    → App handler 按需调用 Knowledge / Answering / Presentation 等 Kit
    → App 检查并交付结果
```

模型提出的名字、参数、结论都不是鉴权、持久化授权或执行回执。App 可以不用某个 Kit，但仍须遵守实际使用的 Core 接口。选用某个 Kit 后，要遵守其局部输入输出约束。

## 新 App 必须提供什么

- **基础运行**：Provider 的模型连接和实际输入。Core 提供默认预算、单次超时、信号与普通文本传输，按需要覆盖。
- **启用工具时**：业务实现及所需身份、访问控制、参数与结果约束。
- **启用持久化时**：来源、用户归属、存放与保留策略及失败恢复。
- **启用复杂编排时**：声明节点、工具、模型能力、资料、检查与输出的关联。

不需要默认启用长期记忆、用户画像、经验库、向量数据库或动态工具加载。可以先交付一个只读、单轮、明确来源的 App，再按真实需求逐项接入。

## 已提供与需要自行实现的能力

| 库已提供 | App 仍需实现 |
| --- | --- |
| Knowledge 的文档解析、内存目录、章节选择和快照 | 读取文件／数据库、资料授权、版本计算、持久化导入／修改／删除 |
| Answering 的任务清单、检查和有界局部修正 | 任务业务定义、事实读取、模型调用、业务校验和允许的 fallback |
| Support 的上下文装配和模型调用格式适配 | 请求数据、服务端身份、来源可信度、存储和模型连接配置 |
| TextSkills 的文本目录加载和元数据校验 | 实际文件读取、工具引用核验、更新发布和重新加载时机 |
| Core 的运行记录和可选诊断、Support 的可选 Provider observer | 日志输出、存储、敏感内容策略、查询和运维 |

可复制运行的离线完整代码见[服务问答示例](examples/offline-agent.md)。parse／define 在内存中解析和编译资料。资料准备与更新见[资料维护 flow](flows/knowledge-maintenance.md)。

画像合并、经验学习、长期记忆存储、文档持久化、向量索引存储及文件摄取由 App 实现。相关章节提供接入边界与范本。

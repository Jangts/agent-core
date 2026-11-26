# 选择模型协议与调用生命周期

客服摘要需要在当前请求中返回。数千份独立工单可以批量生成。用户边说边打断的语音助手需要连接内同时收发。协议决定了可发内容和返回合同，生命期决定任务在哪里开始、停止及恢复。

## 从任务的等待方式选择入口

| 场景 | 接入合同 | 宿主需要保存或配置 |
| --- | --- | --- |
| 普通问答、短工具链 | `ModelRunner` 与显式协议 Provider | 当前请求的取消、预算、工具范围 |
| 单项长任务 | 支持后台操作的 Responses 或 Interactions | 稳定操作身份、远端 ID、轮询和取消 |
| 多个独立输入 | OpenAI、Anthropic 或 Gemini 原生 Batch | 输入 ID 与逐项终态、保留策略 |
| 双向语音或互动 | OpenAI Realtime 或 Gemini Live | 有界连接端口、会话授权、媒体和中断 |

`Support.createModelProvider` 根据显式协议适配 Chat Completions、Responses、Messages、GenerateContent 和 Interactions。先确认模型支持所需模态、严格 schema 或工具能力，再选择适配器。服务器托管搜索要明确授权。模型提议的本地工具仍走应用执行。

后台任务通过 `runModelOperation` 进行单次提交、查询、读取或取消，`waitModelOperation` 提供有界轮询。批量可以用 `Support.createBatchModelProvider` 从可移植消息生成请求，按项目 ID 找回结果和失败。实时从 `openModelRealtime` 接入连接，由应用提供音频收发和短期认证。三种调用各自受约束，批量按实际生成项目记账，轮询查询不占用生成次数。

## 处理跨请求和连接的未确认结果

续接要核对协议、模型和宿主作用域。后台结果已被远端确认而本地保存失败时，`MODEL_OPERATION_SAVE_UNCONFIRMED` 携带确认的结果，可按原操作身份对账。批量任务完成后仍需逐项终态，`BATCH_ITEM_TERMINAL_MISSING` 表示该项缺少认可的生成终态。实时连接要等待可发送状态，使用当前轮次的中断和结果，避免已结束轮次的事件继续进入交付。

运行 `node node_modules/@jangts/agent-core/development/examples/model-protocols.mjs` 和 `node node_modules/@jangts/agent-core/development/examples/model-lifecycles.mjs`。它们用固定协议数据演示边界。真实能力和权限以目标模型和供应商环境的验证为准。[模型协议与生命周期](../docs/api/model-protocols.md) · [工作流设计 Skill](../skills/agent-core-workflow-design/SKILL.md)

[技术分享目录](README.md)

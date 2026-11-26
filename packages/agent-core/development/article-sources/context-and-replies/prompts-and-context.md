# 按任务阶段构造提示与上下文

客服回答“我的工单处理到哪了”时，需要当前应用规则、问题和刚执行的工单查询结果。以前的答复可以解释指代，更新的查询结果应决定当前状态。把这些材料按来源装配，后续调用才知道各自的用途和保留期限。

## 一次调用先用明确的消息

在现有 handler 中，把应用规则放入 system，把用户问题放入 user。进入模型前，应用依据请求身份读取所需记录。模型工具提议只有在授权执行并获得结果后，才作为工具结果参与合成。原始资料和历史中的文字始终作为数据传递。

当材料需要独立限长或诊断时，用 `Support.defineContextFragments` 为各个来源声明片段。

```ts
import { Support } from '@jangts/agent-core';

const context = Support.defineContextFragments<{ question: string }>([
  {
    id: 'rules', sourceId: 'app.reply-policy', role: 'system',
    trust: 'instruction', lifetime: 'configuration', maxChars: 300,
    format: () => '只引用已确认的记录。无法确认时说明缺失内容。',
  },
  {
    id: 'question', sourceId: 'request.question', role: 'user',
    trust: 'user', lifetime: 'turn', maxChars: 3000,
    format: ({ question }) => ({ question }),
  },
]);
```

用 `context.build({ input })` 构造输入并交给 Runner。增加查询回执时，可为它声明 `trust: 'tool'`、`lifetime: 'step'` 与独立字段。结构化用户片段的顶层字段须唯一。字符限制是应用选择，片段生命期用于说明当前装配作用域，数据库清理仍由宿主执行。

## 为决策、答复和压缩分别提供输入

选择工具时，只送入当前输入与允许的能力。组织答复时，送入实际回执和适用的答复规则。压缩历史时，可从 `context.plan` 接入 `Support.createContextProcessingNode`。默认验证只测量并检查装配，压缩策略与处理权限由应用明确选择。后续用返回的准备句柄发送，保持测量与实际请求一致。

检查 `fragmentUsage` 和 Provider 侧实际发出的请求，核对来源、输入长度和工具协议开销。观察数据只保留排查所需信息。可运行 `node node_modules/@jangts/agent-core/development/docs/examples/lifecycle-matrix.mjs` 对照不同阶段的实际能力。[上下文处理](../../docs/api/context-processing.md) · [工作流设计 Skill](../../skills/agent-core-workflow-design/SKILL.md)

[技术分享目录](../README.md)

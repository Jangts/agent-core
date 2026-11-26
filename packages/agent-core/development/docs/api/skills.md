# 通用任务 SKILLs

在 App 已经选定的任务阶段，从 `@jangts/agent-core/skills` 读取 `taskSkills[id]`。`description` 用于向模型介绍可选方法，`instructions` 是送入该阶段的正文。单一用途的 handler 可以直接选用固定 ID。

| ID | 适用时机 |
| --- | --- |
| `evidence-answering` | 已读取相关资料，需要回答事实问题并交代依据或缺项 |
| `guided-operation` | 用户请求操作步骤，App 已提供相应使用说明 |
| `option-comparison` | 用户需要按相同口径比较指定选项 |
| `structured-extraction` | 从指定材料提取目标字段及出处 |
| `tabular-analysis` | 用已接入的表格计算能力回答统计问题 |
| `delivery-review` | 按实际来源复核成稿、说明或报告 |
| `document-authoring` | 起草提纲、正文或局部修订 |
| `change-review` | 核对同一对象两个版本的实际差异 |
| `meeting-assistance` | 准备会前提纲或整理会后约定 |
| `task-planning` | 把目标拆成可推进的阶段、依赖和验收条件 |
| `task-handover` | 为接手者整理持续任务的当前状态和下一步 |
| `worklist-triage` | 盘点已有事项的处理次序与等待条件 |
| `asset-selection` | 从实际候选中选用符合用途的素材 |
| `data-quality-review` | 按已登记规则检查数据并报告实际覆盖 |
| `record-reconciliation` | 按稳定标识对齐来源并说明单侧缺失和顺序差异 |
| `import-preflight` | 核对导入差异、阻止项和待确认的目标基线 |

下面的 handler 使用当前请求的 ModelRunner。调用方通过已授权的读取接口取得本题资料，并检查回答中引用的来源。

```ts
import type { ModelRunner } from '@jangts/agent-core';
import { taskSkills } from '@jangts/agent-core/skills';

export function answerFromSources(
  runner: ModelRunner,
  question: string,
  sources: readonly { id: string; content: string }[],
) {
  return runner.invoke({
    input: [
      { role: 'system', content: taskSkills['evidence-answering'].instructions },
      { role: 'user', content: JSON.stringify({ question, sources }) },
    ],
  });
}
```

方法目录与条目均为只读。工具、身份和可执行动作由 App 注册，模型沿用当前请求的预算和取消信号。需要逐题生成、核验与有限修正时，在 Answering Kit 的 `generate` handler 中使用相同正文。[Answering Kit](knowledge-answering.md)

随包的 `skills/<id>/SKILL.md` 提供中文纯文本方法，可供按目录发现 Skill 的宿主读取。

开发者可以使用独立的[开发者 Skills](../agent-development.md#开发者-skills)设计、检查和验证 App 工作流。

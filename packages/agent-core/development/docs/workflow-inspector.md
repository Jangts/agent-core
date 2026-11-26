# 工作流检查器

工作流检查器是随 `@jangts/agent-core` 交付的可选开发工具。它核对实际注册图和 App 提供的声明引用，并生成离线 HTML，可查看有向图、路由优先级、节点详情、工具参数以及各个适配器的合同。

## 生成离线报告

在已安装 SDK 的 App 目录运行随包示例：

```sh
SDK=./node_modules/@jangts/agent-core
INSPECTOR="$SDK/development/scripts/workflow-inspector/cli.mjs"
node "$INSPECTOR" inspect \
  --entry "$SDK/development/examples/workflow-inspection.mjs" \
  --output .tmp/agent-workflow.html
```

打开生成的文件。点选节点可高亮入站和出站边，查看 handler、前置与产出。工具可独立搜索，也可按当前节点筛选并反查引用节点。实线表示跳转，虚线表示错误恢复，圆点为完成出口。共享一条边的路由分别按优先级列出。节点可拖动，图可缩放，复杂图仍可能有交叉连线。

## 接入 App 的真实声明

准备一个可信的纯声明 JavaScript 模块，导出已有的 `workflow`。需要补充信息时，导出 `inspection`：

```js
import { workflow, toolCatalog } from './agent-declarations.mjs';

export const inspection = {
  workflow,
  toolCatalog,
  nodeCapabilities: [{ nodeId: 'review', tools: [{ toolId: 'lookup', access: 'read' }] }],
};
```

检查器每次在新的 Node 进程中加载入口，读取公开的 `toGraph()` 和可选目录的 `values()`。入口的顶层代码必须可独立加载，避免启动 App、访问业务库、执行工具或请求模型。子进程继承命令行进程的权限并重新加载模块。TypeScript 使用 App 正常生成的 JavaScript。如果无法安全地单独加载声明，可直接用 `--input` 提供现有 JSON。

| 字段 | 合同 |
| --- | --- |
| `workflow` | 提供公开 [toGraph 合同](api/workflow-views.md) 的已注册工作流。 |
| `toolCatalog` 或 `tools` | 提供 `values()` 的公开注册目录，或带 `id` 的工具声明数组。可选字段为 `registered`、`description`、`kind`、`source` 和 `parameters`（JSON Schema）。缺少注册信息时显示未知。 |
| `nodeCapabilities` | 每个 `nodeId` 一条，可补充 `kind`、`role`、`tools: [{toolId, access?}]` 与 `adapters: [{id, description?, toolIds?, parameters?}]`。各适配器保留自己的工具列表和参数合同。 |
| `nodeMetadata` | 每个 `nodeId` 一条，可补充 `handler`、`source`、输入和输出 Schema（`input`、`output`）及 `completion` 说明。 |
| `routeConditions` | 按 `sourceNodeId` 与从零开始的 `order` 定位条件路由。可补充声明里的 `conditionSource` 和 `source`。 |

检查器核对入口、节点和边 ID、边的端点、节点的出入边、路由顺序和元数据引用。提供明确的工具清单后，绑定到清单外的工具会报错，绑定到未注册或状态未知的工具会提示。导出只投影约定字段：缺少的声明保持未知，不推断其值；未知扩展字段与运行正文不进入报告。它不会计算路由条件或访问远程 Schema。分享报告前确保其中的描述、来源和 Schema 适合相应受众。

用 `export --entry ./inspect-workflow.mjs > .tmp/workflow.json` 生成 JSON。用 `check --input .tmp/workflow.json` 单独核对引用，或用 `inspect --input .tmp/workflow.json --output .tmp/agent-workflow.html` 生成报告。JSON 支持原样的 `WorkflowGraph`，也支持 `{ graph, tools?, nodeCapabilities?, nodeMetadata?, routeConditions?, lifecycleMatrix?, chain? }`。

## 跟随源码更新

```sh
node "$INSPECTOR" watch --entry ./inspect-workflow.mjs \
  --source ./agent-declarations.mjs --output .tmp/agent-workflow.html
```

监视器按内容检查入口和显式列入的文件。每个需要触发刷新的依赖各加一次 `--source`。编译产物由 App 原有流程更新。来源指纹只覆盖本次列出的文件，路径相对于当前工作目录。

导出成功后原子替换 HTML。引用或导出出错会保留上一份报告，并在终端提示可能过期。重新打开或刷新文件即可查看新内容。加上 `--serve 4319` 后可自行打开 `http://127.0.0.1:4319/`，页面随已登记的源文件更新，失败时显示过期提示。服务仅开放报告和投影后的快照。

## 复盘指定运行

由 App 通过已授权的数据源调用 `workflow.toTrace(runId)`，把返回的 `WorkflowRunTrace` 导出为 JSON。检查时使用 `--trace ./run.json --run-id <id>`。链已包含在输入快照内时只需指定 `--run-id <id>`。

检查器验证运行与工作流身份，将 span、真实跳转、子日志元数据和覆盖情况独立展示。重复访问同一节点会保留各自 span，历史图外节点、缺失记录和历史名称仍可查。有对应的历史定义时优先使用它。报告排除运行事件正文与子日志 payload。

注册图用于查看可能路径，实际执行结论以运行链为依据。需要 Agent 辅助检查时，可使用安装包内的 [开发 Skill](../skills/agent-core-workflow-inspection/SKILL.md)。

对照两次导出或为路径编写用例，见[工作流变更检查与离线回归](workflow-development.md)。

评估节点边界时，结合[同一任务的两种组织方式](examples/organization-comparison.md)阅读实际处理函数、状态交接和故障断言。先确定成果和恢复责任，再检查注册图是否忠实表达它们；不能从图的布局或节点数量推断哪种设计更好。

## 证据边界

`check` 与 HTML 报告在引用警告之外提供 `evidence` 摘要。可选清单标为 `supplied` 或 `not-supplied`；缺少 handler、完成说明、工具绑定与注册状态的声明计为未知，不视为失败。显式空绑定列表与未提供列表不同。摘要只说明元数据可用性，不证明声明正确或完整。投影省略未知扩展字段与事件正文，不检查它们。

注册图描述可能路径；附带的运行链描述观察到的访问，保留来源覆盖状态（`true`、`false` 或 `unknown`）与问题。来源记录完整不证明业务完成。架构适用性、动态授权、副作用结果、工作流之外的请求恢复和持久化、真实模型语义及生产行为都需独立证据。零警告不代表这些属性通过验收。

## 生命周期矩阵

可选 `lifecycleMatrix` 描述阶段、工具钩子、全工具或选中执行范围和意图适用范围。检查器核对引用，HTML 可从单元关联 reported subflow 运行记录；缺失记录不等于未执行。完整字段、导出入口和证据边界见[矩阵范式](examples/lifecycle-matrix.md)。

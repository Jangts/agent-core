# 工作流图与运行轨迹

`workflow.toGraph()` 返回注册定义的纯拓扑，`await workflow.toTrace(runId)` 返回一次运行中该 Workflow 的实际节点执行。两者都是深度只读、可 JSON 序列化的数据，不包含 handler、条件函数、布局或渲染器。

运行轨迹 API 保留既有保存格式的 `nodes`、`transitions` 和 `subflow` 等字段。它们是序列化字段名；上报步骤不是可执行子工作流。检查器使用 `--trace`，并保留 `--chain` 输入别名。

这两个接口用于开发审查、调试、观测界面和演示。导出不参与 Agent 的决策、调度或任务执行，不增加业务能力；执行链是既有记录的只读投影，不是重放或恢复入口。日志可由 App 授权接入复盘，图与执行链没有自动接入学习或规则修改。

## 数据源与调用

```ts
const workflow = defineWorkflow({
  id: 'assistant',
  nodes,
  traceSource: async runId => {
    const capture = await authorizedRunReader.readAll(runId);
    return { events: capture.events, coverage: capture.coverage };
  },
});
const graph = workflow.toGraph();
const chain = await workflow.toTrace(runId);
// 临时导出可传入本次专用数据源，不修改 Workflow。
const exported = await workflow.toTrace(runId, authorizedSource);
```

`traceSource: WorkflowRunTraceSource` 是 App 的只读接口，接收 `runId`，返回 `Promise<{ events: readonly CoreDiagnosticRecord[]; coverage: WorkflowRunTraceCoverage }>`。App 负责授权、账户隔离、存储路径解析、保留期、分页和读取边界。Core 不保存全局运行日志，也不从最近一次运行取得数据。`add()` 返回的新 Workflow 沿用绑定的数据源。

空 runId 或未配置数据源抛出 `TypeError`；数据源读取错误原样传播；没有该 run／Workflow 的节点执行记录时抛出 `RangeError`。这与成功返回空图不同。读取期间 App 应返回一致快照，并对正在运行、缺失或无法证明完整的记录准确填写 coverage。

## WorkflowGraph

| 字段 | 类型与含义 |
| --- | --- |
| schemaVersion | `1` |
| workflowId / revision | 定义 ID／可选定义版本 |
| entryNodeId | 显式入口，不能用入边数推断 |
| nodes | 按注册顺序排列的 `WorkflowGraphNode[]` |
| edges | 按节点和路由声明顺序生成的 `WorkflowGraphEdge[]` |

节点字段：`id`、`name`（未声明时为 id）、`description`、`order`（从 0 开始）、`startsRound`、`requires`、`provides`、`routes`、`incomingEdgeIds`、`outgoingEdgeIds`。空合同及边集合返回空数组。

路由字段：`order`（节点内从 0 开始）、可选 `routeId`／`description`／`conditionId`、`conditional: boolean`、`edgeId`。路由顺序是匹配优先级；导图不执行 `when` 或 `complete`。

边字段：`id`、`kind: 'transition' | 'error' | 'complete'`、`sourceNodeId`、可选 `targetNodeId`、`routeOrders: number[]`、可选 `errorRouteId`。同一源节点、种类、目标合成一条边，多条路由通过 `routeOrders` 保留；普通跳转与错误恢复分别成边。完成边没有目标节点；错误边的 routeOrders 为空，errorRouteId 来自 onErrorRouteId。边 ID 是稳定的 JSON 元组 `[sourceNodeId, kind, targetNodeId ?? null]`，使用方将其视为不透明字符串。

注册时仅读取一次 `get routes()`，复制并封存路由。getter 必须是只依赖不可变定义的纯函数；运行条件应写在 `when` 中。执行与导图共享注册快照。导图不分析函数体，因此不包含节点内部工具调用或自定义子节点。

## WorkflowRunTrace

| 字段 | 类型与含义 |
| --- | --- |
| schemaVersion | `1` |
| workflowId / runId | 查询的 Workflow 与运行 ID |
| nodes | 按首次观察的 producerSequence 排序的节点执行 |
| transitions | 按 producerSequence 排序的真实跳转／完成事件 |
| coverage | 完整性、内容策略与缺失诊断 |

`WorkflowNodeVisit` 的身份是 `spanId`，另含 `nodeId`、可选 `workflowInvocationId`／`definitionRevision`／`name`／`description`／`kind`／`roundIndex`。同一节点的多次进入和同一 run 中多次调用 Workflow 均保留独立执行；历史或图外 nodeId 不丢弃，名称等只取历史日志，不从当前定义补齐。

每次执行还包含 `firstEventSequence`、`lastEventSequence`、可选 `enteredAtMs`／`endedAtMs`／`durationMs`／`usedModel`、`status`、`events`、`subflow`。时间为 epoch 毫秒，序号保留原始 producerSequence，不重新编号。status 为 `running | success | error | cancelled | unknown`，只反映本节点，错误恢复跳转不把失败节点改成成功。完整记录缺少退出时返回 unknown；不完整快照中已经进入但尚未退出的节点为 running。TIMEOUT 与 CANCELLED 均为 cancelled。

`events` 保存节点生命周期和普通 progress：`eventId`、`producerSequence`、`occurredAtMs`、`type: enter | progress | transition | complete | error`，以及可选 `phase`、`routeId`、`conditionId`、`errorCode`、`errorEventId`、`payload`。专用于 subStep 的 progress 归入 subflow，不重复记为普通 progress。

`WorkflowTransitionRecord` 字段为 `eventId`、`producerSequence`、`occurredAtMs`、`type: transition | complete`、`sourceSpanId`，以及可选 `targetSpanId`、`targetNodeId`、`routeOrder`、`routeId`、`conditionId`、`errorEventId`。只有实际事件才生成连线，不按相邻顺序或时间猜测。错误事件声明恢复目标时也生成 transition，其 eventId 与 errorEventId 均关联该原始错误事件。targetSpanId 只是选择后继的证据，不代替后继 enter；缺失后继记录会进入 coverage。

### 有序 subflow

`subflow` 是按节点内 sequence 排列的原始日志。它保留 `ReportedStepRecord` 字段：`origin`、`stepId`、`operation`、`targetStepId`、`sequence`、`createdAtMs`、`revision`、`subnodeId`、`type`、`kind`、`name`、`status`、`usedModel`、`startedAtMs`、`endedAtMs`、`relatedDefinitionId`、`relatedInvocationId`、`parentStepId`、`nextStepIds`、`caseId`、`summary`、`payload`。

每次 fix 保留独立 stepId 和 targetStepId，不合并或改写原记录。重复事件快照按本次 spanId 内的 stepId 去重。直接捕获写入／修正 progress 时补充 `sourceEventId` 和 `producerSequence`；仅在后续快照找到的记录不伪造原始事件序号。旧日志缺失 operation／createdAtMs／revision 时保留缺失并报告 historical-subflow-fields；元数据日志允许 name／kind／payload 等内容字段缺失。

subnodeId 和 type 由调用方定义；没有 subnodeId 的记录属于主节点自己的过程。Core 不生成 subnodes、默认分组、合并视图或子节点之间的连线。展示端可依自己的 DataModel 分组、投影多次 fix、过滤或展开；同组不保证连续，不推导串行或依赖。

### Coverage

`complete: boolean | 'unknown'` 表示数据源声明的事件覆盖；投影发现问题时降为 false。`content: included | omitted | mixed | unknown` 独立说明内容采集策略，未采集正文不等于事件丢失。`issues` 每项含 `code` 和可选 `spanId`／`eventId`／`count`。

Core 会追加 `conflicting-event`、`invalid-workflow-event`、`missing-node-id`、`conflicting-span`、`subflow-truncated`、`conflicting-subflow`、`invalid-subflow-progress`、`missing-enter`、`missing-exit`、`historical-subflow-fields`、`missing-target-enter`。App 可附加自己的读取诊断码。当前 v2 诊断封装不合法时由 normalizeDiagnosticEvent 抛错；Core 不把不可解析的数据伪装成成功历史。

精确的 readonly 类型通过根入口、`/engine`、`/types` 和 `/structs` 导出，见[公开符号参考](reference.md)。

# 从 0.9.0 升级至 1.0.0

按概念域更新 import、类型、配置和调用方，再验证原来的结果、授权、取消与恢复行为。规范名称用于新代码；保留的 deprecated 名称提供迁移入口，不表示存在两套实现。不要对保存载荷、提示词和业务数据做全局字符串替换。

## 模型交互与类型

| 0.9 名称 | 规范名称 |
| --- | --- |
| ModelTransportDefinition / ModelTransportRegistration | ModelInteractionDefinition / ModelInteractionRegistration |
| ModelStageTransportRegistration | ModelStageInteractionRegistration |
| createModelTransport / createStageModelTransport | createModelInteraction / createStageModelInteraction |
| createTextTransport / createJsonTransport / createPlainTextTransport | createTextInteraction / createJsonInteraction / createPlainTextInteraction |
| RegisteredTransportOutput | RegisteredInteractionOutput |
| ModelRunnerProvider | ModelProvider |
| LifecycleContext / LifecycleRun | ModelLifecycleContext / ModelLifecycleRun |
| OperationAction / OperationStatus | ModelOperationAction / ModelOperationStatus |
| ModelSessionCall / ModelSessionResult | ModelResponseToolCall / ModelToolResponse |
| PreparedSessionTransport / SessionModelTransportRegistration | PreparedModelToolInteraction / ModelToolInteractionRegistration |
| createSessionTransport / prepareSessionFunctions | createModelToolInteraction / prepareModelToolInteraction |

**准备产物有一个必须显式修改的同名类型例外：**0.9 的 `PreparedModelInteraction<Result>` 是单选准备产物，应改为 `PreparedModelSelection<Result>`；0.9 的 `PreparedModelTransport<Result>` 应改为新的 `PreparedModelInteraction<Result>`。新名字已用于最终结果收集合同，不能同时把它保留为旧单选类型别名。自定义 adapter 的 `prepare`、selection 解析和 `resolve` 应一同检查，不能只修 import 让错误合同碰巧通过编译。旧 `PreparedModelTransport` 仍可作为最终准备产物的 deprecated 别名。

普通模型选择中的 `transports` / `transport` 改为 `interactions` / `interaction`。旧键仍桥接至规范值；同时显式传入不一致的新旧值会拒绝，不静默择一。按入口只提供一套键最清楚。计量视图增加 `interactionId` / `interactionChars`，旧 `transportId` / `transportChars` 的兼容及保存字段保持；网络 HTTP、SSE 或双工 Transport 不按此表改名。有限文本/多工具结果的规范选择名为 `tools`，旧 `session` 选择保留兼容；真正实时会话不因此改成一次响应。

纯 operation、纯 realtime 及组合 Provider 保持各自能力，不为升级伪造 `stream`。本地工具提案、托管执行事件和本地执行回执仍需分别处理。

## 领域工具与生命周期

| 0.9 名称 | 规范名称 |
| --- | --- |
| GoalTool / GoalRegistry / createGoalRegistry | DomainTool / DomainToolRegistry / createDomainToolRegistry |
| GoalToolRegistration / RegisteredGoal / GoalId | DomainToolRegistration / RegisteredDomainTool / DomainToolId |
| GoalPolicy / GoalDescription | DomainToolPolicy / DomainToolDescription |
| CatalogGoal / CatalogTool | CatalogDomainTool / CatalogExecutionTool |
| Kit 的 Tool / ToolRegistration / RegisteredToolDefinition | LifecycleTool / LifecycleToolRegistration / RegisteredLifecycleTool |
| Kit 的 Policy / LifecycleHooks / LifecycleProtocol | ToolLifecyclePolicy / ToolLifecycleHooks / ToolLifecycleProtocol |
| ToolsOptions | ToolLifecycleRegistryOptions |

只迁移对应 Kit 类型的 import，不改 Core 的 `ExecutableTool`、基础 `ToolDefinition` 或业务中的普通 Tool。领域关系键 `goalId` / `goalIds` 对应 `domainToolId` / `domainToolIds`；`scopePolicy`、`targetPolicy`、`planIntent` 对应 `scopeMode`、`targetMode`、`planningAction`。旧输入按对应入口桥接，冲突不靠键顺序解释。规范目录投影与保留原形状的旧目录入口应按各自返回类型读取。

`asIntent`、`select({ intent: true })`、App 的 `goal`/`intent` 业务选择和模型可见的 `availableGoals` 等协议键保留原义；不要把它们机械替换成领域目录名称。领域工具和执行工具是不同 ID 集合，不要合并关联方向。

## 记录、轨迹与状态版本

| 0.9 名称或方法 | 规范名称或方法 |
| --- | --- |
| SubFlowLogger / ScopedSubFlowLogger | ReportedStepRecorder / ScopedReportedStepRecorder |
| SubFlowLog / RecordedSubStep / SubFlowValue | ReportedStepLog / ReportedStepRecord / ReportedStepValue |
| SubFlowStepInput / SubFlowStepFix | ReportedStepInput / ReportedStepUpdate |
| context.createSubFlowLogger() | context.createStepRecorder() |
| WorkflowChain / WorkflowChainNode | WorkflowRunTrace / WorkflowNodeVisit |
| WorkflowChainCoverage / WorkflowChainSource | WorkflowRunTraceCoverage / WorkflowRunTraceSource |
| workflow.toChain() / chainSource | workflow.toTrace() / traceSource |
| AgentFamily / FamilyRecord / FamilyVersion | BranchVersioning / BranchVersionRecord / BranchVersion |
| FamilyDefinition / FamilyStore / FamilyOperation | BranchVersioningDefinition / BranchVersionStore / BranchVersionOperation |
| defineAgentFamily / Family / familyOperations | defineBranchVersioning / BranchVersions / branchVersionOperations |
| AgentCheckpoint / AgentCheckpointRecord | AgentSnapshot / AgentSnapshotRecord |
| checkpoint / exportCheckpoint / restoreCheckpoint | snapshot / exportSnapshot / restoreSnapshot |

同一模块格式中的 recorder 旧名与新名是同一构造器，旧工厂别名指向规范函数。Engine 的新旧快照方法使用相同数据复制与身份校验机制，工作流的新旧轨迹方法读取同一授权投影。`traceSource` 与 `chainSource` 同时提供时明确拒绝，避免来源歧义。

Core 实际提供的运行上下文支持新工厂；既有自定义 `NodeReportingContext` 的旧合同不被强加新必填方法。需要规范工厂保证的类型使用 `RuntimeNodeReportingContext`，不要将任意旧替身直接断言为该类型。

这不表示所有旧上下文输入类型都原样兼容。`ToolExecutionContext`、`WorkflowContext` 及相关执行回调现在描述 Core 的增强产物，间接要求 `createStepRecorder`。0.9 使用者若手工构造这些对象或测试替身，需要显式迁移；不能将只实现旧方法的对象断言为新类型。已有 recorder 工厂可以绑定给规范方法，共用同一实例和 receiver：

```ts
const upgraded = {
  ...legacyContext,
  createStepRecorder: legacyContext.createSubFlowLogger.bind(legacyContext),
};
```

保留原来的 signal、诊断作用域及 report 绑定。此示例只适合原对象可安全展开的情形；带原型/私有状态的宿主应在自己的构造器或适配对象中显式绑定方法，不靠对象展开复制服务。Core 返回的上下文已提供两种方法，实际库执行不需要重复创建 recorder。该项与 Prepared 类型同名调整一样，是明确的 0.9 输入类型迁移项。

`ContextJournal`、`ContextRecord`、`ContextTrust`、`trust`、`Reflection` 保持原名和职责。`Delivery` 的规范命名空间为 `DeliveryPipeline`，旧名称保留兼容。快照不恢复任意执行位置，版本管理不等于多 Agent 调度。

## 旧记录与升级检查

保存键和身份不因源码改名重建。诊断中的 `recordedSubSteps`、`subflow`、`subStep` 与原格式标记保持；BranchVersionRecord 的 `revision`、`activeId`、期限和版本身份不被重算。WaitRecord 的定义/任务寻址、waitId、submission、有效期和终态保持，不重新 open 或延长等待。

Durable 的 `operationId` 标识稳定逻辑操作；已有 `commitId` 仍用于该次提交的精确确认，新提交生成新 commitId。continuation 的协议/模型/scope、完整历史锚点与逐轮原生块保持，厂商字段和签名不得批量改写；历史工具名变化须按协议显式兼容或拒绝。

分别检查新接入和旧使用者升级：公开 ESM/CJS import、严格类型、自定义对象与原型实例、adapter 结果推导、取消/拒权、旧记录读取及必要恢复。保存格式按自身合同读取或拒绝，不将“升级了包”当作任意旧格式已转换。包体、依赖、可选 peer、文档与消费者应对应同一实际候选；本地构建、模拟器和真实外部服务证据分别判断。

维护边界见[版本兼容与维护](compatibility.md)。

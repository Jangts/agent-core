# 概念与职责

Agent Core 的规范名称表达能力的实际职责。相同对象在 API、配置、示例和诊断中保持一致；不同生命周期与证据性质不因名字相似而合并。

## 执行与状态

Engine 编排一次运行；Workflow 定义节点及路由，Node 是可调度处理单元，State 是宿主拥有的运行状态。ModelRunner 提供模型调用的预算、取消、输入输出和结果保证。Provider 实现模型能力，Adapter 映射表达方式；服务品牌不是授权或能力事实来源。

WorkflowGraph 是已注册的静态拓扑。WorkflowRunTrace 是实际访问及转移的记录，允许同一节点多次出现，并明确覆盖度。ReportedStep 是处理单元报告的内部过程，生产者可以是 App 或显式接入的原生边界；它不是可执行子工作流，也不自动证明业务动作完成。

AgentSnapshot 保存宿主数据及分支身份，不保存任意工作流的执行游标。DurableCheckpoint 保存顺序任务恢复位置及其有界执行状态。BranchVersioning 管理分支上的 App 状态版本、合并和活动指针；BranchVersionRecord 的 CAS revision 不是保存格式版本。这些能力不等价于多 Agent 调度或通用程序恢复。

## 模型交互与工具

ModelInteraction 描述模型请求的表达、结果收集及解析。网络 Transport 负责 HTTP、SSE 或双工传输，不决定业务工具选择。PreparedModelSelection 是单选适配器的准备产物；PreparedModelInteraction 的收集器返回最终类型化结果。有限单次文本与多个工具提案的响应不是长期实时会话。

DomainTool 是可选领域操作的声明，执行工具拥有实际处理、授权和结果合同。LifecycleTool 增加可选贡献及阶段 hook，仍使用 Core 的真实调用路径。`asIntent` 与 `select({ intent: true })` 只是已注册工具的意图识别视图，不动态发现工具，也不授权执行。App 自己的 goal 等业务字段可表示用户目标，不能因此与 SDK 领域工具目录混为独立同名实体。

宿主规范目录使用 `domainTools`、`executionTools` 和 `domainToolIds`；当前 `modelCatalog` 的 `availableGoals`、`availableGoalIds`、`goalIds` 是既有模型投影协议，保留其字段和含义。诊断分类、保存字段及私有实现文件路径也不因公开源码名变化而机械改写。

Proposal 是提案，Selection 是解析后的选择，Invocation 是一次真实调用；厂商托管执行与本地工具执行分别记录授权和回执。函数专用 wire 结构仍使用 Function 名称，不以 Tool 字样暗示支持任意工具类别。

## 上下文、记录与交付

ContextFragment 是待装配输入片段，ContextPlan 是装配前计划，BuiltContext 是装配结果。`trust` 参与角色限制与结构审计，不是普通来源标签。ContextJournal 只保存请求内供上下文使用的选定调用事实，不是全量调用账本、聊天历史或持久恢复日志。

Registry 拥有注册和封存，Catalog 提供目录视图；安装目录还可有按序执行的局部合同，不能因命名而提前计算条件或改变失败行为。Definition、Options、Settings、define、create、register、bind 按具体职责使用，不要求所有能力增加同一层包装。

DeliveryPipeline 按声明顺序执行交付阶段并显式完成，不是通用 Workflow。Reflection 从授权证据分析观察、假设与建议，不自动学习、改变策略或发布结论。文本 Skill 提供方法说明，不是可执行 handler 或权限。

## 分歧与接纳

材料冲突、字段合并冲突与认知分歧有不同含义。ResultReview 的确认表示可复现分歧，不代表事实正确；覆盖完成也不保证正确。Waiting 的 `resolved` 只表示答复被记录，裁决答复、处置建议、结果接纳和业务提交分别由对应合同保证。

取消等待、请求取消、确认停止及状态未知分别表达；执行完成不等于结果已接纳或业务已提交。身份、内容修订、策略修订、CAS 代次、尝试次数和格式版本不得混用。

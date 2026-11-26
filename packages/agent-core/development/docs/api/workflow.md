# 工作流入门

用 `defineWorkflow` 声明普通节点。省略入口时，从首节点开始并计入首轮。

```js
const agent = new AgentCoreEngine({ workflow });
agent.bindToolRuntime(tools);
const result = await agent.run({ name: '演示服务' });
```

构造时可以省略 `workflow`，之后用 `agent.bindWorkflow(workflow)` 绑定一次。
`bindModel` 和 `bindToolRuntime` 同样各绑定一个依赖。工具目录用 `register` 或
`registerAll` 登记多项工具。

在普通节点的 `run` 中，用 `tools.invoke({ toolId, input })` 调用已绑定的工具。
Core 使用当前节点的诊断记录调用，节点用返回值更新状态。

工作流状态使用普通可变对象。节点返回的更新一次性校验 `provides` 和所有写入目标，再一起提交。要更新的字段须为可写数据属性，新增字段要求状态可扩展。写入合同不满足时抛出 `WorkflowContractError`，同一批次的字段保持原值，并跳过 `onErrorNodeId`。

需要模型时，可以直接构造 `new AgentCoreEngine({ workflow, model: { provider, maxCalls } })`，
也可以省略模型，之后用 `agent.bindModel({ provider, maxCalls })` 绑定一次。
节点仍调用 `model.invoke({ input })`。Runner 在本次运行第一次使用模型时创建，
后续节点共用这次调用预算。模型和工具都由 Loop 接入当前节点的诊断。

`agent.switchModel({ provider, maxCalls })` 替换后续运行的模型配置。
已经开始的运行继续使用启动时的配置与预算。Workflow 保持一次绑定。

模型安装时固定规范回调、传输原对象对应的定义和纯预算配置；每次运行仍新建自己的调用预算和收集器。App 服务实例不被整体冻结，原方法仍能读取服务内部的动态状态。上下文策略由普通节点登记，Core 不隐式调度。

`agent.bindModelRuntime(runner)` 接入已有 Runner，节点继续使用 `context.model.invoke`／`prepare`。未绑定的共享 Runner 由 Engine 按每次 run 的 execution 自动绑定，允许独立运行；已绑定请求或不提供 bind 的结构化服务沿用原预算、取消与观察寿命，不允许重叠运行，复用不获赠额度。fork 须显式恢复分支模型。静态 bindModel 则按每次 run 新建 Runner。详见[已有请求模型服务](core.md#已有请求模型服务)。

`context.tools.invoke` 将单次请求的 signal 与 Workflow signal 合并。局部取消只终止该次工具调用，不能替换或延长 Workflow 的执行期限。

合并信号在 Engine 调用边界统一检查并用于停止等待；手写 ToolBinding 与 ToolRegistry 获得相同保证。迟到返回不能变成成功结果，真实副作用的取消及回执仍由 App 实现。

给已有流程加一个节点和接入路由时，用 `workflow.add({ nodes, routes })`。
它一次校验新增节点和接线，并返回新定义。也可以传入另一份 Workflow，再传入接入路由。
独立使用新定义时，将它登记到新 Agent。已有业务实例需要复用装配时，可以派生一个实例。

```js
const at = agent.snapshot({ conversationId, revision });
const upgraded = agent.fork({
  at,
  workflow: extension,
  resume: snapshot => restoreBranchDependencies(snapshot),
});
const result = await upgraded.run({ name: '演示服务' });
```

[完整离线服务问答示例](../examples/offline-agent.md)展示工具与模型节点的基础组合；Workflow 派生沿用上文的 add／fork 合同。

检查点保留宿主提供的数据副本。派生实例延续 Agent 身份，取得新的分支和版本身份。
`resume` 根据检查点为新分支恢复依赖。请求级 App 对象与工具运行时须单独恢复，
固定模型配置可复用。每次运行有自己的 `workflowInvocationId`。
`exportSnapshot(at)` 返回可序列化的数据副本及完整分支身份。App 保存记录后，可以用 `new AgentCoreEngine({ branch: record.source, workflow, app })` 重绑依赖，再调用 `restoreSnapshot(record)`；分支身份必须完全一致。数据记录不携带可执行函数、工具实例或有效授权。持久版本、合并及显式启用见 [BranchVersions](advanced-agents.md#持久分支与显式启用)。

`fork` 默认继承原 Workflow。传入 `workflow` 时，内部调用原 Workflow 的 `add` 完成组合和校验。独立新建实例时，可以直接调用 `baseWorkflow.add(extension)`。

## 使用多个已配置的模型

只用一个模型时，继续用 `{ workflow, model }`。需要多个模型时，在构造器登记配置：

```js
const agent = new AgentCoreEngine({
  workflow,
  models: { fast, reasoning },
  model: 'fast',
  maxModelCalls: 4,
});

await agent.run(input);
await agent.run(nextInput, { modelId: 'reasoning' });
```

节点可用 `model.invoke({ input })` 继承本次运行的默认模型，也可在同一次运行
用 `model.invoke({ modelId: 'reasoning', input })` 选择另一个配置。选择顺序是
节点调用指定的 ID、请求指定的 ID、实例默认 ID。只登记一项时可省略默认 ID。
登记多项且省略 `model` 时，调用必须提供 ID。构造时传入的模型 ID 必须存在于 `models`。

`agent.switchModel('reasoning')` 修改后续运行的默认项。每个模型保有自己的调用上限，
配置 `maxModelCalls` 时还受同一次运行的总上限约束。各次运行分别计数。

## 单条等值路由

`route.toIfEqual(target, path, value, options?)` 生成一条普通跳转路由，使用严格相等判断。
同一个状态查询分支的前后写法如下。

```js
// 手写
{ id: 'to-service', conditionId: 'intent.status',
  when: state => state.intent === 'status', targetNodeId: 'service' }

// 使用 route
route.toIfEqual('service', 'intent', 'status', {
  id: 'to-service', conditionId: 'intent.status',
})
```

第四参数可省略，也可以补充 `description`。生成的路由可与手写条件、完成路由
和兜底路由放在同一个 `routes` 数组，沿用原有校验和诊断。

对普通字面值，省略标识时会生成稳定 ID。`id` 由字段、值和目标节点派生。
`conditionId` 在注册时从源节点 ID 和最终路由 ID 展开。两者均可独立覆盖。对象引用或 Symbol 条件可显式填写标识。
自动标识包含条件值，若值属于私密数据，请显式填写两个日志标识。

同一节点内的路由 `id` 重复时，首项保留原值，后续项按顺序补 `~2`、`~3` 等后缀，并避开已有 ID。手写路由和生成的路由共用此规则。

路径支持点分字段。数组下标也用点分形式，如 `aaa.0.bbb`。例如 `route.toIfEqual('deliver', 'decision.type', 'reply')`。
需要比较两个状态值时，用 `route.toIfEqualWith('deliver', 'decision.id', 'expected.id')`。
路径缺失时读到 `undefined`，比较仍使用严格相等，所以两条路径都缺失时也会匹配。

### 无条件跳转

`route('repair')` 与 `route.to('repair')` 是同一个无条件跳转生成器，生成 `{ id: 'to-repair', targetNodeId: 'repair' }`。
需要保留自定义标识时，传入 `route.to('repair', 'retry-repair')`。

### 条件跳转

`route.toIfDefined('failure', 'error', { conditionId: 'review.to-failure' })`
在字段值不为 `undefined` 时跳转，默认路由 ID 为 `to-failure`。
处理状态中已记录的错误时，可直接用 `route.toIfError('failure', { conditionId: 'review.to-failure' })`。

默认读取状态的 `error` 字段。使用其他字段时，传 `route.toIfError('failure', { errorKey: 'reviewError' })`。

字段和目标节点同名时，用 `route.toIf('recovered')`。字段为真值时才跳转。

`route.toIfNotEmpty('candidate', 'candidates')` 在状态数组有元素时跳转；路径不存在或数组为空时不匹配。字段路径支持 `result.items`、`groups.0.items` 这样的点分路径，`toIfDefined` 和 `toIfError` 的 `errorKey` 也使用相同的路径读取方式。
`route.to*` 一般省略路由 ID。现有方法习惯按目标生成 `to-${target}`。

### 交付路由

- `route.deliver('result', { id })` 到达终点就交付必需结果，缺失时抛出合同错误。
- `route.deliverIfReady('result', { id, conditionId })` 有结果就交付，否则继续判断下一条路由。只有 `undefined` 表示缺失。
- `route.deliverWhenComplete('outcome', { id, conditionId })` 消费 SDK 的 `StepOutcome`。完成时交付其中的 `value`，继续时判断下一条路由。

需要判断并解包同一个 `StepOutcome` 时，可用生成器保留相同的普通路由合同：

```js
// 手写普通路由
{
  id: 'complete',
  conditionId: 'dispatch.complete',
  when: state => state.outcome?.type === 'complete',
  complete: state => {
    const outcome = requireWorkflowValue(state, 'outcome');
    if (outcome.type !== 'complete') throw new TypeError('Expected a complete outcome');
    return outcome.value;
  },
}

// 使用路由生成器
route.deliverWhenComplete('outcome', {
  id: 'complete',
  conditionId: 'dispatch.complete',
})
```

每个 `route.xxx()` 方法返回一条普通路由，
由 `routes` 数组决定顺序，由 `defineWorkflow` 统一校验。

`conditionId` 支持 `{nid}` 和 `{rid}`。Workflow 注册时分别替换为源节点 ID 和最终路由 ID，
后者包含自动去重的后缀。手写路由可以直接写 `conditionId: '{nid}.{rid}'`。
现有条件跳转生成器一般采用这个模板，显式传入的 `conditionId` 优先。

交付生成器默认用 `complete` 作为路由 ID。条件路由默认用 `{nid}.{rid}` 作为条件 ID，
因此采用这些命名的调用可以省略整个 options。需要自定义标识时，可显式覆盖。

手写路由可省略日志标识。Workflow 保留省略的 `id` 和 `conditionId`，
只解析显式提供的占位符。引用 `{rid}` 时，该路由须提供 ID。

路由生成器各自决定输出的默认值。以下是现有方法的命名习惯。`route.to` 使用 `to-${target}`，交付生成器使用
`complete`，等值跳转按字段、值和目标派生。生成器可以自行定义命名方式。
Workflow 统一处理已有配置中的标识冲突和占位符，缺失的标识保持为空。

## 节点报告

Loop 自动记录节点进入、跳转、完成和异常。节点需要补充业务细节时，可在定义中提供
`report(update, context)`，返回 `{ usedModel, payload }`，各字段均可省略。子日志通过 `context.createStepRecorder()` 绑定当前执行，write／fix 自动实时入账，无需返回或提交实例。这个完成回调只在诊断允许内容时调用，读取的是状态更新的副本；需要在元数据模式下保留的 `usedModel` 应在运行中通过 `context.report` 提交。
Loop 将这些补充信息附在节点的完成或跳转记录上。报告失败时，原节点事件仍然记录。

节点中的 `model.invoke` 也接受已登记的结构化传输对象。`model.invoke({ input, transport })`
从对象合同推断输出类型，同一字段也接受 ID 引用。两种写法共享节点的诊断和请求预算。

### 节点运行中的报告

`run(state, context)` 可调用 `context.report({ usedModel, payload })` 报告进度。usedModel 是本次节点自身的可选布尔元数据，未上报保持未知；payload 仅在内容获准时读取。`context.createStepRecorder()` 创建本次执行唯一实例，write／fix 自动入账，无需在报告中提交；readAll 向任何实例持有者提供只读查询。write 先记意图并返回 ID，fix 补后续结果，readAll 返回固定格式不可变快照；写入和补全复用现有 node.progress，短路或抛错也保留已送出的起始记录。报告不提交业务状态，也不决定路由；Loop 补齐节点身份、时间及事件序号。取消或节点结束后 logger 解绑，write 返回 -1、fix 返回 false 且不报错，readAll 持续可读。结束时的节点 `report(update, context)` 继续用于内容获准时的补充报告。合同见[子日志实例](observability.md#子日志实例与先记后补)。

## 节点缓存

Engine 构造参数 `cache: { maxEntries: 1024, ttlMs: 60000 }` 控制实例级内存缓存；maxEntries 缺省 1024，ttlMs 省略表示不按时间过期，采用全 Engine 的 LRU 淘汰，不使用后台定时器。值按引用保存，允许存 undefined，has 可区分未命中与已存 undefined。delete 返回是否删除，set／clear 返回 void。

每个节点通过 context.cache 访问自己的分区。get(key, { nodeId }) 可读取其他节点分区；has、set、delete、clear 只能操作当前节点，clear 不清空其他分区。run(step) 使用保留分区 `$step`。同一 Engine 跨 run 共享；fork 保留容量配置但不复制缓存数据。

可选构造参数 agentCache 接收 AgentCachePort。节点的 context.agentCache 是异步视图，未提供端口时不存在。端口用命名 address 接收 nodeId、key、persistence、signal；clear 接收不含 key 的分区地址。端口方法保留原对象 this。所有节点操作前后检查本次取消；取消不会回滚已开始的 App 存储写入。

```ts
// 在节点 run 中：
context.cache.set('selection', value);
const prior = context.cache.get('selection');
if (context.agentCache) {
  await context.agentCache.set('summary', summary);
  const saved = await context.agentCache.get('summary');
}
```

agentCache 每个操作默认 persistence: false；true 必须由 supportsPersistence: true 的 App 端口明确支持，否则拒绝。两种空间不回退、不镜像，delete／clear 仅影响指定空间及当前分区。App 负责容量、TTL、序列化、用户／租户隔离和持久化。节点分区不是授权边界，不复用权限结论。

缓存不进入 checkpoint／状态／Durable 恢复。fork 的 resume 可显式返回 agentCache 重新绑定 App 端口；默认不继承。需要重放或持久业务事实的数据仍使用原 state 补丁或 App 存储。取消后不可继续使用捕获的节点缓存视图。

## 开发辅助：工作流图与运行轨迹

这两个只读导出接口不参与 Agent 的实际调度或业务执行。`toGraph()` 导出注册拓扑，`toTrace(runId)` 读取并聚合真实主节点执行，节点内部保留有序 subflow。字段、数据源、覆盖与展示边界见[工作流图与运行轨迹](workflow-views.md)。

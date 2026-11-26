# Agent Core 日志规则

Agent Core 提供可选的执行事实观察和日志输出。事件描述库自身的模型调用、协议解析、工具执行与工作流，不包含 App 或 Kit 的业务日志。调用合同以[日志与调用链](../../packages/agent-core/development/docs/api/observability.md)为准。

事件类型在 `src/structs/diagnostics.ts`，内容分类在 `src/diagnostics/catalog.ts`，共同事实源在 `src/execution/events.ts`；`src/diagnostics/index.ts` 提供创建与当前记录校验入口。监听与持久输出消费同一事实，不能各自制造一次执行身份。

## 接口与启用

```ts
const diagnostics = createDiagnostics({ output: {
  accepts: descriptor => descriptor.content === 'metadata',
  write: event => output.write(event),
}, runId });

const model = new ModelRunner({ provider,
  execution: { signal, diagnostics: diagnostics.child('main') },
});
```

`CoreLogOutput.accepts` 可按事件名称和 `metadata/content` 分类筛选；`write` 接收类型化联合 `CoreEvent`。事件包含 `version=2, eventId, type, producerSequence, occurredAtMs, runId, spanId, parentSpanId, invocationId, payload`。所有子上下文共享一个序号源，span 使用父路径和局部 ID 组成。

没有 output 且没有接纳该事件的监听器时，不求值该事件的惰性 payload；未注册持久输出不会禁止实时监听。旁路监听通过 `execution.observe.event` 注册，缺省仅接纳元数据；内容须由该消费者明确接纳。各消费者的过滤与副本独立，观察错误不改变业务结果。按序等待的 `ModelRunner.sink.output` 是内容交付端，失败会传播，不能把它当作旁路监听。运行需要的预算、journal、当前调用状态和工具回执仍按执行契约维护。

请求实例通过 execution 接收 DiagnosticContext；Provider 从 ModelProviderContext 取得它。Support Provider 通过自己的可选 `ProviderObserver` 交出网络观察；App 可利用每次调用的 options 关联请求。共享 Provider 不保存可变的“当前请求”。

## 事件清单

| 事件 | 分类 | 触发与内容 |
| --- | --- | --- |
| loop.event | metadata | 低层有界循环的真实步骤与结束；不伪装成 Workflow 主节点 |
| model.start / model.binding | metadata | 模型调用开始及已登记模型绑定的处理状态 |
| model.prepare | content | 调用前的实际角色消息、transport 选项、schema 与 fragment 元数据 |
| model.output | content | 每个已接收的逻辑片段，包含文本或函数参数增量及片段序号 |
| model.parsed | content | finish/decode/resolve 成功后的对象 |
| model.end | metadata | finally 中的调用状态、耗时、用量、已接收片段数及错误 |
| runtime.rejected | metadata | 调用前的取消、传输缺失、调用／输入／schema 预算拒绝 |
| workflow.event | metadata | 节点进入、路由、完成与错误代码，不递归复制 workflow state |
| node.progress | metadata（正文另行授权） | 活跃节点 report／子日志 write、fix 的状态与修订，Core 补齐身份；payload／subSteps 仅内容获准才采集，不是内部执行证明 |
| tool.call / tool.result | metadata（正文另行授权） | 工具身份、调用和完成状态；input/value、详细错误和subSteps仅内容采集时附带 |
| rule.result | metadata | 工具边界失败的名称、input/execute/output 阶段与错误 |

表中解释不替代实际 `coreEventCatalog` 和 `CoreEventPayloads` 声明；新增目录项与类型由同一声明约束。Core output 只记录 Core 自身运行，不接收 Support／Kit 的业务事件，也不提供它们的统一日志总线。Support／Kit 的返回值、异常和可选 observe 回调由 App 自行收集。Kit 调用 Engine／ModelRunner 时，底层 Core 自身的模型、预算、取消和工作流事件仍属于 Core 运行日志。未登记事件名会被忽略，其 payload 不求值。

函数参数和无效 JSON 在 push、finish 或 resolve 抛错之前发出 `model.output`；原文、解析值、后续拒绝分别追加事件。Support 的 `provider.frame` 是取得的 SSE data，Core 的 `model.output` 是适配后的逻辑片段，两者由不同观察端口提供。Provider 的 request、response、frame、error-body、end 事件由 App 采集，接口见 [ProviderObserver](../../packages/agent-core/development/docs/api/support.md#provider预览和流)。自定义 Provider 只提供其实现可观察到的层次。

工具与模型内部异常保留原始业务错误；诊断中的错误投影含 name/message/stack/code/errors。正文省略、秘密过滤和访问规则由 output 实现。通用 `breakWhile` 的显式 observer 是独立接口，不安装全局的请求日志观察器。

## 生命周期与隔离

创建入口是createDiagnostics({ output, runId, spanId })。DiagnosticContext.identity提供只读运行身份；child(id, fields)可附加执行归属。Core 事件使用当前 v2 信封：eventId/type/producerSequence/occurredAtMs 与 run/span 关系，以及可选 invocationId/definitionKind/definitionId/definitionRevision/nodeId/stageId。

真实模型及工具调用使用同一 invocationId 关联返回结果与日志，子调用保留明确父 span。工作流每次访问节点生成独立 span，所选路由可登记 routeId/conditionId，错误可定位 phase/failedRouteId。绑定后的 `context.model` 和 `context.tools` 自动沿当前节点作用域调用；自定义服务仍须传递实际上下文，Core 不猜测 App 内部调用关系。声明 revision 可选，目前不保证跨改版的历史图完整匹配。

节点运行中的 `context.report({ usedModel, payload, subs })` 与结束时的节点 `report(update, context)` 有不同触发时机，共用既有事件出口。usedModel 为节点本次自身的可选布尔元数据，不混入业务状态，不自动汇总子节点。结束回调仍仅内容获准时求值，元数据标记在运行中通过 context.report 提交。

context.createStepRecorder() 已绑定当前执行，每次访问复用唯一实例，由 runtime 接收 write／fix 快照并立即发布 node.progress，无需节点提交实例或结束时回读；readAll 仅供内部查询。write／fix 生成有界、不可变追加序列，报告不接收 logger 或数组。write 时先追加计划事实，fix 以独立 ID 追加结果修订，通过 targetStepId 关联原 write，旧快照与历史事件不改写；短路或未取得结果时保留未完成记录，不虚构终态。实现位于 execution/reporting.ts、diagnostics/sub-flow.ts 和 execution/events.ts，规范字段／限制见[使用合同](../../packages/agent-core/development/docs/api/observability.md#子日志实例与先记后补)。事件 subSteps 缺省为空、origin=reported；元数据模式不读取私有正文 getter。节点结束或取消后 logger 解绑，write 返回 -1、fix 返回 false，不报错且不读取入参；readAll 对任何保留实例的持有者持续可读，报告不接纳迟到修改，不改变原日志开关、失败隔离及保留期。

output 的同步异常、异步 rejection 和 accepts 失败都在通知边界隔离，不替换业务错误，不触发重试。通知不等待持久化；慢 output 的队列和容量由消费者负责。

库不读取环境变量，不管理文件、数据库、保留期或消费者的 flush。调用方创建并关闭 output，按需要提供存储、脱敏、背压和健康告警。

独立回归：`node --test test/diagnostics.test.mjs`。包同时提供 ESM、CommonJS 和平台无关类型入口。

## 文件适配与读取边界

现有 App 在 `apps/server/src/common/diagnostics/session.ts` 和 `apps/banker-api/src/infrastructure/diagnostics/session.ts` 将 Core output 接到 `FileLogSession.recordFact`。身份、type、payload 与 subSteps 平铺于一条事实，适配器另加 source、app、traceId、采集 sequence 和 recordedAtMs；不能再用 `record('core', ..., () => fact)` 把整条 Core 信封包进 payload。

`record(source, event, payloadFactory)` 仍是 App／客户端自有记录的当前入口，拥有自己的 schemaVersion、event、recordedAt 与 payload；它与 `recordFact` 是两种当前来源，不是新旧 Core 格式。Core 事件内部 `payload.event` 等类型化字段也不等于存储重复包装。

文件读取由 `@jangts/diagnostics` 的 App 侧存储适配及 inspect CLI 承担。Core 不因此获得文件读取、日志回查或模型处理权限。现行关联、Journal、平铺落盘与当前格式校验见[日志与调用链](../../packages/agent-core/development/docs/api/observability.md)。

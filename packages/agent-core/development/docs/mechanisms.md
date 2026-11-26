# 工作机制图解

[返回开发指南](README.md) · [API 手册](api/README.md) · [知识回答合同](api/knowledge-answering.md)

本文用图解释当前实现。标为「App 组合示例」的流程由应用显式编排，不是 Core 内置的固定 Agent 流程；Core 不要求 App 使用 Support、Kit 或任务拆分。

## 1. 总体协作关系

```mermaid
flowchart LR
    User[用户输入] --> App[App：身份、配置、业务编排与交付]
    App -->|调用运行 API、登记 handler| Core[Core：执行、模型、工具、上下文合同]
    Core -->|按登记合同回调| Handler[App handler：业务处理与实际端口]
    Handler -->|状态更新、结果或错误| Core
    App -->|可选接入辅助| Support[Support：构造配置、适配器与 handler]
    Support -->|产物交给 App 登记| App
    Handler -->|按需调用| Kit[可选 Kit：知识、回答、呈现、交互等]
    Kit -->|局部业务结果| Handler
    Handler --> IO[App 数据库、文件与外部服务]
    Core -->|ChatProvider 合同| Provider[App 提供的模型连接]
    Provider --> Model[模型服务]
    App --> Output[用户可见输出]
```

Core 与 App 是调用／回调关系。Support 辅助 App 接入同一套合同；Kit 由 App 单向选用，Kit 内也可调用 Core API，继续受同一预算、取消与错误合同约束。

## 2. 任务概念如何对应执行机制

```mermaid
flowchart TD
    Question[用户问题] --> Compose[App 根据业务组织本轮处理]
    Catalog[集中能力清单：用途、schema、约束、handler] --> View[本轮可见能力视图]
    Identity[服务端身份与资源权限] --> View
    View --> Compose
    Compose --> Workflow[可选 AgentWorkflow：声明执行节点与路由]
    Workflow --> Node[节点：requires、run、provides、routes、onErrorNodeId]
    Node --> Handler[App handler]
    Handler --> Model[ModelRunner：取得模型提议或回答]
    Handler --> Tool[ToolRegistry：执行已登记工具]
    Handler --> Tasks[可选 Answering：领域回答任务]
    Tasks --> Definition[任务声明：id、inputSchema、readerId、outputId、checkIds、domainToolIds、scopeId]
    Definition --> Evidence[App reader：授权、实际读取与证据]
    Evidence --> Items[AnswerItem：来源状态及所属输入 ID]
    Items --> Answer[生成、检查、局部修正与交付状态]
    Model --> Update[handler 返回结果或局部状态更新]
    Tool --> Update
    Answer --> Update
    Update --> Route[Core 提交合规更新，再按声明选路]
    Route -->|继续| Node
    Route -->|完成| Result[返回 App 交付]
```

这里的三个概念不同：**用户问题**是输入，**工作流节点**是执行阶段，**回答任务／条目**是 Answering Kit 的领域对象。一个节点可以处理多个回答条目；模型提议不会自动创建工作流节点或安装新 handler。基础 `ModelRunner.invoke` 调用无需工作流或回答任务。

## 3. Core 工作流怎样推进

对应 `AgentWorkflow` 与 绑定后的 `AgentCoreEngine.run` 的实际规则。

```mermaid
flowchart TD
    Definition[App 声明工作流清单] --> Validate[构造时校验：节点、路由引用、可达性与有界环]
    Validate --> Entry[entryNodeId 对应 startsRound 节点]
    Entry --> Abort[检查取消，取得目标节点]
    Abort --> Round{节点标记 startsRound？}
    Round -->|是| Budget{轮次预算足够？}
    Budget -->|否| Exhaust[抛出预算耗尽错误]
    Budget -->|是| Count[消耗一轮]
    Round -->|否| Enter[发出 enter 事件]
    Count --> Enter
    Enter --> Requires[检查 requires 字段]
    Requires --> Run[调用节点 run，取得局部更新]
    Run --> Commit[检查取消、更新形状与 provides，再提交更新]
    Commit --> Select[按 routes 顺序选择首个匹配项]
    Select --> Route{匹配结果}
    Route -->|目标节点| Transition[发出 transition，清除上一节点错误]
    Transition --> Abort
    Route -->|complete| Complete[计算结果、isResult、检查取消]
    Complete --> End[发出 complete 并返回]
    Route -->|没有匹配| Contract[工作流合同错误]
    Requires -.->|异常| Error[节点 try 范围内错误处理]
    Run -.->|异常| Error
    Commit -.->|异常| Error
    Complete -.->|异常| Error
    Contract --> Error
    Error --> Recover{未取消、非合同错误且有 onErrorNodeId？}
    Recover -->|是| ErrorNode[携带 context.error 转到错误节点]
    ErrorNode --> Abort
    Recover -->|否| Throw[抛给调用方]
```

只有进入 `startsRound: true` 的节点才消耗一轮，同一轮里的其他阶段不另计轮次；所有可能的环（含错误路由）必须经过轮次边界。入口节点省略该字段时默认开始一轮。预算入口检查在节点 try 范围之外，耗尽不会转入该节点的 onErrorNodeId。`run(step)` 使用显式 StepOutcome：`{ type: 'continue' }` 继续，`{ type: 'complete', value }` 完成；value 可以合法地是 undefined。

提交保护只覆盖 Core 管理的局部状态更新；它不回滚 handler 已发生的外部写入。诊断观察失败不会改变业务执行。

## 4. 模型提议到工具实际执行的时序

**App 组合示例**：使用 Support 工具清单、ModelRunner 与 Core 工具执行器。

```mermaid
sequenceDiagram
    actor U as 用户
    participant A as App 编排
    participant S as Support 工具清单
    participant M as ModelRunner
    participant P as ChatProvider / 模型
    participant T as Core ToolRegistry
    participant H as App 工具 handler
    U->>A: 提问
    A->>S: 从同一清单取得能力视图和请求内 runtime
    S-->>A: 模型声明、解析器、真实执行注册
    A->>M: invoke（输入及已登记 transport）
    M->>M: 检查取消、调用额度、输入与 schema 预算
    M->>P: stream（输入与可见能力）
    P-->>M: 模型分片
    M->>M: 完整收集、协议解析
    M-->>A: ToolProposal（工具名与原始参数）
    A->>T: runtime.invoke（工具名、参数）
    T->>T: 查找登记工具、parseInput
    T->>H: authorize（参数、服务端上下文、signal）
    alt 授权通过
        H-->>T: 允许
        T->>H: execute，并等待实际 I/O
        H-->>T: 实际结果
        T->>T: parseOutput、记录成功事件
        T-->>A: 校验后的结果
        opt App 需要根据结果继续生成
            A->>M: invoke（工具结果与后续输入）
            M->>P: 在剩余额度内生成
            P-->>M: 完整响应
            M-->>A: 解析结果
        end
        A->>A: 业务检查、绑定事实与交付
        A-->>U: 最终回复
    else 授权拒绝或执行／输出检查失败
        H-->>T: 拒绝或异常
        T-->>A: 错误与失败事件
        A-->>U: App 按实际原因处理失败
    end
```

图中错误分支也覆盖 Registry 自身的输入／输出检查失败，不一定发生 handler 调用。模型提议不是成功回执，Core 不会因为模型提出工具名就自动执行；后续是否调用、再生成或结束由 App handler／工作流决定。工具输出检查失败也不代表已发生的副作用被回滚。

## 5. 一次模型调用的内部流程

```mermaid
flowchart TD
    Invoke[invoke：规范化输入，选择已登记 transport] --> Initial[检查取消与剩余调用额度]
    Initial --> Prepare[准备或复用本次传输快照]
    Prepare --> Assemble[Core 装配文本、消息、BuiltContext 或 ContextPlan]
    Assemble --> Check[实际消息、传输指令、Schema 及可选 token 预算检查]
    Check --> Consume[取得模型调用额度，设置调用期限]
    Consume --> Stream[Provider 流：收集分片并检查输出预算]
    Stream --> Finish[完整响应：finish、parse、resolve]
    Finish --> Deliver[按序等待内容交付，检查取消]
    Deliver --> Journal[提交 Journal 与完成信息]
    Journal --> Result[返回 value 与 invocation]
    Stream -.->|取消、超时、上游或输出错误| Error[标注阶段与错误码并抛出]
    Finish -.->|协议解析失败| Error
```

Core 负责通用输入装配与最终预算检查，不隐式选择或压缩。需要处理时，App 将 Support 或自定义处理节点登记到同一 Workflow，并用普通路由决定何时执行。处理节点内的模型调用共享请求额度、取消和期限；详见[上下文节点](api/context-processing.md)。

普通 invoke 不需要预先 prepare。需要提前测量时，用 `model.prepare(...)` 获得单次快照，反复 `prepared.measure(input)` 后仍通过 `model.invoke({ input, prepared })` 消费同一句柄。测量覆盖实际传输指令和 Schema；最终检查继续有效，句柄不是额度预约。

`ModelRunner.sink.output` 按顺序等待生成分片的消费者，完整解析值仍经 invoke 返回；`execution.observe.event` 是失败隔离的旁路观察。分片预览与最终业务交付是不同边界。

## 6. Answering Kit 的任务检查与局部修正

对应 `defineAnswerFlow` 当前注册的七个节点；采用该 Kit 时才有这一流程。

```mermaid
flowchart TD
    Input[校验输入 ID、条目归属和数量] --> Generate[generate：仅生成 source=ready 条目]
    Generate --> Validate[validate：本地检查并保留规范化值]
    Validate --> Review[review：按 off / optional / required 策略复核]
    Review --> Select[select-repair：选出 ready 且仍存在问题的条目]
    Select --> Can{有失败项、修正次数和调用额度？}
    Can -->|是| Repair[repair：消耗一次修正机会，仅提交失败项及问题]
    Repair --> Recheck[recheck：仅重检本次生成的条目]
    Recheck --> Select
    Can -->|否| Deliver[deliver：逐条判断]
    Deliver --> Accepted[accepted：来源 ready、值存在且检查满足]
    Deliver --> Fallback[fallback：App fallback 提供了值]
    Deliver --> Blocked[blocked：无可交付值]
```

初次生成和每次 repair 各消耗一个工作流轮次；`maxRepairs` 另外限制修正次数。`canInvoke` 读取 App 提供的真实额度，Kit 不额外创建模型预算。非 ready 来源不进入生成或修正；复核已明确失败的条目，不能靠后来复核不可用而变成通过。取消、无效条目归属和程序合同错误会抛出，不自动伪装成 fallback。

## 7. App 知识回答的组合时序

下图是按[Knowledge、Answering 与 Presentation 合同](api/knowledge-answering.md)组织的 App 组合示意，具体编排和端口由 App 提供。可直接复制运行的完整代码见[离线服务问答](examples/offline-agent.md)；该代码不启用 Knowledge／Answering。

```mermaid
sequenceDiagram
    actor U as 用户
    participant A as App answer
    participant T as Answering 任务清单
    participant K as Knowledge / App reader
    participant F as Answering Flow
    participant M as 同一个 ModelRunner
    participant C as App 检查与复核
    participant O as Presentation
    U->>A: question、signal
    A->>T: 解析任务参数并读取
    T->>K: 调用已登记 reader
    K->>K: App authorize，读取固定 revision 快照
    K-->>A: 问题与来源证据
    A->>F: 运行已声明回答条目
    F->>M: generate：带证据调用
    M-->>F: 草稿
    F->>C: 本地检查；按策略复核
    C-->>F: 检查结果及问题
    loop 存在问题且修正次数、真实额度允许
        F->>M: 仅修正失败条目
        M-->>F: 修正草稿
        F->>C: 重检与复核
        C-->>F: 最新检查结果
    end
    F-->>A: accepted / fallback / blocked
    opt 有可交付值
        A->>O: 绑定程序来源字段并渲染母板
        O-->>A: 正文及来源
    end
    A-->>U: status、text（若有）、issues
```

复核若使用模型，应通过传入的同一个 ModelRunner 消费额度。fallback 的证据和允许文案由 App 提供；未提供可交付值时返回 blocked。授权、读取、取消或合同错误可直接抛出，不保证走到末尾交付。

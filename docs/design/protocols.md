# 传输与协议规范

## 层次与所有权

本页说明 Core 的执行合同，以及选用 Support 或 Kit 时各自适用的读写规则。Support 传输实现和 Kit 局部协议不因此成为所有 App 的 Core 接入要求。具体函数的参数、返回与异常见 [API 手册](../../packages/agent-core/development/docs/api/README.md)，职责关系见 [Core、Support 与 Kit](design-layers.md)。

| 层次 | 对应库能力负责 | 应用负责 |
| --- | --- | --- |
| SSE 字节流 | UTF-8 跨块解码、CR/LF/CRLF、空行分帧、多行 data、注释忽略、取消与空闲超时 | URL、认证、HTTP headers、重连、心跳周期、超时数值 |
| SSE 发送 | 通用 event/data 编码，写入背压与 signal 检查 | HTTP 生命周期、事件名清单、messageId 等载荷、终止事件和关闭 |
| 模型交互与 Provider | 交互登记、creator／formatter、适配器、有界调用；Provider 验证 HTTP／SSE 完成状态 | 业务阶段、schema／对象解析、配置、选用实现与用户文案 |
| JSON 对象帧 | 仅扫描完整对象，字符串转义与嵌套括号，帧数／多余闭括号上限 | 是否接受多个对象、对象顺序、前导消息、字段合并和语义 |
| 能力协议 | 唯一名称注册、输入校验 → 执行 → 输出校验、执行记录 | 能力清单、可见性、权限、语义路由、副作用与完成性检查 |
| InteractionProtocol／CommandCatalog | Web／AI 载荷与命令清单、字段和 schema 派生、模式与归属、按序检查与投影 | 字段含义、值域／跨字段约束、业务绑定与实际 handler |

先解码传输，再验证协议，再由应用检查授权和执行。网络分块不是事件边界；完整 JSON 不是已授权的命令。

## SSE

接收入口 `readSse(body, options)` 产出 `{event, data}`。没有 event 字段时为 `message`；多行 data 用换行连接；注释（包括心跳）不产出事件；忽略未知字段。不提供 EventSource 重连、id／retry 持久化。仅空行提交事件，EOF 的未提交尾帧不当作完整消息。UTF-8 无效时失败。当前底层实现的累计帧／缓冲保护阈值为 1,048,576 字符。

`signal` 取消读流；`idleTimeoutMs` 控制单次等待；`waitForCancel: false` 允许浏览器不等待底层取消清理，应用选择该策略。`abortableStream` 可退出不响应取消的异步迭代器，不等待其悬挂的 next／return。

`encodeSseEvent({event, data})` 编码字符串，拒绝事件名换行注入，逐行编码 data。对象先由应用序列化；工具不定义 JSON 信封。`writeSseFrame({ writer, frame }, { signal })` 接受已编码帧，write 返回 false 时等待应用提供的 waitForDrain；该回调须遵守 signal，HTTP 断开须由应用中止 signal。工具不自动重发或关闭连接。

本站 start／delta／bubble／actions／done／error、版本号与信封继续以 `@jangts/contracts/chat-protocol` 为准，不注册为 core 的默认协议。

## JSON

`parseJsonFrames(text, {maxFrames, maxExtraClosings})` 只接收一个或多个完整 JSON 对象帧，帧外只允许空白及显式限额内的多余闭括号。首帧前的闭括号、非空白前后缀、超限、未闭合字符串／对象或非法 JSON 均失败；不补齐、不猜字段、不丢弃半截输入。限额必须由应用显式提供。此工具不接受 Markdown 围栏或数组／原始值；应用可先用 JSON.parse 或自行选择围栏规则。

`scanJsonObjectFrames(text)` 仅提取正文中的完整对象形状片段，返回原始字符串，不解析、不挑选、不执行；未闭合片段仍失败。应用须自行筛选和验证。提取出的候选交由调用方的字段和冲突规则校验。

候选选择、前导文字、帧数量和冲突处理由调用方的解码规则声明。帧扫描保留原文，候选只有通过实际协议检查后才可进入分发。

## 注册、错误与记录

InteractionProtocol／CommandCatalog 是可选 Interaction Kit 的交互规范与实现；使用 Core 不要求采用其信封、交互分类或分发方式。推荐通过 `Interaction` 构造器及静态辅助调用，见 [Interaction API](../../packages/agent-core/development/docs/api/kits.md#intentsinteractiontools)。以下说明仅约束采用这套规范的调用者。

`InteractionProtocol` 包含 `commands: CommandCatalog`。`defineInteractionProtocol` 编译整体载荷和命令配置，`defineCommandCatalog` 可单独创建命令清单。命令字段用 `jsonSchema` 声明模型结构；编译后由同一份声明生成 `fieldSchemas`、`modelJsonSchema`、`inputJsonSchema`、`keys`、`assert` 与 `parse`。先选择命令并检查模式／归属，再检查字段、按序执行 checks、业务 refine 与 format。失败不会继续投影或执行工具。模型 schema 不替代值域与权限检查，也不改变 HTTP／SSE 和 App 的 JSON 结构。

交互用途可登记为 `query`、`action`、`presentation`、`input` 或 `receipt`；`commands.manifest(category?)` 从实际注册返回对应清单。类别只描述用途，例如 `input` 表示请求使用者参与，不能据此自动同意、登录或提交。具体数据结构和权限仍由应用配置。`commandAliases` 只在接收端接受单个别名选择字段；多个选择字段即使值相同也拒绝，模型 schema 始终只展示规范字段。`bindInteraction` 启动时检查命令与 handler 一一对应；`dispatch` 完成协议校验后才调用本地 handler，格式器不能改变已选中的处理器。单独 `parse`／`receive` 不执行 handler。示例与职责见 [通用模块](modules.md)。

步骤清单、输出字段、模式、业务 checks 和 format 由调用方登记。动态自定义 keys 可由 `commandSchema` 适配，仍遵守同一参数归属、授权与执行顺序契约。

协议和工具名称不得为空或重复；工具清单封存后不能新增。输入与输出校验器由应用注册，失败必须中断执行链，不把未验证值作为成功结果。同步工具执行记录含名称、kind、耗时与成功／失败，错误码可由应用分类。请求内 journal 对输入与结果保留快照，每个已开始工具只能写入一次终态回执。

实例绑定 Workflow 后，`run(state)` 按已登记的有序路由推进：`targetNodeId` 转移，`complete` 结束。轮次边界消费 maxRounds，阶段数量不额外消费轮次；阶段与结束边界检查取消，取消不进入 onErrorNodeId 指定的恢复节点。登记时校验引用、可达性和有界循环。低层循环 `run(step)` 用 `StepOutcome` 表示继续或结束。模型调用同时受外部 signal 和单次截止时间约束；输出超限立即失败，不向解码器传入截断结果。trace 区分 CALL_TIMEOUT、ROUND_TIMEOUT、CANCELLED 与 UPSTREAM_ERROR；业务校验错误保留应用提供的错误码。core 不将内部协议自动发布为用户正文，最终内容是否可展示由应用决定。

## 统一模型能力与适配器

`ModelToolRegistry` 接收 id、description、inputSchema 与 resolve；inputSchema 同时提供 jsonSchema 和 parse。`Support.createModelInteraction` 是推荐的创建入口；自写 interaction 可直接满足 `ModelInteractionDefinition` 扩展契约。适配器拥有 wire 名称映射和响应收集；业务 parse 处理对象。

模型响应统一还原为 `ModelSelection { toolId, input, call? }`，再经本阶段登记解析；业务 ID 不必符合任何供应商的函数命名格式。原生与 JSON 实现共享这套注册／解析接口，但互不自动重试或切换。适配器声明 strict 支持情况，不能把未实现的保证当作已支持。

`ModelRunner` 只负责调用生命周期、完整结束后提交、上下文／声明／输出预算、journal 和 trace，不按业务能力名称分支。`CompatibleModelProvider` 统一负责 HTTP／SSE 完成状态：原生要求 tool_calls，文本／JSON 要求 stop，都要求 [DONE]；异常 EOF、length、重复结束和终止后的正文均失败。数据或参数未完整结束时不得调用业务 parse，更不得执行工具。

参数 schema 继续由应用拥有，授权和副作用仍在原执行器检查；非 strict 格式不取代本地验证。业务结果的上下文投影与用户展示规则由应用配置，可选用 core 的投影／交付能力，也可自行实现后接入相同契约；供应商 wire 格式不下放到应用。

## 流程合同与状态提交

流程的 app 参数只提供应用依赖；handler 返回状态更新，由 core 在输入／输出合同和取消边界之间应用。requires / provides 检查已声明字段的存在，isResult 检查终态；合同错误不进入业务修复。业务语义与副作用仍由宿主保证，core 不为它们提供回滚。

流程事件只输出阶段、轮次、分支、耗时与规范错误码。observer 用于诊断，不能改变路由、自动重试或把未完成工具变成完成；事件默认没有持久化宿主。

`streamEvents` 的单槽交付在消费者继续迭代后才确认消费。消费者提前 `return()`、抛错或取消时，挂起的 `emit()` 失败，生产者不能把未确认的输出当作已交付并继续提交状态；正常完整消费仍逐条确认并保持背压。

## 模型响应计量

每次模型调用使用独立的同步 collector。Core 在工厂返回后、每次 push 后及 finish 后检查 outputChars 为非负安全整数，并按 maxOutputChars 检查预算；预算可设 Infinity，计数不能为 Infinity。诊断保留有效观测峰值，finish 可以释放内部缓冲。call 是可选观察元数据，读取失败不覆盖业务结果、原始异常或取消，不阻止终态事件收尾。

原生交互仅接纳字符串及合法 function-call-delta：index 为0，提供的 id 为非空字符串，name 和 arguments 为字符串。调用必须完整且引用已登记能力；多调用、混合正文及协议错误不产生工具执行。具体调用见 [Core API](../../packages/agent-core/development/docs/api/core.md)。需要正文 + 多调用时使用 `Support.createModelInteraction`；它复用同一聚合 collector，但不改变上述原生单提案合同。

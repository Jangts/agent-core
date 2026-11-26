# Provider 工具调用协议迭代计划

本文由 Agent Core 维护方维护，安排 `packages/agent-core` 兼容模型 Provider 的协议扩展。性质为实施计划，不表示能力已经实现或发布。

## 范围与设计边界

本次只解决直接使用 CompatibleModelProvider 时的工具调用协议缺口：可选完成策略、标准会话完成预置、多调用聚合、正式工具消息类型与 wire 映射。

不新增 SDK 会话循环，不引入会话 Handler，不改变 Engine、Runner 或单提案 interaction 的调度合同。此前围绕完整会话循环提出的 Handler 实例方案不作为本次迭代依据。宿主的循环和业务编排不属于本计划，也不在本计划中安排其实现或迁移。

Provider 是协议适配能力，不因支持 tool_calls 就承担真实工具执行。本次没有新增可执行业务工具，也没有据此新增工具执行器或 Kit。

## 当前源码基线

- `src/support/model/compatible-provider.ts` 根据 functions 有无校验 finish_reason 与结束标记；默认行为保留。
- `src/support/model/chat-completions.ts` 构造工具请求字段、转换 delta 和图片消息；目前不映射工具线程字段。
- `src/structs/support/model/provider.ts` 定义 Provider 端口；新增完成策略属于此处的 Support 合同。
- `src/structs/model/chat-provider.ts` 和 `messages.ts` 属于 Core 公共模型合同，本次不使其依赖 Support 类型。
- 原生 interaction 的单调用限制在 `src/model/interactions/native-functions.ts`，继续保持。

## P1：完成策略合同

在 CompatibleModelPorts 增加可选完成策略。策略定义按每次请求创建独立 session，输入包含实际序列化请求中的工具配置、delta、finish_reason 和结束标记。策略负责接受或拒绝响应，不接管请求循环和工具执行。

工具配置取自最终请求体，而非配置对象或 options 推导值：Provider 先组装完整请求体对象，从中读出 `tools`、`tool_choice`、`parallel_tool_calls` 再交给策略 session。`requestBody` 覆盖 `chatCompletionFunctionOptions` 的既有顺序保持不变，`tool_choice` 被覆盖为 `undefined` 时经序列化后不下发该字段，线上等价于字段省略。

Provider 继续返回 `AsyncIterable<ModelPart>`，不新增完整调用列表流元素。HTTP/SSE 形状、取消、重复 finish、finish 后增量等固定保护由 Provider 保持；自定义策略不能将传输失败或取消变成成功。

同帧先处理 delta 再处理 finish；允许合法的尾部 usage。默认和标准预置均拒绝缺结束标记的断流。实现明确错误端口、观察链、清理和策略异常的传递方式。

交付条件：端口生命周期、状态作用域、背压与错误合同明确；同一 Provider 的并发请求不共享聚合状态。

## P2：默认与标准会话完成预置

默认预置按现有源码抽取，保持请求、完成规则与 MODEL_* 分类，不新增完整调用验证。不得将其改称或改造成单提案验证器；单提案限制仍由 interaction collector 保证。

默认预置的等价性以逐条对照验收，不接受"语义一致"的定性描述。现状严格性由 `options.functions` 是否存在决定，而不是由 `tool_choice` 决定：它同时控制"是否允许出现 function part"和"期望的 finish_reason"。默认预置必须完整复刻这层耦合。

| 触发条件 | 现状行为 | 默认预置 |
| --- | --- | --- |
| 无 functions 却出现 function-call delta | `MODEL_PROTOCOL` | 同 |
| functions 存在、期望 `tool_calls`，实际为 `length` | `MODEL_OUTPUT_LIMIT` | 同 |
| 期望 finish_reason 与实际不符（非 length） | `MODEL_INCOMPLETE` | 同 |
| 收到 finish 后仍出现 content 或 tool_calls | `MODEL_PROTOCOL` | 同 |
| `[DONE]` 时未收到 finish，或缺少 functions 时无调用、无 functions 时无文本（空 JSON 例外除外） | `MODEL_INCOMPLETE` | 同 |
| 流结束但未出现 `[DONE]` | `MODEL_INCOMPLETE`，`reason: 'eof'` | 同 |
| `finish_reason` 重复出现 | `MODEL_PROTOCOL` | 同 |

期望值固定为 `functions ? 'tool_calls' : 'stop'`。上表同时是默认预置的验收清单，任何一项行为变化都视为破坏性变更。

标准会话预置显式选用，规则如下：

| 线上 tool_choice | 完成规则 |
| --- | --- |
| auto | tool_calls 要求至少一个调用且所有已开始调用完整；允许伴随正文。stop 要求文本合同，出现任何调用 delta 即拒绝 |
| required | 必须返回完整工具调用；不天然限制为一个调用 |
| 指定函数对象 | 工具完成合同，全部调用名称匹配指定函数 |
| none | 文本合同，出现调用 delta 即拒绝 |
| 省略 | 明确保留既有完成规则作为兼容约定，不宣称供应商省略值在线上等同 required |
| 未知值 | 请求前拒绝，不按纯文本处理 |

length 保持输出限额错误；缺调用、残缺响应与结束原因错配分类明确。沿用适用的空 JSON 例外，但不能用例外掩盖调用错配。parallel_tool_calls 仅为发送字段，不是执行授权或调度策略。

交付条件：新规则只作用于显式启用的标准预置；默认消费者与 Kimi 既有字段省略路径行为不变。

## P3：通用多调用 collector

Support 提供按 index 聚合的 collector，与标准预置同批交付。处理交错分片、调用 ID 冲突、名称与参数拼接、逐调用完整性；一个完整调用不能掩盖另一个残缺调用。

明确聚合结果所有权与使用入口：完成策略和直接调用方复用同一聚合算法，不在 Provider 中另写第二份。区分协议完整性与业务参数校验；本次不因提供 collector 而接管工具注册、授权、执行或循环。

collector 与完成策略登记在 `src/support/model/completion/`，由该目录的 `index.ts` 导出集中清单与单项实现，并加入 `src/support/model/index.ts` 的导出面。清单沿用 `modelInteractionCatalog` 的做法：对象冻结，模块加载时用 `breakWhile` 校验注册键与实现自报 id 一致。新增预置必须同时登记清单、类型和测试，不能只导出函数。

交付条件：调用列表可被直接接入者可靠获取，Provider 流输出保持原合同，不重复输出聚合调用。

## P4：正式工具消息输入与映射

Support 提供具体 Provider 使用的工具消息扩展类型，显式支持 assistant 工具声明和 tool 结果。具体 CompatibleModelProvider.stream 及创建函数的返回类型保留这份能力，Core ChatProvider 不反向引用 Support 类型。

类型位置由本仓库决定：`ProviderMessage` 声明在 `src/structs/support/model/messages.ts`，Discriminated Union 形式，`toolCallId` 仅 tool 角色必填，`toolCalls` 仅 assistant 允许，`images` 仍仅 user，assistant content 允许空串。`ChatProvider` 抽象签名保持 `readonly ModelMessage[]` 不变；`CompatibleModelProvider.stream` 参数放宽为 `readonly (ModelMessage | ProviderMessage)[]`，通过方法参数双向兼容完成收窄，不改 Core 抽象合同。`chatCompletionMessages` 显式映射 `toolCallId` 到 `tool_call_id`、`toolCalls` 到嵌套 `tool_calls`，不做整体展开透传。

新输入保证角色与字段关联，并提供运行时校验；兼容既有 ModelMessage 输入，原有非法图片组合仍在运行时拒绝，不以类型断言绕过。

本次扩展仅用于具体 Provider 直连，不让工具消息进入 Runner 的 preparation/history，不调整其消息计量与调度。若实现发现必须改变 Core 公共合同，先说明实际依赖和兼容影响，不能静默扩大本计划。

交付条件：合法工具线程可按正式类型输入，非法组合明确拒绝；具体 Provider 仍满足 Core ChatProvider 原合同。

## P5：验证、文档与发布

针对性证据覆盖：默认行为回归；auto 文本与多调用；required 多调用；指定函数与 none；未知和省略值；错配 finish；残缺/冲突 ID；尾部 usage；取消与并发状态隔离；扩展消息类型和 wire 映射。

默认预置回归按 P2 对照表逐条建用例，不使用"语义等价"的合并断言。验收在 `packages/agent-core/test/` 内自足完成，不依赖外部仓库的参考实现，也不把外部实现的通过情况作为本包发布条件。

保留 server、banker 既有单提案断言。类型与运行时检查按具体问题选择最小范围，不自动运行全仓构建、真实模型、业务工具、UI 或部署。

发布面包含：`test/public-api.types.txt` 快照、`scripts/api-reference.mjs` 生成的 `development/docs/api/reference.md`、`development/docs/api/support.md` 合同说明、`apps/agent-core-docs/content/recipes/support-recipes.mjs` 的 wire 边界表述、包版本与 changelog。`ChatProvider` 抽象签名不变，公开类型变化仅限 Support 侧新增，快照更新须逐行确认无 Core 合同改动。

## 本仓库自身待办

以下事项由本仓库决定，不由需求方提供结论，也不阻塞 P1–P4 开工：

- server 的 structured 阶段固定使用 `nativeFunctionInteraction`，而 kimi 预设下发 `tool_choice: 'auto'`，两者当前语义不一致，属于既有配置问题。当前决定是只登记、不改线上请求：不删除 kimi 预设的覆盖，也不让 server/banker 改用标准会话预置，保持与改动前完全一致的请求语义。出现可复现的失败证据，或能验证供应商接受 `required` 时再收敛，收敛方向届时单独确定。
- 多调用能力只由 interaction collector 的单提案限制挡在 Agent 路径之外，直连 Provider 不受该限制。该边界写入 `support.md`，避免被理解为框架已支持并行工具执行。0.5.0 新增的 `createSessionModelTransport` 是显式 opt-in 的会话 transport，复用同一 collector，不改变 `nativeFunctionInteraction` 的单提案合同。
- `parallel_tool_calls` 仅是发送字段，不表达执行授权或调度策略；已在 P2 记录，接入示例不据此给出并发执行指引。

## 执行状态

P1–P4 的接口与实现已落地：`CompatibleModelPorts.completionPolicy`、`src/support/model/completion/`（默认预置、标准会话预置、共用 collector、冻结清单）、`ProviderMessage` 与 `chatCompletionMessages` 显式映射。`test/completion-policy.test.mjs` 覆盖默认等价性、`tool_choice` 规则、聚合冲突与 wire 映射，既有 Provider 与公开类型合同测试保持通过。

未执行：全仓构建、真实模型调用、业务端到端、UI 与部署。包版本已更新为 `0.2.0`，变更条目维护于 `CHANGELOG.md`；版本与文件存在不表示已发布。

### 消息边界复查（2026-11-06）

消息映射按声明字段生成 wire 数据，不透传原始 wire 字段或宿主附加信息；工具结果 ID 要求非空字符串，并校验角色与正文类型。该修正沿用 P4 的 Support 边界，不新增 Core 会话循环或工具执行机制。

验证：agent-core 包的 ESM／CommonJS 编译通过；`completion-policy.test.mjs`、`compatible-provider.test.mjs` 与 `provider-branches.test.mjs` 共 24 项通过；公开 API 参考已从源码重新生成。未执行全仓构建、真实模型、业务端到端、UI 或部署。

### 发布记录（2026-11-06）

`@jangts/agent-core@0.2.0` 已发布至 npm 公共仓库，`latest` 指向 `0.2.0`，公共查询的完整性值与发布回执一致。文档站通过现有 Pages 脚本发布，服务器逐文件核对 2452 个成品；公网抽查的 53 个页面与资源 SHA-256 与本地一致，缺失路径返回 404。文档站检查通过，覆盖 API 目录、示例、搜索索引和图示；未执行浏览器交互或视觉验收。

文档生成器对 API 索引执行正文规范化，行内模板符号保持字面量；依赖声明附件使用独立页面路径，避免进入 VitePress 排除的 node_modules／dist 目录。打包边界检查同步包含正式 CHANGELOG.md。

# Support：按统一合同装配

[共同类型](types.md) · [返回首页](README.md)。Support 从根命名空间使用，提供符合 Core 接口的实现。

## SchemaAdapter

```ts
Support.defineSchema<Value>({ jsonSchema, parse }): SchemaAdapter<Value>
Support.fromJsonSchema(jsonSchema, { compile, error? }): SchemaAdapter<unknown>
Support.fromParserSchema(schema, { toJsonSchema }): SchemaAdapter<Output>
```

defineSchema接收一份明确的原始schema及parser，复制jsonSchema、固定parser引用及接收者。fromJsonSchema复用App的validator/compiler；fromParserSchema接Zod等已有parser库，不重复维护另一份JSON Schema。

Schema 编译、转换、校验、解析与错误工厂均为同步合同；意外返回 Promise／thenable 时立即抛 TypeError，并观察迟到拒绝。`compile` 必须在创建 adapter 时返回 validator 函数，validator 运行时必须返回 boolean。

裸JSON Schema不提供TypeScript业务类型证明，fromJsonSchema默认返回unknown；需要Value推断时使用返回已验证Value的parser／有类型的compiler端口，不能用任意`<Value>`断言冒充类型推导。

三个函数均返回相同SchemaAdapter结构；不通过inputSchema里面是否碰巧有parse/jsonSchema字段猜模式。parser同步；异步业务读取和授权放在执行handler。

## 工具声明与目录

```ts
interface ToolDefinition<Input, Output, App> {
  readonly id: string;
  readonly kind: string;
  readonly description: string;
  readonly inputSchema: SchemaAdapter<Input>;
  authorize(input: Input, context: OperationContext<App>): MaybePromise<void>;
  execute(input: Input, context: OperationContext<App>): MaybePromise<Output>;
  parseOutput(value: unknown): Output;
}
Support.defineTool<Input, Output, App>(definition): ToolDefinition<Input, Output, App>
Support.defineToolCatalog(definitions): ToolCatalog
```

authorize通过时返回 void，拒绝时抛错。接入现有布尔权限函数时，在回调内判断结果并抛出应用的授权错误。Support 固定注册时的方法与接收者，并校验异步授权的完成结果。parseOutput 解析工具执行结果。

```ts
catalog.select(toolIds): ToolCatalog<SelectedDefinitions>
catalog.bind({ app, execution }): ToolRuntime
runtime.invoke({ toolId, input }): Promise<ToolResult<InferredOutput>>
```

catalog.tools从工具声明投影同一jsonSchema；其能力适配器只检查原始参数对象与选择合同，resolve返回`{ toolId, input }`，input保留原始参数。它不提前运行工具的业务inputSchema.parse；工具在真实invoke中解析一次后再授权和执行，避免转换型parser重复运行。自定义模型阶段可另登记解析与resolve，但不能把已转换值再伪装成工具原始入参。

Catalog实现共同只读集合接口。静态选择后推断的工具ID与结果类型同步收窄；动态ID走unknown边界。Context/App不进入模型schema，不能被模型参数覆盖。

返回外形始终为`{ value, invocation }`，实际工具结果位于value；execute/parseOutput只处理业务值，不自行构造调用回执。

runtime按本次请求创建；所有input、authorize、execute、output回调收到或使用同一有效signal。取消、未知工具、输入或输出拒绝都不能写出成功回执。静态schema说明本身不证明已执行。

同一个绑定结果提供异步 `invoke` 和显式同步 `invokeSync`。两者复用同一个 Core 注册器、授权检查和回执记录。

## 应用能力组合

```ts
Support.defineCapabilityCatalog(definitions, { toolReferences? }): CapabilityCatalog
Support.validateToolReferences(toolIds, references): void
Support.defineRegistrationCatalog(definitions): RegistrationCatalog
```

模块使用id、description和tools。tools项的主键是id；reference明确requiredToolIds/optionalToolIds。组合结果继承共同Catalog操作，并提供tools与findToolOwner(toolId)；未知owner返回undefined。

组合层只核对引用和装配，不识别App的业务完成／恢复字段。RegistrationCatalog使用definitions数组，install(app)按声明顺序、when条件注册。静态登记、部署可配置和本次请求授权分别判断，不复用一个enabled替代三者。

## 模型传输与阶段

```ts
Support.createTextInteraction({ id, options? }): ModelInteractionDefinition<string>
Support.createJsonInteraction({ id, outputSchema, options? }): ModelInteractionDefinition<Output>
Support.createModelInteraction({ id, tools, adapter?, options?, requireStrictArguments? }): ModelInteractionDefinition
Support.createStageModelInteraction({ id, tools, stages, adapter?, options? }): ModelInteractionDefinition
```

`createJsonInteraction` 用于直接生成符合 Schema 的 JSON 值，例如摘要、分类结果或表格数据。`outputSchema` 是普通 `SchemaAdapter<Output>`，包含 `jsonSchema` 和同步 `parse(value)`；可直接提供、使用 Support Schema 工厂，或传入有状态的类实现。JSON 解码后再调用该 parser；声明 JSON Schema 不替代运行时校验。

```ts
const summary = Support.createJsonInteraction({ id: 'summary', outputSchema: {
  jsonSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false },
  parse(value: unknown) {
    if (!value || typeof value !== 'object' || !('text' in value) || typeof value.text !== 'string') throw new TypeError('需要摘要正文');
    return { text: value.text };
  },
} });
const model = new ModelRunner({ provider, interactions: [summary] });
const result = await model.invoke({ input: '概括资料', interaction: summary });
console.log(result.value.text, result.invocation);
```

ID 保留字面量类型；登记后可用原 interaction 句柄或 ID 调用。每次调用都创建新的 collector，分片只在该次调用内累积。非法 JSON、Schema parser 拒绝、异步 parser 或函数调用分片均作为失败传播，不产生可交付的成功值。输入／输出／Schema 预算、取消和调用额度继续由同一 Runner 执行。

它不要求能力清单，也不引入 capability/input envelope；需要模型从已注册能力中作选择时，使用 `createModelInteraction` 或 `createStageModelInteraction`。JSON 请求方式及供应商实际支持的 JSON 值类型由 Provider 决定。输出仍统一为 `{ value, invocation }`，不会因 JSON 模式变成裸对象。`options` 只接受温度覆盖，不放宽 Provider 和 Runner 的约束。

capabilities是ModelToolSource或按stageId读取的source工厂。stages项使用`{ id, toolIds }`。静态source装配时校验全部引用，动态source在本次准备交互时刷新。未知阶段不调用动态source，不扩大到其他阶段。

prepare(stageId)返回统一的collector协议；准备好的交互固定本次resolver及接收者；下一次动态准备可取得新source。native与JSON adapter消费同一能力投影。原生 adapter 校验中立 function-call-delta 的对象形状、index、ID、名称和参数字符串；非法分片不进入能力执行。collector 的 outputChars 计数和 call 元数据读取边界遵守 [Core 传输合同](core.md)。回退由App显式选择，不按模型名或URL隐式猜测。

## 模型策略与预算

```ts
Support.createModelStrategy({ model, models?, reasoning?, reasoningOptions?, budget?, ...coreSettings }): ModelRunnerOptions
```

`model` 接受模型定义，或 `models` 中的 ID。`reasoning` 选择 `reasoningOptions` 中明确登记的配置；例如 high/off 对应已经配置供应商推理参数的 Provider。未知 ID 或推理方案报错，不根据名字推断模型能力。

预算缺省为 medium。它们是可覆写的本地任务预算，不是供应商容量或性能保证：

| budget | 场景 | maxCalls | maxInputChars | maxOutputChars | maxOutputTokens | callTimeoutMs |
| --- | --- | --- | --- | --- | --- | --- |
| small | 少量调用的短任务 | 2 | 8000 | 4000 | 512 | 15000 |
| medium | 普通多步任务 | 8 | 32000 | 16000 | 1024 | 30000 |
| large | 较多调用和输出空间 | 16 | 64000 | 32000 | 4096 | 60000 |

从低到高依次应用：档位、模型定义、推理配置、budget 对象中的精确值、顶层 Core 设置。合法的 0、Infinity 保留；显式 undefined 使用 Core 缺省。budget 对象以 medium 为基线。所有 Core 模型字段都可传入，输出仍是同一 ModelRunnerOptions。没有绑定 execution 的结果可直接用作 Engine 的 model；请求级 execution 仍归 Engine 所有，不能通过策略绕过。

```ts
const settings = Support.createModelStrategy({ model: { provider }, budget: 'small', maxCalls: 1 });
const model = new ModelRunner(settings);
```

## 上下文

```ts
Support.defineContextFragments(definitions, options?): ContextBuilder
Support.defineContextAssembly(definitions, options): ContextBuilder
builder.fragments(input): readonly ContextFragment[]
builder.plan({ input, maxInputChars?, originalFragments?, mutableFragmentIds?, additionalMessages? }): ContextPlan
builder.build({ input, maxInputChars?, originalFragments?, mutableFragmentIds?, additionalMessages? }): BuiltContext
```

- ContextPlan.fragments是未组装定义片段；BuiltContext.fragmentUsage是已用量元数据，不能同叫fragments。
- 片段使用id、sourceId、trust、lifetime、maxChars、role和value。业务原文是数据，不升格为system指令。
- 格式化先取得本次输入，再按声明顺序和budget装配；当前问题、授权条件和已有证据不能被随意裁剪。
- ContextBuilder无一次请求signal。选择与压缩以普通 Workflow 节点执行，内部调用复用 Core 请求额度与 signal。

Support 的策略模式是 `validate | reduce | audit`。`createContextProcessingNode` 返回普通 WorkflowNode；需要分别观察和路由时，使用 `createContextSelectionNode` 与 `createContextReductionNode`。Core 不按这些模式调度，具体运行边界见[上下文节点](context-processing.md)。

`createContextStrategy` 可用 `preset: compact | balanced | extended` 按片段硬预算的 25%／50%／75% 生成目标字符数，并保留最近 1／3／6 组原文；精确 targetChars 和 keepGroups 优先。比例只表示字符空间，不表示语义保留率。不选 preset 时沿用片段硬预算与一组原文保护。该函数可从已登记的历史片段生成近期窗口或连续任务摘要配置。它复用片段 ID／预算、生成步骤 ID 和 handler 引用；精确覆盖 targetChars、keepGroups、grouping 与 selection 后仍使用同一节点合同。返回的 policy、compressors、selectors 可直接配入普通处理节点。单个策略可配置完整 selection（包括 model）、selectors、compressors、steps 及字符／token 触发和目标水位；显式 steps 完全替换生成步骤及其依赖；直接给 steps 时可省略生成专用的 kind、fragment、field、compressor。默认选择按最终步骤决定：单步 fixed，多步 sequence。传入策略数组时，各项生成一个操作，共同设置放在第二个参数；默认按顺序执行。重复步骤或冲突处理器在装配时拒绝。默认每组为 user-turn，保留最近一组完整原文；数字来自配置及完整轮次保护，不承诺模型性能或摘要质量。

预算可在装配时配置一次。固定预算传数字，按请求计算时传 `maxInputChars(input)`。
两种写法都用 `builder.build({ input })` 或 `builder.plan({ input })`，需要单次覆盖时再补预算。
预算未配置且未随请求传入时，构建会报错。`plan` 与 `build` 均接受 Core ContextPlan 的附加消息和变更审计字段；附图用户消息参与最终预算，build 复用 Core 的审计及装配，不静默丢弃这些字段。处理入口接受与 Core 一致的字符预算（包含 Infinity）；零预算仍须通过最终实际用量检查。每次处理先固定计划及结构化片段、消息、图片的合同字段，允许原型 getter，不因异步处理期间调用方改动原计划而改变已确定预算。

## Provider、预览和流

`CompatibleModelProvider.stream` 直接使用时也执行取消合同：已取消则不发送 HTTP 请求，等待请求／SSE 期间可停止等待；忽略取消的请求若迟到返回，适配器释放其未消费正文。HTTP／格式错误的正文清理采用尽力执行，不覆盖原始分类；诊断正文采集仍有独立的大小和时间上限，并释放 reader。

`writeSseFrame` 要求 `writer.write` 同步返回 boolean；等待 drain 时由统一取消等待保护。`readSse` 在取得 reader 前及网络块内的事件之间检查取消，不交付已缓冲的迟到事件。

| 接口 | 首选输入／语义 |
| --- | --- |
| new CompatibleModelProvider | `{ config, ports?, observe?, errors? }`，config 接受静态配置或动态读取函数 |
| createReplyPreviewRules | 从实际阶段引用、能力 Schema 及明确的展示资格生成并校验预览规则 |
| createReplyPreview | `{ rules, sink, render?, maxChars? }`，返回供模型output sink调用的handler |
| streamEvents | `(producer, context)`，producer必须等待emit，保持有界背压 |
| readSse | `(body, options)`，signal及idleTimeoutMs在options中，遵循真实传输约束 |
| encodeSseEvent | 原始SSE事件结构，外部event/data字段保留 |
| writeSseFrame | `({ writer, frame }, context)`，等待背压，传播交付错误 |
| scanJsonObjectFrames / parseJsonFrames | 保留同步，前者只切分，后者解析并限制帧数 |

modelInteractionCatalog 按明确登记的交互 ID 选择原生函数或 JSON adapter；App 提供选择元数据，可明确覆盖，不按品牌、模型名或 URL 推断能力。

预览规则使用stageId与toolId；预览是暂态，不能授权、持久化或执行模型提议。ModelOutputEvent进sink，ProviderObservation进observer，不混用。

外部SSE/wire类型可以保留标准字段，并在Support边界转换；不为统一SDK拼写修改协议本身。

兼容 Provider 的 `requestBody` 用于供应商扩展字段。模型身份、输入消息、流式协议和 token 上限由适配器与 Core 调用合同控制。覆盖这些字段会在发送请求前报错。需要使用另一种请求协议时，可以直接实现同一个 `ChatProvider` 接口。

完成判定通过 `ports.completionPolicy` 选择，缺省为 `Support.completionPolicyCatalog.default`，是否接受函数分片、期望的 `finish_reason`、`[DONE]` 前的完整性都按调用是否声明 `functions` 判定，缺结束标记的断流仍按 `MODEL_INCOMPLETE` 结束。`Support.completionPolicyCatalog.session` 按线上 `tool_choice` 判定：`auto` 要求已开始的调用全部完整并允许伴随正文，`required` 与指定函数对象要求至少一个完整调用，`none` 拒绝任何调用分片，字段省略采用 default 的完成规则，未知值在发请求前按配置错误拒绝。策略只判定响应是否满足请求，不接管请求循环、传输保护或工具执行；取消与传输失败不会因为策略而变成成功。

`Support.createToolCallCollector` 按 index 聚合调用分片，完成策略与直接调用方共用同一实现。分片 ID 冲突、跨 index 重复 ID 与残缺调用都按协议错误拒绝，一个完整调用不会掩盖另一个残缺调用。

协议层从不限制接收多个调用分片，`parallel_tool_calls` 只是发送字段，不表达执行授权或调度策略。Agent 路径的单提案限制由 `nativeFunctionInteraction` 的 collector 决定；直接使用 Provider 不受该限制，也不因此获得工具执行、授权或循环能力。需要正文 + 多调用时使用 `Support.createModelInteraction`，它复用同一聚合 collector，但不改变 `nativeFunctionInteraction` 的单提案合同。`createModelInteraction` 返回 `DecodedModelToolResponse`，每个调用的 `toolId`、解析后的 `input` 与非致命 `problem` 都由 Support 解析；Core 只提供原始 `ModelToolResponse`。

`ProviderMessage` 提供直连所需的 `tool` 结果与 assistant `toolCalls` 形状，`chatCompletionMessages` 显式映射为 `tool_call_id` 与嵌套 `tool_calls`；角色与字段不匹配、调用字段不完整时按 `TypeError` 拒绝。只发送声明字段，额外字段（包括原始 wire 字段）不透传；`toolCallId` 必须是非空字符串，`role` 与 `content` 按消息合同校验。Core `ModelMessage` 现已支持 assistant `toolCalls` 与 `role:'tool'` 字段；`ChatProvider` 抽象签名仍为 `readonly ModelMessage[]`。

直连工具线程使用声明字段，assistant 的 `content` 可以为空字符串；工具结果通过同一个调用 ID 关联：

```ts
import { Support } from '@jangts/agent-core';

const messages: Support.ProviderMessage[] = [
  { role: 'user', content: '查询资料' },
  {
    role: 'assistant', content: '',
    toolCalls: [{ id: 'call-1', name: 'lookup', arguments: '{"query":"资料"}' }],
  },
  { role: 'tool', content: '{"found":true}', toolCallId: 'call-1' },
];
const wireMessages = Support.chatCompletionMessages(messages);
// 工具声明映射为 tool_calls，工具结果映射为 tool_call_id。
```

工具的注册、参数业务校验、授权和执行由宿主负责。`createToolCallCollector.complete()` 检查调用 ID 与名称的完整性，不解析或验证业务参数 JSON。

多个请求复用同一个 Provider 时，可以用 `Support.createProviderObservationScope` 绑定应用自己的输出规则。将返回的 `observer` 配给 Provider，每次请求用 `attach(diagnostics, destination)` 关联日志目标。子作用域会自动继承关联。应用负责脱敏、保留期和写入策略，Provider 事件按现有应用日志出口记录。

## 拒绝检查

```ts
Support.breakWhile(occur, error?, tags?): void
Support.breakWhile([
  { occur: () => expired, error: '已过期' },
  { occur: [() => missing, () => invalid], error: '输入不可用' },
]): void
```

`occur` 指定拒绝条件，可以是一个真值、惰性谓词，或按顺序短路的 OR 谓词数组；任一项为真即拒绝，停止执行后续谓词和错误工厂。多个检查对象也按顺序在首次拒绝时停止。ProtocolCheck 使用相同的 `occur` 字段，`when` 决定是否启用检查。

完整导出、精确重载和声明源码见[公开符号参考](reference.md)。示例中的签名用于阅读，不能据省略字段推断任意扩展选项。

## 上下文压缩／选择与局部回调

`createContextCompressor({ id, instruction, interaction, maxOutputTokens, parse })`、`createContextSelector({ id, instruction?, interaction, maxOutputTokens, parse?, maxExcerptChars? })`构造可登记handler。主请求与它们的模型调用共享同一个runner、期限、剩余额度和父诊断身份：

```ts
compress(request: ContextCompressionCall, context: ExecutionContext)
select(request: ContextSelectionCall, context: ExecutionContext)
request.callModel({ stageId, input, maxOutputTokens, interaction }): Promise<ModelResult<unknown>>
```

request 提供 stageId 及压缩片段／选择候选；结果 parser 只处理返回的 value。策略引用使用 handlerId；callModel 接收命名请求并返回 ModelResult。取消信号从第二个 context 读取。处理节点通过 Workflow 模型端口接入这些回调，保护原文、历史分组、水位、预留调用和审计规则见[上下文节点](context-processing.md)。

createReplyPreview使用`{ rules, sink, render?, maxChars? }`；规则使用stageId和toolId（native适配将其映射为函数wire name）。sink按序等待，render同步。规则数据快照复制，回调固定原接收者；预览永不授权或执行工具。

选择器省略 `instruction` 时使用内置的裁切选择指令，要求模型返回 `{ stepIds }`，并明确将片段摘录视为数据。自定义解析器须同时提供对应指令。

### 显式推理 wire 策略

CompatibleModelProvider 的 `config.reasoning` 接受 `{ format, level }`。level 为 off／low／medium／high；format 明确指定供应商支持的字段格式，不按模型名称猜测。

| format | 生成字段 |
| --- | --- |
| reasoning-effort | reasoning_effort: none／low／medium／high |
| thinking | thinking.type: disabled／enabled，仅开关 |
| enable-thinking | enable_thinking: false／true，仅开关 |
| thinking-budget | thinking.type 及 budget_tokens；low／medium／high 缺省为 1024／4096／8192，可用 budgets 精确覆盖 |
| custom | map(level) 返回自定义 requestBody 字段，必须同步 |

显式 requestBody 字段优先于生成字段；两者都不能覆盖 model、messages、stream 或输出限额。thinking-budget 必须为回答预留空间，思考 token 数须小于实际输出限额；不满足时在发请求前拒绝，不扩大 Core 预算。带 getter／私有状态的 mapper 保留接收者，静态配置只解析一次，动态配置逐请求解析。

```ts
const provider = new Support.CompatibleModelProvider({ config: {
  baseUrl, apiKey, model,
  reasoning: { format: 'thinking-budget', level: 'high' },
} });
const settings = Support.createModelStrategy({ model: { provider }, maxOutputTokens: 10000 });
```

JSON 值传输缺省启用 `json` 模式。CompatibleModelProvider 的该模式使用 `json_object`；需要数组／标量而供应商不支持对应模式时，可在同一 `options` 中显式设 `json: false`，仍保留完整 JSON 解码和 outputSchema 校验。

## 模型 Tool、用途与激活

`Support.defineModelTools(definitions)` 编译 BaseTool 声明：id、description、inputSchema 和同步 resolve。省略 resolve 时，Support 将已解析输入作为结果。ExecutableTool 复用模型元数据，并提供授权、执行与结果校验；`defineToolCatalog` 从同一声明生成 `catalog.tools` 模型视图，无需另配 Capability。

```ts
const tools = Support.defineModelTools([{
  id: 'manage_memo',
  description: 'Process a memo draft',
  inputSchema: memoSchema,
  asIntent: {
    description: 'Remember something or set a reminder',
    when: context => context.features.memos,
  },
  active: context => context.services.memos != null,
  resolve: input => input,
}]);
const discovery = tools.select({ intent: true }, context);
const explicit = tools.select(['manage_memo'], context);
```

`asIntent` 接受 true、非空描述、同步布尔判断函数或 `{ description?, when? }`。省略表示不参与需求识别，不提供静态 false。描述省略时复用 Tool 描述，when 省略时参与。允许的下一步统一由 DomainTool.delegates 声明，不放入发现元数据。Intent 没有独立身份或注册表；不同 Tool 的相似描述分别保留。

`active` 接受布尔值或同步判断函数，省略默认激活。获取时筛选，已准备视图与执行入口在处理时复核；激活不能代替鉴权。节点自主组织候选，任何阶段都可以使用 select({ intent: true }, context)；Engine 不依据标记自动投放工具。

## delegate 与分派

生命周期调用使用工具自身的 `id`。`lifecycle` 只声明协议和钩子，不含第二个身份；`registry.call(next, context)` 用 `next.type` 查找同一工具，并复核启用条件。协议投影、选中钩子和实际分派共用该 ID。决策的选中工具默认从 `next.type` 或 `type` 读取，特殊结构才配置 `ToolLifecycleRegistryOptions.toolId`。

DomainTool 的 `delegates` 表示允许的下一步，引用工具 ID 或终态输出协议 ID。它是业务约束，不是另一份工具声明，也不规定执行顺序。

## Tool 关联注册

```ts
const linked = Support.defineAssociatedCatalog(owners, {
  tools: independentTools,
  toolDefaults: owner => existingTools.require(owner.id),
});
// owner.modelTools: an array of inline Tool overrides or independent Tool IDs.
// linked.tools: normalized model Tool catalog.
// linked.bindings: owner ID -> toolIds.
// linked.sources: local provenance; not automatically sent to the model.
```

引用只指向显式独立 Tool，不隐式依赖另一个 owner 恰好贡献的工具。重名、重复引用和缺失合同拒绝；modelTools 空数组关闭该 owner 的缺省投影。不会把工具描述聚合为 Intent 实体。装饰器转换不接收并联 asIntent：同一目标分别使用 WorkflowTool 和 Intent 装饰器。完整代码见[独立配置与关联配置](configuration-in-workflow.md)。

执行工具复用模型元数据，不配置自定义 `resolve`。模型投影始终以原始参数生成 `{ toolId, input }`，业务参数仅在执行时解析一次。需要自定义同步映射时，另行声明模型工具。

`select(ids, context?)` 和 `select({ intent: true }, context)` 复用不可变注册条目，允许空选择。不传上下文时，选择排除 `active: false`，保留带函数条件的声明且不求值；传入上下文时筛选条件，并在解析提议时复核。`bind({ app })` 按绑定上下文生成模型视图。实际执行仍复核启用条件和授权。

单次模型工具响应返回 `DecodedModelToolResponse` / `DecodedModelResponseToolCall`。名称匹配与 JSON 解码不代表通过 Schema 校验、映射、授权或执行。需要模型映射时，将提议交给所选 source 的 `resolve`；执行工具则将原始参数交给绑定运行时。未知工具不提供解码后的 `input`。

## 候选、协议与会话

```ts
const catalog = Support.defineToolCatalog(definitions);
const candidates = catalog.select({ intent: true, include: continuationIds }, context);
const envelope = Support.defineSchema({
  jsonSchema: commandSchema,
  tools: candidates.tools,
  parse: parseCommand,
});
const runtime = candidates.bind({ app: context });
const interaction = Support.createModelInteraction({
  id: 'conversation', response: 'tools', tools: runtime.tools,
});
// 模型返回后，按业务顺序逐个调用；无需重新拼接 toolId/input。
for (const call of result.value.calls) await runtime.invoke(call);
```

`select(ids, context)` 是显式选择；`select({ intent: true, include }, context)` 选择需求入口并加入明确的后续工具。共同启用条件始终生效，发现描述只覆盖发现候选，普通后续工具保留执行描述。include 必须引用当前目录中的工具。

`defineSchema` 的 tools 参数为 name/input 包装生成名称枚举、参数 Schema 关联与必要字段，同时在解析前拒绝候选之外的名称。它不提前调用业务输入解析器，不替代命令自身的解析或实际授权。

`createModelInteraction` 缺省返回一次选择的映射结果；`response: 'tools'` 返回正文与解码调用列表。两者复用相同模型调用和工具来源接口。会话可使用空工具目录，此时只允许直接回复；工具调用仍由应用按依赖和业务顺序交给现有 invoke。调用结果保留原回执，未知工具和非法 JSON 不会进入业务执行。

工具的 domainToolIds 是默认关系来源，domainToolDelegates 从实际工具和终态协议推导目标可选下一步，避免两份对应表。显式 delegates 是闭合集合，不会被其他登记自动扩宽；省略时由实际关联工具推导。本次候选排除未安装协议和未激活工具。

模型协议、每轮设置、资源准备、续接与生命周期见[统一模型接入](model-protocols.md)。

## 答复指导归并

`Support.resolveReplyGuidance({ defaults?, node?, tools?, call? })` 复制并冻结 App 选择的可信 `ReplyGuidance`。优先级为默认值 < 节点 < 适用工具 < 当前调用；多个工具默认值冲突时须明确选择当前调用值。所有提供值都校验，包括被覆盖的默认值。无值时返回 undefined。它不扫描注册，也不把工具描述、工具结果或用户原文提升为指令。将结果作为 Runner 或工作流模型调用的 `replyGuidance`。[答复组织](../../articles/reply-organization.md)提供完整示例和更丰富的风格/参考指导。

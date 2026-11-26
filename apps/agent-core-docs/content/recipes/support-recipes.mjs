/**
 * Support 层示例主体：Schema、推荐工具目录、注册目录、模型传输与 Provider、
 * 预览、观察、拒绝检查、SSE/JSON 帧、协议目录与显式重试。
 * 末尾展开 support-context 的上下文示例，最终由 core-support.mjs 聚合。
 */
import context from './support-context.mjs';

// 多个工具示例共用同一份空对象 Schema，避免重复噪音掩盖真正要展示的合同。
const emptySchema = `const inputSchema = Support.defineSchema({
  jsonSchema: { type: 'object', properties: {}, additionalProperties: false },
  parse(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length) throw new TypeError('需要空对象');
    return {};
  },
});`;

export default [
  {
    // 演示 JSON 声明与运行解析的同一合同；动态 import 与 compile 端口都只是把校验委托给真实实现。
    id: 'schema-adapters',
    title: 'Schema：保留 JSON 声明与实际解析的同一合同',
    layer: 'support',
    matches: [
      'defineSchema',
      'fromParserSchema',
      'fromJsonSchema',
      'SchemaAdapter',
      'JsonSchemaOptions',
    ],
    summary: 'Support 生成规范的 SchemaAdapter，Core 只要求 jsonSchema 与同步 parse 合同。',
    details: `defineSchema 固定声明快照并绑定原 parser 接收者。它不会根据 JSON Schema 自动猜出 TypeScript 类型，也不是内置通用验证器。JSON Schema 向模型说明允许的结构，parse 在真实运行边界验证该结构，两者都必须有效。

已有解析库可以使用 fromParserSchema，显式提供 toJsonSchema；只有 JSON Schema 时，fromJsonSchema 接受调用者拥有的 compile 函数。编译返回的校验器必须同步返回 boolean。不能用始终返回 true 的 parser 冒充验证，不能把泛型参数当作运行时校验。`,
    examples: [
      {
        title: '一个有实际校验的字符串对象',
        level: '入门',
        environment: 'Node.js',
        ts: `import { Support } from '@jangts/agent-core';
const nameSchema = Support.defineSchema({
  jsonSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'], additionalProperties: false },
  parse(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 1 || !('name' in value) || typeof value.name !== 'string') throw new TypeError('需要 name 字符串');
    return { name: value.name };
  },
});
console.log(nameSchema.parse({ name: 'Ivan' }));`,
      },
      {
        title: '复用已经拥有的解析对象',
        level: '配置',
        environment: 'Node.js',
        ts: `import { Support } from '@jangts/agent-core';
class NameParser {
  parse(value: unknown) { if (typeof value !== 'string' || !value.trim()) throw new TypeError('需要非空姓名'); return value.trim(); }
}
const schema = Support.fromParserSchema(new NameParser(), {
  toJsonSchema: () => ({ type: 'string', minLength: 1 }),
});
console.log(schema.parse(' Ivan '));`,
        note: '实际接解析库时，toJsonSchema 必须准确表达该 parser；不是库名称决定可信度。',
      },
      {
        title: '使用已有 JSON Schema 编译端口',
        level: '扩展',
        environment: 'Node.js',
        ts: `import { Support } from '@jangts/agent-core';
const schema = Support.fromJsonSchema<number>({ type: 'integer', minimum: 0 }, {
  compile(jsonSchema) {
    if (jsonSchema.type !== 'integer' || jsonSchema.minimum !== 0) throw new Error('本例编译器只处理该规则');
    return (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
  },
});
console.log(schema.parse(3));`,
        note: '演示显式编译端口，不是一个通用 JSON Schema 编译器；生产可接入 App 已有的成熟编译器。',
      },
    ],
    policies: [
      {
        title: 'Schema 快照与同步校验规则',
        file: 'src/support/schema.ts',
        symbols: ['defineSchema', 'fromParserSchema', 'fromJsonSchema'],
      },
    ],
  },
  {
    // 演示一份定义同时生成模型 Tool Schema 与执行运行时；选择 Tool 不等于已执行工具。
    id: 'recommended-tool-catalog',
    title: '工具最佳实践：一份定义生成模型 Tool 与执行运行时',
    layer: 'support',
    matches: [
      'defineTool',
      'defineToolCatalog',
      'createToolRegistry',
      'ToolCatalog',
      'ToolCatalog.bind',
      'ToolCatalog.select',
      'ToolRuntime',
      'ToolDefinition',
      'ToolModelView',
      'ToolProposal',
    ],
    summary: '把 Schema、授权、执行和输出校验登记一次，按请求绑定 App，避免维护两份工具清单。',
    details: `defineTool 不只是格式化对象：它校验身份和必需 handler，固定 Schema/回调接收者，并要求 authorize 成功返回 void、拒绝时抛错。defineToolCatalog 同源生成模型可见 tools 与真实工具运行时；选择 Tool 并不执行工具。

catalog 在定义阶段复用；bind({app,execution}) 绑定请求依赖，得到 async invoke 和显式同步 invokeSync。Core 接受满足执行合同的实现，不要求 catalog 或 handler 转成普通对象。select 只选择已登记 ID，不扩大本次授权；真正 execute 前仍调用 authorize。

createToolRegistry 是直接将定义与 App 依赖接到 Core ToolRegistry 的装配入口；通常优先 catalog.bind，已有清单时无需重复手配 Tool Schema。`,
    examples: [
      {
        title: '定义并使用一项只读工具',
        level: '入门',
        environment: 'Node.js',
        ts: `import { Support } from '@jangts/agent-core';
${emptySchema}
const catalog = Support.defineToolCatalog([{ id: 'get_status', kind: 'read', description: '读取服务状态', inputSchema,
  authorize() {},
  execute() { return '服务运行正常'; },
  parseOutput(value: unknown) { if (typeof value !== 'string') throw new TypeError('需要字符串'); return value; },
}]);
const tools = catalog.bind({ app: undefined });
console.log((await tools.invoke({ toolId: 'get_status', input: {} })).value);
console.log(catalog.tools.ids());`,
      },
      {
        title: '保留清单，增加本次权限与服务依赖',
        level: '配置',
        environment: 'Node.js',
        ts: `import { Support } from '@jangts/agent-core';
import type { OperationContext } from '@jangts/agent-core/types';
type App = { allowed: boolean; readStatus(): Promise<string> };
${emptySchema}
const catalog = Support.defineToolCatalog<App>([{ id: 'get_status', kind: 'read', description: '读取状态', inputSchema,
  authorize(_input: {}, { app }: OperationContext<App>) { if (!app.allowed) throw new Error('当前请求没有读取权限'); },
  execute(_input: {}, { app }: OperationContext<App>) { return app.readStatus(); },
  parseOutput(value: unknown) { if (typeof value !== 'string') throw new TypeError('需要字符串'); return value; },
}]);
const tools = catalog.bind({ app: { allowed: true, readStatus: async () => '服务运行正常' },
  execution: { signal: AbortSignal.timeout(10000) },
});
console.log((await tools.invoke({ toolId: 'get_status', input: {} })).value);`,
      },
    ],
    policies: [
      {
        title: '授权与工具能力投影来自同源定义',
        file: 'src/support/tools.ts',
        symbols: ['defineTool', 'defineToolCatalog'],
      },
    ],
  },
  {
    // 演示集中清单与按序安装；optionalToolIds 只表示使用关系，引用仍必须有效。
    id: 'registration-catalog',
    title: '能力组合与声明式安装',
    layer: 'support',
    matches: [
      'defineCapabilityCatalog',
      'validateToolReferences',
      'defineRegistrationCatalog',
      'CapabilityModule',
      'CapabilityCatalogOptions',
      'CapabilityToolReferences',
      'RegistrationDefinition',
      'ReadonlyCatalog',
      'Registry',
      'defineAssociatedCatalog',
    ],
    summary: '集中列出模块、工具引用和注册顺序；通用循环只消费这份实际清单。',
    details: `defineCapabilityCatalog 核对模块与工具的唯一身份，建立 tools 及 findToolOwner 投影；requiredToolIds 与 optionalToolIds 都必须指向已经登记的工具，optional 只表示使用关系，并不容许写错引用。它不创建新的 Core 执行阶段。

defineRegistrationCatalog 将静态安装项编译为只读目录，install(app) 按顺序评估 when 并调用 register。后项可观察前项安装后的状态。谓词与注册都同步，不用 enabled 代替部署配置、本次权限和执行授权三个不同判断。

defineAssociatedCatalog 在装配时核对 owner 到工具的引用：字符串只能指向独立登记的工具，内联声明可补全默认值；重复工具 ID 与未知 owner 直接拒绝，不创建平行意图身份，也不执行工具。

Catalog 的 get 可返回 undefined，require 未找到时抛错；ids/definitions/values/entries 是同一集合的不同视图，不是平行清单。`,
    examples: [
      {
        title: '直接复用现有模块声明',
        level: '入门',
        environment: 'Node.js',
        ts: `import { Support } from '@jangts/agent-core';
const modules = [{ id: 'service', description: '服务查询能力', tools: [{ id: 'get_status' }] }];
const catalog = Support.defineCapabilityCatalog(modules);
console.log(catalog.ids(), catalog.findToolOwner('get_status')?.id);`,
      },
      {
        title: '增加工具引用和有序安装',
        level: '配置',
        environment: 'Node.js',
        ts: `import { Support } from '@jangts/agent-core';
const modules = [{ id: 'service', description: '服务查询', tools: [{ id: 'get_status' }],
  references: [{ id: 'status-skill', requiredToolIds: ['get_status'], optionalToolIds: [] }] }];
const moduleCatalog = Support.defineCapabilityCatalog(modules, { toolReferences: module => module.references });
const registration = Support.defineRegistrationCatalog<{ installed: string[] }>([
  { id: 'service', register: app => { app.installed.push(moduleCatalog.require('service').id); } },
  { id: 'status-view', when: app => app.installed.includes('service'), register: app => { app.installed.push('status-view'); } },
]);
const app = { installed: [] as string[] };
registration.install(app);
console.log(app.installed);`,
      },
    ],
    policies: [
      {
        title: '引用检查与同源能力组合',
        file: 'src/support/capabilities.ts',
        symbols: ['validateToolReferences', 'defineCapabilityCatalog'],
      },
      {
        title: '所有者到工具的关系投影',
        file: 'src/support/associations.ts',
        symbols: ['defineAssociatedCatalog'],
      },
    ],
  },
  {
    // 演示能力到传输/阶段投影的生成；交互适配必须显式选择，Core 不按模型名猜回退。
    id: 'recommended-model-transport',
    title: '模型传输与阶段投影',
    layer: 'support',
    matches: [
      'defineModelTools',
      'createModelInteraction',
      'createStageModelInteraction',
      'createTextInteraction',
      'nativeFunctionInteraction',
      'jsonObjectInteraction',
      'modelInteractionCatalog',
      'ModelInteractionAdapter',
      'ModelStageInteractionRegistration',
      'ModelInteractionRegistration',
      'prepareModelToolInteraction',
    ],
    summary: '从 Tool 定义生成封存目录与阶段投影，原生函数和 JSON 适配复用同一 Tool 合同。',
    details: `createTextInteraction 明确创建普通文本传输；createModelInteraction 默认使用 nativeFunctionInteraction。需要 JSON 协议时显式传 jsonObjectInteraction，Core 不根据模型名称、URL 或失败次数猜测回退。

createStageModelInteraction 使用 stages[{id,toolIds}] 约束每个模型阶段。静态源装配时核验，动态 source 工厂在本次 prepare 时获取快照；已准备调用固定 resolver 与接收者。未知阶段先拒绝，不调用动态 source；阶段外 Tool 不能通过运行时绕过。

modelInteractionCatalog 以 native-functions、json-object 两个真实适配器 ID 提供只读目录。App 可按明确的模型 Tool 配置选择目录项，不根据模型名称、URL 或失败次数自动猜测。直接使用适配器与通过目录 ID 代指使用同一 ModelInteractionAdapter 合同。

requireStrictArguments 请求适配器声明的严格参数能力；不支持则装配时拒绝。它不保证供应商一定正确响应，最终 collector 与 Schema 仍需校验。

createModelInteraction 通过 response: 'tools' 允许一次响应同时包含正文与多个工具调用，并复用同一调用收集器；它只提供解析结果，不执行工具。prepareModelToolInteraction 为各阶段准备工具声明，未知工具与非法参数以 problem 标记保留，执行工具可将解码调用直接交给 runtime.invoke，参数解析、授权与取消检查仍由同一执行入口负责。`,
    examples: [
      {
        title: '创建具名文本传输',
        level: '入门',
        environment: 'Node.js',
        ts: `import { ModelRunner, Support } from '@jangts/agent-core';
const text = Support.createTextInteraction({ id: 'brief', options: { temperature: 0.2 } });
const runner = new ModelRunner({ provider: { async *stream() { yield '服务正常'; } }, interactions: [text] });
console.log((await runner.invoke({ input: '简答服务状态', interaction: text })).value);`,
      },
      {
        title: '从同源 Tool 生成两个阶段的传输',
        level: '配置',
        environment: 'Node.js',
        ts: `import { Support } from '@jangts/agent-core';
${emptySchema}
const tools = Support.defineModelTools([
  { id: 'greet', description: '问候', inputSchema, resolve: () => 'greet' },
  { id: 'status', description: '状态查询', inputSchema, resolve: () => 'status' },
]);
const interaction = Support.createStageModelInteraction({ id: 'intent', tools,
  stages: [{ id: 'recognize', toolIds: ['greet', 'status'] }, { id: 'status-only', toolIds: ['status'] }],
});
console.log(interaction.prepare('status-only').schemaChars);`,
      },
      {
        title: '保留 Tool，只替换明确的交互适配',
        level: '扩展',
        environment: 'Node.js',
        ts: `import { Support } from '@jangts/agent-core';
${emptySchema}
const tools = Support.defineModelTools([
  { id: 'status', description: '查询服务状态', inputSchema, resolve: () => 'status' },
]);
const native = Support.createModelInteraction({ id: 'native', tools });
const adapterId: keyof typeof Support.modelInteractionCatalog = 'json-object';
const json = Support.createModelInteraction({ id: 'json', tools, adapter: Support.modelInteractionCatalog[adapterId] });
console.log(native.id, json.id);`,
        note: '模型调用仍是 invoke({input,interaction}) 并返回 ModelResult；切换交互不重新设计业务结果。',
      },
    ],
    policies: [
      {
        title: '阶段清单校验与动态源快照',
        file: 'src/support/model/stage-transport.ts',
        symbols: ['createStageModelInteraction'],
      },
      {
        title: '显式模型交互适配器目录',
        file: 'src/support/model/interactions/index.ts',
        symbols: ['modelInteractionCatalog'],
      },
      {
        title: '正文与多工具调用的会话传输',
        file: 'src/support/model/session.ts',
        symbols: ['prepareModelToolInteraction'],
      },
    ],
  },
  {
    // 演示兼容 Provider 的 HTTP/SSE 生命周期；自定义 Provider 必须自行遵守同一传输合同。
    id: 'compatible-provider',
    title: '兼容 Provider 与自定义 Provider',
    layer: 'support',
    matches: [
      'CompatibleModelProvider',
      'CompatibleModelProvider.stream',
      'CompatibleModelProviderOptions',
      'CompatibleModelConfig',
      'CompatibleModelPorts',
      'completionPolicyCatalog',
      'defaultCompletionPolicy',
      'sessionCompletionPolicy',
      'createToolCallCollector',
      'ProviderMessage',
      'chatCompletionMessages',
      'chatCompletionParts',
      'chatCompletionFunctionOptions',
    ],
    summary:
      'Support 负责常见 Chat Completions HTTP/SSE 生命周期；App 可替换为自己的 ChatProvider。',
    details: `CompatibleModelProvider 接受 {config,ports?,observe?,errors?}，config 可是静态配置或动态读取函数。静态配置及回调固定，动态工厂按实际调用取当前配置。请求密钥来自服务端配置，不写在前端、文章或代码仓库。

requestBody 允许供应商扩展参数，但不能覆盖 model/messages/stream/max_tokens/max_completion_tokens 等 Core 已控制字段。不同请求协议请实现 ChatProvider，而不是绕过同一适配器的约束。

完成判定通过 ports.completionPolicy 选择。缺省使用 completionPolicyCatalog.default，是否接受函数分片、期望的 finish_reason、[DONE] 前的完整性都按调用是否声明 functions 判定。completionPolicyCatalog.session 按线上 tool_choice 判定：auto 要求已开始的调用全部完整并允许正文，required 与指定函数对象要求至少一个完整调用，none 拒绝任何调用分片，字段省略采用 default 的完成规则，未知值在发请求前拒绝。策略只判定响应是否满足请求，不接管请求循环、传输保护或工具执行。

createToolCallCollector 按 index 聚合调用分片，策略与直接调用方共用同一实现；ID 冲突、跨 index 重复 ID 与残缺调用都按协议错误拒绝。协议层从不限制接收多个调用分片，parallel_tool_calls 只是发送字段；Agent 路径的单提案限制由 nativeFunctionInteraction 决定，直接使用 Provider 不受该限制，也不因此获得工具执行或调度能力。需要正文 + 多调用时显式使用 createModelInteraction；它复用同一聚合 collector，但不改变 nativeFunctionInteraction 的单提案合同。

ProviderMessage 提供直连所需的 tool 结果与 assistant toolCalls；chatCompletionMessages 显式映射为 tool_call_id 与嵌套 tool_calls，角色与字段不匹配时拒绝。只发送声明字段，额外字段（包括原始 wire 字段）不透传；toolCallId 必须是非空字符串，role 与 content 按消息合同校验。Core ModelMessage 现支持 assistant toolCalls 与 role:'tool' 字段；ChatProvider 抽象签名保持 readonly ModelMessage[] 不变。

工具的注册、参数业务校验、授权和执行由宿主负责。createToolCallCollector.complete() 检查调用 ID 与名称的完整性，不解析或验证业务参数 JSON。

Provider 必须按传输合同结束：未完成、超限、格式不符、取消与供应商错误分别失败。错误映射不等于自动重试策略。chatCompletionMessages/Parts/FunctionOptions 是 wire 边界转换，不是业务协议验证器。`,
    examples: [
      {
        title: '真实服务端配置接入常见协议',
        level: '入门',
        environment: 'Node.js',
        ts: `import { ModelRunner, Support } from '@jangts/agent-core';
const provider = new Support.CompatibleModelProvider({ config: {
  baseUrl: process.env.MODEL_BASE_URL!, apiKey: process.env.MODEL_API_KEY!, model: process.env.MODEL_NAME!,
} });
const runner = new ModelRunner({ provider });
console.log((await runner.invoke('你好')).value);`,
        note: '运行此例需要提供可用模型服务的连接配置。',
      },
      {
        title: '直连工具线程的声明字段与 wire 映射',
        level: '配置',
        environment: 'Node.js',
        ts: `import { Support } from '@jangts/agent-core';
const messages: Support.ProviderMessage[] = [
  { role: 'user', content: '查询资料' },
  { role: 'assistant', content: '', toolCalls: [
    { id: 'call-1', name: 'lookup', arguments: '{"query":"资料"}' },
  ] },
  { role: 'tool', content: '{"found":true}', toolCallId: 'call-1' },
];
console.log(Support.chatCompletionMessages(messages));`,
        note: '只演示消息转换，无网络请求或工具执行。原始 tool_calls、tool_call_id 和宿主附加数据不透传。',
      },
      {
        title: '同一合同接入离线对象实现',
        level: '配置',
        environment: 'Node.js',
        ts: `import { ModelRunner } from '@jangts/agent-core/model';
const provider = { async *stream(messages: readonly { content: string }[]) {
  yield '离线回答：' + messages.at(-1)!.content;
} };
console.log((await new ModelRunner({ provider }).invoke('你好')).value);`,
      },
      {
        title: '由类实现 Core 的 Provider 合同',
        level: '扩展',
        environment: 'Node.js',
        ts: `import { ChatProvider, ModelRunner } from '@jangts/agent-core';
import type { ModelMessage, ModelProviderContext } from '@jangts/agent-core/types';
class LocalProvider extends ChatProvider {
  async *stream(messages: readonly ModelMessage[], context: ModelProviderContext) {
    context.signal.throwIfAborted();
    yield '离线回答：' + messages.at(-1)!.content;
  }
}
console.log((await new ModelRunner({ provider: new LocalProvider() }).invoke('你好')).value);`,
      },
    ],
    policies: [
      {
        title: 'HTTP 失败映射和受控请求字段',
        file: 'src/support/model/compatible-provider.ts',
        symbols: ['httpFailures', 'reservedRequestFields', 'assertRequestExtensions'],
      },
    ],
  },
  {
    // 演示按阶段/能力/路径提取可展示正文；预览仍是未校验的模型流，不能据此执行工具。
    id: 'reply-preview',
    title: '正文预览：有序输出，不代替最终接受',
    layer: 'support',
    matches: [
      'createReplyPreview',
      'ReplyPreviewRule',
      'ReplyPreviewOptions',
      'ReplyPreviewSettings',
    ],
    summary: '按已登记的 stage/tool/字段路径提取可展示正文，拒绝把控制提议当作已执行结果。',
    details: `createReplyPreview 接收 rules、sink、可选 render 和 maxChars，返回供 ModelRunner.sink.output 调用的 handler。规则是暂态展示范围：哪些阶段、哪个 Tool、哪些正文路径可展示。

预览接收的是尚未完整校验的模型流，不能据此执行工具、批准写操作或持久化最终回复。model.end 失败会撤销预览。sink 按序等待并传播失败；不要误写成忽略 Promise 的旁路 observer。render 同步，规则及接收者在创建时固定。`,
    examples: [
      {
        title: '为纯文本阶段增加预览',
        level: '入门',
        environment: 'Node.js',
        ts: `import { ModelRunner, Support } from '@jangts/agent-core';
const preview = Support.createReplyPreview({ rules: [{ stageId: 'reply' }],
  sink: bubbles => { console.log('preview', bubbles); },
});
const runner = new ModelRunner({ provider: { async *stream() { yield '你好'; yield '，Core'; } }, sink: { output: preview } });
console.log((await runner.invoke({ input: '你好', stageId: 'reply' })).value);`,
      },
      {
        title: '只允许明确正文协议的可展示字段',
        level: '配置',
        environment: 'Node.js',
        ts: `import { Support } from '@jangts/agent-core';
const preview = Support.createReplyPreview({
  rules: [{ stageId: 'reply', toolId: 'reply', paths: [['answer'], ['bubbles', '*']],
    when: { path: ['kind'], values: ['reply'] } }],
  sink: async bubbles => { console.log('当前暂态正文', bubbles); },
  maxChars: 4000,
});
console.log(typeof preview);`,
        note: '规则必须对应 App 实际登记的 reply Tool 与 Schema，配置预览本身不创建模型 Tool。',
      },
    ],
  },
  {
    // 演示稳定 Provider 绑定观察规则、请求级关联值；该观察是隔离旁路，不改变结果与取消。
    id: 'provider-observation',
    title: 'Provider 观察与 App 自己的记录目标',
    layer: 'support',
    matches: [
      'createProviderObservationScope',
      'ProviderObserver',
      'ProviderObservation',
      'ProviderEventDescriptor',
      'ProviderEventPayloads',
    ],
    summary: '稳定 Provider 绑定观察规则，本次请求只关联自己的目标，子作用域继承关联。',
    details: `ProviderObservation 是 wire 边界的 Support 观察，不是 Core 的执行事件。接受规则可区分 metadata 和 content，未启用时不构造内容 payload 或读取错误正文。它是失败隔离的旁路，不改变模型结果、取消和重试。

createProviderObservationScope 返回 observer 与 attach。observer 可在稳定 Provider 构造时绑定，attach 在本次请求绑定日志目标。App 拥有脱敏、读取/记录权限与保留期，Core 不理解这个目标是不是文件、数据库或消息记录。`,
    examples: [
      {
        title: '只观察元数据',
        level: '入门',
        environment: 'Node.js',
        ts: `import { Support } from '@jangts/agent-core';
const scope = Support.createProviderObservationScope<{ requestId: string }>({
  accepts(_owner, descriptor) { return descriptor.content === 'metadata'; },
  write(owner, event, spanId) { console.log(owner.requestId, spanId, event.event); },
});
console.log(scope.observer);`,
      },
      {
        title: '按本次请求绑定自己的关联值',
        level: '配置',
        environment: 'Node.js',
        ts: `import { Support } from '@jangts/agent-core';
import { createDiagnostics } from '@jangts/agent-core/diagnostics';
const scope = Support.createProviderObservationScope<{ requestId: string }>({
  accepts: (_owner, descriptor) => descriptor.content === 'metadata',
  write(owner, event, spanId) { console.log(owner.requestId, spanId, event.event); },
});
const provider = new Support.CompatibleModelProvider({
  config: { baseUrl: process.env.MODEL_BASE_URL!, apiKey: process.env.MODEL_API_KEY!, model: process.env.MODEL_NAME! },
  observe: { provider: scope.observer },
});
const diagnostics = scope.attach(createDiagnostics(), { requestId: 'app-request-1' });
console.log(provider, diagnostics.identity?.runId);`,
        note: '此例只装配；实际调用时把该 diagnostics 配入对应请求 execution，不把 App ID 强塞进 Core 身份。',
      },
    ],
  },
  {
    // 演示 breakWhile/matchRule/walkRules 的首次拒绝与首个匹配语义；单条件仍可直接用 if。
    id: 'rules-and-checks',
    title: '拒绝检查、首个匹配与顺序处理',
    layer: 'support',
    matches: [
      'breakWhile',
      'configureBreakWhile',
      'matchRule',
      'walkRules',
      'BreakCheck',
      'BreakPredicate',
      'BreakReason',
      'MatchRule',
      'WalkRule',
      'BreakWhileConfig',
    ],
    summary: '使用真实清单表达多项检查和枚举分发；单个普通判断仍可直接使用 if。',
    details: `breakWhile(occur,error?) 在遭遇拒绝条件时抛错；省略原因时创建 Error。检查数组按顺序在第一项拒绝后停止，依赖前项校验的条件使用回调，原因工厂仅在拒绝时执行。数组字段仍统一叫 occur，不按单复数另造 conditions。

注意：直接传 breakWhile(() => bad) 时，函数本身被当作一个真值，并不会求值；需要惰性条件时使用检查对象 {occur:()=>bad} 或谓词数组 [()=>bad]。

matchRule 返回首个匹配 handler 的结果，即使结果是 undefined 也不继续。walkRules 顺序执行所有匹配项，后项可观察前项修改；两者谓词同步返回 boolean。单条件正常处理不必套壳为清单。`,
    examples: [
      {
        title: '一个明确的拒绝',
        level: '入门',
        environment: 'Node.js',
        ts: `import { Support } from '@jangts/agent-core';
const input = '你好';
Support.breakWhile(!input.trim(), '问题不能为空');
console.log(input);`,
      },
      {
        title: '有依赖关系的检查按序求值',
        level: '配置',
        environment: 'Node.js',
        ts: `import { Support } from '@jangts/agent-core';
const input: unknown = { name: 'Ivan' };
Support.breakWhile([
  { occur: !input || typeof input !== 'object', error: '需要对象' },
  { occur: () => !('name' in (input as object)), error: '缺少 name' },
]);
console.log(input);`,
      },
      {
        title: '声明式优先分发与顺序转换',
        level: '扩展',
        environment: 'Node.js',
        ts: `import { Support } from '@jangts/agent-core';
const routeName = Support.matchRule([
  { id: 'status', description: '状态意图', pattern: (input: string) => input === 'status', handle: () => 'service' },
  { id: 'fallback', description: '其他意图', handle: () => 'reply' },
], 'status');
const state = { answer: '  服务正常  ' };
Support.walkRules([
  { handle: (value: typeof state) => { value.answer = value.answer.trim(); } },
  { pattern: (value: typeof state) => !!value.answer, handle: value => { value.answer += '。'; } },
], state);
console.log(routeName, state.answer);`,
      },
    ],
    policies: [
      {
        title: '拒绝检查与匹配短路的实际规则',
        file: 'src/utils/rules.ts',
        symbols: ['breakWhile', 'matchRule', 'walkRules'],
      },
    ],
  },
  {
    // 演示 SSE 编解码、单槽背压与 JSON 帧边界；不修复、不截断，业务结构仍由 Schema 校验。
    id: 'streams-and-frames',
    title: 'SSE、JSON 帧与有界事件流',
    layer: 'support',
    matches: [
      'readSse',
      'SseIdleTimeoutError',
      'encodeSseEvent',
      'writeSseFrame',
      'streamEvents',
      'abortableStream',
      'scanJsonObjectFrames',
      'parseJsonFrames',
      'SseWriter',
      'JsonFrameLimits',
    ],
    summary: '复用传输机制，保持取消和背压；协议解析与业务校验仍各自负责。',
    details: `readSse 解析标准 SSE；encodeSseEvent/writeSseFrame 只处理编码与可取消的写入背压，HTTP 响应、认证和生命周期由 App 框架拥有。浏览器接收不需要一个专用 SDK 后端。

streamEvents 使用单槽交接，生产者必须 await emit，不无限堆积输出。消费者停止时通知生产者，不将尚未消费内容当作已交付。

scanJsonObjectFrames 仅提取完整对象帧，不校验外围内容；parseJsonFrames 按 maxFrames/maxExtraClosings 校验外围字符并 JSON.parse。它们不修复、不截断、不解释业务字段，完整业务结构仍由 Schema 校验。`,
    examples: [
      {
        title: '在本地解析一帧 SSE',
        level: '入门',
        environment: 'Node.js',
        ts: `import { Support } from '@jangts/agent-core';
const frame = Support.encodeSseEvent({ event: 'status', data: JSON.stringify({ phase: 'thinking' }) });
const body = new Response(frame).body!;
for await (const event of Support.readSse(body)) console.log(event.event, event.data);`,
      },
      {
        title: '生产者等待每一次事件交付',
        level: '配置',
        environment: 'Node.js',
        ts: `import { Support } from '@jangts/agent-core';
const signal = new AbortController().signal;
const stream = Support.streamEvents<{ phase: string }>(async emit => {
  await emit({ phase: 'preparing' });
  await emit({ phase: 'complete' });
}, { signal });
for await (const event of stream) console.log(event.phase);`,
      },
      {
        title: '显式限制 JSON 帧数量和外围内容',
        level: '扩展',
        environment: 'Node.js',
        ts: `import { Support } from '@jangts/agent-core';
const text = '{"kind":"reply","answer":"服务正常"}';
console.log(Support.scanJsonObjectFrames(text));
console.log(Support.parseJsonFrames(text, { maxFrames: 1, maxExtraClosings: 0 }));
const sent: string[] = [];
await Support.writeSseFrame({
  writer: { write(frame) { sent.push(frame); return true; }, async waitForDrain() {} },
  frame: Support.encodeSseEvent({ event: 'answer', data: text }),
}, { signal: new AbortController().signal });
console.log(sent);`,
      },
    ],
    policies: [
      {
        title: '事件流单槽交接与背压',
        file: 'src/support/stream-events.ts',
        symbols: ['streamEvents'],
      },
    ],
  },
  {
    // 演示按 App 自己的协议 ID 登记规范；Core 不内置业务阶段名称或执行权限。
    id: 'protocol-registry',
    title: '协议目录：同一清单驱动匹配和校验',
    layer: 'core',
    matches: [
      'ProtocolRegistry',
      'ProtocolRegistry.require',
      'ProtocolRegistry.set',
      'ProtocolRegistry.ids',
    ],
    summary: '按 App 自己的协议 ID 登记规范；Core 不内置业务阶段名称。',
    details: `ProtocolRegistry 继承 Map，但 set 禁止重复 ID 和空值；require 未找到时抛错。注册的是 App 已定义的协议合同，不自动创建状态机、模型提示词或执行权限。

App 可以让同一清单同时驱动模型可见说明、解析和处理入口，避免模型枚举和程序分发各维护一套。不要把特定 Kit 的状态升级为所有 App 必需字段。`,
    examples: [
      {
        title: '一个可查的协议清单',
        level: '入门',
        environment: 'Node.js',
        ts: `import { ProtocolRegistry } from '@jangts/agent-core/protocols';
const protocols = new ProtocolRegistry([['reply', { description: '最终正文', terminal: true }]]);
console.log(protocols.require('reply'), protocols.ids());`,
      },
      {
        title: '从类型化声明生成同一目录',
        level: '配置',
        environment: 'Node.js',
        ts: `import { ProtocolRegistry } from '@jangts/agent-core/protocols';
const definitions = [
  { id: 'reply', terminal: true },
  { id: 'lookup', terminal: false },
];
const protocols = new ProtocolRegistry(definitions.map(definition => [definition.id, definition] as const));
console.log(protocols.require('lookup').terminal);`,
      },
    ],
  },
  {
    // 演示只对 MODEL_MULTIPLE_CALLS 显式回退；回退发生在任何工具副作用之前。
    id: 'explicit-model-retry',
    title: '仅在特定模型协议失败时显式回退',
    layer: 'support',
    matches: ['retryMultipleModelCalls'],
    summary: '处理不支持的并行提议，不接管 App 的全部重试和业务错误。',
    details: `retryMultipleModelCalls 只捕获带 MODEL_MULTIPLE_CALLS 代码的错误，调用显式 retry(error)；其他失败原样传播。回退发生在任何工具执行前，不能重复执行已经产生副作用的提议。

两次调用必须使用同一请求预算和取消。此 helper 不重置额度，也不根据模型名自动更换协议；回退调用的输入、传输与业务接受仍由 App 定义。`,
    examples: [
      {
        title: '正常调用保持同一返回合同',
        level: '入门',
        environment: 'Node.js',
        ts: `import { ModelRunner, Support } from '@jangts/agent-core';
const runner = new ModelRunner({ provider: { async *stream() { yield '服务正常'; } }, maxCalls: 2 });
const result = await Support.retryMultipleModelCalls({
  invoke: () => runner.invoke('查询服务状态'),
  retry: () => runner.invoke('只选择一个服务状态结论'),
});
console.log(result.value);`,
      },
      {
        title: '业务拒绝不会被当成自动重试条件',
        level: '配置',
        environment: 'Node.js',
        ts: `import { Support } from '@jangts/agent-core';
try {
  await Support.retryMultipleModelCalls({
    invoke: async () => { throw new Error('当前请求没有权限'); },
    retry: async () => '此回退不会被执行',
  });
} catch (error) { console.log((error as Error).message); }`,
      },
    ],
    policies: [
      {
        title: '明确的重试范围',
        file: 'src/model/decision-retry.ts',
        symbols: ['retryMultipleModelCalls'],
      },
    ],
  },
  ...context,
];

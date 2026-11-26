/**
 * 模型层 Support 示例：JSON 传输、供应商推理参数与模型策略生成。
 * 说明同一调用合同如何按场景补全预算与推理配置，由 core-support.mjs 聚合。
 */
export default [
  {
    // 演示 JSON 值直传：Schema 与 parser 同时绑定，模型输出不经过能力 envelope。
    id: 'json-value-transport',
    title: 'JSON 值传输：直接校验结构化结果',
    layer: 'support',
    matches: ['createJsonInteraction'],
    summary:
      '从输出 Schema 生成 JSON 收集与解析实现，不增加 Tool 选择 envelope，返回统一的模型回执。',
    details: `缺省开启 json 模式；CompatibleModelProvider 使用 json_object。数组或标量输出需要关闭该供应商模式时，可显式 options.json=false，仍执行相同 JSON 解码和 Schema 校验。

createJsonInteraction({id,outputSchema,options?}) 返回满足 Core ModelInteractionDefinition<T> 的实现，保留 id 字面量。outputSchema 是 SchemaAdapter<T>，包含 JSON Schema 及同步 parser；可以是普通对象、Support 的 Schema 实现或自定义类。JSON 解码后还会调用 parser，因此 Schema 声明和模型输出均不能代替运行时验证。

每次模型调用创建新 collector，不共享分片缓存。collector 接受文本分片；函数调用分片、非法 JSON、Schema 校验失败和异步 parser 均会拒绝。Runner 继续承担输入、Schema、输出预算，取消和调用额度；该助手不会创建额外运行器或放大权限。

模型输出直接是该 Schema 的 JSON 值，调用结果仍是 {value,invocation}。它没有 tool/input envelope，不要求 Tool 目录。需要模型选择 Tool 时使用 createModelInteraction/createStageModelInteraction。Provider 决定 JSON wire 方式和实际支持的值类型，不按模型名称推断。`,
    examples: [
      {
        title: '最小 JSON 摘要：Schema 和 parser 一次绑定',
        level: '入门',
        environment: 'Node.js',
        ts: `import { ModelRunner, Support } from '@jangts/agent-core';
const summary = Support.createJsonInteraction({ id: 'summary', outputSchema: {
  jsonSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false },
  parse(value: unknown) {
    if (!value || typeof value !== 'object' || !('text' in value) || typeof value.text !== 'string') throw new TypeError('需要摘要正文');
    return { text: value.text };
  },
} });
const provider = { async *stream() { yield '{"text":"服务运行正常。"}'; } };
const model = new ModelRunner({ provider, interactions: [summary] });
const result = await model.invoke({ input: '概括服务状态', interaction: summary });
console.log(result.value.text, result.invocation);`,
      },
      {
        title: '同一摘要合同增加温度、预算与自定义解析实现',
        level: '扩展',
        environment: 'Node.js',
        ts: `import { ModelRunner, Support } from '@jangts/agent-core';
class SummarySchema {
  readonly jsonSchema = { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false };
  #maxChars = 100;
  parse(value: unknown) {
    if (!value || typeof value !== 'object' || !('text' in value) || typeof value.text !== 'string'
      || !value.text.trim() || value.text.length > this.#maxChars) throw new TypeError('需要简短摘要');
    return { text: value.text };
  }
}
const summary = Support.createJsonInteraction({ id: 'summary', outputSchema: new SummarySchema(), options: { temperature: 0.2 } });
const model = new ModelRunner({ provider: { async *stream() { yield '{"text":"服务运行正常。"}'; } },
  interactions: [summary], maxCalls: 2, maxOutputTokens: 256,
});
console.log((await model.invoke({ input: '概括服务状态', interaction: 'summary' })).value.text);`,
        note: '两个示例均为离线 Provider。更换供应商时继续使用同一传输和调用合同。',
      },
    ],
    policies: [
      {
        title: 'JSON 收集、解码和输出 Schema 校验',
        file: 'src/support/model/transports.ts',
        symbols: ['createJsonInteraction'],
      },
    ],
  },
  {
    // 演示推理参数由供应商格式声明决定；requestBody 不能覆盖 Core 控制的请求字段。
    id: 'provider-reasoning-strategies',
    title: '推理策略：显式 wire 格式与自然档位',
    layer: 'support',
    matches: ['ProviderReasoningLevel', 'ProviderReasoningStrategy'],
    summary: 'Support 按显式选择的协议格式生成推理参数，保留精确覆盖与自定义映射。',
    details: `CompatibleModelProvider 的 config.reasoning 使用 level=off/low/medium/high，并显式选择 format。reasoning-effort 生成 reasoning_effort；thinking 与 enable-thinking 仅表达开关，不宣称 low/high 有强度差异；thinking-budget 的 low/medium/high 默认思考预算为 1024/4096/8192，可通过 budgets 覆写；custom 使用同步 map(level)。

requestBody 的显式字段优先。无论是 mapper 或 requestBody，都不能覆盖模型、消息、流及 Core 输出限额。thinking-budget 必须小于实际输出 token 限额，不通过提高 Core 额度补救冲突。格式由供应商声明决定，不能只因模型名称相似就使用；独立 Provider 仍可以实现同一 ChatProvider 合同。`,
    examples: [
      {
        title: '按明确 wire 格式生成思考预算',
        level: '配置',
        environment: 'Node.js',
        ts: `import { Support } from '@jangts/agent-core';
const provider = new Support.CompatibleModelProvider({ config: {
  baseUrl: 'https://provider.example', apiKey: 'placeholder', model: 'configured-model',
  reasoning: { format: 'thinking-budget', level: 'high', budgets: { high: 6000 } },
} });
console.log(provider instanceof Support.CompatibleModelProvider);`,
        note: '这里只装配，不发送网络请求。调用时输出 token 限额必须大于思考预算。',
      },
      {
        title: '自定义供应商映射并保留原字段的精确覆盖',
        level: '扩展',
        environment: 'Node.js',
        ts: `import { Support } from '@jangts/agent-core';
const provider = new Support.CompatibleModelProvider({ config: {
  baseUrl: 'https://provider.example', apiKey: 'placeholder', model: 'configured-model',
  reasoning: { format: 'custom', level: 'medium', map(level) { return { analysis_mode: level }; } },
  requestBody: { analysis_mode: 'app-defined' },
} });
console.log(provider instanceof Support.CompatibleModelProvider);`,
      },
    ],
    policies: [
      {
        title: '推理参数映射和保留字段保护',
        file: 'src/support/model/compatible-provider.ts',
        symbols: ['snapshotConfiguration', 'assertRequestExtensions'],
      },
    ],
  },
  {
    // 演示预算档位与逐字段覆盖的优先级；档位只是本地准入，不代表供应商容量。
    id: 'model-strategy-generation',
    title: '模型策略：显式选择与推荐预算',
    layer: 'support',
    matches: [
      'createModelStrategy',
      'modelBudgetStrategies',
      'ModelStrategyOptions',
      'ModelBudgetStrategy',
    ],
    summary: '从已登记的模型和推理配置中选择，以本地预算档位补全 Core 设置，并保留逐字段精确覆盖。',
    details: `createModelStrategy 返回普通 ModelRunnerOptions，可直接创建 ModelRunner；不含请求 execution 的定义也可直接绑定 AgentCoreEngine。模型可以直接给定义，或用 models 中的 ID 代指。传入 ID 时找不到模型即报错，不根据名字、品牌或 URL 猜测能力。

budget 的 small、medium、large 分别适合调用较少的短任务、普通多步任务和需要更多调用空间的任务。它们规定本地准入和输出预算，不代表供应商上下文容量、真实速度或质量保证。small 为 2 次、8000 输入字符、4000 输出字符、512 输出 token 预留、15000ms 单次期限；medium 为 8 次、32000、16000、1024、30000ms；large 为 16 次、64000、32000、4096、60000ms。供应商硬上限和 Core 最终校验继续有效。

优先级由低到高：预算档位 → 已选模型配置 → 显式 reasoningOptions 中的配置 → budget 对象中的精确设置 → 顶层 Core 字段。省略 budget 使用 medium。budget 对象在 medium 上补精确值；显式 undefined 交回 Core 缺省解释，合法的 0 和 Infinity 不当作缺省。

reasoning 是 reasoningOptions 中的名称，例如 low/high/off。其内容是明确的 Core 模型配置覆盖，可指向已经按供应商推理参数构造的 Provider。Support 不推断供应商如何开启思考，不自行拼装未经声明的 wire 字段。没有匹配声明时拒绝。已有 Provider、interaction、token 计数器、sink、错误端口和 execution 的合同均保留；App 服务不会被深度冻结。`,
    examples: [
      {
        title: '短任务使用小预算，增加需求仍沿用同一 Core 构造',
        level: '入门',
        environment: 'Node.js',
        ts: `import { AgentCoreEngine, ModelRunner, Support } from '@jangts/agent-core';
const provider = { async *stream() { yield '服务在线。'; } };
const config = Support.createModelStrategy({ model: { provider }, budget: 'small' });
const model = new ModelRunner(config);
console.log((await model.invoke('服务状态？')).value);
const agent = new AgentCoreEngine({ model: config });
console.log(agent.branch.agentId);`,
      },
      {
        title: '已有模型用 ID 代指，推理方案显式登记',
        level: '配置',
        environment: 'Node.js',
        ts: `import { ModelRunner, Support } from '@jangts/agent-core';
const fast = { async *stream() { yield '简短回答'; } };
const reasoned = { async *stream() { yield '经过复核的回答'; } };
const models = { fast: { provider: fast }, thorough: { provider: reasoned } };
const config = Support.createModelStrategy({ model: 'fast', models, budget: 'small',
  reasoning: 'high', reasoningOptions: { high: { provider: reasoned } },
  maxCalls: 1, maxOutputTokens: 1200,
});
console.log((await new ModelRunner(config).invoke('检查资料')).value);`,
        note: '示例 Provider 完全离线。实际供应商的推理参数由各 Provider 的显式配置实现。',
      },
      {
        title: '自定义预算和原生 Core 端口保持有效',
        level: '扩展',
        environment: 'Node.js',
        ts: `import { ModelRunner, Support } from '@jangts/agent-core';
const provider = { async *stream() { yield 'done'; } };
const interaction = Support.createTextInteraction({ id: 'app:text' });
const config = Support.createModelStrategy({ model: { provider, interactions: [interaction] },
  budget: { maxCalls: 3, maxInputChars: 24000, callTimeoutMs: 20000 },
  tokenBudget: { counterId: 'app-counter', contextWindowTokens: 4000,
    countTokens({ messages }) { return messages.reduce((sum, message) => sum + message.content.length, 0); } },
});
const result = await new ModelRunner(config).invoke({ input: 'hello', interaction });
console.log(result.value);`,
        note: '计数器仅为演示。生产环境注入与实际模型匹配的计数器，不用字符估算冒充真实 token 数。',
      },
    ],
    policies: [
      {
        title: '推荐预算、同合同补全和覆盖顺序',
        file: 'src/support/model/strategies.ts',
        symbols: ['modelBudgetStrategies', 'settingKeys', 'settings', 'createModelStrategy'],
      },
    ],
  },
];

/**
 * Core 模型与工具执行示例：ModelRunner 的调用、准备快照、模型绑定与子执行、
 * 能力/传输注册，以及 ToolRegistry 的真实调用。
 * 由 core-support.mjs 聚合；共享代码片段只用于减少示例重复。
 */
// 离线 Provider：示例不发起网络请求，便于读者直接运行理解合同。
const localProvider = `const provider = {
  async *stream(messages: readonly { content: string }[]) {
    yield '收到：' + messages.at(-1)!.content;
  },
};`;
// Workflow 片段只演示“节点拿到绑定模型”这一层，模型配置在前面的示例中注入。
const boundModelWorkflow = `import { AgentCoreEngine, defineWorkflow, route } from '@jangts/agent-core/engine';
type State = { input: string; answer?: string };
const workflow = defineWorkflow<State, string>({ id: 'chat', nodes: [{
  id: 'reply', description: '用绑定模型回答', startsRound: true,
  async run(state, { model }) {
    const { value } = await model.invoke({ input: state.input });
    return { answer: value };
  }, routes: [route.deliver('answer')],
}] });`;

export default [
  {
    // 演示两种输入省写返回同一 ModelResult；Runner 是请求级对象，预算不可跨请求复用。
    id: 'model-invoke',
    title: 'ModelRunner：输入可以省写，输出合同保持一致',
    layer: 'core',
    matches: [
      'ModelRunner',
      'ModelRunner.invoke',
      'ModelRunnerOptions',
      'ModelRunnerSettings',
      'ModelCallRequest',
      'ModelResult',
      'ModelCallRecord',
      'ModelRunner.callCount',
      'ModelRunner.totalCallCount',
      'ModelRunner.remainingCalls',
      'ModelRunner.lastCall',
      'ModelRunner.signal',
      'ModelRunner.execution',
      'modelRunnerDefaults',
    ],
    summary: '用真实 Provider 端口执行一次模型交互，返回 value 和本次 invocation。',
    details: `invoke('文本') 与 invoke({input:'文本'}) 都返回 ModelResult<string>；输入省写不产生第二套输出格式。结构化传输只改变 value 的类型，不切换为裸结果。错误通过 Promise 拒绝。

Runner 是请求级执行对象：调用次数和 journal 会累积，不应把已经用尽预算的 Runner 当成永久单例。稳定模型配置可绑定到 Engine，每次 Workflow 执行会获得请求内 Runner。

默认值来自 modelRunnerDefaults，属于缺参时的运行基线，不是供应商容量或所有场景的最佳值。字符正文、传输声明、输出字符和 token 预留是不同预算。没有明确 token 计数器时，不猜测字符/token 比例。lastCall 是最近完成的快照，不能用它关联并发请求，应使用各次返回的 invocation。`,
    examples: [
      {
        title: '同一输出的两种输入',
        level: '入门',
        environment: 'Node.js',
        ts: `import { ModelRunner } from '@jangts/agent-core/model';
${localProvider}
const runner = new ModelRunner({ provider });
const first = await runner.invoke('你好');
const second = await runner.invoke({ input: '你好' });
console.log(first.value, second.value);
console.log(first.invocation.invocationId);`,
      },
      {
        title: '增加预算与请求取消',
        level: '配置',
        environment: 'Node.js',
        ts: `import { ModelRunner } from '@jangts/agent-core/model';
${localProvider}
const runner = new ModelRunner({ provider, maxCalls: 2, maxInputChars: 4000,
  maxOutputChars: 2000, callTimeoutMs: 15000,
  execution: { signal: AbortSignal.timeout(20000) },
});
const result = await runner.invoke({ input: '你好', stageId: 'reply', maxOutputTokens: 600 });
console.log(result.value, runner.remainingCalls);`,
      },
      {
        title: '增加独立的有序输出接收器',
        level: '扩展',
        environment: 'Node.js',
        ts: `import { ModelRunner } from '@jangts/agent-core/model';
${localProvider}
const events: string[] = [];
const runner = new ModelRunner({ provider, sink: {
  async output(event) { events.push(event.type); },
} });
const result = await runner.invoke('你好');
console.log(result.value, events);`,
        note: 'sink.output 按序等待。model.output 是尚未完整校验的提议，不能在此执行模型提出的工具操作。',
      },
    ],
    policies: [
      {
        title: 'Core 的基础预算缺省值',
        file: 'src/model/defaults.ts',
        symbols: ['modelRunnerDefaults'],
      },
    ],
  },
  {
    // 演示提前准备与多次测量；测量不消耗调用次数，也不代表预算已获准。
    id: 'prepared-model-call',
    title: '实际请求测量与同次准备快照',
    layer: 'core',
    matches: [
      'ModelRunner.prepare',
      'PreparedModelCall',
      'PreparedModelCall.measure',
      'ModelInputMeasurement',
      'ModelPrepareRequest',
      'WorkflowModel.prepare',
    ],
    summary: '需要提前处理上下文时才 prepare；多次测量与最终发送复用同一次传输准备。',
    details: `普通 invoke 无需强制增加 prepare 步骤。prepare 固定当次动态传输指令、Schema、选项及 collector 工厂；measure 允许多次检查候选，不花模型调用次数。

measure 包含实际正文、传输指令和声明的计量，并分别展示 messageChars、instructionChars、schemaChars、transportChars、inputChars。输入 token 限额只有注入明确计数器后才存在；它已扣除本次输出预留和安全余量。

准备句柄属于创建它的本次 Runner/Workflow 请求，只能最终消费一次，不能更换 interaction、stageId 或输出预留。测量不是预算预订或放行凭证：最终 Provider 前仍会重新检查。取消、过期、外部句柄及重复消费均会拒绝。`,
    examples: [
      {
        title: '普通调用仍然只有 invoke',
        level: '入门',
        environment: 'Node.js',
        ts: `import { ModelRunner } from '@jangts/agent-core/model';
${localProvider}
const runner = new ModelRunner({ provider });
console.log((await runner.invoke('你好')).value);`,
      },
      {
        title: '只在需要测量时准备一次',
        level: '配置',
        environment: 'Node.js',
        ts: `import { ModelRunner } from '@jangts/agent-core/model';
${localProvider}
const runner = new ModelRunner({ provider, maxInputChars: 1000 });
const prepared = runner.prepare({ stageId: 'reply', maxOutputTokens: 400 });
const input = '你好，解释这次服务状态';
console.log(prepared.measure(input));
const result = await runner.invoke({ input, prepared });
console.log(result.value);`,
      },
      {
        title: '对同一准备句柄检查多份候选',
        level: '扩展',
        environment: 'Node.js',
        ts: `import { ModelRunner } from '@jangts/agent-core/model';
${localProvider}
const runner = new ModelRunner({ provider, maxInputChars: 1000 });
const prepared = runner.prepare({ stageId: 'reply' });
const withHistory = [{ role: 'user' as const, content: '历史：上次正常。\\n本轮：现在呢？' }];
const currentOnly = [{ role: 'user' as const, content: '现在的服务状态？' }];
const selected = prepared.measure(withHistory).withinBudget ? withHistory : currentOnly;
if (!prepared.measure(selected).withinBudget) throw new Error('输入仍超限');
console.log((await runner.invoke({ input: selected, prepared })).value);`,
        note: '仅演示 App 自己决定候选；删减真实上下文时仍要保持原问题、授权与证据完整。',
      },
    ],
    policies: [{ title: '同次准备与真实输入计量', file: 'src/model/preparation.ts', symbols: [] }],
  },
  {
    // 演示稳定模型配置在构造时绑定，运行/节点/调用三级选择都不重置共享预算。
    id: 'model-bindings',
    title: '一次绑定，单次多模型与跨次切换',
    layer: 'core',
    matches: [
      'AgentCoreEngine.bindModel',
      'AgentCoreEngine.switchModel',
      'AgentModelBinding',
      'WorkflowModel',
      'WorkflowModel.invoke',
    ],
    summary: '构造时提供稳定模型配置；请求用配置 ID 选择，不反复注入 Provider。',
    details: `单模型可在构造时传 model 配置，或稍后 bindModel 一次。多模型则在 models 中登记配置，model 字符串选择默认项；多个模型时不能猜默认值。未知模型 ID 在调用前拒绝。

switchModel 改后续运行的默认选择；run(state,{modelId}) 只覆盖本次，节点 model.invoke({modelId}) 只覆盖这次模型调用。单次 Workflow 可先快模型草拟、再另一个模型复核。多模型共享 maxModelCalls 请求预算，每个模型仍有各自的局部限制；切换不刷新祖先额度。

模型配置与选择绑定在 Agent 上，Workflow 通过节点中的模型端口使用它们。`,
    examples: [
      {
        title: '将模型提前绑到 Agent',
        level: '入门',
        environment: 'Node.js',
        ts: `${boundModelWorkflow}
${localProvider}
const agent = new AgentCoreEngine({ workflow, model: { provider } });
console.log(await agent.run({ input: '你好' }));`,
      },
      {
        title: '增加模型目录，调用时只给 ID',
        level: '配置',
        environment: 'Node.js',
        ts: `${boundModelWorkflow}
${localProvider}
const agent = new AgentCoreEngine({ workflow, model: 'quick', maxModelCalls: 4,
  models: { quick: { provider, maxCalls: 2 }, careful: { provider, maxCalls: 2 } },
});
console.log(await agent.run({ input: '简答' }));
console.log(await agent.run({ input: '仔细回答' }, { modelId: 'careful' }));
agent.switchModel('careful');
console.log(await agent.run({ input: '后续默认使用 careful' }));`,
      },
      {
        title: '同一任务中调用两个已绑定模型',
        level: '扩展',
        environment: 'Node.js',
        ts: `import { AgentCoreEngine, defineWorkflow, route } from '@jangts/agent-core/engine';
type State = { input: string; answer?: string };
${localProvider}
const workflow = defineWorkflow<State, string>({ id: 'draft-review', nodes: [{
  id: 'reply', description: '草拟后复核', startsRound: true,
  async run(state, { model }) {
    const draft = await model.invoke({ input: state.input, modelId: 'quick' });
    const reviewed = await model.invoke({ input: '复核这份草稿：' + draft.value, modelId: 'careful' });
    return { answer: reviewed.value };
  }, routes: [route.deliver('answer')],
}] });
const agent = new AgentCoreEngine({ workflow, model: 'quick', maxModelCalls: 2,
  models: { quick: { provider }, careful: { provider } },
});
console.log(await agent.run({ input: '解释服务状态' }));`,
      },
    ],
  },
  {
    // 演示子 Runner 的隔离记录与共享祖先额度；子执行不能绕过取消和期限。
    id: 'model-child',
    title: '子执行：隔离记录，共享祖先额度',
    layer: 'core',
    matches: ['ModelRunner.createChild', 'ModelChildOptions'],
    summary: '子 Runner 不继承对话和输出接收器，但不能绕过父级预算、取消和期限。',
    details: `children 配置请求共享的 maxDepth、maxConcurrentCalls 和 maxChildren，缺省为单层、串行执行。同一个 Runner 的调用不能重叠；多个子 Runner 的模型调用共享根容量。interactions 显式指定子执行可用集合，不自动继承父级的全部模型可见能力。

maxCalls 是子执行局部上限，reserveCalls 为父级保留后续收尾额度；没有可用额度时拒绝。父级 totalCallCount 包含后代消耗，父级 callCount、journal 与子级各自隔离。子执行属于父请求的生命周期，业务授权由 App 提供。`,
    examples: [
      {
        title: '为子执行配置一次调用额度',
        level: '入门',
        environment: 'Node.js',
        ts: `import { ModelRunner } from '@jangts/agent-core/model';
${localProvider}
const parent = new ModelRunner({ provider, maxCalls: 3 }).bind();
const child = parent.createChild({ id: 'service-review', maxCalls: 1, reserveCalls: 1,
  timeoutMs: 10000, interactions: [] });
const report = await child.invoke('独立核对服务状态');
console.log(report.value, parent.totalCallCount, child.callCount);`,
      },
      {
        title: '子报告返回后再由父级完成回答',
        level: '配置',
        environment: 'Node.js',
        ts: `import { ModelRunner } from '@jangts/agent-core/model';
${localProvider}
const parent = new ModelRunner({ provider, maxCalls: 3 }).bind();
const child = parent.createChild({ id: 'service-review', maxCalls: 1, reserveCalls: 1,
  timeoutMs: 10000, interactions: [] });
const report = await child.invoke('核对状态证据');
const answer = await parent.invoke('根据已核对报告回答：' + report.value);
console.log(answer.value);`,
        note: '子任务完成后再调用父模型，没有 Promise.all。父级仍负责核对报告来源和业务完成性。',
      },
    ],
  },
  {
    // 演示模型 Tool 清单只描述可选范围；传输校验通过后才得到类型化选择，授权仍在调用边界。
    id: 'capabilities-transport',
    title: '模型 Tool 与传输：完整校验后才得到类型化选择',
    layer: 'core',
    matches: [
      'ModelToolRegistry',
      'ModelToolRegistry.register',
      'ModelToolRegistry.registerAll',
      'ModelToolRegistry.resolve',
      'ModelToolRegistry.select',
      'ModelToolRegistry.seal',
      'ModelToolRegistry.require',
      'ModelToolRegistry.get',
      'ModelToolRegistry.has',
      'ModelToolRegistry.ids',
      'ModelToolRegistry.entries',
      'ModelToolRegistry.values',
      'ModelToolRegistry.definitions',
      'ModelTool',
      'ModelToolSource',
      'ModelSelection',
      'ModelInteractionDefinition',
      'PreparedModelInteraction',
      'ChatProvider',
    ],
    summary: 'Tool 定义提供 Schema 与 resolver；传输将 wire 输出翻译为统一的模型选择合同。',
    details: `Tool 清单描述模型允许提出什么，不代表业务已获授权。inputSchema.parse 解析参数，resolve 根据完整、已校验的输入构造领域结果。两者同步，不能偷偷执行网络工具。

select 返回封存的阶段子集。未知 Tool、重复 ID、空选择或阶段外选择拒绝。App 在投影前决定 Tool 可见性；工具执行时仍应检查真实请求权限。

Core 通过 ModelInteractionDefinition.prepare 取得 options、schemaChars、可选 instruction 和新的 collector。collector.push 接受分片；finish 完成协议与输入校验后返回结果。

Core 在 collector 工厂返回后、每次 push 后和 finish 后读取 outputChars：值必须是非负安全整数，NaN、Infinity、负数和小数均按协议错误拒绝。maxOutputChars 可以显式设为 Infinity，但不放宽 collector 计数合同。诊断保留各次有效观测的峰值，finish 可释放或规范化内部缓冲，不要求缓冲一直增长。

原生交互接收字符串或合法的 function-call-delta。函数分片必须是非数组对象，index 为 0；id 提供时必须是非空字符串，name 和 arguments 提供时必须是字符串。冲突 ID、多个调用、未登记 Tool、混合正文或不完整参数被拒绝，不执行工具。

collector 可选 call 元数据只尽力读取一次；getter 抛错不覆盖已取得的业务结果、原始错误或取消，也不阻止 model.end 收尾。outputChars 是执行校验字段，不适用这个容错规则。普通对象或类都可以实现这个接口；Support 提供推荐的 native/JSON 组合，无需 Core 依赖 Support。`,
    examples: [
      {
        title: '声明两个可选择 Tool',
        level: '入门',
        environment: 'Node.js',
        ts: `import { ModelToolRegistry } from '@jangts/agent-core';
const inputSchema = { jsonSchema: { type: 'object', properties: {}, additionalProperties: false },
  parse(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length) throw new Error('需要空对象');
    return {};
  } };
const tools = new ModelToolRegistry([
  { id: 'greet', description: '回答问候', inputSchema, resolve: () => 'greet' },
  { id: 'status', description: '查询状态', inputSchema, resolve: () => 'status' },
]).seal();
console.log(tools.resolve({ toolId: 'status', input: {} }, { stageId: 'recognize' }));`,
      },
      {
        title: '仅向一个阶段投影允许的子集',
        level: '配置',
        environment: 'Node.js',
        ts: `import { ModelToolRegistry, Support } from '@jangts/agent-core';
const schema = Support.defineSchema({ jsonSchema: { type: 'object', properties: {} },
  parse(value: unknown) { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('需要对象'); return {}; } });
const registry = new ModelToolRegistry([
  { id: 'greet', description: '问候', inputSchema: schema, resolve: () => 'greet' },
  { id: 'status', description: '状态', inputSchema: schema, resolve: () => 'status' },
]).seal();
const readOnly = registry.select(['status']);
const interaction = Support.createModelInteraction({ id: 'recognize', tools: readOnly });
console.log(interaction.id, readOnly.ids());`,
      },
    ],
  },
  {
    // 演示同步/异步工具调用与回执；裸工具的业务授权由 App 自己保证。
    id: 'tool-registry',
    title: '真实工具调用与请求内运行时',
    layer: 'core',
    matches: [
      'ToolRegistry',
      'ToolRegistry.register',
      'ToolRegistry.registerAll',
      'ToolRegistry.invoke',
      'ToolRegistry.invokeAsync',
      'ToolRegistry.setDiagnostics',
      'ToolRegistry.events',
      'ToolRegistry.require',
      'ToolRegistry.get',
      'ToolRegistry.has',
      'ToolRegistry.ids',
      'ToolRegistry.entries',
      'ToolRegistry.values',
      'ToolRegistry.definitions',
      'ToolRegistry.seal',
      'ExecutableTool',
      'ToolResult',
      'ToolExecutionEvent',
      'AgentCoreEngine.bindToolRuntime',
    ],
    summary: 'Core 注册并执行真实工具，返回带 invocation 的回执；业务授权由 App 注册的实现拥有。',
    details: `ToolRegistry 的输入、输出 parser 同步执行；invoke 是同步调用，遇到 Promise 会拒绝；invokeAsync 允许异步 execute。两者的结果都固定为 {value, invocation}，工具失败抛出而不是伪装成功值。

裸 ExecutableTool 是执行机制，parseInput/execute 中的业务授权由 App 自己保证。推荐 Support.defineToolCatalog 将 Schema、authorize、execute、parseOutput 和模型能力同源生成，再绑定真实 App 依赖。

将工具运行时 bindToolRuntime 一次后，节点只给 toolId/input；Core 自动接上节点执行范围和取消。events 是真实调用摘要，不是模型提出的工具清单。`,
    examples: [
      {
        title: '最小本地只读工具',
        level: '入门',
        environment: 'Node.js',
        ts: `import { ToolRegistry } from '@jangts/agent-core/tools';
const tools = new ToolRegistry().register({
  id: 'get_status', kind: 'read', description: '读取演示服务状态',
  parseInput(value: unknown) { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('需要对象'); return {}; },
  execute: () => '服务运行正常',
  parseOutput(value: unknown) { if (typeof value !== 'string') throw new TypeError('需要文本'); return value; },
}).seal();
const result = tools.invoke({ toolId: 'get_status', input: {} });
console.log(result.value, result.invocation.invocationId);`,
      },
      {
        title: '提前绑定，节点不再重复注入工具',
        level: '配置',
        environment: 'Node.js',
        ts: `import { AgentCoreEngine, defineWorkflow, route } from '@jangts/agent-core/engine';
import { ToolRegistry } from '@jangts/agent-core/tools';
type State = { answer?: unknown };
const tools = new ToolRegistry().register({ id: 'get_status', kind: 'read',
  parseInput: () => ({}), execute: async () => '服务运行正常', parseOutput: value => value,
}).seal();
const workflow = defineWorkflow<State, unknown>({ id: 'status', nodes: [{
  id: 'read', description: '读取状态', startsRound: true,
  async run(_state, { tools }) { const { value } = await tools.invoke({ toolId: 'get_status', input: {} }); return { answer: value }; },
  routes: [route.deliver('answer')],
}] });
const agent = new AgentCoreEngine({ workflow }).bindToolRuntime(tools);
console.log(await agent.run({}));`,
        note: '第一个示例严格校验外部输入；第二个仅展示绑定关系，真实业务应使用相应 Schema 与授权。',
      },
    ],
    policies: [
      {
        title: '工具输入、执行、输出及迟到结果的检查顺序',
        file: 'src/capabilities/tools.ts',
        symbols: ['ToolRegistry'],
      },
    ],
  },
];

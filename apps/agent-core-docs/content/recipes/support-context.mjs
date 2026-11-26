/**
 * 上下文处理示例：片段与预算、装配配置、Workflow 节点、策略目录、
 * 缩减步骤选择与压缩/选择 handler。由 support-recipes.mjs 展开后聚合。
 */
// 多个示例共用同一份片段声明，便于对比“只加能力、不改入口”的演进方式。
const builderCode = `import { Support } from '@jangts/agent-core';
type Input = { question: string; history: readonly { role: string; content: string }[] };
const builder = Support.defineContextFragments<Input>([
  { id: 'question', sourceId: 'request', trust: 'user', lifetime: 'turn', maxChars: 1000,
    role: 'user', format: input => input.question },
  { id: 'history', sourceId: 'conversation', trust: 'user', lifetime: 'turn', maxChars: 10000,
    role: 'user', format: input => ({ messages: input.history }) },
], { maxInputChars: 1200 });`;

export default [
  {
    // 演示片段元数据与硬预算校验；装配不会静默截断，也不会调用模型做选择。
    id: 'context-fragments',
    title: '上下文片段：明确来源、信任和预算',
    layer: 'core',
    matches: [
      'assembleFragments',
      'assembleContextPlan',
      'validateContextFragment',
      'validateContextBudget',
      'ContextFragment',
      'ContextFragmentUsage',
      'BuiltContext',
      'ContextPlan',
      'ContextTrust',
      'ContextLifetime',
    ],
    summary: 'Core 识别片段与装配合同，校验来源元数据和预算，不内置业务压缩算法。',
    details: `片段包含 id/sourceId/trust/lifetime/maxChars/role/value。trust 描述来源语义，不是给数据授予系统权限；外部原文仍是数据。装配输出 BuiltContext，包含 messages、fragmentUsage 和字符用量。

assembleFragments 在已登记顺序上校验并装配，不偷偷截断超限片段。assembleContextPlan 对原片段与可变范围执行审计后装配；它不会调用模型选择器或压缩器。选择、压缩的推荐算法由 Support 普通节点提供；自定义节点也能接同一合同。

ContextPlan 是候选片段与预算计划，不是已经发送的模型请求。fragmentUsage 是装配后的用量元数据，不能把它当成原始 fragments。`,
    examples: [
      {
        title: '用裸配置装配一份输入',
        level: '入门',
        environment: 'Node.js',
        ts: `import { assembleFragments } from '@jangts/agent-core/context';
const input = assembleFragments([{ id: 'question', sourceId: 'request', trust: 'user',
  lifetime: 'turn', maxChars: 1000, role: 'user', value: '现在服务状态怎样？' }], 2000);
console.log(input.messages, input.fragmentUsage);`,
      },
      {
        title: '增加候选计划与最终审计',
        level: '配置',
        environment: 'Node.js',
        ts: `import { assembleContextPlan } from '@jangts/agent-core/context';
import type { ContextFragment } from '@jangts/agent-core/types';
const fragments: ContextFragment[] = [{ id: 'question', sourceId: 'request', trust: 'user',
  lifetime: 'turn', maxChars: 1000, role: 'user', value: '现在服务状态怎样？' }];
const input = assembleContextPlan({ fragments, originalFragments: fragments, mutableFragmentIds: [], maxInputChars: 2000 });
console.log(input.inputChars);`,
        note: '可变片段列表为空，表示不允许修改原片段；不会自动授权一个压缩步骤。',
      },
    ],
    policies: [
      {
        title: '片段校验与预算拒绝',
        file: 'src/context/fragments.ts',
        symbols: ['validateContextFragment', 'validateContextBudget'],
      },
    ],
  },
  {
    // 演示一次绑定片段元数据后，请求只提供业务输入；没有预算来源时直接拒绝。
    id: 'context-builders',
    title: '上下文装配：稳定元数据配置一次',
    layer: 'support',
    matches: [
      'defineContextFragments',
      'defineContextAssembly',
      'transformContextText',
      'ContextBuilder',
      'ContextBuilder.fragments',
      'ContextBuilder.plan',
      'ContextBuilder.build',
      'ContextFragmentConfig',
      'ContextAssemblyOptions',
      'ContextProjection',
      'ContextBuilderOptions',
    ],
    summary: 'Support 提前绑定片段元数据、格式化和顺序，请求只提供变化的业务输入。',
    details: `defineContextFragments 适合已经拥有完整片段声明的清单；defineContextAssembly 复用另一份元数据目录及贡献插槽，避免每处重复配置来源和预算。二者都返回同一个 ContextBuilder 合同，fragments、plan、build 仅表示不同准备阶段。

maxInputChars 可绑定固定值或按本次 input 计算，单次请求仍可显式覆盖。没有任何预算来源时拒绝，不能将“没有设置”解释为无限容量。format/transform 同步，固定原接收者；动态 App 服务内容仍在本次输入中读取。

transformContextText 统一转换字符串与对象中嵌套字符串，转换后再测量；它不负责翻译正确性或把数据升级为指令。`,
    examples: [
      {
        title: '一次配置，以后只给问题和历史',
        level: '入门',
        environment: 'Node.js',
        ts: `${builderCode}
const context = builder.build({ input: { question: '服务状态？', history: [] } });
console.log(context.messages);`,
      },
      {
        title: '同一个 builder 提前给出计划',
        level: '配置',
        environment: 'Node.js',
        ts: `${builderCode}
const input = { question: '服务状态？', history: [] };
const plan = builder.plan({ input });
const expanded = builder.fragments(input);
console.log(plan.maxInputChars, expanded.map(fragment => fragment.id));
const largerRequest = builder.build({ input, maxInputChars: 2000 });
console.log(largerRequest.maxInputChars);`,
      },
      {
        title: '复用元数据目录与请求贡献插槽',
        level: '扩展',
        environment: 'Node.js',
        ts: `import { Support } from '@jangts/agent-core';
import type { ContextFragment } from '@jangts/agent-core/types';
type Input = { question: string; evidence: string };
const builder = Support.defineContextAssembly<Input, 'question', 'evidence'>([
  { kind: 'fragment', id: 'question', format: input => input.question },
  { kind: 'contributions', placement: 'evidence' },
], {
  maxInputChars: 2000,
  fragment(id, value): ContextFragment { return { id, sourceId: 'request', trust: 'user', lifetime: 'turn', role: 'user', maxChars: 1000, value }; },
  contributions: { evidence(input) { return [{ id: 'evidence', sourceId: 'service', trust: 'server', lifetime: 'turn', role: 'user', maxChars: 1000, value: input.evidence }]; } },
});
console.log(builder.build({ input: { question: '状态？', evidence: '最近检查：正常' } }).messages);`,
      },
    ],
    policies: [
      {
        title: '装配顺序、依赖快照与请求预算覆盖',
        file: 'src/support/context/assembly.ts',
        symbols: ['defineContextFragments', 'defineContextAssembly'],
      },
    ],
  },
  {
    // 演示上下文处理仍是普通 Workflow 节点：调用同一次准备的模型请求，不新建执行框架。
    id: 'context-workflow-nodes',
    title: '上下文处理是普通 Workflow 节点',
    layer: 'support',
    matches: [
      'createContextProcessingNode',
      'createContextSelectionNode',
      'createContextReductionNode',
      'ContextProcessingNodeDefinition',
      'ContextSelectionNodeDefinition',
      'ContextReductionNodeDefinition',
      'ContextNodeResult',
      'ContextNodeModel',
      'ContextStageResult',
      'ContextSelectionResult',
    ],
    summary: '通过正常节点与路由接入选择、裁切、压缩，Core 统一记录并调度它们。',
    details: `Support 提供完整处理节点，以及可独立配置的选择／单步缩减节点；最终模型调用沿用同一 PreparedModelCall，测量和发送共用一次准备的传输。

createContextProcessingNode 负责选定策略并完成装配；createContextSelectionNode 只返回允许的 stepIds，不自动执行缩减；createContextReductionNode 只执行已登记的一个 stepId。它们都是 WorkflowNode，不是另一种执行框架，App 用正常 routes 决定何时进入。

节点具有本次 signal、期限和同一模型端口。选择与压缩使用的模型调用同样消耗祖先额度，不创建新的免费请求；超限、保护片段变化、未知步骤和迟到结果仍拒绝。自定义节点可以实现同一 WorkflowNode 合同，不受 Support 算法限制。`,
    examples: [
      {
        title: '只验证与装配，先不增加压缩',
        level: '入门',
        environment: 'Node.js',
        ts: `import { AgentCoreEngine, defineWorkflow, route } from '@jangts/agent-core/engine';
import { Support } from '@jangts/agent-core';
import type { BuiltContext, PreparedModelCall } from '@jangts/agent-core/types';
type State = { question: string; input?: BuiltContext; prepared?: PreparedModelCall; answer?: string };
const builder = Support.defineContextFragments<State>([
  { id: 'question', sourceId: 'request', trust: 'user', lifetime: 'turn', role: 'user', maxChars: 1000, format: state => state.question },
], { maxInputChars: 2000 });
const prepare = Support.createContextProcessingNode<State, string>({
  id: 'prepare', description: '装配并校验输入', startsRound: true,
  plan: state => builder.plan({ input: state }),
  update: result => ({ input: result.input, prepared: result.prepared }),
  routes: [route.to('reply')],
});
const workflow = defineWorkflow<State, string>({ id: 'chat', nodes: [prepare, {
  id: 'reply', description: '使用同次准备回答', requires: ['input', 'prepared'],
  async run(state, { model }) { const { value } = await model.invoke({ input: state.input!, prepared: state.prepared! }); return { answer: String(value) }; },
  routes: [route.deliver('answer')],
}] });
const agent = new AgentCoreEngine({ workflow, model: { provider: { async *stream() { yield '服务正常'; } } } });
console.log(await agent.run({ question: '状态？' }));`,
      },
      {
        title: '同一节点合同增加历史裁切策略',
        level: '配置',
        environment: 'Node.js',
        ts: `import { Support } from '@jangts/agent-core';
import { route } from '@jangts/agent-core/engine';
import type { BuiltContext, PreparedModelCall } from '@jangts/agent-core/types';
type State = { question: string; history: { role: string; content: string }[]; input?: BuiltContext; prepared?: PreparedModelCall };
const builder = Support.defineContextFragments<State>([
  { id: 'question', sourceId: 'request', trust: 'user', lifetime: 'turn', role: 'user', maxChars: 1000, format: state => state.question },
  { id: 'history', sourceId: 'conversation', trust: 'user', lifetime: 'turn', role: 'user', maxChars: 10000, format: state => ({ messages: state.history }) },
], { maxInputChars: 1200 });
const prepare = Support.createContextProcessingNode<State, string>({
  id: 'prepare', description: '按需要裁切旧历史', startsRound: true,
  plan: state => builder.plan({ input: state }),
  policy: { mode: 'reduce', steps: [{ id: 'recent', kind: 'trim', fragmentId: 'history', field: 'messages',
    targetChars: 700, grouping: { kind: 'user-turn' }, keepGroups: 1 }] },
  update: result => ({ input: result.input, prepared: result.prepared }),
  routes: [route.to('reply')],
});
console.log(prepare.id);`,
        note: '将该节点放回前例相同 Workflow；每次 run 的 State 增加 history 即可，模型 reply 节点不换接口。完整流程里的 reply 目标必须存在。',
      },
    ],
    policies: [
      {
        title: '普通节点的配置绑定与阶段执行',
        file: 'src/support/context/nodes.ts',
        symbols: [
          'createContextProcessingNode',
          'createContextSelectionNode',
          'createContextReductionNode',
        ],
      },
    ],
  },
  {
    // 演示 validate/reduce/audit 三种策略；水位数字是示例业务选择，不是通用容量建议。
    id: 'context-policy',
    title: '上下文策略：验证、缩减与审计',
    layer: 'support',
    matches: [
      'processContext',
      'validateContextPolicy',
      'contextPolicyCatalog',
      'contextReductionCatalog',
      'ContextPolicy',
      'ContextReduction',
      'ContextProcessingReport',
      'ContextProcessingOptions',
    ],
    summary: 'Support 给出可替换的策略实现，Core 保留最终输入合同和预算检查。',
    details: `当前 ContextPolicy 的判别值是 validate、reduce、audit。validate 只验证和装配；reduce 在水位触发后选择已登记步骤；audit 检查 App 修改是否限于声明可变范围。

triggerChars/triggerTokens 控制何时开始，targetInputChars/targetInputTokens 控制期望水位，最终硬预算另由请求准备和 Core 检查。字符和 token 不能互相猜算；没有计数器时不得假装拥有 token 用量。

缩减步骤包含真实的 fragmentId、kind 和 targetChars。trim 明确历史分组和最少保留组，compress 明确 handlerId。受保护的问题、系统指令、授权与证据不能随意改写。报告记录实际变更和用量，不将压缩成功当成语义质量保证。

直接 processContext 接收 ContextPlan、ContextPolicy 和执行选项；通常优先把它放入普通 Workflow 节点，使过程事件和取消链自然纳入 Loop。`,
    examples: [
      {
        title: '显式使用只校验策略',
        level: '入门',
        environment: 'Node.js',
        ts: `import { Support } from '@jangts/agent-core';
import type { ContextPolicy } from '@jangts/agent-core/support/context';
const policy: ContextPolicy = { mode: 'validate' };
Support.validateContextPolicy(policy, [], []);
console.log(policy.mode);`,
      },
      {
        title: '从真实业务片段配置缩减顺序',
        level: '配置',
        environment: 'Node.js',
        ts: `import { Support } from '@jangts/agent-core';
import type { ContextPolicy } from '@jangts/agent-core/support/context';
const policy: ContextPolicy = { mode: 'reduce', triggerChars: 1800, targetInputChars: 1500,
  selection: { mode: 'sequence' },
  steps: [{ id: 'recent-history', kind: 'trim', fragmentId: 'history', field: 'messages',
    grouping: { kind: 'user-turn' }, keepGroups: 2, targetChars: 1000 }],
};
Support.validateContextPolicy(policy, [], []);
console.log(policy.steps);`,
        note: '这些数字是示例业务的显式选择，不是 SDK 推荐适用于所有模型的容量。',
      },
      {
        title: '对 App 自己的处理限定可变范围',
        level: '扩展',
        environment: 'Node.js',
        ts: `import { Support } from '@jangts/agent-core';
import type { ContextPolicy } from '@jangts/agent-core/support/context';
const policy: ContextPolicy = { mode: 'audit', mutableFragmentIds: ['history'] };
Support.validateContextPolicy(policy, [], []);
console.log(policy.mutableFragmentIds);`,
        note: '审计还需要 ContextPlan 携带原片段；仅列 ID 不会自行修改或发布资料。',
      },
    ],
    policies: [
      {
        title: '策略与缩减操作的真实调度目录',
        file: 'src/support/context/processing.ts',
        symbols: [
          'contextPolicyCatalog',
          'contextReductionCatalog',
          'validateContextPolicy',
          'processContext',
        ],
      },
    ],
  },
  {
    // 演示 sequence/fixed/auto/model 选择策略；选择器只能返回已登记且额度可行的步骤。
    id: 'context-selection',
    title: '选择缩减步骤：顺序、固定、自动或模型',
    layer: 'support',
    matches: [
      'contextSelectionCatalog',
      'selectContextSteps',
      'validateContextSelection',
      'reservedContextCalls',
      'contextHandlerCalls',
      'ContextSelection',
      'ContextSelectionCandidate',
      'ContextSelectionCall',
    ],
    summary: '一套类型化策略表达多种场景，保留精确参数与 App 自定义选择。',
    details: `sequence 保持登记顺序；fixed 选择某种 kind；auto 优先选择损失比例在阈值内的可裁切项，否则选择压缩；model 调用已登记 selector 返回唯一、可行的 stepIds。

auto 的 maxTrimLossRatio 默认 0.25，是 JSON 字符减少比例的启发式，不是语义信息损失百分比。auto/model 默认 reserveCalls=1，为最终回答保留调用；handler maxCalls 默认 1，本地算法可明确声明 0。

选择前根据真实可用调用额度排除不可行候选。空 stepIds 表示没有执行缩减，不隐式改为全部步骤；最终仍超预算就拒绝。选择器也不能通过返回未知 ID 或累计调用超额来扩大能力。`,
    examples: [
      {
        title: '按已登记顺序处理',
        level: '入门',
        environment: 'Node.js',
        ts: `import { Support } from '@jangts/agent-core';
Support.validateContextSelection({ mode: 'sequence' }, []);
console.log(Object.keys(Support.contextSelectionCatalog));`,
      },
      {
        title: '按场景选择策略并精确覆盖',
        level: '配置',
        environment: 'Node.js',
        ts: `import { Support } from '@jangts/agent-core';
const localOnly = { mode: 'fixed' as const, kind: 'trim' as const };
const preserveMore = { mode: 'auto' as const, maxTrimLossRatio: 0.1, reserveCalls: 2 };
Support.validateContextSelection(localOnly, []);
Support.validateContextSelection(preserveMore, []);
console.log(localOnly, preserveMore);`,
      },
    ],
    policies: [
      {
        title: '选择策略目录、保留额度及可行性筛选',
        file: 'src/support/context/selection-policy.ts',
        symbols: [
          'contextSelectionCatalog',
          'selectContextSteps',
          'automatic',
          'reservedContextCalls',
          'contextHandlerCalls',
        ],
      },
    ],
  },
  {
    // 演示压缩器与选择器的装配；模型 handler 必须走调用参数中的 callModel，不能另建 Runner。
    id: 'context-handlers',
    title: '压缩器与选择器：推荐实现和自定义算法',
    layer: 'support',
    matches: [
      'createContextCompressor',
      'createContextSelector',
      'ContextCompressor',
      'ContextSelector',
      'ContextCompressionCall',
      'ContextModelCall',
      'ContextModelRequest',
    ],
    summary: '将提示词、输出解析和算法绑定为 handler；模型 I/O 通过同一请求的 callModel。',
    details: `createContextCompressor 需要业务 instruction、已登记 transport ID、输出预留与结果 parse；Core 不决定怎样概括业务资料。createContextSelector 有内置选择指令和 {stepIds} 默认输出协议，默认 maxExcerptChars=0，只传候选元数据；自定义 parser 必须同时提供相应 instruction。

handler 也可以直接由 App 对象或类实现，声明 maxCalls=0 表示纯本地处理。模型 handler 应使用调用参数的 callModel，而不是新建 Runner 绕过祖先预算、取消和日志。算法可替换，但保护范围、输出结构和最终预算不因自定义实现而取消。

创建 handler 只形成配置，不会自动登记传输或进入 Workflow；节点的 compressors/selectors 显式接入，policy 中用 handlerId 引用。`,
    examples: [
      {
        title: '绑定一个文本压缩 handler',
        level: '入门',
        environment: 'Node.js',
        ts: `import { Support } from '@jangts/agent-core';
const compressor = Support.createContextCompressor({
  id: 'history-summary', instruction: '保留事实、时间和未完成事项，精简重复表达。',
  interaction: 'core:plain-text', maxOutputTokens: 500,
  parse(value: unknown) { if (typeof value !== 'string' || !value.trim()) throw new TypeError('需要非空摘要'); return value; },
});
console.log(compressor.id);`,
      },
      {
        title: '选择器明确控制可见摘录范围',
        level: '配置',
        environment: 'Node.js',
        ts: `import { Support } from '@jangts/agent-core';
const selector = Support.createContextSelector({ id: 'select-reduction',
  interaction: 'selector-json', maxOutputTokens: 200, maxExcerptChars: 1000,
});
console.log(selector.id);`,
        note: 'selector-json 必须由 App 注册，返回 value={stepIds:string[]}；不能把普通文本传输当成已解析 JSON。此例只展示 handler 装配，不发请求。',
      },
      {
        title: '用本地类实现同一选择合同',
        level: '扩展',
        environment: 'Node.js',
        ts: `import type { ContextSelector, ContextSelectionCall } from '@jangts/agent-core/support/context';
class TrimFirst implements ContextSelector {
  readonly id = 'trim-first';
  readonly maxCalls = 0;
  async select(call: ContextSelectionCall) {
    const candidate = call.candidates.find(item => item.kind === 'trim');
    return candidate ? [candidate.id] : [];
  }
}
const selector = new TrimFirst();
console.log(selector.id, selector.maxCalls);`,
        note: '这段策略不调用模型。它只建议已登记候选，仍由节点执行与检查。',
      },
    ],
    policies: [
      {
        title: '默认选择指令与摘录范围',
        file: 'src/support/context/selection.ts',
        symbols: ['createContextSelector'],
      },
      {
        title: '压缩请求与真实 callModel 合同',
        file: 'src/support/context/compression.ts',
        symbols: ['createContextCompressor'],
      },
    ],
  },
];

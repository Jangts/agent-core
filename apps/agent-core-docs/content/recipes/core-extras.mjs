/**
 * 其余 Core／Support 能力示例：Support 聚合入口、由历史语义生成策略、
 * 预览规则生成、同步调用适配与两个小型纯函数。
 * 由 core-support.mjs 聚合，示例保持离线、可直接运行。
 */
export default [
  {
    // 演示聚合命名空间与子入口指向同一实现；只改变导入粒度，不切换调用合同。
    id: 'support-navigation',
    title: 'Support：推荐用法的聚合入口',
    layer: 'support',
    matches: ['Support'],
    summary: 'Support 聚合推荐的构造、策略与同源配置生成；Core 运行不依赖这个命名空间。',
    details: `最常见的导入是根入口的 Support 命名空间。已有清晰模块依赖时，也可从 /support、/support/model 或 /support/context 显式导入所需实现。它们是相同公开实现的不同导航入口，不是不同层次的执行器。

各个构造函数的输入、补全、策略与示例在相应条目展开；不需要先学完整个 Support 再运行 Agent。纯对象或类实现只要满足 Core 合同同样有效，Support 产物无需转成普通对象。`,
    examples: [
      {
        title: '通过聚合命名空间使用推荐实现',
        level: '入门',
        environment: 'Node.js',
        ts: `import { Support } from '@jangts/agent-core';
const schema = Support.defineSchema({ jsonSchema: { type: 'string' },
  parse(value: unknown) { if (typeof value !== 'string') throw new TypeError('需要文本'); return value; },
});
console.log(schema.parse('你好'));`,
      },
      {
        title: '只改变导入粒度，合同与调用不变',
        level: '配置',
        environment: 'Node.js',
        ts: `import { defineSchema } from '@jangts/agent-core/support';
const schema = defineSchema({ jsonSchema: { type: 'string' },
  parse(value: unknown) { if (typeof value !== 'string') throw new TypeError('需要文本'); return value; },
});
console.log(schema.parse('你好'));`,
      },
    ],
  },
  {
    // 演示从已有片段生成 recent/continuity 步骤；preset 比例只表示字符空间。
    id: 'context-strategy-generation',
    title: '从历史语义生成处理策略',
    layer: 'support',
    matches: [
      'createContextStrategy',
      'ContextStrategy',
      'ContextStrategyOptions',
      'ContextStrategySettings',
      'contextHistoryStrategies',
    ],
    summary: '复用片段身份与硬预算，生成 recent 或 continuity 的完整步骤和引用。',
    details: `recent 生成整轮历史窗口步骤；continuity 使用已给定 compressor 生成“旧轮摘要＋近期原文”的压缩步骤。返回 {policy,compressors,selectors}，可直接配入上下文 Workflow 节点。

可选 preset 为 compact、balanced、extended：目标字符数分别取 fragment.maxChars 的 25%、50%、75%，保留 1、3、6 组完整原文；这些比例表示字符空间，不是语义保真率。精确 targetChars、keepGroups 优先。未选 preset 时，缺省 targetChars 取已有 fragment.maxChars，grouping 使用 user-turn，keepGroups=1；选择默认固定为该场景对应的 trim 或 compress。需要更精确约束时仍在同一 options 覆盖，不改回另一种配置风格。策略生成 .window/.summary ID、fragmentId 和 handlerId，避免重复手配这些关系。

也可传入策略数组，在第二个参数配置共同 selection、selectors、compressors、steps 及 triggerChars/targetInputChars/triggerTokens/targetInputTokens。selection 支持 model 和自定义选择器；显式 steps 完全替换生成步骤及其原有依赖，可省去 kind/fragment/field/compressor 等已无用途的生成字段。缺省按最终步骤选择，单步 fixed，多步 sequence。

这些是 Support 场景补全，不是 Core 对所有历史的规定；也不保证摘要的语义质量。fragment 必须来自 App 的真实登记，预算和最近原文保留仍会接受最终检查。`,
    examples: [
      {
        title: '复用已有片段生成最近历史策略',
        level: '入门',
        environment: 'Node.js',
        ts: `import { Support } from '@jangts/agent-core';
const fragment = { id: 'history', maxChars: 4000 };
const strategy = Support.createContextStrategy({ kind: 'recent', fragment, field: 'messages' });
console.log(strategy.policy, strategy.compressors);`,
      },
      {
        title: '同一配置增加保留组数与目标大小',
        level: '配置',
        environment: 'Node.js',
        ts: `import { Support } from '@jangts/agent-core';
const fragment = { id: 'history', maxChars: 4000 };
const strategy = Support.createContextStrategy({ kind: 'recent', fragment, field: 'messages',
  keepGroups: 3, targetChars: 2500, grouping: { kind: 'user-turn' },
});
console.log(strategy.policy);`,
      },
      {
        title: '需要承接旧话题时明确提供压缩算法',
        level: '扩展',
        environment: 'Node.js',
        ts: `import { Support } from '@jangts/agent-core';
const compressor = Support.createContextCompressor({ id: 'history-summary',
  instruction: '按资料原意概括旧历史，保留事实、时间和未完成事项。',
  interaction: 'core:plain-text', maxOutputTokens: 500,
  parse(value: unknown) { if (typeof value !== 'string' || !value.trim()) throw new TypeError('需要摘要'); return { messages: [{ role: 'user', content: value }] }; },
});
const strategy = Support.createContextStrategy({ kind: 'continuity',
  fragment: { id: 'history', maxChars: 4000 }, field: 'messages', compressor,
  targetChars: 2500, keepGroups: 2,
});
console.log(strategy.policy, strategy.compressors.map(item => item.id));`,
        note: '本例只装配策略。将 policy/compressors/selectors 作为原上下文节点配置，不在这里发新请求或创建额外额度。',
      },
    ],
    policies: [
      {
        title: '场景目录、生成的步骤和精确覆盖',
        file: 'src/support/context/strategies.ts',
        symbols: ['contextStrategyCatalog', 'createContextStrategy', 'recent', 'continuity'],
      },
    ],
  },
  {
    // 演示预览规则必须来自已声明的 Schema 与阶段，不能把任意字符串猜成正文。
    id: 'preview-rule-generation',
    title: '从 Tool 与阶段声明生成预览规则',
    layer: 'support',
    matches: ['createReplyPreviewRules', 'ReplyPreviewTool', 'ReplyPreviewStage'],
    summary: '复用实际 Schema 与阶段引用，只为明确允许展示的 Tool 生成规则。',
    details: `stage.preview='text' 仅允许无 toolIds 的纯文本阶段；'tools' 只处理该阶段引用且显式开启 preview 的 Tool。不会把任意字符串字段猜成可展示正文。

tool.preview=true 从常见 text/bubbles 字段约定中只选择真实 Schema 声明的路径，至少存在一条；自定义 paths 时逐个验证，when.path 也必须存在。ID 重复、未知引用或不存在的字段在装配时拒绝。

返回的规则交给现有 createReplyPreview。新增阶段或 Tool 时复用清单生成，避免传输一份列表、预览再手抄一份；预览仍不能授权、持久化最终回复或执行工具。`,
    examples: [
      {
        title: '明确标记纯文本阶段',
        level: '入门',
        environment: 'Node.js',
        ts: `import { Support } from '@jangts/agent-core';
const rules = Support.createReplyPreviewRules({ stages: [{ id: 'reply', preview: 'text' }], tools: [] });
const preview = Support.createReplyPreview({ rules, sink: bubbles => { console.log(bubbles); } });
console.log(typeof preview);`,
      },
      {
        title: '复用结构化 Tool 的 Schema 与阶段引用',
        level: '配置',
        environment: 'Node.js',
        ts: `import { Support } from '@jangts/agent-core';
const tools = [{ id: 'reply', jsonSchema: { type: 'object', properties: { answer: { type: 'string' } } },
  preview: { paths: [['answer']] } }];
const rules = Support.createReplyPreviewRules({
  stages: [{ id: 'respond', toolIds: ['reply'], preview: 'tools' }], tools,
});
const preview = Support.createReplyPreview({ rules, sink: bubbles => { console.log(bubbles); } });
console.log(rules, typeof preview);`,
        note: '真实 App 应从它已经登记的 Tool 和阶段声明投影这两个数组；本例用最小静态资料展示所需字段。',
      },
    ],
    policies: [
      {
        title: 'Schema 字段核验与明确预览范围',
        file: 'src/support/model/preview-rules.ts',
        symbols: ['createReplyPreviewRules', 'fieldExists'],
      },
    ],
  },
  {
    // 演示宿主已选定调用后的同步执行适配；选择与授权不在这个入口内。
    id: 'synchronous-invocation',
    title: '宿主已选定调用的同步执行适配',
    layer: 'core',
    matches: ['executeInvocation', 'InvocationHandler', 'ToolInvocationPorts', 'ToolJournal'],
    summary: '为宿主已经选定的同步调用统一记录开始、完成和失败，不替代选工具与授权。',
    details: `executeInvocation 返回 void，结果由 App 自己的 Context 和可选 receipt 端口表达。handler.call 必须同步，不允许偷偷返回 Promise。选择、授权事实、参数结构及副作用仍归宿主。

需要异步值与统一 ToolResult 时优先使用 ToolRegistry/Support 工具运行时。这个同步适配主要连接已有的宿主调用流程，不要为所有工具另建一套 InvocationHandler 框架。可配置 journal/diagnostics/signal/checkpoint/receipt，它们都是已有合同的 App 实现。`,
    examples: [
      {
        title: '执行 App 已选定的本地调用',
        level: '入门',
        environment: 'Node.js',
        ts: `import { executeInvocation } from '@jangts/agent-core/tools';
const state = { status: '' };
executeInvocation({ id: 'read-status', call(_input: {}, context: typeof state) {
  context.status = '服务正常';
} }, {}, state);
console.log(state.status);`,
      },
      {
        title: '接入同一请求 journal 和取消信号',
        level: '配置',
        environment: 'Node.js',
        ts: `import { executeInvocation } from '@jangts/agent-core/tools';
import { ContextJournal } from '@jangts/agent-core/journal';
const state = { status: '', journal: new ContextJournal(), signal: new AbortController().signal };
executeInvocation({ id: 'read-status', call(_input: {}, context: typeof state) { context.status = '服务正常'; } }, {}, state, {
  signal: context => context.signal,
  journal: context => context.journal,
  receipt: context => context.status,
});
console.log(state.journal.snapshot());`,
      },
    ],
    policies: [
      {
        title: '同步调用、取消和回执的边界',
        file: 'src/capabilities/invocation.ts',
        symbols: ['executeInvocation'],
      },
    ],
  },
  {
    // 演示稳定前缀比较与键排序查询键；二者都不是散列、授权或语义去重。
    id: 'structural-query-and-prefix',
    title: '结构查询键与文本公共前缀',
    layer: 'core',
    matches: ['commonPrefixLength', 'retrievalQueryKey'],
    summary: '用于稳定比较与用量分析的小型纯函数，不是授权、散列或语义去重系统。',
    details: `commonPrefixLength 比较字符串的 JS UTF-16 前缀长度，用于稳定前缀分析；它不是 token 数、字符字素数或缓存命中承诺。

retrievalQueryKey 对 JSON 可序列化的对象键排序，再保留数组顺序序列化，适合受控查询结构比较。它不是加密 hash、身份签名或适用于任意 JS 对象的唯一键；Date/Map/函数/循环对象等不属于示例的受控 JSON 查询输入。`,
    examples: [
      {
        title: '比较两个真实输入的稳定前缀',
        level: '入门',
        environment: 'Node.js',
        ts: `import { commonPrefixLength } from '@jangts/agent-core';
console.log(commonPrefixLength('服务：正常', '服务：繁忙')); // 3`,
      },
      {
        title: '对象键顺序不同，查询语义保持同一结构',
        level: '配置',
        environment: 'Node.js',
        ts: `import { retrievalQueryKey } from '@jangts/agent-core';
const first = retrievalQueryKey({ query: '服务状态', filters: { region: 'cn', active: true } });
const second = retrievalQueryKey({ filters: { active: true, region: 'cn' }, query: '服务状态' });
console.log(first === second); // true
console.log(retrievalQueryKey({ ids: ['a', 'b'] }) === retrievalQueryKey({ ids: ['b', 'a'] })); // false`,
      },
    ],
    policies: [
      {
        title: '结构键的排序与序列化',
        file: 'src/utils/query-key.ts',
        symbols: ['retrievalQueryKey', 'canonical'],
      },
      { title: '公共前缀的比较实现', file: 'src/utils/text.ts', symbols: ['commonPrefixLength'] },
    ],
  },
];

/**
 * Kit 检索类示例：全文索引、向量检索、名次融合与外部推理绑定。
 * 每个条目声明 summary、details、由简到繁的 examples 与策略源码，
 * 由 recipes/kits.mjs 聚合后交给文档生成脚本；示例代码不会被实际执行。
 */
/** 构造示例条目；note 用于补充离线限制或容易误读的约束。 */
const sample = (title, level, ts, note) => ({
  title,
  level,
  environment: 'Node.js',
  ts,
  ...(note ? { note } : {}),
});

export default [
  {
    // 分片只处理已解码文本；分页窗口、索引和提示词由 App 决定。
    id: 'kit-text-blocks',
    title: 'TextBlocks：长文本结构分片',
    layer: 'kit',
    matches: ['TextBlocks', 'splitTextBlocks'],
    summary: '把长文本切成有界结构块，为分页读取或索引保留原文与偏移。',
    details: `split(text, { targetChars }) 只处理已解码的纯文本。标题与分隔线起新块，空行结束当前块，其余在换行处按 targetChars 断开；单行超过目标长度时保留为一个块，由后续分页切片，避免同一行被拆成互不相关的两段。所有块按顺序拼回与原文逐字一致，保留空白与 CRLF；number 从 1 开始，start/end 是原文 UTF-16 偏移。

targetChars 必须为正整数，空文本返回空数组。Kit 不读写文件、不分页、不访问模型或存储；分页窗口、检索、摘要与提示词由 App 决定。块边界跟随结构而不是固定字符窗口，需要报告覆盖范围时使用 start/end。`,
    examples: [
      sample(
        '先切一份带章节的说明',
        '入门',
        `import { TextBlocks } from '@jangts/agent-core/kits/text-blocks';
const text = '# 概览\\n\\n' + '说明内容\\n'.repeat(4) + '\\n## 细节\\n\\n' + '更多内容\\n'.repeat(4);
const blocks = TextBlocks.split(text, { targetChars: 40 });
console.log(blocks.map(block => [block.number, block.start, block.end]));
console.log(blocks.map(block => block.text).join('') === text);`,
        '示例只演示分片合同；分页窗口、上下文预算和提示词仍由 App 决定。',
      ),
      sample(
        '按块分页并记录覆盖范围',
        '配置',
        `import { TextBlocks, type TextBlock } from '@jangts/agent-core/kits/text-blocks';
const text = '# 报告\\n\\n' + '记录内容\\n'.repeat(200);
const blocks = TextBlocks.split(text, { targetChars: 4000 });
const page = (offset: number, limit: number): { blocks: TextBlock[]; nextOffset?: number } => ({
  blocks: blocks.slice(offset, offset + limit),
  nextOffset: offset + limit < blocks.length ? offset + limit : undefined,
});
const first = page(0, 2);
console.log(first.blocks.map(block => block.number), first.nextOffset);`,
        '块边界不等于固定字符窗口；报告已读范围时应记录块的 start/end，而不是推算字符位置。',
      ),
    ],
    policies: [
      {
        title: '结构边界、精确拼回与原文偏移',
        file: 'src/kits/text-blocks.ts',
        symbols: ['TextBlocks', 'splitTextBlocks'],
      },
    ],
  },
  {
    // 示例从最小索引推进到访问过滤与快照恢复；快照只校验配置一致性，不提供持久化。
    id: 'kit-text-search',
    title: 'TextSearch：App 侧全文索引',
    layer: 'kit',
    matches: ['TextSearch'],
    summary: '按已声明字段建立局部索引，查询必须给出应用过滤器。',
    details: `构造参数包含 indexRevision、fields、storedFields，可加 tokenize、boost、combineWith。upsert 按文档 id 增加或替换。search({query,limit,filter}) 返回 {id,score,terms,document}[]；document 仅包含 storedFields，不是原文完整副本。query 不能为空，limit 为 1—1000，filter 必须同步返回 boolean。

默认 combineWith='OR'；分词默认来自 MiniSearch，中文等语言可显式提供 tokenizer。remove 异步等待 vacuum，clear 清空当前索引。snapshot/restore 检查引擎标识和配置指纹；indexRevision 由 App 表达格式/分词语义版本，修改自定义分词行为时也应更新。快照不是持久化服务，保存、到期、删除和访问策略由 App 负责。`,
    examples: [
      sample(
        '先索引两份接口说明',
        '入门',
        `import { TextSearch } from '@jangts/agent-core/kits/search';
type Document = { id: string; title: string; body: string };
const index = new TextSearch<Document>({ indexRevision: 'manual-v1', fields: ['title', 'body'], storedFields: ['title'] });
index.upsert({ id: 'workflow', title: 'Workflow', body: 'Define reusable agent nodes.' });
index.upsert({ id: 'model', title: 'Model', body: 'Bind a model provider.' });
console.log(index.search({ query: 'agent', limit: 5, filter: () => true }));`,
      ),
      sample(
        '相同 search 增加访问过滤、权重和快照',
        '配置',
        `import { TextSearch } from '@jangts/agent-core/kits/search';
type Document = { id: string; title: string; body: string; audience: string };
const options = { indexRevision: 'manual-v2', fields: ['title', 'body'] as const, storedFields: ['title', 'audience'] as const, boost: { title: 3 }, combineWith: 'AND' as const };
const index = new TextSearch<Document>(options);
index.upsert({ id: 'workflow', title: 'Agent Workflow', body: 'Define reusable nodes.', audience: 'public' });
index.upsert({ id: 'private', title: 'Agent internals', body: 'Internal notes.', audience: 'owner' });
const restored = TextSearch.restore<Document>(options, index.snapshot());
console.log(restored.search({ query: 'agent', limit: 5, filter: document => document.audience === 'public' }));
await restored.remove('workflow');`,
        '允许用于过滤的元数据须登记为 storedFields；字段过滤必须依赖可信 App 身份，不能让模型自报身份。',
      ),
    ],
    policies: [
      {
        title: '索引字段、过滤、快照指纹与删除',
        file: 'src/kits/search.ts',
        symbols: ['TextSearch'],
      },
    ],
  },
  {
    // 二维向量只演示合同与排序规则，不代表真实 embedding 质量；过滤条件必须来自可信身份。
    id: 'kit-vector-search',
    title: 'VectorSearch：有边界的精确余弦检索',
    layer: 'kit',
    matches: ['VectorSearch'],
    summary: '给定同一个向量空间，先过滤文档，再按余弦相似度排序。',
    details: `构造 VectorSearchSpace 必须提供 identity 和 dimensions（1—16384）。upsert({document,vector}) 复制文档并归一化向量；拒绝维数不符、非有限数和零向量。search({vector,limit,filter,minScore?,groupBy?}) 返回 SearchHit[]。filter/groupBy 同步，limit 为 1—1000，minScore 若给出须在 [-1,1]。

配置 groupBy 时每组只取最高分，等分时以 id 选择；最终按分数降序和 id 排序。remove/clear 只改变当前内存索引。它不生成 embedding、不查数据库，也不混合不同模型/维数的向量；空间版本、授权、索引规模和持久化由 App 决定。`,
    examples: [
      sample(
        '先在同一空间检索说明片段',
        '入门',
        `import { VectorSearch } from '@jangts/agent-core/kits/vector-search';
const index = new VectorSearch<{ id: string; text: string }>({ identity: 'demo-direction-v1', dimensions: 2 });
index.upsert({ document: { id: 'workflow', text: '工作流说明' }, vector: [1, 0] });
index.upsert({ document: { id: 'model', text: '模型说明' }, vector: [0, 1] });
console.log(index.search({ vector: [0.9, 0.1], limit: 2, filter: () => true }));`,
        '二维向量用于展示合同；不代表真实文本 embedding 或检索质量。',
      ),
      sample(
        '相同 search 增加权限、阈值和文档分组',
        '配置',
        `import { VectorSearch } from '@jangts/agent-core/kits/vector-search';
type Chunk = { id: string; documentId: string; audience: string; text: string };
const index = new VectorSearch<Chunk>({ identity: 'demo-direction-v1', dimensions: 2 });
index.upsert({ document: { id: 'manual-1', documentId: 'manual', audience: 'public', text: '工作流定义' }, vector: [1, 0] });
index.upsert({ document: { id: 'manual-2', documentId: 'manual', audience: 'public', text: '工作流调用' }, vector: [0.95, 0.05] });
index.upsert({ document: { id: 'private-1', documentId: 'private', audience: 'owner', text: '内部说明' }, vector: [1, 0] });
console.log(index.search({ vector: [1, 0], limit: 5, minScore: 0.5, filter: row => row.audience === 'public', groupBy: row => row.documentId }));`,
      ),
    ],
    policies: [
      {
        title: '向量校验、归一化、过滤与分组排序',
        file: 'src/kits/vector-search.ts',
        symbols: ['normalize', 'VectorSearch'],
      },
    ],
  },
  {
    // 演示不同来源分数不可直接相加，因此只按名次融合；权限过滤必须在融合前完成。
    id: 'kit-rank-fusion',
    title: 'Rank Fusion：按名次融合多个检索结果',
    layer: 'kit',
    matches: ['reciprocalRankFusion'],
    summary: '融合全文与向量结果的名次，避免直接相加语义不同的原始分数。',
    details: `reciprocalRankFusion(lists,{limit,k?}) 返回 {id,score,contributions}[]。每个来源有唯一 sourceId、按名次排列的 ids 和可选正 weight。默认 k=60、weight=1；贡献为 weight/(k+rank)，rank 从 1 开始。同来源重复 ID 只计一次。总分降序，等分时按 id 排序；limit 为 1—1000。

返回分数是融合排序依据，不是相似度、置信度或事实正确率。各来源须在融合前完成相同的权限过滤；融合不会重新检查源数据是否可见。`,
    examples: [
      sample(
        '先用默认融合参数',
        '入门',
        `import { reciprocalRankFusion } from '@jangts/agent-core/kits/rank-fusion';
const result = reciprocalRankFusion([
  { sourceId: 'text', ids: ['workflow', 'model'] },
  { sourceId: 'vector', ids: ['model', 'workflow'] },
], { limit: 5 });
console.log(result);`,
      ),
      sample(
        '相同函数增加来源权重与平滑参数',
        '配置',
        `import { reciprocalRankFusion } from '@jangts/agent-core/kits/rank-fusion';
const result = reciprocalRankFusion([
  { sourceId: 'text', ids: ['workflow', 'model'], weight: 2 },
  { sourceId: 'vector', ids: ['model', 'workflow'], weight: 1 },
], { limit: 2, k: 30 });
console.log(result[0].contributions);`,
      ),
    ],
    policies: [
      {
        title: 'RRF 名次、去重和分数',
        file: 'src/kits/rank-fusion.ts',
        symbols: ['reciprocalRankFusion'],
      },
    ],
  },
  {
    // 演示 App 自定义 I/O 绑定：identity 说明真实算法版本，与聊天 Runner 的调用账本无关。
    id: 'kit-model-calls',
    title: 'ModelCalls：外部推理绑定',
    layer: 'kit',
    matches: ['ModelCalls'],
    summary: '为 embedding 等 App 自定义 I/O 绑定身份、校验、取消与统一调用回执。',
    details: `构造时登记 {id,identity,invoke,assertInput?,assertOutput?}。invoke({modelId,input,timeoutMs},execution) 返回 ModelResult<Output>，正文/向量在 value，真实调用信息在 invocation。已知字面量 ID 可从登记元组推导输入输出；未知 ID 拒绝。identity 用来说明真实模型/算法版本，不从请求猜测。

timeoutMs 必须是支持范围内的正安全整数；与上层 signal 合并。输入输出 assertion 同步且必须返回 void；取消后迟到的结果不会作为成功返回。底层 I/O 应消费传入 signal，停止等待不等于能撤销外部副作用。

这是独立外部推理适配器，不能因为返回形状相同就宣称它已接入聊天 Runner 的调用次数账本。当前源码的绑定需由 App 明确承担对应业务预算；embedding 与聊天调用的计量单位不可混扣。Core 的单次多模型聊天能力仍使用 Engine/ModelRunner 的正常模型合同。`,
    examples: [
      sample(
        '先绑定一个离线演示向量算法',
        '入门',
        `import { ModelCalls } from '@jangts/agent-core/kits/inference';
const models = new ModelCalls([
  { id: 'demo-vector', identity: 'length-direction-v1', invoke: (text: string) => [text.length, 1] },
] as const);
const result = await models.invoke({ modelId: 'demo-vector', input: 'Agent Core', timeoutMs: 1000 }, { signal: new AbortController().signal });
console.log(result.value, result.invocation.modelId);`,
        '算法只演示 I/O 绑定，不提供真实语言向量质量。',
      ),
      sample(
        '在同一 invoke 上增加输入输出检查和取消',
        '配置',
        `import { ModelCalls } from '@jangts/agent-core/kits/inference';
const models = new ModelCalls([
  { id: 'demo-vector', identity: 'length-direction-v1',
    assertInput(text: string) { if (!text.trim()) throw new Error('文本为空'); },
    invoke(text: string, context) { context.signal.throwIfAborted(); return [text.length, 1]; },
    assertOutput(vector: number[]) { if (vector.length !== 2 || vector.some(value => !Number.isFinite(value))) throw new Error('向量无效'); },
  },
] as const);
const controller = new AbortController();
const result = await models.invoke({ modelId: 'demo-vector', input: 'Agent Core', timeoutMs: 1000 }, { signal: controller.signal });
console.log(models.identity('demo-vector'), result.value);`,
      ),
    ],
    policies: [
      {
        title: '绑定、校验、期限与真实回执',
        file: 'src/kits/inference.ts',
        symbols: ['ModelCalls'],
      },
    ],
  },
];

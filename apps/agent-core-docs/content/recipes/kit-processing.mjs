// Agent Core 文档站的 Kit 处理类配方：归一化、交付、内容投影、查询汇总、检索、
// 证据检查、策略集、候选封套与文本 Skill。默认导出配方数组，由 kits.mjs 汇总。
const sample = (title, level, ts, note) => ({
  title,
  level,
  environment: 'Node.js',
  ts,
  ...(note ? { note } : {}),
});

export default [
  {
    id: 'kit-normalization',
    title: 'Normalization：有顺序的值转换',
    layer: 'kit',
    matches: ['Normalization', 'defineNormalization', 'uniqueBy'],
    summary: '把清理、替换和停止条件集中为一份实际参与执行的转换清单。',
    details: `输入是有序 NormalizationStep 清单；normalize(value, context) 返回最后一个值。每步可返回新值，也可选择原地修改；对象所有权由 App 决定。when 与 isComplete 必须同步返回 boolean，normalize 必须同步。重复或空步骤 ID、缺少 handler、误返回 Promise 都会拒绝。

uniqueBy 按 App 提供的 key 稳定去重，保留第一次出现的原值；initial 可以排除已经见过的键。它不会猜测两个业务对象是否等价。`,
    examples: [
      sample(
        '先只清理同一段查询',
        '入门',
        `import { Normalization } from '@jangts/agent-core/kits/normalization';
const query = Normalization.defineNormalization<string>([
  { id: 'trim', normalize: value => value.trim() },
]);
console.log(query.normalize('  Agent Core  ', undefined));`,
      ),
      sample(
        '继续增加步骤和停止条件',
        '配置',
        `import { Normalization } from '@jangts/agent-core/kits/normalization';
const query = Normalization.defineNormalization<string>([
  { id: 'trim', normalize: value => value.trim() },
  { id: 'collapse-space', normalize: value => value.replace(/\\s+/g, ' ') },
  { id: 'lowercase', when: value => value !== '*', normalize: value => value.toLowerCase() },
], { isComplete: value => value === '*' });
const values = [' Agent  Core ', 'agent core', '*'].map(value => query.normalize(value, undefined));
console.log(Normalization.uniqueBy(values, value => value));`,
      ),
    ],
    policies: [
      {
        title: '步骤执行、同步约束和停止顺序',
        file: 'src/kits/normalization.ts',
        symbols: ['defineNormalization', 'uniqueBy'],
      },
    ],
  },
  {
    id: 'kit-delivery',
    title: 'DeliveryPipeline：顺序交付与显式结束',
    layer: 'kit',
    matches: ['DeliveryPipeline', 'defineDeliveryPipeline', 'Delivery', 'defineDelivery'],
    summary: '每个交付阶段明确 continue 或 complete；一个阶段完成后立即结束。',
    details: `defineDeliveryPipeline 接受 createState、stages、missingResult，以及可选 beforeStage。deliver(input, execution) 同步返回 Result。beforeStage 与该阶段 handle 交错执行；不是先跑完所有 hook 再跑 handler。没有任何阶段交付时抛出 missingResult() 返回的错误。

执行前后检查 AbortSignal；所有 handler 都必须同步。阶段名、状态、优先级和是否允许发布是 App 的语义，不是 Core 的全局交付协议。`,
    examples: [
      sample(
        '交付一段已经确认的文本',
        '入门',
        `import { DeliveryPipeline } from '@jangts/agent-core/kits/delivery';
const delivery = DeliveryPipeline.defineDeliveryPipeline({
  createState: (input: string) => ({ text: input }),
  stages: [{ id: 'publish', handle: (state: { text: string }) => ({ type: 'complete' as const, value: state.text }) }],
  missingResult: () => new Error('没有可交付结果'),
});
console.log(delivery.deliver('已完成的答复', { signal: new AbortController().signal }));`,
      ),
      sample(
        '增加校验阶段，保留同一个 deliver',
        '配置',
        `import { DeliveryPipeline } from '@jangts/agent-core/kits/delivery';
const delivery = DeliveryPipeline.defineDeliveryPipeline({
  createState: (input: string) => ({ text: input.trim() }),
  stages: [
    { id: 'check', handle(state: { text: string }) {
      if (!state.text) throw new Error('答复为空');
      return { type: 'continue' as const };
    } },
    { id: 'publish', handle: (state: { text: string }) => ({ type: 'complete' as const, value: state.text }) },
  ],
  beforeStage: ({ stageId }: { stageId: string }) => { console.log('阶段', stageId); },
  missingResult: () => new Error('没有可交付结果'),
});
console.log(delivery.deliver(' 已完成的答复 ', { signal: new AbortController().signal }));`,
      ),
    ],
    policies: [
      {
        title: '交错 hook、阶段短路与取消检查',
        file: 'src/kits/delivery.ts',
        symbols: ['defineDeliveryPipeline'],
      },
    ],
  },
  {
    id: 'kit-projection',
    title: 'Projection：按预算投影内容',
    layer: 'kit',
    matches: [
      'Projection',
      'defineContentProjection',
      'projectContinuousExcerpt',
      'defineTreeProjection',
    ],
    summary: '先缩短文本，再减少条目；源数据、投影结果和预算由 App 显式区分。',
    details: `value 应是可序列化的 JSON 数据。defineContentProjection 的 counts 与 lengths 是 App 指定的尝试顺序；project({value,maxChars}) 返回 {text,truncated}。已在预算内时直接返回 JSON.stringify 的结果，超限后依次尝试 render 与 fallback。fallback 的结果由 App 负责，不能把它当成 Core 的最终输入预算保证。

projectContinuousExcerpt 对可连续截取的正文做二分前缀选择；render(0) 已超限时返回 undefined，保留已有代理对。defineTreeProjection 同步按属性/数组顺序遍历，超过 maxDepth 或 omit 返回 true 时省略节点；只有 undefined 表示省略，null、false、0 均保留。`,
    examples: [
      sample(
        '为同一份查询结果准备紧凑 JSON',
        '入门',
        `import { Projection } from '@jangts/agent-core/kits/projection';
const projection = Projection.defineContentProjection({
  counts: [10, 3, 1], lengths: [200, 80, 20],
  render: value => JSON.stringify(value), fallback: () => '{}',
});
const result = projection.project({ value: { items: [{ title: '配置说明', body: '正文'.repeat(100) }] }, maxChars: 120 });
console.log(result.text, result.truncated);`,
      ),
      sample(
        '相同数据先移除私有字段，再按预算投影',
        '配置',
        `import { Projection } from '@jangts/agent-core/kits/projection';
const tree = Projection.defineTreeProjection({
  maxDepth: 4,
  visitRecord(record) { delete record.privateNote; },
});
const source = { items: [{ title: '配置说明', body: '正文'.repeat(100), privateNote: '不向模型提供' }] };
// 调用者明确选择副本所有权；visitor 不会碰原记录。
const publicData = tree.visit(structuredClone(source), undefined);
const compact = Projection.defineContentProjection({ counts: [10, 3, 1], lengths: [200, 80, 20], render: JSON.stringify, fallback: () => '{}' });
console.log(compact.project({ value: publicData, maxChars: 120 }));`,
      ),
      sample(
        '保留连续正文而非拆散段落',
        '扩展',
        `import { Projection } from '@jangts/agent-core/kits/projection';
const body = '一段连续的资料正文。'.repeat(100);
const excerpt = Projection.projectContinuousExcerpt(body, 120, length => JSON.stringify({ excerpt: body.slice(0, length) }));
if (excerpt) console.log(JSON.parse(excerpt.text));`,
        'render 的输出长度须随前缀长度单调增长，二分搜索才有意义。',
      ),
    ],
    policies: [
      {
        title: '缩减顺序与树遍历',
        file: 'src/kits/projection.ts',
        symbols: ['defineContentProjection', 'projectContinuousExcerpt', 'defineTreeProjection'],
      },
    ],
  },
  {
    id: 'kit-aggregation',
    title: 'Aggregation：查询汇总与稳定合并',
    layer: 'kit',
    matches: ['Aggregation', 'defineQueryAggregation', 'mergeByKey'],
    summary: '顺序读取 App 数据，将重复项如何合并留在同一份配置中。',
    details: `collect(inputs, context) 同步调用 execute，返回 {total,items}。未配置 key 时保留所有结果；配置 key 后按首次插入位置稳定合并，默认后项覆盖前项。merge(item,previous,input,context) 可决定保留哪个结果。execute、key、merge 必须同步。

mergeByKey 是独立的同类合并函数。它不查询数据库、不调用模型，不管理事务或权限；这些仍由真实读取端口负责。`,
    examples: [
      sample(
        '顺序汇总两次读取',
        '入门',
        `import { Aggregation } from '@jangts/agent-core/kits/aggregation';
const pages = new Map([[1, [{ id: 'a', title: '第一页' }]], [2, [{ id: 'a', title: '重复项' }, { id: 'b', title: '第二页' }]]]);
const query = Aggregation.defineQueryAggregation({ execute: (page: number) => pages.get(page) ?? [] });
console.log(query.collect([1, 2], undefined));`,
      ),
      sample(
        '同一 collect 增加主键与保留策略',
        '配置',
        `import { Aggregation } from '@jangts/agent-core/kits/aggregation';
type Row = { id: string; title: string };
const pages = new Map<number, Row[]>([[1, [{ id: 'a', title: '第一页' }]], [2, [{ id: 'a', title: '重复项' }, { id: 'b', title: '第二页' }]]]);
const query = Aggregation.defineQueryAggregation({
  execute: (page: number) => pages.get(page) ?? [],
  key: (row: Row) => row.id,
  merge: (row: Row, previous: Row | undefined) => previous ?? row,
});
console.log(query.collect([1, 2], undefined));
console.log(Aggregation.mergeByKey([...pages.values()].flat(), row => row.id, (row, previous) => previous ?? row));`,
      ),
    ],
    policies: [
      {
        title: '稳定键合并与读取顺序',
        file: 'src/kits/aggregation.ts',
        symbols: ['defineQueryAggregation', 'mergeByKey'],
      },
    ],
  },
  {
    id: 'kit-retrieval',
    title: 'Retrieval：有额度的同步检索生命周期',
    layer: 'kit',
    matches: ['Retrieval', 'defineRetrieval', 'retrievalQueryKey'],
    summary: '把规范化、校验、去重、授权、读取和后续效果放在一条确定的调用路径中。',
    details: `run(query, context) 返回 RetrievalReceipt：原 query、去重 key、成功序号、开始时间、rawResult、带请求内 sourceId 的 result 及 extensions。state(context) 提供本次请求的 queryCount、seen、sources；limit(context) 是成功查询额度。

顺序为 prepare → assertInput → 去重/额度 → authorize → 预占 seen key → execute → assertResult → 累计成功次数及来源 → effects。失败尝试已占用 seen key，不会因失败自动重试。effects 按顺序执行，失败不会假装回滚先前副作用。全部端口为同步；异步检索可由 App 自己的普通 Workflow 节点处理。默认 key 来自 retrievalQueryKey；默认来源 ID 为检索 ID、成功序号与源 ID 的组合，只是请求内引用。`,
    examples: [
      sample(
        '为同一份产品资料配置一次读取',
        '入门',
        `import { Retrieval } from '@jangts/agent-core/kits/retrieval';
type Source = { sourceId: string; text: string };
const state = { queryCount: 0, seen: new Set<string>(), sources: [] as Source[] };
const documents = [{ sourceId: 'manual', text: 'Agent Core 使用指南' }];
const retrieval = Retrieval.defineRetrieval({
  id: 'manual-search', description: '读取已确认的本地演示资料',
  assertInput(query: string) { if (!query.trim()) throw new Error('查询为空'); },
  state: () => state, limit: () => 2,
  execute: (query: string) => ({ sources: documents.filter(item => item.text.includes(query)) }),
});
console.log(retrieval.run('Agent', { app: {}, signal: new AbortController().signal }).result);`,
      ),
      sample(
        '相同 run 增加规范化、授权和回执效果',
        '配置',
        `import { Retrieval } from '@jangts/agent-core/kits/retrieval';
type Source = { sourceId: string; text: string };
const state = { queryCount: 0, seen: new Set<string>(), sources: [] as Source[] };
const retrieval = Retrieval.defineRetrieval<string, Source, { sources: Source[] }, { canRead: boolean }>({
  id: 'manual-search', description: '按当前服务端权限读取资料',
  prepare: query => query.trim(),
  assertInput(query) { if (!query) throw new Error('查询为空'); },
  state: () => state, limit: () => 2,
  authorize(_query, { app }) { if (!app.canRead) throw new Error('没有资料读取权限'); },
  execute: query => ({ sources: [{ sourceId: 'manual', text: 'Agent Core 使用指南' }].filter(item => item.text.includes(query)) }),
  effects: [{ id: 'source-count', description: '给真实回执附加来源数量', handle(receipt) { receipt.extensions.sourceCount = receipt.result.sources.length; } }],
});
const receipt = retrieval.run(' Agent ', { app: { canRead: true }, signal: new AbortController().signal });
console.log(receipt.sequence, receipt.extensions);`,
      ),
    ],
    policies: [
      {
        title: '去重、预占、读取、计数和效果顺序',
        file: 'src/kits/retrieval.ts',
        symbols: ['defineRetrieval'],
      },
      { title: '默认查询键', file: 'src/utils/query-key.ts', symbols: ['retrievalQueryKey'] },
    ],
  },
  {
    id: 'kit-evidence',
    title: 'Evidence：用真实观察检查完成性',
    layer: 'kit',
    matches: ['Evidence', 'defineEvidenceChecklist', 'defineEvidenceProjection'],
    summary: '用 App 定义的证据语义检查需求，避免把模型的“完成了”当成真实回执。',
    details: `Checklist 按 requirement.kind 选择已登记的 isSatisfied。isSatisfied 检查一项，isComplete 检查全部，missing 返回未满足需求。未知 kind 拒绝；predicate 必须同步返回 boolean。Kit 不推断“文件已交付”或“事务已提交”，App 必须用真实结果定义。

EvidenceProjection 按 sourceIds 缩小带来源的观察。未选择或空数组时保留完整证据，未知工具也保持原观察；这与按权限过滤不是一回事，权限应在来源读取前完成。默认工具选择读取 toolId，再兼容观察本身提供的 tool；App 可显式提供 toolId()。`,
    examples: [
      sample(
        '检查真实资料是否已读取',
        '入门',
        `import { Evidence } from '@jangts/agent-core/kits/evidence';
type Observation = { sourceId: string; read: boolean };
type Requirement = { id: string; kind: 'source-read'; sourceId: string };
const checklist = Evidence.defineEvidenceChecklist<Observation, Requirement>([
  { kind: 'source-read', description: '资料读取已成功', isSatisfied: (seen, need) => seen.read && seen.sourceId === need.sourceId },
]);
console.log(checklist.isComplete({ observations: [{ sourceId: 'manual', read: true }], requirements: [{ id: 'need-manual', kind: 'source-read', sourceId: 'manual' }] }));`,
      ),
      sample(
        '相同清单返回缺口，再限定审查所用来源',
        '配置',
        `import { Evidence } from '@jangts/agent-core/kits/evidence';
type Observation = { sourceId: string; read: boolean };
type Requirement = { id: string; kind: 'source-read'; sourceId: string };
const checklist = Evidence.defineEvidenceChecklist<Observation, Requirement>([
  { kind: 'source-read', description: '资料读取已成功', isSatisfied: (seen, need) => seen.read && seen.sourceId === need.sourceId },
]);
console.log(checklist.missing({ observations: [], requirements: [{ id: 'need-manual', kind: 'source-read', sourceId: 'manual' }] }));
type ToolObservation = { toolId: string; sources: { id: string; text: string }[] };
const projection = Evidence.defineEvidenceProjection<ToolObservation, { id: string; text: string }>({
  sourceId: source => source.id,
  providers: { search: { sources: row => row.sources, withSources: (row, sources) => ({ ...row, sources }) } },
});
console.log(projection.project({ observations: [{ toolId: 'search', sources: [{ id: 'manual', text: '使用指南' }, { id: 'faq', text: '常见问题' }] }], sourceIds: ['manual'] }));`,
      ),
    ],
    policies: [
      {
        title: '完成性与证据投影规则',
        file: 'src/kits/evidence.ts',
        symbols: ['defineEvidenceChecklist', 'defineEvidenceProjection'],
      },
    ],
  },
  {
    id: 'kit-policies',
    title: 'Policies：全部命中与首个恢复',
    layer: 'kit',
    matches: ['Policies', 'definePolicySet', 'defineRecoveryChain'],
    summary: '策略集收集所有匹配理由；恢复链按顺序选择第一个显式 handled 结果。',
    details: `assess(input) 返回 {required,reasons,kinds}，不会只取第一个匹配，也不会让某个“快速模式”覆盖强制规则。RecoveryResult 是 {handled:false} 或 {handled:true,value}；值为 undefined 仍然可以是已处理。未知 ID、重复 ID、空描述和异步 handler 均拒绝。具体 kind 与恢复条件由 App 定义。`,
    examples: [
      sample(
        '为同一答复声明何时必须复核',
        '入门',
        `import { Policies } from '@jangts/agent-core/kits/policies';
const policy = Policies.definePolicySet([
  { id: 'has-write', description: '有写操作就复核', kind: 'review', when: (input: { wrote: boolean }) => input.wrote },
]);
console.log(policy.assess({ wrote: true }));`,
      ),
      sample(
        '增加另一理由及有序恢复',
        '配置',
        `import { Policies } from '@jangts/agent-core/kits/policies';
type Input = { wrote: boolean; uncertain: boolean; cancelled: boolean };
const policy = Policies.definePolicySet<Input, 'review'>([
  { id: 'has-write', description: '有写操作就复核', kind: 'review', when: input => input.wrote },
  { id: 'uncertain', description: '证据不确定就复核', kind: 'review', when: input => input.uncertain },
]);
const recovery = Policies.defineRecoveryChain<Input, string>([
  { id: 'cancelled', description: '取消时不发布答案', tryRecover: input => input.cancelled ? { handled: true, value: '任务已取消' } : { handled: false } },
  { id: 'needs-review', description: '未通过复核时明确说明', tryRecover: input => policy.assess(input).required ? { handled: true, value: '结果还需要复核' } : { handled: false } },
]);
const input = { wrote: true, uncertain: true, cancelled: false };
console.log(policy.assess(input), recovery.tryRecover(input));`,
      ),
    ],
    policies: [
      {
        title: '全命中与首个 handled',
        file: 'src/kits/policies.ts',
        symbols: ['definePolicySet', 'defineRecoveryChain'],
      },
    ],
  },
  {
    id: 'kit-candidates',
    title: 'Candidates：有界候选封套',
    layer: 'kit',
    matches: ['Candidates', 'defineCandidateSelection'],
    summary: '同一结果可以是单项提议或候选清单；候选权限与数量由应用控制。',
    details: `parse({value,allowed}) 返回 unknown[]。没有配置字段的输入按单项返回；出现 field 时必须是只有该字段的对象，成员必须是非数组对象且不能再次嵌套候选字段。默认 minCandidates=1，maxCandidates 必填。allowed 只表示此处是否接受多候选，不是执行授权；模型不能通过候选封套绕过任务已接受后的限制。`,
    examples: [
      sample(
        '接受单一提议或最多三个候选',
        '入门',
        `import { Candidates } from '@jangts/agent-core/kits/candidates';
const selection = Candidates.defineCandidateSelection({ field: 'candidates', maxCandidates: 3 });
console.log(selection.parse({ value: { action: 'read' }, allowed: true }));
console.log(selection.parse({ value: { candidates: [{ action: 'read' }, { action: 'reply' }] }, allowed: true }));`,
      ),
      sample(
        '相同 parse 增加下界和应用阶段约束',
        '配置',
        `import { Candidates } from '@jangts/agent-core/kits/candidates';
const selection = Candidates.defineCandidateSelection({ field: 'candidates', minCandidates: 2, maxCandidates: 3, error: '当前阶段不接受这份候选' });
const taskAccepted = true;
try {
  selection.parse({ value: { candidates: [{ action: 'read' }, { action: 'reply' }] }, allowed: !taskAccepted });
} catch (error) { console.log((error as Error).message); }`,
      ),
    ],
    policies: [
      {
        title: '候选封套、数量与浅层限制',
        file: 'src/kits/candidates.ts',
        symbols: ['defineCandidateSelection'],
      },
    ],
  },
  {
    id: 'kit-text-skills',
    title: 'TextSkills：只读文本 Skill',
    layer: 'kit',
    matches: ['TextSkills', 'defineTextSkillLoader'],
    summary: '校验已登记的文本工作说明，读取由 App 提供；不运行文件里的代码。',
    details: `load({entries}, {read}) 返回冻结 TextSkill 数组。默认入口规则是 id/SKILL.md；默认严格头要求 name 和 description 依次出现。默认 maxIdChars=64；描述和指令预算必须显式提供。登记的 kind 必须是 text-workflow，toolIds 必须唯一。read、parseHeader 同步，误返回 Promise 会拒绝。

toolIds 是声明的依赖，单凭这份文本不会注册、授权或执行工具。来源允许列表、文件访问、安装和发布归 App。`,
    examples: [
      sample(
        '从明确来源读取一份文本 Skill',
        '入门',
        String.raw`import { TextSkills } from '@jangts/agent-core/kits/text-skills';
const documents = new Map([['summarize/SKILL.md', '---\nname: summarize\ndescription: 汇总已读取资料\n---\n只根据已确认资料总结。']]);
const loader = TextSkills.defineTextSkillLoader({ maxInstructionChars: 2000, maxDescriptionChars: 120 });
const skills = loader.load({ entries: [{ id: 'summarize', entry: 'summarize/SKILL.md', kind: 'text-workflow', toolIds: [] }] }, {
  read(entry) { const text = documents.get(entry); if (!text) throw new Error('来源未登记'); return text; },
});
console.log(skills[0].description);`,
      ),
      sample(
        '同一 loader 增加应用自己的入口约定',
        '配置',
        String.raw`import { TextSkills } from '@jangts/agent-core/kits/text-skills';
const documents = new Map([['skills/summarize.md', '---\nname: summarize\ndescription: 汇总已读取资料\n---\n只根据已确认资料总结。']]);
const loader = TextSkills.defineTextSkillLoader({ maxInstructionChars: 2000, maxDescriptionChars: 120, maxIdChars: 32, entryFor: id => 'skills/' + id + '.md' });
const skills = loader.load({ entries: [{ id: 'summarize', entry: 'skills/summarize.md', kind: 'text-workflow', toolIds: ['read-source'] }] }, {
  read(entry) { const text = documents.get(entry); if (!text) throw new Error('来源未登记'); return text; },
});
console.log(skills[0].toolIds);`,
        '入口规则和工具引用只做登记校验；实际工具仍需应用注册和授权。',
      ),
    ],
    policies: [
      {
        title: '文本登记与严格头解析',
        file: 'src/kits/text-skills.ts',
        symbols: ['defineTextSkillLoader', 'strictHeader'],
      },
    ],
  },
];

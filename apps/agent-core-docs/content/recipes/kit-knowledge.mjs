/**
 * Kit 资料与答复示例：资料选读快照、答复任务目录、逐项答复流程、
 * 输出字段所有权、模板/变体与答复事件。
 * 每个条目由 recipes/kits.mjs 聚合，示例代码只用于文档展示。
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
    // 示例从普通对象资料推进到章节预算与文本锚点；快照标识不是权限或正文 hash。
    id: 'kit-knowledge',
    title: 'Knowledge：资料、章节与证据快照',
    layer: 'kit',
    matches: ['Knowledge', 'defineKnowledgeCatalog', 'parseKnowledgeDocument'],
    summary: '同一份资料合同支持普通对象与带锚点的文本；选读后得到明确版本的证据快照。',
    details: `defineKnowledgeCatalog(documents, options?) 编译资料树，拒绝重复文档/章节、无版本、循环结构。read({documentId,selection}) 返回 {documentId,selection,revision,locale,content,id}。selection.mode 可为 document、self 或 subtree；self/subtree 还需非空、无重复的 sectionIds。self 只读该章节自己的文本，subtree 包含其子章节。

maxChars 限制本次选中且 trim 后的正文，超限抛错，不静默截断。assertSelection 只检查引用和选择形状，不执行正文预算校验。sectionIds 查看真实章节；普通 get/require 返回已编译资料定义。

revision 由 App 提供，id 是基于资料身份、版本、语言与选读序列化的快照标识，不是正文 hash、权限凭据或数据库 ID。相同 revision 下不能偷偷改内容；后续生成、复核应传递同一快照。文件加载、来源可信度、权限和发布不属于这个 Kit。`,
    examples: [
      sample(
        '先读取一份普通对象资料',
        '入门',
        `import { Knowledge } from '@jangts/agent-core/kits/knowledge';
const catalog = Knowledge.defineKnowledgeCatalog([
  { id: 'manual', revision: '1', parts: ['Agent Core 支持普通 Workflow 节点。'] },
]);
const snapshot = catalog.read({ documentId: 'manual', selection: { mode: 'document' } });
console.log(snapshot.content, snapshot.revision);`,
      ),
      sample(
        '在相同 read 上增加章节与预算',
        '配置',
        `import { Knowledge } from '@jangts/agent-core/kits/knowledge';
const catalog = Knowledge.defineKnowledgeCatalog([
  { id: 'manual', revision: '2', parts: [
    { id: 'start', parts: ['先运行一个节点。', { id: 'advanced', parts: ['再增加模型和工具。'] }] },
  ] },
], { maxChars: 2000 });
console.log(catalog.sectionIds('manual'));
const snapshot = catalog.read({ documentId: 'manual', selection: { mode: 'subtree', sectionIds: ['start'] } });
console.log(snapshot.content, snapshot.id);`,
      ),
      sample(
        '换成文本适配器，后续目录与读取完全相同',
        '扩展',
        String.raw`import { Knowledge } from '@jangts/agent-core/kits/knowledge';
const document = Knowledge.parseKnowledgeDocument({
  id: 'manual', revision: '3',
  text: ['<!-- agent-section:start -->', '先运行一个节点。', '<!-- /agent-section:start -->'].join('\n'),
});
const catalog = Knowledge.defineKnowledgeCatalog([document], { maxChars: 2000 });
const read = { documentId: 'manual', selection: { mode: 'self' as const, sectionIds: ['start'] } };
catalog.assertSelection(read);
console.log(catalog.read(read).content);`,
        '成对锚点必须匹配；标记仅是文本适配器的一种输入，Core 不要求资料必须存成 Markdown。',
      ),
    ],
    policies: [
      {
        title: '选读、预算和快照标识',
        file: 'src/kits/knowledge/catalog.ts',
        symbols: ['defineKnowledgeCatalog'],
      },
      {
        title: '文本章节解析与树编译',
        file: 'src/kits/knowledge/sections.ts',
        symbols: ['parseKnowledgeDocument', 'compileKnowledgeDocument'],
      },
    ],
  },
  {
    // 演示任务定义如何引用 reader、output 与 check；目录校验本身不授予读取权限。
    id: 'kit-answer-tasks',
    title: 'Answering 目录：任务、资料读取与检查引用',
    layer: 'kit',
    matches: ['defineAnswerTaskCatalog', 'defineAnswerReaderCatalog', 'defineAnswerCheckCatalog'],
    summary: '同一任务定义关联输入 Schema、reader、output 和 check，装配时验证真实引用。',
    details: `defineAnswerReaderCatalog 保存真实读取端口；defineAnswerCheckCatalog 编译同步检查清单。defineAnswerTaskCatalog 使用这些目录，核对 readerId、outputId、checkIds、domainToolIds 和输入 Schema。

task.read(request,context) 只允许同步 reader；readAsync 在同一任务入口等待异步 reader，并检查取消。检查目录按 checkIds 顺序执行，保留修正后的 value 与所有 issues；任意 failed 优先，其次 unavailable，全部通过才 passed。任务目录的 describe 投影 inputJsonSchema，不执行读取或模型。

目录校验不是读取授权。reader 从服务端 App 依赖取得可信资料；模型不能通过 taskId、sourceStatus 或 outputId 自行取得权限。`,
    examples: [
      sample(
        '为说明资料登记一个读取任务',
        '入门',
        `import { Answering } from '@jangts/agent-core/kits/answering';
import { Presentation } from '@jangts/agent-core/kits/presentation';
const readers = Answering.defineAnswerReaderCatalog([{ id: 'manual', read: (input: string) => ({ question: input, source: 'Agent Core 允许普通对象节点。' }) }]);
const checks = Answering.defineAnswerCheckCatalog<string, {}>([]);
const outputs = Presentation.defineOutputCatalog([{ id: 'reply', kind: 'text', fields: [{ id: 'text', owner: 'generated' }] }]);
const tasks = Answering.defineAnswerTaskCatalog([
  { id: 'explain', description: '根据说明资料解释接口', readerId: 'manual', outputId: 'reply', domainToolIds: ['explain'], checkIds: [], metadata: {},
    inputSchema: { jsonSchema: { type: 'string' }, parse(value: unknown) { if (typeof value !== 'string') throw new Error('需要问题'); return value; } } },
], { readers, checks, outputs });
console.log(tasks.read({ taskId: 'explain', input: '如何定义节点？' }, { app: {}, signal: new AbortController().signal }));`,
      ),
      sample(
        '相同任务增加检查引用并检查生成结果',
        '配置',
        `import { Answering } from '@jangts/agent-core/kits/answering';
import { Presentation } from '@jangts/agent-core/kits/presentation';
const readers = Answering.defineAnswerReaderCatalog([{ id: 'manual', read: (input: string) => ({ question: input, source: 'Agent Core 允许普通对象节点。' }) }]);
const checks = Answering.defineAnswerCheckCatalog<string, {}>([
  { id: 'nonempty', check: value => ({ status: value.trim() ? 'passed' : 'failed', value: value.trim(), issues: value.trim() ? [] : [{ code: 'EMPTY', message: '答案为空' }] }) },
]);
const outputs = Presentation.defineOutputCatalog([{ id: 'reply', kind: 'text', fields: [{ id: 'text', owner: 'generated' }] }]);
const tasks = Answering.defineAnswerTaskCatalog([
  { id: 'explain', description: '根据说明资料解释接口', readerId: 'manual', outputId: 'reply', domainToolIds: ['explain'], checkIds: ['nonempty'], metadata: {},
    inputSchema: { jsonSchema: { type: 'string' }, parse(value: unknown) { if (typeof value !== 'string') throw new Error('需要问题'); return value; } } },
], { readers, checks, outputs });
const context = { app: {}, signal: new AbortController().signal };
const evidence = await tasks.readAsync({ taskId: 'explain', input: '如何定义节点？' }, context);
console.log(evidence, checks.check({ checkIds: tasks.require('explain').checkIds, value: ' 普通对象即可。 ' }, context));`,
      ),
    ],
    policies: [
      {
        title: '任务引用与同步/异步读取',
        file: 'src/kits/answering/tasks.ts',
        symbols: ['defineAnswerReaderCatalog', 'defineAnswerTaskCatalog'],
      },
      {
        title: '检查结果汇总',
        file: 'src/kits/answering/checks.ts',
        symbols: ['defineAnswerCheckCatalog'],
      },
    ],
  },
  {
    // 演示逐项生成、检查、复核与局部修正；fallback 文案不能当作“已通过检查”。
    id: 'kit-answer-flow',
    title: 'Answering Flow：逐项生成、复核与局部修正',
    layer: 'kit',
    matches: ['Answering', 'defineAnswerFlow', 'validateAnswerBatch'],
    summary: '对已拆分的问题批次保留覆盖关系，修复失败项，不重新生成已经通过的项。',
    details: `run({inputIds,items},context) 返回 AnswerResult[]。每个 item 包含 id、inputIds、data 和 sourceStatus；它们都由 App 在资料读取后决定。validateAnswerBatch 要求每个原始 inputId 至少被一个 item 覆盖，拒绝未知输入、重复任务 ID 和超限。

流程使用 App 的 generate、同步 check、可选异步 review、同步 fallback 与 canInvoke。maxItems、maxRepairs 显式配置；reviewPolicy 默认 optional，另可 required 或 off。canInvoke 只检查调用条件，真正模型调用仍须走 App 已绑定的 Runner 预算。generate 返回以 item.id 为键的 Map；返回外来 ID 会拒绝。

局部失败项才修复；已知复核失败不会因后续复核不可用而放行。最终状态为 accepted、fallback 或 blocked，fallback 的文字不是“已通过检查”的证据。来源 unavailable/conflict 不进入正常生成。Kit 内部使用 Workflow，不建立新的 Core 运行合同。`,
    examples: [
      sample(
        '先处理一个有来源的说明问题',
        '入门',
        `import { Answering } from '@jangts/agent-core/kits/answering';
const flow = Answering.defineAnswerFlow<{ source: string }, string, {}>({
  maxItems: 4, maxRepairs: 0, reviewPolicy: 'off', canInvoke: () => true,
  async generate({ items }) { return new Map(items.map(item => [item.id, item.data.source])); },
  check: ({ value }) => ({ status: value.trim() ? 'passed' : 'failed', issues: [] }),
  fallback: () => ({ handled: false }),
});
const result = await flow.run({ inputIds: ['question-1'], items: [{ id: 'explain', inputIds: ['question-1'], sourceStatus: 'ready', data: { source: '普通对象可以实现节点合同。' } }] }, { app: {}, signal: new AbortController().signal });
console.log(result[0].status, result[0].value);`,
        '离线示例直接使用已读正文，展示流程合同；换成模型生成时仍用同一个 generate 端口。',
      ),
      sample(
        '保持 run 不变，增加复核和一次局部修正',
        '配置',
        `import { Answering } from '@jangts/agent-core/kits/answering';
const flow = Answering.defineAnswerFlow<{ source: string }, string, {}>({
  maxItems: 4, maxRepairs: 1, reviewPolicy: 'required', canInvoke: () => true,
  async generate({ items, repairs }) { return new Map(items.map(item => [item.id, repairs?.has(item.id) ? item.data.source : ''])); },
  check: ({ value }) => ({ status: value.trim() ? 'passed' : 'failed', issues: value.trim() ? [] : [{ code: 'EMPTY', message: '需要非空回答' }] }),
  async review({ items }) { return new Map(items.map(({ item, value }) => [item.id, { status: value === item.data.source ? 'passed' as const : 'failed' as const, issues: [] }])); },
  fallback: () => ({ handled: true, value: '当前资料不足，暂时无法回答。' }),
});
const result = await flow.run({ inputIds: ['question-1'], items: [{ id: 'explain', inputIds: ['question-1'], sourceStatus: 'ready', data: { source: '普通对象可以实现节点合同。' } }] }, { app: {}, signal: new AbortController().signal });
console.log(result[0].status, result[0].checks);`,
        '示例以空草稿触发一次真实局部修正；生产 review 应依据真实证据，不用字符串等号代替语义复核。',
      ),
      sample(
        '先验证多问题覆盖，防止遗漏输入',
        '扩展',
        `import { Answering } from '@jangts/agent-core/kits/answering';
const items = [
  { id: 'define', inputIds: ['q1'], sourceStatus: 'ready' as const, data: { source: '定义节点' } },
  { id: 'run', inputIds: ['q2'], sourceStatus: 'unavailable' as const, data: { source: '' } },
];
Answering.validateAnswerBatch(['q1', 'q2'], items, 4);
console.log('两个问题均有明确处理项，包括资料不可用的项。');`,
      ),
    ],
    policies: [
      {
        title: '生成、检查、复核、局部修正与交付',
        file: 'src/kits/answering/flow.ts',
        symbols: ['defineAnswerFlow'],
      },
      {
        title: '问题覆盖检查',
        file: 'src/kits/answering/batch.ts',
        symbols: ['validateAnswerBatch'],
      },
    ],
  },
  {
    // 演示模型只填写 generated/semantic 字段，固定文字与绑定值由程序提供。
    id: 'kit-presentation-output',
    title: 'Presentation：字段所有权与最终输出',
    layer: 'kit',
    matches: [
      'Presentation',
      'defineOutputCatalog',
      'defineReplyFormats',
      'replyFormatChecks',
      'mergeReplyBubbles',
    ],
    summary: '模型只填写被分配的字段；固定文字、绑定值和语义键由程序拥有。',
    details: `defineOutputCatalog 支持 text、master、record、group 四种输出。非 group 必须声明 fields；text 只能有一个必需字段，master 的模板槽位须与字段完全对应。字段 owner 为 generated、bound、constant 或 semantic。未提供 valueSchema 时使用字符串解析器。

toModelSchema 只给模型 generated/semantic 字段，semantic 只给允许的 key；check 返回检查状态与 issues，compose({outputId,input},context) 在检查之后同步绑定真实值并返回 {outputId,kind,value}。bound/semantic 需要登记 provider；provider 必须同步。group 的 items 由程序分配，引用必须登记且不能成环。

defineReplyFormats 只在 App 真的持有回复模板时声明格式；resolve 对其他回复返回 undefined，不额外要求输出格式或反问。replyFormatChecks 提供气泡数量与总字符预算检查，mergeReplyBubbles 折叠空气泡并把超出部分并入最后一条。限额、模板和文案仍由 App 拥有。

输出合同拒绝模型填入其他字段，不等于业务已经完成、已授权或已发给用户。最终输出、流传输和业务提交依然是不同边界。`,
    examples: [
      sample(
        '先组合一段生成文本',
        '入门',
        `import { Presentation } from '@jangts/agent-core/kits/presentation';
const outputs = Presentation.defineOutputCatalog([
  { id: 'reply', kind: 'text', fields: [{ id: 'text', owner: 'generated' }] },
]);
console.log(outputs.toModelSchema('reply'));
const output = outputs.compose({ outputId: 'reply', input: { generated: { text: '普通对象即可定义节点。' } } }, { app: {}, signal: new AbortController().signal });
console.log(output.value);`,
      ),
      sample(
        '相同 compose 让程序持有说明前缀',
        '配置',
        `import { Presentation } from '@jangts/agent-core/kits/presentation';
const outputs = Presentation.defineOutputCatalog([
  { id: 'reply', kind: 'master', master: '{{prefix}}{{text}}', fields: [
    { id: 'prefix', owner: 'constant', constantValue: '接口说明：' },
    { id: 'text', owner: 'generated' },
  ] },
]);
console.log(outputs.toModelSchema('reply')); // 只有 text 由模型填写
console.log(outputs.compose({ outputId: 'reply', input: { generated: { text: '普通对象即可定义节点。' } } }, { app: {}, signal: new AbortController().signal }).value);`,
      ),
      sample(
        '增加绑定字段和语义键，保持 compose 入口',
        '扩展',
        `import { Presentation } from '@jangts/agent-core/kits/presentation';
const outputs = Presentation.defineOutputCatalog<{ displayName: string }>([
  { id: 'reply', kind: 'record', fields: [
    { id: 'text', owner: 'generated' },
    { id: 'author', owner: 'bound', providerId: 'author' },
    { id: 'tone', owner: 'semantic', providerId: 'tone', semanticKeys: ['brief', 'detailed'] },
  ] },
], { providers: [
  { id: 'author', resolve: (_input, { app }) => app.displayName },
  { id: 'tone', resolve: ({ key }) => key === 'brief' ? '简洁说明' : '详细说明' },
] });
const result = outputs.compose({ outputId: 'reply', input: { generated: { text: '普通对象即可。', tone: 'brief' } } }, { app: { displayName: '示例助手' }, signal: new AbortController().signal });
console.log(result.value);`,
      ),
    ],
    policies: [
      {
        title: '字段所有权、模型 Schema 和组合',
        file: 'src/kits/presentation/outputs.ts',
        symbols: ['defineOutputCatalog'],
      },
      {
        title: '回复格式声明、共享检查与气泡归一',
        file: 'src/kits/presentation/formats.ts',
        symbols: ['defineReplyFormats', 'replyFormatChecks', 'mergeReplyBubbles'],
      },
    ],
  },
  {
    // 演示模板只替换一次、语义槽校验与变体选择；随机源与偏好顺序由 App 提供。
    id: 'kit-presentation-templates',
    title: '模板、语义槽与表达选择',
    layer: 'kit',
    matches: ['defineTextTemplate', 'defineSemanticSlots', 'selectVariant', 'resolvePreference'],
    summary: '程序拥有模板和偏好顺序，插入值只替换一次，变体随机源由 App 提供。',
    details: `defineTextTemplate(master).render(values) 只替换原模板中的 {{word}}，缺少字段抛错，插入值中的花括号不会再次求值。defineSemanticSlots 只检查带 namespace 的语义槽是否在允许 keys 和 maxOccurrences 内，不执行替换。

selectVariant 返回一个值或 undefined；有多个候选时尽量避开 previous，randomIndex(limit) 须返回有效整数。resolvePreference 按 priority 降序、order 降序选择，空数组返回 undefined。这些都是局部表达策略，不决定授权、事实优先级或业务路由。`,
    examples: [
      sample(
        '先用程序模板组合说明',
        '入门',
        `import { Presentation } from '@jangts/agent-core/kits/presentation';
const template = Presentation.defineTextTemplate('你好，{{name}}。{{body}}');
console.log(template.render({ name: '开发者', body: '普通对象也能实现接口。' }));`,
      ),
      sample(
        '相同模板加语义键校验与不重复变体',
        '配置',
        `import { Presentation } from '@jangts/agent-core/kits/presentation';
const slots = Presentation.defineSemanticSlots({ namespace: 'tone', keys: ['brief', 'detailed'], maxOccurrences: 1 });
console.log(slots.isValid('{{tone:brief}}'));
const greeting = Presentation.selectVariant(['你好', '欢迎'], { previous: '你好', randomIndex: () => 0 });
const tone = Presentation.resolvePreference([{ value: 'brief', priority: 1, order: 0 }, { value: 'detailed', priority: 2, order: 1 }]);
const template = Presentation.defineTextTemplate('{{greeting}}，{{body}}');
console.log(template.render({ greeting: greeting ?? '你好', body: tone === 'detailed' ? '下面逐步说明接口。' : '普通对象即可。' }));`,
      ),
    ],
    policies: [
      {
        title: '单次模板替换与语义槽',
        file: 'src/kits/presentation/templates.ts',
        symbols: ['defineTextTemplate', 'defineSemanticSlots'],
      },
      {
        title: '变体与偏好排序',
        file: 'src/kits/presentation/variants.ts',
        symbols: ['selectVariant', 'resolvePreference'],
      },
    ],
  },
  {
    // 演示文本/气泡事件的分片与背压；它们是展示合同，不证明业务已检查或已交付。
    id: 'kit-presentation-events',
    title: '答复事件：文本分片和气泡边界',
    layer: 'kit',
    matches: [
      'REPLY_BUBBLE_BOUNDARY',
      'replyBubbleTexts',
      'publishReplyEvents',
      'serializeOutputEvents',
      'textOutputEvents',
    ],
    summary: '把已经接受的答复变成可等待的文本/气泡事件，保留取消和交付背压。',
    details: `publishReplyEvents({text,delivery?},execution) 返回 AsyncIterable<AgentOutputEvent>。默认 chunkSize=240、intervalMs=0、bubblePauseMs=0、maxDurationMs=3000；时序总量按上限缩放，取消会停止继续输出。内部 REPLY_BUBBLE_BOUNDARY 只用于划分气泡，不应作为正文显示。

serializeOutputEvents 转为文本流、过滤 preview，并将 bubble 重新编码为内部边界。textOutputEvents 将普通字符串流包装为 text 事件。replyBubbleTexts 只取输入中确实为 string 的 text/bubbles。它们是答复展示合同，不是 Core 的执行事实监听，不证明内容已通过业务检查。`,
    examples: [
      sample(
        '先输出已经接受的答复',
        '入门',
        `import { Presentation } from '@jangts/agent-core/kits/presentation';
const context = { signal: new AbortController().signal };
for await (const event of Presentation.publishReplyEvents({ text: '这是已经接受的答复。' }, context)) console.log(event);`,
      ),
      sample(
        '相同事件入口增加分片与气泡',
        '配置',
        String.raw`import { Presentation } from '@jangts/agent-core/kits/presentation';
const text = Presentation.replyBubbleTexts({ text: '先说明定义。', bubbles: ['再解释输入输出。'] }).join(Presentation.REPLY_BUBBLE_BOUNDARY);
const events = Presentation.publishReplyEvents({ text, delivery: { chunkSize: 6, intervalMs: 10, bubblePauseMs: 30, maxDurationMs: 1000 } }, { signal: new AbortController().signal });
for await (const event of events) {
  if (event.type === 'text') process.stdout.write(event.text);
  else if (event.type === 'bubble') process.stdout.write('\n');
}`,
      ),
      sample(
        '在同一合同间转换已有文本流',
        '扩展',
        `import { Presentation } from '@jangts/agent-core/kits/presentation';
async function* chunks() { yield '已接受的'; yield '正文。'; }
const events = Presentation.textOutputEvents(chunks());
for await (const text of Presentation.serializeOutputEvents(events)) console.log(text);`,
      ),
    ],
    policies: [
      {
        title: '分片、气泡与总时长限制',
        file: 'src/kits/presentation/events.ts',
        symbols: ['publishReplyEvents', 'serializeOutputEvents', 'textOutputEvents'],
      },
    ],
  },
];

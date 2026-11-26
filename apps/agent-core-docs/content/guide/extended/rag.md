---
title: 搭建可检索的资料：从章节到 RAG
description: 判断资料该整篇读取、按章节读取还是切块检索，并用 TextSearch、VectorSearch、ModelCalls 与名次融合搭出可核验的检索链路。
---

# 搭建可检索的资料：从章节到 RAG

RAG 不是默认选项。资料能整篇读入时，整篇读取最准确；需要定位章节时，章节读取比向量召回更可靠；只有语料大到无法整篇装入、问题又集中在局部时，切块检索才值得付出索引和引用成本。

SDK 提供检索、排序、外部推理绑定和文档目录这些零件；语料、embedding 服务、索引存储、权限与更新策略仍由 App 负责。示例使用 TypeScript，去掉类型标注即为 JavaScript。

## 先决定资料怎么读

| 资料形态 | 推荐方式 | 入口 | 代价 |
| --- | --- | --- | --- |
| 单篇在数千字符内，问题跨段落 | 整篇读取 | `Knowledge` 的 `document` 选择 | 最低，正文完整 |
| 主题清晰，问题主要落在某一节 | 章节读取 | `Knowledge` 的 `self` / `subtree` | 低，需要稳定章节 ID |
| 语料很大，问题只涉及局部片段 | 切块 + 检索 | `TextSearch`、`VectorSearch` | 高，需要索引、更新与引用 |

判断顺序建议固定为：整篇 → 章节 → 切块。切块会丢失跨段上下文，也最容易让模型把候选当事实；只有在前面两种方式确实装不下时才进入检索。

## 资料契约

无论采用哪种方式，先为资料定义稳定的身份：

| 字段 | 用途 |
| --- | --- |
| `id` | 文档或块的身份，修改标题不改变它 |
| `revision` | 内容版本，建议使用内容哈希；引用和过期命中复核都依赖它 |
| `locale` | 语言区域，避免把不同语言资料混在同一答案里 |
| `source` | 可追溯的来源，不是模型生成的说明 |
| `scope` | 访问范围；过滤必须使用可信的 App 身份，不能使用模型自报值 |

`revision` 变化意味着旧引用失效。检索命中后应回源读取当前记录，核对 `revision`、可见性和删除状态，再交给模型；只相信索引里的旧副本会把已删除或已改版的内容带进回答。

## 用章节组织资料

资料可以整篇读取，也可以按章节读取。章节 ID 是稳定身份，不是标题；拆分或重命名章节时，同步迁移引用。

```ts
import { Knowledge } from '@jangts/agent-core/kits/knowledge';

const catalog = Knowledge.defineKnowledgeCatalog(
  [
    Knowledge.parseKnowledgeDocument({
      id: 'service-guide',
      revision: 'content-2026-11-01',
      locale: 'zh-CN',
      // source 为 App 读取并授权的受控文本。
      text: source,
    }),
  ],
  { maxChars: 12000 },
);

const snapshot = catalog.read({
  documentId: 'service-guide',
  selection: { mode: 'subtree', sectionIds: ['delivery'] },
});
```

`read` 返回带 `revision`、`selection` 和 `content` 的冻结快照。内容超过 `maxChars` 时直接报错，不会静默截断；需要更多内容时缩小选择或分次读取。

## 切块与向量

切块优先按章节，其次按段落；保留标题路径，避免模型拿到一段没有主题的孤立文本。块 ID 应能定位回原文，例如 `documentId#section#index`。

纯文本没有现成章节结构时，先用 `TextBlocks` 按标题、分隔线、空行和换行切成有界块，再交给分页读取或检索。分片保留原文偏移，按顺序拼回与原文逐字一致；单行超过目标长度时保留为一个块，由后续读取按片段切分，避免把同一行拆成互不相关的两段。

```ts
import { TextBlocks } from '@jangts/agent-core/kits/text-blocks';

// targetChars 只约束常规行；超长单行作为独立块返回。
const blocks = TextBlocks.split(source, { targetChars: 6000 });
```

```ts
import { ModelCalls } from '@jangts/agent-core/kits/inference';
import { VectorSearch } from '@jangts/agent-core/kits/vector-search';

type Chunk = {
  id: string;
  documentId: string;
  revision: string;
  scope: string;
  title: string;
  text: string;
};

const embeddings = new ModelCalls([
  {
    id: 'embed',
    identity: 'embedding-model@2026-01:1024',
    invoke: async (text: string, context: { signal: AbortSignal }) => {
      const response = await fetch('https://embedding.example/v1/embed', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: context.signal,
      });
      return ((await response.json()) as { vector: number[] }).vector;
    },
  },
] as const);

const index = new VectorSearch<Chunk>({
  identity: 'embedding-model@2026-01:1024',
  dimensions: 1024,
});

const controller = new AbortController();
// chunks 由 App 的切块流程产生，每块保留原文定位与 revision。
for (const chunk of chunks) {
  const { value } = await embeddings.invoke(
    { modelId: 'embed', input: chunk.text, timeoutMs: 5000 },
    { signal: controller.signal },
  );
  index.upsert({ document: chunk, vector: value });
}
```

`ModelCalls.identity` 与 `VectorSearch` 的 `space.identity` 必须描述同一个空间。更换 embedding 模型、维度或关键预处理时，旧向量不能继续混用，应重建索引。

`VectorSearch` 是有界语料的内存全量扫描，适合可控规模的块集合。块数很大时应换用 App 自己的向量存储，仍可复用下面的融合与复核逻辑。

## 混合检索与融合

关键词检索保留精确命中，向量检索补充同义表达；两路使用 `reciprocalRankFusion` 按名次融合，而不是相加原始分数。

```ts
import { TextSearch } from '@jangts/agent-core/kits/search';
import { reciprocalRankFusion } from '@jangts/agent-core/kits/rank-fusion';

const lexical = new TextSearch<Chunk>({
  indexRevision: 'chunks-v1',
  fields: ['title', 'text'],
  storedFields: ['documentId', 'revision', 'scope'],
});

const lexicalHits = lexical.search({
  query: question,
  limit: 20,
  filter: (chunk) => chunk.scope === viewer.scope,
});

const { value: queryVector } = await embeddings.invoke(
  { modelId: 'embed', input: question, timeoutMs: 5000 },
  { signal: controller.signal },
);
const vectorHits = index.search({
  vector: queryVector,
  limit: 20,
  minScore: 0.2,
  filter: (chunk) => chunk.scope === viewer.scope,
});

const fused = reciprocalRankFusion(
  [
    { sourceId: 'lexical', ids: lexicalHits.map((hit) => hit.id) },
    { sourceId: 'vector', ids: vectorHits.map((hit) => hit.id) },
  ],
  { limit: 8 },
);
```

`TextSearch` 的过滤器只能看到 `storedFields`，所以参与权限判断的字段必须登记在 `storedFields` 中。两路都应在融合前完成相同的权限过滤；融合本身不会重新检查可见性。

融合分数只表示排序名次，不是相似度、置信度或事实正确率。

## 回源复核与证据

命中只是候选。交给模型前，回源读取当前记录并核对版本：

```ts
const evidence = [];
// store、indexedRevision 与 visible 由 App 实现；这里只演示复核顺序。
for (const rank of fused) {
  const current = await store.get(rank.id);
  if (!current || current.revision !== indexedRevision.get(rank.id) || !visible(current, viewer))
    continue;
  evidence.push({
    sourceId: `chunk:${current.id}`,
    title: current.title,
    revision: current.revision,
    text: current.text,
  });
  if (evidence.length === 5) break;
}
```

检索结果应作为工具观察或证据进入上下文，而不是拼进 system 提示词。每条证据保留真实 `sourceId`、标题和 `revision`；回答中的引用必须指向实际来源，不能由模型补写。

上下文预算按实际字符数校验。超限时减少候选数量或分次读取，不要截断一条规则或一条证据。

## 更新与删除

- 内容变化：生成新 `revision`，只重新向量化受影响的块，并更新两个索引。
- 删除资料：同时清理正文、向量、快照、查询缓存和引用；只做软删除不够。
- 字段或分词变化：更新 `TextSearch.indexRevision`，重建索引；旧快照会因配置指纹不匹配而拒绝恢复。
- `snapshot()` / `restore()` 只验证配置一致，不提供持久化、到期或访问控制。

## 失败与降级

| 失败 | 建议行为 |
| --- | --- |
| embedding 服务不可用 | 退回关键词检索；两路都不可用时明确说明无法检索 |
| 向量索引未就绪 | 使用关键词检索或整篇读取，不阻塞回答 |
| 没有命中 | 说明没有找到资料，不根据常识补写事实 |
| 预算超限 | 减少候选或分次读取，不截断规则与证据 |
| 版本冲突或记录已删除 | 丢弃该命中，不回退到旧副本 |

降级路径也要保留真实来源；不要把“检索失败”包装成“没有这项资料”。

## 如何判断是否值得

先用真实问题建一个小样本集，标注期望命中的来源 ID，再比较整篇、章节与检索三种方式：

- 期望来源是否进入前 k 条；
- 没有资料时是否明确说不知道；
- 回答中的引用是否指向真实来源；
- 额外延迟与 embedding 成本是否可接受。

如果检索没有提高来源命中，或语料本来就能整篇读入，应停止向量化，把维护成本放回章节结构和词表。更完整的样本、指标与对比方法见[检索质量评估](./retrieval-evaluation.md)。

## 常见错误

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 答案跨块断裂 | 块太小或缺少标题路径 | 按章节或段落切块，保留上下文 |
| 同义提问召回不到 | 只做关键词或只做向量 | 两路检索并用名次融合 |
| 越权内容出现在候选里 | 过滤放在融合之后，或使用模型自报身份 | 融合前按可信身份过滤 |
| 更换模型后结果异常 | 向量空间混用 | 用 `space.identity` 校验并重建索引 |
| 引用对不上正文 | 直接把旧索引副本当事实 | 回源复核 `revision` 与可见性 |

## 下一步

- 需要章节、快照与发布的完整合同：[知识资料](/manual/knowledge)。
- 需要逐项查看检索、融合与外部推理绑定：[其余 Kit](/manual/api/kits)。
- 需要可运行的小例子：[全文索引](/recipes/kit-text-search)、[向量检索](/recipes/kit-vector-search)、[名次融合](/recipes/kit-rank-fusion)、[外部推理绑定](/recipes/kit-model-calls)。

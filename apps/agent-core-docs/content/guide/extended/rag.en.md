---
title: "Building a searchable corpus: from sections to RAG"
description: Decide between whole-document reads, section reads and chunk retrieval, then build a verifiable retrieval chain with TextSearch, VectorSearch, ModelCalls and rank fusion.
---

# Building a searchable corpus: from sections to RAG

RAG is not the default. When a document fits in context, reading it whole is the most accurate option. When questions target a known section, section reads are more reliable than vector recall. Chunk retrieval only earns its indexing and citation cost when the corpus is too large to load and questions concentrate on small parts of it.

The SDK supplies retrieval, ranking, external-inference binding and document catalogs. The corpus, embedding service, index storage, permissions and update policy remain the App's responsibility. Examples use TypeScript; remove the type annotations for JavaScript.

## Decide how the corpus is read

| Corpus shape | Recommended | Entry point | Cost |
| --- | --- | --- | --- |
| One document within a few thousand characters; questions span paragraphs | Whole-document read | `Knowledge` with the `document` selection | Lowest; text stays complete |
| Clear topics; questions land in one section | Section read | `Knowledge` with `self` / `subtree` | Low; stable section IDs required |
| Large corpus; questions concern small fragments | Chunking + retrieval | `TextSearch`, `VectorSearch` | Highest; indexing, updates and citations required |

Use a fixed order: whole document → sections → chunks. Chunking loses cross-paragraph context and makes it easiest for a model to treat a candidate as fact. Move to retrieval only when the earlier options genuinely do not fit.

## The corpus contract

Whatever the read strategy, define stable identity first:

| Field | Purpose |
| --- | --- |
| `id` | Document or chunk identity; renaming a title does not change it |
| `revision` | Content version, ideally a content hash; citations and stale-hit checks depend on it |
| `locale` | Keeps languages from being mixed in one answer |
| `source` | A traceable origin, not a model-written description |
| `scope` | Access scope; filtering must use trusted App identity, never a model-reported value |

A changed `revision` invalidates old citations. After a hit, read the authoritative record back and verify `revision`, visibility and deletion state before handing it to the model. Trusting the indexed copy can surface deleted or rewritten content.

## Organize documents with sections

A document can be read whole or by section. Section IDs are stable identity, not titles; when sections split or move, migrate references with them.

```ts
import { Knowledge } from '@jangts/agent-core/kits/knowledge';

const catalog = Knowledge.defineKnowledgeCatalog(
  [
    Knowledge.parseKnowledgeDocument({
      id: 'service-guide',
      revision: 'content-2026-11-01',
      locale: 'en-US',
      // source is controlled text that the App has read and authorized.
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

`read` returns a frozen snapshot with `revision`, `selection` and `content`. Content above `maxChars` raises an error instead of being silently truncated; narrow the selection or read in passes when more text is needed.

## Chunking and vectors

Chunk by section first, then by paragraph, and keep the heading path so a chunk never arrives without its topic. A chunk ID should map back to the source, for example `documentId#section#index`.

When plain text has no section structure, split it into bounded blocks with `TextBlocks` on headings, rules, blank lines and line breaks before paging or retrieval. Blocks keep source offsets and reassemble into the original text exactly; a single over-long line stays one block so later paging can fragment it without turning one line into unrelated sections.

```ts
import { TextBlocks } from '@jangts/agent-core/kits/text-blocks';

// targetChars bounds ordinary lines; an over-long line is returned as its own block.
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
// chunks come from the App's chunking pipeline; each keeps its source locator and revision.
for (const chunk of chunks) {
  const { value } = await embeddings.invoke(
    { modelId: 'embed', input: chunk.text, timeoutMs: 5000 },
    { signal: controller.signal },
  );
  index.upsert({ document: chunk, vector: value });
}
```

`ModelCalls.identity` and `VectorSearch.space.identity` must describe the same space. When the embedding model, dimensions or essential preprocessing change, old vectors cannot be mixed in; rebuild the index.

`VectorSearch` performs an exhaustive in-memory scan over a bounded corpus, which suits a controllable chunk set. For much larger sets, use the App's own vector store and keep the fusion and verification logic below.

## Hybrid retrieval and fusion

Lexical search preserves exact matches; vector search covers paraphrases. Fuse the two ranked lists with `reciprocalRankFusion` rather than adding raw scores.

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

A `TextSearch` filter only sees `storedFields`, so any field used for authorization must be stored. Both retrievers must apply the same permission filter before fusion; fusion never re-checks visibility.

A fused score expresses rank only. It is not similarity, confidence or factual correctness.

## Read back and cite

A hit is a candidate. Read the authoritative record before handing it to the model:

```ts
const evidence = [];
// store, indexedRevision and visible are App-owned; the loop only shows the check order.
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

Retrieval results belong in tool observations or evidence, not in the system prompt. Every item keeps its real `sourceId`, title and `revision`; citations in the answer must point at actual sources and cannot be invented by the model.

Validate budgets against real character counts. When over budget, return fewer candidates or read in passes; never slice a rule or a piece of evidence.

## Updates and deletion

- Content changes: produce a new `revision`, re-embed only the affected chunks, and update both indexes.
- Deleting a document: remove text, vectors, snapshots, query caches and citations; a soft-delete flag is not enough.
- Field or tokenizer changes: bump `TextSearch.indexRevision` and rebuild; old snapshots are rejected by configuration fingerprint.
- `snapshot()` / `restore()` only verify configuration consistency; they provide no persistence, expiry or access control.

## Failure and degradation

| Failure | Recommended behavior |
| --- | --- |
| Embedding service unavailable | Fall back to lexical search; when both fail, state that retrieval is unavailable |
| Vector index not ready | Use lexical search or a whole-document read; do not block the answer |
| No hits | Say the corpus has nothing; never fill the gap with general knowledge |
| Budget exceeded | Return fewer candidates or read in passes; do not truncate rules or evidence |
| Revision conflict or deleted record | Drop the hit; do not fall back to the stale copy |

A degraded path still keeps real sources. Do not turn "retrieval failed" into "there is no such material".

## Decide whether it is worth it

Build a small set of real questions with expected source IDs, then compare whole-document reads, section reads and retrieval:

- Does the expected source appear in the top k?
- Does the system say "unknown" when no material exists?
- Do citations point at real sources?
- Are the extra latency and embedding cost acceptable?

If retrieval does not improve source recall, or the corpus fits in a whole read, stop vectorizing and spend the effort on section structure and vocabulary instead. See [Evaluating retrieval quality](./retrieval-evaluation.md) for a fuller sample, metric and comparison method.

## Common mistakes

| Symptom | Cause | Fix |
| --- | --- | --- |
| Answers break across chunks | Chunks are too small or lose the heading path | Chunk by section or paragraph and keep context |
| Paraphrased questions miss | Only lexical or only vector retrieval | Run both and fuse by rank |
| Unauthorized content appears | Filtering happens after fusion, or uses a model-reported identity | Filter by trusted identity before fusion |
| Results change after a model upgrade | Vector spaces were mixed | Validate with `space.identity` and rebuild |
| Citations do not match the text | The stale indexed copy was treated as fact | Read back and verify `revision` and visibility |

## Next

- Full contract for sections, snapshots and publication: [Knowledge](/manual/knowledge).
- Per-interface detail on retrieval, fusion and external inference binding: [Other Kits](/manual/api/kits).
- Small runnable examples: [Text index](/recipes/kit-text-search), [vector search](/recipes/kit-vector-search), [rank fusion](/recipes/kit-rank-fusion), [external inference binding](/recipes/kit-model-calls).

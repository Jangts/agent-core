# Knowledge documents, sections, and versions

[Back to development handbook](README.md) · [Knowledge API](api/knowledge-answering.md#knowledge) · [Complete answering chain](api/knowledge-answering.md)

## How the library learns your knowledge structure

Core does not scan knowledge directories, infer a knowledge base from file names, or automatically generate sections from Markdown headings. The App explicitly executes the following chain:

```text
App reads controlled sources
  → provides id, revision, locale, and body/structure
  → Knowledge.parseKnowledgeDocument (only when text anchors are used)
  → Knowledge.defineKnowledgeCatalog
  → App checks the task's document/section references
  → catalog.read with the reads allowed for this round
  → passes the KnowledgeSnapshot as evidence to subsequent handlers
```

This structure is a local specification after adopting the Knowledge Kit, not a document format every Agent must store. The App can generate `KnowledgeDocument.parts` directly without Markdown parsing.

## Development-time preparation tools and runtime assembly functions

| Entry/asset | Purpose | What it does not do |
| --- | --- | --- |
| [Maintenance guide](maintenance.md) | Prepare knowledge in the project; organize faithfully when sources exist, keep empty when none | Knowledge must have real sources; ideas are not facts |
| `Knowledge.parseKnowledgeDocument({id, revision, text, locale?})` | Parse paired section anchors into a document tree | Does not read files, compute revision, or complete all catalog validation |
| `Knowledge.defineKnowledgeCatalog(documents, options?)` | Compile/freeze an in-memory document catalog, providing ids, sectionIds, assertSelection, read | Does not create databases, watch files, import uploads, or automatically learn or write back |
| [Section marker notes](#text-section-anchors) | Local code fragment explaining paired anchors and nesting rules | Not initial knowledge and not loaded automatically |
| [knowledge.mjs](../skills/agent-core-app/scripts/lib/knowledge.mjs) | App-side template shipped with the Skill for explicitly reading files, computing versions, and compiling catalogs | Not a built-in persistent initializer of the library |

Minimal document JSON structure:

```json
{
  "id": "service-guide",
  "revision": "content-version-1",
  "locale": "zh-CN",
  "parts": [
    "全局引言。",
    { "id": "delivery", "parts": [
      "本章节自身正文。",
      { "id": "delivery.timing", "parts": ["时机说明。"] }
    ] }
  ]
}
```

`parts` may mix raw text strings and subsections. Structured section IDs must be non-empty strings and **globally unique within the same document**, not merely unique among adjacent siblings. Document IDs are unique within the catalog; catalog compilation rejects duplicate sections and cycles. Do not run only the text parser and skip catalog compilation.

## Text section anchors

Sources use paired markers on their own lines, with no indentation:

```md
<!-- agent-section:delivery -->
本章节自身正文。
<!-- agent-section:delivery.timing -->
子章节正文。
<!-- /agent-section:delivery.timing -->
<!-- /agent-section:delivery -->
```

The characters accepted in IDs by the text adapter are English letters, digits, `_`, `.`, `:`, and `-`. Markers must keep spaces as in the example and occupy their own line; opening and closing IDs must match and nest correctly. Markdown `#` headings are merely body text. The parser recognizes anchors from raw text and is not a full Markdown interpreter; do not put example anchors on their own lines inside code fences in sources, or they will also be recognized as real sections.

Stable IDs represent content identity. Changing a title does not require changing the ID; when splitting/deleting sections, migrate task mappings and historical reference policies at the same time. Characters such as `.` are only part of the ID; parent-child relationships are determined by the actual nesting in `parts` and cannot be guessed from names.

## Three ways to read

| Request | Returned scope |
| --- | --- |
| `{documentId:'service-guide', selection:{mode:'document'}}` | The whole body text and all descendants, in source order |
| `{documentId:'service-guide', selection:{mode:'self', sectionIds:['delivery']}}` | The selected section's own string body, excluding subsections |
| `{documentId:'service-guide', selection:{mode:'subtree', sectionIds:['delivery']}}` | The selected section and all its descendants |

Sections explicitly selected are joined by two newlines in the order of the request array; duplicate IDs are rejected. If a parent section and its child are both selected into a subtree as two different IDs, the child text may still be included twice; the library does not automatically eliminate this ancestor overlap. The App should choose the appropriate minimal complete scope.

`maxChars` limits the selected, trimmed body text of this call; exceeding it throws rather than silently cutting off the latter half. Document size, storage capacity, and model context budget are different limits. Unknown fields, identity, and file paths coming from the client are not trustworthy just because catalog.assertSelection passes; cross-boundary input is still parsed and authorized by the App according to its own schema.

## Versions and snapshots

The App provides `revision`. It can be a hash of available content and related metadata, a database version number, or a release version; the library does not compute it for you. Secretly modifying the body text under the same id/revision invalidates version semantics.

`KnowledgeSnapshot` contains documentId, selection, revision, locale, content, and id. The id comes from the serialization of the above identity and selection and is **not a body-text hash, signature, persistence ID, or authorization credential**. Different section selections of the same document have different references, and selection order also affects identity. Generation and review should pass the same snapshot and must not re-read "the latest current body" to replace old evidence.

## Updates and knowledge growth

The current catalog has no register, upsert, delete, save, watch, or automatic retrieval interfaces over all storage. When change is needed, the App creates a new catalog and switches its own reference; see [Continuous accumulation](memory-and-learning.md) for the pattern. Before publication, re-validate task → document → sections, reader, checks, and output references.

Both static sources and approved growth knowledge can be converted to KnowledgeDocument. User-uploaded originals, unverified self-descriptions, and experience candidates should not be mixed directly into a public authoritative catalog; permissions, sources, and review status are controlled by the App's storage/loading adapters.

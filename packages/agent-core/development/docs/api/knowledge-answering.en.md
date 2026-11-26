# Knowledge, Answering, and Presentation

[Shared types](types.md) · [Back to home](README.md). The three Kits compose through ordinary inputs and outputs.

## Knowledge

```ts
defineKnowledgeCatalog(documents, options?): KnowledgeCatalog
parseKnowledgeDocument({ id, revision, locale?, text }): KnowledgeDocument
```

A document is still `{ id, revision, locale?, parts }`, and a section is still `{ id, parts }`. Catalog extends `ReadonlyCatalog<KnowledgeDocument>` and adds:

```ts
catalog.sectionIds(documentId): readonly string[]
catalog.assertSelection(request: KnowledgeRead): void
catalog.read(request: KnowledgeRead): KnowledgeSnapshot
interface KnowledgeRead {
  readonly documentId: string;
  readonly selection:
    | { readonly mode: 'document' }
    | { readonly mode: 'self' | 'subtree'; readonly sectionIds: readonly string[] };
}
interface KnowledgeSnapshot extends KnowledgeRead {
  readonly id: string;
  readonly revision: string;
  readonly locale?: string;
  readonly content: string;
}
```

Reads remain synchronous in-memory operations that do not read files, access the network, or decide material permissions. The snapshot id distinguishes document, revision, language, and selection range. Unknown documents／sections or duplicate selections are rejected; exceeding maxChars is rejected without truncating facts. The observation callback is at options.observe, and failures are isolated.

Read requests use KnowledgeRead. maxChars and observe are bound at catalog construction; structured documents, requests, and observers may be implemented by classes. Section snapshot IDs are opaque source identities.

Observation callbacks for knowledge, output composition, and answer flows receive only an independent structuredClone data snapshot and retain no prototypes or methods of business values. Observable payloads that cannot be copied skip notification; observation failures do not change business results and never leak internal object references as a fallback. Answer observation cannot modify already checked body text or source data.

## AnswerTaskCatalog

```ts
defineAnswerTaskCatalog(definitions, ports): AnswerTaskCatalog
interface AnswerTaskDefinition<Input, Metadata> {
  readonly id: string;
  readonly description: string;
  readonly inputSchema: SchemaAdapter<Input>;
  readonly domainToolIds: readonly string[];
  readonly scopeId?: string;
  readonly readerId: string;
  readonly outputId: string;
  readonly checkIds: readonly string[];
  readonly metadata: Metadata;
}
```

ports contains readers, outputs, checks, and optional assertDefinition. readers/outputs/checks all receive the registration set interface.

```ts
defineAnswerReaderCatalog(definitions): AnswerReaderCatalog
reader.read(input, context): MaybePromise<Evidence>
catalog.read({ taskId, input }, context): Evidence
catalog.readAsync({ taskId, input }, context): Promise<Evidence>
```

context extends OperationContext and includes the read-only task definition selected for this run. Synchronous read rejects thenables; readers with I/O use readAsync. The input schema is parsed first, and the reader is still responsible for real authorization and reading. Registration checks IDs and reader/output/check references and never implicitly selects another task.

## Check catalog

```ts
defineAnswerCheckCatalog(definitions): AnswerCheckCatalog
interface AnswerChecker<Value, App> {
  readonly id: string;
  check(value: Value, context: OperationContext<App>): CheckResult<Value>;
}
checks.check({ checkIds, value }, context): CheckResult<Value>
```

value comes first and context second. The catalog runs in checkIds order, preserves explicit corrected values, merges issues in execution order, and marks the check source; program errors are not wrapped as model factual errors. Synchronous checkers must not accidentally return a Promise.

## AnswerFlow

```ts
defineAnswerFlow<Data, Value, App>(definition): AnswerFlow<Data, Value, App>
flow.run({ inputIds, items }, context): Promise<readonly AnswerResult<Data, Value>[]>
```

definition contains reusable maxItems, maxRepairs, reviewPolicy, canInvoke, and named handlers. signal, diagnostics, and this run's App dependencies are passed through run's context; canInvoke(context) reads the real balance of these dependencies when a call is actually needed.

| handler | Input | Returns |
| --- | --- | --- |
| generate | `{ items, repairs?, previous? }` | `Promise<ReadonlyMap<itemId, Value>>` |
| check | `{ item, value }` | Synchronous `CheckResult<Value>` |
| review | `{ items: readonly { item, value }[] }` | `Promise<ReadonlyMap<itemId, CheckResult<Value>>>` |
| fallback | `{ item, issues }` | `{ handled: true; value: Value }` or `{ handled: false }` |

The handler's second argument is uniformly `OperationContext<App>`. The App may provide the same ModelRunner through context.app; the Kit does not create models or add model quota. Handlers are bound at definition time and compiled into a fixed Workflow; each run builds independent task state and repair quota, and the same flow can be reused concurrently. Handlers receive the current node's cancellation signal and diagnostics scope, and stage runs are recorded by the Core Loop.

```ts
interface AnswerItem<Data> {
  readonly id: string;
  readonly inputIds: readonly string[];
  readonly sourceStatus: 'ready' | 'unavailable' | 'conflict';
  readonly data: Data;
}
interface AnswerResult<Data, Value> {
  readonly item: AnswerItem<Data>;
  readonly value?: Value;
  readonly status: 'accepted' | 'fallback' | 'blocked';
  readonly issues: readonly Issue[];
  readonly checks: Readonly<{ local: CheckResult<Value>; review: CheckResult<Value> }>;
}
```

Generation／review use a Map to support partial correction and lookup by ID; final results use an array to preserve input delivery order. This is a difference in purpose, not arbitrary reshaping of a same-named collection field.

Standalone issues must be covered; unknown itemIds, duplicate ownership, and illegal references are rejected. reviewPolicy preserves the required/optional/off semantics: a confirmed factual error cannot be released just because later review is unavailable. Repairs apply only to failed items, and fallback must be produced from real evidence. Cancellation, model calls, and repair quota continue to share the upper-layer boundary.

## OutputCatalog

```ts
defineOutputCatalog(definitions, { providers?, observe? }): OutputCatalog
catalog.toModelSchema(outputId): JsonSchema
catalog.check({ outputId, value }): CheckResult<Readonly<Record<string, unknown>>>
catalog.compose({ outputId, input }, context): OutputResult // 同步provider；误返thenable拒绝
```

Catalog extends the shared has/get/require/ids/values. Definitions still have the four kinds text/master/record/group and do not make them outputs required across all of Core.

| Declared field | Contract |
| --- | --- |
| id | Output or field identity |
| owner | generated/bound/constant/semantic, indicating the value owner, not the handler's this |
| valueSchema | Optional SchemaAdapter; defaults to string; both model and program values go through the real parser |
| providerId | Provider reference for program binding or semantic resolution |
| constantValue | Program fixed value, snapshotted at registration |
| semanticKeys | Exposes only the optional keys, never private mapping values |
| allowedOutputIds | Output IDs allowed by a group |

A provider uses `resolve({ key? }, context)`; the first argument describes the selection and the second provides the execution context. toModelSchema projects only generated fields and semantic keys; the program is responsible for bound/constant and real links. check can retain valid fields for partial repair, but compose re-parses／re-checks input internally, and only a passed result can continue composing. A check result is not a permission credential, and partially usable values cannot complete an overall output.

OutputResult is `{ outputId, kind, value }`. Group children use program-assigned ids and outputId references; the model cannot register outputs, providers, or permissions on its own.

## Masters, semantic slots, and bubbles

| Factory／method | Shared contract |
| --- | --- |
| defineTextTemplate(master, options) | Pure compilation; render(values) substitutes once synchronously; errors.missingField creates an error |
| defineSemanticSlots(definition) | namespace, keys, maxOccurrences; isValid(text): boolean |
| defineReplyFormats({ formats, checks }) | Compiles template-bound reply formats; resolve(context) returns an inspected format only on a match and undefined otherwise |
| replyFormatChecks.bubbles(totalLimit) / textBudget(maxChars) | Shared bubble count, blank-bubble and text-length checks; the app declares the limits |
| mergeReplyBubbles(bubbles, limit) | Program normalization for replies without a template: drops blank bubbles and merges overflow into the last one |
| replyBubbleTexts(input) | Keeps the existing plain-text／bubble extraction responsibility and returns readonly string[]; count and length limits are enforced by the registered output contract |
| publishReplyEvents({ text, delivery }, context) | Returns `AsyncIterable<AgentOutputEvent>`, preserving backpressure and cancellation as consumers pull; pacing continues to use *Ms |
| serializeOutputEvents(events) / textOutputEvents(chunks) | Preserves explicit conversion between events and text streams and is not an invoke return mode |

Presentation handling is not responsible for fact verification or authorization. Generation requirements are called prompt/template; a program-held substitution structure is called master, and model body text must not be treated as an executable master.

Full exports, exact reloads, and declaration sources are in the [public symbol reference](reference.md). Signatures in the examples are for reading only; omitted fields do not imply arbitrary extra options.

### Content and check boundaries

AnswerTask.describe projects the executable inputSchema as inputJsonSchema, avoiding the case where a same-named field is sometimes an adapter and sometimes bare JSON. For a generated field in OutputCatalog, an ordinary valueSchema parse failure forms a repairable Issue; AbortError, TimeoutError, and program provider exceptions continue to propagate. Final values for kind=text/master must be strings; record/group preserve their own structure.

Knowledge document parts allow paragraph strings and named sections, and sections recursively contain parts; self reads only the section's direct paragraphs, while subtree includes subsections. document reads the whole document; sectionIds must be non-empty, deduplicated, and all existing; exceeding maxChars is rejected without truncating evidence. The same definition, revision, language, and selection produce a stable snapshot identity. Read operations only work on existing in-memory documents and provide no file or account authorization.

Presentation's publishReplyEvents uses `({ text, delivery? }, context)`, with delivery defaulting to chunkSize=240, intervalMs=0, bubblePauseMs=0, maxDurationMs=3000. It slices by Unicode characters; intentional pacing is constrained by maxDurationMs, and consumer pulling still provides backpressure. serializeOutputEvents converts for consumers that explicitly need a text stream protocol; it is not another output mode of invoke.

Check results must include an issues array; it is empty when passed and contains at least one item when failed. The check catalog, local checks, and review use the same contract, with path as a string／number array. Explicitly returning value: undefined is still a sanitizer update and must not be confused with a missing value.

signal／diagnostics are passed through the execution context. See [Basic example](../examples/offline-agent.md) for complete offline App integration of models and tools; configure the local contracts of Knowledge／Answering according to this page.

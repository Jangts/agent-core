# Memory and continuous accumulation

[Back to development handbook](README.md) · [Shared flow](flows/knowledge-maintenance.md) · [Record templates](records.md)

The library has no out-of-the-box long-term memory database, user profile merging service, or automatic learner of business experience. Core provides execution contracts, Support helps assemble context and calls, and Kits such as Knowledge/Answering provide local processing once adopted. Whether to record, how to assign ownership, and when to update and delete are all explicitly implemented by the App; not recording is also a valid choice.

## Different data needs different rules

| Data | Recommended use | Should not be equated with |
| --- | --- | --- |
| Recent Q&A | Session continuity, disambiguation | Tool execution logs, permanent knowledge |
| Accumulated user preferences | Addressing, expression preferences, ongoing topics | Identity, permissions, public facts |
| Business experience candidates | Inducing reusable suggestions and failure patterns from results | Proven rules, automatic authorization |
| Published knowledge | Business facts with explicit sources, scope, and versions | Unverified user self-descriptions |
| Original materials and extraction results | Current task evidence or authorized archives | Automatically shared knowledge |

Do not use one source-less large summary to hold all categories. Each record category should at least have stable identity, ownership, source, version, status, and retention policy. Template fields are only a starting point; the App defines and validates them, and they are not a new Core protocol that all consumers must follow.

## Application flow for updating user preferences

```text
Select final Q&A allowed to be recorded, and the watermark
  → Old summary + new Q&A + explicit merge rules
  → Model extraction of candidates under budget constraints
  → Parsing and length/source/sensitive-scope checks
  → Commit summary and new watermark on the premise of the old version
  → Subsequent requests read by identity and mark it as low-trust memory
```

Do not mix the model's internal reasoning, corrections, or unexecuted actions into user profiles. When new expressions conflict with old preferences, apply the App's explicit rules; authoritative human facts are still provided by the corresponding data source. On model failure or version conflict, keep the old summary and the unconsumed watermark and retry with bounds, avoiding lost messages or duplicate merges. Scheduled tasks, storage transactions/CAS, leases, and retries are implemented by the App; the Core per-request budget cannot be assumed to cover background jobs.

## Application flow for experience growth

Register extraction, validation, query, and publication implementations with a fixed task type; adding an experience record is only a data change and does not automatically add a handler. Candidates should be associated with actual sources and results, retain applicability scope, counterexamples, and conflicts, and not treat one success as a universal rule.

Candidate formation → deduplication/conflict checks → business validation or human confirmation → versioned publication → controlled reading, consistent with the [shared flow](flows/knowledge-maintenance.md). To integrate with Knowledge, the App converts permitted records into `KnowledgeDocument`, compiles a new catalog, and switches the request reference; active requests keep using the old snapshot.

`prepare-source.mjs` is used to organize text candidates during development. Runtime persistent learning can reuse its compilation logic and source constraints, while storage, concurrency, and publication policies are provided by the App.

## Decisions required before runtime integration

Record scope and user choices, tenant isolation, visibility scope, retention and deletion, source priority, update conflicts, idempotency keys/consumption watermarks, failure recovery, and which content is forever candidate-only. Without these implementations, documentation and interfaces should state clearly "used for this round/session" or "manually maintained", and must not claim automatic learning.

## Optional personal Memory Kit

Import `@jangts/agent-core/kits/memory`. This is a pure snapshot library, not a memory database, identity provider, scheduler or automatic business learner. `preference` is the reserved summary kind; `goal` requires an expiry. Other registered kinds receive generic entry handling, not automatic preference projection. Apps own admission, privacy and scope policy.

| API | Contract |
| --- | --- |
| `memoryUpdateSchema(kinds, scopes?)` | One JSON schema/parser pair; at most16 operations |
| `applyMemoryUpdate(previous, operations, sources, now, legacy?, legacyValidUntil?)` | Copy-on-write evidence association, versioned replacement/retraction, expiry and capacity; never persists |
| `batchMemorySources(sources, target, maxBatches?, maxChars?)` | Whole timestamp groups and safe watermark; never cuts user text |
| `memoryModelView(state, sources, maxChars?)` | Bounded model view with actual scopeId; omission never means deletion |
| `memoryContext(state, query, now, scope?)` | At most300 codepoints of preferences,3 related entries and a separate unverified legacy block |
| `reviewMemorySources / memoryReviewBatch / completeMemoryReview` | Availability, rotating source selection and actual review completion |
| `isMemoryState(value)` | Stored snapshot validation; App handles corrupt auxiliary memory without failing chat |

Complete minimal wiring (`load`, `extract`, `commit` are App ports, not SDK storage APIs):

```ts
import { memoryUpdateSchema, applyMemoryUpdate, memoryModelView, memoryContext } from '@jangts/agent-core/kits/memory';
import type { MemoryState, MemorySource } from '@jangts/agent-core/kits/memory';
const schema = memoryUpdateSchema(['preference', 'goal']);
async function update(
  load: () => Promise<MemoryState | undefined>,
  extract: (input: unknown) => Promise<unknown>,
  commit: (expected: number, state: MemoryState) => Promise<void>,
  sources: MemorySource[],
) {
  const old = await load(); // App authorizes account, visibility, final status and retention first.
  const proposal = schema.parse(await extract({ memory: memoryModelView(old, sources), sources }));
  const now = Date.now();
  const next = applyMemoryUpdate(old, proposal.operations, sources, now);
  await commit(old?.revision ?? 0, next); // App atomically publishes snapshot and watermark with CAS/lease.
  return memoryContext(next, 'current question', now, 'current-session-id');
}
```

Use ModelRunner for real model calls with separate background call/input/output/timeout/cancellation budgets. Parse unknown outputs before applying them. A registered kind is not authorization. Exact user quotes are transient and discarded: matching establishes occurrence, not semantic entailment, personal attribution or real-world truth. Apps must exclude sensitive/third-party/role-play material and evaluate model behavior with negative examples.

There are at most64 active entries; older overflow becomes needs-review, outside automatic context, and a new explicit statement may reactivate it. Total history is128 versions. A retirement floor prevents older sources recreating discarded entries. A single timestamp group larger than the batch budget fails; Apps must diagnose it without skipping its watermark.

Apps can supply a durable `MemorySource.orderKey` for sources with the same millisecond timestamp. Keys sort lexically from older to newer. The Kit retains the key in the evidence reference for later batches. Older snapshots remain readable. If both sources are in the current batch, the Kit can use App-provided source order. When the order is otherwise unknown, the existing entry stays in place. Goals that have already expired at catch-up time are kept as historical versions.

Legacy summaries remain explicitly unverified. Apps can set a fixed migration expiry, never extending it on subsequent updates. An evidenced operation may remove an exact legacyQuote span, without introducing replacement text. Oversized old summaries use the explicit legacySummary compression channel rather than silent truncation or fabricated evidence. Current statements and evidence-linked entries outrank legacy text.

Design references: [Anthropic agent memory](https://www.anthropic.com/research/components-of-agent-memory), [Dreaming cookbook](https://platform.claude.com/cookbook/managed-agents-cma-dreaming-with-a-dynamic-workflow). Hierarchy and maintenance do not guarantee improvement: evaluate accuracy, stale-memory effects, recall and cost independently.

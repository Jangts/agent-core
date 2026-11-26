# Two organizations for the same task

[中文](organization-comparison.md) · [References](../examples.en.md) · [Runnable source](organization-comparison.mjs)

The task is “explain demo service status and save the answer.” Both organizations share facts (online, 12ms, monitor:7, revision 7), tools, scripted Provider, handlers and delivery contract. Run the installed file with Node 22.12+; credentials, MockGPT, network and application databases are unnecessary:

```sh
node node_modules/@jangts/agent-core/development/docs/examples/organization-comparison.mjs
```

In a checkout with a resolvable Core build:

```sh
node development/docs/examples/organization-comparison.mjs
node --test test/reference-organizations.test.mjs
```

## Choosing boundaries

| Concern | Use-case nodes | Constrained investigation loop |
| --- | --- | --- |
| Organization | After target understanding, a complete explain-status use case owns reads, evidence gaps, synthesis and answer commit; saving, optional checking and presentation repair retain separate boundaries | One Core node selects work from current evidence and unresolved questions, reporting the actual action |
| Reason | Separate outputs, receipts and optional work can be observed and taken over independently when the host needs separate routing | A small investigation can share one lifecycle when independent routing is unnecessary |
| Advancement | Routes advance known dependencies without extra model decisions | Online needs no extra read; degraded reads incident; changing reads deployment. A Core self-route schedules execution, with no second scheduler |
| Handoff | Node updates commit `service → evidence → answer → receipt` | The same fields are committed per visit with evidence-attempt and save-verification flags; gaps select actions rather than a phase index |
| Recovery | The host restores validated facts, outputs and receipts | The host preserves evidence and attempt records, continuing unresolved gaps without repeating uncertain writes |

Evidence changes the executed path rather than advancing a fixed phase array: online proceeds to explanation, while abnormal states read their relevant source. A read yielding no new evidence records the gap and stops investigation, retaining known status rather than retrying without progress. The loop has a finite action set and is not an open research Agent. The model interprets the unknown service target; code advances known reads, writes and checks. An open investigation needs App-owned authorized actions, evidence gaps, progress and stop conditions. Both organizations are reasonable; node counts are not quality scores. Optional checking can stay inside a delivery handler when it needs no independent route. A loop action can become a node when it needs independent recovery.

## Judgment, state and effects

The first model call interprets the service request; the second explains sourced facts. A scripted Provider cannot prove language understanding. Production Apps must validate target and authorization; this fixture only accepts demo. Projection, arithmetic, dependencies, permission and write reconciliation belong to code. A fixed input can reasonably omit initial interpretation rather than making a call merely to meet a count.

Evidence reuse requires the same authorized scope, target and source revision. `cached` is a fixture whose host already validated those conditions, not a general cache policy. Save and receipt calls both carry the same scope and request key, checked against host authorization on every actual invocation. Denied or failed receipt reads preserve the answer and pending outcome. Saving uses a stable request key; a real host derives it from request identity and binds authorization. The in-memory receipt map simulates authoritative storage and is not persistence. Confirmed receipts skip saving. A connection lost after writing triggers a receipt read; unresolved outcomes retain the answer and ask for reconciliation without retrying the write.

Only returned node updates are committed. Cancellation rejects the run rather than reporting success, while previously committed answers and receipts remain in App state. Core checkpoints do not persist external effects or roll back writes. Cross-process recovery, durable receipts and delivery connection failures remain host responsibilities and are unverified here.

## Resources and faults

The initial model allocation is 1 and the authorized ceiling is 2. Once valid evidence is available, explaining it is necessary work: public `Support.assessModelBudget` first assesses the remaining explanation call, then its expand recommendation is applied through `adjustCallBudget` to raise the allocation to 2 without resetting consumption. With a hard ceiling of 1, sourced deterministic facts remain deliverable with an explicit narrative limitation. Initial underestimation alone does not trigger partial delivery.

Long records lose only known redundant `noise`; service, status, numbers, source and revision survive. Original evidence remains in state for rereading. This is field projection, not semantic compression or model summarization; no summarizer runs in this example. It cannot replace missing facts: read failures stop at the actual gap. Generation failures retain factual delivery. Optional check failures add a warning without erasing the answer or receipt. Final presentation repair receives only the existing answer and no tool or model context. Repair failure retains the original answer without reopening writes. Cancellation is enforced at call boundaries; read, generation, save and receipt exception paths check cancellation before producing any partial outcome.

The script prints actual visits, model call counts, tool order, effect counts, budget revisions and character sizes. Regression additionally covers missing prerequisites, same-scope reuse, confirmed writes, reconcilable/unresolved writes, model failure, hard ceilings and cancellation. Characters are not tokens, billing or demonstrated performance savings. Evidence is limited to static structure and offline behavior; real-model semantics, real storage, production recovery and performance remain unverified.

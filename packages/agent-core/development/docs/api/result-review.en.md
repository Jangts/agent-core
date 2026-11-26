# Multi-agent result review and decisions

Result review is optional App-side composition. Core retains invocation, parent/child budget and cancellation guarantees. The App owns common scope, authoritative evidence, decision authority, real authorization and atomic storage. Agreement does not establish truth; a confirmed finding establishes an inconsistency under its stated conditions.

## Start with inspection

Import `defineResultReview` and `checkReviewAdmission` from `@jangts/agent-core/kits/result-review`. Declare typed detectors with `id`, synchronous `candidates(request)` and `run(candidate, request, context)`. Bind the request to a host-owned scope containing `id`, `contentRevision` and `policyRevision`; each input contains its identity, source, scope, versions, evidence references and exact business `value`.

Inspection needs no persistence, waiting gate or persistent ledger and does not implicitly call a model. Registered methods preserve their receiver. Semantic handlers use the current host-injected Runner or controlled child and its shared budget. Deterministic handlers add no model calls.

Candidates may reference only declared inputs. Findings may reference only their candidate and evidence already associated with those inputs. A resolvable reference does not establish factual correctness. Host-defined scope cannot be narrowed by model-generated names, conditions or versions. Register input-version differences deterministically before aligning semantic conditions.

## Findings, coverage and bounded review

`findings` and per-detector `coverage` are independent. A confirmed disagreement can coexist with unchecked candidates. Coverage records `complete / partial / not-run / failed`, inspected/skipped candidate identities and a stop reason. `maxCandidates` defaults to 64; zero reports skipped coverage. Detector failures do not become agreement. Malformed results reject; cancellation and timeouts propagate.

A trusted detector definition may override model blocking flags with `blocking: true` or a synchronous predicate. Inspection completeness is not truth or permission. Optional `strategies` use `when/run` for targeted review. `review.resolve(request, result, context, { maxRounds })` defaults to two rounds per finding; missing or repeated progress markers end review. Outcomes are `resolved / unresolved / needs-answer`, without forced consensus. The App also limits evidence reads, total model calls and time.

`checkReviewAdmission` checks scope, content/policy revisions, required coverage and blocking findings. All blocking findings are unresolved by default; only host-accepted `resolvedFindingIds` may remove them. This pure preflight is not an authorization token. Actual commits must atomically recheck current versions, policy, coverage and permissions.

## Waiting and continuation

Import `defineReviewDecision` from `@jangts/agent-core/kits/review-decision`. Bind a parent task, dispute content revision, source versions, policy revision, waiting identity, stable action ID and original deadline. Supply an existing WaitGate and host `authorize/read/accept` ports.

- `open` idempotently opens a wait bounded by the original deadline.
- `respond` receives an answer without accepting it or triggering effects.
- `read` only reads existing facts; it neither resumes tasks nor allocates budget. Accepted receipts must match the waiting submission.
- `continue` explicitly accepts a resolved answer under current authorization. First acceptance checks the original deadline; repeated continuation can retrieve its persisted receipt.

The host must atomically compare the complete binding, current sources/policy, submission ID and action identity while saving an idempotent receipt. Separate Kits do not form a storage transaction. Read back or reconcile an uncertain save instead of blindly repeating effects. Cancellation does not undo external writes.

Waiting has one slot per gate definition ID and taskId; parallel disputes need distinct slots associated with their parent. waitId identifies a generation. Content revisions and storage CAS revisions are separate. A resolved wait means an answer was received, not that the disagreement was settled or execution authorized.

## Selecting an existing result

`@jangts/agent-core/kits/review-choice` exposes `inspectReviewChoices`, `isReviewChoice`, `isReviewChoiceAnswer` and `bindReviewChoiceDecision`. Inputs are one or two existing bounded summaries with host-validated `complete` coverage; use general ResultReview for larger sets. `compare` returns strict JSON `{ conflict, reason }`. A disagreement with complete inspection can wait for a choice. Missing evidence, failed inspection or incomplete coverage remain `incomplete` and cannot be bypassed by a human selection.

Answers refer only to an existing inputId and a reason. The recipe centralizes answer validation, wait association and acceptance checks. The App still computes content hashes, binds identity and source versions and supplies real locks/CAS. All recipe operations must share the host record's exclusive scope; no cross-process lock is installed.

Choosing an existing summary adds no model calls or new allowance. A genuinely new model stage after waiting must atomically obtain a bounded allocation from the parent's persistent ledger without extending its original deadline or resetting consumption. A new taskId does not create new parent credit. Inspection-only use still needs no persistent ledger.

The shipped `development/examples/collaboration-probe.mjs` demonstrates process reconstruction, response loss and an ordinary-handler versus recommended-adapter comparison under the same host guarantees. It does not establish power-loss durability or external exactly-once semantics. See the [public symbol reference](reference.en.md) for exact declarations.

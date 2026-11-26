# Persistent waiting and continuation

[中文](harness-durable.md) · [Source](harness-durable.mjs)

This bounded R2 composition completes an artifact task, opens a persisted confirmation gate and returns normally while waiting. A fresh process reconstructs storage, current authorization and the gate; only a consumed confirmation allows the separate save task. It restores neither a call stack nor a Core pause protocol.

From `main/`, with Node 22.12 or newer and current package artifacts:

```sh
node development/examples/harness-durable.mjs
node --test test/waiting.test.mjs
```

The example does not build, use the network, call a model or access a private database. It creates temporary file storage under the main repository's `.tmp/`, starts four fresh Node processes and deletes its fixture afterward. Importing the module starts nothing; call `runDurableExample()` explicitly. If artifacts are stale, stop and request the coordinated build.

## Observable execution

1. The first process completes the prepare Durable task, persists the draft and its completed checkpoint, then opens a pending gate. The App returns `{ status: 'waiting' }`; the final save has not happened.
2. The second process reconstructs live identity and authorization and responds twice with the same submission. The second response returns the original record. The App reads the completed prepare result and resolved confirmation before running the save Durable task. After the save port persists its write, a synthetic lost response makes the App return unknown; the save checkpoint remains running with attemptCount 1.
3. The third process reconstructs current authorization and ports, actually enters the save reconciliation callback and reads the persisted receipt. Its completed state persists confirmationCount 1, with no new execution attempt or repeated save.
4. The fourth process moves the completed tasks' execution deadlines into the past and runs the same App entry. Authorized completed-state reads return the same result without producing or saving again.

Output includes four process IDs, waiting and final results, `artifactWrites: 1`, `savedWrites: 1` and `confirmationCount: 1`. Both task attempt counts must equal 1. Waiting does not throw and consumes no failed Durable attempt.

## Wait Gate contract

Import `defineWaitGate` from `@jangts/agent-core/kits/waiting`. The App supplies `exclusive/load/save`, a synchronous pure `isAnswer` predicate and current `authorize` policy. Core does not interpret local pending/resolved/cancelled states.

- Identity is `{ taskId, waitId, subject }`; the App must supply a fresh, never-reused waitId for each generation. Gate definition ID and taskId identify the storage slot, with revision bound in the record. The gate stores only the current slot, not a deduplication history of every past waitId. Identity text grants no permissions.
- `open({ identity, expiresAtMs })` creates a wait; identical identity and expiry return its existing record. A different generation can replace only a terminal slot for the same subject, explicitly comparing `previousWaitId`. Pending waits cannot be replaced. Do not reuse a task ID for unrelated work.
- `read(identity)` only queries; `cancel(identity)` turns pending into cancelled. Both reauthorize. Expiry does not prohibit authorized reads or cancellation.
- `respond({ identity, submissionId, answer })` checks identity and expiry under the exclusive lock and persists the answer once. Once resolved, the same submission ID and JSON answer return the first record; object-key order is irrelevant. Other replies conflict. Reading a consumed reply after expiry never executes work again.
- Old wait IDs, different subjects, incompatible definition revisions and new expired replies reject. Cancelled waits reject replies. Every operation, including duplicate replies, rechecks current grants. Authorization rejects by throwing, never by returning false.
- Answers contain only finite numbers, strings, booleans, null, plain objects and dense arrays. Getters, symbols, hidden fields, class instances, cycles and undefined reject. Returned and stored values are detached copies.

The gate grants no permission to save. The App must authorize actual execution again; the example save task rereads the gate in its authorization callback. Current grants, credentials, connections and signals are reconstructed rather than restored from a snapshot.

## Storage and evidence boundaries

All writers must use the same exclusive mechanism. Successful save means the record is durable. A save already started during cancellation settles before releasing the lock; the caller may still receive cancellation and must reread confirmation.

The example uses exclusive directories, synced files, atomic rename and directory sync, failing on contention. It offers no distributed locks, stale-lock recovery, encryption or production retention policy. A real host owns recovery after a killed process; the example never steals a lock.

The save step declares reconciliation and checks its external receipt for completed/not-executed results. A real port unable to confirm must return unknown. This example proves fresh-process composition, normal waiting, duplicate confirmation, actual receipt reconciliation after a lost save response, and terminal queries. Response loss is a synthetic local error after persistence, not a power failure, SIGKILL, disk corruption or cross-machine fault; external exactly-once is not promised. Targeted gate tests separately exercise conflicts, expiry, identity, revoked grants, concurrent duplicate consumption and serialization boundaries.

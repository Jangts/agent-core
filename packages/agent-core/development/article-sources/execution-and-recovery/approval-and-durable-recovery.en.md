# Wait for approval and recover operations across processes

A proposed refund needs administrative approval. The administrator may reply hours later, after the original request and process have ended. Once the refund is submitted, the payment service could succeed while its response is lost. Persist the response, execution authorization, and operation confirmation as distinct facts.

## Give the wait and its reply stable identities

Use Waiting to define allowed answers, authority, and deadline. A gate definition and taskId identify a slot. The waitId identifies one generation. Reopening the same wait keeps its original deadline. Check waitId and authorization on submission and store the answer. A reconstructed process can read that record. A later execution entry point explicitly continues under current authority. A resolved wait establishes that an answer was received.

## Select recovery behavior for the operation

Durable records the definition revision, task progress, deadline, and spent attempts. Replay-safe analysis can use `safe`. Use `reconcile` for a step that may have written externally, and query the actual business receipt using the stable operationId. Reconciliation has zero model allowance. Save confirmed state for `completed`. On `not-executed`, check the original execution deadline and capacity plus current authorization before starting work. Preserve uncertainty on `unknown`.

The operationId survives recovery of the same logical effect. Each Durable save gets a new commitId for that specific submission. If a save acknowledgement is lost, read back the matching commitId under the host's exclusive scope. Across processes the application supplies real concurrency control, atomic storage, and business idempotency. Cancellation and timeout cannot establish that a remote refund was rolled back.

Run `node node_modules/@jangts/agent-core/development/examples/harness-durable.mjs` to observe wait reconstruction across processes, a lost save acknowledgement, and read-back. Exercise concurrent writes, expiry, and permission changes using your real store. [Persistent waiting example](../../examples/harness-durable.en.md) · [Resilience review Skill](../../skills/agent-core-resilience-review/SKILL.md)

[Technical articles](../README.en.md)

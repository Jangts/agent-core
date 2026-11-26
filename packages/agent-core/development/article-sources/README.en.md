# Technical articles

Use these articles to design an Agent Core task, maintain its input and state, and verify how it behaves when it succeeds or fails. Each article connects one design decision to an SDK contract and a runnable case.

## Workflow design

- [Where workflow nodes and tools belong](workflow-design/nodes-and-tools.en.md) · Choose a use-case, exploration, or matrix structure for a service explanation.
- [Prepare a model decision from one capability catalog](workflow-design/one-phase-one-declaration.en.md) · Derive the current selection and check authorization at execution.
- [Compose subtasks under a shared budget](workflow-design/compose-bounded-subtasks.en.md) · Choose handlers or child agents and resolve failures and state conflicts.
- [Save branch versions and promote them explicitly](workflow-design/version-and-promote-agent-state.en.md) · Distinguish runtime snapshots, candidates, and the active version.

## Context and replies

- [Build prompts and context by task stage](context-and-replies/prompts-and-context.en.md) · Give instructions, user input, history, and tool results distinct roles.
- [Manage context length and delivery scope](context-and-replies/compression-or-partial.en.md) · Choose projection, targeted reads, summarization, or partial delivery.
- [Maintain evidence-linked personal memory](context-and-replies/personal-memory-snapshots.en.md) · Handle updates, same-timestamp ordering, retraction, and expiry.
- [Organize facts, formats, and references in replies](context-and-replies/reply-organization.en.md) · Connect verified business facts and wording to the right calls.

## Execution and recovery

- [Adjust call budgets around remaining work](execution-and-recovery/reasonable-dynamic-budgets.en.md) · Use observed progress to assess allowance and preserve the call ledger.
- [Deliver confirmed results after a request failure](execution-and-recovery/reliable-request-recovery.en.md) · Separate step repair, request recovery, and deterministic fallback.
- [Route completion failures to targeted repair](execution-and-recovery/targeted-completion-repair.en.md) · Send content, format, and evidence failures to their owners.
- [Reuse evidence and reconcile operation receipts](execution-and-recovery/evidence-and-operation-receipts.en.md) · Track evidence reads, business effects, and message delivery.
- [Wait for approval and recover operations across processes](execution-and-recovery/approval-and-durable-recovery.en.md) · Persist approval facts and reconcile writes that may have happened.
- [Review disagreements and accept an existing result](execution-and-recovery/review-and-accept-results.en.md) · Track findings, coverage, human responses, and final acceptance.

## Integration and verification

- [Choose a model protocol and call lifecycle](integration-and-verification/choose-model-lifecycles.en.md) · Choose among direct responses, background jobs, batches, and realtime sessions.
- [Find the first wrong decision in a run trace](integration-and-verification/observe-real-execution.en.md) · Trace failures through routes, invocations, and receipts.
- [Test how a task ends under faults](integration-and-verification/test-completion-under-faults.en.md) · Build offline fault cases around behavioral invariants.

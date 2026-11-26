# Technical articles

Use these articles to design an Agent Core task, maintain its input and state, and verify how it behaves when it succeeds or fails. Each article connects one design decision to an SDK contract and a runnable case.

## Workflow design

- [Where workflow nodes and tools belong](nodes-and-tools.en.md) · Choose a use-case, exploration, or matrix structure for a service explanation.
- [Prepare a model decision from one capability catalog](one-phase-one-declaration.en.md) · Derive the current selection and check authorization at execution.
- [Compose subtasks under a shared budget](compose-bounded-subtasks.en.md) · Choose handlers or child agents and resolve failures and state conflicts.
- [Save branch versions and promote them explicitly](version-and-promote-agent-state.en.md) · Distinguish runtime snapshots, candidates, and the active version.

## Context and replies

- [Build prompts and context by task stage](prompts-and-context.en.md) · Give instructions, user input, history, and tool results distinct roles.
- [Manage context length and delivery scope](compression-or-partial.en.md) · Choose projection, targeted reads, summarization, or partial delivery.
- [Maintain evidence-linked personal memory](personal-memory-snapshots.en.md) · Handle updates, same-timestamp ordering, retraction, and expiry.
- [Organize facts, formats, and references in replies](reply-organization.en.md) · Connect verified business facts and wording to the right calls.

## Execution and recovery

- [Adjust call budgets around remaining work](reasonable-dynamic-budgets.en.md) · Use observed progress to assess allowance and preserve the call ledger.
- [Deliver confirmed results after a request failure](reliable-request-recovery.en.md) · Separate step repair, request recovery, and deterministic fallback.
- [Route completion failures to targeted repair](targeted-completion-repair.en.md) · Send content, format, and evidence failures to their owners.
- [Reuse evidence and reconcile operation receipts](evidence-and-operation-receipts.en.md) · Track evidence reads, business effects, and message delivery.
- [Wait for approval and recover operations across processes](approval-and-durable-recovery.en.md) · Persist approval facts and reconcile writes that may have happened.
- [Review disagreements and accept an existing result](review-and-accept-results.en.md) · Track findings, coverage, human responses, and final acceptance.

## Integration and verification

- [Choose a model protocol and call lifecycle](choose-model-lifecycles.en.md) · Choose among direct responses, background jobs, batches, and realtime sessions.
- [Find the first wrong decision in a run trace](observe-real-execution.en.md) · Trace failures through routes, invocations, and receipts.
- [Test how a task ends under faults](test-completion-under-faults.en.md) · Build offline fault cases around behavioral invariants.

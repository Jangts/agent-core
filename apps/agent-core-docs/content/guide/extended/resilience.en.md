---
title: Choose recovery using the failure and retained evidence
description: Use confirmed reads, effects, and receipts to decide whether to repair, reconcile, narrow delivery, or cancel, then verify with repeatable cases.
---

# Choose recovery using the failure and retained evidence

A request may have read evidence and completed a write before failing to send its final message. Record which step failed, what is confirmed, and whether the request is still live. Track the business result, explanation, and message delivery separately to decide what recovery can do. [Run request recovery and cancellation cases](/manual/examples/resilience/)

## Decide what to do from the facts available

| Known fact | Action | What to assert |
| --- | --- | --- |
| Tool denies current authorization | Stop or clarify the current request. Preserve the denied scope and cause | The protected port is never called and protected fields are absent |
| Read times out with a valid target and permission | Retry a transient failure within the original allowance and deadline | Attempts are charged and stop at the deadline |
| Retrieval fails with some evidence already verified | Narrow claims to authorized sources still available. Keyword or whole-document reads must fit the same access and input limits | Verified and unverified scope are distinct and the retrieval fault remains visible |
| Input is too large or allowance is tight | Project fields or read sections first. Assess remaining work for expansion, clarification, or partial delivery | Consumption and ancestor reserves remain intact, and essential facts are still recoverable |
| Write confirmed, explanation or format failed | Repair from the original receipt. Use deterministic fallback if repair fails | One business write, with the confirmed result still readable |
| Write acknowledgement lost | Query the authoritative receipt by stable operation identity. Preserve uncertainty until the effect is confirmed or known not executed | Reconciliation is read-only and an unknown result does not trigger another write |
| User cancelled | Propagate cancellation and reject late results | Cancellation remains visible and confirmed receipts stay readable under authorization |

Use generic retries only for operations that are safe to replay. Keep separate diagnostic causes for connection failures, protocol errors, deadlines, access denial, and invalid model output. Rate limits can use bounded retry. Configuration and permission errors need explicit handling. An unavailable index and an empty result also require different reporting. [Model protocols and lifecycles](/manual/api/model-protocols) · [Request recovery contracts](/manual/api/reliability)

## Preserve receipts, budgets, and terminal status through recovery

Use code for reads, statistics, and verifiable calculations. Admit evidence and receipts from actual execution first, then pass the needed fields to the model. Spend more work when it can produce a new result or useful evidence. Look for repeated tool declarations and context, and measure input size separately from call consumption. [Budget and context examples](/manual/examples) · [Resilience review](/manual/workflow-development#review-agent-resilience)

Keep a model or node deadline inside its execution scope. While the outer request remains live, recovery can still read and deliver confirmed work. Propagate explicit cancellation throughout the same execution chain. After disconnection, use an authorized request or message identity to find the stored result. The App supplies persistence, cross-process exclusion, and reconnect handling. Cancellation and disconnection provide no evidence that a remote write was rolled back. [Receipt reconciliation](/articles/evidence-and-operation-receipts) · [Cross-process approval and recovery](/articles/approval-and-durable-recovery)

## Match each claim to its verification

- Use the graph and declaration diff to check allowed paths and references. Use a run record to explain a specific fallback, recording the failing stage, category, attempts, result state, and duration.
- Inject one failure in an offline scenario and assert the result, path, and read or write count. Use layered tests to isolate a node, a tool, or the business composition.
- Simulate HTTP errors, interrupted streams, and terminal parsing. Verify semantic quality, real authorization, durable effects, and reconnect behavior against the corresponding model or port.

[Diagnose from execution](/articles/observe-real-execution) · [Test how tasks end under faults](/articles/test-completion-under-faults) · [MockGPT offline checks](./mockgpt.en.md) · [Production checklist](./production-checklist.en.md)

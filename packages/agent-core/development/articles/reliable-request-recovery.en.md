# Deliver confirmed results after a request failure

A user asks to save a report and receive an explanation. The save succeeds, then the model times out while writing the explanation. The business record and the reply are separate outcomes. Recovery can use the confirmed receipt to report the save and state that the detailed explanation is still unavailable.

## Give each recovery layer a scope

| Where failure is handled | Work it can do | State it needs |
| --- | --- | --- |
| Workflow failure route | Fill an evidence gap, reword, or repair a format | Current step and available results |
| Request recovery | Compose a usable reply from confirmed work | Stable result IDs, receipts, and known gaps |
| Deterministic fallback | Report confirmed state and unresolved facts | Established facts and the failure class |

Use `Support.createRequestRecovery` to bind `execute`, optional `recover`, and synchronous `fallback` to the same record. Execution runs once. Recovery failure reaches fallback and retains the technical errors for diagnostics. Record a receipt as soon as the effect is confirmed so later failure still leaves it available.

## Treat timeout, cancellation, and disconnection independently

Put an execution-only timeout inside `execute` and bound the time allowed for request recovery separately. Propagate explicit user cancellation. The wrapper skips recovery and fallback on cancellation. A disconnected client can query persisted results under current authorization after reconnecting. For an uncertain write, follow the [receipt reconciliation path](evidence-and-operation-receipts.en.md).

Run `node node_modules/@jangts/agent-core/development/docs/examples/organization-comparison.mjs` to observe available work surviving a stalled task. In your own request tests, fail execution and recovery independently, then assert one execution, a readable receipt, and a reply consistent with the actual state. [Request recovery contract](../docs/api/reliability.en.md) · [Resilience review Skill](../skills/agent-core-resilience-review/SKILL.md)

[Technical articles](README.en.md)

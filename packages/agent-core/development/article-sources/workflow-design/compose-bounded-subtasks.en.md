# Compose subtasks under a shared budget

An outage report needs monitoring data and a change log before it can assemble a timeline. Run the two reads concurrently when they are independent. If one depends on the service ID returned by the other, express that dependency in the parent workflow.

## Keep allowances with the parent task

Ordinary functions can compose deterministic work directly. Use `createChild` when a subtask needs its own model interaction, progress, and lifetime, then bind the child Runner to an ordinary handler or Engine. Reserve room in the parent for the final synthesis. Children spend the same upstream allowance, including failed attempts. The application binds tool permissions for each child.

`Support.runChildren` handles a bounded group of independent tasks. Give branches stable IDs, call limits, a concurrency limit, and deadlines. Acceptance callbacks check each result. A group failure cancels its peers, late results cannot enter commit, and completed external effects still need business receipts.

## Aggregate in a stable order

`aggregateBranchResults` gathers branch outcomes in declaration order and detects conflicts when branches write the same top-level parent field. Available successful results can survive an unsuccessful branch while the aggregate withholds a complete parent patch. Use separate fields for monitoring and change evidence. If both branches propose a conclusion, give the parent an explicit decision. Use an application transaction when external writes must commit together.

Run `node node_modules/@jangts/agent-core/development/examples/harness-parallel.mjs` in an installed project to observe deterministic aggregation, conflict rejection, call-budget contention, and late results after cancellation. [Bounded subtasks](../../docs/api/advanced-agents.en.md) · [Workflow design Skill](../../skills/agent-core-workflow-design/SKILL.md)

[Technical articles](../README.en.md)

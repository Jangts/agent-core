# Where workflow nodes and tools belong

A support request asks for an explanation of last night's outage and a saved record. The status lookup, explanation, and save have different inputs and permissions. The deliverable can identify the service, the time observed, confirmed facts, unresolved questions, and a receipt once the record is saved.

## Put nodes where the task branches or recovers

A tool owns an authorized operation such as reading a monitoring window or creating a record. A node advances the task, for instance by deciding whether a status result calls for a change-log lookup. Register authorization, parsing, and result checks with the tool. Several nodes can reuse a tool, and a node can compose several tools. Keep elementary calculations in code. Give a step its own node when it needs an independent route, recovery path, or observed state.

| Structure | When it fits | What to check |
| --- | --- | --- |
| Use case | The goal is known and domain rules determine most of a short flow | A complete result leaves the node and recovery can reuse confirmed work |
| Exploration | Evidence determines the order of further reads | Available actions, progress markers, and stop conditions are explicit |
| Matrix | Decisions reuse lifecycle hooks in combinations that vary by request | The selected tools and hooks can be traced to the decision |

## Check the boundary with a failure

Make a formatting check fail after the save is confirmed. A sound boundary routes to presentation repair and reads the existing receipt. If every helper became a node, inspect the payload and authority passed across each edge. If one node owns the entire task, check whether a failure still leaves a recoverable record of the last confirmed result.

From a project with the SDK installed, run `node node_modules/@jangts/agent-core/development/docs/examples/lifecycle-matrix.mjs` to compare selected hooks with all-tool hooks and inspect what survives a presentation failure. Compare two sequencing choices in the [same-task example](../../docs/examples/organization-comparison.en.md). [Workflow design Skill](../../skills/agent-core-workflow-design/SKILL.md)

[Technical articles](../README.en.md)

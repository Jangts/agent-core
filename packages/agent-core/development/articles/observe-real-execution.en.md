# Find the first wrong decision in a run trace

A report shows two lookup calls although the graph contains one lookup node. Find that request's observed run first. The workflow may have revisited the node, the node may have called the port twice, or the log may combine separate requests. Each cause requires a different change.

## Compare declarations, visits, and business receipts

The inspector's registered graph describes possible nodes and edges. The Engine's WorkflowRunTrace describes observed visits and transitions. Use run and invocation identities to connect model calls, tool calls, and subtasks. A node can use `createStepRecorder` to report local work. Consult the business receipt for an external effect. Leave the outcome unknown when evidence is missing.

Follow the visits to the earliest wrong decision. Was input prepared for the intended stage? Which condition won? Was the operation proposed, denied, or executed? Did delivery failure return to execution? Record the scope, versions, duration, and facts used to explain the decision. Apply access and retention policy to user data and keep credentials out of diagnostics.

## Turn a diagnosis into a regression case

Use the [inspector guide](../docs/workflow-inspector.en.md) to export a graph or load an authorized run record. If delivery failure caused a repeated read, keep the valid receipt in a fixture, inject failure, and assert the repair route and lookup count. Assess semantic choices with separate model samples. [Observability contract](../docs/api/observability.en.md) · [Workflow inspection Skill](../skills/agent-core-workflow-inspection/SKILL.md)

[Technical articles](README.en.md)

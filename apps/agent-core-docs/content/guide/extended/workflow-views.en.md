---
title: From workflow graphs to execution chains
description: Use workflow graphs to review definitions and execution chains to inspect captured runs, with clear boundaries between developer tools, observability, demonstrations and Agent execution.
---

# From workflow graphs to execution chains

A workflow graph shows registered nodes, routes and recovery relationships. An execution chain shows the visits, selected branches and subflow records captured during one run. The graph helps you read the definition; the chain helps you inspect observed execution.

Both interfaces are developer aids. Calling them adds no models, tools, roles or business permissions, and does not select the next action, alter scheduling or advance a task. Normal execution does not require exporting a graph. Demonstrating how an application runs is not evidence that its Agent can complete the corresponding business task.

See the [workflow graph and execution chain API](/manual/api/workflow-views) for exact fields, sources and errors. This article explains how to use the data and what a visualization can establish.

## Separate definitions, records and views

| Data | The question it answers | What it cannot establish |
| --- | --- | --- |
| Workflow graph | Which transitions are declared, including recovery targets | Which path a run will select, or why a model reached a conclusion |
| Execution chain | Which visits, iterations, failures and recoveries were captured | That the current graph contains every historical node, or that an absent event never occurred |
| Raw logs and receipts | Concrete events, calls, results and correlation identities | That a successful tool call completed the entire task |
| Rendered view | A selected grouping, filter and layout of the data | That hidden facts do not exist, or that layout order implies a dependency |

A chain is a readonly projection of captured records, aggregated by main-node visit. It creates no second execution ledger and is not a scheduling protocol, executable script or recovery checkpoint. Rendering a chain again neither replays tools nor resumes a finished task.

## Review program structure with a graph

```ts
const graph = workflow.toGraph();
```

Export reads the registered snapshot without executing nodes, route conditions or completion functions. You can display a base graph without any run, or use its JSON in design reviews, code reviews and internal development tools.

Follow the explicit entry to examine stage responsibilities, branches, recovery exits and completion. Several routes can share a topology edge; retain their order and condition identity in the view. Read entryNodeId instead of inferring the entry from incoming edges.

When a graph looks simple, inspect whether it expresses the actual responsibilities. A dispatch node might merely select a protocol, or it might hide tool execution, recovery, validation and delivery. Promote orchestration into Workflow stages when those operations have separate results and failure destinations. Increasing the node count alone improves neither division of work nor Agent capability.

Static export does not inspect function bodies or discover internal tools and custom subnodes. In a multi-Agent application, export each Workflow separately. Application declarations still own roles, available tools, resource scopes and delivery contracts. Agents sharing a workflow skeleton can have different role constraints; graph shape alone does not establish identical permissions or expertise.

## Inspect an actual run with a chain

```ts
// The App bound an authorized traceSource when creating the Workflow.
const chain = await workflow.toTrace(runId);
```

You can also provide an authorized source per call. The App owns log paths, account isolation, retention, pagination and read limits. Export grants no access to other users' records.

Inspect whether tool failures entered the declared recovery stage, rejected delivery retained receipts, repeated visits came from a new decision, and which facts were recorded before cancellation. Across runs, an application can calculate path coverage, retries or stage durations. Such analysis belongs to application or developer tooling; it is not a built-in evaluation feature of the export interfaces.

One nodeId can be visited repeatedly; spanId identifies a visit. Connect visits through actual transitions rather than array adjacency. An error event declaring a recovery target also provides explicit handoff evidence.

Read coverage before interpreting the picture. Missing or uncertain capture does not prove that an unshown node never ran. Content capture is separate from event coverage. Complete capture establishes the coverage of the observation, not completion of the user's business requirements.

Historical records can contain nodes absent from the current definition. Preserve their captured names, revisions and identities rather than filling in a seemingly complete historical path from today's graph.

## Leave presentation choices to observability clients

Core aggregates visits of main nodes and retains a flat subflow ordered by sequence within each visit. GUIs, terminals and developer panels can build their own DataModels:

- When collapsed, summarize the node's internal process in original record order.
- When expanded, group by subnodeId while retaining sequence values across groups.
- Show records without subnodeId as the main node's own internal process.
- Retain each fix as an independent record, project it onto its targetStepId, and allow inspection of the original revision history.

Grouped records may interleave, run concurrently or simply classify one logical stage. Grouping creates no serial dependency between subnodes. A child Agent has its own Workflow invocation; an observability tool can associate it with the parent through actual call identities, rather than presenting every child stage as a parallel step inside the parent node.

toTrace returns a read-time snapshot. For a live interface, the App consumes the existing event observer stream and updates its view according to its own rules. Export is not a subscription channel. Consumers own layout, expansion, filtering, status projection and rendering.

## What a demonstration establishes

A demonstration can explain responsibilities, current request progress, delegation and failure handling. Distinguish static definitions, captured runs and test runs driven by offline model scripts.

An offline script with actual tools can verify orchestration and call contracts along the scripted path. It does not establish that a real model will make the same decisions. A static graph proves no execution, and a successful chain proves no universal coverage of business inputs, dependencies or failures. Business acceptance still requires suitable inputs, actual calls and evidence of real results.

## Relationship to log-based reflection

An App can give an Agent authorized logs to extract issues, hypotheses and improvement suggestions. The App separately decides whether suggestions become memory, rules or published program changes; captured records do not automatically create a learning loop.

Workflow graphs and run traces currently expose structure and run projections for developers. They are not automatically connected to decision-making, learning or rule modification. If an App supplies these projections to reflection, it must select fields explicitly, preserve coverage gaps and maintain the original authorization and content policies. Export does not grant that business capability.

For underlying records and correlation, continue with [requests, traces and Journal](/manual/api/observability). For reflection, branches and handling suggestions, see [reflection, branches and publication](/manual/api/advanced-agents).

# Workflow inspector

The workflow inspector is an optional development tool shipped with `@jangts/agent-core`. It validates the registered graph and App-provided metadata and produces a self-contained report with a directed graph, route priorities, node details, searchable tools, per-adapter tool lists and JSON Schemas.

## Generate an offline report

From an App with the SDK installed, run the packaged example:

```sh
SDK=./node_modules/@jangts/agent-core
INSPECTOR="$SDK/development/scripts/workflow-inspector/cli.mjs"
node "$INSPECTOR" inspect \
  --entry "$SDK/development/examples/workflow-inspection.mjs" \
  --output .tmp/agent-workflow.html
```

Open the resulting file to browse the graph. Select a node to see its incoming and outgoing paths and execution contracts. Tools can be searched independently or by node and link back to every referring node. Solid arrows are transitions, dashed arrows are recovery, and a terminal marker indicates completion. Routes with a common edge remain separately listed in priority order. Graph positions are adjustable. Dense graphs can still have crossing edges.

## Connect your App

Provide a trusted, declaration-only JavaScript module that exports the actual public workflow object. For a richer report, export `inspection`:

```js
import { workflow, toolCatalog } from './agent-declarations.mjs';

export const inspection = {
  workflow,
  toolCatalog,
  nodeCapabilities: [{ nodeId: 'review', tools: [{ toolId: 'lookup', access: 'read' }] }],
};
```

The inspector runs the entry's top-level JavaScript in a fresh Node process and calls `toGraph()` and the optional catalog's `values()`. Use a module that can be loaded without starting the App, connecting to services or executing handlers. The fresh process reloads imports with the same permissions as the CLI. For TypeScript, point to JavaScript emitted by the App's build. If importing the declarations would have side effects, supply an existing JSON snapshot with `--input` instead.

| Field | Contract |
| --- | --- |
| `workflow` | A registered workflow with the public [toGraph contract](api/workflow-views.en.md). |
| `toolCatalog` or `tools` | A public registered catalog with `values()`, or a metadata array with `id` and optional `registered`, `description`, `kind`, `source` and `parameters` JSON Schema. Unspecified registration stays unknown. |
| `nodeCapabilities` | One entry per `nodeId`, with optional `kind`, `role`, `tools: [{toolId, access?}]` and `adapters: [{id, description?, toolIds?, parameters?}]`. Each adapter keeps its own tool list and Schema. |
| `nodeMetadata` | One entry per `nodeId`, with optional `handler`, `source`, `input` and `output` schemas, and `completion` text. |
| `routeConditions` | Entries keyed by `sourceNodeId` and zero-based `order` on a conditional route. Optionally supply `conditionSource` and `source` from the declaration. |

Static reference checks cover the entry, node/edge IDs, edge endpoints, incident edges, route order, and metadata references. With a supplied tool catalog or inventory, missing tool IDs fail the check. Unknown and explicitly unregistered bindings produce warnings. The inspector projects only documented fields, never executes a condition, and does not resolve remote Schema references. Treat any description, source field or Schema included in a report as shareable only within its authorized audience.

Use `export --entry ./inspect-workflow.mjs > .tmp/workflow.json` for JSON. Use `check --input .tmp/workflow.json` for reference validation or `inspect --input .tmp/workflow.json --output .tmp/agent-workflow.html` to render. The JSON input accepts a bare `WorkflowGraph` or `{ graph, tools?, nodeCapabilities?, nodeMetadata?, routeConditions?, lifecycleMatrix?, chain? }`.

## Follow source changes

```sh
node "$INSPECTOR" watch --entry ./inspect-workflow.mjs \
  --source ./agent-declarations.mjs --output .tmp/agent-workflow.html
```

Watch samples the named files by content, including the inspection entry. Add `--source` once for every dependency that should trigger refresh. Use the App's normal build to refresh any emitted JavaScript. The source fingerprint marks the listed files only. Paths are relative to the working directory.

A valid export atomically replaces the report. A validation failure leaves the previous HTML in place and reports that it may be stale. Refresh an open file to view changes, or add `--serve 4319` to open `http://127.0.0.1:4319/` yourself. The loopback viewer follows source updates and shows when it is displaying the last valid snapshot. Only the report and projected snapshot are served.

## Inspect a recorded run

Export the exact run through the App's authorized `workflow.toTrace(runId)` source. Write the returned `WorkflowRunTrace` to JSON. Then supply `--trace ./run.json --run-id <id>` to the inspector, or pass `--run-id <id>` with an embedded chain. The inspector validates the workflow and run identities. It displays real spans, transitions, sub-flow metadata and coverage independently of the current graph. Use the corresponding historical definition where available. Repeat visits and historical nodes outside the current graph remain visible. Payloads and source content are omitted from the chain projection.

The registered graph describes possible paths. Only the recorded chain supports conclusions about a specific execution. Use the [development Skill](../skills/agent-core-workflow-inspection/SKILL.md) shipped in the installed package for an Agent-assisted review.

To compare two exports or add repeatable cases, see [workflow change review and offline scenarios](workflow-development.en.md).

For boundary decisions, work through [two organizations for the same task](examples/organization-comparison.en.md), including its handlers, state handoffs and fault assertions. Establish result and recovery ownership first, then check whether the registration expresses it. Layout and node counts cannot establish which design is better.

## Evidence boundaries

`check` and HTML reports expose an `evidence` summary separate from reference warnings. Optional inventories are `supplied` or `not-supplied`; missing handler, completion, tool-binding and registration declarations are counted as unknown, not failures. A supplied empty binding list differs from an absent list. The summary describes metadata availability, not its correctness or completeness. Unknown extension fields and event payloads are omitted by projection and are not inspected.

A registered graph describes possible paths. An attached chain describes observed visits and retains the source coverage (`true`, `false` or `unknown`) and issues; complete source coverage does not prove business completion. Architecture suitability, dynamic authorization, side-effect outcomes, request recovery and persistence outside the workflow, real-model semantics and production behavior require separate evidence. Zero warnings is not acceptance of these properties.

## Lifecycle matrices

Optional `lifecycleMatrix` describes stages, tool hooks, all/selected execution and intent scope. References are checked and HTML cells link to reported subflow records; absent records do not mean non-execution. See the [matrix organization](examples/lifecycle-matrix.en.md) for fields, export and evidence limits.

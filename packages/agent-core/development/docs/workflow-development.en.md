# Workflow development and verification

Use the packaged Skills to design nodes and analyze model budgets. The SDK's Node.js tools inspect registered graphs, compare declarations, and run offline cases.

| Development task | Entry | Output |
| --- | --- | --- |
| Design or review an answer without changing the graph | [Reply organization](../articles/reply-organization.en.md) | Processing choice, style, references, focused examples and evidence |
| Understand the definition and a specific run | [Workflow inspector](workflow-inspector.en.md) | Snapshot, self-contained HTML report, and an optional recorded chain |
| Find resilience gaps in budgets and knowledge reads | [Resilience review](#review-agent-resilience) | Failure paths, evidence, and regression cases to add |
| Review a workflow change | [Declaration diff](#review-a-declaration-change) | Changes to routes, schemas and adapters, with directly affected nodes |
| Verify expected behavior | [Offline cases](#run-offline-cases) | Results, paths, recovery, and model call counts |
| Test an App by layer | [Feature, node, and tool tests](#test-agent-features-nodes-and-tools) | One case inventory and a Node.js test report |

[Create an App](create-app.en.md) provides a starting project. Give a coding assistant the relevant [Development Skill](agent-development.en.md#development-skills) when working on any of these tasks.

## Design workflow nodes

The workflow node design Skill starts with representative requests and their inputs, outputs, branches and failure ownership. Independent routing, result commitment or recovery can justify a split, but compare their benefits with state handoffs, extra calls and recovery complexity. None is sufficient by itself. Observation-only details usually belong in internal execution records; shared reads, conversions and checks can stay in handlers or tools. A complete use case can be one node, while a bounded investigation loop can select work from new evidence and stop or replan without progress. Advance validated prerequisites in code; ambiguity, new evidence or synthesis may require model judgment.

Find the Skill at `development/skills/agent-core-workflow-design/SKILL.md` in the installed package. Use the [workflow inspector](workflow-inspector.en.md) to review the registered graph and, when available, recorded visits, transitions, and calls.

Start with [two organizations for the same task](examples/organization-comparison.en.md) to compare lifecycle boundaries over shared facts and delivery contracts. After choosing boundaries, inspect registrations and references, review declaration changes, and assert results, observed paths and effect counts in offline scenarios. The example includes a runnable package entry; similar diagrams or passing reference checks cannot replace behavioral evidence.

## Optimize the model budget

The model budget optimization Skill builds an invocation ledger with stage, purpose, outcome, usage, and elapsed time. Look for duplicate reads, repeated context, and routine reviews before setting shared limits and reserving calls for delivery. Use [Core request measurement](api/core.en.md) to check assembled messages and declarations, and [context processing](api/context-processing.en.md) to control history retention and summarization.

Find the Skill at `development/skills/agent-core-budget-optimization/SKILL.md` in the installed package. Offline cases distinguish justified allowance expansion after an underestimated start, projection or compression under context pressure, and truthful delivery under actual blockers or hard boundaries. A low initial allowance does not justify partial delivery. Compare usage, latency and semantic quality using comparable cases and real model records.

## Review Agent resilience

Use `development/skills/agent-core-resilience-review/SKILL.md` to check direct replies, complex requests, long-history follow-ups, and paths near exhaustion. Assess whether moving parsing, filtering, counting or comparison into program handlers would help; a suitable fully model-driven reply is valid without that change. For workloads that vary materially, assign an allocation from validated work and capability requirements, keep a hard cap, and reserve calls for completion.

Inspect the first actual request that lets the model select a tool. Check its tool IDs, choice mode, and the capabilities the stage needs across direct questions, implicit requests, short follow-ups, and multiple intents. Derive stage filters from the [registered tool definitions](api/configuration-in-workflow.en.md). Compare the tool list, descriptions, schemas, and prompts for duplicate aliases, repeated field details, and internal metadata. Keep the details that distinguish tool purposes, inputs, and effects. [Measure the assembled request](api/core.en.md) before and after, then retest route and argument selection.

Review [stable section anchors](knowledge.en.md#text-section-anchors), the active [retrieval index](api/kits.en.md#textsearch-vectorsearch-rrf-modelcalls), and authorized reads of selected sections. If the App uses MiniSearch through `TextSearch`, check tokenization, retrieval scope, and index freshness. For long histories, assess the [context policy](api/context-processing.en.md), including thresholds, recent original turns, and incremental summaries. Use offline cases to check truthful partial completion and preserve cancellation, authorization, and execution receipts.

Record the triggering request, execution path, measured usage and limit, what the App can still deliver, and the smallest reproducible case. For a complex lookup that exhausts its tool quota, add a [layered test](#test-agent-features-nodes-and-tools) that checks that reads stop and incomplete coverage is reported as partial.

## Review a declaration change

Run the following from the App directory. Capture the baseline with the actual declarations in place. After an edit, export the same workflow as the candidate and compare the two snapshots. If the App uses compiled TypeScript declarations, refresh its JavaScript entry before each export.

```sh
SDK=./node_modules/@jangts/agent-core
mkdir -p .tmp
node "$SDK/development/scripts/workflow-inspector/cli.mjs" export \
  --entry ./inspect-workflow.mjs > .tmp/workflow-before.json

# After editing the registered declarations:
node "$SDK/development/scripts/workflow-inspector/cli.mjs" export \
  --entry ./inspect-workflow.mjs > .tmp/workflow-after.json
node "$SDK/development/scripts/workflow-diff/cli.mjs" \
  --before .tmp/workflow-before.json --after .tmp/workflow-after.json
```

The report compares the entry point, nodes, edges, route priorities, tool schemas, bindings, adapters, handler metadata and condition references. It lists directly affected nodes, including current and former references to changed tools through nodes or adapters. A missing optional inventory is marked unexamined. Inventory entries are matched by ID and arrays within a declaration retain their order. Snapshot timestamps, source fingerprints, revision labels and JSON object key order are ignored. Runtime checks establish route selection and actual authorization.

Use `--json` for structured results. With `--fail-on-change`, a detected declaration change exits with status 2. Invalid input exits with status 1. Capture the baseline from the actual registration before making the change.

For an Agent-assisted review, use the [workflow change review Skill](../skills/agent-core-workflow-change-review/SKILL.md).

## Run offline cases

Start with the [packaged fixture](../examples/workflow-scenarios.mjs), which exercises an authorized path and a denial recovery through the same workflow:

```sh
SDK=./node_modules/@jangts/agent-core
node "$SDK/development/scripts/workflow-scenarios/cli.mjs" \
  --fixture "$SDK/development/examples/workflow-scenarios.mjs"
```

Export a `scenarios` array from a trusted JavaScript fixture. Each case has an `id` and `setup({ execution, provider })` that returns `{ agent, state }` through the App's factory. Pass `execution` to the Engine and `provider` to the relevant model configuration. Use synthetic data and in-memory implementations for tools, storage and other external ports. The fixture module and factories run with the CLI's permissions.

- `replies` defaults to zero allowed model calls. Each listed reply is a string or an array of Core `ModelPart` values. Unexpected calls and unused replies fail the case.
- Provide `verify({ result, events, modelCalls })` for success or `verifyError({ error, events, modelCalls })` for an expected rejection. Use ordinary Node assertions to check the result, observed node and route order, recovery and model call count. JSON summaries contain selected workflow fields and omit successful result bodies and model content.
- `timeoutMs` defaults to 5000. A deadline aborts the signal passed to the Engine and fails the case. Repeat `--case ID` to run only selected cases. Test failures produce exit status 1.

Use offline scenarios for known routing, authorization and result contracts. Validate real model semantics and production side effects through their own integration checks.

For Agent-assisted case development and diagnosis, use the [workflow regression Skill](../skills/agent-core-workflow-regression/SKILL.md).

## Test Agent features, nodes, and tools

Run the packaged Node.js script from the App directory. Omitting `--fixture` runs the examples shipped with the Skill.

```sh
SDK=./node_modules/@jangts/agent-core
TEST_AGENT="$SDK/development/skills/agent-core-app-testing/scripts/test-agent.mjs"
node "$TEST_AGENT"
node "$TEST_AGENT" --layer tool
```

Export an `agentTests` array from a trusted JavaScript module. Register a unique `id`, a `layer`, and a `run({ signal, runScenario })` handler for each entry. An optional `timeoutMs` defaults to 5000 milliseconds.

| Layer | Setup and assertions |
| --- | --- |
| `feature` | Use `runScenario` with the real App Engine and verify user results, authorization paths, or model call counts |
| `node` | Run the actual node in a minimal workflow and verify state commits, route priority, and recovery |
| `tool` | Invoke the actual binding with synthetic ports and verify input, authorization, effect count, output checks, and receipts |

Point `--fixture` to an entry that the local Node.js runtime can load. JavaScript Apps can supply an `.mjs` file. TypeScript Apps can use their existing toolchain to emit a JavaScript entry and pass its path to the script.

Save this example as `test/agent-tests.mjs`. It runs a counting node in the actual Engine and asserts the delivered result and zero model calls. In an App suite, use the real node and the smallest workflow that exercises it.

```js
import assert from 'node:assert/strict';
import { AgentCoreEngine, defineWorkflow, route } from '@jangts/agent-core';

const workflow = defineWorkflow({
  id: 'count-records',
  nodes: [{
    id: 'count',
    description: 'Count the records supplied by the App',
    run: ({ records }) => ({ count: records.length }),
    routes: [route.deliver('count')],
  }],
});

export const agentTests = [{
  id: 'counts-records',
  layer: 'node',
  run({ runScenario }) {
    return runScenario({
      setup: ({ execution }) => ({
        agent: new AgentCoreEngine({ workflow, execution }),
        state: { records: ['first', 'second'] },
      }),
      verify({ result, modelCalls }) {
        assert.equal(result, 2);
        assert.equal(modelCalls, 0);
      },
    });
  },
}];
```

Run `node "$TEST_AGENT" --fixture ./test/agent-tests.mjs --case counts-records`. The passing case appears as `node/counts-records` in the Node test report.

`runScenario` uses the offline scenario contract above and defaults to the current test's `id` and timeout. It uses scripted model replies and inherits the test's cancellation signal. Pass the test signal to the tool binding or invocation for direct cases. Use fresh state and synthetic dependencies in each case. The script uses Node's test report and exits nonzero on failure. Repeat `--layer` or `--case ID` to select layers or cases.

## Interpreting evidence

Inspector checks and diffs establish static declaration facts. Diff `hasChanges: false` means no differences in compared, projected fields; missing optional sections remain unexamined and handler bodies, conditions and ports are not compared. The additive `evidence` field in diff JSON states this scope. Scenario success means the fixture's verification callback accepted the scripted execution, not that every business property was asserted. Request recovery, delivery persistence, unknown writes and side-effect replay must be exercised through the App's corresponding ports and explicit assertions. Neither a graph nor a passing scenario supplies real-model or production evidence.

## Choose an organization

Use complete use cases for independently owned outcomes, bounded exploration for new evidence, or a [matrix](examples/lifecycle-matrix.en.md) for similar execution stages and tool hooks. All share authorization, reasonable budgets, retained results and truthful delivery without requiring matching topology. A matrix can obtain intent, tool and arguments in one decision and advance known steps programmatically. Measure actual calls rather than nodes. Inspector and diff accept optional matrix declarations and recorded associations; semantic quality still needs real-model evidence.

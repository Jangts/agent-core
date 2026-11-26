# Agent Core API

This handbook describes the current SDK module by module. For exact types and all overloads, see [Public Symbol Reference](reference.en.md).

See [Concepts and naming](../concepts.en.md), [Compatibility](../compatibility.en.md), and [Upgrading](../upgrading.en.md).

Core defines runtime interfaces and execution guarantees, Support provides recommended implementations and configuration strategies, and Kit provides optional business tools for Apps. Pure algorithms use their own input and output contracts.

Apps can also select a task Skill and use its instructions in their own handlers. [Task Skills](skills.en.md)

Start with [Independent and associated configuration in executable code](configuration-in-workflow.en.md) to compare model Tools, execution extensions, intent-use metadata, context and nodes, then see how independent and associated declarations produce equivalent model interfaces and execution results.

## Start with these seven rules

1. Entities use `id`; references to entities use `toolId`, `documentId`, etc.; `name` is the display name.
2. `jsonSchema` is always a read-only JSON Schema; `inputSchema` is always `SchemaAdapter<T>`, whose `parse` performs the actual parsing.
3. `is/can/has` return booleans; `assert/authorize` return void on success and throw on failure; `check` returns an issue report; `parse` returns the converted value.
4. `define` compiles a static declaration; `create/new` create an adapter or runtime instance. Request state, signal, and budget are bound at runtime.
5. Input first, context second. Complex calls use named requests; `get(id)` returns undefined when missing, `require(id)` throws when missing.
6. A successful invoke uniformly returns `{ value, invocation }`; the short input form only normalizes input, both text and structured values are placed in value, and failures uniformly throw.
7. An observer is non-blocking observation of the business; a sink is delivery that must be awaited. They do not have the same semantics just because both return Promises.

## Imports and reading order

```ts
import { AgentCoreEngine, ModelRunner, Support } from '@jangts/agent-core';
import { defineKnowledgeCatalog } from '@jangts/agent-core/kits/knowledge';
import { defineAnswerFlow } from '@jangts/agent-core/kits/answering';
import type { SchemaAdapter, OperationContext, Issue } from '@jangts/agent-core';
```

Use Core services and common contracts from the root entry, integration helpers from `Support`, and Kits from their own entries with named functions or constructors. The full `/kits` entry and the individual entries export the same implementations.

| Order | Document | What you learn |
| --- | --- | --- |
| 1 | [Common types and rules](types.en.md) | Identity, schema, validation, errors, context, collections, ownership |
| | [Workflow primer](workflow.en.md) | Agent binding, nodes, routes, and derivation |
| 2 | [Core](core.en.md) | Model calls, tools, tool execution, workflow, and events |
| 3 | [Support](support.en.md) | Schema, tool and capability catalogs, model interaction, and context assembly |
| | [Context processing](context-processing.en.md) | Budget, watermarks, compression, and original-text protection |
| | [Model protocols and lifecycles](model-protocols.en.md) | Provider protocols, continuation, background, batch, and realtime |
| | [Resources, completion and recovery](reliability.en.md) | Request budgets, directed repair, and retained results |
| 4 | [Knowledge, answering, and presentation](knowledge-answering.en.md) | Evidence gathering, checks, local repair, program-bound output |
| 5 | [Remaining Kits](kits.en.md) | Intent, interaction, retrieval, rules, artifacts, and persistent tasks |
| | [Personal memory](../memory-and-learning.en.md) | Evidence-linked snapshots, scope, corrections, and retraction |
| | [Result review and decisions](result-review.en.md) | Disagreement findings, independent coverage, action admission and waiting |
| | [Retrospectives, branches, and material publishing](advanced-agents.en.md) | Bounded subtasks, metadata evidence, persistent versions, and source validation |
| 6 | [End-to-end examples](examples.en.md) | Declare tools, invoke models, and perform real operations with one set of contracts |

For the unified source of truth for logs and Journal, call-chain correlation, and relationship table mapping, see [Requests, call chains, and Journal](observability.en.md).

## One-page quick reference

| Task | Preferred interface | Result |
| --- | --- | --- |
| A single model call | `runner.invoke({ stageId, input, interaction })` | ModelResult: value is the complete parsed value; raw chunks only go to the sink |
| Execute a tool | `tools.invoke({ toolId, input })` | ToolResult: value is the actual result that has been parsed, authorized, executed, and checked |
| Compile a workflow | `defineWorkflow(definition)` | A `Workflow` not bound to a request |
| Run a workflow | `agent.run(state)` | A value that satisfies the final result contract |
| Declare a tool | `Support.defineTool(definition)` | A typed definition sharing its source with the model schema |
| Create a request tool instance | `catalog.bind({ app, execution })` | A `ToolRuntime` whose lifetime is limited to this request |
| Obtain a registered entry | `catalog.get(id)` / `catalog.require(id)` | Optional lookup / mandatory lookup |
| Check a value | `checker.check(value, context)` | `CheckResult`, not a boolean or an error alias |
| Read material | `knowledge.read({ documentId, selection })` | A snapshot with version, selection, and identity |
| Resume a persistent task | `task.run({ taskId }, context)` | A copy of confirmed final state. Pass `store` in the request if none is already bound |

Synchronous algorithms remain synchronous. Source schema, permissions, budget, cancellation, and final commit checks are not relaxed by adopting these helper interfaces. The App's own business state is not promoted to a required field of every Kit.

## Mock model

The [MockGPT Kit](mock.en.md) describes `@jangts/agent-core/mock` and its `/node` and `/web` entries: rules and generators, direct return values, HTTP/SSE, tool proposals, web sources, errors, cancellation, and budget.

- [Decorators and definition pools](decorators.en.md)

For developer-side static topology and observed run chains, which do not participate in task execution, see [Workflow graphs and run traces](workflow-views.en.md).

- [Resources, completion and recovery](reliability.en.md)

Model protocols and lifecycles: [unified integration guide](model-protocols.en.md).

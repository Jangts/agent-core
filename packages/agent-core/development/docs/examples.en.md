# Examples and integration references

Start with the guarantee you need to preserve and select a corresponding offline example. Then use the linked integration contract. Scenarios assert real execution paths and state. Semantic quality, external effects, and cross-process persistence require validation with the relevant real ports and environments.

## Verify resilience first

| What to preserve | Runnable example | Integration reference |
| --- | --- | --- |
| An explanation failure still leaves the confirmed result available | [Request recovery and cancellation](examples/resilience/README.en.md) · [Bounded Agent composition](../examples/harness-composition.en.md) | [Budgets, completion, and recovery](api/reliability.en.md) |
| Authorization denial or monitor failure leaves the status unconfirmed | Run the [helpdesk fixture](examples/service-helpdesk/cases.mjs) through the scenario and layered runners | [Model and tool integration](basic-usage.en.md) |
| Oversized input, stalled investigation, or budget pressure preserves honest reporting | [Two organizations for one task](examples/organization-comparison.en.md) | [Context policy](api/context-processing.en.md) |
| A child failure, cancellation, or late result preserves parent state | [Controlled parallel tasks](../examples/harness-parallel.en.md) | [Bounded subtasks and branches](api/advanced-agents.en.md) |
| Waits and possibly completed operations can be reconciled across processes | [Durable waiting](../examples/harness-durable.en.md) | [Waiting, durable tasks, and authorization](api/advanced-agents.en.md) |
| Incomplete review or version changes prevent acceptance | [Collaboration probe](../examples/collaboration-probe.mjs) | [Result review and decisions](api/result-review.en.md) |
| Memory correction, expiry, and retraction preserve scope | [Personal memory example](examples/personal-memory.mjs) | [Memory snapshots](memory-and-learning.en.md) |
| Routing, lifecycle hooks, and call counts remain inspectable | [Node and tool matrix](examples/lifecycle-matrix.en.md) | [Inspector](workflow-inspector.en.md) · [Change review and verification](workflow-development.en.md) |

Run bundled examples under `node_modules/@jangts/agent-core/development/` in an installed project. Use the [workflow scenario runner](workflow-development.en.md#run-offline-cases) or the layered test runner for the helpdesk fixture.

## Select an integration pattern

- Start with one working feature. [Create an App](create-app.en.md) · [Offline service answering](examples/offline-agent.en.md) · [Runtime mechanics](mechanisms.en.md)
- Connect models and external operations. [Model and tool calls](basic-usage.en.md) · [Model protocols and lifecycles](api/model-protocols.en.md) · [Core API](api/core.en.md)
- Connect knowledge and structured replies. [Knowledge answering](api/knowledge-answering.en.md) · [Context processing](api/context-processing.en.md) · [Reply organization](../articles/reply-organization.en.md)

## Maintenance tools

The following paths are relative to the installed package's `development/`. Scripts require Node 22+ and a resolvable Core build.

| Entry | Input | Output and side effects |
| --- | --- | --- |
| `skills/agent-core-app/scripts/validate-knowledge.mjs PROJECT` | Existing project knowledge manifest, sources, and required read references | Check results; does not modify files |
| `skills/agent-core-app/scripts/prepare-source.mjs PROJECT --source UTF8_FILE --id DOCUMENT_ID` | Existing project, explicitly provided source, and stable document id | Source awaiting review and a proposal; does not overwrite effective knowledge or configuration |
| `skills/agent-core-app/scripts/plan.mjs PROJECT [--source UTF8_FILE]` | Existing project, optional source path | Agent development plan; see the Skill for specific behavior |
| `skills/agent-core-app/scripts/create-app.mjs TARGET [--write]` | Empty target directory, name and purpose, optional real source | Read-only plan by default; explicitly creates a TypeScript/Node project and unpublished source candidates |
| `skills/agent-core-app/scripts/create-app.mjs TARGET --check` | Generation receipt, current managed files, and the selected template | Read-only diff report; does not overwrite user modifications |

Knowledge maintenance tools work from configuration explicitly provided by the project and do not scan or execute project code. For initialization and diff checks see [Create an App](create-app.md). For knowledge format, flow, and publication responsibility see the [Maintenance guide](maintenance.md). Failures exit with a non-zero code and an error report; invalid UTF-8, budget, or section errors cannot be bypassed by relaxing validation.

The tools do not replace document review, resource authorization, database write-back, or publication, and they do not by default take on PDF/OCR, web crawling, or arbitrary material ingestion.

# Third-party App development handbook

This handbook explains how to build Apps with the public interfaces of Agent Core, covering APIs, integration examples, Skills, and App knowledge maintenance. The Chinese edition starts at [中文](README.md); each page has a corresponding `*.en.md` file in the same directory.

> [API handbook](api/README.en.md) · [Public symbol reference](api/reference.en.md)

> [Concepts and naming](concepts.en.md) · [Compatibility](compatibility.en.md) · [Upgrading](upgrading.en.md)

Agent Core integrates with applications through public interfaces and works with different service frameworks, databases, model providers, and front ends.

The API reference is also part of this development documentation: [API home](api/README.en.md), [Core](api/core.en.md), [Support](api/support.en.md), [Kit](api/kits.en.md). This handbook explains how to combine these interfaces and take on application responsibilities; signatures, parameters, returns, and exceptions are governed by the corresponding API pages.

## Start from the task to be completed

First read [How the mechanism works](mechanisms.en.md) to understand overall collaboration, the difference between tasks and nodes, workflow progression, the timing of model and tool calls, and the App knowledge answering example.

Start by providing a ChatProvider, then call `new ModelRunner({ provider }).invoke('你好')`. Core itself provides the plain text path and default run settings; Support and Kit are optional. Tools, context processing, persistence, and complex orchestration are integrated step by step as needed.

| Task | Recommended entry |
| --- | --- |
| Create a runnable Agent App from an empty directory | [Create an App](create-app.en.md) |
| Install into an existing project, configure the model connection | [Installation and integration](getting-started.en.md) |
| Generate one reply | [Model calls](basic-usage.en.md#one-model-call) |
| Declare tools, authorization, execution in one place and return results | [Tool integration](basic-usage.en.md#tools-are-declared-only-once) |
| Understand the difference between raw model streams and complete delivery | [Stream boundaries](basic-usage.en.md#streams-previews-and-logs) |
| Orchestrate conditional loops and multi-stage tasks | [Registration and orchestration](registration.en.md) |
| Design nodes, inspect a graph, or review a workflow change | [Workflow development and verification](workflow-development.en.md), [Workflow inspector](workflow-inspector.en.md) |
| Design or review replies, style and reference use | [Reply organization](../articles/reply-organization.en.md), [Development Skill](../skills/agent-core-reply-development/SKILL.md) |
| Reuse task methods or work with a coding assistant | [Task Skills](api/skills.en.md), [Development Skills](agent-development.en.md) |
| Manage prompts, context sources and processing responsibilities | [Prompts and context](../articles/prompts-and-context.en.md) |
| Control context length and compression | [Context policy](api/context-processing.en.md) |
| Generate and check answers from existing knowledge | [Knowledge documents](knowledge.en.md), [Knowledge answering contract](api/knowledge-answering.en.md) |
| Handle user materials and persistence | [Material boundaries](materials.en.md), [Memory and continuous accumulation](memory-and-learning.en.md) |
| Integrate logs, cancellation, and failure handling | [Delivery and operations](operations.en.md) |
| Verify a complete integration | [Integration checks](acceptance.en.md) |

For partial integration approaches see [Examples](examples.en.md); for App data field design see [Record examples](records.en.md). For manual preparation and iteration see the [Maintenance handbook](maintenance.en.md); for the shared workflow and Skill used by coding Agents see [Agent-assisted development](agent-development.en.md). These assets are not automatically scanned, installed, published, or written to a database by the library.

## Runtime interfaces and reusable methods

Core owns the execution service and the calling/callback contracts, such as workflow state commits, model call budget, tool input → execution → output, and real call receipts. Support helps the App construct these calls and the implementations that get scheduled. Kit is chosen by the App on its own and owns its own local business models and specifications.

`Support` is the unified namespace for integration support and contains multiple modules. A single optional capability module is called a Kit; multiple Kits are aggregated by `/kits`. A Kit may have its own helper functions and shared utilities internally.

Task Skills provide reusable instructions for App handlers. Developers use the packaged Skills and Node.js tools to design, inspect, and verify workflows. [Workflow development and verification](workflow-development.en.md)

```text
App authentication, storage, knowledge loading, and run configuration
    → Support assembles model and context
    → Core executes registered workflows, model calls, and tools
    → App handler calls Knowledge / Answering / Presentation Kits as needed
    → App checks and delivers the result
```

Names, parameters, and conclusions proposed by the model are not authentication, persistence authorization, or execution receipts. An App may skip a given Kit but still has to comply with the Core interfaces it actually uses. After adopting a Kit, comply with that Kit's local input and output constraints.

## What a new App must provide

- **Basic run**: the Provider's model connection and the actual input. Core provides the default budget, single-call timeout, signals, and plain text transport; override as needed.
- **When enabling tools**: the business implementation plus the required identity, access control, parameter, and result constraints.
- **When enabling persistence**: sources, user ownership, storage and retention policy, and failure recovery.
- **When enabling complex orchestration**: associations among declared nodes, tools, model tools, knowledge, checks, and output.

No default need to enable long-term memory, user profiles, experience libraries, vector databases, or dynamic tool loading. Deliver a read-only, single-round App with explicit sources first, then integrate each item according to real requirements.

## Provided versus still-App-owned tools

| Provided by the library | Still to be implemented by the App |
| --- | --- |
| Knowledge document parsing, in-memory catalogs, section selection, and snapshots | Reading files/databases, knowledge authorization, version computation, persistent import/modification/deletion |
| Answering task lists, checks, and bounded local repair | Task business definition, fact reading, model calls, business validation, and allowed fallback |
| Support context assembly and model call format adaptation | Request data, server-side identity, source trustworthiness, storage, and model connection configuration |
| TextSkills text catalog loading and metadata validation | Actual file reading, tool reference verification, update publishing, and reload timing |
| Core run records and optional diagnostics, Support's optional Provider observer | Log output, storage, sensitive content policy, queries, and operations |

Run the [service answering example](examples/offline-agent.en.md) to see model calls, tool authorization, and result delivery in one offline application. See the [knowledge maintenance flow](flows/knowledge-maintenance.en.md) for preparing and updating source material.

Profile merging, experience learning, long-term memory storage, document persistence, vector index storage, and file ingestion are implemented by the App. The relevant chapters provide integration boundaries and templates.

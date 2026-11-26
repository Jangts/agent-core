# Installation and integration

[Back to development handbook](README.md) · [API handbook](api/README.md)

Install Agent Core as a dependency in your application, then integrate models, tools, and workflows as needed.

When starting from an empty directory, you can first generate a TypeScript/Node project following [Create an App](create-app.md), then complete dependency and model integration along this page.

## Installation

Install from npm:

```sh
npm install @jangts/agent-core
```

Dependencies are installed by the package manager according to `package.json`. When using a local package provided by the maintainer, specify the tarball path:

```sh
npm install /artifacts/jangts-agent-core-0.1.0.tgz
```

Replace the path and version according to the actual delivery. Offline installation requires the maintainer to provide a complete local dependency source, and the package manager resolves all dependencies.

The package provides ESM, CommonJS, and TypeScript declarations. Use Node.js 22.12.0 or later; the runtime must provide the APIs in use such as `fetch`, `AbortSignal`, and `ReadableStream`. Model credentials are managed by the application's server-side configuration.

## Wire up the first call

First provide a ChatProvider that the App has already configured, then pass the raw question; all other run settings have defaults:

```ts
import { Support, ModelRunner } from '@jangts/agent-core';

const provider = new Support.CompatibleModelProvider({ config: {
  baseUrl: process.env.AI_BASE_URL!,
  apiKey: process.env.AI_API_KEY!,
  model: process.env.AI_MODEL!,
} });
const model = new ModelRunner({ provider });
const text = (await model.invoke('你好')).value;
```

The above uses the application's existing environment configuration, and the service must be compatible with Chat Completions; baseUrl does not include /chat/completions. The Provider handles HTTP/SSE itself, so you do not need to implement stream separately. Run the [Offline complete example](examples/offline-agent.md) first without model credentials; it does not call a real model. Plain text calls need no Knowledge, tools, or workflows. Kits are imported from `@jangts/agent-core/kits/<name>` as needed; see the corresponding task documentation for specific compositions.

| Provided by the App | Executed by existing interfaces |
| --- | --- |
| The Provider's real connection configuration and user input; signal/budget overrides as needed | ModelRunner checks budget, handles cancellation/timeout, and calls the model |
| Centralized tool declarations, server-side identity, and business implementation | Core ToolRegistry executes registrations; optional Support reduces repeated wiring, and authorization constraints come from the actual declarations |
| Continue/end conditions and business error exits | AgentCoreEngine executes according to registered flows |
| Knowledge reading, visibility scope, sources and versions | Kits such as Knowledge process provided data under local contracts |

Next, follow [Model and tool integration](basic-usage.md) to complete text calls, tool proposals, and real execution in order. ModelRunner.invoke is one complete model call; multi-step execution is explicitly orchestrated by the App with existing Core APIs. For parameters and errors see [Core](api/core.md), [Support](api/support.md), and [Kit](api/kits.md).

## Knowledge and output integration

- [Knowledge documents](knowledge.md): sections, versions, selection, and snapshots; parse/define process only in-memory data and create no storage.
- [Knowledge answering contract](api/knowledge-answering.md): the local interfaces of Knowledge, Answering, and Presentation, connected by the App through reader, authorization, model, review, and output.
- [Manual maintenance](maintenance.md) and [Agent-assisted development](agent-development.md): shared rules and scripts for maintaining existing code and knowledge.
- [Operations](operations.md): Core output, Support observer, App logs, cancellation, and budget.

Prepare knowledge faithfully when raw material exists; when there is only an idea, keep knowledge empty with open items, and do not write speculation or demo text as facts. Knowledge growth is carried by the existing App's authorization, storage, and update flows.

## Lifecycle wiring

Static declarations can be validated during the existing project's assembly stage; user materials, read evidence, consumed budget, and session state should have explicit request/session ownership. Do not store mutable current-request state in objects shared across users.

Before integration, verify small-scope behavior that has no real side effects, then verify real models and business execution as needed. The call code in the documentation is not a standalone application template, and it does not automatically grant publication or operation permissions.

## Debug with a mock model

When there are no model credentials, use the [MockGPT Kit](api/mock.md) to configure fixed replies, input-dependent generators, tool proposals, and failures. Direct calls are imported from `@jangts/agent-core/mock`; when a standalone HTTP model service is needed, use createMockServer from `@jangts/agent-core/mock/node`. Point the model client at its local address, and the application's workflow, tool authorization, and budget contracts stay the same.

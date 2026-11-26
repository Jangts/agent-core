# Build by API responsibility

Follow the application call chain: obtain a model result, execute real tools, then compose multi-stage tasks with a workflow. Core defines execution contracts, Support constructs integration implementations, and Kits supply optional business capabilities inside App handlers.

## 1. ModelRunner: results and request lifetime

Reuse `new ModelRunner({ provider })` across requests. Each top-level `invoke` has independent budgets, cancellation and records. For several calls in one request, use `runner.bind(execution)` and read statistics and Journal on that binding. A shared host has no current request and rejects request-statistic reads. Engine binds a shared Runner per run; an existing binding retains its cumulative budget.

Successful `invoke` returns `{ value, invocation }`; failures throw. Read the complete result from `value` and consume live chunks through `sink.output`. Subclass overrides retain their real receiver and use `this.bind(request.execution)` for execution records. Keep request data out of shared instance fields.

Read [model contracts](/manual/api/core), [model protocols and lifecycles](/manual/api/model-protocols), and [requests, call chains and Journal](/manual/api/observability).

## 2. Tools: declaration, authorization and execution

Declare tools with `Support.defineToolCatalog`, then bind dependencies through `catalog.bind({ app, execution })`. `tools.invoke({ toolId, input })` parses input, authorizes, executes and checks output, returning `{ value, invocation }`. A model-selected tool and arguments are a proposal that must pass this execution boundary.

Use `@toolbox` for class-owned tool declarations and same-named handlers. `ParseInput` and `ParseOutput` convert values; `Authorize` supplies common and additional permission checks. JSON Schema validates before optional input conversion. Common authorization runs before additional authorization, and failed registration publishes no partial tool group.

Read [tool integration](/manual/basic-usage), [Support](/manual/api/support) and [decorators](/manual/api/decorators).

## 3. Workflows: commit, route and finish

Assemble nodes with `defineWorkflow` or `AgentWorkflow`. Nodes return state patches. After commit, routes inspect the latest state: `route.to` continues and `route.deliver` completes delivery. Routes match in declaration order. Call `context.model.invoke` and `context.tools.invoke` inside nodes to retain budgets, cancellation, authorization and receipts.

Object nodes and `@node` definitions implement the same contracts. `@agent` registers actual Engine subclass instances and `@model` registers actual Runner subclass instances, with explicit constructor arguments. Select nodes and their order with `nodePool.pick(ids, ns)` rather than module import order.

Read [Workflow](/manual/api/workflow), [classes and namespaces](/manual/api/decorators) and [graphs and execution chains](/manual/api/workflow-views).

## 4. Set context, budget, and recovery boundaries

Use `Support.defineContextFragments` to declare sources, trust, and size limits. Use the same prepared handle to measure and invoke when you need to account for the actual input. Apply `replyGuidance` to relevant user-facing reply calls.

`maxCalls` is the initial request allocation and `maxTotalCalls` is the host ceiling. Assess the work remaining before adjusting a bound request. Spent attempts and ancestor reserves remain in effect. Retain actual receipts so format repair and deterministic fallback can reuse confirmed results. Reconcile writes whose outcome is unknown.

[Context processing](/manual/api/context-processing) · [Resources, completion, and recovery](/manual/api/reliability) · [Reply organization](/articles/reply-organization)

## 5. App handlers: optional Kits

Choose knowledge, answer checking, retrieval, artifacts and durable tasks as needed. Kit-local contracts do not become mandatory Core state. App owns identity, factual sources, persistence and side-effect authorization.

Read [knowledge answering](/manual/api/knowledge-answering), [Kits](/manual/api/kits) and the [complete offline example](/manual/examples/offline-agent). Install `@jangts/mock-gpt` separately before using `/mock` entries.

For personal memory, cross-process recovery, or accepting a reviewed result, start with [memory snapshots](/manual/memory-and-learning), [bounded subtasks and durable tasks](/manual/api/advanced-agents), or [result review and decisions](/manual/api/result-review). The App supplies the relevant data scope, current authorization, and storage ports.

## Find exact declarations

The [public API directory](/api/) derives signatures and overloads from current source exports; the [module directory](/api/modules) groups import entries. Read the [API handbook](/manual/api/) for behavior, then inspect symbol pages for exact parameters.

[Find examples by resilience guarantee](/recipes/) · [Upgrade an existing integration](/manual/upgrading)

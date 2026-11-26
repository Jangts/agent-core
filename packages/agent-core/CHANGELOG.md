# 变更日志

本文件记录 `@jangts/agent-core` 的行为变更。接口合同与使用方式见[API 手册](development/docs/api/README.md)。

## 1.0.0

Changes include the 0.9.0 development work below.

### Added

- Add `Waiting` for authorized submissions with stable wait identities, cancellation and retry handling. Add `Durable` recovery for interrupted side effects with explicit completed, not-executed and unknown outcomes. Branch composition aggregates independent results and detects conflicting state patches. See the [advanced agents guide](development/docs/api/advanced-agents.en.md).
- Add explicit model provider integrations for OpenAI Chat Completions and Responses, Anthropic Messages, and Gemini GenerateContent and Interactions. Supported capabilities cover ordered media, scoped continuation, authorized hosted search, background operations, native batch and bounded realtime sessions. See the [model protocol guide](development/docs/api/model-protocols.en.md).
- Add result review, decision and selection APIs for checking evidence and coverage and accepting an existing result. Apps provide authorization and persistence. See the [result review guide](development/docs/api/result-review.en.md).
- Add the optional `@jangts/agent-core/kits/memory` entry with evidence-linked updates and retractions, expiring goals, and bounded source batching, review and context selection. Apps manage storage, access policy and scheduling. See the [memory guide](development/docs/memory-and-learning.en.md).
- Add per-call `replyGuidance` and `Support.resolveReplyGuidance` for trusted App, node and tool defaults. Explicit user requests for detail and format still apply, together with the call's output protocol. See the [reply organization guide](development/articles/reply-organization.en.md).

### Changed

- Standardize public names around ModelInteraction, DomainTool, LifecycleTool, ReportedStepRecorder, WorkflowRunTrace, BranchVersioning, AgentSnapshot and DeliveryPipeline. Supported aliases share the canonical implementation. Existing record identities and stored formats retain their own contracts.
- Update the optional `@jangts/mock-gpt` peer to `0.3.0`. The `/mock` and `/mock/node` entries expose the new duplex and WebSocket helpers when that peer is installed.

### Fixed

- Preserve confirmed remote results when a host save fails. `MODEL_OPERATION_SAVE_UNCONFIRMED` includes the confirmed result and original cause for reconciliation.
- Bound background and batch response sizes and batch JSONL line sizes. Report `BATCH_ITEM_TERMINAL_MISSING` for items without a recognized terminal event.
- Reject premature realtime sends and stale interruption events, and preserve the cancellation reason through WebRTC connection setup.

### Upgrade

- In custom adapters, the 0.9.0 single-selection `PreparedModelInteraction<Result>` becomes `PreparedModelSelection<Result>`. The 1.0.0 `PreparedModelInteraction<Result>` is the final-result contract previously named `PreparedModelTransport<Result>`. Manually constructed `WorkflowContext` and `ToolExecutionContext` objects must supply `createStepRecorder`. Review the full migration in the upgrade guide ([English](development/docs/upgrading.en.md) · [中文](development/docs/upgrading.md)).

## 0.9.0

Unpublished development version.

- Add optional lifecycle matrix inspection, intent and tool reference checking, navigation from recorded hooks to nodes, and affected-node reporting in declaration diffs. Include a runnable example with actual Tools Kit hooks, combined decisions, authorization, cancellation and recovery.
- Let hosts adjust call budgets within an active request while preserving consumed attempts, budget ceilings and ancestor reserves. Add remaining-work assessment, targeted Completion Kit checks and explicit request recovery.
- Report unregistered native tool calls as `MODEL_UNREGISTERED_CALL`. Other protocol failures continue to use `MODEL_PROTOCOL`.
- Add nine bilingual technical articles with links to the associated APIs, Skills and scripts.

## 0.8.1

Published on npm on 2026-11-20.

- Add the resilience review Skill for application-side data processing, task-based quotas, sectioned knowledge retrieval, context compression and completion under limits.
- Add the App testing Skill, a Node.js runner and eight offline examples covering Agent features, workflow nodes and tool contracts. Select cases by layer or ID. Offline workflow scenarios receive the test cancellation signal.

## 0.8.0

Published on npm on 2026-11-20.

- Bundle a Node.js workflow inspector that exports the registered graph, checks declared references, and renders a self-contained HTML report. It can watch explicit source files and show a separately supplied recorded run.
- Bundle a declaration diff for route priority, recovery, tool schemas and adapters. The report links changes to the nodes that reference them.
- Bundle an offline scenario runner for the actual App Engine with scripted model replies, covering authorized and denied tool paths, recovery and call counts.
- Add development Skills for node design, model budget optimization, workflow inspection, change review and offline regression. See the [workflow development handbook](development/docs/workflow-development.en.md).

## 0.7.0

- Publish reusable task methods through `@jangts/agent-core/skills` and bundle their `SKILL.md` sources.
- Include import preflight, data-quality review, and record reconciliation. App handlers supply source data, authorization, and execution receipts.
- Validate every workflow state write before applying a node update and preserve the search index when custom tokenization fails.

## 0.6.0

- Validate common toolbox authorization before additional checks, preserving cancellation and synchronous calls.
- Reject ambiguous execution-state reads on shared Runners; subclass overrides use the existing execution binding for request statistics, journals and cancellation.
- Consume asynchronous token-counter rejections and reject lossy retrieval-query keys at every depth.

- Isolate shared Runner execution state per invocation; bind existing execution options for cumulative multi-call budgets, cancellation and journals. Engine binds shared Runners per run while retaining request-bound guards and subclass receivers.
- Reuse fromJsonSchema compile/error in toolbox registration; compile shared schema objects once per group, validate before optional ParseInput conversion, and publish atomically.


- Register actual ModelRunner and AgentCoreEngine subclasses through model/agent decorators, preserving instance identity and explicit constructor arguments.
- Define shared-host tool groups with toolbox metadata, class JSON inputSchemas, ParseInput/ParseOutput methods and common/additional Authorize checks; publish groups atomically.
- Remove the workflow decorator and workflowPool; construct graphs through defineWorkflow or AgentWorkflow.

## 0.5.1

- Use GoalRegistry / GoalTool for domain targets; discovery remains asIntent metadata. Allowed next steps belong to the goal declaration; goalDelegates derives default choices from tool membership and terminal protocols; explicit allowed sets are not widened by registration.
- Select demand entry points and explicit continuations through select parameters; derive candidate descriptions, activation and name/input schemas from the selected catalog.
- Use the owning tool id for lifecycle dispatch and protocol lookup; remove delegate and lifecycle.id registrations. The optional toolId selector only adapts custom decision shapes.
- Select session responses with createModelTransport({ response: 'session' }); pass decoded calls directly to the existing runtime.invoke boundary.
- Keep a single ToolLifecycleRegistry constructor name across public entries and preserve App data metadata in executable catalog projections.

- Separate executable declarations from model result mapping: executable model projections always propose raw arguments; custom mappings belong to model tools.
- Share immutable registered entries across catalog selections and demand views; align activation filtering and bind runtime model views to the App context.
- Preserve original receivers for discovery predicates through executable, domain, lifecycle and association adapters.
- Name session results `DecodedSessionResult` / `DecodedSessionCall` to distinguish JSON decoding from validation, resolution, authorization and execution; unknown tools have no decoded inputs.
- Allow empty model selections and reject explicitly inactive tools during direct model resolution.

## 0.5.0

- Add the optional `TextBlocks` Kit: structure-aware splitting of long plain text into numbered blocks with source offsets and exact reassembly; paging, search, storage and prompts stay with the App.
- Reject mutable context fragments whose declared field set changes through a `null` value, and merge tool model fields as own data properties so `__proto__`-like keys cannot rewrite the merged prototype.
- Keep Kit implementations out of Core barrels: `/context` and the capability registration surface expose Core helpers only, while Kit helpers remain available from `/kits/*` and the documented root convenience surface. Remove the unused execution barrel.
- Make `@jangts/mock-gpt` an optional peer dependency used only by the `/mock` entries instead of a production dependency; install it explicitly to use those entries.
- Support native tool threads in Core: `ModelMessage` accepts assistant `toolCalls` and `role: 'tool'` results; preparation preserves and counts them, and `ModelCallTrace.calls` records every completed call while `functionCall` keeps its single-call meaning.
- Add the opt-in `Support.createSessionModelTransport`: one response may contain prose and several tool calls. The resolved `toolId` / `input` / `problem` fields live in Support; Core only exposes raw `ModelSessionResult`. `nativeFunctionInteraction` and its single-proposal contract remain unchanged.
- Keep the Core `/model` barrel free of Support implementations; named Support exports remain available from the package root and `/support`.
- Keep Kits available from the root convenience surface and from `/kits` / `/kits/*` subpaths. Kits remain optional, not restricted; Apps may use whichever entry is convenient.
- Add `ModelOptions.toolChoice` and `parallelToolCalls`, including `'omit'` for leaving the wire field out; defaults keep `tool_choice: 'required'` and `parallel_tool_calls: false`.
- Unify model interfaces as ModelTool and ModelToolRegistry; transports use tools / toolIds, selections use toolId, and the JSON adapter uses a name/input envelope. Skip the 0.4 series.
- Add asIntent discovery metadata and active conditions, with node-owned withIntent(context) and explicit selection. Intent has no independent identity or aggregation registry.
- Preserve executable, lifecycle, domain-policy and preview extensions. Derive model interfaces from executable tools without parsing business arguments twice; retain authorization, cancellation, budgets and receipts.
- Add WorkflowTool / WorkflowNode names and separate Intent decorators for classes and methods, with order-independent ESM/CJS metadata. Tool decorators reject inline asIntent.
- Retain explicit owner-to-tool associations and local provenance without transmitting registration sources to the model. Domain delegates remain allowed sets with optional explicit overrides.
- Add one optional `lifecycle` block per tool in place of separate invocation and contribution objects, and one optional `delegate` field that claims a dispatch id. The registry keeps a unique `delegateId → tool` index, so `call(next, context)` stays the single dispatch path; `inspect` runs once for every tool and the remaining selected-only hooks run for the tool that owns the decision.
- Rename request-tool vocabulary to goals across the domain catalog: ports use `goalIds`/`goals`, projections expose `goalCatalog`/`goalDelegates`, and the model catalog returns `availableGoalIds`/`availableGoals`.
- Name lifecycle dispatch by `lifecycle.id`; `ToolsOptions.invocationId(decision)` selects the handler, `call(next, context)` routes on `next.type`, and the missing-handler factory is `unavailableInvocation(invocationId)`. No `step` field remains in the lifecycle contract.

## 0.3.6

- Preserve explicit recovery targets from workflow error events as execution-chain transitions linked to the original errorEventId.

- Export immutable Workflow topology with toGraph() and observed per-visit execution chains with toChain(runId); keep ordered append-only subflow records and App-owned authorized read sources.
- Snapshot routes getters exactly once during node registration for execution and graph export.

- Shorten registered subnode IDs to node-local kind/definition/ordinal identifiers; retain real call correlation in relatedInvocationId.

- Separate arbitrary business type from write/fix operation and add explicit subnodeId grouping.
- Independent full/scoped logger classes share one owning store and full readAll history. Scoped delegates bind writes, restrict fixes, cannot fork, and cannot invoke; actual invocations bind their existing execution identity.
- Rejected writes/fixes keep sentinel returns and emit safe, deduplicated developer warnings.

- Optional per-call logger for native model/tool/invocation and executable Kit boundaries; omitted loggers add no sub-logs and are never inferred or globally forwarded.
- Every accepted fix appends an independently identified record referencing the original write through targetStepId; readAll preserves the full write/fix ledger in append order.

- Bind each sub-flow logger to its execution context; write/fix commit immutable snapshots immediately to runtime and notify App observers through node.progress.
- Remove logger submission through report.subs; readAll remains a read-only local query. Terminal events use runtime-owned snapshots and detached visits return write=-1 / fix=false without throwing, while every holder retains readAll access.
- write returns the new ID on success and -1 on any failure; fix returns a success boolean for every attempt; invalid revisions and detached instances return false without throwing. Retained loggers remain readable across visits or external borrowing.
- Tool debugSteps hooks write through their bound context and no longer return a logger.

## 0.3.5

- Add decorators and typescript-decorators keywords for npm discovery; preserve the English-first getting-started README.

## 0.3.2

- Expand the English-first bilingual README with runnable workflows, model configuration, tools, decorators, knowledge and task-based documentation links.

## 0.3.1

- Shared per-kind decorator readers with namespace isolation: ns defaults to 'default', accepts multiple namespaces, and leaves original ids unchanged. Read via get(id, ns?), getAll(ns?) and pick(ids, ns?). No public pool factories or owner lookups.
- Host-method decorators automatically bind and register during instance initialization. Constructor failures are wiring failures and do not roll back completed initialization registrations.

- Named decorator implementation types: Node, Tool, Fragment, Workflow, Agent and Model; class examples no longer repeat Omit.
- Decorator class constraints preserve union branches, including required App dependencies in Engine configurations.

## 0.3.0

- Optional standard class and instance-method decorators in `/support/decorators` for nodes, tools and fragments; class decorators for workflow, Agent configuration and ModelRunner options.
- Classes are constructed once as definitions; methods bind the real host and preserve private state. The decorator supplies id without creating Engines, Runners or request budgets.
- Explicit DefinitionPool registration/read/selection/sealing and owner-local definitionOf reads, including ESM/CJS cross-reading of the same decorated owner.
- Original object APIs, execution, authorization, cancellation and 0.2.5 cache semantics remain unchanged. Bottom-level function converters are internal only.

## 0.2.5

- Engine-owned, bounded LRU `context.cache` with node partitions and optional write TTL.
- Optional asynchronous App-owned `context.agentCache`; persistent and volatile spaces are explicit, independent and never silently fall back.
- Both workflow and `$step` contexts expose the same cache operations; forks have fresh memory and only use an explicitly restored App cache port.
- Vector filter, grouping and returned-hit metadata use independent snapshots so callback mutations cannot affect later consumers.

## 0.2.1

### 变更

- 许可调整为 Apache License 2.0，补充 `LICENSE` 与 `NOTICE`。
- 运行依赖 `@jangts/streaming` 更新为 `^0.1.2`。

## 0.2.0

### 新增

- `CompatibleModelPorts.completionPolicy`：宿主可注入完成判定策略。未注入时使用 `Support.completionPolicyCatalog.default`，请求、完成规则与 `MODEL_*` 分类与旧版本逐项一致。
- `Support.completionPolicyCatalog.session`：按实际下发请求体中的 `tool_choice` 判定的标准会话完成策略，覆盖 `auto`、`required`、指定函数、`none`、字段省略与未知值。
- `Support.createToolCallCollector`：按 index 聚合调用分片的共用实现，完成策略与直连调用方使用同一算法；ID 冲突、跨 index 重复 ID 与残缺调用按协议错误拒绝。
- `ProviderMessage`：直连 Provider 的工具线程消息类型；`chatCompletionMessages` 显式映射 `tool_call_id` 与嵌套 `tool_calls`，不做整体透传。Core `ModelMessage` 与 `ChatProvider` 抽象签名不变。

### 修复

- 工具线程消息只发送声明字段，不透传原始 wire 字段或宿主附加数据；动态输入校验角色、正文类型及工具结果的非空字符串 ID。

- 兼容 Provider 的 CommonJS 产物与 ESM 产物恢复一致：调用记录草稿的类型不再因只读耗时字段导致编译失败，`dist/cjs` 重新生成并导出完成策略与 collector。

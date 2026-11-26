# Concepts and responsibilities

Agent Core names describe actual responsibilities. The same object keeps a consistent meaning across APIs, configuration, examples and diagnostics; similar names do not collapse different lifecycles or kinds of evidence.

## Execution and state

An Engine coordinates one run. A Workflow defines nodes and routes, a Node is a schedulable handler, and State is host-owned runtime data. ModelRunner enforces model-call budgets, cancellation, input/output boundaries and result contracts. A Provider implements model capabilities; an Adapter maps their expression. A service brand is neither authorization nor proof of capability.

WorkflowGraph is registered static topology. WorkflowRunTrace records observed visits and transitions, permits repeated visits to the same node, and states its coverage. A ReportedStep describes an internal process reported by an App or an explicitly instrumented native boundary. It is not an executable subworkflow and does not automatically prove completion of a business action.

AgentSnapshot captures host data and branch identity, not an arbitrary workflow execution cursor. DurableCheckpoint contains the recovery position and bounded execution state of a sequential task. BranchVersioning manages App state versions on branches, merges and the active pointer. A BranchVersionRecord CAS revision is not a storage-format version. These capabilities do not imply multi-agent scheduling or general program recovery.

## Model interactions and tools

ModelInteraction describes request expression, response collection and parsing. A network Transport carries HTTP, SSE or duplex traffic; it does not choose business tools. PreparedModelSelection is a single-selection adapter's prepared output. A PreparedModelInteraction collector returns the final typed result. One finite response containing text and multiple tool proposals is not a long-lived realtime session.

A DomainTool declares an optional domain operation. An execution tool owns real handling, authorization and result contracts. A LifecycleTool adds optional contributions and phase hooks while retaining Core's actual invocation path. `asIntent` and `select({ intent: true })` project registered tools for intent recognition; they neither discover tools dynamically nor authorize execution. App business fields such as goal may express a user's objective without becoming a separate SDK domain-tool entity.

A Proposal is a proposal, a Selection is a parsed choice, and an Invocation is an actual call. Provider-hosted execution and local tool execution have separate authorization and receipt facts. Function-specific wire structures retain Function terminology; the word Tool does not imply support for arbitrary tool categories.

The canonical host catalog uses `domainTools`, `executionTools`, and `domainToolIds`. The existing `modelCatalog` projection retains `availableGoals`, `availableGoalIds`, and `goalIds` as model-protocol fields. Diagnostic categories, saved fields, and private implementation paths are not mechanically rewritten when public source names change.

## Context, records and delivery

ContextFragment is an input fragment, ContextPlan is the pre-assembly plan, and BuiltContext is the assembled result. `trust` participates in role restrictions and structural auditing; it is not merely a source label. ContextJournal stores selected request-local call facts relevant to context, not a complete invocation ledger, chat history or persistent recovery log.

A Registry owns registration and sealing, while a Catalog exposes a directory view. An installation catalog may also have an ordered local contract: its name does not permit early predicate evaluation or different failure semantics. Definition, Options, Settings, define, create, register and bind follow their concrete responsibilities without requiring every capability to add the same wrapper layer.

DeliveryPipeline runs declared delivery stages in order and completes explicitly; it is not a general Workflow. Reflection analyzes observations, hypotheses and recommendations from authorized evidence. It does not automatically learn, change policy or publish conclusions. A text Skill supplies instructions, not an executable handler or permission.

## Disagreement and acceptance

Conflicting materials, field-merge conflicts and cognitive disagreement are different concepts. A confirmed ResultReview finding means reproducible disagreement, not factual truth; complete coverage does not guarantee correctness either. Waiting `resolved` only means an answer was recorded. Decision answers, proposed resolutions, result acceptance and business commits have separate contracts.

Stopping a wait, requesting cancellation, confirming termination and an unknown state are distinct. Execution completion does not establish result acceptance or business commit. Identity, content revision, policy revision, CAS generation, attempt count and format version must not be conflated.

# Node and tool lifecycle matrix

A matrix separates reusable execution stages from tool lifecycle hooks. It suits Apps with many capabilities and similar processing stages, including a combined goal and next-tool decision. Use-case organization suits independently owned outcomes, authorization and recovery; exploration suits actions selected from new evidence. Apps may combine them. Node counts and graph shapes are not quality scores.

## One declaration drives execution

The [runnable example](lifecycle-matrix.mjs) uses existing `AgentCoreEngine`, `Support.defineToolCatalog` and `ToolLifecycleRegistry`. One model response supplies `{intent, next}`. Program logic checks the pairing and runs real inspection, authorization, execution and completion hooks. Known dependencies, counting and actual permissions do not require model judgment. Available facts can be delivered directly; a real task may need another model call to interpret newly retrieved evidence. One combined decision does not imply one call per entire request.

Tool inventory, hook wrappers and inspection metadata derive from the same definitions and stages. The registry runs `inspect` and `visibleText` across all registered tools, and `authorize` and `complete` only for the selected tool. Undeclared hooks leave empty cells. Matrix relationships are not topology edges and do not mean every tool executes. This example enters the matrix for status and directly delivers greetings. Export App scope from actual registration and dispatch, never tool-name guesses.

```sh
node node_modules/@jangts/agent-core/development/docs/examples/lifecycle-matrix.mjs
node node_modules/@jangts/agent-core/development/scripts/workflow-inspector/cli.mjs inspect \
  --entry node_modules/@jangts/agent-core/development/docs/examples/lifecycle-matrix.mjs \
  --output .tmp/matrix.html
```

Importing the entry executes no model, tool or App. Direct execution uses in-memory tools and a scripted Provider, without credentials or network. In the source repository replace `node_modules/@jangts/agent-core` with `.`; run `node --test test/lifecycle-matrix.test.mjs` for the regression entry.

## Optional inspection snapshot

Supply `lifecycleMatrix` in `inspection` or a JSON snapshot:

```js
const lifecycleMatrix = {
  intents: [{ id: 'status', toolIds: ['read'], description: 'Explain service status' }],
  bindings: [{
    id: 'authorize/read/authorize', nodeId: 'authorize', toolId: 'read',
    hook: 'authorize', handler: 'authorizeRead', mode: 'selected', intentIds: ['status'],
  }],
};
```

Intent IDs are unique and toolIds have no duplicates. Bindings have unique stable IDs, actual nodeId/toolId references, hook and handler descriptions, `selected` or `all` mode and nonempty unique intentIds. The bound tool must belong to every listed intent's toolIds. This is optional App explanation metadata, not a mandatory Core Intent registry. IDs impose no business vocabulary; the inspector never invokes hooks or handlers. An absent matrix remains unknown and does not reject other organizations.

The inspector validates node, tool, intent pairing and unique references; absent tool registration status stays unknown. Click stages and tools in the report. Diff compares `matrixIntents` and `matrixBindings`, tracing direct affected nodes. Legacy snapshots remain accepted. If either side omits a matrix, diff marks it unexamined rather than proving it unchanged.

## Recorded execution and evidence

The example uses `context.createStepRecorder()` at invocation to record `relatedDefinitionId = binding.id` with success or error status. Obtain `workflow.toTrace(runId)` through an authorized App source and attach `--trace run.json --run-id ID`. Cells match nodeId and relatedDefinitionId for each recorded span; click a record to inspect it. Repeated visits retain separate span identities.

A match establishes an App-reported hook record, not correct authorization, business completion or successful writes. Missing observations do not mean a hook did not execute: incomplete chains, old definitions and logging limits may leave gaps. Unknown extensions and event bodies remain omitted. Review source, handler and intent descriptions for the intended audience.

## Failure and quality checks

Offline cases verify direct greetings, a combined decision, all/selected hook scopes, pairing and permission rejection without execution, truthful model/tool failure recovery, committed facts and answer preservation after optional presentation failure, terminal cancellation, diff impact and matrix-to-run navigation in the actual HTML script. This read-only example does not implement writes, budget expansion or semantic summarization. See the [organization comparison](organization-comparison.en.md) for budgets, long context and unknown writes.

Real Apps must also validate first-choice quality, interpretation of new facts, visibility, live permissions, remaining necessary work, protected compression, unknown-effect reconciliation and delivery recovery. These quality contracts apply to matrices, use cases and exploration. Cafe retains its own goals, tools and permissions; this fixture does not import them.

Matrix toolIds describe lifecycle participation, not permission to invoke. A presentation-only contributor may participate in all-tool phases. Project callable candidates from the same declarations and actual visibility conditions. The example note contributor is hook-only; proposals to invoke it are rejected before execution.

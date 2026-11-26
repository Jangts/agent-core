# Context node

Core accepts text, messages, BuiltContext, or ContextPlan, and is responsible for generic input assembly, trust and structure constraints, actual request measurement, and the final budget. The App chooses assembly, selection, grouped trimming, summarization and retention policies and supplies the required business handlers. Support Workflow nodes execute the configured general processing flow; Core enforces trust, structure and budget boundaries. Apps can reuse that flow or provide custom nodes.

For the recommended path from direct messages to fragments and processing nodes, automatic behavior and module responsibilities, see [Prompts and context](../../articles/prompts-and-context.en.md).

## Progressive configuration from a single call

When no processing is needed, call `runner.invoke({ input })` or `context.model.invoke({ input })` directly. An over-limit ContextPlan is rejected; processing steps are never inserted implicitly.

When processing is needed, register a Support node in the same Workflow:

```ts
const processing = Support.createContextProcessingNode({
  id: 'context', description: '处理本轮上下文',
  plan: state => state.plan,
  request: { stageId: 'reply', interaction, maxOutputTokens: 1000 },
  policy: { mode: 'reduce', steps: [
    { id: 'summary', kind: 'compress', fragmentId: 'history',
      targetChars: 4000, handlerId: 'summary' },
  ] },
  compressors: [compressor],
  update: result => ({ input: result.input, prepared: result.prepared }),
  routes: [route.to('answer')],
});
// answer 是普通节点：
// (await context.model.invoke({ input: state.input, prepared: state.prepared })).value
```

The generator returns an ordinary WorkflowNode, configured through defineWorkflow and executed by agent.run. A custom implementation may supply the node's run directly. The canonical methods of plan, request, prepared, and update bind their receiver at assembly time, and the policy and handler lists form a snapshot; the App service keeps its original identity.

## Explicit selection and compression

When selection, compression, and assembly must be observed separately on the main graph, use three ordinary nodes and let App routing decide the execution order:

| Generator | Actual work | Result |
| --- | --- | --- |
| createContextSelectionNode | Validates candidates and protection boundaries, selects affordable registered steps by policy | ContextSelectionResult: plan, prepared, stepIds, report |
| createContextReductionNode | Executes one trim or compression specified by stepId, audits the result | ContextStageResult: processed plan, prepared, report |
| createContextProcessingNode | Processes according to configuration and completes assembly; the default validate only checks and assembles | ContextNodeResult: input, prepared, report |

The three generators use the same base node fields, plan/prepared/request inputs, and update output mapping. Subsequent nodes reuse the previous node's handle through the prepared callback, avoiding a second dynamic prepare. The App chooses its own state fields; these Support results do not become global state required by Core. An independent implementation still only needs to satisfy the input/output contract of the corresponding Workflow.

The same over-limit data is rejected when processing is not enabled; adding selection, reduction, and assembly nodes allows it to continue. When replacing the reduction node, a standalone class only needs to provide the same id, run, and routes and preserve the plan's audit input; Core's enter facts prove that the node was actually entered.

## Scenario recommendations and precise overrides

`createContextStrategy` generates the same node configuration from registered fragments:

```ts
const strategy = Support.createContextStrategy({
  kind: 'continuity', fragment: historyDefinition, field: 'history', compressor,
  targetChars: 4000, keepGroups: 3,
});
const node = Support.createContextProcessingNode({
  ...strategy,
  id: 'context', description: '保留近期原文并整理旧历史',
  plan: state => state.plan,
  update: result => ({ input: result.input, prepared: result.prepared }),
  routes: [route.to('answer')],
});
```

recent generates a local window of complete rounds without calling the model; continuity generates a summary of the old segment plus protection of recent raw text, and model cost depends on the supplied compressor. Step IDs, handlerIds, and the registration array are generated from the same input. targetChars defaults to the fragment's maxChars, grouping defaults to user-turn, and keepGroups defaults to 1; explicit values take precedence, and 0 is not treated as a default. When a model selector or a fully custom policy is needed, add the same node's policy or selectors, or replace the node implementation directly, without switching the dispatch protocol.

## Low-level configuration of recommended strategies

Support.ContextPolicy has three modes:

| Mode | Behavior |
| --- | --- |
| validate | No reduction; only validate and assemble |
| reduce | Select limited processing operations by steps and selection |
| audit | Inspect fragments before and after App processing; only mutableFragmentIds may change values |

reduce selection methods are sequence, fixed, auto, and model. Without a configured selection, steps run in order; fixed restricts to trim or compress; auto previews trim loss for complete groups, prefers safe trimming, and otherwise chooses affordable compression; model calls a registered selector that returns a step ID. Selectors cannot provide new tools, handlers, permissions, or budget.

auto's maxTrimLossRatio defaults to 0.25; it is a JSON character-reduction heuristic, not semantic loss or an optimal-quality guarantee. Multiple trims of the same fragment accumulate, and small steps cannot bypass the limit. An empty selection means there is no safe processing item; a final over-limit is still rejected and is not disguised as successful processing.

triggerChars／triggerTokens are early trigger watermarks; targetInputChars／targetInputTokens are soft targets. Each step runs at most once; if the soft target is not reached but the final hard limit is satisfied, execution continues, while exceeding the hard limit is rejected. Trim targets use the full JSON length of the fragment value and cannot cut a single message.

## Protection, grouping, and raw text

Fragments keep id, sourceId, trust, role, lifetime, maxChars, and structured top-level fields. Fragments from system, instruction, and those outside the processing list are immutable. Reduction results cannot grow longer, and low-trust history is never promoted to instructions. Auditing can only prove structure and boundaries, not that summary facts are correct.

History supports fixed complete groups or user-turn grouping. user-turn starts at a user message and keeps the multiple assistant messages after it plus a user round that has not yet been answered; isolated openings, unknown roles, and non-text entries are rejected for processing. Recent raw-text retention is configured in the compression step:

```ts
{
  id: 'summary', kind: 'compress', fragmentId: 'history', targetChars: 8000,
  handlerId: 'summary',
  preserve: { field: 'history', keepGroups: 3, grouping: { kind: 'user-turn' } },
}
```

Support passes only the old segment to the handler and stitches the recent tail back unchanged. The return value must maintain fields and legitimate grouping. If the preserved content itself exceeds the limit, it is rejected rather than deleted; with no old segment, the summary model is not called. The App decides the retention count, fact checking, and whether to persist the summary; this capability does not modify history storage.

Core's ContextPlan can provide trusted originalFragments and mutableFragmentIds for generic diff auditing; it does not send the original fragments to the model. Additional image messages are retained through additionalMessages, and their text counts toward the body budget. Image binaries continue to follow a separate input boundary.

## Actual measurement and quota

The node prepares one real interaction and reuses the same snapshot for measurement and sending. The body is constrained by maxInputChars, and interaction instructions and declarations by maxSchemaChars; if a JSON Schema is embedded in the instructions, it is not double-counted in the actual total. When tokenBudget is configured, the counter receives the actual neutral request fields including instructions, Schema, and images, and deducts the output reservation and safety margin; Core does not guess the character-to-token ratio or provider capacity.

Actual input continues to be validated before the final Provider call. Node estimates, processing reports, and withinBudget are not release credentials. The prepared handle belongs to this Runner／Workflow request and can be consumed only once.

The selector/compressor maxCalls declares the model calls available per handler, defaulting to 1, with 0 for pure local implementations. Support enforces callModel and shares the same total quota of the Runner／Workflow. auto/model reserveCalls default to at least 1 to protect the final answer; candidate budgets are judged conservatively by the declared maximum call count. Core still deducts actual calls atomically and does not refund failures.

Node processing deadlines default to Core's basic single-run limit and can be precisely overridden with timeoutMs; they combine with the parent signal and do not extend the deadline. Internal model requests also receive that signal. Handlers that ignore cancellation, late results, and suspended content sinks must not commit success.

## Process observation

Selection, compression, and assembly use the start, transition, completion, failure, and duration facts of ordinary nodes. context.report adds an approved processing report; nodes do not create spans, write logs, or manage diagnostics. Listening and persistent log switches are independent; see [Process observation](observability.en.md#state-and-output-during-a-run) for details.

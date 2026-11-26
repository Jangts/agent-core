// English prose for support-context.mjs; code samples stay in the Chinese source module.
export default {
  'context-fragments': {
    title: 'Context fragments: explicit source, trust, and budget',
    summary:
      'Core recognizes fragments and the assembly contract, validates source metadata and budgets, and has no built-in business compression algorithm.',
    details: `A fragment contains id/sourceId/trust/lifetime/maxChars/role/value. trust describes source semantics and does not grant system permissions to data; external raw text is still data. Assembly outputs BuiltContext, containing messages, fragmentUsage, and character usage.

assembleFragments validates and assembles in the registered order and does not silently truncate over-limit fragments. assembleContextPlan audits the original fragments and the mutable range before assembling; it does not call a model selector or compressor. The recommended selection and compression algorithms are provided by ordinary Support nodes, and custom nodes can also implement the same contract.

ContextPlan is a candidate fragment and budget plan, not a model request that has already been sent. fragmentUsage is usage metadata after assembly and must not be treated as the original fragments.`,
    examples: [
      { title: 'Assemble one input from bare configuration', level: 'Beginner' },
      {
        title: 'Add a candidate plan and final audit',
        level: 'Configuration',
        note: 'An empty mutable fragment list means the original fragments may not be modified; no compression step is authorized automatically.',
      },
    ],
    policyTitles: ['Fragment validation and budget rejection'],
  },

  'context-builders': {
    title: 'Context assembly: configure stable metadata once',
    summary:
      'Support binds fragment metadata, formatting, and order in advance, and requests supply only the changing business input.',
    details: `defineContextFragments suits a list that already has a complete fragment declaration; defineContextAssembly reuses another metadata catalog and contribution slots to avoid repeating source and budget configuration everywhere. Both return the same ContextBuilder contract, and fragments, plan, and build only represent different preparation stages.

maxInputChars can bind a fixed value or compute it from the current input, and a single request can still override it explicitly. A request is rejected when there is no budget source at all, and 'not set' cannot be interpreted as unlimited capacity. format/transform are synchronous and fix their original receivers; dynamic App service content is still read from the current input.

transformContextText uniformly transforms strings and nested strings inside objects and measures afterwards; it is not responsible for translation correctness or for promoting data into instructions.`,
    examples: [
      { title: 'Configure once, then supply only question and history', level: 'Beginner' },
      { title: 'The same builder produces a plan in advance', level: 'Configuration' },
      { title: 'Reuse a metadata catalog and request contribution slots', level: 'Extension' },
    ],
    policyTitles: ['Assembly order, dependency snapshots, and request budget overrides'],
  },

  'context-workflow-nodes': {
    title: 'Context processing is an ordinary Workflow node',
    summary:
      'Integrate selection, trimming, and compression through normal nodes and routes; Core records and schedules them uniformly.',
    details: `Support provides a complete processing node plus separately configurable selection and single-step reduction nodes; the final model call reuses the same PreparedModelCall, and measurement and sending share one transport preparation.

createContextProcessingNode selects the policy and completes assembly; createContextSelectionNode only returns allowed stepIds and does not execute reductions automatically; createContextReductionNode executes exactly one registered stepId. They are all WorkflowNode, not another execution framework, and the App uses normal routes to decide when to enter.

Nodes have this request's signal, deadline, and the same model port. Model calls used by selection and compression also consume ancestor quota and do not create new free requests; over-limit, protected-fragment changes, unknown steps, and late results are still rejected. Custom nodes can implement the same WorkflowNode contract without being constrained by Support algorithms.`,
    examples: [
      { title: 'Validate and assemble only, without compression yet', level: 'Beginner' },
      {
        title: 'Add a history trimming policy to the same node contract',
        level: 'Configuration',
        note: 'Put this node back into the same Workflow as the previous example; each run just adds history to State, and the model reply node does not change its interface. In a complete flow the reply target must exist.',
      },
    ],
    policyTitles: ['Configuration binding and stage execution for ordinary nodes'],
  },

  'context-policy': {
    title: 'Context policy: validate, reduce, and audit',
    summary:
      'Support provides replaceable policy implementations while Core keeps the final input contract and budget checks.',
    details: `The current ContextPolicy discriminant values are validate, reduce, and audit. validate only validates and assembles; reduce selects registered steps after a watermark triggers; audit checks whether App modifications stay within the declared mutable range.

triggerChars/triggerTokens control when to start, targetInputChars/targetInputTokens control the desired watermark, and the final hard budget is checked separately by request preparation and Core. Characters and tokens cannot be guessed from each other; without a counter, do not pretend to have token usage.

Reduction steps contain a real fragmentId, kind, and targetChars. trim specifies history grouping and the minimum number of retained groups, and compress specifies handlerId. Protected questions, system instructions, authorization, and evidence must not be rewritten arbitrarily. Reports record actual changes and usage and do not treat successful compression as a semantic quality guarantee.

Calling processContext directly accepts a ContextPlan, ContextPolicy, and execution options; usually prefer putting it in an ordinary Workflow node so process events and cancellation chains are naturally part of the Loop.`,
    examples: [
      { title: 'Explicitly use a validation-only policy', level: 'Beginner' },
      {
        title: 'Configure reduction order from real business fragments',
        level: 'Configuration',
        note: 'These numbers are explicit choices for the example business, not SDK recommendations for capacities that suit all models.',
      },
      {
        title: "Limit the mutable range for the App's own processing",
        level: 'Extension',
        note: 'Auditing also requires the ContextPlan to carry the original fragments; listing IDs alone does not modify or publish material by itself.',
      },
    ],
    policyTitles: ['Real scheduling catalog for policies and reduction operations'],
  },

  'context-selection': {
    title: 'Selecting reduction steps: sequence, fixed, automatic, or model',
    summary:
      'One typed policy set expresses multiple scenarios while preserving exact parameters and App-defined selection.',
    details: `sequence keeps the registered order; fixed selects a certain kind; auto prefers trimmable items whose loss ratio is within the threshold and otherwise selects compression; model calls a registered selector to return unique, feasible stepIds.

auto's maxTrimLossRatio defaults to 0.25 and is a heuristic for the JSON character reduction ratio, not a percentage of semantic information loss. auto/model default to reserveCalls=1 to keep a call for the final answer; handler maxCalls defaults to 1, and local algorithms can explicitly declare 0.

Infeasible candidates are excluded before selection based on the real available call quota. An empty stepIds means no reduction was executed and is not implicitly changed to all steps; if the budget is still exceeded, the request is rejected. A selector also cannot widen its capability by returning unknown IDs or accumulating calls beyond the quota.`,
    examples: [
      { title: 'Process in registered order', level: 'Beginner' },
      { title: 'Choose a policy per scenario with exact overrides', level: 'Configuration' },
    ],
    policyTitles: ['Selection policy catalog, reserved quota, and feasibility filtering'],
  },

  'context-handlers': {
    title: 'Compressors and selectors: recommended implementations and custom algorithms',
    summary:
      'Bind prompts, output parsing, and algorithms as handlers; model I/O goes through callModel of the same request.',
    details: `createContextCompressor requires a business instruction, a registered interaction ID, an output reservation, and result parse; Core does not decide how to summarize business material. createContextSelector has a built-in selection instruction and a default {stepIds} output protocol, defaults maxExcerptChars=0, and passes only candidate metadata; a custom parser must also provide a corresponding instruction.

A handler can also be implemented directly by an App object or class, and declaring maxCalls=0 means purely local processing. A model handler should use callModel from the call arguments rather than creating a new Runner that bypasses ancestor budgets, cancellation, and logging. Algorithms are replaceable, but protected ranges, output structures, and final budgets are not cancelled by custom implementations.

Creating a handler only forms configuration and does not automatically register a transport or enter a Workflow; a node's compressors/selectors are wired explicitly, and policy refers to them by handlerId.`,
    examples: [
      { title: 'Bind a text compression handler', level: 'Beginner' },
      {
        title: 'A selector explicitly controls the visible excerpt range',
        level: 'Configuration',
        note: 'selector-json must be registered by the App and return value={stepIds:string[]}; an ordinary text transport must not be treated as already parsed JSON. This example only shows handler assembly and sends no request.',
      },
      {
        title: 'Implement the same selection contract with a local class',
        level: 'Extension',
        note: 'This policy does not call a model. It only suggests registered candidates, and the node still performs execution and checks.',
      },
    ],
    policyTitles: [
      'Default selection instruction and excerpt range',
      'Compression request and the real callModel contract',
    ],
  },
};

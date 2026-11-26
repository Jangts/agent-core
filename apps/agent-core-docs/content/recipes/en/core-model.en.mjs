// English prose for core-model.mjs; code samples stay in the Chinese source module.
export default {
  'model-invoke': {
    title: 'ModelRunner: input can be shortened while the output contract stays the same',
    summary:
      'Execute one model interaction through the real Provider port and return a value plus the invocation for this call.',
    details: `invoke('text') and invoke({input: 'text'}) both return ModelResult<string>; shortening the input does not produce a second output format. Structured interactions only change the type of value and do not switch to a bare result. Errors are delivered through Promise rejection.

The Runner is a request-level execution object: call counts and the journal accumulate, so a Runner whose budget is exhausted should not be treated as a permanent singleton. Stable model configuration can be bound to the Engine, and each Workflow execution receives an in-request Runner.

Defaults come from modelRunnerDefaults and are the runtime baseline when arguments are missing, not supplier capacity or the best values for all scenarios. Character body text, transport declarations, output characters, and token reservations are different budgets. Without an explicit token counter, do not guess a character/token ratio. lastCall is a snapshot of the most recently completed call and cannot be used to correlate concurrent requests; use the invocation returned by each call instead.`,
    examples: [
      { title: 'Two inputs for the same output', level: 'Beginner' },
      { title: 'Add budget and request cancellation', level: 'Configuration' },
      {
        title: 'Add an independent ordered output receiver',
        level: 'Extension',
        note: 'sink.output is awaited in order. model.output is a proposal that has not been fully validated, so tool operations proposed by the model must not be executed here.',
      },
    ],
    policyTitles: ['Core default budget values'],
  },

  'prepared-model-call': {
    title: 'Actual request measurement and same-call preparation snapshot',
    summary:
      'Use prepare only when context must be handled ahead of time; multiple measurements and the final send reuse the same transport preparation.',
    details: `An ordinary invoke does not require an added prepare step. prepare fixes the dynamic transport instructions, Schema, options, and collector factory for that call; measure allows checking candidates multiple times without consuming model call counts.

measure includes the actual body, transport instructions, and declared measurements, and shows messageChars, instructionChars, schemaChars, transportChars, and inputChars separately. An input token limit exists only after an explicit counter is injected; it already deducts the output reservation and safety margin for this call.

A preparation handle belongs to the Runner/Workflow request that created it and can only be finally consumed once; the interaction, stageId, or output reservation cannot be changed. Measurement is not a budget reservation or an admission ticket: checks are repeated before the final Provider call. Cancellation, expiry, foreign handles, and repeated consumption are all rejected.`,
    examples: [
      { title: 'Ordinary calls still only use invoke', level: 'Beginner' },
      { title: 'Prepare once only when measurement is needed', level: 'Configuration' },
      {
        title: 'Check multiple candidates with the same preparation handle',
        level: 'Extension',
        note: 'This only demonstrates the App deciding candidates; trimming real context must still preserve the original question, authorization, and evidence integrity.',
      },
    ],
    policyTitles: ['Same-call preparation and real input measurement'],
  },

  'model-bindings': {
    title: 'Bind once, multiple models per run, and switching across runs',
    summary:
      'Provide stable model configuration at construction; requests select by configuration ID instead of injecting a Provider repeatedly.',
    details: `A single model can be supplied as the model configuration at construction, or bound once later with bindModel. For multiple models, register configurations in models and select the default with the model string; with multiple models the default cannot be guessed. Unknown model IDs are rejected before the call.

switchModel changes the default selection for later runs; run(state,{modelId}) overrides only the current run, and node model.invoke({modelId}) overrides only that model call. A single Workflow can draft with a fast model and then review with another. Multiple models share the maxModelCalls request budget, each model still has its own local limits, and switching does not refresh ancestor quota.

Model configuration and selection are bound on the Agent, and the Workflow uses them through the model port in its nodes.`,
    examples: [
      { title: 'Bind the model to the Agent in advance', level: 'Beginner' },
      { title: 'Add a model catalog and supply only the ID at call time', level: 'Configuration' },
      { title: 'Call two bound models within the same task', level: 'Extension' },
    ],
  },

  'model-child': {
    title: 'Child execution: isolated records, shared ancestor quota',
    summary:
      'A child Runner does not inherit conversation or the output receiver, but cannot bypass parent budget, cancellation, or deadlines.',
    details: `children configures the maxDepth, maxConcurrentCalls, and maxChildren shared across the request, defaulting to a single level and serial execution. Calls on the same Runner cannot overlap; model calls from multiple child Runners share the root capacity. interactions explicitly specifies the set available to child execution and does not automatically inherit all model-visible tools of the parent.

maxCalls is the local limit for child execution, and reserveCalls keeps follow-up wrap-up quota for the parent; the call is rejected when no quota is available. The parent totalCallCount includes descendant consumption, while the parent callCount, journal, and children are isolated from each other. Child execution belongs to the lifecycle of the parent request, and business authorization is supplied by the App.`,
    examples: [
      { title: 'Configure a call quota for child execution', level: 'Beginner' },
      {
        title: 'Let the parent finish the answer after the child report returns',
        level: 'Configuration',
        note: 'The parent model is called only after the child task completes; there is no Promise.all. The parent still owns verifying the report source and business completeness.',
      },
    ],
  },

  'capabilities-transport': {
    title: 'Model tools and interactions: typed selection only after full validation',
    summary:
      'A tool definition provides a Schema and resolver; a transport translates wire output into the unified model selection contract.',
    details: `A tool list describes what the model may propose, not what business authorization has been granted. inputSchema.parse parses arguments, and resolve constructs a domain result from the complete, validated input. Both are synchronous and cannot secretly execute network tools.

select returns a sealed stage subset. Unknown tools, duplicate IDs, empty selections, or selections outside the stage are rejected. The App decides tool visibility before projection; real request permissions should still be checked during tool execution.

Core obtains options, schemaChars, an optional instruction, and a new collector through ModelInteractionDefinition.prepare. collector.push accepts fragments; finish returns the result after protocol and input validation.

Core reads outputChars after the collector factory returns, after every push, and after finish: the value must be a non-negative safe integer, and NaN, Infinity, negative numbers, and fractions are rejected as protocol errors. maxOutputChars can be explicitly set to Infinity, but that does not relax the collector counting contract. Diagnostics keep the peak of each valid observation; finish may release or normalize internal buffers, so the buffer is not required to grow forever.

Native interaction accepts strings or valid function-call-delta. A function fragment must be a non-array object with index 0; id, when provided, must be a non-empty string, and name and arguments, when provided, must be strings. Conflicting IDs, multiple calls, unregistered tools, mixed body text, or incomplete arguments are rejected and no tool is executed.

The optional call metadata on the collector is read only once on a best-effort basis; a throwing getter does not override the business result already obtained, the original error, or cancellation, and does not prevent model.end from finishing. outputChars is an execution validation field and is not subject to this tolerance rule. Plain objects or classes can both implement this interface; Support provides a recommended native/JSON combination without requiring Core to depend on Support.`,
    examples: [
      { title: 'Declare two selectable tools', level: 'Beginner' },
      { title: 'Project an allowed subset to only one stage', level: 'Configuration' },
    ],
  },

  'tool-registry': {
    title: 'Real tool invocation and in-request runtime',
    summary:
      'Core registers and executes real tools and returns receipts carrying an invocation; business authorization is owned by the implementation registered by the App.',
    details: `ToolRegistry input and output parsers run synchronously; invoke is a synchronous call and rejects when it encounters a Promise, while invokeAsync allows an asynchronous execute. Both results are always {value, invocation}, and tool failures throw instead of masquerading as successful values.

A bare ExecutableTool is an execution mechanism, and business authorization in parseInput/execute must be guaranteed by the App itself. The recommended approach is Support.defineToolCatalog, which generates the Schema, authorize, execute, parseOutput, and model tool from a single source, then binds the real App dependencies.

After binding the tool runtime once with bindToolRuntime, nodes supply only toolId/input; Core automatically wires in the node execution scope and cancellation. events is a summary of real calls, not a list of tools proposed by the model.`,
    examples: [
      { title: 'Minimal local read-only tool', level: 'Beginner' },
      {
        title: 'Bind in advance so nodes no longer inject tools repeatedly',
        level: 'Configuration',
        note: 'The first example validates external input strictly; the second only shows the binding relationship, and real business code should use the appropriate Schema and authorization.',
      },
    ],
    policyTitles: ['Check order for tool input, execution, output, and late results'],
  },
};

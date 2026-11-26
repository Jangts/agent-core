// English prose for support-recipes.mjs; code samples stay in the Chinese source module.
// Context recipes spread into the source module are described in support-context.en.mjs.
export default {
  'schema-adapters': {
    title: 'Schema: keep the JSON declaration and actual parsing on the same contract',
    summary:
      'Support generates a canonical SchemaAdapter; Core only requires the jsonSchema and synchronous parse contract.',
    details: `defineSchema fixes a declaration snapshot and binds the original parser receiver. It does not infer TypeScript types from JSON Schema, nor is it a built-in general validator. The JSON Schema tells the model which structure is allowed, while parse validates that structure at the real execution boundary; both must be valid.

An existing parsing library can use fromParserSchema with an explicit toJsonSchema; when only a JSON Schema exists, fromJsonSchema accepts a caller-owned compile function. The validator returned by compilation must synchronously return a boolean. A parser that always returns true must not masquerade as validation, and generic parameters must not be treated as runtime validation.`,
    examples: [
      { title: 'A string object with real validation', level: 'Beginner' },
      {
        title: 'Reuse a parsing object you already own',
        level: 'Configuration',
        note: 'When integrating a real parsing library, toJsonSchema must accurately express that parser; the library name does not determine trustworthiness.',
      },
      {
        title: 'Use an existing JSON Schema compile port',
        level: 'Extension',
        note: 'This demonstrates an explicit compile port, not a general JSON Schema compiler; production can plug in a mature compiler the App already has.',
      },
    ],
    policyTitles: ['Schema snapshots and synchronous validation rules'],
  },

  'recommended-tool-catalog': {
    title: 'Tool best practice: one definition generates the model tool and execution runtime',
    summary:
      'Register Schema, authorization, execution, and output validation once, and bind the App per request instead of maintaining two tool lists.',
    details: `defineTool is more than object formatting: it validates identity and required handlers, fixes the Schema/callback receivers, and requires authorize to return void on success and throw on rejection. defineToolCatalog generates the model-visible tools and the real tool runtime from the same source; selecting a tool does not execute the tool.

The catalog is reused at definition time; bind({app,execution}) binds request dependencies and yields async invoke plus explicit synchronous invokeSync. Core accepts implementations that satisfy the execution contract and does not require the catalog or handler to be converted into plain objects. select only chooses registered IDs and does not widen this request's authorization; authorize is still called before the real execute.

createToolRegistry is the assembly entry that wires definitions and App dependencies directly to the Core ToolRegistry; usually prefer catalog.bind, and an existing list needs no repeated manual tool Schema configuration.`,
    examples: [
      { title: 'Define and use a read-only tool', level: 'Beginner' },
      {
        title: "Keep the list and add this request's permissions and service dependencies",
        level: 'Configuration',
      },
    ],
    policyTitles: ['Authorization and model tool projection come from the same definition'],
  },

  'registration-catalog': {
    title: 'Tool module composition and declarative installation',
    summary:
      'List modules, tool references, and registration order in one place; the generic loop consumes only that actual list.',
    details: `defineCapabilityCatalog verifies unique identities for modules and tools and builds the tools and findToolOwner projections; requiredToolIds and optionalToolIds must both point to already registered tools, and optional only indicates a usage relationship, not permission to write a wrong reference. It does not create new Core execution stages.

defineRegistrationCatalog compiles static installation items into a read-only catalog, and install(app) evaluates when in order and calls register. Later items can observe state installed by earlier ones. Predicates and registration are both synchronous; enabled is not a substitute for the three distinct decisions of deployment configuration, this request's permissions, and execution authorization.

defineAssociatedCatalog verifies owner-to-tool references at assembly time: a string may only name an independently registered tool, inline declarations may fill defaults, and duplicate tool IDs or unknown owners are rejected. It creates no parallel intent identity and executes no tools.

A Catalog get may return undefined, while require throws when nothing is found; ids/definitions/values/entries are different views of the same collection, not parallel lists.`,
    examples: [
      { title: 'Reuse existing module declarations directly', level: 'Beginner' },
      { title: 'Add tool references and ordered installation', level: 'Configuration' },
    ],
    policyTitles: [
      'Reference checks and same-source tool module composition',
      'Owner-to-tool relationship projection',
    ],
  },

  'recommended-model-transport': {
    title: 'Model interaction and stage projection',
    summary:
      'Generate a sealed catalog and stage projections from tool definitions; native functions and JSON adapters share the same tool contract.',
    details: `createTextInteraction explicitly creates an ordinary text interaction; createModelInteraction uses nativeFunctionInteraction by default. When the JSON protocol is needed, pass jsonObjectInteraction explicitly; Core does not guess a fallback from model names, URLs, or failure counts.

createStageModelInteraction uses stages[{id,toolIds}] to constrain each model stage. Static sources are verified at assembly time, and dynamic source factories take a snapshot at this prepare time; a prepared call has a fixed resolver and receivers. Unknown stages are rejected before any dynamic source is called; tools outside the stage cannot bypass the constraint at runtime.

modelInteractionCatalog provides a read-only catalog under the two real adapter IDs native-functions and json-object. An App can choose catalog entries according to explicit model tool configuration, without automatically guessing from model names, URLs, or failure counts. Using an adapter directly and referring to it by catalog ID follow the same ModelInteractionAdapter contract.

requireStrictArguments requests the strict argument capability declared by the adapter and rejects assembly when it is unsupported. It does not guarantee that the provider responds correctly, and the final collector and Schema still need to validate.

createModelInteraction with response: 'tools' allows one response to contain prose and several tool calls while reusing the same call collector; it exposes decoded calls and never executes tools; pass each call to runtime.invoke to retain the normal execution boundary. prepareModelToolInteraction prepares tool declarations per stage, keeping unknown tools and invalid arguments as problem markers for the App to validate before real dispatch.`,
    examples: [
      { title: 'Create a named text interaction', level: 'Beginner' },
      {
        title: 'Generate interactions for two stages from same-source tools',
        level: 'Configuration',
      },
      {
        title: 'Keep the tools and replace only the explicit interaction adapter',
        level: 'Extension',
        note: 'Model calls still use invoke({input,interaction}) and return ModelResult; switching interaction does not redesign business results.',
      },
    ],
    policyTitles: [
      'Stage list validation and dynamic source snapshots',
      'Explicit model interaction adapter catalog',
      'Session interaction for prose and multiple tool calls',
    ],
  },

  'compatible-provider': {
    title: 'Compatible Provider and custom Providers',
    summary:
      'Support owns the common Chat Completions HTTP/SSE lifecycle; an App can substitute its own ChatProvider.',
    details: `CompatibleModelProvider accepts {config,ports?,observe?,errors?}, and config can be a static configuration or a dynamic read function. Static configuration and callbacks are fixed, while dynamic factories read the current configuration for each actual call. Request keys come from server-side configuration and are not written into the frontend, articles, or the code repository.

requestBody allows provider extension parameters but must not override Core-controlled fields such as model/messages/stream/max_tokens/max_completion_tokens. For a different request protocol, implement ChatProvider rather than bypassing the constraints of the same adapter.

Completion determination is selected through ports.completionPolicy. The default comes from completionPolicyCatalog.default, and whether function fragments are accepted, the expected finish_reason, and completeness before [DONE] are all decided by whether the call declares functions. completionPolicyCatalog.session decides by the tool_choice on the wire: auto requires all started calls to be complete and permits body text, required and an explicit function object require at least one complete call, none rejects any call fragment, an omitted field uses the default completion rules, and unknown values are rejected before the request is sent. A policy only decides whether a response satisfies the request; it does not take over the request loop, interaction protection, or tool execution.

createToolCallCollector aggregates call fragments by index, and policies and direct callers share the same implementation; ID conflicts, duplicate IDs across indices, and incomplete calls are all rejected as protocol errors. The protocol layer never restricts receiving multiple call fragments, and parallel_tool_calls is only a field that is sent; the single-proposal limit on the Agent path is decided by nativeFunctionInteraction, while direct Provider use is not subject to that limit and does not thereby gain tool execution or scheduling capability. Use createModelInteraction explicitly when prose and multiple calls are required; it reuses the same aggregation collector without changing the nativeFunctionInteraction single-proposal contract.

ProviderMessage provides the tool results and assistant toolCalls needed for a direct connection; chatCompletionMessages explicitly maps them to tool_call_id and nested tool_calls, and rejects mismatched roles and fields. Only declared fields are sent, and extra fields, including raw wire fields, are not forwarded; toolCallId must be a non-empty string, and role and content are validated per the message contract. Core ModelMessage now supports assistant toolCalls and role:'tool' fields; the ChatProvider abstract signature stays readonly ModelMessage[].

Tool registration, business argument validation, authorization, and execution belong to the host. createToolCallCollector.complete() checks the completeness of call IDs and names; it does not parse or validate business argument JSON.

A Provider must finish per the interaction contract: incomplete, over limit, format mismatch, cancellation, and provider errors fail separately. Error mapping is not an automatic retry policy. chatCompletionMessages/Parts/FunctionOptions are wire-boundary conversions, not business protocol validators.`,
    examples: [
      {
        title: 'Connect a common protocol with real server-side configuration',
        level: 'Beginner',
        note: 'Running this example requires connection configuration for an available model service.',
      },
      {
        title: 'Declared fields and wire mapping for a direct tool thread',
        level: 'Configuration',
        note: 'This only demonstrates message conversion, with no network request or tool execution. Raw tool_calls, tool_call_id, and host-attached data are not forwarded.',
      },
      {
        title: 'Connect an offline object implementation to the same contract',
        level: 'Configuration',
      },
      {
        title: 'Implement the Core Provider contract with a class',
        level: 'Extension',
      },
    ],
    policyTitles: ['HTTP failure mapping and controlled request fields'],
  },

  'reply-preview': {
    title: 'Body preview: ordered output is not final acceptance',
    summary:
      'Extract displayable body text by registered stage/tool/field path, and refuse to treat control proposals as executed results.',
    details: `createReplyPreview accepts rules, sink, optional render, and maxChars, and returns a handler for ModelRunner.sink.output. Rules define the transient display scope: which stages, which tool, and which body paths may be shown.

The preview receives a model stream that has not been fully validated, so it must not be used to execute tools, approve write operations, or persist the final reply. A failed model.end revokes the preview. The sink awaits in order and propagates failures; do not mistakenly write it as a side-channel observer that ignores Promises. render is synchronous, and rules and receivers are fixed at creation time.`,
    examples: [
      { title: 'Add a preview for a plain-text stage', level: 'Beginner' },
      {
        title: 'Allow only displayable fields of an explicit body protocol',
        level: 'Configuration',
        note: 'Rules must correspond to the reply tool and Schema the App actually registers; configuring a preview does not create a model tool.',
      },
    ],
  },

  'provider-observation': {
    title: "Provider observation and the App's own recording targets",
    summary:
      'A stable Provider binds observation rules; each request is associated only with its own target, and child scopes inherit the association.',
    details: `ProviderObservation is a Support observation at the wire boundary, not a Core execution event. Accept rules can distinguish metadata from content; when not enabled, no content payload is built and no error body is read. It is a failure-isolated side channel that does not change model results, cancellation, or retries.

createProviderObservationScope returns observer and attach. observer can be bound when constructing a stable Provider, and attach binds a log target for the current request. The App owns redaction, read/record permissions, and retention; Core does not understand whether this target is a file, a database, or a message record.`,
    examples: [
      { title: 'Observe metadata only', level: 'Beginner' },
      {
        title: 'Bind your own correlation value per request',
        level: 'Configuration',
        note: 'This example only assembles; for actual calls, configure that diagnostics into the corresponding request execution rather than forcing an App ID into the Core identity.',
      },
    ],
  },

  'rules-and-checks': {
    title: 'Rejection checks, first match, and sequential processing',
    summary:
      'Use real lists to express multiple checks and enumerated dispatch; a single ordinary condition can still use if.',
    details: `breakWhile(occur,error?) throws when a rejection condition is met; when the reason is omitted it creates an Error. A check array stops at the first rejection in order, conditions that depend on earlier checks use callbacks, and the reason factory only runs on rejection. The array field is still uniformly named occur, without inventing separate names for singular and plural.

Note: when passing breakWhile(() => bad) directly, the function itself is treated as a truthy value and is not evaluated; for a lazy condition use a check object {occur:()=>bad} or a predicate array [()=>bad].

matchRule returns the result of the first matching handler and does not continue even when that result is undefined. walkRules executes all matching items in order, and later items can observe earlier modifications; both predicates synchronously return boolean. A single normal condition does not need to be wrapped in a list.`,
    examples: [
      { title: 'One explicit rejection', level: 'Beginner' },
      { title: 'Checks with dependencies evaluated in order', level: 'Configuration' },
      { title: 'Declarative priority dispatch and sequential transformation', level: 'Extension' },
    ],
    policyTitles: ['Actual rules for rejection checks and match short-circuiting'],
  },

  'streams-and-frames': {
    title: 'SSE, JSON frames, and bounded event streams',
    summary:
      'Reuse interaction mechanics while preserving cancellation and backpressure; protocol parsing and business validation remain separate.',
    details: `readSse parses standard SSE; encodeSseEvent/writeSseFrame only handle encoding and cancellable write backpressure, while HTTP responses, authentication, and lifecycle belong to the App framework. Browser consumption does not require a dedicated SDK backend.

streamEvents uses single-slot handoff, and producers must await emit rather than accumulating output without bound. When the consumer stops, the producer is notified, and unconsumed content is not treated as delivered.

scanJsonObjectFrames only extracts complete object frames and does not validate surrounding content; parseJsonFrames validates surrounding characters by maxFrames/maxExtraClosings and calls JSON.parse. They do not repair, truncate, or interpret business fields, and complete business structures are still validated by Schema.`,
    examples: [
      { title: 'Parse one SSE frame locally', level: 'Beginner' },
      { title: 'Producer waits for each event delivery', level: 'Configuration' },
      {
        title: 'Explicitly limit JSON frame count and surrounding content',
        level: 'Extension',
      },
    ],
    policyTitles: ['Single-slot handoff and backpressure in event streams'],
  },

  'protocol-registry': {
    title: 'Protocol registry: one list drives matching and validation',
    summary:
      "Register specifications under the App's own protocol IDs; Core has no built-in business stage names.",
    details: `ProtocolRegistry extends Map, but set forbids duplicate IDs and empty values; require throws when nothing is found. What is registered is an App-defined protocol contract; it does not automatically create state machines, model prompts, or execution permissions.

An App can let the same list drive model-visible descriptions, parsing, and handler entries, avoiding two parallel sets for model enumeration and program dispatch. Do not promote the state of a particular Kit to a required field for all Apps.`,
    examples: [
      { title: 'A queryable protocol list', level: 'Beginner' },
      { title: 'Generate the same catalog from typed declarations', level: 'Configuration' },
    ],
  },

  'explicit-model-retry': {
    title: 'Explicit fallback only when a specific model protocol fails',
    summary:
      "Handle unsupported parallel proposals without taking over all of the App's retries and business errors.",
    details: `retryMultipleModelCalls catches only errors with the MODEL_MULTIPLE_CALLS code and calls the explicit retry(error); other failures propagate unchanged. The fallback happens before any tool execution and must not repeat proposals that already produced side effects.

Both calls must use the same request budget and cancellation. This helper does not reset quotas or automatically switch protocols based on model names; the input, interaction, and business acceptance of the fallback call are still defined by the App.`,
    examples: [
      { title: 'A normal call keeps the same return contract', level: 'Beginner' },
      {
        title: 'Business rejections are not treated as automatic retry conditions',
        level: 'Configuration',
      },
    ],
    policyTitles: ['Explicit retry scope'],
  },
};

// English prose for model-strategies.mjs; code samples stay in the Chinese source module.
export default {
  'json-value-transport': {
    title: 'JSON value interaction: validate structured results directly',
    summary:
      'Generate JSON collection and parsing from an output Schema without adding a tool-selection envelope, and return a unified model result.',
    details: `The json mode is enabled by default; CompatibleModelProvider uses json_object. When array or scalar output requires turning that provider mode off, set options.json=false explicitly, and the same JSON decoding and Schema validation still run.

createJsonInteraction({id,outputSchema,options?}) returns an implementation that satisfies the Core ModelInteractionDefinition<T> contract and preserves the id literal. outputSchema is a SchemaAdapter<T> containing the JSON Schema and a synchronous parser; it can be a plain object, a Support Schema implementation, or a custom class. The parser is also called after JSON decoding, so neither the Schema declaration nor the model output can replace runtime validation.

Each model call creates a new collector and does not share fragment caches. The collector accepts text fragments; function-call fragments, invalid JSON, Schema validation failures, and asynchronous parsers are all rejected. The Runner continues to own input, Schema, output budget, cancellation, and call quota; this helper does not create extra runners or widen permissions.

The model output is directly the JSON value of that Schema, and the call result is still {value,invocation}. It has no tool/input envelope and does not require a tool catalog. Use createModelInteraction/createStageModelInteraction when the model must select tools. The Provider decides the JSON wire format and which value types are actually supported; nothing is inferred from the model name.`,
    examples: [
      { title: 'Minimal JSON summary: bind Schema and parser in one step', level: 'Beginner' },
      {
        title: 'Add temperature, budget, and a custom parser to the same summary contract',
        level: 'Extension',
        note: 'Both examples use offline Providers. When switching providers, the same interaction and call contract continue to apply.',
      },
    ],
    policyTitles: ['JSON collection, decoding, and output Schema validation'],
  },

  'provider-reasoning-strategies': {
    title: 'Reasoning strategies: explicit wire format and natural levels',
    summary:
      'Support generates reasoning parameters from an explicitly chosen protocol format, preserving exact overrides and custom mappings.',
    details: `CompatibleModelProvider's config.reasoning uses level=off/low/medium/high and explicitly selects format. reasoning-effort generates reasoning_effort; thinking and enable-thinking only express an on/off switch and do not claim that low/high differ in strength; thinking-budget defaults the thinking budget for low/medium/high to 1024/4096/8192 and can be overridden through budgets; custom uses a synchronous map(level).

Explicit fields in requestBody take priority. Neither a mapper nor requestBody can override the model, messages, stream, or Core output limits. The thinking budget must be smaller than the actual output token limit; do not resolve the conflict by raising the Core quota. The format is determined by the provider declaration and must not be used merely because model names look similar; an independent Provider can still implement the same ChatProvider contract.`,
    examples: [
      {
        title: 'Generate a thinking budget for an explicit wire format',
        level: 'Configuration',
        note: 'This only assembles configuration and sends no network request. At call time the output token limit must be larger than the thinking budget.',
      },
      {
        title: 'Map a custom provider while keeping exact overrides of original fields',
        level: 'Extension',
      },
    ],
    policyTitles: ['Reasoning parameter mapping and reserved-field protection'],
  },

  'model-strategy-generation': {
    title: 'Model strategy: explicit selection and recommended budgets',
    summary:
      'Select from registered models and reasoning configurations, complete Core settings with local budget tiers, and keep per-field exact overrides.',
    details: `createModelStrategy returns plain ModelRunnerOptions and can create a ModelRunner directly; definitions without request execution can also be bound directly to AgentCoreEngine. The model can be given directly or referred to by an ID in models. When an ID is passed, a missing model is an error; tools are not guessed from names, brands, or URLs.

The budget values small, medium, and large suit short tasks with few calls, ordinary multi-step tasks, and tasks that need more call headroom. They define local admission and output budgets and do not represent provider context capacity, real speed, or quality guarantees. small is 2 calls, 8000 input characters, 4000 output characters, 512 reserved output tokens, and a 15000ms per-call deadline; medium is 8, 32000, 16000, 1024, and 30000ms; large is 16, 64000, 32000, 4096, and 60000ms. Provider hard limits and the Core final checks still apply.

Priority from low to high: budget tier, selected model configuration, settings in explicit reasoningOptions, exact settings in the budget object, and top-level Core fields. Omitting budget uses medium. The budget object adds exact values on top of medium; an explicit undefined hands interpretation back to Core defaults, and valid 0 and Infinity are not treated as defaults.

reasoning is a name in reasoningOptions, such as low/high/off. Its content is an explicit Core model configuration override and can point to a Provider already built with provider reasoning parameters. Support does not infer how a provider enables thinking and does not assemble undeclared wire fields itself. A request is rejected when no declaration matches. Existing contracts for Provider, interaction, token counter, sink, error port, and execution are preserved; App services are not deeply frozen.`,
    examples: [
      {
        title:
          'Use a small budget for a short task and keep the same Core construction as needs grow',
        level: 'Beginner',
      },
      {
        title: 'Refer to an existing model by ID and register the reasoning scheme explicitly',
        level: 'Configuration',
        note: `The example Providers are fully offline. Reasoning parameters for real providers are implemented through each Provider's explicit configuration.`,
      },
      {
        title: 'Keep custom budgets and native Core ports effective',
        level: 'Extension',
        note: 'The counter is for demonstration only. In production inject a counter that matches the actual model; do not use character estimates as real token counts.',
      },
    ],
    policyTitles: ['Recommended budgets, same-contract completion, and override order'],
  },
};

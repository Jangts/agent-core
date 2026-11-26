// English prose for core-extras.mjs; code samples stay in the Chinese source module.
export default {
  'support-navigation': {
    title: 'Support: the aggregate entry for recommended usage',
    summary:
      'Support aggregates recommended construction, policies, and same-source configuration generation; Core execution does not depend on this namespace.',
    details: `The most common import is the Support namespace from the root entry. When module dependencies are already clear, the needed implementations can also be imported explicitly from /support, /support/model, or /support/context. These are different navigation entries to the same public implementations, not different execution layers.

The inputs, completion, policies, and examples of each constructor are expanded in the corresponding entries; the whole of Support does not need to be learned before running an Agent. Implementations as plain objects or classes are equally valid as long as they satisfy the Core contract, and Support products do not need to be converted into plain objects.`,
    examples: [
      {
        title: 'Use the recommended implementation through the aggregate namespace',
        level: 'Beginner',
      },
      {
        title: 'Change only the import granularity; contract and call stay the same',
        level: 'Configuration',
      },
    ],
  },

  'context-strategy-generation': {
    title: 'Generate processing strategies from history semantics',
    summary:
      'Reuse fragment identity and hard budgets to generate complete steps and references for recent or continuity.',
    details: `recent generates a whole-round history window step; continuity uses the supplied compressor to generate a compression step that combines an old-round summary with recent original text. It returns {policy, compressors, selectors}, which can be configured directly into context Workflow nodes.

The optional preset is compact, balanced, or extended: target character counts are 25%, 50%, and 75% of fragment.maxChars respectively, keeping 1, 3, and 6 groups of full original text; these ratios express character space, not semantic fidelity. Explicit targetChars and keepGroups take precedence. When no preset is selected, the default targetChars is the existing fragment.maxChars, grouping uses user-turn, and keepGroups is 1; the selection default is fixed to the trim or compress that corresponds to the scenario. When more precise constraints are needed, override them in the same options rather than returning to another configuration style. Strategy generation produces .window/.summary IDs, fragmentId, and handlerId so these relationships do not need to be hand-configured repeatedly.

An array of strategies can also be passed, with shared selection, selectors, compressors, steps, and triggerChars/targetInputChars/triggerTokens/targetInputTokens configured in the second argument. selection supports model and custom selectors; explicit steps fully replace the generated steps and their original dependencies, and generated fields that are no longer used, such as kind/fragment/field/compressor, can be omitted. By default the strategy is selected by final steps: fixed for a single step and sequence for multiple steps.

These are Support scenario completions, not Core rules for all history, and they do not guarantee the semantic quality of summaries. The fragment must come from a real registration in the App, and budgets and retention of recent original text still go through final checks.`,
    examples: [
      {
        title: 'Reuse an existing fragment to generate a recent-history strategy',
        level: 'Beginner',
      },
      {
        title: 'Add kept groups and target size to the same configuration',
        level: 'Configuration',
      },
      {
        title: 'Supply a compression algorithm explicitly when old topics must be carried forward',
        level: 'Extension',
        note: 'This example only assembles the strategy. The policy/compressors/selectors are used as configuration for existing context nodes; no new request is sent and no extra budget is created here.',
      },
    ],
    policyTitles: ['Scenario catalog, generated steps, and precise overrides'],
  },

  'preview-rule-generation': {
    title: 'Generate preview rules from tool and stage declarations',
    summary:
      'Reuse the actual Schema and stage references to generate rules only for tools that are explicitly allowed to be displayed.',
    details: `stage.preview='text' allows only text-only stages without toolIds; 'tools' handles only tools referenced by that stage with preview explicitly enabled. Arbitrary string fields are never guessed to be displayable body text.

tool.preview=true selects only paths actually declared in the Schema from common text/bubbles field conventions, with at least one present; custom paths are validated one by one, and when.path must also exist. Duplicate IDs, unknown references, or non-existent fields are rejected during assembly.

The returned rules are passed to the existing createReplyPreview. New stages or tools reuse catalog generation, avoiding transmitting one list and then hand-copying it for preview; preview still cannot authorize, persist the final reply, or execute tools.`,
    examples: [
      { title: 'Explicitly mark a text-only stage', level: 'Beginner' },
      {
        title: 'Reuse the Schema and stage references of structured tools',
        level: 'Configuration',
        note: 'A real App should project these two arrays from the tools and stage declarations it has already registered; this example uses minimal static data to show the required fields.',
      },
    ],
    policyTitles: ['Schema field verification and explicit preview scope'],
  },

  'synchronous-invocation': {
    title: 'Synchronous execution adapter for host-selected invocations',
    summary:
      'Record start, completion, and failure uniformly for synchronous invocations the host has already selected, without replacing tool selection or authorization.',
    details: `executeInvocation returns void; results are expressed through the App's own Context and an optional receipt port. handler.call must be synchronous and must not secretly return a Promise. Selection, authorization facts, argument structure, and side effects still belong to the host.

When asynchronous values and a unified ToolResult are needed, prefer the ToolRegistry/Support tool runtime. This synchronous adapter mainly connects existing host invocation flows; do not build a separate InvocationHandler framework for all tools. journal/diagnostics/signal/checkpoint/receipt can be configured, and they are all App implementations of existing contracts.`,
    examples: [
      { title: 'Execute a local invocation the App has already selected', level: 'Beginner' },
      { title: 'Connect the same request journal and cancellation signal', level: 'Configuration' },
    ],
    policyTitles: ['Boundaries of synchronous invocation, cancellation, and receipts'],
  },

  'structural-query-and-prefix': {
    title: 'Structural query keys and text common prefixes',
    summary:
      'Small pure functions for stable comparison and usage analysis, not an authorization, hashing, or semantic deduplication system.',
    details: `commonPrefixLength compares the JS UTF-16 prefix length of strings for stable prefix analysis; it is not a token count, character count, or cache hit promise.

retrievalQueryKey sorts the keys of a JSON-serializable object and then serializes while preserving array order, making it suitable for comparing controlled query structures. It is not a cryptographic hash, identity signature, or a unique key for arbitrary JS objects; Date/Map/functions/cyclic objects are not among the controlled JSON query inputs shown here.`,
    examples: [
      { title: 'Compare the stable prefix of two real inputs', level: 'Beginner' },
      {
        title: 'Different object key order keeps the same structure semantics',
        level: 'Configuration',
      },
    ],
    policyTitles: [
      'Sorting and serialization of structural keys',
      'Implementation of common prefix comparison',
    ],
  },
};

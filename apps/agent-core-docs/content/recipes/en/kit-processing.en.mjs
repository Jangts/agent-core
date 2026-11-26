// English prose for kit-processing.mjs; code samples stay in the Chinese source module.
export default {
  'kit-normalization': {
    title: 'Normalization: ordered value transformation',
    summary:
      'Collect cleaning, replacement, and stop conditions into one transformation list that actually drives execution.',
    details: `The input is an ordered list of NormalizationStep entries; normalize(value, context) returns the last value. Each step may return a new value or modify in place; object ownership is decided by the App. when and isComplete must synchronously return boolean, and normalize must be synchronous. Duplicate or empty step IDs, missing handlers, and accidentally returning a Promise are all rejected.

uniqueBy deduplicates stably by the key the App provides and keeps the first occurrence's original value; initial can exclude keys already seen. It does not guess whether two business objects are equivalent.`,
    examples: [
      { title: 'Start by cleaning one query', level: 'Beginner' },
      {
        title: 'Continue by adding steps and a stop condition',
        level: 'Configuration',
      },
    ],
    policyTitles: ['Step execution, synchronous constraints, and stop order'],
  },

  'kit-delivery': {
    title: 'DeliveryPipeline: sequential delivery with an explicit end',
    summary:
      'Each delivery stage explicitly continues or completes; once a stage completes, the run ends immediately.',
    details: `defineDeliveryPipeline accepts createState, stages, missingResult, and an optional beforeStage. deliver(input, execution) synchronously returns a Result. beforeStage runs interleaved with that stage's handle; it does not run every hook first and then the handlers. When no stage delivers anything, the error returned by missingResult() is thrown.

AbortSignal is checked before and after execution, and every handler must be synchronous. Stage names, state, priority, and whether publication is allowed are App semantics, not a global Core delivery protocol.`,
    examples: [
      { title: 'Deliver a piece of text that is already confirmed', level: 'Beginner' },
      {
        title: 'Add a validation stage while keeping the same deliver',
        level: 'Configuration',
      },
    ],
    policyTitles: ['Interleaved hooks, stage short-circuiting, and cancellation checks'],
  },

  'kit-projection': {
    title: 'Projection: project content under a budget',
    summary:
      'Shorten text first, then reduce entries; source data, projection result, and budget are explicitly separated by the App.',
    details: `value should be serializable JSON data. The counts and lengths of defineContentProjection are the attempt order the App specifies; project({value,maxChars}) returns {text,truncated}. When the value is already within budget it returns the JSON.stringify result directly; once over the limit it tries render and then fallback in turn. The fallback result is the App's responsibility and must not be treated as Core's final input budget guarantee.

projectContinuousExcerpt performs a binary-search prefix selection over body text that can be truncated continuously; render(0) already over the limit returns undefined, and existing surrogate pairs are preserved. defineTreeProjection traverses synchronously in property/array order and omits nodes beyond maxDepth or where omit returns true; only undefined means omit, while null, false, and 0 are kept.`,
    examples: [
      {
        title: 'Prepare compact JSON for the same query result',
        level: 'Beginner',
      },
      {
        title: 'Remove private fields from the same data, then project under budget',
        level: 'Configuration',
      },
      {
        title: 'Keep continuous body text instead of splitting paragraphs',
        level: 'Extension',
        note: 'The output length of render must grow monotonically with the prefix length for the binary search to be meaningful.',
      },
    ],
    policyTitles: ['Reduction order and tree traversal'],
  },

  'kit-aggregation': {
    title: 'Aggregation: query aggregation and stable merging',
    summary:
      'Read App data in order and keep how duplicate items are merged in the same configuration.',
    details: `collect(inputs, context) calls execute synchronously and returns {total,items}. Without a key every result is kept; with a key, merging is stable by first insertion position and later items override earlier ones by default. merge(item,previous,input,context) can decide which result to keep. execute, key, and merge must all be synchronous.

mergeByKey is an independent merge function for the same purpose. It does not query a database, call a model, or manage transactions or permissions; those remain the responsibility of the real read port.`,
    examples: [
      { title: 'Aggregate two reads in order', level: 'Beginner' },
      {
        title: 'Add a primary key and retention policy to the same collect',
        level: 'Configuration',
      },
    ],
    policyTitles: ['Stable key merging and read order'],
  },

  'kit-retrieval': {
    title: 'Retrieval: a synchronous retrieval lifecycle with quota',
    summary:
      'Keep normalization, validation, deduplication, authorization, reading, and follow-up effects on one deterministic call path.',
    details: `run(query, context) returns a RetrievalReceipt: the original query, the dedup key, the success sequence, the start time, rawResult, result with request-scoped sourceId values, and extensions. state(context) provides this request's queryCount, seen, and sources; limit(context) is the successful query quota.

The order is prepare → assertInput → dedup/quota → authorize → reserve the seen key → execute → assertResult → count successes and sources → effects. A failed attempt has already occupied its seen key and is not retried automatically because it failed. effects run in order, and a failure does not pretend to roll back earlier side effects. All ports are synchronous; asynchronous retrieval can be handled by the App's own ordinary Workflow node. The default key comes from retrievalQueryKey, and the default source ID is a combination of the retrieval ID, the success sequence, and the source ID, which is only a request-scoped reference.`,
    examples: [
      { title: 'Configure one read for the same product material', level: 'Beginner' },
      {
        title: 'Add normalization, authorization, and receipt effects to the same run',
        level: 'Configuration',
      },
    ],
    policyTitles: [
      'Deduplication, reservation, reading, counting, and effect order',
      'Default query key',
    ],
  },

  'kit-evidence': {
    title: 'Evidence: check completeness with real observations',
    summary:
      'Check requirements against App-defined evidence semantics instead of treating a model saying it is done as a real receipt.',
    details: `A Checklist selects a registered isSatisfied by requirement.kind. isSatisfied checks one item, isComplete checks all of them, and missing returns unmet requirements. An unknown kind is rejected; predicates must synchronously return boolean. The Kit does not infer that a file was delivered or a transaction was committed; the App must define those through real results.

EvidenceProjection narrows observations that carry sources by sourceIds. When nothing is selected, or the array is empty, the full evidence is kept, and unknown tools also keep their original observations; this is not the same as filtering by permission, which should happen before the source is read. The default tool selection reads toolId and then falls back to the tool the observation itself provides; the App can supply toolId() explicitly.`,
    examples: [
      { title: 'Check whether real material has been read', level: 'Beginner' },
      {
        title: 'Return gaps from the same checklist, then limit the sources used for review',
        level: 'Configuration',
      },
    ],
    policyTitles: ['Completeness and evidence projection rules'],
  },

  'kit-policies': {
    title: 'Policies: all matches and the first recovery',
    summary:
      'A policy set collects every matching reason; a recovery chain selects the first explicitly handled result in order.',
    details: `assess(input) returns {required,reasons,kinds}; it does not stop at the first match, and it does not let some fast mode override a mandatory rule. RecoveryResult is {handled:false} or {handled:true,value}; a value of undefined can still count as handled. Unknown IDs, duplicate IDs, empty descriptions, and async handlers are all rejected. Concrete kinds and recovery conditions are defined by the App.`,
    examples: [
      { title: 'Declare when the same reply must be reviewed', level: 'Beginner' },
      { title: 'Add another reason and ordered recovery', level: 'Configuration' },
    ],
    policyTitles: ['All matches and the first handled result'],
  },

  'kit-candidates': {
    title: 'Candidates: a bounded candidate envelope',
    summary:
      'The same result can be a single proposal or a candidate list; candidate permission and count are controlled by the application.',
    details: `parse({value,allowed}) returns unknown[]. Input without the configured field is returned as a single item; when field is present the input must be an object with only that field, its members must be non-array objects, and they cannot nest the candidate field again. The default is minCandidates=1 and maxCandidates is required. allowed only says whether multiple candidates are accepted here, not that execution is authorized; a model cannot bypass restrictions that apply after a task is accepted through a candidate envelope.`,
    examples: [
      {
        title: 'Accept a single proposal or up to three candidates',
        level: 'Beginner',
      },
      {
        title: 'Add a lower bound and an application-stage constraint to the same parse',
        level: 'Configuration',
      },
    ],
    policyTitles: ['Candidate envelope, count, and shallow constraints'],
  },

  'kit-text-skills': {
    title: 'TextSkills: read-only text Skills',
    summary:
      'Validate registered text work instructions that the App reads; code inside the files is never executed.',
    details: `load({entries}, {read}) returns a frozen TextSkill array. The default entry rule is id/SKILL.md; the default strict header requires name and description to appear in that order. The default maxIdChars=64, and the description and instruction budgets must be provided explicitly. The registered kind must be text-workflow, and toolIds must be unique. read and parseHeader are synchronous, and returning a Promise by mistake is rejected.

toolIds are declared dependencies; this text alone does not register, authorize, or execute tools. Source allowlists, file access, installation, and publication belong to the App.`,
    examples: [
      { title: 'Read one text Skill from an explicit source', level: 'Beginner' },
      {
        title: "Add the application's own entry convention to the same loader",
        level: 'Configuration',
        note: 'Entry rules and tool references are only registration checks; the actual tools still need to be registered and authorized by the application.',
      },
    ],
    policyTitles: ['Text registration and strict header parsing'],
  },
};

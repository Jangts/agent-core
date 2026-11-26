// English prose for kit-search.mjs; code samples stay in the Chinese source module.
export default {
  'kit-text-blocks': {
    title: 'TextBlocks: structure-aware splitting of long text',
    summary:
      'Split long text into bounded structural blocks while keeping the original text and offsets for paging or indexing.',
    details: `split(text, { targetChars }) only processes decoded plain text. Headings and horizontal rules start a new block, blank lines end the current one, and other lines break at line boundaries once targetChars would be exceeded; a single over-long line stays one block so later paging can fragment it without turning one line into unrelated sections. Blocks reassemble into the original text exactly, preserving whitespace and CRLF; number starts at 1 and start/end are UTF-16 offsets in the source.

targetChars must be a positive integer, and empty text returns an empty array. The Kit does not read files, page, call models or touch storage; paging windows, retrieval, summaries and prompts remain App decisions. Boundaries follow structure rather than a fixed character window, so report coverage with start/end.`,
    examples: [
      {
        title: 'First split a short document with two sections',
        level: 'Beginner',
        note: 'The example only demonstrates the splitting contract; paging windows, context budgets and prompts still belong to the App.',
      },
      {
        title: 'Page through blocks and record coverage',
        level: 'Configuration',
        note: 'Block boundaries are not a fixed character window; record each block start/end instead of inferring character positions.',
      },
    ],
    policyTitles: ['Structural boundaries, exact reassembly, and source offsets'],
  },

  'kit-text-search': {
    title: 'TextSearch: App-side full-text index',
    summary:
      'Build a local index over declared fields; every query must supply an application filter.',
    details: `Constructor options include indexRevision, fields, and storedFields, plus optional tokenize, boost, and combineWith. upsert adds or replaces by document id. search({query,limit,filter}) returns {id,score,terms,document}[]; document contains only storedFields and is not a full copy of the original. query cannot be empty, limit is 1–1000, and filter must synchronously return boolean.

combineWith defaults to 'OR'; tokenization comes from MiniSearch by default, and languages such as Chinese can supply a tokenizer explicitly. remove waits asynchronously for vacuum, and clear empties the current index. snapshot/restore checks the engine identity and configuration fingerprint; indexRevision is how the App expresses the format/tokenization semantics version, and it should also be updated when custom tokenization behavior changes. A snapshot is not a persistence service; saving, expiry, deletion, and access policy belong to the App.`,
    examples: [
      { title: 'First index two interface documents', level: 'Beginner' },
      {
        title: 'Add access filtering, weighting, and a snapshot to the same search',
        level: 'Configuration',
        note: 'Metadata allowed for filtering must be registered as storedFields; field filtering must rely on a trusted App identity and must not trust an identity the model claims.',
      },
    ],
    policyTitles: ['Index fields, filtering, snapshot fingerprint, and removal'],
  },

  'kit-vector-search': {
    title: 'VectorSearch: bounded exact cosine retrieval',
    summary:
      'Given the same vector space, filter documents first and then rank by cosine similarity.',
    details: `Constructing a VectorSearchSpace requires identity and dimensions (1–16384). upsert({document,vector}) copies the document and normalizes the vector; mismatched dimensions, non-finite numbers, and zero vectors are rejected. search({vector,limit,filter,minScore?,groupBy?}) returns SearchHit[]. filter/groupBy are synchronous, limit is 1–1000, and minScore, when given, must be within [-1,1].

With groupBy configured, each group keeps only its highest score, with ties broken by id; the final order is score descending and then id. remove/clear only change the current in-memory index. It does not generate embeddings, query a database, or mix vectors from different models/dimensions; space version, authorization, index size, and persistence are decided by the App.`,
    examples: [
      {
        title: 'First retrieve documentation fragments in the same space',
        level: 'Beginner',
        note: 'Two-dimensional vectors are used to show the contract; they do not represent real text embeddings or retrieval quality.',
      },
      {
        title: 'Add permissions, a threshold, and document grouping to the same search',
        level: 'Configuration',
      },
    ],
    policyTitles: ['Vector validation, normalization, filtering, and grouped ordering'],
  },

  'kit-rank-fusion': {
    title: 'Rank Fusion: fuse multiple retrieval results by rank',
    summary:
      'Fuse full-text and vector ranks instead of directly adding raw scores with different semantics.',
    details: `reciprocalRankFusion(lists,{limit,k?}) returns {id,score,contributions}[]. Each source has a unique sourceId, ids in rank order, and an optional positive weight. The defaults are k=60 and weight=1; a contribution is weight/(k+rank), with rank starting at 1. A repeated ID within one source counts once. The total is ordered by score descending and then by id; limit is 1–1000.

The returned score is a fusion ordering value, not similarity, confidence, or factual correctness. Every source must apply the same permission filtering before fusion; fusion does not re-check whether the source data is visible.`,
    examples: [
      { title: 'First use the default fusion parameters', level: 'Beginner' },
      {
        title: 'Add source weights and the smoothing parameter to the same function',
        level: 'Configuration',
      },
    ],
    policyTitles: ['RRF ranks, deduplication, and scores'],
  },

  'kit-model-calls': {
    title: 'ModelCalls: external inference bindings',
    summary:
      'Bind identity, validation, cancellation, and a unified invocation receipt for App-defined I/O such as embeddings.',
    details: `The constructor registers {id,identity,invoke,assertInput?,assertOutput?}. invoke({modelId,input,timeoutMs},execution) returns ModelResult<Output>, with the body/vector in value and real call information in invocation. Input and output types can be inferred from the registered tuple for known literal IDs; unknown IDs are rejected. identity states the real model/algorithm version and is not guessed from the request.

timeoutMs must be a positive safe integer within the supported range and is merged with the caller's signal. Input and output assertions are synchronous and must return void; a late result after cancellation is not returned as success. The underlying I/O should consume the provided signal; stopping the wait does not undo external side effects.

This is an independent external inference adapter, and returning a similar shape does not mean it is wired into the chat Runner's call-count ledger. The App must explicitly carry the corresponding business budget for current source bindings; embedding and chat calls cannot be charged against each other's units. Core's single-run multi-model chat still uses the normal Engine/ModelRunner model contract.`,
    examples: [
      {
        title: 'First bind an offline demonstration vector algorithm',
        level: 'Beginner',
        note: 'The algorithm only demonstrates I/O binding and does not provide real language embedding quality.',
      },
      {
        title: 'Add input and output checks plus cancellation to the same invoke',
        level: 'Configuration',
      },
    ],
    policyTitles: ['Bindings, validation, deadlines, and real receipts'],
  },
};

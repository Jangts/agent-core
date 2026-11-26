// English prose for advanced-agents.mjs (supportRecipes and kitRecipes); code samples stay in the Chinese source module.
export default {
  'child-composition': {
    title: 'Child task composition: sequential execution and controlled parallelism',
    summary:
      'Reuse createChild and the shared budget, check every result, and commit in declaration order.',
    details: `runChildren defaults its concurrency to the root Runner's maxConcurrentCalls. Each task explicitly configures visible interactions, a call limit, and the amount reserved for the parent, and the result array keeps declaration order.

accept checks each result; the optional commit is only called after everything is accepted. A failure cancels the tasks in the group, and late results cannot be committed. When the whole set needs a transaction, the App handles the returned array inside a real transaction; commits that already happened are not rolled back by cancellation.`,
    examples: [
      { title: 'Analyze two documents in sequence', level: 'Beginner' },
      {
        title: 'Add concurrent capacity to the same set of analyses',
        level: 'Configuration',
        note: 'The same function and task list, adding only the root Runner capacity setting. Local budgets and the parent reservation still apply.',
      },
    ],
    policyTitles: ['Child acceptance, cancellation, and ordered commit'],
  },

  'execution-reflection': {
    title: 'Log reflection: authorization metadata and evidence reports',
    summary:
      'The App supplies authorized evidence sources; the reflection task produces a sourced report through ordinary model and tool contracts.',
    details: `source checks the real identity and visible range for every query. The model reads evidence through history.query and then submits observed, hypothesis, or recommendation; observed must reference evidence IDs actually read in this run.

The report keeps incompleteness and missing explanations, and persisted defaults to false. Read permission, handing content to the model, and disclosing results are each decided by the App; the metadata adapter does not pass raw log body text.`,
    examples: [
      { title: 'Bind the reflection model, evidence source, and authorization', level: 'Beginner' },
      {
        title: 'Build the same kind of evidence source from a log reader',
        level: 'Configuration',
        note: "The reader's directory scope, shutdown, and retention are managed by the App. The adapted source can be passed into the same defineReflection.",
      },
    ],
    policyTitles: ['Reflection evidence references and report checks'],
  },

  'agent-family': {
    title: 'Agent family: versions, merge, and explicit promotion',
    summary:
      'Manage data branches on real CAS storage; candidate versions are explicitly promoted after checks and authorization.',
    details: `create establishes the initial version, fork saves a candidate based on the real parent branch identity, merge checks conflicts through the App's three-way merger, and promote explicitly switches activeId. A candidate's base must still be the current active version.

BranchVersionStore.compareAndSwap atomically commits the version set and activeId. Read permission is enforced by the store, and changes are checked by authorize and validate. A data version does not carry running functions, tool instances, or permissions; the App re-assembles dependencies when using a version.`,
    examples: [
      {
        title: 'Configure state checks, source verification, and three-way merge',
        level: 'Configuration',
      },
      {
        title: 'Explicitly promote an approved candidate version',
        level: 'Extension',
        note: 'The App calls this after real approval; promote still re-runs source, authorization, revision, and CAS checks.',
      },
    ],
    policyTitles: ['Branch version conflicts and promotion checks'],
  },

  'knowledge-publication': {
    title: 'Knowledge candidates: compilation checks and explicit publication',
    summary:
      'Candidate preparation and publication reuse the Knowledge compiler, and the real store commits official documents through CAS.',
    details: `propose checks the complete replaced document set and writes only the candidate. publish re-verifies authorization, sources, validity period, and publishedRevision, then atomically replaces the official set. reject deletes the candidate.

store.revision coordinates all writes, and publishedRevision marks changes to the official set. When body text or metadata changes, the document needs a new revision. Ordinary knowledge reads use documents, and candidates do not enter the fact catalog.`,
    examples: [
      { title: 'Bind document storage and source authorization', level: 'Beginner' },
      {
        title: 'Publish an approved candidate document set',
        level: 'Configuration',
        note: "Call this after the App's real approval flow. Source changes, expired candidates, or version conflicts reject the commit.",
      },
    ],
    policyTitles: ['Document candidate compilation, source checks, and CAS publication'],
  },
};

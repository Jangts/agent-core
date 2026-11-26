// English prose for kit-knowledge.mjs; code samples stay in the Chinese source module.
export default {
  'kit-knowledge': {
    title: 'Knowledge: documents, sections, and evidence snapshots',
    summary:
      'One document contract supports plain objects and anchored text; a selection yields an evidence snapshot with an explicit version.',
    details: `defineKnowledgeCatalog(documents, options?) compiles the document tree and rejects duplicate documents/sections, missing revisions, and cycles. read({documentId,selection}) returns {documentId,selection,revision,locale,content,id}. selection.mode can be document, self, or subtree; self/subtree also need non-empty, duplicate-free sectionIds. self reads only that section's own text, while subtree includes its child sections.

maxChars limits the selected body text after trimming; going over the limit throws instead of silently truncating. assertSelection only checks references and the selection shape and does not enforce the body budget. sectionIds lists the real sections; ordinary get/require return the compiled document definitions.

revision is provided by the App, and id is a snapshot identifier serialized from document identity, revision, language, and selection; it is not a body hash, permission credential, or database ID. Content must not change quietly under the same revision; subsequent generation and review should pass the same snapshot. File loading, source trust, permissions, and publication are outside this Kit.`,
    examples: [
      { title: 'First read one plain-object document', level: 'Beginner' },
      {
        title: 'Add sections and a budget to the same read',
        level: 'Configuration',
      },
      {
        title: 'Switch to the text adapter; later catalog and read calls stay identical',
        level: 'Extension',
        note: 'Paired anchors must match; markers are just one input for the text adapter, and Core does not require documents to be stored as Markdown.',
      },
    ],
    policyTitles: [
      'Selection, budget, and snapshot identity',
      'Text section parsing and tree compilation',
    ],
  },

  'kit-answer-tasks': {
    title: 'Answering catalog: tasks, source reads, and check references',
    summary:
      'One task definition ties together the input Schema, reader, output, and check, with real references verified at assembly.',
    details: `defineAnswerReaderCatalog holds real read ports; defineAnswerCheckCatalog compiles a synchronous check list. defineAnswerTaskCatalog uses those catalogs to verify readerId, outputId, checkIds, domainToolIds, and the input Schema.

task.read(request,context) only allows synchronous readers; readAsync awaits asynchronous readers at the same task entry and checks cancellation. The check catalog runs in checkIds order and keeps the corrected value plus all issues; any failed wins first, then unavailable, and only an all-pass run is passed. The task catalog's describe projects inputJsonSchema without performing reads or model calls.

Catalog validation is not read authorization. Readers obtain trusted sources from server-side App dependencies; a model cannot gain permission through taskId, sourceStatus, or outputId.`,
    examples: [
      { title: 'Register one read task for explanatory material', level: 'Beginner' },
      {
        title: 'Add check references to the same task and check the generated result',
        level: 'Configuration',
      },
    ],
    policyTitles: [
      'Task references and synchronous/asynchronous reads',
      'Check result aggregation',
    ],
  },

  'kit-answer-flow': {
    title: 'Answering Flow: item-by-item generation, review, and local repair',
    summary:
      'Preserve coverage relationships over a split question batch and repair failing items without regenerating the ones that passed.',
    details: `run({inputIds,items},context) returns AnswerResult[]. Each item contains id, inputIds, data, and sourceStatus, all decided by the App after reading sources. validateAnswerBatch requires every original inputId to be covered by at least one item and rejects unknown inputs, duplicate task IDs, and limit violations.

The flow uses the App's generate, synchronous check, optional asynchronous review, synchronous fallback, and canInvoke. maxItems and maxRepairs are configured explicitly; reviewPolicy defaults to optional and can also be required or off. canInvoke only checks invocation conditions; real model calls must still go through the budget of the Runner the App has bound. generate returns a Map keyed by item.id; a foreign ID is rejected.

Only locally failing items are repaired; a known review failure is not let through because a later review is unavailable. The final status is accepted, fallback, or blocked, and fallback text is not evidence that a check passed. Sources with unavailable/conflict do not enter normal generation. The Kit uses Workflow internally and does not establish a new Core execution contract.`,
    examples: [
      {
        title: 'First handle one question that has a source',
        level: 'Beginner',
        note: 'The offline example uses already-read body text directly to show the flow contract; when switching to model generation, the same generate port still applies.',
      },
      {
        title: 'Keep run unchanged and add review plus one local repair',
        level: 'Configuration',
        note: 'The example triggers one real local repair with an empty draft; production review should rely on real evidence instead of substituting string equality for semantic review.',
      },
      {
        title: 'First validate multi-question coverage to avoid missing inputs',
        level: 'Extension',
      },
    ],
    policyTitles: [
      'Generation, checks, review, local repair, and delivery',
      'Question coverage checks',
    ],
  },

  'kit-presentation-output': {
    title: 'Presentation: field ownership and final output',
    summary:
      'The model fills only the fields it is assigned; fixed text, bound values, and semantic keys are owned by the program.',
    details: `defineOutputCatalog supports text, master, record, and group outputs. Non-group outputs must declare fields; text may have only one required field, and master template slots must correspond exactly to the fields. Field owner is generated, bound, constant, or semantic. Without valueSchema the string parser is used.

toModelSchema exposes only generated/semantic fields to the model, with semantic limited to the allowed keys; check returns a check status and issues, and compose({outputId,input},context) synchronously binds real values after checks and returns {outputId,kind,value}. bound/semantic require a registered provider, and providers must be synchronous. group items are assigned by the program, and references must be registered and must not form a cycle.

defineReplyFormats declares a format only where the App really owns a reply template; resolve returns undefined for every other reply, so no extra output requirement or follow-up question is added. replyFormatChecks provides bubble-count and total-character budget checks, and mergeReplyBubbles drops blank bubbles and merges overflow into the last one. Limits, templates and wording stay with the App.

The output contract rejecting model-filled extra fields does not mean the business is complete, authorized, or already sent to the user. Final output, streaming, and business submission remain separate boundaries.`,
    examples: [
      { title: 'First compose one piece of generated text', level: 'Beginner' },
      {
        title: 'Let the program own the explanatory prefix in the same compose',
        level: 'Configuration',
      },
      {
        title: 'Add bound fields and semantic keys while keeping the compose entry',
        level: 'Extension',
      },
    ],
    policyTitles: [
      'Field ownership, model Schema, and composition',
      'Reply format declarations, shared checks, and bubble normalization',
    ],
  },

  'kit-presentation-templates': {
    title: 'Templates, semantic slots, and expression selection',
    summary:
      'The program owns templates and preference order, inserted values are replaced only once, and the App supplies the random source for variants.',
    details: `defineTextTemplate(master).render(values) replaces only {{word}} in the original template, throws on a missing field, and does not re-evaluate braces inside inserted values. defineSemanticSlots only checks whether namespaced semantic slots fall within the allowed keys and maxOccurrences; it does not perform replacement.

selectVariant returns a value or undefined; with multiple candidates it avoids previous when possible, and randomIndex(limit) must return a valid integer. resolvePreference selects by priority descending and then order descending, and returns undefined for an empty array. These are local expression strategies and do not decide authorization, fact priority, or business routing.`,
    examples: [
      { title: 'First compose an explanation with a program template', level: 'Beginner' },
      {
        title: 'Add semantic key validation and a non-repeating variant to the same template',
        level: 'Configuration',
      },
    ],
    policyTitles: [
      'Single-pass template replacement and semantic slots',
      'Variant and preference ordering',
    ],
  },

  'kit-presentation-events': {
    title: 'Reply events: text chunks and bubble boundaries',
    summary:
      'Turn an accepted reply into awaitable text/bubble events while preserving cancellation and delivery backpressure.',
    details: `publishReplyEvents({text,delivery?},execution) returns AsyncIterable<AgentOutputEvent>. The defaults are chunkSize=240, intervalMs=0, bubblePauseMs=0, and maxDurationMs=3000; the total timing scales down to the cap, and cancellation stops further output. The internal REPLY_BUBBLE_BOUNDARY only separates bubbles and should not be displayed as body text.

serializeOutputEvents converts to a text stream, filters preview, and re-encodes bubble as the internal boundary. textOutputEvents wraps a plain string stream into text events. replyBubbleTexts only takes text/bubbles entries that are actually strings in the input. These are reply presentation contracts, not Core execution fact observation, and they do not prove the content passed business checks.`,
    examples: [
      { title: 'First output a reply that is already accepted', level: 'Beginner' },
      {
        title: 'Add chunking and bubbles to the same event entry',
        level: 'Configuration',
      },
      {
        title: 'Convert an existing text stream within the same contract',
        level: 'Extension',
      },
    ],
    policyTitles: ['Chunking, bubbles, and total duration limit'],
  },
};

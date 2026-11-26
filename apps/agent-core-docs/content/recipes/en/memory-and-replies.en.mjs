/** English descriptions for the shared memory and reply guidance examples. */
export default {
  'memory-snapshot-update': {
    title: 'Build and read a memory snapshot from authorized sources',
    summary: 'Batch extraction input, validate a proposal, and project memory for the current request.',
    details: 'The application admits sources and checks meaning. An exact quote is used to match the user text. A real transaction updates the snapshot and processed watermark against the previous revision. This example transforms one eligible source in memory.',
    examples: [{ title: 'Prepare extraction and apply one proposed preference', level: 'Basic' }],
  },
  'memory-source-review': {
    title: 'Review memory against source availability and inspected evidence',
    summary: 'Track which sources are available, pending review, and semantically inspected.',
    details: 'The application supplies availability it actually checked, then selects a bounded review batch. Only mark source IDs that were actually inspected. Application policy decides whether unavailable evidence can still be used.',
    examples: [{ title: 'Prepare a bounded review batch and record completion', level: 'Configuration' }],
  },
  'reply-guidance-for-current-call': {
    title: 'Choose a detail level for the current reply',
    summary: 'Resolve trusted application, node, tool, and call settings for a user-facing invocation.',
    details: 'The caller chooses explicitly if tool defaults conflict. A fixed Provider demonstrates how to pass the setting. Assess adherence on live-model samples.',
    examples: [{ title: 'Resolve conflicting tool defaults explicitly', level: 'Basic' }],
  },
};

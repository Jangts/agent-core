/** English descriptions for the shared reliability examples. */
export default {
  'reasonable-budget': {
    title: 'Assess necessary work and revise the request allocation',
    summary: 'Address context and repetition before funding useful remaining work.',
    details:
      'Assessment consumes no model calls and grants no authority. Allocation changes preserve consumed attempts and ancestor constraints; an underestimated quota does not itself justify partial delivery.',
    examples: [{ title: 'Pure assessment and controlled adjustment', level: 'Beginner' }],
  },
  'reliable-completion': {
    title: 'Repair delivery while preserving confirmed work',
    summary:
      'See how required and optional checks affect delivery and how a reply failure can preserve a saved result.',
    details:
      'Track business outcomes separately from delivery. An optional check can fail while confirmed work remains available. On execution or repair failure, give an account based on the actual receipt. Propagate user cancellation to the caller.',
    examples: [
      { title: 'Retain an optional error while accepting the primary result', level: 'Beginner' },
      { title: 'Fall back to a confirmed receipt', level: 'Beginner' },
    ],
  },
};

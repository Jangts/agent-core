/**
 * Knowledge Kit entry: sectioned knowledge documents, snapshot reads and candidate publication.
 *
 * Place in the package: an optional App-side library. Documents, storage, authorization and
 * provenance are App-owned; this directory owns the section tree, budgeted reads, opaque
 * snapshot identity and the candidate/publish lifecycle over an atomic store revision.
 *
 * Exports: everything from `./catalog.js` and `./publication.js`, `parseKnowledgeDocument`, and
 * the `Knowledge` namespace object.
 */
export * from './catalog.js';
export { parseKnowledgeDocument } from './sections.js';

import { defineKnowledgeCatalog } from './catalog.js';
import { parseKnowledgeDocument } from './sections.js';
import { defineKnowledgePublication } from './publication.js';
export * from './publication.js';

/** Namespace object for callers that prefer one import over named helpers. */
export const Knowledge = Object.freeze({
  defineKnowledgeCatalog,
  parseKnowledgeDocument,
  defineKnowledgePublication,
});

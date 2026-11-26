/**
 * Knowledge Kit: compile documents into a sectioned catalog and read budgeted snapshots.
 *
 * Place in the package: part of the `knowledge` Kit. A snapshot carries text, revision and an
 * opaque id; this module never fetches, authorizes or persists — it only resolves declared
 * documents and sections.
 *
 * Exports: `defineKnowledgeCatalog`, and the knowledge document/read/snapshot types.
 */
import { nativeReportedStepSync } from '../../diagnostics/native-sub-flow.js';
import { readonlyCatalog } from '../../utils/catalog.js';
import type {
  KnowledgeCatalogOptions,
  KnowledgeDocument,
  KnowledgeRead,
  KnowledgeSnapshot,
  KnowledgeCatalog,
} from '../../structs/kits/knowledge.js';
import { compileKnowledgeDocument, knowledgeText } from './sections.js';
import { observeSafely } from '../../utils/observer.js';

/**
 * Compile a knowledge catalog from document declarations.
 *
 * Reads are declarative: `document` returns the whole text, `self` returns exactly the named
 * sections and `subtree` includes their nested sections. Section ids are validated up front,
 * so a typo fails at read time instead of silently returning partial content.
 *
 * @param documents - Unique-id documents, each compiled into an immutable section tree.
 * @param options - Optional `maxChars` budget and an observer for successful reads.
 * @returns A frozen catalog extended with `sectionIds`, `assertSelection` and `read`.
 * @throws TypeError For a duplicate document id, an invalid budget, an unknown document or
 *   section, or a malformed selection; `RangeError` when the content exceeds `maxChars`.
 */
export function defineKnowledgeCatalog(
  documents: readonly KnowledgeDocument[],
  options: KnowledgeCatalogOptions = {},
): KnowledgeCatalog {
  const { maxChars } = options,
    observe = options.observe?.bind(options);
  const catalog = new Map<string, ReturnType<typeof compileKnowledgeDocument>>();
  if (maxChars !== undefined && (!Number.isSafeInteger(maxChars) || maxChars < 1))
    throw new TypeError('Invalid knowledge budget');
  for (const document of documents) {
    if (catalog.has(document.id))
      throw new TypeError(`Duplicate knowledge document: ${document.id}`);
    catalog.set(document.id, compileKnowledgeDocument(document));
  }
  const resolve = (input: KnowledgeRead) => {
    if (!input || typeof input !== 'object') throw new TypeError('Invalid knowledge request');
    const read = { documentId: input.documentId, selection: input.selection },
      entry = catalog.get(read.documentId);
    if (!entry) throw new TypeError(`Unknown knowledge document: ${read.documentId}`);
    if (!read.selection || !['document', 'self', 'subtree'].includes(read.selection.mode))
      throw new TypeError('Invalid knowledge selection');
    if (read.selection.mode !== 'document') {
      if (
        !Array.isArray(read.selection.sectionIds) ||
        !read.selection.sectionIds.length ||
        new Set(read.selection.sectionIds).size !== read.selection.sectionIds.length
      )
        throw new TypeError('Invalid knowledge section selection');
      for (const id of read.selection.sectionIds)
        if (!entry.sections.has(id))
          throw new TypeError(`Unknown knowledge section: ${read.documentId}/${id}`);
    }
    return { read, entry };
  };
  const sectionIds = (id: string) => {
    const entry = catalog.get(id);
    if (!entry) throw new TypeError(`Unknown knowledge document: ${id}`);
    return Object.freeze([...entry.sections.keys()]);
  };
  const assertSelection = (read: KnowledgeRead) => {
    resolve(read);
  };
  return Object.freeze({
    ...readonlyCatalog(
      [...catalog.values()].map((entry) => entry.document),
      (id) => new TypeError(`Unknown knowledge document: ${id}`),
    ),
    sectionIds,
    assertSelection,
    read(
      input: KnowledgeRead,
      context: Partial<
        Pick<import('../../structs/common.js').ExecutionContext, 'logger' | 'signal'>
      > = {},
    ): KnowledgeSnapshot {
      return nativeReportedStepSync(context, 'knowledge', input?.documentId ?? 'knowledge', () => {
        const { read, entry } = resolve(input),
          raw = read.selection;
        const selection =
          raw.mode === 'document'
            ? Object.freeze({ mode: 'document' as const })
            : Object.freeze({ mode: raw.mode, sectionIds: Object.freeze([...raw.sectionIds]) });
        const content = (
          selection.mode === 'document'
            ? knowledgeText(entry.document.parts)
            : selection.sectionIds
                .map((id) =>
                  knowledgeText(entry.sections.get(id)!.parts, selection.mode === 'subtree'),
                )
                .join('\n\n')
        ).trim();
        if (maxChars !== undefined && content.length > maxChars)
          throw new RangeError('Knowledge selection exceeds its budget');
        // Preserve the existing opaque snapshot identity format.
        const identitySelection =
          selection.mode === 'document'
            ? selection
            : { mode: selection.mode, sections: selection.sectionIds };
        const snapshot = Object.freeze({
          documentId: read.documentId,
          selection,
          revision: entry.document.revision,
          locale: entry.document.locale,
          content,
          id: JSON.stringify([
            read.documentId,
            entry.document.revision,
            entry.document.locale,
            identitySelection,
          ]),
        });
        observeSafely(observe, snapshot);
        return snapshot;
      });
    },
  });
}
export type * from '../../structs/kits/knowledge.js';

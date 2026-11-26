/**
 * Knowledge document contract for the Knowledge Kit.
 *
 * Place in the package: an optional App-side catalog of structured text. Documents are nested
 * sections of strings; a read selects the whole document or explicit sections and returns an
 * immutable snapshot with content, revision and identity for citation.
 *
 * Exports: `KnowledgeSection`, `KnowledgePart`, `KnowledgeDocument`, `SectionSelection`,
 * `KnowledgeRead`, `KnowledgeSnapshot`, `KnowledgeCatalogOptions`, `KnowledgeCatalog`.
 */
import type { ReadonlyCatalog } from '../common.js';

/** A named section that may contain text and further sections. */
export interface KnowledgeSection {
  /** Section id, unique within its document; used by section selections. */
  readonly id: string;
  /** Section content in order; nested sections are addressed independently. */
  readonly parts: readonly KnowledgePart[];
}
/** Document content: a text leaf or a nested section. */
export type KnowledgePart = string | KnowledgeSection;

/** One versioned document as supplied by the App. */
export interface KnowledgeDocument {
  /** Stable document id; duplicate ids are rejected by the catalog. */
  readonly id: string;
  /** Revision label recorded in every snapshot so a citation names the exact content. */
  readonly revision: string;
  /** Locale of the content, when the App maintains translations. */
  readonly locale?: string;
  /** Ordered content. */
  readonly parts: readonly KnowledgePart[];
}
/** Which part of a document a read returns. */
export type SectionSelection =
  /** The whole document. */
  | { readonly mode: 'document' }
  /** `self` returns only the named sections; `subtree` also includes their descendants. */
  | { readonly mode: 'self' | 'subtree'; readonly sectionIds: readonly string[] };
/** A request for one document selection. */
export interface KnowledgeRead {
  readonly documentId: string;
  /** Must reference existing sections; an invalid selection throws. */
  readonly selection: SectionSelection;
}
/** Materialized read result. */
export interface KnowledgeSnapshot extends KnowledgeRead {
  /** Deterministic identity derived from document, revision and selection. */
  readonly id: string;
  /** Revision of the document that produced this content. */
  readonly revision: string;
  readonly locale?: string;
  /** Rendered text, trimmed; sections are separated by blank lines. */
  readonly content: string;
}
/** Catalog construction options. */
export interface KnowledgeCatalogOptions {
  /** Maximum characters per read; exceeding it throws a `RangeError`. */
  readonly maxChars?: number;
  /** Observer invoked with every produced snapshot. */
  readonly observe?: (snapshot: KnowledgeSnapshot) => void | Promise<void>;
}
/** Compiled catalog of knowledge documents. */
export interface KnowledgeCatalog extends ReadonlyCatalog<KnowledgeDocument> {
  /** Section ids of one document, in declaration order; throws for an unknown document. */
  sectionIds(documentId: string): readonly string[];
  /** Validates a read without producing content; throws when the selection is invalid. */
  assertSelection(read: KnowledgeRead): void;
  /** Produces a snapshot for the read; throws for unknown documents, sections or budget excess. */
  read(read: KnowledgeRead): KnowledgeSnapshot;
}

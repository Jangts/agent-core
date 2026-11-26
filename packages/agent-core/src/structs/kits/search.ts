/**
 * Text search contract for the Text Search Kit.
 *
 * Place in the package: an optional App-side full-text index. The Kit owns the index, declarative
 * field validation and snapshot compatibility; the corpus, tokenization policy, storage, identity,
 * filters and persistence stay with the App.
 *
 * Exports: `TextSearchOptions`, `TextSearchHit`, `TextSearchQuery`, `TextSearchSnapshot`.
 */
import type { SearchHit } from '../common.js';
/** App supplies fields, tokenizer and its own schema/tokenizer revision. */
export interface TextSearchOptions<Document extends { id: string }> {
  /** App-owned revision of the field/tokenizer configuration; a change invalidates snapshots. */
  readonly indexRevision: string;
  /** Fields that are indexed and searchable. */
  readonly fields: readonly (keyof Document & string)[];
  /** Fields returned in a hit; the indexed body is not implicitly returned. */
  readonly storedFields: readonly (keyof Document & string)[];
  /** Tokenizer override; defaults to MiniSearch's default tokenizer. */
  readonly tokenize?: (text: string, fieldName?: string) => string[];
  /** Per-field relevance multiplier; omitted fields keep the default weight. */
  readonly boost?: Readonly<Partial<Record<keyof Document & string, number>>>;
  /** How multiple query terms combine; defaults to the engine default (OR). */
  readonly combineWith?: 'AND' | 'OR';
}
/** One ranked match; `terms` are post-tokenization and only stored fields are returned. */
export interface TextSearchHit<Document extends { id: string }> extends SearchHit<
  Partial<Document>
> {
  /** Matched terms, as reported by the engine after tokenization. */
  readonly terms: readonly string[];
  /** Inherited `document` carries stored fields only; the indexed body is not returned. */
}
/** Search input: a hard result limit and an App-owned filter, both required on every query. */
export interface TextSearchQuery<Document extends { id: string }> {
  /** Maximum number of hits returned. */
  readonly limit: number;
  /** Required on every query; the application owns authorization and applicability. */
  readonly filter: (document: Readonly<Partial<Document>> & { id: string }) => boolean;
}
/** Serialized index; the revision pair proves the snapshot matches the current configuration. */
export interface TextSearchSnapshot {
  /** Snapshot format version; other versions are not loaded. */
  readonly version: 2;
  /** Engine that produced the snapshot; a different engine cannot restore it. */
  readonly engine: 'minisearch-7';
  /** Fingerprint of the field and tokenizer configuration that built the index. */
  readonly configurationFingerprint: string;
  /** Serialized MiniSearch index. */
  readonly serializedIndex: string;
}

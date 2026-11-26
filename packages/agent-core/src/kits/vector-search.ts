/**
 * Vector Search Kit: exact cosine search over a small, App-owned embedded corpus.
 *
 * Place in the package: an optional App-side library. The Kit stores vectors and computes
 * scores; embeddings, document identity, metadata and persistence stay with the App. The
 * corpus is held in memory and scanned exhaustively, so it suits bounded sets only.
 *
 * Exports: `VectorSearch`, `VectorSearchSpace`, `VectorSearchQuery`, `VectorSearchHit`.
 */
import type { SearchHit } from '../structs/common.js';
import { synchronous, booleanResult } from '../utils/synchronous.js';
import { breakWhile } from '../utils/rules.js';
/** Embedding space identity and width; vectors from another space must never be mixed in. */
export interface VectorSearchSpace {
  /** Non-blank space name, for example `model@revision`; reported back by `VectorSearch`. */
  readonly identity: string;
  /** Expected vector length, 1..16384. */
  readonly dimensions: number;
}
/** One search hit; the document is a cloned snapshot, not the indexed instance. */
export interface VectorSearchHit<Document> extends SearchHit<Document> {}
/** Search options excluding the query vector, which `search` takes alongside them. */
export interface VectorSearchQuery<Document> {
  /** Maximum hits returned, 1..1000. */
  readonly limit: number;
  /** Synchronous predicate over a document snapshot; false excludes the candidate. */
  readonly filter: (document: Readonly<Document>) => boolean;
  /** Minimum cosine score in [-1, 1]; defaults to -1, which keeps every candidate. */
  readonly minScore?: number;
  /** Optional group key; only the best hit per group is kept, defaulting to the document id. */
  readonly groupBy?: (document: Readonly<Document>) => string;
}

/**
 * Validate a vector and normalize it to unit length.
 *
 * Scaling by the largest component first keeps the squared sum inside the float range for
 * long vectors, so normalization cannot overflow to Infinity.
 */
function normalize(vector: readonly number[], dimensions: number): Float32Array {
  breakWhile(
    !Array.isArray(vector) ||
      vector.length !== dimensions ||
      Array.from(vector).some((n) => typeof n !== 'number' || !Number.isFinite(n)),
    'Invalid vector dimensions or values',
  );
  const scale = Math.max(...vector.map(Math.abs));
  breakWhile(scale === 0, 'Zero vector cannot be searched');
  const norm = Math.sqrt(vector.reduce((sum, n) => sum + (n / scale) ** 2, 0));
  return Float32Array.from(vector, (n) => n / scale / norm);
}
/**
 * Exact cosine search for a bounded embedded corpus. Identity and metadata are App-owned.
 *
 * Vectors arrive as plain arrays and are stored normalized in `Float32Array` form, so query
 * time only needs a dot product per candidate.
 */
export class VectorSearch<Document extends { id: string }> {
  private readonly entries = new Map<string, { document: Document; vector: Float32Array }>();
  /** The declared space; compare it before mixing vectors from another source. */
  readonly space: VectorSearchSpace;
  /**
   * @param space - Non-blank identity and dimensions (1..16384) of the corpus.
   * @throws TypeError When the space declaration is invalid.
   */
  constructor(space: VectorSearchSpace) {
    breakWhile(
      !space.identity?.trim() ||
        !Number.isSafeInteger(space.dimensions) ||
        space.dimensions < 1 ||
        space.dimensions > 16384,
      'Invalid vector space',
    );
    this.space = Object.freeze({ identity: space.identity, dimensions: space.dimensions });
  }
  /**
   * Insert or replace one document and its embedding.
   *
   * @param document - Document with a non-blank string `id`; it is cloned before being stored.
   * @param vector - Raw vector for this space.
   * @throws TypeError For a blank/missing id, a vector of the wrong width, a non-finite
   *   component, or an all-zero vector (cosine is undefined for it).
   */
  upsert({ document, vector }: { document: Document; vector: readonly number[] }): void {
    breakWhile(!document?.id?.trim(), 'Invalid vector document id');
    this.entries.set(document.id, {
      document: structuredClone(document),
      vector: normalize(vector, this.space.dimensions),
    });
  }
  /** Remove one document; returns whether it was present. */
  remove(id: string) {
    return this.entries.delete(id);
  }
  /** Drop the whole corpus while keeping the declared space. */
  clear() {
    this.entries.clear();
  }
  /**
   * Score every candidate and return the best hits.
   *
   * @param options - Query vector plus limit, filter, minimum score and optional grouping.
   * @returns At most `limit` hits, best score first, ties broken by id.
   * @throws TypeError For an invalid limit, a missing filter, an out-of-range `minScore`, a
   *   vector the space rejects, a non-synchronous filter or grouper, or a non-string group.
   */
  search(
    options: VectorSearchQuery<Document> & { vector: readonly number[] },
  ): VectorSearchHit<Document>[] {
    const { vector } = options;
    breakWhile(
      !Number.isSafeInteger(options.limit) ||
        options.limit < 1 ||
        options.limit > 1000 ||
        typeof options.filter !== 'function' ||
        (options.minScore !== undefined &&
          (!Number.isFinite(options.minScore) || options.minScore < -1 || options.minScore > 1)),
      'Invalid vector query',
    );
    const query = normalize(vector, this.space.dimensions),
      groups = new Map<string, VectorSearchHit<Document>>();
    for (const [id, { document, vector: value }] of this.entries) {
      // Each callback receives its own snapshot; readonly types cannot prevent runtime mutation.
      const allowed = booleanResult(
        options.filter(structuredClone(document)),
        'Vector filters must be synchronous',
        'Vector filters must return boolean',
      );
      if (!allowed) continue;
      let score = 0;
      for (let i = 0; i < query.length; i++) score += query[i] * value[i];
      score = Math.max(-1, Math.min(1, score));
      if (score < (options.minScore ?? -1)) continue;
      const group =
        synchronous(
          options.groupBy?.(structuredClone(document)),
          'Vector grouping must be synchronous',
        ) ?? id;
      if (typeof group !== 'string') throw new TypeError('Vector groups must be strings');
      const prior = groups.get(group);
      if (!prior || score > prior.score || (score === prior.score && id < prior.id))
        groups.set(group, { id, score, document: structuredClone(document) });
    }
    return [...groups.values()]
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .slice(0, options.limit);
  }
}

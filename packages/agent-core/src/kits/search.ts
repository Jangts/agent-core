/**
 * Text Search Kit: an in-memory MiniSearch index with explicit field declarations.
 *
 * Place in the package: an optional App-side full-text index. The Kit owns the index,
 * declarative validation and snapshot compatibility; corpus, tokenization policy, storage,
 * identity, filters and persistence stay with the App. No model call or Core dependency is
 * involved, and nothing is written to disk here.
 *
 * Exports: `TextSearch` and the search option/query/hit/snapshot types.
 */
import { booleanResult } from '../utils/synchronous.js';
import MiniSearch from 'minisearch';
import type { SearchResult } from 'minisearch';
import { breakWhile } from '../utils/rules.js';
import type {
  TextSearchOptions,
  TextSearchQuery,
  TextSearchHit,
  TextSearchSnapshot,
} from '../structs/kits/search.js';

/**
 * Optional App-side full-text index. No storage, identity, model calls or Core dependencies.
 *
 * Only declared fields are indexed and only `storedFields` come back with a hit, so a document
 * never leaks extra properties into search results.
 */
export class TextSearch<Document extends { id: string }> {
  private readonly options;
  private readonly stored: readonly string[];
  private readonly inputFields: readonly string[];
  private readonly configurationFingerprint: string;
  private readonly tokenize: TextSearchOptions<Document>['tokenize'];
  private preparedTokens?: ReadonlyMap<string, string[]>;
  private index: MiniSearch<Document>;
  /**
   * Compile the index configuration and validate it before any document is added.
   *
   * @param registration - Format revision, indexed and stored fields, optional tokenizer,
   *   boosts and combination mode; handlers are bound to this object.
   * @throws TypeError For a missing revision, empty/duplicate/blank field declarations, stored
   *   fields that collide with search metadata, an invalid tokenizer or combination, or a
   *   boost for an undeclared field or with a non-positive value.
   */
  constructor(registration: TextSearchOptions<Document>) {
    const definition = {
      indexRevision: registration.indexRevision,
      fields: registration.fields,
      storedFields: registration.storedFields,
      tokenize: registration.tokenize,
      boost: registration.boost,
      combineWith: registration.combineWith,
    };
    const reserved = new Set(['id', 'score', 'terms', 'queryTerms', 'match']);
    breakWhile(
      [
        {
          occur: () =>
            !definition ||
            typeof definition.indexRevision !== 'string' ||
            !definition.indexRevision.trim(),
          error: 'Text search requires an application format revision',
        },
        {
          occur: () =>
            !Array.isArray(definition.fields) ||
            !definition.fields.length ||
            !Array.isArray(definition.storedFields),
          error: 'Text search requires field declarations',
        },
        {
          occur: () =>
            [...definition.fields, ...definition.storedFields].some(
              (f) => typeof f !== 'string' || !f.trim(),
            ),
          error: 'Invalid text search field',
        },
        {
          occur: () =>
            new Set(definition.fields).size !== definition.fields.length ||
            new Set(definition.storedFields).size !== definition.storedFields.length,
          error: 'Duplicate text search field',
        },
        {
          occur: () => definition.storedFields.some((f) => reserved.has(f)),
          error: 'Stored fields conflict with search metadata',
        },
        {
          occur: () =>
            definition.tokenize !== undefined && typeof definition.tokenize !== 'function',
          error: 'Invalid text search tokenizer',
        },
        {
          occur: () =>
            definition.combineWith !== undefined && !['AND', 'OR'].includes(definition.combineWith),
          error: 'Invalid text search combination',
        },
        {
          occur: () =>
            Object.entries(definition.boost ?? {}).some(
              ([field, value]) =>
                !definition.fields.includes(field as keyof Document & string) ||
                typeof value !== 'number' ||
                !Number.isFinite(value) ||
                value <= 0,
            ),
          error: 'Invalid text search field boost',
        },
      ],
      ['kit', 'text-search', 'registration'],
    );
    this.stored = Object.freeze([...definition.storedFields]);
    this.inputFields = Object.freeze([...new Set([...definition.fields, ...this.stored])]);
    // Object entries have distinct keys, so there is no equal-key ordering case.
    const boost = Object.fromEntries(
      Object.entries(definition.boost ?? {}).sort(([a], [b]) => (a < b ? -1 : 1)),
    ) as Record<string, number>;
    const tokenize = definition.tokenize?.bind(registration);
    this.tokenize = tokenize;
    this.options = {
      fields: [...definition.fields],
      storeFields: [...definition.storedFields],
      ...(tokenize
        ? {
            tokenize: (text: string, field?: string) =>
              field === undefined ? tokenize(text) : this.preparedTokens!.get(field)!,
          }
        : {}),
      searchOptions: { boost, combineWith: definition.combineWith ?? 'OR' },
    };
    this.configurationFingerprint = JSON.stringify({
      indexRevision: definition.indexRevision,
      fields: this.options.fields,
      storedFields: this.options.storeFields,
      boost: this.options.searchOptions.boost,
      combineWith: this.options.searchOptions.combineWith,
    });
    this.index = new MiniSearch<Document>(this.options);
  }
  /**
   * Insert or replace one document.
   *
   * @param document - Document carrying a non-blank string `id`; only declared fields are kept.
   * @throws TypeError For a missing document, a blank/non-string id, or a non-string value in
   *   an indexed field. A failing tokenizer leaves the previous index intact.
   */
  upsert(document: Document): void {
    breakWhile(!document, 'Invalid text search document');
    // Only declared fields belong to this index. Read inherited getters before
    // cloning and do not retain caller-owned nested metadata or extra services.
    const snapshot = structuredClone({
      ...Object.fromEntries(
        this.inputFields.map((field) => [field, document[field as keyof Document]]),
      ),
      id: document.id,
    }) as Document;
    breakWhile(
      typeof snapshot.id !== 'string' ||
        !snapshot.id.trim() ||
        this.options.fields.some(
          (field) => snapshot[field] !== undefined && typeof snapshot[field] !== 'string',
        ),
      'Invalid text search document',
    );
    this.preparedTokens = this.prepareTokens(snapshot);
    try {
      if (this.index.has(snapshot.id)) this.index.replace(snapshot);
      else this.index.add(snapshot);
    } finally {
      this.preparedTokens = undefined;
    }
  }

  /** Run the App tokenizer before MiniSearch discards or inserts any document. */
  private prepareTokens(document: Document): ReadonlyMap<string, string[]> | undefined {
    if (!this.tokenize) return undefined;
    const prepared = new Map<string, string[]>();
    for (const field of this.options.fields) {
      const value = document[field];
      if (value === undefined) continue;
      const tokens = this.tokenize(value as string, field);
      breakWhile(!Array.isArray(tokens), 'Text search tokenizer must return an array of strings');
      const terms = Array.from(tokens);
      breakWhile(
        terms.some((term) => typeof term !== 'string'),
        'Text search tokenizer must return an array of strings',
      );
      prepared.set(field, terms);
    }
    return prepared;
  }
  /**
   * Search the index and return at most `limit` hits.
   *
   * @param options - Non-empty query text, limit (1..1000) and a synchronous filter that decides
   *   which stored documents may be returned.
   * @returns Hits ordered by MiniSearch relevance, carrying the stored fields only.
   * @throws TypeError For a blank query, an out-of-range limit, a missing filter, a filter
   *   result that is not synchronous boolean.
   */
  search(options: TextSearchQuery<Document> & { query: string }): TextSearchHit<Document>[] {
    const { query } = options;
    breakWhile(
      [
        {
          occur: () => typeof query !== 'string' || !query.trim(),
          error: 'Text search requires a nonempty query',
        },
        {
          occur: () =>
            !options ||
            !Number.isSafeInteger(options.limit) ||
            options.limit < 1 ||
            options.limit > 1000,
          error: 'Text search limit must be between 1 and 1000',
        },
        {
          occur: () => typeof options.filter !== 'function',
          error: 'Text search requires an application filter',
        },
      ],
      ['kit', 'text-search', 'query'],
    );
    return this.index
      .search(query, {
        filter: (hit) =>
          booleanResult(
            options.filter({ ...this.fields(hit), id: String(hit.id) }),
            'Text search filters must be synchronous',
            'Text search filters must return boolean',
          ),
      })
      .slice(0, options.limit)
      .map((hit) => ({
        id: String(hit.id),
        score: hit.score,
        terms: [...hit.terms],
        document: this.fields(hit),
      }));
  }
  private fields(hit: SearchResult): Partial<Document> {
    return structuredClone(
      Object.fromEntries(
        this.stored
          .filter((field) => Object.hasOwn(hit, field))
          .map((field) => [field, hit[field]]),
      ),
    ) as Partial<Document>;
  }
  /**
   * Remove one document.
   *
   * Vacuum before returning so deleted terms do not survive the next serialized checkpoint.
   *
   * @param id - Document id; a non-blank string is required.
   * @returns Whether a document was actually discarded.
   * @throws TypeError For a blank or non-string id.
   */
  async remove(id: string): Promise<boolean> {
    breakWhile(typeof id !== 'string' || !id.trim(), 'Invalid text search document id');
    if (!this.index.has(id)) return false;
    this.index.discard(id);
    await this.index.vacuum();
    return true;
  }
  /** Drop every document while keeping the compiled configuration. */
  clear(): void {
    this.index.removeAll();
  }
  /**
   * Serialize the index together with the configuration used to build it.
   *
   * @returns A versioned snapshot; the fingerprint lets `restore` reject a mismatched setup.
   */
  snapshot(): TextSearchSnapshot {
    return {
      // The layout version and engine tag pin the serialized format to MiniSearch 7 semantics.
      version: 2,
      engine: 'minisearch-7',
      configurationFingerprint: this.configurationFingerprint,
      serializedIndex: JSON.stringify(this.index),
    };
  }
  /**
   * Rebuild an index from a snapshot.
   *
   * @param definition - The same configuration the snapshot was produced with.
   * @param snapshot - Snapshot returned by `snapshot`.
   * @returns A new populated `TextSearch`.
   * @throws An error when the layout version, engine tag, configuration fingerprint or payload
   *   type does not match, because restoring an incompatible index would silently misanswer.
   */
  static restore<Document extends { id: string }>(
    definition: TextSearchOptions<Document>,
    snapshot: TextSearchSnapshot,
  ): TextSearch<Document> {
    const search = new TextSearch(definition);
    breakWhile(
      !snapshot ||
        snapshot.version !== 2 ||
        snapshot.engine !== 'minisearch-7' ||
        snapshot.configurationFingerprint !== search.configurationFingerprint ||
        typeof snapshot.serializedIndex !== 'string',
      'Incompatible text search snapshot; rebuild from application records',
    );
    search.index = MiniSearch.loadJSON<Document>(snapshot.serializedIndex, search.options);
    return search;
  }
}
export type {
  TextSearchOptions,
  TextSearchQuery,
  TextSearchHit,
  TextSearchSnapshot,
} from '../structs/kits/search.js';

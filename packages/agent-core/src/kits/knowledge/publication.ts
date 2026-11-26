/**
 * Knowledge Kit: candidate preparation, verification and atomic publication of documents.
 *
 * Place in the package: part of the `knowledge` Kit. The store, authorization and provenance
 * checks are App ports; this module owns revision checking, candidate expiry and capacity,
 * compilation of proposed documents and the compare-and-swap commit.
 *
 * Exports: `defineKnowledgePublication`, and the publication record/candidate/source types.
 */
import { defineKnowledgeCatalog } from './catalog.js';
import { invocationId } from '../../utils/invocation.js';
import { awaitWithSignal, awaitAssertion } from '../../utils/cancellation.js';
import { breakWhile } from '../../utils/rules.js';
import type { OperationContext } from '../../structs/common.js';
import type { KnowledgeDocument } from '../../structs/kits/knowledge.js';
import type {
  KnowledgeCandidate,
  KnowledgePublication,
  KnowledgePublicationOptions,
  KnowledgePublicationRecord,
  KnowledgeSourceReference,
} from '../../structs/kits/knowledge-publication.js';

/**
 * Compile a publication lifecycle over one App-owned atomic record.
 *
 * Candidate preparation and publication share the same compiler and an App-owned atomic
 * revision. `propose` compiles and validates a candidate but leaves published documents alone;
 * `publish` re-verifies sources and the base revision before swapping, so a stale candidate can
 * never overwrite newer content.
 *
 * @param options - Store, authorization, provenance verification, clock, optional required
 *   reads, capacity and retention bounds; handlers are bound to this options object.
 * @returns A frozen publication exposing `read`, `propose`, `publish` and `reject`.
 * @throws A configured error for invalid bounds, a malformed record or candidate, a revision
 *   conflict, an expired candidate, exhausted capacity, a changed base revision, or a public
 *   document whose content changed without a new revision.
 */
export function defineKnowledgePublication<App>(
  options: KnowledgePublicationOptions<App>,
): KnowledgePublication<App> {
  const load = options.store.load.bind(options.store),
    swap = options.store.compareAndSwap.bind(options.store);
  const authorize = options.authorize.bind(options),
    verify = options.verifySources.bind(options),
    now = options.now?.bind(options) ?? Date.now;
  // Defaults keep one record small: at most 32 pending candidates, each valid for seven days.
  const maxCandidates = options.maxCandidates ?? 32,
    retention = options.candidateRetentionMs ?? 7 * 86400_000;
  const maxChars = options.maxReadChars,
    reads = structuredClone(options.requiredReads ?? []);
  breakWhile(
    !Number.isSafeInteger(maxCandidates) ||
      maxCandidates < 1 ||
      !Number.isSafeInteger(retention) ||
      retention < 1,
    'Invalid publication bounds',
  );
  const compile = (documents: readonly KnowledgeDocument[]) => {
    const catalog = defineKnowledgeCatalog(documents, { maxChars });
    for (const read of reads) catalog.read(read);
    return catalog;
  };
  // Keep only the last successfully compiled record. Include its full document
  // content so a broken store reusing a revision cannot bypass validation.
  let compiledRecord: string | undefined;
  const sourceSnapshot = (
    sources: readonly KnowledgeSourceReference[],
  ): KnowledgeSourceReference[] => {
    const invalid = 'Invalid or expired knowledge provenance';
    breakWhile(!Array.isArray(sources) || !sources.length || sources.length > 32, invalid);
    const snapshot = Array.from(sources, (source) => ({
      id: source?.id,
      revision: source?.revision,
      expiresAtMs: source?.expiresAtMs,
    }));
    breakWhile(
      snapshot.some(
        (source) =>
          typeof source.id !== 'string' ||
          !source.id.trim() ||
          typeof source.revision !== 'string' ||
          !source.revision.trim() ||
          (source.expiresAtMs !== undefined &&
            (!Number.isFinite(source.expiresAtMs) || source.expiresAtMs <= now())),
      ),
      invalid,
    );
    return snapshot;
  };
  const read = async (context: OperationContext<App>): Promise<KnowledgePublicationRecord> => {
    context.signal.throwIfAborted();
    const record = structuredClone(await awaitWithSignal(load(), context.signal));
    breakWhile(
      !record ||
        !Number.isSafeInteger(record.revision) ||
        record.revision < 0 ||
        !Number.isSafeInteger(record.publishedRevision) ||
        record.publishedRevision < 0 ||
        record.publishedRevision > record.revision ||
        !Array.isArray(record.documents) ||
        !Array.isArray(record.candidates) ||
        record.candidates.length > maxCandidates,
      'Invalid publication record',
    );
    breakWhile(
      new Set(record.candidates.map((item) => item?.id)).size !== record.candidates.length ||
        record.candidates.some(
          (item) =>
            !item ||
            typeof item.id !== 'string' ||
            !item.id ||
            !Number.isSafeInteger(item.baseRevision) ||
            item.baseRevision < 0 ||
            item.baseRevision > record.publishedRevision ||
            !Number.isFinite(item.createdAtMs) ||
            !Number.isFinite(item.expiresAtMs) ||
            item.expiresAtMs <= item.createdAtMs ||
            !Array.isArray(item.sources) ||
            !item.sources.length ||
            item.sources.length > 32,
        ),
      'Invalid knowledge candidate',
    );
    const compilationKey = JSON.stringify([
      record.revision,
      record.publishedRevision,
      record.documents,
      record.candidates.map((item) => item.document),
    ]);
    if (compilationKey !== compiledRecord) {
      for (const item of record.candidates)
        compile([...record.documents.filter((doc) => doc.id !== item.document.id), item.document]);
      compile(record.documents);
      compiledRecord = compilationKey;
    }
    context.signal.throwIfAborted();
    return record;
  };
  const commit = async (
    record: KnowledgePublicationRecord,
    next: KnowledgePublicationRecord,
    context: OperationContext<App>,
    assertCurrent?: () => void,
  ) => {
    context.signal.throwIfAborted();
    const snapshot = structuredClone(next);
    assertCurrent?.();
    context.signal.throwIfAborted();
    const saved = await swap(record.revision, snapshot);
    breakWhile(saved !== true, 'Knowledge publication revision conflict');
    context.signal.throwIfAborted();
    return structuredClone(next);
  };
  const checked = async (revision: number, context: OperationContext<App>) => {
    const record = await read(context);
    breakWhile(record.revision !== revision, 'Knowledge publication revision conflict');
    return record;
  };
  const replacement = (record: KnowledgePublicationRecord, document: KnowledgeDocument) => {
    const previous = record.documents.find((item) => item.id === document.id);
    breakWhile(
      !!previous &&
        previous.revision === document.revision &&
        JSON.stringify(previous) !== JSON.stringify(document),
      'Changed knowledge needs a new document revision',
    );
    const documents = [
      ...record.documents.filter((item) => item.id !== document.id),
      structuredClone(document),
    ];
    compile(documents);
    return documents;
  };
  const candidate = (record: KnowledgePublicationRecord, id: string): KnowledgeCandidate => {
    const item = record.candidates.find((value) => value.id === id);
    breakWhile(!item || item.expiresAtMs <= now(), 'Knowledge candidate unavailable');
    return item!;
  };
  return Object.freeze<KnowledgePublication<App>>({
    read,
    async propose(request, context) {
      context.signal.throwIfAborted();
      const document = structuredClone(request.document),
        revision = request.revision,
        sources = sourceSnapshot(request.sources);
      await awaitAssertion(
        () => authorize('propose', context),
        context.signal,
        'Knowledge publication authorization must return void',
      );
      const record = await checked(revision, context);
      sourceSnapshot(sources);
      replacement(record, document);
      await awaitAssertion(
        () => verify(structuredClone(sources), context),
        context.signal,
        'Knowledge provenance validation must return void',
      );
      sourceSnapshot(sources);
      const candidates = record.candidates.filter((item) => item.expiresAtMs > now());
      breakWhile(candidates.length >= maxCandidates, 'Knowledge candidate capacity exhausted');
      const item: KnowledgeCandidate = {
        id: invocationId(),
        baseRevision: record.publishedRevision,
        document,
        sources,
        createdAtMs: now(),
        expiresAtMs: Math.min(
          now() + retention,
          ...sources.map((source) => source.expiresAtMs ?? Infinity),
        ),
      };
      return commit(
        record,
        { ...record, revision: record.revision + 1, candidates: [...candidates, item] },
        context,
        () => {
          sourceSnapshot(sources);
          breakWhile(item.expiresAtMs <= now(), 'Knowledge candidate expired');
        },
      );
    },
    async publish(request, context) {
      const { revision, candidateId } = request;
      await awaitAssertion(
        () => authorize('publish', context),
        context.signal,
        'Knowledge publication authorization must return void',
      );
      const record = await checked(revision, context),
        item = candidate(record, candidateId);
      breakWhile(
        item.baseRevision !== record.publishedRevision,
        'Knowledge candidate base changed; prepare it again',
      );
      const sources = sourceSnapshot(item.sources);
      await awaitAssertion(
        () => verify(structuredClone(sources), context),
        context.signal,
        'Knowledge provenance validation must return void',
      );
      sourceSnapshot(sources);
      const documents = replacement(record, item.document);
      return commit(
        record,
        {
          ...record,
          revision: record.revision + 1,
          publishedRevision: record.publishedRevision + 1,
          documents,
          candidates: record.candidates.filter((value) => value.id !== item.id),
        },
        context,
        () => {
          candidate(record, item.id);
          sourceSnapshot(sources);
        },
      );
    },
    async reject(request, context) {
      const { revision, candidateId } = request;
      await awaitAssertion(
        () => authorize('reject', context),
        context.signal,
        'Knowledge publication authorization must return void',
      );
      const record = await checked(revision, context);
      candidate(record, candidateId);
      return commit(
        record,
        {
          ...record,
          revision: record.revision + 1,
          candidates: record.candidates.filter((item) => item.id !== candidateId),
        },
        context,
      );
    },
  });
}
export type * from '../../structs/kits/knowledge-publication.js';

/**
 * Reciprocal rank fusion for several ranked id lists.
 *
 * Place in the package: an optional App-side helper for merging retrieval or search results.
 * Only ranks are combined, never raw scores, so lists produced by incomparable scorers stay
 * comparable. Storage and source selection belong to the App.
 *
 * Exports: `reciprocalRankFusion`, `RankedList`, `FusedRank`.
 */
import { breakWhile } from '../utils/rules.js';
/** One retriever's ordered result, optionally weighted. */
export interface RankedList {
  /** Unique source name; duplicate names are rejected because they would double-count. */
  readonly sourceId: string;
  /** Ids in descending relevance; duplicates inside one list are ignored after the first. */
  readonly ids: readonly string[];
  /** Relative source weight, strictly positive; defaults to 1. */
  readonly weight?: number;
}
/** One fused result with the per-source ranks that produced its score. */
export interface FusedRank {
  /** Fused document id. */
  id: string;
  /** Sum of `weight / (k + rank)` over contributing sources; higher is better. */
  score: number;
  /** Contributions in source order, using one-based ranks. */
  contributions: { sourceId: string; rank: number; weight: number }[];
}
/**
 * Fuse ranked lists with one-based reciprocal rank fusion.
 *
 * Raw retriever scores are intentionally not mixed. Ties break on id, so the output is
 * deterministic for a given input.
 *
 * @param lists - Ranked lists with unique source ids and positive weights.
 * @param options - `limit` is the maximum number of fused results (1..1000); `k` smooths the
 *   contribution of the top ranks and defaults to the conventional value 60.
 * @returns At most `limit` fused ranks, best first.
 * @throws A configured error for invalid options, a duplicate/blank source id, non-string ids,
 *   or a non-positive weight.
 */
export function reciprocalRankFusion(
  lists: readonly RankedList[],
  options: { limit: number; k?: number },
): FusedRank[] {
  // 60 is the smoothing constant popularised by the original RRF paper and keeps rank
  // differences meaningful without letting the top hit dominate.
  const k = options.k ?? 60,
    sources = new Set<string>(),
    candidates = new Map<string, FusedRank>();
  breakWhile(
    !Number.isFinite(k) ||
      k < 0 ||
      !Number.isSafeInteger(options.limit) ||
      options.limit < 1 ||
      options.limit > 1000,
    'Invalid RRF options',
  );
  for (const list of lists) {
    const weight = list.weight ?? 1,
      sourceId = list.sourceId;
    breakWhile(
      !sourceId?.trim() ||
        sources.has(sourceId) ||
        !Array.isArray(list.ids) ||
        list.ids.some((id) => typeof id !== 'string' || !id.trim()) ||
        !Number.isFinite(weight) ||
        weight <= 0,
      'Invalid ranked source',
    );
    sources.add(sourceId);
    const seen = new Set<string>();
    for (const id of list.ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      const rank = seen.size;
      const candidate = candidates.get(id) ?? {
        id,
        score: 0,
        contributions: [],
      };
      candidate.score += weight / (k + rank);
      candidate.contributions.push({ sourceId, rank, weight });
      candidates.set(id, candidate);
    }
  }
  return [...candidates.values()]
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, options.limit);
}

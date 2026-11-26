/**
 * Candidates Kit: accept, bound and unpack an alternative-proposal envelope.
 *
 * Place in the package: an optional App-side validator for a model reply that may offer
 * several alternatives under one named field. It only narrows the shape; which alternatives
 * are acceptable, and what happens after the user picks one, stays with the App.
 *
 * Exports: `defineCandidateSelection`, `Candidates`, `CandidateSelectionDefinition`.
 */
import type { CandidateSelectionDefinition } from '../structs/kits/candidates.js';
import { breakWhile } from '../utils/rules.js';

/**
 * Compile an alternative-proposal envelope contract.
 *
 * Alternative proposals are bounded and shallow; accepting a task closes this capability.
 * A value that is not an object, or that does not carry the candidate field, is treated as a
 * single implicit candidate and returned as-is. Once the envelope is present it must contain
 * only that field, and its array must hold between `minCandidates` (default 1) and
 * `maxCandidates` distinct candidate objects that do not themselves repeat the field.
 *
 * @param definition - Field name, bounds, optional error wording and diagnostic tags.
 * @returns A frozen selector exposing `field`, the resolved bounds and `parse`.
 * @throws TypeError When the field name or bounds are invalid.
 */
export function defineCandidateSelection(definition: CandidateSelectionDefinition) {
  const { field, error: configuredError, maxCandidates: max } = definition;
  const error =
    typeof configuredError === 'function' ? configuredError.bind(definition) : configuredError;
  const min = definition.minCandidates ?? 1;
  const tags = [...(definition.tags ?? [])];
  breakWhile([
    { occur: () => !field.trim(), error: 'Missing candidate field' },
    {
      occur: [
        () => !Number.isSafeInteger(min) || !Number.isSafeInteger(max),
        () => min < 1 || max < min,
      ],
      error: 'Invalid candidate bounds',
    },
  ]);
  /**
   * Unpack the candidates from one parsed reply value.
   *
   * @param request - The raw value plus whether proposals are still allowed at this point.
   * @returns The candidate list, or `[value]` when no envelope is present.
   * @throws TypeError When `allowed` is not boolean, or when the envelope is disallowed,
   *   malformed, out of bounds or contains nested candidate envelopes.
   */
  function parse({ value, allowed }: { value: unknown; allowed: boolean }): unknown[] {
    if (typeof allowed !== 'boolean') throw new TypeError('Candidate availability must be boolean');

    if (!value || typeof value !== 'object' || !Object.hasOwn(value, field)) return [value];
    const candidates = (value as Record<string, unknown>)[field] as unknown[];
    breakWhile(
      [
        { occur: () => !allowed, error, tags: ['availability'] },
        {
          occur: () => Array.isArray(value) || Object.keys(value).length !== 1,
          error,
          tags: ['envelope'],
        },
        {
          occur: [
            () => !Array.isArray(candidates),
            () => candidates.length < min || candidates.length > max,
          ],
          error,
          tags: ['selection'],
        },
        {
          occur: () => candidates.some((candidate) => invalidCandidate(candidate, field)),
          error,
          tags: ['members'],
        },
      ],
      tags,
    );
    return candidates;
  }
  return Object.freeze({ field, minCandidates: min, maxCandidates: max, parse });
}

function invalidCandidate(value: unknown, field: string): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return true;
  return Object.hasOwn(value, field);
}

export type { CandidateSelectionDefinition } from '../structs/kits/candidates.js';

/** Namespace object for callers that prefer one import over named helpers. */
export const Candidates = Object.freeze({ defineCandidateSelection });

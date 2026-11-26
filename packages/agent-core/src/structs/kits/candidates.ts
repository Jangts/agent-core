/**
 * Candidate envelope contract for the Candidates Kit.
 *
 * Place in the package: an optional App-side validator for a model reply that may offer several
 * alternatives under one named field. The definition only declares the shape and bounds; which
 * alternatives are acceptable, and what happens after the user picks one, stays with the App.
 *
 * Exports: `CandidateSelectionDefinition`.
 */
import type { BreakReason } from '../utils/rules.js';

/**
 * Declares the alternative-proposal envelope.
 *
 * A value without the declared field is treated as a single implicit candidate.
 */
export interface CandidateSelectionDefinition {
  /** Reply field that carries the alternatives. */
  readonly field: string;
  /** Minimum number of distinct candidates once the envelope is present; defaults to 1. */
  readonly minCandidates?: number;
  /** Maximum number of candidates; must be a safe integer not below the minimum. */
  readonly maxCandidates: number;
  /** Rejection wording, either fixed, a pre-built error or a lazy factory. */
  readonly error?: BreakReason;
  /** Diagnostic tags attached to every rejection from this contract. */
  readonly tags?: readonly string[];
}

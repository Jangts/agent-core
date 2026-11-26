/**
 * Context surface: fragment trust, per-fragment budgets, message assembly, structural audit,
 * the request-local journal and plan assembly.
 *
 * Core owns the guarantees here. A fragment declares its trust, lifetime and character
 * budget in one place; assembly validates those declarations and refuses to truncate;
 * auditing rejects structural change to protected fragments. Apps choose ordering, selection,
 * compression and model policy; optional Support nodes execute the declared processing before
 * this boundary, using App handlers where required. Optional Kit helpers
 * such as evidence checks are imported from their own `/kits/*` entries, not from here.
 *
 * Exports: `assembleFragments`, `assembleContextPlan`, `ContextJournal` and the fragment helpers.
 */
export * from './fragments.js';
export { assembleFragments } from './assembly.js';
export * from './journal.js';

export type { ContextPlan } from '../structs/context/processing.js';

export { assembleContextPlan } from './plan.js';

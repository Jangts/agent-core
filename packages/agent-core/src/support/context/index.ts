/**
 * Context support: app-side assembly, reduction and selection helpers for Core context plans.
 *
 * Core keeps the trust, budget, assembly and structural-audit guarantees. This module supplies
 * recommended builders (assembly, compressor, selector, strategy) and node factories that plug
 * into an application workflow; it does not replace Core's processing contract.
 *
 * Main exports: `defineContextAssembly`, `defineContextFragments`, `createContextCompressor`,
 * `createContextSelector`, `createContextStrategy`, the context node factories and the
 * registered policy/reduction/selection catalogs.
 */
export * from './assembly.js';
export * from './fragments.js';
export type * from '../../structs/support/context.js';
export * from './compression.js';
export type * from '../../structs/support/context-processing.js';
export * from './selection.js';

export {
  processContext,
  validateContextPolicy,
  contextPolicyCatalog,
  contextReductionCatalog,
} from './processing.js';
export * from './selection-policy.js';

export type { ContextPlan } from '../../structs/context/processing.js';
export * from './nodes.js';
export { createContextStrategy, contextHistoryStrategies } from './strategies.js';
export type {
  ContextStrategy,
  ContextStrategyOptions,
  ContextStrategySettings,
} from './strategies.js';

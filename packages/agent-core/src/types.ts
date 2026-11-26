/**
 * Type-only entry (`@jangts/agent-core/types`): every public declaration without runtime
 * values, suitable for consumers that only need compile-time shapes.
 *
 * It mirrors the root surface plus Kit-specific structures, and re-exports `./index.js` as
 * types so a single import satisfies both usage styles. Because nothing here executes, this
 * entry cannot be used to reach registries or helpers; those stay on the root entry, the
 * `Support` namespace, or individual Kit subpaths.
 */
export type * from './structs/index.js';
export type * from './structs/kits/answering/tasks.js';
export type * from './structs/kits/answering/checks.js';
export type * from './structs/kits/answering/flow.js';
export type * from './structs/kits/presentation/outputs.js';
export type * from './structs/kits/knowledge.js';
export type * from './structs/kits/search.js';
export type * from './kits/inference.js';
export type * from './kits/vector-search.js';
export type * from './kits/rank-fusion.js';
export type * from './index.js';
export type * from './kits/index.js';

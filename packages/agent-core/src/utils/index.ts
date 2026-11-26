/**
 * Generic helpers shared by every other module of `@jangts/agent-core`.
 *
 * Nothing here knows about business prompts, stages or transports: this barrel only
 * re-exports rule traversal, text comparison, model protocol errors and retrieval
 * query keys. Consumers inside the package import the concrete module directly;
 * this entry exists so cross-module reuse has one stable surface.
 */
export * from './rules.js';
export { commonPrefixLength } from './text.js';
export { modelProtocolError } from './model-protocol.js';
export { retrievalQueryKey } from './query-key.js';

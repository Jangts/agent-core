/**
 * Public surface of the model protocol layer.
 *
 * Re-exports the runner and the provider/transport contracts. Support implementations are
 * exported from the package root or `/support`; this Core barrel stays free of Support code.
 */
export * from './runner.js';
export * from '../structs/model/chat-provider.js';
export { modelRunnerDefaults } from './defaults.js';

export * from './operations.js';
export * from './realtime.js';
export type * from '../structs/model/lifecycle.js';

/**
 * Re-export barrel: exposes the Core tool registry factory to Support consumers.
 *
 * Core owns the registry implementation; Support only re-exports it so applications can bind a
 * `ToolCatalog` without importing internal paths. No behavior is added here.
 */
export { createToolRegistry } from '../capabilities/tool-runtime.js';

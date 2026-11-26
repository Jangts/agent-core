/**
 * Capability registration surface: model tools, executable tools and host-selected
 * invocations.
 *
 * These registries hold declarations only. Which tools a stage may use, whether a
 * call is authorized, and what a payload means remain App decisions; this barrel provides
 * the mechanisms that validate, seal and execute those declarations. Optional Kit helpers
 * such as interaction protocols and commands are imported from their own `/kits/*` entries.
 *
 * Exports: the model capability registry (`model`), the executable tool registry and its
 * sync/async invocation entry points (`tools`), host-selected invocation execution
 * (`invocation`) and the shared protocol registry.
 */
export * from './model.js';
export * from './tools.js';
export * from './invocation.js';
export * from '../utils/protocol-registry.js';

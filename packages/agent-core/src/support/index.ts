/**
 * Support entry point: app-side helpers that build Core-compatible configuration and handlers.
 *
 * Applications import from here and pass the results to Core. Core never imports this module;
 * the helpers follow Core contracts and do not introduce a second scheduling protocol.
 *
 * Main exports: model transports and providers, context assembly and processing policies,
 * registration and capability catalogs, tool definition helpers, schema adapters and transports.
 */
export * from './model/index.js';
export * from './context/index.js';
export * from './registration.js';
export { breakWhile, configureBreakWhile, matchRule, walkRules } from '../utils/rules.js';
export type * from '../structs/utils/rules.js';
export * from './transport/index.js';
export * from './tools.js';
export * from './schema.js';
export { streamEvents } from './stream-events.js';
export { createReplyPreview } from './model/reply-preview.js';
export type { ReplyPreviewRule, ReplyPreviewOptions } from './model/reply-preview.js';

export * from './capabilities.js';

export { retryMultipleModelCalls } from '../model/decision-retry.js';

export type { RegistrationDefinition } from '../structs/support/registration.js';

export * from './associations.js';
export { resolveReplyGuidance } from './reply-guidance.js';
export type { ReplyGuidanceSources } from './reply-guidance.js';
export { createRequestRecovery } from './recovery.js';
export type { RequestRecovery, RecoveredResult } from './recovery.js';

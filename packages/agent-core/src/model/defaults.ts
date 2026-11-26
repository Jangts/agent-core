/**
 * Baseline model runtime limits.
 *
 * These are conservative runtime defaults, not a claim about any provider's context
 * window; a host that knows its model must override them explicitly.
 *
 * Exports: `modelRunnerDefaults` and `defaultTextInteraction`.
 */
import { createPlainTextInteraction } from './transports.js';

/**
 * Frozen default limits.
 *
 * `maxCalls` bounds one request's model calls, `callTimeoutMs` stays below the
 * 32-bit timer limit, and the child limits cap fan-out per request. `stage` is the
 * fallback stage id used when a call does not name one.
 */
export const modelRunnerDefaults = Object.freeze({
  maxCalls: 8,
  callTimeoutMs: 30000,
  maxInputChars: 32000,
  maxOutputChars: 16000,
  maxSchemaChars: 16000,
  maxOutputTokens: 1024,
  stage: 'model',
  children: Object.freeze({ maxDepth: 1, maxConcurrentCalls: 1, maxChildren: 32 }),
});

/**
 * Built-in plain-text interaction.
 *
 * Core owns ordinary text execution, so no App-side adapter is required for the
 * default single-prompt call shape.
 */
export const defaultTextInteraction = createPlainTextInteraction('core:plain-text');

/** @deprecated Use defaultTextInteraction. */
export { defaultTextInteraction as defaultTextTransport };

/**
 * Snapshot helper for per-call model options.
 *
 * Options may be class instances with getters, so every field is read explicitly
 * instead of being spread; fields the caller did not supply are then removed so
 * "absent" and "explicitly undefined" stay distinguishable downstream.
 *
 * Exports: `snapshotModelOptions`.
 */
import type { ModelOptions } from '../structs/model/messages.js';

/**
 * Copy declared model options, preserving explicit overrides.
 *
 * `onUsage` is rebound to the original options object so a method keeps its receiver.
 * The deletion pass restores absent keys that the explicit reads had materialized.
 *
 * @param options - Source options; defaults to an empty object.
 * @returns A plain options object containing only the keys present on the source.
 */
export function snapshotModelOptions(options: Readonly<ModelOptions> = {}): ModelOptions {
  const snapshot: ModelOptions = {
    requireCompletion: options.requireCompletion,
    outputSchema: options.outputSchema,
    continuation: options.continuation,
    onContinuation: options.onContinuation?.bind(options),
    onContent: options.onContent?.bind(options),
    json: options.json,
    temperature: options.temperature,
    maxOutputTokens: options.maxOutputTokens,
    includeUsage: options.includeUsage,
    onUsage: options.onUsage?.bind(options),
    functions: options.functions,
    toolChoice: options.toolChoice,
    parallelToolCalls: options.parallelToolCalls,
  };
  for (const key of Object.keys(snapshot) as (keyof ModelOptions)[]) {
    if (!(key in options)) delete snapshot[key];
  }
  return snapshot;
}

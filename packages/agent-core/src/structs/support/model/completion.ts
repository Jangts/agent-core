/**
 * Completion policy contract for the compatible provider.
 *
 * Place in the package: Support-side protocol decision. A policy decides whether one finished
 * stream satisfies the request it answered. It owns no HTTP, cancellation, request building or
 * tool execution, and a session exists per request so concurrent calls never share state.
 *
 * Exports: `CompletionRequestFacts`, `CompletionFailure`, `CompletionSession`, `CompletionPolicy`.
 */
import type { ModelPart } from '../../model/messages.js';
import type { ModelProviderErrorCode } from './provider.js';

/**
 * Facts the provider reads from the request it actually sends.
 *
 * `functions` reports the Core call options and keeps the default policy equivalent to the
 * behavior that existed before policies were configurable. `toolChoice` is the effective field of
 * the serialized body, so a host override, or a field dropped for being `undefined`, is visible
 * exactly as the upstream receives it.
 */
export interface CompletionRequestFacts {
  /** Whether the call declared native functions through Core options. */
  readonly functions: boolean;
  /** Effective `tool_choice` of the request body; an absent field reads as `undefined`. */
  readonly toolChoice?: unknown;
  /** Whether an empty response is allowed because JSON mode permits it. */
  readonly allowEmptyText: boolean;
}

/** Build the classified failure a policy throws; the provider records it like its own failures. */
export type CompletionFailure = (code: ModelProviderErrorCode) => Error;

/** Per-request completion state observed by one policy. */
export interface CompletionSession {
  /** Observe one part immediately before the provider yields it. */
  part(part: ModelPart): void;
  /** Observe the stream's single `finish_reason`. */
  finish(reason: string): void;
  /** Complete the response when the end-of-stream marker arrives. */
  end(): void;
}

/** Decision whether a finished stream satisfies the request. */
export interface CompletionPolicy {
  /** Registered identifier; the catalog key must match it. */
  readonly id: string;
  /**
   * Start one request.
   *
   * Throwing here rejects the request before it is sent, which is how a policy refuses a request
   * shape it cannot judge after the fact.
   */
  begin(facts: CompletionRequestFacts, fail: CompletionFailure): CompletionSession;
}

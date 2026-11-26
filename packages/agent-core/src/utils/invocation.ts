/**
 * Invocation identity and result envelopes.
 *
 * Invocation ids are platform-neutral: they identify one call inside a run and are
 * deliberately independent of App or request identities, so callers can correlate
 * diagnostics without importing a domain concept.
 *
 * Exports: `invocationId`, `invocationResult` and `toolInvocation`.
 */
import type { InvocationMetadata, InvocationResult } from '../structs/invocation.js';

/**
 * Generate an invocation id.
 *
 * @returns A random UUID from the platform crypto implementation.
 */
export function invocationId(): string {
  return globalThis.crypto.randomUUID();
}

/**
 * Wrap a value and its metadata in a frozen result envelope.
 *
 * Both layers are frozen so downstream consumers cannot mutate an already reported
 * invocation.
 *
 * @param value - The produced value.
 * @param metadata - Invocation metadata describing the call.
 * @returns A frozen `InvocationResult`.
 */
export function invocationResult<Value, Metadata extends InvocationMetadata>(
  value: Value,
  metadata: Metadata,
): InvocationResult<Value, Metadata> {
  return Object.freeze({ value, invocation: Object.freeze(metadata) });
}

/**
 * Normalize the positional tool-invocation shorthand used by App handlers.
 *
 * The shorthand only accepts exactly one request so a handler cannot silently drop
 * additional tools; the request must carry a non-blank `toolId` and an explicit
 * `input` property, which distinguishes "no input" from "input omitted".
 *
 * @param request - Candidate request supplied as a single argument.
 * @param arity - Number of arguments the caller actually passed; must be 1.
 * @returns A plain object with the four supported request fields.
 * @throws TypeError When the arity or the request shape is invalid.
 */
export function toolInvocation(
  request: import('../structs/capabilities/tools.js').ToolInvocationRequest,
  arity: number,
) {
  if (
    arity !== 1 ||
    !request ||
    typeof request !== 'object' ||
    typeof request.toolId !== 'string' ||
    !request.toolId.trim() ||
    !('input' in request)
  ) {
    throw new TypeError('Use one tool request with toolId and input');
  }
  return {
    logger: request.logger,
    toolId: request.toolId,
    input: request.input,
    diagnostics: request.diagnostics,
    signal: request.signal,
  };
}

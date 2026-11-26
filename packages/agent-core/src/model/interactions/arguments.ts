/**
 * Shared argument decoding for interaction adapters.
 *
 * Every adapter ultimately produces the same pair — capability id and argument
 * object — so parsing, validation and wire naming live here instead of being repeated
 * per wire format.
 *
 * Exports: `object`, `parse` and `wireName`.
 */
import { modelProtocolError } from '../../utils/model-protocol.js';

/**
 * Require a plain argument object.
 *
 * @param value - Candidate value.
 * @returns The value typed as a string-keyed record.
 * @throws ValidationError When the value is not a non-array object.
 */
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    modelProtocolError('Model arguments must be an object');
  return value as Record<string, unknown>;
}

/**
 * Parse a complete JSON argument payload.
 *
 * Incomplete JSON is rejected rather than repaired, because a truncated stream must not
 * be executed as a plausible partial call.
 *
 * @param raw - Complete JSON text.
 * @returns The parsed argument object.
 * @throws ValidationError When the text is not complete JSON or not an object.
 */
export function parse(raw: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    modelProtocolError('Model arguments must be complete JSON');
  }
  return object(value);
}

/**
 * Map a business capability id onto a wire-safe function name.
 *
 * Business ids are not constrained by the wire protocol's naming alphabet or length, so
 * an already valid id is returned unchanged and any other id is sanitized and suffixed
 * with an FNV-1a hash. The hash keeps distinct ids distinct after sanitizing.
 *
 * @param id - Registered capability id.
 * @returns A name matching the protocol's expected pattern.
 */
export function wireName(id: string): string {
  if (/^[a-zA-Z0-9_-]{1,64}$/.test(id)) return id;
  let hash = 2166136261;
  for (const char of id) hash = Math.imul(hash ^ char.codePointAt(0)!, 16777619) >>> 0;
  return `cap_${id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48)}_${hash.toString(16)}`;
}

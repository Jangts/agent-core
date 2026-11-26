/**
 * Scoped continuation serialization. The host owns persistence and retention; no state is logged.
 * Only JSON values are accepted, keeping connections and other live handles out of snapshots.
 */
import type { ModelContinuation } from '../../structs/model/messages.js';

/** Identity required when importing state into another request of the same conversation. */
export interface ModelContinuationIdentity {
  readonly protocol: string;
  readonly model: string;
  readonly scope: string;
}

/** Validate a plain JSON tree without silently dropping properties or changing scalar values. */
function jsonValue(value: unknown, seen: Set<object>): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (!value || typeof value !== 'object' || seen.has(value))
    throw new TypeError('Continuation must contain only acyclic JSON values');
  const object = value as object;
  if (
    !Array.isArray(object) &&
    Object.getPrototypeOf(object) !== Object.prototype &&
    Object.getPrototypeOf(object) !== null
  )
    throw new TypeError('Continuation cannot contain resource handles');
  seen.add(object);
  for (const entry of Object.values(object)) jsonValue(entry, seen);
  seen.delete(object);
}

/** Serialize only scoped, versioned state; contents must not contain credentials. */
export function serializeModelContinuation(value: ModelContinuation, maxChars = 1_000_000): string {
  if (!Number.isSafeInteger(maxChars) || maxChars < 1)
    throw new TypeError('Invalid continuation size limit');
  const { version, protocol, model, scope, data } = value ?? {};
  if (
    version !== 1 ||
    typeof protocol !== 'string' ||
    !protocol ||
    typeof model !== 'string' ||
    !model ||
    typeof scope !== 'string' ||
    !scope
  )
    throw new TypeError('Invalid continuation envelope');
  const snapshot = structuredClone(data);
  jsonValue(snapshot, new Set());
  const serialized = JSON.stringify({ version, protocol, model, scope, data: snapshot });
  if (serialized.length > maxChars) throw new TypeError('Continuation size limit exceeded');
  return serialized;
}

/** Import a host-stored JSON envelope after checking the current identity. */
export function parseModelContinuation(
  serialized: string,
  identity: ModelContinuationIdentity,
  maxChars = 1_000_000,
): ModelContinuation {
  if (typeof serialized !== 'string' || serialized.length > maxChars)
    throw new TypeError('Invalid continuation size');
  const value: ModelContinuation = JSON.parse(serialized);
  serializeModelContinuation(value, maxChars);
  if (
    value.protocol !== identity.protocol ||
    value.model !== identity.model ||
    value.scope !== identity.scope
  )
    throw new TypeError('Continuation identity mismatch');
  return Object.freeze(value);
}

/** A fresh host-owned in-memory store, useful for a single process and isolated examples. */
export function createMemoryContinuationStore() {
  const values = new Map<string, string>();
  return Object.freeze({
    save(value: ModelContinuation): void {
      values.set(
        JSON.stringify([value.protocol, value.model, value.scope]),
        serializeModelContinuation(value),
      );
    },
    load(identity: ModelContinuationIdentity): ModelContinuation | undefined {
      const serialized = values.get(
        JSON.stringify([identity.protocol, identity.model, identity.scope]),
      );
      return serialized === undefined ? undefined : parseModelContinuation(serialized, identity);
    },
    delete(identity: ModelContinuationIdentity): boolean {
      return values.delete(JSON.stringify([identity.protocol, identity.model, identity.scope]));
    },
  });
}

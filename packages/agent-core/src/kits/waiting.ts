/**
 * Optional App-side waiting gate. The App owns identity, authorization and atomic storage;
 * this Kit checks a local record and consumes an answer without adding a scheduler.
 */
import { awaitAssertion } from '../utils/cancellation.js';
import { booleanResult } from '../utils/synchronous.js';
import type { OperationContext } from '../structs/common.js';
import type {
  WaitGate,
  WaitGateDefinition,
  WaitGateOptions,
  WaitIdentity,
  WaitRecord,
} from '../structs/kits/waiting.js';

/** Reject a local wait operation with a stable diagnostic category. */
function reject(code: string): never {
  throw Object.assign(new Error(code), { code });
}

/** Copy only explicitly identified waits; identities are never treated as grants. */
function identityOf(value: WaitIdentity): WaitIdentity {
  if (!value) throw new TypeError('Invalid wait identity');
  const { taskId, waitId, subject } = value;
  if ([taskId, waitId, subject].some((part) => typeof part !== 'string' || !part.trim()))
    throw new TypeError('Invalid wait identity');
  return { taskId, waitId, subject };
}

/** Clone and validate JSON data without silently dropping unsupported values. */
function snapshot<T>(value: T): T {
  const path = new Set<object>();
  const check = (item: unknown): void => {
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return;
    if (typeof item === 'number' && Number.isFinite(item)) return;
    if (!item || typeof item !== 'object' || path.has(item))
      throw new TypeError('Wait data must be JSON serializable');
    if (
      !Array.isArray(item) &&
      Object.getPrototypeOf(item) !== Object.prototype &&
      Object.getPrototypeOf(item) !== null
    )
      throw new TypeError('Wait data must be JSON serializable');
    path.add(item);
    const descriptors = Object.getOwnPropertyDescriptors(item);
    if (Reflect.ownKeys(item).some((key) => typeof key !== 'string'))
      throw new TypeError('Wait data must be JSON serializable');
    if (Array.isArray(item)) {
      if (Object.getPrototypeOf(item) !== Array.prototype)
        throw new TypeError('Wait data must be JSON serializable');
      if (Object.keys(descriptors).length !== item.length + 1)
        throw new TypeError('Wait data must be JSON serializable');
      for (let index = 0; index < item.length; index++) {
        const descriptor = descriptors[index];
        if (!descriptor || !('value' in descriptor) || !descriptor.enumerable)
          throw new TypeError('Wait data must be JSON serializable');
        check(descriptor.value);
      }
    } else {
      for (const descriptor of Object.values(descriptors)) {
        if (!('value' in descriptor) || !descriptor.enumerable)
          throw new TypeError('Wait data must be JSON serializable');
        check(descriptor.value);
      }
    }
    path.delete(item);
  };
  check(value);
  try {
    return structuredClone(value);
  } catch {
    throw new TypeError('Wait data must be JSON serializable');
  }
}

/** Stable JSON comparison makes retries insensitive to object-key insertion order. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  return JSON.stringify(value);
}

/**
 * Bind a gate to App ports. Reads, mutations and duplicate responses all reauthorize.
 * Saves keep the exclusive lock until settled, even if cancellation arrives mid-save.
 */
export function defineWaitGate<Answer, App>(
  definition: WaitGateDefinition<Answer, App>,
  options: WaitGateOptions<Answer>,
): WaitGate<Answer, App> {
  const { id, revision, isAnswer, authorize: authorizeMethod } = definition ?? {};
  const { store, now: nowMethod } = options ?? {};
  const { exclusive: exclusiveMethod, load: loadMethod, save: saveMethod } = store ?? {};
  if (
    typeof id !== 'string' ||
    !id.trim() ||
    typeof revision !== 'string' ||
    !revision.trim() ||
    typeof isAnswer !== 'function' ||
    typeof authorizeMethod !== 'function' ||
    typeof exclusiveMethod !== 'function' ||
    typeof loadMethod !== 'function' ||
    typeof saveMethod !== 'function' ||
    (nowMethod !== undefined && typeof nowMethod !== 'function')
  )
    throw new TypeError('Invalid wait gate');
  const validate = isAnswer.bind(definition),
    authorize = authorizeMethod.bind(definition);
  const exclusive = exclusiveMethod.bind(store),
    load = loadMethod.bind(store),
    save = saveMethod.bind(store);
  const now = nowMethod?.bind(options) ?? Date.now;
  const same = (a: WaitIdentity, b: WaitIdentity) =>
    a.taskId === b.taskId && a.waitId === b.waitId && a.subject === b.subject;
  const answerOf = (value: Answer) => {
    const answer = snapshot(value);
    if (
      !booleanResult(
        validate(snapshot(answer)),
        'Wait answer predicates must return boolean synchronously',
      )
    )
      throw new TypeError('Invalid wait answer');
    return answer;
  };
  const checked = (value: WaitRecord<Answer>): WaitRecord<Answer> => {
    if (!value || value.version !== 1 || value.definitionId !== id || value.revision !== revision)
      reject('WAIT_DEFINITION');
    const identity = identityOf(value.identity);
    if (
      !Number.isSafeInteger(value.expiresAtMs) ||
      value.expiresAtMs < 0 ||
      !['pending', 'resolved', 'cancelled'].includes(value.status)
    )
      throw new TypeError('Invalid wait record');
    const base = {
      version: 1 as const,
      definitionId: id,
      revision,
      identity,
      expiresAtMs: value.expiresAtMs,
    };
    if (value.status === 'resolved') {
      if (
        !value.submission ||
        typeof value.submission.id !== 'string' ||
        !value.submission.id.trim()
      )
        throw new TypeError('Invalid wait submission');
      return {
        ...base,
        status: 'resolved',
        submission: { id: value.submission.id, answer: answerOf(value.submission.answer) },
      };
    }
    if (value.submission !== undefined) throw new TypeError('Invalid wait submission');
    return { ...base, status: value.status };
  };
  const locked = async (
    identity: WaitIdentity,
    operation: 'open' | 'read' | 'respond' | 'cancel',
    context: OperationContext<App>,
    action: (
      record: WaitRecord<Answer> | undefined,
      persist: (record: WaitRecord<Answer>) => Promise<WaitRecord<Answer>>,
    ) => Promise<WaitRecord<Answer>>,
  ) => {
    const expected = identityOf(identity);
    if (!context?.signal || !('app' in context))
      throw new TypeError('Wait gates require OperationContext');
    const { signal } = context;
    signal.throwIfAborted();
    const key = JSON.stringify([id, expected.taskId]);
    return exclusive(key, async () => {
      signal.throwIfAborted();
      await awaitAssertion(
        () => authorize(identityOf(expected), { ...context, operation }),
        signal,
        'Wait authorization must return void',
      );
      const loaded = await load(key);
      signal.throwIfAborted();
      const record = loaded === undefined ? undefined : checked(loaded);
      const persist = async (next: WaitRecord<Answer>) => {
        signal.throwIfAborted();
        await save(key, snapshot(next));
        signal.throwIfAborted();
        return snapshot(next);
      };
      if (operation !== 'open' && (!record || !same(record.identity, expected)))
        reject(record ? 'WAIT_IDENTITY' : 'WAIT_MISSING');
      return action(record, persist);
    });
  };
  return Object.freeze({
    async open(request, context) {
      const identity = identityOf(request?.identity);
      const { expiresAtMs, previousWaitId } = request;
      if (
        !Number.isSafeInteger(expiresAtMs) ||
        expiresAtMs < 0 ||
        (previousWaitId !== undefined &&
          (typeof previousWaitId !== 'string' || !previousWaitId.trim()))
      )
        throw new TypeError('Invalid wait opening');
      return locked(identity, 'open', context, async (record, persist) => {
        if (record && same(record.identity, identity)) {
          if (record.expiresAtMs !== expiresAtMs) reject('WAIT_CONFLICT');
          return snapshot(record);
        }
        if (
          record
            ? record.status === 'pending' ||
              record.identity.subject !== identity.subject ||
              record.identity.waitId !== previousWaitId
            : previousWaitId !== undefined
        )
          reject('WAIT_CONFLICT');
        if (expiresAtMs <= now()) reject('WAIT_EXPIRED');
        return persist({
          version: 1,
          definitionId: id,
          revision,
          identity,
          expiresAtMs,
          status: 'pending',
        });
      });
    },
    async read(identity, context) {
      return locked(identity, 'read', context, async (record) => snapshot(record!));
    },
    async respond(request, context) {
      const identity = identityOf(request?.identity);
      const { submissionId } = request;
      if (typeof submissionId !== 'string' || !submissionId.trim())
        throw new TypeError('Invalid wait submission');
      const answer = snapshot(request.answer);
      return locked(identity, 'respond', context, async (record, persist) => {
        const current = record!;
        if (current.status === 'cancelled') reject('WAIT_CANCELLED');
        if (current.status === 'resolved') {
          if (
            current.submission.id !== submissionId ||
            canonical(current.submission.answer) !== canonical(answer)
          )
            reject('WAIT_CONFLICT');
          return snapshot(current);
        }
        if (current.expiresAtMs <= now()) reject('WAIT_EXPIRED');
        return persist({
          ...current,
          status: 'resolved',
          submission: { id: submissionId, answer: answerOf(answer) },
        });
      });
    },
    async cancel(identity, context) {
      return locked(identity, 'cancel', context, async (record, persist) => {
        if (record!.status === 'resolved') reject('WAIT_CONFLICT');
        return record!.status === 'cancelled'
          ? snapshot(record!)
          : persist({ ...record!, status: 'cancelled' });
      });
    },
  } satisfies WaitGate<Answer, App>);
}

export type * from '../structs/kits/waiting.js';

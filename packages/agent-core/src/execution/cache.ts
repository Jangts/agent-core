/**
 * Engine memory and borrowed service storage views. Partition ownership is captured per visit,
 * never in a mutable service field. Cache calls do not create model budgets or execute tools.
 */
import type {
  AgentCacheOptions,
  AgentCachePort,
  CacheContext,
  CacheReadOptions,
  EngineCacheOptions,
  NodeCache,
} from '../structs/execution/cache.js';
import { awaitWithSignal } from '../utils/cancellation.js';

/** Validate the small cache-specific boundary; business permissions remain App-owned. */
function textKey(value: string): string {
  if (typeof value !== 'string' || !value.length)
    throw new TypeError('Cache keys must be nonempty strings');
  return value;
}

/** Reject accidental cross-partition writes and unknown options instead of ignoring them. */
function optionsOf(value: object | undefined, allowed: readonly string[]): void {
  if (
    value !== undefined &&
    (!value ||
      typeof value !== 'object' ||
      Reflect.ownKeys(value).some((key) => typeof key !== 'string' || !allowed.includes(key)))
  )
    throw new TypeError('Invalid cache options');
}

/** Bounded LRU for one Engine; forks get new memory, and values are deliberately not cloned. */
export class EngineCache {
  private readonly entries = new Map<string, { value: unknown; expires: number }>();
  private readonly limit: number;
  private readonly ttl: number;

  constructor(options: EngineCacheOptions = {}) {
    this.limit = options.maxEntries ?? 1024;
    this.ttl = options.ttlMs ?? Infinity;
    if (
      !Number.isSafeInteger(this.limit) ||
      this.limit < 1 ||
      (this.ttl !== Infinity && (!Number.isSafeInteger(this.ttl) || this.ttl < 1))
    )
      throw new TypeError('Invalid Engine cache bounds');
  }

  /** Remove expired entries lazily, without timers or background tasks. */
  private prune(): void {
    const now = Date.now();
    for (const [key, item] of this.entries) if (item.expires <= now) this.entries.delete(key);
  }

  /** Capture an immutable partition and visit signal; no per-run cache is introduced. */
  view(nodeId: string, signal: AbortSignal): NodeCache {
    textKey(nodeId);
    const prefix = JSON.stringify([nodeId]).slice(0, -1) + ',';
    const address = (key: string, node = nodeId) => JSON.stringify([textKey(node), textKey(key)]);
    const read = (key: string, node = nodeId) => {
      signal.throwIfAborted();
      const id = address(key, node);
      const item = this.entries.get(id);
      if (item && item.expires <= Date.now()) {
        this.entries.delete(id);
        return undefined;
      }
      if (item) {
        this.entries.delete(id);
        this.entries.set(id, item);
      }
      return item;
    };
    return Object.freeze({
      get: (key: string, options?: CacheReadOptions) => {
        optionsOf(options, ['nodeId']);
        return read(key, options?.nodeId)?.value;
      },
      has: (key: string) => read(key) !== undefined,
      set: (key: string, value: unknown) => {
        signal.throwIfAborted();
        const id = address(key);
        this.prune();
        this.entries.delete(id);
        this.entries.set(id, { value, expires: Date.now() + this.ttl });
        if (this.entries.size > this.limit) this.entries.delete(this.entries.keys().next().value!);
      },
      delete: (key: string) => {
        signal.throwIfAborted();
        return this.entries.delete(address(key));
      },
      clear: () => {
        signal.throwIfAborted();
        for (const key of this.entries.keys()) if (key.startsWith(prefix)) this.entries.delete(key);
      },
    });
  }
}

/** Snapshot port callbacks with their receiver, rejecting incomplete App storage early. */
export function cachePort(port?: AgentCachePort): AgentCachePort | undefined {
  if (port === undefined) return undefined;
  const handlers = ['get', 'has', 'set', 'delete', 'clear'] as const;
  if (
    !port ||
    handlers.some((key) => typeof port[key] !== 'function') ||
    (port.supportsPersistence !== undefined && typeof port.supportsPersistence !== 'boolean')
  )
    throw new TypeError('Invalid Agent cache port');
  return Object.freeze({
    supportsPersistence: port.supportsPersistence === true,
    get: port.get.bind(port),
    has: port.has.bind(port),
    set: port.set.bind(port),
    delete: port.delete.bind(port),
    clear: port.clear.bind(port),
  });
}

/** Build visit-local views. Persistent writes remain external side effects owned by the App. */
export function cacheContext(
  memory: EngineCache,
  port: AgentCachePort | undefined,
  nodeId: string,
  signal: AbortSignal,
): CacheContext {
  const partition = (options?: AgentCacheOptions & CacheReadOptions, crossRead = false) => {
    signal.throwIfAborted();
    optionsOf(options, crossRead ? ['nodeId', 'persistence'] : ['persistence']);
    const persistence = options?.persistence ?? false;
    if (typeof persistence !== 'boolean') throw new TypeError('Invalid cache persistence');
    if (persistence && !port?.supportsPersistence)
      throw new TypeError('Agent cache persistence is unsupported');
    return Object.freeze({
      nodeId: textKey(crossRead ? (options?.nodeId ?? nodeId) : nodeId),
      persistence,
      signal,
    });
  };
  const address = (
    key: string,
    options?: AgentCacheOptions & CacheReadOptions,
    crossRead = false,
  ) => Object.freeze({ ...partition(options, crossRead), key: textKey(key) });
  const call = async <T>(invoke: () => Promise<T>): Promise<T> => {
    signal.throwIfAborted();
    const value = await awaitWithSignal(invoke(), signal);
    signal.throwIfAborted();
    return value;
  };
  return {
    cache: memory.view(nodeId, signal),
    ...(port
      ? {
          agentCache: Object.freeze({
            get: (key: string, options?: AgentCacheOptions & CacheReadOptions) =>
              call(() => port.get(address(key, options, true))),
            has: (key: string, options?: AgentCacheOptions) =>
              call(async () => {
                const result = await port.has(address(key, options));
                if (typeof result !== 'boolean')
                  throw new TypeError('Agent cache has must return boolean');
                return result;
              }),
            set: (key: string, value: unknown, options?: AgentCacheOptions) =>
              call(async () => {
                const result = await port.set(address(key, options), value);
                if (result !== undefined) throw new TypeError('Agent cache set must return void');
              }),
            delete: (key: string, options?: AgentCacheOptions) =>
              call(async () => {
                const result = await port.delete(address(key, options));
                if (typeof result !== 'boolean')
                  throw new TypeError('Agent cache delete must return boolean');
                return result;
              }),
            clear: (options?: AgentCacheOptions) =>
              call(async () => {
                const result = await port.clear(partition(options));
                if (result !== undefined) throw new TypeError('Agent cache clear must return void');
              }),
          }),
        }
      : {}),
  };
}

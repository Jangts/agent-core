/**
 * Node-partitioned cache contracts. Engine memory is synchronous; service-owned storage is
 * asynchronous and explicitly selects volatile or persistent space. Neither is workflow state.
 */

/** Optional Engine memory bounds; TTL is measured from the latest write. */
export interface EngineCacheOptions {
  readonly maxEntries?: number;
  readonly ttlMs?: number;
}
/** Only reads may name another node. Partition names are not authorization boundaries. */
export interface CacheReadOptions {
  readonly nodeId?: string;
}
/** Synchronous view of the current node's Engine-owned memory. Values retain identity. */
export interface NodeCache {
  get(key: string, options?: CacheReadOptions): unknown;
  has(key: string): boolean;
  set(key: string, value: unknown): void;
  delete(key: string): boolean;
  clear(): void;
}
/** Persistent and volatile storage are independent; there is no implicit fallback or mirroring. */
export interface AgentCacheOptions {
  readonly persistence?: boolean;
}
/** Exact immutable address passed to the App port, including cancellation for this visit. */
export interface AgentCacheAddress {
  readonly nodeId: string;
  readonly key: string;
  readonly persistence: boolean;
  readonly signal: AbortSignal;
}
/** App-owned storage. Capacity, expiry, serialization and user isolation belong to the App. */
export interface AgentCachePort {
  readonly supportsPersistence?: boolean;
  get(address: AgentCacheAddress): Promise<unknown>;
  has(address: AgentCacheAddress): Promise<boolean>;
  set(address: AgentCacheAddress, value: unknown): Promise<void>;
  delete(address: AgentCacheAddress): Promise<boolean>;
  clear(partition: Omit<AgentCacheAddress, 'key'>): Promise<void>;
}
/** Async node view. Writes and clear can only address the current partition. */
export interface NodeAgentCache {
  get(key: string, options?: AgentCacheOptions & CacheReadOptions): Promise<unknown>;
  has(key: string, options?: AgentCacheOptions): Promise<boolean>;
  set(key: string, value: unknown, options?: AgentCacheOptions): Promise<void>;
  delete(key: string, options?: AgentCacheOptions): Promise<boolean>;
  clear(options?: AgentCacheOptions): Promise<void>;
}
/** Cache access shared by workflow visits and the low-level $step loop. */
export interface CacheContext {
  readonly cache: NodeCache;
  readonly agentCache?: NodeAgentCache;
}

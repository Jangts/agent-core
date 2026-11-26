/** Optional asynchronous and realtime provider contracts. Storage and authorization are host ports. */
export interface ModelLifecycleContext {
  readonly signal: AbortSignal;
  readonly lifetimeSignal?: AbortSignal;
  readonly markDispatched?: () => void;
}
export type ModelOperationAction = 'submit' | 'query' | 'read' | 'cancel';
export type ModelOperationStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'unknown'
  | 'incomplete'
  | 'refused';
/** Serializable remote operation identity; never contains credentials. */
export interface ModelOperationHandle {
  readonly operationId: string;
  readonly scope: string;
  readonly protocol: string;
  readonly remoteId?: string;
  readonly endpoint?: string;
  readonly model?: string;
  readonly itemIds: readonly string[];
}
export interface ModelOperationRequest {
  readonly action: ModelOperationAction;
  readonly handle: ModelOperationHandle;
  readonly cleanup?: boolean;
  readonly payload?: Readonly<Record<string, unknown>>;
}
export interface ModelOperationResult {
  readonly handle: ModelOperationHandle;
  readonly status: ModelOperationStatus;
  readonly value?: unknown;
  readonly usage?: unknown;
  readonly continuation?: import('./messages.js').ModelContinuation;
}
export interface ModelOperationProvider {
  invoke(
    request: ModelOperationRequest,
    context: ModelLifecycleContext,
  ): Promise<ModelOperationResult>;
}
/** Each callback must enter the existing Runner's budget and cancellation boundary. */
export type ModelLifecycleRun = <T>(
  work: (signal: AbortSignal) => Promise<T>,
  options?: {
    signal?: AbortSignal;
    calls?: number;
    cleanup?: boolean;
    action?:
      | 'submit'
      | 'query'
      | 'read'
      | 'cancel'
      | 'connect'
      | 'send'
      | 'close'
      | 'interrupt'
      | 'generate'
      | 'resource'
      | 'authorize';
    operationId?: string;
  },
) => Promise<T>;
export interface ModelOperationPorts {
  readonly run: ModelLifecycleRun;
  authorize(
    action: ModelOperationAction,
    handle: ModelOperationHandle,
    signal?: AbortSignal,
  ): void | Promise<void>;
  /** Atomic, exclusive transition; a stored submit prevents blind resubmission after restart. */
  reserve(handle: ModelOperationHandle): Promise<boolean>;
  save(result: ModelOperationResult): Promise<void>;
}
/** Duplex frame interaction. The host owns credentials, media capture and WebRTC negotiation. */
export interface ModelDuplex {
  send(frame: Readonly<Record<string, unknown>>, signal: AbortSignal): Promise<void>;
  readonly frames: AsyncIterable<Readonly<Record<string, unknown>>>;
  close(): void | Promise<void>;
}
export interface ModelRealtimeProvider {
  connect(context: ModelLifecycleContext): Promise<ModelDuplex>;
}
/** Provider-neutral events emitted by the portable realtime session. */
export type ModelRealtimeEvent =
  | { readonly generation: number; readonly type: 'text'; readonly text: string }
  | { readonly generation: number; readonly type: 'audio'; readonly data: string }
  | {
      readonly generation: number;
      readonly type: 'media';
      readonly data: string;
      readonly mimeType?: string;
    }
  | {
      readonly generation: number;
      readonly type: 'tool';
      readonly id: string;
      readonly name: string;
      readonly arguments: string;
    }
  | {
      readonly generation: number;
      readonly type: 'tool-wait' | 'completed';
      readonly usage?: unknown;
    };

/** @deprecated Use `ModelLifecycleContext`. Retained for the 0.9 migration. */
export type { ModelLifecycleContext as LifecycleContext };
/** @deprecated Use `ModelLifecycleRun`. Retained for the 0.9 migration. */
export type { ModelLifecycleRun as LifecycleRun };
/** @deprecated Use `ModelOperationAction`. Retained for the 0.9 migration. */
export type { ModelOperationAction as OperationAction };
/** @deprecated Use `ModelOperationStatus`. Retained for the 0.9 migration. */
export type { ModelOperationStatus as OperationStatus };

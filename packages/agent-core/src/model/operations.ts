/** Bounded operation actions sharing the Runner admission boundary; no hidden polling worker. */
import type {
  ModelOperationProvider,
  ModelOperationRequest,
  ModelOperationResult,
  ModelOperationPorts,
} from '../structs/model/lifecycle.js';
/** Execute one action. Unknown submission is persisted and never automatically resubmitted. */
export async function runModelOperation(
  provider: ModelOperationProvider,
  request: ModelOperationRequest,
  ports: ModelOperationPorts,
  signal?: AbortSignal,
): Promise<ModelOperationResult> {
  const snapshot = structuredClone(request);
  const { handle, action } = snapshot;
  if (
    !handle.operationId ||
    !handle.scope ||
    !handle.protocol ||
    !handle.itemIds.length ||
    new Set(handle.itemIds).size !== handle.itemIds.length
  )
    throw new TypeError('Invalid operation identity');
  await ports.run(
    async (activeSignal) => {
      await ports.authorize(action, handle, activeSignal);
    },
    {
      signal,
      calls: 0,
      action: 'authorize',
      operationId: handle.operationId,
      cleanup: action === 'cancel' || (request.cleanup === true && action !== 'submit'),
    },
  );

  if (action !== 'submit' && !handle.remoteId) return { handle, status: 'unknown' };
  return ports.run(
    async (activeSignal) => {
      let dispatched = false;
      let result: ModelOperationResult;
      if (action === 'submit' && !(await ports.reserve(handle)))
        throw new Error('Operation already submitted; query or reconcile before retrying');
      try {
        activeSignal.throwIfAborted();
        result = await provider.invoke(snapshot, {
          signal: activeSignal,
          markDispatched: () => {
            dispatched = true;
          },
        });
        if (
          result.handle.operationId !== handle.operationId ||
          result.handle.scope !== handle.scope ||
          result.handle.protocol !== handle.protocol ||
          result.handle.endpoint !== handle.endpoint ||
          result.handle.model !== handle.model ||
          JSON.stringify(result.handle.itemIds) !== JSON.stringify(handle.itemIds) ||
          (action !== 'submit' && result.handle.remoteId !== handle.remoteId)
        )
          throw new Error('Operation identity changed');
      } catch (error) {
        if (action === 'submit') {
          try {
            await ports.save({ handle, status: dispatched ? 'unknown' : 'failed' });
          } catch (saveError) {
            throw new AggregateError(
              [error, saveError],
              'Model operation and status persistence failed',
            );
          }
        }
        throw error;
      }
      // An acknowledgement failure can occur after the save committed. Keep the
      // confirmed result available for reconciliation and never overwrite it with unknown.
      try {
        await ports.save(result);
      } catch (cause) {
        throw Object.assign(
          new Error('Model operation result persistence unconfirmed', { cause }),
          {
            code: 'MODEL_OPERATION_SAVE_UNCONFIRMED',
            result,
          },
        );
      }
      return result;
    },
    {
      signal,
      action,
      operationId: handle.operationId,
      calls: action === 'submit' ? handle.itemIds.length : 0,
      cleanup: action === 'cancel' || (request.cleanup === true && action !== 'submit'),
    },
  );
}
/** Explicit bounded wait; no timer survives completion, cancellation or timeout. */
export async function waitModelOperation(
  provider: ModelOperationProvider,
  request: Omit<ModelOperationRequest, 'action'>,
  ports: ModelOperationPorts,
  options: { signal?: AbortSignal; maxQueries: number; intervalMs: number },
): Promise<ModelOperationResult> {
  if (
    !Number.isSafeInteger(options.maxQueries) ||
    options.maxQueries < 1 ||
    !Number.isFinite(options.intervalMs) ||
    options.intervalMs < 0
  )
    throw new TypeError('Invalid wait bounds');
  for (let i = 0; i < options.maxQueries; i++) {
    options.signal?.throwIfAborted();
    const result = await runModelOperation(
      provider,
      { ...request, action: 'query' },
      ports,
      options.signal,
    );
    if (!['queued', 'running'].includes(result.status)) return result;
    if (i + 1 < options.maxQueries)
      await new Promise<void>((resolve, reject) => {
        const done = () => {
          options.signal?.removeEventListener('abort', abort);
          resolve();
        };
        const timer = setTimeout(done, options.intervalMs);
        const abort = () => {
          clearTimeout(timer);
          options.signal?.removeEventListener('abort', abort);
          reject(options.signal?.reason);
        };
        options.signal?.addEventListener('abort', abort, { once: true });
        if (options.signal?.aborted) abort();
      });
  }
  throw new Error('Operation query limit reached');
}

/** HTTP asynchronous adapters. One invocation is one bounded protocol action, without retries. */
import type {
  ModelOperationProvider,
  ModelOperationResult,
  ModelOperationStatus,
} from '../../../structs/model/lifecycle.js';
import {
  cancelModelResponse,
  readModelJson,
  readModelJsonLines,
  resolveModelResponseLimits,
} from '../http-response.js';
export interface OperationHttpConfig {
  readonly protocol:
    'responses' | 'interactions' | 'openai-batch' | 'anthropic-batch' | 'gemini-batch';
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly model?: string;
  /** Explicit supplier profile, validated by the shared portable request preparation. */
  readonly requestBody?: Readonly<Record<string, unknown>>;
  readonly request?: typeof fetch;
  /** Maximum bytes per HTTP response, default 16 MiB. */
  readonly maxResponseBytes?: number;
  /** Maximum bytes per JSONL line, default 1 MiB or the smaller response limit. */
  readonly maxJsonlLineBytes?: number;
}
const routes = {
  responses: { root: '/responses', header: 'Authorization', prefix: 'Bearer ' },
  interactions: { root: '/interactions', header: 'x-goog-api-key', prefix: '' },
  'openai-batch': { root: '/batches', header: 'Authorization', prefix: 'Bearer ' },
  'anthropic-batch': { root: '/messages/batches', header: 'x-api-key', prefix: '' },
  'gemini-batch': { root: '/batches', header: 'x-goog-api-key', prefix: '' },
} as const;
const statuses: Record<string, ModelOperationStatus> = {
  queued: 'queued',
  pending: 'queued',
  validating: 'queued',
  in_progress: 'running',
  processing: 'running',
  running: 'running',
  JOB_STATE_RUNNING: 'running',
  completed: 'completed',
  incomplete: 'incomplete',
  refused: 'refused',
  succeeded: 'completed',
  JOB_STATE_SUCCEEDED: 'completed',
  ended: 'completed',
  failed: 'failed',
  expired: 'failed',
  JOB_STATE_FAILED: 'failed',
  cancelled: 'cancelled',
  canceled: 'cancelled',
  JOB_STATE_CANCELLED: 'cancelled',
  cancelling: 'running',
  finalizing: 'running',
};
/** Construct an adapter; endpoint/model payload stays explicit and is not inferred from brand names. */
export function createOperationHttpProvider(config: OperationHttpConfig): ModelOperationProvider {
  const { protocol, baseUrl, apiKey } = config,
    request = config.request ?? fetch,
    route = Object.hasOwn(routes, protocol) ? routes[protocol] : undefined;
  const limits = resolveModelResponseLimits(config.maxResponseBytes, config.maxJsonlLineBytes);
  if (!route || !baseUrl || !apiKey) throw new TypeError('Operation endpoint is not configured');
  return {
    async invoke(input, context) {
      if (
        input.handle.endpoint !== undefined &&
        input.handle.endpoint.replace(/\/+$/, '') !== baseUrl.replace(/\/+$/, '')
      )
        throw new TypeError('Operation endpoint mismatch');
      if (
        input.handle.model !== undefined &&
        config.model !== undefined &&
        input.handle.model !== config.model
      )
        throw new TypeError('Operation model mismatch');
      if (input.handle.protocol !== protocol) throw new TypeError('Operation protocol mismatch');
      const submitting = input.action === 'submit';
      const id = input.handle.remoteId;
      if (!submitting && !id) throw new TypeError('Remote operation ID required');
      const tail = submitting ? '' : `/${id!.split('/').map(encodeURIComponent).join('/')}`;
      const suffix =
        input.action === 'cancel'
          ? protocol === 'gemini-batch'
            ? ':cancel'
            : '/cancel'
          : input.action === 'read' && protocol === 'anthropic-batch'
            ? '/results'
            : '';
      const payload = submitting
        ? {
            ...input.payload,
            ...(protocol === 'responses' || protocol === 'interactions'
              ? { background: true }
              : {}),
          }
        : undefined;
      const path =
        protocol === 'gemini-batch'
          ? submitting
            ? `/models/${encodeURIComponent(config.model ?? '')}:batchGenerateContent`
            : `/${id!.split('/').map(encodeURIComponent).join('/')}${suffix}`
          : route.root + tail + suffix;
      if (protocol === 'gemini-batch' && submitting && !config.model)
        throw new TypeError('Batch model required');
      context.signal.throwIfAborted();
      if (submitting) context.markDispatched?.();
      const response = await request(baseUrl.replace(/\/+$/, '') + path, {
        method: submitting || input.action === 'cancel' ? 'POST' : 'GET',
        headers: {
          'Content-Type': 'application/json',
          [route.header]: route.prefix + apiKey,
          ...(protocol === 'anthropic-batch' ? { 'anthropic-version': '2023-06-01' } : {}),
        },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
        signal: context.signal,
      });
      if (!response.ok) {
        cancelModelResponse(response);
        throw Object.assign(new Error('Remote operation request failed'), {
          status: response.status,
        });
      }
      const body: Record<string, unknown> =
        input.action === 'read' && protocol === 'anthropic-batch'
          ? {
              results: await readModelJsonLines(
                response,
                limits,
                input.handle.itemIds.length,
                context.signal,
              ),
              status: 'completed',
            }
          : await readModelJson(response, limits.maxResponseBytes, context.signal);
      const remote =
        typeof body.id === 'string' ? body.id : typeof body.name === 'string' ? body.name : id;
      const state =
        typeof body.status === 'string'
          ? body.status
          : typeof body.processing_status === 'string'
            ? body.processing_status
            : typeof (body.metadata as Record<string, unknown> | undefined)?.state === 'string'
              ? String((body.metadata as Record<string, unknown>).state)
              : 'unknown';
      const result: ModelOperationResult = {
        handle: { ...input.handle, ...(remote ? { remoteId: remote } : {}) },
        status: Object.hasOwn(statuses, state) ? statuses[state] : 'unknown',
        value: body,
        ...(body.usage ? { usage: body.usage } : {}),
      };
      return result;
    },
  };
}

/** Portable batch compilation and per-item result correlation over official batch HTTP actions. */
import type { ModelMessage, ModelOptions } from '../../../structs/model/messages.js';
import type {
  ModelOperationProvider,
  ModelLifecycleContext,
} from '../../../structs/model/lifecycle.js';
import { ProtocolDecoder } from '../protocols/responses.js';
import type { ModelProtocol } from '../protocols/requests.js';
import { prepareModelRequest } from '../protocols/preparation.js';
import {
  cancelModelResponse,
  readModelJson,
  readModelJsonLines,
  resolveModelResponseLimits,
} from '../http-response.js';
import { createOperationHttpProvider, type OperationHttpConfig } from './http.js';
export interface ModelBatchItem {
  readonly id: string;
  readonly messages: readonly ModelMessage[];
  readonly options?: Readonly<ModelOptions>;
}
export interface ModelBatchItemResult {
  readonly id: string;
  readonly status: 'completed' | 'failed';
  readonly value?: unknown;
  readonly error?: unknown;
  readonly usage?: unknown;
}
/** Compile portable items, upload OpenAI JSONL if necessary, and normalize completed item identities. */
export function createBatchModelProvider(
  configuration: OperationHttpConfig & {
    readonly model: string;
    readonly completionProtocol?: 'responses' | 'chat-completions';
  },
): ModelOperationProvider {
  const config = { ...configuration };
  const limits = resolveModelResponseLimits(config.maxResponseBytes, config.maxJsonlLineBytes);
  const raw = createOperationHttpProvider(config),
    request = config.request ?? fetch;
  const protocol: ModelProtocol =
    config.protocol === 'anthropic-batch'
      ? 'messages'
      : config.protocol === 'gemini-batch'
        ? 'generate-content'
        : (config.completionProtocol ?? 'responses');
  if (!['openai-batch', 'anthropic-batch', 'gemini-batch'].includes(config.protocol))
    throw new TypeError('Batch protocol required');
  const headers = { Authorization: `Bearer ${config.apiKey}` };
  const content = async (id: string, maxItems: number, context: ModelLifecycleContext) => {
    const response = await request(
      config.baseUrl.replace(/\/+$/, '') + `/files/${encodeURIComponent(id)}/content`,
      { headers, signal: context.signal },
    );
    if (!response.ok) {
      cancelModelResponse(response);
      throw Error('Batch output download failed');
    }
    return readModelJsonLines(response, limits, maxItems, context.signal);
  };
  return {
    async invoke(input, context) {
      let prepared = input;
      if (input.action === 'submit') {
        const items = input.payload?.items as readonly ModelBatchItem[] | undefined;
        if (
          !Array.isArray(items) ||
          items.length !== input.handle.itemIds.length ||
          items.some((item, i) => item.id !== input.handle.itemIds[i])
        )
          throw new TypeError('Batch items must match reserved IDs');
        const bodies = items.map((item) =>
          prepareModelRequest(
            {
              protocol,
              model: config.model,
              requestBody: config.requestBody,
              baseUrl: config.baseUrl,
              scope: input.handle.scope,
              stream: false,
            },
            item.messages,
            item.options ?? {},
          ),
        );
        let payload: Record<string, unknown>;
        if (config.protocol === 'anthropic-batch')
          payload = {
            requests: items.map((item, i) => ({ custom_id: item.id, params: bodies[i] })),
          };
        else if (config.protocol === 'gemini-batch')
          payload = {
            batch: {
              input_config: {
                requests: {
                  requests: items.map((item, i) => ({
                    request: bodies[i],
                    metadata: { key: item.id },
                  })),
                },
              },
            },
          };
        else {
          const endpoint = protocol === 'responses' ? '/v1/responses' : '/v1/chat/completions';
          const jsonl = items
            .map((item, i) =>
              JSON.stringify({
                custom_id: item.id,
                method: 'POST',
                url: endpoint,
                body: bodies[i],
              }),
            )
            .join('\n');
          const form = new FormData();
          form.set('purpose', 'batch');
          form.set('file', new Blob([jsonl], { type: 'application/jsonl' }), 'batch.jsonl');
          const response = await request(config.baseUrl.replace(/\/+$/, '') + '/files', {
            method: 'POST',
            headers,
            body: form,
            signal: context.signal,
          });
          if (!response.ok) {
            cancelModelResponse(response);
            throw Error('Batch input upload failed');
          }
          const file = await readModelJson(response, limits.maxResponseBytes, context.signal);
          if (typeof file.id !== 'string' || !file.id) throw Error('Batch input ID missing');
          payload = { input_file_id: file.id, endpoint, completion_window: '24h' };
        }
        prepared = { ...input, payload };
      }
      const result = await raw.invoke(prepared, context);
      if (input.action !== 'read' || result.status !== 'completed') return result;
      const body = result.value as Record<string, any>;
      const expectedIds = new Set(input.handle.itemIds);
      let rows: any[] = [];
      if (config.protocol === 'openai-batch') {
        for (const id of [body.output_file_id, body.error_file_id]) {
          if (typeof id !== 'string') continue;
          for (const row of await content(id, expectedIds.size - rows.length, context))
            rows.push(row);
        }
      } else if (config.protocol === 'anthropic-batch') rows = body.results;
      else {
        const file = body.response?.responsesFile;
        if (typeof file === 'string') {
          if (!/^files\/[A-Za-z0-9_-]+$/.test(file)) throw Error('Invalid batch output file name');
          const base = new URL(config.baseUrl);
          const path =
            '/download' + base.pathname.replace(/\/$/, '') + '/' + file + ':download?alt=media';
          const response = await request(base.origin + path, {
            headers: { 'x-goog-api-key': config.apiKey },
            signal: context.signal,
          });
          if (!response.ok) {
            cancelModelResponse(response);
            throw Error('Batch output download failed');
          }
          rows = await readModelJsonLines(response, limits, expectedIds.size, context.signal);
        } else
          rows =
            body.response?.inlinedResponses?.inlinedResponses ??
            body.response?.inlinedResponses ??
            body.response?.inlined_responses ??
            [];
      }
      if (!Array.isArray(rows)) throw Error('Invalid batch response items');
      if (rows.length > expectedIds.size)
        throw Object.assign(Error('Batch response item limit exceeded'), {
          code: 'MODEL_RESPONSE_LIMIT',
        });
      const seen = new Set<string>();
      const results: ModelBatchItemResult[] = rows.map((row: any) => {
        const id = row.custom_id ?? row.key ?? row.metadata?.key;
        if (typeof id !== 'string' || !expectedIds.has(id) || seen.has(id))
          throw Error('Invalid batch result identity');
        seen.add(id);
        const error =
          row.error ??
          (row.result?.type !== 'succeeded' ? row.result?.error : undefined) ??
          (row.response?.status_code >= 400 ? row.response : undefined);
        const value = row.result?.message ?? row.response?.body ?? row.response ?? row;
        const usage = value?.usage ? { usage: value.usage } : {};
        if (error) return { id, status: 'failed', error, ...usage };
        let events;
        try {
          events = new ProtocolDecoder(protocol).decode(value, true);
        } catch {
          return { id, status: 'failed', error: { code: 'BATCH_ITEM_PROTOCOL' }, ...usage };
        }
        const terminal = events.find(
          (event) => typeof event !== 'string' && event.type === 'completion',
        );
        if (!terminal)
          return { id, status: 'failed', error: { code: 'BATCH_ITEM_TERMINAL_MISSING' }, ...usage };
        if (!['completed', 'tool-calls'].includes(terminal.status))
          return {
            id,
            status: 'failed',
            error: { code: 'BATCH_ITEM_' + terminal.status.toUpperCase() },
            ...usage,
          };
        return { id, status: 'completed', value: events, ...usage };
      });
      for (const id of input.handle.itemIds)
        if (!seen.has(id))
          results.push({ id, status: 'failed', error: { code: 'BATCH_ITEM_MISSING' } });
      return { ...result, value: results };
    },
  };
}

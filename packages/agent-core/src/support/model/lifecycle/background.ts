/** Portable background conversation requests and terminal results; protocol payloads stay internal. */
import type { ModelMessage, ModelOptions } from '../../../structs/model/messages.js';
import type { ModelOperationProvider } from '../../../structs/model/lifecycle.js';
import { prepareModelRequest } from '../protocols/preparation.js';
import { assertProtocolCompletion, ProtocolDecoder } from '../protocols/responses.js';
import { createOperationHttpProvider, type OperationHttpConfig } from './http.js';
export interface BackgroundModelInput {
  readonly messages: readonly ModelMessage[];
  readonly options?: Readonly<ModelOptions>;
}
/** Same input and normalized output for Responses and Interactions; pending is never completed. */
export function createBackgroundModelProvider(
  config: OperationHttpConfig & {
    readonly protocol: 'responses' | 'interactions';
    readonly model: string;
  },
): ModelOperationProvider {
  const raw = createOperationHttpProvider(config);
  return {
    async invoke(input, context) {
      let request = input;
      if (input.action === 'submit') {
        const payload = input.payload as unknown as BackgroundModelInput | undefined;
        if (!payload || !Array.isArray(payload.messages))
          throw new TypeError('Background messages required');
        request = {
          ...input,
          payload: prepareModelRequest(
            {
              protocol: config.protocol,
              model: config.model,
              requestBody: config.requestBody,
              baseUrl: config.baseUrl,
              scope: input.handle.scope,
              stream: false,
            },
            payload.messages,
            payload.options ?? {},
          ),
        };
      }
      const result = await raw.invoke(request, context);
      const { value: body, ...metadata } = result;
      if (!['completed', 'incomplete', 'refused'].includes(result.status)) return metadata;
      const decoder = new ProtocolDecoder(config.protocol);
      const events = decoder.decode(body as Record<string, unknown>, true);
      const terminal = events.find(
        (event) => typeof event !== 'string' && event.type === 'completion',
      );
      assertProtocolCompletion(terminal !== undefined, 'Background generation terminal missing');
      const usage = events.find((event) => typeof event !== 'string' && event.type === 'usage');
      return {
        ...metadata,
        status: terminal.status === 'tool-calls' ? 'completed' : terminal.status,
        value: events.filter(
          (event) =>
            typeof event === 'string' ||
            event.type === 'function-call-delta' ||
            event.type === 'content',
        ),
        ...(usage && typeof usage !== 'string' && usage.type === 'usage'
          ? { usage: usage.usage }
          : {}),
        ...(decoder.replay.length
          ? {
              continuation: {
                version: 1 as const,
                protocol: config.protocol,
                model: config.model,
                scope: input.handle.scope,
                data: { endpoint: config.baseUrl.replace(/\/+$/, ''), replay: decoder.replay },
              },
            }
          : {}),
      };
    },
  };
}

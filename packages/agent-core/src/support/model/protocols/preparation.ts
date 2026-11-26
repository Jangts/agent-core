/** Shared request preflight and scoped replay for direct and batch generation. */
import type { ModelMessage, ModelOptions } from '../../../structs/model/messages.js';
import { modelProtocolCatalog, modelRequest, type ModelProtocol } from './requests.js';
import { validateFunctions, validatePortableSchema } from './schema.js';
import { snapshotModelRequestBody, extendModelRequest } from './profile.js';
import { resolveModelCapabilities, type ModelEndpointCapabilities } from './capabilities.js';
import { replayNativeTurns } from './continuation.js';
export interface ModelRequestPreparation {
  readonly protocol: ModelProtocol;
  readonly model: string;
  readonly baseUrl: string;
  readonly scope?: string;
  readonly stream?: boolean;
  readonly capabilities?: ModelEndpointCapabilities;
  /** Explicit supplier extensions; Core-owned fields are rejected. */
  readonly requestBody?: Readonly<Record<string, unknown>>;
}
/** Validate first, then compile; no caller can bypass constraints by using a batch endpoint. */
export function prepareModelRequest(
  config: ModelRequestPreparation,
  messages: readonly ModelMessage[],
  options: Readonly<ModelOptions> = {},
): Record<string, unknown> {
  const descriptor = Object.hasOwn(modelProtocolCatalog, config.protocol)
    ? modelProtocolCatalog[config.protocol]
    : undefined;
  if (!descriptor) throw new TypeError('Unknown model protocol');
  const stream = config.stream ?? false;
  const capabilities = resolveModelCapabilities(config.protocol, config.capabilities);
  if (!capabilities.tools && (options.functions?.length || options.toolChoice === 'required'))
    throw new TypeError('Endpoint does not support tools');
  const extensions = snapshotModelRequestBody(config.requestBody);
  validateFunctions(options.functions);
  if (options.outputSchema) validatePortableSchema(options.outputSchema);
  if (
    (options.outputSchema ||
      (options.json && ['messages', 'interactions'].includes(config.protocol))) &&
    !capabilities.jsonSchema
  )
    throw new TypeError(`Native output schema unsupported: ${config.protocol}`);
  if (
    options.functions?.some((f) => f.strict) &&
    ['generate-content', 'interactions'].includes(config.protocol)
  )
    throw new TypeError(`Strict function schema unsupported: ${config.protocol}`);
  for (const message of messages) {
    if (
      (message.content && !capabilities.modalities.includes('text')) ||
      (message.images?.length && !capabilities.modalities.includes('image'))
    )
      throw new TypeError('Unsupported endpoint input modality');
  }
  for (const m of messages)
    for (const p of m.parts ?? []) {
      if (!capabilities.modalities.includes(p.type))
        throw new TypeError(`Unsupported input modality ${p.type}`);
      if (
        m.role === 'tool' &&
        ['chat-completions', 'generate-content'].includes(config.protocol) &&
        p.type !== 'text'
      )
        throw new TypeError('Media tool results require a supported protocol');
    }

  const body = modelRequest(config.protocol, config.model, messages, options, stream) as Record<
    string,
    any
  >;
  if (config.protocol === 'responses' && config.scope)
    body.include = ['reasoning.encrypted_content'];
  const continuation = options.continuation;
  if (continuation) {
    const scope = config.scope;
    if (!scope) throw new TypeError('Continuation requires an explicit identity scope');
    if (
      continuation.protocol !== config.protocol ||
      continuation.model !== config.model ||
      continuation.scope !== scope ||
      continuation.version !== 1
    )
      throw new TypeError('Model continuation scope mismatch');
    const saved = continuation.data as { endpoint?: string };
    if (!saved || saved.endpoint !== config.baseUrl.replace(/\/+$/, ''))
      throw new TypeError('Invalid continuation endpoint');
    replayNativeTurns(config.protocol, body, messages, continuation.data);
  }

  return extendModelRequest(body, extensions);
}

/** Pure request mappings. Provider wire details never enter business handlers. */
import type {
  ModelMessage,
  ModelOptions,
  ModelContentPart,
} from '../../../structs/model/messages.js';
export type ModelProtocol =
  'chat-completions' | 'responses' | 'messages' | 'generate-content' | 'interactions';
/** Endpoint descriptors also drive capability reporting and request selection. */
export const modelProtocolCatalog = Object.freeze({
  'chat-completions': {
    path: '/chat/completions',
    modalities: ['text', 'image', 'file'],
    jsonSchema: true,
  },
  responses: { path: '/responses', modalities: ['text', 'image', 'file'], jsonSchema: true },
  messages: { path: '/messages', modalities: ['text', 'image', 'file'], jsonSchema: true },
  'generate-content': {
    path: '',
    modalities: ['text', 'image', 'audio', 'video', 'file'],
    jsonSchema: true,
  },
  interactions: {
    path: '/interactions',
    modalities: ['text', 'image', 'audio', 'video', 'file'],
    jsonSchema: true,
  },
});
for (const descriptor of Object.values(modelProtocolCatalog)) {
  Object.freeze(descriptor.modalities);
  Object.freeze(descriptor);
}
/** Preserve ordered typed parts; the legacy text/images representation is a shorthand. */
function parts(message: ModelMessage): readonly ModelContentPart[] {
  return (
    message.parts ?? [
      { type: 'text', text: message.content },
      ...(message.images ?? []).map((image) => ({ type: 'image' as const, url: image.url })),
    ]
  );
}
function data(url: string) {
  const m = /^data:([^;,]+);base64,(.*)$/.exec(url);
  return m ? { mime_type: m[1], data: m[2] } : undefined;
}
function content(message: ModelMessage, protocol: ModelProtocol): unknown[] {
  return parts(message).map((p) => {
    if (p.type === 'text')
      return protocol === 'generate-content'
        ? { text: p.text }
        : {
            type:
              protocol === 'responses'
                ? message.role === 'assistant'
                  ? 'output_text'
                  : 'input_text'
                : 'text',
            text: p.text,
          };
    const inline = data(p.url);
    if (protocol === 'chat-completions') {
      if (p.type === 'file') {
        if (!inline || inline.mime_type !== 'application/pdf')
          throw new TypeError('Chat file input requires inline PDF data');
        return { type: 'file', file: { filename: 'attachment.pdf', file_data: p.url } };
      }
      return { type: 'image_url', image_url: { url: p.url } };
    }
    if (protocol === 'responses')
      return p.type === 'image'
        ? { type: 'input_image', image_url: p.url }
        : inline
          ? {
              type: 'input_file',
              filename: inline.mime_type === 'application/pdf' ? 'attachment.pdf' : 'attachment',
              file_data: p.url,
            }
          : { type: 'input_file', file_url: p.url };
    if (protocol === 'messages')
      return {
        type: p.type === 'file' ? 'document' : 'image',
        source: inline
          ? { type: 'base64', media_type: inline.mime_type, data: inline.data }
          : { type: 'url', url: p.url },
      };
    if (protocol === 'generate-content')
      return inline
        ? { inlineData: { mimeType: inline.mime_type, data: inline.data } }
        : { fileData: { mimeType: p.mimeType, fileUri: p.url } };
    return {
      type: p.type === 'file' ? 'document' : p.type,
      ...(inline ?? { uri: p.url }),
      ...(p.mimeType ? { mime_type: p.mimeType } : {}),
    };
  });
}
/** Compile one request using a protocol's native tool-result and instruction placement. */
export function modelRequest(
  protocol: ModelProtocol,
  model: string,
  messages: readonly ModelMessage[],
  options: Readonly<ModelOptions>,
  stream: boolean,
): Record<string, unknown> {
  const functions = options.functions ?? [];
  const tools = functions.map((f) => ({
    name: f.name,
    description: f.description,
    parameters: f.parameters,
  }));
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) =>
      parts(m)
        .map((p) => {
          if (p.type !== 'text') throw new TypeError('System instructions must be text');
          return p.text;
        })
        .join(''),
    )
    .join('\n');
  const calls = new Map(
    messages.flatMap((m) => (m.toolCalls ?? []).map((c) => [c.id, c.name] as const)),
  );
  const history = messages.filter((m) => m.role !== 'system');
  const output =
    options.outputSchema ??
    (options.json && ['messages', 'interactions'].includes(protocol)
      ? { type: 'object', additionalProperties: true }
      : undefined);
  if (protocol === 'chat-completions')
    return {
      model,
      stream,
      ...(stream && options.includeUsage ? { stream_options: { include_usage: true } } : {}),
      messages: messages.map((m) => ({
        ...m,
        parts: undefined,
        images: undefined,
        content: content(m, protocol),
        toolCalls: undefined,
        toolCallId: undefined,
        ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
        ...(m.toolCalls
          ? {
              tool_calls: m.toolCalls.map((c) => ({
                id: c.id,
                type: 'function',
                function: { name: c.name, arguments: c.arguments },
              })),
            }
          : {}),
      })),
      ...(tools.length
        ? {
            tools: functions.map((f) => ({ type: 'function', function: f })),
            tool_choice: options.toolChoice ?? 'auto',
            parallel_tool_calls:
              options.parallelToolCalls === 'omit' ? undefined : options.parallelToolCalls,
          }
        : {}),
      ...(output
        ? {
            response_format: {
              type: 'json_schema',
              json_schema: { name: 'result', schema: output, strict: true },
            },
          }
        : options.json
          ? { response_format: { type: 'json_object' } }
          : {}),
      max_tokens: options.maxOutputTokens,
      temperature: options.temperature,
    };
  if (protocol === 'responses')
    return {
      model,
      stream,
      store: false,
      input: messages.flatMap<Record<string, unknown>>((m) =>
        m.role === 'tool'
          ? [
              {
                type: 'function_call_output',
                call_id: m.toolCallId,
                output: m.parts ? content(m, protocol) : m.content,
              },
            ]
          : [
              { role: m.role, content: content(m, protocol) },
              ...(m.toolCalls ?? []).map((c) => ({
                type: 'function_call',
                call_id: c.id,
                name: c.name,
                arguments: c.arguments,
              })),
            ],
      ),
      ...(tools.length
        ? {
            tools: functions.map((f) => ({ type: 'function', ...f })),
            tool_choice: options.toolChoice ?? 'auto',
            ...(typeof options.parallelToolCalls === 'boolean'
              ? { parallel_tool_calls: options.parallelToolCalls }
              : {}),
          }
        : {}),
      ...(output
        ? {
            text: { format: { type: 'json_schema', name: 'result', schema: output, strict: true } },
          }
        : options.json
          ? { text: { format: { type: 'json_object' } } }
          : {}),
      max_output_tokens: options.maxOutputTokens,
      temperature: options.temperature,
    };
  if (protocol === 'messages')
    return {
      model,
      stream,
      ...(output ? { output_config: { format: { type: 'json_schema', schema: output } } } : {}),
      max_tokens: options.maxOutputTokens ?? 1024,
      ...(system ? { system } : {}),
      messages: history.map((m) =>
        m.role === 'tool'
          ? {
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: m.toolCallId,
                  content: m.parts ? content(m, protocol) : m.content,
                },
              ],
            }
          : {
              role: m.role,
              content: [
                ...content(m, protocol),
                ...(m.toolCalls ?? []).map((c) => ({
                  type: 'tool_use',
                  id: c.id,
                  name: c.name,
                  input: JSON.parse(c.arguments),
                })),
              ],
            },
      ),
      ...(tools.length
        ? {
            tools: functions.map((t) => ({
              name: t.name,
              description: t.description,
              input_schema: t.parameters,
              ...(t.strict === undefined ? {} : { strict: t.strict }),
            })),
            tool_choice: {
              type: options.toolChoice === 'required' ? 'any' : (options.toolChoice ?? 'auto'),
              ...(typeof options.parallelToolCalls === 'boolean'
                ? { disable_parallel_tool_use: !options.parallelToolCalls }
                : {}),
            },
          }
        : {}),
      temperature: options.temperature,
    };
  if (protocol === 'generate-content')
    return {
      contents: history.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts:
          m.role === 'tool'
            ? [
                {
                  functionResponse: {
                    id: m.toolCallId,
                    name: calls.get(m.toolCallId!),
                    response: {
                      result:
                        m.parts
                          ?.map((p) => {
                            if (p.type !== 'text')
                              throw new TypeError(
                                'Media tool results require a supported protocol',
                              );
                            return p.text;
                          })
                          .join('') ?? m.content,
                    },
                  },
                },
              ]
            : [
                ...content(m, protocol),
                ...(m.toolCalls ?? []).map((c) => ({
                  functionCall: { id: c.id, name: c.name, args: JSON.parse(c.arguments) },
                })),
              ],
      })),
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      ...(tools.length
        ? {
            tools: [{ functionDeclarations: tools }],
            toolConfig: {
              functionCallingConfig: {
                mode:
                  options.toolChoice === 'required'
                    ? 'ANY'
                    : options.toolChoice === 'none'
                      ? 'NONE'
                      : 'AUTO',
              },
            },
          }
        : {}),
      generationConfig: {
        maxOutputTokens: options.maxOutputTokens,
        temperature: options.temperature,
        ...(output
          ? { responseMimeType: 'application/json', responseJsonSchema: output }
          : options.json
            ? { responseMimeType: 'application/json' }
            : {}),
      },
    };
  return {
    model,
    stream,
    store: false,
    ...(output
      ? { response_format: { type: 'text', mime_type: 'application/json', schema: output } }
      : {}),
    input: history.flatMap<Record<string, unknown>>((m) =>
      m.role === 'tool'
        ? [
            {
              type: 'function_result',
              call_id: m.toolCallId,
              name: calls.get(m.toolCallId!),
              result: content(m, protocol),
            },
          ]
        : [
            {
              type: m.role === 'assistant' ? 'model_output' : 'user_input',
              content: content(m, protocol),
            },
            ...(m.toolCalls ?? []).map((c) => ({
              type: 'function_call',
              id: c.id,
              name: c.name,
              arguments: JSON.parse(c.arguments),
            })),
          ],
    ),
    ...(system ? { system_instruction: system } : {}),
    ...(tools.length ? { tools: tools.map((t) => ({ type: 'function', ...t })) } : {}),
    generation_config: {
      max_output_tokens: options.maxOutputTokens,
      temperature: options.temperature,
      ...(tools.length
        ? {
            tool_choice: options.toolChoice === 'required' ? 'any' : (options.toolChoice ?? 'auto'),
          }
        : {}),
    },
  };
}

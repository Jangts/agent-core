/** Validate and snapshot untrusted provider events before Runner routing or collector dispatch. */
import type { ModelStreamEvent, ModelContentPart } from '../structs/model/messages.js';
import { modelProtocolError } from '../utils/model-protocol.js';

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    modelProtocolError('Invalid model event object');
  return value as Record<string, unknown>;
}
function text(value: unknown, nonempty = false): string {
  if (typeof value !== 'string' || (nonempty && !value))
    modelProtocolError('Invalid model event text');
  return value;
}
function usageCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    modelProtocolError('Invalid model usage');
  return value;
}
function content(value: unknown): ModelContentPart {
  const source = record(value),
    type = source.type;
  if (type === 'text') return { type, text: text(source.text) };
  if (type !== 'image' && type !== 'audio' && type !== 'video' && type !== 'file')
    modelProtocolError('Invalid model content type');
  const url = text(source.url, true),
    mimeType = source.mimeType;
  return { type, url, ...(mimeType === undefined ? {} : { mimeType: text(mimeType) }) };
}
/** Snapshot only declared fields; malformed getters are also protocol failures, never native TypeErrors. */
export function snapshotModelEvent(value: unknown): ModelStreamEvent {
  try {
    if (typeof value === 'string') return value;
    const source = record(value),
      type = source.type;
    if (type === 'function-call-delta') {
      const index = source.index,
        id = source.id,
        name = source.name,
        args = source.arguments;
      if (typeof index !== 'number' || !Number.isSafeInteger(index) || index < 0)
        modelProtocolError('Invalid model call index');
      return {
        type,
        index,
        ...(id === undefined ? {} : { id: text(id, true) }),
        ...(name === undefined ? {} : { name: text(name) }),
        ...(args === undefined ? {} : { arguments: text(args) }),
      };
    }
    if (type === 'usage') {
      const usage = record(source.usage);
      return {
        type,
        usage: {
          promptTokens: usageCount(usage.promptTokens),
          completionTokens: usageCount(usage.completionTokens),
          totalTokens: usageCount(usage.totalTokens),
        },
      };
    }
    if (type === 'completion') {
      const status = source.status,
        reason = source.reason;
      if (
        status !== 'completed' &&
        status !== 'tool-calls' &&
        status !== 'refused' &&
        status !== 'incomplete'
      )
        modelProtocolError('Invalid model completion status');
      return { type, status, ...(reason === undefined ? {} : { reason: text(reason) }) };
    }
    if (type === 'continuation') {
      const state = record(source.continuation);
      if (state.version !== 1) modelProtocolError('Invalid model continuation version');
      return {
        type,
        continuation: {
          version: 1,
          protocol: text(state.protocol, true),
          model: text(state.model, true),
          scope: text(state.scope, true),
          data: structuredClone(state.data),
        },
      };
    }
    if (type === 'content') return { type, content: content(source.content) };
    modelProtocolError('Unknown model event');
  } catch {
    modelProtocolError('Malformed provider event');
  }
}

/** Give collectors and legacy transports the same plain-text projection. */
export function normalizeModelText(event: ModelStreamEvent):
  | Exclude<ModelStreamEvent, { type: 'content' }>
  | {
      type: 'content';
      content: Exclude<ModelContentPart, { type: 'text' }>;
    } {
  if (typeof event !== 'string' && event.type === 'content') {
    const { content } = event;
    return content.type === 'text' ? content.text : { type: 'content', content };
  }
  return event;
}

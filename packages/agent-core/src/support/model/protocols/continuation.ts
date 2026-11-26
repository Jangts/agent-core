/** Scoped native turns bound to canonical visible history. No provider state is trusted by position alone. */
import type {
  ModelMessage,
  ModelStreamEvent,
  ModelContentPart,
} from '../../../structs/model/messages.js';
import type { ModelProtocol } from './requests.js';
type Wire = Record<string, any>;
interface Anchor {
  role: string;
  parts: ModelContentPart[];
  calls: unknown[];
  toolCallId?: string;
}
interface NativeTurn {
  index: number;
  anchor: Anchor;
  native: Wire[];
}
export interface NativeContinuationData {
  endpoint: string;
  history: Anchor[];
  turns: NativeTurn[];
}
function append(parts: ModelContentPart[], part: ModelContentPart): void {
  if (part.type === 'text' && part.text === '') return;
  const previous = parts.at(-1);
  if (part.type === 'text' && previous?.type === 'text')
    parts[parts.length - 1] = { type: 'text', text: previous.text + part.text };
  else
    parts.push(
      part.type === 'text'
        ? { type: 'text', text: part.text }
        : { type: part.type, url: part.url, ...(part.mimeType ? { mimeType: part.mimeType } : {}) },
    );
}
/** Canonical projections remove representation-only text fragment boundaries, retaining semantic order. */
function anchor(message: ModelMessage): Anchor {
  const parts: ModelContentPart[] = [];
  for (const part of message.parts ?? [
    { type: 'text', text: message.content },
    ...(message.images ?? []).map((image) => ({ type: 'image' as const, url: image.url })),
  ])
    append(parts, part);
  if (message.role === 'assistant' && parts[0]?.type === 'text')
    parts[0] = { type: 'text', text: parts[0].text.trimStart() };
  const last = parts.at(-1);
  if (message.role === 'assistant' && last?.type === 'text')
    parts[parts.length - 1] = { type: 'text', text: last.text.trimEnd() };
  const normalized = parts.filter((p) => p.type !== 'text' || p.text !== '');
  return {
    role: message.role,
    parts: normalized,
    calls: (message.toolCalls ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      arguments: c.arguments,
    })),
    ...(message.toolCallId ? { toolCallId: message.toolCallId } : {}),
  };
}
/** Collect exactly the visible assistant projection emitted by a decoder, never private thinking. */
export class ContinuationRecorder {
  private parts: ModelContentPart[] = [];
  private calls = new Map<number, Wire>();
  push(event: ModelStreamEvent): void {
    if (typeof event === 'string') append(this.parts, { type: 'text', text: event });
    else if (event.type === 'content') append(this.parts, event.content);
    else if (event.type === 'function-call-delta') {
      const call = this.calls.get(event.index) ?? { id: '', name: '', arguments: '' };
      if (event.id) call.id = event.id;
      if (event.name) call.name += event.name;
      if (event.arguments) call.arguments += event.arguments;
      this.calls.set(event.index, call);
    }
  }
  finish(
    endpoint: string,
    messages: readonly ModelMessage[],
    native: Wire[],
    previous?: unknown,
  ): NativeContinuationData {
    const old = previous as NativeContinuationData | undefined;
    const projected = anchor({
      role: 'assistant',
      content: '',
      parts: this.parts,
      toolCalls: [...this.calls.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, c]) => ({ id: c.id, name: c.name, arguments: c.arguments })),
    });
    const data = {
      endpoint,
      history: [...messages.map(anchor), projected],
      turns: [...(old?.turns ?? []), { index: messages.length, anchor: projected, native }],
    };
    if (JSON.stringify(data).length > 1048576)
      throw new TypeError('Model continuation exceeds the 1048576 character limit');
    return structuredClone(data);
  }
}
/** Check all old inputs and assistant turns before replaying any opaque blocks. Legacy unanchored data is rejected. */
export function replayNativeTurns(
  protocol: ModelProtocol,
  body: Wire,
  messages: readonly ModelMessage[],
  data: unknown,
): void {
  if (JSON.stringify(data)?.length > 1048576)
    throw new TypeError('Model continuation exceeds the 1048576 character limit');
  const saved = data as NativeContinuationData;
  if (!saved || !Array.isArray(saved.history) || !Array.isArray(saved.turns) || !saved.turns.length)
    throw new TypeError('Invalid continuation history anchors');
  if (
    messages.length < saved.history.length ||
    saved.history.some((a, i) => JSON.stringify(a) !== JSON.stringify(anchor(messages[i])))
  )
    throw new TypeError('Model continuation history mismatch');
  let previous = -1;
  for (const turn of saved.turns) {
    if (
      !Number.isSafeInteger(turn.index) ||
      turn.index <= previous ||
      messages[turn.index]?.role !== 'assistant' ||
      !Array.isArray(turn.native) ||
      JSON.stringify(turn.anchor) !== JSON.stringify(anchor(messages[turn.index]))
    )
      throw new TypeError('Model continuation assistant anchor mismatch');
    previous = turn.index;
  }
  const offset = (index: number) =>
    messages
      .slice(0, index)
      .reduce(
        (count, m) =>
          count +
          (['messages', 'generate-content', 'interactions'].includes(protocol) &&
          m.role === 'system'
            ? 0
            : ['responses', 'interactions'].includes(protocol) && m.role !== 'tool'
              ? 1 + (m.toolCalls?.length ?? 0)
              : 1),
        0,
      );
  for (const turn of [...saved.turns].reverse()) {
    const i = offset(turn.index);
    if (protocol === 'chat-completions') {
      const original = turn.native[0];
      if (typeof original?.reasoning_content === 'string')
        body.messages[i].reasoning_content = original.reasoning_content;
    } else if (protocol === 'messages') body.messages[i].content = structuredClone(turn.native);
    else if (protocol === 'generate-content') body.contents[i].parts = structuredClone(turn.native);
    else
      body.input.splice(
        i,
        1 + (messages[turn.index].toolCalls?.length ?? 0),
        ...structuredClone(turn.native),
      );
  }
}

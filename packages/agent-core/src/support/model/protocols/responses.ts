/** Incremental native response decoding with explicit terminal events and private replay state. */
import type { ModelStreamEvent } from '../../../structs/model/messages.js';
import type { ModelProtocol } from './requests.js';
import type { HostedToolDecoder } from './hosted.js';
type Wire = Record<string, any>;
const eventCatalog: Partial<Record<ModelProtocol, ReadonlySet<string>>> = {
  responses: new Set([
    'response.created',
    'response.in_progress',
    'response.output_item.added',
    'response.output_item.done',
    'response.content_part.added',
    'response.content_part.done',
    'response.output_text.delta',
    'response.output_text.done',
    'response.function_call_arguments.delta',
    'response.function_call_arguments.done',
    'response.refusal.delta',
    'response.refusal.done',
    'response.reasoning_summary_part.added',
    'response.reasoning_summary_part.done',
    'response.reasoning_summary_text.delta',
    'response.reasoning_summary_text.done',
    'response.completed',
    'response.incomplete',
    'response.failed',
  ]),
  messages: new Set([
    'message_start',
    'message_delta',
    'message_stop',
    'content_block_start',
    'content_block_delta',
    'content_block_stop',
    'ping',
  ]),
  interactions: new Set([
    'interaction.created',
    'interaction.status_update',
    'interaction.completed',
    'step.start',
    'step.delta',
    'step.stop',
  ]),
};
/** Only a terminal event can prove completion for a native generation. */
export function assertProtocolCompletion(completed: boolean, message: string): asserts completed {
  if (!completed) throw Object.assign(new Error(message), { code: 'MODEL_INCOMPLETE' });
}

/** Per-request decoder; instances are never shared between conversations. */
export class ProtocolDecoder {
  readonly replay: Wire[] = [];
  finished = false;
  private called = false;
  private refused = false;
  private inputTokens = 0;
  private outputTokens = 0;
  private blocks = new Map<number, Wire>();
  private chat: Wire = { role: 'assistant', content: '', reasoning_content: '', tool_calls: [] };
  constructor(
    readonly protocol: ModelProtocol,
    private readonly hosted?: HostedToolDecoder,
  ) {}
  private call(index: number, c: Wire): ModelStreamEvent {
    this.called = true;
    return {
      type: 'function-call-delta',
      index,
      id: c.id,
      name: c.name,
      arguments: typeof c.arguments === 'string' ? c.arguments : JSON.stringify(c.arguments ?? {}),
    };
  }
  private done(reason: string): ModelStreamEvent {
    if (
      ![
        'stop',
        'end_turn',
        'tool_use',
        'tool_calls',
        'STOP',
        'completed',
        'length',
        'max_tokens',
        'MAX_TOKENS',
        'incomplete',
        'content_filter',
        'refusal',
        'SAFETY',
        'blocked',
        'refused',
        'stop_sequence',
        'pause_turn',
      ].includes(reason)
    )
      throw Object.assign(new Error('Unrecognized or nonterminal model status'), {
        code: 'MODEL_PROTOCOL',
      });
    this.finished = true;
    return {
      type: 'completion',
      status: this.refused
        ? 'refused'
        : ['length', 'max_tokens', 'MAX_TOKENS', 'incomplete', 'pause_turn'].includes(reason)
          ? 'incomplete'
          : ['content_filter', 'refusal', 'SAFETY', 'blocked', 'refused'].includes(reason)
            ? 'refused'
            : this.called
              ? 'tool-calls'
              : 'completed',
      reason,
    };
  }
  /** Decode one SSE payload or one complete response. Protocol errors never become silent EOF. */
  decode(x: Wire, full = false): ModelStreamEvent[] {
    if (
      this.finished &&
      (x.choices?.some((c: Wire) => c.delta?.content || c.delta?.tool_calls?.length) ||
        x.candidates?.some((c: Wire) => c.content?.parts?.length) ||
        [
          'response.output_text.delta',
          'response.function_call_arguments.delta',
          'content_block_start',
          'content_block_delta',
          'step.start',
          'step.delta',
        ].includes(x.type ?? x.event_type))
    )
      throw Object.assign(new Error('Model payload after terminal event'), {
        code: 'MODEL_PROTOCOL',
      });
    if (x.error || x.type === 'error')
      throw Object.assign(new Error('Model upstream error'), { code: 'MODEL_UPSTREAM' });
    if (this.finished && (x.item || /^response\.web_search_call\./.test(x.type ?? '')))
      throw new TypeError('Hosted tool payload after terminal event');
    if (!full && this.hosted?.intercept(x, this.replay)) return [];
    const out: ModelStreamEvent[] = [];
    const eventType = x.type ?? x.event_type;
    if (
      !full &&
      eventType &&
      eventCatalog[this.protocol] &&
      !eventCatalog[this.protocol]!.has(eventType)
    )
      throw new TypeError(`Unsupported ${this.protocol} event: ${eventType}`);
    const usage = x.usage ?? x.usageMetadata;
    if (usage) {
      const promptTokens =
        usage.prompt_tokens ??
        usage.input_tokens ??
        usage.promptTokenCount ??
        usage.total_input_tokens ??
        this.inputTokens;
      const completionTokens =
        usage.completion_tokens ??
        usage.output_tokens ??
        usage.candidatesTokenCount ??
        usage.total_output_tokens ??
        this.outputTokens;
      this.inputTokens = promptTokens;
      this.outputTokens = completionTokens;
      if (Number.isSafeInteger(promptTokens) && Number.isSafeInteger(completionTokens))
        out.push({
          type: 'usage',
          usage: {
            promptTokens,
            completionTokens,
            totalTokens:
              usage.total_tokens ?? usage.totalTokenCount ?? promptTokens + completionTokens,
          },
        });
    }
    if (this.protocol === 'chat-completions') {
      const c = x.choices?.find((c: Wire) => c.index === 0) ?? x.choices?.[0];
      if (!c) return out;
      const d = full ? c.message : c.delta;
      if (full && d) this.replay.push(structuredClone(d));
      if (!full && d) {
        if (typeof d.reasoning_content === 'string')
          this.chat.reasoning_content += d.reasoning_content;
        if (typeof d.content === 'string') this.chat.content += d.content;
        for (const [i, call] of (d.tool_calls ?? []).entries()) {
          const index = call.index ?? i;
          const saved = (this.chat.tool_calls[index] ??= {
            type: 'function',
            function: { name: '', arguments: '' },
          });
          if (call.id) saved.id = call.id;
          if (call.function?.name) saved.function.name += call.function.name;
          if (call.function?.arguments) saved.function.arguments += call.function.arguments;
        }
      }
      if (d?.content) out.push(d.content);
      if (d?.refusal) this.refused = true;
      for (const [i, call] of (d?.tool_calls ?? []).entries()) {
        this.called = true;
        out.push({
          type: 'function-call-delta',
          index: call.index ?? i,
          id: call.id,
          name: call.function?.name,
          arguments: call.function?.arguments,
        });
      }
      if (c.finish_reason) {
        if (!full) {
          this.chat.tool_calls = this.chat.tool_calls.filter(Boolean);
          this.replay.push(structuredClone(this.chat));
        }
        out.push(this.done(c.finish_reason));
      }
      return out;
    }
    if (this.protocol === 'responses') {
      if (full) {
        for (const item of x.output ?? [])
          if (
            !['message', 'function_call', 'reasoning'].includes(item.type) &&
            !this.hosted?.accept(item)
          )
            throw new TypeError(`Unsupported Responses output: ${item.type}`);
        this.replay.push(...(x.output ?? []));
        for (const [i, item] of (x.output ?? []).entries()) {
          if (this.hosted?.accept(item)) {
            this.hosted.record(item);
            continue;
          }
          if (item.type === 'function_call') out.push(this.call(i, { ...item, id: item.call_id }));
          for (const c of item.content ?? [])
            if (c.type === 'output_text') {
              out.push(c.text);
              this.hosted?.annotations(c);
            } else if (c.type === 'refusal') this.refused = true;
            else throw new TypeError(`Unsupported Responses content: ${c.type}`);
        }
        out.push(this.done(x.status ?? 'incomplete'));
        return out;
      }
      if (x.type === 'response.output_text.delta') out.push(x.delta);
      if (
        x.type === 'response.output_item.added' &&
        !['message', 'function_call', 'reasoning'].includes(x.item?.type)
      )
        throw new TypeError(`Unsupported Responses output: ${x.item?.type}`);
      if (x.type === 'response.output_item.added' && x.item?.type === 'function_call') {
        this.called = true;
        out.push({
          type: 'function-call-delta',
          index: x.output_index,
          id: x.item.call_id,
          name: x.item.name,
        });
      }
      if (x.type === 'response.function_call_arguments.delta')
        out.push({ type: 'function-call-delta', index: x.output_index, arguments: x.delta });
      if (x.type === 'response.output_item.done') this.replay.push(x.item);
      if (x.type === 'response.refusal.delta') this.refused = true;
      if (['response.completed', 'response.incomplete', 'response.failed'].includes(x.type)) {
        if (x.type === 'response.failed') throw new Error('Model response failed');
        out.push(...this.usage(x.response?.usage));
        out.push(this.done(x.response?.status ?? 'incomplete'));
      }
      return out;
    }
    if (this.protocol === 'messages') {
      if (full) {
        const content = x.content;
        if (!Array.isArray(content)) throw new TypeError('Expected Messages content blocks');
        for (const b of content)
          if (
            !['text', 'tool_use', 'thinking', 'redacted_thinking'].includes(b.type) &&
            !this.hosted?.accept(b)
          )
            throw new TypeError(`Unsupported Messages content: ${b.type}`);
        this.replay.push(...content);
        for (const [i, b] of content.entries()) {
          if (this.hosted?.accept(b)) {
            this.hosted.record(b);
            continue;
          }
          if (b.type === 'text') {
            out.push(b.text);
            this.hosted?.annotations(b);
          }
          if (b.type === 'tool_use')
            out.push(this.call(i, { id: b.id, name: b.name, arguments: b.input }));
        }
        out.push(this.done(x.stop_reason ?? 'incomplete'));
        return out;
      }
      if (x.type === 'message_start') out.push(...this.usage(x.message?.usage));
      if (
        x.type === 'content_block_start' &&
        !['text', 'tool_use', 'thinking', 'redacted_thinking'].includes(x.content_block?.type)
      )
        throw new TypeError(`Unsupported Messages content: ${x.content_block?.type}`);
      if (x.type === 'content_block_start') {
        this.blocks.set(x.index, structuredClone(x.content_block));
        const b = x.content_block;
        if (b.type === 'tool_use') {
          this.called = true;
          out.push({ type: 'function-call-delta', index: x.index, id: b.id, name: b.name });
        }
        if (b.type === 'text' && b.text) out.push(b.text);
      }
      if (x.type === 'content_block_delta') {
        const d = x.delta,
          b = this.blocks.get(x.index);
        if (d.type === 'text_delta') {
          out.push(d.text);
          if (b) b.text = (b.text ?? '') + d.text;
        } else if (d.type === 'input_json_delta') {
          out.push({ type: 'function-call-delta', index: x.index, arguments: d.partial_json });
          if (b) b._args = (b._args ?? '') + d.partial_json;
        } else if (b && d.type === 'thinking_delta') b.thinking = (b.thinking ?? '') + d.thinking;
        else if (b && d.type === 'signature_delta') b.signature = (b.signature ?? '') + d.signature;
        else if (b && d.type === 'citations_delta' && this.hosted?.enabled) {
          (b.citations ??= []).push(d.citation);
          this.hosted.annotations(b);
        } else throw new TypeError(`Unsupported Messages delta: ${d.type}`);
      }
      if (x.type === 'content_block_stop') {
        const b = this.blocks.get(x.index);
        if (b) {
          if (b._args) {
            b.input = JSON.parse(b._args);
            delete b._args;
          }
          this.replay.push(b);
        }
      }
      if (x.type === 'message_delta') {
        out.push(...this.usage(x.usage));
        if (x.delta?.stop_reason) out.push(this.done(x.delta.stop_reason));
      }
      return out;
    }
    if (this.protocol === 'generate-content') {
      const c = x.candidates?.find((c: Wire) => (c.index ?? 0) === 0);
      if (!c) {
        if (x.promptFeedback?.blockReason) out.push(this.done('blocked'));
        return out;
      }
      for (const b of c.content?.parts ?? []) {
        if (
          !['text', 'inlineData', 'functionCall', 'thoughtSignature', 'thought'].some((k) => k in b)
        )
          throw new TypeError('Unsupported generateContent part');
        this.replay.push(b);
        if (b.text && !b.thought) out.push(b.text);
        if (b.inlineData) {
          const mime = b.inlineData.mimeType ?? 'application/octet-stream';
          out.push({
            type: 'content',
            content: {
              type: mime.startsWith('audio/')
                ? 'audio'
                : mime.startsWith('image/')
                  ? 'image'
                  : 'file',
              url: `data:${mime};base64,${b.inlineData.data}`,
              mimeType: mime,
            },
          });
        }
        if (b.functionCall)
          out.push(
            this.call(this.replay.length - 1, {
              ...b.functionCall,
              id: b.functionCall.id ?? `call_${this.replay.length - 1}`,
              arguments: b.functionCall.args,
            }),
          );
      }
      if (c.finishReason) out.push(this.done(c.finishReason));
      return out;
    }
    if (full) {
      for (const b of x.steps ?? [])
        if (
          !['model_output', 'thought', 'function_call'].includes(b.type) &&
          !this.hosted?.accept(b)
        )
          throw new TypeError(`Unsupported Interactions step: ${b.type}`);
      this.replay.push(...(x.steps ?? []));
      for (const [i, b] of (x.steps ?? []).entries()) {
        if (this.hosted?.accept(b)) {
          this.hosted.record(b);
          continue;
        }
        if (b.type === 'function_call') out.push(this.call(i, b));
        if (b.type === 'model_output')
          for (const c of b.content ?? [])
            if (c.type === 'text') {
              out.push(c.text);
              this.hosted?.annotations(c);
            } else out.push(this.media(c));
      }
      out.push(
        this.done(x.status === 'requires_action' ? 'tool_calls' : (x.status ?? 'incomplete')),
      );
      return out;
    }
    const t = x.event_type ?? x.type;
    if (t === 'step.start' && !['model_output', 'thought', 'function_call'].includes(x.step?.type))
      throw new TypeError(`Unsupported Interactions step: ${x.step?.type}`);
    if (t === 'step.start') {
      this.blocks.set(x.index, structuredClone(x.step));
      if (x.step.type === 'function_call') {
        this.called = true;
        out.push({ type: 'function-call-delta', index: x.index, id: x.step.id, name: x.step.name });
      }
    }
    if (t === 'step.delta') {
      const b = this.blocks.get(x.index),
        d = x.delta;
      if (d.type === 'text') out.push(d.text);
      else if (d.type === 'arguments_delta') {
        out.push({ type: 'function-call-delta', index: x.index, arguments: d.arguments });
        if (b) b._args = (b._args ?? '') + d.arguments;
      } else if (b && d.type === 'thought_signature') b.signature = d.signature;
      else if (['image', 'audio', 'video', 'document'].includes(d.type)) out.push(this.media(d));
      else if (d.type !== 'thought_summary')
        throw new TypeError(`Unsupported Interactions delta: ${d.type}`);
      if (b && d.type === 'text') {
        (b.content ??= []).push(structuredClone(d));
        this.hosted?.annotations(d);
      }
    }
    if (t === 'step.stop') {
      const b = this.blocks.get(x.index);
      if (b) {
        if (b._args) {
          b.arguments = JSON.parse(b._args);
          delete b._args;
        }
        this.replay.push(b);
      }
    }
    if (t === 'interaction.completed')
      out.push(
        this.done(
          (x.interaction?.status ?? x.status) === 'requires_action'
            ? 'tool_calls'
            : (x.interaction?.status ?? x.status ?? 'completed'),
        ),
      );
    return out;
  }
  private media(c: Wire): ModelStreamEvent {
    const type = c.type === 'document' ? 'file' : c.type;
    if (!['image', 'audio', 'video', 'file'].includes(type))
      throw new TypeError(`Unsupported model content: ${c.type}`);
    const url =
      c.uri ??
      c.url ??
      (c.data ? `data:${c.mime_type ?? 'application/octet-stream'};base64,${c.data}` : undefined);
    if (typeof url !== 'string') throw new TypeError('Media output has no usable resource');
    return {
      type: 'content',
      content: {
        type,
        url,
        mimeType: c.mime_type,
      } as import('../../../structs/model/messages.js').ModelContentPart,
    };
  }
  private usage(usage: Wire | undefined): ModelStreamEvent[] {
    if (!usage) return [];
    return this.decode({ usage });
  }
}

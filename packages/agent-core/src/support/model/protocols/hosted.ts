/** Explicitly authorized provider-side search. Events are private observations, never local receipts. */
import type { ModelProtocol } from './requests.js';
type Wire = Record<string, any>;
export interface HostedToolEvent {
  readonly protocol: ModelProtocol;
  readonly source: 'provider';
  readonly phase: 'started' | 'delta' | 'completed' | 'sources';
  readonly type: string;
  readonly data: Readonly<Record<string, unknown>>;
}
/** Validate the finite native search definitions supported by this adapter. */
export function validateHostedTools(
  protocol: ModelProtocol,
  tools: readonly Readonly<Record<string, unknown>>[],
): void {
  for (const tool of tools) {
    const accepted =
      protocol === 'responses'
        ? tool.type === 'web_search'
        : protocol === 'messages'
          ? tool.type === 'web_search_20250305' && tool.name === 'web_search'
          : protocol === 'interactions'
            ? tool.type === 'google_search'
            : false;
    if (!accepted)
      throw new TypeError(`Unsupported hosted tool definition: ${protocol}/${String(tool.type)}`);
  }
}
/** Request-local queue. Callers explicitly drain it into an awaited private callback. */
export class HostedToolDecoder {
  private queue: HostedToolEvent[] = [];
  private blocks = new Map<number, Wire>();
  constructor(
    readonly protocol: ModelProtocol,
    readonly enabled: boolean,
  ) {}
  accept(block: Wire): boolean {
    const remote =
      this.protocol === 'responses'
        ? block.type === 'web_search_call'
        : this.protocol === 'messages'
          ? block.type === 'web_search_tool_result' ||
            (block.type === 'server_tool_use' && block.name === 'web_search')
          : this.protocol === 'interactions'
            ? ['google_search_call', 'google_search_result'].includes(block.type)
            : false;
    if (remote && !this.enabled) throw new TypeError('Unconfigured provider-side tool execution');
    return remote;
  }
  record(block: Wire, phase: HostedToolEvent['phase'] = 'completed'): void {
    this.queue.push({
      protocol: this.protocol,
      source: 'provider',
      phase,
      type: block.type,
      data: structuredClone(block),
    });
  }
  drain(): HostedToolEvent[] {
    const values = this.queue;
    this.queue = [];
    return values;
  }
  annotations(block: Wire): void {
    if (this.enabled && (block.annotations || block.citations))
      this.record(
        { type: 'citations', annotations: block.annotations, citations: block.citations },
        'sources',
      );
  }
  /** Consume native remote-tool frames while leaving ordinary content to the main decoder. */
  intercept(x: Wire, replay: Wire[]): boolean {
    const t = x.type ?? x.event_type;
    if (this.protocol === 'responses') {
      if (/^response\.web_search_call\.(in_progress|searching|completed)$/.test(t ?? '')) {
        if (!this.enabled) throw new TypeError('Unconfigured provider-side tool execution');
        this.record(x, t.endsWith('completed') ? 'completed' : 'delta');
        return true;
      }
      if (
        ['response.output_item.added', 'response.output_item.done'].includes(t) &&
        x.item &&
        this.accept(x.item)
      ) {
        this.record(x.item, t.endsWith('added') ? 'started' : 'completed');
        if (t.endsWith('done')) replay.push(x.item);
        return true;
      }
      if (t === 'response.output_text.annotation.added') {
        if (!this.enabled) throw new TypeError('Unconfigured provider-side citations');
        this.record(x, 'sources');
        return true;
      }
    }
    const start = this.protocol === 'messages' ? 'content_block_start' : 'step.start';
    const delta = this.protocol === 'messages' ? 'content_block_delta' : 'step.delta';
    const stop = this.protocol === 'messages' ? 'content_block_stop' : 'step.stop';
    if (t === start) {
      const block = x.content_block ?? x.step;
      if (block && this.accept(block)) {
        this.blocks.set(x.index, structuredClone(block));
        this.record(block, 'started');
        return true;
      }
    }
    const block = this.blocks.get(x.index);
    if (block && t === delta) {
      const d = x.delta;
      if (d.type === 'input_json_delta') block._args = (block._args ?? '') + d.partial_json;
      else Object.assign(block, d);
      this.record(x, 'delta');
      return true;
    }
    if (block && t === stop) {
      if (block._args) {
        block.input = JSON.parse(block._args);
        delete block._args;
      }
      replay.push(block);
      this.record(block);
      this.blocks.delete(x.index);
      return true;
    }
    return false;
  }
}

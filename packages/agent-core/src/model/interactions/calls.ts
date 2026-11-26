/**
 * Tool-call delta aggregation.
 *
 * One algorithm is shared by completion policies, session interactions and direct callers:
 * fragments are keyed by their provider index, IDs may not conflict, and a complete call
 * requires both an ID and a name. A complete call never hides another started but incomplete one.
 *
 * Exports: `AggregatedToolCall`, `ToolCallCollector`, `ToolCallFailure` and
 * `createToolCallCollector`.
 */
import type { ModelPart } from '../../structs/model/messages.js';
import { modelProtocolError } from '../../utils/model-protocol.js';

/** One completed native tool call in provider index order. */
export interface AggregatedToolCall {
  readonly index: number;
  readonly id: string;
  readonly name: string;
  readonly arguments: string;
}

/** Report a protocol violation and stop; callers decide how the failure is classified. */
export type ToolCallFailure = (message: string) => never;

/** Aggregation entry point for streamed function-call deltas. */
export interface ToolCallCollector {
  /** Feed one part; text parts are ignored and cannot satisfy or break a call. */
  push(part: ModelPart): void;
  /** Calls started so far, including incomplete ones, in index order. */
  readonly calls: readonly AggregatedToolCall[];
  /**
   * Finalize the calls.
   *
   * @throws When any started call is still missing its ID or name.
   */
  complete(): readonly AggregatedToolCall[];
}

/**
 * Create a collector for one response.
 *
 * @param fail - Protocol failure factory; defaults to the Core model protocol error.
 * @returns A collector that keeps its own state and never shares it with another response.
 */
export function createToolCallCollector(
  fail: ToolCallFailure = modelProtocolError,
): ToolCallCollector {
  const pending = new Map<number, { id: string; name: string; arguments: string }>();
  const ids = new Set<string>();
  const calls = (): readonly AggregatedToolCall[] =>
    [...pending.entries()]
      .sort(([left], [right]) => left - right)
      .map(([index, call]) => ({ index, ...call }));
  return {
    push(part: ModelPart) {
      if (typeof part === 'string') return;
      if (!part || typeof part !== 'object' || Array.isArray(part))
        fail('Expected a native model call');
      const { type, index, id, name, arguments: args } = part;
      if (type !== 'function-call-delta') fail('Expected a native model call');
      if (!Number.isInteger(index) || index < 0) fail('Invalid model call index');
      if (
        (id !== undefined && (typeof id !== 'string' || !id)) ||
        (name !== undefined && typeof name !== 'string') ||
        (args !== undefined && typeof args !== 'string')
      )
        fail('Invalid model call fields');
      let call = pending.get(index);
      if (!call) {
        call = { id: '', name: '', arguments: '' };
        pending.set(index, call);
      }
      if (id !== undefined) {
        if (call.id && call.id !== id) fail('Conflicting model call IDs');
        if (!call.id) {
          if (ids.has(id)) fail('Duplicate model call ID');
          ids.add(id);
          call.id = id;
        }
      }
      call.name += name ?? '';
      call.arguments += args ?? '';
    },
    get calls() {
      return calls();
    },
    complete() {
      const completed = calls();
      for (const call of completed) if (!call.id || !call.name) fail('Incomplete model call');
      return completed;
    },
  };
}

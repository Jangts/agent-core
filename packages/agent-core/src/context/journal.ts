/**
 * Request-local journal of context-relevant execution receipts.
 *
 * It records what was produced (model values, tool inputs) and what came back (tool results),
 * each stamped with a monotonic producer sequence so a snapshot replays in order. Values are
 * deep-cloned on write and on read: a caller mutating its own object cannot retroactively
 * change recorded history, and a snapshot is not a live window into the journal.
 *
 * This is a projection, not a persistent log store; storage and retention belong to the App.
 *
 * Exports: `ContextJournal` and the `ContextRecord` type.
 */
import { invocationId as nextInvocationId } from '../utils/invocation.js';
import type { InvocationMetadata } from '../structs/invocation.js';
import type {
  ToolJournal,
  ToolJournalStart,
  ToolJournalFinish,
} from '../structs/capabilities/invocation.js';
import type { ContextRecord } from '../structs/context/journal.js';
/** Request-local context projection of execution receipts; not a separate persistent log store. */
export class ContextJournal implements ToolJournal {
  /** Append-only: `producerSequence` is derived from this length, so order is never rewritten. */
  private readonly records: ContextRecord[] = [];
  /** Duplicate invocation ids are rejected instead of overwriting earlier history. */
  private readonly invocationIds = new Set<string>();
  /** Open tool calls, so a result can only close a call that actually started. */
  private readonly toolCalls = new Map<
    string,
    { record: Extract<ContextRecord, { type: 'tool' }>; finished: boolean }
  >();
  /**
   * Record one model-produced value.
   *
   * @param options.stageId Stage that produced the value.
   * @param options.value Value to record; deep-cloned on write.
   * @param options.invocation Execution identity whose `invocationId` must not be in the journal.
   * @returns Nothing.
   * @throws Error when the invocation id was already recorded.
   */
  model({
    stageId,
    value,
    invocation,
  }: {
    stageId: string;
    value: unknown;
    invocation: InvocationMetadata;
  }): void {
    if (this.invocationIds.has(invocation.invocationId))
      throw new Error('Duplicate journal invocation');
    this.records.push({
      ...invocation,
      // Derived from the append position, so the sequence stays gap-free without a counter.
      producerSequence: this.records.length + 1,
      occurredAtMs: Date.now(),
      type: 'model',
      stageId,
      value: structuredClone(value),
    });
    this.invocationIds.add(invocation.invocationId);
  }
  /**
   * Open a tool call.
   *
   * @param request Tool id, input and optional invocation metadata. A supplied invocation id is
   *   kept so Core records and the journal share one identity; otherwise a new id is generated.
   * @returns The invocation id that must be used to finish the call.
   * @throws Error when a call with that id is already recorded.
   */
  beginTool({ toolId, input, invocation }: ToolJournalStart): string {
    const invocationId = invocation?.invocationId ?? nextInvocationId();
    if (this.invocationIds.has(invocationId)) throw new Error('Duplicate journal invocation');
    const record: Extract<ContextRecord, { type: 'tool' }> = {
      ...invocation,
      invocationId,
      startedAtMs: invocation?.startedAtMs ?? Date.now(),
      durationMs: 0,
      producerSequence: this.records.length + 1,
      occurredAtMs: Date.now(),
      type: 'tool',
      toolId,
      input: structuredClone(input),
    };
    this.records.push(record);
    this.invocationIds.add(invocationId);
    this.toolCalls.set(invocationId, { record, finished: false });
    return invocationId;
  }
  /**
   * Close an open tool call with its outcome.
   *
   * @param request Invocation id, terminal status and result value; the value is cloned into
   *   the record.
   * @returns Nothing.
   * @throws Error when the call is unknown or was already finished.
   */
  finishTool({ invocationId, status, value }: ToolJournalFinish): void {
    const entry = this.toolCalls.get(invocationId);
    if (!entry || entry.finished) throw new Error('Invalid tool receipt');
    const call = entry.record;
    const occurredAtMs = Date.now();
    this.records.push({
      invocationId,
      runId: call.runId,
      spanId: call.spanId,
      parentSpanId: call.parentSpanId,
      parentInvocationId: call.parentInvocationId,
      startedAtMs: call.startedAtMs,
      durationMs: occurredAtMs - call.startedAtMs,
      producerSequence: this.records.length + 1,
      occurredAtMs,
      type: 'tool-result',
      toolId: call.toolId,
      status,
      value: structuredClone(value),
    });
    // Kept after finishing, so a repeated finish is rejected instead of appending a second
    // result for the same call.
    entry.finished = true;
  }
  /**
   * @returns A detached copy of every record, safe for the caller to mutate.
   */
  snapshot(): readonly ContextRecord[] {
    return structuredClone(this.records);
  }
}
export type { ContextRecord } from '../structs/context/journal.js';

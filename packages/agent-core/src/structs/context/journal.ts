/**
 * Request journal contract: the ordered record of what one request actually did.
 *
 * A journal is request-local. It records model and tool facts with a monotonic sequence so an App
 * can rebuild context or receipts without reading Core diagnostics; the record payloads are opaque
 * to Core.
 *
 * Exports: `ContextRecord`.
 */
import type { InvocationMetadata } from '../invocation.js';

/** Identity every journal record carries, in addition to its type-specific fields. */
type RecordIdentity = InvocationMetadata & {
  /** Invocation that produced the record. */
  readonly invocationId: string;
  /** Monotonic order within this journal; starts at 1 and never repeats. */
  readonly producerSequence: number;
  /** Instant the record was written, in epoch milliseconds. */
  readonly occurredAtMs: number;
};

/**
 * One journal entry: a model call, a tool request or a tool result.
 *
 * The three variants are distinguished by `type`; `value`/`input` stay `unknown` because their
 * domain meaning belongs to the App.
 */
export type ContextRecord = RecordIdentity &
  /** A model call was made for `stageId`; `value` is what the call produced. */
  (
    | { readonly type: 'model'; readonly stageId: string; readonly value: unknown }
    /** A tool call was requested; `input` is the raw request payload. */
    | { readonly type: 'tool'; readonly toolId: string; readonly input: unknown }
    /** A tool call settled; `value` carries the result or the failure detail. */
    | {
        readonly type: 'tool-result';
        readonly toolId: string;
        readonly status: 'success' | 'error' | 'cancelled';
        readonly value: unknown;
      }
  );

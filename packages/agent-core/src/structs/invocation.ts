/**
 * Invocation identity and success receipts.
 *
 * Every Core-initiated model call or tool call returns its value together with the metadata that
 * identifies the invocation, so callers can correlate results with diagnostics without parsing
 * logs. These records describe completed calls only; failures surface as thrown errors.
 *
 * Exports: `InvocationMetadata`, `InvocationResult`, `ModelCallRecord`, `ToolCallRecord`,
 * `ModelResult`, `ToolResult`.
 */
import type { ModelUsage } from './model/messages.js';

/** Identity and timing shared by every invocation receipt. */
export interface InvocationMetadata {
  /** Root run this invocation belongs to, when the host runs inside a diagnostics scope. */
  readonly runId?: string;
  /** Diagnostics span of this invocation. */
  readonly spanId?: string;
  /** Span that caused this invocation; absent for a root invocation. */
  readonly parentSpanId?: string;
  /** Enclosing invocation when one call triggers another. */
  readonly parentInvocationId?: string;
  /** Opaque per-invocation id shared by receipt, events and diagnostic records. */
  readonly invocationId: string;
  /** Start instant in epoch milliseconds. */
  readonly startedAtMs: number;
  /** Elapsed milliseconds from start to completion. */
  readonly durationMs: number;
}
/** A produced value together with the receipt of the invocation that produced it. */
export interface InvocationResult<Value, Metadata extends InvocationMetadata = InvocationMetadata> {
  readonly value: Value;
  readonly invocation: Readonly<Metadata>;
}
/** Receipt of a model call that returned successfully. */
export interface ModelCallRecord extends InvocationMetadata {
  /** Records are only emitted for successful calls; failures are thrown instead. */
  readonly status: 'success';
  /** Workflow stage that requested the call. */
  readonly stageId?: string;
  /** Configured model binding used for the call. */
  readonly modelId?: string;
  /** One-based position of the call within its runner's lifetime. */
  readonly callSequence: number;
  /** Provider-reported token usage; present only when the provider supplied it. */
  readonly usage?: Readonly<ModelUsage>;
}
/** Receipt of a tool call that returned successfully. */
export interface ToolCallRecord extends InvocationMetadata {
  /** Records are only emitted for successful calls; failures are thrown instead. */
  readonly status: 'success';
  /** Registered tool that produced the value. */
  readonly toolId: string;
}
/** Model call result with its model-call receipt. */
export type ModelResult<Value> = InvocationResult<Value, ModelCallRecord>;
/** Tool call result with its tool-call receipt. */
export type ToolResult<Value> = InvocationResult<Value, ToolCallRecord>;

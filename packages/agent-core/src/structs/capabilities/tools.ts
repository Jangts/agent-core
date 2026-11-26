/**
 * Tool definition, execution and registry contracts.
 *
 * A tool declares its model-visible schema, a host authorization step and one execution unit. The
 * registry binds an App context, validates input/output at the boundary and produces receipts, so
 * individual tools never handle transportation, budget accounting or event emission.
 *
 * Exports: `ToolDefinition`, `ToolExecutionContext`, `ErasedTool`, `RegisteredTool`,
 * `ToolExecutionEvent`, `ToolRegistryPorts`, `ToolInvocationRequest`, `ToolRegistryOptions`.
 */
import type { InvocationMetadata } from '../invocation.js';
import type { ExecutionContext, MaybePromise, OperationContext, SchemaAdapter } from '../common.js';
import type { DiagnosticContext } from '../diagnostics.js';
import type { RegistrationProjection } from '../../utils/registration.js';
import type { NodeReportingContext, RuntimeNodeReportingContext } from '../debug.js';
import type { ModelTool, ToolProposal } from './model.js';

/** One registered tool, typed by its input, output, host context and id literal. */
export interface ExecutableTool<
  Input = unknown,
  Output = unknown,
  App = unknown,
  Id extends string = string,
> extends Omit<ModelTool<Input, ToolProposal, App>, 'resolve'> {
  /** Executable proposals use raw arguments; custom model mappings are separate tools. */
  readonly resolve?: never;
  /** Stable id; also the name the model calls. */
  readonly id: Id;
  /** Declared grouping used by registries and documentation; not an authorization boundary. */
  readonly kind: string;
  /** Model-visible explanation of when to call the tool. */
  readonly description: string;
  /** Schema applied to raw model arguments before `authorize` and `execute`. */
  readonly inputSchema: SchemaAdapter<Input>;
  /** Host permission check. Runs before execution and may be asynchronous. */
  authorize(input: Input, context: OperationContext<App>): MaybePromise<void>;
  /** Executes the already-authorized input; must not repeat authorization decisions. */
  execute(
    input: Input,
    context: OperationContext<App> & import('../debug.js').NodeReportingContext,
  ): MaybePromise<Output>;
  /** Optional result hook; writes through context.createStepRecorder() are recorded immediately. */
  debugSteps?(result: Output, context: import('../debug.js').NodeReportingContext): void;
  /** Validates untrusted output (for example a cached replay) before it is returned. */
  parseOutput(value: unknown): Output;
}

/** Executable declarations share metadata, but proposal mapping belongs to the model projection. */
export type ToolDefinition<
  Input = unknown,
  Output = unknown,
  App = unknown,
  Id extends string = string,
> = ExecutableTool<Input, Output, App, Id>;

/** Execution facts handed to a tool for one invocation. */
export interface ToolExecutionContext extends ExecutionContext, RuntimeNodeReportingContext {
  /** Delegate bound by Core to this actual invocation. */
  readonly logger?: import('../debug.js').ScopedReportedStepRecorder;
  /** Diagnostic scope of the invocation, when recording is enabled. */
  readonly diagnostics?: DiagnosticContext;
  /** Declared execution discipline; mirrors whether the registry accepted an async tool. */
  readonly mode: 'sync' | 'async';
  /** Opaque invocation id shared by receipt, events and diagnostics. */
  readonly invocationId: string;
  /** Non-optional cancellation for this invocation. */
  readonly signal: AbortSignal;
}

/** Type-erased tool shape the registry executes after parsing at the boundary. */
export interface ErasedTool {
  readonly id: string;
  readonly kind: string;
  /** Optional here because the erased view does not require model-facing prose. */
  readonly description?: string;
  readonly debugSteps?: (result: unknown, context: NodeReportingContext) => void;
  parseInput(value: unknown): unknown;
  parseOutput(value: unknown): unknown;
  execute(input: unknown, context: ToolExecutionContext): unknown;
}

/** Registered snapshot: public data is retained, implementation helpers are not a contract. */
export type RegisteredTool<Tool extends ErasedTool = ErasedTool> = RegistrationProjection<
  Tool,
  ErasedTool
>;

/** Fact emitted when one tool call settles, correlated by `invocationId`. */
export interface ToolExecutionEvent<Kind extends string = string> extends InvocationMetadata {
  toolId: string;
  /** Opaque identity shared by result and diagnostic records; not an App message ID. */
  invocationId: string;
  kind: Kind;
  durationMs: number;
  status: import('../common.js').InvocationStatus;
  /** Error classification when the call failed. */
  errorCode?: string;
}

/** Host ports a tool registry needs in addition to the tool definitions. */
export interface ToolRegistryPorts {
  /** Request lifetime; late external results cannot become successful receipts. */
  signal?: AbortSignal;
  diagnostics?: DiagnosticContext;
  /** Builds the error for a tool id that is not available in this request. */
  unavailable?(name: string): Error;
  /** Maps an arbitrary thrown value to a stable error code for events. */
  errorCode?(error: unknown): string;
}

/** One invocation request; the registry supplies signal and diagnostics when omitted. */
export interface ToolInvocationRequest<Id extends string = string> {
  /** Explicit recorder for this call, also available to its handler for deliberate use. */
  readonly logger?: import('../debug.js').ReportedStepRecorder;
  readonly toolId: Id;
  /** Raw model arguments; parsed by the tool's input schema before authorization. */
  readonly input: unknown;
  /** Per-call cancellation; can only shorten the surrounding execution lifetime. */
  readonly signal?: AbortSignal;
  readonly diagnostics?: DiagnosticContext;
}

/** Registry construction options. */
export interface ToolRegistryOptions {
  /** Execution defaults applied to invocations that do not pass their own. */
  readonly execution?: import('../common.js').ExecutionOptions;
  /** Error factories shared by every tool in the registry. */
  readonly errors?: Pick<ToolRegistryPorts, 'unavailable' | 'errorCode'>;
}

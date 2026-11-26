/**
 * Tool invocation lifecycle contracts: request-local journal, handler shape and host ports.
 *
 * These declarations let an App compose tool handlers from a journal and optional ports without
 * Core learning any domain concept. The journal records execution receipts; the host decides what
 * a receipt means for its own domain.
 *
 * Exports: `ToolJournalStart`, `ToolJournalFinish`, `ToolJournal`, `InvocationHandler`,
 * `ToolInvocationPorts`.
 */
import type { InvocationMetadata } from '../invocation.js';

/** Opening record for one tool call, written before the handler runs. */
export interface ToolJournalStart {
  /** Tool being invoked. */
  toolId: string;
  /** Parsed input; stored as-is so the host can build its own domain record. */
  input: unknown;
  /** What the caller already knows. The journal fills gaps and generates an id when absent. */
  invocation?: Partial<InvocationMetadata>;
}

/** Closing record for one tool call, written once with the terminal outcome. */
export interface ToolJournalFinish {
  /** Invocation opened by `beginTool`. */
  invocationId: string;
  /** Terminal status; `cancelled` is distinct from `error`. */
  status: 'success' | 'error' | 'cancelled';
  /** Produced value on success; failure detail on error; ignored for cancellation. */
  value: unknown;
}

/** Request-local execution receipts; the host decides their domain content. */
export interface ToolJournal {
  /** Opens a receipt and returns the invocation id later passed to `finishTool`. */
  beginTool(request: ToolJournalStart): string;
  /** Closes the receipt; must be called exactly once per opened invocation. */
  finishTool(request: ToolJournalFinish): void;
}

/** A named handler invoked by a tool lifecycle step. */
export interface InvocationHandler<Input, Context> {
  readonly id: string;
  /**
   * Runs the handler.
   *
   * The return value is ignored, so handlers report outcomes through the tool value or journal.
   * @param input - Step input supplied by the lifecycle.
   * @param context - Host context of the request.
   * @param execution - Execution facts of this invocation.
   */
  call(input: Input, context: Context, execution: import('./tools.js').ToolExecutionContext): void;
}

/** Optional tools the lifecycle resolves from the host context for one invocation. */
export interface ToolInvocationPorts<Context> {
  /** Explicit recorder selected for this invocation only. */
  readonly logger?: (context: Context) => import('../debug.js').ReportedStepRecorder | undefined;
  /** Diagnostic scope; omitted disables recording for this tool. */
  readonly diagnostics?: (
    context: Context,
  ) => import('../diagnostics.js').DiagnosticContext | undefined;
  /** Extra cancellation; must not replace the tool execution signal. */
  readonly signal?: (context: Context) => AbortSignal | undefined;
  /** Journal receiving begin/finish receipts. */
  readonly journal?: (context: Context) => ToolJournal | undefined;
  /** Extracts the domain checkpoint recorded with the receipt. */
  readonly checkpoint?: (context: Context) => unknown;
  /** Builds the domain receipt from a checkpoint after execution. */
  readonly receipt?: (context: Context, checkpoint: unknown) => unknown;
  /** Converts an error into the receipt's replacement value. */
  readonly receiptError?: (error: unknown) => unknown;
}

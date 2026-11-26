/**
 * Execution of one host-selected synchronous invocation.
 *
 * An invocation is the smallest Core-owned unit of work: the App decides which handler to
 * call and supplies payload and authorization facts, while this module runs the handler once,
 * threads cancellation and diagnostics, and pairs an optional journal start with a receipt.
 * Selection, authorization and retries stay outside.
 *
 * Exports: `executeInvocation` and the invocation contracts re-exported at the bottom.
 */
import { nativeReportedStepSync } from '../diagnostics/native-sub-flow.js';
import { invocationId } from '../utils/invocation.js';
import { synchronous } from '../utils/synchronous.js';
import { diagnosticError } from '../diagnostics/index.js';
import { NodeReports } from '../execution/reporting.js';
import type { InvocationHandler, ToolInvocationPorts } from '../structs/capabilities/invocation.js';

/**
 * Run one synchronous invocation and record its effects.
 *
 * @param invocation Handler whose `call` performs the work; its `id` becomes the tool id in
 *   diagnostics and journal records.
 * @param input Payload handed to the handler unchanged.
 * @param context App context passed to the ports below; it is never inspected here.
 * @param ports Per-context callbacks for diagnostics, cancellation, journalling and receipt
 *   capture. All are optional: without them the handler still runs, just unrecorded.
 * @returns Nothing. The outcome is conveyed through the journal receipt, when one is bound.
 * @throws TypeError when the handler identity is missing, or when the handler returns a
 *   promise despite the synchronous contract.
 * @throws Whatever the handler throws, unchanged, including the abort error raised by the
 *   signal checks.
 */
export function executeInvocation<Input, Context>(
  invocation: InvocationHandler<Input, Context>,
  input: Input,
  context: Context,
  ports: ToolInvocationPorts<Context> = {},
): void {
  let logger: import('../structs/debug.js').ReportedStepRecorder | undefined;
  try {
    logger = ports.logger?.(context);
  } catch {
    /* Optional recording cannot block execution. */
  }
  const callId = invocationId();
  return nativeReportedStepSync(
    {
      logger,
      invocationId: callId,
      get signal() {
        return ports.signal?.(context);
      },
    },
    'invocation',
    invocation.id,
    (scopedLogger) => runInvocation(invocation, input, context, ports, scopedLogger, callId),
  );
}

/** Execute the existing synchronous lifecycle without changing journal or error precedence. */
function runInvocation<Input, Context>(
  invocation: InvocationHandler<Input, Context>,
  input: Input,
  context: Context,
  ports: ToolInvocationPorts<Context>,
  logger?: import('../structs/debug.js').ScopedReportedStepRecorder,
  executionId = invocationId(),
): void {
  const toolId = invocation.id;
  // Identify the call before touching the ports: journal and diagnostics records cannot be
  // reconciled with an anonymous handler.
  if (!toolId?.trim()) throw new TypeError('Invalid invocation handler identity');
  const journal = ports.journal?.(context),
    id = executionId,
    startedAtMs = Date.now();
  const diagnostics = ports.diagnostics?.(context)?.child(id, {
    invocationId: id,
    nodeRole: 'invocation',
    definitionKind: 'tool-invocation',
    definitionId: toolId,
    nodeId: toolId,
    nodeName: toolId,
    nodeKind: 'tool-invocation',
  });
  const callId = journal?.beginTool({
    toolId,
    input,
    invocation: { ...diagnostics?.identity, invocationId: id, startedAtMs },
  });
  diagnostics?.emit('tool.call', () => ({
    toolId,
    invocationId: id,
    ...(diagnostics?.enabled('tool.call', 'content') ? { input } : {}),
  }));
  // Held outside the try block so the failure path can still tell cancellation from an error.
  let activeSignal: AbortSignal | undefined;
  let reports: NodeReports | undefined;
  try {
    const checkpoint = ports.checkpoint?.(context);
    const signal = (activeSignal = ports.signal?.(context));
    signal?.throwIfAborted();
    reports = new NodeReports(diagnostics, signal, 'tool.result');
    // The helper rejects a promise and drains its rejection: a handler that turns async must
    // fail here instead of escaping as an unhandled rejection.
    synchronous(
      invocation.call(input, context, {
        logger,
        mode: 'sync',
        invocationId: id,
        signal: signal ?? new AbortController().signal,
        diagnostics,
        report: reports.report.bind(reports),
        createStepRecorder: reports.createStepRecorder.bind(reports),
        createSubFlowLogger: reports.createStepRecorder.bind(reports),
      }),
      'Invocation handlers must be synchronous',
    );
    ports.signal?.(context)?.throwIfAborted();
    if (callId) {
      const receipt = ports.receipt?.(context, checkpoint);
      // Cancellation may have arrived while the handler or receipt ran; a successful record
      // must not be committed for a request the host has already abandoned.
      ports.signal?.(context)?.throwIfAborted();
      journal!.finishTool({ invocationId: callId, status: 'success', value: receipt });
    }
    reports.close();
    diagnostics?.emit(
      'tool.result',
      () => ({ toolId, invocationId: id, status: 'success', durationMs: Date.now() - startedAtMs }),
      reports.debug(),
    );
  } catch (error) {
    reports?.close();
    diagnostics?.emit(
      'tool.result',
      () => ({
        toolId,
        invocationId: id,
        status: activeSignal?.aborted ? 'cancelled' : 'error',
        durationMs: Date.now() - startedAtMs,
        ...(diagnostics?.enabled('tool.result', 'content')
          ? { error: diagnosticError(error) }
          : {}),
      }),
      reports?.debug(),
    );
    try {
      if (callId)
        journal!.finishTool({
          invocationId: callId,
          // The signal, not the error shape, decides whether this counts as cancellation.
          status: ports.signal?.(context)?.aborted ? 'cancelled' : 'error',
          value: ports.receiptError?.(error),
        });
    } catch {
      /* Preserve the invocation failure if receipt recording also fails. */
    }
    throw error;
  } finally {
    // Closing is idempotent, so a port that throws on the success path still releases the
    // reporting scope.
    reports?.close();
  }
}

export type {
  InvocationHandler,
  ToolInvocationPorts,
  ToolJournal,
} from '../structs/capabilities/invocation.js';

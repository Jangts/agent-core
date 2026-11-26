/**
 * Optional fixed sub-flow records for native execution boundaries.
 *
 * Callers choose the logger explicitly. A full logger issues a scoped delegate for this call; already-scoped Kit contexts reuse
 * their delegate. Neither path creates storage or changes execution and cancellation.
 * Logging failures are isolated from the wrapped operation.
 *
 * Exports: nativeReportedStepCatalog, nativeReportedStepSync, nativeReportedStepAsync.
 */
import type {
  ReportedStepLog,
  ScopedReportedStepRecorder,
  ReportedStepStatus,
} from '../structs/debug.js';

import {
  ReportedStepRecorder,
  requireReportedStepRecorder,
  bindNativeReportedStepRecorder,
} from './sub-flow.js';

/** Fixed metadata shared by native producers; pure getters and formatters are not producers. */
export const nativeReportedStepCatalog = {
  model: { name: 'Model call', kind: 'model', type: 'model.call' },
  tool: { name: 'Tool call', kind: 'tool', type: 'tool.call' },
  invocation: { name: 'Invocation', kind: 'invocation', type: 'handler.call' },
  retrieval: { name: 'Retrieval', kind: 'retrieval', type: 'retrieval.run' },
  task: { name: 'Read answer evidence', kind: 'retrieval', type: 'evidence.read' },
  check: { name: 'Check answer', kind: 'validation', type: 'answer.check' },
  output: { name: 'Compose output', kind: 'presentation', type: 'output.compose' },
  answer: { name: 'Answer flow', kind: 'answering', type: 'answer.run' },
  retry: { name: 'Retry model proposal', kind: 'recovery', type: 'model.retry' },
  context: { name: 'Process context', kind: 'context', type: 'context.process' },
  recovery: { name: 'Recovery attempt', kind: 'recovery', type: 'recovery.try' },
  delivery: { name: 'Deliver result', kind: 'delivery', type: 'delivery.run' },
  aggregation: { name: 'Aggregate queries', kind: 'retrieval', type: 'queries.collect' },
  knowledge: { name: 'Read knowledge', kind: 'retrieval', type: 'knowledge.read' },
} as const;
type Producer = keyof typeof nativeReportedStepCatalog;
type Context = {
  readonly logger?: ReportedStepLog;
  readonly signal?: AbortSignal;
  readonly invocationId?: string;
};

/** Start one fixed record; its revision is best-effort and never controls the operation. */
function begin(context: Context, producer: Producer, id: string) {
  let logger: ReportedStepLog | undefined;
  try {
    logger =
      context.logger instanceof ReportedStepRecorder
        ? bindNativeReportedStepRecorder(context.logger, producer, id)
        : context.logger;
  } catch {
    /* A recording limit must not turn a valid operation into a failure. */
  }
  let step: string | -1 = -1;
  try {
    if (logger)
      step = logger.write({
        ...nativeReportedStepCatalog[producer],
        relatedDefinitionId: id,
        ...(context.invocationId === undefined
          ? {}
          : { relatedInvocationId: context.invocationId }),
        status: 'running',
      });
  } catch {
    /* Optional recording must not change execution. */
  }
  return {
    logger,
    finish: (status: ReportedStepStatus) => {
      try {
        if (logger && step !== -1) logger.fix(step, { status });
      } catch {
        /* A broken or detached logger cannot replace the operation result. */
      }
    },
  };
}

/** Signal access is diagnostic metadata and cannot replace an operation failure. */
function failureStatus(context: Context): ReportedStepStatus {
  try {
    return context.signal?.aborted ? 'cancelled' : 'error';
  } catch {
    return 'error';
  }
}

/** Preserve a synchronous boundary while pairing an optional write with one result revision. */
export function nativeReportedStepSync<Value>(
  context: Context,
  producer: Producer,
  id: string,
  invoke: (logger?: ScopedReportedStepRecorder) => Value,
): Value {
  if (producer === 'model' || producer === 'tool' || producer === 'invocation')
    requireReportedStepRecorder(context.logger);
  if (!context.logger) return invoke();
  const { logger, finish } = begin(context, producer, id);
  try {
    const value = invoke(logger as ScopedReportedStepRecorder);
    finish('success');
    return value;
  } catch (error) {
    finish(failureStatus(context));
    throw error;
  }
}

/** Await the original operation without introducing another timeout or cancellation race. */
export async function nativeReportedStepAsync<Value>(
  context: Context,
  producer: Producer,
  id: string,
  invoke: (logger?: ScopedReportedStepRecorder) => Value | PromiseLike<Value>,
): Promise<Value> {
  if (producer === 'model' || producer === 'tool' || producer === 'invocation')
    requireReportedStepRecorder(context.logger);
  if (!context.logger) return invoke();
  const { logger, finish } = begin(context, producer, id);
  try {
    const value = await invoke(logger as ScopedReportedStepRecorder);
    finish('success');
    return value;
  } catch (error) {
    finish(failureStatus(context));
    throw error;
  }
}

/** @deprecated Use `nativeReportedStepCatalog`. Kept as a 0.9 compatibility alias. */
export { nativeReportedStepCatalog as nativeSubFlowCatalog };

/** @deprecated Use `nativeReportedStepSync`. Kept as a 0.9 compatibility alias. */
export { nativeReportedStepSync as nativeSubFlowSync };

/** @deprecated Use `nativeReportedStepAsync`. Kept as a 0.9 compatibility alias. */
export { nativeReportedStepAsync as nativeSubFlowAsync };

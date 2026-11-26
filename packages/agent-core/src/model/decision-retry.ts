/**
 * Single retry point for rejected parallel model proposals.
 *
 * A provider may answer with more than one tool call. The protocol rejects that answer
 * before any tool runs, so retrying is safe and must happen here — after a tool had
 * executed, a retry could duplicate side effects.
 *
 * Exports: `retryMultipleModelCalls`.
 */
import { nativeSubFlowAsync } from '../diagnostics/native-sub-flow.js';
import { getErrorInfo } from '../errors.js';

/**
 * Retry once when the failure is a rejected multi-call proposal.
 *
 * Only the `MODEL_MULTIPLE_CALLS` code is retried; every other failure is rethrown
 * unchanged. The caller owns the fallback prompt and the budget it consumes.
 *
 * @param request - `invoke` performs the first attempt; `retry` performs the fallback.
 * @returns The first successful value.
 * @throws The original error when it is not a multi-call rejection, or the fallback error.
 */
export async function retryMultipleModelCalls<Value>(request: {
  readonly logger?: import('../structs/debug.js').ReportedStepRecorder;
  readonly signal?: AbortSignal;
  readonly invoke: () => Promise<Value>;
  readonly retry: (error: unknown) => Promise<Value>;
}): Promise<Value> {
  try {
    return await request.invoke();
  } catch (error) {
    if (!getErrorInfo(error).codes.includes('MODEL_MULTIPLE_CALLS')) throw error;
    return nativeSubFlowAsync(request, 'retry', 'MODEL_MULTIPLE_CALLS', () => request.retry(error));
  }
}

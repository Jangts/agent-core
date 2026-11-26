/**
 * Core diagnostics surface: one execution fact source shared by live observers and an optional
 * log consumer.
 *
 * `createDiagnostics` configures the consumer, `diagnosticError` turns an arbitrary thrown value
 * into a loggable record, and `normalizeDiagnosticEvent` re-validates a persisted record before
 * it is trusted. Payload visibility comes from the event catalog, and a failing consumer never
 * changes execution.
 *
 * Exports: the factory and helpers above, the event catalog, and the diagnostic types.
 */
import { createEventScope } from '../execution/events.js';
import { reportedStepStatuses } from '../structs/debug.js';
import { getErrorInfo } from '../errors.js';
import { coreEventCatalog } from './catalog.js';
import { payloadSnapshot } from './sub-flow.js';
import { breakWhile } from '../utils/rules.js';
import type {
  DiagnosticContext,
  CoreEventName,
  CoreEventPayloads,
  CoreEvent,
  DiagnosticSpanFields,
  CreateDiagnosticsOptions,
} from '../structs/diagnostics.js';
export * from '../structs/diagnostics.js';
export * from './catalog.js';
export { ReportedStepRecorder, ScopedReportedStepRecorder } from './sub-flow.js';
/** @deprecated Use the ReportedStepRecorder names. These aliases preserve constructor identity. */
export {
  ReportedStepRecorder as SubFlowLogger,
  ScopedReportedStepRecorder as ScopedSubFlowLogger,
} from './sub-flow.js';
export type * from '../structs/debug.js';
export { reportedStepStatusCatalog, reportedStepStatuses } from '../structs/debug.js';

/**
 * Configure the optional log consumer of the shared execution fact source.
 *
 * @param options.output Log consumer. Without it, events are still observable but not persisted.
 * @param options.observe Live observer applied to this scope and every child scope.
 * @param options.runId Run identity; a random id is generated when omitted.
 * @param options.spanId Root span id; defaults to `run`.
 * @returns A diagnostic context whose children share the run, sequence and consumers.
 */
export function createDiagnostics(options: CreateDiagnosticsOptions = {}): DiagnosticContext {
  return createEventScope(options);
}
/**
 * Convert a thrown value into a plain record suitable as a log payload.
 *
 * @param error Any thrown value. Non-Errors are reported as `NonError` with their string form
 *   and no issue details.
 * @returns A record with name, message, stack, code, issues and whatever boundary metadata was
 *   recorded. It never throws: an uninspectable value becomes `UninspectableError`.
 */
export function diagnosticError(error: unknown): Record<string, unknown> {
  const info = getErrorInfo(error);
  let detail: Record<string, unknown>;
  try {
    if (!(error instanceof Error)) return { name: 'NonError', message: String(error) };
    const { name, message, stack, code } = error as Error & { code?: unknown };
    detail = {
      name,
      message,
      stack,
      code: code ?? (info.code === 'UNKNOWN_ERROR' ? undefined : info.code),
    };
  } catch {
    detail = {
      name: 'UninspectableError',
      message: 'Error details unavailable',
      code: info.code === 'UNKNOWN_ERROR' ? undefined : info.code,
    };
  }
  return {
    ...detail,
    issues: info.issues,
    ...(info.stageId === undefined ? {} : { stageId: info.stageId }),
    ...(info.isRetryable === undefined ? {} : { isRetryable: info.isRetryable }),
  };
}

/**
 * Validate a persisted diagnostic record and return a detached copy.
 *
 * Persisted data is untrusted, so the envelope version, event type, identity, ordering and the
 * bounded sub-step shape are checked; the payload itself is not interpreted. The copy is deep
 * cloned, so a store cannot hand back a record that later shares structure with the caller.
 *
 * @param input Candidate record, typically parsed JSON from a log store.
 * @returns A normalized record with `subSteps`, `subStepsDropped` and `subStepsTruncated`
 *   defaulted.
 * @throws TypeError when the envelope, identity, node role or reported steps are invalid.
 * @throws RangeError when a reported payload is too large or too deeply nested.
 */
export function normalizeDiagnosticEvent(
  input: unknown,
): import('../structs/diagnostics.js').CoreDiagnosticRecord {
  if (!input || typeof input !== 'object') throw new TypeError('Invalid diagnostic record');
  const raw = input as Record<string, unknown>;
  // The version gates the whole layout: an older record may use different fields, so it is
  // rejected instead of best-effort coerced.
  if (raw.version !== 2) throw new TypeError('Unsupported diagnostic version');
  const { type, producerSequence, occurredAtMs } = raw;
  if (
    typeof type !== 'string' ||
    !Object.hasOwn(coreEventCatalog, type) ||
    typeof raw.runId !== 'string' ||
    !raw.runId ||
    typeof raw.spanId !== 'string' ||
    !raw.spanId ||
    !Number.isSafeInteger(producerSequence) ||
    Number(producerSequence) < 1 ||
    typeof occurredAtMs !== 'number' ||
    !Number.isFinite(occurredAtMs) ||
    !Object.hasOwn(raw, 'payload')
  )
    throw new TypeError('Invalid diagnostic envelope');
  const { eventId } = raw;
  if (typeof eventId !== 'string' || !eventId)
    throw new TypeError('Invalid diagnostic event identity');
  const steps = raw.subSteps ?? [];
  // The count and size bounds match what the sub-flow logger enforces, so a record produced by
  // Core can never be rejected here; only hand-edited or foreign records can.
  if (
    !Array.isArray(steps) ||
    steps.length > 1024 ||
    new Set(steps.map((step) => step?.stepId)).size !== steps.length ||
    steps.some(
      (step) =>
        !step ||
        step.origin !== 'reported' ||
        typeof step.stepId !== 'string' ||
        !step.stepId.trim() ||
        typeof step.name !== 'string' ||
        typeof step.kind !== 'string' ||
        !Number.isSafeInteger(step.sequence) ||
        step.sequence < 1 ||
        (step.status !== undefined && !reportedStepStatuses.includes(step.status)) ||
        [
          'type',
          'subnodeId',
          'parentStepId',
          'relatedDefinitionId',
          'relatedInvocationId',
          'caseId',
          'summary',
        ].some((key) => step[key] !== undefined && typeof step[key] !== 'string') ||
        (step.usedModel !== undefined && typeof step.usedModel !== 'boolean') ||
        (step.revision !== undefined &&
          (!Number.isSafeInteger(step.revision) ||
            step.revision < 1 ||
            !Number.isFinite(step.createdAtMs))) ||
        ['createdAtMs', 'startedAtMs', 'endedAtMs'].some(
          (key) =>
            step[key] !== undefined &&
            (typeof step[key] !== 'number' || !Number.isFinite(step[key]) || step[key] < 0),
        ) ||
        (step.nextStepIds !== undefined &&
          (!Array.isArray(step.nextStepIds) ||
            step.nextStepIds.some((id: unknown) => typeof id !== 'string'))),
    ) ||
    (raw.subStepsDropped !== undefined &&
      (!Number.isSafeInteger(raw.subStepsDropped) || Number(raw.subStepsDropped) < 0)) ||
    (raw.subStepsTruncated !== undefined && typeof raw.subStepsTruncated !== 'boolean')
  )
    throw new TypeError('Invalid reported diagnostic steps');
  const originals = new Map<
    string,
    { revision: number; subnodeId?: string; type?: string; relatedInvocationId?: string }
  >();
  let lastSequence = 0;
  for (const step of steps) {
    if (step.operation === undefined) continue; // Historical projected snapshots remain readable.
    breakWhile(
      !['write', 'fix'].includes(step.operation) || step.sequence <= lastSequence,
      () => new TypeError('Invalid sub-flow record order'),
    );
    lastSequence = step.sequence;
    if (step.operation === 'write') {
      breakWhile(
        step.targetStepId !== undefined || step.revision !== 1,
        () => new TypeError('Invalid sub-flow write record'),
      );
      originals.set(step.stepId, {
        revision: 1,
        subnodeId: step.subnodeId,
        type: step.type,
        relatedInvocationId: step.relatedInvocationId,
      });
    } else {
      const previous = originals.get(step.targetStepId);
      breakWhile(
        previous === undefined ||
          step.revision !== previous.revision + 1 ||
          step.subnodeId !== previous.subnodeId ||
          step.type !== previous.type ||
          step.relatedInvocationId !== previous.relatedInvocationId,
        () => new TypeError('Invalid sub-flow fix reference'),
      );
      originals.set(step.targetStepId, {
        revision: step.revision,
        subnodeId: step.subnodeId,
        type: step.type,
        relatedInvocationId: step.relatedInvocationId,
      });
    }
  }
  // Structural check only: the returned snapshot is discarded because the clone below already
  // produces the detached copy kept by the normalized record.
  for (const step of steps) if (step.payload !== undefined) payloadSnapshot(step.payload);
  breakWhile(
    JSON.stringify(steps).length > 65536,
    () => new TypeError('Reported diagnostic steps exceed the size limit'),
  );
  breakWhile(
    raw.usedModel !== undefined && typeof raw.usedModel !== 'boolean',
    () => new TypeError('Invalid reported model use'),
  );
  if (type === 'node.progress') {
    const progress = (raw.payload as CoreEventPayloads['node.progress'])?.subStep;
    breakWhile(
      progress !== undefined &&
        (!progress ||
          !['write', 'fix'].includes(progress.operation) ||
          ['type', 'subnodeId', 'relatedInvocationId'].some(
            (key) =>
              progress[key as 'type' | 'subnodeId' | 'relatedInvocationId'] !== undefined &&
              typeof progress[key as 'type' | 'subnodeId' | 'relatedInvocationId'] !== 'string',
          ) ||
          typeof progress.stepId !== 'string' ||
          !progress.stepId ||
          (progress.targetStepId !== undefined &&
            (progress.operation !== 'fix' ||
              typeof progress.targetStepId !== 'string' ||
              !progress.targetStepId)) ||
          !Number.isSafeInteger(progress.sequence) ||
          progress.sequence < 1 ||
          !Number.isSafeInteger(progress.revision) ||
          progress.revision < 1 ||
          !Number.isFinite(progress.createdAtMs) ||
          progress.createdAtMs < 0 ||
          !reportedStepStatuses.includes(progress.status) ||
          (progress.usedModel !== undefined && typeof progress.usedModel !== 'boolean')),
      () => new TypeError('Invalid reported sub-step progress'),
    );
  }
  for (const key of [
    'parentSpanId',
    'invocationId',
    'parentInvocationId',
    'workflowInvocationId',
    'workflowNodeId',
    'agentId',
    'branchId',
    'agentVersionId',
    'parentBranchId',
    'parentAgentVersionId',
    'forkPointId',
    'definitionId',
    'definitionKind',
    'definitionRevision',
    'nodeId',
    'nodeName',
    'nodeKind',
    'nodeDescription',
    'stageId',
    'modelId',
  ]) {
    if (raw[key] !== undefined && typeof raw[key] !== 'string')
      throw new TypeError('Invalid diagnostic identity');
  }
  if (
    raw.nodeRole !== undefined &&
    !['workflow-node', 'workflow-boundary', 'invocation', 'loop-step'].includes(
      String(raw.nodeRole),
    )
  )
    throw new TypeError('Invalid diagnostic node role');
  // Detached copy: the caller's object may be reused, frozen or backed by a store buffer.
  const copy = structuredClone(raw);
  return {
    ...copy,
    version: 2,
    eventId,
    type,
    producerSequence,
    occurredAtMs,
    subSteps: copy.subSteps ?? [],
    subStepsDropped: copy.subStepsDropped ?? 0,
    subStepsTruncated: copy.subStepsTruncated ?? false,
  } as import('../structs/diagnostics.js').CoreDiagnosticRecord;
}

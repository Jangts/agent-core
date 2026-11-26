/** Read-side projection of captured workflow facts; never dispatches or reconstructs topology. */
import { normalizeDiagnosticEvent } from '../diagnostics/index.js';
import type { WorkflowEvent } from '../structs/execution/workflow.js';
import type {
  WorkflowRunTrace,
  WorkflowNodeVisit,
  WorkflowTransitionRecord,
  WorkflowRunTraceSource,
  WorkflowReportedStepRecord,
} from '../structs/execution/workflow-views.js';
import type { ReportedStepValue } from '../structs/debug.js';
import { freezeView } from './workflow-graph.js';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type Visit = Mutable<Omit<WorkflowNodeVisit, 'events' | 'subflow'>> & {
  events: WorkflowNodeVisit['events'][number][];
  subflow: WorkflowReportedStepRecord[];
};
const lifecycleTypes = new Set(['enter', 'transition', 'complete', 'error']);

/** Aggregate main visits by span and keep raw subflow records in their own append order. */
export function projectWorkflowRunTrace(
  workflowId: string,
  runId: string,
  input: Awaited<ReturnType<WorkflowRunTraceSource>>,
): WorkflowRunTrace {
  const coverage = structuredClone(input.coverage);
  const issues = [...coverage.issues];
  const issue = (code: string, spanId?: string, eventId?: string) =>
    issues.push({ code, spanId, eventId });
  const events = input.events
    .map(normalizeDiagnosticEvent)
    .filter((e) => e.runId === runId)
    .sort((a, b) => a.producerSequence - b.producerSequence);
  const visits = new Map<string, Visit>();
  const ledgers = new Map<string, Map<string, WorkflowReportedStepRecord>>();
  const transitions: WorkflowTransitionRecord[] = [];
  const seen = new Map<string, string>();
  for (const raw of events) {
    const payload =
      raw.payload && typeof raw.payload === 'object'
        ? (raw.payload as Record<string, unknown>)
        : {};
    const candidate = payload.event;
    const fact =
      raw.type === 'workflow.event' && candidate && typeof candidate === 'object'
        ? (candidate as WorkflowEvent)
        : undefined;
    const belongs =
      fact?.workflowId === workflowId ||
      (raw.nodeRole === 'workflow-node' && raw.definitionId === workflowId);
    if (!belongs || (raw.nodeRole !== undefined && raw.nodeRole !== 'workflow-node')) continue;
    if (raw.type === 'workflow.event' && !fact) {
      issue('invalid-workflow-event', raw.spanId, raw.eventId);
      continue;
    }
    const identity = JSON.stringify(raw);
    if (seen.has(raw.eventId)) {
      if (seen.get(raw.eventId) !== identity) issue('conflicting-event', raw.spanId, raw.eventId);
      continue;
    }
    seen.set(raw.eventId, identity);
    if (
      fact &&
      (!lifecycleTypes.has(fact.type) ||
        fact.eventId !== raw.eventId ||
        fact.workflowId !== workflowId ||
        (raw.workflowInvocationId !== undefined &&
          fact.workflowInvocationId !== raw.workflowInvocationId) ||
        [
          'targetSpanId',
          'targetNodeId',
          'routeId',
          'conditionId',
          'errorCode',
          'errorEventId',
        ].some((key) => {
          const value = fact[key as keyof WorkflowEvent];
          return value !== undefined && typeof value !== 'string';
        }) ||
        (fact.route !== undefined && (!Number.isSafeInteger(fact.route) || fact.route < 0)) ||
        (fact.durationMs !== undefined &&
          (!Number.isFinite(fact.durationMs) || fact.durationMs < 0)) ||
        !Number.isSafeInteger(fact.roundIndex) ||
        typeof fact.workflowInvocationId !== 'string' ||
        fact.nodeId !== raw.nodeId ||
        (fact.spanId !== undefined && fact.spanId !== raw.spanId) ||
        (fact.runId !== undefined && fact.runId !== runId))
    ) {
      issue('invalid-workflow-event', raw.spanId, raw.eventId);
      continue;
    }
    if (!raw.nodeId) {
      issue('missing-node-id', raw.spanId, raw.eventId);
      continue;
    }
    let visit = visits.get(raw.spanId);
    if (!visit) {
      visit = {
        spanId: raw.spanId,
        nodeId: raw.nodeId,
        workflowInvocationId: raw.workflowInvocationId ?? fact?.workflowInvocationId,
        definitionRevision: raw.definitionRevision,
        name: raw.nodeName,
        description: raw.nodeDescription,
        kind: raw.nodeKind,
        roundIndex: fact?.roundIndex,
        firstEventSequence: raw.producerSequence,
        lastEventSequence: raw.producerSequence,
        status: 'unknown',
        events: [],
        subflow: [],
      };
      visits.set(raw.spanId, visit);
      ledgers.set(raw.spanId, new Map());
    }
    if (
      visit.nodeId !== raw.nodeId ||
      visit.workflowInvocationId !== (raw.workflowInvocationId ?? fact?.workflowInvocationId)
    ) {
      issue('conflicting-span', raw.spanId, raw.eventId);
      continue;
    }
    visit.lastEventSequence = raw.producerSequence;
    if (raw.usedModel !== undefined) visit.usedModel = raw.usedModel;
    if (raw.subStepsDropped || raw.subStepsTruncated)
      issue('subflow-truncated', raw.spanId, raw.eventId);
    const ledger = ledgers.get(raw.spanId)!;
    // Normalization always supplies a ledger, including for historical envelopes.
    for (const step of raw.subSteps) {
      const previous = ledger.get(step.stepId);
      if (!previous) ledger.set(step.stepId, structuredClone(step));
      else if (
        JSON.stringify({ ...previous, sourceEventId: undefined, producerSequence: undefined }) !==
        JSON.stringify(step)
      )
        issue('conflicting-subflow', raw.spanId, raw.eventId);
    }
    // Normalization rejects progress without a valid step id and sequence.
    const progress = payload.subStep as
      Omit<WorkflowReportedStepRecord, 'origin' | 'sourceEventId' | 'producerSequence'> | undefined;
    if (raw.type === 'node.progress' && progress) {
      const record = ledger.get(progress.stepId);
      if (record) {
        ledger.set(record.stepId, {
          ...record,
          sourceEventId: raw.eventId,
          producerSequence: raw.producerSequence,
        });
      } else {
        ledger.set(progress.stepId, {
          ...structuredClone(progress),
          origin: 'reported',
          sourceEventId: raw.eventId,
          producerSequence: raw.producerSequence,
        });
      }
      continue;
    }
    if (fact || raw.type === 'node.progress') {
      visit.events.push({
        eventId: raw.eventId,
        producerSequence: raw.producerSequence,
        occurredAtMs: raw.occurredAtMs,
        type: fact?.type ?? 'progress',
        phase: fact?.phase,
        routeId: fact?.routeId,
        conditionId: fact?.conditionId,
        errorCode: fact?.errorCode,
        errorEventId: fact?.errorEventId,
        payload: payload.payload as ReportedStepValue | undefined,
      });
    }
    if (!fact) continue;
    visit.roundIndex ??= fact.roundIndex;
    if (fact.type === 'enter') {
      visit.enteredAtMs = raw.occurredAtMs;
      visit.status = 'running';
    }
    if (fact.type === 'error')
      visit.status =
        fact.errorCode === 'CANCELLED' || fact.errorCode === 'TIMEOUT' ? 'cancelled' : 'error';
    if (fact.type !== 'enter') {
      visit.endedAtMs = raw.occurredAtMs;
      visit.durationMs = fact.durationMs;
      if (fact.type !== 'error' && visit.status !== 'error' && visit.status !== 'cancelled')
        visit.status = 'success';
    }
    if (
      fact.type === 'transition' ||
      fact.type === 'complete' ||
      (fact.type === 'error' && fact.targetNodeId !== undefined)
    )
      transitions.push({
        eventId: raw.eventId,
        producerSequence: raw.producerSequence,
        occurredAtMs: raw.occurredAtMs,
        type: fact.type === 'complete' ? 'complete' : 'transition',
        sourceSpanId: raw.spanId,
        targetSpanId: fact.targetSpanId,
        targetNodeId: fact.targetNodeId,
        routeOrder: fact.route,
        routeId: fact.routeId,
        conditionId: fact.conditionId,
        errorEventId: fact.type === 'error' ? raw.eventId : fact.errorEventId,
      });
  }
  if (!visits.size) throw new RangeError(`No captured workflow visits: ${workflowId} / ${runId}`);
  for (const visit of visits.values()) {
    visit.subflow = [...ledgers.get(visit.spanId)!.values()].sort(
      (a, b) => a.sequence - b.sequence,
    );
    if (visit.enteredAtMs === undefined) issue('missing-enter', visit.spanId);
    if (visit.endedAtMs === undefined && coverage.complete === true) {
      visit.status = 'unknown';
      issue('missing-exit', visit.spanId);
    }
    for (const step of visit.subflow)
      if (
        step.operation === undefined ||
        step.revision === undefined ||
        step.createdAtMs === undefined
      )
        issue('historical-subflow-fields', visit.spanId);
  }
  for (const edge of transitions)
    if (edge.targetSpanId && !visits.has(edge.targetSpanId))
      issue('missing-target-enter', edge.targetSpanId, edge.eventId);
  return freezeView({
    schemaVersion: 1,
    workflowId,
    runId,
    nodes: [...visits.values()],
    transitions,
    coverage: { ...coverage, complete: issues.length ? false : coverage.complete, issues },
  });
}

/** @deprecated Use `projectWorkflowRunTrace`. Kept as a 0.9 compatibility alias. */
export { projectWorkflowRunTrace as projectWorkflowChain };

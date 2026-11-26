/**
 * Diagnostic event fact source for the execution loop.
 *
 * One `DiagnosticContext` tree serves both live observers and the optional persistent log.
 * Facts are built once, then each consumer receives its own copy — full content only when
 * that consumer asked for content, otherwise a metadata projection. No consumer means no
 * payload work and no sub-step capture.
 *
 * Exports: `createEventScope` and `executionEvents`.
 */
import { captureReportedStepSnapshot } from '../diagnostics/sub-flow.js';
import type { DebugStepsOutput } from '../structs/debug.js';
import { invocationId } from '../utils/invocation.js';
import { getErrorInfo } from '../errors.js';
import { coreEventCatalog } from '../diagnostics/catalog.js';
import type {
  DiagnosticContext,
  CoreEventName,
  CoreEventPayloads,
  CoreEvent,
  DiagnosticSpanFields,
  CreateDiagnosticsOptions,
} from '../structs/diagnostics.js';
import type { ExecutionObserver } from '../structs/execution/events.js';

// Binding method snapshots must preserve the observer's subscription identity.
const observerSources = new WeakMap<ExecutionObserver, ExecutionObserver>();

/** Internal binding helper shared by Engine configuration and inherited event scopes. */
export function snapshotExecutionObserver(source: ExecutionObserver): ExecutionObserver {
  const snapshot = {
    accepts: source.accepts?.bind(source),
    event: source.event.bind(source),
  };
  observerSources.set(snapshot, observerSources.get(source) ?? source);
  return snapshot;
}

/**
 * Create the root diagnostic scope.
 *
 * @param options - Sink, observer, run id and initial span id.
 * @returns The root scope; child scopes inherit its consumers.
 */
export function createEventScope(options: CreateDiagnosticsOptions = {}): DiagnosticContext {
  const { output, observe } = options;
  const write = output?.write.bind(output);
  const accepts = output?.accepts?.bind(output);
  const runId = options.runId || invocationId();
  const spanId = options.spanId ?? 'run';
  // Shared by every child scope so `producerSequence` orders facts across the whole run.
  let sequence = 0;
  const observer = (source: import('../structs/execution/events.js').ExecutionObserver) => ({
    source: observerSources.get(source) ?? source,
    accepts: source.accepts?.bind(source),
    event: source.event.bind(source),
  });
  type Listener = ReturnType<typeof observer>;
  const initial = observe ? [observer(observe)] : [];
  const context = (
    span: string,
    parent?: string,
    fields: DiagnosticSpanFields = {},
    listeners: readonly Listener[] = initial,
  ): DiagnosticContext => {
    const identity = Object.freeze({
      ...fields,
      runId,
      spanId: span,
      ...(parent ? { parentSpanId: parent } : {}),
    });
    // A missing accepts hook means the sink takes everything except an explicit refusal.
    const logEnabled = (event: CoreEventName, content: 'metadata' | 'content'): boolean => {
      if (!write) return false;
      try {
        return accepts?.({ event, content }) !== false;
      } catch {
        return false;
      }
    };
    // Listeners default to metadata-only; content requires an explicit opt-in.
    const listenerEnabled = (
      listener: Listener,
      event: CoreEventName,
      content: 'metadata' | 'content',
    ): boolean => {
      try {
        return listener.accepts
          ? listener.accepts({ ...identity, event, content }) === true
          : content === 'metadata';
      } catch {
        return false;
      }
    };
    const fact = <K extends CoreEventName>(
      event: K,
      payload: () => CoreEventPayloads[K],
      debug?: DebugStepsOutput,
    ): CoreEvent => {
      const value = payload();
      const reported = captureReportedStepSnapshot(
        scope.enabled(event, 'content') ? debug?.recordedSubSteps : undefined,
        identity,
      );
      return {
        ...identity,
        ...reported,
        ...(typeof debug?.usedModel === 'boolean' ? { usedModel: debug.usedModel } : {}),
        version: 2,
        eventId:
          event === 'workflow.event'
            ? (value as CoreEventPayloads['workflow.event']).event.eventId
            : event === 'loop.event'
              ? (value as CoreEventPayloads['loop.event']).eventId
              : invocationId(),
        type: event,
        producerSequence: ++sequence,
        occurredAtMs: Date.now(),
        payload: value,
      } as CoreEvent;
    };
    const publish = (record: CoreEvent): void => {
      const event = record.type,
        kind = coreEventCatalog[event];
      if (logEnabled(event, kind)) {
        try {
          const pending = write?.(eventSnapshot(record, logEnabled(event, 'content')));
          if (pending) void Promise.resolve(pending).catch(() => {});
        } catch {}
      }
      for (const listener of listeners) {
        if (!listenerEnabled(listener, event, kind)) continue;
        try {
          const copy = eventSnapshot(record, listenerEnabled(listener, event, 'content'));
          if (copy.type === 'workflow.event') Object.freeze(copy.payload.event);
          const pending = listener.event(Object.freeze(copy));
          if (pending) void Promise.resolve(pending).catch(() => {});
        } catch {}
      }
    };
    const scope: DiagnosticContext = {
      identity,
      /** Whether any consumer would accept this event, optionally requiring content. */
      enabled(event, content) {
        if (!Object.hasOwn(coreEventCatalog, event)) return false;
        const kind = content === 'content' ? 'content' : coreEventCatalog[event];
        return (
          logEnabled(event, kind) ||
          listeners.some((listener) => listenerEnabled(listener, event, kind))
        );
      },
      /**
       * Build and publish a fact without waiting for anyone.
       *
       * Observation failures are swallowed so reporting cannot change execution.
       */
      emit<K extends CoreEventName>(
        event: K,
        payload: () => CoreEventPayloads[K],
        debug?: DebugStepsOutput,
      ) {
        if (!this.enabled(event)) return;
        try {
          publish(fact(event, payload, debug));
        } catch {
          /* Observation must not change execution. */
        }
      },
      /**
       * Publish a fact and then hand a copy of it to a delivery sink.
       *
       * Publication comes first so observers retain causal order even if the sink stalls.
       */
      async deliver(event, payload, sink) {
        const record = fact(event, payload);
        publish(record);
        await sink(eventSnapshot(record) as never);
      },
      /**
       * Derive a child span.
       *
       * A child that starts its own invocation records the parent invocation, which keeps
       * a request-scoped trace navigable without modelling the whole call tree.
       */
      child: (id, childFields = {}) =>
        context(
          `${span}/${id}`,
          span,
          {
            ...fields,
            ...(childFields.invocationId &&
            childFields.invocationId !== fields.invocationId &&
            fields.invocationId
              ? { parentInvocationId: fields.invocationId }
              : {}),
            ...childFields,
          },
          listeners,
        ),
      /** Reusing a request observer must not subscribe it twice through Runner and Engine. */
      withObserver: (source) =>
        listeners.some((listener) => listener.source === (observerSources.get(source) ?? source))
          ? scope
          : context(span, parent, fields, [...listeners, observer(source)]),
    };
    return scope;
  };
  return context(spanId);
}

/**
 * Metadata projections shared by live observers and log consumers.
 *
 * Only events listed here are reduced; an unlisted event passes its full payload to a
 * metadata-only consumer, so any event added to the catalog must also be added here when
 * its payload contains content.
 */
const metadataProjections: Partial<{
  [K in CoreEventName]: (payload: CoreEventPayloads[K]) => CoreEventPayloads[K];
}> = {
  'node.progress': ({ subStep, reportError }) => ({
    ...(subStep ? { subStep } : {}),
    ...(reportError ? { reportError } : {}),
  }),
  'workflow.event': ({ event }) => ({ event }),
  'tool.call': ({ toolId, invocationId }) => ({ toolId, invocationId }),
  'tool.result': ({ toolId, invocationId, status, durationMs, errorCode }) => ({
    toolId,
    invocationId,
    status,
    durationMs,
    errorCode,
  }),
  'model.parsed': ({ stageId, callSequence }) => ({ stageId, callSequence }),
  'model.end': ({ stageId, state, receivedParts }) => ({ stageId, state, receivedParts }),
  'runtime.rejected': ({ stageId, error }) => ({
    stageId,
    error: { code: getErrorInfo(error).code },
  }),
  'rule.result': ({ tags, error }) => ({ tags, error: { code: getErrorInfo(error).code } }),
};
/**
 * Reduce a payload to its metadata projection.
 *
 * @param type - Event type.
 * @param payload - Full payload built for the fact.
 * @returns The projected payload, or the original when no projection is declared.
 */
function metadataPayload<K extends CoreEventName>(
  type: K,
  payload: CoreEventPayloads[K],
): CoreEventPayloads[K] {
  return metadataProjections[type]?.(payload) ?? payload;
}

/**
 * Copy one record for a single consumer.
 *
 * Every consumer gets its own copy so one listener cannot observe another's mutations.
 * A content-free copy is used when requested, and if the full record cannot be cloned the
 * metadata-only record is used instead, since observation must never fail the caller.
 *
 * @param record - Fact to copy.
 * @param content - Whether to keep payload content.
 * @returns A structured clone of either the full record or its metadata projection.
 */
function eventSnapshot(record: CoreEvent, content = true): CoreEvent {
  const metadata = () => ({
    ...record,
    subSteps: [],
    subStepsDropped: 0,
    subStepsTruncated: false,
    payload: metadataPayload(record.type, record.payload),
  });
  try {
    return structuredClone(content ? record : metadata()) as CoreEvent;
  } catch {
    return structuredClone(metadata()) as CoreEvent;
  }
}

/**
 * Resolve the diagnostic scope for one execution.
 *
 * An observer forces a scope to exist even when the host installed none; the observer is
 * attached to the existing scope instead of replacing it, so log and live observation
 * share one fact identity and one sequence.
 *
 * @param options - Execution options carrying a scope and/or an observer.
 * @returns The scope to use, or undefined when the host observes nothing.
 */
export function executionEvents(
  options?: import('../structs/common.js').ExecutionOptions,
): DiagnosticContext | undefined {
  const { diagnostics, observe } = options ?? {};
  return observe ? (diagnostics ?? createEventScope()).withObserver(observe) : diagnostics;
}

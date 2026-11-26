/**
 * Reflection Kit: adapt an App-owned execution log reader into an authorized reflection source.
 *
 * Place in the package: part of the `reflection` Kit. It projects metadata only — no payloads,
 * text, file paths or replay — and remembers which runs a caller discovered, so a guessed run
 * cannot be read in a later call.
 *
 * Exports: `defineReflectionLogSource`, `ReflectionLogReader`.
 */
import { breakWhile } from '../utils/rules.js';
import type { ReflectionSource, ReflectionEvidence } from '../structs/kits/reflection.js';
import type { OperationContext, MaybePromise } from '../structs/common.js';
import { reflectionIdentityFields } from '../structs/kits/reflection.js';
import { awaitAssertion, awaitWithSignal } from '../utils/cancellation.js';
interface Page<T> {
  items: T[];
  status: string;
  cursor?: string;
  issues: { code: string }[];
  issuesOmitted: number;
  coverage: { exhausted: boolean; captureIncomplete?: boolean };
}
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const eventMetrics = {
  'model.end': (payload: Record<string, unknown>) => object(payload.state),
  'workflow.event': (payload: Record<string, unknown>) => object(payload.event),
} satisfies Record<string, (payload: Record<string, unknown>) => Record<string, unknown>>;
const workflowStatuses: Readonly<Record<string, string>> = {
  enter: 'running',
  transition: 'running',
  continue: 'running',
  complete: 'success',
  error: 'error',
};
const cancellationCodes = new Set(['CANCELLED', 'TIMEOUT', 'CALL_TIMEOUT', 'ROUND_TIMEOUT']);
/**
 * Structural port: the App supplies its own FileLogReader, trusted scope and current
 * authorization.
 */
export interface ReflectionLogReader {
  /**
   * List runs the caller may inspect.
   *
   * @param query - Optional trace filter, pagination cursor, page limit and abort signal.
   * @returns A page of runs with their file path and manifest.
   */
  listRuns(query: {
    traceId?: string;
    cursor?: string;
    limit?: number;
    signal?: AbortSignal;
  }): Promise<Page<{ path: string; manifest: Readonly<Record<string, unknown>> }>>;
  /**
   * Read the events of one run.
   *
   * @param query - Run id, optional source/type filters, pagination cursor, limit and signal.
   * @returns A page of raw event records.
   */
  readEvents(query: {
    run: string;
    sources?: readonly ('app' | 'core' | 'client')[];
    types?: readonly string[];
    cursor?: string;
    limit?: number;
    signal?: AbortSignal;
  }): Promise<Page<Record<string, unknown>>>;
}

/**
 * Build a reflection source over a log reader.
 *
 * Coverage is reported as `best-effort`: a page is only `complete` when the reader exhausted the
 * run without capture gaps or omitted issues, and every gap or issue code is surfaced instead of
 * being silently dropped.
 *
 * @param options - Reader, source id, optional fixed trace id and the authorization hook.
 * @returns A frozen source whose `query` returns reflection evidence.
 * @throws A configured or authorization error for a malformed page, an expired run or event, or
 *   a run that this source has not discovered yet; `TypeError` when authorization returns a value.
 */
export function defineReflectionLogSource<App>(options: {
  reader: ReflectionLogReader;
  id: string;
  traceId?: string;
  authorize(context: OperationContext<App>): MaybePromise<void>;
}): ReflectionSource<App> {
  const reader = options.reader,
    traceId = options.traceId,
    authorize = options.authorize.bind(options),
    allowed = new Map<string, number>();
  const checkAuthorization = (context: OperationContext<App>) =>
    awaitAssertion(
      () => authorize(context),
      context.signal,
      'Reflection log authorization must return void',
    );
  const coverage = (page: Page<unknown>) => ({
    consistency: 'best-effort' as const,
    complete:
      page.coverage.exhausted &&
      !page.coverage.captureIncomplete &&
      !page.issues.length &&
      !page.issuesOmitted,
    gaps: [
      ...new Set([
        ...(page.status === 'end' ? [] : [page.status]),
        ...page.issues.map((item) => item.code),
        ...(page.issuesOmitted ? ['issues omitted'] : []),
        ...(page.coverage.captureIncomplete ? ['capture incomplete'] : []),
      ]),
    ].slice(0, 32),
  });
  return Object.freeze<ReflectionSource<App>>({
    id: options.id,
    description:
      'Explicitly authorized execution metadata; no payloads, text, file paths or replay.',
    authorize: (_query, context) => checkAuthorization(context),
    async query(query, context) {
      await checkAuthorization(context);
      if (!query.run) {
        const page = await awaitWithSignal(
          reader.listRuns({
            traceId,
            cursor: query.cursor,
            limit: query.limit,
            signal: context.signal,
          }),
          context.signal,
        );
        context.signal.throwIfAborted();
        const items = page.items.map(({ path, manifest }): ReflectionEvidence => {
          const expiresAtMs = Number(manifest.expiresAt);
          breakWhile(
            !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now(),
            'Log evidence expired',
          );
          return {
            id: `run:${String(manifest.runId)}`,
            runId: path,
            type: 'run',
            expiresAtMs,
            ...(typeof manifest.outcome === 'string' ? { status: manifest.outcome } : {}),
          };
        });
        const result = { items, cursor: page.cursor, coverage: coverage(page) };
        context.signal.throwIfAborted();
        // A rejected discovery page must not grant access to a partial result.
        for (const item of items) allowed.set(item.runId, item.expiresAtMs!);
        return result;
      }
      const expiresAtMs = allowed.get(query.run);
      breakWhile(
        !expiresAtMs || expiresAtMs <= Date.now(),
        'Run was not discovered in this authorized review',
      );
      const page = await awaitWithSignal(
        reader.readEvents({
          run: query.run,
          sources: ['core'],
          types: query.types,
          cursor: query.cursor,
          limit: query.limit,
          signal: context.signal,
        }),
        context.signal,
      );
      context.signal.throwIfAborted();
      breakWhile(expiresAtMs! <= Date.now(), 'Log evidence expired');
      const items = page.items.map((event): ReflectionEvidence => {
        const state = object(event.payload),
          type = String(event.type ?? event.event);
        const select = Object.hasOwn(eventMetrics, type)
          ? eventMetrics[type as keyof typeof eventMetrics]
          : undefined;
        const metrics = select ? select(state) : state;
        const item: Record<string, unknown> = {
          id: `${String(event.runId)}:${String(event.sequence)}`,
          runId: query.run,
          type: event.type ?? event.event,
          sequence: event.sequence,
          expiresAtMs,
        };
        for (const key of reflectionIdentityFields)
          if (typeof event[key] === 'string') item[key] = event[key];
        if (typeof event.occurredAtMs === 'number') item.occurredAtMs = event.occurredAtMs;
        for (const key of ['stageId', 'status', 'code'] as const) {
          const value = metrics[key] ?? state[key] ?? event[key];
          if (typeof value === 'string') item[key] = value;
        }
        const code =
          metrics.errorCode ??
          state.errorCode ??
          (Array.isArray(metrics.codes) ? metrics.codes[0] : undefined) ??
          object(metrics.error).code;
        if (typeof code === 'string') item.code = code;
        if (
          (type === 'workflow.event' || type === 'loop.event') &&
          typeof metrics.type === 'string' &&
          Object.hasOwn(workflowStatuses, metrics.type)
        ) {
          item.status =
            metrics.type === 'error' && typeof code === 'string' && cancellationCodes.has(code)
              ? 'cancelled'
              : workflowStatuses[metrics.type];
        }
        for (const key of ['durationMs', 'inputChars', 'outputChars', 'calls'] as const)
          if (typeof metrics[key] === 'number') item[key] = metrics[key];
        return item as unknown as ReflectionEvidence;
      });
      return { items, cursor: page.cursor, coverage: coverage(page) };
    },
  });
}

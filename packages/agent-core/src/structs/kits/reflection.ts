/**
 * Reflection contract for the Reflection Kit.
 *
 * Place in the package: an optional App-side diagnostic agent that inspects recorded execution
 * evidence and answers a question about it. It reads metadata through an App-provided source, never
 * the original event payloads, and reports what the evidence supports rather than asserting facts
 * Core cannot prove. Reports are request-local and never persisted here.
 *
 * Exports: `reflectionIdentityFields`, `ReflectionEvidence`, `ReflectionQuery`, `ReflectionPage`,
 * `ReflectionSource`, `reflectionFindingKinds`, `ReflectionFinding`, `ReflectionReport`,
 * `ReflectionDefinition`, `ReflectionTask`.
 */
import type { ModelRunner } from '../../model/runner.js';
import type { OperationContext, MaybePromise } from '../common.js';
import type { ToolDefinition } from '../support/tools.js';
import type { DiagnosticIdentity } from '../diagnostics.js';

/** Identity fields an evidence item may project from the original diagnostic identity. */
export const reflectionIdentityFields = Object.freeze([
  'spanId',
  'parentSpanId',
  'invocationId',
  'parentInvocationId',
  'agentId',
  'branchId',
  'agentVersionId',
  'parentBranchId',
  'parentAgentVersionId',
  'forkPointId',
  'workflowInvocationId',
  'workflowNodeId',
  'nodeRole',
  'definitionId',
] as const);

/** Explicit metadata projection, not an arbitrary original event/payload. */
export interface ReflectionEvidence extends Partial<
  Pick<DiagnosticIdentity, (typeof reflectionIdentityFields)[number]>
> {
  /** Evidence id cited by findings when they rely on this item. */
  readonly id: string;
  /** Run the item belongs to; queries are scoped by run. */
  readonly runId: string;
  /** Evidence type, matched against `ReflectionQuery.types`. */
  readonly type: string;
  readonly occurredAtMs?: number;
  /** Ordering key inside the source; ascending. */
  readonly sequence?: number;
  readonly stageId?: string;
  readonly status?: string;
  /** Error or protocol code recorded on the item. */
  readonly code?: string;
  /** Model or tool calls represented by the item. */
  readonly calls?: number;
  readonly durationMs?: number;
  readonly inputChars?: number;
  readonly outputChars?: number;
  /** Instant after which the item is no longer retained by the source. */
  readonly expiresAtMs?: number;
}

/** One evidence query. */
export interface ReflectionQuery {
  /** Run to inspect; omitted means the App chooses the scope. */
  readonly run?: string;
  /** Evidence types to include; omitted means all types. */
  readonly types?: readonly string[];
  /** Opaque continuation cursor from a previous page. */
  readonly cursor?: string;
  /** Maximum items requested; at least 1, clamped to the remaining evidence budget. */
  readonly limit: number;
}

/** One page of evidence plus an honest statement of its coverage. */
export interface ReflectionPage {
  /** Items in source order. */
  readonly items: readonly ReflectionEvidence[];
  /** Continuation cursor; absent when the source has no further items. */
  readonly cursor?: string;
  readonly coverage: {
    /** `best-effort` may miss items; `snapshot` reflects one consistent point in time. */
    readonly consistency: 'best-effort' | 'snapshot';
    /** `true` complete, `false` known incomplete, `null` unknown. */
    readonly complete: boolean | null;
    /** Human-readable descriptions of known gaps. */
    readonly gaps: readonly string[];
  };
}

/** App-owned evidence source, including its own authorization. */
export interface ReflectionSource<App> {
  readonly id: string;
  readonly description: string;
  /** Guards one query; runs before any evidence is read. */
  authorize(query: ReflectionQuery, context: OperationContext<App>): MaybePromise<void>;
  /** Returns one page; an invalid page shape aborts the reflection. */
  query(query: ReflectionQuery, context: OperationContext<App>): Promise<ReflectionPage>;
}

/** Allowed finding kinds, from observed facts to advisory conclusions. */
export const reflectionFindingKinds = ['observed', 'hypothesis', 'recommendation'] as const;

/** One finding, always tied to the evidence it rests on. */
export interface ReflectionFinding {
  /** `observed` must cite evidence; `hypothesis` and `recommendation` are advisory. */
  readonly kind: (typeof reflectionFindingKinds)[number];
  /** What the reflection claims. */
  readonly claim: string;
  /** Evidence ids supporting the claim. */
  readonly evidenceIds: readonly string[];
}

/** Request-local reflection result. */
export interface ReflectionReport {
  readonly id: string;
  /** `incomplete` when evidence, model budget or the timeout stopped the work early. */
  readonly status: 'completed' | 'incomplete';
  /** Question as submitted; at most 2000 characters. */
  readonly question: string;
  readonly findings: readonly ReflectionFinding[];
  /** Known limitations, for example exhausted budgets or incomplete coverage. */
  readonly limitations: readonly string[];
  /** Evidence items the reflection actually saw. */
  readonly evidence: readonly ReflectionEvidence[];
  /** Coverage statement of each page that was read. */
  readonly coverage: readonly ReflectionPage['coverage'][];
  readonly createdAtMs: number;
  readonly expiresAtMs?: number;
  /** Marker: a report is returned to the caller and never stored by the Kit. */
  readonly persisted: false;
}

/** Configuration for compiling a reflection task. */
export interface ReflectionDefinition<App> {
  /** Parent runner; the reflection creates a child and preserves the parent's reserve. */
  readonly model: Pick<ModelRunner, 'createChild' | 'remainingCalls'> &
    Partial<Pick<ModelRunner, 'bind'>>;
  /** Evidence source queried through the reflection tools. */
  readonly source: ReflectionSource<App>;
  /** Additional tools exposed to the reflection model. */
  readonly tools?: readonly ToolDefinition<any, any, App>[];
  /** Model calls the child may use; defaults to 4. */
  readonly maxCalls?: number;
  /** Parent calls kept untouched; defaults to 1. */
  readonly reserveCalls?: number;
  /** Wall-clock limit for the whole reflection in milliseconds; defaults to 30000. */
  readonly timeoutMs?: number;
  /** Maximum evidence pages read; defaults to 4. */
  readonly maxPages?: number;
  /** Maximum evidence items collected; defaults to 64. */
  readonly maxEvents?: number;
  /** Maximum evidence characters placed in the model context; defaults to 12000. */
  readonly maxEvidenceChars?: number;
  /** Guards one reflection request; runs before any model call. */
  authorize(question: string, context: OperationContext<App>): MaybePromise<void>;
}
/** Compiled reflection task. */
export interface ReflectionTask<App> {
  /** Answers the question from evidence; never throws for incomplete evidence alone. */
  run(question: string, context: OperationContext<App>): Promise<ReflectionReport>;
}

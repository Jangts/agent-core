/**
 * Reported execution detail supplied by App nodes, tools and explicitly instrumented Core/Kit boundaries.
 *
 * The data here is optional reported evidence, never proof of complete execution, authorization or
 * external side-effect confirmation, and it is collected only through the diagnostic context that owns the
 * current node visit. The status catalog below is the single source of truth for legal reported
 * statuses, their terminal flag and the transitions that `fix` may apply.
 *
 * Exports: `reportedStepStatusCatalog`, `reportedStepStatuses`, `ReportedStepStatus`,
 * `ReportedStep`, `ReportedStepValue`, `ReportedStepRecord`, `ReportedStepInput`, `ReportedStepUpdate`,
 * `ReportedStepRecorder`, `NodeReportingContext`, `ReportedStepProgress`, `DebugStepsOutput`.
 */

/**
 * Legal self-reported step statuses and their transitions.
 *
 * `terminal: true` means the step is finished and its status can no longer change; `next` lists the
 * statuses a later `fix` may assign to a non-terminal step.
 */
export const reportedStepStatusCatalog = {
  /** No status reported yet; only `fix` uses this as an intermediate state. */
  unknown: {
    terminal: false,
    next: ['unknown', 'planned', 'running', 'success', 'error', 'cancelled', 'skipped'],
  },
  /** Declared by the node but not started. */
  planned: {
    terminal: false,
    next: ['planned', 'running', 'success', 'error', 'cancelled', 'skipped'],
  },
  /** Started and still active; may only stay running or finish. */
  running: { terminal: false, next: ['running', 'success', 'error', 'cancelled'] },
  success: { terminal: true, next: [] },
  error: { terminal: true, next: [] },
  cancelled: { terminal: true, next: [] },
  skipped: { terminal: true, next: [] },
} as const;
/** Frozen list of reported statuses in catalog order, used for membership validation. */
export const reportedStepStatuses = Object.freeze(
  Object.keys(reportedStepStatusCatalog),
) as readonly (keyof typeof reportedStepStatusCatalog)[];
/** A status a node may report; derived from the catalog, never declared separately. */
export type ReportedStepStatus = keyof typeof reportedStepStatusCatalog;
/** One step as reported by a node; fields beyond identity are optional detail. */
export interface ReportedStep {
  /** App-defined business log type; never a write/fix operation enum. */
  readonly type?: string;
  /** Logical subnode grouping within this node visit; independent of individual log ids. */
  readonly subnodeId?: string;
  /** Log record identity, unique within one node visit; not a subnode id. */
  readonly stepId: string;
  /** Reported parent step, forming a tree; absent for a top-level step. */
  readonly parentStepId?: string;
  /** Self-reported reference only; never a workflow dispatch identity. */
  readonly relatedDefinitionId?: string;
  /** Real model/tool invocation identity, kept separate from the node-local subnode id. */
  readonly relatedInvocationId?: string;
  /** Short reported label. */
  readonly name: string;
  /** Reported step kind (for example a tool or model call); free-form and node-owned. */
  readonly kind: string;
  /** Reported lifecycle status; omission means the node did not report one. */
  readonly status?: ReportedStepStatus;
  /** This step's own reported model use, never a descendant rollup. */
  readonly usedModel?: boolean;
  /** Reported start instant in epoch milliseconds. */
  readonly startedAtMs?: number;
  /** Reported end instant in epoch milliseconds; only meaningful for terminal statuses. */
  readonly endedAtMs?: number;
  /** Reported successor step ids, for display only. */
  readonly nextStepIds?: readonly string[];
  /** Reported case or variant id, interpreted by the App. */
  readonly caseId?: string;
  /** Reported one-line summary. */
  readonly summary?: string;
}
/** JSON-like value accepted in reported payloads; depth and size are bounded by the recorder. */
export type ReportedStepValue =
  | null
  | boolean
  | number
  | string
  | readonly ReportedStepValue[]
  | { readonly [key: string]: ReportedStepValue };
/** A step already accepted by a logger, carrying recorder-assigned bookkeeping fields. */
export interface ReportedStepRecord extends ReportedStep {
  /** Historical marker: only self-reported steps are recorded. */
  readonly origin: 'reported';
  /** Append-only logging operation, separate from the App-owned business type. */
  readonly operation?: 'write' | 'fix';
  /** Original write record revised by this fix; fixes have their own stepId. */
  readonly targetStepId?: string;
  /** One-based append order within the node visit, including every fix. */
  readonly sequence: number;
  /** Optional only for historical records produced before the logger contract. */
  readonly createdAtMs?: number;
  /** Revision number, incremented by each accepted `fix`. */
  readonly revision?: number;
  /** Reported payload; the recorder snapshots it and bounds the total size. */
  readonly payload?: Readonly<Record<string, ReportedStepValue>>;
}
/** Input accepted by `write`; the logger assigns the step id and sequence. */
export interface ReportedStepInput extends Omit<ReportedStep, 'stepId' | 'kind'> {
  /** Optional family classification; defaults to the custom type when omitted. */
  readonly kind?: string;
  readonly payload?: Readonly<Record<string, ReportedStepValue>>;
}
/** Scoped writes cannot supply or override the identity bound by their delegate. */
export type ScopedReportedStepInput = Omit<ReportedStepInput, 'subnodeId'>;

/** Explicit revision whitelist: identity, grouping and business type are never patchable. */
export interface ReportedStepUpdate {
  readonly status?: ReportedStepStatus;
  readonly usedModel?: boolean;
  readonly startedAtMs?: number;
  readonly endedAtMs?: number;
  readonly summary?: string;
  readonly nextStepIds?: readonly string[];
  /** Fill missing result fields; existing facts cannot be replaced. */
  readonly payload?: Readonly<Record<string, ReportedStepValue>>;
}
/** Common read/write surface for both independently implemented logger classes. */
export interface ReportedStepLog {
  write(input: ScopedReportedStepInput): string | -1;
  fix(stepId: string | -1, patch: ReportedStepUpdate): boolean;
  /** Both logger classes return the same complete immutable ledger. */
  readAll(): readonly Readonly<ReportedStepRecord>[];
}
/** Nominal classes: only the full logger is accepted by native invocation requests. */
export type { ReportedStepRecorder, ScopedReportedStepRecorder } from '../diagnostics/sub-flow.js';
import type { ReportedStepRecorder } from '../diagnostics/sub-flow.js';
/** Reporting surface handed to a node or tool for the duration of one visit. */
export interface NodeReportingContext {
  /** Reports progress for the active node; Core supplies the execution identity. */
  report(update: import('./execution/workflow.js').WorkflowNodeReport): void;
  /** Bound to this context and owned by runtime; repeated calls in one visit return the same instance. */
  /** @deprecated Use the runtime createStepRecorder method. */
  createSubFlowLogger(): ReportedStepRecorder;
}
/** Compact progress notification emitted for each accepted sub-step write or fix. */
export interface ReportedStepProgress {
  readonly relatedInvocationId?: string;
  readonly operation: 'write' | 'fix';
  readonly type?: string;
  readonly subnodeId?: string;
  /** Original write record when this operation is a fix. */
  readonly targetStepId?: string;
  /** Unique id of this append-only record. */
  readonly stepId: string;
  /** Append sequence of this record within the node visit, including every fix. */
  readonly sequence: number;
  /** Revision after the operation; `write` starts at 1. */
  readonly revision: number;
  /** Instant the progress fact was recorded, in epoch milliseconds. */
  readonly createdAtMs: number;
  /** Status after the operation. */
  readonly status: ReportedStepStatus;
  /** Reported model use after the operation, when the node stated it. */
  readonly usedModel?: boolean;
}
/** Debug material a handler contributes to a diagnostic event. */
export interface DebugStepsOutput {
  /** Model use reported by this handler; omitted when unknown. */
  readonly usedModel?: boolean;
  /** Runtime-owned immutable snapshot, committed when a logger writes or fixes a step. */
  readonly recordedSubSteps?: readonly Readonly<ReportedStepRecord>[];
}

/** @deprecated Use `ReportedStepValue`. Kept as a 0.9 compatibility alias. */
export type { ReportedStepValue as SubFlowValue };

/** @deprecated Use `ReportedStepRecord`. Kept as a 0.9 compatibility alias. */
export type { ReportedStepRecord as RecordedSubStep };

/** @deprecated Use `ReportedStepInput`. Kept as a 0.9 compatibility alias. */
export type { ReportedStepInput as SubFlowStepInput };

/** @deprecated Use `ScopedReportedStepInput`. Kept as a 0.9 compatibility alias. */
export type { ScopedReportedStepInput as ScopedSubFlowStepInput };

/** @deprecated Use `ReportedStepUpdate`. Kept as a 0.9 compatibility alias. */
export type { ReportedStepUpdate as SubFlowStepFix };

/** @deprecated Use `ReportedStepLog`. Kept as a 0.9 compatibility alias. */
export type { ReportedStepLog as SubFlowLog };

/** @deprecated Use `ReportedStepProgress`. Kept as a 0.9 compatibility alias. */
export type { ReportedStepProgress as SubStepProgress };

/** Reporting context produced by Core; legacy user implementations remain assignable to NodeReportingContext. */
export interface RuntimeNodeReportingContext extends NodeReportingContext {
  createStepRecorder(): ReportedStepRecorder;
}

/** @deprecated Use ReportedStepRecorder. */
export type {
  ReportedStepRecorder as SubFlowLogger,
  ScopedReportedStepRecorder as ScopedSubFlowLogger,
} from '../diagnostics/sub-flow.js';

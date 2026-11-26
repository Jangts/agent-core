/** Serializable topology and observed execution contracts; layout belongs to consumers. */
import type { CoreDiagnosticRecord } from '../diagnostics.js';
import type { ReportedStepRecord, ReportedStepValue } from '../debug.js';
import type { WorkflowEvent } from './workflow.js';

/** Pure registered topology; routes sharing a target share an edge within one kind. */
export interface WorkflowGraph {
  readonly schemaVersion: 1;
  readonly workflowId: string;
  readonly revision?: string;
  readonly entryNodeId: string;
  readonly nodes: readonly WorkflowGraphNode[];
  readonly edges: readonly WorkflowGraphEdge[];
}
/** Node metadata and derived incident edges, without executable callbacks. */
export interface WorkflowGraphNode {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly order: number;
  readonly startsRound: boolean;
  readonly requires: readonly string[];
  readonly provides: readonly string[];
  readonly routes: readonly WorkflowGraphRoute[];
  readonly incomingEdgeIds: readonly string[];
  readonly outgoingEdgeIds: readonly string[];
}
/** Declaration order is retained even when multiple routes share a topology edge. */
export interface WorkflowGraphRoute {
  readonly order: number;
  readonly routeId?: string;
  readonly description?: string;
  readonly conditional: boolean;
  readonly conditionId?: string;
  readonly edgeId: string;
}
/** Completion has no target node; recovery edges remain distinct from normal edges. */
export interface WorkflowGraphEdge {
  readonly id: string;
  readonly kind: 'transition' | 'error' | 'complete';
  readonly sourceNodeId: string;
  readonly targetNodeId?: string;
  readonly routeOrders: readonly number[];
  readonly errorRouteId?: string;
}
/** Capture completeness is independent of whether diagnostic content was included. */
export interface WorkflowRunTraceCoverage {
  readonly complete: boolean | 'unknown';
  readonly content: 'included' | 'omitted' | 'mixed' | 'unknown';
  readonly issues: readonly {
    readonly code: string;
    readonly spanId?: string;
    readonly eventId?: string;
    readonly count?: number;
  }[];
}
/** App resolves authorization, retention, pagination and storage paths before returning. */
export type WorkflowRunTraceSource = (runId: string) => Promise<{
  readonly events: readonly CoreDiagnosticRecord[];
  readonly coverage: WorkflowRunTraceCoverage;
}>;
/** Observed visits, never merged by static node id or synthesized from adjacency. */
export interface WorkflowRunTrace {
  readonly schemaVersion: 1;
  readonly workflowId: string;
  readonly runId: string;
  readonly nodes: readonly WorkflowNodeVisit[];
  readonly transitions: readonly WorkflowTransitionRecord[];
  readonly coverage: WorkflowRunTraceCoverage;
}
/** Historical subflow snapshots may omit recorder fields or descriptive content. */
export type WorkflowReportedStepRecord = Omit<ReportedStepRecord, 'name' | 'kind'> & {
  readonly name?: string;
  readonly kind?: string;
  readonly sourceEventId?: string;
  readonly producerSequence?: number;
};
/** A single node visit, with flat ordered subflow records including every independent fix. */
export interface WorkflowNodeVisit {
  readonly spanId: string;
  readonly nodeId: string;
  readonly workflowInvocationId?: string;
  readonly definitionRevision?: string;
  readonly name?: string;
  readonly description?: string;
  readonly kind?: string;
  readonly roundIndex?: number;
  readonly firstEventSequence: number;
  readonly lastEventSequence: number;
  readonly enteredAtMs?: number;
  readonly endedAtMs?: number;
  readonly durationMs?: number;
  readonly status: 'running' | 'success' | 'error' | 'cancelled' | 'unknown';
  readonly usedModel?: boolean;
  readonly events: readonly WorkflowNodeVisitEvent[];
  readonly subflow: readonly WorkflowReportedStepRecord[];
}
/** Node-local lifecycle facts; payload remains subject to the source's content policy. */
export interface WorkflowNodeVisitEvent {
  readonly eventId: string;
  readonly producerSequence: number;
  readonly occurredAtMs: number;
  readonly type: WorkflowEvent['type'] | 'progress';
  readonly phase?: WorkflowEvent['phase'];
  readonly routeId?: string;
  readonly conditionId?: string;
  readonly errorCode?: string;
  readonly errorEventId?: string;
  readonly payload?: ReportedStepValue;
}
/** Actual handoff evidence; a target span does not prove its enter event was captured. */
export interface WorkflowTransitionRecord {
  readonly eventId: string;
  readonly producerSequence: number;
  readonly occurredAtMs: number;
  readonly type: 'transition' | 'complete';
  readonly sourceSpanId: string;
  readonly targetSpanId?: string;
  readonly targetNodeId?: string;
  readonly routeOrder?: number;
  readonly routeId?: string;
  readonly conditionId?: string;
  readonly errorEventId?: string;
}

/** @deprecated Use `WorkflowRunTraceCoverage`. Kept as a 0.9 compatibility alias. */
export type { WorkflowRunTraceCoverage as WorkflowChainCoverage };

/** @deprecated Use `WorkflowRunTraceSource`. Kept as a 0.9 compatibility alias. */
export type { WorkflowRunTraceSource as WorkflowChainSource };

/** @deprecated Use `WorkflowRunTrace`. Kept as a 0.9 compatibility alias. */
export type { WorkflowRunTrace as WorkflowChain };

/** @deprecated Use `WorkflowNodeVisit`. Kept as a 0.9 compatibility alias. */
export type { WorkflowNodeVisit as WorkflowChainNode };

/** @deprecated Use `WorkflowNodeVisitEvent`. Kept as a 0.9 compatibility alias. */
export type { WorkflowNodeVisitEvent as WorkflowChainNodeEvent };

/** @deprecated Use `WorkflowTransitionRecord`. Kept as a 0.9 compatibility alias. */
export type { WorkflowTransitionRecord as WorkflowChainTransition };

/** @deprecated Use `WorkflowReportedStepRecord`. Kept as a 0.9 compatibility alias. */
export type { WorkflowReportedStepRecord as WorkflowSubflowRecord };

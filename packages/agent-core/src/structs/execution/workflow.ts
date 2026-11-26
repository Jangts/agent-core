import type { ModelRunnerBudgetSnapshot } from '../model/runtime.js';
import type { WorkflowRunTraceSource } from './workflow-views.js';
/**
 * Workflow contract: a state graph whose nodes report their own use of model and tools.
 *
 * A definition declares nodes, ordered routes and an optional result predicate. The engine walks
 * the graph, validates `requires`/`provides`, applies route order and records one `WorkflowEvent`
 * per decision. All declarations here are metadata; execution stays in the engine so Core remains
 * the only place that owns round budgets, cancellation and state commits.
 *
 * Exports: `WorkflowContext`, `WorkflowRoute`, `WorkflowNodeReport`, `WorkflowNode`,
 * `AgentWorkflowDefinition`, `WorkflowEvent`, `WorkflowFailure`, `WorkflowExtension`,
 * `WorkflowModel`.
 */
import type { CacheContext } from './cache.js';
import type { MaybePromise, OperationContext } from '../common.js';
import type { DiagnosticContext } from '../diagnostics.js';
import type { ModelInteractionDefinition } from '../model/runtime.js';
import type { RuntimeNodeReportingContext } from '../debug.js';
/** Model request for a workflow: diagnostics arrive through the node context, never per call. */
type WorkflowModelRequest<Transport> = import('../model/runtime.js').ModelCallRequest<Transport> & {
  readonly diagnostics?: never;
  readonly modelId?: string;
};

/** Execution facts available to every node of a running workflow. */
export interface WorkflowContext<Runtime = undefined>
  extends OperationContext<Runtime>, RuntimeNodeReportingContext, CacheContext {
  /** Zero-based bounded round; phases within a round do not consume another round. */
  readonly roundIndex: number;
  /** Report progress while this node is active; Core supplies its execution identity. */
  report(update: WorkflowNodeReport): void;
  /** Diagnostic scope of this node visit, when recording is enabled. */
  readonly diagnostics?: DiagnosticContext;
  /** Model access limited by the workflow's configured calls and budget. */
  readonly model: WorkflowModel;
  readonly tools: {
    /** Per-call cancellation can shorten, never replace, the Workflow lifetime. */
    invoke(
      request: Omit<import('../capabilities/tools.js').ToolInvocationRequest, 'diagnostics'>,
    ): Promise<import('../invocation.js').ToolResult<unknown>>;
  };
  /** Failure that led into this node, present only while entering an `onErrorNodeId` target. */
  readonly error?: unknown;
  /** Event id of that failure, for correlation in host logs. */
  readonly errorEventId?: string;
}

/**
 * One route out of a node.
 *
 * Routes are evaluated in array order and the first match wins. A route either continues at
 * `targetNodeId` or completes the workflow through `complete`; declaring both is invalid.
 */
export type WorkflowRoute<State, Result, Runtime = undefined> = {
  /** Stable route id reported in events; required only when hosts need to audit the choice. */
  readonly id?: string;
  readonly description?: string;
  /** Stable condition id reported when this route was selected. */
  readonly conditionId?: string;
  /** Omission means unconditional selection at this position; otherwise must return boolean now. */
  readonly when?: (state: Readonly<State>, context: WorkflowContext<Runtime>) => boolean;
} & (
  | { readonly targetNodeId: string; readonly complete?: never }
  | {
      readonly targetNodeId?: never;
      readonly complete: (state: Readonly<State>, context: WorkflowContext<Runtime>) => Result;
    }
);

/** Detail an App node reports about its current visit. */
export interface WorkflowNodeReport {
  /** This visit's own use only; omitted means unknown. */
  readonly usedModel?: boolean;
  /** App-defined progress detail; collected only when content logging is enabled. */
  readonly payload?: unknown;
}

/** One node of the graph. */
export type WorkflowNode<State, Result, Runtime = undefined> = {
  /** Stable node id referenced by routes and error handling. */
  readonly id: string;
  /** Required explanation of what the node does; also used in diagnostics. */
  readonly description: string;
  /** Display name; defaults to `id` when omitted. */
  readonly name?: string;
  /** Optional application-reported detail, collected only when content logging is enabled. */
  readonly report?: (
    update: Readonly<Partial<State>> | void,
    context: RuntimeNodeReportingContext,
  ) => WorkflowNodeReport;
  /**
   * Reserves a fresh round on entry.
   *
   * Use it for steps that may legitimately repeat; entering such a node when the round budget is
   * exhausted fails with the configured exhausted error.
   */
  readonly startsRound?: boolean;
  /** Node entered when `run`/`provides`/`route` fails; contract errors always propagate instead. */
  readonly onErrorNodeId?: string;
  /** Route id reported with the recovery transition. */
  readonly onErrorRouteId?: string;
  /** State keys that must be present before this node runs; enforced by the engine. */
  readonly requires?: readonly (keyof State & string)[];
  /** State keys this node is expected to produce; validated after `run`. */
  readonly provides?: readonly (keyof State & string)[];
  /** Candidate successors, evaluated in order. A getter must be pure; registration reads it once. */
  readonly routes: readonly WorkflowRoute<State, Result, Runtime>[];
  /** Return only changed fields. Core commits them after cancellation and output checks. */
  readonly run?: (
    state: Readonly<State>,
    context: WorkflowContext<Runtime>,
  ) => void | Partial<State> | Promise<void | Partial<State>>;
};

/** The graph an engine executes. */
export type AgentWorkflowDefinition<State, Result, Runtime = undefined> = {
  /** Stable workflow id, also reported in every event. */
  readonly id: string;
  /** App-owned authorized diagnostic reader; no global run storage is installed. */
  readonly traceSource?: WorkflowRunTraceSource;
  /** @deprecated Use traceSource. Supplying both is rejected. */
  readonly chainSource?: WorkflowRunTraceSource;
  /** Definition revision; lets hosts distinguish executions of different graph versions. */
  readonly revision?: string;
  readonly nodes: readonly WorkflowNode<State, Result, Runtime>[];
  /** Synchronous result adjudicator; returning anything other than `true` is a contract error. */
  readonly isResult?: (result: Result) => boolean;
  /** First node to enter; defaults to the first declared node, which must start a round. */
  readonly entryNodeId?: string;
};

/** Metadata only: never includes state, prompt, parameters, results or raw errors. */
export interface WorkflowEvent {
  readonly eventId: string;
  /** Id of the failure that caused this transition, when recovering from an error. */
  readonly errorEventId?: string;
  readonly workflowId: string;
  readonly agentId?: string;
  readonly branchId?: string;
  readonly agentVersionId?: string;
  readonly parentBranchId?: string;
  readonly parentAgentVersionId?: string;
  readonly forkPointId?: string;
  readonly workflowInvocationId: string;
  /** Chosen successor span; absence of its enter event does not prove entry. */
  readonly targetSpanId?: string;
  readonly nodeId: string;
  readonly roundIndex: number;
  readonly targetNodeId?: string;
  readonly type: 'enter' | 'transition' | 'complete' | 'error';
  /** Elapsed milliseconds for the phase the event reports. */
  readonly durationMs?: number;
  /** Zero-based index of the selected route in `node.routes`. */
  readonly route?: number;
  /** Id of the selected route, when it declared one. */
  readonly routeId?: string;
  /** Id of the selected condition, when the route declared one. */
  readonly conditionId?: string;
  /** Logical phase that produced the event. */
  readonly phase?: 'boundary' | 'requires' | 'run' | 'provides' | 'route' | 'complete' | 'result';
  /** Route that failed on `route`, `complete` or `result` phases. */
  readonly failedRouteId?: string;
  readonly runId?: string;
  readonly spanId?: string;
  readonly parentSpanId?: string;
  /** Error classification for `error` events. */
  readonly errorCode?: string;
}

/** Error retained only while entering a registered failure phase. */
export interface WorkflowFailure {
  error: unknown;
  errorEventId?: string;
}

/** Additional nodes and routes merged into an existing definition. */
export interface WorkflowExtension<State, Result, App> {
  /** Nodes appended to the definition; ids must not collide with existing nodes. */
  readonly nodes: readonly WorkflowNode<State, Result, App>[];
  /** Replacement route lists keyed by node id; other nodes keep their declared routes. */
  readonly routes?: Readonly<Record<string, readonly WorkflowRoute<State, Result, App>[]>>;
  /** Extension revision, recorded so mixed definitions remain auditable. */
  readonly revision?: string;
}

/**
 * Model and tool access for one workflow invocation.
 *
 * Every call is charged to the workflow's shared budget. Overloads select the transport: a prepared
 * call, the default plain-text transport, or one registered transport with its typed result.
 */
export interface WorkflowModel {
  invoke<Result>(
    request: WorkflowModelRequest<never> & {
      readonly prepared: import('../model/runtime.js').PreparedModelCall<Result>;
    },
  ): Promise<import('../invocation.js').ModelResult<Result>>;
  invoke(
    request: WorkflowModelRequest<never>,
  ): Promise<import('../invocation.js').ModelResult<string>>;
  invoke<Result>(
    request: WorkflowModelRequest<ModelInteractionDefinition<Result>> & {
      readonly interaction: ModelInteractionDefinition<Result>;
    },
  ): Promise<import('../invocation.js').ModelResult<Result>>;
  invoke<Result>(
    request: WorkflowModelRequest<ModelInteractionDefinition<Result>> & {
      readonly transport: ModelInteractionDefinition<Result>;
    },
  ): Promise<import('../invocation.js').ModelResult<Result>>;
  invoke(
    request: WorkflowModelRequest<string | ModelInteractionDefinition>,
  ): Promise<import('../invocation.js').ModelResult<unknown>>;
  prepare(
    request?: import('../model/runtime.js').ModelPrepareRequest<never> & {
      readonly modelId?: string;
    },
  ): import('../model/runtime.js').PreparedModelCall<string>;
  prepare<Result>(
    request: import('../model/runtime.js').ModelPrepareRequest<
      ModelInteractionDefinition<Result>
    > & {
      readonly interaction: ModelInteractionDefinition<Result>;
      readonly modelId?: string;
    },
  ): import('../model/runtime.js').PreparedModelCall<Result>;
  prepare<Result>(
    request: import('../model/runtime.js').ModelPrepareRequest<
      ModelInteractionDefinition<Result>
    > & {
      readonly transport: ModelInteractionDefinition<Result>;
      readonly modelId?: string;
    },
  ): import('../model/runtime.js').PreparedModelCall<Result>;
  prepare(
    request: import('../model/runtime.js').ModelPrepareRequest<
      string | ModelInteractionDefinition
    > & { readonly modelId?: string },
  ): import('../model/runtime.js').PreparedModelCall;
  /** Optional for custom structural runtimes; available with ModelRunner. */
  readonly callBudget?: ModelRunnerBudgetSnapshot;
  /** Host-controlled request adjustment; never grants ancestor capacity. */
  adjustCallBudget?(request: { limit: number; reason: string }): ModelRunnerBudgetSnapshot;
  /** Calls still available to this workflow after ancestor reservations. */
  readonly remainingCalls: number;
  /** Calls completed by this workflow's own runner. */
  readonly callCount: number;
  /** Calls consumed across this workflow and its descendants. */
  readonly totalCallCount: number;
}

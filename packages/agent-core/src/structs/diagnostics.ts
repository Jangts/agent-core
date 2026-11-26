/**
 * Diagnostic envelope, event catalog and recording context for agent-core.
 *
 * One execution fact is produced once; it may be observed live and, when enabled, projected into a
 * log sink. This module declares the names, payload shapes, identity fields and content classes
 * that both paths share, so a consumer never needs a parallel event description.
 *
 * Exports: `CoreEventPayloads`, `CoreEventName`, `CoreEventDescriptor`, `DiagnosticIdentity`,
 * `DiagnosticSpanFields`, `CoreEvent`, `CoreLogOutput`, `DiagnosticContext`,
 * `CreateDiagnosticsOptions`, `CoreDiagnosticRecord`.
 */
import type { DebugStepsOutput, ReportedStepRecord } from './debug.js';
import type { WorkflowEvent } from './execution/workflow.js';
import type { ModelCallTrace } from './model/runtime.js';
import type { ModelMessage } from './model/messages.js';

/** Payload of every Core event, keyed by event name. Fields are the event's own facts only. */
export interface CoreEventPayloads {
  /** Admission of a bounded protocol action; all fields are metadata only. */
  'model.lifecycle.start': {
    invocationId: string;
    action: string;
    operationRef?: string;
    calls: number;
    cleanup: boolean;
  };
  /** Local protocol action settled; remote generation status remains a separate fact. */
  'model.lifecycle.end': {
    invocationId: string;
    action: string;
    operationRef?: string;
    calls: number;
    cleanup: boolean;
    status: 'success' | 'error' | 'cancelled';
    durationMs: number;
    errorCode?: string;
  };
  /** One loop round transition raised by the engine. */
  'loop.event': import('./execution/engine.js').LoopEvent;
  /** Model binding selection and its per-phase timing; recorded around one model invocation. */
  'model.binding': {
    /** Configured model binding id. */
    modelId: string;
    /** Invocation the binding served. */
    invocationId: string;
    /** Phase outcome: `running` while active, otherwise terminal. */
    status: 'running' | 'success' | 'error' | 'cancelled';
    /** Lifecycle phase this fact belongs to. */
    phase: 'input' | 'invoke' | 'output';
    /** Elapsed milliseconds for the phase; absent while running. */
    durationMs?: number;
    /** Error classification when the phase failed. */
    errorCode?: string;
  };
  /** Snapshot of the prepared request, emitted before the provider is called. */
  'model.prepare': {
    stageId: string;
    /** Transport selected for the call. */
    transportId: string;
    /** Messages actually sent, after context assembly and budget checks. */
    messages: readonly ModelMessage[];
    /** Transport-specific request options; opaque to Core consumers. */
    options: unknown;
    /** Context measurement or projection attached by the caller. */
    context?: unknown;
  };
  /** One streamed model part, in arrival order. */
  'model.output': {
    stageId: string;
    /** Position of the call within its runner. */
    callSequence: number;
    /** Zero-based index of the part within the response. */
    partIndex: number;
    part: import('./model/messages.js').ModelPart;
  };
  /** Parsed output of a response, once the collector resolved it. */
  'model.parsed': { stageId: string; callSequence: number; value?: unknown };
  /** End of a model call, successful or not, with its accumulated trace. */
  'model.end': {
    stageId: string;
    state: Readonly<ModelCallTrace>;
    /** Failure that ended the call; absent on success. */
    error?: unknown;
    /** Number of parts actually received, for truncated-stream detection. */
    receivedParts: number;
  };
  /** A Core input or state condition rejected execution. */
  'runtime.rejected': { stageId?: string; error: unknown };
  /** Progress reported by an active workflow node. */
  'node.progress': {
    payload?: unknown;
    /** Sub-step delivery fact; separate from the node's own payload. */
    subStep?: import('./debug.js').ReportedStepProgress;
    /** Set when the node's report violated the reporting contract. */
    reportError?: 'INVALID_NODE_REPORT';
  };
  /** Start of one model call, emitted before any output part. */
  'model.start': { stageId: string; callSequence: number; transportId: string };
  /** Workflow lifecycle fact raised by the engine. */
  'workflow.event': { event: WorkflowEvent; payload?: unknown };
  /** A tool call was accepted for execution. */
  'tool.call': { toolId: string; invocationId: string; input?: unknown };
  /** A tool call settled, successfully or not. */
  'tool.result': {
    toolId: string;
    invocationId: string;
    value?: unknown;
    error?: unknown;
    errorCode?: string;
    status: import('./common.js').InvocationStatus;
    /** Elapsed milliseconds for the tool execution. */
    durationMs: number;
  };
  /** A declarative rule rejected processing, with its ownership tags. */
  'rule.result': { tags: readonly string[]; error: unknown };
}
/** Union of every Core event name; the key set of `CoreEventPayloads`. */
export type CoreEventName = keyof CoreEventPayloads;
/**
 * Event classification used when deciding whether a sink accepts an event.
 *
 * `metadata` events carry identity, timing and status only; `content` events may carry user,
 * model or tool content and therefore require an explicit acceptance decision.
 */
export interface CoreEventDescriptor {
  event: CoreEventName;
  content: 'metadata' | 'content';
}
/** Execution identity only: never message, account or HTTP identity. */
export interface DiagnosticIdentity {
  /** Root run id shared by every fact of one logical run. */
  readonly runId: string;
  /** Span that produced the fact. */
  readonly spanId: string;
  /** Enclosing span; absent for a root span. */
  readonly parentSpanId?: string;
  /** Invocation that produced the fact, when the fact belongs to one. */
  readonly invocationId?: string;
  /** Enclosing invocation, when one invocation triggers another. */
  readonly parentInvocationId?: string;
  /** Role the emitting span plays in the execution graph. */
  readonly nodeRole?: 'workflow-node' | 'workflow-boundary' | 'invocation' | 'loop-step';
  /** App-owned agent identity. */
  readonly agentId?: string;
  /** App-owned branch identity. */
  readonly branchId?: string;
  /** App-owned immutable version identity of the agent definition. */
  readonly agentVersionId?: string;
  /** Branch this branch was forked from, when applicable. */
  readonly parentBranchId?: string;
  /** Version of the parent branch at the fork point. */
  readonly parentAgentVersionId?: string;
  /** App-owned fork marker shared by the forked branch and its origin. */
  readonly forkPointId?: string;
  /** Workflow invocation the fact belongs to. */
  readonly workflowInvocationId?: string;
  /** Workflow node invocation the fact belongs to. */
  readonly workflowNodeId?: string;
  /** Kind of the workflow/agent definition that dispatched the node. */
  readonly definitionKind?: string;
  /** Id of that definition. */
  readonly definitionId?: string;
  /** Revision of that definition; distinguishes executions of different definition states. */
  readonly definitionRevision?: string;
  /** Node id inside the workflow. */
  readonly nodeId?: string;
  /** Human-readable node name. */
  readonly nodeName?: string;
  /** Node kind as declared by the App. */
  readonly nodeKind?: string;
  /** Optional node description for diagnostics display. */
  readonly nodeDescription?: string;
  /** Model stage that produced the fact. */
  readonly stageId?: string;
  /** Model binding used, when the fact concerns a model call. */
  readonly modelId?: string;
}
/** Identity fields a child span may override; the parent supplies run, span and parent span. */
export type DiagnosticSpanFields = Omit<DiagnosticIdentity, 'runId' | 'spanId' | 'parentSpanId'>;
/**
 * A recorded Core fact.
 *
 * Every variant carries the same envelope: a version marker, unique event id, producing span's
 * identity, a per-producer monotonic sequence, the occurrence instant and optional reported
 * sub-steps. `subStepsDropped`/`subStepsTruncated` state that reported detail was bounded.
 */
export type CoreEvent = {
  [K in CoreEventName]: DiagnosticIdentity & {
    /** Envelope version; consumers must reject anything else. */
    version: 2;
    /** Unique id of this fact, stable across observers and log writers. */
    eventId: string;
    /** Discriminator matching `payload`. */
    type: K;
    /** Monotonic counter owned by the producing scope; starts at 1 for each producer. */
    producerSequence: number;
    /** Instant the fact occurred, in epoch milliseconds. */
    occurredAtMs: number;
    /** Event-specific facts. */
    payload: CoreEventPayloads[K];
    /** Whether the reported step used a model; omitted when the producer did not state it. */
    usedModel?: boolean;
    /** Reported sub-steps attached to this fact, bounded and already validated. */
    subSteps: readonly ReportedStepRecord[];
    /** Number of reported sub-steps omitted by the recorder's bounds. */
    subStepsDropped: number;
    /** True when reported sub-steps were truncated, so the attached list is incomplete. */
    subStepsTruncated: boolean;
  };
}[CoreEventName];
/** Destination for recorded facts; implementations decide filtering and durability. */
export interface CoreLogOutput {
  /** Returns false to skip an event entirely; absent means accept every event. */
  accepts?(descriptor: CoreEventDescriptor): boolean;
  /** Persists one fact. Rejections propagate to the emitting call. */
  write(event: CoreEvent): void | Promise<void>;
}
/**
 * Recording scope bound to one execution identity.
 *
 * A child scope inherits the sink and observer of its parent; only identity changes.
 */
export interface DiagnosticContext {
  /** Identity of the current scope, when the scope is bound to an execution. */
  readonly identity?: Readonly<DiagnosticIdentity>;
  /** Cheap pre-check so callers can skip building expensive payloads. */
  enabled(event: CoreEventName, content?: 'metadata' | 'content'): boolean;
  /**
   * Records one fact.
   *
   * @param event - Event name; determines the payload type.
   * @param payload - Thunk invoked only when the event is enabled.
   * @param debug - Optional reported debug material attached to the fact.
   */
  emit<K extends CoreEventName>(
    event: K,
    payload: () => CoreEventPayloads[K],
    debug?: DebugStepsOutput,
  ): void;
  /** Ordered content delivery uses the same fact, while consumer failures propagate. */
  deliver<K extends CoreEventName>(
    event: K,
    payload: () => CoreEventPayloads[K],
    sink: (event: Extract<CoreEvent, { type: K }>) => void | Promise<void>,
  ): Promise<void>;
  /** Derives a child span; `fields` fills values the child knows but the parent does not. */
  child(spanId: string, fields?: Readonly<DiagnosticSpanFields>): DiagnosticContext;
  /** Bind live observation without changing the log destination or request identity. */
  withObserver(observer: import('./execution/events.js').ExecutionObserver): DiagnosticContext;
}

/** Options for creating a root diagnostic scope. */
export interface CreateDiagnosticsOptions {
  /** Log destination; omission disables persistence while observation can still work. */
  readonly output?: CoreLogOutput;
  /** Live observer of the same facts, independent of `output`. */
  readonly observe?: import('./execution/events.js').ExecutionObserver;
  /** Root run id; generated when omitted. */
  readonly runId?: string;
  /** Root span id; generated when omitted. */
  readonly spanId?: string;
}

/**
 * Persisted data is untrusted: normalization checks the current envelope, not arbitrary payloads.
 */
export interface CoreDiagnosticRecord extends DiagnosticIdentity {
  /** Envelope version this record was written with. */
  readonly version: 2;
  readonly eventId: string;
  readonly type: CoreEventName;
  /** Per-producer monotonic sequence; at least 1. */
  readonly producerSequence: number;
  readonly occurredAtMs: number;
  /** Unvalidated payload; only the envelope above is checked during normalization. */
  readonly payload: unknown;
  readonly usedModel?: boolean;
  readonly subSteps: readonly ReportedStepRecord[];
  readonly subStepsDropped: number;
  readonly subStepsTruncated: boolean;
}

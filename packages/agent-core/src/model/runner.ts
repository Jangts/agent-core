/**
 * Model runner: the single path from prepared input to a validated result.
 *
 * This module is the model-facing protocol boundary. It owns, in strict order:
 * cancellation, registration and budget checks, input measurement (characters, schema
 * and tokens), budget charging, streaming through the interaction's collector, then the
 * journal entry, call trace and terminal event. Nothing here knows business prompts,
 * stages or provider SDKs; those are registered by the App.
 *
 * Exports: `ModelRunner`, the re-exported `BudgetError`, and the runtime/config type
 * re-exports at the bottom of the file.
 */
import { resolveInteractionAlias } from './transports.js';
import { requireReportedStepRecorder } from '../diagnostics/sub-flow.js';
import { nativeSubFlowAsync } from '../diagnostics/native-sub-flow.js';
import type { DiagnosticContext } from '../structs/diagnostics.js';
import { executionEvents } from '../execution/events.js';
import { ModelCallBudget, parentModelBudget } from './call-budget.js';
import { synchronous } from '../utils/synchronous.js';
import { awaitWithSignal, combineSignals, isTimeoutReason } from '../utils/cancellation.js';
import { invocationId, invocationResult } from '../utils/invocation.js';
import type { ModelResult } from '../structs/invocation.js';
import { defaultTextInteraction, modelRunnerDefaults } from './defaults.js';
import { breakWhile } from '../utils/rules.js';
import {
  compiledModelBinding,
  modelBindingId,
  snapshotModelBinding,
  type ModelBinding,
} from './binding.js';
import { prepareModelInteraction, preparedInputSize } from './preparation.js';
import { getErrorInfo, recordErrorContext } from '../errors.js';
import { modelInputTokenLimit, countModelInput, enforceModelInputTokens } from './token-budget.js';
import { assembleContextPlan } from '../context/plan.js';
import type { ContextPlan } from '../structs/context/processing.js';
import { modelMessageDiagnostics } from './message-diagnostics.js';
import { validateContextBudget } from '../context/fragments.js';
import { createDiagnostics, diagnosticError } from '../diagnostics/index.js';
import { BudgetError, ValidationError } from '../structs/errors.js';
import { ContextJournal } from '../context/journal.js';
import type {
  ModelOutputEvent,
  ModelCallTrace,
  ModelRunnerPorts,
  ModelRuntimeConfig,
  ModelInteractionDefinition,
  ModelTokenBudget,
  ModelRunnerOptions,
  ModelCallRequest,
} from '../structs/model/runtime.js';
import type { BoundModelProvider } from '../structs/model/chat-provider.js';
import type { ModelMessage, ModelOptions } from '../structs/model/messages.js';
import type { BuiltContext } from '../structs/context/fragments.js';
import { commonPrefixLength } from '../utils/text.js';
import { snapshotModelOptions } from './options.js';
import { normalizeModelText, snapshotModelEvent } from './stream-event.js';
import { modelProtocolError } from '../utils/model-protocol.js';
import { abortableStream } from '@jangts/streaming/abortable-stream';

// A prepared call is single-use: it carries a snapshot that was measured and approved
// once, so replaying it would bypass the accounting that justified the first call.
interface PreparedCallState {
  readonly snapshot: import('../structs/model/runtime.js').PreparedModelCall;
  used: boolean;
}

// The runner fills one trace while the call progresses; the receipt it publishes stays readonly.
type CallTraceDraft = { -readonly [K in keyof ModelCallTrace]: ModelCallTrace[K] };

// A context plan has no `messages` key yet; a built context carries already assembled ones.
const isContextPlan = (
  input: readonly ModelMessage[] | BuiltContext | ContextPlan,
): input is ContextPlan => !Array.isArray(input) && !('messages' in input);
const isMessageArray = (
  input: readonly ModelMessage[] | BuiltContext | ContextPlan,
): input is readonly ModelMessage[] => Array.isArray(input);

/**
 * Validate a requested completion size.
 *
 * @param tokens - Requested output tokens.
 * @param stageId - Stage used for error context.
 * @throws TypeError When `tokens` is not a positive safe integer.
 */
function validateOutputTokens(tokens: number, stageId: string): void {
  breakWhile(
    !Number.isSafeInteger(tokens) || tokens < 1,
    () =>
      recordErrorContext(new TypeError('maxOutputTokens must be a positive safe integer'), {
        stageId,
        codes: ['MODEL_CONFIG'],
        isRetryable: false,
      }) as Error,
  );
}

export { BudgetError } from '../structs/errors.js';

/** Known protocol action names; caller content never becomes an event action. */
const lifecycleActions: readonly string[] = Object.freeze([
  'authorize',
  'submit',
  'query',
  'read',
  'cancel',
  'connect',
  'send',
  'close',
  'interrupt',
  'generate',
  'resource',
]);

/**
 * Execute registered model stages under one request's budgets and lifetime.
 *
 * Without constructor execution, each top-level call binds independent request state.
 * Explicit execution or bind(execution) retains one cumulative lifetime.
 * Invariants: at most one call is in flight per binding; `callCount` and `journal` are
 * local to the runner while `totalCallCount` includes descendants; every call is charged
 * to the shared budget before I/O and every failure is annotated with its stage before it
 * propagates. No business prompts, domain stages or provider SDKs are built into this
 * runner.
 */
export class ModelRunner<
  TransportId extends string = string,
  const Transports extends readonly ModelInteractionDefinition[] =
    readonly ModelInteractionDefinition[],
> {
  /** Configuration-only runners bind fresh state at each top-level execution. */
  private readonly boundExecution: boolean;
  private readonly binding: ModelBinding;
  private readonly sourceExecution?: import('../structs/common.js').ExecutionOptions;
  private readonly executionBindings = new WeakMap<object, ModelRunner<TransportId, Transports>>();
  private readonly preparedOwners = new WeakMap<object, ModelRunner<TransportId, Transports>>();
  /** Record of parsed results for this runner; descendants keep their own journals. */
  private readonly executionJournal = new ContextJournal();
  /** Request receipts; bind a shared Runner before reading execution state. */
  get journal(): ContextJournal {
    this.requireExecution();
    return this.executionJournal;
  }
  private completedCallCount = 0;
  private activeCall?: ModelCallTrace;
  /** Admitted attempts of this runner, including in-flight and failed calls. */
  get callCount(): number {
    this.requireExecution();
    return this.completedCallCount;
  }
  /** Detached copy of the most recent call trace, or undefined before the first call. */
  get lastCall(): Readonly<ModelCallTrace> | undefined {
    this.requireExecution();
    return this.activeCall ? Object.freeze(structuredClone(this.activeCall)) : undefined;
  }
  private readonly priorInputs = new Map<string, string>();
  private readonly tokenBudget?: ModelTokenBudget;
  private readonly registeredInteractions = new Map<ModelInteractionDefinition, string>();
  private readonly interactions = new Map<string, ModelInteractionDefinition>();

  private readonly preparedCalls = new WeakMap<object, PreparedCallState>();
  private readonly provider: BoundModelProvider;
  private readonly modelId?: string;
  private readonly config: ModelRuntimeConfig;
  private readonly executionSignal: AbortSignal;
  /** The selected request cancellation; a shared host has no implicit current request. */
  get signal(): AbortSignal {
    this.requireExecution();
    return this.executionSignal;
  }
  readonly execution: import('../structs/common.js').ExecutionContext;
  private readonly maxInputChars: number;
  private readonly maxOutputTokens: number;
  private readonly ports: ModelRunnerPorts;
  private budget: ModelCallBudget;
  private depth = 0;
  private inFlight = false;
  private requestGate: {
    active: number;
    cleanupActive?: number;
    children: number;
    limits: Readonly<Required<import('../structs/model/runtime.js').ModelChildPolicy>>;
  };
  /** Limits shared by every runner of one request; children only read them. */
  get childLimits(): Readonly<Required<import('../structs/model/runtime.js').ModelChildPolicy>> {
    return this.requestGate.limits;
  }

  /** Includes descendant attempts; local callCount and journal remain isolated. */
  get totalCallCount(): number {
    this.requireExecution();
    return this.budget.used;
  }

  /**
   * Create a fresh runner for a nested stage.
   *
   * The child never inherits conversation, journal or sinks: only the provider, fixed
   * limits, the parent budget and the child's own lifetime. All ancestors keep their
   * budgets, and the child is charged through them, so nested work cannot overspend.
   *
   * @param options - Child id, call allowance, reserved calls, timeout and optional signals.
   * @returns A runner sharing the request gate, with a budget derived from this one.
   * @throws Error When the depth or child capacity is exhausted, a call is in flight,
   * the settings are invalid, or the observer belongs to another run.
   */
  createChild(options: import('../structs/model/runtime.js').ModelChildOptions): ModelRunner {
    if (!this.boundExecution) {
      if (!options.execution) throw new TypeError('Bind execution before creating a model child');
      return this.bind(options.execution).createChildBound(options);
    }
    if (options.execution && options.execution !== this.sourceExecution)
      throw new TypeError('Bound model execution cannot be replaced');
    return this.createChildBound(options);
  }

  /** Child creation always consumes the selected execution budget and gate. */
  private createChildBound(
    options: import('../structs/model/runtime.js').ModelChildOptions,
  ): ModelRunner {
    breakWhile(
      this.depth >= this.requestGate.limits.maxDepth,
      'Nested model children exceed the request depth limit',
    );
    breakWhile(this.inFlight, 'Cannot create a child while this model call is active');
    breakWhile(
      this.requestGate.children >= this.requestGate.limits.maxChildren,
      'Model child capacity exhausted',
    );
    breakWhile(
      typeof options.id !== 'string' ||
        !options.id.trim() ||
        !Number.isSafeInteger(options.timeoutMs) ||
        options.timeoutMs < 1 ||
        options.timeoutMs > 2147483647,
      'Invalid child execution settings',
    );
    const budget = this.budget.child(options.maxCalls, options.reserveCalls);
    const diagnostics = options.diagnostics ?? this.ports.diagnostics;
    breakWhile(
      !!this.ports.diagnostics?.identity?.runId &&
        !!diagnostics?.identity?.runId &&
        this.ports.diagnostics.identity.runId !== diagnostics.identity.runId,
      'Child observation belongs to another run',
    );
    const childOptions = {
      provider: this.provider,
      [modelBindingId]: this.modelId,
      maxCalls: options.maxCalls,
      callTimeoutMs: this.config.callTimeoutMs,
      maxInputChars: this.maxInputChars,
      maxOutputChars: this.config.maxOutputChars,
      maxSchemaChars: this.ports.maxSchemaChars,
      maxOutputTokens: this.maxOutputTokens,
      tokenBudget: this.tokenBudget,
      usage: this.config.usage,
      interactions: resolveInteractionAlias(options.interactions, options.transports),
      children: this.requestGate.limits,
      execution: {
        signal: combineSignals(this.signal, AbortSignal.timeout(options.timeoutMs), options.signal),
        diagnostics: diagnostics?.child(invocationId(), {
          definitionKind: 'agent',
          definitionId: options.id,
        }),
      },
    };
    const child = new ModelRunner(childOptions);
    child.budget = budget;
    child.depth = this.depth + 1;
    this.requestGate.children++;
    child.requestGate = this.requestGate;
    return child;
  }

  /**
   * Build a runner from App options, or adopt an already compiled binding.
   *
   * Compiling here rather than per call is what makes configuration immutable for the
   * runner's lifetime. The text interaction is always registered first, then App
   * interactions in declaration order.
   *
   * @param options - Runner options; may carry a compiled binding and an inherited budget.
   * @throws TypeError When settings, child limits or an interaction are invalid.
   * @throws ValidationError When the token budget contract is incomplete.
   */
  constructor(options: ModelRunnerOptions<Transports>) {
    const resolved =
      (options as ModelRunnerOptions & { [compiledModelBinding]?: ModelBinding })[
        compiledModelBinding
      ] ?? snapshotModelBinding(options);
    if (
      options.execution !== undefined &&
      (!options.execution ||
        typeof options.execution !== 'object' ||
        Array.isArray(options.execution))
    )
      throw new TypeError('Execution options must be an object');
    this.sourceExecution = options.execution;
    this.binding = resolved;
    this.boundExecution =
      options.execution !== undefined ||
      (options as ModelRunnerOptions & { [parentModelBudget]?: ModelCallBudget })[
        parentModelBudget
      ] !== undefined;
    this.budget = new ModelCallBudget(
      resolved.config.maxCalls,
      (options as ModelRunnerOptions & { [parentModelBudget]?: ModelCallBudget })[
        parentModelBudget
      ],
      0,
      resolved.config.maxTotalCalls,
    );
    this.requestGate = { active: 0, children: 0, limits: resolved.children };
    this.provider = resolved.provider;
    this.modelId = (options as ModelRunnerOptions & { [modelBindingId]?: string })[modelBindingId];
    this.config = resolved.config;
    this.executionSignal = options.execution?.signal ?? new AbortController().signal;
    this.maxOutputTokens = resolved.maxOutputTokens;
    this.maxInputChars = resolved.maxInputChars;
    this.ports = Object.freeze({
      ...resolved.ports,
      diagnostics: this.boundExecution
        ? (executionEvents(options.execution) ??
          (resolved.ports.onOutput ? createDiagnostics() : undefined))
        : undefined,
    });
    this.execution = Object.freeze({
      signal: this.executionSignal,
      diagnostics: this.ports.diagnostics,
    });
    this.tokenBudget = resolved.tokenBudget;
    this.interactions.set(defaultTextInteraction.id, defaultTextInteraction);
    for (const { source, definition } of resolved.interactions) {
      this.registeredInteractions.set(source, definition.id);
      this.interactions.set(definition.id, definition);
    }
  }

  /**
   * Bind existing execution options to request-local state, reusing the same object identity.
   *
   * @param execution - Cancellation and observation for one request; omission creates a fresh one.
   * @returns A request-bound Runner; an already-bound receiver returns itself without new budget.
   * @throws TypeError When execution is not an object.
   */
  bind(
    execution: import('../structs/common.js').ExecutionOptions = {},
  ): ModelRunner<TransportId, Transports> {
    if (this.boundExecution) return this;
    if (!execution || typeof execution !== 'object' || Array.isArray(execution))
      throw new TypeError('Execution options must be an object');
    const prior = this.executionBindings.get(execution);
    if (prior) return prior;
    const owner = new ModelRunner<TransportId, Transports>({
      provider: this.provider,
      [compiledModelBinding]: this.binding,
      [modelBindingId]: this.modelId,
      execution,
    } as ModelRunnerOptions<Transports>);
    this.executionBindings.set(execution, owner);
    // Subclass hooks retain their real receiver, including private fields. The explicit execution
    // parameter carries the binding through super calls without ambient state or Node-only APIs.
    if (this.invoke !== ModelRunner.prototype.invoke)
      owner.invoke = ((request: any) => {
        if (typeof request !== 'string' && request.execution && request.execution !== execution)
          return Promise.reject(new TypeError('Bound model execution cannot be replaced'));
        return this.invoke(
          typeof request === 'string' ? { input: request, execution } : { ...request, execution },
        );
      }) as typeof owner.invoke;
    if (this.prepare !== ModelRunner.prototype.prepare)
      owner.prepare = ((request: any = {}) => {
        if (request.execution && request.execution !== execution)
          throw new TypeError('Bound model execution cannot be replaced');
        return this.prepare({ ...request, execution });
      }) as typeof owner.prepare;
    if (this.createChild !== ModelRunner.prototype.createChild)
      owner.createChild = (options) => {
        if (options.execution && options.execution !== execution)
          throw new TypeError('Bound model execution cannot be replaced');
        return this.createChild({ ...options, execution });
      };
    return owner;
  }

  /** Execute one bounded lifecycle action using the same request gate and call ledger. */
  async runOperation<T>(
    work: (signal: AbortSignal) => Promise<T>,
    options: {
      signal?: AbortSignal;
      calls?: number;
      cleanup?: boolean;
      action?:
        | 'submit'
        | 'query'
        | 'read'
        | 'cancel'
        | 'connect'
        | 'send'
        | 'close'
        | 'interrupt'
        | 'generate'
        | 'resource';
      operationId?: string;
    } = {},
  ): Promise<T> {
    options = {
      signal: options.signal,
      calls: options.calls,
      cleanup: options.cleanup,
      action: options.action,
      operationId: options.operationId,
    };
    if (!this.boundExecution)
      return this.bind({ signal: options.signal }).runOperation(work, options);
    const calls = options.calls ?? 0;
    if (options.action !== undefined && !lifecycleActions.includes(options.action))
      throw new TypeError('Invalid lifecycle action');
    const action = options.action ?? 'custom';
    const operationId = options.operationId;
    if (operationId !== undefined && (typeof operationId !== 'string' || operationId.length > 4096))
      throw new TypeError('Invalid lifecycle identity');
    let operationRef: string | undefined;
    if (operationId && this.ports.diagnostics) {
      // Stable correlation without exposing the host's raw operation identity.
      try {
        const digest = await globalThis.crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(operationId),
        );
        operationRef = [...new Uint8Array(digest)]
          .map((byte) => byte.toString(16).padStart(2, '0'))
          .join('');
      } catch {
        /* Correlation is optional; invocation identity remains available. */
      }
    }
    if (!Number.isSafeInteger(calls) || calls < 0)
      throw new TypeError('Invalid lifecycle call count');
    if ((options.cleanup || this.requestGate.cleanupActive) && calls !== 0)
      throw new TypeError('Cleanup cannot generate new work');
    const baseSignal = options.cleanup
      ? (options.signal ?? new AbortController().signal)
      : combineSignals(this.executionSignal, options.signal ?? this.executionSignal);
    const signal = combineSignals(baseSignal, AbortSignal.timeout(this.config.callTimeoutMs));
    signal.throwIfAborted();
    if (
      options.cleanup
        ? (this.requestGate.cleanupActive ?? 0) >= 1
        : this.inFlight || this.requestGate.active >= this.requestGate.limits.maxConcurrentCalls
    )
      throw new TypeError('Model request already has an active call');
    if (this.budget.remaining < calls) throw new BudgetError();
    for (let index = 0; index < calls; index++) this.budget.take();
    this.completedCallCount += calls;
    if (options.cleanup) this.requestGate.cleanupActive = (this.requestGate.cleanupActive ?? 0) + 1;
    else {
      this.inFlight = true;
      this.requestGate.active++;
    }
    const id = invocationId();
    const startedAtMs = Date.now();
    let scope: DiagnosticContext | undefined;
    try {
      scope = this.ports.diagnostics?.child(id, { invocationId: id });
    } catch {
      /* Custom observation is best effort. */
    }
    const metadata = {
      invocationId: id,
      action,
      ...(operationRef ? { operationRef } : {}),
      calls,
      cleanup: options.cleanup === true,
    };
    try {
      scope?.emit('model.lifecycle.start', () => metadata);
    } catch {
      /* Custom observation must not strand an admitted action. */
    }
    const pending = Promise.resolve().then(() => {
      signal.throwIfAborted();
      return work(signal);
    });
    // Caller cancellation stops waiting, but an issued side effect keeps its gate until settled.
    const release = () => {
      if (options.cleanup) this.requestGate.cleanupActive!--;
      else {
        this.inFlight = false;
        this.requestGate.active--;
      }
    };
    const settle = (error?: unknown, failed = false) => {
      release();
      try {
        scope?.emit('model.lifecycle.end', () => ({
          ...metadata,
          status: signal.aborted
            ? ('cancelled' as const)
            : failed
              ? ('error' as const)
              : ('success' as const),
          durationMs: Date.now() - startedAtMs,
          ...(failed ? { errorCode: getErrorInfo(error).code } : {}),
        }));
      } catch {
        /* Gate release is independent of custom observation. */
      }
    };
    // End means the issued action settled, not merely that its caller stopped waiting.
    pending.then(
      () => settle(),
      (error) => settle(error, true),
    );
    return await awaitWithSignal(pending, signal);
  }

  /** Never guess a current request on a concurrently reusable host. */
  private requireExecution(): void {
    if (!this.boundExecution)
      throw new TypeError('Bind execution before reading model execution state');
  }

  /** Calls still available to this runner after the parent's reserve is applied. */
  /** Current request allowance and immutable revision history. Bind shared runners first. */
  get callBudget() {
    this.requireExecution();
    return this.budget.snapshot();
  }

  /** Host-only policy decision; preserves attempts, ancestor limits and cancellation. */
  adjustCallBudget(request: { limit: number; reason: string }) {
    this.requireExecution();
    this.signal.throwIfAborted();
    return this.budget.adjust(request.limit, request.reason);
  }

  get remainingCalls(): number {
    this.requireExecution();
    return this.budget.remaining;
  }

  /**
   * Resolve the character limit for one input shape.
   *
   * A message array uses the runner limit; a built context or plan may declare a lower
   * limit, and the stricter of the two wins so neither contract can be exceeded.
   *
   * @param input - Messages, built context or context plan.
   * @returns The effective input character limit.
   */
  private inputLimit(input: readonly ModelMessage[] | BuiltContext | ContextPlan): number {
    if (isMessageArray(input)) return this.maxInputChars;
    const limit = input.maxInputChars;
    validateContextBudget(0, limit);
    return Math.min(limit, this.maxInputChars);
  }

  /** Backpressure is awaited, but a stalled consumer cannot disable model cancellation/deadlines. */
  private async emitOutput(event: ModelOutputEvent, signal: AbortSignal): Promise<void> {
    const sink = this.ports.onOutput!;
    signal.throwIfAborted();
    await awaitWithSignal(
      Promise.resolve().then(() => {
        signal.throwIfAborted();
        return sink(event);
      }),
      signal,
    );
  }

  /**
   * Publish and, when a sink is installed, deliver one lifecycle event.
   *
   * Delivery goes through the scope so observers see the event before the sink does;
   * `consume` runs inside the delivery callback, after the abort check, so a cancelled
   * call cannot mutate the collector.
   *
   * @param type - Lifecycle event name.
   * @param payload - Lazily built payload; only evaluated when someone consumes it.
   * @param signal - Signal that bounds publication and delivery.
   * @param scope - Diagnostic scope owning the event and its consumers.
   * @param consume - Optional collector update performed before delivery.
   */
  private async publishOutput<
    K extends 'model.start' | 'model.output' | 'model.parsed' | 'model.end',
  >(
    type: K,
    payload: () => import('../structs/diagnostics.js').CoreEventPayloads[K],
    signal: AbortSignal,
    scope?: import('../structs/diagnostics.js').DiagnosticContext,
    consume?: () => void,
  ): Promise<void> {
    signal.throwIfAborted();
    if (this.ports.onOutput)
      await scope?.deliver(type, payload, (event) => {
        signal.throwIfAborted();
        consume?.();
        return this.emitOutput(event, signal);
      });
    else {
      scope?.emit(type, payload);
      signal.throwIfAborted();
      consume?.();
    }
  }

  /**
   * Prepare a call and measure it before invocation.
   *
   * A prepared call is single-use and bound to the stage, output tokens and interaction it
   * was measured with; `invoke` rejects any attempt to replace those settings.
   *
   * @param request - Stage, interaction and output token overrides.
   * @returns A frozen prepared call with a `measure` helper.
   * @throws TypeError When the stage, tokens or interaction selection is invalid.
   */
  prepare(
    request?: import('../structs/model/runtime.js').ModelPrepareRequest<never>,
  ): import('../structs/model/runtime.js').PreparedModelCall<string>;
  /** Prepare a call for an interaction instance supplied at the call site. */
  prepare<Result>(
    request: import('../structs/model/runtime.js').ModelPrepareRequest<
      ModelInteractionDefinition<Result>
    > &
      (
        | { readonly interaction: ModelInteractionDefinition<Result> }
        | { readonly transport: ModelInteractionDefinition<Result> }
      ),
  ): import('../structs/model/runtime.js').PreparedModelCall<Result>;
  /** Prepare a call for an interaction id, typed by the runner's registered interactions. */
  prepare<const Id extends string>(
    request:
      | (import('../structs/model/runtime.js').ModelPrepareRequest<Id> & {
          readonly interaction: Id;
        })
      | (import('../structs/model/runtime.js').ModelPrepareRequest<Id> & {
          readonly transport: Id;
        }),
  ): import('../structs/model/runtime.js').PreparedModelCall<
    import('../structs/model/runtime.js').RegisteredInteractionOutput<Transports, Id>
  >;
  /** Prepare a call without narrowing the interaction type. */
  prepare(
    request: import('../structs/model/runtime.js').ModelPrepareRequest<
      string | ModelInteractionDefinition
    >,
  ): import('../structs/model/runtime.js').PreparedModelCall;
  prepare(
    request: import('../structs/model/runtime.js').ModelPrepareRequest<
      string | ModelInteractionDefinition
    > = {},
  ): import('../structs/model/runtime.js').PreparedModelCall {
    request = {
      ...request,
      interaction: resolveInteractionAlias(request.interaction, request.transport),
    };
    if (!this.boundExecution) {
      const owner = this.bind(request.execution);
      const prepared = owner.prepareBound(request);
      this.preparedOwners.set(prepared, owner);
      return prepared;
    }
    if (request.execution && request.execution !== this.sourceExecution)
      throw new TypeError('Bound model execution cannot be replaced');
    return this.prepareBound(request);
  }

  /** Prepare once against the selected execution state. */
  private prepareBound(
    request: import('../structs/model/runtime.js').ModelPrepareRequest<
      string | ModelInteractionDefinition
    >,
  ): import('../structs/model/runtime.js').PreparedModelCall {
    this.signal.throwIfAborted();
    if (!this.provider.stream && !this.provider.streamEvents)
      throw new TypeError('Provider does not support model generation');
    const stageId = request.stageId ?? modelRunnerDefaults.stage;
    const maxOutputTokens = request.maxOutputTokens ?? this.maxOutputTokens;
    if (typeof stageId !== 'string' || !stageId.trim())
      throw new TypeError('stageId must be a nonempty string');
    validateOutputTokens(maxOutputTokens, stageId);
    const transportId =
      request.interaction === undefined
        ? defaultTextInteraction.id
        : typeof request.interaction === 'string'
          ? request.interaction
          : this.registeredInteractions.get(request.interaction);
    const interaction = transportId === undefined ? undefined : this.interactions.get(transportId);
    if (!interaction) throw new TypeError('Prepare requires a registered model interaction');
    const prepared = prepareModelInteraction(interaction, stageId, request.replyGuidance);
    let state: PreparedCallState;
    const runner = this;
    const snapshot: import('../structs/model/runtime.js').PreparedModelCall = Object.freeze({
      ...prepared,
      stageId,
      modelId: this.modelId,
      interactionId: interaction.id,
      transportId: interaction.id,
      maxOutputTokens,
      get remainingCalls() {
        return runner.remainingCalls;
      },
      /**
       * Preflight measurement of one input shape.
       *
       * Measuring does not consume the prepared call and does not charge the budget; it
       * only reports the sizes and whether all three budgets would accept the input.
       *
       * @param input - Prompt string, message array or built context.
       * @returns Frozen character and token measurements with a `withinBudget` verdict.
       * @throws TypeError When the input shape is invalid or the call is already used.
       */
      measure(input: string | readonly ModelMessage[] | BuiltContext) {
        runner.signal.throwIfAborted();
        if (state.used) throw new TypeError('Prepared model call has already been used');
        const base =
          typeof input === 'string'
            ? [{ role: 'user' as const, content: input }]
            : isMessageArray(input)
              ? input
              : input.messages;
        const size = preparedInputSize(base, prepared);
        const inputLimit =
          typeof input === 'string' ? runner.maxInputChars : runner.inputLimit(input);
        const inputTokenLimit = runner.tokenBudget
          ? modelInputTokenLimit(runner.tokenBudget, maxOutputTokens)
          : undefined;
        const inputTokens = runner.tokenBudget
          ? countModelInput(runner.tokenBudget, size.messages, prepared.options)
          : undefined;
        const maxSchemaChars = runner.ports.maxSchemaChars!;
        return Object.freeze({
          messageChars: size.messageChars,
          instructionChars: size.instructionChars,
          schemaChars: size.schemaChars,
          interactionChars: size.transportChars,
          transportChars: size.transportChars,
          inputChars: size.inputChars,
          maxInputChars: inputLimit,
          maxSchemaChars,
          maxOutputTokens,
          ...(runner.tokenBudget
            ? { counterId: runner.tokenBudget.counterId, inputTokens, inputTokenLimit }
            : {}),
          withinBudget:
            size.messageChars <= inputLimit &&
            size.transportChars <= maxSchemaChars &&
            (inputTokens === undefined || inputTokens <= inputTokenLimit!),
        });
      },
    });
    state = { snapshot, used: false };
    this.preparedCalls.set(snapshot, state);
    return snapshot;
  }

  /**
   * Invoke one model call.
   *
   * Named and shorthand input share the same lifecycle: validation, measurement, budget
   * charge, streaming, commit. A caller-supplied signal only shortens the call lifetime.
   *
   * @param request - A prompt string, or a request naming input, stage, interaction and signal.
   * @returns The parsed result with its invocation metadata.
   * @throws TypeError When the request, stage, tokens or interaction is invalid.
   * @throws ValidationError When the input or output exceeds its budget.
   * @throws BudgetError When no model call remains for this request.
   * @throws The signal reason on cancellation or timeout.
   */
  invoke(request: string): Promise<ModelResult<string>>;
  /** Invoke a prepared call whose settings cannot be replaced. */
  invoke<Result>(
    request: ModelCallRequest<never> & {
      readonly prepared: import('../structs/model/runtime.js').PreparedModelCall<Result>;
    },
  ): Promise<ModelResult<Result>>;
  /** Invoke with the default interaction and a plain-text result. */
  invoke(request: ModelCallRequest<never>): Promise<ModelResult<string>>;
  /** Invoke with an interaction instance supplied at the call site. */
  invoke<Result>(
    request:
      | (ModelCallRequest<ModelInteractionDefinition<Result>> & {
          interaction: ModelInteractionDefinition<Result>;
        })
      | (ModelCallRequest<ModelInteractionDefinition<Result>> & {
          transport: ModelInteractionDefinition<Result>;
        }),
  ): Promise<ModelResult<Result>>;
  /** Invoke with an interaction id registered on this runner. */
  invoke<const Id extends string>(
    request: ModelCallRequest<Id> & ({ readonly interaction: Id } | { readonly transport: Id }),
  ): Promise<
    ModelResult<import('../structs/model/runtime.js').RegisteredInteractionOutput<Transports, Id>>
  >;
  /** Invoke without narrowing the interaction type. */
  invoke(
    request: ModelCallRequest<TransportId | ModelInteractionDefinition>,
  ): Promise<ModelResult<unknown>>;
  async invoke(
    request: string | ModelCallRequest<TransportId | ModelInteractionDefinition>,
  ): Promise<ModelResult<unknown>> {
    if (typeof request !== 'string')
      request = {
        ...request,
        interaction: resolveInteractionAlias(request.interaction, request.transport),
      };
    if (!this.boundExecution) {
      if (typeof request !== 'string' && request.prepared) {
        const owner = this.preparedOwners.get(request.prepared);
        if (!owner) throw new TypeError('Prepared model call is foreign or already used');
        if (request.execution && this.bind(request.execution) !== owner)
          throw new TypeError('Prepared model execution cannot be replaced');
        return owner.invokeBound(request);
      }
      const execution =
        typeof request === 'string'
          ? {}
          : (request.execution ?? { signal: request.signal, diagnostics: request.diagnostics });
      return this.bind(execution).invokeBound(request);
    }
    if (
      typeof request !== 'string' &&
      request.execution &&
      request.execution !== this.sourceExecution
    )
      throw new TypeError('Bound model execution cannot be replaced');
    return this.invokeBound(request);
  }

  /** Invoke against one execution, preserving recording and cancellation on every path. */
  private async invokeBound(
    request: string | ModelCallRequest<TransportId | ModelInteractionDefinition>,
  ): Promise<ModelResult<unknown>> {
    const context =
      typeof request === 'string' ? { logger: undefined, signal: undefined } : request;
    requireReportedStepRecorder(context.logger);
    const callId = invocationId();
    return nativeSubFlowAsync(
      {
        logger: context.logger,
        signal: combineSignals(this.signal, context.signal),
        invocationId: callId,
      },
      'model',
      typeof request === 'string'
        ? modelRunnerDefaults.stage
        : (request.stageId ?? request.prepared?.stageId ?? modelRunnerDefaults.stage),
      () => this.invokeRequest(request, callId),
    );
  }

  /** Validate and execute a single request; optional recording is owned by invoke. */
  private async invokeRequest(
    request: string | ModelCallRequest<TransportId | ModelInteractionDefinition>,
    callId: string,
  ): Promise<ModelResult<unknown>> {
    if (!this.provider.stream && !this.provider.streamEvents)
      throw new TypeError('Provider does not support model generation');
    const call = typeof request === 'string' ? { input: request } : request;
    const state = call.prepared === undefined ? undefined : this.preparedCalls.get(call.prepared);
    if (call.prepared !== undefined && (!state || state.used))
      throw new TypeError('Prepared model call is foreign or already used');
    const prepared = state?.snapshot;
    const stage = call.stageId ?? prepared?.stageId ?? modelRunnerDefaults.stage;
    const tokens = call.maxOutputTokens ?? prepared?.maxOutputTokens ?? this.maxOutputTokens;
    const invalid = (message: string) =>
      recordErrorContext(new TypeError(message), {
        stageId: stage,
        codes: ['MODEL_CONFIG'],
        isRetryable: false,
      }) as Error;
    breakWhile([
      { occur: 'stage' in call, error: () => invalid('Use stageId to select a model stage') },
      {
        occur: typeof stage !== 'string' || !stage.trim(),
        error: () => invalid('stageId must be a nonempty string'),
      },
      {
        occur: 'transportId' in call,
        error: () =>
          invalid(
            'Use transport (legacy alias) or interaction to select a registered model interaction',
          ),
      },
      {
        occur: typeof call.interaction === 'string' && !call.interaction.trim(),
        error: () => invalid('Transport ID must be a nonempty string'),
      },
      { occur: 'prompt' in call, error: () => invalid('Use input to provide model input') },
      { occur: call.input == null, error: () => invalid('Model input is required') },
      {
        occur:
          call.input !== undefined &&
          typeof call.input !== 'string' &&
          call.instructions !== undefined,
        error: () =>
          invalid('instructions require string input; message inputs already declare their roles'),
      },
      {
        occur: call.instructions !== undefined && typeof call.instructions !== 'string',
        error: () => invalid('instructions must be text'),
      },
    ]);
    validateOutputTokens(tokens, stage);
    const source = call.input;
    const input =
      typeof source === 'string'
        ? [
            ...(call.instructions === undefined
              ? []
              : [{ role: 'system' as const, content: call.instructions }]),
            { role: 'user' as const, content: source },
          ]
        : source;
    const interaction = call.interaction;
    const transportId =
      interaction === undefined
        ? (prepared?.transportId ?? defaultTextInteraction.id)
        : typeof interaction === 'string'
          ? interaction
          : this.registeredInteractions.get(interaction);
    breakWhile(transportId === undefined, () =>
      invalid(
        call.transport !== undefined
          ? 'Typed transport must be the registered transport instance'
          : 'Typed interaction must be the registered interaction instance',
      ),
    );
    if (
      prepared &&
      (stage !== prepared.stageId ||
        tokens !== prepared.maxOutputTokens ||
        transportId !== prepared.transportId)
    )
      throw invalid('Prepared model request settings cannot be replaced');
    if (prepared && call.modelOptions) throw invalid('Prepared model options cannot be replaced');
    if (prepared && call.replyGuidance !== undefined)
      throw invalid('Prepared reply guidance cannot be replaced');
    if (state) state.used = true;
    return this.invokePrepared(
      stage,
      input,
      tokens,
      transportId as TransportId,
      call.diagnostics,
      prepared,
      call.signal,
      callId,
      call.modelOptions,
      call.replyGuidance,
    );
  }

  /**
   * Acquire the per-runner call slot and execute one call.
   *
   * The concurrency guard is taken and released around `execute`; the error context is
   * decorated with the stage before the failure leaves this method, so later layers do
   * not need to re-derive it.
   *
   * @param stage - Stage id for diagnostics and error context.
   * @param input - Messages, built context or context plan.
   * @param tokens - Requested output tokens.
   * @param transportId - Registered interaction to execute.
   * @param diagnostics - Observation scope for this call.
   * @param prepared - Prepared call whose snapshot must be reused.
   * @param requestSignal - Caller signal, combined with the runner signal.
   * @returns The parsed result with invocation metadata.
   * @throws Error When a call is already in flight or the request capacity is exhausted.
   */
  private async invokePrepared(
    stage: string,
    input: readonly ModelMessage[] | BuiltContext | ContextPlan,
    tokens: number,
    transportId: TransportId,
    diagnostics = this.ports.diagnostics,
    prepared?: import('../structs/model/runtime.js').PreparedModelCall,
    requestSignal?: AbortSignal,
    callId = invocationId(),
    modelOptions?: import('../structs/model/messages.js').ModelInteractionOptions,
    replyGuidance?: import('../structs/model/runtime.js').ReplyGuidance,
  ): Promise<ModelResult<unknown>> {
    const configuredRun = this.ports.diagnostics?.identity?.runId,
      selectedRun = diagnostics?.identity?.runId;
    if (configuredRun && selectedRun && configuredRun !== selectedRun)
      throw recordErrorContext(
        new TypeError('Model observation parent belongs to a different run'),
        { stageId: stage, codes: ['MODEL_CONFIG'], isRetryable: false },
      );
    breakWhile(
      (this.requestGate.cleanupActive ?? 0) > 0,
      'Model generation is unavailable during cleanup',
    );
    breakWhile(this.inFlight, 'Concurrent calls on the same model runner are not allowed');
    breakWhile(
      this.requestGate.active >= this.requestGate.limits.maxConcurrentCalls,
      'Concurrent model calls exceed the request capacity',
    );
    this.inFlight = true;
    this.requestGate.active++;
    let failure: unknown;
    try {
      return await this.execute(
        stage,
        input,
        tokens,
        transportId,
        combineSignals(this.signal, requestSignal),
        diagnostics,
        prepared,
        callId,
        modelOptions,
        replyGuidance,
      );
    } catch (error) {
      failure = recordErrorContext(error, { stageId: stage });
    } finally {
      this.requestGate.active--;
      this.inFlight = false;
    }
    throw failure;
  }

  /**
   * Execute the prepared call: measure, charge, stream, commit.
   *
   * Phase order is a correctness requirement, not an implementation detail. Every
   * rejection path goes through `reject`, which annotates codes and emits
   * `runtime.rejected`. Budget charging happens only after all input checks pass, so a
   * rejected request never consumes a call. The terminal `model.end` event is published
   * in `finally` with its own timeout, because the call signal is already aborted when a
   * call is cancelled and terminal delivery must still retract previews.
   *
   * @param stage - Stage id for diagnostics.
   * @param input - Messages, built context or context plan.
   * @param tokens - Requested output tokens.
   * @param transportId - Registered interaction id.
   * @param signal - Combined execution and request signal.
   * @param parentDiagnostics - Parent observation scope, defaulting to the runner scope.
   * @param prepared - Prepared call whose snapshot must be reused.
   * @returns The parsed result with invocation metadata.
   * @throws Error or ValidationError from any phase, decorated with stage context.
   */
  private async execute(
    stage: string,
    input: readonly ModelMessage[] | BuiltContext | ContextPlan,
    tokens: number,
    transportId: string,
    signal: AbortSignal,
    parentDiagnostics = this.ports.diagnostics,
    prepared?: import('../structs/model/runtime.js').PreparedModelCall,
    callId = invocationId(),
    modelOptions?: import('../structs/model/messages.js').ModelInteractionOptions,
    replyGuidance?: import('../structs/model/runtime.js').ReplyGuidance,
  ): Promise<ModelResult<unknown>> {
    const id = callId,
      startedAtMs = Date.now();
    this.activeCall = undefined;
    const invocationDiagnostics = parentDiagnostics?.child(id, {
      invocationId: id,
      modelId: this.modelId,
      nodeRole: 'invocation',
      definitionKind: 'model-transport',
      definitionId: transportId,
      nodeId: stage,
      nodeName: stage,
      nodeKind: 'model',
      nodeDescription: 'Registered model invocation',
      definitionRevision: undefined,
      stageId: stage,
    });
    let diagnostics = invocationDiagnostics;
    const reject = (error: unknown): never => {
      recordErrorContext(error, {
        stageId: stage,
        ...(signal.aborted
          ? {
              codes: [isTimeoutReason(signal.reason) ? 'ROUND_TIMEOUT' : 'CANCELLED'],
              isRetryable: false,
            }
          : error instanceof BudgetError
            ? { codes: ['BUDGET'], isRetryable: false }
            : {}),
      });
      diagnostics?.emit('runtime.rejected', () => ({
        stageId: stage,
        error: diagnosticError(error),
      }));
      throw error;
    };
    const definition = this.interactions.get(transportId);
    if (!definition)
      return reject(new Error(`Model interaction is not registered: ${transportId}`));
    try {
      signal.throwIfAborted();
    } catch (error) {
      return reject(error);
    }
    if (!this.remainingCalls) return reject(new BudgetError());
    let interaction: import('../structs/model/interactions.js').PreparedModelInteraction;
    let interactionOptions: ModelOptions;
    try {
      interaction = prepared ?? prepareModelInteraction(definition, stage, replyGuidance);
      if (modelOptions) {
        const original = interaction;
        const overrides = snapshotModelOptions(modelOptions);
        interaction = prepareModelInteraction(
          {
            id: transportId,
            prepare: () => ({ ...original, options: { ...original.options, ...overrides } }),
          },
          stage,
        );
      }
      interactionOptions = interaction.options;
    } catch (error) {
      return reject(error);
    }
    const tokenBudget = this.tokenBudget;
    let tokenLimit: number | undefined;
    try {
      tokenLimit = tokenBudget ? modelInputTokenLimit(tokenBudget, tokens) : undefined;
    } catch (error) {
      return reject(error);
    }
    if (isContextPlan(input)) {
      try {
        input = assembleContextPlan(input);
      } catch (error) {
        return reject(error);
      }
    }
    diagnostics = invocationDiagnostics;
    const baseMessages = isMessageArray(input) ? input : input.messages;
    let size: ReturnType<typeof preparedInputSize>;
    try {
      size = preparedInputSize(baseMessages, interaction);
    } catch (error) {
      return reject(error);
    }
    const messages = size.messages;
    try {
      const capabilities = this.provider.capabilities;
      if (messages.some((message) => message.parts !== undefined) && !this.provider.streamEvents)
        throw new TypeError('Legacy provider does not accept typed content');
      if (
        interactionOptions.requireCompletion &&
        (!capabilities?.completion || !this.provider.streamEvents)
      )
        throw new TypeError('Provider does not prove completion');
      if (interactionOptions.functions?.length && capabilities?.tools === false)
        throw new TypeError('Provider does not support tool calls');
      if (interactionOptions.outputSchema && !capabilities?.jsonSchema)
        throw new TypeError('Provider does not support structured output');
      if (interactionOptions.continuation && tokenBudget)
        throw new TypeError('Opaque remote context cannot satisfy exact input token accounting');
      for (const message of messages)
        for (const part of message.parts ?? []) {
          if (part.type !== 'text' && !capabilities?.modalities?.includes(part.type))
            throw new TypeError(`Provider does not support ${part.type} input`);
        }
      signal.throwIfAborted();
    } catch (error) {
      return reject(error);
    }
    if (!this.remainingCalls) return reject(new BudgetError());
    const messageChars = size.messageChars;
    const functionChars = size.transportChars;
    // The binding snapshots and validates this fixed allowance at construction.
    if (functionChars > this.ports.maxSchemaChars!)
      return reject(
        new ValidationError([
          { code: 'MODEL_SCHEMA_BUDGET', message: 'Model declarations exceed their schema budget' },
        ]),
      );
    const inputChars = size.inputChars;
    try {
      validateContextBudget(
        messageChars,
        this.inputLimit(input),
        (limit) =>
          this.ports.inputBudgetError?.(limit) ??
          new ValidationError([
            { code: 'CONTEXT_BUDGET', message: `Model input exceeds ${limit} characters` },
          ]),
      );
    } catch (error) {
      return reject(error);
    }
    let inputTokens: number | undefined;
    try {
      if (tokenBudget) {
        inputTokens = countModelInput(tokenBudget, messages, interactionOptions);
        enforceModelInputTokens(inputTokens, tokenLimit!);
      }
      signal.throwIfAborted();
    } catch (error) {
      return reject(error);
    }
    this.budget.take();
    this.completedCallCount++;
    const call = this.callCount;
    const step: CallTraceDraft = {
      ...invocationDiagnostics?.identity,
      modelId: this.modelId,
      invocationId: id,
      startedAtMs,
      callSequence: call,
      stageId: stage,
      durationMs: 0,
      inputChars,
      outputChars: 0,
      firstOutputMs: null,
      outputDurationMs: 0,
      status: 'error',
      codes: [],
      ...(inputTokens === undefined ? {} : { inputTokens, inputTokenLimit: tokenLimit }),
    };
    if (!isMessageArray(input) && diagnostics?.enabled('model.prepare')) {
      try {
        const serialized = JSON.stringify({
          messages: modelMessageDiagnostics(messages),
          interaction: {
            ...interactionOptions,
            continuation: undefined,
            onContinuation: undefined,
            onContent: undefined,
          },
        });
        step.context = {
          fragmentUsage: input.fragmentUsage,
          stablePrefixChars: commonPrefixLength(serialized, this.priorInputs.get(stage) ?? ''),
        };
        this.priorInputs.set(stage, serialized);
      } catch {
        step.context = { fragmentUsage: input.fragmentUsage, stablePrefixChars: 0 };
      }
    }
    this.activeCall = step;
    const callDeadline = AbortSignal.timeout(this.config.callTimeoutMs);
    const callSignal = combineSignals(signal, callDeadline);
    let response:
      import('../structs/model/interactions.js').ModelResponseCollector<unknown> | undefined;
    let completed = false;
    let pendingContinuation: import('../structs/model/messages.js').ModelContinuation | undefined;
    let mediaOutputChars = 0;
    let receivedParts = 0;
    let callError: { error: unknown } | undefined;
    let callMetadataRead = false;
    const captureCallMetadata = () => {
      if (!response || callMetadataRead) return;
      callMetadataRead = true;
      // Optional diagnostic metadata cannot replace a committed value, hide the
      // original failure or suppress the terminal event if its getter fails.
      try {
        const call = response.call;
        if (call) step.functionCall = call;
      } catch {
        /* best-effort metadata */
      }
      try {
        const calls = response.calls;
        if (calls?.length) {
          step.calls = calls.map((call) => ({
            id: call.id,
            name: call.name,
            argumentChars: call.argumentChars,
            ...(call.toolId === undefined ? {} : { toolId: call.toolId }),
          }));
        }
      } catch {
        /* best-effort metadata */
      }
    };
    const accountOutput = () => {
      const outputChars = response!.outputChars + mediaOutputChars;
      if (!Number.isSafeInteger(outputChars) || outputChars < 0)
        modelProtocolError('Model response collectors must report nonnegative safe output counts');
      // A collector may release or normalize buffered text at finish. Retain the
      // largest observed size without requiring its internal buffer to grow.
      step.outputChars = Math.max(step.outputChars, outputChars);
      if (this.config.maxOutputChars !== undefined && outputChars > this.config.maxOutputChars)
        throw (
          this.ports.outputBudgetError?.() ??
          new ValidationError([
            { code: 'OUTPUT_LIMIT', message: 'Model output exceeds its character budget' },
          ])
        );
    };
    diagnostics?.emit('model.prepare', () => ({
      stageId: stage,
      transportId,
      messages: modelMessageDiagnostics(messages),
      options: {
        ...interactionOptions,
        continuation: undefined,
        onContinuation: undefined,
        onContent: undefined,
        maxOutputTokens: tokens,
      },
      context: isMessageArray(input) ? undefined : input.fragmentUsage,
    }));
    try {
      await this.publishOutput(
        'model.start',
        () => ({ stageId: stage, callSequence: call, transportId }),
        callSignal,
        diagnostics,
      );
      callSignal.throwIfAborted();
      response = synchronous(
        interaction.createResponse(),
        'Model response factories must be synchronous',
      );
      if (!response || typeof response.push !== 'function' || typeof response.finish !== 'function')
        throw new TypeError('Invalid model response collector');
      accountOutput();
      callSignal.throwIfAborted();
      for await (const rawEvent of abortableStream(
        (this.provider.streamEvents ?? this.provider.stream)!.call(this.provider, messages, {
          signal: callSignal,
          diagnostics,
          options: {
            ...interactionOptions,
            maxOutputTokens: tokens,
            includeUsage: this.config.usage,
            onUsage: (usage) => {
              step.usage = usage;
            },
          },
        }),
        callSignal,
      )) {
        const part = normalizeModelText(snapshotModelEvent(rawEvent));
        if (typeof part !== 'string' && part.type !== 'function-call-delta') {
          if (part.type === 'usage') {
            step.usage = part.usage;
            continue;
          }
          if (part.type === 'continuation') {
            pendingContinuation = structuredClone(part.continuation);
            continue;
          }
          if (part.type === 'completion') {
            if (completed) modelProtocolError('Duplicate completion event');
            if (part.status !== 'completed' && part.status !== 'tool-calls')
              modelProtocolError('Model generation did not complete', 'MODEL_INCOMPLETE');
            completed = true;
            continue;
          }
          // Usage, continuation and completion have been consumed above. Only media remains.
          if (completed) modelProtocolError('Content after completion');
          mediaOutputChars += part.content.url.length;
          accountOutput();
          if (!interactionOptions.onContent)
            modelProtocolError('This interaction does not accept media output');
          synchronous(
            interactionOptions.onContent!(structuredClone(part.content)),
            'Model content callbacks must be synchronous',
          );
          continue;
        }
        if (completed) modelProtocolError('Content after completion');
        const partIndex = receivedParts;
        receivedParts++;
        callSignal.throwIfAborted();
        if (part && step.firstOutputMs === null) step.firstOutputMs = Date.now() - startedAtMs;
        await this.publishOutput(
          'model.output',
          () => ({ stageId: stage, callSequence: call, partIndex, part }),
          callSignal,
          diagnostics,
          () => {
            synchronous(response!.push(part), 'Model response collectors must be synchronous');
            accountOutput();
          },
        );
        callSignal.throwIfAborted();
      }
      callSignal.throwIfAborted();
      if (this.provider.streamEvents && !completed)
        modelProtocolError('Missing model completion event', 'MODEL_INCOMPLETE');
      const value = synchronous(response.finish(), 'Model result parsers must be synchronous');
      accountOutput();
      captureCallMetadata();
      await this.publishOutput(
        'model.parsed',
        () => ({ stageId: stage, callSequence: call, value }),
        callSignal,
        diagnostics,
      );
      callSignal.throwIfAborted();
      // Prove the business projection can be committed before replacing host continuation state.
      const journalValue = structuredClone(value);
      if (pendingContinuation && interactionOptions.onContinuation)
        synchronous(
          interactionOptions.onContinuation(pendingContinuation),
          'Model continuation callbacks must be synchronous',
        );
      this.journal.model({
        stageId: stage,
        value: journalValue,
        invocation: {
          ...invocationDiagnostics?.identity,
          invocationId: id,
          startedAtMs,
          durationMs: Date.now() - startedAtMs,
        },
      });
      step.status = 'success';
      return invocationResult(value, {
        ...invocationDiagnostics?.identity,
        invocationId: id,
        modelId: this.modelId,
        stageId: stage,
        startedAtMs,
        durationMs: Date.now() - startedAtMs,
        callSequence: call,
        status: 'success' as const,
        ...(step.usage ? { usage: Object.freeze({ ...step.usage }) } : {}),
      });
    } catch (error) {
      callError = { error };
      step.status = signal.aborted || callDeadline.aborted ? 'cancelled' : 'error';
      try {
        const info = getErrorInfo(error);
        const codes =
          error instanceof ValidationError
            ? error.issues.map((item) => item.code)
            : [
                signal.aborted
                  ? isTimeoutReason(signal.reason)
                    ? 'ROUND_TIMEOUT'
                    : 'CANCELLED'
                  : callDeadline.aborted
                    ? 'CALL_TIMEOUT'
                    : info.code === 'UNKNOWN_ERROR'
                      ? 'UPSTREAM_ERROR'
                      : info.code,
              ];
        recordErrorContext(error, {
          stageId: stage,
          codes,
          ...(signal.aborted
            ? { isRetryable: false }
            : callDeadline.aborted
              ? { isRetryable: true }
              : {}),
        });
        step.codes = [...getErrorInfo(error).codes];
      } catch {
        // Even instanceof or an Error subclass's fields can throw. Decoration
        // must not replace the original value or skip terminal delivery.
        const cancelled = step.status === 'cancelled',
          codes = [cancelled ? 'CANCELLED' : 'UPSTREAM_ERROR'];
        recordErrorContext(error, {
          stageId: stage,
          codes,
          ...(cancelled ? { isRetryable: false } : {}),
        });
        step.codes = codes;
      }
    } finally {
      captureCallMetadata();
      step.durationMs = Date.now() - startedAtMs;
      step.outputDurationMs = step.firstOutputMs == null ? 0 : step.durationMs - step.firstOutputMs;
      const end = () => ({
        stageId: stage,
        state: { ...step },
        receivedParts,
        ...(callError ? { error: diagnosticError(callError.error) } : {}),
      });
      // Terminal delivery also retracts cancelled previews. It needs its own
      // bounded lifetime: the call signal is already aborted on cancellation.
      try {
        await this.publishOutput('model.end', end, AbortSignal.timeout(250), diagnostics);
      } catch {
        /* Terminal notification cannot replace a committed result or its original failure. */
      }
    }
    throw callError!.error;
  }
}

// Re-exported so consumers configuring a runner do not import the struct module directly.
export type {
  ModelOutputEvent,
  ModelRuntimeConfig,
  ModelInteractionDefinition,
  ModelCallTrace,
  ModelRunnerPorts,
  ModelTokenBudget,
  ModelRunnerOptions,
  ModelCallRequest,
  ModelRunnerSettings,
  ModelChildOptions,
  ModelChildPolicy,
} from '../structs/model/runtime.js';

export type {
  PreparedModelCall,
  ReplyGuidance,
  ModelInputMeasurement,
  ModelPrepareRequest,
} from '../structs/model/runtime.js';

/** @deprecated Use `ModelInteractionDefinition`. */
export type { ModelInteractionDefinition as ModelTransportDefinition } from '../structs/model/runtime.js';

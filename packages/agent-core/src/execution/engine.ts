/**
 * Bounded execution: the generic agent run loop and workflow driver.
 *
 * Two execution shapes share the round budget, cancellation and one diagnostic scope. A
 * `CoreStep` loop owns its own round counter and returns an explicit continue/complete
 * outcome; a bound workflow is traversed node by node, with routes selected after each
 * commit. Business rules, tools and models are injected by the host — this module only
 * enforces ordering, cancellation, budgets and reporting.
 *
 * Exports: `AgentCoreEngine` and the engine option/identity types.
 */
import { EngineCache, cacheContext, cachePort } from './cache.js';
import type { AgentCachePort } from '../structs/execution/cache.js';
import { ModelCallBudget, parentModelBudget } from '../model/call-budget.js';
import type { ModelResult } from '../structs/invocation.js';
import { ModelRunner } from '../model/runner.js';
import {
  compiledModelBinding,
  modelBindingId,
  snapshotModelBinding,
  type ModelBinding,
} from '../model/binding.js';
import type {
  ModelCallRequest,
  ModelRunnerOptions,
  ModelInteractionDefinition,
} from '../structs/model/runtime.js';
import type { ToolRegistry } from '../capabilities/tools.js';
import { getErrorInfo } from '../errors.js';
import { invocationId } from '../utils/invocation.js';
import { synchronous } from '../utils/synchronous.js';
import type { DiagnosticContext } from '../structs/diagnostics.js';
import type {
  AgentCoreEngineOptions,
  CoreStep,
  StepOutcome,
  LoopEvent,
} from '../structs/execution/engine.js';
import { AgentWorkflow, AttemptBudget, defineWorkflow } from './workflow.js';
import type {
  WorkflowContext,
  WorkflowModel,
  WorkflowEvent,
  WorkflowExtension,
  WorkflowFailure,
  WorkflowNodeReport,
} from '../structs/execution/workflow.js';
import { BudgetError, WorkflowContractError } from '../structs/errors.js';
import { requireWorkflowValue } from './state.js';
import { createEventScope, executionEvents, snapshotExecutionObserver } from './events.js';
import { awaitWithSignal, combineSignals, isTimeoutReason } from '../utils/cancellation.js';
import { breakWhile } from '../utils/rules.js';
import { NodeReports } from './reporting.js';
import { snapshotBranch } from './branch.js';

export * from './workflow.js';
export type * from '../structs/execution/cache.js';

/** Prepare every state write for an ordinary object, preserving existing property flags. */
function workflowStateWrites<State>(state: State, fields: Record<PropertyKey, unknown>) {
  const keys = Reflect.ownKeys(fields);
  if (keys.length === 0) return undefined;
  breakWhile(
    state === null || (typeof state !== 'object' && typeof state !== 'function'),
    () => new WorkflowContractError('Workflow state must be a mutable object'),
  );
  const extensible = Object.isExtensible(state);
  return Object.fromEntries(
    keys.map((key) => {
      const own = Object.getOwnPropertyDescriptor(state, key);
      let target = own;
      // Treat __proto__ as a data key without invoking the inherited prototype setter.
      if (!own && key !== '__proto__') {
        for (
          let parent = Object.getPrototypeOf(state);
          parent && !target;
          parent = Object.getPrototypeOf(parent)
        ) {
          target = Object.getOwnPropertyDescriptor(parent, key);
        }
      }
      breakWhile(
        (target && target.writable !== true) || (!own && !extensible),
        () => new WorkflowContractError(`Workflow state field is not writable: ${String(key)}`),
      );
      const descriptor = own
        ? { value: fields[key] }
        : Object.getOwnPropertyDescriptor(fields, key)!;
      return [key, descriptor];
    }),
  );
}

type InvokeTool = (
  request: import('../structs/capabilities/tools.js').ToolInvocationRequest,
) => Promise<import('../structs/invocation.js').ToolResult<unknown>>;
type ToolBinding = { invoke: InvokeTool } | Pick<ToolRegistry, 'invokeAsync'>;

/** The subset of a runner an engine may drive; kept small so the App can supply it. */
export type AgentModelRuntime = Pick<
  ModelRunner,
  'invoke' | 'prepare' | 'execution' | 'remainingCalls' | 'callCount' | 'totalCallCount'
> &
  Partial<Pick<ModelRunner, 'callBudget' | 'adjustCallBudget'>> & {
    /** Stable Runner bindings create request-local state; existing request runtimes return themselves. */
    bind?(execution: import('../structs/common.js').ExecutionOptions): AgentModelRuntime;
  };

/**
 * Model binding accepted by the engine.
 *
 * Execution scope belongs to the engine, so a bound model may not carry its own signal or
 * execution options.
 */
export type AgentModelBinding = ModelRunnerOptions & { execution?: never; signal?: never };

/**
 * Engine construction options.
 *
 * Combines round budget and error factories with exactly one model shape (a single bound
 * model or a named catalog), an optional tool runtime, an optional branch identity, and
 * an optional workflow together with its App dependencies.
 */
export type AgentCoreEngineSetup<State, Result, App = undefined> = AgentCoreEngineOptions & {
  readonly branch?: AgentBranch;
  readonly tools?: ToolBinding;
} & (
    | {
        model?: AgentModelBinding;
        models?: never;
      }
    | {
        model?: string;
        models: Readonly<Record<string, AgentModelBinding>>;
        maxModelCalls?: number;
      }
  ) &
  (
    | { workflow?: undefined; app?: never }
    | ({ readonly workflow: AgentWorkflow<State, Result, App> } & ([App] extends [undefined]
        ? { readonly app?: undefined }
        : { readonly app: App }))
  );

/**
 * Immutable identity of one branch of an agent.
 *
 * The three required ids are generated per engine unless the host restores a branch; the
 * optional ids are only present on a fork and record the exact origin, so a forked run
 * can be attributed without consulting external storage.
 */
export interface AgentBranch {
  /** Agent the branch belongs to. */
  readonly agentId: string;
  /** Branch identifier, unique within the agent. */
  readonly branchId: string;
  /** Agent version the branch was created from. */
  readonly agentVersionId: string;
  /** Parent branch id; present only for a fork. */
  readonly parentBranchId?: string;
  /** Agent version of the parent branch; present only for a fork. */
  readonly parentAgentVersionId?: string;
  /** Snapshot the branch was forked at; present only for a fork. */
  readonly forkPointId?: string;
}

/**
 * In-memory host-data snapshot with a copy-on-read accessor.
 *
 * The stored data is already a clone, and `read` clones again, so a caller cannot mutate
 * the snapshot by mutating what it read.
 */
export interface AgentSnapshot<Data> {
  /** Snapshot identifier, unique within the engine. */
  readonly id: string;
  /** Branch the snapshot was captured on. */
  readonly source: AgentBranch;
  /** @returns A fresh clone of the snapshot data. */
  read(): Data;
}
/**
 * Host-owned serializable data, never a saved credential, model budget or executable handler.
 */
export interface AgentSnapshotRecord<Data> {
  /** Snapshot identifier, preserved across export and restore. */
  readonly id: string;
  /** Validated branch identity captured at snapshot time. */
  readonly source: AgentBranch;
  /** Detached data payload; serializable by the host. */
  readonly data: Data;
}

/**
 * Bounded execution shared by applications; business rules are registered by each host.
 *
 * Configuration is bound before a run and may be bound only once per model, tool runtime
 * and workflow. A run resolves its signal from the engine, the request runtime and the
 * caller, then executes either the bound workflow or a supplied step function until the
 * round budget, cancellation or a completion stops it.
 */
export class AgentCoreEngine<Result, State = unknown, App = undefined> {
  /** Workflow catalog constructor, exposed so hosts do not import two modules. */
  static readonly Workflow = AgentWorkflow;
  /** Attempt budget, exposed for hosts that gate their own sub-steps. */
  static readonly AttemptBudget = AttemptBudget;
  /** Factory for a validated workflow definition. */
  static readonly createWorkflow = defineWorkflow;

  private readonly cacheMemory: EngineCache;
  private readonly serviceCache?: AgentCachePort;
  private readonly maxRounds: number;
  private readonly exhausted: () => Error;
  private readonly options: AgentCoreEngineOptions;

  private modelOptions?: ModelBinding;
  private modelRuntime?: AgentModelRuntime;
  private runtimeActive = false;
  private models?: ReadonlyMap<string, ModelBinding>;
  private selectedModelId?: string;
  private maxModelCalls?: number;

  /**
   * Compile model options and reject engine-owned settings.
   *
   * @param options - Model binding supplied to the engine.
   * @returns The compiled binding.
   * @throws TypeError When the binding carries its own execution scope.
   */
  private snapshotModel(options: AgentModelBinding): ModelBinding {
    if (options.execution || options.signal)
      throw new TypeError('Configure model execution on the Engine');
    return snapshotModelBinding(options);
  }

  /**
   * Bind the single model this engine will use.
   *
   * @param options - App model settings.
   * @returns This engine, for chaining.
   * @throws TypeError When a model is already bound or the settings are invalid.
   */
  bindModel(options: AgentModelBinding): this {
    if (this.modelOptions || this.models || this.modelRuntime)
      throw new TypeError('Engine already has a bound model');
    return this.setModel(options);
  }

  /**
   * Bind an existing request lifetime once, for App services sharing this Runner's budget.
   *
   * Callbacks are bound to the source runtime and the counters stay live getters, so the
   * engine and the App observe exactly the same budget and signal.
   *
   * @param source - Request model runtime owned by the App.
   * @returns This engine, for chaining.
   * @throws Error When another model is already bound or the runtime lacks a usable signal.
   */
  bindModelRuntime(source: AgentModelRuntime): this {
    breakWhile(
      !!this.modelOptions || !!this.models || !!this.modelRuntime,
      'Engine already has a bound model',
    );
    const execution = source.execution,
      invoke = source.invoke,
      prepare = source.prepare;
    breakWhile(
      typeof invoke !== 'function' ||
        typeof prepare !== 'function' ||
        typeof execution?.signal?.throwIfAborted !== 'function',
      'Invalid request model runtime',
    );
    const runtime: AgentModelRuntime = {
      ...(source.bind
        ? {
            bind: (execution: import('../structs/common.js').ExecutionOptions) => {
              const selected = source.bind!(execution);
              return selected === source ? runtime : selected;
            },
          }
        : {}),
      ...(source.adjustCallBudget
        ? {
            adjustCallBudget: source.adjustCallBudget.bind(source),
          }
        : {}),
      get callBudget() {
        return source.callBudget;
      },
      invoke: invoke.bind(source),
      prepare: prepare.bind(source),
      execution: Object.freeze({ signal: execution.signal, diagnostics: execution.diagnostics }),
      get remainingCalls() {
        return source.remainingCalls;
      },
      get callCount() {
        return source.callCount;
      },
      get totalCallCount() {
        return source.totalCallCount;
      },
    };
    this.modelRuntime = Object.freeze(runtime);
    return this;
  }

  /**
   * Select a configured model, or replace the single bound model's configuration.
   *
   * @param options - A configured model id, or new settings for the single bound model.
   * @returns This engine, for chaining.
   * @throws WorkflowContractError When the id is not configured.
   * @throws TypeError When no single model is bound to switch.
   */
  switchModel(options: AgentModelBinding | string): this {
    if (typeof options === 'string') {
      this.requireModel(options, this.models);
      this.selectedModelId = options;
      return this;
    }
    if (!this.modelOptions)
      throw new TypeError('Bind a single model before switching its configuration');
    return this.setModel(options);
  }

  /**
   * Look up a configured model by id.
   *
   * @param id - Configured model id.
   * @param models - Configured model map, when the engine uses a catalog.
   * @returns The compiled binding.
   * @throws WorkflowContractError When the id is not configured.
   */
  private requireModel(id: string, models?: ReadonlyMap<string, ModelBinding>): ModelBinding {
    const options = models?.get(id);
    if (!options) throw new WorkflowContractError(`Unknown configured model: ${id}`);
    return options;
  }

  /**
   * Compile and store the single bound model.
   *
   * @param options - App model settings.
   * @returns This engine, for chaining.
   */
  private setModel(options: AgentModelBinding): this {
    this.modelOptions = this.snapshotModel(options);
    return this;
  }

  private invokeTool?: InvokeTool;

  /**
   * Bind the tool runtime used by workflow context.
   *
   * @param tools - Registry exposing `invokeAsync`, or an object exposing `invoke`.
   * @returns This engine, for chaining.
   * @throws TypeError When tools are already bound or expose no invoke method.
   */
  bindToolRuntime(tools: ToolBinding): this {
    if (this.invokeTool) throw new TypeError('Engine already has a bound tool runtime');
    if (!tools || (typeof tools !== 'object' && typeof tools !== 'function'))
      throw new TypeError('Tool runtime requires an invoke method');
    const invoke = 'invokeAsync' in tools ? tools.invokeAsync : tools.invoke;
    if (typeof invoke !== 'function') throw new TypeError('Tool runtime requires an invoke method');
    this.invokeTool = invoke.bind(tools);
    return this;
  }

  private boundWorkflow?: { workflow: AgentWorkflow<State, Result, App>; app?: App };

  /**
   * Bind a workflow, narrowing the engine's state and App types.
   *
   * Binding changes the engine's type parameters without changing its identity, so the
   * same instance keeps its model, tools and branch.
   *
   * @param workflow - Workflow to execute.
   * @returns The same engine typed for the workflow's state.
   */
  bindWorkflow<NextState>(
    workflow: AgentWorkflow<NextState, Result, undefined>,
  ): AgentCoreEngine<Result, NextState, undefined>;
  /**
   * Bind a workflow together with its App dependencies.
   *
   * @param workflow - Workflow to execute.
   * @param app - Dependencies passed to every node and route as `context.app`.
   * @returns The same engine typed for the workflow's state and App.
   */
  bindWorkflow<NextState, NextApp>(
    workflow: AgentWorkflow<NextState, Result, NextApp>,
    app: NextApp,
  ): AgentCoreEngine<Result, NextState, NextApp>;
  bindWorkflow<NextState, NextApp>(
    workflow: AgentWorkflow<NextState, Result, NextApp>,
    app?: NextApp,
  ): AgentCoreEngine<Result, NextState, NextApp> {
    const engine = this as unknown as AgentCoreEngine<Result, NextState, NextApp>;
    engine.bind(workflow, app);
    return engine;
  }

  /**
   * Store the workflow and its dependencies.
   *
   * @param workflow - Workflow to execute.
   * @param app - App dependencies handed to every node and route.
   * @throws TypeError When a workflow is already bound.
   */
  private bind(workflow: AgentWorkflow<State, Result, App>, app?: App): void {
    if (this.boundWorkflow) throw new TypeError('Engine already has a bound workflow');
    this.boundWorkflow = { workflow, app };
  }

  /** The bound workflow. */
  get workflow(): AgentWorkflow<State, Result, App> {
    if (!this.boundWorkflow) throw new TypeError('Engine has no bound workflow');
    return this.boundWorkflow.workflow;
  }

  // A default identity is generated eagerly so checkpoints taken before a run still carry
  // a stable branch, and a forked engine can point at the parent's ids.
  private branchIdentity: AgentBranch = Object.freeze({
    agentId: invocationId(),
    branchId: invocationId(),
    agentVersionId: invocationId(),
  });
  // Membership test for checkpoints: a checkpoint object from another engine (or a
  // hand-built lookalike) must not be accepted as if it proved branch ownership.
  private readonly checkpoints = new WeakSet<object>();

  /** Identity of this engine's branch. */
  get branch(): AgentBranch {
    return this.branchIdentity;
  }

  /** @deprecated Use snapshot. Captures data only, not an execution cursor. */
  checkpoint<Data>(data: Data): AgentSnapshot<Data> {
    return this.snapshot(data);
  }
  /** @deprecated Use exportSnapshot. */
  exportCheckpoint<Data>(value: AgentSnapshot<Data>): AgentSnapshotRecord<Data> {
    return this.exportSnapshot(value);
  }
  /** @deprecated Use restoreSnapshot. Restores data and branch identity only. */
  restoreCheckpoint<Data>(value: AgentSnapshotRecord<Data>): AgentSnapshot<Data> {
    return this.restoreSnapshot(value);
  }

  /**
   * Capture host-owned data without an execution cursor or live dependencies.
   * Data is cloned on capture and on every read.
   * @param data Serializable host data to capture.
   * @returns A snapshot bound to this branch.
   */
  snapshot<Data>(data: Data): AgentSnapshot<Data> {
    const snapshot = structuredClone(data);
    const checkpoint = Object.freeze({
      id: invocationId(),
      source: this.branch,
      read: () => structuredClone(snapshot),
    });
    this.checkpoints.add(checkpoint);
    return checkpoint;
  }

  /**
   * Export a host-data snapshot for host-owned persistence.
   *
   * @param checkpoint - Snapshot captured by this engine.
   * @returns A serializable record with a validated branch identity.
   * @throws Error When the snapshot belongs to another engine.
   */
  exportSnapshot<Data>(checkpoint: AgentSnapshot<Data>): AgentSnapshotRecord<Data> {
    breakWhile(!this.checkpoints.has(checkpoint), 'Checkpoint belongs to another branch');
    return {
      id: checkpoint.id,
      source: snapshotBranch(checkpoint.source),
      data: checkpoint.read(),
    };
  }

  /**
   * Recreate a host-data snapshot from a persisted record.
   *
   * The record's branch must match this engine's branch exactly; otherwise persisted data
   * from another branch would be adopted silently.
   *
   * @param record - Record produced by `exportSnapshot`.
   * @returns A snapshot bound to this engine.
   * @throws Error When the id is invalid or the branch identity differs.
   */
  restoreSnapshot<Data>(record: AgentSnapshotRecord<Data>): AgentSnapshot<Data> {
    const source = snapshotBranch(record.source);
    breakWhile(
      typeof record.id !== 'string' ||
        !record.id.trim() ||
        record.id.length > 200 ||
        JSON.stringify(source) !== JSON.stringify(snapshotBranch(this.branch)),
      'Checkpoint identity does not match the restored branch',
    );
    const data = structuredClone(record.data);
    const checkpoint = Object.freeze({ id: record.id, source, read: () => structuredClone(data) });
    this.checkpoints.add(checkpoint);
    return checkpoint;
  }

  /**
   * Create an engine on a new branch forked at a host-data snapshot.
   *
   * The forked engine keeps the round budget, observation and configuration, receives an
   * optional workflow extension, and gets a new branch identity whose parent ids point at
   * this engine. Live handles are not copied: an App dependency, request runtime or tool
   * runtime must be restored by the `resume` callback, because they cannot be serialized.
   *
   * @param request.at - Snapshot captured by this engine to fork from.
   * @param request.workflow - Optional extension or replacement workflow.
   * @param request.routes - Route overrides; only valid with a workflow instance.
   * @param request.resume - Receives the snapshot data and returns restored dependencies.
   * @returns A new engine on the forked branch.
   * @throws TypeError When the snapshot is foreign or the App dependency is missing.
   * @throws Error When a bound request runtime or tool runtime was not restored.
   */
  fork<Data>({
    at,
    workflow,
    routes,
    resume,
  }: {
    at: AgentSnapshot<Data>;
    workflow?: AgentWorkflow<State, Result, App> | WorkflowExtension<State, Result, App>;
    routes?: WorkflowExtension<State, Result, App>['routes'];
    resume?: (checkpoint: Data) => {
      app?: App;
      tools?: ToolBinding;
      model?: AgentModelRuntime;
      agentCache?: AgentCachePort;
    };
  }): AgentCoreEngine<Result, State, App> {
    if (!this.boundWorkflow) throw new TypeError('Engine has no bound workflow');
    if (!this.checkpoints.has(at))
      throw new TypeError('Fork requires a checkpoint from this branch');
    if (routes && !(workflow instanceof AgentWorkflow))
      throw new TypeError('Use routes with a Workflow instance');
    const definition = workflow ? this.workflow.add(workflow, routes) : this.workflow;
    const dependencies = resume?.(at.read());
    if (this.boundWorkflow.app !== undefined && dependencies?.app === undefined) {
      throw new TypeError('Fork requires restored App dependencies');
    }
    breakWhile(
      !!this.modelRuntime && !dependencies?.model,
      'Fork requires a restored request model runtime',
    );
    breakWhile(!!this.invokeTool && !dependencies?.tools, 'Fork requires a restored tool runtime');
    const engine = new AgentCoreEngine<Result, State, App>({
      maxRounds: this.maxRounds,
      cache: this.options.cache,
      agentCache: dependencies?.agentCache,
      errors: { exhausted: this.exhausted },
      execution: {
        diagnostics: this.options.execution?.diagnostics,
        observe: this.options.execution?.observe,
      },
    });
    engine.bind(definition, dependencies?.app);
    if (dependencies?.tools) engine.bindToolRuntime(dependencies.tools);
    if (dependencies?.model) engine.bindModelRuntime(dependencies.model);
    else {
      engine.modelOptions = this.modelOptions;
      engine.models = this.models;
      engine.selectedModelId = this.selectedModelId;
      engine.maxModelCalls = this.maxModelCalls;
    }
    engine.branchIdentity = Object.freeze({
      agentId: this.branch.agentId,
      branchId: engine.branch.branchId,
      agentVersionId: engine.branch.agentVersionId,
      parentBranchId: this.branch.branchId,
      parentAgentVersionId: this.branch.agentVersionId,
      forkPointId: at.id,
    });
    return engine;
  }

  /**
   * Build an engine and validate its wiring.
   *
   * Legacy top-level names (`maxSteps`, `exhausted`, `signal`, `diagnostics`,
   * `onWorkflowEvent`, `observe`) are rejected rather than ignored, because silently
   * dropping them would change budgets or observation.
   *
   * @param settings - Round budget, errors, execution scope, model, tools, workflow and branch.
   * @throws TypeError When settings are invalid, removed names are used, or model wiring is
   * inconsistent.
   */
  constructor(settings: AgentCoreEngineSetup<State, Result, App> = {}) {
    if (
      !settings ||
      typeof settings !== 'object' ||
      ['maxSteps', 'exhausted', 'signal', 'diagnostics', 'onWorkflowEvent', 'observe'].some(
        (key) => key in settings,
      )
    ) {
      throw new TypeError('Use maxRounds, execution (including observe) and errors');
    }
    this.cacheMemory = new EngineCache(settings.cache);
    this.serviceCache = cachePort(settings.agentCache);
    const execution = settings.execution;
    if (settings.branch !== undefined) this.branchIdentity = snapshotBranch(settings.branch);
    const observer = execution?.observe;
    this.maxRounds = settings.maxRounds ?? 8;
    this.exhausted =
      settings.errors?.exhausted?.bind(settings.errors) ??
      (() => new BudgetError('Agent round budget exhausted'));
    this.options = {
      cache: { ...settings.cache },
      execution: {
        signal: execution?.signal,
        diagnostics: execution?.diagnostics,
        observe: observer && snapshotExecutionObserver(observer),
      },
    };
    breakWhile(
      !Number.isSafeInteger(this.maxRounds) || this.maxRounds < 1,
      () => new TypeError('maxRounds must be a positive safe integer'),
    );
    if (settings.workflow) this.bind(settings.workflow, settings.app);
    if (settings.tools !== undefined) this.bindToolRuntime(settings.tools);
    if (settings.models) {
      if (settings.model !== undefined && typeof settings.model !== 'string') {
        throw new TypeError('Use a model ID with configured models');
      }
      const models = Object.entries(settings.models);
      if (!models.length || models.some(([id]) => !id.trim()))
        throw new TypeError('Configure at least one named model');
      this.models = new Map(models.map(([id, config]) => [id, this.snapshotModel(config)]));
      const selectedModelId = settings.model ?? (models.length === 1 ? models[0][0] : undefined);
      if (selectedModelId !== undefined) this.requireModel(selectedModelId, this.models);
      this.selectedModelId = selectedModelId;
      this.maxModelCalls = settings.maxModelCalls;
      if (this.maxModelCalls !== undefined) new ModelCallBudget(this.maxModelCalls);
    } else if (settings.model !== undefined) {
      if (typeof settings.model === 'string')
        throw new TypeError(`Unknown configured model: ${settings.model}`);
      this.bindModel(settings.model);
    }
  }

  /**
   * Run the loop with a step function when no workflow is bound.
   *
   * @param step - Receives the round index and context; returns continue or complete.
   * @param options - Optional caller signal; a model id requires a bound workflow.
   * @returns The value of the completing step.
   */
  run(step: CoreStep<Result>, options?: { signal?: AbortSignal; modelId?: never }): Promise<Result>;
  /**
   * Run a bound workflow from an initial state.
   *
   * @param state - Initial workflow state; node updates are committed into it.
   * @param options - Optional caller signal and per-run model id.
   * @returns The workflow result.
   */
  run(state: State, options?: { signal?: AbortSignal; modelId?: string }): Promise<Result>;
  async run(
    input: State | CoreStep<Result>,
    options?: { signal?: AbortSignal; modelId?: string },
  ): Promise<Result> {
    breakWhile(
      !!this.modelRuntime && !this.modelRuntime.bind && this.runtimeActive,
      'Request model runtime does not permit concurrent Workflow runs',
    );
    const boundRuntime = this.modelRuntime?.bind ? undefined : this.modelRuntime;
    if (boundRuntime) this.runtimeActive = true;
    try {
      if (this.boundWorkflow) {
        const { workflow, app } = this.boundWorkflow;
        return await this.executeWorkflow(
          workflow,
          input as State,
          app,
          options?.signal,
          options?.modelId,
        );
      }
      if (typeof input !== 'function')
        throw new TypeError('Bind a workflow before running with state');
      if (options?.modelId !== undefined)
        throw new WorkflowContractError('modelId requires a bound workflow');
      return await this.runLoop(input as CoreStep<Result>, options?.signal);
    } finally {
      if (boundRuntime) this.runtimeActive = false;
    }
  }

  /**
   * Resolve the lifetime of one run.
   *
   * All three sources are lifetime bounds only, so the strictest wins and no source can
   * extend another.
   *
   * @param requestSignal - Caller-supplied signal for this run.
   * @returns The combined signal.
   */
  private executionSignal(requestSignal?: AbortSignal): AbortSignal {
    return combineSignals(
      this.options.execution?.signal,
      this.modelRuntime?.execution.signal,
      requestSignal,
    );
  }

  /**
   * Resolve the observation scope for one run.
   *
   * A bound request runtime contributes its scope only when the engine has none, so one
   * fact source serves both the App and the engine.
   *
   * @returns Execution options with the effective diagnostic scope.
   */
  private executionOptions(): import('../structs/common.js').ExecutionOptions {
    return {
      ...this.options.execution,
      diagnostics: this.options.execution?.diagnostics ?? this.modelRuntime?.execution.diagnostics,
    };
  }

  /**
   * Drive a caller-supplied step function until it completes or the budget ends.
   *
   * Each iteration is a round: the step must return an explicit continue/complete outcome,
   * the continue path owns the round limit, and a report scope always closes before the
   * next round starts. Failures leave the loop and are rethrown after the scope closes.
   *
   * @param step - Step implementation receiving the round index and context.
   * @param requestSignal - Caller signal for this run.
   * @returns The value of the completing step.
   * @throws WorkflowContractError When the step returns something other than continue/complete.
   * @throws The configured exhausted error, the step's failure, or the signal reason.
   */
  private async runLoop(step: CoreStep<Result>, requestSignal?: AbortSignal): Promise<Result> {
    const signal = this.executionSignal(requestSignal);
    const events = executionEvents(this.executionOptions());
    // The continue path owns the round limit. Completion returns immediately;
    // failures leave the loop and propagate after the report scope closes.
    let failure: unknown;
    for (let index = 0; ; index++) {
      const diagnostics = events?.child(invocationId(), {
        nodeRole: 'loop-step',
        definitionKind: 'loop',
        definitionId: 'loop',
        nodeId: 'step',
        nodeName: 'step',
        nodeKind: 'loop-step',
      });
      const reports = new NodeReports(diagnostics, signal, 'loop.event');
      let phase: LoopEvent['phase'] = 'boundary';
      try {
        signal.throwIfAborted();
        this.emitLoop({ type: 'enter', roundIndex: index }, diagnostics);
        phase = 'run';
        signal.throwIfAborted();
        const result = await awaitWithSignal(
          step(index, {
            ...cacheContext(this.cacheMemory, this.serviceCache, '$step', signal),
            signal,
            diagnostics,
            report: reports.report.bind(reports),
            createStepRecorder: reports.createStepRecorder.bind(reports),
            createSubFlowLogger: reports.createStepRecorder.bind(reports),
          }),
          signal,
        );
        signal.throwIfAborted();
        if (
          !result ||
          (typeof result !== 'object' && typeof result !== 'function') ||
          (result.type !== 'continue' && result.type !== 'complete') ||
          (result.type === 'complete' && !('value' in result))
        )
          throw new WorkflowContractError(
            'Loop steps must return explicit continue/complete outcomes',
          );
        if (result.type === 'complete') {
          const value = result.value;
          signal.throwIfAborted();
          this.emitLoop({ type: 'complete', roundIndex: index }, diagnostics, reports);
          return value;
        }
        if (index + 1 >= this.maxRounds) {
          phase = 'budget';
          throw this.exhausted();
        }
        this.emitLoop({ type: 'continue', roundIndex: index }, diagnostics, reports);
      } catch (error) {
        this.emitLoop(
          { type: 'error', roundIndex: index, phase, errorCode: this.errorCode(error, signal) },
          diagnostics,
          reports,
        );
        failure = error;
        break;
      } finally {
        reports.close();
      }
    }
    throw failure;
  }

  /**
   * Traverse a workflow node by node.
   *
   * Per visit the order is fixed: cancellation and round-budget checks, `requires`
   * validation, the node handler, commit of `provides`, route selection, then either
   * completion or transition. Failures are reported before any recovery decision, and only
   * non-aborted, non-contract failures may follow `onErrorNodeId`; anything else propagates.
   *
   * @param workflow - Validated workflow catalog.
   * @param state - Initial state; mutated in place by commits.
   * @param app - Host dependencies exposed as `context.app`.
   * @param requestSignal - Caller signal for this run.
   * @param requestModelId - Per-run configured model override.
   * @returns The workflow result.
   * @throws WorkflowContractError for contract violations, or the node failure otherwise.
   */
  private async executeWorkflow<State, App>(
    workflow: AgentWorkflow<State, Result, App>,
    state: State,
    app: App | undefined,
    requestSignal?: AbortSignal,
    requestModelId?: string,
  ): Promise<Result> {
    const signal = this.executionSignal(requestSignal);
    const invokeTool = this.invokeTool;
    const workflowInvocationId = invocationId();
    // The execution scope also correlates content delivery when no observer or log is installed.
    const workflowDiagnostics = (
      executionEvents(this.executionOptions()) ?? createEventScope()
    ).child(workflowInvocationId, {
      ...this.branch,
      invocationId: workflowInvocationId,
      workflowInvocationId,
      nodeRole: 'invocation',
      definitionKind: 'workflow',
      definitionId: workflow.id,
      definitionRevision: workflow.revision,
    });
    const modelOptions = this.modelOptions;
    const models = this.models;
    const selectedModelId = requestModelId ?? this.selectedModelId;
    if (requestModelId !== undefined) this.requireModel(requestModelId, models);
    const budget =
      this.maxModelCalls === undefined ? undefined : new ModelCallBudget(this.maxModelCalls);
    const modelRuntime =
      this.modelRuntime?.bind?.({ signal, diagnostics: workflowDiagnostics }) ?? this.modelRuntime;
    const sharedRuntime = modelRuntime !== undefined && modelRuntime === this.modelRuntime;
    // Opaque request runtimes were guarded by run(); bind-capable request runtimes are guarded here.
    const guardRuntime = sharedRuntime && !!this.modelRuntime?.bind;
    breakWhile(
      guardRuntime && this.runtimeActive,
      'Request model runtime does not permit concurrent Workflow runs',
    );
    if (guardRuntime) this.runtimeActive = true;
    try {
      const runners = new Map<string | undefined, ModelRunner>();
      const preparedOwners = new WeakMap<
        import('../structs/model/runtime.js').PreparedModelCall,
        { runner: AgentModelRuntime; modelId?: string }
      >();
      const runnerFor = (modelId = selectedModelId): AgentModelRuntime => {
        if (modelRuntime) {
          breakWhile(modelId !== undefined, 'Request model runtime has no registered model IDs');
          return modelRuntime;
        }
        const options = modelId === undefined ? modelOptions : this.requireModel(modelId, models);
        if (!options) throw new WorkflowContractError('Select a configured modelId');
        let runner = runners.get(modelId);
        if (!runner) {
          const setup = {
            provider: options.provider,
            [compiledModelBinding]: options,
            [modelBindingId]: modelId,
            [parentModelBudget]: budget,
            execution: { signal, diagnostics: workflowDiagnostics },
          };
          runner = new ModelRunner(setup);
          runners.set(modelId, runner);
        }
        return runner;
      };
      let nextVisitId = invocationId();
      let target = workflow.entryNodeId;
      let rounds = 0;
      let round = -1;
      let failure: WorkflowFailure | undefined;
      for (;;) {
        const node = workflow.require(target);
        try {
          signal.throwIfAborted();
          if (node.startsRound && rounds >= this.maxRounds) throw this.exhausted();
        } catch (error) {
          const diagnostics = workflowDiagnostics?.child(nextVisitId, {
            nodeRole: 'workflow-boundary',
            definitionKind: 'workflow',
            definitionId: workflow.id,
            definitionRevision: workflow.revision,
            nodeId: node.id,
            workflowNodeId: node.id,
            nodeName: node.name ?? node.id,
            nodeKind: 'workflow-node',
            nodeDescription: node.description.slice(0, 1024),
          });
          this.emit(
            {
              ...this.branch,
              workflowId: workflow.id,
              workflowInvocationId,
              nodeId: node.id,
              roundIndex: round,
              ...diagnostics?.identity,
              type: 'error',
              phase: 'boundary',
              errorCode: this.errorCode(error, signal),
            },
            diagnostics,
          );
          throw error;
        }
        if (node.startsRound) round = rounds++;
        const started = Date.now();
        const nodeDiagnostics = workflowDiagnostics?.child(nextVisitId, {
          nodeRole: 'workflow-node',
          definitionKind: 'workflow',
          definitionId: workflow.id,
          definitionRevision: workflow.revision,
          nodeId: node.id,
          workflowNodeId: node.id,
          nodeName: node.name ?? node.id,
          nodeKind: 'workflow-node',
          nodeDescription: node.description.slice(0, 1024),
          invocationId: undefined,
          stageId: undefined,
        });
        const event = {
          ...this.branch,
          workflowId: workflow.id,
          workflowInvocationId,
          errorEventId: failure?.errorEventId,
          nodeId: node.id,
          roundIndex: round,
          ...(nodeDiagnostics?.identity
            ? {
                runId: nodeDiagnostics.identity.runId,
                spanId: nodeDiagnostics.identity.spanId,
                parentSpanId: nodeDiagnostics.identity.parentSpanId,
              }
            : {}),
        };
        function invokeModel<Value>(
          request: ModelCallRequest<never> & {
            prepared: import('../structs/model/runtime.js').PreparedModelCall<Value>;
            modelId?: string;
          },
        ): Promise<ModelResult<Value>>;
        function invokeModel(
          request: ModelCallRequest<never> & { modelId?: string },
        ): Promise<ModelResult<string>>;
        function invokeModel<Value>(
          request: ModelCallRequest<ModelInteractionDefinition<Value>> &
            (
              | {
                  interaction: ModelInteractionDefinition<Value>;
                  transport?: ModelInteractionDefinition<Value>;
                }
              | {
                  transport: ModelInteractionDefinition<Value>;
                  interaction?: ModelInteractionDefinition<Value>;
                }
            ) & { modelId?: string },
        ): Promise<ModelResult<Value>>;
        function invokeModel(
          request: ModelCallRequest<string | ModelInteractionDefinition> & { modelId?: string },
        ): Promise<ModelResult<unknown>>;
        function invokeModel(
          request: ModelCallRequest<string | ModelInteractionDefinition> & { modelId?: string },
        ): Promise<ModelResult<unknown>> {
          signal.throwIfAborted();
          const owner = request.prepared && preparedOwners.get(request.prepared);
          if (
            request.prepared &&
            (!owner || (request.modelId !== undefined && request.modelId !== owner.modelId))
          )
            throw new WorkflowContractError(
              'Prepared model call belongs to another execution or model',
            );
          const runner = owner?.runner ?? runnerFor(request.modelId);
          return runner.invoke({
            logger: request.logger,
            stageId: request.stageId,
            maxOutputTokens: request.maxOutputTokens,
            interaction: request.interaction,
            transport: request.transport,
            prepared: request.prepared,
            modelOptions: request.modelOptions,
            replyGuidance: request.replyGuidance,
            signal: combineSignals(signal, request.signal),
            diagnostics: nodeDiagnostics,
            ...(typeof request.input === 'string'
              ? { input: request.input, instructions: request.instructions }
              : { input: request.input }),
          });
        }
        const prepareModel = ((
          request: import('../structs/model/runtime.js').ModelPrepareRequest<
            string | ModelInteractionDefinition
          > & { modelId?: string } = {},
        ) => {
          signal.throwIfAborted();
          const runner = runnerFor(request.modelId);
          const snapshot = runner.prepare({
            replyGuidance: request.replyGuidance,
            stageId: request.stageId,
            maxOutputTokens: request.maxOutputTokens,
            interaction: request.interaction,
            transport: request.transport,
          });
          preparedOwners.set(snapshot, { runner, modelId: request.modelId ?? selectedModelId });
          return snapshot;
        }) as WorkflowModel['prepare'];
        const reports = new NodeReports(nodeDiagnostics, signal);
        const context: WorkflowContext<App> = {
          ...cacheContext(this.cacheMemory, this.serviceCache, node.id, signal),
          report: reports.report.bind(reports),
          createStepRecorder: reports.createStepRecorder.bind(reports),
          createSubFlowLogger: reports.createStepRecorder.bind(reports),
          roundIndex: round,
          app: app as Readonly<App>,
          signal,
          diagnostics: nodeDiagnostics,
          model: {
            get callBudget() {
              return runnerFor().callBudget;
            },
            adjustCallBudget(request) {
              signal.throwIfAborted();
              const runner = runnerFor();
              if (!runner.adjustCallBudget)
                throw new WorkflowContractError('Model runtime does not support budget adjustment');
              return runner.adjustCallBudget(request);
            },
            invoke: invokeModel,
            prepare: prepareModel,
            get remainingCalls() {
              return runnerFor().remainingCalls;
            },
            get callCount() {
              return runnerFor().callCount;
            },
            get totalCallCount() {
              return runnerFor().totalCallCount;
            },
          },
          tools: {
            async invoke(request) {
              const toolSignal = combineSignals(signal, request.signal);
              toolSignal.throwIfAborted();
              if (!invokeTool) throw new WorkflowContractError('Engine has no bound tool runtime');
              const result = await awaitWithSignal(
                invokeTool({ ...request, signal: toolSignal, diagnostics: nodeDiagnostics }),
                toolSignal,
              );
              toolSignal.throwIfAborted();
              return result;
            },
          },
          ...(failure ?? {}),
        };
        this.emit({ ...event, type: 'enter' }, nodeDiagnostics);
        let phase: NonNullable<WorkflowEvent['phase']> = 'requires';
        let selectedRoute: (typeof node.routes)[number] | undefined;
        let update: Partial<State> | void;
        try {
          signal.throwIfAborted();
          for (const field of node.requires ?? []) requireWorkflowValue(state, field);
          signal.throwIfAborted();
          phase = 'run';
          update = await awaitWithSignal(node.run?.(state, context), signal);
          signal.throwIfAborted();
          phase = 'provides';
          this.commit(state, update, node.provides ?? [], signal);
          phase = 'route';
          const routeIndex = node.routes.findIndex((route) => {
            selectedRoute = route;
            if (!route.when) return true;
            const value = route.when(state, context);
            try {
              synchronous(value, 'Workflow predicates must be synchronous');
            } catch {
              throw new WorkflowContractError('Workflow predicates must be synchronous');
            }
            if (typeof value !== 'boolean')
              throw new WorkflowContractError('Workflow predicates must return boolean');
            signal.throwIfAborted();
            return value;
          });
          if (routeIndex < 0)
            throw new WorkflowContractError(`No matching workflow route: ${node.id}`);
          const route = node.routes[routeIndex];
          signal.throwIfAborted();
          if (route.complete) {
            phase = 'complete';
            const result = route.complete(state, context);
            try {
              synchronous(result, 'Workflow completions must be synchronous');
            } catch {
              throw new WorkflowContractError('Workflow completions must be synchronous');
            }
            signal.throwIfAborted();
            phase = 'result';
            const valid = workflow.isResult ? workflow.isResult(result) : true;
            try {
              synchronous(valid, 'Workflow result predicates must be synchronous');
            } catch {
              throw new WorkflowContractError('Workflow result predicates must be synchronous');
            }
            if (valid !== true)
              throw new WorkflowContractError(`Invalid workflow result: ${workflow.id}`);
            signal.throwIfAborted();
            this.emit(
              {
                ...event,
                type: 'complete',
                route: routeIndex,
                routeId: route.id,
                conditionId: route.conditionId,
                durationMs: Date.now() - started,
              },
              nodeDiagnostics,
              node.report ? () => node.report!(structuredClone(update), context) : undefined,
              reports,
            );
            return result;
          }
          nextVisitId = invocationId();
          this.emit(
            {
              ...event,
              targetSpanId: workflowDiagnostics?.identity
                ? `${workflowDiagnostics.identity.spanId}/${nextVisitId}`
                : undefined,
              type: 'transition',
              targetNodeId: route.targetNodeId,
              route: routeIndex,
              routeId: route.id,
              conditionId: route.conditionId,
              durationMs: Date.now() - started,
            },
            nodeDiagnostics,
            node.report ? () => node.report!(structuredClone(update), context) : undefined,
            reports,
          );
          target = route.targetNodeId!;
          failure = undefined;
        } catch (error) {
          const recoverable = !signal.aborted && !(error instanceof WorkflowContractError);
          if (recoverable && node.onErrorNodeId !== undefined) nextVisitId = invocationId();
          const errorEvent = this.emit(
            {
              ...event,
              targetSpanId:
                recoverable && node.onErrorNodeId !== undefined && workflowDiagnostics?.identity
                  ? `${workflowDiagnostics.identity.spanId}/${nextVisitId}`
                  : undefined,
              type: 'error',
              targetNodeId: recoverable ? node.onErrorNodeId : undefined,
              routeId: recoverable ? node.onErrorRouteId : undefined,
              phase,
              failedRouteId: ['route', 'complete', 'result'].includes(phase)
                ? selectedRoute?.id
                : undefined,
              conditionId: phase === 'route' ? selectedRoute?.conditionId : undefined,
              durationMs: Date.now() - started,
              errorCode: this.errorCode(error, signal),
            },
            nodeDiagnostics,
            undefined,
            reports,
          );
          signal.throwIfAborted();
          if (node.onErrorNodeId === undefined || error instanceof WorkflowContractError)
            throw error;
          failure = { error, errorEventId: errorEvent.eventId };
          target = node.onErrorNodeId;
        } finally {
          reports.close();
        }
      }
    } finally {
      if (guardRuntime) this.runtimeActive = false;
    }
  }

  /**
   * Merge a node's state update and assert its declared outputs.
   *
   * Read the update once, check `provides` on the merged view and validate every write
   * against the mutable state object before applying any field. Check cancellation last.
   *
   * @param state - State mutated in place.
   * @param update - Object returned by the node handler, or undefined for no change.
   * @param provides - Fields the node promises to leave defined.
   * @param signal - Signal checked immediately before writing.
   * @throws WorkflowContractError When the update is not an object, a provided field is
   * undefined, or a field cannot be written as data.
   */
  private commit<State>(
    state: State,
    update: void | Partial<State>,
    provides: readonly (keyof State & string)[],
    signal: AbortSignal,
  ): void {
    if (update !== undefined && (!update || typeof update !== 'object' || Array.isArray(update))) {
      throw new WorkflowContractError(
        'Workflow handlers must return a state update object or undefined',
      );
    }
    // Read accessors once: output checks and the eventual commit use the same values.
    const fields =
      update === undefined ? undefined : ({ ...update } as Record<PropertyKey, unknown>);
    const next = fields === undefined ? state : { ...state, ...fields };
    for (const field of provides) requireWorkflowValue(next, field);
    const writes = fields === undefined ? undefined : workflowStateWrites(state, fields);
    signal.throwIfAborted();
    if (writes !== undefined) Object.defineProperties(state, writes);
  }

  /**
   * Publish one loop event.
   *
   * The report scope is closed before emission for every event type, including `enter`,
   * so a step cannot report progress against a round that has already ended.
   *
   * @param event - Loop event without its id.
   * @param diagnostics - Scope of the current round.
   * @param reports - Report scope for the current round.
   */
  private emitLoop(
    event: Omit<LoopEvent, 'eventId'>,
    diagnostics?: DiagnosticContext,
    reports?: NodeReports,
  ): void {
    const record = Object.freeze({ ...event, eventId: invocationId() });
    reports?.close();
    diagnostics?.emit('loop.event', () => record, reports?.debug());
  }

  /**
   * Publish one workflow event and attach the node's report when content is enabled.
   *
   * The event is always emitted, even if the report throws or is malformed; a report is
   * optional evidence, while the event is the authoritative transition record.
   *
   * @param input - Event fields without its id.
   * @param diagnostics - Scope of the current node visit.
   * @param report - Optional report builder evaluated only when content is enabled.
   * @param reports - Report scope closed after emission.
   * @returns The frozen event, so callers can reference its id.
   */
  private emit(
    input: Omit<WorkflowEvent, 'eventId'>,
    diagnostics: DiagnosticContext | undefined,
    report?: () => WorkflowNodeReport,
    reports?: NodeReports,
  ): Readonly<WorkflowEvent> {
    const event = Object.freeze({ ...input, eventId: invocationId() });
    let detail: WorkflowNodeReport | undefined;
    if (
      report &&
      diagnostics?.enabled('workflow.event') &&
      diagnostics.enabled('workflow.event', 'content')
    ) {
      try {
        const result = synchronous(report(), 'Workflow reports must be synchronous');
        reports?.receive(result);
        detail = { payload: structuredClone(result.payload) };
      } catch {
        /* A report cannot suppress the workflow event. */
      }
    }
    reports?.close();
    diagnostics?.emit(
      'workflow.event',
      () => ({ event, ...(detail?.payload === undefined ? {} : { payload: detail.payload }) }),
      reports?.debug(),
    );
    return event;
  }

  /**
   * Classify a failure for reporting.
   *
   * Cancellation takes precedence over the error itself: once the signal is aborted, the
   * reason matters more than whatever the interrupted code threw.
   *
   * @param error - Failure to classify.
   * @param signal - Execution signal at the time of failure.
   * @returns `TIMEOUT`, `CANCELLED`, or the error's own code.
   */
  private errorCode(error: unknown, signal?: AbortSignal): string {
    if (signal?.aborted) return isTimeoutReason(signal.reason) ? 'TIMEOUT' : 'CANCELLED';
    return getErrorInfo(error).code;
  }
}

// Re-exported so hosts configuring an engine do not import the struct module directly.
export type {
  CoreStep,
  StepOutcome,
  LoopEvent,
  AgentCoreEngineOptions,
} from '../structs/execution/engine.js';

export type * from '../structs/execution/workflow-views.js';

/** @deprecated Use `AgentSnapshot`. Kept as a 0.9 compatibility alias. */
export type { AgentSnapshot as AgentCheckpoint };

/** @deprecated Use `AgentSnapshotRecord`. Kept as a 0.9 compatibility alias. */
export type { AgentSnapshotRecord as AgentCheckpointRecord };

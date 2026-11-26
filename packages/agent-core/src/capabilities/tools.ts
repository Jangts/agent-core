/**
 * Core tool registry: the mechanism that turns registered tools into invoked tools.
 *
 * `ToolRegistry` owns identity, registration-time validation, cancellation, diagnostics,
 * output parsing and success/failure bookkeeping. It deliberately knows nothing about
 * visibility, authorization policy or domain metadata: those are App registrations, and
 * `authorize` is called by the typed bridge in `tool-runtime.js`.
 *
 * `invoke` requires a synchronous tool; `invokeAsync` awaits thenables. Both reject an
 * unknown tool and report through the ports bound at construction.
 *
 * Exports: `ToolRegistry`, `executeInvocation`, and the tool/invocation contracts.
 */
import { nativeReportedStepSync, nativeReportedStepAsync } from '../diagnostics/native-sub-flow.js';
import { executionEvents } from '../execution/events.js';
import {
  invocationId as nextInvocationId,
  invocationResult,
  toolInvocation,
} from '../utils/invocation.js';
import type { ToolResult } from '../structs/invocation.js';
import { synchronous } from '../utils/synchronous.js';
import { awaitWithSignal, combineSignals } from '../utils/cancellation.js';
import { diagnosticError } from '../diagnostics/index.js';
import { registrationData } from '../utils/registration.js';
import { NodeReports } from '../execution/reporting.js';
import type {
  ErasedTool,
  RegisteredTool,
  ToolExecutionEvent,
  ToolRegistryPorts,
  ToolRegistryOptions,
  ToolInvocationRequest,
} from '../structs/capabilities/tools.js';

/**
 * Registry mechanism only: visibility, authorization policy, schemas and semantic metadata
 * are host registrations. A registry is mutable until sealed and keeps its own call log.
 */
export class ToolRegistry<Tool extends ErasedTool = ErasedTool> {
  /** Insertion order is the declaration order and is preserved by every enumeration below. */
  private readonly tools = new Map<string, RegisteredTool<Tool>>();
  /** Sealing is one-way: a running stage must not add tools to the registry it executes. */
  private sealed = false;

  /** In-memory execution facts for this registry's lifetime, one entry per completed call. */
  private readonly executionEvents: ToolExecutionEvent<Tool['kind']>[] = [];
  /** Frozen snapshot of the recorded execution facts. */
  get events(): readonly Readonly<ToolExecutionEvent<Tool['kind']>>[] {
    return Object.freeze([...this.executionEvents]);
  }
  private diagnostics: ToolRegistryPorts['diagnostics'];
  private readonly ports: ToolRegistryPorts;
  /**
   * @param options.execution Request-lifetime signal plus the diagnostics/observer source the
   *   registry starts from.
   * @param options.errors Factories for the unknown-tool error and for failure codes.
   */
  constructor({ execution, errors }: ToolRegistryOptions = {}) {
    this.ports = {
      signal: execution?.signal,
      diagnostics: executionEvents(execution),
      unavailable: errors?.unavailable?.bind(errors),
      errorCode: errors?.errorCode?.bind(errors),
    };
    this.diagnostics = this.ports.diagnostics;
  }

  /**
   * Replace the diagnostics scope used by subsequent calls.
   *
   * Calls already in flight keep the scope they started with.
   *
   * @param diagnostics New diagnostics context, or undefined to stop emitting events.
   */
  setDiagnostics(diagnostics: ToolRegistryPorts['diagnostics']): void {
    this.diagnostics = diagnostics;
  }

  /**
   * Register one executable tool.
   *
   * The stored entry is frozen and its parsers are bound to the tool, so later changes on the
   * caller's object cannot alter validation or execution.
   *
   * @param tool Executable tool; `id` and `kind` must be non-empty, and the parse and execute
   *   handlers must all be functions.
   * @returns This registry, for chaining.
   * @throws Error when the registry is sealed or the id is already registered.
   * @throws TypeError when the tool shape is invalid.
   */
  register(tool: Tool): this {
    if (this.sealed) throw new Error('Tool registry is sealed');
    const { id, kind, description, parseInput, parseOutput, execute, debugSteps } = tool;
    if (
      !id?.trim() ||
      !kind?.trim() ||
      ![parseInput, parseOutput, execute].every((value) => typeof value === 'function')
    )
      throw new TypeError('Invalid executable tool');
    if (this.tools.has(id)) throw new Error(`Duplicate registered tool: ${id}`);
    const input = parseInput.bind(tool),
      output = parseOutput.bind(tool);
    this.tools.set(
      id,
      Object.freeze({
        ...registrationData(tool, [
          'id',
          'kind',
          'description',
          'parseInput',
          'parseOutput',
          'execute',
          'debugSteps',
        ]),
        id,
        kind,
        description,
        debugSteps: debugSteps?.bind(tool),
        parseInput: input,
        parseOutput: output,
        execute: execute.bind(tool),
      }) as unknown as RegisteredTool<Tool>,
    );
    return this;
  }

  /**
   * Invoke a registered tool synchronously.
   *
   * @param request Single request object carrying `toolId`, `input`, and optional signal and
   *   diagnostics. Exactly one argument is accepted; the arity check is runtime-enforced
   *   because callers may bypass the type system.
   * @returns The tool result, with frozen invocation metadata.
   * @throws TypeError when the request shape is wrong, the diagnostics belong to another run,
   *   or the tool returns a promise.
   * @throws Error when the tool is unknown or the tool itself fails; the abort reason
   *   surfaces when the signal is cancelled.
   */
  invoke(request: ToolInvocationRequest): ToolResult<unknown> {
    const call = toolInvocation(request, arguments.length);
    const callId = nextInvocationId();
    return nativeReportedStepSync(
      { ...call, signal: combineSignals(this.ports.signal, call.signal), invocationId: callId },
      'tool',
      call.toolId,
      (scopedLogger) =>
        this.execute(
          call.toolId,
          call.input,
          false,
          call.diagnostics,
          call.signal,
          scopedLogger,
          callId,
        ) as ToolResult<unknown>,
    );
  }

  /**
   * Invoke a registered tool and await its result.
   *
   * @param request Single request object, identical to `invoke`.
   * @returns The tool result once the tool settles.
   * @throws TypeError or Error under the same conditions as `invoke`; rejections from an
   *   asynchronous tool are propagated unchanged.
   */
  async invokeAsync(request: ToolInvocationRequest): Promise<ToolResult<unknown>> {
    const call = toolInvocation(request, arguments.length);
    const callId = nextInvocationId();
    return nativeReportedStepAsync(
      { ...call, signal: combineSignals(this.ports.signal, call.signal), invocationId: callId },
      'tool',
      call.toolId,
      (scopedLogger) =>
        this.execute(
          call.toolId,
          call.input,
          true,
          call.diagnostics,
          call.signal,
          scopedLogger,
          callId,
        ) as Promise<ToolResult<unknown>>,
    );
  }

  /**
   * Run one call: validate, parse input, execute, parse output, then record the outcome.
   *
   * @param name Registered tool id.
   * @param input Untrusted caller input, parsed before the tool sees it.
   * @param asynchronous Whether promises returned by the tool are awaited.
   * @param parentDiagnostics Scope the call is recorded under; defaults to the registry's.
   * @param requestSignal Per-call signal, combined with the request-lifetime signal.
   * @returns The frozen result on success; every failure path throws.
   */
  private execute(
    name: string,
    input: unknown,
    asynchronous: boolean,
    parentDiagnostics = this.diagnostics,
    requestSignal?: AbortSignal,
    logger?: import('../structs/debug.js').ScopedReportedStepRecorder,
    callId = nextInvocationId(),
  ): unknown {
    // A tool call stays inside the run that invoked it: mixing two diagnostic trees would
    // produce records with two parents and break run-scoped correlation.
    if (
      this.diagnostics?.identity?.runId &&
      parentDiagnostics?.identity?.runId &&
      this.diagnostics.identity.runId !== parentDiagnostics.identity.runId
    )
      throw new TypeError('Tool diagnostics must belong to the same run');
    const tool = this.tools.get(name);
    if (!tool) throw this.ports.unavailable?.(name) ?? new Error(`Tool is not registered: ${name}`);
    // Either signal may cancel the call; combining them keeps both lifetimes effective.
    const signal = combineSignals(this.ports.signal, requestSignal);
    const invocationId = callId;
    const diagnostics = parentDiagnostics?.child(invocationId, {
      invocationId,
      nodeRole: 'invocation',
      definitionKind: 'tool',
      definitionId: name,
      nodeId: name,
      nodeName: name,
      nodeKind: 'tool',
      // Cap the persisted description so an App-supplied string cannot inflate every record.
      nodeDescription: tool.description?.slice(0, 1024),
      // Tool calls are not stage-scoped; explicit undefined clears inherited span fields.
      stageId: undefined,
      definitionRevision: undefined,
    });
    const reports = new NodeReports(diagnostics, signal, 'tool.result');
    const reporting = {
      report: reports.report.bind(reports),
      createStepRecorder: reports.createStepRecorder.bind(reports),
      createSubFlowLogger: reports.createStepRecorder.bind(reports),
    };
    diagnostics?.emit('tool.call', () => ({
      toolId: name,
      invocationId,
      ...(diagnostics?.enabled('tool.call', 'content') ? { input } : {}),
    }));
    const started = Date.now();
    // Track the phase for failure reports, so input or output parsing errors can be told
    // apart from failures raised by the tool itself.
    let phase = 'input';
    const output = (value: unknown) => {
      signal.throwIfAborted();
      phase = 'output';
      const result = synchronous(
        tool.parseOutput(value),
        'Tool output parsers must be synchronous',
      );
      signal.throwIfAborted();
      return result;
    };
    const succeed = (result: unknown) => {
      signal.throwIfAborted();
      if (tool.debugSteps && diagnostics?.enabled('tool.result', 'content')) {
        try {
          synchronous(tool.debugSteps(result, reporting), 'Tool debug reports must be synchronous');
        } catch {
          diagnostics?.emit('node.progress', () => ({ reportError: 'INVALID_NODE_REPORT' }));
        }
      }
      const debug = reports.debug();
      signal.throwIfAborted();
      reports.close();
      diagnostics?.emit(
        'tool.result',
        () => ({
          toolId: name,
          invocationId,
          status: 'success',
          ...(diagnostics?.enabled('tool.result', 'content') ? { value: result } : {}),
          durationMs: Date.now() - started,
        }),
        debug,
      );
      // Kept locally as well as emitted, so a run summary does not require a log consumer.
      this.executionEvents.push(
        Object.freeze({
          ...diagnostics?.identity,
          toolId: name,
          invocationId,
          startedAtMs: started,
          kind: tool.kind,
          durationMs: Date.now() - started,
          status: 'success',
        }),
      );
      return invocationResult(result, {
        ...diagnostics?.identity,
        invocationId,
        toolId: name,
        startedAtMs: started,
        durationMs: Date.now() - started,
        status: 'success' as const,
      });
    };
    const fail = (error: unknown): never => {
      reports.close();
      // Rule-level record carries the failing phase, which the tool result does not.
      diagnostics?.emit('rule.result', () => ({
        tags: [name, phase],
        error: diagnosticError(error),
      }));
      diagnostics?.emit(
        'tool.result',
        () => ({
          toolId: name,
          invocationId,
          status: signal.aborted ? 'cancelled' : 'error',
          ...(diagnostics?.enabled('tool.result', 'content')
            ? { error: diagnosticError(error) }
            : {}),
          durationMs: Date.now() - started,
        }),
        reports.debug(),
      );
      let errorCode = signal.aborted ? 'CANCELLED' : 'TOOL_ERROR';
      try {
        errorCode = this.ports.errorCode?.(error) ?? errorCode;
      } catch {
        /* Error decoration cannot replace the original failure. */
      }
      this.executionEvents.push(
        Object.freeze({
          ...diagnostics?.identity,
          toolId: name,
          invocationId,
          startedAtMs: started,
          kind: tool.kind,
          durationMs: Date.now() - started,
          status: signal.aborted ? 'cancelled' : 'error',
          ...(errorCode ? { errorCode } : {}),
        }),
      );
      throw error;
    };
    try {
      signal.throwIfAborted();
      const parsed = synchronous(tool.parseInput(input), 'Tool input parsers must be synchronous');
      signal.throwIfAborted();
      phase = 'execute';
      const value = tool.execute(parsed, {
        logger,
        mode: asynchronous ? 'async' : 'sync',
        invocationId,
        signal,
        diagnostics,
        ...reporting,
      });
      if (asynchronous)
        // Async completions are routed to `fail` explicitly, so bookkeeping runs exactly once
        // whether the tool settles immediately or later.
        return awaitWithSignal(value, signal).then(output).then(succeed).catch(fail);
      return succeed(output(synchronous(value, 'Synchronous tools must not return a Promise')));
    } catch (error) {
      return fail(error);
    }
  }

  /**
   * Register several tools.
   *
   * @param tools Executable tools applied in iteration order.
   * @returns This registry, for chaining.
   * @throws Error or TypeError under the same conditions as `register`.
   */
  registerAll(tools: Iterable<Tool>): this {
    for (const tool of tools) this.register(tool);
    return this;
  }

  /**
   * @param name Tool id.
   * @returns The registered tool, or undefined when absent.
   */
  get(name: string): RegisteredTool<Tool> | undefined {
    return this.tools.get(name);
  }
  /** Frozen snapshot of the registered tools, in declaration order. */
  get definitions(): readonly Readonly<RegisteredTool<Tool>>[] {
    return Object.freeze([...this.tools.values()]);
  }
  /** Registered tool ids in declaration order. */
  ids(): readonly string[] {
    return Object.freeze([...this.tools.keys()]);
  }
  /** Live iterator over `[id, tool]` pairs; it reflects only entries added before sealing. */
  entries(): IterableIterator<[string, RegisteredTool<Tool>]> {
    return this.tools.entries();
  }
  /**
   * @param id Tool id.
   * @returns The registered tool.
   * @throws Error when the tool is unknown; the App-supplied `unavailable` factory can
   *   replace the default message.
   */
  require(id: string): RegisteredTool<Tool> {
    const tool = this.get(id);
    if (!tool) throw this.ports.unavailable?.(id) ?? new Error(`Tool is not registered: ${id}`);
    return tool;
  }
  /**
   * @param name Tool id.
   * @returns Whether the id is registered in this registry.
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }
  /** Live iterator over the registered tools. */
  values(): IterableIterator<RegisteredTool<Tool>> {
    return this.tools.values();
  }
  /**
   * Close the registry to further registration.
   *
   * Sealing is idempotent and does not affect existing tools.
   *
   * @returns This registry.
   */
  seal(): this {
    this.sealed = true;
    return this;
  }
}

export type {
  ToolDefinition,
  ToolExecutionContext,
  ErasedTool,
  RegisteredTool,
  ToolExecutionEvent,
  ToolRegistryPorts,
  ToolRegistryOptions,
  ToolInvocationRequest,
} from '../structs/capabilities/tools.js';
export { executeInvocation } from './invocation.js';
export type {
  InvocationHandler,
  ToolInvocationPorts,
  ToolJournal,
} from '../structs/capabilities/invocation.js';

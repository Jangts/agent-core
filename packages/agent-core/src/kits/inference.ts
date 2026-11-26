/**
 * Inference Kit: a bounded, cancellable catalog of App-registered model bindings.
 *
 * Place in the package: an optional App-side wrapper for calling model providers. A binding
 * owns the provider call; this module owns id/identity registration, input and output
 * assertions, attempt-budget accounting, timeout composition and diagnostics. It does not
 * choose prompts, retries or fallbacks, and Core does not import it.
 *
 * Exports: `ModelCalls`, `ModelBinding`, `ModelInvocationContext`, `ModelInvocationRequest`.
 */
import type { ExecutionContext, MaybePromise } from '../structs/common.js';
import { BudgetError } from '../structs/errors.js';
import { breakWhile } from '../utils/rules.js';
import type { AttemptBudget } from '../execution/workflow.js';
import { assertion, synchronous } from '../utils/synchronous.js';
import { awaitWithSignal, combineSignals } from '../utils/cancellation.js';
import { invocationId, invocationResult } from '../utils/invocation.js';
import { getErrorInfo } from '../errors.js';
import type { ModelResult } from '../structs/invocation.js';
import { ProtocolRegistry } from '../utils/protocol-registry.js';

/** App-defined I/O. Registered literal IDs determine input and output types. */
export interface ModelBinding<Input, Output> {
  /** Catalog key used in requests; must be unique within one `ModelCalls` instance. */
  readonly id: string;
  /** Non-blank implementation identity (provider plus model name) reported in diagnostics. */
  readonly identity: string;
  /** Performs the provider call. May be async; the Kit applies the caller's signal. */
  invoke(input: Input, context: ModelInvocationContext): MaybePromise<Output>;
  /** Optional synchronous assertion run before the budget is consumed or the call starts. */
  assertInput?(input: Input): void;
  /** Optional synchronous assertion run after the call, before the result is reported. */
  assertOutput?(output: Output): void;
}
/** One take consumes one binding invocation attempt, independent of batch size or chat tokens. */
export interface ModelInvocationContext extends ExecutionContext {
  /** Shared attempt budget; a refusal fails the call with `BudgetError` before invoking. */
  readonly attemptBudget?: Pick<AttemptBudget, 'take'>;
}
/**
 * One model call: registered binding id, the input to hand over and its timeout.
 *
 * @typeParam Input - Input type of the addressed binding.
 */
export interface ModelInvocationRequest<Input> {
  /** Registered binding id; unknown ids fail before any provider work happens. */
  readonly modelId: string;
  /** Input handed to the binding unchanged; Core never clones App objects here. */
  readonly input: Input;
  /** Per-call timeout in milliseconds, 1..2147483647 (the platform timer ceiling). */
  readonly timeoutMs: number;
}
// Literal ids in `Bindings` decide the accepted input and reported output types; ids that are
// not registered fall back to `unknown` so the overload still compiles for dynamic callers.
type BindingFor<
  Bindings extends readonly ModelBinding<any, any>[],
  Id extends string,
> = Bindings[number] extends infer Binding
  ? Binding extends { readonly id: infer Known extends string }
    ? Id extends Known
      ? Binding
      : never
    : never
  : never;
type InputFor<Bindings extends readonly ModelBinding<any, any>[], Id extends string> =
  BindingFor<Bindings, Id> extends infer Binding
    ? [Binding] extends [never]
      ? unknown
      : Binding extends { invoke(input: infer Input, ...args: any[]): unknown }
        ? Input
        : unknown
    : unknown;
type OutputFor<Bindings extends readonly ModelBinding<any, any>[], Id extends string> =
  BindingFor<Bindings, Id> extends infer Binding
    ? [Binding] extends [never]
      ? unknown
      : Binding extends { invoke(...args: any[]): infer Output }
        ? Awaited<Output>
        : unknown
    : unknown;
type RegisteredBinding<Binding extends ModelBinding<any, any>> = Readonly<
  Pick<Binding, Extract<keyof Binding, keyof ModelBinding<any, any>>>
>;
/**
 * Frozen catalog of model bindings plus a checked invocation entry point.
 *
 * Registration happens once in the constructor; the catalog is never mutated afterwards, so a
 * caller cannot swap a provider in the middle of a run.
 */
export class ModelCalls<
  Input = unknown,
  Output = unknown,
  const Bindings extends readonly ModelBinding<any, any>[] = readonly ModelBinding<Input, Output>[],
> {
  private sequence = 0;
  private readonly bindings = new ProtocolRegistry<ModelBinding<any, any>>();
  /**
   * @param bindings - Bindings to register; each needs a non-blank `identity` and an `invoke`.
   * @throws TypeError When a binding is malformed or two bindings share an id.
   */
  constructor(bindings: Bindings) {
    for (const binding of bindings) {
      if (!binding.identity?.trim() || typeof binding.invoke !== 'function')
        throw new TypeError('Invalid model binding');
      this.bindings.set(
        binding.id,
        Object.freeze({
          id: binding.id,
          identity: binding.identity,
          invoke: binding.invoke.bind(binding),
          assertInput: binding.assertInput?.bind(binding),
          assertOutput: binding.assertOutput?.bind(binding),
        }),
      );
    }
  }
  /** Registered bindings in declaration order, with methods already bound to their owner. */
  get definitions(): readonly RegisteredBinding<Bindings[number]>[] {
    return Object.freeze([...this.bindings.values()]) as readonly RegisteredBinding<
      Bindings[number]
    >[];
  }
  /** Registered binding ids in declaration order. */
  ids(): readonly string[] {
    return this.bindings.ids();
  }
  /** Whether a binding id is registered. */
  has(id: string): boolean {
    return this.bindings.has(id);
  }
  /** Registered binding for `id`, or `undefined` when it is absent. */
  get(id: string): RegisteredBinding<Bindings[number]> | undefined {
    return this.bindings.get(id) as RegisteredBinding<Bindings[number]> | undefined;
  }
  /**
   * Registered binding for `id`.
   *
   * @throws TypeError When the id is not registered.
   */
  require(id: string): RegisteredBinding<Bindings[number]> {
    return this.bindings.require(id) as RegisteredBinding<Bindings[number]>;
  }
  /** Iterate the registered bindings. */
  values(): IterableIterator<RegisteredBinding<Bindings[number]>> {
    return this.bindings.values() as IterableIterator<RegisteredBinding<Bindings[number]>>;
  }
  /** Iterate `[id, binding]` pairs. */
  entries(): IterableIterator<[string, RegisteredBinding<Bindings[number]>]> {
    return this.bindings.entries() as IterableIterator<
      [string, RegisteredBinding<Bindings[number]>]
    >;
  }
  /**
   * Implementation identity of one binding.
   *
   * @throws TypeError When the id is not registered.
   */
  identity(id: string): string {
    return this.require(id).identity;
  }
  /**
   * Invoke one registered binding under the caller's signal, timeout and attempt budget.
   *
   * Order matters: the binding id is resolved, input is asserted, the budget take happens
   * before the provider call, and the output assertion runs before a result is reported. Any
   * failure emits a diagnostic and rethrows unchanged, so callers see the provider's own error.
   *
   * @param request - Binding id, input and per-call timeout.
   * @param context - Execution context; `signal` is combined with a timeout signal.
   * @returns The provider output wrapped with invocation metadata.
   * @throws TypeError For a malformed request, unknown id, missing signal/context, invalid
   *   timeout or failed input/output assertion; `BudgetError` when the attempt budget refuses;
   *   the provider's own error otherwise, including abort and timeout.
   */
  invoke<const Id extends string>(
    request: ModelInvocationRequest<InputFor<Bindings, Id>> & { readonly modelId: Id },
    context: ModelInvocationContext,
  ): Promise<ModelResult<OutputFor<Bindings, Id>>>;
  async invoke(
    request: ModelInvocationRequest<unknown>,
    context: ModelInvocationContext,
  ): Promise<ModelResult<unknown>> {
    if (!request || typeof request !== 'object' || !('input' in request))
      throw new TypeError('Use one model request and execution context');
    const { modelId: id, input, timeoutMs } = request;
    if (
      !context?.signal ||
      typeof id !== 'string' ||
      !id.trim() ||
      !Number.isSafeInteger(timeoutMs) ||
      timeoutMs < 1 ||
      // 2147483647 is the largest delay `setTimeout`/`AbortSignal.timeout` accept reliably.
      timeoutMs > 2147483647
    )
      throw new TypeError('A modelId, signal and positive supported timeoutMs are required');
    const sourceBudget = context.attemptBudget;
    const take = sourceBudget?.take.bind(sourceBudget);
    const callId = invocationId(),
      startedAtMs = Date.now();
    const diagnostics = context.diagnostics?.child(callId, {
      invocationId: callId,
      modelId: id,
      nodeRole: 'invocation',
      definitionKind: 'model-binding',
      definitionId: id,
      nodeId: id,
      nodeName: id,
      nodeKind: 'model-binding',
    });
    const signal = combineSignals(context.signal, AbortSignal.timeout(timeoutMs));
    let phase: 'input' | 'invoke' | 'output' = 'input';
    try {
      const binding = this.bindings.require(id);
      signal.throwIfAborted();
      assertion(binding.assertInput?.(input), 'Model input assertions must be synchronous');
      signal.throwIfAborted();
      if (take) {
        const accepted = synchronous(take(), 'Model attempt budget must be synchronous');
        breakWhile(typeof accepted !== 'boolean', 'Model attempt budget must return boolean');
        breakWhile(!accepted, () => new BudgetError('External model attempt budget exhausted'));
      }
      const callSequence = ++this.sequence;
      phase = 'invoke';
      diagnostics?.emit('model.binding', () => ({
        modelId: id,
        invocationId: callId,
        status: 'running',
        phase,
      }));
      // Hand off checked inputs before yielding. Arbitrary App inputs may be
      // class instances or services, so Core must not silently clone them.
      signal.throwIfAborted();
      const output = await awaitWithSignal(
        binding.invoke(input, { ...context, signal, diagnostics, attemptBudget: sourceBudget }),
        signal,
      );
      signal.throwIfAborted();
      phase = 'output';
      assertion(binding.assertOutput?.(output), 'Model output assertions must be synchronous');
      signal.throwIfAborted();
      diagnostics?.emit('model.binding', () => ({
        modelId: id,
        invocationId: callId,
        status: 'success',
        phase,
        durationMs: Date.now() - startedAtMs,
      }));
      return invocationResult(output, {
        ...diagnostics?.identity,
        invocationId: callId,
        modelId: id,
        startedAtMs,
        durationMs: Date.now() - startedAtMs,
        callSequence,
        status: 'success' as const,
      });
    } catch (error) {
      diagnostics?.emit('model.binding', () => ({
        modelId: id,
        invocationId: callId,
        status: signal.aborted ? 'cancelled' : 'error',
        phase,
        durationMs: Date.now() - startedAtMs,
        errorCode: getErrorInfo(error).code,
      }));
      throw error;
    }
  }
}

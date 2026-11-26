import { domainAlias, domainProjection } from './domains/compatibility.js';
/**
 * Tools Kit: a lifecycle registry for App-declared tools.
 *
 * Place in the package: an optional App-side library for tools that need more than a plain
 * definition — availability, one lifecycle hook set, output ownership, context fields, task rules
 * and delivery hooks. Actual invocation is delegated to Core (`ToolRegistry` and
 * `executeInvocation`); domain predicates, phase names and vocabulary stay App configuration.
 *
 * A callable lifecycle uses its owning LifecycleTool id. Protocols, selected hooks and direct calls
 * read the same registry entry; lifecycle hooks have no independent registration identity.
 *
 * Exports: `ToolLifecycleRegistry` and the tool lifecycle types.
 */
import { bindIntent, snapshotIntent } from '../capabilities/tool-conditions.js';
import { assertion, booleanResult, synchronous } from '../utils/synchronous.js';
import { toolInvocation } from '../utils/invocation.js';
import type { ToolInvocationRequest } from '../structs/capabilities/tools.js';
import type { ToolResult } from '../structs/invocation.js';
import type {
  ToolRuntimeTypes,
  LifecycleTool,
  LifecycleToolRegistration,
  RegisteredLifecycleTool,
  ToolLifecycleRegistryOptions,
  ToolLifecycleHooks,
  ToolNormalizer,
  ToolFinalizer,
  ToolProtocol,
} from '../structs/kits/tools.js';
import type { ToolRegistryPorts } from '../structs/capabilities/tools.js';
import type { ToolInvocationPorts } from '../structs/capabilities/invocation.js';
import { breakWhile } from '../utils/rules.js';
import { ToolRegistry } from '../capabilities/tools.js';
import { executeInvocation } from '../capabilities/invocation.js';
import { ProtocolRegistry } from '../utils/protocol-registry.js';
import { registrationData } from '../utils/registration.js';
import { ModelToolRegistry } from '../capabilities/model.js';
import { toolActive } from '../capabilities/tool-conditions.js';

/**
 * Registered lifecycle hooks. Domain predicates and phase names are host configuration.
 */
type PreparedTool<
  Types extends ToolRuntimeTypes,
  Declaration extends LifecycleToolRegistration<Types>,
> = RegisteredLifecycleTool<Types, Declaration> &
  LifecycleTool<Types> & {
    readonly goalIds: 'all' | readonly string[];
    readonly domainToolIds: 'all' | readonly string[];
  };

/** Hooks that must finish with `undefined`; every other hook only rejects thenables. */
const assertionHooks: readonly string[] = ['authorize', 'inspect', 'finalize'];
/** Every hook a lifecycle block may declare, in binding order. */
const lifecycleHooks = [
  'call',
  'authorize',
  'resume',
  'complete',
  'inspect',
  'finalize',
  'rules',
  'modelFields',
  'visibleText',
  'reviewDraft',
  'composition',
  'recoveryContext',
  'projectContext',
  'missingInteractionAllowed',
  'supportsGoal',
  'supportsDomainTool',
] as const;

/** Pin contract methods and configuration without cloning the App services they use. */
function snapshotLifecycleOptions<
  Types extends ToolRuntimeTypes,
  Declaration extends LifecycleToolRegistration<Types>,
>(
  options: ToolLifecycleRegistryOptions<Types, Declaration>,
): ToolLifecycleRegistryOptions<Types, Declaration> {
  const {
    receiver,
    execution,
    errors,
    registration,
    toolId,
    outputs,
    modelOutputs,
    unavailableInvocation,
    forbidden,
    contextFragment,
    goalIds,
    diagnostics,
    signal,
    journal,
    checkpoint,
    receipt,
    receiptError,
  } = options;
  const domainIds = domainAlias<() => readonly string[]>(options, 'domainToolIds', 'goalIds');
  if (typeof domainIds !== 'function') throw new TypeError('An goalIds provider is required');
  const {
    kinds,
    isValidId,
    audiences,
    effects,
    goalExists,
    protocolVersion,
    tags,
    invalidTool,
    invalidInvocation,
  } = registration;
  const domainExists = domainAlias<(id: string) => boolean>(
    registration,
    'domainToolExists',
    'goalExists',
  );
  if (typeof domainExists !== 'function')
    throw new TypeError('A domainToolExists predicate is required');
  return Object.freeze({
    receiver: receiver?.bind(options),
    execution:
      execution && Object.freeze({ signal: execution.signal, diagnostics: execution.diagnostics }),
    errors:
      errors &&
      Object.freeze({
        unavailable: errors.unavailable?.bind(errors),
        errorCode: errors.errorCode?.bind(errors),
      }),
    registration: Object.freeze({
      kinds: Object.freeze([...kinds]),
      audiences: Object.freeze([...audiences]),
      effects: Object.freeze([...effects]),
      isValidId: isValidId.bind(registration),
      goalExists: domainExists.bind(registration),
      protocolVersion,
      tags: tags && Object.freeze([...tags]),
      invalidTool: typeof invalidTool === 'function' ? invalidTool.bind(registration) : invalidTool,
      invalidInvocation:
        typeof invalidInvocation === 'function'
          ? invalidInvocation.bind(registration)
          : invalidInvocation,
    }),
    toolId:
      toolId?.bind(options) ??
      ((decision: Types['decision']) => {
        const value = decision as { type?: string; next?: { type?: string } };
        return value.next?.type ?? value.type ?? '';
      }),
    outputs: outputs.bind(options),
    modelOutputs: modelOutputs?.bind(options),
    unavailableInvocation: unavailableInvocation?.bind(options),
    forbidden: forbidden?.bind(options),
    contextFragment: contextFragment.bind(options),
    goalIds: domainIds.bind(options),
    diagnostics: diagnostics?.bind(options),
    signal: signal?.bind(options),
    journal: journal?.bind(options),
    checkpoint: checkpoint?.bind(options),
    receipt: receipt?.bind(options),
    receiptError: receiptError?.bind(options),
  });
}

/** Bind every declared hook to its owner and freeze the result. */
function bindLifecycle<Types extends ToolRuntimeTypes>(value: ToolLifecycleHooks<Types>) {
  domainAlias(value, 'supportsDomainTool', 'supportsGoal');
  return Object.freeze({
    ...registrationData(value, [...lifecycleHooks, 'protocol']),
    protocol: value.protocol,
    ...Object.fromEntries(
      lifecycleHooks.map((key) => {
        const handler = value[key] as ((...args: unknown[]) => unknown) | undefined;
        return [
          key,
          typeof handler === 'function'
            ? (...args: unknown[]) =>
                (assertionHooks.includes(key) ? assertion : synchronous)(
                  handler.apply(value, args),
                  `LifecycleTool lifecycle ${key} must finish synchronously with the declared result`,
                )
            : handler,
        ];
      }),
    ),
  });
}

/**
 * Registry of tools whose lifecycle, protocols and context contributions the App declares.
 *
 * Registration is only possible before `seal()`; afterwards the catalog is read-only, so a run
 * cannot change which tools exist. Every hook is optional and is applied in registration order,
 * which is why `registerAll` preserves iteration order.
 */
export class ToolLifecycleRegistry<
  Types extends ToolRuntimeTypes,
  Declaration extends LifecycleToolRegistration<Types> = LifecycleToolRegistration<Types>,
> {
  private readonly tools: ToolRegistry<PreparedTool<Types, Declaration>>;
  private readonly registered = new Map<string, PreparedTool<Types, Declaration>>();
  private readonly sources = new Map<string, Declaration>();
  private normalizer?: ToolNormalizer<Types>;
  private finalizer?: ToolFinalizer<Types>;
  private sealed = false;

  private diagnostics?: ToolRegistryPorts['diagnostics'];
  private activeDiagnostics?: ToolRegistryPorts['diagnostics'];
  private readonly invocationPorts: ToolInvocationPorts<Types['context']>;
  private readonly options: ToolLifecycleRegistryOptions<Types, Declaration>;
  /**
   * @param options - Receiver, execution context, error wording, registration policy, protocol
   *   providers and optional journal/receipt ports; contract methods are bound to their owner.
   * @throws TypeError When no `goalIds` provider is supplied.
   */
  constructor(options: ToolLifecycleRegistryOptions<Types, Declaration>) {
    this.options = snapshotLifecycleOptions(options);
    this.tools = new ToolRegistry({
      execution: this.options.execution,
      errors: this.options.errors,
    });
    this.diagnostics = this.options.execution?.diagnostics;
    this.invocationPorts = Object.freeze({
      logger: this.options.logger,
      diagnostics: this.options.diagnostics ?? (() => this.diagnostics),
      signal: this.options.signal,
      journal: this.options.journal,
      checkpoint: this.options.checkpoint,
      receipt: this.options.receipt,
      receiptError: this.options.receiptError,
    });
  }
  /** Core tool events, forwarded unchanged. */
  get events() {
    return this.tools.events;
  }
  /** Swap the diagnostics sink for later invocations; the Core registry is updated as well. */
  setDiagnostics(value: ToolRegistryPorts['diagnostics']): void {
    this.diagnostics = value;
    this.tools.setDiagnostics(value);
  }

  /**
   * Register and freeze one tool definition.
   *
   * Handlers are bound to the original object; authorization, inspection and finalization
   * hooks must return `void` synchronously, while the remaining handlers are checked for
   * accidental thenables only.
   *
   * @param input - LifecycleTool definition with identity, audience, effect and its hooks.
   * @returns This registry, for chaining.
   * @throws A configured registration error for a sealed registry, invalid identity,
   *   description, audience, effect, goal ids, missing handlers, duplicate tool id,
   *   duplicate delegate id, incomplete lifecycle contract, protocol version mismatch or
   *   duplicate invocation id.
   */
  register(input: Declaration): this {
    const {
      id,
      kind,
      description,
      audience,
      effect,
      goalIds,
      lifecycle,
      parseInput: inputParser,
      parseOutput: outputParser,
      active: availability,
      execute,
      debugSteps,
    } = input;
    const parseInput = inputParser?.bind(input),
      parseOutput = outputParser?.bind(input);
    const available = typeof availability === 'function' ? availability.bind(input) : availability;
    const resolvedDomainIds = domainAlias<'all' | readonly string[]>(
      input,
      'domainToolIds',
      'goalIds',
    );
    const frozenGoalIds = Array.isArray(resolvedDomainIds)
      ? Object.freeze([...resolvedDomainIds])
      : resolvedDomainIds;
    // Validate the declaration before projecting it into a model tool: a sealed or invalid
    // registration must report its configured error instead of a schema-projection failure.
    this.assertRegistration(input, { parseInput, parseOutput, execute });
    const modelTool = new ModelToolRegistry([
      {
        id,
        description,
        inputSchema: input.inputSchema ?? { jsonSchema: { type: 'object' }, parse: parseInput },
        resolve: input.resolve?.bind(input) ?? ((value: unknown) => ({ toolId: id, input: value })),
        active: typeof input.active === 'function' ? input.active.bind(input) : input.active,
        asIntent: bindIntent(
          snapshotIntent(
            typeof input.asIntent === 'function' ? input.asIntent.bind(input) : input.asIntent,
          ),
          input,
        ),
      },
    ]).require(id);
    const tool = {
      ...registrationData(input, [
        'id',
        'kind',
        'description',
        'audience',
        'effect',
        'goalIds',
        'lifecycle',
        'parseInput',
        'parseOutput',
        'execute',
        'debugSteps',
        'active',
      ]),
      ...modelTool,
      id,
      kind,
      description,
      audience,
      effect,
      lifecycle,
      goalIds: frozenGoalIds,
      domainToolIds: frozenGoalIds,
      parseInput,
      parseOutput,
      debugSteps: debugSteps?.bind(input),
      execute: execute?.bind(input),
      active: available,
    };
    const registered = Object.freeze({
      ...tool,
      ...(lifecycle ? { lifecycle: bindLifecycle(lifecycle) } : {}),
    }) as unknown as PreparedTool<Types, Declaration>;
    return this.install(input, registered, true);
  }

  /** Validate one declaration in the fixed order documented by `register`. */
  private assertRegistration(
    input: Declaration,
    handlers: { parseInput: unknown; parseOutput: unknown; execute: unknown },
  ): void {
    if ('delegate' in input || (input.lifecycle && 'id' in input.lifecycle))
      throw new TypeError('Lifecycle calls use the tool id');
    const goalIds = domainAlias<'all' | readonly string[]>(input, 'domainToolIds', 'goalIds') ?? [];
    const policy = this.options.registration;
    const identityPredicate = policy.isValidId;
    const isValidId = () =>
      booleanResult(
        identityPredicate(input),
        'LifecycleTool identity predicates must be synchronous',
        'LifecycleTool identity predicates must return boolean',
      );
    const invalid = policy.invalidTool ?? 'Invalid registered tool';
    const invalidInvocation = policy.invalidInvocation ?? 'Invalid or duplicate tool invocation';
    const { lifecycle } = input;
    // A lifecycle block may declare hooks only. Declaring any invocation part makes both
    // required, so a partial declaration fails instead of silently never running.
    const ownsInvocation =
      !!lifecycle && (lifecycle.protocol !== undefined || lifecycle.call !== undefined);
    const { parseInput, parseOutput, execute } = handlers;
    breakWhile(
      [
        { occur: () => this.sealed, error: 'LifecycleTool registry is sealed', tags: ['sealed'] },
        {
          occur: [() => !policy.kinds.includes(input.kind), () => !isValidId()],
          error: invalid,
          tags: ['identity'],
        },
        {
          occur: () => typeof input.description !== 'string' || !input.description.trim(),
          error: invalid,
          tags: ['description'],
        },
        {
          occur: () =>
            input.active !== undefined &&
            typeof input.active !== 'boolean' &&
            typeof input.active !== 'function',
          error: invalid,
          tags: ['active'],
        },
        {
          occur: [
            () => !policy.audiences.includes(input.audience),
            () => !policy.effects.includes(input.effect),
          ],
          error: invalid,
          tags: ['execution-contract'],
        },
        {
          occur: [
            () => goalIds !== 'all' && !Array.isArray(goalIds),
            () => goalIds !== 'all' && !goalIds.length,
            () =>
              goalIds !== 'all' &&
              goalIds.some(
                (goal) =>
                  !booleanResult(
                    policy.goalExists!(goal),
                    'Goal lookup must return boolean synchronously',
                  ),
              ),
            () => goalIds !== 'all' && new Set(goalIds).size !== goalIds.length,
          ],
          error: invalid,
          tags: ['goals'],
        },
        {
          occur: () =>
            ![parseInput, parseOutput, execute].every((handler) => typeof handler === 'function'),
          error: invalid,
          tags: ['handlers'],
        },
        {
          occur: () => this.tools.has(input.id),
          error: () => new Error(`Duplicate registered tool: ${input.id}`),
          tags: ['duplicate-name'],
        },
        {
          occur: () => ownsInvocation && typeof lifecycle!.call !== 'function',
          error: invalidInvocation,
          tags: ['lifecycle', 'contract'],
        },
        {
          occur: () => ownsInvocation && typeof lifecycle!.protocol?.keys !== 'function',
          error: invalidInvocation,
          tags: ['lifecycle', 'contract'],
        },
        {
          occur: () =>
            ownsInvocation &&
            policy.protocolVersion !== undefined &&
            lifecycle!.protocol?.version !== undefined &&
            lifecycle!.protocol.version !== policy.protocolVersion,
          error: invalidInvocation,
          tags: ['lifecycle', 'version'],
        },
      ],
      policy.tags,
    );
  }

  private install(
    input: Declaration,
    tool: PreparedTool<Types, Declaration>,
    validated = false,
  ): this {
    if (!validated)
      this.assertRegistration(input, {
        parseInput: tool.parseInput,
        parseOutput: tool.parseOutput,
        execute: tool.execute,
      });
    this.tools.register(tool);
    this.registered.set(tool.id, tool);
    this.sources.set(tool.id, input);
    return this;
  }

  /** Register every tool in iteration order. */
  registerAll(tools: Iterable<Declaration>): this {
    for (const tool of tools) this.register(tool);
    return this;
  }
  /**
   * Invoke one Core tool by its already-validated request.
   *
   * When the request carries no diagnostics, the currently active one is used, so a call made
   * from inside a tool inherits that tool's diagnostic context.
   */
  invoke(request: ToolInvocationRequest): ToolResult<unknown> {
    const call = toolInvocation(request, arguments.length);
    return this.tools.invoke({ ...call, diagnostics: call.diagnostics ?? this.activeDiagnostics });
  }
  /** Registered tools in registration order. */
  get definitions(): readonly RegisteredLifecycleTool<Types, Declaration>[] {
    return Object.freeze([...this.registered.values()]);
  }
  /** Registered tool ids, delegated to the Core registry. */
  ids() {
    return this.tools.ids();
  }
  /** Iterate `[id, tool]` pairs. */
  entries(): IterableIterator<[string, RegisteredLifecycleTool<Types, Declaration>]> {
    return this.registered.entries();
  }
  /** Registered tool for `id`, or `undefined` when it is absent. */
  get(id: string): RegisteredLifecycleTool<Types, Declaration> | undefined {
    return this.registered.get(id);
  }
  /**
   * Registered tool for `id`.
   *
   * @throws TypeError When the id is not registered.
   */
  require(id: string): RegisteredLifecycleTool<Types, Declaration> {
    this.tools.require(id);
    return this.registered.get(id)!;
  }
  /** Whether a tool id is registered. */
  has(name: string): boolean {
    return this.tools.has(name);
  }
  /** Iterate the registered tools. */
  values(): IterableIterator<RegisteredLifecycleTool<Types, Declaration>> {
    return this.registered.values();
  }
  /**
   * Install the single normalization handler.
   *
   * @throws An error when a handler is already installed or the registry is sealed, because a
   *   second handler would make normalization order ambiguous.
   */
  registerNormalizer(handler: ToolNormalizer<Types>): void {
    breakWhile(this.sealed || this.normalizer, 'Normalizer already registered or registry sealed');
    this.normalizer = handler;
  }
  /** Apply the installed normalizer, or return the value unchanged when none exists. */
  normalize(value: unknown, ...args: Types['normalizerArgs']): unknown {
    return this.normalizer
      ? synchronous(
          this.normalizer.call(this.options.receiver?.() ?? this, value, ...args),
          'LifecycleTool normalization must be synchronous',
        )
      : value;
  }
  /**
   * Install the single reply finalizer.
   *
   * @throws An error when a finalizer is already installed or the registry is sealed.
   */
  registerFinalizer(handler: ToolFinalizer<Types>): void {
    breakWhile(this.sealed || this.finalizer, 'Finalizer already registered or registry sealed');
    this.finalizer = handler;
  }
  /**
   * Run the installed finalizer over a decision.
   *
   * @throws An error when no finalizer is installed, or when it does not finish synchronously.
   */
  finish(
    receiver: Types['receiver'],
    decision: Types['decision'],
    context: Types['context'],
  ): Types['result'] {
    breakWhile(!this.finalizer, 'No registered reply finalizer');
    return synchronous(
      this.finalizer!.call(receiver, receiver, decision, context),
      'LifecycleTool finalization must be synchronous',
    );
  }

  /**
   * Run the invocation that answers one decision next.
   *
   * Delegation is the App's choice; this method only executes the tool that claimed the id, so a
   * purely programmatic node, a model choice and a mixed pipeline all dispatch the same way.
   *
   * Diagnostics are swapped to the invocation's own sink for the duration of the call and
   * restored afterwards, so nested tool calls report under the innermost scope.
   *
   * @param next - Decision next carrying the claimed delegate id in `type`.
   * @param context - Execution context forwarded to Core's invocation executor.
   * @throws A configured error when the delegate is unknown or the tool is unavailable.
   */
  call(next: { type: string }, context: Types['context']): void {
    const tool = this.registered.get(next.type);
    breakWhile([
      {
        occur: () => typeof tool?.lifecycle?.call !== 'function',
        error: () =>
          this.options.unavailableInvocation?.(next.type) ??
          new Error(`LifecycleTool invocation is not registered: ${next.type}`),
      },
      {
        occur: () => !toolActive(tool!.active, context),
        error: () => this.options.forbidden?.() ?? new Error('LifecycleTool is not available'),
      },
    ]);
    executeInvocation(
      {
        id: tool!.id,
        call: (input, executionContext, execution) => {
          const previous = this.activeDiagnostics;
          this.activeDiagnostics = execution.diagnostics;
          try {
            tool!.lifecycle!.call!(input, executionContext, execution);
          } finally {
            this.activeDiagnostics = previous;
          }
        },
      },
      next,
      context,
      this.invocationPorts,
    );
  }

  /** Output protocols plus one protocol per registered invocation. */
  protocols(): ProtocolRegistry<ToolProtocol<Declaration>> {
    return new ProtocolRegistry([...this.options.outputs(), ...this.invocationProtocols()]);
  }
  /**
   * Protocols exposed to the model: output protocols plus invocations whose audience is `model` and
   * which are currently available in `context`.
   */
  modelProtocols(context: Types['context']): ProtocolRegistry<ToolProtocol<Declaration>> {
    return new ProtocolRegistry([
      ...(this.options.modelOutputs?.(context) ?? this.options.outputs()),
      ...this.invocationProtocols(
        (tool) => tool.audience === 'model' && toolActive(tool.active, context),
      ),
    ]);
  }
  /** Whether the protocol registered for this invocation is declared terminal. */
  isTerminal(next: { type: string }): boolean {
    return this.protocols().get(next.type)?.terminal === true;
  }

  /** `[invocationId, protocol]` pairs, optionally filtered by the owning tool. */
  private invocationProtocols(
    keep?: (tool: PreparedTool<Types, Declaration>) => boolean,
  ): (readonly [string, ToolProtocol<Declaration>])[] {
    return [...this.registered]
      .filter(([, tool]) => typeof tool.lifecycle?.call === 'function')
      .filter(([, tool]) => !keep || keep(tool))
      .map(
        ([id, tool]) =>
          [id, tool.lifecycle!.protocol as ToolProtocol<Declaration>] as readonly [
            string,
            ToolProtocol<Declaration>,
          ],
      );
  }

  /**
   * Run `inspect` for every registered tool in registration order.
   *
   * `inspect` belongs to the all-tools group, so the selected tool participates exactly once
   * through the same loop rather than through a second selected-only pass.
   */
  assertDecision(decision: Types['decision'], context: Types['context']): void {
    for (const tool of this.registered.values()) tool.lifecycle?.inspect?.(decision, context);
  }
  /** Run the selected invocation's authorization hook, if any. */
  authorize(decision: Types['decision'], context: Types['context']): void {
    this.selected(decision)?.lifecycle?.authorize?.(decision, context);
  }
  /** Whether the selected invocation should resume rather than start fresh; defaults to false. */
  resume(decision: Types['decision'], context: Types['context']): boolean {
    const lifecycle = this.selected(decision)?.lifecycle;
    return lifecycle?.resume
      ? booleanResult(
          lifecycle.resume(decision, context),
          'LifecycleTool resume must return boolean synchronously',
        )
      : false;
  }
  /** Let the selected invocation rewrite the decision on completion, if it declares a hook. */
  complete(decision: Types['decision'], context: Types['context']): Types['decision'] | undefined {
    return this.selected(decision)?.lifecycle?.complete?.(decision, context);
  }
  /** Fold every tool's context projection over the value, in registration order. */
  projectContext(value: unknown): unknown {
    return [...this.registered.values()].reduce(
      (current, tool) => tool.lifecycle?.projectContext?.(current) ?? current,
      value,
    );
  }
  /** Fold every tool's visible-text transform over the text. */
  visibleText(text: string, context: Types['context']): string {
    return [...this.registered.values()].reduce(
      (value, tool) => tool.lifecycle?.visibleText?.(value, context) ?? value,
      text,
    );
  }
  /** Fold every tool's review transform over the draft. */
  reviewDraft(draft: unknown, context: Types['context']): unknown {
    return [...this.registered.values()].reduce(
      (value, tool) => tool.lifecycle?.reviewDraft?.(value, context) ?? value,
      draft,
    );
  }
  /** Collected recovery context values; `undefined` results are omitted. */
  recoveryContext(context: Types['context']): unknown[] {
    return [...this.registered.values()].flatMap((tool) => {
      const value = tool.lifecycle?.recoveryContext?.(context);
      return value === undefined ? [] : [value];
    });
  }
  /**
   * The single output template that owns this delivery.
   *
   * @throws An error when more than one tool claims composition, because delivery would
   *   otherwise depend on registration order.
   */
  composition(context: Types['context']): Types['composition'] | undefined {
    const values = [...this.registered.values()].flatMap((tool) => {
      const value = tool.lifecycle?.composition?.(context);
      return value ? [value] : [];
    });
    breakWhile(values.length > 1, 'More than one output template owns this delivery');
    return values[0];
  }
  /** Run every tool's finalize hook for the given phase. */
  finalize(decision: Types['decision'], context: Types['context'], phase: Types['phase']): void {
    for (const tool of this.registered.values())
      tool.lifecycle?.finalize?.(decision, context, phase);
  }
  /** Whether any tool permits the interaction to be missing. */
  missingInteractionAllowed(decision: Types['decision'], context: Types['context']): boolean {
    return [...this.registered.values()].some((tool) =>
      tool.lifecycle?.missingInteractionAllowed
        ? booleanResult(
            tool.lifecycle.missingInteractionAllowed(decision, context),
            'Missing interaction predicates must return boolean synchronously',
          )
        : false,
    );
  }
  /** Task rules ordered by their declared `order`, joined into one prompt block. */
  taskRules(context: Types['context']): string {
    return [...this.registered.values()]
      .flatMap((tool) => tool.lifecycle?.rules?.(context) ?? [])
      .sort((left, right) => left.order - right.order)
      .map((rule) => rule.text)
      .filter(Boolean)
      .join('\n\n');
  }
  /** Model-context fragments for one placement, ordered by each field's `order`. */
  contextFields(context: Types['context'], placement: Types['placement']) {
    return [...this.registered.values()]
      .flatMap((tool) =>
        (tool.lifecycle?.modelFields?.(context, placement) ?? [])
          .filter((field) => field.placement === placement)
          .map((field) => ({ tool, field })),
      )
      .sort((left, right) => left.field.order - right.field.order)
      .map(({ tool, field }) => this.options.contextFragment(this.sources.get(tool.id)!, field));
  }
  /** Merged model-context values for one placement; later fragments win per key. */
  modelFields(context: Types['context'], placement: Types['placement']) {
    const fields: Record<string, unknown> = {};
    for (const { value } of this.contextFields(context, placement)) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
      for (const [key, entry] of Object.entries(value))
        // Own data properties keep keys such as `__proto__` from rewriting the merged result's
        // prototype, matching how context assembly writes structured fields.
        Object.defineProperty(fields, key, {
          value: entry,
          enumerable: true,
          configurable: true,
          writable: true,
        });
    }
    return fields;
  }
  /** @deprecated Use supportsDomainTool. Runtime alias shares the same method identity. */
  declare supportsGoal: (id: string, context: Types['context']) => boolean;
  /** Canonical metadata projection. */
  describeDomainTools(audience?: string, context?: Types['context']) {
    return this.describe(audience, context).map(domainProjection);
  }
  /** A lifecycle tool may veto domain membership; silence means support. */
  supportsDomainTool(intentId: string, context: Types['context']): boolean {
    return [...this.registered.values()].every(
      (tool) =>
        (tool.lifecycle?.supportsDomainTool ?? tool.lifecycle?.supportsGoal)?.(
          intentId,
          context,
        ) !== false,
    );
  }
  /**
   * Describe registered tools, optionally limited by audience and availability.
   *
   * A tool with an `available` predicate is only listed when a context is supplied and the
   * predicate holds, so a caller that omits the context sees just the unconditional tools.
   *
   * @param audience - Audience to keep; omit to include every audience.
   * @param context - Context for availability checks.
   * @returns Plain metadata; `goalIds: 'all'` is expanded to the current goal ids.
   */
  describe(
    audience?: string,
    context?: Types['context'],
  ): {
    id: Declaration['id'];
    kind: Declaration['kind'];
    description: Declaration['description'];
    audience: Declaration['audience'];
    effect: Declaration['effect'];
    goalIds: string[];
  }[] {
    return [...this.registered.values()]
      .filter(
        (tool) =>
          (!audience || tool.audience === audience) &&
          (tool.active === undefined ||
            (typeof tool.active === 'boolean'
              ? toolActive(tool.active, context)
              : !!context && toolActive(tool.active, context))),
      )
      .map(({ id, kind, description, audience, effect, goalIds }) => ({
        id,
        kind,
        description,
        audience,
        effect,
        goalIds: goalIds === 'all' ? [...this.options.goalIds!()] : [...goalIds],
      }));
  }
  /**
   * Reinstall every registered tool, plus the finalizer and normalizer, into another registry.
   *
   * The original definitions are reused rather than the compiled views, so the target applies
   * its own policy checks and binding exactly as it would for a first registration.
   */
  copyTo(target: ToolLifecycleRegistry<Types, Declaration>): void {
    for (const tool of this.registered.values()) target.install(this.sources.get(tool.id)!, tool);
    if (this.finalizer) target.registerFinalizer(this.finalizer);
    if (this.normalizer) target.registerNormalizer(this.normalizer);
  }
  /** Freeze the registry: no further registration, normalizer or finalizer is accepted. */
  seal(): this {
    this.sealed = true;
    this.tools.seal();
    return this;
  }
  /** LifecycleTool that owns the invocation id named by the decision, if any. */
  private selected(decision: Types['decision']): PreparedTool<Types, Declaration> | undefined {
    return this.registered.get(this.options.toolId!(decision));
  }
}

/** Both public spellings are the same method, so a registry can serve either catalog port. */
Object.defineProperty(ToolLifecycleRegistry.prototype, 'supportsGoal', {
  value: ToolLifecycleRegistry.prototype.supportsDomainTool,
  configurable: true,
  writable: true,
});

export type {
  ToolRuntimeTypes,
  LifecycleTool,
  LifecycleToolRegistration,
  RegisteredLifecycleTool,
  ToolLifecycleRegistryOptions,
  ToolLifecyclePolicy,
  ToolLifecycleHooks,
  ToolLifecycleProtocol,
  ToolModelField,
  ToolNormalizer,
  ToolFinalizer,
  ToolJournal,
  ToolProtocol,
} from '../structs/kits/tools.js';

/** The lifecycle registry is the public `Tools` Kit entry point. */

/** @deprecated Use the explicit lifecycle names; these aliases remain for 1.x. */
export type {
  RegisteredLifecycleTool as RegisteredToolDefinition,
  ToolLifecycleHooks as LifecycleHooks,
  ToolLifecycleProtocol as LifecycleProtocol,
} from '../structs/kits/tools.js';

/** Explicit old option and policy shapes. */
export type { Tool, ToolRegistration, Policy, ToolsOptions } from '../structs/kits/tools.js';

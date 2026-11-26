/**
 * LifecycleTool contract for the Tools Kit.
 *
 * Place in the package: an optional App-side library for tools that need more than a plain
 * definition — availability, one lifecycle hook set, output ownership, model-context fields,
 * task rules and delivery hooks. Actual invocation is delegated to Core (`ToolRegistry`,
 * `executeInvocation`); domain predicates, phase names and vocabulary stay App configuration.
 *
 * A tool declares at most one `lifecycle` block. Hooks under "selected" run only for the tool a
 * decision picks; the rest run for every registered tool; `delegate` claims one delegate id so
 * the registry can route a decision to its handler.
 *
 * Exports: `ToolRuntimeTypes`, `ToolModelField`, `ToolLifecycleProtocol`, `ToolLifecycleHooks`, `LifecycleTool`,
 * `LifecycleToolRegistration`, `RegisteredLifecycleTool`, `ToolLifecyclePolicy`, `ToolProtocol`, `ToolNormalizer`,
 * `ToolFinalizer`, `ToolLifecycleRegistryOptions`, `ToolJournal` (type re-export).
 */
import type { ContextFragment, ContextLifetime } from '../context/fragments.js';
import type { BreakReason } from '../utils/rules.js';
import type { ErasedTool, ToolExecutionContext, ToolRegistryPorts } from '../capabilities/tools.js';
import type { ProtocolShape } from './interaction.js';
import type { ModelTool } from '../capabilities/model.js';
import type { ToolInvocationPorts } from '../capabilities/invocation.js';
import type { RegistrationProjection } from '../../utils/registration.js';

/** One schema binds lifecycle handler types without introducing platform fields into core. */
export interface ToolRuntimeTypes {
  /** App decision object carried through lifecycle invocations. */
  decision: unknown;
  /** App handler context for one request. */
  context: unknown;
  /** Value produced by a tool's `composition` hook. */
  composition: unknown;
  /** App phase names used by `finalize`. */
  phase: string;
  /** App placement names used to group model-context fields. */
  placement: string;
  /** Extra arguments accepted by a tool normalizer. */
  normalizerArgs: unknown[];
  /** Value produced by a tool finalizer. */
  result: unknown;
  /** Value handed to the finalizer, supplied by the lifecycle receiver. */
  receiver: unknown;
}

/** One model-context field contributed by a tool. */
export interface ToolModelField<Placement extends string = string> {
  /** Validity window of the produced fragment. */
  lifetime?: ContextLifetime;
  /** Character budget of the produced fragment. */
  maxChars?: number;
  /** Placement group this field belongs to; only that placement consumes it. */
  placement: Placement;
  /** Ordering key; lower values are emitted first within a placement. */
  order: number;
  /** Key inside the merged model field record; later entries win. */
  key: string;
  /** Field value, rendered by the registry's fragment factory. */
  value: unknown;
}

/** Output protocol carried by a tool lifecycle. */
export interface ToolLifecycleProtocol extends ProtocolShape {
  /** Protocol version; compared with the configured `protocolVersion` when present. */
  readonly version?: number;
  /** Marks an output that ends the interaction. */
  readonly terminal?: boolean;
}

/**
 * Everything one tool declares for a request.
 *
 * Declaring `protocol` or `call` makes the tool callable under its own id; both become
 * required in practice; the registry rejects a partial declaration. Every other hook is
 * optional and returning nothing expresses "no opinion".
 */
export interface ToolLifecycleHooks<
  Types extends ToolRuntimeTypes,
  Protocol extends ToolLifecycleProtocol = ToolLifecycleProtocol,
> {
  // ---- Selected: only the tool that owns the decision's invocation runs these. ----

  /** Output protocol of the invocation. */
  protocol?: Protocol;
  /** Executes the invocation. Must be synchronous and return nothing. */
  call?(value: unknown, context: Types['context'], execution: ToolExecutionContext): void;
  /** Permission check for the decision; runs before execution. */
  authorize?(decision: Types['decision'], context: Types['context']): void;
  /** Returns true when this invocation is a valid continuation of the decision. */
  resume?(decision: Types['decision'], context: Types['context']): boolean;
  /** Normalizes the decision after the invocation; returning undefined keeps it unchanged. */
  complete?(decision: Types['decision'], context: Types['context']): Types['decision'] | undefined;

  // ---- All: every registered tool participates. ----

  /** Observes the decision before any invocation runs. */
  inspect?(decision: Types['decision'], context: Types['context']): void;
  /** Runs finalization for one phase. */
  finalize?(decision: Types['decision'], context: Types['context'], phase: Types['phase']): void;
  /** Extra rules contributed to the model context, ordered by `order`. */
  rules?(context: Types['context']): { order: number; text: string }[];
  /** Model-context fields for one placement, ordered by `order`. */
  modelFields?(
    context: Types['context'],
    placement: Types['placement'],
  ): ToolModelField<Types['placement']>[];
  /** Rewrites visible text produced by this tool. */
  visibleText?(text: string, context: Types['context']): string;
  /** Reviews a draft before delivery. */
  reviewDraft?(draft: unknown, context: Types['context']): unknown;
  /** Builds the tool's composition value for the current context. */
  composition?(context: Types['context']): Types['composition'] | undefined;
  /** Extra context used when recovering a previous attempt. */
  recoveryContext?(context: Types['context']): unknown;
  /** Projects the stored context before it is shown or persisted. */
  projectContext?(context: unknown): unknown;
  /** Returns true when an absent interaction is acceptable in this phase. */
  missingInteractionAllowed?(decision: Types['decision'], context: Types['context']): boolean;
  /** Vetoes a goal by returning false; silence (undefined) means support. */
  supportsDomainTool?(domainToolId: string, context: Types['context']): boolean | undefined;
  /** @deprecated Use supportsDomainTool. */
  supportsGoal?(goalId: string, context: Types['context']): boolean | undefined;
}

/** A registered tool: model metadata plus one optional lifecycle block. */
export interface LifecycleToolBase<Types extends ToolRuntimeTypes>
  extends ErasedTool, ModelTool<unknown, unknown, Types['context']> {
  /** Goal ids this tool serves, or `'all'` when it is always available. */
  readonly description: string;
  /** Audience this tool is described to; validated against the registry policy. */
  readonly audience: string;
  /** Declared effect class, for example read-only or mutating. */
  readonly effect: string;
  /** Lifecycle hooks this tool declares for a request. */
  readonly lifecycle?: ToolLifecycleHooks<Types>;
}

/** Membership accepts either canonical names or the explicit 0.9 compatibility form. */
export type ToolDomainMembership =
  | {
      readonly domainToolIds: 'all' | readonly string[];
      readonly goalIds?: 'all' | readonly string[];
    }
  | {
      readonly goalIds: 'all' | readonly string[];
      readonly domainToolIds?: 'all' | readonly string[];
    };
/** A tool with optional lifecycle behavior and required domain membership. */
export type LifecycleTool<Types extends ToolRuntimeTypes> = LifecycleToolBase<Types> &
  ToolDomainMembership;

/** Declaration form; the registry derives the ModelTool projection from existing handlers. */
export type LifecycleToolRegistration<Types extends ToolRuntimeTypes> = Omit<
  LifecycleToolBase<Types>,
  'inputSchema' | 'resolve'
> &
  Partial<Pick<LifecycleToolBase<Types>, 'inputSchema' | 'resolve'>> &
  ToolDomainMembership;

type RegisteredLifecycle<Types extends ToolRuntimeTypes, Value> =
  Value extends ToolLifecycleHooks<Types>
    ? RegistrationProjection<Value, ToolLifecycleHooks<Types>>
    : Value;

/** Normalized membership preserves a declaration's literal relation IDs for either input spelling. */
type RegisteredToolDomainIds<Declaration> = Declaration extends {
  readonly domainToolIds: infer Ids extends 'all' | readonly string[];
}
  ? Readonly<Ids>
  : Declaration extends { readonly goalIds: infer Ids extends 'all' | readonly string[] }
    ? Readonly<Ids>
    : 'all' | readonly string[];

/** Registered snapshot with frozen goal ids and projected hooks. */
export type RegisteredLifecycleTool<
  Types extends ToolRuntimeTypes,
  Declaration extends LifecycleToolRegistration<Types> = LifecycleToolRegistration<Types>,
> = Readonly<
  Omit<
    RegistrationProjection<Declaration, LifecycleTool<Types>>,
    'lifecycle' | 'goalIds' | 'domainToolIds'
  > & {
    lifecycle?: RegisteredLifecycle<Types, Declaration['lifecycle']>;
    goalIds: RegisteredToolDomainIds<Declaration>;
    domainToolIds: RegisteredToolDomainIds<Declaration>;
  }
>;

/** Registration policy shared by every tool in the registry. */
interface ToolLifecyclePolicyBase<LifecycleTool> {
  /** Accepted values of a tool's `kind`. */
  readonly kinds: readonly string[];
  /** Identity and shape predicate; must be synchronous boolean. */
  readonly isValidId: (tool: LifecycleTool) => boolean;
  /** Accepted `audience` values. */
  readonly audiences: readonly string[];
  /** Accepted `effect` values. */
  readonly effects: readonly string[];
  /** Reports whether a goal id exists, for validating `goalIds` references. */
  readonly domainToolExists?: (domainToolId: string) => boolean;
  /** @deprecated Use domainToolExists. */
  readonly goalExists?: (goal: string) => boolean;
  /** When set, every lifecycle protocol must declare this version. */
  readonly protocolVersion?: number;
  /** Diagnostic tags attached to registration rejections. */
  readonly tags?: readonly string[];
  /** Rejection wording for an invalid tool definition. */
  readonly invalidTool?: BreakReason;
  /** Rejection wording for an invalid or duplicate invocation id. */
  readonly invalidInvocation?: BreakReason;
}

/** Protocol type of a tool's lifecycle invocation. */
export type ToolProtocol<
  LifecycleTool extends { lifecycle?: { protocol?: ToolLifecycleProtocol } },
> = NonNullable<NonNullable<LifecycleTool['lifecycle']>['protocol']>;
/** Converts untrusted input into a decision; must be synchronous. */
export type ToolNormalizer<Types extends ToolRuntimeTypes> = (
  value: unknown,
  ...args: Types['normalizerArgs']
) => unknown;
/** Converts an executed decision into the tool result; must be synchronous. */
export type ToolFinalizer<Types extends ToolRuntimeTypes> = (
  receiver: Types['receiver'],
  decision: Types['decision'],
  context: Types['context'],
) => Types['result'];

/** Construction options for a tool registry. */
interface ToolLifecycleRegistryOptionsBase<
  Types extends ToolRuntimeTypes,
  Declaration extends LifecycleToolRegistration<Types>,
> extends ToolInvocationPorts<Types['context']> {
  /** Supplies the receiver handed to the finalizer. */
  readonly receiver?: () => Types['receiver'];
  /** Execution defaults (signal and diagnostics) applied to invocations. */
  readonly execution?: import('../common.js').ExecutionOptions;
  /** Error factories shared by the registry. */
  readonly errors?: Pick<ToolRegistryPorts, 'unavailable' | 'errorCode'>;
  /** Registration policy for every tool. */
  readonly registration: ToolLifecyclePolicy<Declaration>;
  /** Selects the tool id from a custom decision shape; defaults to next.type or type. */
  readonly toolId?: (decision: Types['decision']) => string;
  /** Output protocols by id, used to validate invocation outputs. */
  readonly outputs: () => Iterable<readonly [string, ToolProtocol<Declaration>]>;
  /** Optional context-dependent output protocols, exposed alongside `outputs`. */
  readonly modelOutputs?: (
    context: Types['context'],
  ) => Iterable<readonly [string, ToolProtocol<Declaration>]>;
  /** Builds the error for an invocation id with no registered tool. */
  readonly unavailableInvocation?: (invocationId: string) => Error;
  /** Builds the error for a tool that is currently unavailable. */
  readonly forbidden?: () => Error;
  /** Renders a model field into a context fragment. */
  readonly contextFragment: (
    tool: Declaration,
    field: ToolModelField<Types['placement']>,
  ) => ContextFragment;
  /** Current goal ids, used to validate `goalIds: 'all'` availability. */
  readonly domainToolIds?: () => readonly string[];
  /** @deprecated Use domainToolIds. */
  readonly goalIds?: () => readonly string[];
}

export type { ToolJournal } from '../capabilities/invocation.js';

/** @deprecated Use the explicit lifecycle names; these aliases remain for 1.x. */
export type {
  RegisteredLifecycleTool as RegisteredToolDefinition,
  ToolLifecycleHooks as LifecycleHooks,
  ToolLifecycleProtocol as LifecycleProtocol,
};

/** @deprecated Use ToolLifecyclePolicy. */
export type Policy<Tool> = ToolLifecyclePolicy<Tool> & {
  readonly goalExists: (goal: string) => boolean;
};
/** @deprecated Use ToolLifecycleRegistryOptions. */
export type ToolsOptions<
  Types extends ToolRuntimeTypes,
  Declaration extends LifecycleToolRegistration<Types>,
> = ToolLifecycleRegistryOptions<Types, Declaration> & {
  readonly goalIds: () => readonly string[];
};

/** @deprecated Use LifecycleTool and domainToolIds. */
export type Tool<Types extends ToolRuntimeTypes> = LifecycleTool<Types> & {
  readonly goalIds: 'all' | readonly string[];
};
/** @deprecated Use LifecycleToolRegistration. */
export type ToolRegistration<Types extends ToolRuntimeTypes> = Omit<
  Tool<Types>,
  'inputSchema' | 'resolve'
> &
  Partial<Pick<Tool<Types>, 'inputSchema' | 'resolve'>>;

/** A lifecycle policy must supply either the canonical or the legacy lookup. */
export type ToolLifecyclePolicy<Tool> = ToolLifecyclePolicyBase<Tool> &
  (
    | { readonly domainToolExists: (id: string) => boolean }
    | { readonly goalExists: (id: string) => boolean }
  );
/** A lifecycle registry must supply a canonical or explicit legacy membership source. */
export type ToolLifecycleRegistryOptions<
  Types extends ToolRuntimeTypes,
  Declaration extends LifecycleToolRegistration<Types>,
> = ToolLifecycleRegistryOptionsBase<Types, Declaration> &
  (
    | { readonly domainToolIds: () => readonly string[] }
    | { readonly goalIds: () => readonly string[] }
  );

/**
 * Model runtime contract: budgets, interactions, call traces and prepared calls.
 *
 * A runner owns one request's call budget, deadlines and input/output limits. It prepares a
 * interaction (schemas, instruction, collector), measures the input, charges one call and reports a
 * trace. Child runners share the request-wide limits, so a nested stage can only consume what the
 * parent already reserved.
 *
 * Exports: `ModelTokenBudget`, `ModelRuntimeConfig`, `ModelChildPolicy`,
 * `ModelInteractionDefinition`,
 * `ModelCallTrace`, `ModelOutputEvent`, `ModelRunnerPorts`, `ModelChildOptions`,
 * `ModelRunnerSettings`, `RegisteredInteractionOutput`, `ModelRunnerOptions`, `ModelCallRequest`,
 * `ModelInputMeasurement`, `PreparedModelCall`, `ModelPrepareRequest`.
 */
import type { PreparedModelInteraction } from './interactions.js';
import type { InvocationMetadata } from '../invocation.js';
import type { ExecutionOptions } from '../common.js';
import type { DiagnosticContext } from '../diagnostics.js';
import type { ModelOptions, ModelUsage, ModelMessage, ModelPart } from './messages.js';
import type { ChatProvider } from './chat-provider.js';
import type { BuiltContext } from '../context/fragments.js';
import type { ContextPlan } from '../context/processing.js';
import type { ContextFragmentUsage } from '../context/fragments.js';

/**
 * Provider-injected token accounting.
 *
 * Core never guesses a character-to-token conversion, so token budgets exist only when a host
 * supplies a real counter.
 */
export interface ModelTokenBudget {
  /** Identifies the tokenizer and its version; recorded in every measurement. */
  counterId: string;
  /** Total context window of the model, in tokens. */
  contextWindowTokens: number;
  /** Additional reserve subtracted together with the output reservation. */
  safetyMarginTokens?: number;
  /** Counts input tokens for the exact request shape that will be sent. */
  countTokens(input: {
    messages: readonly ModelMessage[];
    functions?: ModelOptions['functions'];
    json?: boolean;
    outputSchema?: Readonly<Record<string, unknown>>;
  }): number;
}

/** Per-request model runtime limits. */
export interface ModelRuntimeConfig {
  /** Calls allowed for the whole request, including descendant runners' reservations. */
  maxCalls: number;
  /** Host-authorized ceiling for request-local adjustments; defaults to maxCalls. */
  maxTotalCalls?: number;
  /** Deadline for one provider call, in milliseconds. */
  callTimeoutMs: number;
  /** Cap on streamed output characters; exceeding it fails the call. */
  maxOutputChars?: number;
  /** Request and record provider usage for each call. */
  usage?: boolean;
}

/** Request-wide limits, shared by every descendant. They cannot be enlarged by a child. */
export interface ModelChildPolicy {
  /** Maximum nesting depth of child runners; `0` forbids children. */
  readonly maxDepth?: number;
  /** Maximum calls running at the same time across the request. */
  readonly maxConcurrentCalls?: number;
  /** Maximum child runners created across the request. */
  readonly maxChildren?: number;
}

/** One registered interaction: a wire format prepared for a stage. */
export interface ModelInteractionDefinition<Result = unknown> {
  /** Transport id used by call requests and reported in diagnostics. */
  readonly id: string;
  /** Builds the prepared interaction for `stageId`; must not spend a call by itself. */
  prepare(stageId: string): import('./interactions.js').PreparedModelInteraction<Result>;
}

/** Accumulated facts of one model call, reported on success and on failure. */
export interface ModelCallTrace extends InvocationMetadata {
  /** One-based position of the call within its runner's lifetime. */
  callSequence: number;
  stageId: string;
  /** Model binding used for the call, when one was configured. */
  modelId?: string;
  /** Counted input characters (messages, instruction and schemas). */
  inputChars: number;
  /** Measured input tokens; present only with an explicit token counter. */
  inputTokens?: number;
  /** Token ceiling the measurement was compared against. */
  inputTokenLimit?: number;
  /** Characters received from the provider. */
  outputChars: number;
  /** Time to first streamed part in milliseconds; `null` until a part arrived. */
  firstOutputMs?: number | null;
  /** Milliseconds from the first part to the end of the stream. */
  outputDurationMs?: number;
  status: import('../common.js').InvocationStatus;
  /** Error or protocol codes observed during the call, in occurrence order. */
  codes: string[];
  usage?: ModelUsage;
  /** Selected function call, when the response produced one. */
  functionCall?: { id: string; name: string; argumentChars: number };
  /** All calls produced by a model tool response; omitted for single-selection interactions. */
  calls?: readonly { id: string; name: string; argumentChars: number; toolId?: string }[];
  /** Context accounting: per-fragment usage and characters shared with the previous call. */
  context?: { fragmentUsage: ContextFragmentUsage[]; stablePrefixChars: number };
}

/** Delivery sink, awaited in order. Parts are unvalidated proposals, never execution receipts. */
export type ModelOutputEvent = Extract<
  import('../execution/events.js').CoreEvent,
  { type: 'model.start' | 'model.output' | 'model.parsed' | 'model.end' }
>;

/** Host ports a model runner needs in addition to its provider and interactions. */
export interface ModelRunnerPorts {
  /** Ordered delivery of model events; awaits each call before continuing. */
  onOutput?(event: ModelOutputEvent): void | Promise<void>;
  /** Transports available by id and instance. */
  interactions?: readonly ModelInteractionDefinition[];
  /** @deprecated Use interactions. Conflicting aliases are rejected. */
  transports?: readonly ModelInteractionDefinition[];
  diagnostics?: DiagnosticContext;
  /** Separate allowance for registered schemas; existing context budgets keep their meaning. */
  maxSchemaChars?: number;
  tokenBudget?: ModelTokenBudget;
  /** Builds the error for an input that exceeds the character or token limit. */
  inputBudgetError?(limit: number): Error;
  /** Builds the error for output that exceeds the character limit. */
  outputBudgetError?(): Error;
}

/** Request-bound isolated runner settings; provider and ancestor budgets cannot be replaced. */
export interface ModelChildOptions {
  /** Existing execution binding; does not reset an already-bound parent. */
  readonly execution?: import('../common.js').ExecutionOptions;
  /** Child stage id, reported in traces and events. */
  readonly id: string;
  /** Calls the child may use from the shared request budget. */
  readonly maxCalls: number;
  /** Calls kept for the parent; the child cannot spend them. */
  readonly reserveCalls: number;
  /** Deadline for the child's own calls, in milliseconds. */
  readonly timeoutMs: number;
  /** Additional interactions visible to the child. */
  readonly interactions?: readonly ModelInteractionDefinition[];
  /** @deprecated Use interactions. Conflicting aliases are rejected. */
  transports?: readonly ModelInteractionDefinition[];
  readonly diagnostics?: DiagnosticContext;
  /** Extra cancellation; can only shorten the parent's lifetime. */
  readonly signal?: AbortSignal;
}

/** Named settings keep all model limits together; output token reservation stays per call. */
export interface ModelRunnerSettings extends Partial<ModelRuntimeConfig> {
  readonly children?: ModelChildPolicy;
  /** Character budget for the assembled input. */
  maxInputChars?: number;
  /** Character allowance for registered capability schemas. */
  maxSchemaChars?: number;
  tokenBudget?: ModelTokenBudget;
  /** Default output reservation; invoke can override it for one call. */
  maxOutputTokens?: number;
}

/**
 * Result type of an interaction selected by id.
 *
 * `core:plain-text` yields `string`, a registered id yields its declared result, and an id the
 * runner does not know yields `unknown` rather than a guessed type.
 */
export type RegisteredInteractionOutput<
  Transports extends readonly ModelInteractionDefinition[],
  Id extends string,
> = string extends Id
  ? unknown
  : Id extends 'core:plain-text'
    ? string
    : [Extract<Transports[number], { readonly id: Id }>] extends [never]
      ? unknown
      : Extract<Transports[number], { readonly id: Id }> extends ModelInteractionDefinition<
            infer Value
          >
        ? Value
        : unknown;

/** Full runner construction options: provider, interactions, sinks and named limits. */
export type ModelRunnerOptions<
  Transports extends readonly ModelInteractionDefinition[] = readonly ModelInteractionDefinition[],
> = {
  provider: import('./chat-provider.js').ModelProvider;
  /** Bind one cumulative request lifetime; omission keeps top-level invocations isolated. */
  execution?: ExecutionOptions;
  interactions?: Transports;
  /** @deprecated Use interactions. */
  transports?: Transports;
  sink?: { output?: ModelRunnerPorts['onOutput'] };
  errors?: {
    inputBudget?: ModelRunnerPorts['inputBudgetError'];
    outputBudget?: ModelRunnerPorts['outputBudgetError'];
  };
} & ModelRunnerSettings;

/** Trusted App guidance for a user-facing reply; explicit user detail/format requests take priority. */
export interface ReplyGuidance {
  readonly defaultDetail: 'brief' | 'normal' | 'detailed';
}

/** One model call request. The input shape selects prompt mode or message mode. */
export type ModelCallRequest<Transport = string> = {
  /** Share the existing execution across stages; omission creates an isolated top-level call. */
  readonly execution?: import('../common.js').ExecutionOptions;
  /** Record this call in the supplied logger; omission adds no sub-flow record. */
  readonly logger?: import('../debug.js').ReportedStepRecorder;
  /** Additional cancellation can shorten, never replace, the Runner lifetime. */
  readonly signal?: AbortSignal;
  /** Parent observation scope for this invocation; never changes execution budget or signal. */
  readonly diagnostics?: DiagnosticContext;
  /** Reuse a prepared call; its stage, interaction and output reservation then take precedence. */
  readonly prepared?: PreparedModelCall;
  /** Scoped per-turn protocol state and output settings; cannot override a prepared call. */
  readonly modelOptions?: import('./messages.js').ModelInteractionOptions;
  /** Optional reply guidance, frozen during preparation; never inferred from user/tool text. */
  readonly replyGuidance?: ReplyGuidance;
  readonly maxOutputTokens?: number;
  readonly stageId?: string;
  readonly interaction?: Transport;
  /** @deprecated Use interaction. */
  readonly transport?: Transport;
} &
  /** Prompt mode: one user message plus optional instructions. */
  (
    | { input: string; instructions?: string }
    /** Message mode: messages or a context plan; instructions are already inside the input. */
    | { input: readonly ModelMessage[] | BuiltContext | ContextPlan; instructions?: never }
  );

/** Exact prepared-request accounting; token values exist only with an explicit model counter. */
export interface ModelInputMeasurement {
  /** Characters of the message content. */
  readonly messageChars: number;
  /** Characters of the instruction text. */
  readonly instructionChars: number;
  /** Characters of the compiled capability schemas. */
  readonly schemaChars: number;
  /** Characters the interaction itself contributes (for example framing). */
  readonly interactionChars: number;
  /** @deprecated Use interactionChars. */
  readonly transportChars: number;
  /** Sum of the character components above. */
  readonly inputChars: number;
  /** Character budget the input was compared against. */
  readonly maxInputChars: number;
  /** Schema budget the input was compared against. */
  readonly maxSchemaChars: number;
  /** Output tokens reserved for this call, which reduces the token input ceiling. */
  readonly maxOutputTokens: number;
  /** Tokenizer identity; present only when a token budget applies. */
  readonly counterId?: string;
  /** Measured input tokens. */
  readonly inputTokens?: number;
  /** Token ceiling after reserving output and the safety margin. */
  readonly inputTokenLimit?: number;
  /** True when every applicable character and token budget accepted the input. */
  readonly withinBudget: boolean;
}

/**
 * Request-bound, single-use interaction snapshot.
 *
 * Repeated measurements do not prepare or spend calls.
 */
export interface PreparedModelCall<Result = unknown> extends PreparedModelInteraction<Result> {
  /** Model binding the call was prepared with. */
  readonly modelId?: string;
  readonly replyGuidance?: ReplyGuidance;
  readonly stageId: string;
  /** Canonical interaction identity; legacy transportId remains a read alias. */
  readonly interactionId: string;
  /** @deprecated Use interactionId. */
  readonly transportId: string;
  readonly maxOutputTokens: number;
  /** Calls still available; a live value, so later spends are visible. */
  readonly remainingCalls: number;
  /**
   * Preflight measurement of one input shape.
   *
   * Never marks the call used and never charges the budget.
   *
   * @param input - Prompt string, message array or built context to measure.
   * @returns Character and token sizes plus a `withinBudget` verdict.
   */
  measure(input: string | readonly ModelMessage[] | BuiltContext): ModelInputMeasurement;
}
/** Transport selection for `prepare`; omitted fields take the runner defaults. */
export interface ModelPrepareRequest<Transport = string> {
  /** Existing execution shared with invoke and child calls. */
  readonly execution?: import('../common.js').ExecutionOptions;
  readonly replyGuidance?: ReplyGuidance;
  readonly stageId?: string;
  readonly interaction?: Transport;
  /** @deprecated Use interaction. */
  readonly transport?: Transport;
  readonly maxOutputTokens?: number;
}

/** Read-only accounting returned by ModelRunner; revisions contain host-authored reasons. */
export interface ModelRunnerBudgetSnapshot {
  readonly limit: number;
  readonly ceiling: number;
  readonly used: number;
  readonly remaining: number;
  readonly revisions: readonly Readonly<{
    previous: number;
    limit: number;
    used: number;
    reason: string;
  }>[];
}

/** @deprecated Use `ModelInteractionDefinition`. Retained for the 0.9 migration. */
export type { ModelInteractionDefinition as ModelTransportDefinition };
/** @deprecated Use `RegisteredInteractionOutput`. Retained for the 0.9 migration. */
export type { RegisteredInteractionOutput as RegisteredTransportOutput };

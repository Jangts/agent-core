/**
 * Compile validated model settings into an immutable binding.
 *
 * The runner must not observe configuration changes after construction, so every
 * option, callback and interaction is snapshotted here — once per engine or runner.
 * Lifecycle state (call counters, journals, budgets) stays outside the binding.
 *
 * Exports: the `ModelBinding` interface, the internal `modelBindingId` and
 * `compiledModelBinding` symbols, and `snapshotModelBinding`.
 */
import { defaultTextInteraction, modelRunnerDefaults } from './defaults.js';
import { resolveModelSettings } from './settings.js';
import { normalizeModelInteraction } from './transports.js';
import { validateModelTokenBudget } from './token-budget.js';
import type {
  ModelRunnerOptions,
  ModelRunnerPorts,
  ModelRuntimeConfig,
  ModelInteractionDefinition,
  ModelTokenBudget,
  ModelChildPolicy,
} from '../structs/model/runtime.js';
import type { BoundModelProvider } from '../structs/model/chat-provider.js';

/**
 * Internal compiled definition; execution scope and mutable call state belong to each runner.
 */
export interface ModelBinding {
  /** Provider with its `stream` method already bound to the original receiver. */
  readonly provider: BoundModelProvider;
  /** Frozen call limits and usage reporting switch. */
  readonly config: ModelRuntimeConfig;
  /** Maximum characters of user/assistant message content per call. */
  readonly maxInputChars: number;
  /** Default completion token request per call; overridable per call within limits. */
  readonly maxOutputTokens: number;
  /** Output sink, diagnostics and budget-error hooks, with receivers bound. */
  readonly ports: ModelRunnerPorts;
  /** Optional token accounting contract; absent when the host does not count tokens. */
  readonly tokenBudget?: ModelTokenBudget;
  /** Registered interactions paired with their original source definitions. */
  readonly interactions: readonly {
    /** Definition as supplied by the App; used as the identity key for typed lookups. */
    readonly source: ModelInteractionDefinition;
    /** Normalized, frozen definition actually executed. */
    readonly definition: ModelInteractionDefinition;
  }[];
  /** Child execution limits already merged with defaults and validated. */
  readonly children: Readonly<Required<ModelChildPolicy>>;
}

/**
 * Brand carrying the configured model id through copy operations.
 *
 * Only Core passes compiled definitions; it is not a public configuration alternative.
 */
export const modelBindingId = Symbol('model-binding-id');
/** Escape hatch that lets the engine hand an already compiled binding to a runner. */
export const compiledModelBinding = Symbol('compiled-model-binding');

/**
 * Compile runner options into a frozen binding.
 *
 * Fixed configuration and callbacks are pinned without cloning or freezing App services:
 * providers and sinks stay live objects, only their method receivers are bound. Optional
 * child limits are filled from the defaults before validation, and interactions are
 * normalized and checked for duplicate ids, including the built-in text interaction.
 *
 * @param options - Runner options as supplied by the App or by the engine.
 * @returns A frozen binding shared by every runner created from these options.
 * @throws TypeError When child limits, the token budget or an interaction is invalid.
 * @throws ValidationError When the token budget contract is incomplete.
 */
export function snapshotModelBinding(options: ModelRunnerOptions): ModelBinding {
  const resolved = resolveModelSettings(options);
  if (
    options.children !== undefined &&
    (!options.children || typeof options.children !== 'object' || Array.isArray(options.children))
  )
    throw new TypeError('Invalid child execution policy');
  const sourceChildren = options.children;
  const children = Object.freeze({
    maxDepth:
      sourceChildren?.maxDepth === undefined
        ? modelRunnerDefaults.children.maxDepth
        : sourceChildren.maxDepth,
    maxConcurrentCalls:
      sourceChildren?.maxConcurrentCalls === undefined
        ? modelRunnerDefaults.children.maxConcurrentCalls
        : sourceChildren.maxConcurrentCalls,
    maxChildren:
      sourceChildren?.maxChildren === undefined
        ? modelRunnerDefaults.children.maxChildren
        : sourceChildren.maxChildren,
  });
  if (
    !Number.isSafeInteger(children.maxDepth) ||
    children.maxDepth < 0 ||
    !Number.isSafeInteger(children.maxConcurrentCalls) ||
    children.maxConcurrentCalls < 1 ||
    !Number.isSafeInteger(children.maxChildren) ||
    children.maxChildren < 1
  )
    throw new TypeError('Invalid child execution policy');
  const ports = resolved.ports;
  const sourceBudget = ports.tokenBudget;
  const countTokens = sourceBudget?.countTokens;
  const tokenBudget =
    sourceBudget &&
    Object.freeze({
      counterId: sourceBudget.counterId,
      contextWindowTokens: sourceBudget.contextWindowTokens,
      safetyMarginTokens: sourceBudget.safetyMarginTokens,
      countTokens:
        typeof countTokens === 'function' ? countTokens.bind(sourceBudget) : countTokens!,
    });
  if (tokenBudget) validateModelTokenBudget(tokenBudget);
  const ids = new Set<string>([defaultTextInteraction.id]);
  const interactions = Object.freeze(
    (ports.interactions ?? []).map((source) => {
      const definition = normalizeModelInteraction(source);
      if (ids.has(definition.id)) throw new TypeError('Invalid or duplicate model interaction');
      ids.add(definition.id);
      return Object.freeze({ source, definition });
    }),
  );
  return Object.freeze({
    provider: resolved.provider,
    config: resolved.config,
    children,
    maxInputChars: resolved.maxInputChars,
    maxOutputTokens: resolved.maxOutputTokens,
    tokenBudget,
    interactions,
    ports: Object.freeze({
      maxSchemaChars: ports.maxSchemaChars,
      onOutput: ports.onOutput,
      inputBudgetError: ports.inputBudgetError,
      outputBudgetError: ports.outputBudgetError,
    }),
  });
}

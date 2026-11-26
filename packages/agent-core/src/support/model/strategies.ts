/**
 * Model strategy presets: compose a Core `ModelRunnerOptions` from named sources.
 *
 * A strategy selects a model definition (inline or by catalog ID), optional reasoning variant and
 * a budget preset, then layers any explicit Core fields last. Values are local admission
 * allowances, not claims about provider capacity or performance.
 *
 * Main exports: `modelBudgetStrategies`, `createModelStrategy` and the strategy option types.
 */
import { resolveInteractionAlias } from '../../model/transports.js';
import { snapshotModelBinding } from '../../model/binding.js';
import type { ExecutionOptions } from '../../structs/common.js';
import type {
  ModelRunnerOptions,
  ModelRunnerSettings,
  ModelInteractionDefinition,
} from '../../structs/model/runtime.js';

/**
 * Budget presets by expected workload size.
 *
 * `maxCalls` counts model calls per run; `maxInputChars`/`maxOutputChars` are character budgets;
 * `maxOutputTokens` is the per-call output reservation; `callTimeoutMs` bounds one call in
 * milliseconds. These are local admission and output allowances, never a claim about provider
 * capacity or performance.
 */
export const modelBudgetStrategies = Object.freeze({
  small: Object.freeze({
    maxCalls: 2,
    maxInputChars: 8000,
    maxOutputChars: 4000,
    maxOutputTokens: 512,
    callTimeoutMs: 15000,
  }),
  medium: Object.freeze({
    maxCalls: 8,
    maxInputChars: 32000,
    maxOutputChars: 16000,
    maxOutputTokens: 1024,
    callTimeoutMs: 30000,
  }),
  large: Object.freeze({
    maxCalls: 16,
    maxInputChars: 64000,
    maxOutputChars: 32000,
    maxOutputTokens: 4096,
    callTimeoutMs: 60000,
  }),
});
/** Preset name, or an explicit partial set of Core runner settings. */
export type ModelBudgetStrategy = keyof typeof modelBudgetStrategies | Partial<ModelRunnerSettings>;
type StrategyModel<Transports extends readonly ModelInteractionDefinition[], Execution> = Omit<
  ModelRunnerOptions<Transports>,
  'execution'
> & { execution?: Execution };
/**
 * Input of `createModelStrategy`: model selection, optional reasoning and budget plus explicit
 * Core overrides. Explicit Core fields win over every generated value.
 */
export type ModelStrategyOptions<
  Transports extends readonly ModelInteractionDefinition[] = readonly ModelInteractionDefinition[],
  Execution = ExecutionOptions,
> = Partial<StrategyModel<Transports, Execution>> & {
  /** An existing definition, or an ID in the explicitly supplied model catalog. */
  readonly model: StrategyModel<Transports, Execution> | string;
  /** Named model definitions; required when `model` is a string ID. */
  readonly models?: Readonly<Record<string, StrategyModel<Transports, Execution>>>;
  /** Names and supplier-specific implementations are declared by the App, never guessed. */
  readonly reasoning?: string;
  /** Per-reasoning overrides; entries are applied only when `reasoning` names them. */
  readonly reasoningOptions?: Readonly<
    Record<string, Partial<StrategyModel<Transports, Execution>>>
  >;
  /** Preset name, or an explicit partial budget; defaults to `medium`. */
  readonly budget?: ModelBudgetStrategy;
};

// Exhaustiveness ensures new Core settings cannot silently disappear at this boundary: adding a
// setting to `ModelRunnerSettings` without listing it here fails type checking.
const budgetSettingKeys = {
  maxCalls: true,
  maxTotalCalls: true,
  callTimeoutMs: true,
  maxOutputChars: true,
  usage: true,
  children: true,
  maxInputChars: true,
  maxSchemaChars: true,
  tokenBudget: true,
  maxOutputTokens: true,
} satisfies Record<keyof ModelRunnerSettings, true>;
const settingKeys = {
  ...budgetSettingKeys,
  provider: true,
  execution: true,
  interactions: true,
  transports: true,
  sink: true,
  errors: true,
} satisfies Record<keyof ModelRunnerOptions, true>;
// Copy only known Core keys, so helper fields such as `model`, `models` or `budget` in a selected
// definition are not forwarded as runner options.
function settings(source: Partial<ModelRunnerOptions>): Partial<ModelRunnerOptions> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(settingKeys) as (keyof ModelRunnerOptions)[])
    if (key !== 'interactions' && key !== 'transports' && key in source) result[key] = source[key];
  if ('interactions' in source || 'transports' in source)
    result.interactions = resolveInteractionAlias(source.interactions, source.transports);
  return result;
}

function budgetSettings(source: Partial<ModelRunnerSettings>): Partial<ModelRunnerSettings> {
  // Check forbidden canonical fields on the prototype too: getters can otherwise
  // smuggle a Provider or request execution through a numeric budget override.
  for (const key of Object.keys(settingKeys)) {
    if (!Object.hasOwn(budgetSettingKeys, key) && key in source)
      throw new TypeError(`Invalid model budget field: ${key}`);
  }
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(budgetSettingKeys) as (keyof ModelRunnerSettings)[])
    if (key in source) result[key] = source[key];
  return result;
}

type NamedDefinition<Catalog, Id> = Id extends string
  ? string extends Id
    ? Catalog[keyof Catalog]
    : Id extends keyof Catalog
      ? Catalog[Id]
      : never
  : never;
type SelectedModel<Options extends ModelStrategyOptions> = Options['model'] extends infer Model
  ? Model extends string
    ? NamedDefinition<NonNullable<Options['models']>, Model>
    : Model
  : never;
type SelectedReasoning<Options extends ModelStrategyOptions> = 'reasoning' extends keyof Options
  ? | NamedDefinition<
        NonNullable<Options['reasoningOptions']>,
        Exclude<Options['reasoning'], undefined>
      >
    | (undefined extends Options['reasoning'] ? {} : never)
  : {};
// A present undefined clears the inherited field; an optional field may also be absent.
// Distribute over dynamic catalogs so unrelated interaction IDs retain their own output types.
type TransportsFrom<
  Source,
  Fallback extends readonly ModelInteractionDefinition[],
> = Source extends unknown
  ? 'interactions' extends keyof Source
    ? | Extract<Exclude<Source['interactions'], undefined>, readonly ModelInteractionDefinition[]>
      | (undefined extends Source['interactions'] ? readonly [] : never)
      | ({} extends Pick<Source, 'interactions'> ? Fallback : never)
    : 'transports' extends keyof Source
      ? | Extract<Exclude<Source['transports'], undefined>, readonly ModelInteractionDefinition[]>
        | (undefined extends Source['transports'] ? readonly [] : never)
        | ({} extends Pick<Source, 'transports'> ? Fallback : never)
      : Fallback
  : never;
type ExecutionFrom<Source, Fallback> = Source extends unknown
  ? 'execution' extends keyof Source
    ? Source['execution'] | ({} extends Pick<Source, 'execution'> ? Fallback : never)
    : Fallback
  : never;
type StrategyResult<Options extends ModelStrategyOptions> = Omit<
  ModelRunnerOptions<
    TransportsFrom<
      Options,
      TransportsFrom<
        SelectedReasoning<Options>,
        TransportsFrom<SelectedModel<Options>, readonly []>
      >
    >
  >,
  'execution'
> & {
  execution?: ExecutionFrom<
    Options,
    ExecutionFrom<SelectedReasoning<Options>, ExecutionFrom<SelectedModel<Options>, undefined>>
  >;
};

/**
 * Compose runner options in precedence order: budget preset, selected model, declared reasoning,
 * exact budget, then explicit Core fields.
 *
 * The result is validated through the same Core binding rules but creates no runner and spends no
 * calls.
 *
 * @param options Model selection, optional reasoning and budget, and explicit Core overrides.
 * @returns A frozen, validated `ModelRunnerOptions` with inferred interaction/execution types.
 * @throws {TypeError} When a model ID is unknown, a string model is combined with inline
 *   definitions, a reasoning name is unknown, or a budget field or preset is invalid.
 */
export function createModelStrategy<const Options extends ModelStrategyOptions>(
  options: Options,
): StrategyResult<Options>;
export function createModelStrategy(options: ModelStrategyOptions): ModelRunnerOptions {
  const { model, models, reasoning, reasoningOptions, budget = 'medium' } = options;
  if (typeof model !== 'string' && models !== undefined)
    throw new TypeError('Use a model ID with configured models');
  const selected =
    typeof model === 'string'
      ? models && Object.hasOwn(models, model)
        ? models[model]
        : undefined
      : model;
  if (!selected || typeof selected !== 'object')
    throw new TypeError(`Unknown model strategy: ${String(model)}`);
  const reasoningSettings =
    reasoning === undefined
      ? undefined
      : reasoningOptions && Object.hasOwn(reasoningOptions, reasoning)
        ? reasoningOptions[reasoning]
        : undefined;
  if (reasoning !== undefined && !reasoningSettings)
    throw new TypeError(`Unknown reasoning strategy: ${reasoning}`);
  if (typeof budget === 'string' && !Object.hasOwn(modelBudgetStrategies, budget))
    throw new TypeError(`Unknown model budget: ${budget}`);
  if (
    !budget ||
    (typeof budget !== 'string' && (typeof budget !== 'object' || Array.isArray(budget)))
  )
    throw new TypeError('Invalid model budget strategy');
  const preset =
    typeof budget === 'string' ? modelBudgetStrategies[budget] : modelBudgetStrategies.medium;
  const result = {
    ...preset,
    ...settings(selected),
    ...(reasoningSettings && settings(reasoningSettings)),
    ...(typeof budget === 'object' && budgetSettings(budget)),
    ...settings(options),
  } as ModelRunnerOptions;
  // Preserve the structural legacy view without a second mutable configuration source. The
  // canonical field still owns precedence and both names return the exact selected list.
  if ('interactions' in result)
    Object.defineProperty(result, 'transports', {
      enumerable: true,
      get: () => result.interactions,
    });
  // Validate through the same Core rules without creating a request runner or spending calls.
  snapshotModelBinding(result);
  return Object.freeze(result);
}

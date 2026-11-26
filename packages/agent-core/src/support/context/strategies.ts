/**
 * Context strategy presets: derive a validated reduction policy from history declarations.
 *
 * A strategy describes one historical fragment (its ID, JSON field and how much to keep) and
 * generates either a trim step (`recent`) or a compression step (`continuity`). Generated steps and
 * any explicit overrides are validated together, so the result can be passed straight to the
 * context processing nodes.
 *
 * Main exports: `contextHistoryStrategies`, `createContextStrategy` and the strategy types.
 */
import { validateContextPolicy } from './processing.js';
import { breakWhile } from '../../utils/rules.js';
import type { ContextFragment } from '../../structs/context/fragments.js';
import type {
  ContextCompressor,
  ContextHistoryGrouping,
  ContextPolicy,
  ContextReduction,
  ContextRecentHistory,
  ContextSelector,
} from '../../structs/support/context-processing.js';

/**
 * Named history presets.
 *
 * `targetRatio` is the fraction of the fragment's own `maxChars` used as the reduction target;
 * `keepGroups` is how many most-recent groups always stay verbatim. Both are local admission
 * heuristics, not claims about semantic retention.
 */
export const contextHistoryStrategies = Object.freeze({
  compact: Object.freeze({ targetRatio: 0.25, keepGroups: 1 }),
  balanced: Object.freeze({ targetRatio: 0.5, keepGroups: 3 }),
  extended: Object.freeze({ targetRatio: 0.75, keepGroups: 6 }),
});

interface HistoryStrategy {
  /** Reuse the registered fragment identity and its existing hard size allowance. */
  readonly fragment: Pick<ContextFragment, 'id' | 'maxChars'>;
  readonly field: string;
  readonly preset?: keyof typeof contextHistoryStrategies;
  readonly targetChars?: number;
  readonly keepGroups?: number;
  readonly grouping?: ContextHistoryGrouping;
}
/**
 * Shared reduce-policy settings applied to the whole strategy.
 *
 * Trigger and target fields follow the Core policy contract; omitted values fall back to the plan
 * budget or to the trigger. Supplying `steps` disables generation and uses the explicit list.
 */
export type ContextStrategySettings = Omit<
  Extract<ContextPolicy, { mode: 'reduce' }>,
  'mode' | 'steps'
> & {
  readonly steps?: readonly ContextReduction[];
  readonly compressors?: readonly ContextCompressor[];
  readonly selectors?: readonly ContextSelector[];
};
type GeneratedContextStrategyOptions = HistoryStrategy &
  ContextStrategySettings &
  (
    | { readonly kind: 'recent'; readonly compressor?: never }
    | { readonly kind: 'continuity'; readonly compressor: ContextCompressor }
  );
/**
 * One history declaration that generates a step, or an explicit step list with optional history
 * fields (`fragment`, `field`, `preset`, `targetChars`, `keepGroups`, `grouping`).
 */
export type ContextStrategyOptions =
  | GeneratedContextStrategyOptions
  | (ContextStrategySettings &
      Partial<HistoryStrategy> & {
        readonly steps: readonly ContextReduction[];
        readonly kind?: 'recent' | 'continuity';
        readonly compressor?: ContextCompressor;
      });
/** Validated inputs ready to pass to a context processing node. */
export interface ContextStrategy {
  /** Reduction policy with the generated or explicit steps and selection. */
  readonly policy: ContextPolicy;
  /** Compressors referenced by generated compression steps, deduplicated by identity. */
  readonly compressors: readonly ContextCompressor[];
  /** Selectors available to model-driven selection. */
  readonly selectors: readonly ContextSelector[];
}

interface StrategyInput {
  options: GeneratedContextStrategyOptions;
  id: string;
  targetChars: number;
  preserve: ContextRecentHistory;
}
interface StrategyDefinition {
  readonly operation: ContextReduction['kind'];
  build(input: StrategyInput): {
    step: ContextReduction;
    compressors: readonly ContextCompressor[];
  };
}
function recent({ id, targetChars, preserve }: StrategyInput) {
  return {
    step: { id: `${id}.window`, kind: 'trim' as const, fragmentId: id, targetChars, ...preserve },
    compressors: [],
  };
}
function continuity({ options, id, targetChars, preserve }: StrategyInput) {
  const compressor = options.compressor;
  breakWhile(!compressor, 'Continuity strategy requires a compressor');
  return {
    step: {
      id: `${id}.summary`,
      kind: 'compress' as const,
      fragmentId: id,
      targetChars,
      handlerId: compressor!.id,
      preserve,
    },
    compressors: [compressor!],
  };
}
/** The declared alternatives drive default selection and the generated operations together. */
const contextStrategyCatalog = {
  recent: { operation: 'trim', build: recent },
  continuity: { operation: 'compress', build: continuity },
} satisfies Record<GeneratedContextStrategyOptions['kind'], StrategyDefinition>;

/**
 * Build a reduction policy from one or more history declarations.
 *
 * `recent` keeps a window of recent groups; `continuity` summarizes older groups while preserving
 * the most recent originals. Neither preset claims semantic quality, only bounded input size.
 *
 * @param options One history declaration or an array of them. With an array, shared processing
 *   settings must be passed in `settings`, not on individual items.
 * @param settings Shared policy settings, overridden by single-item fields when one item is given.
 * @returns A frozen strategy with the policy, its compressors and selectors.
 * @throws {Error} When no history is declared, shared settings appear on array items, a preset or
 *   allowance is invalid, or the generated selection has no matching step.
 * @throws {ValidationError} When the resulting policy fails Core validation.
 */
export function createContextStrategy(
  options: ContextStrategyOptions | readonly ContextStrategyOptions[],
  settings: ContextStrategySettings = {},
): ContextStrategy {
  const definitions: readonly ContextStrategyOptions[] = Array.isArray(options)
    ? options
    : [options as ContextStrategyOptions];
  breakWhile(!definitions.length, 'Context strategy requires at least one history');
  const single = definitions.length === 1 ? definitions[0] : undefined;
  // Array items generate operations; global processing settings belong to the second argument.
  if (
    !single &&
    definitions.some((item) =>
      [
        'selection',
        'steps',
        'selectors',
        'compressors',
        'triggerChars',
        'targetInputChars',
        'triggerTokens',
        'targetInputTokens',
      ].some((key) => key in item),
    )
  ) {
    throw new TypeError('Configure shared context strategy settings in the second argument');
  }
  const config: Record<string, unknown> = {};
  const keys = [
    'selection',
    'steps',
    'selectors',
    'compressors',
    'triggerChars',
    'targetInputChars',
    'triggerTokens',
    'targetInputTokens',
  ] as const;
  for (const source of [single, settings])
    if (source) for (const key of keys) if (key in source) config[key] = source[key];
  const configured = config as ContextStrategySettings;
  const generated =
    configured.steps !== undefined
      ? []
      : (definitions as readonly GeneratedContextStrategyOptions[]).map((options) => {
          const { kind, fragment, field } = options;
          const preset = options.preset;
          breakWhile(
            preset !== undefined && !Object.hasOwn(contextHistoryStrategies, preset),
            'Unknown history strategy preset',
          );
          breakWhile(
            !Number.isSafeInteger(fragment.maxChars) || fragment.maxChars < 1,
            'History strategy requires a positive fragment allowance',
          );
          const defaults = preset === undefined ? undefined : contextHistoryStrategies[preset];
          const id = fragment.id,
            targetChars =
              options.targetChars ??
              (defaults
                ? Math.max(1, Math.floor(fragment.maxChars * defaults.targetRatio))
                : fragment.maxChars);
          const grouping = options.grouping ?? { kind: 'user-turn' };
          const preserve = {
            field,
            keepGroups: options.keepGroups ?? defaults?.keepGroups ?? 1,
            grouping:
              grouping.kind === 'fixed'
                ? { kind: grouping.kind, size: grouping.size }
                : { kind: grouping.kind },
          };
          breakWhile(!Object.hasOwn(contextStrategyCatalog, kind), 'Unknown context strategy');
          return contextStrategyCatalog[kind].build({ options, id, targetChars, preserve });
        });
  const steps = configured.steps ?? generated.map((item) => item.step);
  // A single step needs no selection decision; several steps keep declared order.
  const selection =
    configured.selection ??
    (steps.length === 1
      ? { mode: 'fixed' as const, kind: steps[0].kind }
      : { mode: 'sequence' as const });
  const compressors = [
    ...generated.flatMap((item) => item.compressors),
    ...(configured.compressors ?? []),
  ];
  const unique = new Map<string, ContextCompressor>();
  for (const compressor of compressors) {
    // The same handler may be referenced by several steps; a different object under one ID is
    // ambiguous for the policy, so it is rejected instead of silently replaced.
    breakWhile(
      unique.has(compressor.id) && unique.get(compressor.id) !== compressor,
      `Conflicting context compressor: ${compressor.id}`,
    );
    unique.set(compressor.id, compressor);
  }
  const selectors = [...(configured.selectors ?? [])];
  const policy: ContextPolicy = {
    mode: 'reduce',
    steps: [...steps],
    selection,
    triggerChars: configured.triggerChars,
    targetInputChars: configured.targetInputChars,
    triggerTokens: configured.triggerTokens,
    targetInputTokens: configured.targetInputTokens,
  };
  breakWhile(
    selection.mode === 'fixed' && !steps.some((step) => step.kind === selection.kind),
    'Context strategy selection has no matching operation',
  );
  validateContextPolicy(policy, [...unique.values()], selectors);
  return Object.freeze({
    policy,
    compressors: Object.freeze([...unique.values()]),
    selectors: Object.freeze(selectors),
  });
}

/**
 * Context selection policy: choose which registered reductions to run and budget their calls.
 *
 * Each selection mode is one catalog entry that both validates its declaration and chooses steps,
 * so a mode cannot be accepted by validation yet behave differently at execution. Selection never
 * spends the calls reserved for the final reply.
 *
 * Main exports: `selectContextSteps`, `validateContextSelection`,
 * `contextSelectionCatalog` and the call-allowance helpers.
 */
import { BudgetError, ValidationError } from '../../structs/errors.js';
import { breakWhile } from '../../utils/rules.js';
import type {
  ContextSelection,
  ContextSelectionCall,
  ContextSelector,
  ContextSelectionCandidate,
} from '../../structs/support/context-processing.js';

const invalid = (message: string) => new ValidationError([{ code: 'CONTEXT_POLICY', message }]);
/**
 * Calls that automatic or model selection must leave for the reply.
 *
 * Ordered and fixed selection make no extra calls, so nothing is reserved for them.
 *
 * @param selection Selection declaration.
 * @returns The declared reserve (default 1) for `auto`/`model`, otherwise 0.
 */
export const reservedContextCalls = (selection: ContextSelection) =>
  selection.mode === 'auto' || selection.mode === 'model' ? (selection.reserveCalls ?? 1) : 0;
/**
 * Effective call ceiling of a compressor or selector.
 *
 * Omitting `maxCalls` means one call; declaring 0 is valid and marks a purely local handler.
 *
 * @param handler Handler declaration.
 * @returns The declared ceiling, defaulting to 1.
 */
export const contextHandlerCalls = (handler: { maxCalls?: number }) => handler.maxCalls ?? 1;
interface SelectionInput extends ContextSelectionCall {
  readonly signal: AbortSignal;
  diagnostics?: import('../../structs/diagnostics.js').DiagnosticContext;
  selection: ContextSelection;
  selectors: readonly ContextSelector[];
}
interface SelectionResult {
  stepIds: string[];
  reason: string;
}
interface SelectionHandler {
  validate(selection: ContextSelection, selectors: readonly ContextSelector[]): void;
  choose(input: SelectionInput): Promise<SelectionResult>;
}
function validateBudget(selection: ContextSelection): void {
  const reserve = reservedContextCalls(selection);
  breakWhile(
    !Number.isSafeInteger(reserve) || reserve < 1,
    invalid('Selection must reserve at least one reply call'),
  );
}
function validateAuto(selection: ContextSelection): void {
  if (selection.mode !== 'auto') throw invalid('Invalid automatic context selection');
  validateBudget(selection);
  const ratio = selection.maxTrimLossRatio ?? 0.25;
  breakWhile(!Number.isFinite(ratio) || ratio < 0 || ratio > 1, invalid('Invalid trim loss ratio'));
}
function validateModel(selection: ContextSelection, selectors: readonly ContextSelector[]): void {
  if (selection.mode !== 'model') throw invalid('Invalid model context selection');
  validateBudget(selection);
  breakWhile(
    !selectors.some((handler) => handler.id === selection.handlerId),
    invalid('Unregistered context selector'),
  );
}
async function fixed({ selection, candidates }: SelectionInput): Promise<SelectionResult> {
  if (selection.mode !== 'fixed') throw invalid('Invalid fixed context selection');
  return {
    stepIds: candidates
      .filter((candidate) => candidate.kind === selection.kind)
      .map((candidate) => candidate.id),
    reason: `fixed:${selection.kind}`,
  };
}
async function automatic({ selection, candidates }: SelectionInput): Promise<SelectionResult> {
  if (selection.mode !== 'auto') throw invalid('Invalid automatic context selection');
  const ratio = selection.maxTrimLossRatio ?? 0.25;
  const trims = candidates
    .filter(
      (candidate) =>
        candidate.kind === 'trim' &&
        (candidate.trimLossRatio ?? 1) <= ratio &&
        candidate.projectedChars! < candidate.chars,
    )
    .sort((a, b) => a.trimLossRatio! - b.trimLossRatio!);
  const chosen = trims[0] ?? candidates.find((candidate) => candidate.kind === 'compress');
  return {
    stepIds: chosen ? [chosen.id] : [],
    reason:
      chosen?.kind === 'trim'
        ? 'bounded-trim-loss'
        : chosen
          ? 'preserve-through-compression'
          : 'no-safe-candidate',
  };
}
async function model(input: SelectionInput): Promise<SelectionResult> {
  if (input.selection.mode !== 'model') throw invalid('Invalid model context selection');
  const handlerId = input.selection.handlerId;
  const selector = input.selectors.find((handler) => handler.id === handlerId)!;
  const result = await selector.select(
    {
      stageId: input.stageId,
      candidates: structuredClone(input.candidates),
      fragments: structuredClone(input.fragments),
      currentTokens: input.currentTokens,
      requiredReductionTokens: input.requiredReductionTokens,
      currentChars: input.currentChars,
      requiredReductionChars: input.requiredReductionChars,
      remainingCalls: input.remainingCalls,
      callModel: input.callModel,
    },
    { signal: input.signal, diagnostics: input.diagnostics },
  );
  breakWhile(
    !Array.isArray(result) ||
      result.some((id) => typeof id !== 'string') ||
      new Set(result).size !== result.length ||
      result.some((id) => !input.candidates.some((candidate) => candidate.id === id)),
    invalid('Selector must return unique available step IDs'),
  );
  return { stepIds: [...result], reason: 'registered-selector' };
}

function validateFixed(selection: ContextSelection): void {
  if (selection.mode !== 'fixed') throw invalid('Invalid fixed context selection');
  breakWhile(
    !['trim', 'compress'].includes(selection.kind),
    invalid('Unknown fixed context operation'),
  );
}
function validateSequence(): void {}
async function ordered({ candidates }: SelectionInput): Promise<SelectionResult> {
  return { stepIds: candidates.map((candidate) => candidate.id), reason: 'configured-order' };
}
/**
 * Selection modes with their validators and choosers.
 *
 * `sequence` keeps declared order and `fixed` keeps one reduction kind; `auto` picks the cheapest
 * bounded trim or falls back to compression; `model` delegates to a registered selector.
 */
export const contextSelectionCatalog = {
  sequence: { validate: validateSequence, choose: ordered },
  fixed: { validate: validateFixed, choose: fixed },
  auto: { validate: validateAuto, choose: automatic },
  model: { validate: validateModel, choose: model },
} satisfies Record<ContextSelection['mode'], SelectionHandler>;

/**
 * Validate selector declarations and the selection mode they serve.
 *
 * @param selection Selection declaration to validate.
 * @param selectors Selectors available to `model` selection.
 * @throws {ValidationError} When a selector is invalid or duplicated, the mode is unknown, or the
 *   mode's own requirements are not met (for example an unregistered selector ID).
 */
export function validateContextSelection(
  selection: ContextSelection,
  selectors: readonly ContextSelector[],
): void {
  const ids = new Set<string>();
  for (const selector of selectors) {
    breakWhile(
      typeof selector.id !== 'string' ||
        !selector.id ||
        ids.has(selector.id) ||
        typeof selector.select !== 'function' ||
        !Number.isSafeInteger(contextHandlerCalls(selector)) ||
        contextHandlerCalls(selector) < 0,
      invalid('Invalid context selector'),
    );
    ids.add(selector.id);
  }
  breakWhile(
    !Object.hasOwn(contextSelectionCatalog, selection.mode),
    invalid('Unknown context selection mode'),
  );
  contextSelectionCatalog[selection.mode].validate(selection, selectors);
}

/**
 * Choose steps that fit the remaining call budget.
 *
 * Feasibility uses exact trim previews and declared call ceilings; the reply reserve and the
 * selector's own allowance are subtracted before candidates are considered, so neither can be
 * spent on reductions.
 *
 * @param input Candidates, current measurements, budget and the selection declaration.
 * @returns The chosen step IDs plus a machine-readable reason.
 * @throws {BudgetError} When model selection has no calls or no feasible candidate left.
 * @throws {ValidationError} When the chosen steps exceed the available allowance.
 */
export async function selectContextSteps(input: SelectionInput): Promise<SelectionResult> {
  const selection = input.selection;
  const modelId = selection.mode === 'model' ? selection.handlerId : undefined;
  const selector = input.selectors.find((handler) => handler.id === modelId);
  const selectorCalls = selector ? contextHandlerCalls(selector) : 0;
  const reserve = reservedContextCalls(selection);
  // The selector may call the model itself, so its allowance is unavailable to the steps it picks.
  const available = input.remainingCalls - reserve - selectorCalls;
  if (selection.mode === 'model' && available < 0)
    throw new BudgetError('No calls available for context selection');
  const candidates: ContextSelectionCandidate[] = input.candidates.filter(
    (candidate) => candidate.requiredCalls <= available,
  );
  if (selection.mode === 'model' && !candidates.length)
    throw new BudgetError('No feasible context operations after reserving calls');
  const result = await contextSelectionCatalog[selection.mode].choose({ ...input, candidates });
  if (selection.mode === 'model') {
    const required = result.stepIds.reduce(
      (sum, id) => sum + candidates.find((candidate) => candidate.id === id)!.requiredCalls,
      0,
    );
    breakWhile(required > available, invalid('Selected operations exceed context call allowance'));
  }
  return result;
}

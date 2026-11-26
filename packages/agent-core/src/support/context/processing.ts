/**
 * Context processing engine: validate, select, apply and audit context reductions.
 *
 * A processing state snapshots the plan once, then reductions mutate working fragments until the
 * target size is met. Core guarantees (fragment trust, character/token budgets, structural audit
 * and cancellation) are enforced here; application code supplies policies, handlers and selection
 * strategies. Each mode and reduction kind is a registered entry, so validation and execution
 * cannot diverge.
 *
 * Main exports: `processContext` (complete run), `beginContextProcessing` /
 * `finishContextProcessing` (staged runs), the policy/reduction catalogs and the individual
 * validation, measurement and reduction helpers used by workflow nodes.
 */
import { nativeReportedStepAsync } from '../../diagnostics/native-sub-flow.js';
import { snapshotFragment, snapshotMessage } from './snapshot.js';
import { auditContextChange as audit } from '../../context/audit.js';
import type { ContextPlan } from '../../structs/context/processing.js';
import { historyGroups, validateRecentHistory } from './history.js';
import {
  contextHandlerCalls,
  reservedContextCalls,
  selectContextSteps,
  validateContextSelection,
} from './selection-policy.js';
import { assembleFragments } from '../../context/assembly.js';
import { validateContextFragment, validateContextBudget } from '../../context/fragments.js';
import { BudgetError, ValidationError } from '../../structs/errors.js';
import { breakWhile } from '../../utils/rules.js';
import { awaitWithSignal } from '../../utils/cancellation.js';
import type { ModelMessage } from '../../structs/model/messages.js';
import type { ContextFragment, BuiltContext } from '../../structs/context/fragments.js';
import type {
  ContextPolicy,
  ContextReduction,
  ContextCompressor,
  ContextModelCall,
  ContextProcessingReport,
  ContextSelector,
  ContextSelectionCandidate,
  ContextSelection,
  ContextTokenMeasurement,
} from '../../structs/support/context-processing.js';

const fail = (message: string) => new ValidationError([{ code: 'CONTEXT_POLICY', message }]);
// Structured values are measured by their serialized length, matching the character budget that
// assembly later enforces.
const size = (fragment: ContextFragment) =>
  typeof fragment.value === 'string'
    ? fragment.value.length
    : JSON.stringify(fragment.value).length;
const positive = (value: number) => Number.isSafeInteger(value) && value > 0;

/**
 * Validate a complete context policy and every handler it can reference.
 *
 * Handler IDs must be unique and each handler must declare a non-negative integer call ceiling.
 * Reduction targets and selection modes are checked by their own catalog entries.
 *
 * @param policy Policy to validate; the mode must be one of the registered modes.
 * @param compressors Compressors available to compression steps.
 * @param selectors Selectors available to model-driven selection.
 * @throws {ValidationError} When a handler, mode, reduction step or selection declaration is
 *   invalid or references something unregistered.
 */
export function validateContextPolicy(
  policy: ContextPolicy,
  compressors: readonly ContextCompressor[],
  selectors: readonly ContextSelector[] = [],
): void {
  const handlers = new Set<string>();
  for (const handler of compressors) {
    breakWhile(
      !handler.id ||
        handlers.has(handler.id) ||
        typeof handler.compress !== 'function' ||
        !Number.isSafeInteger(contextHandlerCalls(handler)) ||
        contextHandlerCalls(handler) < 0,
      fail('Invalid context compressor'),
    );
    handlers.add(handler.id);
  }
  const mode = Object.hasOwn(contextPolicyCatalog, policy.mode)
    ? contextPolicyCatalog[policy.mode]
    : undefined;
  breakWhile(!mode, fail('Unknown context processing mode'));
  mode!.validate(policy, handlers);
  if (policy.mode === 'reduce')
    validateContextSelection(policy.selection ?? { mode: 'sequence' }, selectors);
}

function validateCorePolicy(policy: ContextPolicy, handlers: Set<string>): void {
  if (policy.mode !== 'reduce') throw fail('Invalid Core policy');
  breakWhile(
    policy.triggerChars !== undefined && !positive(policy.triggerChars),
    fail('Invalid context trigger'),
  );
  for (const value of [policy.targetInputChars, policy.triggerTokens, policy.targetInputTokens])
    breakWhile(value !== undefined && !positive(value), fail('Invalid context watermark'));
  breakWhile(
    policy.targetInputChars !== undefined &&
      policy.triggerChars !== undefined &&
      policy.targetInputChars > policy.triggerChars,
    fail('Context target must not exceed trigger'),
  );
  breakWhile(
    policy.targetInputTokens !== undefined &&
      policy.triggerTokens !== undefined &&
      policy.targetInputTokens > policy.triggerTokens,
    fail('Token target must not exceed trigger'),
  );
  const ids = new Set<string>();
  for (const step of policy.steps) {
    breakWhile(
      !step.id || ids.has(step.id) || !step.fragmentId || !positive(step.targetChars),
      fail('Invalid context reduction'),
    );
    ids.add(step.id);
    const operation = Object.hasOwn(contextReductionCatalog, step.kind)
      ? contextReductionCatalog[step.kind]
      : undefined;
    breakWhile(!operation, fail('Unknown context reduction'));
    operation!.validate(step, handlers);
  }
}

interface OperationCall {
  step: ContextReduction;
  fragment: ContextFragment;
  stageId: string;
  signal: AbortSignal;
  diagnostics?: import('../../structs/diagnostics.js').DiagnosticContext;
  compressors: readonly ContextCompressor[];
  callModel: ContextModelCall;
}
interface Operation {
  validate(step: ContextReduction, handlers: Set<string>): void;
  run(call: OperationCall): Promise<ContextFragment['value']>;
}

async function trim({ step, fragment }: OperationCall): Promise<ContextFragment['value']> {
  if (step.kind !== 'trim') throw fail('Invalid trim step');
  const groups = historyGroups(fragment.value, step);
  const record = fragment.value as Record<string, unknown>;
  let chars = size(fragment),
    start = 0;
  // Groups are nonempty. Removing one drops its array contents and, unless it
  // was the last group, one separating comma. Serialize each removed group once.
  while (groups.length - start > step.keepGroups && chars > step.targetChars) {
    chars -= JSON.stringify(groups[start]).length - (start + 1 === groups.length ? 2 : 1);
    start++;
  }
  return { ...record, [step.field]: groups.slice(start).flat() };
}
function compressionInput(
  step: Extract<ContextReduction, { kind: 'compress' }>,
  fragment: ContextFragment,
) {
  if (!step.preserve) return { fragment, recent: undefined, targetChars: step.targetChars };
  const groups = historyGroups(fragment.value, step.preserve);
  const kept = Math.min(step.preserve.keepGroups, groups.length);
  const recent = groups.slice(groups.length - kept).flat();
  const older = groups.slice(0, groups.length - kept).flat();
  const record = fragment.value as Record<string, unknown>;
  const value = { ...record, [step.preserve.field]: older };
  const recentChars =
    size({ ...fragment, value: { ...record, [step.preserve.field]: recent } }) -
    size({ ...fragment, value: { ...record, [step.preserve.field]: [] } });
  return {
    fragment: { ...fragment, value },
    recent,
    older,
    // Recent groups are appended back after compression, so their characters are subtracted from
    // the budget the handler may use; the target stays positive.
    targetChars: Math.max(1, step.targetChars - recentChars),
  };
}
async function compress(call: OperationCall): Promise<ContextFragment['value']> {
  if (call.step.kind !== 'compress') throw fail('Invalid compression step');
  const step = call.step;
  const handler = call.compressors.find((item) => item.id === step.handlerId)!;
  const input = compressionInput(step, call.fragment);
  if (input.older?.length === 0) return call.fragment.value;
  const value = await handler.compress(
    {
      stageId: call.stageId,
      fragment: structuredClone(input.fragment),
      targetChars: input.targetChars,
      callModel: call.callModel,
    },
    { signal: call.signal, diagnostics: call.diagnostics },
  );
  if (!step.preserve) return value;
  const field = step.preserve.field;
  breakWhile(
    !value || typeof value !== 'object' || !Array.isArray(value[field]),
    fail('Protected-history compression must return an array'),
  );
  const summary = value as Record<string, unknown>;
  const record = call.fragment.value as Record<string, unknown>;
  breakWhile(
    Object.keys(summary).length !== Object.keys(record).length ||
      Object.keys(record).some(
        (key) =>
          !Object.hasOwn(summary, key) ||
          (key !== field && JSON.stringify(summary[key]) !== JSON.stringify(record[key])),
      ),
    fail('Compression must preserve unrelated history fields'),
  );
  const merged = { ...record, [field]: [...(summary[field] as unknown[]), ...input.recent!] };
  historyGroups(merged, step.preserve);
  return merged;
}

/** This catalog drives validation and dispatch. Every step executes at most once. */
export const contextReductionCatalog = {
  trim: {
    validate(step) {
      if (step.kind !== 'trim') throw fail('Invalid trim step');
      validateRecentHistory(step);
    },
    run: trim,
  },
  compress: {
    validate(step, handlers) {
      if (step.kind !== 'compress') throw fail('Invalid compression step');
      breakWhile(!handlers.has(step.handlerId), fail('Unregistered context compressor'));
      if (step.preserve) validateRecentHistory(step.preserve);
    },
    run: compress,
  },
} satisfies Record<ContextReduction['kind'], Operation>;

/** A handler ignoring cancellation cannot block delivery or publish a late result. */
async function runOperation<Value>(run: () => Promise<Value>, signal: AbortSignal): Promise<Value> {
  signal.throwIfAborted();
  return await awaitWithSignal(
    Promise.resolve().then(() => {
      signal.throwIfAborted();
      return run();
    }),
    signal,
  );
}

/**
 * Validate fragment structure and ID uniqueness without re-checking per-fragment budgets.
 *
 * Per-fragment size is rechecked during reduction, where the fragment's own allowance applies.
 *
 * @param fragments Fragments to validate as one set.
 * @throws {ValidationError} When an ID is malformed or repeated, or required metadata is invalid.
 */
export function validateStructure(fragments: readonly ContextFragment[]): void {
  const ids = new Set<string>();
  for (const fragment of fragments) validateContextFragment(fragment, ids, false);
}

/** Execution ports accepted by the processing helpers; alias of the Core options contract. */
export type ProcessingPorts =
  import('../../structs/support/context-processing.js').ContextProcessingOptions;
/**
 * Working state for one context-processing stage.
 *
 * `fragments` is mutated in place by reductions while `before` keeps the original snapshot for the
 * audit report; `ports` carries the signal, diagnostics and call budget already validated by the
 * caller.
 */
export interface ProcessingState {
  /** Token count before processing; present only when a token measurement port was supplied. */
  beforeTokens?: number;
  /** Normalized plan the state was created from. */
  plan: ContextPlan;
  /** Policy under execution; already validated and snapshotted. */
  policy: ContextPolicy;
  /** Execution ports: signal, diagnostics, call budget and model call. */
  ports: ProcessingPorts;
  /** Cloned user messages appended after fragments and counted against the same budget. */
  additionalMessages: ModelMessage[];
  /** Total characters across `additionalMessages`. */
  additionalChars: number;
  /** Original fragment snapshot, retained for audit and reporting. */
  before: ContextFragment[];
  /** Working fragments; reductions replace entries in this array. */
  fragments: ContextFragment[];
  /** Accumulates changes, selection decisions and token measurements. */
  report: ContextProcessingReport;
}
const measure = (fragments: readonly ContextFragment[]) =>
  assembleFragments(
    fragments.map((fragment) => ({ ...fragment, maxChars: Number.MAX_SAFE_INTEGER })),
    Number.MAX_SAFE_INTEGER,
  ).inputChars;

function measuredTokens(
  fragments: readonly ContextFragment[],
  additional: readonly ModelMessage[],
  budget?: ContextTokenMeasurement,
): number | undefined {
  if (!budget) return undefined;
  const context = assembleFragments(
    fragments.map((fragment) => ({ ...fragment, maxChars: Number.MAX_SAFE_INTEGER })),
    Number.MAX_SAFE_INTEGER,
  );
  const tokens = budget.measure([...context.messages, ...additional]);
  breakWhile(!Number.isSafeInteger(tokens) || tokens < 0, fail('Invalid measured context tokens'));
  return tokens;
}
/**
 * Resolve the effective trigger and target watermarks for a reduction policy.
 *
 * Configured values are clamped to the plan's character budget and the runner's token limit, so a
 * policy can never reduce below what the request actually allows. A missing target equals the
 * trigger, which means "reduce until back under the trigger".
 *
 * @param state Processing state carrying the plan and ports.
 * @returns Trigger and target sizes in characters and, when measurable, tokens.
 * @throws {ValidationError} When token thresholds are configured without a token measurement port,
 *   or the effective target exceeds the effective trigger.
 */
export function watermarks(state: ProcessingState) {
  const policy = state.policy;
  if (policy.mode !== 'reduce') throw fail('Invalid Core policy');
  const triggerChars = Math.min(
    policy.triggerChars ?? state.plan.maxInputChars,
    state.plan.maxInputChars,
  );
  const targetChars = policy.targetInputChars ?? triggerChars;
  const budget = state.ports.tokenBudget;
  breakWhile(
    (policy.triggerTokens !== undefined || policy.targetInputTokens !== undefined) && !budget,
    fail('Token thresholds require a token measurement port'),
  );
  const triggerTokens = budget
    ? Math.min(policy.triggerTokens ?? budget.inputLimit, budget.inputLimit)
    : undefined;
  const targetTokens = policy.targetInputTokens ?? triggerTokens;
  breakWhile(
    targetChars > triggerChars || (targetTokens !== undefined && targetTokens > triggerTokens!),
    fail('Target exceeds effective context trigger'),
  );
  return {
    trigger: { chars: triggerChars, tokens: triggerTokens },
    target: { chars: targetChars, tokens: targetTokens },
  };
}
/**
 * Decide whether the current fragments still need reduction.
 *
 * A fragment exceeding its own `maxChars` also counts as needing reduction, even when the total
 * fits, because per-fragment allowances are part of the plan contract.
 *
 * @param state Processing state to measure.
 * @param threshold Trigger size; `tokens` is checked only when present.
 * @returns `true` when characters, a per-fragment allowance or tokens exceed the threshold.
 */
export function needsReduction(
  state: ProcessingState,
  threshold: { chars: number; tokens?: number },
): boolean {
  return (
    measure(state.fragments) + state.additionalChars > threshold.chars ||
    state.fragments.some((fragment) => size(fragment) > fragment.maxChars) ||
    (threshold.tokens !== undefined &&
      measuredTokens(state.fragments, state.additionalMessages, state.ports.tokenBudget)! >
        threshold.tokens)
  );
}

/**
 * Validate and record application-made changes for an `audit` policy.
 *
 * Only fragments listed as mutable may have changed; the audit helper enforces the rest. Changes
 * that survive are recorded in the report as `app` entries.
 *
 * @param state Processing state; the policy must be `audit` and carry original fragments.
 * @throws {ValidationError} When the policy is not `audit`, original fragments are missing, a
 *   mutable ID does not exist, or a protected fragment changed.
 */
export function auditApp({ plan, policy, before, fragments, report }: ProcessingState): void {
  if (policy.mode !== 'audit') throw fail('Invalid App audit policy');
  breakWhile(!plan.originalFragments, fail('App audit requires original fragments'));
  const mutable = new Set(policy.mutableFragmentIds);
  breakWhile(
    [...mutable].some((id) => !before.some((fragment) => fragment.id === id)),
    fail('Unknown mutable fragment'),
  );
  audit(before, fragments, mutable);
  for (const [index, fragment] of fragments.entries())
    if (JSON.stringify(fragment.value) !== JSON.stringify(before[index].value))
      report.changes.push({
        id: 'app',
        kind: 'app',
        fragmentId: fragment.id,
        beforeChars: size(before[index]),
        afterChars: size(fragment),
      });
}

/**
 * Wrap the model call port with a handler-local call ceiling and a reply reserve.
 *
 * `reserve` is subtracted from the runner's remaining budget, so handlers can never consume the
 * calls the final reply still needs.
 *
 * @param ports Execution ports providing cancellation and the underlying model call.
 * @param maxCalls Maximum calls this handler may make.
 * @param reserve Calls that must remain available for the reply.
 * @returns A call function that throws instead of overspending.
 * @throws {BudgetError} On each call that would exceed either limit.
 * @throws The signal's abort reason when the request is already cancelled.
 */
export function limitedCall(
  ports: ProcessingPorts,
  maxCalls: number,
  reserve: number,
): ContextModelCall {
  let calls = 0;
  return (request) => {
    ports.signal.throwIfAborted();
    if (calls >= maxCalls || (ports.remainingCalls?.() ?? Infinity) <= reserve)
      throw new BudgetError('Context handler call allowance exhausted');
    calls++;
    return ports.callModel(request);
  };
}

async function selectionCandidates(
  state: ProcessingState,
  steps: readonly ContextReduction[],
  selection: ContextSelection,
): Promise<ContextSelectionCandidate[]> {
  const candidates: ContextSelectionCandidate[] = [];
  for (const step of steps) {
    const fragment = state.fragments.find((item) => item.id === step.fragmentId)!;
    if (size(fragment) <= step.targetChars) continue;
    const candidate: ContextSelectionCandidate = {
      id: step.id,
      kind: step.kind,
      fragmentId: step.fragmentId,
      chars: size(fragment),
      targetChars: step.targetChars,
      requiredCalls: 0,
    };
    if (step.kind === 'compress') {
      if (compressionInput(step, fragment).older?.length === 0) continue;
      candidate.requiredCalls = contextHandlerCalls(
        state.ports.compressors.find((handler) => handler.id === step.handlerId)!,
      );
    }
    if (step.kind === 'trim' && (selection.mode === 'auto' || selection.mode === 'model')) {
      try {
        const value = await trim({ ...state.ports, step, fragment });
        candidate.projectedChars = size({ ...fragment, value });
        const retained = state.report.changes
          .filter((change) => change.fragmentId === step.fragmentId && change.kind === 'trim')
          .reduce((ratio, change) => (ratio * change.afterChars) / change.beforeChars, 1);
        candidate.trimLossRatio = Math.max(
          0,
          1 - (retained * candidate.projectedChars) / candidate.chars,
        );
        if (candidate.projectedChars >= candidate.chars) continue;
      } catch (error) {
        if (!(error instanceof ValidationError)) throw error;
        continue; // A candidate incompatible with the current value cannot be selected.
      }
    }
    candidates.push(candidate);
  }
  return candidates;
}

/**
 * Choose which reduction steps to run next, under the current selection mode.
 *
 * Candidates that cannot make progress are filtered out: a step whose fragment already fits, a
 * compression with no older history, or a step that needs more calls than the remaining budget.
 *
 * @param state Processing state providing ports, fragments and the report.
 * @param steps Reduction steps still pending.
 * @param selection Selection strategy to apply.
 * @returns Registered step IDs in execution order; records the decision in the report.
 * @throws {BudgetError} When model-driven selection has no calls or no feasible candidate left.
 * @throws {ValidationError} When the selector returns unknown, duplicate or over-budget IDs.
 */
export async function chooseSteps(
  state: ProcessingState,
  steps: readonly ContextReduction[],
  selection: ContextSelection,
): Promise<string[]> {
  const { ports, report } = state;
  const candidates = await selectionCandidates(state, steps, selection);
  if (!candidates.length) return [];
  const handler =
    selection.mode === 'model'
      ? ports.selectors?.find((item) => item.id === selection.handlerId)
      : undefined;
  const currentChars = measure(state.fragments) + state.additionalChars;
  const target = watermarks(state).target;
  const currentTokens = measuredTokens(
    state.fragments,
    state.additionalMessages,
    ports.tokenBudget,
  );
  const fragmentOverflow = state.fragments.reduce(
    (sum, fragment) => sum + Math.max(0, size(fragment) - fragment.maxChars),
    0,
  );
  const result = await runOperation(
    () =>
      selectContextSteps({
        stageId: ports.stageId,
        signal: ports.signal,
        diagnostics: ports.diagnostics,
        selection,
        selectors: ports.selectors ?? [],
        candidates,
        fragments: structuredClone(
          state.fragments.filter((fragment) =>
            candidates.some((candidate) => candidate.fragmentId === fragment.id),
          ),
        ),
        currentChars,
        currentTokens,
        requiredReductionTokens:
          currentTokens === undefined ? undefined : Math.max(0, currentTokens - target.tokens!),
        // Per-fragment overflow also has to be removed even when the total already fits.
        requiredReductionChars: Math.max(currentChars - target.chars, fragmentOverflow),
        remainingCalls: ports.remainingCalls?.() ?? Infinity,
        callModel: limitedCall(
          ports,
          handler ? contextHandlerCalls(handler) : 0,
          reservedContextCalls(selection),
        ),
      }),
    ports.signal,
  );
  report.decisions!.push({ mode: selection.mode, stepIds: result.stepIds, reason: result.reason });
  return result.stepIds;
}

/**
 * Apply one reduction step to its target fragment in the working state.
 *
 * The fragment is cloned before the handler runs, then validated, audited and size-checked before
 * it replaces the original. A reduction that grows the fragment is rejected.
 *
 * @param state Processing state whose fragments are updated in place.
 * @param step Reduction step to execute.
 * @param selection Selection strategy used to size the handler call budget.
 * @throws {ValidationError} When the result is structurally invalid, changes protected fields, or
 *   exceeds the original size.
 * @throws {BudgetError} When the step's handler exceeds its call allowance.
 */
export async function applyReduction(
  state: ProcessingState,
  step: ContextReduction,
  selection: ContextSelection,
): Promise<void> {
  const { fragments, ports, report } = state;
  const index = fragments.findIndex((fragment) => fragment.id === step.fragmentId);
  const fragment = fragments[index];
  if (size(fragment) <= step.targetChars) return;
  const handler =
    step.kind === 'compress'
      ? ports.compressors.find((item) => item.id === step.handlerId)
      : undefined;
  const value = await runOperation(
    () =>
      contextReductionCatalog[step.kind].run({
        ...ports,
        step,
        // Clone first: the handler must not observe or mutate state that audit still needs.
        fragment: structuredClone(fragment),
        callModel: limitedCall(
          ports,
          handler ? contextHandlerCalls(handler) : 0,
          reservedContextCalls(selection),
        ),
      }),
    ports.signal,
  );
  ports.signal.throwIfAborted();
  const next = { ...fragment, value };
  validateStructure([next]);
  audit([fragment], [next], new Set([fragment.id]));
  breakWhile(size(next) > size(fragment), fail('Context reduction increased size'));
  fragments[index] = next;
  report.changes.push({
    id: step.id,
    kind: step.kind,
    fragmentId: fragment.id,
    beforeChars: size(fragment),
    afterChars: size(next),
  });
}

/**
 * Check that every reduction step targets an existing, reducible fragment.
 *
 * System-role and instruction-trust fragments are never reducible, regardless of policy.
 *
 * @param state Processing state whose policy and fragments are checked.
 * @throws {ValidationError} When the policy is not a reduction policy or a target is missing,
 *   system-owned or instruction-trusted.
 */
export function validateReductionTargets(state: ProcessingState): void {
  const { policy, fragments } = state;
  if (policy.mode !== 'reduce') throw fail('Invalid reduction policy');
  for (const step of policy.steps) {
    const fragment = fragments.find((item) => item.id === step.fragmentId);
    breakWhile(
      !fragment || fragment.role === 'system' || fragment.trust === 'instruction',
      fail(`Invalid reduction target: ${step.fragmentId}`),
    );
  }
}

async function reduceCore(state: ProcessingState): Promise<void> {
  const { plan, policy, fragments, ports, report } = state;
  if (policy.mode !== 'reduce') throw fail('Invalid Core policy');
  validateReductionTargets(state);
  const selection = policy.selection ?? { mode: 'sequence' };
  breakWhile(
    (selection.mode === 'auto' || selection.mode === 'model') && !ports.remainingCalls,
    fail('Automatic selection requires a live call budget'),
  );
  report.selection = selection.mode;
  report.decisions = [];
  const thresholds = watermarks(state);
  if (!needsReduction(state, thresholds.trigger)) return;
  const pending = new Map(policy.steps.map((step) => [step.id, step]));
  let queue: string[] | undefined;
  while (pending.size && needsReduction(state, thresholds.target)) {
    queue ??= await chooseSteps(state, [...pending.values()], selection);
    if (!queue.length) break;
    const id = queue.shift()!;
    const step = pending.get(id)!;
    pending.delete(id);
    await applyReduction(state, step, selection);
    // Automatic selection scores candidates against current sizes, so recompute after each step.
    if (selection.mode === 'auto') queue = undefined;
  }
}

interface PolicyHandler {
  validate(policy: ContextPolicy, compressors: Set<string>): void;
  run(state: ProcessingState): void | Promise<void>;
}
function validateAppPolicy(policy: ContextPolicy): void {
  if (policy.mode !== 'audit') throw fail('Invalid App audit policy');
  breakWhile(
    !Array.isArray(policy.mutableFragmentIds) ||
      policy.mutableFragmentIds.some((id) => typeof id !== 'string' || !id) ||
      new Set(policy.mutableFragmentIds).size !== policy.mutableFragmentIds.length,
    fail('Invalid mutable fragment list'),
  );
}
/** The modes and their implementations are registered together, consumed by validation and execution. */
export const contextPolicyCatalog = {
  validate: { validate() {}, run() {} },
  reduce: { validate: validateCorePolicy, run: reduceCore },
  audit: { validate: validateAppPolicy, run: auditApp },
} satisfies Record<ContextPolicy['mode'], PolicyHandler>;

/**
 * Snapshot and validate a plan before any reduction runs.
 *
 * Messages and fragments are cloned and their getters read inside cancellation checks, so a late
 * abort cannot leave partially copied state. Additional messages must be plain user text.
 *
 * @param source Plan supplied by the request or a context builder.
 * @param policy Validated policy to execute.
 * @param ports Execution ports for cancellation, diagnostics and model calls.
 * @returns A processing state ready for the policy runner.
 * @throws {ValidationError} When the budget, fragments, additional messages or token budget are
 *   invalid, or a protected fragment already changed.
 * @throws {TypeError} When the plan budget is not a valid integer or infinity.
 */
export function beginContextProcessing(
  source: ContextPlan,
  policy: ContextPolicy,
  ports: ProcessingPorts,
): ProcessingState {
  const signal = ports.signal;
  // Caller-provided getters may do work; checking before and after prevents a cancelled request
  // from contributing a value to the snapshot.
  const read = <Value>(get: () => Value): Value => {
    signal.throwIfAborted();
    try {
      return get();
    } finally {
      signal.throwIfAborted();
    }
  };
  return read(() => {
    validateContextPolicy(policy, ports.compressors, ports.selectors);
    const maxInputChars = read(() => source.maxInputChars);
    validateContextBudget(0, maxInputChars);
    if (ports.tokenBudget)
      breakWhile(
        !positive(ports.tokenBudget.inputLimit) || !ports.tokenBudget.counterId,
        fail('Invalid token measurement budget'),
      );
    const rawMessages = read(() => source.additionalMessages);
    const rawFragments = read(() => source.fragments);
    const originals = read(() => source.originalFragments);
    const mutable = read(() => source.mutableFragmentIds);
    const additionalMessages = [...(rawMessages ?? [])].map((message) =>
      read(() => snapshotMessage(message)),
    );
    breakWhile(
      additionalMessages.some(
        (message) => message.role !== 'user' || typeof message.content !== 'string',
      ),
      fail('Additional context must be user messages'),
    );
    const additionalChars = additionalMessages.reduce(
      (sum, message) => sum + message.content.length,
      0,
    );
    breakWhile(!Array.isArray(rawFragments), fail('Context plan requires fragments'));
    const fragments = [...rawFragments].map((fragment) => read(() => snapshotFragment(fragment)));
    validateStructure(fragments);
    const before = [...(originals ?? fragments)].map((fragment) =>
      read(() => snapshotFragment(fragment)),
    );
    validateStructure(before);
    const mutableFragmentIds = mutable === undefined ? undefined : [...mutable];
    // Only a plan that declares originals can attribute pre-processing changes; otherwise there is
    // no baseline to compare against.
    if (originals)
      audit(
        before,
        fragments,
        new Set(policy.mode === 'audit' ? policy.mutableFragmentIds : (mutableFragmentIds ?? [])),
      );
    const plan: ContextPlan = {
      maxInputChars,
      fragments,
      additionalMessages: additionalMessages as ContextPlan['additionalMessages'],
      originalFragments: originals === undefined ? undefined : before,
      mutableFragmentIds,
    };
    const report: ContextProcessingReport = {
      mode: policy.mode,
      beforeChars: read(() => measure(before)) + additionalChars,
      afterChars: 0,
      changes: [],
    };
    const beforeTokens = read(() => measuredTokens(before, additionalMessages, ports.tokenBudget));
    return {
      plan,
      policy,
      ports,
      fragments,
      before,
      report,
      additionalChars,
      additionalMessages,
      beforeTokens,
    };
  });
}

/**
 * Assemble the final context and finalize the processing report.
 *
 * Additional messages are appended after fragments, and the combined size is checked against the
 * same budget. Token measurements are reported only when a measurement port exists.
 *
 * @param state Processing state after the policy has run.
 * @returns The built context and the completed report.
 * @throws {ValidationError} When the final input exceeds the character budget or, with a token
 *   counter, the token budget (code `MODEL_TOKEN_BUDGET`).
 */
export function finishContextProcessing(state: ProcessingState): {
  context: BuiltContext;
  report: ContextProcessingReport;
} {
  const { plan, ports, fragments, report, additionalChars, additionalMessages, beforeTokens } =
    state;
  ports.signal.throwIfAborted();
  const context = assembleFragments(fragments, plan.maxInputChars);
  context.messages.push(...additionalMessages);
  context.inputChars += additionalChars;
  validateContextBudget(context.inputChars, plan.maxInputChars);
  const afterTokens = measuredTokens(fragments, additionalMessages, ports.tokenBudget);
  if (afterTokens !== undefined) {
    breakWhile(
      afterTokens > ports.tokenBudget!.inputLimit,
      new ValidationError([
        { code: 'MODEL_TOKEN_BUDGET', message: 'Processed context exceeds token budget' },
      ]),
    );
    report.tokens = {
      counterId: ports.tokenBudget!.counterId,
      before: beforeTokens!,
      after: afterTokens,
      inputLimit: ports.tokenBudget!.inputLimit,
    };
  }
  report.afterChars = context.inputChars;
  return { context, report };
}

/**
 * Run a complete context policy in one call: snapshot, execute and finalize.
 *
 * @param plan Plan to process.
 * @param policy Policy whose mode selects the registered runner.
 * @param ports Execution ports for cancellation, diagnostics and model calls.
 * @returns The processed context and its report.
 * @throws {ValidationError} When validation or the final budget check fails.
 * @throws {BudgetError} When a handler exhausts its call allowance.
 */
export async function processContext(
  plan: ContextPlan,
  policy: ContextPolicy,
  ports: ProcessingPorts,
): Promise<{ context: BuiltContext; report: ContextProcessingReport }> {
  return nativeReportedStepAsync(ports, 'context', policy.mode, async () => {
    const state = beginContextProcessing(plan, policy, ports);
    await contextPolicyCatalog[policy.mode].run(state);
    return finishContextProcessing(state);
  });
}

export type * from '../../structs/support/context-processing.js';

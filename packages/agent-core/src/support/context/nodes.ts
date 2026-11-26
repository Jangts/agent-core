/**
 * Context workflow nodes: wire context planning, processing, selection and reduction into Core.
 *
 * Each factory returns a standard `WorkflowNode` that prepares the model call, converts the plan
 * into a Core processing state and then applies one stage. Applications may use the single
 * complete node or the explicit selection/reduction pair in their own graph. The nodes add no new
 * scheduling contract; Core still owns budgets, cancellation and commit.
 *
 * Main exports: `createContextProcessingNode`, `createContextSelectionNode`,
 * `createContextReductionNode` and their result/definition types.
 */
import { resolveInteractionAlias } from '../../model/transports.js';
import { nativeReportedStepAsync } from '../../diagnostics/native-sub-flow.js';
import {
  beginContextProcessing,
  finishContextProcessing,
  chooseSteps,
  applyReduction,
  needsReduction,
  watermarks,
  validateReductionTargets,
  contextPolicyCatalog,
  validateContextPolicy,
  type ProcessingState,
} from './processing.js';
import { modelRunnerDefaults } from '../../model/defaults.js';
import { synchronous } from '../../utils/synchronous.js';
import { combineSignals } from '../../utils/cancellation.js';
import { breakWhile } from '../../utils/rules.js';
import type { WorkflowContext, WorkflowNode } from '../../structs/execution/workflow.js';
import type { ContextPlan } from '../../structs/context/processing.js';
import type { BuiltContext } from '../../structs/context/fragments.js';
import type {
  ModelCallRequest,
  ModelPrepareRequest,
  PreparedModelCall,
  ModelInteractionDefinition,
} from '../../structs/model/runtime.js';
import type { ModelResult } from '../../structs/invocation.js';
import type {
  ContextCompressor,
  ContextSelector,
  ContextPolicy,
  ContextProcessingReport,
  ContextRecentHistory,
  ContextReduction,
} from '../../structs/support/context-processing.js';

/** Outcome of one context node: the built input, its prepared model call and the change report. */
export interface ContextNodeResult {
  /** Context built from the processed fragments, sized against the full input limit. */
  readonly input: BuiltContext;
  /** Model call prepared for this stage; carries measurement and remaining call budget. */
  readonly prepared: PreparedModelCall;
  /** What processing changed: characters, token usage, selection decisions and reductions. */
  readonly report: ContextProcessingReport;
}
/**
 * Definition accepted by `createContextProcessingNode`.
 *
 * It is a normal Core `WorkflowNode` except that the node body is declared here: `plan` builds the
 * context, `update` decides the committed state, and policy/handlers/timeout are validated when the
 * node is created.
 */
export type ContextProcessingNodeDefinition<State, Result, App> = Omit<
  WorkflowNode<State, Result, App>,
  'run' | 'report'
> & {
  /** Builds the context plan; must be synchronous so budget failures surface before any I/O. */
  readonly plan: (state: Readonly<State>, context: WorkflowContext<App>) => ContextPlan;
  /** Model preparation request, either static or derived from the current node state. */
  readonly request?:
    | (ModelPrepareRequest<string | ModelInteractionDefinition> & { modelId?: string })
    | ((
        state: Readonly<State>,
        context: WorkflowContext<App>,
      ) => ModelPrepareRequest<string | ModelInteractionDefinition> & { modelId?: string });
  /** Maps the node result to the state fields to commit; return only changed fields. */
  readonly update: (result: ContextNodeResult, state: Readonly<State>) => Partial<State>;
  /** Optional prebuilt model call, used instead of preparing `request`. */
  readonly prepared?: (state: Readonly<State>, context: WorkflowContext<App>) => PreparedModelCall;
  /** Processing policy; omitted means `validate` (no reduction, audit checks only). */
  readonly policy?: ContextPolicy;
  /** Compressors referenced by compression steps; validated against the policy at creation. */
  readonly compressors?: readonly ContextCompressor[];
  /** Selectors referenced by model-driven selection; validated against the policy at creation. */
  readonly selectors?: readonly ContextSelector[];
  /** Per-node timeout in milliseconds; defaults to the Core call timeout. */
  readonly timeoutMs?: number;
};

function history(source: ContextRecentHistory): ContextRecentHistory {
  const grouping = source.grouping;
  return {
    field: source.field,
    keepGroups: source.keepGroups,
    grouping:
      grouping.kind === 'fixed'
        ? { kind: grouping.kind, size: grouping.size }
        : { kind: grouping.kind },
  };
}
function reduction(source: ContextReduction): ContextReduction {
  const { id, kind, fragmentId, targetChars } = source;
  return kind === 'trim'
    ? { id, kind, fragmentId, targetChars, ...history(source) }
    : {
        id,
        kind,
        fragmentId,
        targetChars,
        handlerId: source.handlerId,
        preserve: source.preserve && history(source.preserve),
      };
}
function policySnapshot(source: ContextPolicy): ContextPolicy {
  if (source.mode === 'audit')
    return { mode: source.mode, mutableFragmentIds: [...source.mutableFragmentIds] };
  if (source.mode !== 'reduce') return { mode: source.mode };
  const selection = source.selection;
  return {
    mode: source.mode,
    triggerChars: source.triggerChars,
    targetInputChars: source.targetInputChars,
    triggerTokens: source.triggerTokens,
    targetInputTokens: source.targetInputTokens,
    steps: source.steps.map(reduction),
    selection: !selection
      ? undefined
      : selection.mode === 'fixed'
        ? { mode: selection.mode, kind: selection.kind }
        : selection.mode === 'auto'
          ? {
              mode: selection.mode,
              reserveCalls: selection.reserveCalls,
              maxTrimLossRatio: selection.maxTrimLossRatio,
            }
          : selection.mode === 'model'
            ? {
                mode: selection.mode,
                reserveCalls: selection.reserveCalls,
                handlerId: selection.handlerId,
              }
            : { mode: selection.mode },
  };
}

/** Result of a selection or reduction stage, before the node's `update` commits chosen fields. */
export interface ContextStageResult {
  /** Plan describing current fragments at the full (unreduced) input limit. */
  readonly plan: ContextPlan;
  /** Model call prepared for this stage. */
  readonly prepared: PreparedModelCall;
  /** Processing report accumulated by this and preceding steps. */
  readonly report: ContextProcessingReport;
}
/** Selection stage result: the chosen step IDs plus the unchanged stage snapshot. */
export interface ContextSelectionResult extends ContextStageResult {
  /** Registered reduction step IDs chosen for execution; selection itself executes nothing. */
  readonly stepIds: readonly string[];
}
/** Definition of a selection node: like a processing node, but `update` receives chosen step IDs. */
export type ContextSelectionNodeDefinition<State, Result, App> = Omit<
  ContextProcessingNodeDefinition<State, Result, App>,
  'update'
> & {
  /** Receives the chosen step IDs so the graph can route to reduction nodes. */
  readonly update: (result: ContextSelectionResult, state: Readonly<State>) => Partial<State>;
};
/**
 * Definition of a reduction node: one registered step is applied per node run.
 *
 * `stepId` may be fixed or derived from state, which lets a graph route over several steps.
 */
export type ContextReductionNodeDefinition<State, Result, App> = Omit<
  ContextProcessingNodeDefinition<State, Result, App>,
  'update'
> & {
  /** ID of the reduction step to run, fixed or derived from state. */
  readonly stepId: string | ((state: Readonly<State>) => string);
  /** Receives the stage result after one reduction has been applied. */
  readonly update: (result: ContextStageResult, state: Readonly<State>) => Partial<State>;
};

type NodeDefinition<State, Result, App, Value> = Omit<
  ContextProcessingNodeDefinition<State, Result, App>,
  'update'
> & {
  readonly update: (value: Value, state: Readonly<State>) => Partial<State>;
};
function stageResult(
  work: ProcessingState,
  prepared: PreparedModelCall,
  fullLimit: number,
  steps: readonly ContextReduction[],
): ContextStageResult {
  const mutable = steps.map((step) => step.fragmentId);
  return {
    plan: {
      additionalMessages: work.plan.additionalMessages,
      fragments: work.fragments,
      maxInputChars: fullLimit,
      originalFragments: work.plan.originalFragments ?? work.before,
      // Several steps may target one fragment; the plan lists each mutable ID only once.
      mutableFragmentIds: [...new Set(mutable)],
    },
    prepared,
    report: work.report,
  };
}

/** Common node wiring only; each specialized creator supplies its actual algorithm. */
function contextNode<State, Result, App, Value>(
  definition: NodeDefinition<State, Result, App, Value>,
  execute: (
    work: ProcessingState,
    prepared: PreparedModelCall,
    fullLimit: number,
    state: Readonly<State>,
    context: WorkflowContext<App>,
  ) => Value | Promise<Value>,
): WorkflowNode<State, Result, App> {
  const plan = definition.plan.bind(definition),
    update = definition.update.bind(definition);
  const selectPrepared = definition.prepared?.bind(definition);
  const requestSource = definition.request;
  const request =
    typeof requestSource === 'function'
      ? requestSource.bind(definition)
      : {
          stageId: requestSource?.stageId,
          modelId: requestSource?.modelId,
          interaction: resolveInteractionAlias(
            requestSource?.interaction,
            requestSource?.transport,
          ),
          maxOutputTokens: requestSource?.maxOutputTokens,
        };
  const policy = policySnapshot(definition.policy ?? { mode: 'validate' });
  const compressors = (definition.compressors ?? []).map((handler) => {
    const { id, maxCalls, compress } = handler;
    return {
      id,
      maxCalls,
      compress: typeof compress === 'function' ? compress.bind(handler) : compress,
    };
  });
  const selectors = (definition.selectors ?? []).map((handler) => {
    const { id, maxCalls, select } = handler;
    return { id, maxCalls, select: typeof select === 'function' ? select.bind(handler) : select };
  });
  validateContextPolicy(policy, compressors, selectors);
  const timeoutMs = definition.timeoutMs ?? modelRunnerDefaults.callTimeoutMs;
  breakWhile(
    !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2147483647,
    'Invalid context node timeout',
  );
  return {
    id: definition.id,
    description: definition.description,
    name: definition.name,
    startsRound: definition.startsRound,
    requires: definition.requires,
    provides: definition.provides,
    onErrorNodeId: definition.onErrorNodeId,
    onErrorRouteId: definition.onErrorRouteId,
    routes: definition.routes,
    async run(state, context) {
      return nativeReportedStepAsync(context, 'context', definition.id, async () => {
        // The node timeout is an additional bound; parent cancellation still wins.
        const signal = combineSignals(context.signal, AbortSignal.timeout(timeoutMs));
        const prepared = selectPrepared
          ? selectPrepared(state, context)
          : context.model.prepare(
              typeof request === 'function' ? request(state, context) : request,
            );
        const input = synchronous(plan(state, context), 'Context plans must be synchronous');
        // An empty measurement reports the allowance left after transport, instruction and schema
        // overhead, so processing must fit inside whichever limit is tighter.
        const overhead = prepared.measure([]);
        const fullLimit = Math.min(input.maxInputChars, overhead.maxInputChars);
        const bodyLimit = fullLimit;
        breakWhile(bodyLimit < 1, 'No input capacity for context');
        const work = beginContextProcessing(
          {
            fragments: input.fragments,
            additionalMessages: input.additionalMessages,
            originalFragments: input.originalFragments,
            mutableFragmentIds: input.mutableFragmentIds,
            maxInputChars: bodyLimit,
          },
          policy,
          {
            stageId: prepared.stageId,
            signal,
            diagnostics: context.diagnostics,
            compressors,
            selectors,
            // Read lazily so handlers see the live budget rather than the value at preparation.
            remainingCalls: () => prepared.remainingCalls,
            callModel: (options) =>
              context.model.invoke({
                ...options,
                modelId: options.modelId ?? prepared.modelId,
                signal,
              }),
            ...(overhead.counterId
              ? {
                  tokenBudget: {
                    counterId: overhead.counterId,
                    inputLimit: overhead.inputTokenLimit!,
                    measure: (messages) => prepared.measure(messages).inputTokens!,
                  },
                }
              : {}),
          },
        );
        context.report({ payload: { phase: 'processing', fragmentCount: input.fragments.length } });
        const result = await execute(work, prepared, fullLimit, state, context);
        // Never report or commit a result produced after cancellation.
        signal.throwIfAborted();
        context.report({ payload: { phase: 'processed', report: work.report } });
        return synchronous(update(result, state), 'Context node updates must be synchronous');
      });
    },
  };
}

/**
 * Create one node that runs the complete context policy and returns the built context.
 *
 * Use this when the graph does not need to route between selection and reduction phases.
 *
 * @param definition Node definition including plan, model request/prepared call, policy and update.
 * @returns A `WorkflowNode` returning the processed context, prepared call and report.
 * @throws {Error} When the policy, its handlers or the timeout are invalid, or the plan is missing
 *   enough input capacity.
 */
export function createContextProcessingNode<State, Result, App = undefined>(
  definition: ContextProcessingNodeDefinition<State, Result, App>,
): WorkflowNode<State, Result, App> {
  return contextNode(definition, async (work, prepared, fullLimit) => {
    await contextPolicyCatalog[work.policy.mode].run(work);
    const result = finishContextProcessing(work);
    return {
      input: { ...result.context, maxInputChars: fullLimit },
      prepared,
      report: result.report,
    };
  });
}

/**
 * Create an ordinary node that selects reduction steps without executing them.
 *
 * The node reports the registered step IDs so the graph can route to reduction nodes itself.
 *
 * @param definition Node definition with a `reduce` policy and a selection-aware `update`.
 * @returns A `WorkflowNode` returning the chosen step IDs plus the current stage result.
 * @throws {Error} When the policy is not a reduction policy, a reduction target is protected, or
 *   selection exceeds the remaining call budget.
 */
export function createContextSelectionNode<State, Result, App = undefined>(
  definition: ContextSelectionNodeDefinition<State, Result, App>,
): WorkflowNode<State, Result, App> {
  return contextNode(definition, async (work, prepared, fullLimit) => {
    validateReductionTargets(work);
    breakWhile(work.policy.mode !== 'reduce', 'Selection requires a reduction policy');
    const policy = work.policy as Extract<ContextPolicy, { mode: 'reduce' }>;
    work.report.selection = policy.selection?.mode ?? 'sequence';
    work.report.decisions = [];
    const stepIds = needsReduction(work, watermarks(work).trigger)
      ? await chooseSteps(work, policy.steps, policy.selection ?? { mode: 'sequence' })
      : [];
    return { ...stageResult(work, prepared, fullLimit, policy.steps), stepIds };
  });
}

/**
 * Create a node that applies exactly one registered reduction step.
 *
 * Partial plans keep the full budget until final assembly, so intermediate nodes do not shrink the
 * allowance reserved for the reply.
 *
 * @param definition Node definition with a fixed or state-derived `stepId` and update function.
 * @returns A `WorkflowNode` returning the stage result after the reduction.
 * @throws {Error} When the step ID is not registered, the target is protected, or the reduction
 *   fails or increases the fragment size.
 */
export function createContextReductionNode<State, Result, App = undefined>(
  definition: ContextReductionNodeDefinition<State, Result, App>,
): WorkflowNode<State, Result, App> {
  const source = definition.stepId;
  const stepId = typeof source === 'function' ? source.bind(definition) : () => source;
  return contextNode(definition, async (work, prepared, fullLimit, state) => {
    validateReductionTargets(work);
    const policy = work.policy as Extract<ContextPolicy, { mode: 'reduce' }>;
    const id = synchronous(stepId(state), 'Context operation IDs must be synchronous');
    const step = policy.steps.find((item) => item.id === id);
    breakWhile(!step, 'Context operation is not registered');
    await applyReduction(work, step!, policy.selection ?? { mode: 'sequence' });
    return stageResult(work, prepared, fullLimit, policy.steps);
  });
}

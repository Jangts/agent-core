/**
 * Request-budget assessment: prefer useful completion, reuse and context reduction to early exit.
 * Pure recommendations consume no model calls and grant no authority. The App supplies task
 * progress and necessary work; ModelRunner independently enforces any accepted adjustment.
 */
import type { ModelRunnerBudgetSnapshot } from '../../structs/model/runtime.js';

/** Named remaining costs; include nested generation and review, not just visible tool steps. */
export interface RemainingModelWork {
  readonly execution: number;
  readonly review: number;
  readonly delivery: number;
  readonly recovery: number;
}
/** Facts supplied by the App and actual prepared-input measurement. */
export interface BudgetAssessmentInput {
  readonly budget: ModelRunnerBudgetSnapshot;
  readonly work: RemainingModelWork;
  readonly complete?: boolean;
  readonly needsUser?: boolean;
  readonly blocked?: boolean;
  readonly stalled?: boolean;
  readonly contextPressure?: boolean;
  readonly canReduceContext?: boolean;
  /** Only true after authorized projection, reuse and alternative plans were considered. */
  readonly alternativesExhausted?: boolean;
}
/** A recommendation, never an instruction to execute a tool or weaken an input boundary. */
export interface BudgetAssessment {
  readonly action:
    'deliver' | 'continue' | 'reduce-context' | 'expand' | 'replan' | 'clarify' | 'partial';
  readonly reason: string;
  readonly requiredCalls: number;
  readonly suggestedLimit?: number;
}

/**
 * Evaluate remaining necessary work without a classification/model round.
 * Context pressure and stalled work are addressed before granting additional calls. A partial
 * result requires an actual blocker or exhausted alternatives, never just a low initial quota.
 */
export function assessModelBudget(input: BudgetAssessmentInput): BudgetAssessment {
  const costs = [input.work.execution, input.work.review, input.work.delivery, input.work.recovery];
  if (costs.length !== 4 || costs.some((value) => !Number.isSafeInteger(value) || value < 0))
    throw new TypeError('Remaining model work requires four nonnegative call estimates');
  const requiredCalls = costs.reduce((sum, value) => sum + value, 0);
  const { used, limit, ceiling, remaining } = input.budget;
  if (
    ![used, limit, ceiling, remaining, requiredCalls].every(Number.isSafeInteger) ||
    used < 0 ||
    used > limit ||
    limit > ceiling ||
    remaining < 0 ||
    remaining > limit - used
  )
    throw new TypeError('Invalid request budget accounting');
  const result = (action: BudgetAssessment['action'], reason: string): BudgetAssessment => ({
    action,
    reason,
    requiredCalls,
  });
  if (input.complete) return result('deliver', 'The requested result is ready');
  if (input.needsUser)
    return result('clarify', 'Necessary information or authority requires the user');
  if (input.blocked)
    return result('partial', 'An actual blocker prevents further useful execution');
  if (input.stalled) return result('replan', 'Repeated work has no new evidence or progress');
  if (input.contextPressure && input.canReduceContext)
    return result('reduce-context', 'Project or compress input, then reassess necessary work');
  if (input.contextPressure)
    return result(
      input.alternativesExhausted ? 'partial' : 'replan',
      'Protected input needs another feasible plan',
    );
  if (requiredCalls <= remaining)
    return result('continue', 'Necessary work fits the current allowance');
  // A child may be constrained by an ancestor reserve, regardless of its own nominal ceiling.
  if (remaining === limit - used && requiredCalls <= ceiling - used)
    return {
      ...result('expand', 'Useful remaining work exceeds the initial estimate'),
      suggestedLimit: used + requiredCalls,
    };
  return result(
    input.alternativesExhausted ? 'partial' : 'replan',
    'Reassess the plan or ancestor allocation before stopping',
  );
}

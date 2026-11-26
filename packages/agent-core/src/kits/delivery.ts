/**
 * Delivery Kit: run an ordered, synchronous stage pipeline that ends with one result.
 *
 * Place in the package: an optional App-side delivery pipeline (for example formatting and
 * sending one reply). The Kit owns ordering, cancellation checks and outcome validation; the
 * stages, their state and the actual side effects belong to the App.
 *
 * Exports: `defineDeliveryPipeline`, `Delivery`, and the delivery option/outcome types.
 */
import { nativeReportedStepSync } from '../diagnostics/native-sub-flow.js';
import type { DeliveryPipelineOptions } from '../structs/kits/delivery.js';
import type { ExecutionContext } from '../structs/common.js';
import { synchronous } from '../utils/synchronous.js';

/**
 * Compile a delivery pipeline from its declared stages.
 *
 * Stages are registered once, in declaration order, and must have unique non-blank ids. A
 * stage without a `handle` is a named hook only, so `beforeStage` can observe it.
 *
 * @param options - Stage list, state factory, optional pre-stage hook and the error factory
 *   used when every stage chose `continue`.
 * @returns A frozen plan exposing the stage ids and `deliver(input, execution)`.
 * @throws TypeError At construction for duplicate/blank ids or a non-function handler; from
 *   `deliver` when any handler returns a thenable, when a stage outcome is neither `continue`
 *   nor `complete`, or when `complete` carries no value.
 */
export function defineDeliveryPipeline<Input, State, Result, StageId extends string>(
  options: DeliveryPipelineOptions<Input, State, Result, StageId>,
) {
  const ids = new Set<string>();
  const stages = options.stages.map((stage) => {
    const { id } = stage;
    if (
      !id?.trim() ||
      ids.has(id) ||
      (stage.handle !== undefined && typeof stage.handle !== 'function')
    )
      throw new TypeError('Invalid or duplicate delivery stage');
    ids.add(id);
    return Object.freeze({ id, handle: stage.handle?.bind(stage) });
  });
  const createState = options.createState.bind(options),
    beforeStage = options.beforeStage?.bind(options),
    missingResult = options.missingResult.bind(options);
  return Object.freeze({
    stages: Object.freeze(stages.map((stage) => ({ id: stage.id }))),
    /**
     * Build the state and run the stages in order.
     *
     * The first `complete` outcome ends the pipeline and returns its value; if none completes,
     * `missingResult` supplies the error.
     *
     * @param input - Host input; it is exposed to stages as `context.app`.
     * @param execution - Execution context; cancellation is checked before every hook.
     * @throws The configured error when no stage completes, or a `TypeError` for invalid
     *   handler results.
     */
    deliver(input: Input, execution: ExecutionContext): Result {
      return nativeReportedStepSync(execution, 'delivery', 'delivery', () => {
        execution.signal.throwIfAborted();
        const state = synchronous(
          createState(input, execution),
          'Delivery state creation must be synchronous',
        );
        const context = {
          ...execution,
          signal: execution.signal,
          diagnostics: execution.diagnostics,
          app: input,
        };
        for (const stage of stages) {
          execution.signal.throwIfAborted();
          synchronous(
            beforeStage?.({ stageId: stage.id, state }, context),
            'Delivery hooks must be synchronous',
          );
          execution.signal.throwIfAborted();
          if (!stage.handle) continue;
          const outcome = synchronous(
            stage.handle(state, context),
            'Delivery handlers must be synchronous',
          );
          execution.signal.throwIfAborted();
          if (
            !outcome ||
            !['continue', 'complete'].includes(outcome.type) ||
            (outcome.type === 'complete' && !('value' in outcome))
          )
            throw new TypeError('Delivery handlers require explicit continue/complete');
          if (outcome.type === 'complete') {
            const value = outcome.value;
            execution.signal.throwIfAborted();
            return value;
          }
        }
        throw synchronous(missingResult(), 'Delivery errors must be synchronous');
      });
    },
  });
}
export type * from '../structs/kits/delivery.js';

/** Namespace object for callers that prefer one import over named helpers. */
export const DeliveryPipeline = Object.freeze({
  defineDeliveryPipeline,
  /** @deprecated Use defineDeliveryPipeline. */
  defineDelivery: defineDeliveryPipeline,
});
/** @deprecated Use DeliveryPipeline. Same immutable namespace and implementation. */
export const Delivery = DeliveryPipeline;
/** @deprecated Use defineDeliveryPipeline. */
export const defineDelivery = defineDeliveryPipeline;

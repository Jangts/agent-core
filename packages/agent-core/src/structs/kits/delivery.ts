/**
 * Delivery pipeline contract for the Delivery Kit.
 *
 * Place in the package: an optional App-side pipeline that ends with one result, for example
 * formatting and sending a reply. The Kit owns ordering, cancellation checks and outcome
 * validation; the stages, their state and the real side effects belong to the App.
 *
 * Exports: `DeliveryPipelineStage`, `DeliveryPipelineOptions`.
 */
import type { ExecutionContext, OperationContext } from '../common.js';
import type { StepOutcome } from '../execution/engine.js';

/** One pipeline stage, identified for reporting and optional observation. */
export interface DeliveryPipelineStage<Input, State, Result, StageId extends string> {
  /** Unique, non-blank stage id in declaration order. */
  readonly id: StageId;
  /**
   * Handles this stage.
   *
   * Returning `complete` ends the pipeline immediately; `continue` moves to the next stage.
   * Omitting the handler makes the stage a named hook that only `beforeStage` observes.
   */
  readonly handle?: (state: State, context: OperationContext<Input>) => StepOutcome<Result>;
}

/** Pipeline construction options. */
export interface DeliveryPipelineOptions<Input, State, Result, StageId extends string> {
  /** Creates the mutable per-run state; must return synchronously. */
  readonly createState: (input: Input, context: ExecutionContext) => State;
  /** Stages in execution order; ids must be unique. */
  readonly stages: readonly DeliveryPipelineStage<Input, State, Result, StageId>[];
  /** Observes every stage before it runs, including stages without a handler. */
  readonly beforeStage?: (
    input: { stageId: StageId; state: State },
    context: OperationContext<Input>,
  ) => void;
  /** Builds the error thrown when every stage returned `continue`. */
  readonly missingResult: () => Error;
}

/** @deprecated Use DeliveryPipelineStage. */
export type DeliveryStage<Input, State, Result, StageId extends string> = DeliveryPipelineStage<
  Input,
  State,
  Result,
  StageId
>;
/** @deprecated Use DeliveryPipelineOptions. */
export type DeliveryOptions<Input, State, Result, StageId extends string> = DeliveryPipelineOptions<
  Input,
  State,
  Result,
  StageId
>;

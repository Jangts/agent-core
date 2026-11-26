/**
 * Answer flow contract for the Answering Kit.
 *
 * Place in the package: the only `answering` module that composes the others. Generation, checking,
 * review, fallback and budget checks are App handlers; the flow owns the stage graph, cell state,
 * repair budget and per-item result statuses.
 *
 * Exports: `AnswerIssue`, `AnswerCheck`, `AnswerItem`, `AnswerResult`, `AnswerFlowDefinition`.
 */
import type { CheckResult, Issue, OperationContext, MaybePromise } from '../../common.js';
import type { RecoveryResult } from '../policies.js';

/** Validation problem produced while checking a generated answer. */
export interface AnswerIssue extends Issue {}
/** Result of one local or review check over a generated answer. */
export interface AnswerCheck<Value> extends CheckResult<Value> {}

/** One unit an answer batch must produce. */
export interface AnswerItem<Data> {
  /** Unique item id inside the batch; also the key used for values and repairs. */
  readonly id: string;
  /** Input ids this item answers; every batch input must be covered exactly once overall. */
  readonly inputIds: readonly string[];
  /** App-owned data the generator and readers consume. */
  readonly data: Data;
  /** Availability of the item's source material; anything but `ready` cannot be answered. */
  readonly sourceStatus: 'ready' | 'unavailable' | 'conflict';
}

/** Final outcome for one item. */
export interface AnswerResult<Data, Value> {
  readonly item: AnswerItem<Data>;
  /** Accepted or recovered value; absent when the item was blocked. */
  readonly value?: Value;
  /** `accepted` needs both checks resolved; `fallback` used recovery; `blocked` has no value. */
  readonly status: 'accepted' | 'fallback' | 'blocked';
  /** Combined local and review issues, plus generated codes such as a missing value. */
  readonly issues: readonly AnswerIssue[];
  /** Verdicts that produced this result. */
  readonly checks: { readonly local: AnswerCheck<Value>; readonly review: AnswerCheck<Value> };
}
/** Static handlers and limits; signal, diagnostics and App dependencies arrive at run. */
export interface AnswerFlowDefinition<Data, Value, App = undefined> {
  /** Maximum items in one batch; must be a positive integer. */
  readonly maxItems: number;
  /** Repair rounds; the flow runs at most `maxRepairs + 1` rounds in total. */
  readonly maxRepairs: number;
  /** Review policy; defaults to `optional`, `required` blocks on an unresolved review. */
  readonly reviewPolicy?: 'optional' | 'required' | 'off';
  /** Request-level budget guard; must return boolean synchronously. */
  canInvoke(context: OperationContext<App>): boolean;
  /**
   * Produces values for the items that still need one.
   *
   * `repairs` carries the issues of a failed attempt and `previous` its rejected values.
   */
  generate(
    input: {
      readonly items: readonly AnswerItem<Data>[];
      readonly repairs?: ReadonlyMap<string, readonly AnswerIssue[]>;
      readonly previous?: ReadonlyMap<string, Value>;
    },
    context: OperationContext<App>,
  ): Promise<ReadonlyMap<string, Value>>;
  /** Local check for one generated value; must return synchronously. */
  check(
    input: { readonly item: AnswerItem<Data>; readonly value: Value },
    context: OperationContext<App>,
  ): AnswerCheck<Value>;
  /** Batch review; returns one check per reviewed item and must cover the submitted items. */
  review?(
    input: { readonly items: readonly { item: AnswerItem<Data>; value: Value }[] },
    context: OperationContext<App>,
  ): Promise<ReadonlyMap<string, AnswerCheck<Value>>>;
  /** Last resort for a failed item; `handled` supplies a replacement value. */
  fallback(
    input: { readonly item: AnswerItem<Data>; readonly issues: readonly AnswerIssue[] },
    context: OperationContext<App>,
  ): RecoveryResult<Value>;
  /** Observes a stage outcome; failures must not affect the flow result. */
  observe?(
    input: { readonly stageId: string; readonly results: readonly AnswerResult<Data, Value>[] },
    context: OperationContext<App>,
  ): MaybePromise<void>;
}

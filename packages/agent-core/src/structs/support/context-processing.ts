/**
 * Context processing contract used by Support's context engine.
 *
 * Core keeps the trust, budget and structural-audit guarantees; these declarations describe the
 * App-supplied policies, reductions, compressors and selectors that the engine applies in a fixed
 * order. Each mode, kind and handler is a registered entry, so validation and execution read the
 * same declaration.
 *
 * Exports: `ContextHistoryGrouping`, `ContextRecentHistory`, `ContextHandlerReference`,
 * `ContextReduction`, `ContextSelection`, `ContextSelectionCandidate`, `ContextTokenMeasurement`,
 * `ContextSelectionCall`, `ContextSelector`, `ContextPolicy`, `ContextCompressionCall`,
 * `ContextCompressor`, `ContextProcessingReport`, `ContextModelRequest`, `ContextModelCall`,
 * `ContextProcessingOptions`.
 */
import type { ContextFragment, BuiltContext } from '../context/fragments.js';
import type { ContextPlan } from '../context/processing.js';
import type { ExecutionContext } from '../common.js';
import type { ModelResult } from '../invocation.js';
import type { ModelMessage } from '../model/messages.js';

/** How a message history is split into groups for trimming. */
export type ContextHistoryGrouping = { kind: 'fixed'; size: number } | { kind: 'user-turn' };
/** Recent history that compression must keep verbatim. */
export interface ContextRecentHistory {
  /** Field holding the history value inside the fragment. */
  field: string;
  /** Number of trailing groups to keep. */
  keepGroups: number;
  /** Grouping rule; `user-turn` keeps whole conversational turns together. */
  grouping: ContextHistoryGrouping;
}

/** Reference to a registered compressor or selector handler. */
export interface ContextHandlerReference {
  /** Registered handler id; an unknown id is rejected before execution. */
  readonly handlerId: string;
}

/** One declared reduction step. */
export type ContextReduction =
  /** Trims a history field to `targetChars`, dropping whole groups beyond `keepGroups`. */
  | {
      id: string;
      kind: 'trim';
      fragmentId: string;
      field: string;
      targetChars: number;
      grouping: ContextHistoryGrouping;
      keepGroups: number;
    }
  /** Rewrites one fragment through a registered compressor down to `targetChars`. */
  | ({
      id: string;
      kind: 'compress';
      fragmentId: string;
      targetChars: number;
      /** Recent history the compressor must preserve verbatim. */
      preserve?: ContextRecentHistory;
    } & ContextHandlerReference);

/** Selection is independent of ownership; omitted selection preserves ordered execution. */
export type ContextSelection =
  /** Apply every declared step in order. */
  | { mode: 'sequence' }
  /** Apply only steps of the given kind. */
  | { mode: 'fixed'; kind: ContextReduction['kind'] }
  /** maxTrimLossRatio is a JSON-character reduction heuristic, not semantic information loss. */
  | { mode: 'auto'; maxTrimLossRatio?: number; reserveCalls?: number }
  /** Ask a registered model selector; `reserveCalls` keeps calls for later stages. */
  | ({ mode: 'model'; reserveCalls?: number } & ContextHandlerReference);

/** Candidate step considered by selection, with its measured cost. */
export interface ContextSelectionCandidate {
  id: string;
  kind: ContextReduction['kind'];
  fragmentId: string;
  /** Current size of the candidate fragment, in JSON characters. */
  chars: number;
  /** Size the step would reduce the fragment to. */
  targetChars: number;
  /** Model calls required to apply the step; 0 for local steps. */
  requiredCalls: number;
  /** Exact dry-run result for trim. Compression size is not predicted. */
  projectedChars?: number;
  /** Fraction of characters removed by a trim step; meaningless for compression. */
  trimLossRatio?: number;
}

/** Injected token measurement for token-triggered policies. */
export interface ContextTokenMeasurement {
  /** Tokenizer identity, reported in the processing report. */
  counterId: string;
  /** Input token ceiling the measurement is compared against. */
  inputLimit: number;
  measure(messages: readonly ModelMessage[]): number;
}
/** Everything a selector may inspect for one decision. */
export interface ContextSelectionCall {
  readonly stageId: string;
  /** Reducible candidates, already filtered and measured. */
  candidates: readonly ContextSelectionCandidate[];
  /** Only reducible fragments; never protected request or system fragments. */
  fragments: readonly ContextFragment[];
  /** Current input tokens, when a token budget applies. */
  currentTokens?: number;
  /** Tokens that must be removed to satisfy the token budget. */
  requiredReductionTokens?: number;
  currentChars: number;
  /** Characters that must be removed to satisfy the character budget. */
  requiredReductionChars: number;
  /** Calls the selector may still spend through `callModel`. */
  remainingCalls: number;
  callModel: ContextModelCall;
}
/** Model or local selector that chooses which reductions to apply. */
export interface ContextSelector {
  id: string;
  /** Maximum model calls made through callModel, default 1; 0 permits a local selector. */
  maxCalls?: number;
  /** Returns selected reduction ids; unknown ids are rejected. */
  select(call: ContextSelectionCall, context: ExecutionContext): Promise<readonly string[]>;
}

/** Declared context policy for one stage. */
export type ContextPolicy =
  /** Validate trust and budgets without changing content. */
  | { mode: 'validate' }
  /**
   * Reduce content when a trigger is exceeded.
   *
   * Character and token triggers/targets may be combined; `targetInputChars`/`targetInputTokens`
   * define the size the reduction must reach.
   */
  | {
      mode: 'reduce';
      triggerChars?: number;
      targetInputChars?: number;
      triggerTokens?: number;
      targetInputTokens?: number;
      selection?: ContextSelection;
      steps: readonly ContextReduction[];
    }
  /** Verify that only the listed fragments changed value, without reducing anything. */
  | { mode: 'audit'; mutableFragmentIds: readonly string[] };

/** One compression request. */
export interface ContextCompressionCall {
  readonly stageId: string;
  /** Fragment to compress; its `targetChars` bound is enforced by the engine. */
  fragment: ContextFragment;
  targetChars: number;
  /** Same runner's budget, timeout, transports and diagnostics. No recursive processing. */
  callModel: ContextModelCall;
}
/** Registered compressor handler. */
export interface ContextCompressor {
  id: string;
  /** Maximum model calls through callModel, default 1; declare 0 for local compression. */
  maxCalls?: number;
  /** Produces a replacement value no larger than the requested target where possible. */
  compress(
    call: ContextCompressionCall,
    context: ExecutionContext,
  ): Promise<ContextFragment['value']>;
}
/** Facts recorded for one processing run. */
export interface ContextProcessingReport {
  /** Policy mode that ran. */
  mode: ContextPolicy['mode'];
  /** Selection mode applied, when the policy reduced content. */
  selection?: ContextSelection['mode'];
  /** Per-step selection decisions, kept for auditing `auto` and `model` choices. */
  decisions?: { mode: ContextSelection['mode']; stepIds: string[]; reason: string }[];
  /** Total characters before and after processing. */
  beforeChars: number;
  afterChars: number;
  /** Token measurement, present only when a token budget was supplied. */
  tokens?: { counterId: string; before: number; after: number; inputLimit: number };
  /** Applied changes in execution order; `app` marks an App-supplied mutation. */
  changes: {
    id: string;
    kind: 'trim' | 'compress' | 'app';
    fragmentId: string;
    beforeChars: number;
    afterChars: number;
  }[];
}
/** One model call made on behalf of a selector or compressor. */
export type ContextModelRequest = {
  readonly modelId?: string;
  readonly stageId: string;
  readonly input: readonly ModelMessage[] | BuiltContext;
  readonly maxOutputTokens: number;
} & (
  | { readonly interaction: string; readonly transport?: string }
  | {
      readonly interaction?: string;
      /** @deprecated Use interaction. */ readonly transport: string;
    }
);
/** Same runner and same fixed invocation result as public model calls. */
export interface ContextModelCall {
  (request: ContextModelRequest): Promise<ModelResult<unknown>>;
}

/** Runtime inputs for one processing run. */
export interface ContextProcessingOptions extends ExecutionContext {
  /** Stage the processing belongs to; reported in diagnostics and selection calls. */
  readonly stageId: string;
  /** Compressors available by handler id. */
  readonly compressors: readonly ContextCompressor[];
  /** Selectors available by handler id; required only for model selection. */
  readonly selectors?: readonly ContextSelector[];
  readonly callModel: ContextModelCall;
  /** Remaining model calls; used to reject unaffordable selections. */
  readonly remainingCalls?: () => number;
  /** Token measurement; without it, token triggers and targets cannot apply. */
  readonly tokenBudget?: ContextTokenMeasurement;
}

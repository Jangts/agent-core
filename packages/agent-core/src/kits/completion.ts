/**
 * Completion Kit: ordered App checks return a specific recovery target instead of a boolean.
 * This is an optional library called by ordinary workflow nodes, not a second task scheduler.
 * Work records, factual sufficiency, persistence and user-facing language belong to the App.
 */

import { awaitWithSignal } from '../utils/cancellation.js';

/** A correction names its owner and scope; presentation faults never imply re-executing tools. */
export type CompletionDecision =
  | { readonly kind: 'ready' }
  | {
      readonly kind: 'repair';
      readonly target: 'content' | 'format' | 'evidence';
      readonly reason: string;
    }
  | { readonly kind: 'clarify' | 'partial'; readonly reason: string };

/** Each check explicitly declares whether its failure can block the principal result. */
export interface CompletionCheck<Input> {
  readonly id: string;
  readonly required: boolean;
  readonly check: (
    input: Input,
    signal: AbortSignal,
  ) => CompletionDecision | Promise<CompletionDecision>;
}
/** Technical failures and optional refusals stay visible without erasing the main result. */
export interface CompletionReport {
  readonly decision: CompletionDecision;
  readonly observations: readonly {
    readonly id: string;
    readonly decision?: CompletionDecision;
    readonly error?: unknown;
  }[];
}

/**
 * Compile checks once; required failures propagate to the App's recovery edge, optional failures
 * are returned as observations. Cancellation is never converted into success or retried work.
 */
export function defineCompletionChecks<Input>(checks: readonly CompletionCheck<Input>[]) {
  const definitions = checks.map((check) => ({
    id: check.id,
    required: check.required,
    check: check.check.bind(check),
  }));
  if (
    new Set(definitions.map((check) => check.id)).size !== definitions.length ||
    definitions.some((check) => !check.id.trim() || typeof check.required !== 'boolean')
  )
    throw new TypeError('Completion checks require unique IDs and explicit required flags');
  return Object.freeze({
    async run(input: Input, signal: AbortSignal): Promise<CompletionReport> {
      const observations: { id: string; decision?: CompletionDecision; error?: unknown }[] = [];
      for (const check of definitions) {
        signal.throwIfAborted();
        try {
          const decision = await awaitWithSignal(
            Promise.resolve(check.check(input, signal)),
            signal,
          );
          signal.throwIfAborted();
          if (
            !decision ||
            !['ready', 'repair', 'clarify', 'partial'].includes(decision.kind) ||
            (decision.kind !== 'ready' &&
              (typeof decision.reason !== 'string' || !decision.reason.trim())) ||
            (decision.kind === 'repair' &&
              !['content', 'format', 'evidence'].includes(decision.target))
          )
            throw new TypeError('Invalid completion decision');
          observations.push({ id: check.id, decision });
          if (check.required && decision.kind !== 'ready') return { decision, observations };
        } catch (error) {
          signal.throwIfAborted();
          if (check.required) throw error;
          observations.push({ id: check.id, error });
        }
      }
      return { decision: { kind: 'ready' }, observations };
    },
  });
}

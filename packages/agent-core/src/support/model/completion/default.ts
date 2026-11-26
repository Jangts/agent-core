/**
 * Default completion policy: the behavior the provider had before policies were configurable.
 *
 * Strictness is driven by whether the call declared functions, not by `tool_choice`: that one fact
 * decides both whether function parts are acceptable and which `finish_reason` is expected.
 *
 * Exports: `defaultCompletionPolicy`.
 */
import type { CompletionPolicy } from '../../../structs/support/model/completion.js';

const policy: CompletionPolicy = {
  id: 'default',
  begin(facts, fail) {
    let finished = false;
    let hasText = false;
    let hasCall = false;
    return {
      part(part) {
        if (typeof part === 'string') {
          hasText = true;
          return;
        }
        if (!facts.functions) throw fail('MODEL_PROTOCOL');
        hasCall = true;
      },
      finish(reason) {
        if (reason !== (facts.functions ? 'tool_calls' : 'stop'))
          throw fail(reason === 'length' ? 'MODEL_OUTPUT_LIMIT' : 'MODEL_INCOMPLETE');
        finished = true;
      },
      end() {
        if (!finished || (facts.functions ? !hasCall : !hasText && !facts.allowEmptyText))
          throw fail('MODEL_INCOMPLETE');
      },
    };
  },
};

/** Frozen default policy: strictness depends only on whether the call declared functions. */
export const defaultCompletionPolicy: CompletionPolicy = Object.freeze(policy);

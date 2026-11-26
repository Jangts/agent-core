/**
 * Standard session completion policy: one policy covering the documented `tool_choice` modes.
 *
 * Selection is explicit; consumers that do not opt in keep the default policy. Rules follow the
 * effective `tool_choice` of the request body, so a host override is judged as the upstream saw it.
 * An omitted field keeps the pre-policy rules instead of being read as `required`.
 *
 * Exports: `sessionCompletionPolicy`.
 */
import type {
  CompletionPolicy,
  CompletionSession,
} from '../../../structs/support/model/completion.js';
import { createToolCallCollector } from './calls.js';

type Mode = 'inherit' | 'auto' | 'required' | 'none' | 'named';

/** Read the specific-function form: `{ type: 'function', function: { name } }`. */
function namedTool(choice: unknown): string | undefined {
  if (!choice || typeof choice !== 'object' || Array.isArray(choice)) return undefined;
  const value = choice as Record<string, unknown>;
  if (value.type !== 'function') return undefined;
  const fn = value.function;
  if (!fn || typeof fn !== 'object' || Array.isArray(fn)) return undefined;
  const name = (fn as Record<string, unknown>).name;
  return typeof name === 'string' && name ? name : undefined;
}

const policy: CompletionPolicy = {
  id: 'session',
  begin(facts, fail): CompletionSession {
    const choice = facts.toolChoice;
    let mode: Mode;
    let named: string | undefined;
    if (choice === undefined) mode = 'inherit';
    else if (choice === 'auto' || choice === 'required' || choice === 'none') mode = choice;
    else {
      named = namedTool(choice);
      if (!named) throw fail('MODEL_CONFIG');
      mode = 'named';
    }
    const collector = createToolCallCollector((): never => {
      throw fail('MODEL_PROTOCOL');
    });
    let finished = false;
    let hasText = false;
    let hasCall = false;
    const textSatisfied = () => hasText || facts.allowEmptyText;
    const calls = () => {
      const completed = collector.complete();
      if (!completed.length) throw fail('MODEL_INCOMPLETE');
      if (named && completed.some((call) => call.name !== named)) throw fail('MODEL_PROTOCOL');
      return completed;
    };
    return {
      part(part) {
        if (typeof part === 'string') {
          hasText = true;
          return;
        }
        hasCall = true;
        if (mode === 'none') throw fail('MODEL_PROTOCOL');
        if (mode === 'inherit' && !facts.functions) throw fail('MODEL_PROTOCOL');
        collector.push(part);
      },
      finish(reason) {
        if (mode === 'inherit') {
          if (reason !== (facts.functions ? 'tool_calls' : 'stop'))
            throw fail(reason === 'length' ? 'MODEL_OUTPUT_LIMIT' : 'MODEL_INCOMPLETE');
          finished = true;
          return;
        }
        if (reason === 'length') throw fail('MODEL_OUTPUT_LIMIT');
        if (mode === 'none') {
          if (reason !== 'stop' || !textSatisfied()) throw fail('MODEL_INCOMPLETE');
        } else if (mode === 'auto') {
          if (reason === 'tool_calls') calls();
          else if (reason === 'stop') {
            if (hasCall) throw fail('MODEL_PROTOCOL');
            if (!textSatisfied()) throw fail('MODEL_INCOMPLETE');
          } else throw fail('MODEL_INCOMPLETE');
        } else if (reason === 'tool_calls') calls();
        else throw fail('MODEL_INCOMPLETE');
        finished = true;
      },
      end() {
        if (!finished) throw fail('MODEL_INCOMPLETE');
        if (mode === 'inherit' && (facts.functions ? !hasCall : !textSatisfied()))
          throw fail('MODEL_INCOMPLETE');
      },
    };
  },
};

/**
 * Frozen opt-in policy that judges rules by the request's effective `tool_choice`.
 *
 * Consumers that do not select it keep `defaultCompletionPolicy`.
 */
export const sessionCompletionPolicy: CompletionPolicy = Object.freeze(policy);

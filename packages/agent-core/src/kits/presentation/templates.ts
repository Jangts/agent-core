/**
 * Presentation Kit: text masters with substituted slots and semantic-slot validation.
 *
 * Place in the package: part of the `presentation` Kit. The program owns each master; model
 * output only supplies slot values, so generated text can never introduce new template syntax.
 *
 * Exports: `defineTextTemplate`, `defineSemanticSlots`, and the template definition types.
 */
import type {
  SemanticSlotDefinition,
  TextTemplateOptions,
} from '../../structs/kits/presentation/templates.js';
import { breakWhile } from '../../utils/rules.js';
import { observeSafely } from '../../utils/observer.js';

/**
 * The program owns the master; inserted model text is a value and is substituted once only.
 *
 * Substitution is single-pass `String.replace`: a value that itself contains `{{slot}}` is
 * left as literal text, so a slot value cannot inject further substitutions.
 *
 * @param master - Template text using `{{slot}}` placeholders; slot names may repeat.
 * @param options - Error wording and an optional observer for rendered text.
 * @returns A frozen template exposing the deduplicated `slots` and `render(values)`.
 * @throws Error From `render` when a referenced slot is missing from `values`.
 */
export function defineTextTemplate(master: string, options: TextTemplateOptions = {}) {
  const slots = Object.freeze([
    ...new Set([...master.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1])),
  ]);
  const errors = options.errors,
    missingField = errors?.missingField?.bind(errors),
    observe = options.observe?.bind(options);
  return Object.freeze({
    slots,
    render(values: Readonly<Record<string, string>>): string {
      const result = master.replace(/\{\{(\w+)\}\}/g, (_token, key: string) => {
        breakWhile(
          !Object.hasOwn(values, key),
          () => missingField?.(key) ?? new Error(`Missing template slot: ${key}`),
        );
        return values[key];
      });
      observeSafely(observe, result);
      return result;
    },
  });
}

/**
 * Models select public semantic keys; hosts retain private values and selection policy.
 *
 * A text is valid when it uses at most `maxOccurrences` namespaced slots, every name is a
 * declared key, and no malformed `{{namespace` remnant is left behind — the last check stops
 * partial or misspelled placeholders from reaching the template engine.
 *
 * @param definition - Namespace (lower-case words joined by hyphens), allowed keys and the
 *   occurrence limit (a non-negative safe integer, 0 forbidding the slot entirely).
 * @returns A frozen validator with the namespace and `isValid(text)`.
 * @throws TypeError For an invalid namespace or occurrence limit.
 */
export function defineSemanticSlots(definition: SemanticSlotDefinition) {
  const { namespace, maxOccurrences } = definition;
  breakWhile([
    { occur: () => !/^[a-z][a-z0-9-]*$/.test(namespace), error: 'Invalid slot namespace' },
    {
      occur: () => !Number.isSafeInteger(maxOccurrences) || maxOccurrences < 0,
      error: 'Invalid slot limit',
    },
  ]);
  const keys = new Set(definition.keys);
  const pattern = new RegExp(`\\{\\{${namespace}:([^{}]*)\\}\\}`, 'g');
  return Object.freeze({
    namespace,
    isValid(text: string): boolean {
      const matches = [...text.matchAll(pattern)];
      return (
        matches.length <= maxOccurrences &&
        matches.every((match) => keys.has(match[1])) &&
        !text.replace(pattern, '').includes(`{{${namespace}`)
      );
    },
  });
}

export type {
  SemanticSlotDefinition,
  TextTemplateOptions,
} from '../../structs/kits/presentation/templates.js';

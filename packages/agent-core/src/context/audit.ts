/**
 * Structural audit of context fragments before they are assembled.
 *
 * A plan may carry the trusted originals plus the fragments an App node produced. This check
 * permits value rewrites for explicitly mutable fragments and rejects everything structural:
 * added or removed fragments, changed trust, lifetime or budget, changed value type, changed
 * field sets, and changes to system or instruction fragments.
 *
 * The guarantee is structural only. Whether a rewritten value is semantically faithful needs
 * an App-side audit.
 *
 * Exports: `auditContextChange`.
 */
import type { ContextFragment } from '../structs/context/fragments.js';
import { ValidationError } from '../structs/errors.js';
import { breakWhile } from '../utils/rules.js';
/** Single code for every violation, so consumers can classify audit failures uniformly. */
const fail = (message: string) => new ValidationError([{ code: 'CONTEXT_POLICY', message }]);

/**
 * Compare trusted originals with the fragments about to be assembled.
 *
 * @param original Fragments captured before any App-side processing.
 * @param current Fragments that will actually be assembled; same length as `original`.
 * @param mutable Ids explicitly allowed to change value. Everything else is protected.
 * @returns Nothing; a clean audit has no side effect.
 * @throws ValidationError when the fragment list, its metadata, the value type or the field
 *   set changed, or when a protected fragment was rewritten.
 */
export function auditContextChange(
  original: readonly ContextFragment[],
  current: readonly ContextFragment[],
  mutable: ReadonlySet<string>,
): void {
  // Fragments may be rewritten in place but not added or removed: assembly and audit both
  // assume the same positions describe the same fragment.
  breakWhile(
    original.length !== current.length,
    fail('Context fragments cannot be added or removed'),
  );
  for (const [index, before] of original.entries()) {
    const after = current[index];
    // Metadata and value are compared separately: only the value may be rewritten, and only
    // for ids the plan explicitly allows.
    const { value: _before, ...beforeMetadata } = before;
    const { value: _after, ...afterMetadata } = after;
    breakWhile(
      Object.keys(beforeMetadata).length !== Object.keys(afterMetadata).length ||
        Object.entries(beforeMetadata).some(
          ([key, value]) => (afterMetadata as Record<string, unknown>)[key] !== value,
        ),
      fail('Context identity, trust and budgets must be preserved'),
    );
    // A type change would alter how the fragment is serialized, so it is rejected before any
    // value comparison is attempted.
    breakWhile(
      typeof before.value !== typeof after.value,
      fail('Context value type must be preserved'),
    );
    // String comparison captures both values and their key order; a reordered rewrite counts
    // as a change, which is the conservative direction for an audit.
    const changed = JSON.stringify(before.value) !== JSON.stringify(after.value);
    breakWhile(
      changed &&
        (!mutable.has(before.id) || before.role === 'system' || before.trust === 'instruction'),
      fail(`Protected context changed: ${before.id}`),
    );
    if (changed && typeof before.value === 'object' && typeof after.value === 'object')
      // A null value carries no fields. Treat it as an empty field set so turning it into an
      // object, or dropping an object back to null, is still rejected as a structural change.
      breakWhile(
        JSON.stringify(Object.keys(before.value ?? {}).sort()) !==
          JSON.stringify(Object.keys(after.value ?? {}).sort()),
        fail('Context fields must be preserved'),
      );
  }
}

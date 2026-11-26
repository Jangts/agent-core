/** Portable schema validation. Unsupported constraints are rejected, never silently removed. */
import type { ModelFunction } from '../../../structs/model/messages.js';
const keywords = new Set([
  'type',
  'description',
  'properties',
  'required',
  'items',
  'enum',
  'additionalProperties',
  'title',
]);
/** Validate the portable schema subset and retain the exact failing path. */
export function validatePortableSchema(schema: unknown, path = 'output'): void {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema))
    throw new TypeError(`Invalid schema: ${path}`);
  for (const [key, value] of Object.entries(schema)) {
    if (!keywords.has(key)) throw new TypeError(`Unsupported portable schema: ${path}.${key}`);
    if (key === 'properties') {
      if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new TypeError(`Invalid schema properties: ${path}`);
      for (const [name, child] of Object.entries(value))
        validatePortableSchema(child, `${path}.properties.${name}`);
    }
    if (key === 'items' || (key === 'additionalProperties' && typeof value === 'object'))
      validatePortableSchema(value, `${path}.${key}`);
  }
}
/** Validate portable function names and object schemas before any network operation. */
export function validateFunctions(functions: readonly ModelFunction[] = []): void {
  const names = new Set<string>();
  for (const fn of functions) {
    if (!/^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(fn.name) || names.has(fn.name))
      throw new TypeError(`Invalid or duplicate portable function name: ${fn.name}`);
    names.add(fn.name);
    validatePortableSchema(fn.parameters, fn.name);
    if (fn.parameters.type !== 'object')
      throw new TypeError(`Function parameters must be object: ${fn.name}`);
  }
}

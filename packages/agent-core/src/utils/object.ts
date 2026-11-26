/**
 * Structural object freezing for schema snapshots.
 *
 * JSON schemas are shared by definition, so a consumer that mutates a nested keyword
 * would corrupt every other consumer. This deep freeze makes that attempt fail loudly.
 *
 * Exports: `freezeSchema`.
 */
/**
 * Recursively freeze an object graph.
 *
 * Arrays are objects, so they are covered as well. Already frozen nodes are skipped,
 * which makes the walk safe on cyclic or shared sub-graphs and idempotent.
 *
 * @param value - Candidate node; primitives and non-objects are ignored.
 */
export function freezeSchema(value: unknown): void {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const child of Object.values(value)) freezeSchema(child);
}

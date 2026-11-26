/**
 * Answering Kit: batch shape validation for one answer request.
 *
 * Place in the package: part of the `answering` Kit. It guards the request envelope only;
 * reading, checking and repairing answers happens in the flow and task modules.
 *
 * Exports: `validateAnswerBatch`.
 */
import type { AnswerItem } from '../../structs/kits/answering/flow.js';

/**
 * Validate that one batch is well formed and fully covered.
 *
 * @param inputIds - Every input id the batch must answer; non-empty, unique, non-blank.
 * @param items - Answer items; each must reference known inputs and together cover all of them.
 * @param maxItems - Maximum allowed item count, a positive safe integer.
 * @throws TypeError For an invalid limit or input ids, an empty or oversized item list,
 *   duplicate item ids, an unknown source status or input id, or an uncovered input.
 */
export function validateAnswerBatch<Data>(
  inputIds: readonly string[],
  items: readonly AnswerItem<Data>[],
  maxItems: number,
): void {
  if (
    !Number.isSafeInteger(maxItems) ||
    maxItems < 1 ||
    !inputIds.length ||
    new Set(inputIds).size !== inputIds.length ||
    inputIds.some((id) => typeof id !== 'string' || !id)
  )
    throw new TypeError('Invalid answer input ids or limit');
  if (
    !items.length ||
    items.length > maxItems ||
    new Set(items.map((item) => item.id)).size !== items.length
  )
    throw new TypeError('Invalid answer item count or ids');
  const covered = new Set<string>();
  for (const item of items) {
    if (
      typeof item.id !== 'string' ||
      !item.id ||
      !['ready', 'unavailable', 'conflict'].includes(item.sourceStatus) ||
      !item.inputIds.length ||
      new Set(item.inputIds).size !== item.inputIds.length
    )
      throw new TypeError('Invalid answer item');
    for (const id of item.inputIds) {
      if (!inputIds.includes(id)) throw new TypeError(`Unknown answer input: ${id}`);
      covered.add(id);
    }
  }
  if (inputIds.some((id) => !covered.has(id)))
    throw new TypeError('Answer tasks do not cover every input');
}

/**
 * Event visibility catalog for Core diagnostics.
 *
 * Each event Core can emit appears once with its default visibility tier:
 * - `metadata`: identity, timing and outcome. Consumers that have not opted into content still
 *   receive the event; a few payloads are additionally projected to metadata-only fields.
 * - `content`: the payload carries model-visible text (prepared messages, model output, parsed
 *   values), so the event reaches only consumers that accept content.
 *
 * The object doubles as the allow-list used when normalizing persisted records, and its
 * `satisfies` clause forces a tier for every `CoreEventName`, so a new event cannot skip the
 * decision.
 *
 * Exports: `coreEventCatalog`.
 */
import type { CoreEventName } from '../structs/diagnostics.js';
/**
 * Default visibility tier for every event Core can emit.
 *
 * The same object is the allow-list used when normalizing persisted records; adding an event to
 * `CoreEventName` without a tier here fails type checking.
 */
export const coreEventCatalog = {
  'node.progress': 'metadata',
  'model.start': 'metadata',
  'model.lifecycle.start': 'metadata',
  'model.lifecycle.end': 'metadata',
  'model.binding': 'metadata',
  'model.prepare': 'content',
  'model.output': 'content',
  'model.parsed': 'content',
  'model.end': 'metadata',
  'runtime.rejected': 'metadata',
  'loop.event': 'metadata',
  'workflow.event': 'metadata',
  'tool.call': 'metadata',
  'tool.result': 'metadata',
  'rule.result': 'metadata',
} as const satisfies Record<CoreEventName, 'metadata' | 'content'>;

/**
 * Tool-call delta aggregation, re-exported from Core.
 *
 * The algorithm lives in `model/interactions/calls.ts` so session interactions and
 * completion policies share one implementation. This module keeps the existing
 * Support import path stable.
 *
 * Exports: `AggregatedToolCall`, `ToolCallCollector`, `ToolCallFailure` and
 * `createToolCallCollector`.
 */
export { createToolCallCollector } from '../../../model/interactions/calls.js';
export type {
  AggregatedToolCall,
  ToolCallCollector,
  ToolCallFailure,
} from '../../../model/interactions/calls.js';

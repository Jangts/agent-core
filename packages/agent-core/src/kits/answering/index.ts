/**
 * Answering Kit entry: batch validation, per-value checks, task/reader catalogs and the
 * generate-check-review-repair workflow.
 *
 * Place in the package: an optional App-side library for answering a bounded batch of items.
 * Models, readers, checks, fallbacks and repair policy are supplied by the App; this module
 * owns their composition, bounds and status aggregation. Core never imports it.
 *
 * Exports: everything from `./flow.js`, `./tasks.js`, `./batch.js` and `./checks.js`, plus the
 * `Answering` namespace object.
 */
export * from './flow.js';
export * from './tasks.js';
export * from './batch.js';
export * from './checks.js';

import { defineAnswerTaskCatalog, defineAnswerReaderCatalog } from './tasks.js';
import { defineAnswerCheckCatalog } from './checks.js';
import { defineAnswerFlow } from './flow.js';
import { validateAnswerBatch } from './batch.js';

/** Namespace object for callers that prefer one import over named helpers. */
export const Answering = Object.freeze({
  defineAnswerTaskCatalog,
  defineAnswerReaderCatalog,
  defineAnswerCheckCatalog,
  defineAnswerFlow,
  validateAnswerBatch,
});

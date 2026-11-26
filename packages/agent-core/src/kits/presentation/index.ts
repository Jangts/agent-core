/**
 * Presentation Kit entry: output contracts, text templates, semantic slots, reply formats,
 * variants and the reply/chunk event stream.
 *
 * Place in the package: an optional App-side library for shaping what the user finally sees.
 * The App owns copy, styling and transport; this directory owns contract validation, template
 * substitution, format checks, variant selection and the bubble/chunk protocol.
 *
 * Exports: everything from `./outputs.js`, `./formats.js`, `./variants.js`, `./templates.js` and
 * `./events.js`, plus the `Presentation` namespace object.
 */
export * from './outputs.js';
export * from './formats.js';
export * from './variants.js';
export type * from '../../structs/kits/presentation/outputs.js';
export type * from '../../structs/kits/presentation/formats.js';
export * from './templates.js';
export * from './events.js';

import { defineOutputCatalog } from './outputs.js';
import { defineReplyFormats, mergeReplyBubbles, replyFormatChecks } from './formats.js';
import { defineTextTemplate, defineSemanticSlots } from './templates.js';
import { selectVariant, resolvePreference } from './variants.js';
import {
  REPLY_BUBBLE_BOUNDARY,
  replyBubbleTexts,
  publishReplyEvents,
  serializeOutputEvents,
  textOutputEvents,
} from './events.js';

/** Namespace object for callers that prefer one import over named helpers. */
export const Presentation = Object.freeze({
  defineOutputCatalog,
  defineReplyFormats,
  replyFormatChecks,
  mergeReplyBubbles,
  defineTextTemplate,
  defineSemanticSlots,
  selectVariant,
  resolvePreference,
  REPLY_BUBBLE_BOUNDARY,
  replyBubbleTexts,
  publishReplyEvents,
  serializeOutputEvents,
  textOutputEvents,
});

/** Resolve App-selected reply configuration without discovering or promoting untrusted tool text. */
import type { ReplyGuidance } from '../structs/model/runtime.js';
import { snapshotReplyGuidance } from '../model/reply-guidance.js';

/** Configurations selected by the App for this reply, not all registered tools or nodes. */
export interface ReplyGuidanceSources {
  readonly defaults?: ReplyGuidance;
  readonly node?: ReplyGuidance;
  readonly tools?: readonly (ReplyGuidance | undefined)[];
  readonly call?: ReplyGuidance;
}

/**
 * Resolve defaults < node < applicable tools < call. Conflicting tool defaults require
 * an explicit call choice. Validation still checks overridden values; no raw description
 * or tool result becomes a system instruction.
 */
export function resolveReplyGuidance(
  sources: ReplyGuidanceSources,
): Readonly<ReplyGuidance> | undefined {
  const defaults = snapshotReplyGuidance(sources.defaults);
  const node = snapshotReplyGuidance(sources.node);
  const tools = (sources.tools ?? [])
    .map(snapshotReplyGuidance)
    .filter((value) => value !== undefined);
  const call = snapshotReplyGuidance(sources.call);
  if (!call && new Set(tools.map((value) => value.defaultDetail)).size > 1)
    throw new TypeError('Conflicting tool reply guidance requires an explicit call choice');
  return call ?? tools[0] ?? node ?? defaults;
}

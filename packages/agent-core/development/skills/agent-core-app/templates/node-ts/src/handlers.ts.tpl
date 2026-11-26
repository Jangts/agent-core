import type { OperationContext } from '@jangts/agent-core';
import type { KnowledgeCatalog, KnowledgeSnapshot } from '@jangts/agent-core/kits/knowledge';

export interface ReadInput { documentId: string; sectionIds?: string[] }
export interface Reply { text: string; sourceIds: string[] }
export interface Services {
  knowledge: KnowledgeCatalog;
  seen: Map<string, KnowledgeSnapshot>;
  authorizeRead?: (input: ReadInput, signal: AbortSignal) => void | Promise<void>;
}
export function object(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Expected an object');
  return input as Record<string, unknown>;
}
export function parseRead(input: unknown): ReadInput {
  const value = object(input);
  if (Object.keys(value).some(key => !['documentId', 'sectionIds'].includes(key)) || typeof value.documentId !== 'string'
    || !value.documentId || value.documentId.length > 100 || value.sectionIds !== undefined && (!Array.isArray(value.sectionIds)
      || !value.sectionIds.length || value.sectionIds.length > 16 || value.sectionIds.some(id => typeof id !== 'string' || !id || id.length > 100))) throw new TypeError('Invalid knowledge read');
  return { documentId: value.documentId, ...(value.sectionIds ? { sectionIds: [...value.sectionIds as string[]] } : {}) };
}
export async function authorizeRead(input: ReadInput, { app, signal }: OperationContext<Services>) {
  if (!app.authorizeRead) throw new Error('The App must authorize knowledge access');
  await app.authorizeRead(input, signal); signal.throwIfAborted();
}
export function readKnowledge(input: ReadInput, { app }: OperationContext<Services>) {
  const value = app.knowledge.read({ documentId: input.documentId, selection: input.sectionIds
    ? { mode: 'subtree', sectionIds: input.sectionIds } : { mode: 'document' } });
  app.seen.set(value.documentId, value); return value;
}
export function parseSnapshot(input: unknown): KnowledgeSnapshot {
  const value = object(input);
  if (typeof value.documentId !== 'string' || typeof value.revision !== 'string' || typeof value.content !== 'string'
    || typeof value.id !== 'string' || !value.selection) throw new TypeError('Invalid knowledge result');
  return input as KnowledgeSnapshot;
}
export function parseReply(input: unknown): Reply {
  const value = object(input);
  if (Object.keys(value).some(key => !['text', 'sourceIds'].includes(key)) || typeof value.text !== 'string' || !value.text.trim() || value.text.length > 4000
    || !Array.isArray(value.sourceIds) || value.sourceIds.length > 16 || value.sourceIds.some(id => typeof id !== 'string' || !id)
    || new Set(value.sourceIds).size !== value.sourceIds.length) throw new TypeError('Invalid reply');
  return { text: value.text, sourceIds: [...value.sourceIds as string[]] };
}
export function acceptReply(reply: Reply, services: Services) {
  return reply.sourceIds.map(documentId => {
    const source = services.seen.get(documentId);
    if (!source) throw new Error('Reply cites a source that was not read');
    return { documentId, revision: source.revision };
  });
}

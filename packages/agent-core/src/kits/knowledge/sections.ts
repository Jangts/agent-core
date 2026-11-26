/**
 * Knowledge Kit: adapter and helpers for sectioned knowledge documents.
 *
 * Place in the package: part of the `knowledge` Kit. The anchor format is one text adapter;
 * other sources build the same document contract directly. No I/O happens here.
 *
 * Exports: `parseKnowledgeDocument`, `compileKnowledgeDocument`, `knowledgeText`.
 */
import type {
  KnowledgeDocument,
  KnowledgePart,
  KnowledgeSection,
} from '../../structs/kits/knowledge.js';

/**
 * Paired, nestable anchors are one text adapter. Other sources supply the same document
 * contract directly.
 *
 * @param input - Document identity, revision, optional locale and the anchored text.
 * @returns A document whose parts alternate text strings and section objects.
 * @throws TypeError For an unmatched closing anchor or an anchor left open at the end.
 */
export function parseKnowledgeDocument(input: {
  id: string;
  revision: string;
  text: string;
  locale?: string;
}): KnowledgeDocument {
  const parts: KnowledgePart[] = [];
  const stack: { id: string; parts: KnowledgePart[] }[] = [];
  const pattern = /^<!-- (\/?)agent-section:([A-Za-z0-9_.:-]+) -->\s*$/gm;
  let offset = 0;
  for (const match of input.text.matchAll(pattern)) {
    const target = stack.at(-1)?.parts ?? parts;
    target.push(input.text.slice(offset, match.index));
    if (match[1]) {
      if (stack.at(-1)?.id !== match[2])
        throw new TypeError(`Unmatched knowledge section: ${match[2]}`);
      stack.pop();
    } else {
      const section = { id: match[2], parts: [] as KnowledgePart[] };
      target.push(section);
      stack.push(section);
    }
    offset = match.index! + match[0].length;
  }
  if (stack.length) throw new TypeError(`Unclosed knowledge section: ${stack.at(-1)!.id}`);
  parts.push(input.text.slice(offset));
  return { id: input.id, revision: input.revision, locale: input.locale, parts };
}

/**
 * Deep-copy and freeze a document while indexing its sections by id.
 *
 * @param document - Declared document, possibly sharing arrays or containing cycles.
 * @returns The frozen document plus a map from section id to its frozen section.
 * @throws TypeError For a missing identity or parts array, a sparse or cyclic tree, a blank
 *   section id, or a duplicate section id.
 */
export function compileKnowledgeDocument(document: KnowledgeDocument) {
  if (!document.id?.trim() || !document.revision?.trim() || !Array.isArray(document.parts))
    throw new TypeError('Invalid knowledge document');
  const sections = new Map<string, KnowledgeSection>();
  const ancestors = new Set<object>();
  function copy(parts: readonly KnowledgePart[]): readonly KnowledgePart[] {
    if (!Array.isArray(parts) || ancestors.has(parts))
      throw new TypeError('Invalid knowledge section tree');
    ancestors.add(parts);
    // Visit empty array slots too: a sparse tree is not valid knowledge, and
    // must not share a serialized cache identity with an explicit null part.
    const result = Array.from(parts, (part) => {
      if (typeof part === 'string') return part;
      if (!part || typeof part.id !== 'string' || !part.id.trim() || sections.has(part.id))
        throw new TypeError('Invalid or duplicate knowledge section');
      // Reserve the id before descending, including self-referential input.
      sections.set(part.id, part);
      const value = Object.freeze({ id: part.id, parts: copy(part.parts) });
      sections.set(part.id, value);
      return value;
    });
    ancestors.delete(parts);
    return Object.freeze(result);
  }
  const value = Object.freeze({
    id: document.id,
    revision: document.revision,
    locale: document.locale,
    parts: copy(document.parts),
  });
  return { document: value, sections };
}

/**
 * Flatten parts into text.
 *
 * @param parts - Document parts; nested sections are traversed in order.
 * @param subtree - When false, nested section text is skipped and only top-level text remains.
 * @returns Concatenated text with separators left to the caller.
 */
export function knowledgeText(parts: readonly KnowledgePart[], subtree = true): string {
  return parts
    .map((part) => (typeof part === 'string' ? part : subtree ? knowledgeText(part.parts) : ''))
    .join('');
}

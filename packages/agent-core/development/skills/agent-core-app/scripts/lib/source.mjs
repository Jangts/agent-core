/*
 * Reader for a knowledge source file supplied by the operator.
 *
 * The file belongs to the App's development skills (开发技能). It turns one UTF-8 source
 * file into a parsed knowledge document plus the hashes that identify it. The Knowledge
 * Kit owns the document contract; this module only owns the file access, the byte budget
 * and the identity derivation.
 *
 * Main exports: `readSuppliedSource`.
 */
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { createHash } from 'node:crypto';
import { Knowledge } from '@jangts/agent-core/kits/knowledge';

/**
 * Read and parse one supplied knowledge source file.
 *
 * @param file - Path of the UTF-8 source file.
 * @param id - Stable document id; must be a lowercase slug of at most 64 characters.
 * @param maxBytes - Maximum accepted file size in bytes.
 * @param locale - Optional locale carried over from the document this one replaces.
 * @returns The raw bytes, the parsed document, the original file name and the content hash.
 * @throws TypeError For an invalid document id or a file that is not valid UTF-8.
 * @throws RangeError When the file is empty or exceeds the byte budget.
 * @throws Error When the decoded text is blank, or the anchors of the document are invalid.
 */
export async function readSuppliedSource(file, id, maxBytes = 32000, locale) {
  // The id becomes part of the published document identity, so its shape is fixed.
  if (!/^[a-z][a-z0-9_.:-]{0,63}$/.test(id)) throw new TypeError('Choose a stable document ID');
  const bytes = await readFile(file);
  if (!bytes.length || bytes.length > maxBytes)
    throw new RangeError('Source must contain text within the configured byte budget');
  // `fatal` rejects malformed UTF-8 instead of replacing the invalid bytes.
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (!text.trim()) throw new Error('Source has no content; use empty initialization instead');
  // The content hash covers the raw bytes; the revision covers the parsed identity.
  const digest = createHash('sha256').update(bytes).digest('hex');
  const revision = createHash('sha256')
    .update(JSON.stringify([id, locale, text]))
    .digest('hex');
  const document = Knowledge.parseKnowledgeDocument({ id, revision, locale, text });
  return { bytes, document, name: basename(file), digest };
}

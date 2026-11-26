/**
 * App-owned knowledge loading for the `agent-core-app` Skill.
 *
 * Reads the App's `knowledge.config.json` allowlist, verifies each referenced document against the
 * configured byte limit, and compiles the documents into a Knowledge Kit catalog. This is App
 * configuration code, not a Core file-store API: no model or request may supply a filesystem path.
 *
 * Exports: `compileApplicationKnowledge`, `readApplicationKnowledge`, `loadApplicationKnowledge`.
 */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Knowledge } from '@jangts/agent-core/kits/knowledge';

/**
 * Compile parsed documents into a Knowledge catalog.
 *
 * @param documents Documents produced by `Knowledge.parseKnowledgeDocument`.
 * @param policy Validated `knowledge.config.json` content (`schemaVersion`, `maxReadChars`,
 *   `requiredReads`).
 * @returns The compiled catalog; required reads are resolved so a missing read fails here.
 * @throws {TypeError} When the policy shape or a required read is invalid.
 */
export function compileApplicationKnowledge(documents, policy) {
  if (
    !policy ||
    policy.schemaVersion !== 1 ||
    !Number.isSafeInteger(policy.maxReadChars) ||
    policy.maxReadChars < 1 ||
    !Array.isArray(policy.requiredReads)
  )
    throw new TypeError('Invalid application knowledge policy');
  const catalog = Knowledge.defineKnowledgeCatalog(documents, { maxChars: policy.maxReadChars });
  // Required task reads must fit their runtime content budget as well as resolve.
  for (const read of policy.requiredReads) catalog.read(read);
  return catalog;
}

/**
 * Read the knowledge config and its allowed documents from one directory.
 *
 * The config hash is computed over the exact bytes parsed below, so a proposal identity cannot
 * drift from the document catalog it was derived from.
 *
 * @param directory Directory holding `knowledge.config.json` and the listed documents.
 * @returns Parsed `documents`, the raw `policy` and the `baseConfigSha256` of the config file.
 * @throws {TypeError} When the config or a document entry fails validation.
 * @throws {RangeError} When a source document exceeds `maxDocumentBytes`.
 */
export async function readApplicationKnowledge(directory = new URL('./', import.meta.url)) {
  // Bind validation and proposal identity to the exact bytes parsed below.
  const configBytes = await readFile(new URL('knowledge.config.json', directory));
  const baseConfigSha256 = createHash('sha256').update(configBytes).digest('hex');
  const policy = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(configBytes));
  if (
    !Array.isArray(policy.documents) ||
    !Number.isSafeInteger(policy.maxDocumentBytes) ||
    policy.maxDocumentBytes < 1
  )
    throw new TypeError('Invalid application document catalog');
  const documents = await Promise.all(
    policy.documents.map(async (entry) => {
      // The allowlist is App-maintained. Neither a model nor a request supplies this filesystem path.
      if (
        !entry ||
        typeof entry.id !== 'string' ||
        typeof entry.file !== 'string' ||
        !/^[a-z0-9][a-z0-9.-]*\.knowledge\.md$/.test(entry.file) ||
        (entry.locale !== undefined && typeof entry.locale !== 'string')
      )
        throw new TypeError('Invalid application document entry');
      const bytes = await readFile(new URL(entry.file, directory));
      if (bytes.length > policy.maxDocumentBytes)
        throw new RangeError('Source document exceeds the App limit');
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      const revision = createHash('sha256')
        .update(JSON.stringify([entry.id, entry.locale, text]))
        .digest('hex');
      return Knowledge.parseKnowledgeDocument({
        id: entry.id,
        revision,
        locale: entry.locale,
        text,
      });
    }),
  );
  return { documents, policy, baseConfigSha256 };
}

/**
 * Read and compile the App knowledge catalog in one step.
 *
 * @param directory Directory holding `knowledge.config.json` and the listed documents.
 * @returns The compiled Knowledge catalog.
 * @throws {TypeError | RangeError} Same validation failures as `readApplicationKnowledge` and
 *   `compileApplicationKnowledge`.
 */
export async function loadApplicationKnowledge(directory = new URL('./', import.meta.url)) {
  const { documents, policy } = await readApplicationKnowledge(directory);
  return compileApplicationKnowledge(documents, policy);
}

/**
 * Text Skills Kit: compile declarative, text-only skill registrations into readable skills.
 *
 * Place in the package: an optional App-side library for skill documents that are pure text.
 * Documents are read through an App port; nothing here executes code, imports modules, binds
 * tools or grants authority. Tool ids are only carried as declared references.
 *
 * Exports: `defineTextSkillLoader`, `TextSkills`, and the skill document/port types.
 */
import { synchronous } from '../utils/synchronous.js';
import type {
  TextSkill,
  TextSkillHeader,
  TextSkillLoaderDefinition,
  TextSkillRegistration,
  TextSkillReadPorts,
} from '../structs/kits/text-skills.js';
import { breakWhile } from '../utils/rules.js';

/**
 * Compile a loader that validates registrations and reads their documents.
 *
 * The default contract is narrow by design: ids are lower-case words joined by hyphens (up to
 * `maxIdChars`, default 64), each entry lives at `<id>/SKILL.md`, the kind is `text-workflow`,
 * and the document starts with `name`/`description` front matter.
 *
 * @param definition - Size limits, optional per-app entry/header overrides and error wording;
 *   handlers are bound to this object.
 * @returns A frozen loader with `load({ entries }, ports)`.
 * @throws TypeError At construction for non-integer or non-positive limits; from `load` for a
 *   malformed catalog, duplicate/invalid ids, a mismatched entry path or kind, duplicate tool
 *   ids, an oversized instruction body, or a header that is absent or disagrees with the id.
 */
export function defineTextSkillLoader(
  definition: TextSkillLoaderDefinition,
): import('../structs/kits/text-skills.js').TextSkillLoader {
  const { maxInstructionChars, maxDescriptionChars, maxIdChars = 64 } = definition;
  breakWhile([
    {
      occur: () =>
        ![maxInstructionChars, maxDescriptionChars, maxIdChars].every(Number.isSafeInteger),
      error: 'Invalid text skill limits',
      tags: ['integer'],
    },
    {
      occur: () => Math.min(maxInstructionChars, maxDescriptionChars, maxIdChars) < 1,
      error: 'Invalid text skill limits',
      tags: ['range'],
    },
  ]);
  const idPattern = new RegExp(`^[a-z][a-z0-9-]{0,${maxIdChars - 1}}$`);
  const entryFor = definition.entryFor?.bind(definition) ?? ((id) => `${id}/SKILL.md`);
  const parseHeader = definition.parseHeader?.bind(definition) ?? strictHeader;
  const catalogError =
    (typeof definition.errors?.catalog === 'function'
      ? definition.errors.catalog.bind(definition.errors)
      : definition.errors?.catalog) ?? 'Text skill catalog must be an array';
  const registrationError =
    (typeof definition.errors?.registration === 'function'
      ? definition.errors.registration.bind(definition.errors)
      : definition.errors?.registration) ?? 'Invalid text skill registration';
  const documentError =
    (typeof definition.errors?.document === 'function'
      ? definition.errors.document.bind(definition.errors)
      : definition.errors?.document) ?? 'Invalid text skill document';
  const tags = [...(definition.tags ?? [])];

  return Object.freeze({
    load(input: { entries: unknown }, ports: TextSkillReadPorts): readonly TextSkill[] {
      breakWhile(!input || typeof input !== 'object', catalogError);
      const entries = input.entries,
        read = ports.read.bind(ports);
      breakWhile(!Array.isArray(entries), catalogError);
      const ids = new Set<string>();
      return Object.freeze(
        (entries as Record<string, unknown>[]).map((raw) => {
          breakWhile(!raw || typeof raw !== 'object' || Array.isArray(raw), registrationError, [
            ...tags,
            'registration',
            'shape',
          ]);
          const entry = {
            id: raw.id,
            entry: raw.entry,
            kind: raw.kind,
            toolIds: raw.toolIds,
          } as unknown as TextSkillRegistration;
          breakWhile(
            [
              {
                occur: () => !entry || typeof entry !== 'object',
                error: registrationError,
                tags: ['shape'],
              },
              {
                occur: [
                  () => typeof entry.id !== 'string' || !idPattern.test(entry.id),
                  () => ids.has(entry.id),
                ],
                error: registrationError,
                tags: ['id'],
              },
              {
                occur: [
                  () =>
                    entry.entry !==
                    synchronous(entryFor(entry.id), 'Skill entry selectors must be synchronous'),
                  () => entry.kind !== 'text-workflow',
                ],
                error: registrationError,
                tags: ['workflow'],
              },
              {
                occur: [
                  () => !Array.isArray(entry.toolIds),
                  () => entry.toolIds.some((tool) => typeof tool !== 'string' || !tool),
                  () => new Set(entry.toolIds).size !== entry.toolIds.length,
                ],
                error: registrationError,
                tags: ['tools'],
              },
            ],
            [...tags, 'registration'],
          );
          ids.add(entry.id);
          const instructions = synchronous(read(entry.entry), 'Skill reads must be synchronous');
          breakWhile(
            typeof instructions !== 'string' || instructions.length > maxInstructionChars,
            documentError,
            [...tags, 'document', 'instructions'],
          );
          const header = synchronous(
            parseHeader(instructions),
            'Skill header parsing must be synchronous',
          );
          breakWhile(
            [
              {
                occur: [() => !header, () => header!.id !== entry.id],
                error: documentError,
                tags: ['identity'],
              },
              {
                occur: () =>
                  !header!.description.trim() || header!.description.length > maxDescriptionChars,
                error: documentError,
                tags: ['description'],
              },
            ],
            [...tags, 'document'],
          );
          return Object.freeze({
            id: entry.id,
            entry: entry.entry,
            kind: entry.kind,
            toolIds: Object.freeze([...entry.toolIds]),
            description: header!.description.trim(),
            instructions,
          });
        }),
      );
    },
  });
}

/** Default header parser: exactly the two front-matter keys, nothing else, in this order. */
function strictHeader(instructions: string): TextSkillHeader | undefined {
  const header = instructions.match(
    /^---\r?\nname: ([a-z][a-z0-9-]*)\r?\ndescription: ([^\r\n]+)\r?\n---(?:\r?\n|$)/,
  );
  return header ? { id: header[1], description: header[2] } : undefined;
}

export type {
  TextSkill,
  TextSkillRegistration,
  TextSkillHeader,
  TextSkillLoaderDefinition,
  TextSkillLoader,
  TextSkillReadPorts,
} from '../structs/kits/text-skills.js';

/** Namespace object for callers that prefer one import over named helpers. */
export const TextSkills = Object.freeze({ defineTextSkillLoader });

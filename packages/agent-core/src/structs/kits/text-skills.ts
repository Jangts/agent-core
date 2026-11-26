/**
 * Text skill contract for the Text Skills Kit.
 *
 * Place in the package: an optional App-side loader for text-only skill documents. A skill is
 * metadata plus instructions read from a document; nothing here executes code, imports modules or
 * calls tools. Ids, entry paths and header fields are validated against the declared limits.
 *
 * Exports: `TextSkillRegistration`, `TextSkill`, `TextSkillHeader`, `TextSkillLoaderDefinition`,
 * `TextSkillReadPorts`, `TextSkillLoader`.
 */
import type { BreakReason } from '../utils/rules.js';

/** Catalog entry of one text skill, before its document is read. */
export interface TextSkillRegistration {
  /** Skill id, lowercase kebab case, bounded by `maxIdChars` (64 by default). */
  readonly id: string;
  /** Document path; must equal the loader's `entryFor(id)` result. */
  readonly entry: string;
  /** Only text workflow skills are supported. */
  readonly kind: 'text-workflow';
  /** Tool ids the instructions may reference; validated by the caller, not executed here. */
  readonly toolIds: readonly string[];
}

/** Loaded skill: registration plus the parsed document text. */
export interface TextSkill extends TextSkillRegistration {
  /** Description taken from the document header and matching the registration. */
  readonly description: string;
  /** Instruction body without the header, bounded by `maxInstructionChars`. */
  readonly instructions: string;
}

/** Header every skill document must carry. */
export interface TextSkillHeader {
  readonly id: string;
  readonly description: string;
}

/** Loader limits, parsing hooks and rejection wording. */
export interface TextSkillLoaderDefinition {
  /** Maximum characters of the instruction body; larger documents are rejected. */
  readonly maxInstructionChars: number;
  /** Maximum characters of the description header. */
  readonly maxDescriptionChars: number;
  /** Maximum id length; defaults to 64. */
  readonly maxIdChars?: number;
  /** Maps an id to its expected document path; defaults to `<id>/SKILL.md`. */
  readonly entryFor?: (id: string) => string;
  /** Default parser accepts the strict name/description header; hosts can inject a YAML parser. */
  readonly parseHeader?: (instructions: string) => TextSkillHeader | undefined;
  /** Diagnostic tags attached to loader rejections. */
  readonly tags?: readonly string[];
  readonly errors?: {
    readonly catalog?: BreakReason;
    readonly registration?: BreakReason;
    readonly document?: BreakReason;
  };
}

/** Host port that reads one skill document by path. */
export interface TextSkillReadPorts {
  /** Returns the document text; throwing aborts the load. */
  read(entry: string): string;
}
/** Compiled loader. */
export interface TextSkillLoader {
  /**
   * Reads and validates every registered skill.
   *
   * @param request - `entries` is the untrusted catalog array; shape is validated here.
   * @param ports - Document reader supplied by the host.
   * @returns Frozen skills in catalog order.
   * @throws When the catalog, a registration, an entry path or a document is invalid.
   */
  load(request: { readonly entries: unknown }, ports: TextSkillReadPorts): readonly TextSkill[];
}

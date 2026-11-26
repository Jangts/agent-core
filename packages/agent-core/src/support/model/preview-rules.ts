/**
 * Reply preview rule generation from capability and stage declarations.
 *
 * Previews are presentation only: rules are derived from the same capability schemas and stage
 * references used for interaction, so a capability cannot preview a field it does not accept.
 * Declarations are snapshotted; application objects are never frozen or mutated.
 *
 * Main exports: `createReplyPreviewRules` and the capability/stage declaration types.
 */
import { breakWhile } from '../../utils/rules.js';
import type { JsonSchema } from '../../structs/common.js';
import type { ReplyPreviewRule } from './reply-preview.js';
import { wireName } from '../../model/interactions/arguments.js';
import type { ModelTool } from '../../structs/capabilities/model.js';

/** A model tool with an explicit, presentation-only streaming preview contract. */
export interface PreviewTool<Input = unknown, Selection = Input, Context = any> extends ModelTool<
  Input,
  Selection,
  Context
> {
  readonly preview?: true | Omit<ReplyPreviewRule, 'stageId' | 'toolId'>;
}

/**
 * Capability declaration used to derive preview rules.
 *
 * Omitted `preview` means the capability never previews, so previewing is an explicit opt-in.
 */
export interface ReplyPreviewTool {
  /** Capability ID, which must equal the native function wire name used for interaction. */
  readonly id: string;
  /** Input schema used to prove that preview and eligibility paths really exist. */
  readonly jsonSchema: JsonSchema;
  /**
   * Explicit preview opt-in: `true` uses the default text/bubble paths, an object narrows the
   * paths and eligibility, and omission means the capability never previews.
   */
  readonly preview?: true | Omit<ReplyPreviewRule, 'stageId' | 'toolId'>;
}
/** Stage declaration: which tools it exposes and whether it previews text or arguments. */
export interface ReplyPreviewStage {
  /** Stage ID used by the workflow and interaction projection. */
  readonly id: string;
  /** Capabilities exposed at this stage; must be unique and registered. */
  readonly toolIds?: readonly string[];
  /** `text` previews plain model text; `tools` previews opted-in capability arguments. */
  readonly preview?: 'text' | 'tools';
}

/**
 * Check whether a schema path exists, following local `$ref`, composition keywords and `items`.
 *
 * Rules are only emitted for declared fields, so a renamed or removed field fails generation
 * instead of silently producing an empty preview.
 */
function fieldExists(root: JsonSchema, path: readonly string[]): boolean {
  const visit = (schema: unknown, remaining: readonly string[], depth: number): boolean => {
    if (!schema || typeof schema !== 'object' || depth > 64) return false;
    if (!remaining.length) return true;
    const current = schema as Record<string, unknown>;
    if (typeof current.$ref === 'string' && current.$ref.startsWith('#/')) {
      const target = current.$ref
        .slice(2)
        .split('/')
        .reduce<unknown>(
          (value, part) =>
            value && typeof value === 'object'
              ? (() => {
                  const key = part.replace(/~1/g, '/').replace(/~0/g, '~');
                  return Object.hasOwn(value, key)
                    ? (value as Record<string, unknown>)[key]
                    : undefined;
                })()
              : undefined,
          root,
        );
      if (visit(target, remaining, depth + 1)) return true;
    }
    for (const keyword of ['anyOf', 'oneOf', 'allOf']) {
      const alternatives = current[keyword];
      if (
        Array.isArray(alternatives) &&
        alternatives.some((value) => visit(value, remaining, depth + 1))
      )
        return true;
    }
    const [key, ...rest] = remaining;
    const properties = current.properties;
    if (
      key !== '*' &&
      properties &&
      typeof properties === 'object' &&
      Object.hasOwn(properties, key!) &&
      visit((properties as Record<string, unknown>)[key!], rest, depth + 1)
    )
      return true;
    return (key === '*' || /^\d+$/.test(key!)) && visit(current.items, rest, depth + 1);
  };
  return visit(root, path, 0);
}

function stringList(value: readonly string[], label: string): string[] {
  breakWhile(!Array.isArray(value), `Invalid preview ${label}`);
  const snapshot = Array.from(value);
  breakWhile(
    snapshot.some((item) => typeof item !== 'string'),
    `Invalid preview ${label}`,
  );
  return snapshot;
}
function previewSnapshot(
  preview: ReplyPreviewTool['preview'],
): true | Omit<ReplyPreviewRule, 'stageId' | 'toolId'> | undefined {
  if (!preview || preview === true) return preview || undefined;
  const { paths, when } = preview;
  const pathSnapshot =
    paths === undefined ? undefined : Array.from(paths, (path) => stringList(path, 'path'));
  const eligibility =
    when === undefined
      ? undefined
      : {
          path: stringList(when.path, 'eligibility path'),
          values: stringList(when.values, 'eligibility values'),
        };
  return { paths: pathSnapshot, when: eligibility };
}

/**
 * Generate frozen preview rules from capability and stage declarations.
 *
 * Capabilities without preview metadata are skipped even when their stage opts in. Default paths
 * are `text` and `bubbles[*]`, each kept only when the capability schema declares it.
 *
 * @param options Stage declarations and the tools they may reference.
 * @returns Frozen rules in stage order, each with deep-frozen paths and eligibility.
 * @throws {Error} When a capability or stage ID repeats, a stage references an unknown capability,
 *   a preview mode is unknown, or a preview path or eligibility field is absent from the schema.
 */
export function createReplyPreviewRules(options: {
  readonly stages: readonly ReplyPreviewStage[];
  readonly tools: readonly ReplyPreviewTool[];
}): readonly ReplyPreviewRule[] {
  const tools = new Map<string, ReplyPreviewTool>();
  for (const capability of options.tools) {
    const id = capability.id;
    breakWhile(!id || tools.has(id), 'Duplicate preview capability declaration');
    const preview = previewSnapshot(capability.preview);
    // Validate and emit the same canonical snapshot, never reread App getters.
    const jsonSchema = preview ? structuredClone(capability.jsonSchema) : {};
    tools.set(id, { id, preview, jsonSchema });
  }
  const stages = new Set<string>(),
    rules: ReplyPreviewRule[] = [];
  for (const stage of options.stages) {
    const { id: stageId, preview, toolIds } = stage;
    breakWhile(!stageId || stages.has(stageId), 'Duplicate preview stage declaration');
    stages.add(stageId);
    const ids = toolIds === undefined ? [] : stringList(toolIds, 'capability IDs');
    breakWhile(
      new Set(ids).size !== ids.length || ids.some((id) => !tools.has(id)),
      'Preview stage references an unknown capability',
    );
    breakWhile(
      preview !== undefined && !['text', 'tools'].includes(preview),
      'Unknown preview stage mode',
    );
    if (!preview) continue;
    if (preview === 'text') {
      breakWhile(ids.length > 0, 'Text preview requires a declared plain-text stage');
      rules.push(Object.freeze({ stageId }));
      continue;
    }
    for (const id of ids) {
      const capability = tools.get(id)!;
      if (!capability.preview) continue;
      const source = capability.preview === true ? {} : capability.preview;
      const { paths, when } = source;
      const checkedPaths =
        paths ??
        [['text'], ['bubbles', '*']].filter((path) => fieldExists(capability.jsonSchema, path));
      breakWhile(
        !checkedPaths.length ||
          checkedPaths.some((path) => !fieldExists(capability.jsonSchema, path)),
        `Invalid preview field: ${id}`,
      );
      breakWhile(
        !!when && !fieldExists(capability.jsonSchema, when.path),
        `Invalid preview eligibility field: ${id}`,
      );
      // Only generator-owned snapshots are frozen; App declarations remain untouched.
      const emittedPaths = Object.freeze(checkedPaths.map((path) => Object.freeze(path)));
      const emittedWhen =
        when &&
        Object.freeze({ path: Object.freeze(when.path), values: Object.freeze(when.values) });
      rules.push(
        Object.freeze({
          stageId,
          toolId: wireName(id),
          paths: emittedPaths,
          ...(emittedWhen ? { when: emittedWhen } : {}),
        }),
      );
    }
  }
  return Object.freeze(rules);
}

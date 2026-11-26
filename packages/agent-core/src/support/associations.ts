/** Compile owner-to-tool relations without parallel intent identities or execution side effects. */
import { bindIntent, snapshotIntent } from '../capabilities/tool-conditions.js';
import { readonlyCatalog } from '../utils/catalog.js';
import { synchronous } from '../utils/synchronous.js';
import { defineModelTools } from './model/capabilities.js';
import type { ModelToolRegistration } from '../structs/capabilities/model.js';
import type {
  AssociatedRegistration,
  AssociationOptions,
  AssociationSource,
  ToolAssociation,
} from '../structs/support/associations.js';

/** Compile independent and owner-derived Tool declarations, validating all references eagerly. */
export function defineAssociatedCatalog<Entry extends AssociatedRegistration>(
  entries: readonly Entry[],
  options: AssociationOptions<Entry> = {},
) {
  const owners = readonlyCatalog<Entry>(
    entries,
    (id) => new TypeError(`Unknown tool owner: ${id}`),
  );
  const definitions = new Map<string, ModelToolRegistration>();
  const sources = new Map<string, AssociationSource[]>();
  const declare = (tool: ModelToolRegistration, source: AssociationSource) => {
    if (definitions.has(tool.id)) throw new TypeError(`Duplicate model tool: ${tool.id}`);
    definitions.set(tool.id, tool);
    sources.set(tool.id, [source]);
  };
  const independent = new Set<string>();
  for (const tool of options.tools ?? []) {
    independent.add(tool.id);
    declare(tool, {
      kind: 'standalone',
      id: tool.id,
      description: tool.description,
      toolIds: [tool.id],
    });
  }
  const bindings = owners.definitions.map((owner) => {
    const fallback = options.toolDefaults
      ? synchronous(options.toolDefaults(owner), 'Tool defaults must be synchronous')
      : undefined;
    const declarations: readonly ToolAssociation[] = owner.modelTools ?? (fallback ? [{}] : []);
    const toolIds: string[] = [];
    for (const declaration of declarations) {
      if (typeof declaration === 'string') {
        if (!independent.has(declaration))
          throw new TypeError(
            `Tool reference must name an independent tool: ${owner.id} -> ${declaration}`,
          );
        sources.get(declaration)!.push({
          kind: 'registration',
          id: owner.id,
          description: owner.description,
          toolIds: [declaration],
        });
        toolIds.push(declaration);
      } else {
        if (!declaration || typeof declaration !== 'object' || Array.isArray(declaration))
          throw new TypeError('Invalid tool association');
        const active = declaration.active ?? fallback?.active;
        const intent = declaration.asIntent ?? fallback?.asIntent;
        const intentOwner = declaration.asIntent !== undefined ? declaration : fallback;
        const tool = {
          ...fallback,
          ...declaration,
          id: declaration.id ?? fallback?.id ?? owner.id,
          description: declaration.description ?? fallback?.description ?? owner.description,
          active:
            typeof active === 'function'
              ? active.bind(declaration.active !== undefined ? declaration : fallback)
              : active,
          asIntent: bindIntent(
            snapshotIntent(typeof intent === 'function' ? intent.bind(intentOwner) : intent),
            intentOwner,
          ),
          resolve: declaration.resolve?.bind(declaration) ?? fallback?.resolve?.bind(fallback),
        } as ModelToolRegistration;
        declare(tool, {
          kind: 'registration',
          id: owner.id,
          description: owner.description,
          toolIds: [tool.id],
        });
        toolIds.push(tool.id);
      }
    }
    if (new Set(toolIds).size !== toolIds.length)
      throw new TypeError(`Duplicate tool reference: ${owner.id}`);
    return Object.freeze({ id: owner.id, toolIds: Object.freeze(toolIds) });
  });
  return Object.freeze({
    ...owners,
    tools: defineModelTools([...definitions.values()]),
    bindings: readonlyCatalog(bindings, (id) => new TypeError(`Unknown tool binding: ${id}`)),
    sources: readonlyCatalog(
      [...sources].map(([id, values]) =>
        Object.freeze({
          id,
          sources: Object.freeze(
            values.map((source) =>
              Object.freeze({ ...source, toolIds: Object.freeze([...source.toolIds]) }),
            ),
          ),
        }),
      ),
      (id) => new TypeError(`Unknown tool source: ${id}`),
    ),
  });
}
export type * from '../structs/support/associations.js';

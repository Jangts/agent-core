/**
 * Capability catalog support: validate application modules and the tools they contribute.
 *
 * Applications declare modules (id, description, tools) plus optional tool-reference projections;
 * this module checks them once at construction so the resulting catalog can be handed to Core.
 * It is composition only: it creates no Core execution entity and owns no domain lifecycle.
 *
 * Main exports: `defineCapabilityCatalog` and `validateToolReferences`.
 */
import { synchronous } from '../utils/synchronous.js';
import { readonlyCatalog } from '../utils/catalog.js';
import { breakWhile } from '../utils/rules.js';
import type {
  CapabilityModule,
  CapabilityCatalogOptions,
  CapabilityToolReferences,
} from '../structs/support/capabilities.js';

/**
 * Validate tool references against the complete registered set.
 *
 * Checking against every registered tool (not only the ones available in the current request)
 * keeps the declaration honest: a module may reference a tool that this request filters out, but
 * never one that does not exist.
 *
 * @param names All registered tool IDs, including tools unavailable to the current request.
 * @param references Tool-reference declarations to check.
 * @throws {Error} When an owner ID is blank, `requiredToolIds` is not an array, or a referenced
 *   tool ID is not registered.
 */
export function validateToolReferences(
  names: Iterable<string>,
  references: readonly CapabilityToolReferences[],
): void {
  const available = new Set(names);
  for (const reference of references) {
    breakWhile(!reference.id?.trim(), 'Invalid tool reference owner');
    const required = reference.requiredToolIds;
    breakWhile(!Array.isArray(required), 'Tool references require requiredToolIds');
    for (const name of [...required!, ...(reference.optionalToolIds ?? [])]) {
      breakWhile(!available.has(name), `Unregistered tool reference: ${reference.id} -> ${name}`);
    }
  }
}

/**
 * Build a frozen capability catalog from application module declarations.
 *
 * Each module must carry a non-empty description, and every contributed tool ID must be unique
 * across modules. Reference projections run during construction and must be synchronous.
 *
 * @param definitions Capability modules in declaration order; order is preserved in the catalog.
 * @param options Optional projections that expose tool references for validation.
 * @returns A frozen catalog with `definitions`, `require`, `tools` and `findToolOwner`.
 * @throws {TypeError} When the catalog lookup receives an unknown module ID.
 * @throws {Error} When a module description, tool ID, reference projection or referenced tool is
 *   invalid.
 */
export function defineCapabilityCatalog<Module extends CapabilityModule>(
  definitions: readonly Module[],
  options: CapabilityCatalogOptions<Module> = {},
) {
  const catalog = readonlyCatalog<Module>(
    definitions,
    (id) => new TypeError(`Unknown capability module: ${id}`),
  );
  const modules = catalog.definitions;
  const owners = new Map<string, Readonly<Module>>();
  const tools: Module['tools'][number][] = [];
  for (const module of modules) {
    breakWhile(!module.description?.trim(), 'Invalid capability module description');
    for (const tool of module.tools as Module['tools']) {
      const { id } = tool;
      breakWhile(!id?.trim() || owners.has(id!), `Invalid or duplicate capability tool: ${id}`);
      owners.set(id!, module);
      tools.push(tool);
    }
  }
  validateToolReferences(
    owners.keys(),
    modules.flatMap((module) =>
      options.toolReferences
        ? synchronous(
            options.toolReferences(module),
            'Capability reference projections must be synchronous',
          )
        : [],
    ),
  );
  return Object.freeze({
    ...catalog,
    tools: Object.freeze(tools),
    findToolOwner(toolId: string): Readonly<Module> | undefined {
      return owners.get(toolId);
    },
  });
}

export type * from '../structs/support/capabilities.js';

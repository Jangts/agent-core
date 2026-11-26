/**
 * One process-realm definition registry per kind. The shared symbol makes ESM/CJS copies
 * consume the same stores; consumers receive frozen read-only views, never pool factories.
 */
import { ProtocolRegistry } from '../../utils/protocol-registry.js';
import type { WorkflowNode } from '../../structs/execution/workflow.js';
import type { ToolDefinition } from '../../structs/capabilities/tools.js';
import type { ModelTool } from '../../structs/capabilities/model.js';
import type { ContextFragmentConfig } from '../../structs/support/context.js';
import type { AgentCoreEngine } from '../../execution/engine.js';
import type { ModelRunner } from '../../model/runner.js';

/** Registration identity; ids are unique within one kind and namespace. */
export interface IdentifiedDefinition {
  readonly id: string;
}
/** Read-only roots. A typed read describes the expected contract, not a static id/type lookup. */
export interface DefinitionReader<Definition extends object> {
  get<Value extends Definition = Definition>(
    id: string,
    ns?: string,
  ): (Value & IdentifiedDefinition) | undefined;
  getAll<Value extends Definition = Definition>(
    ns?: string,
  ): readonly (Value & IdentifiedDefinition)[];
  pick<Value extends Definition = Definition>(
    ids: readonly string[],
    ns?: string,
  ): readonly (Value & IdentifiedDefinition)[];
}
/** Enumerable categories drive allocation and lookup; no additional runtime dispatch layer. */
export const definitionKinds = ['node', 'tool', 'fragment', 'agent', 'model'] as const;
export type DefinitionKind = (typeof definitionKinds)[number];
type NamespaceStore = Map<string, ProtocolRegistry<IdentifiedDefinition>>;
type SharedPools = {
  readonly version: 3;
  readonly stores: Record<DefinitionKind, NamespaceStore>;
};
const sharedKey = Symbol.for('@jangts/agent-core/decorator-roots/v3');
const realm = globalThis as unknown as Record<symbol, SharedPools | undefined>;

/** Allocate once per realm, including when another module format initialized the roots first. */
function sharedPools(): SharedPools {
  const existing = realm[sharedKey];
  if (existing) {
    if (existing.version !== 3 || definitionKinds.some((kind) => !existing.stores[kind]))
      throw new TypeError('Incompatible decorator root registry');
    return existing;
  }
  const stores = Object.fromEntries(
    definitionKinds.map((kind) => [kind, new Map()]),
  ) as SharedPools['stores'];
  const pools: SharedPools = Object.freeze({ version: 3, stores: Object.freeze(stores) });
  Object.defineProperty(globalThis, sharedKey, { value: pools });
  return pools;
}

/** Namespace is an exact, nonblank key; no trimming, fallback or hierarchy is applied. */
function namespace(value: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new TypeError('Decorator namespace must be a nonempty string');
  return value;
}

/** Preflight every destination so a conflict never leaves partial multi-namespace registration. */
export function registerDefinition(
  kind: DefinitionKind,
  definition: IdentifiedDefinition,
  ns: string | readonly string[] = 'default',
): void {
  registerDefinitions(kind, [definition], ns);
}

/** Validate the whole group and every namespace before publishing any definition. */
export function registerDefinitions(
  kind: DefinitionKind,
  definitions: readonly IdentifiedDefinition[],
  ns: string | readonly string[] = 'default',
): void {
  const ids = new Set<string>();
  for (const definition of definitions) {
    if (typeof definition.id !== 'string' || !definition.id.trim())
      throw new TypeError('Invalid decorator definition id');
    if (ids.has(definition.id)) throw new Error(`Duplicate ${kind} definition: ${definition.id}`);
    ids.add(definition.id);
  }
  const requested = typeof ns === 'string' ? [ns] : ns;
  if (!Array.isArray(requested) || !requested.length)
    throw new TypeError('Decorator ns must be a namespace or a nonempty namespace array');
  const names = [...new Set(requested.map(namespace))];
  const store = sharedPools().stores[kind];
  for (const name of names)
    for (const definition of definitions) {
      if (store.get(name)?.has(definition.id))
        throw new Error(`Duplicate ${kind} definition: ${definition.id} (ns: ${name})`);
    }
  for (const name of names) {
    let entries = store.get(name);
    if (!entries) store.set(name, (entries = new ProtocolRegistry()));
    for (const definition of definitions) entries.set(definition.id, definition);
  }
}

/** Root reads never instantiate or execute definitions; array results are immutable snapshots. */
function reader<Definition extends object>(kind: DefinitionKind): DefinitionReader<Definition> {
  const store = sharedPools().stores[kind];
  return Object.freeze({
    get<Value extends Definition = Definition>(
      id: string,
      ns = 'default',
    ): (Value & IdentifiedDefinition) | undefined {
      return store.get(namespace(ns))?.get(id) as (Value & IdentifiedDefinition) | undefined;
    },
    getAll<Value extends Definition = Definition>(
      ns = 'default',
    ): readonly (Value & IdentifiedDefinition)[] {
      return Object.freeze([...(store.get(namespace(ns))?.values() ?? [])]) as readonly (Value &
        IdentifiedDefinition)[];
    },
    pick<Value extends Definition = Definition>(
      ids: readonly string[],
      ns = 'default',
    ): readonly (Value & IdentifiedDefinition)[] {
      const entries = store.get(namespace(ns));
      const selected = new ProtocolRegistry<IdentifiedDefinition>();
      for (const id of ids) {
        const definition = entries?.get(id);
        if (!definition) throw new TypeError(`Unknown ${kind} definition: ${id} (ns: ${ns})`);
        selected.set(id, definition);
      }
      return Object.freeze([...selected.values()]) as readonly (Value & IdentifiedDefinition)[];
    },
  });
}

/** Decorated nodes; ids are unique within each namespace. */
export const nodePool = reader<WorkflowNode<any, any, any>>('node');
/** Decorated tools; namespaces isolate otherwise identical ids. */
export const toolPool = reader<ToolDefinition<any, any, any> | ModelTool<any, any>>('tool');
/** Decorated fragment configurations; use the original builder to assemble them. */
export const fragmentPool = reader<ContextFragmentConfig<any>>('fragment');
/** Runtime instances retain their subclass methods, budgets and original lifetime. */
export const agentPool = reader<AgentCoreEngine<any, any, any>>('agent');
/** Reads return the registered Runner itself; they never reconstruct or reset it. */
export const modelPool = reader<ModelRunner<any>>('model');

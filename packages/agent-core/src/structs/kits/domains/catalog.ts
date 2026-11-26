/**
 * Agent catalog contract for the Domain Tools Kit.
 *
 * Place in the package: an optional App-side projection that describes which intents, scopes and
 * tools are available to one request. The ports read the App's real registries, so no parallel
 * capability list exists; this module only declares what the catalog needs from them.
 *
 * Exports: `CatalogDomainTool`, `CatalogScope`, `CatalogTask`, `CatalogExecutionTool`, `DescribedTool`,
 * `AgentCatalogPorts`.
 */
/** Goal as the catalog sees it: an id plus its declared delegates. */
export interface CatalogDomainTool<Id extends string = string> {
  readonly id: Id;
  readonly delegates: readonly string[];
}
/** Scope as the catalog sees it: an id plus the tools it may use. */
export interface CatalogScope {
  readonly id: string;
  readonly toolIds: readonly string[];
}
/** The goal currently accepted for the request, used to narrow the catalog. */
export interface CatalogTask<Id extends string = string> {
  readonly goalId?: Id;
  readonly domainToolId?: Id;
  /** Selected scope; `null` or `undefined` means a scope has not been chosen yet. */
  readonly scopeId?: string | null;
}
/** Tool facts the catalog needs, independent of lifecycle details. */
export interface CatalogExecutionTool<App> {
  readonly id: string;
  /** Intent ids the tool serves, or `'all'` when it is always available. */
  readonly goalIds?: 'all' | readonly string[];
  readonly domainToolIds?: 'all' | readonly string[];
  /** Returns whether the tool may run for this App state; absent means always available. */
  readonly active?: import('../../capabilities/model.js').ToolCondition<App>;
  /** Invocation identity, when the tool participates in the lifecycle. */
  readonly lifecycle?: { readonly call?: (...args: any[]) => unknown };
}
/** Model- or host-facing description of one tool. */
export interface DescribedTool {
  readonly id: string;
  readonly kind: string;
  readonly description: string;
  readonly audience: string;
  readonly effect: string;
  readonly goalIds: readonly string[];
}
/** Ports the catalog reads from the App's registries. */
export interface LegacyAgentCatalogPorts<
  App,
  Id extends string,
  Intent extends CatalogDomainTool<Id>,
  Scope extends CatalogScope,
> {
  /** All registered Tool ids, before availability filtering. */
  goalIds(app: App): readonly Id[];
  /** Registered domain Tools, optionally narrowed to `ids`. */
  goals(ids?: readonly Id[]): readonly Intent[];
  /** Registered scopes for the given Tool ids (all scopes when omitted). */
  scopes(ids?: readonly Id[]): readonly Scope[];
  /** When not `false`, the catalog is narrowed to `currentTask`; defaults to restriction on. */
  readonly restrictToTask?: boolean;
  /** Task accepted for this request, if any. */
  currentTask(app: App): CatalogTask<Id> | undefined;
  readonly tools: {
    values(): Iterable<CatalogExecutionTool<App>>;
    /** Installed tool and terminal-output protocols; absent preserves the declared policy view. */
    protocols?(): Iterable<readonly [string, { readonly terminal?: boolean }]>;
    has(id: string): boolean;
    supportsGoal(id: Id, app: App): boolean;
    /** Describes tools for an audience (for example `'model'`); must be synchronous. */
    describe(audience?: string, app?: App): readonly DescribedTool[];
  };
}

/** @deprecated Use the DomainTool names; compatibility exports remain for 1.x. */
export type { CatalogDomainTool as CatalogGoal, CatalogExecutionTool as CatalogTool };

/** Canonical domain/execution catalog ports with a precise 0.9 compatibility alternative. */
export type AgentCatalogPorts<
  App,
  Id extends string,
  Domain extends CatalogDomainTool<Id>,
  Scope extends CatalogScope,
> =
  | LegacyAgentCatalogPorts<App, Id, Domain, Scope>
  | (Omit<LegacyAgentCatalogPorts<App, Id, Domain, Scope>, 'goalIds' | 'goals' | 'tools'> & {
      domainToolIds(app: App): readonly Id[];
      domainTools(ids?: readonly Id[]): readonly Domain[];
      readonly executionTools: Omit<
        LegacyAgentCatalogPorts<App, Id, Domain, Scope>['tools'],
        'supportsGoal'
      > & { supportsDomainTool(id: Id, app: App): boolean };
    });

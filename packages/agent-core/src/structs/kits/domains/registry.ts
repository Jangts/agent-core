/**
 * Domain Tool registry contract for the Domain Tools Kit.
 *
 * Place in the package: an optional App-side catalog of domain Tools. An intent names its allowed
 * delegates and optional App-declared policies; the registry checks identity, allowed vocabulary,
 * duplicate ids and sealing, while the meaning of each vocabulary value stays with the App.
 *
 * Exports: `DomainTool`, `DomainToolPolicy`, `DomainToolDescription`, `DomainToolId`,
 * `RegisteredDomainTool`.
 */
import type { BreakReason } from '../../utils/rules.js';
import type { RegistrationProjection } from '../../../utils/registration.js';
import type { ModelTool } from '../../capabilities/model.js';

/** One domain Tool. */
export interface DomainTool extends ModelTool<any, any> {
  /** Unique Tool id, matched against the policy's `idPattern` when configured. */
  id: string;
  /** Non-blank model-facing description. */
  description: string;
  /** Allowed delegate ids, retained in declaration order without imposing execution order; non-empty and unique. */
  delegates?: readonly string[];
  /** App-declared scope-mode name; validated against `policy.scopeModes` when that is set. */
  scopeMode?: string;
  /** @deprecated Use scopeMode. */
  scopePolicy?: string;
  /** App-declared target-mode name; validated against `policy.targetModes` when that is set. */
  targetMode?: string;
  /** @deprecated Use targetMode. */
  targetPolicy?: string;
  /** App-declared context tier; validated against `policy.contextTiers` when that is set. */
  contextTier?: string;
  /** App-declared planning action; validated against `policy.actions` when that is set. */
  planningAction?: string;
  /** @deprecated Use planningAction. */
  planIntent?: string;
  /** Additional actions the intent may use; must be unique. */
  auxiliaryActions?: readonly string[];
  /** App-declared handoff marker; validated against `policy.handoffValues` when that is set. */
  preparedHandoff?: unknown;
}

/** Configuration form; object arguments and a Tool proposal are the registration defaults. */
export type DomainToolRegistration = Omit<DomainTool, 'inputSchema' | 'resolve'> &
  Partial<Pick<DomainTool, 'inputSchema' | 'resolve'>>;

/** Registration rules for one intent registry. */
export interface DomainToolPolicy<Definition extends DomainToolRegistration> {
  /** Pattern every Tool id must match. */
  readonly idPattern?: RegExp;
  /** Allowed `scopePolicy` values; `undefined` accepts any value. */
  readonly scopeModes?: readonly string[];
  /** Allowed `targetPolicy` values; `undefined` accepts any value. */
  readonly targetModes?: readonly string[];
  /** Allowed `contextTier` values; `undefined` accepts any value. */
  readonly contextTiers?: readonly string[];
  /** Allowed `planIntent` values; `undefined` accepts any value. */
  readonly actions?: readonly string[];
  /** Allowed delegate ids; `undefined` accepts any non-empty delegate. */
  readonly delegates?: readonly string[];
  /** Allowed `preparedHandoff` values; `undefined` accepts any value. */
  readonly handoffValues?: readonly unknown[];
  /** Extra App assertion, called after the built-in checks; must return void synchronously. */
  readonly assertDefinition?: (definition: Definition) => void;
  /** Diagnostic tags attached to registration rejections. */
  readonly tags?: readonly string[];
  readonly errors?: {
    readonly sealed?: BreakReason;
    readonly invalid?: BreakReason;
    /** Builds the duplicate-id rejection; receives the Tool id. */
    readonly duplicate?: (goal: string) => Error | string;
  };
}

/** Registered domain Tool with its delegates widened to the definition's delegate literals. */
export type DomainToolDescription<Definition extends DomainToolRegistration> = Omit<
  RegisteredDomainTool<Definition>,
  'delegates'
> & { delegates: NonNullable<Definition['delegates']>[number][] };

/** Union of the ids of a definition set, or `string` when it cannot be narrowed. */
export type DomainToolId<Definition> = Definition extends { id: infer Id extends string }
  ? Id
  : string;
type RegisteredGoalLists<Definition extends DomainToolRegistration> = {
  readonly [
    Key in keyof Pick<Definition, Extract<keyof Definition, 'delegates' | 'auxiliaryActions'>>
  ]: Readonly<Definition[Key]>;
};
/** Frozen registration view: list fields are frozen copies, helper methods are dropped. */
export type RegisteredDomainTool<Definition extends DomainToolRegistration> = Readonly<
  Omit<
    RegistrationProjection<Definition, DomainTool>,
    'delegates' | 'auxiliaryActions' | 'inputSchema' | 'resolve'
  > &
    ModelTool<any, any> &
    RegisteredGoalLists<Definition> & {
      id: Definition['id'];
      delegates: Readonly<NonNullable<Definition['delegates']>>;
    }
>;

/** @deprecated Use the DomainTool names; compatibility exports remain for 1.x. */
export type {
  DomainToolRegistration as GoalToolRegistration,
  DomainToolDescription as GoalDescription,
  DomainToolPolicy as GoalPolicy,
  RegisteredDomainTool as RegisteredGoal,
  DomainToolId as GoalId,
  DomainTool as GoalTool,
};

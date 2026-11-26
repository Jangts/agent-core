/**
 * Context builder contract.
 *
 * Place in the package: Support-side assembly helpers. A builder turns App fragment declarations
 * into a `ContextPlan` or an assembled `BuiltContext`; ordering and metadata are compiled once,
 * while values are produced per request. Apps choose reduction and selection policy; Support
 * nodes execute that policy. Core owns assembly guarantees and model execution.
 *
 * Exports: `ContextProjection`, `ContextBuilderOptions`, `ContextAssemblyOptions`,
 * `ContextFragmentConfig`, `ContextBuilder`.
 */
import type { ContextPlan } from '../context/processing.js';
import type { ContextFragment, BuiltContext } from '../context/fragments.js';

/** One declared projection: a single fragment or a placement expanded into fragments. */
export type ContextProjection<
  Input,
  Id extends string = string,
  Placement extends string = string,
> =
  | {
      readonly kind: 'fragment';
      /** Fragment id; must be unique across all projections. */
      readonly id: Id;
      /** Produces the fragment value; must be synchronous. */
      readonly format: (input: Input) => ContextFragment['value'];
    }
  /** Expands to the fragments supplied for this placement; ids use a separate prefix. */
  | { readonly kind: 'contributions'; readonly placement: Placement };

/** Shared builder options. */
export interface ContextBuilderOptions<Input> {
  /** Character budget, constant or derived from the request; at least one of these is required. */
  readonly maxInputChars?: number | ((input: Input) => number);
  /** Applied to every produced fragment before assembly; must be synchronous. */
  readonly transform?: (fragment: ContextFragment, input: Input) => ContextFragment;
}

/** Assembly options for placement-based projections. */
export interface ContextAssemblyOptions<
  Input,
  Id extends string,
  Placement extends string,
> extends ContextBuilderOptions<Input> {
  /** Builds a fragment for a single-fragment projection. */
  readonly fragment: (id: Id, value: ContextFragment['value']) => ContextFragment;
  /** Contribution handlers keyed by placement; each expands to zero or more fragments. */
  readonly contributions?: Readonly<
    Record<Placement, (input: Input) => readonly ContextFragment[]>
  >;
}

/** Self-describing fragment declaration: metadata plus a formatter. */
export interface ContextFragmentConfig<Input> extends Omit<ContextFragment, 'value'> {
  /** Documentation only; not sent to the model. */
  readonly description?: string;
  /** Produces the value; must be synchronous. */
  readonly format: (input: Input) => ContextFragment['value'];
}

/** Compiled builder. It holds no request state and may be shared across invocations. */
export interface ContextBuilder<Input> {
  /** Produces the fragments for one input, after transforms. */
  fragments(input: Input): ContextFragment[];
  /** Assembles and validates the plan into messages with usage accounting. */
  build(
    request: { input: Input; maxInputChars?: number } & Omit<
      ContextPlan,
      'fragments' | 'maxInputChars'
    >,
  ): BuiltContext;
  /** Produces the unassembled plan without running the budget boundary. */
  plan(
    request: { input: Input; maxInputChars?: number } & Omit<
      ContextPlan,
      'fragments' | 'maxInputChars'
    >,
  ): ContextPlan;
}

/**
 * Context builders: compile application fragment declarations into a Core `ContextBuilder`.
 *
 * Ordering and metadata are compiled once; fragment values and formatting are produced per
 * request, so a builder may be shared across invocations. The builder only assembles a plan or
 * built context. Apps choose reduction and selection policy; Support nodes execute it, and Core
 * owns assembly guarantees and model execution.
 *
 * Main exports: `defineContextAssembly`, `defineContextFragments` and `transformContextText`.
 */
import { synchronous } from '../../utils/synchronous.js';
import type { ContextFragment } from '../../structs/context/fragments.js';
import type {
  ContextBuilder,
  ContextBuilderOptions,
  ContextFragmentConfig,
  ContextAssemblyOptions,
  ContextProjection,
} from '../../structs/support/context.js';
import { breakWhile } from '../../utils/rules.js';
import { assembleContextPlan } from '../../context/plan.js';
import { validateContextBudget } from '../../context/fragments.js';

/**
 * Compile ordered context projections into a builder.
 *
 * A projection is either a single fragment (with its own formatter) or a placement whose
 * contribution handler expands to any number of fragments at request time.
 *
 * @param definitions Projections in the order they should appear in the plan.
 * @param options Fragment factory, contribution handlers and an optional size budget.
 * @returns A frozen builder exposing `fragments`, `plan` and `build`.
 * @throws {Error} When a projection ID repeats, a formatter is missing, a placement has no
 *   contribution handler, or a callback is asynchronous.
 */
export function defineContextAssembly<
  Input,
  Id extends string = string,
  Placement extends string = string,
>(
  definitions: readonly ContextProjection<Input, Id, Placement>[],
  options: ContextAssemblyOptions<Input, Id, Placement>,
): ContextBuilder<Input> {
  const fragment = options.fragment.bind(options);
  const ids = new Set<string>();
  const factories = definitions.map((definition) => {
    // Contribution placements live in the same ID namespace, prefixed so they cannot collide with
    // a real fragment ID.
    const id =
      definition.kind === 'fragment' ? definition.id : `contributions:${definition.placement}`;
    breakWhile(ids.has(id), `Duplicate context projection: ${id}`);
    ids.add(id);
    if (definition.kind === 'fragment') {
      const id = definition.id;
      breakWhile(typeof definition.format !== 'function', `Missing context formatter: ${id}`);
      const format = definition.format.bind(definition);
      return (input: Input) => [
        synchronous(
          fragment(id, synchronous(format(input), 'Context formatters must be synchronous')),
          'Context fragment factories must be synchronous',
        ),
      ];
    }
    const create = options.contributions?.[definition.placement];
    breakWhile(
      typeof create !== 'function',
      `Unknown context contribution: ${definition.placement}`,
    );
    const expand = create!.bind(options.contributions);
    return (input: Input) =>
      synchronous(expand(input), 'Context contributions must be synchronous');
  });
  return contextBuilder(factories, options);
}

/**
 * Compile self-describing fragment declarations into a builder.
 *
 * Each definition carries its own trust, lifetime and size metadata, so no separate metadata
 * catalog is needed. The budget may be a constant or a function of the request input.
 *
 * @param definitions Fragment configurations in plan order.
 * @param options Optional transform, budget selector and related builder settings.
 * @returns A frozen builder exposing `fragments`, `plan` and `build`.
 * @throws {Error} When a fragment ID repeats or a formatter is missing or asynchronous.
 * @throws {TypeError} When `plan`/`build` is called with no configured or overridden budget.
 */
export function defineContextFragments<Input>(
  definitions: readonly ContextFragmentConfig<Input>[],
  options: ContextBuilderOptions<Input> = {},
): ContextBuilder<Input> {
  const ids = new Set<string>();
  const factories = definitions.map((definition) => {
    const metadata = {
      id: definition.id,
      sourceId: definition.sourceId,
      trust: definition.trust,
      lifetime: definition.lifetime,
      maxChars: definition.maxChars,
      role: definition.role,
    };
    breakWhile(
      typeof definition.format !== 'function',
      `Missing context formatter: ${metadata.id}`,
    );
    const format = definition.format.bind(definition);
    breakWhile(ids.has(metadata.id), `Duplicate context fragment: ${metadata.id}`);
    ids.add(metadata.id);
    return (input: Input): ContextFragment[] => [
      { ...metadata, value: synchronous(format(input), 'Context formatters must be synchronous') },
    ];
  });
  return contextBuilder(factories, options);
}

function contextBuilder<Input>(
  factories: readonly ((input: Input) => readonly ContextFragment[])[],
  options: ContextBuilderOptions<Input>,
): ContextBuilder<Input> {
  const transform = options.transform?.bind(options);
  const configuredLimit =
    typeof options.maxInputChars === 'function'
      ? options.maxInputChars.bind(options)
      : options.maxInputChars;
  const fragments = (input: Input) =>
    factories.flatMap((create) =>
      create(input).map((value) =>
        transform
          ? synchronous(transform(value, input), 'Context transforms must be synchronous')
          : value,
      ),
    );
  function limit(input: Input, override?: number): number {
    const value =
      override ??
      (typeof configuredLimit === 'function'
        ? synchronous(configuredLimit(input), 'Context budget selectors must be synchronous')
        : configuredLimit);
    if (value === undefined)
      throw new TypeError('Configure a context budget or pass maxInputChars');
    validateContextBudget(0, value);
    return value;
  }
  return Object.freeze({
    fragments,
    plan({
      input,
      maxInputChars,
      originalFragments,
      additionalMessages,
      mutableFragmentIds,
    }: Parameters<ContextBuilder<Input>['plan']>[0]) {
      const budget = limit(input, maxInputChars);
      return {
        fragments: fragments(input),
        maxInputChars: budget,
        originalFragments,
        additionalMessages,
        mutableFragmentIds,
      };
    },
    build({
      input,
      maxInputChars,
      originalFragments,
      additionalMessages,
      mutableFragmentIds,
    }: Parameters<ContextBuilder<Input>['build']>[0]) {
      const budget = limit(input, maxInputChars);
      return assembleContextPlan({
        fragments: fragments(input),
        maxInputChars: budget,
        originalFragments,
        additionalMessages,
        mutableFragmentIds,
      });
    },
  });
}

/**
 * Apply a text transform to a fragment value, including strings nested inside objects.
 *
 * Structured values are walked through a JSON round trip, which is what the budget measurement
 * serializes later; values that JSON cannot represent are therefore not preserved.
 *
 * @param fragment Fragment whose value should be transformed.
 * @param transform Pure text mapping applied to every string in the value.
 * @returns A new fragment with unchanged metadata and the transformed value.
 */
export function transformContextText(
  fragment: ContextFragment,
  transform: (text: string) => string,
): ContextFragment {
  const value =
    typeof fragment.value === 'string'
      ? transform(fragment.value)
      : JSON.parse(
          JSON.stringify(fragment.value, (_key, value) =>
            typeof value === 'string' ? transform(value) : value,
          ),
        );
  return { ...fragment, value };
}

export type {
  ContextBuilder,
  ContextBuilderOptions,
  ContextFragmentConfig,
  ContextAssemblyOptions,
  ContextProjection,
} from '../../structs/support/context.js';

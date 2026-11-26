/**
 * Stage-scoped model interaction: expose only the tools declared for each stage.
 *
 * Static capability sources are projected once at construction; dynamic sources are re-projected
 * at the model boundary. Either way, an undeclared stage or capability is rejected rather than
 * silently omitted.
 *
 * Main export: `createStageModelInteraction`.
 */
import { synchronous } from '../../utils/synchronous.js';
import { ModelToolRegistry } from '../../capabilities/model.js';
import { breakWhile } from '../../utils/rules.js';
import { createModelInteraction } from './transports.js';
import type { ModelToolSource } from '../../structs/capabilities/model.js';
import type { ModelStageInteractionRegistration } from '../../structs/support/model/interactions.js';

/**
 * Build an interaction that projects a capability source through declared stage references.
 *
 * @param registration Transport declaration: unique ID, stage-to-capability references, interaction
 *   adapter, options and a static or per-stage capability source.
 * @returns A Core model interaction with `tools(stage)`.
 * @throws {Error} When a stage ID repeats, has no capability IDs, the declaration has no stages, a
 *   stage or capability is not registered, or a dynamic capability source is asynchronous.
 */
export function createStageModelInteraction<Result, const Id extends string = string>(
  registration: ModelStageInteractionRegistration<Result> & { readonly id: Id },
) {
  const stages = new Map<string, readonly string[]>();
  for (const stage of registration.stages) {
    const ids = stage.toolIds;
    breakWhile(
      !stage.id?.trim() ||
        stages.has(stage.id) ||
        !Array.isArray(ids) ||
        !ids.length ||
        new Set(ids).size !== ids.length,
      `Invalid model stage: ${stage.id}`,
    );
    stages.set(stage.id, Object.freeze([...ids]));
  }
  breakWhile(!stages.size, 'Model interaction requires declared stages');
  const { id, adapter, options, requireStrictArguments, tools: source } = registration;
  const project = (stage: string, tools: ModelToolSource<Result>): ModelToolSource<Result> => {
    const ids = stages.get(stage);
    breakWhile(!ids, `Unregistered model stage: ${id} -> ${stage}`);
    const catalog = new ModelToolRegistry(tools.values());
    for (const id of ids!)
      breakWhile(!catalog.has(id), `Unregistered model capability: ${stage} -> ${id}`);
    const selected = catalog.select(ids!);
    const resolve = tools.resolve.bind(tools);
    return Object.freeze({
      values: () => selected.values() as ReturnType<ModelToolSource<Result>['values']>,
      resolve(
        selection: Parameters<ModelToolSource<Result>['resolve']>[0],
        context: Readonly<{ stageId: string }>,
      ) {
        // createModelInteraction pins this stage and rejects selections outside
        // the prepared capability IDs before delegating to this resolver.
        return resolve(selection, { stageId: context.stageId });
      },
    });
  };
  const fixed =
    typeof source === 'function'
      ? undefined
      : new Map([...stages.keys()].map((stage) => [stage, project(stage, source)]));
  return createModelInteraction({
    id,
    adapter,
    options,
    requireStrictArguments,
    tools(stage) {
      breakWhile(!stages.has(stage), `Unregistered model stage: ${id} -> ${stage}`);
      return fixed
        ? fixed.get(stage)!
        : project(
            stage,
            synchronous(
              (source as (stage: string) => ModelToolSource<Result>).call(registration, stage),
              'Model capability sources must be synchronous',
            ),
          );
    },
  });
}

/** @deprecated Use `createStageModelInteraction`. Retained for the 0.9 migration. */
export { createStageModelInteraction as createStageModelTransport };

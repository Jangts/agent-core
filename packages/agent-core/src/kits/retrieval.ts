/**
 * Retrieval Kit: a synchronous, budgeted query lifecycle with duplicate protection.
 *
 * Place in the package: an optional App-side library for one query round-trip. Data access,
 * authorization, state and result semantics are host ports; this module owns the fixed order
 * — state, preparation, assertions, duplicate/budget checks, authorization, adapter call,
 * result validation, source naming and declared effects.
 *
 * Exports: `defineRetrieval`, `retrievalQueryKey`, `Retrieval`, and the retrieval port types.
 */
import { nativeReportedStepSync } from '../diagnostics/native-sub-flow.js';
import { assertion, synchronous } from '../utils/synchronous.js';
import type {
  RetrievalDefinition,
  RetrievalPorts,
  RetrievalRunner,
  RetrievalReason,
  RetrievalReceipt,
  RetrievalResult,
  RetrievalSource,
} from '../structs/kits/retrieval.js';
import { retrievalQueryKey } from '../utils/query-key.js';
import { breakWhile } from '../utils/rules.js';

/**
 * Compile a retrieval runner from its declared ports and effects.
 *
 * Rejected queries stay in the caller's `seen` set, so a retry is reported as a duplicate
 * instead of silently repeating the adapter call; only successful results increment the
 * query count.
 *
 * @param definition - Identity, ports (`prepare`, `assertInput`, `state`, `limit`,
 *   `authorize`, `execute`, `assertResult`), optional key/source-id/clock overrides and
 *   ordered effects.
 * @returns A frozen runner exposing `id`, `description`, `effects` and `run(query, context)`.
 * @throws A configured error for blank/duplicate ids or a missing port; `TypeError` for
 *   non-synchronous ports, non-negative-integer counts, duplicate queries and exhausted
 *   budget (unless the App supplied its own error wording).
 */
export function defineRetrieval<
  Query,
  Source extends RetrievalSource,
  Result extends RetrievalResult<Source>,
  App,
>(
  definition: RetrievalDefinition<Query, Source, Result, App>,
): RetrievalRunner<Query, Source, Result, import('../structs/common.js').OperationContext<App>> {
  type Context = import('../structs/common.js').OperationContext<App>;
  const { id, description } = definition;
  const prepare = definition.prepare?.bind(definition),
    validate = definition.assertInput.bind(definition);
  const getState = definition.state.bind(definition),
    limit = definition.limit.bind(definition),
    authorize = definition.authorize?.bind(definition),
    execute = definition.execute.bind(definition);
  const validateResult = definition.assertResult?.bind(definition);
  const keyFor = definition.key?.bind(definition) ?? retrievalQueryKey;
  const bindId =
    definition.sourceId?.bind(definition) ??
    ((source: Source, _query: Query, sequence: number) => `${id}:q${sequence}:${source.sourceId}`);
  const now = definition.now?.bind(definition) ?? (() => Date.now());
  const tags = Object.freeze([...(definition.tags ?? [])]);
  const errorPorts = definition.errors;
  const duplicateError =
    typeof errorPorts?.duplicate === 'function'
      ? errorPorts.duplicate.bind(errorPorts)
      : (errorPorts?.duplicate ?? 'Query was already attempted');
  const budgetError =
    typeof errorPorts?.budget === 'function'
      ? errorPorts.budget.bind(errorPorts)
      : (errorPorts?.budget ?? 'Retrieval budget exhausted');
  breakWhile(
    [
      {
        occur: () => !id.trim() || !description.trim(),
        error: 'Invalid retrieval declaration',
        tags: ['metadata'],
      },
      {
        occur: () =>
          ![validate, getState, limit, execute].every((handler) => typeof handler === 'function'),
        error: 'Missing retrieval port',
        tags: ['ports'],
      },
    ],
    ['agent-core', 'retrieval-registration'],
  );
  const effectIds = new Set<string>();
  const effects = Object.freeze(
    (definition.effects ?? []).map((effect) => {
      breakWhile(
        [
          {
            occur: () => effectIds.has(effect.id),
            error: () => `Duplicate retrieval effect: ${effect.id}`,
            tags: ['id'],
          },
          {
            occur: () => !effect.id.trim() || typeof effect.handle !== 'function',
            error: 'Invalid retrieval effect',
            tags: ['handler'],
          },
        ],
        ['agent-core', 'retrieval-registration'],
      );
      effectIds.add(effect.id);
      return Object.freeze({
        id: effect.id,
        description: effect.description,
        handle: effect.handle.bind(effect),
      });
    }),
  );

  /**
   * Run one retrieval attempt.
   *
   * @param input - Raw query; `prepare` may rewrite it before validation and keying.
   * @param context - Host context passed to every port.
   * @returns A receipt with the prepared query, key, sequence, raw result and named result.
   * @throws A configured duplicate/budget reason, or `TypeError` for a non-synchronous port or
   *   invalid counts; aborts with the caller's signal.
   */
  function run(input: Query, context: Context): RetrievalReceipt<Query, Source, Result> {
    context.signal.throwIfAborted();
    const state = synchronous(getState(context), 'Retrieval state must be synchronous');
    const query = prepare
      ? synchronous(prepare(input, context), 'Retrieval preparation must be synchronous')
      : input;
    assertion(
      validate(query, context),
      'Retrieval input assertions must return void synchronously',
    );
    const key = synchronous(keyFor(query), 'Retrieval keys must be synchronous');
    breakWhile(
      [
        {
          occur: () => state.seen.has(key),
          error: reason(duplicateError, query, context),
          tags: ['duplicate'],
        },
        {
          occur: () => {
            const maximum = synchronous(limit(context), 'Retrieval limits must be synchronous');
            if (
              !Number.isSafeInteger(maximum) ||
              maximum < 0 ||
              !Number.isSafeInteger(state.queryCount) ||
              state.queryCount < 0
            )
              throw new TypeError('Retrieval counts and limits must be nonnegative safe integers');
            return state.queryCount >= maximum;
          },
          error: reason(budgetError, query, context),
          tags: ['budget'],
        },
      ],
      tags,
    );
    context.signal.throwIfAborted();
    assertion(
      authorize?.(query, context),
      'Retrieval authorization must return void synchronously',
    );
    context.signal.throwIfAborted();
    // Reserve before calling the adapter. Failed attempts remain seen; success counts only
    // after validation.
    state.seen.add(key);
    const startedAtMs = now();
    const rawResult = synchronous(
      execute(query, context),
      'Retrieval adapters must be synchronous',
    );
    context.signal.throwIfAborted();
    assertion(
      validateResult?.(rawResult, query, context),
      'Retrieval result assertions must return void synchronously',
    );
    context.signal.throwIfAborted();
    const sequence = state.queryCount + 1;
    const result = {
      ...rawResult,
      sources: rawResult.sources.map((source) => ({
        ...source,
        sourceId: synchronous(
          bindId(source, query, sequence, context),
          'Retrieval source identifiers must be synchronous',
        ),
      })),
    };
    context.signal.throwIfAborted();
    state.queryCount++;
    state.sources.push(...result.sources);
    const receipt = { query, key, sequence, startedAtMs, rawResult, result, extensions: {} };
    // Effects retain declared order. Failure stops subsequent effects without inventing rollback.
    for (const effect of effects) {
      context.signal.throwIfAborted();
      synchronous(effect.handle(receipt, context), 'Retrieval effects must be synchronous');
      context.signal.throwIfAborted();
    }
    return receipt;
  }
  return Object.freeze({
    id,
    description,
    effects,
    run: (input: Query, context: Context) =>
      nativeReportedStepSync(context, 'retrieval', id, () => run(input, context)),
  });
}

function reason<Query, Context>(
  value: RetrievalReason<Query, Context>,
  query: Query,
  context: Context,
) {
  return () => (typeof value === 'function' ? value(query, context) : value);
}

export type {
  RetrievalDefinition,
  RetrievalRunner,
  RetrievalPorts,
  RetrievalEffect,
  RetrievalReason,
  RetrievalReceipt,
  RetrievalResult,
  RetrievalSource,
  RetrievalState,
} from '../structs/kits/retrieval.js';

/** Default structural query key: property order is normalized, array order is preserved. */
export { retrievalQueryKey } from '../utils/query-key.js';

/** Namespace object for callers that prefer one import over named helpers. */
export const Retrieval = Object.freeze({ defineRetrieval, retrievalQueryKey });

/**
 * Answering Kit: the bounded generate → check → review → repair → deliver workflow.
 *
 * Place in the package: part of the `answering` Kit and the only module that composes the
 * other answering pieces. Generation, checking, review, fallback and budget checks are App
 * handlers; this module owns the stage graph, cell state, repair budget and result statuses.
 *
 * Exports: `defineAnswerFlow`, and the answer flow/item/result/check types.
 */
import { nativeReportedStepAsync } from '../../diagnostics/native-sub-flow.js';
import { booleanResult, synchronous } from '../../utils/synchronous.js';
import { awaitWithSignal } from '../../utils/cancellation.js';
import type { OperationContext } from '../../structs/common.js';
import { AgentCoreEngine } from '../../execution/engine.js';
import { defineWorkflow, AttemptBudget } from '../../execution/workflow.js';
import type {
  AnswerFlowDefinition,
  AnswerCheck,
  AnswerItem,
  AnswerIssue,
  AnswerResult,
} from '../../structs/kits/answering/flow.js';
import { validateAnswerBatch } from './batch.js';
import { snapshotAnswerCheck } from './check-result.js';
import { observeSafely } from '../../utils/observer.js';
import type {
  AnswerCell as Cell,
  AnswerFlowState as State,
} from '../../structs/kits/answering/state.js';

const unavailable = <Value>(): AnswerCheck<Value> => ({ status: 'unavailable', issues: [] });

/**
 * Compile a reusable answer workflow.
 *
 * Reusable answer workflow. Requests own cells and repair budgets; models remain caller-owned.
 * The flow runs at most `maxRepairs + 1` rounds: one generation pass, then one repair round per
 * failing item set, and finally an explicit accepted/fallback/blocked result per item.
 *
 * @param definition - Batch limits, review policy, generation/check/review/fallback/canInvoke
 *   handlers and an optional observer; handlers are bound to this object.
 * @returns A frozen flow whose `run({ inputIds, items }, context)` returns one result per item.
 * @throws TypeError At construction for invalid limits or policy, or a missing handler; from
 *   `run` for an invalid batch, non-synchronous handlers, or generated/reviewed values that do
 *   not belong to the requested items.
 */
export function defineAnswerFlow<Data, Value, App = undefined>(
  definition: AnswerFlowDefinition<Data, Value, App>,
) {
  const { maxItems, maxRepairs } = definition,
    reviewPolicy = definition.reviewPolicy ?? 'optional';
  if (
    !Number.isSafeInteger(maxItems) ||
    maxItems < 1 ||
    !Number.isSafeInteger(maxRepairs) ||
    maxRepairs < 0 ||
    !['optional', 'required', 'off'].includes(reviewPolicy)
  )
    throw new TypeError('Invalid answer flow limits or policy');
  for (const handler of [
    definition.generate,
    definition.check,
    definition.fallback,
    definition.canInvoke,
  ]) {
    if (typeof handler !== 'function') throw new TypeError('Missing answer flow handler');
  }
  if (definition.review !== undefined && typeof definition.review !== 'function')
    throw new TypeError('Invalid answer review handler');
  const generateValues = definition.generate.bind(definition),
    checkValue = definition.check.bind(definition),
    reviewValues = definition.review?.bind(definition),
    fallbackValue = definition.fallback.bind(definition),
    canInvoke = definition.canInvoke.bind(definition),
    observer = definition.observe?.bind(definition);
  const allowed = (context: OperationContext<App>) => {
    context.signal.throwIfAborted();
    const value = booleanResult(
      canInvoke(context),
      'Answer budget checks must return boolean synchronously',
    );
    context.signal.throwIfAborted();
    return value;
  };
  const issues = (cell: Cell<Data, Value>): AnswerIssue[] => {
    const result = [
      ...cell.local.issues,
      ...(cell.review.status === 'failed' ? cell.review.issues : []),
    ];
    if (!cell.hasValue || cell.local.status !== 'passed')
      result.push({
        code: !cell.hasValue ? 'ANSWER_MISSING' : 'ANSWER_LOCAL_CHECK',
        message: 'No locally accepted value',
      });
    if ((reviewPolicy === 'required' || cell.knownReviewFailure) && cell.review.status !== 'passed')
      result.push({ code: 'ANSWER_REVIEW_REQUIRED', message: 'Required review is unresolved' });
    return result;
  };
  function observe(
    stageId: string,
    cells: Cell<Data, Value>[],
    context: OperationContext<App>,
  ): void {
    if (!observer) return;
    const results = cells.map((cell) => ({
      item: cell.item,
      value: cell.value,
      status: 'blocked' as const,
      issues: issues(cell),
      checks: { local: cell.local, review: cell.review },
    }));
    observeSafely((input) => observer(input, context), { stageId, results });
  }
  async function generate(
    cells: Cell<Data, Value>[],
    repair: boolean,
    context: OperationContext<App>,
  ): Promise<void> {
    context.signal.throwIfAborted();
    if (!cells.length || !allowed(context)) return;
    const previous = new Map(
      cells.flatMap((cell) =>
        !cell.hasValue ? [] : [[cell.item.id, cell.value as Value] as const],
      ),
    );
    const repairs = repair ? new Map(cells.map((cell) => [cell.item.id, issues(cell)])) : undefined;
    for (const cell of cells) cell.generated = false;
    let values: ReadonlyMap<string, Value>;
    try {
      values = await awaitWithSignal(
        generateValues({ items: cells.map((cell) => cell.item), repairs, previous }, context),
        context.signal,
      );
    } catch {
      context.signal.throwIfAborted();
      observe(repair ? 'repair-unavailable' : 'generation-unavailable', cells, context);
      return;
    }
    context.signal.throwIfAborted();
    if (
      !values ||
      typeof values.get !== 'function' ||
      typeof values.keys !== 'function' ||
      [...values.keys()].some((id) => !cells.some((cell) => cell.item.id === id))
    )
      throw new TypeError('Invalid generated answer ownership');
    for (const cell of cells) {
      cell.hasValue = values.has(cell.item.id);
      cell.value = values.get(cell.item.id);
      cell.generated = cell.hasValue;
      cell.local = { status: 'not-run', issues: [] };
      cell.review = { status: 'not-run', issues: [] };
    }
  }
  function check(cells: Cell<Data, Value>[], context: OperationContext<App>): void {
    for (const cell of cells) {
      context.signal.throwIfAborted();
      if (!cell.hasValue) {
        cell.local = unavailable();
        continue;
      }
      const result = snapshotAnswerCheck(
        synchronous(
          checkValue({ item: cell.item, value: cell.value as Value }, context),
          'Answer checkers must be synchronous',
        ),
      );
      context.signal.throwIfAborted();
      if (Object.hasOwn(result, 'value')) cell.value = result.value;
      cell.local = result;
    }
  }
  async function review(cells: Cell<Data, Value>[], context: OperationContext<App>): Promise<void> {
    context.signal.throwIfAborted();
    const selected = cells.filter((cell) => cell.local.status === 'passed' && cell.hasValue);
    if (!selected.length) return;
    if (reviewPolicy === 'off') {
      for (const cell of selected) cell.review = { status: 'not-run', issues: [] };
      return;
    }
    if (!reviewValues || !allowed(context)) {
      for (const cell of selected) cell.review = unavailable();
      return;
    }
    let checks: ReadonlyMap<string, AnswerCheck<Value>>;
    try {
      checks = await awaitWithSignal(
        reviewValues(
          { items: selected.map((cell) => ({ item: cell.item, value: cell.value! })) },
          context,
        ),
        context.signal,
      );
    } catch {
      context.signal.throwIfAborted();
      for (const cell of selected) cell.review = unavailable();
      return;
    }
    context.signal.throwIfAborted();
    if (
      !checks ||
      typeof checks.get !== 'function' ||
      typeof checks.keys !== 'function' ||
      [...checks.keys()].some((id) => !selected.some((cell) => cell.item.id === id))
    )
      throw new TypeError('Invalid answer review ownership');
    const checked = new Map([...checks].map(([id, result]) => [id, snapshotAnswerCheck(result)]));
    for (const cell of selected) {
      cell.review = checked.get(cell.item.id) ?? unavailable();
      if (cell.review.status === 'failed') cell.knownReviewFailure = true;
      if (cell.review.status === 'passed') cell.knownReviewFailure = false;
    }
  }
  const workflow = defineWorkflow<State<Data, Value>, AnswerResult<Data, Value>[], App>({
    id: 'answer-flow',
    entryNodeId: 'generate',
    nodes: [
      {
        id: 'generate',
        description: 'Generate available items',
        startsRound: true,
        run: async (state, context) => {
          await generate(
            state.cells.filter((cell) => cell.item.sourceStatus === 'ready'),
            false,
            context,
          );
        },
        routes: [{ id: 'to-validate', targetNodeId: 'validate' }],
      },
      {
        id: 'validate',
        description: 'Check values and retain sanitized output',
        run: (state, context) => {
          check(
            state.cells.filter((cell) => cell.item.sourceStatus === 'ready'),
            context,
          );
        },
        routes: [{ id: 'to-review', targetNodeId: 'review' }],
      },
      {
        id: 'review',
        description: 'Review locally accepted values',
        run: async (state, context) => {
          await review(
            state.cells.filter((cell) => cell.item.sourceStatus === 'ready'),
            context,
          );
          observe('checked', state.cells, context);
        },
        routes: [{ id: 'to-select-repair', targetNodeId: 'select-repair' }],
      },
      {
        id: 'select-repair',
        description: 'Select only failed available items',
        run: (state) => ({
          pending: state.cells.filter(
            (cell) => cell.item.sourceStatus === 'ready' && issues(cell).length > 0,
          ),
        }),
        routes: [
          {
            id: 'to-repair',
            conditionId: '{nid}.{rid}',
            when: (state, context) =>
              state.pending.length > 0 && state.repairBudget.available && allowed(context),
            targetNodeId: 'repair',
          },
          { id: 'to-deliver', targetNodeId: 'deliver' },
        ],
      },
      {
        id: 'repair',
        description: 'Use one bounded repair attempt',
        startsRound: true,
        run: async (state, context) => {
          if (!state.repairBudget.take()) throw new TypeError('Answer repair budget exhausted');
          await generate(state.pending, true, context);
        },
        routes: [{ id: 'to-recheck', targetNodeId: 'recheck' }],
      },
      {
        id: 'recheck',
        description: 'Recheck only repaired items',
        run: async (state, context) => {
          const generated = state.pending.filter((cell) => cell.generated);
          check(generated, context);
          await review(generated, context);
          observe('repaired', state.pending, context);
        },
        routes: [{ id: 'to-select-repair', targetNodeId: 'select-repair' }],
      },
      {
        id: 'deliver',
        description: 'Return accepted values or explicit fallback states',
        run: (state, context) => ({
          result: state.cells.map((cell) => {
            context.signal.throwIfAborted();
            const errors = issues(cell);
            if (cell.item.sourceStatus === 'ready' && !errors.length && cell.hasValue)
              return {
                item: cell.item,
                value: cell.value,
                status: 'accepted' as const,
                issues: errors,
                checks: { local: cell.local, review: cell.review },
              };
            const outcome = synchronous(
              fallbackValue({ item: cell.item, issues: errors }, context),
              'Answer fallback must be synchronous',
            );
            if (
              !outcome ||
              typeof outcome.handled !== 'boolean' ||
              (outcome.handled && !('value' in outcome))
            )
              throw new TypeError('Invalid answer fallback outcome');
            return {
              item: cell.item,
              value: outcome.handled ? outcome.value : undefined,
              status: outcome.handled ? ('fallback' as const) : ('blocked' as const),
              issues: errors,
              checks: { local: cell.local, review: cell.review },
            };
          }),
        }),
        routes: [{ id: 'complete', complete: (state) => state.result! }],
      },
    ],
  });
  return Object.freeze({
    /**
     * Run one answer batch.
     *
     * @param request - Input ids the batch must cover and the items to answer; validated before
     *   any handler runs.
     * @param context - Operation context supplying app, signal and diagnostics.
     * @returns One accepted, fallback or blocked result per item, in request order.
     * @throws TypeError For an invalid batch or handler output, or when the repair budget is
     *   exhausted without a final result.
     */
    async run(
      request: { inputIds: readonly string[]; items: readonly AnswerItem<Data>[] },
      context: OperationContext<App>,
    ): Promise<AnswerResult<Data, Value>[]> {
      return nativeReportedStepAsync(context, 'answer', 'answer-flow', async () => {
        context.signal.throwIfAborted();
        validateAnswerBatch(request.inputIds, request.items, maxItems);
        const cells = request.items.map((item) => ({
          item: Object.freeze({
            id: item.id,
            data: item.data,
            sourceStatus: item.sourceStatus,
            inputIds: Object.freeze([...item.inputIds]),
          }),
          hasValue: false,
          local: { status: 'not-run' as const, issues: [] },
          review: { status: 'not-run' as const, issues: [] },
          knownReviewFailure: false,
        }));
        return new AgentCoreEngine<AnswerResult<Data, Value>[]>({
          maxRounds: maxRepairs + 1,
          errors: { exhausted: () => new TypeError('Answer flow exhausted') },
          execution: { signal: context.signal, diagnostics: context.diagnostics },
        })
          .bindWorkflow(workflow, context.app as App)
          .run({ cells, pending: [], repairBudget: new AttemptBudget(maxRepairs) });
      });
    },
  });
}
export type {
  AnswerFlowDefinition,
  AnswerCheck,
  AnswerItem,
  AnswerIssue,
  AnswerResult,
} from '../../structs/kits/answering/flow.js';

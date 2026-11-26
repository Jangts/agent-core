/**
 * Locks down `defineRetrieval` end to end: source-id binding, structural query keys,
 * duplicate-versus-budget rejection order, failure ownership across validate/execute/
 * result, ordered effects and cancellation checkpoints. The suite runs twice, once per
 * module format, through the ESM and CommonJS entries, with an in-memory app state fixture.
 */
import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as core from '@jangts/agent-core';
import * as kits from '@jangts/agent-core/kits';
const esm = { ...core, ...kits };
for (const [format, api] of [
  ['ESM', esm],
  [
    'CJS',
    {
      ...createRequire(import.meta.url)('@jangts/agent-core'),
      ...createRequire(import.meta.url)('@jangts/agent-core/kits'),
    },
  ],
]) {
  const test = (name, ...args) => nodeTest(`${format}: ${name}`, ...args);
  const { defineRetrieval, retrievalQueryKey, configureBreakWhile } = api;

  // The shared `context` doubles as the app-level store that retrieval commits into:
  // attempted keys, query counter, evidence list and the per-request limit.
  function fixture(overrides = {}) {
    const calls = [];
    const context = { queryCount: 0, seen: new Set(), sources: [], limit: 2 };
    const raw = { total: 1, sources: [{ sourceId: 'manual', title: 'Document' }] };
    const definition = {
      id: 'documents',
      description: 'Read registered documents',
      prepare: (query) => {
        calls.push('prepare');
        return { ...query, query: query.query.trim() };
      },
      assertInput: () => {
        calls.push('validate');
      },
      state: ({ app }) => app,
      limit: ({ app }) => app.limit,
      authorize: () => {
        calls.push('authorize');
      },
      execute: () => {
        calls.push('execute');
        return raw;
      },
      assertResult: () => {
        calls.push('result');
      },
      now: () => 10,
      effects: [
        { id: 'receipt', description: 'Deliver evidence', handle: () => calls.push('receipt') },
      ],
      ...overrides,
    };
    return {
      module: defineRetrieval(definition),
      context,
      execution: { app: context, signal: new AbortController().signal },
      calls,
      raw,
      definition,
    };
  }

  test('retrieval binds real source ids and commits before ordered domain effects without mutating input or result', () => {
    const value = fixture({
      effects: [
        {
          id: 'binding',
          description: 'Bind output',
          handle: (receipt, { app: state }) => {
            assert.equal(state.queryCount, 1);
            assert.equal(state.sources[0], receipt.result.sources[0]);
            receipt.extensions.reference = 'registered';
          },
        },
        {
          id: 'publish',
          description: 'Publish output',
          handle: (receipt) => assert.equal(receipt.extensions.reference, 'registered'),
        },
      ],
    });
    const input = { query: ' document ' };
    const receipt = value.module.run(input, value.execution);
    assert.deepEqual(value.calls, ['prepare', 'validate', 'authorize', 'execute', 'result']);
    // The caller's input object is not rewritten by prepare().
    assert.deepEqual(input, { query: ' document ' });
    // The adapter result is copied and bound, so the raw result never gains the source id.
    assert.equal(value.raw.sources[0].sourceId, 'manual');
    assert.equal(receipt.result.sources[0].sourceId, 'documents:q1:manual');
    // Sequence and clock come from the registered `now`, not wall time.
    assert.equal(receipt.sequence, 1);
    assert.equal(receipt.startedAtMs, 10);
  });

  test('structural query keys sort object fields but retain array order and semantic differences', () => {
    // Object key order is irrelevant; term order is semantic and must stay significant.
    assert.equal(
      retrievalQueryKey({ scope: 'docs', filter: { b: 2, a: 1 } }),
      retrievalQueryKey({ filter: { a: 1, b: 2 }, scope: 'docs' }),
    );
    assert.notEqual(
      retrievalQueryKey({ terms: ['a', 'b'] }),
      retrievalQueryKey({ terms: ['b', 'a'] }),
    );
    assert.throws(() => retrievalQueryKey(undefined), /cannot be serialized/);
  });

  test('duplicate rejection precedes an exhausted budget and carries distinct diagnostics for the same error', () => {
    const events = [],
      failure = new Error('not allowed');
    const value = fixture({ errors: { duplicate: failure, budget: failure }, tags: ['retrieval'] });
    value.module.run({ query: 'document' }, value.execution);
    value.context.limit = 1;
    configureBreakWhile({ onBreak: (event) => events.push(event) });
    try {
      // Duplicate detection runs before budget accounting, so the repeated query reports
      // `duplicate` while the new query reports `budget` — both through the same error.
      assert.throws(
        () => value.module.run({ query: 'document' }, value.execution),
        (error) => error === failure,
      );
      assert.throws(
        () => value.module.run({ query: 'other' }, value.execution),
        (error) => error === failure,
      );
      assert.deepEqual(
        events.map((event) => event.tags),
        [
          ['retrieval', 'duplicate'],
          ['retrieval', 'budget'],
        ],
      );
      assert.equal(value.calls.filter((call) => call === 'execute').length, 1);
    } finally {
      configureBreakWhile();
    }
  });

  test('rejected authorization neither reserves the query nor consumes a result count', () => {
    const failure = new Error('unknown document');
    const value = fixture({
      authorize() {
        throw failure;
      },
    });
    assert.throws(
      () => value.module.run({ query: 'document' }, value.execution),
      (error) => error === failure,
    );
    // Rejected authorization leaves no trace: no reserved key, no spent budget, no evidence.
    assert.equal(value.context.seen.size, 0);
    assert.equal(value.context.queryCount, 0);
    assert.equal(value.context.sources.length, 0);
  });

  test('adapter and result failures retain attempted keys without committing evidence or running effects', () => {
    for (const stage of ['execute', 'assertResult']) {
      const failure = new Error(stage);
      const value = fixture({
        [stage]() {
          throw failure;
        },
      });
      assert.throws(
        () => value.module.run({ query: 'document' }, value.execution),
        (error) => error === failure,
      );
      // The attempted key is reserved even when the adapter or result check fails, so a
      // retry of the same query is refused instead of silently re-running.
      assert.equal(value.context.seen.size, 1);
      assert.equal(value.context.queryCount, 0);
      assert.equal(value.context.sources.length, 0);
      assert.equal(value.calls.includes('receipt'), false);
      assert.throws(
        () => value.module.run({ query: 'document' }, value.execution),
        /already attempted/,
      );
    }
  });

  test('effect failure preserves committed evidence, stops later effects and does not refund the attempt', () => {
    const calls = [],
      failure = new Error('delivery');
    const value = fixture({
      effects: [
        {
          id: 'first',
          description: 'First effect',
          handle() {
            calls.push('first');
            throw failure;
          },
        },
        { id: 'later', description: 'Later effect', handle: () => calls.push('later') },
      ],
    });
    assert.throws(
      () => value.module.run({ query: 'document' }, value.execution),
      (error) => error === failure,
    );
    // Effects run only after commit, so a failing effect keeps the evidence and the spent
    // attempt while stopping the remaining effects.
    assert.equal(value.context.queryCount, 1);
    assert.equal(value.context.sources.length, 1);
    assert.deepEqual(calls, ['first']);
  });

  test('evidence clearing does not reset budgets or duplicate history; different request states stay isolated', () => {
    const value = fixture();
    value.module.run({ query: 'document' }, value.execution);
    value.context.sources.length = 0;
    // Clearing committed evidence is not a reset: the duplicate history and budget stay.
    assert.throws(
      () => value.module.run({ query: 'document' }, value.execution),
      /already attempted/,
    );
    assert.equal(value.context.queryCount, 1);
    const other = { queryCount: 0, seen: new Set(), sources: [], limit: 2 };
    assert.equal(
      value.module.run({ query: 'document' }, { app: other, signal: new AbortController().signal })
        .sequence,
      1,
    );
    assert.equal(value.context.sources.length, 0);
  });

  test('registered effects and handlers are snapshots; duplicate effect ids fail at registration', () => {
    const value = fixture();
    // Later mutation of the definition must not affect the already-registered module.
    value.definition.effects[0].handle = () => {
      throw new Error('mutated');
    };
    value.definition.execute = () => {
      throw new Error('mutated');
    };
    assert.doesNotThrow(() => value.module.run({ query: 'document' }, value.execution));
    assert.throws(
      () => fixture({ effects: [value.definition.effects[0], value.definition.effects[0]] }),
      /Duplicate retrieval effect/,
    );
  });

  test('retrieval always enforces cancellation after binding, before evidence commit and between effects', () => {
    // Three distinct checkpoints: before any work, after the source id is bound but before
    // commit, and between two effects after the evidence has been committed.
    const controller = new AbortController(),
      failure = new Error('stopped');
    const value = fixture();
    value.definition.assertInput = undefined;
    controller.abort(failure);
    assert.throws(
      () =>
        value.module.run({ query: 'document' }, { ...value.execution, signal: controller.signal }),
      (error) => error === failure,
    );
    assert.deepEqual(value.calls, []);

    const sourceController = new AbortController();
    const binding = fixture({
      sourceId() {
        sourceController.abort(failure);
        return 'bound';
      },
    });
    assert.throws(
      () =>
        binding.module.run(
          { query: 'document' },
          { ...binding.execution, signal: sourceController.signal },
        ),
      (error) => error === failure,
    );
    assert.equal(binding.context.seen.size, 1);
    assert.equal(binding.context.queryCount, 0);
    assert.deepEqual(binding.context.sources, []);

    const effectController = new AbortController(),
      effects = [];
    const committed = fixture({
      effects: [
        {
          id: 'first',
          description: 'Cancel after commit',
          handle() {
            effects.push('first');
            effectController.abort(failure);
          },
        },
        {
          id: 'later',
          description: 'Must not run',
          handle() {
            effects.push('later');
          },
        },
      ],
    });
    assert.throws(
      () =>
        committed.module.run(
          { query: 'document' },
          { ...committed.execution, signal: effectController.signal },
        ),
      (error) => error === failure,
    );
    assert.equal(committed.context.queryCount, 1);
    assert.equal(committed.context.sources.length, 1);
    assert.deepEqual(effects, ['first']);
  });

  test('retrieval rejects invalid counts before authorization and retains error-factory receivers', () => {
    // Fractional, non-finite and non-positive limits are refused before authorization, so
    // no key or budget is consumed.
    for (const limit of [NaN, Infinity, -1, 0.5]) {
      const value = fixture({ limit: () => limit });
      assert.throws(
        () => value.module.run({ query: 'document' }, value.execution),
        /safe integers/,
      );
      assert.equal(value.calls.includes('authorize'), false);
      assert.equal(value.context.seen.size, 0);
    }
    const failure = new Error('budget');
    class Errors {
      #failure = failure;
      budget() {
        return this.#failure;
      }
    }
    const value = fixture({ limit: () => 0, errors: new Errors() });
    assert.throws(
      () => value.module.run({ query: 'document' }, value.execution),
      (error) => error === failure,
    );
    assert.equal(value.context.seen.size, 0);
  });
}

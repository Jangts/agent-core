/*
 * Behaviour contract for the optional Kits an App may use directly:
 * normalization, delivery, projection, query aggregation, the domain Tool catalog
 * and the text template observer.
 *
 * These are the guarantees that let Kits stay outside Core while still running
 * inside a Core invocation: step ordering is observable, falsey payloads and
 * falsey state are preserved, caller input is never mutated, cancellation stops
 * the selected handler, and Kit observations never publish into Core events.
 *
 * Runs against the published `dist/` bundles through package subpath imports,
 * with inline fakes instead of real transports.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { defineNormalization, uniqueBy } from '@jangts/agent-core/kits/normalization';
import { defineDelivery } from '@jangts/agent-core/kits/delivery';
import {
  defineContentProjection,
  projectContinuousExcerpt,
  defineTreeProjection,
} from '@jangts/agent-core/kits/projection';
import { defineQueryAggregation, mergeByKey } from '@jangts/agent-core/kits/aggregation';
import * as domains from '@jangts/agent-core/kits/domains';
import * as kits from '@jangts/agent-core/kits';
import * as core from '@jangts/agent-core';

test('normalization replacements reach later predicates and explicit completion preserves falsey values', () => {
  const seen = [];
  const pipeline = defineNormalization(
    [
      { id: 'replace', normalize: (value) => ({ count: value.count + 1 }) },
      {
        id: 'observe',
        when: (value) => value.count === 2,
        normalize(value) {
          seen.push(value.count);
          return 0;
        },
      },
      {
        id: 'unreachable',
        normalize() {
          throw new Error('must stop');
        },
      },
    ],
    // `0` is a valid completion signal, so completion cannot be tested by truthiness.
    { isComplete: (value) => value === 0 },
  );
  const input = { count: 1 };
  assert.equal(pipeline.normalize(input), 0);
  // Normalization returns a new value and must leave the caller's object untouched.
  assert.deepEqual(input, { count: 1 });
  assert.deepEqual(seen, [2]);
  assert.throws(
    () =>
      defineNormalization([
        { id: 'x', normalize: (value) => value },
        { id: 'x', normalize: (value) => value },
      ]),
    /duplicate/,
  );
  // 'a' is seeded as already seen, so both ' A ' and 'a' drop out case-insensitively.
  assert.deepEqual(
    uniqueBy([' A ', 'a', 'B', 'b'], (value) => value.trim().toLowerCase(), ['a']),
    ['B'],
  );
});

test('delivery interleaves phase contributions and handlers, preserving early empty results and request isolation', () => {
  const order = [];
  const delivery = defineDelivery({
    createState: () => ({ count: 0 }),
    beforeStage: ({ stageId, state }) => {
      order.push('before:' + stageId);
      state.count++;
    },
    stages: [
      {
        id: 'prepare',
        handle: (state) => {
          order.push('prepare:' + state.count);
          return { type: 'continue' };
        },
      },
      {
        id: 'finish',
        handle: (state) => {
          order.push('finish:' + state.count);
          return { type: 'complete', value: '' };
        },
      },
      {
        id: 'unreachable',
        handle() {
          throw new Error('must stop');
        },
      },
    ],
    missingResult: () => new Error('missing'),
  });
  assert.equal(delivery.deliver({}, { signal: new AbortController().signal }), '');
  // Second delivery replays the same phase order, proving per-request state
  // rather than state shared across calls.
  assert.equal(delivery.deliver({}, { signal: new AbortController().signal }), '');
  assert.deepEqual(order, [
    'before:prepare',
    'prepare:1',
    'before:finish',
    'finish:2',
    'before:prepare',
    'prepare:1',
    'before:finish',
    'finish:2',
  ]);
});

test('delivery propagates the original failure and uses the configured missing-result error', () => {
  const error = new Error('original');
  const options = { createState: () => ({}), missingResult: () => error };
  assert.throws(
    () =>
      defineDelivery({ ...options, stages: [{ id: 'empty' }] }).deliver(
        {},
        { signal: new AbortController().signal },
      ),
    (value) => value === error,
  );
  assert.throws(
    () =>
      defineDelivery({
        ...options,
        stages: [
          {
            id: 'failed',
            handle() {
              throw error;
            },
          },
        ],
      }).deliver({}, { signal: new AbortController().signal }),
    (value) => value === error,
  );
});

test('delivery preserves instance handlers and execution getters, and cancellation stops the selected handler', () => {
  const controller = new AbortController(),
    diagnostics = {};
  class Execution {
    get signal() {
      return controller.signal;
    }
    get diagnostics() {
      return diagnostics;
    }
  }
  class Stage {
    id = 'finish';
    #reply = 'done';
    handle(state, context) {
      assert.equal(state.request, context.app);
      assert.equal(context.signal, controller.signal);
      assert.equal(context.diagnostics, diagnostics);
      return { type: 'complete', value: this.#reply };
    }
  }
  const options = {
    createState: (request) => ({ request }),
    stages: [new Stage()],
    missingResult: () => new Error('missing'),
  };
  assert.equal(defineDelivery(options).deliver({}, new Execution()), 'done');
  const stopped = defineDelivery({
    ...options,
    // Aborting before the first stage must prevent the handler from running at all.
    beforeStage() {
      controller.abort();
    },
    stages: [
      {
        id: 'unreachable',
        handle() {
          assert.fail('cancelled delivery must not execute');
        },
      },
    ],
  });
  assert.throws(() => stopped.deliver({}, new Execution()), { name: 'AbortError' });
});

test('budget projection remains valid JSON and continuous excerpts do not split a surrogate pair', () => {
  // `Infinity` count and tiny length force the tightest cut the projection can
  // take; the rendered result must still parse as JSON rather than be sliced raw.
  const projection = defineContentProjection({
    counts: [Infinity, 1],
    lengths: [20, 2],
    render: (excerpt) => JSON.stringify({ excerpt, truncated: true }),
    fallback: () => '',
  });
  const value = { rows: [{ text: 'long '.repeat(100) }, { text: 'more '.repeat(100) }] };
  const result = projection.project({ value, maxChars: 90 });
  assert.equal(result.truncated, true);
  assert.ok(result.text.length <= 90);
  assert.equal(JSON.parse(result.text).truncated, true);
  assert.equal(projection.project({ value: { ok: true }, maxChars: 100 }).text, '{"ok":true}');
  // Cutting inside the emoji's surrogate pair must yield an empty excerpt instead
  // of a lone half-surrogate.
  assert.deepEqual(
    projectContinuousExcerpt('😀x', 1, (length) => '😀x'.slice(0, length)),
    { text: '', truncated: true },
  );
  // A reader that prepends its own framing returns text that is not a prefix of
  // the source, so the excerpt is rejected rather than shown out of context.
  assert.equal(
    projectContinuousExcerpt('abc', 2, (length) => 'metadata:' + 'abc'.slice(0, length)),
    undefined,
  );
});

test('tree projection visits records before reading their fields and keeps falsey data', () => {
  const order = [];
  const root = {
    get child() {
      order.push('get');
      return { id: 1 };
    },
    list: [0, false, '', null],
  };
  const projection = defineTreeProjection({
    maxDepth: 2,
    omit: (value) => value === null || value === '',
    visitRecord(value, depth, context) {
      context.push('record:' + depth);
    },
  });
  const result = projection.visit(root, order);
  assert.deepEqual(result, { child: { id: 1 }, list: [0, false] });
  // Records are visited before their fields are read, so a throwing getter cannot
  // pre-empt the visit; `0` and `false` survive while `null` and '' are omitted.
  assert.deepEqual(order, ['record:0', 'get', 'record:1']);
  assert.deepEqual(defineTreeProjection({ maxDepth: 0 }).visit({ child: { id: 1 } }), {});
});

test('query aggregation preserves query order, stable row positions, overwrite policy and failure boundaries', () => {
  const calls = [];
  const aggregation = defineQueryAggregation({
    execute(input) {
      calls.push(input);
      return [
        { id: 1, term: input },
        { id: input, term: input },
      ];
    },
    key: (row) => String(row.id),
    merge: (row, previous) => ({ ...row, matches: [...(previous?.matches ?? []), row.term] }),
  });
  const result = aggregation.collect(['a', 'b']);
  // Queries run in the caller's order, and the duplicate id 1 collapses into the
  // first row position instead of moving to the end.
  assert.deepEqual(calls, ['a', 'b']);
  assert.equal(result.total, 3);
  assert.deepEqual(
    result.items.map((row) => row.id),
    [1, 'a', 'b'],
  );
  assert.deepEqual(result.items[0].matches, ['a', 'b']);
  const error = new Error('read failed');
  const stopped = [];
  assert.throws(
    () =>
      defineQueryAggregation({
        execute(input) {
          stopped.push(input);
          if (input === 2) throw error;
          return [input];
        },
      }).collect([1, 2, 3]),
    (value) => value === error,
  );
  // Collection stops at the first failing query: later inputs never execute.
  assert.deepEqual(stopped, [1, 2]);
  assert.deepEqual(
    mergeByKey(
      [
        { id: 'a', value: 1 },
        { id: 'b', value: 2 },
        { id: 'a', value: 3 },
      ],
      (row) => row.id,
      (row) => row,
    ),
    [
      { id: 'a', value: 3 },
      { id: 'b', value: 2 },
    ],
  );
});

test('Kit and legacy exports share identity; hand-written implementations need no Support brand', () => {
  // Same constructor identity across the subpath and the root entry means Apps
  // can mix both import styles without breaking instanceof or registry checks.
  assert.equal(domains.GoalRegistry, core.GoalRegistry);
  assert.equal(domains.ScopeRegistry, core.ScopeRegistry);
  const registry = new core.ToolRegistry();
  registry.register({
    id: 'manual',
    kind: 'pure',
    parseInput: (value) => value,
    execute: (value) => value * 2,
    parseOutput: (value) => value,
  });
  assert.equal(registry.invoke({ toolId: 'manual', input: 3 }).value, 6);
  const require = createRequire(import.meta.url);
  for (const entry of [
    'support',
    'kits/normalization',
    'kits/delivery',
    'kits/projection',
    'kits/aggregation',
  ])
    assert.ok(Object.keys(require('@jangts/agent-core/' + entry)).length > 0);
});

test('Kit observations are caller-owned and cannot publish into Core events', () => {
  const events = [],
    outputs = [];
  const diagnostics = core.createDiagnostics({ output: { write: (value) => events.push(value) } });
  const template = kits.defineTextTemplate('{{body}}', {
    diagnostics,
    observe: (value) => outputs.push(value),
  });
  assert.equal(template.render({ body: 'private' }), 'private');
  // Kit output goes only to the caller's observer; Core diagnostics stay empty so
  // Kit payloads cannot become Core events.
  assert.deepEqual(outputs, ['private']);
  assert.deepEqual(events, []);
  assert.equal(core.coreEventCatalog['presentation.rendered'], undefined);
  assert.equal(core.coreEventCatalog['extension.event'], undefined);
  let constructed = 0;
  // Emitting an unregistered event must not even evaluate the payload factory.
  diagnostics.emit('extension.event', () => {
    constructed++;
    return 'not a Core event';
  });
  assert.equal(constructed, 0);
  assert.deepEqual(events, []);
  // A throwing observer cannot break rendering: the return value is still produced.
  assert.equal(
    kits
      .defineTextTemplate('{{body}}', {
        observe() {
          throw new Error('observer');
        },
      })
      .render({ body: 'safe' }),
    'safe',
  );
});

test('catalog task restriction is explicit and can expose all registered relationships', () => {
  const ports = {
    goalIds: () => ['first', 'second'],
    goals: (goals = ['first', 'second']) =>
      goals.map((goal) => ({ id: goal, delegates: ['finish'] })),
    scopes: () => [
      { id: 'one', toolIds: [] },
      { id: 'two', toolIds: [] },
    ],
    currentTask: () => ({ goalId: 'first', scopeId: 'one' }),
    tools: { values: () => [], has: () => true, supportsGoal: () => true, describe: () => [] },
  };
  // Default behaviour limits the model-visible catalog to the current task.
  assert.deepEqual(domains.defineAgentCatalog(ports).modelCatalog({}).availableGoalIds, [
    'first',
  ]);
  const all = domains.defineAgentCatalog({ ...ports, restrictToTask: false }).modelCatalog({});
  assert.deepEqual(all.availableGoalIds, ['first', 'second']);
  assert.deepEqual(
    all.availableScopes.map((scope) => scope.id),
    ['one', 'two'],
  );
});

/*
 * Contracts for the Core workflow engine (工作流引擎): round accounting, route matching,
 * error recovery, cancellation and the state contract of a phase.
 *
 * The suite is organised around the engine's guarantees rather than around individual
 * features. Every loop must be bounded by the round limit, a phase's returned update is
 * committed atomically, cancellation must prevent the next phase from running and must
 * bypass error recovery, and diagnostics must expose ordered phase facts without leaking
 * state or raw error details.
 *
 * Main exports: none. The file only registers `node:test` cases.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiagnostics } from '@jangts/agent-core';
import {
  AgentCoreEngine,
  defineWorkflow,
  AttemptBudget,
  WorkflowContractError,
} from '@jangts/agent-core/engine';

/**
 * Build an engine with a round limit and an optional cancellation signal.
 *
 * @param rounds - Maximum number of rounds the engine may start.
 * @param signal - Optional signal that cancels the run.
 * @returns A configured engine without a bound workflow.
 */
const engine = (rounds = 2, signal) =>
  new AgentCoreEngine({
    maxRounds: rounds,
    // A recognisable exhaustion error keeps the assertions independent of the
    // engine's own wording.
    errors: { exhausted: () => new Error('rounds exhausted') },
    execution: { signal },
  });
/**
 * Build a node description with a shared shape.
 *
 * @param id - Node id; also used as the description.
 * @param routes - Ordered route list of the node.
 * @param options - Additional node fields such as `startsRound` or `run`.
 * @returns A node description.
 */
const node = (id, routes, options = {}) => ({ id, description: id, routes, ...options });
/**
 * Build a workflow whose entry node is always `round`.
 *
 * @param nodes - Node descriptions of the workflow.
 * @returns A defined workflow.
 */
const workflow = (nodes) => defineWorkflow({ id: 'test', entryNodeId: 'round', nodes });

test('phases do not consume rounds; ordered guards decide the first matching branch', async () => {
  const visits = [];
  const flow = workflow([
    node('round', [{ targetNodeId: 'decision' }], {
      startsRound: true,
      run: (run, { roundIndex }) => {
        visits.push(roundIndex);
        return { count: run.count + 1 };
      },
    }),
    node('decision', [
      // The first matching route wins, so the count check must come first.
      { when: (run) => run.count === 2, targetNodeId: 'done' },
      { when: () => true, targetNodeId: 'round' },
      { targetNodeId: 'wrong' },
    ]),
    node('done', [{ complete: (run) => run.count }]),
    node('wrong', [{ complete: () => -1 }]),
  ]);
  assert.equal(await engine().bindWorkflow(flow).run({ count: 0 }), 2);
  // Two rounds, because only the round node starts a new round.
  assert.deepEqual(visits, [0, 1]);
});

test('every loop remains bounded, including cycles through exception routes', async () => {
  let calls = 0;
  const error = new Error('model');
  const flow = workflow([
    node('round', [{ targetNodeId: 'model' }], { startsRound: true }),
    node('model', [{ complete: () => 'unused' }], {
      onErrorNodeId: 'recover',
      run: () => {
        calls++;
        throw error;
      },
    }),
    node('recover', [{ targetNodeId: 'round' }], {
      run: (_, context) => {
        // The recovery node sees the original failure, not a wrapped one.
        assert.equal(context.error, error);
      },
    }),
  ]);
  await assert.rejects(engine().bindWorkflow(flow).run({}), /rounds exhausted/);
  assert.equal(calls, 2);
});

test('unhandled errors escape and recovery errors are not silently retried', async () => {
  const error = new Error('validation');
  const flow = workflow([
    node('round', [{ complete: () => 'unused' }], {
      startsRound: true,
      onErrorNodeId: 'recover',
      run: () => {
        throw error;
      },
    }),
    node('recover', [{ targetNodeId: 'round' }], {
      run: () => {
        // The recovery node fails as well, so the original error must escape.
        throw error;
      },
    }),
  ]);
  await assert.rejects(engine().bindWorkflow(flow).run({}), (value) => value === error);
});

test('completion is explicit and can return undefined without another round', async () => {
  const flow = workflow([node('round', [{ complete: () => undefined }], { startsRound: true })]);
  assert.equal(await engine(1).bindWorkflow(flow).run({}), undefined);
});

test('cancellation prevents the next phase side effect and bypasses error recovery', async () => {
  const controller = new AbortController();
  const visits = [];
  const flow = workflow([
    node('round', [{ targetNodeId: 'tool' }], {
      startsRound: true,
      onErrorNodeId: 'recover',
      run: () => controller.abort(),
    }),
    node('tool', [{ complete: () => 'done' }], {
      run: () => {
        visits.push('tool');
      },
    }),
    node('recover', [{ targetNodeId: 'round' }], {
      run: () => {
        visits.push('recover');
      },
    }),
  ]);
  await assert.rejects(engine(1, controller.signal).bindWorkflow(flow).run({}), {
    name: 'AbortError',
  });
  // Neither the next phase nor the recovery node may run after cancellation.
  assert.deepEqual(visits, []);
});

test('already aborted requests do not enter handlers; completion also checks cancellation', async () => {
  const controller = new AbortController();
  const flow = workflow([
    node(
      'round',
      [
        {
          complete: () => {
            // Cancelling during completion must abort before the result is used.
            controller.abort();
            return 'done';
          },
        },
      ],
      { startsRound: true },
    ),
  ]);
  await assert.rejects(engine(1, controller.signal).bindWorkflow(flow).run({}), {
    name: 'AbortError',
  });
  let entered = false;
  const never = workflow([
    node('round', [{ complete: () => 'done' }], {
      startsRound: true,
      run: () => {
        entered = true;
      },
    }),
  ]);
  await assert.rejects(engine(1, controller.signal).bindWorkflow(never).run({}), {
    name: 'AbortError',
  });
  // The handler of an already cancelled request must not run at all.
  assert.equal(entered, false);
});

test('catalog checks unknown references, duplicates, unreachable nodes and shadowed routes', () => {
  // A route pointing at a node that does not exist cannot be resolved.
  assert.throws(
    () => workflow([node('round', [{ targetNodeId: 'missing' }], { startsRound: true })]),
    /Unknown/,
  );
  // Two nodes may not share one id.
  assert.throws(
    () =>
      workflow([
        node('round', [{ complete: () => 1 }], { startsRound: true }),
        node('round', [{ complete: () => 2 }]),
      ]),
    /duplicate/,
  );
  // A node that no route can reach is dead code.
  assert.throws(
    () =>
      workflow([
        node('round', [{ complete: () => 1 }], { startsRound: true }),
        node('unused', [{ complete: () => 2 }]),
      ]),
    /Unreachable/,
  );
  // A route after a terminal route can never be taken.
  assert.throws(
    () =>
      workflow([
        node('round', [{ complete: () => 1 }, { targetNodeId: 'round' }], { startsRound: true }),
      ]),
    /unreachable/,
  );
  // Without a round-starting node the workflow could never loop.
  assert.throws(
    () => workflow([node('round', [{ complete: () => 1 }], { startsRound: false })]),
    /bounded round/,
  );
});

test('catalog rejects cycles that bypass round limits, including hidden error cycles', () => {
  // A self-loop and an error route back to the same node both risk an
  // unbounded loop, so the catalog refuses both shapes.
  for (const errorCycle of [false, true]) {
    assert.throws(
      () =>
        workflow([
          node('round', [{ targetNodeId: 'phase' }], { startsRound: true }),
          node(
            'phase',
            errorCycle ? [{ complete: () => 'done' }] : [{ targetNodeId: 'phase' }],
            errorCycle ? { onErrorNodeId: 'phase' } : {},
          ),
        ]),
      /cycle bypasses/,
    );
  }
});

test('catalog snapshot is isolated from caller mutation and can describe execution', async () => {
  const routes = [{ complete: () => 'original' }];
  const flow = workflow([node('round', routes, { startsRound: true })]);
  // Mutating the caller's array after definition must not affect the snapshot.
  routes[0].complete = () => 'mutated';
  assert.equal(await engine().bindWorkflow(flow).run({}), 'original');
  assert.deepEqual(flow.describe(), [
    {
      id: 'round',
      description: 'round',
      startsRound: true,
      onErrorNodeId: undefined,
      requires: [],
      provides: [],
      routes: [{ targetNodeId: undefined, terminal: true, conditional: false }],
    },
  ]);
});

test('missing matching routes fail explicitly rather than spinning', async () => {
  const flow = workflow([
    node('round', [{ when: () => false, complete: () => 'unused' }], { startsRound: true }),
  ]);
  await assert.rejects(engine().bindWorkflow(flow).run({}), /No matching workflow route: round/);
});

test('attempt budget counts successful acquisitions and never grants an extra attempt', () => {
  const budget = new AttemptBudget(1);
  // `available` is a snapshot of the counter, not a reservation.
  assert.equal(budget.available, true);
  assert.equal(budget.take(), true);
  // A refused acquisition does not consume an attempt either.
  assert.equal(budget.take(), false);
  assert.equal(budget.used, 1);
  assert.equal(budget.available, false);
  assert.equal(new AttemptBudget(0).take(), false);
  // Only nonnegative integers are valid limits.
  for (const invalid of [-1, 0.5, Infinity])
    assert.throws(() => new AttemptBudget(invalid), TypeError);
});

test('runtime dependencies are separate from state and returned updates reach the next phase', async () => {
  const runtime = { answer: 42 };
  const state = { count: 1 };
  const flow = workflow([
    node('round', [{ targetNodeId: 'answer' }], {
      startsRound: true,
      provides: ['count'],
      run: (run, context) => {
        // The App dependencies travel in the phase context, not in the state.
        assert.equal(context.app, runtime);
        return { count: run.count + 1 };
      },
    }),
    node('answer', [{ complete: (run) => run.count }], { requires: ['count'] }),
  ]);
  assert.equal(await engine(1).bindWorkflow(flow, runtime).run(state), 2);
  // The committed update reached the caller's state object.
  assert.deepEqual(state, { count: 2 });
});

test('missing phase inputs fail before side effects and are not model-repair errors', async () => {
  let executed = false;
  const flow = workflow([
    node('round', [{ complete: () => 'unused' }], {
      startsRound: true,
      requires: ['decision'],
      onErrorNodeId: 'recover',
      run: () => {
        executed = true;
      },
    }),
    node('recover', [{ targetNodeId: 'round' }]),
  ]);
  await assert.rejects(engine(1).bindWorkflow(flow).run({}), WorkflowContractError);
  // The declared input was missing, so the handler must not have run.
  assert.equal(executed, false);
});

test('missing outputs reject the update before committing other fields', async () => {
  const state = { count: 0 };
  const flow = workflow([
    node('round', [{ complete: () => 'unused' }], {
      startsRound: true,
      provides: ['decision'],
      // The node promises `decision` but returns only `count`.
      run: () => ({ count: 1 }),
    }),
  ]);
  await assert.rejects(engine(1).bindWorkflow(flow).run(state), WorkflowContractError);
  // The rejected update must not have committed any of its fields.
  assert.deepEqual(state, { count: 0 });
});

test('invalid write targets reject the whole workflow update and bypass recovery', async () => {
  let setterCalls = 0;
  let recoveries = 0;
  const flow = workflow([
    node('round', [{ complete: () => 'unused' }], {
      startsRound: true,
      onErrorNodeId: 'recover',
      run: () => ({ count: 1, label: 'new' }),
    }),
    node('recover', [{ complete: () => ++recoveries }]),
  ]);
  const states = [
    Object.defineProperty({ count: 0, label: 'old' }, 'label', { writable: false }),
    Object.defineProperty({ count: 0 }, 'label', { set: () => ++setterCalls }),
    Object.assign(Object.create(Object.freeze({ label: 'old' })), { count: 0 }),
    Object.preventExtensions({ count: 0 }),
  ];
  for (const state of states) {
    await assert.rejects(engine(1).bindWorkflow(flow).run(state), {
      name: 'WorkflowContractError',
      message: /label/,
    });
    assert.equal(state.count, 0);
  }
  await assert.rejects(engine(1).bindWorkflow(flow).run(0), {
    name: 'WorkflowContractError',
    message: /mutable object/,
  });
  assert.equal(recoveries, 0);
  assert.equal(setterCalls, 0);
});

test('workflow commits preserve own property flags and treat prototype names as data', async () => {
  const sealed = Object.seal({ count: 0 });
  const symbol = Symbol('field');
  const state = Object.create({ label: 'old' });
  for (const [target, update] of [
    [Object.freeze({ noWrites: true }), {}],
    [sealed, { count: 1 }],
    [state, { label: 'new', ['__proto__']: 'data', [symbol]: 1 }],
  ]) {
    const flow = workflow([
      node('round', [{ complete: () => 'done' }], { startsRound: true, run: () => update }),
    ]);
    await engine(1).bindWorkflow(flow).run(target);
  }
  assert.deepEqual(Object.getOwnPropertyDescriptor(sealed, 'count'), {
    value: 1, configurable: false, enumerable: true, writable: true,
  });
  assert.deepEqual(Object.getPrototypeOf(state), { label: 'old' });
  assert.equal(state.label, 'new');
  assert.equal(state.__proto__, 'data');
  assert.equal(state[symbol], 1);
});

test('aborting an async handler discards its returned update', async () => {
  const control = new AbortController();
  const state = { count: 0 };
  const flow = workflow([
    node('round', [{ complete: () => 'unused' }], {
      startsRound: true,
      run: async () => {
        control.abort();
        return { count: 1 };
      },
    }),
  ]);
  await assert.rejects(engine(1, control.signal).bindWorkflow(flow).run(state), {
    name: 'AbortError',
  });
  assert.equal(state.count, 0);
});

test('throwing a handler never commits a partial update and routes the original error', async () => {
  const state = { count: 0 };
  const failure = new Error('private detail');
  const flow = workflow([
    node('round', [{ complete: () => 'unused' }], {
      startsRound: true,
      onErrorNodeId: 'recover',
      run: () => {
        throw failure;
      },
    }),
    node('recover', [{ complete: (run) => run.count }], {
      run: (_, context) => {
        assert.equal(context.error, failure);
      },
    }),
  ]);
  assert.equal(await engine(1).bindWorkflow(flow).run(state), 0);
});

test('workflow result validation catches a missing or invalid terminal result', async () => {
  const flow = defineWorkflow({
    id: 'checked',
    entryNodeId: 'round',
    // The workflow declares what a valid terminal result looks like.
    isResult: (value) => typeof value === 'string' && !!value.trim(),
    nodes: [node('round', [{ complete: () => undefined }], { startsRound: true })],
  });
  await assert.rejects(engine(1).bindWorkflow(flow).run({}), WorkflowContractError);
});

test('diagnostics expose ordered phases, routes and codes, never state or raw errors', async () => {
  const events = [];
  const flow = workflow([
    node('round', [{ complete: () => 'unused' }], {
      startsRound: true,
      onErrorNodeId: 'recover',
      run: () => {
        throw Object.assign(new Error('secret'), { code: 'MODEL_TIMEOUT', secret: 'secret' });
      },
    }),
    node('recover', [{ complete: () => 'done' }]),
  ]);
  const runner = new AgentCoreEngine({
    maxRounds: 1,
    errors: { exhausted: () => new Error('exhausted') },
    execution: {
      observe: {
        event: (fact) => {
          if (fact.type === 'workflow.event') events.push(fact.payload.event);
        },
      },
    },
  });
  assert.equal(await runner.bindWorkflow(flow).run({ secret: 'secret' }), 'done');
  // The phase facts arrive in execution order.
  assert.deepEqual(
    events.map(({ nodeId, type }) => [nodeId, type]),
    [
      ['round', 'enter'],
      ['round', 'error'],
      ['recover', 'enter'],
      ['recover', 'complete'],
    ],
  );
  // Only the error code is published, not the message or the custom fields.
  assert.equal(events[1].errorCode, 'MODEL_TIMEOUT');
  assert.doesNotMatch(JSON.stringify(events), /secret/);
  assert.equal(Object.isFrozen(events[0]), true);
});

test('observer failures cannot alter routing, completion or add attempts', async () => {
  let calls = 0;
  const flow = workflow([
    node('round', [{ complete: () => 'done' }], {
      startsRound: true,
      run: () => {
        calls++;
      },
    }),
  ]);
  const runner = new AgentCoreEngine({
    maxRounds: 1,
    errors: { exhausted: () => new Error('exhausted') },
    execution: {
      observe: {
        event: () => {
          // A failing observer must not disturb the run itself.
          throw new Error('observer');
        },
      },
    },
  });
  assert.equal(await runner.bindWorkflow(flow).run({}), 'done');
  assert.equal(calls, 1);
});

test('phase contracts are immutable snapshots and reject duplicate field declarations', () => {
  const requires = ['decision'];
  const flow = workflow([
    node('round', [{ complete: () => 'done' }], { startsRound: true, requires }),
  ]);
  requires.push('later');
  // The contract was captured as a snapshot at definition time.
  assert.deepEqual(flow.get('round').requires, ['decision']);
  assert.throws(
    () =>
      workflow([
        node('round', [{ complete: () => 'done' }], { startsRound: true, provides: ['x', 'x'] }),
      ]),
    /state contract/,
  );
});

test('async observer failures are isolated without delaying the workflow', async () => {
  const flow = workflow([node('round', [{ complete: () => 'done' }], { startsRound: true })]);
  const runner = new AgentCoreEngine({
    maxRounds: 1,
    errors: { exhausted: () => new Error('exhausted') },
    execution: {
      observe: {
        event: async () => {
          throw new Error('async observer');
        },
      },
    },
  });
  assert.equal(await runner.bindWorkflow(flow).run({}), 'done');
  // Give the rejected observer promise a turn, so a late rejection would surface.
  await new Promise((resolve) => setImmediate(resolve));
});

test('invalid returned update values fail as contracts rather than corrupting state', async () => {
  // Only an object of state fields is a valid update.
  for (const invalid of [null, false, 1, 'text', []]) {
    const state = { count: 0 };
    const flow = workflow([
      node('round', [{ complete: () => 'unused' }], { startsRound: true, run: () => invalid }),
    ]);
    await assert.rejects(engine(1).bindWorkflow(flow).run(state), WorkflowContractError);
    assert.deepEqual(state, { count: 0 });
  }
});

test('custom Agent workflows receive App dependencies and emit workflow diagnostics', async () => {
  const app = { value: 'from app' };
  const events = [];
  const flow = workflow([
    node('round', [{ targetNodeId: 'deliver' }], {
      startsRound: true,
      run: (_, context) => {
        assert.equal(context.app, app);
        return { value: context.app.value };
      },
    }),
    node('deliver', [{ complete: (state) => state.value }]),
  ]);
  const core = new AgentCoreEngine({
    maxRounds: 1,
    execution: {
      observe: {
        event: (fact) => {
          if (fact.type === 'workflow.event') events.push(fact.payload.event);
        },
      },
    },
  });
  assert.equal(await core.bindWorkflow(flow, app).run({}), app.value);
  // A transition event appears between the two phase entries.
  assert.deepEqual(
    events.map((event) => event.type),
    ['enter', 'transition', 'enter', 'complete'],
  );
  // All events belong to the same workflow invocation.
  assert.equal(new Set(events.map((event) => event.workflowInvocationId)).size, 1);
});

test('nodes commit the returned value before routing and use normal error recovery', async () => {
  const error = new Error('lookup failed');
  const flow = workflow([
    node(
      'round',
      [
        { when: ({ status }) => status === 'offline', complete: ({ status }) => status },
        { complete: () => 'online' },
      ],
      {
        startsRound: true,
        onErrorNodeId: 'recover',
        run: async (_, { app }) => {
          if (app.fail) throw error;
          return { status: 'offline' };
        },
      },
    ),
    node('recover', [
      {
        complete: (state, context) => {
          assert.equal(context.error, error);
          // The failed node committed nothing, so the field is still unset.
          assert.equal(state.status, undefined);
          return 'recovered';
        },
      },
    ]),
  ]);
  assert.equal(await engine(1).bindWorkflow(flow, {}).run({}), 'offline');
  assert.equal(await engine(1).bindWorkflow(flow, { fail: true }).run({}), 'recovered');
});

test('a bound workflow and its dependencies are reused across requests', async () => {
  const flow = workflow([
    node('round', [{ complete: ({ name }, { app }) => app.prefix + name }], { startsRound: true }),
  ]);
  const core = engine(1).bindWorkflow(flow, { prefix: 'Hello ' });
  assert.deepEqual(await Promise.all([core.run({ name: 'A' }), core.run({ name: 'B' })]), [
    'Hello A',
    'Hello B',
  ]);
  // The engine keeps one bound workflow, so a second binding is refused.
  assert.throws(
    () => core.bindWorkflow(flow, { prefix: 'Other ' }),
    /already has a bound workflow/,
  );
});

test('add and fork preserve the original workflow and reuse registered tools', async () => {
  const base = defineWorkflow({
    id: 'status',
    nodes: [node('lookup', [{ complete: () => 'basic' }])],
  });
  const extra = defineWorkflow({
    id: 'extra',
    nodes: [
      node('latency', [{ complete: (state) => state.value }], {
        async run(_, { tools }) {
          const { value } = await tools.invoke({ toolId: 'latency', input: {} });
          return { value };
        },
      }),
    ],
  });
  const records = [];
  const diagnostics = createDiagnostics({ output: { write: (record) => records.push(record) } });
  const core = new AgentCoreEngine({ workflow: base, execution: { diagnostics } });
  const source = { latency: 12 };
  // The checkpoint captures a snapshot; later mutations of the source do not apply.
  const at = core.checkpoint(source);
  source.latency = 99;
  const fromConstructor = new AgentCoreEngine({ workflow: base });
  assert.equal(await fromConstructor.run({}), 'basic');
  assert.throws(() => fromConstructor.bindWorkflow(base), /already has a bound workflow/);
  const upgraded = core.fork({
    at,
    workflow: extra,
    routes: { lookup: [{ targetNodeId: 'latency' }] },
    resume: (snapshot) => ({
      tools: {
        async invokeAsync({ toolId }) {
          assert.equal(toolId, 'latency');
          return { value: snapshot.latency };
        },
      },
    }),
  });
  assert.deepEqual(await Promise.all([core.run({}), upgraded.run({})]), ['basic', 12]);
  // Adding nodes to a workflow returns a new workflow and leaves the original intact.
  assert.deepEqual(base.ids(), ['lookup']);
  assert.equal(core.fork({ at }).workflow, base);
  // A fork shares the agent, but has its own branch identity.
  assert.equal(upgraded.branch.agentId, core.branch.agentId);
  assert.notEqual(upgraded.branch.branchId, core.branch.branchId);
  assert.equal(upgraded.branch.parentBranchId, core.branch.branchId);
  assert.equal(upgraded.branch.forkPointId, at.id);
  const entries = records.filter(
    (record) => record.type === 'workflow.event' && record.payload.event.type === 'enter',
  );
  assert.deepEqual(
    new Set(entries.map((record) => record.branchId)),
    new Set([core.branch.branchId, upgraded.branch.branchId]),
  );
  assert.equal(new Set(entries.map((record) => record.workflowInvocationId)).size, 2);
  assert.ok(
    entries
      .filter((record) => record.branchId === upgraded.branch.branchId)
      .every((record) => record.forkPointId === at.id),
  );
  // A checkpoint cannot be reused as the fork point of its own branch.
  assert.throws(() => upgraded.fork({ at }), /checkpoint from this branch/);
  // The added node is unreachable in the original workflow, so the merge is refused.
  assert.throws(() => base.add(extra), /Unreachable/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(upgraded.run({}, { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(await upgraded.run({}), 12);
});

test('route and route.to are aliases for unconditional jumps', async () => {
  const { route } = await import('@jangts/agent-core/engine');
  assert.equal(route, route.to);
  // Without an explicit id the route is named after its target.
  assert.deepEqual(route('repair'), { id: 'to-repair', targetNodeId: 'repair' });
  assert.deepEqual(route('repair', 'retry'), { id: 'retry', targetNodeId: 'repair' });
});

test('route generates stable edge and condition IDs with independent overrides', async () => {
  const { route } = await import('@jangts/agent-core/engine');
  const first = route.toIfEqual('service', 'intent', 'status');
  const second = route.toIfEqual('other', 'intent', 'status');
  // The same call always yields the same route id.
  assert.equal(first.id, route.toIfEqual('service', 'intent', 'status').id);
  // The condition id names the condition, so it is shared between both routes.
  assert.equal(first.conditionId, second.conditionId);
  assert.notEqual(first.id, second.id);
  // The value type is part of the derived id, so `1` and `'1'` differ.
  assert.notEqual(route.toIfEqual('next', 'value', 1).id, route.toIfEqual('next', 'value', '1').id);
  // Overriding the id leaves the condition id, and vice versa.
  assert.equal(
    route.toIfEqual('service', 'intent', 'status', { id: 'custom' }).conditionId,
    first.conditionId,
  );
  assert.equal(
    route.toIfEqual('service', 'intent', 'status', { conditionId: 'custom' }).id,
    first.id,
  );
});

test('duplicate route IDs receive stable suffixes regardless of configuration source', async () => {
  const { route } = await import('@jangts/agent-core/engine');
  const generated = route.toIfEqual('service', 'intent', 'status');
  const flow = workflow([
    node('round', [
      generated,
      // A copy of the same route object.
      { ...generated },
      // The same route rebuilt with explicit ids.
      route.toIfEqual('service', 'intent', 'status', {
        id: generated.id,
        conditionId: generated.conditionId,
      }),
    ]),
    node('service', [{ complete: () => 'done' }]),
  ]);
  const routes = flow.describe()[0].routes;
  // The catalog disambiguates duplicates by appending an increasing suffix.
  assert.deepEqual(
    routes.map((entry) => entry.id),
    [generated.id, `${generated.id}~2`, `${generated.id}~3`],
  );
  assert.deepEqual(
    routes.map((entry) => entry.conditionId),
    [`round.${generated.id}`, `round.${generated.id}~2`, `round.${generated.id}~3`],
  );
});

test('Core delivery routes pair readiness with reading the result or outcome', async () => {
  const { route } = await import('@jangts/agent-core/engine');
  const flow = workflow([
    node('round', [
      // Ordered by readiness: outcome first, then result, then the fallback.
      route.deliverWhenComplete('outcome'),
      route.deliverIfReady('result'),
      route.deliver('fallback'),
    ]),
  ]);
  assert.equal(
    await engine(1)
      .bindWorkflow(flow)
      .run({ outcome: { type: 'complete', value: undefined }, fallback: 'unused' }),
    undefined,
  );
  assert.equal(
    await engine(1)
      .bindWorkflow(flow)
      .run({ outcome: { type: 'continue' }, result: false }),
    false,
  );
  assert.equal(await engine(1).bindWorkflow(flow).run({ fallback: 0 }), 0);
  // A terminal route whose field is missing fails instead of returning undefined.
  await assert.rejects(engine(1).bindWorkflow(flow).run({}), /Missing workflow state: fallback/);
});

test('toIfError uses the configured error field and preserves route identity', async () => {
  const { route } = await import('@jangts/agent-core/engine');
  const custom = route.toIfError('failure', {
    errorKey: 'reviewError',
    conditionId: 'review.failed',
  });
  assert.equal(custom.when({ error: new Error('other') }), false);
  assert.equal(custom.when({ reviewError: new Error('review') }), true);
  assert.equal(custom.id, 'to-failure');
  assert.equal(custom.conditionId, 'review.failed');
  // Without an explicit error key the route watches the default `error` field.
  assert.equal(route.toIfError('failure').when({ error: new Error('default') }), true);
});

test('condition ID templates resolve on ordinary routes using the final route ID', async () => {
  const { route } = await import('@jangts/agent-core/engine');
  const flow = workflow([
    node('round', [
      { id: 'to-next', conditionId: '{nid}.{rid}', when: () => false, targetNodeId: 'next' },
      route.toIfDefined('next', 'value'),
      { complete: () => 'fallback' },
    ]),
    node('next', [{ complete: () => 'done' }]),
  ]);
  // `{nid}` is the node id and `{rid}` the final, already disambiguated route id.
  assert.deepEqual(
    flow.describe()[0].routes.map((entry) => entry.conditionId),
    ['round.to-next', 'round.to-next~2', undefined],
  );
  const implicit = workflow([node('round', [{ when: () => true, complete: () => 'done' }])]);
  assert.equal(implicit.describe()[0].routes[0].id, undefined);
  assert.equal(implicit.describe()[0].routes[0].conditionId, undefined);
  // A template that needs a route id cannot be used on a route without one.
  assert.throws(
    () =>
      workflow([
        node('round', [{ conditionId: '{rid}', when: () => true, complete: () => 'done' }]),
      ]),
    /missing route ID/,
  );
});

test('toIf tests truthiness and jumps to the same-named node', async () => {
  const { route } = await import('@jangts/agent-core/engine');
  const jump = route.toIf('recovered');
  assert.equal(jump.targetNodeId, 'recovered');
  // `toIf` uses truthiness, so every falsy value keeps the route unmatched.
  for (const recovered of [undefined, null, false, 0, '']) {
    assert.equal(jump.when({ recovered }), false);
  }
  assert.equal(jump.when({ recovered: {} }), true);
  // `toIfDefined` only tests for `undefined`, so `false` counts as present.
  assert.equal(route.toIfDefined('recovered', 'recovered').when({ recovered: false }), true);
});

test('equal routes read nested state paths and distinguish literal values from a second path', async () => {
  const { route } = await import('@jangts/agent-core/engine');
  const state = { decision: { id: 'ready' }, expected: { id: 'ready' } };
  assert.equal(route.toIfEqual('deliver', 'decision.id', 'ready').when(state), true);
  // A path in the third argument is a literal, so it never equals the state value.
  assert.equal(route.toIfEqual('deliver', 'decision.id', 'expected.id').when(state), false);
  // `toIfEqualWith` compares two state paths instead.
  assert.equal(route.toIfEqualWith('deliver', 'decision.id', 'expected.id').when(state), true);
  assert.equal(
    route.toIfEqualWith('deliver', 'decision.id', 'expected.id').when({ decision: state.decision }),
    false,
  );
  // Two missing paths are equal to each other.
  assert.equal(route.toIfEqualWith('deliver', 'decision.id', 'expected.id').when({}), true);
  const arrayState = { aaa: [{ bbb: 'ready' }], expected: state.expected };
  // Numeric segments address array positions.
  assert.equal(route.toIfEqual('deliver', 'aaa.0.bbb', 'ready').when(arrayState), true);
  assert.equal(route.toIfEqualWith('deliver', 'aaa.0.bbb', 'expected.id').when(arrayState), true);
});

test('node reports attach payload and runtime-owned sublogs without changing workflow state', async () => {
  // The report is only attached when the output accepts its content kind.
  for (const content of [true, false]) {
    const events = [];
    let subs, stepId;
    let reports = 0;
    const diagnostics = createDiagnostics({
      output: {
        accepts: (descriptor) => content || descriptor.content === 'metadata',
        write: (event) => events.push(event),
      },
    });
    const flow = workflow([
      node('round', [{ complete: (state) => state.result.text }], {
        run: (_, context) => {
          subs = context.createSubFlowLogger();
          stepId = subs.write({ name: 'Item', kind: 'check' });
          return { result: { text: 'answer' } };
        },
        report(update) {
          reports++;
          // The report may adjust the pending update, but routing still reads
          // the committed state.
          update.result.text = 'modified by report';
          return { payload: { count: 1 } };
        },
      }),
    ]);
    const core = new AgentCoreEngine({ workflow: flow, execution: { diagnostics } });
    assert.equal(await core.run({}), 'answer');
    const record = events.find(
      (event) => event.type === 'workflow.event' && event.payload.event.type === 'complete',
    );
    assert.equal(reports, content ? 1 : 0);
    assert.deepEqual(record.payload.payload, content ? { count: 1 } : undefined);
    assert.deepEqual(
      record.subSteps.map((step) => step.stepId),
      content ? [stepId] : [],
    );
  }
});

test('default entry and added nodes preserve class getters and private state', async () => {
  // A node may be a class instance; the catalog reads it structurally so the
  // private fields stay reachable.
  class Node {
    #id;
    #routes;
    constructor(id, routes) {
      this.#id = id;
      this.#routes = routes;
    }
    get id() {
      return this.#id;
    }
    get description() {
      return this.#id;
    }
    get routes() {
      return this.#routes;
    }
    run(state) {
      return { visits: [...state.visits, this.#id] };
    }
  }
  const finish = { complete: (state) => state.visits };
  const base = workflow([new Node('round', [finish])]);
  const extended = base.add({
    nodes: [new Node('reply', [finish])],
    routes: { round: [{ targetNodeId: 'reply' }] },
  });
  for (const [flow, expected] of [
    [base, ['round']],
    [extended, ['round', 'reply']],
  ]) {
    const runtime = new AgentCoreEngine({ workflow: flow });
    assert.deepEqual(await runtime.run({ visits: [] }), expected);
  }
});

test('direct and extended workflows reject the same conflicting node aliases', () => {
  const finish = { complete: () => 'ok' };
  const base = workflow([node('round', [finish])]);
  // The legacy aliases `round` and `onError` conflict with the current fields.
  for (const aliases of [
    { startsRound: true, round: false },
    { onErrorNodeId: 'round', onError: 'extra' },
  ]) {
    const extra = node('extra', [finish], aliases);
    const routes = { round: [{ targetNodeId: 'extra' }] };
    assert.throws(
      () => workflow([node('round', routes.round), extra]),
      /Use startsRound and onErrorNodeId: extra/,
    );
    // The extended form applies the same rule as a direct definition.
    assert.throws(
      () => base.add({ nodes: [extra], routes }),
      /Use startsRound and onErrorNodeId: extra/,
    );
  }
});

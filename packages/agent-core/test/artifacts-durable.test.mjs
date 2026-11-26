/*
 * Execution contract for `kits/artifacts` and `kits/durable`.
 *
 * Artifacts: a reference is resolved from its own identity fields plus a live
 * `OperationContext`, so a model-supplied URL, a stale revision or a foreign
 * owner cannot widen access, and cancellation wins over a late result.
 *
 * Durable tasks: checkpoint version 2 is the only accepted shape, attempts and
 * deadlines are never reset on resume, `safe` steps are never replayed once
 * committed, `reconcile` steps must reconcile instead of writing again, and
 * aborts/expiries never commit a half-applied state or erase a committed one.
 *
 * Runs on the built package entry points with an in-memory `store()` fixture
 * (clone on load/save, exclusive lock simulated by a `busy` flag); time is
 * injected through the `now` option so deadline cases stay deterministic.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiagnostics } from '@jangts/agent-core';
import { defineArtifactCatalog } from '@jangts/agent-core/kits/artifacts';
import { defineDurableTask } from '@jangts/agent-core/kits/durable';
const signal = () => new AbortController().signal;
const context = (app = {}, operationSignal = signal()) => ({ app, signal: operationSignal });
// Canonical checkpoint shape: version 2, attempt 0 of 4, a deadline far enough
// away that only the cases patching it observe expiry.
const initial = () => ({
  version: 2,
  definitionId: 'job',
  revision: 'v1',
  nextStepIndex: 0,
  attemptCount: 0,
  maxAttempts: 4,
  deadlineAtMs: Date.now() + 100000,
  status: 'ready',
  state: { values: [] },
});
const isState = (value) => !!value && Array.isArray(value.values);
function store(record = initial()) {
  let data = structuredClone(record),
    busy = false;
  return {
    // Mirrors a real lock: a concurrent admission fails instead of interleaving.
    exclusive: async (_id, operation) => {
      if (busy) throw Error('busy');
      busy = true;
      try {
        return await operation();
      } finally {
        busy = false;
      }
    },
    load: async () => structuredClone(data),
    save: async (_id, value) => {
      data = structuredClone(value);
    },
  };
}

test('artifact resolver checks live authorization/version, not a model supplied URL', async () => {
  const catalog = defineArtifactCatalog([
    {
      id: 'file',
      async resolve(ref, { app }) {
        if (app.owner !== 'owner' || ref.revision !== 'v1') throw Error('forbidden');
        return { id: ref.artifactId };
      },
    },
  ]);
  await assert.rejects(
    catalog.resolve(
      { resolverId: 'file', artifactId: 'id', revision: 'v1' },
      context({ owner: 'foreign' }),
    ),
    /forbidden/,
  );
  await assert.rejects(
    catalog.resolve(
      { resolverId: 'file', artifactId: 'id', revision: 'v2' },
      context({ owner: 'owner' }),
    ),
    /forbidden/,
  );
  assert.deepEqual(
    await catalog.resolve(
      // The extra `url` is model-controlled input and must be ignored entirely.
      { resolverId: 'file', artifactId: 'id', revision: 'v1', url: 'forged' },
      context({ owner: 'owner' }),
    ),
    { id: 'id' },
  );
  await assert.rejects(catalog.resolve({ resolverId: 'unknown', artifactId: 'id' }, context()));
});

test('artifact cancellation cannot accept a late resolved artifact', async () => {
  const controller = new AbortController();
  const catalog = defineArtifactCatalog([
    {
      id: 'file',
      resolve() {
        controller.abort();
        return 'late';
      },
    },
  ]);
  await assert.rejects(
    catalog.resolve({ resolverId: 'file', artifactId: 'id' }, context({}, controller.signal)),
    { name: 'AbortError' },
  );
});

test('a restarted task resumes after the committed step and completed results are not replayed', async () => {
  const backing = store();
  let fail = true,
    writes = 0;
  const definition = () =>
    defineDurableTask({
      id: 'job',
      revision: 'v1',
      isState,
      steps: [
        {
          id: 'first',
          replayPolicy: 'safe',
          async run(state) {
            writes++;
            return { values: [...state.values, 'first'] };
          },
        },
        {
          id: 'second',
          replayPolicy: 'safe',
          async run(state) {
            if (fail) {
              fail = false;
              throw Error('crash');
            }
            return { values: [...state.values, 'second'] };
          },
        },
      ],
    });
  await assert.rejects(definition().run({ taskId: 'id', store: backing }, context()), /crash/);
  // The completed step is committed before the crash, so resume starts at 1.
  assert.equal((await backing.load()).nextStepIndex, 1);
  assert.equal((await backing.load()).status, 'running');
  assert.deepEqual(await definition().run({ taskId: 'id', store: backing }, context()), {
    values: ['first', 'second'],
  });
  await definition().run({ taskId: 'id', store: backing }, context());
  // `first` ran once across all three attempts: committed steps are never replayed.
  assert.equal(writes, 1);
  // Two failed/resumed attempts plus the first = 3, even though work was not redone.
  assert.equal((await backing.load()).attemptCount, 3);
});

test('possibly committed writes require explicit reconciliation and cannot be replayed automatically', async () => {
  const record = initial();
  record.status = 'running';
  record.attemptCount = 1;
  const backing = store(record);
  let writes = 0;
  const step = {
    id: 'write',
    replayPolicy: 'reconcile',
    async run() {
      writes++;
      return { values: ['duplicate'] };
    },
  };
  assert.throws(
    () => defineDurableTask({ id: 'job', revision: 'v1', isState, steps: [step] }),
    /reconciliation/,
  );
  const recovered = defineDurableTask({
    id: 'job',
    revision: 'v1',
    isState,
    steps: [
      {
        ...step,
        async reconcile() {
          return { kind: 'completed', state: { values: ['existing receipt'] } };
        },
      },
    ],
  });
  assert.deepEqual(await recovered.run({ taskId: 'id', store: backing }, context()), {
    values: ['existing receipt'],
  });
  // Reconciliation reports what the previous attempt already wrote; running the
  // handler again would duplicate the side effect.
  assert.equal(writes, 0);
});

test('resumption never resets attempts/deadline and rejects incompatible revisions or cancelled tasks', async () => {
  const task = defineDurableTask({
    id: 'job',
    revision: 'v1',
    isState,
    steps: [
      {
        id: 'read',
        replayPolicy: 'safe',
        run() {
          assert.fail('must not run');
        },
      },
    ],
  });
  // Each patch breaks one independent resume invariant; none may be repaired by
  // starting over, and the handler must never be reached.
  for (const patch of [
    { attemptCount: 4 },
    { deadlineAtMs: 1 },
    { revision: 'old' },
    { status: 'cancelled' },
  ]) {
    await assert.rejects(
      task.run({ taskId: 'id', store: store({ ...initial(), ...patch }) }, context()),
    );
  }
});

test('aborting or failing a step does not commit its mutated local state', async () => {
  const controller = new AbortController(),
    backing = store();
  const task = defineDurableTask({
    id: 'job',
    revision: 'v1',
    isState,
    steps: [
      {
        id: 'read',
        replayPolicy: 'safe',
        async run(state) {
          state.values.push('must not commit');
          controller.abort();
          return state;
        },
      },
    ],
  });
  await assert.rejects(task.run({ taskId: 'id', store: backing }, context({}, controller.signal)));
  // The handler mutated its local state before the abort; that mutation must not
  // be committed, though the attempt still counts.
  assert.deepEqual((await backing.load()).state, { values: [] });
  assert.equal((await backing.load()).attemptCount, 1);
});

test(
  'persisted deadline interrupts a hung handler and refuses its late result',
  { timeout: 2000 },
  async () => {
    const record = initial();
    record.deadlineAtMs = Date.now() + 250;
    const backing = store(record);
    let finish, handlerSignal;
    const task = defineDurableTask({
      id: 'job',
      revision: 'v1',
      isState,
      steps: [
        {
          id: 'slow',
          replayPolicy: 'safe',
          run(_state, { signal }) {
            handlerSignal = signal;
            return new Promise((resolve) => {
              finish = resolve;
            });
          },
        },
      ],
    });
    await assert.rejects(task.run({ taskId: 'id', store: backing }, context()), /expired/);
    assert.equal(handlerSignal.aborted, true);
    // Resolving the hung handler after expiry must be ignored: the checkpoint has
    // to stay at the pre-step state.
    finish({ values: ['late'] });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal((await backing.load()).status, 'running');
    assert.deepEqual((await backing.load()).state, { values: [] });
  },
);

test('deadline expiry during checkpoint save prevents the next handler side effect', async () => {
  const record = initial();
  record.deadlineAtMs = 1000;
  let now = 0,
    saved;
  const backing = {
    exclusive: (_id, run) => run(),
    load: async () => record,
    save: async (_id, value) => {
      saved = structuredClone(value);
      // The clock advances past the deadline while committing, so expiry is
      // detected at commit time and the next handler never starts.
      now = 2000;
    },
  };
  const task = defineDurableTask(
    {
      id: 'job',
      revision: 'v1',
      isState,
      steps: [
        {
          id: 'side-effect',
          replayPolicy: 'safe',
          run() {
            assert.fail('must not run after deadline');
          },
        },
      ],
    },
    { now: () => now },
  );
  await assert.rejects(task.run({ taskId: 'id', store: backing }, context()), /expired/);
  assert.equal(saved.attemptCount, 1);
  assert.equal(saved.status, 'running');
});

test('artifact cancellation interrupts an uncooperative resolver and observes late rejection', async () => {
  const controller = new AbortController();
  let reject;
  const catalog = defineArtifactCatalog([
    {
      id: 'remote',
      resolve: () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    },
  ]);
  const pending = catalog.resolve(
    { resolverId: 'remote', artifactId: 'file' },
    context({}, controller.signal),
  );
  controller.abort(new Error('stop'));
  await assert.rejects(pending, /stop/);
  reject(new Error('late failure'));
  await new Promise((resolve) => setImmediate(resolve));
});

test('returned fresh and cached results cannot mutate a store-owned checkpoint by reference', async () => {
  let record = initial();
  const backing = {
    exclusive: (_id, operation) => operation(),
    load: async () => record,
    save: async (_id, value) => {
      record = value;
    },
  };
  const task = defineDurableTask({
    id: 'job',
    revision: 'v1',
    isState,
    steps: [
      {
        id: 'read',
        replayPolicy: 'safe',
        async run() {
          return { values: ['saved'] };
        },
      },
    ],
  });
  const fresh = await task.run({ taskId: 'id', store: backing }, context());
  fresh.values.push('changed');
  const cached = await task.run({ taskId: 'id', store: backing }, context());
  cached.values.push('changed again');
  assert.deepEqual(record.state, { values: ['saved'] });
});

test('artifact references use only the current identity fields', async () => {
  const reference = { resolverId: 'file', artifactId: 'saved', revision: 'r1', url: 'ignored' };
  const catalog = defineArtifactCatalog([{ id: 'file', resolve: (value) => value }]);
  assert.throws(() => defineArtifactCatalog([{ kind: 'file', resolve() {} }]), /artifact resolver/);
  await assert.rejects(
    catalog.resolve({ kind: 'file', id: 'saved', revision: 'r1' }, context()),
    /Invalid artifact reference/,
  );
  assert.deepEqual(await catalog.resolve(reference, context()), {
    resolverId: 'file',
    artifactId: 'saved',
    revision: 'r1',
  });
  await assert.rejects(catalog.resolve(reference, {}, signal()), /OperationContext/);
});

test('artifact definitions and references accept prototype getters and preserve resolver receivers', async () => {
  class Resolver {
    #owner = 'owner';
    get id() {
      return 'file';
    }
    resolve(reference, { app }) {
      assert.equal(app.owner, this.#owner);
      return reference;
    }
  }
  class Reference {
    #id = 'saved';
    get resolverId() {
      return 'file';
    }
    get artifactId() {
      return this.#id;
    }
    get revision() {
      return 'r1';
    }
  }
  const resolver = new Resolver(),
    catalog = defineArtifactCatalog([resolver]);
  resolver.resolve = () => assert.fail('the bound implementation must stay fixed');
  const reference = await catalog.resolve(new Reference(), context({ owner: 'owner' }));
  assert.deepEqual(reference, { resolverId: 'file', artifactId: 'saved', revision: 'r1' });
  assert.equal(Object.isFrozen(reference), true);
});

test('artifact reference getters cannot cancel and then start a resolver', async () => {
  const controller = new AbortController();
  const catalog = defineArtifactCatalog([
    {
      id: 'file',
      resolve() {
        assert.fail('must not resolve after cancellation');
      },
    },
  ]);
  const reference = {
    resolverId: 'file',
    get artifactId() {
      controller.abort();
      return 'saved';
    },
  };
  await assert.rejects(catalog.resolve(reference, context({}, controller.signal)), {
    name: 'AbortError',
  });
});

test('durable execution rejects removed definition, step and positional run contracts', async () => {
  const step = {
    id: 'read',
    replayPolicy: 'safe',
    async run(state) {
      return state;
    },
  };
  assert.throws(
    () => defineDurableTask({ id: 'job', revision: 'v1', validate: isState, steps: [step] }),
    /durable task/,
  );
  assert.throws(
    () =>
      defineDurableTask({
        id: 'job',
        revision: 'v1',
        isState,
        steps: [{ id: step.id, replay: 'safe', run: step.run }],
      }),
    /durable step/,
  );
  const task = defineDurableTask({ id: 'job', revision: 'v1', isState, steps: [step] });
  await assert.rejects(task.run('id', store(), {}, signal()), /named durable task request/);
});

test('current checkpoints support prototype getters without mutating state or budgets', async () => {
  const original = {
    ...initial(),
    nextStepIndex: 1,
    attemptCount: 3,
    status: 'completed',
    state: { values: ['saved'] },
  };
  const prototype = Object.defineProperties(
    {},
    Object.fromEntries(
      Object.entries(original).map(([key, value]) => [
        key,
        {
          get() {
            return value;
          },
        },
      ]),
    ),
  );
  const backing = {
    exclusive: (_id, operation) => operation(),
    load: async () => Object.create(prototype),
    async save() {
      assert.fail('completed checkpoints need no write');
    },
  };
  const task = defineDurableTask({
    id: 'job',
    revision: 'v1',
    isState,
    steps: [
      {
        id: 'read',
        replayPolicy: 'safe',
        async run() {
          assert.fail('completed checkpoints must not replay');
        },
      },
    ],
  });
  const result = await task.run({ taskId: 'id', store: backing }, context());
  assert.deepEqual(result, { values: ['saved'] });
  result.values.push('changed');
  assert.deepEqual(original.state, { values: ['saved'] });
  assert.equal(original.attemptCount, 3);
  assert.equal(original.version, 2);
});

test('unsupported checkpoint versions are rejected without writes or handler execution', async () => {
  const task = defineDurableTask({
    id: 'job',
    revision: 'v1',
    isState,
    steps: [
      {
        id: 'read',
        replayPolicy: 'safe',
        async run() {
          assert.fail('must not execute');
        },
      },
    ],
  });
  // Both a legacy v1 record and an unknown future v3 must be refused before any
  // write or handler call; silently upgrading either would corrupt the log.
  for (const record of [
    {
      version: 1,
      definition: 'job',
      revision: 'v1',
      next: 0,
      attempts: 0,
      maxAttempts: 4,
      deadline: Date.now() + 100000,
      status: 'ready',
      state: { values: [] },
    },
    { ...initial(), version: 3 },
  ]) {
    const backing = {
      exclusive: (_id, operation) => operation(),
      load: async () => record,
      async save() {
        assert.fail('unsupported data must not be rewritten');
      },
    };
    await assert.rejects(
      task.run({ taskId: 'id', store: backing }, context()),
      /Unsupported durable checkpoint version/,
    );
  }
});

test('durable definitions, steps, clocks and stores preserve private-state receivers and getter configuration', async () => {
  class Clock {
    #time = 0;
    now() {
      return this.#time;
    }
  }
  class Step {
    #value = 'bound';
    get id() {
      return 'read';
    }
    get replayPolicy() {
      return 'safe';
    }
    async run(state, { app }) {
      return { values: [...state.values, this.#value, app.value] };
    }
  }
  class Definition {
    #steps = [new Step()];
    #valid = true;
    get id() {
      return 'job';
    }
    get revision() {
      return 'v1';
    }
    get steps() {
      return this.#steps;
    }
    isState(value) {
      return this.#valid && isState(value);
    }
  }
  class Store {
    #record = { ...initial(), deadlineAtMs: 1000 };
    #locked = false;
    async exclusive(_id, operation) {
      this.#locked = true;
      try {
        return await operation();
      } finally {
        this.#locked = false;
      }
    }
    async load() {
      assert.equal(this.#locked, true);
      return this.#record;
    }
    async save(_id, record) {
      assert.equal(this.#locked, true);
      this.#record = record;
    }
  }
  const definition = new Definition(),
    task = defineDurableTask(definition, new Clock());
  definition.steps[0].run = () => assert.fail('handler must have been bound during definition');
  assert.deepEqual(
    await task.run({ taskId: 'id', store: new Store() }, context({ value: 'request' })),
    { values: ['bound', 'request'] },
  );
});

test('durable cancellation before lock admission or while waiting for it does not load or spend an attempt', async () => {
  const task = defineDurableTask({
    id: 'job',
    revision: 'v1',
    isState,
    steps: [
      {
        id: 'read',
        replayPolicy: 'safe',
        async run() {
          assert.fail('must not execute');
        },
      },
    ],
  });
  const controller = new AbortController(),
    reason = new Error('stop');
  let locks = 0;
  const backing = {
    async exclusive(_id, operation) {
      locks++;
      controller.abort(reason);
      return operation();
    },
    async load() {
      assert.fail('must not load');
    },
    async save() {
      assert.fail('must not save');
    },
  };
  await assert.rejects(
    task.run({ taskId: 'id', store: backing }, context({}, controller.signal)),
    (error) => error === reason,
  );
  assert.equal(locks, 1);
  // A second run on the already-aborted signal must fail before asking for the
  // lock again, so it neither loads nor spends an attempt.
  await assert.rejects(
    task.run({ taskId: 'id', store: backing }, context({}, controller.signal)),
    (error) => error === reason,
  );
  assert.equal(locks, 1);
});

test('cancellation from a state predicate cannot confirm a completed checkpoint', async () => {
  const controller = new AbortController(),
    backing = store(),
    reason = new Error('stop during validation');
  const task = defineDurableTask({
    id: 'job',
    revision: 'v1',
    isState(value) {
      if (value?.values?.includes('result')) controller.abort(reason);
      return isState(value);
    },
    steps: [
      {
        id: 'read',
        replayPolicy: 'safe',
        async run() {
          return { values: ['result'] };
        },
      },
    ],
  });
  await assert.rejects(
    task.run({ taskId: 'id', store: backing }, context({}, controller.signal)),
    (error) => error === reason,
  );
  const saved = await backing.load();
  assert.equal(saved.status, 'running');
  assert.equal(saved.nextStepIndex, 0);
  assert.equal(saved.attemptCount, 1);
  assert.deepEqual(saved.state, { values: [] });
});

test('cancellation during final save waits for the locked commit and does not pretend to roll it back', async () => {
  let record = initial(),
    locked = false,
    enterSave,
    releaseSave,
    settled = false;
  const saving = new Promise((resolve) => {
      enterSave = resolve;
    }),
    released = new Promise((resolve) => {
      releaseSave = resolve;
    });
  const backing = {
    async exclusive(_id, operation) {
      assert.equal(locked, false);
      locked = true;
      try {
        return await operation();
      } finally {
        locked = false;
      }
    },
    async load() {
      return record;
    },
    async save(_id, value) {
      if (value.status === 'completed') {
        enterSave();
        await released;
      }
      record = structuredClone(value);
    },
  };
  let calls = 0;
  const task = defineDurableTask({
    id: 'job',
    revision: 'v1',
    isState,
    steps: [
      {
        id: 'read',
        replayPolicy: 'safe',
        async run() {
          calls++;
          return { values: ['committed'] };
        },
      },
    ],
  });
  const controller = new AbortController(),
    reason = new Error('stop during commit');
  const pending = task.run({ taskId: 'id', store: backing }, context({}, controller.signal));
  const rejection = assert.rejects(pending, (error) => error === reason);
  pending.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  await saving;
  controller.abort(reason);
  await new Promise((resolve) => setImmediate(resolve));
  // Abort arrives mid-commit: the call must not settle while the lock is held,
  // and after release the committed checkpoint stays completed.
  assert.equal(locked, true);
  assert.equal(settled, false);
  releaseSave();
  await rejection;
  assert.equal(locked, false);
  assert.equal(record.status, 'completed');
  assert.equal(record.attemptCount, 1);
  assert.deepEqual(await task.run({ taskId: 'id', store: backing }, context()), {
    values: ['committed'],
  });
  assert.equal(calls, 1);
});

test('expiry during the final save rejects without erasing the already committed checkpoint', async () => {
  let record = { ...initial(), deadlineAtMs: 1000 },
    now = 0;
  const backing = {
    exclusive: (_id, operation) => operation(),
    load: async () => record,
    async save(_id, value) {
      record = structuredClone(value);
      if (value.status === 'completed') now = 1001;
    },
  };
  const task = defineDurableTask(
    {
      id: 'job',
      revision: 'v1',
      isState,
      steps: [
        {
          id: 'read',
          replayPolicy: 'safe',
          async run() {
            return { values: ['saved'] };
          },
        },
      ],
    },
    { now: () => now },
  );
  await assert.rejects(task.run({ taskId: 'id', store: backing }, context()), /expired/);
  assert.equal(record.status, 'completed');
  assert.equal(record.deadlineAtMs, 1000);
  assert.equal(record.attemptCount, 1);
});

test('durable handlers receive the current loop child diagnostics on normal execution and reconciliation', async () => {
  const events = [],
    contexts = [];
  const diagnostics = createDiagnostics({
    runId: 'durable-run',
    spanId: 'parent',
    output: {
      write(event) {
        events.push(event);
      },
    },
  });
  const record = { ...initial(), status: 'running', attemptCount: 1 };
  const task = defineDurableTask({
    id: 'job',
    revision: 'v1',
    isState,
    steps: [
      {
        id: 'recover',
        replayPolicy: 'reconcile',
        async run() {
          assert.fail('must reconcile');
        },
        async reconcile(state, execution) {
          contexts.push(execution);
          return { kind: 'completed', state: { values: [...state.values, 'reconciled'] } };
        },
      },
      {
        id: 'read',
        replayPolicy: 'safe',
        async run(state, execution) {
          contexts.push(execution);
          return state;
        },
      },
    ],
  });
  await task.run({ taskId: 'id', store: store(record) }, { ...context(), diagnostics });
  assert.equal(contexts.length, 2);
  assert.notEqual(contexts[0].diagnostics, diagnostics);
  assert.notEqual(contexts[0].diagnostics.identity.spanId, contexts[1].diagnostics.identity.spanId);
  for (const execution of contexts) {
    assert.equal(execution.diagnostics.identity.parentSpanId, 'parent');
    assert.equal(execution.diagnostics.identity.nodeRole, 'loop-step');
    assert.ok(
      events.some(
        (event) =>
          event.payload.type === 'enter' && event.spanId === execution.diagnostics.identity.spanId,
      ),
    );
  }
});

test('durable store and handler failures retain their original error identity', async () => {
  const failure = new Error('source failure'),
    backing = store();
  const task = defineDurableTask({
    id: 'job',
    revision: 'v1',
    isState,
    steps: [
      {
        id: 'read',
        replayPolicy: 'safe',
        async run() {
          throw failure;
        },
      },
    ],
  });
  await assert.rejects(
    task.run(
      {
        taskId: 'id',
        store: {
          ...backing,
          async load() {
            throw failure;
          },
        },
      },
      context(),
    ),
    (error) => error === failure,
  );
  await assert.rejects(
    task.run({ taskId: 'id', store: backing }, context()),
    (error) => error === failure,
  );
  assert.equal((await backing.load()).status, 'running');
  assert.equal((await backing.load()).attemptCount, 1);
});

test('canonical artifact and durable implementations may carry extra members without changing the execution contract', async () => {
  class Resolver {
    id = 'file';
    kind = 'application-metadata';
    resolve(reference) {
      return reference.artifactId;
    }
  }
  const catalog = defineArtifactCatalog([new Resolver()]);
  assert.equal(
    await catalog.resolve({ resolverId: 'file', artifactId: 'saved' }, context()),
    'saved',
  );
  class Step {
    id = 'read';
    replayPolicy = 'safe';
    replay = 'application-metadata';
    async run() {
      return { values: ['canonical'] };
    }
  }
  class Definition {
    id = 'job';
    revision = 'v1';
    steps = [new Step()];
    isState(value) {
      return isState(value);
    }
    validate() {
      assert.fail('an extra member must not replace isState');
    }
  }
  const result = await defineDurableTask(new Definition()).run(
    { taskId: 'id', store: store() },
    context(),
  );
  assert.deepEqual(result, { values: ['canonical'] });
});

test('cancelled task status is only exposed after current read authorization', async () => {
  const denied = Error('current access denied');
  const operations = [];
  const task = defineDurableTask({ id: 'job', revision: 'v1', isState,
    authorize(_record, execution) { operations.push(execution.operation); throw denied; },
    steps: [{ id: 'write', replayPolicy: 'safe', async run() { assert.fail('must not execute'); } }],
  });
  await assert.rejects(task.run({ taskId: 'id', store: store({ ...initial(), status: 'cancelled' }) }, context()),
    error => error === denied);
  assert.deepEqual(operations, ['read']);
});

test('a running checkpoint requires a persisted attempt before any reconciliation', async () => {
  let writes = 0;
  const backing = store({ ...initial(), status: 'running', attemptCount: 0 });
  const task = defineDurableTask({ id: 'job', revision: 'v1', isState,
    steps: [{ id: 'write', replayPolicy: 'reconcile',
      async run() { assert.fail('must not execute'); },
      async reconcile() { assert.fail('must not reconcile an unrecorded attempt'); },
    }],
  });
  await assert.rejects(task.run({ taskId: 'id', store: {
    ...backing, async save() { writes++; },
  } }, context()), /Invalid durable checkpoint/);
  assert.equal(writes, 0);
});

test('a later running step requires its own persisted attempt', async () => {
  const backing = store({ ...initial(), status: 'running', nextStepIndex: 1, attemptCount: 1 });
  const steps = ['first', 'second'].map(id => ({ id, replayPolicy: 'reconcile',
    async run() { assert.fail('invalid checkpoint must not execute'); },
    async reconcile() { assert.fail('the current attempt was never recorded'); },
  }));
  const task = defineDurableTask({ id: 'job', revision: 'v1', isState, steps });
  await assert.rejects(task.run({ taskId: 'id', store: backing }, context()), /Invalid durable checkpoint/);
});

test('read-only reconciliation confirms exhausted expired work without a new attempt or model reservation', async () => {
  const saved = { ...initial(), status: 'running', attemptCount: 4, deadlineAtMs: 1,
    modelBudget: { maxCalls: 2, reservedCalls: 2, maxCallsPerAttempt: 1 } };
  const backing = store(saved), operations = [];
  const task = defineDurableTask({ id: 'job', revision: 'v1', isState,
    authorize(_record, execution) { operations.push(execution.operation); },
    steps: [{ id: 'write', replayPolicy: 'reconcile', run() { assert.fail('must not write'); },
      async reconcile(_state, execution) {
        assert.equal(execution.maxModelCalls, 0);
        assert.equal(execution.attemptCount, 4);
        return { kind: 'completed', state: { values: ['receipt'] } };
      } }],
  });
  assert.deepEqual(await task.run({ taskId: 'id', store: backing }, context()), { values: ['receipt'] });
  assert.deepEqual(await task.run({ taskId: 'id', store: backing }, context()), { values: ['receipt'] });
  const completed = await backing.load();
  assert.equal(completed.attemptCount, 4);
  assert.equal(completed.modelBudget.reservedCalls, 2);
  assert.equal(completed.version, 2);
  assert.equal(typeof completed.commitId, 'string');
  assert.deepEqual(operations, ['reconcile', 'read']);
});

test('unknown and malformed confirmations never advance, reserve, or accept legacy State results', async () => {
  for (const resolution of [{ kind: 'unknown', reason: 'still pending' }, { values: [] }]) {
    const backing = store({ ...initial(), status: 'running', attemptCount: 1 });
    const task = defineDurableTask({ id: 'job', revision: 'v1', isState,
      steps: [{ id: 'write', replayPolicy: 'reconcile', run() { assert.fail('must not execute'); },
        async reconcile() { return resolution; } }],
    });
    const before = await backing.load();
    await assert.rejects(task.run({ taskId: 'id', store: backing }, context()), error =>
      resolution.kind === 'unknown' ? error.code === 'DURABLE_UNRESOLVED' : error instanceof TypeError);
    assert.deepEqual(await backing.load(), before);
  }
});

test('confirmed absence preserves old reservations and uses stable operation identity for a new authorized attempt', async () => {
  const backing = store({ ...initial(), status: 'running', attemptCount: 1,
    modelBudget: { maxCalls: 3, reservedCalls: 1, maxCallsPerAttempt: 1 } });
  const identities = [], operations = [];
  const task = defineDurableTask({ id: 'job', revision: 'v1', isState,
    authorize(_record, execution) { operations.push(execution.operation); },
    steps: [{ id: 'write', replayPolicy: 'reconcile',
      async reconcile(_state, execution) {
        identities.push(execution.operationId);
        return { kind: 'not-executed' };
      },
      async run(_state, execution) {
        identities.push(execution.operationId);
        assert.equal(execution.attemptCount, 2);
        return { values: ['written'] };
      } }],
  });
  await task.run({ taskId: 'id', store: backing }, context());
  assert.equal(identities[0], identities[1]);
  assert.deepEqual(JSON.parse(identities[0]), ['job', 'v1', 'id', 'write']);
  assert.equal((await backing.load()).modelBudget.reservedCalls, 2);
  assert.deepEqual(operations, ['reconcile', 'execute']);
});

test('confirmed absence cannot bypass exhausted execution attempts or expired execution deadlines', async () => {
  for (const patch of [{ attemptCount: 4 }, { deadlineAtMs: 1 }]) {
    const backing = store({ ...initial(), status: 'running', attemptCount: 1, ...patch });
    const task = defineDurableTask({ id: 'job', revision: 'v1', isState,
      steps: [{ id: 'write', replayPolicy: 'reconcile', run() { assert.fail('must not retry'); },
        async reconcile() { return { kind: 'not-executed' }; } }],
    });
    await assert.rejects(task.run({ taskId: 'id', store: backing }, context()), /exhausted|expired/);
    assert.equal((await backing.load()).status, 'ready');
    assert.equal((await backing.load()).attemptCount, patch.attemptCount ?? 1);
  }
});

test('save acknowledgement loss reads back exact commit identity without replaying an operation', async () => {
  for (const failureAt of ['running', 'completed']) {
    const backing = store(), seen = [], failure = Error('acknowledgement lost');
    let executions = 0;
    const task = defineDurableTask({ id: 'job', revision: 'v1', isState,
      steps: [{ id: 'write', replayPolicy: 'reconcile', async run() {
        executions++; return { values: ['receipt'] };
      }, async reconcile() { assert.fail('confirmed saves must not require reconciliation'); } }],
    });
    const unreliable = { ...backing, async save(id, record) {
      seen.push(record.commitId);
      await backing.save(id, record);
      if (record.status === failureAt) throw failure;
    } };
    assert.deepEqual(await task.run({ taskId: 'id', store: unreliable }, context()), { values: ['receipt'] });
    await task.run({ taskId: 'id', store: unreliable }, context());
    assert.equal(executions, 1);
    assert.equal(new Set(seen).size, 2);
  }
});

test('unconfirmed saves retain original storage failure and cannot start a side effect', async () => {
  const failure = Error('not persisted'), backing = store();
  const task = defineDurableTask({ id: 'job', revision: 'v1', isState,
    steps: [{ id: 'write', replayPolicy: 'safe', run() { assert.fail('must not write'); } }],
  });
  await assert.rejects(task.run({ taskId: 'id', store: { ...backing, async save() { throw failure; } } }, context()),
    error => error === failure);
  assert.equal((await backing.load()).attemptCount, 0);
});

test('optional commit identity rejects malformed values and read-back failure preserves the original save error', async () => {
  const task = defineDurableTask({ id: 'job', revision: 'v1', isState,
    steps: [{ id: 'write', replayPolicy: 'safe', run() { assert.fail('must not write'); } }],
  });
  for (const commitId of ['', ' ', 1, null]) {
    await assert.rejects(task.run({ taskId: 'id', store: store({ ...initial(), commitId }) }, context()),
      /commit identity/);
  }
  const failure = Error('save failed');
  let reads = 0;
  await assert.rejects(task.run({ taskId: 'id', store: {
    exclusive: (_id, operation) => operation(),
    async load() { if (++reads > 1) throw Error('read-back failed'); return initial(); },
    async save() { throw failure; },
  } }, context()), error => error === failure);
});

test('invalid reconciliation reasons fail without replaying the ambiguous write', async () => {
  const record = { ...initial(), status: 'running', attemptCount: 1 };
  const backing = store(record);
  const task = defineDurableTask({
    id: 'job', revision: 'v1', isState, steps: [{
      id: 'write', replayPolicy: 'reconcile',
      async run() { assert.fail('ambiguous operation was replayed'); },
      async reconcile() { return { kind: 'unknown', reason: { unsupported: true } }; },
    }],
  });
  await assert.rejects(task.run({ taskId: 'id', store: backing }, context()), /Invalid durable reconciliation reason/);
});

test('an interrupted step uses the reconciliation handler captured with its definition', async () => {
  const step = {
    id: 'write', replayPolicy: 'reconcile', receipt: { values: ['confirmed'] },
    async run() { assert.fail('an interrupted write was replayed'); },
    async reconcile() { return { kind: 'completed', state: this.receipt }; },
  };
  const task = defineDurableTask({ id: 'job', revision: 'v1', isState, steps: [step] });
  step.reconcile = async () => assert.fail('definition changed after binding');
  const backing = store({ ...initial(), status: 'running', attemptCount: 1 });
  assert.deepEqual(await task.run({ taskId: 'id', store: backing }, context()), { values: ['confirmed'] });
});

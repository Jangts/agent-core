/**
 * Locks down shared synchronous-contract mechanisms: schema compile/convert setup,
 * evidence source selection, the branch identity shared by Engine and Family, combined
 * cancellation lifetimes, void assertions, detached diagnostic projection and model
 * delivery. Runs under node --test as unit tests with in-memory stubs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { combineSignals, awaitWithSignal } from '../dist/esm/utils/cancellation.js';
import { booleanResult, maybeAssertion } from '../dist/esm/utils/synchronous.js';
import { AgentCoreEngine, ModelRunner, Support, createDiagnostics } from '../dist/esm/index.js';
import { defineAgentFamily } from '../dist/esm/kits/family.js';
import { defineEvidenceProjection } from '../dist/esm/kits/evidence.js';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

test('schema compilation and conversion reject asynchronous setup before producing an adapter', () => {
  // Adapters are synchronous by contract, so a promise-returning compiler is refused here
  // instead of failing later on the first parse.
  assert.throws(() => Support.fromJsonSchema({}, { compile: () => Promise.resolve(() => true) }), {
    name: 'TypeError',
    message: 'Schema compilers must be synchronous',
  });
  for (const invalid of [undefined, null, true, {}]) {
    assert.throws(() => Support.fromJsonSchema({}, { compile: () => invalid }), {
      name: 'TypeError',
      message: 'Schema compilers must return a validator',
    });
  }
  assert.throws(
    () =>
      Support.fromParserSchema(
        { parse: (value) => value },
        { toJsonSchema: () => Promise.resolve({}) },
      ),
    { name: 'TypeError', message: 'Schema conversion must be synchronous' },
  );
});

test('schema setup and error factories consume accidental rejected promises and preserve callback receivers', async () => {
  assert.throws(
    () => Support.fromJsonSchema({}, { compile: () => Promise.reject(Error('late compiler')) }),
    /compilers must be synchronous/,
  );
  assert.throws(
    () =>
      Support.fromParserSchema(
        { parse: (value) => value },
        { toJsonSchema: () => Promise.reject(Error('late conversion')) },
      ),
    /conversion must be synchronous/,
  );
  const invalid = Support.fromJsonSchema(
    {},
    { compile: () => () => false, error: () => Promise.reject(Error('late factory')) },
  );
  assert.throws(() => invalid.parse({}), {
    name: 'TypeError',
    message: 'Schema error factories must be synchronous',
  });
  class Compiler {
    #error = Error('real validation error');
    compile() {
      this.#error;
      return Object.assign(() => false, { errors: 'invalid' });
    }
    error(_value, issues) {
      assert.equal(issues, 'invalid');
      return this.#error;
    }
    get expected() {
      return this.#error;
    }
  }
  const compiler = new Compiler(),
    schema = Support.fromJsonSchema({}, compiler);
  assert.throws(
    () => schema.parse({}),
    (value) => value === compiler.expected,
  );
  class Converter {
    #schema = { type: 'string' };
    toJsonSchema() {
      return this.#schema;
    }
  }
  assert.equal(
    Support.fromParserSchema({ parse: (value) => value }, new Converter()).jsonSchema.type,
    'string',
  );
  // Drain microtasks so an unhandled rejection from the consumed setup promises fails here.
  await new Promise((resolve) => setImmediate(resolve));
});

test('evidence source selectors reject async outcomes before publishing a filtered observation', async () => {
  for (const sourceId of [
    () => Promise.resolve('source'),
    () => Promise.reject(Error('late source selector')),
  ]) {
    let published = 0;
    const projection = defineEvidenceProjection({
      sourceId,
      providers: {
        read: {
          sources: (observation) => observation.sources,
          withSources(observation, sources) {
            published++;
            return { ...observation, sources };
          },
        },
      },
    });
    assert.throws(
      () =>
        projection.project({
          observations: [{ toolId: 'read', sources: [{ id: 'source' }] }],
          sourceIds: ['source'],
        }),
      { name: 'TypeError', message: 'Evidence source selectors must be synchronous' },
    );
    assert.equal(published, 0);
  }
  // A rejected selector promise must not surface later as an unhandled rejection.
  await new Promise((resolve) => setImmediate(resolve));
});

test('Engine checkpoints and Family storage accept and reject the same branch identity contract', async () => {
  const source = {
    agentId: 'agent',
    branchId: 'main',
    agentVersionId: '1',
    parentBranchId: 'parent',
    parentAgentVersionId: '0',
    forkPointId: 'checkpoint',
  };
  const family = defineAgentFamily({
    store: { load: async () => undefined, compareAndSwap: async () => true },
    isState: () => true,
    authorize() {},
    validate() {},
  });
  for (const field of Object.keys(source)) {
    for (const invalid of ['', ' ', 'x'.repeat(201), 1]) {
      const branch = { ...source, [field]: invalid };
      // Engine construction and Family storage must reject the exact same identity shapes.
      assert.throws(() => new AgentCoreEngine({ branch }), /Invalid branch identity/);
      await assert.rejects(
        family.create(
          { id: 'family', branch, state: {} },
          { app: {}, signal: new AbortController().signal },
        ),
        /Invalid branch identity/,
      );
    }
  }
  class Branch {
    get agentId() {
      return 'agent';
    }
    get branchId() {
      return 'main';
    }
    get agentVersionId() {
      return '1';
    }
  }
  const engine = new AgentCoreEngine({ branch: new Branch() });
  const stored = await family.create(
    { id: 'family', branch: new Branch(), state: {} },
    { app: {}, signal: new AbortController().signal },
  );
  assert.deepEqual(stored.versions[0].branch, engine.branch);
  assert.equal(Object.isFrozen(engine.branch), true);
  const checkpoint = engine.exportCheckpoint(engine.checkpoint({ value: 1 }));
  assert.deepEqual(
    new AgentCoreEngine({ branch: new Branch() }).restoreCheckpoint(checkpoint).read(),
    { value: 1 },
  );
});

test('combined lifetimes retain parent/local cancellation, input order and single-signal identity', () => {
  const parent = new AbortController(),
    local = new AbortController();
  // A single distinct signal is returned as-is so identity checks and listener cleanup work.
  assert.equal(combineSignals(undefined, parent.signal, parent.signal), parent.signal);
  assert.equal(combineSignals().aborted, false);
  for (const selected of ['parent', 'local']) {
    const a = new AbortController(),
      b = new AbortController(),
      reason = Object.freeze(Error(selected));
    const signal = combineSignals(a.signal, undefined, b.signal, a.signal);
    (selected === 'parent' ? a : b).abort(reason);
    assert.equal(signal.reason, reason);
  }
  parent.abort('parent');
  local.abort('local');
  // When both are already aborted, argument order decides the reported reason.
  assert.equal(combineSignals(parent.signal, local.signal).reason, 'parent');
  assert.equal(combineSignals(local.signal, parent.signal).reason, 'local');
});

test('synchronous and asynchronous assertions share void rules without turning sync tools into async tools', async () => {
  assert.equal(maybeAssertion(undefined, 'void only'), undefined);
  // Any defined return - including false, 0 and '' - violates the void contract, while a
  // thenable that resolves undefined is accepted.
  for (const value of [false, true, null, 0, '', {}]) {
    assert.throws(() => maybeAssertion(value, 'void only'), {
      name: 'TypeError',
      message: 'void only',
    });
    await assert.rejects(maybeAssertion(Promise.resolve(value), 'void only'), {
      name: 'TypeError',
      message: 'void only',
    });
  }
  assert.equal(
    await maybeAssertion(
      {
        then(resolve) {
          resolve();
        },
      },
      'void only',
    ),
    undefined,
  );
  let effects = 0;
  const tools = Support.defineToolCatalog([
    {
      id: 'tool',
      kind: 'read',
      description: 'Read',
      inputSchema: { jsonSchema: { type: 'object' }, parse: (value) => value },
      authorize() {},
      execute() {
        effects++;
        return 'answer';
      },
      parseOutput: (value) => value,
    },
  ]).bind({ app: {} });
  assert.equal(tools.invokeSync({ toolId: 'tool', input: {} }).value, 'answer');
  assert.equal((await tools.invoke({ toolId: 'tool', input: {} })).value, 'answer');
  // Sync and async entry points each run the effect once; the sync path never awaits.
  assert.equal(effects, 2);
});

test('predicate validation retains true/false, distinct errors and consumes rejected async results', async () => {
  assert.equal(booleanResult(false, 'async', 'boolean'), false);
  assert.equal(booleanResult(true, 'async', 'boolean'), true);
  for (const value of [undefined, null, 0, 'true', {}])
    assert.throws(() => booleanResult(value, 'async', 'boolean'), {
      name: 'TypeError',
      message: 'boolean',
    });
  assert.throws(() => booleanResult(Promise.reject(Error('late')), 'async', 'boolean'), {
    name: 'TypeError',
    message: 'async',
  });
  // A thenable is also treated as an asynchronous outcome rather than a truthy value.
  assert.throws(() => booleanResult({ then() {} }, 'async', 'boolean'), /async/);
  await new Promise((resolve) => setImmediate(resolve));
});

test('shared cancellation wait detaches listeners after success/failure and observes abandoned rejections', async () => {
  const controller = new AbortController(),
    signal = controller.signal;
  const add = signal.addEventListener.bind(signal),
    remove = signal.removeEventListener.bind(signal);
  let listeners = 0;
  signal.addEventListener = (...args) => {
    listeners++;
    return add(...args);
  };
  signal.removeEventListener = (...args) => {
    listeners--;
    return remove(...args);
  };
  assert.equal(await awaitWithSignal('answer', signal), 'answer');
  // Zero listeners after success, failure and abort: the wait never leaks subscriptions.
  assert.equal(listeners, 0);
  const error = Error('original');
  await assert.rejects(awaitWithSignal(Promise.reject(error), signal), (value) => value === error);
  assert.equal(listeners, 0);
  const late = deferred(),
    pending = awaitWithSignal(late.promise, signal);
  controller.abort(error);
  await assert.rejects(pending, (value) => value === error);
  assert.equal(listeners, 0);
  late.reject(Error('abandoned'));
  // The abandoned promise still rejects; draining microtasks proves it is handled internally.
  await new Promise((resolve) => setImmediate(resolve));
});

test('model delivery retains microtask cancellation and cannot enter a pre-cancelled sink', async () => {
  const controller = new AbortController();
  let delivered = 0,
    startedProvider = 0;
  const model = new ModelRunner({
    execution: { signal: controller.signal },
    provider: {
      async *stream() {
        startedProvider++;
        yield 'answer';
      },
    },
    sink: {
      output(event) {
        if (event.type === 'model.start') delivered++;
      },
    },
  });
  const pending = model.invoke('question');
  controller.abort();
  // Cancellation is observed before the provider starts, so no start event reaches the sink.
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(delivered, 0);
  assert.equal(startedProvider, 0);
});

test('diagnostic listeners, log outputs and sinks use one detached metadata fallback', async () => {
  const logged = [],
    observed = [],
    delivered = [];
  const scope = createDiagnostics({
    output: {
      write: (record) => {
        logged.push(record);
      },
    },
    observe: {
      accepts: () => true,
      event: (record) => {
        observed.push(record);
      },
    },
  });
  await scope.deliver(
    'tool.result',
    () => ({
      toolId: 'tool',
      invocationId: 'call',
      status: 'success',
      durationMs: 2,
      value: () => 'not cloneable',
    }),
    (record) => {
      delivered.push(record);
    },
  );
  assert.equal(logged.length, 1);
  assert.equal(observed.length, 1);
  assert.equal(delivered.length, 1);
  assert.deepEqual(logged[0], observed[0]);
  assert.deepEqual(observed[0], delivered[0]);
  // Three consumers receive three detached copies, so mutating one cannot affect another.
  assert.notEqual(logged[0], observed[0]);
  assert.notEqual(observed[0], delivered[0]);
  // A non-cloneable field is dropped rather than aborting the whole delivery.
  assert.equal(Object.hasOwn(delivered[0].payload, 'value'), false);
  delivered[0].payload.toolId = 'changed';
  assert.equal(logged[0].payload.toolId, 'tool');
});

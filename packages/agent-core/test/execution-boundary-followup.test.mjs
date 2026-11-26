/*
 * Follow-up cancellation coverage: every remaining point where a callback could
 * still run after an abort, plus two expiry/cleanup rules.
 *
 * The first block aborts from inside an observer or predicate at a named phase
 * (loop enter, workflow enter, route evaluation, completion) and asserts that the
 * next callback never runs. The rest does the same for tool receipts, token
 * preflight, model.start, the response factory, model.output, answer checkers and
 * the answer flow, then covers reflection log discovery (late pages are discarded,
 * expired evidence denies access) and provider iterator cleanup.
 *
 * Runs on `dist/esm` with fake providers and transports; `promptly()` bounds the
 * wait so a hanging cancellation fails instead of stalling the suite.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentCoreEngine, ModelRunner, ToolRegistry, defineWorkflow } from '../dist/esm/index.js';
import { defineAnswerCheckCatalog, defineAnswerFlow } from '../dist/esm/kits/answering/index.js';
import { defineReflectionLogSource } from '../dist/esm/kits/reflection.js';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const tick = () => new Promise((resolve) => setImmediate(resolve));
const context = (signal) => ({ app: {}, signal });
const page = (items) => ({
  items,
  status: 'end',
  coverage: { exhausted: true },
  issues: [],
  issuesOmitted: 0,
});
// Cancellation must settle the query instead of waiting for the reader, so the
// assertion races the pending call against a short wall-clock guard.
async function promptly(pending) {
  let timer;
  try {
    return await Promise.race([
      pending,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error('Cancellation did not settle the query')), 250);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
function transport(handlers = {}) {
  return {
    id: 'custom',
    prepare: () => ({
      options: {},
      schemaChars: 0,
      createResponse: () => ({ outputChars: 0, push() {}, finish: () => 'answer', ...handlers }),
    }),
  };
}

for (const phase of ['loop-enter', 'workflow-enter', 'route', 'complete'])
  // The abort is raised from an observer or predicate at `phase`; `following` counts
  // any callback that would have run afterwards, and must stay zero.
  test(`Core cancellation at ${phase} prevents the following callback`, async () => {
    const control = new AbortController(),
      reason = Error(phase);
    let following = 0;
    const observe = {
      event(event) {
        if (
          (phase === 'loop-enter' &&
            event.type === 'loop.event' &&
            event.payload.type === 'enter') ||
          (phase === 'workflow-enter' &&
            event.type === 'workflow.event' &&
            event.payload.event.type === 'enter')
        )
          control.abort(reason);
      },
    };
    const execution = { signal: control.signal, observe };
    let pending;
    if (phase === 'loop-enter') {
      pending = new AgentCoreEngine({ execution }).run(() => {
        following++;
        return { type: 'complete', value: 'answer' };
      });
    } else {
      const routes =
        phase === 'route'
          ? [
              {
                when() {
                  control.abort(reason);
                  return false;
                },
                complete: () => 'unused',
              },
              {
                when() {
                  following++;
                  return true;
                },
                complete: () => 'answer',
              },
            ]
          : [
              {
                complete() {
                  if (phase === 'complete') control.abort(reason);
                  return 'answer';
                },
              },
            ];
      const workflow = defineWorkflow({
        id: 'boundaries',
        isResult() {
          if (phase === 'complete') following++;
          return true;
        },
        nodes: [
          {
            id: 'answer',
            description: 'Answer',
            run() {
              if (phase === 'workflow-enter') following++;
            },
            routes,
          },
        ],
      });
      pending = new AgentCoreEngine({ execution, workflow }).run({});
    }
    await assert.rejects(pending, (error) => error === reason);
    assert.equal(following, 0);
  });

test('cancellation while collecting tool diagnostics cannot commit a successful receipt', async () => {
  for (const asynchronous of [false, true]) {
    const control = new AbortController(),
      reason = Error('cancelled before receipt'),
      events = [];
    const registry = new ToolRegistry({
      execution: {
        signal: control.signal,
        observe: {
          accepts: () => true,
          event: (event) => {
            events.push(event);
          },
        },
      },
    });
    registry.register({
      id: 'read',
      kind: 'read',
      parseInput: (value) => value,
      parseOutput: (value) => value,
      execute: () => 'answer',
      debugSteps(_value, reporting) {
        const logger = reporting.createSubFlowLogger();
        // Aborting while diagnostics are collected must not leave a success receipt.
        control.abort(reason);
        return logger;
      },
    });
    const request = { toolId: 'read', input: {} };
    if (asynchronous)
      await assert.rejects(registry.invokeAsync(request), (error) => error === reason);
    else
      assert.throws(
        () => registry.invoke(request),
        (error) => error === reason,
      );
    assert.deepEqual(
      registry.events.map((event) => event.status),
      ['cancelled'],
    );
    assert.equal(
      events.some((event) => event.type === 'tool.result' && event.payload.status === 'success'),
      false,
    );
  }
});

test('cancellation in the final token counter prevents charging or entering Provider I/O', async () => {
  const control = new AbortController(),
    reason = Error('cancelled in preflight');
  let providers = 0;
  const runner = new ModelRunner({
    execution: { signal: control.signal },
    maxOutputTokens: 1,
    tokenBudget: {
      counterId: 'counter',
      contextWindowTokens: 10,
      countTokens() {
        control.abort(reason);
        return 1;
      },
    },
    provider: {
      stream() {
        providers++;
        return {
          async *[Symbol.asyncIterator]() {
            yield 'answer';
          },
        };
      },
    },
  });
  await assert.rejects(runner.invoke('question'), (error) => error === reason);
  // Nothing was charged and nothing reached the provider, so the aborted preflight is
  // invisible to budgets and to the journal.
  assert.equal(runner.totalCallCount, 0);
  assert.equal(providers, 0);
  assert.equal(runner.journal.snapshot().length, 0);
});

test('a model.start observer can cancel before the response factory and Provider method are invoked', async () => {
  const control = new AbortController(),
    reason = Error('cancelled at start');
  let factories = 0,
    providers = 0;
  const custom = transport();
  custom.prepare = () => ({
    options: {},
    schemaChars: 0,
    createResponse() {
      factories++;
      return { outputChars: 0, push() {}, finish: () => 'answer' };
    },
  });
  const runner = new ModelRunner({
    execution: {
      signal: control.signal,
      observe: {
        event(event) {
          if (event.type === 'model.start') control.abort(reason);
        },
      },
    },
    transports: [custom],
    provider: {
      stream() {
        providers++;
        return {
          async *[Symbol.asyncIterator]() {
            yield 'answer';
          },
        };
      },
    },
  });
  await assert.rejects(
    runner.invoke({ input: 'question', transport: 'custom' }),
    (error) => error === reason,
  );
  assert.equal(factories, 0);
  assert.equal(providers, 0);
});

test('cancellation in a response factory prevents invoking the Provider method', async () => {
  const control = new AbortController(),
    reason = Error('cancelled in factory');
  let providers = 0;
  const custom = transport();
  custom.prepare = () => ({
    options: {},
    schemaChars: 0,
    createResponse() {
      control.abort(reason);
      return { outputChars: 0, push() {}, finish: () => 'answer' };
    },
  });
  const runner = new ModelRunner({
    execution: { signal: control.signal },
    transports: [custom],
    provider: {
      stream() {
        providers++;
        return {
          async *[Symbol.asyncIterator]() {
            yield 'answer';
          },
        };
      },
    },
  });
  await assert.rejects(
    runner.invoke({ input: 'question', transport: 'custom' }),
    (error) => error === reason,
  );
  assert.equal(providers, 0);
});

test('a model.output observer cannot cancel and still let the response collector consume the part', async () => {
  const control = new AbortController(),
    reason = Error('cancelled at output');
  let pushes = 0;
  const runner = new ModelRunner({
    execution: {
      signal: control.signal,
      observe: {
        accepts: () => true,
        event(event) {
          if (event.type === 'model.output') control.abort(reason);
        },
      },
    },
    transports: [
      transport({
        push() {
          pushes++;
        },
      }),
    ],
    provider: {
      async *stream() {
        yield 'part';
      },
    },
  });
  await assert.rejects(
    runner.invoke({ input: 'question', transport: 'custom' }),
    (error) => error === reason,
  );
  assert.equal(pushes, 0);
  // The aborted part is neither collected nor journaled, even though the provider
  // already yielded it.
  assert.equal(runner.journal.snapshot().length, 0);
});

test('answer checker cancellation stops the next checker and cannot return an accepted result', () => {
  for (const checkIds of [['cancel'], ['cancel', 'later']]) {
    const control = new AbortController(),
      reason = Error('checker cancelled');
    let later = 0;
    const checks = defineAnswerCheckCatalog([
      {
        id: 'cancel',
        check(value) {
          control.abort(reason);
          return { status: 'passed', value, issues: [] };
        },
      },
      {
        id: 'later',
        check(value) {
          later++;
          return { status: 'passed', value, issues: [] };
        },
      },
    ]);
    assert.throws(
      () => checks.check({ checkIds, value: 'answer' }, context(control.signal)),
      (error) => error === reason,
    );
    assert.equal(later, 0);
  }
});

const answerRequest = {
  inputIds: ['one'],
  items: [{ id: 'one', inputIds: ['one'], sourceStatus: 'ready', data: {} }],
};
test('cancellation in an answer budget check prevents invoking the generator', async () => {
  const control = new AbortController(),
    reason = Error('budget cancelled');
  let generated = 0;
  const flow = defineAnswerFlow({
    maxItems: 1,
    maxRepairs: 0,
    canInvoke() {
      control.abort(reason);
      return true;
    },
    async generate() {
      generated++;
      return new Map([['one', 'answer']]);
    },
    check: () => ({ status: 'passed', issues: [] }),
    fallback: () => ({ handled: false }),
  });
  await assert.rejects(
    flow.run(answerRequest, context(control.signal)),
    (error) => error === reason,
  );
  assert.equal(generated, 0);
});

test('cancellation in the repair checker stops review in the same Workflow node', async () => {
  const control = new AbortController(),
    reason = Error('repair cancelled');
  let checked = 0,
    reviewed = 0;
  const flow = defineAnswerFlow({
    maxItems: 1,
    maxRepairs: 1,
    canInvoke: () => true,
    generate: async () => new Map([['one', 'answer']]),
    check() {
      if (++checked === 1)
        return { status: 'failed', issues: [{ code: 'REPAIR', message: 'Repair' }] };
      control.abort(reason);
      return { status: 'passed', issues: [] };
    },
    async review() {
      reviewed++;
      return new Map([['one', { status: 'passed', issues: [] }]]);
    },
    fallback: () => ({ handled: false }),
  });
  await assert.rejects(
    flow.run(answerRequest, context(control.signal)),
    (error) => error === reason,
  );
  assert.equal(checked, 2);
  assert.equal(reviewed, 0);
});

for (const phase of ['list', 'events'])
  test(`direct reflection ${phase} reads stop waiting on cancellation and discard late pages`, async () => {
    const control = new AbortController(),
      reason = Error('review cancelled'),
      entered = deferred(),
      gate = deferred();
    let eventReads = 0;
    const discovered = page([
      { path: 'own/run', manifest: { runId: 'run', expiresAt: Date.now() + 60000 } },
    ]);
    const source = defineReflectionLogSource({
      id: 'source',
      authorize() {},
      reader: {
        async listRuns() {
          if (phase === 'events') return discovered;
          entered.resolve();
          return gate.promise;
        },
        async readEvents() {
          eventReads++;
          entered.resolve();
          return gate.promise;
        },
      },
    });
    const query = phase === 'list' ? { limit: 1 } : { run: 'own/run', limit: 1 };
    if (phase === 'events') await source.query({ limit: 1 }, context(new AbortController().signal));
    const pending = source.query(query, context(control.signal));
    await entered.promise;
    control.abort(reason);
    try {
      await assert.rejects(promptly(pending), (error) => error === reason);
    } finally {
      gate.resolve(phase === 'list' ? discovered : page([]));
      await tick();
    }
    if (phase === 'list') {
      await assert.rejects(
        source.query({ run: 'own/run', limit: 1 }, context(new AbortController().signal)),
        /not discovered/,
      );
      assert.equal(eventReads, 0);
    }
  });

test('reflection rejects evidence that expires while its event page is being read', async (t) => {
  let now = 1000;
  t.mock.method(Date, 'now', () => now);
  const source = defineReflectionLogSource({
    id: 'source',
    authorize() {},
    reader: {
      async listRuns() {
        return page([{ path: 'own/run', manifest: { runId: 'run', expiresAt: 1001 } }]);
      },
      async readEvents() {
        now = 1002;
        return page([]);
      },
    },
  });
  const operation = context(new AbortController().signal);
  await source.query({ limit: 1 }, operation);
  await assert.rejects(source.query({ run: 'own/run', limit: 1 }, operation), /expired/);
});

test('failed discovery does not grant event access to the valid prefix of its page', async () => {
  let reads = 0;
  const source = defineReflectionLogSource({
    id: 'source',
    authorize() {},
    reader: {
      async listRuns() {
        return page([
          { path: 'own/valid', manifest: { runId: 'valid', expiresAt: Date.now() + 60000 } },
          { path: 'own/expired', manifest: { runId: 'expired', expiresAt: 1 } },
        ]);
      },
      async readEvents() {
        reads++;
        return page([]);
      },
    },
  });
  const operation = context(new AbortController().signal);
  await assert.rejects(source.query({ limit: 2 }, operation), /expired/);
  await assert.rejects(source.query({ run: 'own/valid', limit: 1 }, operation), /not discovered/);
  assert.equal(reads, 0);
});

test('Provider iterator cleanup cannot replace a successful answer or the original upstream error', async () => {
  for (const success of [false, true]) {
    const original = Error('original stream error'),
      cleanup = Error('cleanup failed');
    let index = 0;
    const runner = new ModelRunner({ execution: {},
      provider: {
        stream: () => ({
          [Symbol.asyncIterator]: () => ({
            async next() {
              if (!success) throw original;
              return index++ ? { done: true } : { value: 'answer', done: false };
            },
            return() {
              throw cleanup;
            },
          }),
        }),
      },
    });
    if (success) assert.equal((await runner.invoke('question')).value, 'answer');
    else await assert.rejects(runner.invoke('question'), (error) => error === original);
  }
});

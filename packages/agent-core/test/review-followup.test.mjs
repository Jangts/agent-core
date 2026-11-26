/**
 * Locks down follow-up and review boundaries across Kits: Knowledge publication against
 * candidate expiry, ToolBinding cancellation, child acceptance barriers, reflection error
 * projection, answer/presentation observer isolation, text/vector index metadata isolation
 * and external model bindings. Runs under node --test with in-memory stores and fixture
 * providers; no network or real search backend is used.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentCoreEngine, ModelRunner, Support, defineWorkflow, route } from '../dist/esm/index.js';
import { defineKnowledgePublication } from '../dist/esm/kits/knowledge/index.js';
import { defineReflectionLogSource } from '../dist/esm/kits/reflection.js';
import { defineAnswerFlow } from '../dist/esm/kits/answering/index.js';
import { defineOutputCatalog } from '../dist/esm/kits/presentation/index.js';
import { TextSearch } from '../dist/esm/kits/search.js';
import { VectorSearch } from '../dist/esm/kits/vector-search.js';
import { ModelCalls } from '../dist/esm/kits/inference.js';

const context = (signal) => ({ app: {}, signal: signal ?? new AbortController().signal });
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

test('candidate retention expiry during async source verification prevents publication without a write', async () => {
  let now = 100,
    saved = 0;
  // The candidate expires at t=200 while verification advances the clock to t=201, so the
  // write must be refused even though verification itself succeeded.
  const data = {
    revision: 1,
    publishedRevision: 0,
    documents: [],
    candidates: [
      {
        id: 'candidate',
        baseRevision: 0,
        document: { id: 'guide', revision: '1', parts: ['body'] },
        sources: [{ id: 'source', revision: '1' }],
        createdAtMs: 0,
        expiresAtMs: 200,
      },
    ],
  };
  const publication = defineKnowledgePublication({
    now: () => now,
    store: {
      load: async () => data,
      compareAndSwap: async () => {
        saved++;
        return true;
      },
    },
    authorize() {},
    async verifySources() {
      await Promise.resolve();
      now = 201;
    },
  });
  await assert.rejects(
    publication.publish({ revision: 1, candidateId: 'candidate' }, context()),
    /candidate unavailable/,
  );
  assert.equal(saved, 0);
  assert.equal(data.publishedRevision, 0);
});

test('custom ToolBinding cannot execute a pre-aborted request or accept an uncooperative late result', async () => {
  for (const preAborted of [true, false]) {
    const local = new AbortController(),
      entered = deferred(),
      gate = deferred();
    let executed = 0,
      observedSignal;
    const workflow = defineWorkflow({
      id: 'custom-tool',
      nodes: [
        {
          id: 'work',
          description: 'Work',
          async run(_, ctx) {
            return {
              result: await ctx.tools.invoke({ toolId: 'custom', input: {}, signal: local.signal }),
            };
          },
          routes: [route.deliver('result')],
        },
      ],
    });
    const engine = new AgentCoreEngine({ workflow }).bindToolRuntime({
      async invoke(request) {
        executed++;
        observedSignal = request.signal;
        entered.resolve();
        return gate.promise;
      },
    });
    if (preAborted) local.abort();
    const pending = engine.run({});
    const rejection = assert.rejects(pending, { name: 'AbortError' });
    if (!preAborted) {
      await entered.promise;
      local.abort();
      assert.equal(observedSignal.aborted, true);
    }
    await rejection;
    // Pre-aborted requests never reach the port; an abort mid-call lets it start once and
    // the late gate result is discarded.
    assert.equal(executed, preAborted ? 0 : 1);
    gate.resolve({ value: 'late', invocation: {} });
    await new Promise((resolve) => setImmediate(resolve));
  }
});

test('child acceptance rejects sync/async non-void returns and preserves the zero-commit barrier', async () => {
  // Any non-undefined return (including false and 0) from an async or sync acceptance is
  // invalid, and no commit may run when acceptance fails.
  for (const value of [false, true, null, 0])
    for (const asyncHook of [false, true]) {
      const parent = new ModelRunner({ provider: { async *stream() {} } });
      let commits = 0;
      await assert.rejects(
        Support.runChildren(
          parent,
          [
            {
              id: 'child',
              maxCalls: 1,
              reserveCalls: 0,
              timeoutMs: 1000,
              transports: [],
              run: async () => 'answer',
            },
          ],
          {
            accept: () => (asyncHook ? Promise.resolve(value) : value),
            commit: async () => {
              commits++;
            },
          },
        ),
        /acceptance must return void/,
      );
      assert.equal(commits, 0);
    }
});

test('reflection projects real Workflow errors and whitelisted model/loop/error metadata', async () => {
  const events = [];
  const workflow = defineWorkflow({
    id: 'failure',
    nodes: [
      {
        id: 'work',
        description: 'Work',
        run() {
          throw Object.assign(Error('PRIVATE_FAILURE'), { code: 'MODEL_AUTH' });
        },
        routes: [{ complete: () => 'unreachable' }],
      },
    ],
  });
  await assert.rejects(
    new AgentCoreEngine({
      workflow,
      execution: {
        observe: {
          event(event) {
            events.push(event);
          },
        },
      },
    }).run({}),
    /PRIVATE_FAILURE/,
  );
  const page = (items) => ({
    items,
    status: 'end',
    issues: [],
    issuesOmitted: 0,
    coverage: { exhausted: true },
  });
  const source = defineReflectionLogSource({
    id: 'own',
    authorize() {},
    reader: {
      async listRuns() {
        return page([{ path: 'run', manifest: { runId: 'run', expiresAt: Date.now() + 10000 } }]);
      },
      async readEvents() {
        return page([
          ...events.map((event) => ({ ...event, sequence: event.producerSequence })),
          {
            type: 'loop.event',
            runId: 'run',
            sequence: 10,
            payload: { type: 'error', errorCode: 'CANCELLED', durationMs: 3, secret: 'PRIVATE' },
          },
          {
            type: 'model.end',
            runId: 'run',
            sequence: 11,
            payload: {
              state: {
                status: 'success',
                codes: [],
                durationMs: 4,
                inputChars: 6,
                text: 'PRIVATE',
              },
            },
          },
          {
            type: 'runtime.rejected',
            runId: 'run',
            sequence: 12,
            payload: { stageId: 'answer', error: { code: 'BUDGET', message: 'PRIVATE' } },
          },
        ]);
      },
    },
  });
  await source.query({ limit: 1 }, context());
  const result = await source.query({ run: 'run', limit: 10 }, context());
  const failure = result.items.find(
    (item) => item.type === 'workflow.event' && item.status === 'error',
  );
  assert.equal(failure.code, 'MODEL_AUTH');
  assert.equal(failure.workflowNodeId, 'work');
  assert.equal(typeof failure.durationMs, 'number');
  assert.equal(result.items.find((item) => item.type === 'loop.event').status, 'cancelled');
  assert.equal(result.items.find((item) => item.type === 'model.end').inputChars, 6);
  assert.equal(result.items.find((item) => item.type === 'runtime.rejected').code, 'BUDGET');
  // Only whitelisted metadata is projected; the thrown message and payload strings never
  // appear in the serialized reflection result.
  assert.ok(!JSON.stringify(result).includes('PRIVATE'));
});

test('answer observers cannot mutate checked values, even when retaining the observation after delivery', async () => {
  const observations = [];
  const flow = defineAnswerFlow({
    maxItems: 1,
    maxRepairs: 0,
    reviewPolicy: 'off',
    canInvoke: () => true,
    generate: async () => new Map([['a', { text: 'checked' }]]),
    check: () => ({ status: 'passed', issues: [] }),
    fallback: () => ({ handled: false }),
    observe(input) {
      observations.push(input);
      input.results[0].value.text = 'observer mutation';
      throw Error('observer failed');
    },
  });
  const [answer] = await flow.run(
    {
      inputIds: ['q'],
      items: [{ id: 'a', inputIds: ['q'], data: { source: 'real' }, sourceStatus: 'ready' }],
    },
    context(),
  );
  // The observer mutates the checked value and throws; neither may reach the accepted
  // answer, and the observation is still safe to retain afterwards.
  assert.equal(answer.status, 'accepted');
  assert.equal(answer.value.text, 'checked');
  observations[0].results[0].item.data.source = 'late mutation';
  assert.equal(answer.item.data.source, 'real');
});

test('presentation observers get detached nested values and uncloneable observations cannot fail delivery', () => {
  const catalog = defineOutputCatalog(
    [
      {
        id: 'record',
        kind: 'record',
        fields: [
          {
            id: 'body',
            owner: 'generated',
            valueSchema: { jsonSchema: { type: 'object' }, parse: (value) => value },
          },
        ],
      },
    ],
    {
      observe(result) {
        result.value.body.text = 'changed';
      },
    },
  );
  assert.equal(
    catalog.compose(
      { outputId: 'record', input: { generated: { body: { text: 'real' } } } },
      context(),
    ).value.body.text,
    'real',
  );
  let observed = false;
  // This answer is a function value, which cannot be cloned; delivery must still succeed
  // and the observer must simply be skipped rather than failing the flow.
  const opaque = defineAnswerFlow({
    maxItems: 1,
    maxRepairs: 0,
    reviewPolicy: 'off',
    canInvoke: () => true,
    generate: async () => new Map([['a', () => 'answer']]),
    check: () => ({ status: 'passed', issues: [] }),
    fallback: () => ({ handled: false }),
    observe() {
      observed = true;
    },
  });
  return opaque
    .run(
      { inputIds: ['q'], items: [{ id: 'a', inputIds: ['q'], data: {}, sourceStatus: 'ready' }] },
      context(),
    )
    .then(([answer]) => {
      assert.equal(answer.value(), 'answer');
      assert.equal(observed, false);
    });
});

test('text-index metadata stays isolated across input, filter, output and restored snapshots', () => {
  const config = { indexRevision: '1', fields: ['body'], storedFields: ['access'] };
  const index = new TextSearch(config),
    document = { id: 'one', body: 'searchable', access: { owner: 'alice' }, service() {} };
  index.upsert(document);
  // Upsert snapshots stored fields, so mutating the source after indexing is invisible to
  // filters, callers and restores.
  document.access.owner = 'bob';
  const query = { query: 'searchable', limit: 1, filter: () => true };
  assert.equal(index.search(query)[0].document.access.owner, 'alice');
  index.search({
    ...query,
    filter: (item) => {
      item.access.owner = 'filter';
      return true;
    },
  });
  index.search(query)[0].document.access.owner = 'returned';
  assert.equal(index.search(query)[0].document.access.owner, 'alice');
  assert.equal(
    TextSearch.restore(config, index.snapshot()).search(query)[0].document.access.owner,
    'alice',
  );
  class Document {
    get id() {
      return 'two';
    }
    get body() {
      return 'searchable';
    }
    get access() {
      return { owner: 'alice' };
    }
  }
  index.upsert(new Document());
  assert.equal(index.search({ ...query, limit: 2 }).length, 2);
});

test('vector filters and grouping cannot rewrite indexed metadata, and sparse vectors are refused', () => {
  const index = new VectorSearch({ identity: 'space', dimensions: 2 });
  index.upsert({ document: { id: 'one', access: { owner: 'alice' } }, vector: [1, 0] });
  const query = { vector: [1, 0], limit: 1, filter: () => true };
  index.search({
    ...query,
    filter: (item) => {
      item.access.owner = 'filter';
      return true;
    },
    groupBy: (item) => {
      assert.equal(item.access.owner, 'alice');
      item.access.owner = 'group';
      return 'one';
    },
  });
  assert.equal(index.search(query)[0].document.access.owner, 'alice');
  // A sparse vector (a hole or an uninitialized array) is not a valid embedding.
  for (const vector of [new Array(2), [1, ,]]) {
    assert.throws(
      () => index.upsert({ document: { id: 'invalid' }, vector }),
      /dimensions or values/,
    );
    assert.throws(() => index.search({ ...query, vector }), /dimensions or values/);
  }
});

test('external model bindings receive checked class inputs before yielding and still preserve cancellation', async () => {
  class Input {
    #approved = true;
    approved() {
      return this.#approved;
    }
    revoke() {
      this.#approved = false;
    }
  }
  const input = new Input();
  let executed;
  const models = new ModelCalls([
    {
      id: 'custom',
      identity: 'custom',
      assertInput(value) {
        assert.equal(value.approved(), true);
      },
      invoke(value) {
        assert.equal(value, input);
        executed = value.approved();
        return 'answer';
      },
    },
  ]);
  const pending = models.invoke({ modelId: 'custom', input, timeoutMs: 1000 }, context());
  input.revoke();
  // Validation runs before yielding to the handler, so revoking the input afterwards cannot
  // change the already-checked outcome.
  assert.equal((await pending).value, 'answer');
  assert.equal(executed, true);
  const control = new AbortController(),
    original = Error('cancelled'),
    gate = deferred();
  const slow = new ModelCalls([
    {
      id: 'slow',
      identity: 'slow',
      invoke() {
        control.abort(original);
        return gate.promise;
      },
    },
  ]);
  await assert.rejects(
    slow.invoke({ modelId: 'slow', input: {}, timeoutMs: 1000 }, context(control.signal)),
    (error) => error === original,
  );
  gate.resolve('late');
});

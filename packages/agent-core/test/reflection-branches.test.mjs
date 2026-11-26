/**
 * Locks down the reflection Kit's failure boundaries: malformed queries, page cursors,
 * evidence metrics and expiry, unreadable thrown metadata, and log projection must yield
 * an incomplete report or a sanitized event list instead of fabricated findings. Runs
 * under node --test with a scripted model and in-memory reflection sources.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ModelRunner } from '../dist/esm/index.js';
import { defineReflection, defineReflectionLogSource } from '../dist/esm/kits/reflection.js';
const ctx = () => ({ app: {}, signal: new AbortController().signal });
const finish = { name: 'review.finish', input: { findings: [], limitations: [] } };

test('reflection honors remaining budget from an already scoped model port', async () => {
  const report = await defineReflection({
    model: {
      remainingCalls: 1,
      createChild() { assert.fail('the reserved call cannot be spent'); },
    },
    reserveCalls: 1,
    authorize() {},
    source: {
      id: 'local', description: 'authorized',
      authorize() {},
      query() { assert.fail('a budget rejection cannot read the source'); },
    },
  }).run('Inspect', ctx());
  assert.equal(report.status, 'incomplete');
  assert.deepEqual(report.limitations, ['Reflection model budget exhausted; parent reserve preserved']);
});
async function review({ query = { limit: 1 }, page, error, finishInput, providerError } = {}) {
  let calls = 0;
  const model = new ModelRunner({
    maxCalls: 4,
    maxSchemaChars: 30000,
    provider: {
      async *stream() {
        if (providerError) throw false;
        yield JSON.stringify(
          // First call queries history, every later call finishes the report.
          calls++
            ? { ...finish, input: finishInput ?? finish.input }
            : { name: 'history.query', input: query },
        );
      },
    },
  });
  return defineReflection({
    model,
    authorize() {},
    source: {
      id: 'local',
      description: 'authorized',
      authorize() {},
      query() {
        if (error !== undefined) throw error;
        return (
          page ?? { items: [], coverage: { consistency: 'snapshot', complete: true, gaps: [] } }
        );
      },
    },
  }).run('Inspect', ctx());
}
test('reflection rejects malformed query shapes, cursor/run identities and type selectors', async () => {
  // Each shape violates one query contract: identity, type list, or the 1..64 limit window.
  for (const query of [
    null,
    [],
    false,
    { limit: 1, run: '' },
    { limit: 1, cursor: '' },
    { limit: 1, types: 'x' },
    { limit: 1, types: Array(33).fill('x') },
    { limit: 1, types: [''] },
    { limit: 0 },
    { limit: 65 },
    { limit: 1, extra: true },
  ]) {
    const report = await review({ query });
    assert.equal(report.status, 'incomplete');
    assert.ok(report.limitations.length);
  }
});
test('reflection validates page cursors, evidence metrics, freshness and expiry delivery', async () => {
  const coverage = { consistency: 'snapshot', complete: true, gaps: [] },
    base = { id: 'e', runId: 'r', type: 'loop.event' };
  // Empty cursors, negative or non-numeric metrics and already-expired evidence must all
  // surface as page/metric/expiry limitations.
  for (const page of [
    { items: [], coverage, cursor: '' },
    { items: [{ ...base, calls: -1 }], coverage },
    { items: [{ ...base, calls: 'one' }], coverage },
    { items: [{ ...base, expiresAtMs: Date.now() - 1 }], coverage },
  ]) {
    const report = await review({ page });
    assert.equal(report.status, 'incomplete');
    assert.ok(report.limitations.some((x) => /page|metric|expired/.test(x)));
  }
  const expiresAtMs = Date.now() + 60000;
  const report = await review({
    query: { run: 'r', cursor: 'next', types: ['loop.event'], limit: 1 },
    page: {
      items: [
        {
          ...base,
          calls: 2,
          durationMs: 0,
          inputChars: 3,
          outputChars: 4,
          occurredAtMs: 10,
          sequence: 1,
          expiresAtMs,
        },
      ],
      cursor: 'next',
      coverage,
    },
  });
  assert.equal(report.status, 'completed');
  assert.equal(report.expiresAtMs, expiresAtMs);
  // Numeric metrics are copied through so downstream code can reason about cost.
  assert.equal(report.evidence[0].calls, 2);
  // A provider failure that throws a non-Error must still produce a limitation, not a crash.
  assert.deepEqual((await review({ providerError: true })).limitations, [
    'Reflection did not complete',
  ]);
});
test('log reflection reports incomplete discovery and projects alternate event metrics without payload leaks', async () => {
  const page = {
    status: 'partial',
    coverage: { exhausted: false, captureIncomplete: true },
    issues: [{ code: 'MISSING' }],
    issuesOmitted: 2,
  };
  const events = [
    {
      event: 'loop.event',
      sequence: 1,
      payload: { type: 'error', error: { code: 'CANCELLED' }, calls: 2 },
    },
    {
      type: 'workflow.event',
      sequence: 2,
      payload: { event: { type: 'complete', durationMs: 5 } },
    },
    {
      type: 'model.end',
      sequence: 3,
      payload: {
        state: {
          stageId: 's',
          status: 'success',
          errorCode: 'MODEL_CODE',
          inputChars: 4,
          outputChars: 6,
        },
      },
    },
    { event: 'custom', sequence: 4, payload: null },
    { type: 'custom', sequence: 5, payload: ['PRIVATE'] },
  ];
  const source = defineReflectionLogSource({
    id: 'local',
    authorize() {},
    reader: {
      async listRuns() {
        return {
          ...page,
          items: [
            {
              path: 'run',
              manifest: { runId: 'r', outcome: 'success', expiresAt: Date.now() + 60000 },
            },
          ],
        };
      },
      async readEvents() {
        return { ...page, items: events.map((e) => ({ ...e, runId: 'r' })) };
      },
    },
  });
  const discovery = await source.query({ limit: 1 }, ctx());
  assert.equal(discovery.items[0].status, 'success');
  // Gap reporting is ordered and stable: page status, issue code, omitted marker, then
  // capture completeness.
  assert.deepEqual(discovery.coverage.gaps, [
    'partial',
    'MISSING',
    'issues omitted',
    'capture incomplete',
  ]);
  const result = await source.query({ run: 'run', limit: 5 }, ctx());
  assert.equal(result.items[0].status, 'cancelled');
  assert.equal(result.items[0].calls, 2);
  assert.equal(result.items[1].status, 'success');
  assert.equal(result.items[2].code, 'MODEL_CODE');
  assert.equal(result.items[3].type, 'custom');
  // Alternate payload shapes are projected to whitelisted metrics; raw payload strings and
  // arrays never reach the result.
  assert.ok(!JSON.stringify(result).includes('PRIVATE'));
});
test('reflection rejects non-object finding entries before a report can complete', async () => {
  const report = await review({ finishInput: { findings: [null], limitations: [] } });
  assert.equal(report.status, 'incomplete');
  assert.ok(report.limitations.length);
});

test('reflection returns an incomplete report when thrown metadata is unreadable or malformed', async () => {
  const { proxy, revoke } = Proxy.revocable({}, {});
  revoke();
  const unreadable = Error('unreadable');
  Object.defineProperty(unreadable, 'message', {
    get() {
      throw Error('metadata');
    },
  });
  const malformed = Error('malformed');
  Object.defineProperty(malformed, 'message', { value: 7 });
  for (const failure of [proxy, unreadable, malformed]) {
    const model = new ModelRunner({
      maxCalls: 3,
      provider: {
        async *stream() {
          throw failure;
        },
      },
    });
    const task = defineReflection({
      model,
      authorize() {},
      source: {
        id: 'local',
        description: 'metadata',
        authorize() {},
        query() {
          assert.fail();
        },
      },
    });
    const report = await task.run('Inspect', ctx());
    assert.equal(report.status, 'incomplete');
    assert.deepEqual(report.limitations, ['Reflection did not complete']);
  }
});

/**
 * Offline R3: independent child Runners, explicit parent acceptance and retained outcomes.
 * Gates control completion order without sleeps; they deliberately ignore cancellation.
 */
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { AgentCoreEngine, ModelRunner, defineWorkflow } from '@jangts/agent-core';
import { aggregateBranchResults } from '@jangts/agent-core/kits/aggregation';

/** A deterministic host completion gate; no scheduler or background queue is introduced. */
function gate() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** Run one request, optionally conflicting, failing, or cancelling before late branch completion. */
export async function runParallelHarness({
  order = ['left', 'right'],
  conflict = false,
  failed,
  cancel = false,
  maxCalls = 2,
} = {}) {
  const branches = ['left', 'right'];
  const controller = new AbortController();
  const completions = Object.fromEntries(branches.map((id) => [id, gate()]));
  const settled = Object.fromEntries(branches.map((id) => [id, gate()]));
  const prepared = Object.fromEntries(branches.map((id) => [id, gate()]));
  const entered = gate();
  const providerCalls = [];
  const completed = [];
  const retained = [];
  const children = [];
  const parentInput = { source: { title: 'original' } };
  const model = new ModelRunner({
    maxCalls,
    children: { maxDepth: 1, maxChildren: 2, maxConcurrentCalls: 2 },
    execution: { signal: controller.signal },
    provider: {
      async *stream(messages) {
        const id = messages.at(-1).content;
        providerCalls.push(id);
        yield `evidence:${id}`;
      },
    },
  });
  let inspection;
  let pending;
  const parentState = {};
  const workflow = defineWorkflow({
    id: 'parallel-evidence',
    nodes: [
      {
        id: 'collect',
        description: 'Read independent inputs and explicitly accept disjoint results',
        async run(_, context) {
          pending = branches.map(async (id) => {
            const input = structuredClone(parentInput);
            const child = model.createChild({
              id,
              maxCalls: 1,
              reserveCalls: 0,
              timeoutMs: 5000,
              signal: context.signal,
              diagnostics: context.diagnostics,
            });
            children.push(child);
            let result;
            try {
              input.source.title = id;
              const answer = await child.invoke({ input: id });
              prepared[id].resolve();
              // Deliberately uncooperative host work can complete after parent cancellation.
              await completions[id].promise;
              if (failed === id) throw new Error(`Failed branch: ${id}`);
              result = {
                id,
                status: 'succeeded',
                patch: { [conflict ? 'answer' : id]: answer.value },
              };
            } catch (error) {
              prepared[id].resolve();
              result = { id, status: 'failed', error };
            }
            retained.push(result);
            completed.push(id);
            settled[id].resolve();
            return result;
          });
          entered.resolve();
          const results = await Promise.all(pending);
          inspection = aggregateBranchResults({ branches, results });
          // Inspection does not grant permission to commit. Core checks cancellation again too.
          context.signal.throwIfAborted();
          return inspection.status === 'accepted' ? inspection.patch : {};
        },
        routes: [{ complete: (state) => ({ ...state }) }],
      },
    ],
  });
  const parent = new AgentCoreEngine({ execution: { signal: controller.signal } })
    .bindModelRuntime(model)
    .bindWorkflow(workflow);
  const outcome = parent.run(parentState).then(
    (value) => ({ value }),
    (error) => ({ error }),
  );
  await entered.promise;
  await Promise.all(branches.map((id) => prepared[id].promise));
  completions[order[0]].resolve();
  await settled[order[0]].promise;
  if (cancel) controller.abort(new Error('Parent cancelled'));
  completions[order[1]].resolve();
  await Promise.all(pending);
  const result = await outcome;
  assert.equal(parentInput.source.title, 'original');
  if (cancel) {
    assert.ok(result.error);
    assert.deepEqual(parentState, {});
  } else {
    assert.ifError(result.error);
    assert.deepEqual(parentState, inspection.status === 'accepted' ? inspection.patch : {});
  }
  assert.equal(model.totalCallCount, providerCalls.length);
  return {
    inspection,
    parentState,
    retained,
    completed,
    providerCalls,
    totalCalls: model.totalCallCount,
    childCalls: children.map((child) => child.callCount),
    cancelled: !!result.error,
  };
}

/** Demonstrate stable conflict rejection, partial retention, shared limits and late isolation. */
export async function verifyParallelHarness() {
  const accepted = await runParallelHarness();
  assert.equal(accepted.inspection.status, 'accepted');
  assert.deepEqual(accepted.childCalls, [1, 1]);
  const first = await runParallelHarness({ conflict: true });
  const reversed = await runParallelHarness({ conflict: true, order: ['right', 'left'] });
  assert.deepEqual(first.inspection, reversed.inspection);
  assert.equal(first.inspection.status, 'conflict');
  assert.deepEqual(first.completed, ['left', 'right']);
  assert.deepEqual(reversed.completed, ['right', 'left']);
  const partial = await runParallelHarness({ failed: 'right' });
  assert.equal(partial.inspection.status, 'incomplete');
  assert.equal(partial.inspection.results[0].patch.left, 'evidence:left');
  const cancelled = await runParallelHarness({ cancel: true });
  assert.equal(cancelled.retained.filter((row) => row.status === 'succeeded').length, 2);
  assert.deepEqual(cancelled.parentState, {});
  const limited = await runParallelHarness({ maxCalls: 1 });
  assert.equal(limited.providerCalls.length, 1);
  assert.equal(limited.inspection.status, 'incomplete');
  return { accepted, first, reversed, partial, cancelled, limited };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(await verifyParallelHarness(), null, 2));

/*
 * Cancellation contract at the three places work is handed off: the round loop,
 * tool invocation and the event stream.
 *
 * The shared rule is that an abort must stop waiting immediately and must discard
 * whatever the interrupted unit produces afterwards - a late `complete` result, a
 * late report, a late tool result. Pre-aborted signals must be refused before the
 * work is entered at all, which is why the tool-registry case expects no receipts
 * and the stream case expects zero operations.
 *
 * Runs on `dist/esm`; `deferred()` gives each test explicit control over when the
 * uncooperative handler resumes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AgentCoreEngine,
  ToolRegistry,
  defineWorkflow,
  route,
  Support,
} from '../dist/esm/index.js';

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

test('loop cancellation stops waiting for an uncooperative step and drops its late completion/report', async () => {
  const control = new AbortController(),
    gate = deferred(),
    entered = deferred(),
    events = [];
  const pending = new AgentCoreEngine({
    execution: {
      signal: control.signal,
      observe: {
        event: (event) => {
          events.push(event);
        },
      },
    },
  }).run(async (_, context) => {
    entered.resolve();
    await gate.promise;
    context.report({ payload: 'late' });
    return { type: 'complete', value: 'late' };
  });
  await entered.promise;
  control.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  const count = events.length;
  // The handler finishes after the abort: neither its report nor its completion may
  // reach observers.
  gate.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(events.length, count);
  assert.ok(
    !events.some((event) => event.type === 'loop.event' && event.payload.type === 'complete'),
  );
});

test('Workflow tools retain per-call pre-cancellation and in-flight cancellation', async () => {
  for (const preAborted of [true, false]) {
    const local = new AbortController(),
      entered = deferred();
    let executed = 0;
    const tools = new ToolRegistry().register({
      id: 'write',
      kind: 'action',
      parseInput: (value) => value,
      parseOutput: (value) => value,
      execute(_input, context) {
        executed++;
        entered.resolve(context.signal);
        return new Promise(() => {});
      },
    });
    const workflow = defineWorkflow({
      id: 'cancel-tool',
      nodes: [
        {
          id: 'call',
          description: 'Call a local operation',
          async run(_, context) {
            return {
              result: await context.tools.invoke({
                toolId: 'write',
                input: {},
                signal: local.signal,
              }),
            };
          },
          routes: [route.deliver('result')],
        },
      ],
    });
    if (preAborted) local.abort();
    const pending = new AgentCoreEngine({ workflow }).bindToolRuntime(tools).run({});
    const rejected = assert.rejects(pending, { name: 'AbortError' });
    if (!preAborted) {
      const active = await entered.promise;
      local.abort();
      assert.equal(active.aborted, true);
    }
    await rejected;
    // Pre-aborted: the engine refuses before entering the runtime, so there is no
    // receipt at all. In flight: exactly one executed call, recorded as cancelled.
    assert.equal(executed, preAborted ? 0 : 1);
    if (preAborted)
      assert.equal(tools.events.length, 0); // Engine refuses before entering the tool runtime.
    else {
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(tools.events[0].status, 'cancelled');
    }
  }
});

test('an event operation is never started with a pre-aborted or immediately aborted stream', async () => {
  for (const preAborted of [true, false]) {
    const control = new AbortController();
    let operations = 0;
    if (preAborted) control.abort();
    const iterator = Support.streamEvents(
      async () => {
        operations++;
      },
      { signal: control.signal },
    )[Symbol.asyncIterator]();
    const pending = iterator.next();
    if (!preAborted) control.abort();
    await assert.rejects(pending, { name: 'AbortError' });
    await Promise.resolve();
    assert.equal(operations, 0);
  }
});

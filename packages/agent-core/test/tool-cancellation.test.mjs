/**
 * Locks down tool cancellation in Core: pre-aborted input, cancellation during input
 * parsing, async execution, output validation or receipt all record `cancelled` instead of
 * success. Also covers journal/receipt accounting and invocation identity. Runs under
 * node --test with abortable in-memory fixtures.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ToolRegistry, executeInvocation } from '../dist/esm/index.js';

function fixture(handlers = {}, controller = new AbortController()) {
  const registry = new ToolRegistry({ execution: { signal: controller.signal } });
  registry.register({
    id: 'write',
    kind: 'action',
    parseInput: (value) => value,
    execute: (value) => value,
    parseOutput: (value) => value,
    ...handlers,
  });
  return { registry, controller };
}

test('direct Core registration refuses pre-aborted input and cancellation inside input prevents execution', async () => {
  // A signal aborted before the call stops at the boundary: parseInput never runs.
  const control = new AbortController();
  control.abort(new Error('stop'));
  const { registry } = fixture(
    {
      parseInput() {
        assert.fail('input ran');
      },
    },
    control,
  );
  await assert.rejects(registry.invokeAsync({ toolId: 'write', input: {} }), /stop/);
  const second = new AbortController();
  const other = fixture(
    {
      parseInput() {
        second.abort(new Error('input stop'));
      },
      execute() {
        assert.fail('executed');
      },
    },
    second,
  ).registry;
  assert.throws(() => other.invoke({ toolId: 'write', input: {} }), /input stop/);
  assert.equal(registry.events[0].status, 'cancelled');
  assert.equal(other.events[0].status, 'cancelled');
});

test('cancelled external execution stops waiting and ignores late success or failure', async () => {
  for (const outcome of ['resolve', 'reject']) {
    let finish,
      outputs = 0;
    const { registry, controller } = fixture({
      execute: () =>
        new Promise((resolve, reject) => {
          finish = outcome === 'resolve' ? resolve : reject;
        }),
      output: (value) => {
        outputs++;
        return value;
      },
    });
    const running = registry.invokeAsync({ toolId: 'write', input: {} });
    controller.abort(new Error('stop waiting'));
    await assert.rejects(running, /stop waiting/);
    finish(outcome === 'resolve' ? 'late success' : new Error('late failure'));
    await new Promise((resolve) => setImmediate(resolve));
    // A late settlement must not produce output or a second event; cancellation is final.
    assert.equal(outputs, 0);
    assert.equal(registry.events.length, 1);
    assert.equal(registry.events[0].status, 'cancelled');
    assert.equal(typeof registry.events[0].invocationId, 'string');
    assert.ok(registry.events[0].invocationId);
  }
});

test('cancellation during output validation or before success commit cannot record success', async () => {
  // The abort fires either synchronously inside parseOutput or on the following microtask;
  // both must land before the success commit.
  for (const deferred of [false, true]) {
    const controller = new AbortController();
    const { registry } = fixture(
      {
        parseOutput(value) {
          const abort = () => controller.abort(new Error('output stop'));
          if (deferred) queueMicrotask(abort);
          else abort();
          return value;
        },
      },
      controller,
    );
    await assert.rejects(registry.invokeAsync({ toolId: 'write', input: 'result' }), /output stop/);
    assert.equal(registry.events.length, 1);
    assert.equal(registry.events[0].status, 'cancelled');
  }
});

test('synchronous invocation records aborted after handler or receipt cancellation, never success', () => {
  for (const at of ['handler', 'receipt']) {
    const controller = new AbortController(),
      records = [];
    const reason = new Error(at);
    // Aborting inside the handler skips the receipt entirely; aborting inside the receipt
    // still journals the cancellation instead of a success value.
    assert.throws(
      () =>
        executeInvocation(
          {
            id: 'local',
            call() {
              if (at === 'handler') controller.abort(reason);
            },
          },
          {},
          {},
          {
            signal: () => controller.signal,
            journal: () => ({
              beginTool: () => 'c1',
              finishTool: (receipt) => records.push(receipt),
            }),
            receipt() {
              if (at === 'handler') assert.fail('receipt after cancelled handler');
              controller.abort(reason);
              return 'late';
            },
            receiptError: (error) => error,
          },
        ),
      (error) => error === reason,
    );
    // The journal is closed exactly once with the abort reason as the recorded value.
    assert.deepEqual(records, [{ invocationId: 'c1', status: 'cancelled', value: reason }]);
  }
});

test('checkpoint failure closes the same acquired journal and preserves the original error', () => {
  const error = new Error('checkpoint failed'),
    records = [];
  let acquisitions = 0;
  assert.throws(
    () =>
      executeInvocation(
        {
          id: 'local',
          call() {
            assert.fail('executed');
          },
        },
        {},
        {},
        {
          journal() {
            acquisitions++;
            return { beginTool: () => 'c1', finishTool: (receipt) => records.push(receipt) };
          },
          checkpoint() {
            throw error;
          },
          receiptError: (value) => value,
        },
      ),
    (value) => value === error,
  );
  // The journal was acquired before the checkpoint failed, so it is acquired once and closed
  // with the original error rather than reopened.
  assert.equal(acquisitions, 1);
  assert.deepEqual(records, [{ invocationId: 'c1', status: 'error', value: error }]);
});

test('named tool execution options retain a class signal getter', async () => {
  const controller = new AbortController();
  class Execution {
    get signal() {
      return controller.signal;
    }
  }
  const registry = new ToolRegistry({ execution: new Execution() });
  let executed = false;
  registry.register({
    id: 'write',
    kind: 'action',
    parseInput: (value) => value,
    parseOutput: (value) => value,
    execute() {
      executed = true;
    },
  });
  const reason = new Error('stop');
  controller.abort(reason);
  // The getter is read per invocation, and the exact abort reason is forwarded by both
  // sync and async entry points without running the handler.
  assert.throws(
    () => registry.invoke({ toolId: 'write', input: {} }),
    (error) => error === reason,
  );
  await assert.rejects(
    registry.invokeAsync({ toolId: 'write', input: {} }),
    (error) => error === reason,
  );
  assert.equal(executed, false);
});

test('selected invocation identity uses id without reading unrelated names or losing the handler receiver', () => {
  const records = [];
  class Handler {
    #total = 0;
    get id() {
      return 'canonical';
    }
    get name() {
      throw new Error('Application name metadata must not be read');
    }
    get owner() {
      throw new Error('Application ownership metadata must not be read');
    }
    get total() {
      return this.#total;
    }
    call(value, context, execution) {
      assert.equal(context.allowed, true);
      assert.equal(execution.mode, 'sync');
      this.#total += value;
    }
  }
  const handler = new Handler();
  // Identity comes only from `id`; the throwing `name`/`owner` getters prove that unrelated
  // application metadata is never read.
  executeInvocation(
    handler,
    2,
    { allowed: true },
    {
      journal: () => ({
        beginTool(request) {
          assert.equal(request.toolId, 'canonical');
          return 'receipt';
        },
        finishTool(receipt) {
          records.push(receipt);
        },
      }),
      receipt: () => handler.total,
    },
  );
  assert.equal(handler.total, 2);
  assert.deepEqual(records, [{ invocationId: 'receipt', status: 'success', value: 2 }]);
  // A handler without an `id` is not a valid invocation handler, so it must not run.
  assert.throws(
    () =>
      executeInvocation(
        {
          name: 'legacy',
          call() {
            assert.fail('Invalid handler ran');
          },
        },
        {},
        {},
      ),
    /Invalid invocation handler identity/,
  );
});

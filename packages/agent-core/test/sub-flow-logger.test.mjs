/**
 * Locks down the per-execution sub-flow logger: intent is reported before async results,
 * fixes only fill pending result fields, snapshots stay immutable, cancellation and
 * terminal observers cannot mutate, and metadata projections never read private getters.
 * Runs under node --test through AgentCoreEngine and Support tool catalogs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AgentCoreEngine,
  ToolRegistry,
  Support,
  createDiagnostics,
  defineWorkflow,
  normalizeDiagnosticEvent,
} from '../dist/esm/index.js';
import {
  createSubFlowLogger, detachSubFlowLogger, ScopedSubFlowLogger, SubFlowLogger,
} from '../dist/esm/diagnostics/sub-flow.js';

const project = records => {
  const views = new Map();
  for (const record of records) {
    const id = record.targetStepId ?? record.stepId;
    views.set(id, { ...record, stepId: id });
  }
  return [...views.values()];
};

test('loggers reject counterfeit construction and invalid delegates', () => {
  assert.throws(() => new SubFlowLogger(), /createSubFlowLogger/);
  assert.throws(() => new ScopedSubFlowLogger(), /fork/);
  const logger = createSubFlowLogger({}, () => true, () => true, () => {});
  assert.throws(() => logger.fork(' '), /Invalid subnode id/);
  assert.deepEqual(logger.readAll(), []);
});

test('logger keeps sentinel failures even if rejection metadata and console fail', (t) => {
  const info = { name: 'read', kind: 'read' };
  const hostile = new Proxy({}, { getPrototypeOf() { throw new Error('unreadable error'); } });
  const failures = ['unstructured failure', hostile];
  const logger = createSubFlowLogger({}, () => true, () => { throw failures.shift(); }, () => {});
  const warn = t.mock.method(console, 'warn', () => { throw new Error('logging disabled'); });
  assert.equal(logger.write(info), -1);
  assert.equal(logger.write(info), -1);
  assert.equal(failures.length, 0);
  assert.equal(warn.mock.callCount(), 1);
  assert.deepEqual(logger.readAll(), []);
});

test('closing the logger during a staged write prevents the record from being published', (t) => {
  let active = true;
  let publications = 0;
  let timestamps = 0;
  const logger = createSubFlowLogger({}, () => active, () => true, () => publications++);
  t.mock.method(Date, 'now', () => {
    if (++timestamps === 2) active = false;
    return 100;
  });
  assert.equal(logger.write({ name: 'read', kind: 'read' }), -1);
  assert.equal(timestamps, 2);
  assert.equal(publications, 0);
  assert.deepEqual(logger.readAll(), []);
});

test('detach releases callbacks and rejects a stale activity result during commit', (t) => {
  t.mock.method(console, 'warn', () => {});
  let reads = 0;
  const logger = createSubFlowLogger({}, () => {
    if (++reads === 3) detachSubFlowLogger(logger);
    return true;
  }, () => true, () => assert.fail('a detached logger cannot publish'));
  assert.equal(logger.write({ name: 'read', kind: 'read' }), -1);
  assert.equal(logger.fix('unknown', {}), false);
  assert.deepEqual(logger.readAll(), []);
  assert.equal(reads, 3);
});

test('detach during record preparation stops content callbacks and leaves the ledger intact', (t) => {
  let contentReads = 0;
  let publications = 0;
  const logger = createSubFlowLogger({}, () => true,
    () => { contentReads++; return true; },
    () => publications++);
  t.mock.method(Date, 'now', () => { detachSubFlowLogger(logger); return 100; });
  assert.equal(logger.write({ name: 'read', kind: 'read', payload: { detail: 'private' } }), -1);
  assert.deepEqual(logger.readAll(), []);
  assert.equal(contentReads, 0);
  assert.equal(publications, 0);
});
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
function engine(run, events, execution = {}) {
  return new AgentCoreEngine({
    workflow: defineWorkflow({
      id: 'reports',
      nodes: [{ id: 'work', description: 'Local work', run, routes: [{ complete: () => 'done' }] }],
    }),
    execution: {
      observe: { accepts: () => true, event: (event) => events.push(event) },
      ...execution,
    },
  });
}

test('cancellation in lazy diagnostic content cannot append or revise a sub-flow record', async () => {
  for (const action of ['write', 'fix']) {
    const control = new AbortController(),
      reason = Error('cancel lazy report');
    let log;
    const pending = engine(
      (_, context) => {
        log = context.createSubFlowLogger();
        const content = {
          get payload() {
            control.abort(reason);
            return { value: 'late' };
          },
        };
        if (action === 'write')
          log.write({
            name: 'Late',
            kind: 'read',
            get payload() {
              return content.payload;
            },
          });
        else {
          const id = log.write({ name: 'Initial', kind: 'read' });
          log.fix(id, content);
        }
      },
      [],
      { signal: control.signal },
    ).run({});
    await assert.rejects(pending, (error) => error === reason);
    assert.equal(log.readAll().length, action === 'write' ? 0 : 1);
    if (action === 'fix') assert.equal(project(log.readAll())[0].revision, 1);
  }
});

test('intent is emitted before async results, fixes retain order and earlier snapshots', async () => {
  const events = [],
    entered = deferred(),
    wait = deferred();
  let log, initial, first, second;
  const pending = engine(async (_, context) => {
    log = context.createSubFlowLogger();
    // One logger instance per execution, reused across calls within the same node.
    assert.equal(log, context.createSubFlowLogger());
    first = log.write({ name: 'Read first', kind: 'read', payload: { query: 'first' } });
    second = log.write({ name: 'Read second', kind: 'read', parentStepId: first });
    initial = log.readAll();
    entered.resolve();
    await wait.promise;
    log.fix(second, { status: 'success', usedModel: true, payload: { result: 'second result' } });
    log.fix(first, { status: 'running', nextStepIds: [second] });
    log.fix(first, { status: 'success', payload: { result: { count: 2 } } });
    context.report({ usedModel: false });
  }, events).run({});
  await entered.promise;
  const written = events.filter((event) => event.payload.subStep?.operation === 'write');
  assert.equal(written.length, 2);
  // Both steps are announced as planned before the async work finishes, so consumers see
  // intent early and no start time is claimed yet.
  assert.equal(written[0].subSteps[0].status, 'planned');
  assert.equal(written[0].subSteps[0].startedAtMs, undefined);
  wait.resolve();
  assert.equal(await pending, 'done');
  assert.deepEqual(
    log.readAll().filter(step => step.operation === 'write').map((step) => step.stepId),
    [first, second],
  );
  assert.deepEqual(
    log.readAll().map((step) => step.sequence),
    [1, 2, 3, 4, 5],
  );
  assert.deepEqual(
    initial.map((step) => step.status),
    ['planned', 'planned'],
  );
  assert.deepEqual(initial[0].payload, { query: 'first' });
  assert.deepEqual(project(log.readAll())[0].payload, { query: 'first', result: { count: 2 } });
  assert.equal(project(log.readAll())[1].usedModel, true);
  const end = events.find(
    (event) => event.type === 'workflow.event' && event.payload.event.type === 'complete',
  );
  assert.equal(end.usedModel, false); // no child rollup into the parent's own flag
  // Revisions count applied fixes from 1; the first step took three, the second one.
  assert.equal(project(end.subSteps)[0].revision, 3);
  assert.equal(project(end.subSteps)[1].revision, 2);
  assert.deepEqual(project(end.subSteps)[0].nextStepIds, [second]);
  assert.equal(written[0].subSteps[0].revision, 1);
  assert.throws(() => {
    initial[0].payload.query = 'rewrite';
  }, TypeError);
  assert.equal(log.write({ name: 'late', kind: 'read' }), -1);
  for (const event of events) assert.deepEqual(normalizeDiagnosticEvent(event), event);
});

test('short circuits and failures keep planned work without claiming it started', async () => {
  for (const fail of [false, true]) {
    const events = [],
      failure = new Error('original failure');
    const pending = engine((_, context) => {
      const log = context.createSubFlowLogger();
      log.write({ name: 'Never reached', kind: 'read' });
      const skipped = log.write({ name: 'Explicitly skipped', kind: 'check' });
      log.fix(skipped, { status: 'skipped' });
      context.report({ usedModel: false });
      if (fail) throw failure;
    }, events).run({});
    if (fail) await assert.rejects(pending, (error) => error === failure);
    else assert.equal(await pending, 'done');
    const end = events.findLast((event) => event.type === 'workflow.event');
    assert.equal(end.payload.event.type, fail ? 'error' : 'complete');
    assert.equal(end.usedModel, false);
    // Unreached work stays `planned` and explicitly abandoned work is `skipped`; neither may
    // claim a start time.
    assert.deepEqual(
      project(end.subSteps).map((step) => step.status),
      ['planned', 'skipped'],
    );
    assert.ok(end.subSteps.every((step) => step.startedAtMs === undefined));
  }
});

test('cancellation retains the initial record and rejects late fixes', async () => {
  const events = [],
    entered = deferred(),
    wait = deferred(),
    controller = new AbortController();
  let log, id;
  const pending = engine(
    async (_, context) => {
      log = context.createSubFlowLogger();
      id = log.write({ name: 'Wait for result', kind: 'read', status: 'running' });
      entered.resolve();
      await wait.promise;
    },
    events,
    { signal: controller.signal },
  ).run({});
  await entered.promise;
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  // The initial `running` record survives the abort, but the logger is closed so a success
  // fix can no longer be appended.
  assert.equal(
    events.findLast((event) => event.type === 'workflow.event').subSteps[0].status,
    'running',
  );
  assert.equal(log.fix(id, { status: 'success' }), false);
  wait.resolve();
});

test('manual logger submission is refused without inspecting foreign objects', async () => {
  let earlier;
  const events = [];
  const app = engine((_, context) => {
    const log = context.createSubFlowLogger();
    log.write({ name: 'Work', kind: 'check' });
    const invalid = [
      [],
      log.readAll(),
      {
        readAll() {
          assert.fail('lookalike must not run');
        },
      },
    ];
    if (earlier) invalid.push(earlier);
    for (const subs of invalid) context.report({ subs });
    earlier = log;
  }, events);
  await app.run({});
  await app.run({});
  const dropped = events.filter((event) => event.payload.reportError === 'INVALID_NODE_REPORT');
  // Three invalid report shapes in the first run plus four in the second (the earlier
  // execution's logger is now foreign) yield one dropped-progress event each.
  assert.equal(dropped.length, 7);
  assert.ok(dropped.every((event) => event.subSteps.length === 0));
});

test('fix only fills pending result fields and cannot overwrite facts or reopen terminal steps', async () => {
  await engine((_, context) => {
    const log = context.createSubFlowLogger(),
      id = log.write({ name: 'Read', kind: 'read', payload: { input: { id: 1 } } });
    log.fix(id, { payload: { input: { source: 'catalog' }, result: 'answer' }, usedModel: true });
    const before = log.readAll();
    // `fix` only fills pending result fields: identity, name, input, model-use facts and
    // illegal status transitions are all rejected and leave the snapshot untouched.
    for (const patch of [
      { payload: { input: { id: 2 } } },
      { name: 'renamed' },
      { stepId: 'replacement' },
      { usedModel: false },
    ]) {
      assert.equal(log.fix(id, patch), false);
      assert.equal(log.readAll(), before);
    }
    assert.equal(log.fix('foreign-id', {}), false);
    log.fix(id, { status: 'running' });
    const startedAtMs = project(log.readAll())[0].startedAtMs;
    assert.equal(log.fix(id, { status: 'planned' }), false);
    assert.equal(log.fix(id, { startedAtMs: startedAtMs + 1 }), false);
    log.fix(id, { status: 'success' });
    const completed = project(log.readAll())[0];
    assert.equal(log.fix(id, { status: 'running' }), false);
    log.fix(id, { payload: { laterResult: true } });
    assert.equal(project(log.readAll())[0].status, 'success');
    assert.equal(project(log.readAll())[0].endedAtMs, completed.endedAtMs);
    assert.equal(project(log.readAll())[0].payload.laterResult, true);
  }, []).run({});
});

test('metadata retains flags and child revisions without reading private getters', async () => {
  const events = [];
  let reads = 0;
  const privateFields = {
    get payload() {
      reads++;
      throw new Error('private');
    },
    get summary() {
      reads++;
      throw new Error('private');
    },
  };
  const observe = { event: (event) => events.push(event) };
  await engine(
    (_, context) => {
      const log = context.createSubFlowLogger();
      const id = log.write({ name: 'Private work', kind: 'read' });
      const input = { name: 'Another private work', kind: 'read' };
      Object.defineProperties(input, Object.getOwnPropertyDescriptors(privateFields));
      log.write(input);
      const patch = { status: 'success', usedModel: true };
      Object.defineProperties(patch, Object.getOwnPropertyDescriptors(privateFields));
      log.fix(id, patch);
      context.report({
        usedModel: false,
        get payload() {
          reads++;
          throw new Error('private');
        },
      });
    },
    events,
    { observe },
  ).run({});
  assert.equal(reads, 0);
  // No private getter ran, so no sub-steps leak into events and step names never serialize.
  assert.ok(events.every((event) => event.subSteps.length === 0));
  assert.equal(events.findLast((event) => event.payload.subStep)?.payload.subStep.usedModel, true);
  assert.equal(events.findLast((event) => event.type === 'workflow.event').usedModel, false);
  assert.equal(JSON.stringify(events).includes('Private work'), false);
  for (const event of events) normalizeDiagnosticEvent(event);
});

test('content and metadata consumers receive independent projections of the same fact', async () => {
  const logs = [],
    observed = [];
  const diagnostics = createDiagnostics({
    output: {
      accepts: ({ content }) => content === 'metadata',
      write: (record) => logs.push(record),
    },
  });
  await engine(
    (_, context) => {
      const log = context.createSubFlowLogger();
      log.write({ name: 'Read', kind: 'read', payload: { secret: 'private result' } });
      context.report({ usedModel: true, payload: 'private report' });
    },
    observed,
    { diagnostics },
  ).run({});
  assert.equal(JSON.stringify(logs).includes('private'), false);
  // The content consumer keeps its payload, yet its metadata-only projection carries no
  // sub-steps; both views derive from the same fact without sharing mutable state.
  assert.ok(JSON.stringify(observed).includes('private result'));
  const initial = observed.find((event) => event.payload.subStep);
  assert.equal(logs.find((event) => event.eventId === initial.eventId).subSteps.length, 0);
  assert.equal(logs.findLast((event) => event.type === 'workflow.event').usedModel, true);
});

test('simple Loop and sync/async Support tools use the same logger and report interfaces', async () => {
  const events = [],
    execution = { observe: { accepts: () => true, event: (event) => events.push(event) } };
  assert.equal(
    await new AgentCoreEngine({ execution }).run((_, context) => {
      const log = context.createSubFlowLogger(),
        id = log.write({ name: 'Local step', kind: 'check' });
      log.fix(id, { status: 'success' });
      context.report({ usedModel: false });
      return { type: 'complete', value: 'ok' };
    }),
    'ok',
  );
  const definition = Support.defineTool({
    id: 'read',
    kind: 'read',
    description: 'Read',
    inputSchema: { jsonSchema: { type: 'object' }, parse: (value) => value },
    authorize() {},
    parseOutput: (value) => value,
    execute(input, context) {
      const log = context.createSubFlowLogger();
      log.write({ name: 'Internal read', kind: 'read' });
      context.report({ usedModel: true });
      return input.n;
    },
    debugSteps(result, context) {
      const logger = context.createSubFlowLogger();
      logger.fix(logger.readAll()[0].stepId, { status: 'success', payload: { result } });
    },
  });
  const tools = Support.defineToolCatalog([definition]).bind({ app: undefined, execution });
  assert.equal(tools.invokeSync({ toolId: 'read', input: { n: 2 } }).value, 2);
  assert.equal((await tools.invoke({ toolId: 'read', input: { n: 3 } })).value, 3);
  // Each tool call reports its own usedModel and sub-steps, while the enclosing loop's
  // usedModel stays false because it did not call the model itself.
  assert.equal(
    events.filter(
      (event) =>
        event.type === 'tool.result' && event.usedModel === true && event.subSteps.length === 2 &&
        event.subSteps.at(-1).revision === 2,
    ).length,
    2,
  );
  assert.equal(events.findLast((event) => event.type === 'loop.event').usedModel, false);
});

test('logger rejects malformed data and enforces bounded snapshots', async () => {
  await engine((_, context) => {
    const log = context.createSubFlowLogger();
    for (const input of [
      null,
      {},
      { name: '', kind: 'read' },
      { name: 'read', kind: 'read', status: 'made-up' },
      { name: 'read', kind: 'read', usedModel: 'yes' },
      { name: 'read', kind: 'read', payload: { service: new Map() } },
      { name: 'read', kind: 'read', payload: { callback() {} } },
      { name: 'read', kind: 'read', parentStepId: 'missing' },
      { name: 'read', kind: 'read', payload: { huge: 'x'.repeat(65536) } },
    ])
      assert.equal(log.write(input), -1);
    assert.deepEqual(log.readAll(), []);
    // Metadata accessors are not evaluated: a hidden getter must never run.
    const hidden = { kind: 'read' };
    Object.defineProperty(hidden, 'name', {
      get() {
        assert.fail('metadata accessor must not run');
      },
    });
    assert.equal(log.write(hidden), -1);
    for (let i = 0; i < 256; i++) log.write({ name: 'Read', kind: 'read' });
    // The log is capped at 256 steps; overflow is refused instead of growing without bound.
    assert.equal(log.write({ name: 'Overflow', kind: 'read' }), -1);
    assert.equal(log.readAll().length, 256);
  }, []).run({});
});

test('normalization rejects invalid flags, revisions, payloads and child progress', () => {
  const base = {
    version: 2,
    eventId: 'event',
    type: 'node.progress',
    runId: 'run',
    spanId: 'node',
    producerSequence: 1,
    occurredAtMs: 1,
    payload: {},
    subSteps: [],
  };
  const step = {
    origin: 'reported',
    sequence: 1,
    stepId: 'step',
    name: 'Step',
    kind: 'read',
    status: 'planned',
    revision: 1,
    createdAtMs: 1,
  };
  // Normalization re-checks flags, revisions, payload shape and unknown child operations so
  // a persisted event cannot re-enter with invalid metadata.
  for (const patch of [
    { usedModel: 'yes' },
    { revision: 0 },
    { createdAtMs: 'yesterday' },
    { payload: { callback() {} } },
  ]) {
    assert.throws(() => normalizeDiagnosticEvent({ ...base, subSteps: [{ ...step, ...patch }] }));
  }
  assert.throws(
    () => normalizeDiagnosticEvent({ ...base, usedModel: 'yes' }),
    /reported model use/,
  );
  assert.throws(
    () => normalizeDiagnosticEvent({ ...base, payload: { subStep: { operation: 'delete' } } }),
    /sub-step progress/,
  );
});

test('CommonJS uses the same context-issued instance and persisted format', async () => {
  // The CommonJS entry must expose the same logger factory and emit the same stored shape.
  const { createRequire } = await import('node:module');
  const api = createRequire(import.meta.url)('../dist/cjs/index.js'),
    events = [];
  await new api.AgentCoreEngine({
    execution: { observe: { accepts: () => true, event: (event) => events.push(event) } },
  }).run((_, context) => {
    const log = context.createSubFlowLogger(),
      id = log.write({ name: 'Read', kind: 'read' });
    log.fix(id, { status: 'success', usedModel: true, payload: { result: 'done' } });
    context.report({ usedModel: false });
    return { type: 'complete', value: 'done' };
  });
  const end = events.at(-1);
  assert.equal(end.usedModel, false);
  assert.equal(project(end.subSteps)[0].usedModel, true);
  assert.deepEqual(normalizeDiagnosticEvent(end), end);
});

test('terminal observers cannot append or fix after the execution has completed', async () => {
  let logger, id;
  const events = [];
  // Terminal events run after the execution closes, so both append and fix must be refused
  // by that point.
  await engine(
    (_, context) => {
      logger = context.createSubFlowLogger();
      id = logger.write({ name: 'Pending result', kind: 'read' });
    },
    events,
    {
      observe: {
        accepts: () => true,
        event(event) {
          if (event.type === 'workflow.event' && event.payload.event.type === 'complete') {
            assert.equal(logger.fix(id, { status: 'success' }), false);
            assert.equal(logger.write({ name: 'Late work', kind: 'read' }), -1);
            events.push(event);
          }
        },
      },
    },
  ).run({});
  assert.equal(events.length, 1);
  assert.equal(events[0].subSteps[0].status, 'planned');
});

test('runtime commits each revision before observers run and retains a snapshot after logger release', async () => {
  const { NodeReports } = await import('../dist/esm/execution/reporting.js');
  const notifications = [], committedDuringNotification = [];
  let reports;
  const diagnostics = createDiagnostics({
    observe: {
      accepts: () => true,
      event(event) {
        notifications.push(event);
        const snapshot = reports.debug().recordedSubSteps;
        committedDuringNotification.push(snapshot.at(-1).revision);
        throw Error('broken UI consumer');
      },
    },
  });
  reports = new NodeReports(diagnostics);
  const logger = reports.createSubFlowLogger();
  assert.equal(reports.createSubFlowLogger(), logger);
  const id = logger.write({ name: 'Read', kind: 'read' });
  const initial = reports.debug();
  logger.fix(id, { status: 'success', payload: { answer: 42 } });
  const committed = reports.debug();
  assert.equal(initial.recordedSubSteps[0].revision, 1);
  assert.equal(committed.recordedSubSteps.at(-1).revision, 2);
  assert.equal(notifications.length, 2);
  assert.deepEqual(committedDuringNotification, [1, 2]);
  assert.deepEqual(notifications.map(event => event.payload.subStep.operation), ['write', 'fix']);
  assert.equal(notifications[1].subSteps.at(-1).payload.answer, 42);
  reports.close();
  assert.deepEqual(reports.debug(), committed);
  assert.deepEqual(logger.readAll(), committed.recordedSubSteps);
  assert.equal(logger.fix(id, { summary: 'late' }), false);
  assert.throws(() => reports.createSubFlowLogger(), /closed execution/);
});


test('diagnostic snapshot projection rejects forged arrays and foreign execution snapshots', async () => {
  const { NodeReports } = await import('../dist/esm/execution/reporting.js');
  const events = [];
  const root = createDiagnostics({ observe: { accepts: () => true, event: event => events.push(event) } });
  const own = root.child('own'), foreign = root.child('foreign');
  const reports = new NodeReports(own);
  reports.createSubFlowLogger().write({ name: 'Private', kind: 'read' });
  foreign.emit('node.progress', () => ({}), reports.debug());
  own.emit('node.progress', () => ({}), { recordedSubSteps: [...reports.debug().recordedSubSteps] });
  assert.equal(events[0].subSteps.length, 1);
  for (const event of events.slice(1)) {
    assert.equal(event.subSteps.length, 0);
    assert.equal(event.subStepsDropped, 1);
  }
});

test('retained loggers remain readable across visits and silently ignore detached writes', async () => {
  const retained = [];
  const events = [];
  const app = engine((_, context) => {
    const previous = retained.at(-1);
    if (previous) {
      const before = previous.readAll();
      assert.equal(before.at(-1).payload.result, 'previous flow');
      const neverRead = new Proxy({}, { ownKeys() { assert.fail('detached input inspected'); } });
      assert.equal(previous.write(neverRead), -1);
      assert.equal(previous.fix('missing', neverRead), false);
      assert.equal(previous.readAll(), before);
    }
    const logger = context.createSubFlowLogger();
    assert.notEqual(logger, previous);
    const id = logger.write({ name: 'Read', kind: 'read' });
    assert.equal(logger.fix(-1, null), false);
    assert.equal(logger.fix(id, { status: 'success', payload: { result: 'previous flow' } }), true);
    retained.push(logger);
  }, events);
  await app.run({});
  const firstSnapshot = retained[0].readAll();
  await app.run({});
  assert.equal(retained[0].readAll(), firstSnapshot);
  const eventCount = events.length;
  const externalBorrower = retained[0];
  assert.equal(externalBorrower.write(null), -1);
  assert.equal(externalBorrower.fix(-1, null), false);
  assert.equal(externalBorrower.readAll(), firstSnapshot);
  assert.equal(events.length, eventCount);
});

test('each successful fix appends an independently identified event referencing the original write', async () => {
  const events = [];
  await engine((_, context) => {
    const logger = context.createSubFlowLogger();
    const id = logger.write({ name: 'Read', kind: 'read' });
    const first = logger.readAll();
    assert.equal(logger.fix(id, { status: 'running' }), true);
    assert.equal(logger.fix(id, { payload: { count: 2 } }), true);
    assert.equal(logger.fix(id, { status: 'success' }), true);
    const records = logger.readAll();
    assert.equal(records.length, 4);
    assert.deepEqual(records.map(record => record.operation), ['write', 'fix', 'fix', 'fix']);
    assert.deepEqual(records.map(record => record.sequence), [1, 2, 3, 4]);
    assert.equal(new Set(records.map(record => record.stepId)).size, 4);
    assert.ok(records.slice(1).every(record => record.targetStepId === id));
    assert.deepEqual(records.map(record => record.revision), [1, 2, 3, 4]);
    assert.equal(records[0], first[0]);
    assert.equal(records[0].status, 'planned');
    const before = records;
    assert.equal(logger.fix(id, { status: 'running' }), false);
    assert.equal(logger.readAll(), before);
  }, events).run({});
  for (const event of events) normalizeDiagnosticEvent(event);
});

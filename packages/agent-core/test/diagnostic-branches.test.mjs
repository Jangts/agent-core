/*
 * Resilience contract for diagnostics and reporting: instrumentation may lose
 * detail, but it must never change or break business execution.
 *
 * Each case feeds a broken part of the diagnostic path and asserts the surrounding
 * work still completes: malformed external issue metadata is normalized instead of
 * trusted, payload snapshots stay bounded in depth, size and shape, sub-flow facts
 * are write-once, a throwing observer or report sink is contained, a tool keeps its
 * original error even when error decoration fails, and the reply preview rejects
 * malformed token streams.
 *
 * Runs on `dist/esm`; all sinks and observers are in-memory fakes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDiagnostics,
  diagnosticError,
  normalizeDiagnosticEvent,
  ToolRegistry,
  Support,
} from '../dist/esm/index.js';
import { getErrorInfo, recordErrorContext } from '../dist/esm/errors.js';
import {
  createSubFlowLogger,
  readSubFlowLogger,
  payloadSnapshot,
} from '../dist/esm/diagnostics/sub-flow.js';
import { NodeReports } from '../dist/esm/execution/reporting.js';
test('diagnostic failure views normalize malformed external issue metadata without promoting it to authority', () => {
  const value = {
    errors: [
      null,
      1,
      {},
      { code: 'one', path: 'field', checkId: 'check' },
      { code: 'two', message: 1, path: ['field', 0] },
      { code: 'three', path: [{}] },
    ],
    isRetryable: true,
  };
  const info = getErrorInfo(value);
  // Of the six entries only three are usable: `null`, `1` and `{}` are dropped and a
  // non-array path is discarded rather than stringified.
  assert.equal(info.issues.length, 3);
  assert.equal(info.issues[0].message, 'one');
  assert.deepEqual(info.issues[1].path, ['field', 0]);
  assert.equal(info.issues[2].path, undefined);
  recordErrorContext(value, { codes: [], stageId: 'stage' });
  assert.equal(getErrorInfo(value).code, 'one');
  assert.equal(getErrorInfo(Object.assign(() => {}, { code: 'FUNCTION' })).code, 'FUNCTION');
  assert.deepEqual(diagnosticError(null), { name: 'NonError', message: 'null' });
  assert.throws(() => normalizeDiagnosticEvent(null));
});
test('sub-flow payloads reject array, property and complexity attacks while preserving sparse JSON arrays', () => {
  assert.deepEqual(payloadSnapshot({ array: [null, 1, 'text'], sparse: Array(2) }).sparse, [
    null,
    null,
  ]);
  const extra = [];
  extra.named = 1;
  const nonenumerable = {};
  Object.defineProperty(nonenumerable, 'hidden', { value: 1 });
  // Arrays over 4096 entries, extra named properties, non-enumerable keys and symbol
  // keys are all outside the JSON payload shape that may be recorded.
  for (const value of [
    { array: Array(4097) },
    { array: extra },
    { value: nonenumerable },
    { value: { [Symbol('key')]: 1 } },
  ])
    assert.throws(() => payloadSnapshot(value));
  for (const value of [null, 7, [], Object.create(null)])
    assert.throws(() => payloadSnapshot(value));
  for (const value of [null, undefined, 7, {}]) assert.throws(() => readSubFlowLogger(value));
});
test('sub-flow metadata, transitions and incremental payloads retain write-once facts', () => {
  const owner = {},
    log = createSubFlowLogger(
      owner,
      () => true,
      () => true,
      () => {},
    );
  assert.equal(log.write({ name: 'x', kind: 'test', nextStepIds: {} }), -1);
  const first = log.write({
    name: 'first',
    kind: 'test',
    status: 'running',
    startedAtMs: 10,
    relatedDefinitionId: 'definition',
    caseId: 'case',
    summary: 'summary',
    payload: { record: { a: 1 }, array: [] },
    nextStepIds: [],
  });
  const second = log.write({
    name: 'second',
    kind: 'test',
    parentStepId: first,
    startedAtMs: 10,
    endedAtMs: 20,
    status: 'success',
    usedModel: true,
  });
  assert.equal(log.fix(second, { usedModel: false }), false);
  assert.equal(log.fix(first, { nextStepIds: [second] }), false);
  log.fix(first, { summary: 'summary', payload: { record: { b: 2 } } });
  assert.equal(log.fix(first, { summary: 'changed' }), false);
  const third = log.write({ name: 'third', kind: 'test' });
  log.fix(third, { summary: 'added', nextStepIds: [first] });
  assert.equal(log.fix(third, { nextStepIds: [] }), false);
  assert.equal(log.fix(third, { nextStepIds: 7 }), false);
  assert.equal(readSubFlowLogger(log, owner).findLast(step => (step.targetStepId ?? step.stepId) === first).payload.record.b, 2);
});
test('observer selection, serialization and node report failures cannot change business execution', async () => {
  const broken = createDiagnostics({
    output: {
      accepts() {
        throw Error('selection');
      },
      write() {
        assert.fail();
      },
    },
  });
  // A throwing event-selection predicate disables that output/observer for the
  // event instead of failing the model call.
  assert.equal(broken.enabled('model.start'), false);
  const observer = createDiagnostics({
    observe: {
      accepts() {
        throw Error('selection');
      },
      event() {
        assert.fail();
      },
    },
  });
  assert.equal(observer.enabled('model.start'), false);
  const records = [],
    diagnostics = createDiagnostics({
      output: {
        write: (value) => {
          records.push(value);
        },
      },
      observe: {
        accepts: () => true,
        event: async () => {
          throw Error('observer');
        },
      },
    });
  diagnostics.emit('model.start', () => {
    throw Error('payload');
  });
  diagnostics.emit('node.progress', () => ({
    subStep: { operation: 'write' },
    reportError: 'invalid',
  }));
  const reports = new NodeReports(diagnostics);
  reports.report({ usedModel: 'invalid' });
  // The bad report is recorded as INVALID_NODE_REPORT and the run continues.
  assert.ok(records.some((record) => record.payload.reportError === 'INVALID_NODE_REPORT'));
  const toolError = Error('execute'),
    registry = new ToolRegistry({
      execution: { diagnostics },
      errors: {
        errorCode() {
          throw Error('decoration');
        },
      },
    });
  registry.register({
    id: 'tool',
    kind: 'read',
    parseInput: (value) => value,
    execute() {
      throw toolError;
    },
    parseOutput: (value) => value,
  });
  assert.throws(
    () => registry.invoke({ toolId: 'tool', input: {} }),
    (error) => error === toolError,
  );
  const configured = new ToolRegistry({ execution: { diagnostics } });
  configured.register({
    id: 'tool',
    kind: 'read',
    parseInput: (value) => value,
    execute: (value) => value,
    parseOutput: (value) => value,
    debugSteps() {
      throw Error('debug');
    },
  });
  // A throwing `debugSteps` only loses sub-step reporting; the tool result stands.
  assert.equal(configured.invoke({ toolId: 'tool', input: 7 }).value, 7);
  assert.throws(() =>
    configured.invoke({
      toolId: 'tool',
      input: {},
      diagnostics: createDiagnostics({ runId: 'foreign' }),
    }),
  );
  const blankCode = new ToolRegistry({ errors: { errorCode: () => '' } });
  blankCode.register({
    id: 'tool',
    kind: 'read',
    parseInput() {
      throw toolError;
    },
    execute() {},
    parseOutput() {},
  });
  assert.throws(() => blankCode.invoke({ toolId: 'tool', input: {} }));
  assert.equal(blankCode.events[0].errorCode, undefined);
});
test('reply preview validates settings, render hooks and every malformed token category', async () => {
  assert.throws(() => Support.createReplyPreview({ rules: [], sink: null }));
  assert.throws(() => Support.createReplyPreview({ rules: [], sink() {}, maxChars: 0 }));
  const output = [],
    preview = Support.createReplyPreview({
      rules: [{ toolId: 'answer' }],
      render: (text) => text.toUpperCase(),
      sink: (value) => output.push(value),
    });
  const send = (type, part) =>
    preview({ invocationId: 'one', type, payload: { stageId: 'reply', part } });
  for (const value of ['{"text":"x\u0001"}', '{:"x"}', '{"text":{} "x":0}', '{}{}']) {
    await send('model.start');
    await send('model.output', { index: 0, name: 'answer', arguments: value });
    assert.deepEqual(output.at(-1), []);
  }
  await send('model.start');
  await send('model.output', { index: 0, name: 'answer', arguments: '{"text":"visible"}' });
  assert.deepEqual(output.at(-1), ['VISIBLE']);
});

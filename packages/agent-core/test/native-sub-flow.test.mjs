import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as core from '../dist/esm/index.js';
import * as kits from '../dist/esm/kits/index.js';
const esm = { ...core, ...kits };
const require = createRequire(import.meta.url);
import { NodeReports } from '../dist/esm/execution/reporting.js';
import { nativeSubFlowSync } from '../dist/esm/diagnostics/native-sub-flow.js';

for (const [format, api] of [['esm', esm], ['cjs', { ...require('../dist/cjs/index.js'), ...require('../dist/cjs/kits/index.js') }]]) {
  const context = () => {
    const events = [];
    const diagnostics = api.createDiagnostics({ observe: { accepts: () => true, event: fact => events.push(fact) } });
    const Reports = format === 'esm' ? NodeReports : require('../dist/cjs/execution/reporting.js').NodeReports;
    const reports = new Reports(diagnostics);
    return { events, reports, logger: reports.createSubFlowLogger(), signal: new AbortController().signal, app: undefined };
  };
  test(`${format}: native calls are opt-in, pair writes with independent fixes, and preserve failures`, async () => {
    const execution = context();
    const runner = new api.ModelRunner(api.Support.createModelStrategy({ model: { provider: { async *stream() { yield 'answer'; } } }, maxCalls: 4 }));
    await runner.invoke('unrecorded');
    assert.deepEqual(execution.logger.readAll(), []);
    assert.equal((await runner.invoke({ input: 'recorded', logger: execution.logger })).value, 'answer');
    const registry = new api.ToolRegistry().register({ id: 'read', kind: 'read', parseInput: value => value, parseOutput: value => value, execute: value => value });
    assert.equal(registry.invoke({ toolId: 'read', input: 1, logger: execution.logger }).value, 1);
    await assert.rejects(registry.invokeAsync({ toolId: 'missing', input: {}, logger: execution.logger }));
    const records = execution.logger.readAll();
    assert.deepEqual(records.map(record => record.operation), ['write', 'fix', 'write', 'fix', 'write', 'fix']);
    assert.deepEqual(records.map(record => record.sequence), [1, 2, 3, 4, 5, 6]);
    assert.deepEqual(records.filter(record => record.operation === 'fix').map(record => record.status), ['success', 'success', 'error']);
    for (let index = 0; index < records.length; index += 2) {
      assert.equal(records[index + 1].targetStepId, records[index].stepId);
      assert.notEqual(records[index + 1].stepId, records[index].stepId);
      assert.equal(records[index].status, 'running');
    }
    execution.reports.close();
    const count = records.length;
    assert.equal((await runner.invoke({ input: 'detached', logger: execution.logger })).value, 'answer');
    assert.equal(execution.logger.readAll().length, count);
    for (const event of execution.events) api.normalizeDiagnosticEvent(event);
  });
  test(`${format}: Kit execution writes fixed records only for explicitly supplied loggers`, async () => {
    const execution = context();
    const checks = api.Answering.defineAnswerCheckCatalog([{ id: 'required', check: value => ({ status: value ? 'passed' : 'failed', value, issues: [] }) }]);
    checks.check({ checkIds: ['required'], value: 'ok' }, execution);
    const knowledge = api.Knowledge.defineKnowledgeCatalog([{ id: 'manual', revision: 'r1', parts: ['text'] }]);
    knowledge.read({ documentId: 'manual', selection: { mode: 'document' } }, execution);
    const outputs = api.Presentation.defineOutputCatalog([{ id: 'text', kind: 'text', fields: [{ id: 'body', owner: 'generated', type: 'string' }] }]);
    outputs.compose({ outputId: 'text', input: { generated: { body: 'answer' } } }, execution);
    assert.deepEqual(execution.logger.readAll().filter(row => row.operation === 'write').map(row => row.name), ['Check answer', 'Read knowledge', 'Compose output']);
    api.Policies.defineRecoveryChain([
      { id: 'miss', description: 'No recovery', tryRecover: () => ({ handled: false }) },
      { id: 'recover', description: 'Recover', tryRecover: () => ({ handled: true, value: 'ok' }) },
    ]).tryRecover('input', execution);
    api.Delivery.defineDelivery({
      createState: () => ({}),
      stages: [{ id: 'send', handle: () => ({ type: 'complete', value: 'sent' }) }],
      missingResult: () => Error('missing'),
    }).deliver('input', execution);
    api.Aggregation.defineQueryAggregation({ execute: value => [value] }).collect([1, 2], {}, execution);
    assert.deepEqual(execution.logger.readAll().filter(row => row.operation === 'write').slice(3).map(row => row.name), ['Recovery attempt', 'Recovery attempt', 'Deliver result', 'Aggregate queries']);
    const before = execution.logger.readAll();
    checks.check({ checkIds: ['required'], value: 'ok' }, { signal: execution.signal, app: undefined });
    assert.equal(execution.logger.readAll(), before);
  });
  test(`${format}: concurrent calls append fixes in completion order and retain original writes`, async () => {
    const execution = context(), releases = new Map();
    const registry = new api.ToolRegistry().register({
      id: 'wait', kind: 'test', parseInput: value => value, parseOutput: value => value,
      execute: key => new Promise(resolve => releases.set(key, resolve)),
    });
    const first = registry.invokeAsync({ toolId: 'wait', input: 'first', logger: execution.logger });
    const second = registry.invokeAsync({ toolId: 'wait', input: 'second', logger: execution.logger });
    const starts = execution.logger.readAll();
    releases.get('second')('second');
    await second;
    releases.get('first')('first');
    await first;
    const records = execution.logger.readAll();
    assert.deepEqual(records.map(row => row.sequence), [1, 2, 3, 4]);
    assert.equal(records[2].targetStepId, starts[1].stepId);
    assert.equal(records[3].targetStepId, starts[0].stepId);
    assert.equal(records[0], starts[0]);
    assert.equal(records[1], starts[1]);
  });
  test(`${format}: invocation cancellation is recorded without replacing the original failure`, () => {
    const execution = context(), controller = new AbortController(), reason = Error('cancel invocation');
    assert.throws(() => api.executeInvocation({ id: 'cancel', call() { controller.abort(reason); } }, {}, {}, {
      logger: () => execution.logger, signal: () => controller.signal,
    }), error => error === reason);
    assert.equal(execution.logger.readAll().at(-1).status, 'cancelled');
    const original = Error('original unavailable');
    const registry = new api.ToolRegistry({ errors: { unavailable: () => original } });
    assert.throws(() => registry.invoke({ toolId: 'missing', input: {}, logger: { write() { throw Error('broken logger'); }, fix() { throw Error('broken logger'); } } }), /full SubFlowLogger/);
  });

}

test('optional recording failures leave native operation results and primary errors intact', () => {
  const logger = new NodeReports().createSubFlowLogger();
  const original = new Error('operation failed');
  let called = 0;
  core.executeInvocation({ id: 'read', call() { called++; } }, {}, {}, {
    logger() { throw new Error('logger unavailable'); },
  });
  core.executeInvocation({ id: 'x'.repeat(1024), call() { called++; } }, {}, {}, {
    logger: () => logger,
  });
  assert.equal(called, 2);
  assert.deepEqual(logger.readAll(), []);

  const unwritable = { write() { throw new Error('write failed'); } };
  assert.equal(nativeSubFlowSync({ logger: unwritable }, 'retrieval', 'read', () => 42), 42);
  const revisions = [];
  const unfixable = {
    write: () => 'step',
    fix(step, patch) { revisions.push([step, patch.status]); throw new Error('fix failed'); },
  };
  const context = { logger: unfixable, get signal() { throw new Error('signal unavailable'); } };
  assert.throws(() => nativeSubFlowSync(context, 'retrieval', 'read', () => { throw original; }),
    error => error === original);
  assert.deepEqual(revisions, [['step', 'error']]);
});

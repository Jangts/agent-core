import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as esm from '../dist/esm/index.js';
import { NodeReports } from '../dist/esm/execution/reporting.js';
const require = createRequire(import.meta.url);
for (const [format, api, Reports] of [
  ['esm', esm, NodeReports],
  ['cjs', require('../dist/cjs/index.js'), require('../dist/cjs/execution/reporting.js').NodeReports],
]) {
  function fixture(content = true) {
    const events = [];
    const diagnostics = api.createDiagnostics({ observe: { accepts: ({ content: level }) => content || level === 'metadata', event: event => events.push(event) } });
    const reports = new Reports(diagnostics);
    return { logger: reports.createSubFlowLogger(), reports, events };
  }
  test(`${format}: scoped delegates share all reads, constrain only writes, and do not inherit or fork`, () => {
    const { logger, reports, events } = fixture();
    const scope = logger.fork('资料准备'), other = logger.fork('交付');
    assert.ok(logger instanceof api.SubFlowLogger);
    assert.ok(scope instanceof api.ScopedSubFlowLogger);
    assert.equal(scope instanceof api.SubFlowLogger, false);
    assert.equal('fork' in scope, false);
    const direct = logger.write({ subnodeId: '资料准备', type: 'custom/read-source', name: 'Direct', kind: 'read' });
    const delegated = scope.write({ type: 'custom/check-source', name: 'Delegated' });
    const foreign = other.write({ name: 'Other', kind: 'other', type: 'anything.app.wants' });
    assert.equal(scope.fix(direct, { status: 'running' }), true);
    assert.equal(scope.fix(delegated, { status: 'success' }), true);
    const before = logger.readAll();
    assert.equal(scope.fix(foreign, { status: 'success' }), false);
    for (const patch of [{ subnodeId: '交付' }, { type: 'different' }, { relatedInvocationId: 'different' }, { stepId: foreign }, { kind: 'new' }, { name: 'renamed' }]) assert.equal(scope.fix(direct, patch), false);
    assert.equal(scope.write({ subnodeId: '交付', type: 'spoofed', name: 'Spoof', kind: 'other' }), -1);
    assert.equal(logger.readAll(), before);
    assert.equal(scope.readAll(), before);
    assert.equal(other.readAll(), before);
    assert.equal(before[2].subnodeId, '交付');
    assert.equal(before[3].type, 'custom/read-source');
    assert.equal(before[3].operation, 'fix');
    assert.equal(before[3].targetStepId, direct);
    assert.equal(before[0].operation, 'write');
    reports.close();
    assert.equal(scope.write(null), -1);
    assert.equal(scope.fix(direct, null), false);
    assert.equal(scope.readAll(), before);
    assert.equal(logger.write(null), -1);
    for (const event of events) api.normalizeDiagnosticEvent(event);
  });
  test(`${format}: scoped metadata injection never evaluates private content getters`, () => {
    const { logger } = fixture(false), scope = logger.fork('private');
    let reads = 0;
    const input = { name: 'Read', kind: 'read', type: 'custom/private', get payload() { reads++; throw Error('private'); }, get summary() { reads++; throw Error('private'); } };
    const id = scope.write(input);
    assert.notEqual(id, -1);
    assert.equal(scope.fix(id, { get payload() { reads++; throw Error('private'); } }), true);
    assert.equal(reads, 0);
  });
  test(`${format}: real invocations reuse their receipt identity and expose only a scoped logger`, async () => {
    const { logger, events } = fixture();
    let child;
    const registry = new api.ToolRegistry().register({ id: 'sample', kind: 'read', parseInput: value => value, parseOutput: value => value, execute(value, context) {
      child = context.logger;
      assert.ok(child instanceof api.ScopedSubFlowLogger);
      const id = child.write({ name: 'Business detail', kind: 'read', type: 'sample.detail' });
      assert.equal(child.fix(id, { status: 'success' }), true);
      return value;
    } });
    const first = registry.invoke({ toolId: 'sample', input: 1, logger });
    const second = registry.invoke({ toolId: 'sample', input: 2, logger });
    const records = logger.readAll();
    assert.deepEqual([...new Set(records.map(row => row.subnodeId))], ['tool:sample:1', 'tool:sample:2']);
    for (const receipt of [first, second]) assert.ok(records.some(row => row.relatedInvocationId === receipt.invocation.invocationId));
    assert.equal(child.readAll(), records);
    assert.throws(() => registry.invoke({ toolId: 'sample', input: 3, logger: child }), /full SubFlowLogger/);
    await assert.rejects(registry.invokeAsync({ toolId: 'sample', input: 3, logger: child }), /full SubFlowLogger/);
    const runner = new api.ModelRunner(api.Support.createModelStrategy({ model: { provider: { async *stream() { yield 'ok'; } } }, maxCalls: 1 }));
    await assert.rejects(runner.invoke({ input: 'no', logger: child }), /full SubFlowLogger/);
    const result = await runner.invoke({ input: 'yes', logger });
    assert.ok(logger.readAll().some(row => row.kind === 'model' && row.relatedInvocationId === result.invocation.invocationId));
    const before = logger.readAll();
    assert.throws(() => api.executeInvocation({ id: 'call', call() { assert.fail('must not run'); } }, {}, {}, { logger: () => child }), /full SubFlowLogger/);
    assert.equal(logger.readAll(), before);
    for (const event of events) api.normalizeDiagnosticEvent(event);
  });
  test(`${format}: rejected fixes warn safely once per reason without throwing or appending`, () => {
    const { logger, reports } = fixture();
    const own = logger.fork('own'), other = logger.fork('other');
    const id = own.write({ name: 'Own', type: 'custom' });
    const foreign = other.write({ name: 'Other', type: 'custom' });
    const before = logger.readAll(), warnings = [], original = console.warn;
    console.warn = value => warnings.push(value);
    try {
      assert.equal(own.fix(id, { type: 'secret-patch-value' }), false);
      assert.equal(own.fix(id, { type: 'secret-patch-value' }), false);
      assert.equal(own.fix(foreign, { status: 'success' }), false);
      assert.equal(own.fix(foreign, { status: 'success' }), false);
      reports.close();
      assert.equal(own.fix(id, { payload: { confidential: 'secret-patch-value' } }), false);
      assert.equal(warnings.length, 3);
      assert.ok(warnings.some(value => value.includes('forbidden field')));
      assert.ok(warnings.some(value => value.includes('this subnode')));
      assert.ok(warnings.some(value => value.includes('detached')));
      assert.equal(warnings.join('').includes('secret-patch-value'), false);
      assert.equal(logger.readAll(), before);
    } finally { console.warn = original; }
    console.warn = () => { throw Error('broken console'); };
    try { assert.equal(logger.fix('missing', {}), false); }
    finally { console.warn = original; }
  });

}

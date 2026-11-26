import test from 'node:test';
import assert from 'node:assert/strict';
import { createReference } from '../development/docs/examples/organization-comparison.mjs';

for (const organization of ['use-case', 'exploration']) {
  const run = async (options = {}) => {
    const ref = createReference(organization, options);
    return { ...ref, result: await ref.engine.run(ref.state) };
  };
  test(`${organization}: actual route, calls, projection and justified extension`, async () => {
    const { result, ledger } = await run({ longContext: true });
    assert.match(result.answer, /online/);
    assert.equal(ledger.calls.length, 2);
    assert.equal(ledger.effects, 1);
    assert.deepEqual(ledger.tools, ['read', 'save', 'optional']);
    assert.equal(ledger.budget.used, 1);
    assert.equal(ledger.budget.limit, 2);
    assert.equal(ledger.assessment.action, 'expand');
    assert.equal(result.evidence.source, 'monitor:7');
    assert.ok(ledger.calls[1].includes(result.evidence.status));
    assert.equal(result.receipt.scope, 'account-demo');
    assert.ok(ledger.projection.before > ledger.projection.after);
    assert.match(ledger.calls[1], /monitor:7/);
    assert.doesNotMatch(ledger.calls[1], /duplicate/);
    const visits = ledger.events.filter((e) => e.type === 'workflow.event' && e.payload.event.type === 'enter').map((e) => e.payload.event.nodeId);
    assert.deepEqual(visits, organization === 'use-case' ? ['understand', 'explain-status', 'save', 'optional', 'format'] : Array(6).fill('explore'));
  });
  test(`${organization}: optional failure preserves answer and confirmed receipt`, async () => {
    const { result } = await run({ optionalFailure: true });
    assert.match(result.answer, /online/);
    assert.ok(result.receipt.confirmed);
    assert.match(result.warning, /Optional/);
  });
  test(`${organization}: confirmed effects and same-scope evidence are reused`, async () => {
    const { ledger } = await run({ cached: true, receipt: { id: 'request-7', scope: 'account-demo', confirmed: true } });
    assert.equal(ledger.effects, 0);
    assert.deepEqual(ledger.tools, ['optional']);
  });
  for (const unresolvedWrite of [false, true]) test(`${organization}: unknown write reconciles, unresolved=${unresolvedWrite}`, async () => {
    const { result, ledger } = await run({ unknownWrite: true, unresolvedWrite });
    assert.equal(ledger.effects, 1);
    assert.deepEqual(ledger.tools, ['read', 'save', 'receipt', 'optional']);
    assert.match(result.answer, /online/);
    assert.equal(Boolean(result.receipt), !unresolvedWrite);
    assert.equal(Boolean(result.pending), unresolvedWrite);
  });
  for (const option of ['hardLimit', 'modelFailure']) test(`${organization}: ${option} retains sourced facts`, async () => {
    const { result, ledger } = await run({ [option]: true });
    assert.match(result.answer, /monitor:7/);
    assert.ok(result.partial);
    assert.equal(ledger.calls.length, option === 'hardLimit' ? 1 : 2);
  });
  for (const option of ['missing', 'readFailure']) test(`${organization}: ${option} does not invent completion`, async () => {
    const { result, ledger } = await run({ [option]: true });
    assert.ok(result.blocked);
    assert.equal(result.answer, undefined);
    assert.equal(ledger.effects, 0);
    assert.equal(ledger.calls.length, option === 'missing' ? 0 : 1);
  });
  test(`${organization}: cancellation is terminal and keeps committed App state`, async () => {
    const { engine, state, ledger } = createReference(organization, { cancel: true });
    await assert.rejects(engine.run(state));
    assert.match(state.answer, /online/);
    assert.ok(state.receipt.confirmed);
    assert.equal(ledger.effects, 1);
    assert.equal(ledger.tools.includes('optional'), false);
  });
}

for (const organization of ['use-case', 'exploration']) {
  for (const [status, tool] of [['online', null], ['degraded', 'incident'], ['changing', 'deployment']])
    test(`${organization}: evidence-driven path ${status}`, async () => {
      const { engine, state, ledger } = createReference(organization, { status });
      const result = await engine.run(state);
      assert.equal(result.evidence.status, status);
      assert.match(result.answer, new RegExp(status));
      assert.deepEqual(ledger.tools, ['read', ...(tool ? [tool] : []), 'save', 'optional']);
      if (tool) {
        assert.equal(result.detail.source, tool + ':7');
        assert.ok(ledger.calls[1].includes(result.detail.explanation));
      }
      if (organization === 'exploration') {
        const actions = ledger.events.filter(e => e.type === 'node.progress').map(e => e.payload.payload.action).filter(Boolean);
        assert.deepEqual(actions, ['understand', 'read', ...(tool ? ['detail'] : []), 'draft', 'save', 'optional', 'format']);
      }
    });
  test(`${organization}: no progress stops detail investigation and preserves sourced status`, async () => {
    const { engine, state, ledger } = createReference(organization, { status: 'degraded', noProgress: true });
    const result = await engine.run(state);
    assert.match(result.partial, /No new/);
    assert.match(result.answer, /degraded/);
    assert.equal(ledger.tools.filter(t => t === 'incident').length, 1);
    assert.equal(ledger.effects, 1);
  });
  for (const option of ['receiptFailure', 'denyReceipt']) test(`${organization}: ${option} retains answer without write replay`, async () => {
    const { engine, state, ledger } = createReference(organization, { unknownWrite: true, [option]: true });
    const result = await engine.run(state);
    assert.match(result.pending, /verification unavailable/);
    assert.match(result.answer, /online/);
    assert.equal(result.receipt, undefined);
    assert.equal(ledger.effects, 1);
    const auth = ledger.authorizations.filter(a => ['save', 'receipt'].includes(a.toolId));
    assert.deepEqual(auth.map(a => [a.toolId, a.scope, a.key]), [['save', 'account-demo', 'request-7'], ['receipt', 'account-demo', 'request-7']]);
  });
  test(`${organization}: format repair failure never reopens writes or models`, async () => {
    const { engine, state, ledger } = createReference(organization, { formatFailure: true });
    const result = await engine.run(state);
    assert.match(result.answer, /online/);
    assert.match(result.formatWarning, /original answer retained/);
    assert.ok(result.receipt.confirmed);
    assert.equal(ledger.effects, 1);
    assert.equal(ledger.calls.length, 2);
    assert.deepEqual(ledger.tools, ['read', 'save', 'optional']);
  });
  for (const cancelAt of ['understand', 'read', 'draft', 'save']) test(`${organization}: cancellation at ${cancelAt} is never converted to a result`, async () => {
    const { engine, state, ledger } = createReference(organization, { cancelAt });
    await assert.rejects(engine.run(state));
    assert.equal(ledger.tools.includes('receipt'), false);
    assert.equal(ledger.tools.includes('optional'), false);
    if (cancelAt === 'save') assert.match(state.answer, /online/);
  });
}

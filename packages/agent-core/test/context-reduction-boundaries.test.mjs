/*
 * Boundary contract for the Support context pipeline: canonical validation of
 * policies and operation kinds, when reduction may be skipped, and how much of a
 * plan may change while it is being reduced.
 *
 * Complementary to `context-compaction.test.mjs`: that file checks what survives
 * compaction, this one checks the machinery around it - unknown modes fail with
 * one canonical validation error, an already-small fragment costs no call, an
 * auto selector only picks candidates whose loss it can estimate, and assembly
 * rejects two fragments that would write the same field.
 *
 * Runs on `dist/esm`; model calls are replaced by stubs that record their input.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  beginContextProcessing,
  chooseSteps,
  applyReduction,
  limitedCall,
  needsReduction,
  validateContextPolicy,
  contextReductionCatalog,
} from '../dist/esm/support/context/processing.js';
import { contextSelectionCatalog } from '../dist/esm/support/context/selection-policy.js';
import { createContextSelector } from '../dist/esm/support/context/selection.js';
import {
  createContextProcessingNode,
  createContextReductionNode,
} from '../dist/esm/support/context/nodes.js';
import { createContextStrategy } from '../dist/esm/support/context/strategies.js';
const signal = new AbortController().signal;
const frag = (value) => ({
  id: 'history',
  sourceId: 'app',
  trust: 'user',
  role: 'user',
  lifetime: 'turn',
  maxChars: 10000,
  value,
});
const trim = {
  id: 'trim',
  kind: 'trim',
  fragmentId: 'history',
  targetChars: 1,
  field: 'messages',
  grouping: { kind: 'user-turn' },
  keepGroups: 1,
};
const compress = {
  id: 'compress',
  kind: 'compress',
  fragmentId: 'history',
  handlerId: 'c',
  targetChars: 1,
  preserve: { field: 'messages', grouping: { kind: 'user-turn' }, keepGroups: 1 },
};
const ports = { stageId: 's', signal, compressors: [], callModel: async () => ({ value: 'ok' }) };
test('context catalogs reject unknown modes and operation kinds using canonical validation', () => {
  assert.throws(
    () => validateContextPolicy({ mode: 'unknown' }, []),
    (e) => e.issues[0].message.includes('Unknown'),
  );
  assert.throws(
    () => validateContextPolicy({ mode: 'reduce', steps: [{ ...trim, kind: 'unknown' }] }, []),
    (e) => e.issues[0].message.includes('Unknown'),
  );
  const node = { id: 'context', description: 'Context', plan() {}, update() {}, routes: [] };
  assert.throws(
    () => createContextProcessingNode({ ...node, compressors: [{ id: 'c', compress: 1 }] }),
    (e) => e.issues[0].message.includes('compressor'),
  );
  assert.throws(
    () =>
      createContextProcessingNode({
        ...node,
        policy: { mode: 'reduce', steps: [] },
        selectors: [{ id: 's', select: 1 }],
      }),
    (e) => e.issues[0].message.includes('selector'),
  );
  assert.throws(
    () =>
      createContextStrategy([
        {
          kind: 'recent',
          fragment: { id: 'a', maxChars: 100 },
          field: 'messages',
          selection: { mode: 'sequence' },
        },
        { kind: 'recent', fragment: { id: 'b', maxChars: 100 }, field: 'messages' },
      ]),
    /second argument/,
  );
});
test('context reduction avoids needless calls, honors absent live budgets and keeps protected recent history intact', async () => {
  const fragment = frag({ messages: [{ role: 'user', content: 'recent' }] });
  let calls = 0;
  const call = {
    step: compress,
    fragment,
    stageId: 's',
    signal,
    compressors: [
      {
        id: 'c',
        compress() {
          calls++;
          assert.fail();
        },
      },
    ],
    callModel: ports.callModel,
  };
  // With `keepGroups: 1` the only message is protected, so compression must return
  // the value unchanged and never consult the handler.
  assert.deepEqual(await contextReductionCatalog.compress.run(call), fragment.value);
  assert.equal(calls, 0);
  const work = beginContextProcessing(
    { fragments: [fragment], maxInputChars: 10000 },
    { mode: 'reduce', steps: [trim] },
    ports,
  );
  work.report.decisions = [];
  assert.deepEqual(
    await chooseSteps(work, [{ ...trim, targetChars: 10000 }], { mode: 'sequence' }),
    [],
  );
  assert.deepEqual(await chooseSteps(work, [trim], { mode: 'auto' }), []);
  await applyReduction(work, { ...trim, targetChars: 10000 }, { mode: 'sequence' });
  assert.deepEqual(work.report.changes, []);
  const consume = limitedCall(ports, 1, 0);
  assert.equal((await consume({})).value, 'ok');
  assert.throws(() => consume({}), /allowance/);
  const plain = beginContextProcessing(
    {
      fragments: [{ ...frag('large text'), role: 'system', trust: 'server' }],
      maxInputChars: 10000,
    },
    { mode: 'validate' },
    ports,
  );
  assert.equal(needsReduction(plain, { chars: 10000 }), false);
});
test('automatic context selection sorts eligible trims and treats missing loss estimates conservatively', async () => {
  const result = await contextSelectionCatalog.auto.choose({
    selection: { mode: 'auto' },
    candidates: [
      // The first candidate has no loss estimate, so it cannot be ranked and must be
      // excluded; between the other two the lower loss ratio wins, not the larger
      // projected saving.
      { id: 'missing', kind: 'trim', chars: 10, projectedChars: 5 },
      { id: 'second', kind: 'trim', chars: 10, projectedChars: 9, trimLossRatio: 0.2 },
      { id: 'first', kind: 'trim', chars: 10, projectedChars: 9, trimLossRatio: 0.1 },
    ],
  });
  assert.deepEqual(result.stepIds, ['first']);
  const selector = createContextSelector({
    id: 's',
    transport: 't',
    maxOutputTokens: 30,
    maxExcerptChars: 50,
  });
  let request;
  assert.deepEqual(
    await selector.select({
      stageId: 's',
      fragments: [{ id: 'f', value: { a: 1 } }],
      candidates: [],
      currentChars: 10,
      requiredReductionChars: 1,
      remainingCalls: 2,
      async callModel(input) {
        request = input;
        return { value: { stepIds: [] } };
      },
    }),
    [],
  );
  assert.equal(JSON.parse(request.input[1].content).excerpts[0].excerpt, '{"a":1}');
});
test('registered context reduction nodes resolve static operation IDs without reconstructing model requests', async () => {
  const fragment = frag({
    messages: [
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'long old answer' },
      { role: 'user', content: 'recent' },
    ],
  });
  const node = createContextReductionNode({
    id: 'reduce',
    description: 'Reduce',
    stepId: (state) => state.stepId,
    policy: { mode: 'reduce', steps: [trim] },
    prepared: () => ({
      stageId: 's',
      remainingCalls: 1,
      measure: () => ({ maxInputChars: 10000 }),
    }),
    plan: () => ({ fragments: [fragment], maxInputChars: 10000 }),
    update: (result) => ({ result }),
    routes: [],
  });
  const result = await node.run({ stepId: 'trim' }, { signal, report() {} });
  assert.equal(result.result.report.changes[0].kind, 'trim');
  // Only fragments the plan marked mutable are reduced; the rest stay intact.
  assert.deepEqual(result.result.plan.mutableFragmentIds, ['history']);
});

test('context assembly rejects duplicate data fields across independently identified fragments', async () => {
  const { assembleFragments } = await import('../dist/esm/context/assembly.js');
  assert.throws(
    () => assembleFragments([frag({ shared: 1 }), { ...frag({ shared: 2 }), id: 'second' }], 1000),
    /Duplicate context field: shared/,
  );
});

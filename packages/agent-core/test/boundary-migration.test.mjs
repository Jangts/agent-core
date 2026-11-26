/*
 * Migration contract for the extracted Support/Kits entry points: they must be
 * the same implementations as the legacy root exports, and the callback protocol
 * of `executeInvocation` must survive the move.
 *
 * The two halves are linked on purpose. The first part pins the invocation phase
 * order and the receiver of every port callback (journal, handler, receipt,
 * receiptError); the second part proves that Apps importing from a subpath and
 * Apps importing from the root get identical constructors, including in CJS,
 * while `support` no longer re-exports Kit-only symbols.
 *
 * Runs on the published package entries via ESM imports and `createRequire`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  executeInvocation,
  validateContextFragment,
  validateContextBudget,
} from '@jangts/agent-core';
import * as core from '@jangts/agent-core';
import * as support from '@jangts/agent-core/support';
import * as interaction from '@jangts/agent-core/kits/interaction';
import * as domains from '@jangts/agent-core/kits/domains';
import * as tools from '@jangts/agent-core/kits/tools';
import * as presentation from '@jangts/agent-core/kits/presentation';

test('Core invocation preserves callback receivers, receipt phases and original failures', () => {
  const events = [],
    context = {},
    failure = new Error('handler failed');
  const journal = {
    beginTool({ toolId: name, input: value }) {
      assert.equal(this, journal);
      events.push(['begin', name, value]);
      return 'c1';
    },
    finishTool({ invocationId: id, status, value }) {
      assert.equal(this, journal);
      events.push(['finish', id, status, value]);
    },
  };
  const handler = {
    id: 'local',
    call(value, input) {
      assert.equal(this, handler);
      assert.equal(input, context);
      events.push(['call', value]);
    },
  };
  const ports = {
    journal(input) {
      assert.equal(this, ports);
      assert.equal(input, context);
      return journal;
    },
    checkpoint() {
      events.push(['checkpoint']);
      return 3;
    },
    signal() {
      events.push(['signal']);
      return undefined;
    },
    receipt(_input, checkpoint) {
      events.push(['receipt', checkpoint]);
      return false;
    },
    receiptError(error) {
      assert.equal(error, failure);
      return 'original';
    },
  };
  // `signal()` is re-checked before and after the handler, so a cancellation that
  // arrives mid-call is seen before the receipt is written.
  executeInvocation(handler, 0, context, ports);
  assert.deepEqual(events, [
    ['begin', 'local', 0],
    ['checkpoint'],
    ['signal'],
    ['call', 0],
    ['signal'],
    ['receipt', 3],
    ['signal'],
    ['finish', 'c1', 'success', false],
  ]);
  events.length = 0;
  handler.call = () => {
    throw failure;
  };
  assert.throws(
    () => executeInvocation(handler, 0, context, ports),
    (error) => error === failure,
  );
  assert.deepEqual(events, [
    ['begin', 'local', 0],
    ['checkpoint'],
    ['signal'],
    ['signal'],
    ['finish', 'c1', 'error', 'original'],
  ]);
});

test('Core invocation records cancellation without invoking the selected handler', () => {
  const controller = new AbortController(),
    reason = new Error('stop'),
    records = [];
  controller.abort(reason);
  assert.throws(
    () =>
      executeInvocation(
        {
          id: 'selected',
          call() {
            assert.fail('cancelled handler ran');
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
          receiptError: (error) => error,
        },
      ),
    (error) => error === reason,
  );
  assert.deepEqual(records, [{ invocationId: 'c1', status: 'cancelled', value: reason }]);
});

test('Core fragment checks and Support formatting have distinct contracts', () => {
  const fragment = {
    id: 'request',
    sourceId: 'user',
    trust: 'user',
    lifetime: 'turn',
    maxChars: 40,
    role: 'user',
    value: 'plain text',
  };
  assert.equal(validateContextFragment(fragment), 'plain text');
  assert.throws(
    () => support.assembleFragments([fragment], 100),
    /User context must declare structured fields/,
  );
  assert.throws(
    () => validateContextFragment({ ...fragment, role: 'system' }),
    /Untrusted context/,
  );
  // The check is inclusive: an exact fit passes without building an error, one
  // extra character asks the factory exactly once.
  const sentinel = new Error('budget');
  let calls = 0;
  validateContextBudget(2, 2, () => {
    calls++;
    return sentinel;
  });
  assert.equal(calls, 0);
  assert.throws(
    () =>
      validateContextBudget(3, 2, () => {
        calls++;
        return sentinel;
      }),
    (error) => error === sentinel,
  );
  assert.equal(calls, 1);
  assert.deepEqual(
    support.assembleFragments([{ ...fragment, value: { text: 'plain text' } }], 100).messages,
    [
      { role: 'system', content: '' },
      { role: 'user', content: '{"text":"plain text"}' },
    ],
  );
});

test('recommended Kit/Support entrypoints and legacy exports share one implementation in ESM and CJS', () => {
  const require = createRequire(import.meta.url);
  // Each named export is the same binding in the Kit entry and at the root, so
  // mixing import styles cannot produce two registries or two error types.
  for (const [entry, names] of [
    [interaction, ['defineInteractionProtocol', 'defineCommandCatalog', 'bindInteraction']],
    [domains, ['GoalRegistry', 'ScopeRegistry', 'defineAgentCatalog']],
    [tools, ['ToolLifecycleRegistry']],
    [presentation, ['publishReplyEvents', 'REPLY_BUBBLE_BOUNDARY']],
  ]) {
    for (const name of names) assert.equal(core[name], entry[name]);
  }
  // Support is limited to app-side helpers: Kit-only registries must not reappear
  // there once they have been moved.
  assert.equal(support.ToolLifecycleRegistry, undefined);
  assert.equal(support.defineWAITP, undefined);
  for (const name of ['interaction', 'domains', 'tools']) {
    const local = require(`@jangts/agent-core/kits/${name}`),
      legacy = require('@jangts/agent-core');
    for (const key of Object.keys(local)) if (key in legacy) assert.equal(local[key], legacy[key]);
  }
  assert.equal(
    require('@jangts/agent-core/support/model').CompatibleModelProvider,
    require('@jangts/agent-core').CompatibleModelProvider,
  );
  assert.equal(
    require('@jangts/agent-core/support/context').assembleFragments,
    require('@jangts/agent-core/context').assembleFragments,
  );
});

test('Core barrels stay free of Kit implementations while the root keeps Kit helpers available', async () => {
  // `/context` and the capability barrel carry Core contracts only; Kit helpers keep their
  // own `/kits/*` entries instead of riding along with every Core import.
  const context = await import('@jangts/agent-core/context');
  assert.equal(typeof context.assembleFragments, 'function');
  assert.equal(context.defineEvidenceChecklist, undefined);
  assert.equal(context.defineEvidenceProjection, undefined);
  const capabilities = await import('../dist/esm/capabilities/index.js');
  assert.equal(capabilities.defineCommand, undefined);
  assert.equal(capabilities.bindInteraction, undefined);
  // The root convenience surface documented for Apps still exposes both Kit families.
  assert.equal(typeof core.defineEvidenceChecklist, 'function');
  assert.equal(typeof core.defineInteractionProtocol, 'function');
  assert.equal(typeof core.defineCommand, 'function');
  // The unused execution barrel is gone rather than duplicating `/engine`.
  await assert.rejects(import('../dist/esm/execution/index.js'));
});

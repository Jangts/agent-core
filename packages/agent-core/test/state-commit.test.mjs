/**
 * Locks down workflow state commit semantics: node updates are read once and the same
 * snapshot is validated and committed, an own `__proto__` key remains plain data, and
 * cancellation while reading an update getter aborts the whole commit. Runs under
 * node --test with synchronous fixture workflows.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentCoreEngine, defineWorkflow } from '../dist/esm/index.js';

test('Workflow validates and commits the same single snapshot of update getters', async () => {
  let reads = 0;
  const workflow = defineWorkflow({
    id: 'snapshot-update',
    nodes: [
      {
        id: 'answer',
        description: 'Answer',
        provides: ['answer'],
        run: () => ({
          get answer() {
            return ++reads === 1 ? 'checked' : undefined;
          },
        }),
        routes: [{ complete: (state) => state.answer }],
      },
    ],
  });
  const state = {};
  assert.equal(await new AgentCoreEngine({ workflow }).run(state), 'checked');
  assert.equal(state.answer, 'checked');
  // The getter would return undefined on a second read, so exactly one read proves routing
  // and commit share a single validated snapshot.
  assert.equal(reads, 1);
});

test('an own __proto__ update remains data without replacing the state prototype', async () => {
  const state = {},
    prototype = Object.getPrototypeOf(state);
  const workflow = defineWorkflow({
    id: 'data-update',
    nodes: [
      {
        id: 'answer',
        description: 'Answer',
        run: () => JSON.parse('{"__proto__":{"injected":true},"answer":"ok"}'),
        routes: [{ complete: (state) => state.answer }],
      },
    ],
  });
  assert.equal(await new AgentCoreEngine({ workflow }).run(state), 'ok');
  // JSON.parse creates an own `__proto__` property rather than setting the prototype, so
  // prototype pollution must not occur while the key stays as ordinary data.
  assert.equal(Object.getPrototypeOf(state), prototype);
  assert.equal(state.injected, undefined);
  assert.equal(Object.hasOwn(state, '__proto__'), true);
  assert.deepEqual(state.__proto__, { injected: true });
});

test('cancellation while reading an update getter prevents committing any returned field', async () => {
  const control = new AbortController(),
    reason = Error('cancel during update'),
    state = { original: true };
  const workflow = defineWorkflow({
    id: 'cancel-update',
    nodes: [
      {
        id: 'answer',
        description: 'Answer',
        provides: ['answer'],
        run: () => ({
          extra: 'late',
          get answer() {
            control.abort(reason);
            return 'late';
          },
        }),
        routes: [{ complete: (value) => value.answer }],
      },
    ],
  });
  await assert.rejects(
    new AgentCoreEngine({ workflow, execution: { signal: control.signal } }).run(state),
    (error) => error === reason,
  );
  // Cancellation inside the getter aborts before any field is written: even the `extra`
  // field read before the getter must not reach the committed state.
  assert.deepEqual(state, { original: true });
});

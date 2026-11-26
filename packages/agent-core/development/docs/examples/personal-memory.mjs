/** Exercise an evidence-linked correction, session-scoped goal, and retraction offline. */
import assert from 'node:assert/strict';
import {
  applyMemoryUpdate,
  memoryContext,
  memoryUpdateSchema,
} from '@jangts/agent-core/kits/memory';

const schema = memoryUpdateSchema(['preference', 'goal']);
const original = { id: '1', createdAt: 100, orderKey: '01', question: 'Prefer short replies.' };
const correction = { id: '2', createdAt: 100, orderKey: '02', question: 'Prefer detailed replies.' };
const withdrawal = { id: '3', createdAt: 100, orderKey: '03', question: 'Remove that preference.' };
const goal = { id: '4', createdAt: 100, orderKey: '04', scope: 'review-session', question: 'Finish the migration review.' };

const preference = (source, action = 'upsert') => ({
  action, key: 'reply-detail', kind: 'preference', scope: 'account',
  claim: source.question, sourceId: source.id, quote: source.question, validUntil: null,
});

function apply(snapshot, source, candidate) {
  const { operations } = schema.parse({ operations: [candidate] });
  return applyMemoryUpdate(snapshot, operations, [source], 120);
}

let snapshot = apply(undefined, original, preference(original));
snapshot = apply(snapshot, correction, preference(correction));
assert.equal(memoryContext(snapshot, 'replies', 120).summary, correction.question);

snapshot = apply(snapshot, goal, {
  action: 'upsert', key: 'migration-review', kind: 'goal', scope: 'session',
  claim: goal.question, sourceId: goal.id, quote: goal.question, validUntil: 200,
});
const projectGoal = (scope, now) => memoryContext(snapshot, 'migration review', now, scope).related;
assert.equal(projectGoal('review-session', 120).length, 1);
assert.equal(projectGoal('unrelated-session', 120).length, 0);
assert.equal(projectGoal('review-session', 200).length, 0);

snapshot = apply(snapshot, withdrawal, preference(withdrawal, 'retract'));
snapshot = apply(snapshot, correction, preference(correction));
assert.equal(memoryContext(snapshot, 'replies', 120).summary, '');
assert.ok(!JSON.stringify(snapshot).includes('"quote"'));
console.log('Correction, scope, expiry, and retraction verified.');

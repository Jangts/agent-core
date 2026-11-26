/** Save two candidates, promote one, and reject the other because its base is stale. */
import assert from 'node:assert/strict';
import { defineBranchVersioning } from '@jangts/agent-core/kits/branch-versioning';

let saved;
let canPromote = true;
const store = {
  async load() { return structuredClone(saved); },
  async compareAndSwap(_id, expected, next) {
    if (saved?.revision !== expected) return false;
    saved = structuredClone(next);
    return true;
  },
};
const versions = defineBranchVersioning({
  store,
  isState: (value) => typeof value?.policy === 'string',
  authorize(operation) {
    if (operation === 'promote' && !canPromote) throw new Error('Promotion denied');
  },
  validate() {},
});
const context = { app: {}, signal: new AbortController().signal };
const id = 'support-policy';
const branch = { agentId: id, branchId: 'main', agentVersionId: 'v1' };
const initial = await versions.create({ id, branch, state: { policy: 'current' } }, context);

function createCandidate(record, name, version) {
  return versions.fork({
    id,
    revision: record.revision,
    parentId: record.activeId,
    branch: {
      agentId: id, branchId: name, agentVersionId: version,
      parentBranchId: branch.branchId, parentAgentVersionId: branch.agentVersionId,
    },
    state: { policy: name },
  }, context);
}

const first = await createCandidate(initial, 'candidate-a', 'v2');
const second = await createCandidate(first, 'candidate-b', 'v3');
assert.equal(second.activeId, initial.activeId);

const candidateId = first.versions.at(-1).id;
const promotion = { id, revision: second.revision, candidateId, expectedActiveId: initial.activeId };
canPromote = false;
await assert.rejects(versions.promote(promotion, context), /Promotion denied/);
assert.equal(saved.activeId, initial.activeId);

canPromote = true;
const promoted = await versions.promote(promotion, context);
assert.equal(promoted.activeId, candidateId);
await assert.rejects(versions.promote({
  id,
  revision: promoted.revision,
  candidateId: second.versions.at(-1).id,
  expectedActiveId: promoted.activeId,
}, context), /Active family version changed/);
assert.equal(saved.activeId, candidateId);
console.log('Candidate isolation, authorization, promotion, and stale-base rejection verified.');

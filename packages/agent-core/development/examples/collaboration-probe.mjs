/**
 * Deterministic collaboration probe using existing Waiting and Durable contracts.
 * The host owns one atomic parent ledger: decisions, reservations and the simulated action
 * receipt share a commit. This example is not an external-system exactly-once guarantee.
 */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { defineWaitGate } from '@jangts/agent-core/kits/waiting';
import { defineDurableTask } from '@jangts/agent-core/kits/durable';

/** Atomic file replacement and fail-on-contention locks; no stale-lock recovery promise. */
function fileStore(directory) {
  const path = (key) => join(directory, createHash('sha256').update(key).digest('hex'));
  return {
    async exclusive(key, operation) {
      const lock = `${path(key)}.lock`;
      await mkdir(lock);
      try {
        return await operation();
      } finally {
        await rm(lock, { recursive: true });
      }
    },
    async load(key) {
      try {
        return JSON.parse(await readFile(path(key), 'utf8'));
      } catch (error) {
        if (error.code === 'ENOENT') return undefined;
        throw error;
      }
    },
    async save(key, value) {
      const temporary = `${path(key)}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify(value));
      await rename(temporary, path(key));
    },
  };
}

/** Rebuild only request resources; all stable associations come from persisted parent data. */
function assemble(directory) {
  const store = fileStore(directory);
  const context = {
    app: { subject: 'owner', allowed: true },
    signal: new AbortController().signal,
  };
  const authorize = () => {
    context.signal.throwIfAborted();
    if (!context.app.allowed || context.app.subject !== 'owner') throw new Error('Unauthorized');
  };
  const update = (action) =>
    store.exclusive('parent', async () => {
      authorize();
      const parent = await store.load('parent');
      const value = await action(parent);
      await store.save('parent', parent);
      return value;
    });
  const gate = defineWaitGate(
    {
      id: 'collaboration-decision',
      revision: '1',
      isAnswer: (answer) => answer?.choice === 'wait',
      authorize(identity) {
        authorize();
        if (identity.subject !== context.app.subject) throw new Error('Wrong subject');
      },
    },
    { store },
  );
  /** Persist a reservation before any synthetic charged operation; retries never refund it. */
  const reserve = (parent, id, amount) => {
    if (parent.reservations[id] !== undefined) return;
    if (Date.now() >= parent.deadlineAtMs) throw new Error('Parent deadline exceeded');
    if (parent.consumed + amount > parent.limit) throw new Error('Parent budget exhausted');
    parent.reservations[id] = amount;
    parent.consumed += amount;
  };
  const analysis = defineDurableTask(
    {
      id: 'collaboration-analysis',
      revision: '1',
      isState: (s) => Array.isArray(s?.opinions),
      authorize,
      steps: [
        {
          id: 'independent-opinions',
          replayPolicy: 'safe',
          async run() {
            return update((parent) => {
              reserve(parent, 'analysis', 2);
              // Independent, read-only deterministic members; no real model is called.
              parent.opinions = [
                { member: 'a', question: 'publish', materialVersion: '1', claim: 'publish' },
                { member: 'b', question: 'publish', materialVersion: '1', claim: 'wait' },
              ];
              return { opinions: parent.opinions };
            });
          },
        },
      ],
    },
    { store },
  );
  const action = (loseResponse) =>
    defineDurableTask(
      {
        id: 'collaboration-action',
        revision: '1',
        isState: (s) => s?.receipt === null || typeof s?.receipt === 'string',
        authorize,
        steps: [
          {
            id: 'commit-decision',
            replayPolicy: 'reconcile',
            async run() {
              const parent = await store.load('parent');
              const wait = await gate.read(parent.waitIdentity, context);
              if (wait.status !== 'resolved') throw new Error('Decision required');
              const receipt = await update((current) => {
                if (
                  current.contentRevision !== parent.expected.contentRevision ||
                  current.materialVersion !== parent.expected.materialVersion ||
                  current.waitIdentity.waitId !== wait.identity.waitId ||
                  wait.submission.id !== parent.expected.submissionId
                )
                  throw new Error('Stale decision');
                if (current.receipt) {
                  if (current.actionId !== parent.expected.actionId)
                    throw new Error('Action identity conflict');
                  return current.receipt;
                }
                reserve(current, parent.expected.actionId, 1);
                current.actionId = parent.expected.actionId;
                current.acceptedSubmissionId = wait.submission.id;
                current.receipt = 'decision-recorded';
                current.writes += 1;
                return current.receipt;
              });
              if (loseResponse)
                throw Object.assign(new Error('Synthetic response loss'), { code: 'ACK_LOST' });
              return { receipt };
            },
            async reconcile() {
              // Read-only confirmation consumes neither parent reservation nor new model allowance.
              const current = await store.load('parent');
              if (
                current.receipt &&
                current.actionId === current.expected.actionId &&
                current.acceptedSubmissionId === current.expected.submissionId
              )
                return { kind: 'completed', state: { receipt: current.receipt } };
              return { kind: 'unknown', reason: 'No confirmed receipt' };
            },
          },
        ],
      },
      { store },
    );
  const initialize = (id, definitionId, state, parent) =>
    store.exclusive(id, async () => {
      if (await store.load(id)) return;
      await store.save(id, {
        version: 2,
        definitionId,
        revision: '1',
        nextStepIndex: 0,
        attemptCount: 0,
        maxAttempts: 3,
        deadlineAtMs: parent.deadlineAtMs,
        status: 'ready',
        state,
      });
    });
  /** Pure query: does not call Durable.run, allocate budget or accept a decision. */
  const query = async () => {
    authorize();
    const parent = await store.load('parent');
    const wait = await gate.read(parent.waitIdentity, context);
    return { parent, wait, action: await store.load('action') };
  };
  return { store, gate, context, analysis, action, initialize, query };
}

/** A process performs one explicit operation, then releases all request-local resources. */
async function worker(stage, directory) {
  const app = assemble(directory);
  if (stage === 'prepare') {
    const deadlineAtMs = Date.now() + 60000;
    const parent = {
      deadlineAtMs,
      limit: 3,
      consumed: 0,
      reservations: {},
      contentRevision: 1,
      materialVersion: '1',
      writes: 0,
      receipt: null,
      waitIdentity: { taskId: 'parent/dispute-1/content-1', waitId: 'wait-1', subject: 'owner' },
      expected: {
        contentRevision: 1,
        materialVersion: '1',
        submissionId: 'answer-1',
        actionId: 'action-1',
      },
    };
    await app.store.save('parent', parent);
    await app.initialize('analysis', 'collaboration-analysis', { opinions: [] }, parent);
    const result = await app.analysis.run({ taskId: 'analysis' }, app.context);
    assert.notEqual(result.opinions[0].claim, result.opinions[1].claim);
    await app.gate.open({ identity: parent.waitIdentity, expiresAtMs: deadlineAtMs }, app.context);
  } else if (stage === 'respond') {
    const parent = await app.store.load('parent');
    const request = {
      identity: parent.waitIdentity,
      submissionId: 'answer-1',
      answer: { choice: 'wait' },
    };
    await app.gate.respond(request, app.context);
    await app.gate.respond(request, app.context);
  } else if (stage === 'resume' || stage === 'reconcile') {
    const parent = await app.store.load('parent');
    await app.initialize('action', 'collaboration-action', { receipt: null }, parent);
    try {
      await app.action(stage === 'resume').run({ taskId: 'action' }, app.context);
    } catch (error) {
      if (stage !== 'resume' || error.code !== 'ACK_LOST') throw error;
    }
  } else if (stage !== 'query') throw new Error('Unknown stage');
  return { pid: process.pid, ...(await app.query()) };
}

/** Prove real process re-entry, idempotent answer handling and read-only recovery. */
export async function runCollaborationProbe() {
  const base = resolve('.tmp');
  await mkdir(base, { recursive: true });
  const directory = await mkdtemp(join(base, 'collaboration-probe-'));
  const source = fileURLToPath(import.meta.url);
  const run = (stage) =>
    JSON.parse(
      execFileSync(process.execPath, [source, '--worker', stage, directory], { encoding: 'utf8' }),
    );
  try {
    const prepared = run('prepare');
    const answered = run('respond');
    assert.equal(answered.parent.consumed, 2);
    assert.equal(answered.parent.receipt, null);
    const uncertain = run('resume');
    assert.equal(uncertain.action.status, 'running');
    const queried = run('query');
    assert.deepEqual(queried.parent, uncertain.parent);
    assert.deepEqual(queried.action, uncertain.action);
    const confirmed = run('reconcile');
    assert.equal(confirmed.action.status, 'completed');
    assert.equal(confirmed.parent.writes, 1);
    assert.equal(confirmed.parent.consumed, 3);
    assert.equal(confirmed.action.attemptCount, 1);
    assert.equal(confirmed.parent.deadlineAtMs, prepared.parent.deadlineAtMs);
    assert.equal(confirmed.action.deadlineAtMs, prepared.parent.deadlineAtMs);
    assert.equal(
      new Set([prepared.pid, answered.pid, uncertain.pid, queried.pid, confirmed.pid]).size,
      5,
    );
    return {
      processes: 5,
      consumed: 3,
      limit: 3,
      writes: 1,
      attempts: 1,
      queryUnchanged: true,
      originalDeadlinePreserved: true,
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

/** Compare the same atomic host port with manual association checks and the adapter.
 * Both inject response loss after acceptance. The adapter removes repeated preflight,
 * submission/receipt association and expiry checks, not the host's atomic predicate.
 */
export async function runDecisionAdapterComparison() {
  const { defineReviewDecision } = await import('../../dist/esm/kits/review-decision.js');
  async function scenario(recommended) {
    let saved,
      state,
      writes = 0,
      fail = true;
    const context = { app: { subject: 'owner' }, signal: new AbortController().signal };
    const binding = {
      parentTaskId: 'p',
      disputeId: 'd',
      contentRevision: '1',
      sourceVersions: { source: '1' },
      policyRevision: '1',
      waitIdentity: { taskId: 'p/d/1', waitId: 'w1', subject: 'owner' },
      actionId: 'choose-existing',
      deadlineAtMs: Date.now() + 60000,
    };
    state = { binding, status: 'pending' };
    const authorize = () => assert.equal(context.app.subject, 'owner');
    const gate = defineWaitGate(
      { id: 'compare', revision: '1', isAnswer: (v) => v?.choice === 'a', authorize },
      {
        store: {
          async exclusive(_key, fn) {
            return fn();
          },
          async load() {
            return saved;
          },
          async save(_key, value) {
            saved = value;
          },
        },
      },
    );
    const host = {
      binding,
      gate,
      authorize,
      read() {
        return structuredClone(state);
      },
      accept({ binding: expected, submissionId }) {
        // A real App supplies a shared atomic storage transaction for this predicate and write.
        assert.deepEqual(expected, state.binding);
        if (state.status === 'accepted') {
          assert.equal(state.submissionId, submissionId);
          return state;
        }
        assert.ok(Date.now() < binding.deadlineAtMs);
        state = { binding, status: 'accepted', submissionId, result: 'existing-a' };
        writes++;
        if (fail) {
          fail = false;
          throw new Error('ACK_LOST');
        }
        return state;
      },
    };
    const adapter = defineReviewDecision(host);
    const request = { submissionId: 's1', answer: { choice: 'a' } };
    const advance = async () => {
      if (recommended) return adapter.continue(context);
      authorize();
      const current = await host.read(binding, context);
      assert.deepEqual(current.binding, binding);
      const wait = await gate.read(binding.waitIdentity, context);
      if (current.status === 'accepted') {
        assert.equal(wait.status, 'resolved');
        assert.equal(current.submissionId, wait.submission.id);
        return current;
      }
      if (wait.status !== 'resolved') return current;
      assert.ok(Date.now() < binding.deadlineAtMs);
      const result = await host.accept(
        { binding, submissionId: wait.submission.id, answer: wait.submission.answer },
        context,
      );
      assert.deepEqual(result.binding, binding);
      assert.equal(result.submissionId, wait.submission.id);
      return result;
    };
    if (recommended) {
      await adapter.open({ expiresAtMs: binding.deadlineAtMs }, context);
      await adapter.respond(request, context);
    } else {
      authorize();
      assert.deepEqual((await host.read()).binding, binding);
      await gate.open(
        { identity: binding.waitIdentity, expiresAtMs: binding.deadlineAtMs },
        context,
      );
      authorize();
      assert.deepEqual((await host.read()).binding, binding);
      await gate.respond({ ...request, identity: binding.waitIdentity }, context);
    }
    await assert.rejects(advance(), /ACK_LOST/);
    const afterLoss = structuredClone(state);
    const queried = recommended ? await adapter.read(context) : await host.read();
    assert.deepEqual(queried, afterLoss);
    assert.deepEqual(await advance(), afterLoss);
    assert.equal(writes, 1);
    return { status: state.status, submissionId: state.submissionId, result: state.result, writes };
  }
  const ordinary = await scenario(false),
    recommended = await scenario(true);
  assert.deepEqual(recommended, ordinary);
  return { ordinary, recommended };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(
    JSON.stringify(
      process.argv[2] === '--worker'
        ? await worker(process.argv[3], process.argv[4])
        : await runCollaborationProbe(),
    ),
  );

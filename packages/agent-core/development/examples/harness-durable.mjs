/**
 * Offline R2: two bounded Durable tasks separated by a persisted App-owned wait gate.
 * Four fresh processes rebuild ports and authorization. No stack or request is suspended.
 */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, open, readFile, rename, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { defineDurableTask } from '@jangts/agent-core/kits/durable';
import { defineWaitGate } from '@jangts/agent-core/kits/waiting';

/** Example file ports: atomic rename, synced writes, and fail-on-contention directory locks. */
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
    async save(key, record) {
      const temporary = `${path(key)}.${randomUUID()}.tmp`;
      const handle = await open(temporary, 'wx');
      try {
        await handle.writeFile(JSON.stringify(record));
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(temporary, path(key));
      const folder = await open(directory, 'r');
      try {
        await folder.sync();
      } finally {
        await folder.close();
      }
    },
  };
}

/** Rebuild current authorization and live ports; serialized subject text grants nothing. */
function assemble(directory, { loseSaveAcknowledgement = false } = {}) {
  const store = fileStore(directory);
  const identity = { taskId: 'demo', waitId: 'confirmation-1', subject: 'owner' };
  const context = {
    app: { subject: 'owner', allowed: true },
    signal: new AbortController().signal,
  };
  const authorize = () => {
    if (!context.app.allowed || context.app.subject !== 'owner') throw new Error('Not authorized');
  };
  const gate = defineWaitGate(
    {
      id: 'harness-confirmation',
      revision: '1',
      isAnswer: (value) => value?.approved === true,
      authorize(expected, ctx) {
        if (!ctx.app.allowed || ctx.app.subject !== expected.subject)
          throw new Error('Not authorized');
      },
    },
    { store },
  );
  const isState = (state) =>
    !!state &&
    typeof state === 'object' &&
    (state.artifact === null || typeof state.artifact === 'string') &&
    (state.receipt === null || typeof state.receipt === 'string');
  const prepare = defineDurableTask(
    {
      id: 'harness-prepare',
      revision: '1',
      isState,
      authorize,
      steps: [
        {
          id: 'produce-artifact',
          replayPolicy: 'reconcile',
          async run() {
            const previous = await store.load('artifact');
            const artifact = 'Draft prepared before confirmation';
            await store.save('artifact', { artifact, writes: (previous?.writes ?? 0) + 1 });
            return { artifact, receipt: null, confirmationCount: 0 };
          },
          async reconcile() {
            const saved = await store.load('artifact');
            return saved
              ? {
                  kind: 'completed',
                  state: { artifact: saved.artifact, receipt: null, confirmationCount: 0 },
                }
              : { kind: 'not-executed' };
          },
        },
      ],
    },
    { store },
  );
  const save = defineDurableTask(
    {
      id: 'harness-save',
      revision: '1',
      isState,
      async authorize() {
        authorize();
        const wait = await gate.read(identity, context);
        if (wait.status !== 'resolved' || !wait.submission.answer.approved)
          throw new Error('Confirmation required');
      },
      steps: [
        {
          id: 'save-confirmed-artifact',
          replayPolicy: 'reconcile',
          async run(state) {
            const previous = await store.load('saved-artifact');
            const receipt = 'saved-1';
            await store.save('saved-artifact', {
              receipt,
              artifact: state.artifact,
              writes: (previous?.writes ?? 0) + 1,
            });
            if (loseSaveAcknowledgement)
              throw Object.assign(new Error('Synthetic save response loss'), {
                code: 'SYNTHETIC_SAVE_ACK_LOST',
              });
            return { ...state, receipt };
          },
          async reconcile(state) {
            const saved = await store.load('saved-artifact');
            return saved
              ? {
                  kind: 'completed',
                  state: {
                    ...state,
                    receipt: saved.receipt,
                    confirmationCount: (state.confirmationCount ?? 0) + 1,
                  },
                }
              : { kind: 'not-executed' };
          },
        },
      ],
    },
    { store },
  );
  const initialize = (taskId, definitionId, state) =>
    store.exclusive(taskId, async () => {
      if (await store.load(taskId)) return;
      await store.save(taskId, {
        version: 2,
        definitionId,
        revision: '1',
        nextStepIndex: 0,
        attemptCount: 0,
        maxAttempts: 4,
        deadlineAtMs: Date.now() + 60000,
        status: 'ready',
        state,
      });
    });
  /** Fixed App composition, not a second generic scheduling protocol. */
  const run = async (first = false) => {
    await initialize('prepare', 'harness-prepare', {
      artifact: null,
      receipt: null,
      confirmationCount: 0,
    });
    const prepared = await prepare.run({ taskId: 'prepare' }, context);
    const wait = first
      ? await gate.open({ identity, expiresAtMs: Date.now() + 60000 }, context)
      : await gate.read(identity, context);
    if (wait.status === 'pending') return { status: 'waiting', artifact: prepared.artifact };
    if (wait.status !== 'resolved') return { status: 'cancelled' };
    await initialize('save', 'harness-save', prepared);
    return { status: 'completed', ...(await save.run({ taskId: 'save' }, context)) };
  };
  return { store, gate, identity, context, run };
}

/** Execute one fresh process stage against the temporary persisted fixture. */
async function worker(stage, directory) {
  const app = assemble(directory, { loseSaveAcknowledgement: stage === 'resume' });
  if (stage === 'resume') {
    const request = {
      identity: app.identity,
      submissionId: 'answer-1',
      answer: { approved: true },
    };
    await app.gate.respond(request, app.context);
    await app.gate.respond(request, app.context);
  }
  if (stage === 'query') {
    // Execution expiry must not prevent authorized reads of already completed tasks.
    for (const taskId of ['prepare', 'save']) {
      await app.store.exclusive(taskId, async () => {
        const record = await app.store.load(taskId);
        assert.equal(record.status, 'completed');
        await app.store.save(taskId, { ...record, deadlineAtMs: 0 });
      });
    }
  }
  try {
    const result = await app.run(stage === 'prepare');
    return { pid: process.pid, result };
  } catch (error) {
    if (stage !== 'resume' || error.code !== 'SYNTHETIC_SAVE_ACK_LOST') throw error;
    const checkpoint = await app.store.load('save');
    assert.equal(checkpoint.status, 'running');
    assert.equal(checkpoint.attemptCount, 1);
    assert.equal((await app.store.load('saved-artifact')).writes, 1);
    return { pid: process.pid, result: { status: 'unknown', reason: 'save-response-lost' } };
  }
}

/** Run and clean up the fixture, proving process boundaries rather than resetting objects. */
export async function runDurableExample() {
  const base = resolve('.tmp');
  await mkdir(base, { recursive: true });
  const directory = await mkdtemp(join(base, 'harness-durable-'));
  const source = fileURLToPath(import.meta.url);
  const stage = (name) =>
    JSON.parse(
      execFileSync(process.execPath, [source, '--worker', name, directory], { encoding: 'utf8' }),
    );
  try {
    const waiting = stage('prepare');
    const store = fileStore(directory);
    assert.equal(waiting.result.status, 'waiting');
    assert.equal((await store.load('prepare')).status, 'completed');
    assert.equal(await store.load('saved-artifact'), undefined);
    const uncertain = stage('resume');
    assert.equal(uncertain.result.status, 'unknown');
    assert.equal((await store.load('save')).status, 'running');
    const completed = stage('reconcile');
    const queried = stage('query');
    assert.equal(new Set([waiting.pid, uncertain.pid, completed.pid, queried.pid]).size, 4);
    assert.equal(completed.result.status, 'completed');
    assert.deepEqual(queried.result, completed.result);
    assert.equal((await store.load('artifact')).writes, 1);
    assert.equal((await store.load('saved-artifact')).writes, 1);
    assert.equal((await store.load('prepare')).attemptCount, 1);
    assert.equal((await store.load('save')).attemptCount, 1);
    assert.equal((await store.load('save')).state.confirmationCount, 1);
    return {
      waiting,
      uncertain,
      completed,
      queried,
      artifactWrites: 1,
      savedWrites: 1,
      confirmationCount: 1,
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result =
    process.argv[2] === '--worker'
      ? await worker(process.argv[3], process.argv[4])
      : await runDurableExample();
  console.log(JSON.stringify(result, null, 2));
}

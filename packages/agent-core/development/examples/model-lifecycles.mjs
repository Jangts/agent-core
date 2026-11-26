/**
 * The same bounded background task across Responses and Interactions, without a server.
 * A host-owned reference store illustrates reservation and recovery identity, not durable storage.
 */
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { ModelRunner, Support, runModelOperation, waitModelOperation } from '@jangts/agent-core';

/** Submit once and query without spending another model allowance. No real service is called. */
export async function runBackgroundExample(protocol) {
  if (!['responses', 'interactions'].includes(protocol)) throw new TypeError('Background protocol required');
  const handle = { operationId: 'example-task', scope: 'reader:1/conversation:1', protocol,
    endpoint: 'https://fixture.invalid/v1', model: 'fixture', itemIds: ['reply'] };
  const records = new Map();
  let reserved = false, submissions = 0;
  const provider = Support.createBackgroundModelProvider({ protocol, baseUrl: handle.endpoint,
    apiKey: 'fixture-only', model: 'fixture',
    request: async (_url, init) => {
      if (init.method === 'POST') {
        submissions++;
        return Response.json({ id: 'remote-task', status: 'in_progress' });
      }
      return Response.json(protocol === 'responses'
        ? { id: 'remote-task', status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'done' }] }] }
        : { id: 'remote-task', status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: 'done' }] }] });
    },
  });
  const runner = new ModelRunner({ provider, maxCalls: 2 })
    .bind({ signal: new AbortController().signal });
  const ports = {
    run: runner.runOperation.bind(runner),
    authorize(action, identity) {
      if (identity.scope !== handle.scope) throw new Error('Task access denied');
    },
    async reserve(identity) {
      if (reserved) return false;
      reserved = true;
      records.set(identity.operationId, { handle: structuredClone(identity), status: 'queued' });
      return true;
    },
    async save(result) { records.set(result.handle.operationId, structuredClone(result)); },
  };
  const queued = await runModelOperation(provider, { action: 'submit', handle,
    payload: { messages: [{ role: 'user', content: 'Reply done.' }] },
  }, ports);
  assert.equal(queued.value, undefined);
  const completed = await waitModelOperation(provider, { handle: queued.handle }, ports,
    { maxQueries: 2, intervalMs: 0 });
  assert.equal(completed.status, 'completed');
  assert.deepEqual(completed.value, ['done']);
  assert.equal(runner.remainingCalls, 1);
  return { status: completed.status, submissions, records: records.size, remainingCalls: runner.remainingCalls };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const protocol of ['responses', 'interactions']) {
    const result = await runBackgroundExample(protocol);
    assert.equal(result.submissions, 1);
    console.log(`${protocol}: ${result.status}; one submission, query costs no generation call`);
  }
}

/** Same task with ordinary handlers and a declared workflow; no second execution engine. */
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { ModelRunner, Support, BudgetError } from '@jangts/agent-core';
import { createComposition } from './harness-composition.mjs';

/** Keep authorization, schemas and the actual budget in Core while hand-writing sequencing. */
export function createHandlerComparison({ canSave = true } = {}) {
  const calls = { provider: [], authorization: 0, saves: 0, repairs: 0 };
  const receipts = new Map();
  const denied = new Error('Saving is not authorized');
  const execution = { signal: new AbortController().signal };
  const replies = new Map([
    ['prepare', 'note'], ['choose', 'save'], ['after:receipt-1', 'Saved receipt-1'],
    ['repair:receipt-1', JSON.stringify({ receipt: 'receipt-1', message: 'Saved' })],
  ]);
  const model = new ModelRunner({ execution, maxCalls: 4, provider: {
    async *stream(messages) {
      const input = messages.at(-1).content;
      calls.provider.push(input);
      if (!replies.has(input)) throw new Error('Unexpected comparison input');
      yield replies.get(input);
    },
  } });
  const catalog = Support.defineToolCatalog([{
    id: 'save_note', kind: 'write', description: 'Save the comparison note',
    inputSchema: Support.defineSchema({
      jsonSchema: { type: 'object', required: ['note'], properties: { note: { type: 'string' } }, additionalProperties: false },
      parse(value) {
        if (!value || typeof value.note !== 'string' || Object.keys(value).length !== 1) throw new TypeError('Expected a note');
        return { note: value.note };
      },
    }),
    authorize(_input, { app }) { calls.authorization++; if (!app.canSave) throw denied; },
    execute({ note }) { calls.saves++; const receipt = `receipt-${calls.saves}`; receipts.set(receipt, note); return receipt; },
    parseOutput(value) { if (typeof value !== 'string') throw new TypeError('Expected receipt'); return value; },
  }]);
  const parse = (text, receipt) => {
    const value = JSON.parse(text);
    if (value?.receipt !== receipt || typeof value?.message !== 'string' || !value.message.trim()) throw new TypeError('Invalid delivery');
    return value;
  };
  let child;
  const run = async () => {
    const note = (await model.invoke('prepare')).value;
    child = model.createChild({ id: 'note-agent', maxCalls: 2, reserveCalls: 1, timeoutMs: 5000 });
    const tools = catalog.bind({ app: { canSave }, execution: { signal: child.signal } });
    const decision = (await child.invoke('choose')).value;
    if (decision !== 'save') throw new Error('Unknown operation');
    const { value: receipt } = await tools.invoke({ toolId: 'save_note', input: { note } });
    const draft = (await child.invoke(`after:${receipt}`)).value;
    // Only parsing failures enter repair. Tool errors never retry the write.
    try { return parse(draft, receipt); }
    catch (error) {
      if (!(error instanceof SyntaxError || error instanceof TypeError)) throw error;
      calls.repairs++;
      return parse((await model.invoke(`repair:${receipt}`)).value, receipt);
    }
  };
  return { run, model, calls, receipts, denied, get child() { return child; } };
}

/** Compare observable behavior, not source line counts or universal superiority. */
export async function runHandlerComparison() {
  const ordinary = createHandlerComparison();
  const recommended = createComposition();
  assert.deepEqual(await ordinary.run(), await recommended.parent.run({}));
  for (const app of [ordinary, recommended]) {
    assert.equal(app.calls.saves, 1);
    assert.equal(app.calls.authorization, 1);
    assert.equal(app.calls.repairs, 1);
    assert.equal(app.model.totalCallCount, 4);
    await assert.rejects(app.model.invoke('beyond'), BudgetError);
    assert.equal(app.calls.provider.length, 4);
  }
  assert.deepEqual(ordinary.calls.provider, recommended.calls.provider);
  for (const app of [createHandlerComparison({ canSave: false }), createComposition({ canSave: false })]) {
    const execute = app.run ? () => app.run() : () => app.parent.run({});
    await assert.rejects(execute(), (error) => error === app.denied);
    assert.equal(app.calls.saves, 0);
    assert.equal(app.calls.repairs, 0);
    assert.equal(app.model.totalCallCount, 2);
  }
  return { sameDelivery: true, sameProviderSequence: true, callsPerAllowedTask: 4, savesPerAllowedTask: 1 };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(await runHandlerComparison(), null, 2));

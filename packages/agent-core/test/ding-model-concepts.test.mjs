import test from 'node:test';
import assert from 'node:assert/strict';
import { ModelRunner } from '../dist/esm/model/runner.js';
import {
  createTextInteraction,
  createTextTransport,
  createModelInteraction,
  createModelTransport,
} from '../dist/esm/support/model/transports.js';

const provider = { async *stream() { yield ' answer '; } };
const options = { provider, maxCalls: 2 };

test('canonical interactions and legacy aliases use one implementation and preserve prepared accounting', async () => {
  assert.equal(createTextInteraction, createTextTransport);
  assert.equal(createModelInteraction, createModelTransport);
  const text = createTextInteraction({ id: 'text' });
  const runner = new ModelRunner({ ...options, interactions: [text] });
  const prepared = runner.prepare({ interaction: 'text' });
  assert.equal(prepared.interactionId, prepared.transportId);
  const measured = prepared.measure('question');
  assert.equal(measured.interactionChars, measured.transportChars);
  assert.equal((await runner.invoke({ input: 'question', prepared })).value, 'answer');
  const legacy = new ModelRunner({ ...options, transports: [text] });
  assert.equal((await legacy.invoke({ input: 'question', transport: 'text' })).value, 'answer');
});

test('conflicting registration and request aliases reject before the provider runs', async () => {
  let calls = 0;
  const counted = { async *stream() { calls++; yield 'unexpected'; } };
  const first = createTextInteraction({ id: 'first' });
  const second = createTextInteraction({ id: 'second' });
  const list = [first, second];
  assert.throws(() => new ModelRunner({ ...options, interactions: list, transports: [...list] }), /Conflicting/);
  const runner = new ModelRunner({ ...options, provider: counted, interactions: list, transports: list });
  assert.throws(() => runner.prepare({ interaction: 'first', transport: 'second' }), /Conflicting/);
  await assert.rejects(runner.invoke({ input: 'question', interaction: 'first', transport: 'second' }), /Conflicting/);
  assert.equal(calls, 0);
});

test('tools response is one finite model result and session is only an input compatibility spelling', async () => {
  const tools = { *values() {}, resolve() { throw new Error('No tool selected'); } };
  for (const response of ['tools', 'session']) {
    const interaction = createModelInteraction({ id: `response-${response}`, response, tools });
    const runner = new ModelRunner({ ...options, interactions: [interaction] });
    const { value } = await runner.invoke({ input: 'question', interaction: interaction.id });
    assert.equal(value.text, ' answer ');
    assert.deepEqual(value.calls, []);
  }
});

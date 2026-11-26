/**
 * Example: the smallest Core run — one engine round invoking an ordinary provider.
 */
import { AgentCoreEngine } from '@jangts/agent-core/engine';
import { ModelRunner } from '@jangts/agent-core';

// Offline provider: replace with your configured ChatProvider for a real model.
const provider = {
  async *stream(messages) {
    yield `收到：${messages.at(-1).content}`;
  },
};
const model = new ModelRunner({ provider });
const engine = new AgentCoreEngine({ maxRounds: 1 });
const result = await engine.run(async () => ({
  type: 'complete',
  value: await model.invoke('你好，Core'),
}));
console.log(result.value);

/**
 * Example: drive Core with an offline MockGPT-backed ChatProvider.
 *
 * Only the local adapter imports MockGPT; the engine receives a normal provider.
 */
import { AgentCoreEngine } from '@jangts/agent-core/engine';
import { ModelRunner } from '@jangts/agent-core';
import { createMockProvider } from './mock-provider.mjs';

const { provider } = createMockProvider([
  { prompt: '你好，Core', generator: '你好！这是 MockGPT 的离线回答。' },
]);
const model = new ModelRunner({ provider });
const engine = new AgentCoreEngine({ maxRounds: 1 });
const result = await engine.run(async () => ({
  type: 'complete',
  value: await model.invoke({ input: '你好，Core' }),
}));
console.log(result.value);
// Both text and structured calls return { value, invocation }.
console.log('调用状态：', result.invocation.status);

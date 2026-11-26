/**
 * Example: an App handler calls the Candidates Kit while Core only schedules the handler.
 *
 * Core does not import the Kit; the Kit result is converted back into ordinary node state.
 */
import { AgentCoreEngine, defineWorkflow, route } from '@jangts/agent-core/engine';
import { defineCandidateSelection } from '@jangts/agent-core/kits/candidates';

// The smallest possible function provider: simulate just the required model data.
const provider = {
  async *stream(_messages, { signal }) {
    signal.throwIfAborted();
    yield JSON.stringify({ candidates: [{ text: '你好！' }, { text: '很高兴见到你！' }] });
  },
};
const selection = defineCandidateSelection({ field: 'candidates', maxCandidates: 2 });
const workflow = defineWorkflow({
  id: 'candidate-demo',
  nodes: [
    {
      id: 'generate',
      description: '取得模拟模型候选回答',
      provides: ['value'],
      async run(_state, { model }) {
        const { value } = await model.invoke({
          input: '用 JSON 返回两条简短问候，格式为 {"candidates":[{"text":"..."}]}。',
        });
        return { value };
      },
      routes: [route.to('select')],
    },
    {
      id: 'select',
      description: '使用 Candidates Kit 检查候选',
      requires: ['value'],
      provides: ['candidates'],
      run(state) {
        const candidates = selection.parse({ value: JSON.parse(state.value), allowed: true });
        for (const candidate of candidates) {
          if (typeof candidate?.text !== 'string') throw new TypeError('候选回答缺少 text');
        }
        return { candidates };
      },
      routes: [route.deliver('candidates')],
    },
  ],
});
// Core schedules ordinary App handlers. Only the select handler knows this Kit.
const engine = new AgentCoreEngine({ workflow, model: { provider, maxCalls: 1 } });
const candidates = await engine.run({});
for (const candidate of candidates) console.log(candidate.text);

/*
 * Example: context processing nodes (上下文处理节点) in the Support layer (支援层).
 *
 * The example builds a small workflow that prepares one model interaction, lets a selection
 * node decide which registered reduction step is needed, applies that reduction, and
 * finally assembles the model-visible input. It then shows the same graph twice: once
 * with the built-in reduction node and once with a custom App-owned node, so both
 * implementations can be compared.
 *
 * The workflow deliberately fails at the start: without the context nodes the model
 * input is never prepared, so the run is rejected before any provider call.
 *
 * Main exports: none. The file runs its example on import.
 */
import assert from 'node:assert/strict';
import { AgentCoreEngine, Support, defineWorkflow, route } from '@jangts/agent-core';

/**
 * Build the context plan for one round.
 *
 * The plan declares the fragments that may enter the model input together with their
 * per-fragment budget and lifetime.
 *
 * @returns A context plan with a request fragment and a much larger history fragment.
 */
const input = () => ({
  maxInputChars: 90,
  fragments: [
    {
      id: 'request',
      sourceId: 'request',
      role: 'user',
      trust: 'user',
      lifetime: 'turn',
      maxChars: 80,
      value: { message: '保留原问题' },
    },
    {
      id: 'history',
      sourceId: 'history',
      role: 'user',
      trust: 'user',
      lifetime: 'turn',
      maxChars: 1000,
      value: { history: '此前资料。'.repeat(80) },
    },
  ],
});
// The reduction policy names the one registered step and the handler that serves it.
const policy = {
  mode: 'reduce',
  steps: [
    {
      id: 'summary',
      kind: 'compress',
      fragmentId: 'history',
      targetChars: 30,
      handlerId: 'summary',
    },
  ],
};
// The compressor is an App-owned handler; `maxCalls: 0` means the reduction must not
// cost model calls.
const compressor = {
  id: 'summary',
  maxCalls: 0,
  async compress() {
    return { history: '本地示例摘要。' };
  },
};
// The provider echoes the prepared history back, so the example can observe which
// input the context nodes produced.
const provider = {
  async *stream(messages) {
    yield JSON.parse(messages.at(-1).content).history;
  },
};
// The answer node reuses the prepared call, so the transport is measured and approved
// exactly once per round.
const answer = {
  id: 'answer',
  description: '使用同次准备的最终输入',
  async run(state, ctx) {
    return {
      answer: (await ctx.model.invoke({ input: state.input ?? input(), prepared: state.prepared }))
        .value,
    };
  },
  routes: [route.deliver('answer')],
};
const basic = defineWorkflow({ id: 'no-processing', nodes: [answer] });
// Without the context nodes the request has no prepared transport, so the run fails.
await assert.rejects(new AgentCoreEngine({ workflow: basic, model: { provider } }).run({}));

/**
 * Build the example workflow.
 *
 * @param custom - Optional replacement for the built-in reduction node.
 * @returns A defined workflow with the context node chain.
 */
function workflow(custom) {
  const shared = {
    policy,
    compressors: [compressor],
    plan: (state) => state.plan,
    prepared: (state) => state.prepared,
  };
  return defineWorkflow({
    id: 'context-nodes',
    nodes: [
      {
        id: 'prepare',
        description: '准备本轮模型传输',
        run(_, ctx) {
          // The prepared call is single-use and bound to this round.
          return { plan: input(), prepared: ctx.model.prepare() };
        },
        routes: [route.to('select')],
      },
      Support.createContextSelectionNode({
        ...shared,
        id: 'select',
        description: '选择需要处理的登记项',
        update: (result) => ({ plan: result.plan, selected: result.stepIds }),
        routes: [
          // Reduction only runs when the selection reported a pending step.
          { when: (state) => state.selected.length > 0, targetNodeId: 'compress' },
          route.to('assemble'),
        ],
      }),
      custom ??
        Support.createContextReductionNode({
          ...shared,
          id: 'compress',
          description: '压缩历史片段',
          stepId: 'summary',
          update: (result) => ({ plan: result.plan }),
          routes: [route.to('assemble')],
        }),
      Support.createContextProcessingNode({
        id: 'assemble',
        description: '最终装配与边界检查',
        plan: (state) => state.plan,
        prepared: (state) => state.prepared,
        update: (result) => ({ input: result.input }),
        routes: [route.to('answer')],
      }),
      answer,
    ],
  });
}
// A custom node may take the place of the built-in reduction node as long as it
// exposes the same id and routes.
class CustomNode {
  id = 'compress';
  description = '自定义本地处理';
  routes = [route.to('assemble')];
  #summary = '自定义摘要。';
  run(state) {
    return {
      plan: {
        ...state.plan,
        fragments: state.plan.fragments.map((fragment) =>
          fragment.id === 'history' ? { ...fragment, value: { history: this.#summary } } : fragment,
        ),
      },
    };
  }
}
// The first iteration uses the built-in reduction node, the second the custom one.
for (const replacement of [undefined, new CustomNode()]) {
  const agent = new AgentCoreEngine({
    workflow: workflow(replacement),
    model: { provider },
    execution: {
      observe: {
        event(fact) {
          if (fact.type === 'workflow.event' && fact.payload.event.type === 'enter')
            console.log('进入', fact.nodeId);
        },
      },
    },
  });
  console.log(await agent.run({}));
}

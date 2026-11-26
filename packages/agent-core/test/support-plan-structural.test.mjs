/**
 * Locks down structural Support context plans: builder plan/build read prototype request
 * fields and keep audit protection, and all Support context nodes preserve a class plan,
 * its protected attachments and recent history. Runs under node --test with a fixture
 * workflow and a provider that must not be called.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentCoreEngine, Support, defineWorkflow, route } from '../dist/esm/index.js';

const fragment = (value) => ({
  id: 'history',
  sourceId: 'chat',
  role: 'user',
  trust: 'user',
  lifetime: 'turn',
  maxChars: 1000,
  value,
});
const originals = [fragment({ messages: [{ role: 'user', content: 'original' }] })];
const attachment = [{ role: 'user', content: 'attachment', images: [{ url: 'fixture' }] }];

test('builder plan and build read prototype request fields and retain structural audit', () => {
  const builder = Support.defineContextFragments(
    [{ ...originals[0], format: () => ({ messages: [] }) }],
    { maxInputChars: 1000 },
  );
  class Request {
    get input() {
      return {};
    }
    get additionalMessages() {
      return attachment;
    }
    get originalFragments() {
      return originals;
    }
    get mutableFragmentIds() {
      return ['history'];
    }
  }
  const request = new Request();
  assert.equal(builder.plan(request).additionalMessages, attachment);
  assert.deepEqual(builder.build(request).messages.at(-1), attachment[0]);
  class Protected extends Request {
    get mutableFragmentIds() {
      return [];
    }
  }
  // A fragment whose formatted output no longer matches its original cannot be silently
  // committed when the plan declares no mutable ids.
  assert.throws(() => builder.build(new Protected()));
});

test('all Support context nodes preserve a class plan and its protected image messages', async () => {
  const history = [
    fragment({
      messages: [
        { role: 'user', content: 'old '.repeat(60) },
        { role: 'assistant', content: 'old answer' },
        { role: 'user', content: 'keep exact' },
      ],
    }),
  ];
  class Plan {
    get fragments() {
      return history;
    }
    get maxInputChars() {
      return 1000;
    }
    get additionalMessages() {
      return attachment;
    }
    get originalFragments() {
      return history;
    }
    get mutableFragmentIds() {
      return ['history'];
    }
  }
  const strategy = Support.createContextStrategy({
    kind: 'recent',
    fragment: history[0],
    field: 'messages',
    targetChars: 100,
  });
  const common = { ...strategy, plan: (state) => state.plan };
  const workflow = defineWorkflow({
    id: 'structural-plan',
    nodes: [
      Support.createContextSelectionNode({
        ...common,
        id: 'select',
        description: 'Select',
        update: (result) => ({ plan: result.plan }),
        routes: [route.to('reduce')],
      }),
      Support.createContextReductionNode({
        ...common,
        id: 'reduce',
        description: 'Reduce',
        stepId: 'history.window',
        update: (result) => ({ plan: result.plan }),
        routes: [route.to('assemble')],
      }),
      Support.createContextProcessingNode({
        id: 'assemble',
        description: 'Assemble',
        plan: (state) => state.plan,
        update: (result) => ({ result: result.input }),
        routes: [route.deliver('result')],
      }),
    ],
  });
  const agent = new AgentCoreEngine({
    workflow,
    model: {
      provider: {
        async *stream() {
          throw Error('No model call expected');
        },
      },
    },
  });
  const result = await agent.run({ plan: new Plan() });
  // Attachments are appended after the reduced history, and the protected turn survives
  // compression even though older turns are trimmed.
  assert.deepEqual(result.messages.at(-1), attachment[0]);
  assert.equal(
    result.messages.some((message) => message.content.includes('keep exact')),
    true,
  );
});

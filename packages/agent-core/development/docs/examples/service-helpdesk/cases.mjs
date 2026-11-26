/** Shared request scenarios and isolated node and tool checks for the helpdesk. */
import assert from 'node:assert/strict';
import { AgentCoreEngine, defineWorkflow } from '@jangts/agent-core';
import { createHelpdesk, sampleReceipt, statusNode, tools } from './app.mjs';

const unknown = { status: 'unknown', answer: 'Could not confirm the service status.' };
const status = { ...sampleReceipt, answer: 'Service status: online.' };
const explanation = 'The latest monitor reading shows the service online.';

function requestCase({ id, explain, denied, readFails, replies, visits, expected, reads }) {
  let readsMade;
  return {
    id,
    replies,
    setup({ execution, provider }) {
      readsMade = 0;
      const app = {
        mayRead: () => !denied,
        readStatus() {
          readsMade++;
          if (readFails) throw new Error('Monitor unavailable');
          return sampleReceipt;
        },
      };
      return {
        agent: createHelpdesk({ app, provider, execution }),
        state: { service: 'demo', question: 'What is the latest service status?', explain },
      };
    },
    verify({ result, events, modelCalls }) {
      assert.deepEqual(result, expected);
      assert.deepEqual(
        events.filter((event) => event.type === 'enter').map((event) => event.nodeId),
        visits,
      );
      assert.equal(modelCalls, replies.length);
      assert.equal(readsMade, reads);
    },
  };
}

const badExplanation = requestCase({
  id: 'bad-explanation',
  explain: true,
  replies: ['x'.repeat(201)],
  expected: status,
  reads: 1,
  visits: ['lookup', 'explain', 'deliver-status'],
});

export const scenarios = [
  requestCase({
    id: 'status-only',
    replies: [],
    expected: status,
    reads: 1,
    visits: ['lookup', 'deliver-status'],
  }),
  requestCase({
    id: 'explained',
    explain: true,
    replies: [explanation],
    expected: { ...sampleReceipt, answer: explanation },
    reads: 1,
    visits: ['lookup', 'explain'],
  }),
  requestCase({
    id: 'denied',
    explain: true,
    denied: true,
    replies: [],
    expected: unknown,
    reads: 0,
    visits: ['lookup', 'unavailable'],
  }),
  requestCase({
    id: 'read-failed',
    explain: true,
    readFails: true,
    replies: [],
    expected: unknown,
    reads: 1,
    visits: ['lookup', 'unavailable'],
  }),
  badExplanation,
];

export const agentTests = [
  {
    id: 'bad-explanation',
    layer: 'feature',
    run: ({ runScenario }) => runScenario(badExplanation),
  },
  {
    id: 'cancelled-read',
    layer: 'feature',
    async run({ signal }) {
      const cancel = new AbortController();
      let modelCalls = 0;
      const agent = createHelpdesk({
        app: {
          mayRead: () => true,
          readStatus() {
            cancel.abort(new DOMException('Request cancelled during lookup', 'AbortError'));
            return sampleReceipt;
          },
        },
        provider: {
          async *stream() {
            modelCalls++;
            yield explanation;
          },
        },
        execution: { signal: AbortSignal.any([signal, cancel.signal]) },
      });
      await assert.rejects(
        agent.run({ service: 'demo', question: 'What is the status?', explain: true }),
        /cancelled during lookup/,
      );
      assert.equal(modelCalls, 0);
    },
  },
  {
    id: 'confirmed-fields',
    layer: 'node',
    run({ runScenario }) {
      const workflow = defineWorkflow({ id: 'status-node', nodes: [statusNode] });
      return runScenario({
        setup: ({ execution }) => ({
          agent: new AgentCoreEngine({ workflow, execution }),
          state: { receipt: sampleReceipt },
        }),
        verify({ result, modelCalls }) {
          assert.deepEqual(result, status);
          assert.equal(modelCalls, 0);
        },
      });
    },
  },
  {
    id: 'protected-read',
    layer: 'tool',
    async run({ signal }) {
      let readsMade = 0;
      const runtime = tools.bind({
        app: {
          mayRead: (service) => service === 'demo',
          readStatus() {
            readsMade++;
            return sampleReceipt;
          },
        },
        execution: { signal },
      });
      await assert.rejects(
        runtime.invoke({ toolId: 'read_status', input: { service: 'private' } }),
        /Status access denied/,
      );
      assert.equal(readsMade, 0);
      const { value } = await runtime.invoke({ toolId: 'read_status', input: { service: 'demo' } });
      assert.deepEqual(value, sampleReceipt);
      assert.equal(readsMade, 1);
    },
  },
];

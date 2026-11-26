/**
 * Example: run the Answering Kit through draft generation, review and one repair.
 *
 * The generation port is offline; storage, evidence and publication stay with the App.
 */
import assert from 'node:assert/strict';
import { defineAnswerFlow } from '@jangts/agent-core/kits/answering';

// Offline generation port. A real App supplies its already-bound ModelRunner here.
function runtime() {
  return {
    calls: 0,
    async generate({ items, repairs }) {
      this.calls++;
      return new Map(
        items.map((item) => [item.id, repairs ? item.data.verified : item.data.draft]),
      );
    },
  };
}
const definition = {
  maxItems: 1,
  maxRepairs: 0,
  canInvoke: ({ app }) => app.calls < 3,
  generate: (input, { app }) => app.generate(input),
  check: ({ value }) => ({
    status: value ? 'passed' : 'failed',
    issues: value ? [] : [{ code: 'EMPTY', message: 'No answer' }],
  }),
  fallback: () => ({ handled: false }),
};
const request = {
  inputIds: ['question'],
  items: [
    {
      id: 'answer',
      inputIds: ['question'],
      sourceStatus: 'ready',
      data: { draft: '待核对的答案', verified: '已核对的答案' },
    },
  ],
};
const execute = (flow, app) => flow.run(request, { app, signal: new AbortController().signal });

// Start with generation and local checks. The flow can be reused across requests.
const simple = defineAnswerFlow(definition);
const basic = await execute(simple, runtime());
assert.equal(basic[0].value, '待核对的答案');

// Add review and one repair using the same definition and run interface.
const reviewed = defineAnswerFlow({
  ...definition,
  maxRepairs: 1,
  reviewPolicy: 'required',
  async review({ items }) {
    return new Map(
      items.map(({ item, value }) => [
        item.id,
        {
          status: value === item.data.verified ? 'passed' : 'failed',
          issues:
            value === item.data.verified
              ? []
              : [{ code: 'FACT', message: 'Use the verified source' }],
        },
      ]),
    );
  },
});
const app = runtime();
const checked = await execute(reviewed, app);
assert.equal(checked[0].value, '已核对的答案');
assert.equal(checked[0].status, 'accepted');
assert.equal(app.calls, 2);
console.log(
  JSON.stringify({ basic: basic[0].value, reviewed: checked[0].value, calls: app.calls }),
);

/** Synthetic presentation and style cases. Scripted providers demonstrate paths, not model quality. */
import assert from 'node:assert/strict';
import { AgentCoreEngine, ModelRunner, Support, defineWorkflow, route } from '@jangts/agent-core';
import { Presentation } from '@jangts/agent-core/kits/presentation';

/** Validate an App's deliberately small template vocabulary before compiling model-proposed text. */
export function renderProposedMaster(master, values) {
  if (typeof master !== 'string') throw new TypeError('Expected a text master');
  const tokens = [...master.matchAll(/\{\{(\w+)\}\}/g)];
  if (
    !tokens.length ||
    /\{\{|\}\}/.test(master.replace(/\{\{(\w+)\}\}/g, '')) ||
    tokens.some((token) => !['total', 'body'].includes(token[1]))
  )
    throw new TypeError('Unknown or malformed template slot');
  if (!tokens.some((token) => token[1] === 'total') || !tokens.some((token) => token[1] === 'body'))
    throw new TypeError('Required slots missing');
  return Presentation.defineTextTemplate(master).render(values);
}
function scripted(text, calls) {
  return {
    async *stream(messages) {
      calls.messages = messages;
      calls.count++;
      yield text;
    },
  };
}
export const references = [
  {
    id: 'style-example',
    source: 'examples/presentation-and-style.mjs#styles',
    revision: '1',
    purposes: ['expression', 'style'],
  },
];
export const agentTests = [
  {
    id: 'ordered-list',
    layer: 'feature',
    entry: {
      id: 'list',
      source: 'examples/presentation-and-style.mjs#ordered-list',
      outputs: ['items'],
    },
    approach: 'program',
    outputIds: ['items'],
    referenceIds: [],
    expected: { kind: 'criteria', source: 'examples/presentation-and-style.mjs#ordered-list' },
    run({ signal }) {
      const rows = [
        { id: 'one', text: 'First' },
        { id: 'two', text: 'Second' },
        { id: 'three', text: 'Third' },
      ];
      const outputs = Presentation.defineOutputCatalog(
        [
          {
            id: 'row',
            kind: 'text',
            fields: [
              {
                id: 'text',
                owner: 'semantic',
                providerId: 'row-text',
                semanticKeys: rows.map((row) => row.id),
              },
            ],
          },
          { id: 'list', kind: 'group', allowedOutputIds: ['row'], maxItems: 3 },
        ],
        {
          providers: [
            {
              id: 'row-text',
              resolve({ key }, context) {
                const row = context.app.rows.find((item) => item.id === key);
                if (!row) throw new TypeError('Source is not available in this request');
                return row.text;
              },
            },
          ],
        },
      );
      // The program assigns membership/order and selects allowed keys; the provider binds real text.
      const input = {
        items: rows.map((row) => ({
          id: row.id,
          outputId: 'row',
          input: { generated: { text: row.id } },
        })),
      };
      const result = outputs.compose({ outputId: 'list', input }, { signal, app: { rows } });
      assert.deepEqual(
        result.value.map(({ id, value }) => [id, value]),
        rows.map(({ id, text }) => [id, text]),
      );
      assert.throws(() => outputs.toModelSchema('list'), /program-assigned/);
      assert.throws(
        () =>
          outputs.compose(
            { outputId: 'list', input: { items: [input.items[0], input.items[0]] } },
            { signal },
          ),
        /Invalid/,
      );
      const preview = { total: 12, returned: 3, complete: false };
      const text = Presentation.defineTextTemplate(
        'Showing {{returned}} of {{total}}; remaining entries not loaded.',
      ).render({ returned: String(preview.returned), total: String(preview.total) });
      assert.match(text, /Showing 3 of 12/);
      assert.equal(preview.complete, false); // A valid page is not the requested complete list.
    },
  },
  {
    id: 'bound-master',
    layer: 'feature',
    entry: {
      id: 'master',
      source: 'examples/presentation-and-style.mjs#bound-master',
      outputs: ['reply'],
    },
    approach: 'hybrid',
    outputIds: ['reply'],
    referenceIds: [],
    expected: { kind: 'criteria', source: 'examples/presentation-and-style.mjs#bound-master' },
    async run({ signal }) {
      const calls = { count: 0 };
      const model = new ModelRunner({
        provider: scripted('A short explanation.', calls),
        maxCalls: 1,
      });
      const body = (
        await model.invoke({
          input: 'Explain the supplied result without inventing facts.',
          signal,
        })
      ).value;
      const outputs = Presentation.defineOutputCatalog(
        [
          {
            id: 'reply',
            kind: 'master',
            master: 'Found {{total}} items. {{body}}',
            fields: [
              { id: 'total', owner: 'bound', providerId: 'total' },
              { id: 'body', owner: 'generated' },
            ],
          },
        ],
        {
          providers: [
            {
              id: 'total',
              resolve(_request, context) {
                if (
                  context.app.authorized !== true ||
                  !Number.isSafeInteger(context.app.total) ||
                  context.app.total < 0
                )
                  throw new TypeError('Authorized finite count required');
                return String(context.app.total);
              },
            },
          ],
        },
      );
      const context = { signal, app: { authorized: true, total: 0 } };
      assert.deepEqual(Object.keys(outputs.toModelSchema('reply').properties), ['body']);
      assert.equal(
        outputs.check({ outputId: 'reply', value: { body, total: '99' } }).status,
        'failed',
      );
      assert.equal(
        outputs.compose({ outputId: 'reply', input: { generated: { body } } }, context).value,
        'Found 0 items. A short explanation.',
      );
      assert.throws(
        () =>
          outputs.compose(
            { outputId: 'reply', input: { generated: { body } } },
            { signal, app: { authorized: false, total: 0 } },
          ),
        /Authorized/,
      );
      for (const total of [undefined, null, NaN, Infinity, -1])
        assert.throws(
          () =>
            outputs.compose(
              { outputId: 'reply', input: { generated: { body } } },
              { signal, app: { authorized: true, total } },
            ),
          /finite/,
        );
      assert.equal(
        renderProposedMaster('{{total}} items: {{body}}', {
          total: '2',
          body: '{{total}} is literal here',
        }),
        '2 items: {{total}} is literal here',
      );
      for (const master of [
        '{{secret}} {{body}}',
        '{{total}} {{body',
        '{{total}}',
        '{{total}} {{()}} {{body}}',
      ])
        assert.throws(() => renderProposedMaster(master, { total: '2', body }), /slot/);
      assert.equal(calls.count, 1);
      let writes = 0,
        repairs = 0;
      const workflow = defineWorkflow({
        id: 'repair-wording',
        nodes: [
          {
            id: 'save',
            description: 'Perform one synthetic business write',
            run: () => {
              writes++;
              return { receipt: { id: 'saved-once', total: 0 }, generated: { body: 42 } };
            },
            routes: [route.to('format')],
          },
          {
            id: 'format',
            description: 'Reject the malformed generated field after the write',
            run: (state) => ({
              reply: outputs.compose(
                { outputId: 'reply', input: { generated: state.generated } },
                { signal, app: { authorized: true, total: state.receipt.total } },
              ).value,
            }),
            onErrorNodeId: 'repair',
            routes: [route.deliver('reply')],
          },
          {
            id: 'repair',
            description: 'Repair only wording using the saved receipt',
            run: (state) => {
              repairs++;
              assert.equal(state.receipt.id, 'saved-once');
              return {
                reply: outputs.compose(
                  { outputId: 'reply', input: { generated: { body: 'A repaired explanation.' } } },
                  { signal, app: { authorized: true, total: state.receipt.total } },
                ).value,
              };
            },
            routes: [route.deliver('reply')],
          },
        ],
      });
      const repaired = await new AgentCoreEngine({ workflow }).run({}, { signal });
      assert.match(repaired, /A repaired explanation/);
      assert.equal(writes, 1);
      assert.equal(repairs, 1);
      assert.equal(calls.count, 1);
      assert.throws(
        () =>
          outputs.compose(
            { outputId: 'reply', input: { generated: { body } } },
            { ...context, signal: AbortSignal.abort(new Error('cancelled')) },
          ),
        /cancelled/,
      );
    },
  },
  {
    id: 'model-style',
    layer: 'feature',
    entry: {
      id: 'rewrite',
      source: 'examples/presentation-and-style.mjs#model-style',
      outputs: [],
    },
    approach: 'model',
    referenceIds: ['style-example'],
    expected: { kind: 'criteria', source: 'examples/presentation-and-style.mjs#model-style' },
    async run({ signal }) {
      const facts = 'The fictional service previews changes. Confirmation saves them.';
      const reference = 'Style example only: an older guide said 99 items. Do not reuse its facts.';
      const styles = [
        [
          'Explain to a novice in two paragraphs.',
          'You can look over proposed changes first.\n\nConfirm when ready to save them.',
        ],
        ['Give an expert a one-sentence summary.', 'Preview changes, then confirm to save.'],
      ];
      for (const [instruction, answer] of styles) {
        const calls = { count: 0 };
        const model = new ModelRunner({ provider: scripted(answer, calls), maxCalls: 1 });
        const response = (
          await model.invoke({
            input: facts + '\n' + instruction + '\n' + reference,
            signal,
            replyGuidance: Support.resolveReplyGuidance({
              node: { defaultDetail: 'brief' },
            }),
          })
        ).value;
        assert.ok(response.includes('changes'));
        assert.ok(/confirm|Confirm/.test(response));
        assert.ok(!response.includes('99'));
        assert.equal(calls.count, 1);
        assert.match(calls.messages[0].content, /concise reply/);
        assert.match(calls.messages[0].content, /Honor explicit user requests/);
      }
      // Scripted words demonstrate no-template delivery; whether a live model respects style is untested.
    },
  },
];

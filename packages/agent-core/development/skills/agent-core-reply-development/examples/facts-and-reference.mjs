/** Synthetic App examples: domain comparison and trusted help, using public SDK contracts. */
import assert from 'node:assert/strict';
import { AgentCoreEngine, defineWorkflow, route } from '@jangts/agent-core';
import { Presentation } from '@jangts/agent-core/kits/presentation';
import { Knowledge } from '@jangts/agent-core/kits/knowledge';

/** This App rule is deliberately specific: only complete unique SKU collections are comparable. */
export function compareCollections(input) {
  if (input.source !== 'official' || input.complete !== true)
    throw new TypeError('Complete official evidence is required');
  const check = (rows) => {
    if (!Array.isArray(rows) || rows.some((row) => typeof row.sku !== 'string' || !row.sku))
      throw new TypeError('Missing SKU');
    const map = new Map(rows.map((row) => [row.sku, row]));
    if (map.size !== rows.length) throw new TypeError('Duplicate SKU');
    return map;
  };
  const official = check(input.official),
    selected = check(input.selected);
  const common = [...selected.keys()].filter((sku) => official.has(sku));
  return Object.freeze({
    missing: [...official.keys()].filter((sku) => !selected.has(sku)).length,
    extra: [...selected.keys()].filter((sku) => !official.has(sku)).length,
    titleDifferences: common.filter((sku) => official.get(sku).title !== selected.get(sku).title)
      .length,
    order: 'not-compared',
    price: 'unavailable',
  });
}
function sample() {
  const official = Array.from({ length: 82 }, (_, i) => ({ sku: 'sku-' + i, title: 'Item ' + i }));
  const selected = official
    .slice(0, 64)
    .map((row, i) => ({ ...row, title: i < 2 ? 'Changed ' + i : row.title }));
  selected.push({ sku: 'extra', title: 'An extra item' });
  return { source: 'official', complete: true, official, selected };
}
export const references = [
  {
    id: 'comparison-criteria',
    source: 'references/design-card.md',
    revision: '1',
    purposes: ['expected'],
  },
  {
    id: 'help-copy',
    source: 'examples/facts-and-reference.mjs#help',
    revision: '1',
    purposes: ['facts', 'expected'],
  },
];
const help = Knowledge.defineKnowledgeCatalog(
  [
    {
      id: 'preview',
      revision: '1',
      locale: 'en',
      parts: [
        { id: 'quick', parts: ['This screen previews changes; confirmation saves them.'] },
        {
          id: 'details',
          parts: [
            'Review the proposed fields, then confirm. Cancelling leaves saved data unchanged.',
          ],
        },
      ],
    },
  ],
  { maxChars: 400 },
);

export const agentTests = [
  {
    id: 'compare-scope',
    layer: 'feature',
    entry: {
      id: 'compare',
      source: 'examples/facts-and-reference.mjs#compareCollections',
      outputs: ['comparison'],
    },
    approach: 'program',
    referenceIds: ['comparison-criteria'],
    outputIds: ['comparison'],
    expected: { kind: 'conditional', source: 'references/design-card.md#comparison' },
    async run({ signal }) {
      const workflow = defineWorkflow({
        id: 'comparison-reply',
        nodes: [
          {
            id: 'prepare',
            description: 'Apply the synthetic domain comparison',
            run: ({ input }) => ({ facts: compareCollections(input) }),
            routes: [route.to('reply')],
          },
          {
            id: 'reply',
            description: 'Render the exact checked scope',
            run: ({ facts }) => ({
              reply: Presentation.defineTextTemplate(
                'Missing {{missing}}; extra {{extra}}; title differences {{titles}}. Order untested; price unavailable.',
              ).render({
                missing: String(facts.missing),
                extra: String(facts.extra),
                titles: String(facts.titleDifferences),
              }),
            }),
            routes: [route.deliver('reply')],
          },
        ],
      });
      let modelCalls = 0;
      const provider = {
        async *stream() {
          modelCalls++;
          throw new Error('Unexpected model call');
        },
      };
      const agent = new AgentCoreEngine({ workflow, model: { provider, maxCalls: 0 } });
      const reply = await agent.run({ input: sample() }, { signal });
      assert.match(reply, /Missing 18; extra 1; title differences 2/);
      assert.match(reply, /Order untested; price unavailable/);
      assert.equal(modelCalls, 0);
      assert.throws(() => compareCollections({ ...sample(), source: 'master' }), /official/);
      assert.throws(() => compareCollections({ ...sample(), complete: false }), /Complete/);
      const duplicate = sample();
      duplicate.selected.push(duplicate.selected[0]);
      assert.throws(() => compareCollections(duplicate), /Duplicate/);
      assert.equal(
        compareCollections({ source: 'official', complete: true, official: [], selected: [] })
          .missing,
        0,
      );
      await assert.rejects(() =>
        agent.run({ input: { ...sample(), complete: false } }, { signal }),
      );
    },
  },
  {
    id: 'fixed-help',
    layer: 'feature',
    entry: {
      id: 'help',
      source: 'examples/facts-and-reference.mjs#help',
      outputs: ['quick', 'details'],
    },
    approach: 'program',
    referenceIds: ['help-copy'],
    outputIds: ['quick', 'details'],
    expected: { kind: 'fixed', source: 'examples/facts-and-reference.mjs#help' },
    run({ signal }) {
      const read = (request, currentSignal = signal) => {
        currentSignal.throwIfAborted(); // App cancellation around this synchronous local read.
        return help.read(request, { signal: currentSignal });
      };
      const quick = read({
        documentId: 'preview',
        selection: { mode: 'self', sectionIds: ['quick'] },
      });
      assert.equal(quick.content, 'This screen previews changes; confirmation saves them.');
      const details = read({
        documentId: 'preview',
        selection: { mode: 'self', sectionIds: ['details'] },
      });
      assert.match(details.content, /Cancelling leaves saved data unchanged/);
      assert.equal(details.revision, '1');
      assert.notEqual(details.id, quick.id);
      assert.throws(
        () =>
          help.read({
            documentId: 'preview',
            selection: { mode: 'self', sectionIds: ['missing'] },
          }),
        /Unknown/,
      );
      assert.throws(
        () =>
          read(
            { documentId: 'preview', selection: { mode: 'self', sectionIds: ['quick'] } },
            AbortSignal.abort(new Error('cancelled')),
          ),
        /cancelled/,
      );
      // Revision is citation identity, not permission or a claim about the current screen.
      assert.equal(help.require('preview').revision, '1');
    },
  },
];

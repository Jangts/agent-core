// Locks output declaration and reply delivery failure branches: invalid ownership, schema and group
// references, composition errors and cancellation during chunked delivery.
// Covers `defineOutputCatalog` and the presentation event helpers; `node --test` against dist/esm.
import test from 'node:test';
import assert from 'node:assert/strict';
import { defineOutputCatalog } from '../dist/esm/kits/presentation/outputs.js';
import {
  replyBubbleTexts,
  publishReplyEvents,
  serializeOutputEvents,
  textOutputEvents,
} from '../dist/esm/kits/presentation/events.js';
const ctx = () => ({ app: {}, signal: new AbortController().signal });
const field = { id: 'body', owner: 'generated' };
const text = { id: 'text', kind: 'text', fields: [field] };
// A group of two text items, used for reference-validation cases.
const group = { id: 'group', kind: 'group', allowedOutputIds: ['text'], maxItems: 2 };
test('output declarations reject invalid ownership, fields, semantic keys and missing group references', () => {
  // Reserved id, unknown kind, empty fields, non-required generated field, __proto__, bad owner
  // and malformed semanticKeys variants.
  for (const definition of [
    { ...text, id: 'constructor' },
    { ...text, kind: 'invalid' },
    { ...text, fields: [] },
    { ...text, fields: [{ ...field, required: false }] },
    { ...text, fields: [{ ...field, id: '__proto__' }] },
    { ...text, fields: [{ ...field, owner: 'invalid' }] },
    ...[['a', 'a'], [''], [5]].map((semanticKeys) => ({
      ...text,
      fields: [{ ...field, owner: 'semantic', providerId: 'p', semanticKeys }],
    })),
  ])
    assert.throws(
      () =>
        defineOutputCatalog([definition], {
          providers: [
            {
              id: 'p',
              resolve() {
                return 'ok';
              },
            },
          ],
        }),
      TypeError,
    );
  assert.throws(
    () => defineOutputCatalog([{ ...group, allowedOutputIds: ['missing'] }]),
    /Unknown output/,
  );
  const catalog = defineOutputCatalog([text, group]);
  assert.throws(() => catalog.toModelSchema('group'), /program-assigned/);
  assert.throws(() => catalog.toModelSchema('missing'), /Unknown output/);
  assert.throws(() => catalog.require('missing'), /Unknown output/);
  assert.throws(() => catalog.check({ outputId: 'group', value: {} }), /individual/);
});
test('output validation reports actual generated-field issues and preserves cancellation exceptions', () => {
  const catalog = defineOutputCatalog([text]);
  // Non-object payloads are shape issues, not crashes.
  for (const value of [null, [], false])
    assert.equal(catalog.check({ outputId: 'text', value }).issues[0].code, 'OUTPUT_SHAPE');
  assert.equal(catalog.check({ outputId: 'text', value: { body: 'ok' } }).status, 'passed');
  assert.equal(
    catalog.check({ outputId: 'text', value: { body: 1 } }).issues[0].code,
    'OUTPUT_VALUE',
  );
  const abort = new DOMException('stopped', 'AbortError');
  // A cancellation thrown by a field parser must propagate, not become an issue.
  const aborting = defineOutputCatalog([
    {
      ...text,
      fields: [
        {
          ...field,
          valueSchema: {
            jsonSchema: {},
            parse() {
              throw abort;
            },
          },
        },
      ],
    },
  ]);
  assert.throws(
    () => aborting.check({ outputId: 'text', value: { body: 'ok' } }),
    (e) => e === abort,
  );
  const numeric = defineOutputCatalog([
    {
      ...text,
      fields: [
        { ...field, valueSchema: { jsonSchema: { type: 'number' }, parse: (value) => value } },
      ],
    },
  ]);
  assert.throws(
    () => numeric.compose({ outputId: 'text', input: { generated: { body: 1 } } }, ctx()),
    /string/,
  );
});
test('output composition handles optional bound fields and rejects invalid assigned groups', () => {
  const catalog = defineOutputCatalog(
    [
      text,
      group,
      {
        id: 'master',
        kind: 'master',
        master: '{{body}}',
        fields: [{ id: 'body', owner: 'bound', providerId: 'p', required: false }],
      },
      {
        id: 'record',
        kind: 'record',
        fields: [{ id: 'body', owner: 'bound', providerId: 'p', required: false }],
      },
    ],
    {
      providers: [
        {
          id: 'p',
          resolve() {
            return undefined;
          },
        },
      ],
    },
  );
  assert.equal(catalog.compose({ outputId: 'master', input: {} }, ctx()).value, '');
  assert.deepEqual({ ...catalog.compose({ outputId: 'record', input: {} }, ctx()).value }, {});
  for (const input of [
    { generated: { x: 1 }, items: [] },
    { items: null },
    {
      items: [
        { id: 'same', outputId: 'text', input: {} },
        { id: 'same', outputId: 'text', input: {} },
      ],
    },
    { items: [{ id: 'constructor', outputId: 'text', input: {} }] },
    { items: [{ id: 'item', outputId: 'missing', input: {} }] },
  ])
    assert.throws(() => catalog.compose({ outputId: 'group', input }, ctx()), /group/);
  assert.throws(() => catalog.compose({ outputId: 'text', input: {} }), /OperationContext/);
});
test('reply adapters preserve visible strings and suppress preview events', async () => {
  // Non-string bubbles are dropped from the visible text.
  assert.deepEqual(replyBubbleTexts({ text: 'one', bubbles: ['two', 1, null] }), ['one', 'two']);
  assert.deepEqual(replyBubbleTexts({ text: 1, bubbles: null }), []);
  const events = [];
  for await (const event of textOutputEvents(
    (async function* () {
      yield 'a';
      yield 'b';
    })(),
  ))
    events.push(event);
  assert.deepEqual(events, [
    { type: 'text', text: 'a' },
    { type: 'text', text: 'b' },
  ]);
  const text = [];
  for await (const chunk of serializeOutputEvents(
    (async function* () {
      yield { type: 'preview', text: 'hidden' };
      yield { type: 'text', text: 'ok' };
    })(),
  ))
    text.push(chunk);
  assert.deepEqual(text, ['ok']);
  await assert.rejects(async () => {
    for await (const event of publishReplyEvents(null, ctx())) assert.fail();
  }, /named/);
});
test('reply delivery aborts a pending interval and handles abort at listener registration', async (t) => {
  // Abort before next() and abort during listener registration must both reject with the reason.
  for (const immediate of [false, true]) {
    const controller = new AbortController(),
      reason = Error('cancel interval');
    const stream = publishReplyEvents(
      { text: 'ab', delivery: { chunkSize: 1, intervalMs: 10 } },
      { signal: controller.signal },
    );
    assert.equal((await stream.next()).value.text, 'a');
    if (immediate) {
      const add = controller.signal.addEventListener.bind(controller.signal);
      t.mock.method(controller.signal, 'addEventListener', (...args) => {
        add(...args);
        controller.abort(reason);
      });
    }
    const pending = stream.next();
    if (!immediate) controller.abort(reason);
    await assert.rejects(pending, (e) => e === reason);
  }
});

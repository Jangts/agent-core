// Locks runtime output composition: default string parsing, field ownership, constant snapshots,
// cancellation identity, sync-only providers and pull-driven reply delivery with bubble boundaries.
// Covers the presentation kit (`defineOutputCatalog`, `publishReplyEvents`, template and slot
// helpers); `node --test` against dist/esm.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defineOutputCatalog,
  defineTextTemplate,
  defineSemanticSlots,
  publishReplyEvents,
  REPLY_BUBBLE_BOUNDARY,
  serializeOutputEvents,
  textOutputEvents,
} from '@jangts/agent-core/kits/presentation';
const execution = (app = undefined, signal = new AbortController().signal) => ({ app, signal });
// Smallest valid text output, used by the legacy-form assertions.
const textOutput = () => ({
  id: 'text',
  kind: 'text',
  fields: [{ id: 'body', owner: 'generated' }],
});

test('output fields default to string parsing and partial checks cannot bypass composition', () => {
  const catalog = defineOutputCatalog([
    {
      id: 'record',
      kind: 'record',
      fields: [
        { id: 'body', owner: 'generated' },
        { id: 'optional', owner: 'generated', required: false },
      ],
    },
  ]);
  assert.deepEqual(catalog.toModelSchema('record').properties, {
    body: { type: 'string' },
    optional: { type: 'string' },
  });
  const checked = catalog.check({ outputId: 'record', value: { body: 'valid', optional: 1 } });
  assert.equal(checked.status, 'failed');
  assert.equal(checked.value.body, 'valid');
  assert.equal(checked.issues[0].code, 'OUTPUT_VALUE');
  // A caller-supplied `checked` block cannot override failed field validation.
  assert.throws(
    () =>
      catalog.compose(
        {
          outputId: 'record',
          input: { generated: { body: 'valid', optional: 1 }, checked: { status: 'passed' } },
        },
        execution(),
      ),
    /rejected generated fields/,
  );
  const composed = catalog.compose(
    { outputId: 'record', input: { generated: { body: 'valid' } } },
    execution(),
  );
  // Optional fields stay absent instead of defaulting to '' or undefined.
  assert.equal(Object.hasOwn(composed.value, 'optional'), false);
  assert.equal(catalog.check({ outputId: 'record', value: { body: 1 } }).status, 'failed');
  for (const name of ['inspect', 'modelView']) assert.equal(Object.hasOwn(catalog, name), false);
});

test('output registration and composition preserve prototype getters, parser/provider receivers and observer binding', () => {
  class Schema {
    #suffix = ':parsed';
    get jsonSchema() {
      return { type: 'string' };
    }
    parse(value) {
      if (typeof value !== 'string') throw Error('not text');
      return value + this.#suffix;
    }
  }
  const schema = new Schema();
  class Field {
    get id() {
      return 'body';
    }
    get owner() {
      return 'bound';
    }
    get providerId() {
      return 'source';
    }
    get valueSchema() {
      return schema;
    }
    validate() {
      assert.fail('extra implementation methods are not an alternate parser');
    }
  }
  class Definition {
    get id() {
      return 'text';
    }
    get kind() {
      return 'text';
    }
    get fields() {
      return [new Field()];
    }
  }
  class Provider {
    #prefix = 'bound:';
    get id() {
      return 'source';
    }
    resolve(_input, context) {
      return this.#prefix + context.app.name;
    }
  }
  const provider = new Provider();
  class Options {
    #results = [];
    get providers() {
      return [provider];
    }
    observe(result) {
      this.#results.push(result);
    }
    get results() {
      return this.#results;
    }
  }
  class Context {
    #app = { name: 'request' };
    #signal = new AbortController().signal;
    get app() {
      return this.#app;
    }
    get signal() {
      return this.#signal;
    }
  }
  class Request {
    get outputId() {
      return 'text';
    }
    get input() {
      return {};
    }
  }
  const options = new Options(),
    catalog = defineOutputCatalog([new Definition()], options);
  // Registration binds originals; replacing methods afterwards must not matter.
  schema.parse =
    provider.resolve =
    options.observe =
      () => assert.fail('registration must bind the original implementation');
  const result = catalog.compose(new Request(), new Context());
  assert.equal(result.value, 'bound:request:parsed');
  assert.deepEqual(options.results[0], result);
  // Observers receive a copy, not the returned object itself.
  assert.notEqual(options.results[0], result);
});

test('canonical output properties ignore unrelated members and retain constant snapshots and explicit undefined', () => {
  const constant = { source: 'registered' },
    keys = ['friendly'],
    allowed = ['reply'];
  const identity = { jsonSchema: {}, parse: (value) => value };
  const catalog = defineOutputCatalog(
    [
      {
        id: 'reply',
        kind: 'record',
        fields: [
          {
            id: 'text',
            owner: 'generated',
            valueSchema: {
              jsonSchema: { type: 'number' },
              parse(value) {
                if (typeof value !== 'number') throw Error('number required');
                return value + 1;
              },
            },
            schema: { type: 'string' },
            validate() {
              assert.fail('old validator is not an execution API');
            },
          },
          {
            id: 'name',
            owner: 'semantic',
            providerId: 'source',
            semanticKeys: keys,
            keys: ['wrong'],
            provider: 'wrong',
          },
          {
            id: 'fixed',
            owner: 'constant',
            constantValue: constant,
            value: 'wrong',
            valueSchema: identity,
          },
          {
            id: 'empty',
            owner: 'constant',
            get constantValue() {
              return undefined;
            },
            value: 'wrong',
            valueSchema: identity,
          },
        ],
      },
      { id: 'batch', kind: 'group', maxItems: 1, allowedOutputIds: allowed, outputs: ['wrong'] },
    ],
    { providers: [{ id: 'source', resolve: ({ key }, { app }) => app[key] }] },
  );
  constant.source = 'changed';
  // Post-registration mutation of constants, semantic keys and allow-lists must not leak.
  keys.push('wrong');
  allowed.push('wrong');
  const result = catalog.compose(
    {
      outputId: 'batch',
      input: {
        items: [
          {
            id: 'first',
            outputId: 'reply',
            output: 'wrong',
            input: { generated: { text: 1, name: 'friendly' } },
          },
        ],
      },
    },
    execution({ friendly: 'private' }),
  );
  const record = result.value[0].value;
  assert.equal(record.text, 2);
  assert.equal(record.name, 'private');
  assert.deepEqual(record.fixed, { source: 'registered' });
  assert.equal(Object.isFrozen(record.fixed), true);
  // A constant whose value is undefined is still explicit, so the key stays present.
  assert.equal(Object.hasOwn(record, 'empty'), true);
  assert.equal(record.empty, undefined);
  assert.deepEqual(catalog.toModelSchema('reply').properties.name.enum, ['friendly']);
  assert.throws(
    () =>
      catalog.compose(
        { outputId: 'batch', input: { items: [{ id: 'first', outputId: 'wrong', input: {} }] } },
        execution(),
      ),
    /group reference/,
  );
});

test('group children keep the operation context instead of accepting an input-owned context override', () => {
  const contexts = [],
    context = execution({ owner: 'authorized' });
  const catalog = defineOutputCatalog(
    [
      { id: 'reply', kind: 'text', fields: [{ id: 'body', owner: 'bound', providerId: 'source' }] },
      { id: 'batch', kind: 'group', maxItems: 1, allowedOutputIds: ['reply'] },
    ],
    {
      providers: [
        {
          id: 'source',
          resolve(_request, supplied) {
            contexts.push(supplied);
            return supplied.app.owner;
          },
        },
      ],
    },
  );
  class Item {
    get id() {
      return 'first';
    }
    get outputId() {
      return 'reply';
    }
    get input() {
      // Item input must not smuggle in an execution context.
      return { context: { owner: 'forged' } };
    }
  }
  class Input {
    get items() {
      return [new Item()];
    }
  }
  const result = catalog.compose({ outputId: 'batch', input: new Input() }, context);
  assert.equal(result.value[0].value, 'authorized');
  assert.equal(contexts[0], context);
  assert.equal(Object.isFrozen(result.value), true);
});

test('generated schema failures are issues while AbortError and TimeoutError retain their identity', () => {
  for (const failure of [
    new TypeError('invalid data'),
    new Error('parser failure'),
    new DOMException('stop', 'AbortError'),
    new DOMException('late', 'TimeoutError'),
  ]) {
    const catalog = defineOutputCatalog([
      {
        id: 'reply',
        kind: 'text',
        fields: [
          {
            id: 'body',
            owner: 'generated',
            valueSchema: {
              jsonSchema: {},
              parse() {
                throw failure;
              },
            },
          },
        ],
      },
    ]);
    if (['AbortError', 'TimeoutError'].includes(failure.name)) {
      // Cancellation and timeout keep their identity; other parser failures become issues.
      assert.throws(
        () => catalog.check({ outputId: 'reply', value: { body: 'input' } }),
        (error) => error === failure,
      );
      assert.throws(
        () =>
          catalog.compose(
            { outputId: 'reply', input: { generated: { body: 'input' } } },
            execution(),
          ),
        (error) => error === failure,
      );
    } else {
      const checked = catalog.check({ outputId: 'reply', value: { body: 'input' } });
      assert.equal(checked.status, 'failed');
      assert.deepEqual(checked.issues, [
        {
          path: ['reply', 'body'],
          code: 'OUTPUT_VALUE',
          message: 'Generated field does not match its schema',
        },
      ]);
    }
  }
});

test('output parser or provider cancellation stops later handlers and preserves the actual signal reason', () => {
  // Cancellation during parsing and during provider resolution must both stop later fields.
  for (const during of ['parse', 'provider']) {
    const controller = new AbortController(),
      reason = new Error('stop ' + during);
    const catalog = defineOutputCatalog(
      [
        {
          id: 'reply',
          kind: 'record',
          fields:
            during === 'parse'
              ? [
                  {
                    id: 'first',
                    owner: 'generated',
                    valueSchema: {
                      jsonSchema: { type: 'string' },
                      parse(value) {
                        controller.abort(reason);
                        return value;
                      },
                    },
                  },
                  {
                    id: 'second',
                    owner: 'generated',
                    valueSchema: {
                      jsonSchema: { type: 'string' },
                      parse() {
                        assert.fail('must not parse after cancellation');
                      },
                    },
                  },
                ]
              : [
                  { id: 'first', owner: 'bound', providerId: 'first' },
                  { id: 'second', owner: 'bound', providerId: 'second' },
                ],
        },
      ],
      {
        providers: [
          {
            id: 'first',
            resolve() {
              controller.abort(reason);
              return 'value';
            },
          },
          {
            id: 'second',
            resolve() {
              assert.fail('must not read after cancellation');
            },
          },
        ],
      },
    );
    assert.throws(
      () =>
        catalog.compose(
          {
            outputId: 'reply',
            input: { generated: during === 'parse' ? { first: 'one', second: 'two' } : {} },
          },
          execution(undefined, controller.signal),
        ),
      (error) => error === reason,
    );
  }
});

test('output providers remain synchronous and late rejections are observed', async () => {
  const failure = new Error('late provider');
  const catalog = defineOutputCatalog(
    [{ id: 'reply', kind: 'text', fields: [{ id: 'body', owner: 'bound', providerId: 'source' }] }],
    {
      providers: [{ id: 'source', resolve: () => Promise.reject(failure) }],
    },
  );
  assert.throws(
    () => catalog.compose({ outputId: 'reply', input: {} }, execution()),
    /providers must be synchronous/,
  );
  // Providers are synchronous, so a rejected promise is treated as an error.
  const invalid = defineOutputCatalog([
    {
      id: 'reply',
      kind: 'text',
      fields: [
        {
          id: 'body',
          owner: 'generated',
          valueSchema: { jsonSchema: {}, parse: () => Promise.reject(failure) },
        },
      ],
    },
  ]);
  assert.equal(invalid.check({ outputId: 'reply', value: { body: 'value' } }).status, 'failed');
  // Let the rejected parser promise settle so no unhandled rejection escapes the test.
  await new Promise((resolve) => setImmediate(resolve));
});

test('old output execution forms do not select providers or group references', () => {
  const catalog = defineOutputCatalog([textOutput()]);
  assert.throws(
    () => catalog.compose('text', { generated: { body: 'value' }, context: {} }),
    /named output request/,
  );
  assert.throws(
    () =>
      defineOutputCatalog(
        [
          {
            id: 'bound',
            kind: 'text',
            fields: [{ id: 'body', owner: 'bound', provider: 'source' }],
          },
        ],
        { providers: [{ id: 'source', resolve: () => 'value' }] },
      ),
    /Unknown output provider/,
  );
  assert.throws(
    () =>
      defineOutputCatalog(
        [
          {
            id: 'bound',
            kind: 'text',
            fields: [{ id: 'body', owner: 'bound', providerId: 'source' }],
          },
        ],
        [{ id: 'source', resolve: () => 'value' }],
      ),
    /Unknown output provider/,
  );
  assert.throws(
    () =>
      defineOutputCatalog([
        { id: 'batch', kind: 'group', maxItems: 1, outputs: ['text'] },
        textOutput(),
      ]),
    /Invalid output group/,
  );
});

test('reply delivery reads getter-based requests and options while preserving Unicode and explicit string adapters', async () => {
  class Options {
    get chunkSize() {
      return 1;
    }
    get maxDurationMs() {
      return 0;
    }
  }
  class Request {
    get text() {
      // The boundary marker splits bubbles; CJK and a surrogate pair must stay intact.
      return '甲🙂' + REPLY_BUBBLE_BOUNDARY + '乙';
    }
    get delivery() {
      return new Options();
    }
  }
  class Context {
    #signal = new AbortController().signal;
    get signal() {
      return this.#signal;
    }
  }
  const events = await Array.fromAsync(publishReplyEvents(new Request(), new Context()));
  assert.deepEqual(events, [
    { type: 'text', text: '甲' },
    { type: 'text', text: '🙂' },
    { type: 'bubble' },
    { type: 'text', text: '乙' },
  ]);
  assert.deepEqual(
    await Array.fromAsync(
      serializeOutputEvents(
        (async function* () {
          yield* events;
        })(),
      ),
    ),
    ['甲', '🙂', REPLY_BUBBLE_BOUNDARY, '乙'],
  );
  assert.deepEqual(
    await Array.fromAsync(
      textOutputEvents(
        (async function* () {
          yield 'one';
          yield 'two';
        })(),
      ),
    ),
    [
      { type: 'text', text: 'one' },
      { type: 'text', text: 'two' },
    ],
  );
});

test('reply delivery rejects old positional and numeric delivery contracts before emitting', async () => {
  await assert.rejects(
    Array.fromAsync(publishReplyEvents('reply', new AbortController().signal, 1)),
    /named reply delivery request/,
  );
  await assert.rejects(
    Array.fromAsync(publishReplyEvents({ text: 'reply', delivery: 1 }, execution())),
    /named options/,
  );
});

test('reply delivery stays pull-driven and cancellation after a yield never publishes another event', async () => {
  const controller = new AbortController(),
    reason = new DOMException('stop delivery', 'AbortError');
  let reads = 0;
  const stream = publishReplyEvents(
    {
      get text() {
        reads++;
        return 'ab';
      },
      delivery: { chunkSize: 1 },
    },
    { signal: controller.signal },
  );
  // The text getter is not read until the first next() call.
  assert.equal(reads, 0);
  assert.deepEqual((await stream.next()).value, { type: 'text', text: 'a' });
  assert.equal(reads, 1);
  controller.abort(reason);
  await assert.rejects(stream.next(), (error) => error === reason);
  const completed = new AbortController(),
    final = publishReplyEvents({ text: 'one' }, { signal: completed.signal });
  assert.deepEqual((await final.next()).value, { type: 'text', text: 'one' });
  // Abort after the last yield must still reject rather than silently complete.
  completed.abort(reason);
  await assert.rejects(final.next(), (error) => error === reason);
});

test('generated value getters cannot cancel and then start a field parser', () => {
  const controller = new AbortController(),
    reason = new Error('stop in generated getter');
  const catalog = defineOutputCatalog([
    {
      id: 'reply',
      kind: 'text',
      fields: [
        {
          id: 'body',
          owner: 'generated',
          valueSchema: {
            jsonSchema: { type: 'string' },
            parse() {
              assert.fail('must not parse after cancellation');
            },
          },
        },
      ],
    },
  ]);
  const generated = {
    get body() {
      controller.abort(reason);
      return 'value';
    },
  };
  assert.throws(
    () =>
      catalog.compose(
        { outputId: 'reply', input: { generated } },
        execution(undefined, controller.signal),
      ),
    (error) => error === reason,
  );
});

test('template options bind class error and observer receivers while semantic definitions support getters', () => {
  class Errors {
    #prefix = 'missing:';
    missingField(key) {
      return new Error(this.#prefix + key);
    }
  }
  const errors = new Errors();
  class Options {
    #events = [];
    get errors() {
      return errors;
    }
    observe(value) {
      this.#events.push(value);
      throw new Error('observer is independent');
    }
    get events() {
      return this.#events;
    }
  }
  const options = new Options(),
    template = defineTextTemplate('{{body}}', options);
  errors.missingField = options.observe = () => assert.fail('registered methods must stay fixed');
  // Substitution is single-pass: a marker inside the value stays literal.
  assert.equal(template.render({ body: '{{body}}' }), '{{body}}');
  assert.deepEqual(options.events, ['{{body}}']);
  assert.throws(() => template.render({}), /missing:body/);
  class Slots {
    get namespace() {
      return 'address';
    }
    get keys() {
      return ['familiar'];
    }
    get maxOccurrences() {
      return 1;
    }
  }
  const slots = defineSemanticSlots(new Slots());
  assert.equal(slots.isValid('hello {{address:familiar}}'), true);
  assert.equal(slots.isValid('{{address:familiar}}{{address:familiar}}'), false);
  assert.equal(Object.hasOwn(slots, 'valid'), false);
});

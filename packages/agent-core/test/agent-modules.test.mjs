/*
 * Public package contract for the declarative building blocks exported by
 * `@jangts/agent-core` (context assembly, policy sets, recovery chains,
 * candidate selection, interaction protocols, evidence checklists, templates
 * and semantic slots).
 *
 * Every case runs twice, once against the ESM entry and once against the CJS
 * build resolved through `createRequire`, so the two published formats cannot
 * drift. Test names are prefixed with the format that failed.
 *
 * Runs on the built `dist/` output with plain `node --test`; only in-memory
 * fakes are used, no transport or filesystem access.
 */
import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as core from '@jangts/agent-core';
import * as kits from '@jangts/agent-core/kits';
const esm = { ...core, ...kits };
const require = createRequire(import.meta.url);
for (const [format, api] of [
  ['ESM', esm],
  [
    'CJS',
    {
      ...createRequire(import.meta.url)('@jangts/agent-core'),
      ...createRequire(import.meta.url)('@jangts/agent-core/kits'),
    },
  ],
]) {
  const test = (name, ...args) => nodeTest(`${format}: ${name}`, ...args);
  const {
    defineContextAssembly,
    defineContextFragments,
    transformContextText,
    definePolicySet,
    defineRecoveryChain,
    defineCandidateSelection,
    defineEvidenceChecklist,
    defineTextTemplate,
    defineSemanticSlots,
    defineInteractionProtocol,
    bindInteraction,
    configureBreakWhile,
  } = api;

  const metadata = {
    sourceId: 'fixture',
    trust: 'user',
    lifetime: 'turn',
    role: 'user',
    maxChars: 1000,
  };

  test('context assembly expands contributions in place and rebuilds against current input', () => {
    const order = [];
    const context = defineContextAssembly(
      [
        {
          kind: 'fragment',
          id: 'request',
          format: (input) => {
            order.push('request');
            return { request: input.request };
          },
        },
        // Declared between two fragments: contributions must expand in place,
        // not be appended after every fragment.
        { kind: 'contributions', placement: 'receipts' },
        {
          kind: 'fragment',
          id: 'budget',
          format: (input) => {
            order.push('budget');
            return { budget: input.remaining };
          },
        },
      ],
      {
        fragment: (id, value) => ({ id, ...metadata, value }),
        contributions: {
          receipts: (input) => {
            order.push('receipts');
            return [
              { id: 'evidence', ...metadata, trust: 'tool', value: { receipts: input.receipts } },
            ];
          },
        },
      },
    );
    const input = { request: 'original', remaining: 2, receipts: [] };
    const first = context.build({ input, maxInputChars: 3000 });
    assert.deepEqual(order, ['request', 'receipts', 'budget']);
    assert.deepEqual(
      first.fragmentUsage.map((fragment) => fragment.id),
      ['request', 'evidence', 'budget'],
    );
    // Mutating the input after the first build must be visible to the next build,
    // while the previously returned result stays frozen.
    input.receipts.push('actual result');
    assert.deepEqual(
      JSON.parse(context.build({ input, maxInputChars: 3000 }).messages[1].content).receipts,
      ['actual result'],
    );
    assert.deepEqual(JSON.parse(first.messages[1].content).receipts, []);
    assert.throws(
      () =>
        defineContextAssembly([{ kind: 'contributions', placement: 'missing' }], {
          fragment: () => {},
        }),
      /Unknown context contribution/,
    );
  });

  test('context transforms cover nested receipts before budgets and keep formatter-transform order', () => {
    const order = [];
    const definitions = ['first', 'second'].map((id) => ({
      id,
      ...metadata,
      maxChars: 50,
      format: () => {
        order.push('format:' + id);
        return { [id]: { text: 'private'.repeat(20) } };
      },
    }));
    const context = defineContextFragments(definitions, {
      transform(fragment) {
        order.push('transform:' + fragment.id);
        return transformContextText(fragment, (text) => text.replaceAll('private', 'x'));
      },
    });
    const result = context.build({ input: {}, maxInputChars: 200 });
    assert.deepEqual(order, [
      'format:first',
      'transform:first',
      'format:second',
      'transform:second',
    ]);
    assert.doesNotMatch(JSON.stringify(result), /private/);
    assert.throws(
      () => defineContextFragments([definitions[0], definitions[0]]),
      /Duplicate context fragment/,
    );
    const unsafe = defineContextFragments([{ ...definitions[0], role: 'system' }]);
    assert.throws(() => unsafe.build({ input: {}, maxInputChars: 3000 }), /Untrusted context/);
  });

  test('policy assessment keeps all independent reasons and cannot turn off a mandatory rule', () => {
    const policies = definePolicySet([
      {
        id: 'permission',
        kind: 'mandatory',
        description: 'permission review',
        when: (input) => !!input.prepared,
      },
      {
        id: 'configured',
        kind: 'configured',
        description: 'configured review',
        when: (input) => input.mode === 'always',
      },
      {
        id: 'identity',
        kind: 'mandatory',
        description: 'identity review',
        when: (input) => !!input.person,
      },
    ]);
    assert.deepEqual(policies.assess({ mode: 'off', prepared: true, person: true }), {
      required: true,
      reasons: ['permission', 'identity'],
      kinds: ['mandatory'],
    });
    assert.deepEqual(policies.assess({ mode: 'off' }), { required: false, reasons: [], kinds: [] });
    assert.throws(
      () => definePolicySet([...policies.definitions, policies.definitions[0]]),
      /Duplicate policy/,
    );
  });

  test('recovery can decline, preserves falsey results and stops on handler errors', () => {
    const calls = [];
    const recovery = defineRecoveryChain([
      {
        id: 'decline',
        description: 'not applicable',
        tryRecover: () => {
          calls.push('decline');
          return { handled: false };
        },
      },
      {
        id: 'answer',
        description: 'accepted',
        tryRecover: (input) => {
          calls.push('answer');
          return { handled: true, value: input };
        },
      },
      {
        id: 'later',
        description: 'must not run',
        tryRecover: () => {
          calls.push('later');
          return { handled: true, value: 99 };
        },
      },
    ]);
    // Falsy payloads are real answers, not decline signals: only `handled` decides.
    for (const value of [0, false, '', undefined]) {
      calls.length = 0;
      assert.deepEqual(recovery.tryRecover(value), { handled: true, value });
      assert.deepEqual(calls, ['decline', 'answer']);
    }
    const failure = new Error('original');
    const rejected = defineRecoveryChain([
      {
        id: 'failure',
        description: 'propagate',
        tryRecover() {
          throw failure;
        },
      },
    ]);
    assert.throws(
      () => rejected.tryRecover({}),
      (error) => error === failure,
    );
  });

  test('candidate selection closes after acceptance, rejects nesting and retains semantic rejection tags', () => {
    const events = [],
      failure = new Error('candidate contract');
    const candidates = defineCandidateSelection({
      field: 'proposals',
      maxCandidates: 2,
      error: failure,
      tags: ['proposal'],
    });
    const value = { proposals: [{ intent: 'first' }, { intent: 'second' }] };
    assert.equal(candidates.parse({ value, allowed: true }), value.proposals);
    assert.deepEqual(candidates.parse({ value: 'plain', allowed: false }), ['plain']);
    configureBreakWhile({ onBreak: (event) => events.push(event) });
    try {
      for (const [input, allowed, tag] of [
        [value, false, 'availability'],
        [{ ...value, extra: true }, true, 'envelope'],
        [{ proposals: null }, true, 'selection'],
        [{ proposals: [{ proposals: [] }] }, true, 'members'],
      ]) {
        assert.throws(
          () => candidates.parse({ value: input, allowed }),
          (error) => error === failure,
        );
        assert.deepEqual(events.at(-1).tags, ['proposal', tag]);
      }
      // Exactly one break event per rejection, with the shared tags plus the
      // branch-specific tag; duplicates would double-report to observers.
      assert.equal(events.length, 4);
    } finally {
      configureBreakWhile();
    }
  });

  test('candidate rejection factories retain their class receiver and registered method', () => {
    class Definition {
      field = 'proposals';
      maxCandidates = 1;
      #failure = new Error('candidate class error');
      error() {
        return this.#failure;
      }
      get failure() {
        return this.#failure;
      }
    }
    const definition = new Definition(),
      candidates = defineCandidateSelection(definition);
    // Replacing the instance method after registration must not swap the factory
    // that was captured with its original receiver.
    definition.error = () => assert.fail('registered error factory must stay fixed');
    assert.throws(
      () => candidates.parse({ value: { proposals: [] }, allowed: true }),
      (error) => error === definition.failure,
    );
  });

  test('recovery accepts an explicit prototype value including undefined and rejects missing values', () => {
    class Result {
      #value;
      constructor(value) {
        this.#value = value;
      }
      get handled() {
        return true;
      }
      get value() {
        return this.#value;
      }
    }
    const recovery = defineRecoveryChain([
      { id: 'answer', description: 'answer', tryRecover: (value) => new Result(value) },
      {
        id: 'unreachable',
        description: 'unreachable',
        tryRecover() {
          assert.fail('explicit handled result must stop traversal');
        },
      },
    ]);
    for (const value of [undefined, 0, 'answer'])
      assert.equal(recovery.tryRecover(value).value, value);
    const missing = defineRecoveryChain([
      { id: 'missing', description: 'missing', tryRecover: () => ({ handled: true }) },
    ]);
    assert.throws(() => missing.tryRecover(null), /Invalid recovery outcome/);
  });

  test('delivery accepts prototype completion values and checks cancellation after reading them', () => {
    const { defineDelivery } = require('@jangts/agent-core/kits/delivery');
    class Result {
      #value;
      constructor(value) {
        this.#value = value;
      }
      get type() {
        return 'complete';
      }
      get value() {
        return this.#value;
      }
    }
    const delivery = defineDelivery({
      createState: (input) => input,
      missingResult: () => new Error('missing'),
      stages: [
        { id: 'answer', handle: (state) => new Result(state) },
        {
          id: 'unreachable',
          handle() {
            assert.fail('explicit completion must stop delivery');
          },
        },
      ],
    });
    for (const value of [undefined, 0, 'answer'])
      assert.equal(delivery.deliver(value, { signal: new AbortController().signal }), value);
    assert.throws(
      () =>
        defineDelivery({
          createState() {},
          missingResult: () => new Error('missing'),
          stages: [{ id: 'invalid', handle: () => ({ type: 'complete' }) }],
        }).deliver(null, { signal: new AbortController().signal }),
      /explicit continue\/complete/,
    );
    const controller = new AbortController(),
      reason = new Error('stop completion');
    const stopped = defineDelivery({
      createState() {},
      missingResult: () => new Error('missing'),
      stages: [
        {
          id: 'stop',
          handle: () => ({
            type: 'complete',
            get value() {
              controller.abort(reason);
              return 'late';
            },
          }),
        },
      ],
    });
    assert.throws(
      () => stopped.deliver(null, { signal: controller.signal }),
      (error) => error === reason,
    );
  });

  test('interaction binding checks complete handlers and executes only after protocol acceptance', () => {
    let executed = 0;
    const protocol = defineInteractionProtocol({
      commandField: 'kind',
      commandAliases: ['type'],
      commands: {
        lookup: {
          category: 'query',
          fields: { term: { required: true } },
          checks: [{ occur: (value) => typeof value.term !== 'string', error: 'term' }],
          format: (value) => ({ kind: 'forged', term: value.term }),
        },
        reply: { category: 'presentation', fields: ['text'] },
      },
    });
    const handlers = {
      lookup: (value, context) => {
        executed++;
        return context.prefix + value.term;
      },
      reply: () => 'reply',
    };
    const runtime = bindInteraction(protocol, handlers);
    assert.deepEqual(
      protocol.commands.manifest('query').map((entry) => entry.id),
      ['lookup'],
    );
    assert.equal(
      runtime.dispatch({ type: 'lookup', term: 'book' }, { prefix: 'found:' }),
      'found:book',
    );
    assert.equal(executed, 1, 'formatter cannot change command routing');
    for (const value of [
      { kind: 'lookup', type: 'lookup', term: 'book' },
      { kind: 'unknown' },
      { kind: 'lookup', term: null },
    ])
      assert.throws(() => runtime.dispatch(value, {}));
    assert.equal(executed, 1);
    assert.throws(
      () => bindInteraction(protocol, { lookup: handlers.lookup }),
      /Missing interaction handler/,
    );
    assert.throws(
      () => bindInteraction(protocol, { ...handlers, foreign: () => {} }),
      /Unregistered interaction handler/,
    );
    // Handlers are captured when the protocol is bound; mutating the map later
    // must not change dispatch.
    handlers.lookup = () => 'changed';
    assert.equal(
      runtime.dispatch({ kind: 'lookup', term: 'book' }, { prefix: 'found:' }),
      'found:book',
    );
  });

  test('selector aliases normalize without mutating input or advertising aliases in model schemas', () => {
    const protocol = defineInteractionProtocol({
      commandField: 'kind',
      commandAliases: ['type'],
      commands: { reply: { category: 'presentation', fields: ['text'] } },
    });
    const input = { type: 'reply', text: 'hello' };
    assert.deepEqual(protocol.parse(input), { kind: 'reply', text: 'hello' });
    assert.deepEqual(input, { type: 'reply', text: 'hello' });
    assert.deepEqual(Object.keys(protocol.modelJsonSchema.anyOf[0].properties), ['kind', 'text']);
    for (const value of [
      null,
      [],
      {},
      { type: 1 },
      { type: 'reply', kind: 'reply', text: 'hello' },
    ])
      assert.throws(() => protocol.parse(value));
  });

  test('evidence completion uses real registered providers and distinguishes search from read', () => {
    const checklist = defineEvidenceChecklist([
      {
        kind: 'document',
        description: 'verified reads',
        isSatisfied: (receipt, requirement) =>
          receipt.id === requirement.id && receipt.operation === requirement.operation,
      },
    ]);
    const requirements = [{ kind: 'document', id: 'manual', operation: 'read' }];
    const search = [{ id: 'manual', operation: 'search' }];
    assert.equal(checklist.isComplete({ observations: search, requirements }), false);
    assert.deepEqual(checklist.missing({ observations: search, requirements }), requirements);
    assert.equal(
      checklist.isComplete({
        observations: [...search, { id: 'manual', operation: 'read' }],
        requirements,
      }),
      true,
    );
    assert.throws(
      () =>
        checklist.isComplete({
          observations: [],
          requirements: [{ kind: 'unregistered', id: 'manual' }],
        }),
      /Unknown evidence kind/,
    );
  });

  test('output masters substitute once and semantic slots expose no private values', () => {
    const template = defineTextTemplate('{{opening}} {{text}}');
    assert.deepEqual(template.slots, ['opening', 'text']);
    assert.equal(template.render({ opening: 'hello', text: '{{opening}}' }), 'hello {{opening}}');
    assert.throws(() => template.render({ text: 'body' }), /Missing template slot: opening/);
    const slots = defineSemanticSlots({
      namespace: 'address',
      keys: ['familiar'],
      maxOccurrences: 1,
    });
    assert.equal(slots.isValid('hello {{address:familiar}}'), true);
    assert.equal(slots.isValid('hello'), true);
    for (const text of [
      '{{address:private-name}}',
      '{{address',
      '{{address:familiar}}{{address:familiar}}',
    ])
      assert.equal(slots.isValid(text), false);
  });

  test('context builders reuse a bound budget and support one-off overrides', () => {
    class Budget {
      #ceiling = 200;
      maxInputChars(input) {
        return Math.min(input.requested, this.#ceiling);
      }
    }
    const context = defineContextFragments(
      [{ id: 'request', ...metadata, format: (input) => ({ text: input.text }) }],
      new Budget(),
    );
    const input = { text: 'hello', requested: 300 };
    assert.equal(context.plan({ input }).maxInputChars, 200);
    assert.equal(context.build({ input, maxInputChars: 100 }).maxInputChars, 100);
    assert.throws(
      () => context.build({ input, maxInputChars: 1 }),
      (error) => error.issues?.[0]?.code === 'CONTEXT_BUDGET',
    );
    assert.throws(() => context.plan({ input, maxInputChars: NaN }), /Invalid context budget/);
  });
}

// Locks intent/scope registry semantics and ToolLifecycleRegistry traversal: host vocabulary,
// frozen snapshots, alias normalization, ordered contributions and receipts for new observations.
// Covers `GoalRegistry`, `ScopeRegistry`, `ToolLifecycleRegistry`, `ContextJournal`,
// `defineAgentCatalog` and `defineRegistrationCatalog`; `node --test` against dist/esm.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ContextJournal,
  configureBreakWhile,
  defineRegistrationCatalog,
} from '../dist/esm/index.js';
import {
  GoalRegistry,
  ScopeRegistry,
  defineAgentCatalog,
} from '../dist/esm/kits/domains/index.js';
import { ToolLifecycleRegistry } from '../dist/esm/kits/tools.js';

test('intent and scope registries use host vocabulary, freeze entries, normalize aliases and seal after batch installation', () => {
  const intents = new GoalRegistry({
    delegates: ['lookup', 'deliver'],
    actions: ['inspect'],
    scopeModes: ['needed'],
  });
  const definition = {
    id: 'inspect',
    description: 'Inspect documents',
    scopePolicy: 'needed',
    planIntent: 'inspect',
    delegates: ['lookup'],
  };
  intents.registerAll([definition]).seal();
  // Registration copies inputs, so post-registration mutation must not leak.
  definition.delegates.push('deliver');
  assert.deepEqual(intents.get('inspect').delegates, ['lookup']);
  assert.equal(intents.require('inspect').delegates.includes('lookup'), true);
  const description = intents.describe();
  // describe() returns detached copies as well.
  description[0].delegates.push('deliver');
  assert.deepEqual(intents.get('inspect').delegates, ['lookup']);
  assert.throws(() => intents.register({ ...definition, id: 'another' }), /sealed/);
  const scopes = new ScopeRegistry({
    categories: ['documents'],
    acceptsGoal: (scope, goal) => goal === 'talk' || scope.goalIds.includes(goal),
  });
  scopes.registerAll([
    {
      id: 'manuals',
      aliases: ['docs'],
      description: 'Public manuals',
      category: 'documents',
      goalIds: ['inspect'],
      queryScopeIds: ['manuals'],
      knowledgeTopicIds: [],
      toolIds: ['docs.read'],
      evidence: [{ kind: 'read', id: 'manuals' }],
    },
  ]);
  assert.equal(scopes.normalize('docs'), 'manuals');
  assert.equal(scopes.acceptsGoal('docs', 'talk'), true);
  assert.equal(scopes.acceptsGoal('docs', 'foreign'), false);
  // Nested entries are frozen individually.
  assert.ok(Object.isFrozen(scopes.get('docs').evidence[0]));
  assert.deepEqual(scopes.queryScopeIds(), ['manuals']);
});

test('registry queries expose canonical IDs and scope projections remain detached from registered references', () => {
  const intents = GoalRegistry.create([
    {
      id: 'inspect',
      description: 'Inspect',
      scopePolicy: 'required',
      targetPolicy: 'forbidden',
      delegates: ['read'],
    },
  ]);
  assert.deepEqual(intents.ids(), ['inspect']);
  assert.equal(Object.hasOwn(intents.require('inspect'), 'goal'), false);
  assert.equal(Object.hasOwn(intents.describe()[0], 'scope'), false);
  assert.equal(Object.hasOwn(intents.describe()[0], 'target'), false);
  const input = {
    id: 'docs',
    description: 'Docs',
    category: 'documents',
    goalIds: ['inspect'],
    toolIds: ['docs.read'],
    queryScopeIds: ['manuals'],
    knowledgeTopicIds: ['help'],
  };
  const scopes = ScopeRegistry.create([input]);
  input.toolIds.push('forged.read');
  const projection = scopes.describe(['inspect'])[0];
  assert.deepEqual(projection.toolIds, ['docs.read']);
  // Legacy singular aliases must not appear on projections or on stored entries.
  for (const legacy of ['intents', 'tools', 'queryScopes', 'knowledgeTopics']) {
    assert.equal(Object.hasOwn(projection, legacy), false);
    assert.equal(Object.hasOwn(scopes.require('docs'), legacy), false);
  }
  projection.toolIds.push('forged.read');
  projection.goalIds.push('foreign');
  assert.deepEqual(scopes.require('docs').toolIds, ['docs.read']);
  assert.equal(scopes.acceptsGoal('docs', 'foreign'), false);
  assert.equal(scopes.acceptsQuery('docs', 'manuals'), true);
  assert.deepEqual(scopes.topics('docs'), ['help']);
  assert.deepEqual(scopes.describe(['foreign']), []);
  assert.throws(() => scopes.register(input), /sealed/);
});

test('registry assertions and scope predicates keep their class policy receiver', () => {
  class Policy {
    #id = 'inspect';
    assertDefinition(value) {
      assert.ok(value.id === this.#id || value.id === 'docs');
    }
    acceptsGoal(scope, id) {
      return id === this.#id && scope.goalIds.includes(id);
    }
  }
  const policy = new Policy();
  const intents = GoalRegistry.create(
    [{ id: 'inspect', description: 'Inspect', delegates: ['read'] }],
    policy,
  );
  const scopes = ScopeRegistry.create(
    [{ id: 'docs', description: 'Docs', category: 'documents', goalIds: intents.ids() }],
    policy,
  );
  assert.equal(scopes.acceptsGoal('docs', 'inspect'), true);
  assert.equal(scopes.acceptsGoal('docs', 'foreign'), false);
});

test('scope custom validation preserves independent diagnostic groups before duplicate rejection', () => {
  const events = [],
    failure = new Error('invalid');
  const scopes = new ScopeRegistry({
    tags: ['scope'],
    errors: { invalid: failure },
    assertDefinition: (value) => {
      if (value.extra === false) throw failure;
    },
  });
  const entry = {
    id: 'docs',
    description: 'Docs',
    category: 'document',
    goalIds: ['inspect'],
    queryScopeIds: ['docs'],
    knowledgeTopicIds: [],
    toolIds: ['docs.read'],
  };
  scopes.register(entry);
  configureBreakWhile({ onBreak: (event) => events.push(event) });
  try {
    assert.throws(
      () => scopes.register(entry),
      (error) => error === failure,
    );
    assert.deepEqual(events[0].tags, ['scope', 'duplicate']);
    assert.throws(
      () => scopes.register({ ...entry, extra: false }),
      (error) => error === failure,
    );
    assert.equal(
      events.length,
      1,
      'custom thrown errors are not silently reclassified as duplicate failures',
    );
  } finally {
    configureBreakWhile();
  }
});

test('scope source/tool requirements and naming restrictions are host policy rather than built-in platform rules', () => {
  const definition = {
    id: 'Workflow Domain',
    description: 'Task grouping',
    category: 'workflow',
    goalIds: [],
    queryScopeIds: [],
    knowledgeTopicIds: [],
    toolIds: [],
  };
  const generic = new ScopeRegistry();
  // Without host policy, sources and tools are optional and any id shape is accepted.
  generic.register(definition);
  assert.equal(generic.has('Workflow Domain'), true);
  assert.throws(
    () => new ScopeRegistry({ requireSources: true }).register(definition),
    /Invalid scope definition/,
  );
  assert.throws(
    () => new ScopeRegistry({ idPattern: /^[a-z]+$/ }).register(definition),
    /Invalid scope definition/,
  );
});

function runtime(owner = {}, extra = {}) {
  return new ToolLifecycleRegistry({
    receiver: () => owner,
    registration: {
      kinds: ['read'],
      isValidId: (tool) => typeof tool.id === 'string' && !!tool.id,
      audiences: ['model', 'runtime'],
      effects: ['read'],
      goalExists: (goal) => goal === 'inspect',
    },
    
    outputs: () => [['deliver', { terminal: true, keys: () => ['type'] }]],
    goalIds: () => ['inspect'],
    signal: (context) => context.signal,
    journal: (context) => context.journal,
    checkpoint: (context) => context.observations.length,
    receipt: (context, offset) => context.observations.slice(offset),
    receiptError: (error) => ({ message: error.message }),
    contextFragment: (tool, field) => ({
      id: tool.id + ':' + field.key,
      sourceId: tool.id,
      trust: 'server',
      lifetime: 'step',
      role: 'user',
      maxChars: 1000,
      value: { [field.key]: field.value },
    }),
    ...extra,
  });
}
function tool(name, extra = {}) {
  const { lifecycle, ...rest } = extra ?? {};
  return {
    id: name,
    kind: 'read',
    description: name,
    audience: 'model',
    effect: 'read',
    goalIds: ['inspect'],
    parseInput: (value) => value,
    parseOutput: (value) => value,
    execute: (value) => value,
    lifecycle: {
      
      protocol: { keys: () => ['type'] },
      call: (_value, context) => context.observations.push(name),
      ...lifecycle,
    },
    ...rest,
  };
}
const context = () => ({
  observations: ['existing'],
  journal: new ContextJournal(),
  signal: new AbortController().signal,
});
test('inspection runs for every tool in registration order and selected hooks do not fan out', () => {
  const calls = [],
    registry = runtime();
  registry.register(
    tool('one', {
      lifecycle: {
        inspect: () => {
          calls.push('one');
        },
      },
    }),
  );
  registry.register(
    tool('two', {
      lifecycle: {
        
        protocol: { keys: () => ['type'] },
        call() {},
        inspect: () => {
          calls.push('two');
        },
        authorize: () => {
          calls.push('authorize');
        },
        resume: () => true,
        complete: (decision) => decision,
      },
    }),
  );
  const decision = { next: { type: 'two' } },
    input = context();
  registry.assertDecision(decision, input);
  registry.authorize(decision, input);
  // One inspect pass covers every tool, including the selected one; selected hooks follow.
  assert.deepEqual(calls, ['one', 'two', 'authorize']);
  assert.equal(registry.resume(decision, input), true);
  assert.equal(registry.complete(decision, input), decision);
  assert.equal(registry.resume({ next: { type: 'missing' } }, input), false);
});

test('call receipts cover only new observations and aborted calls record a terminal receipt before propagation', () => {
  const registry = runtime();
  registry.register(tool('one'));
  const input = context();
  registry.call({ type: 'one' }, input);
  // A receipt carries only the observations added by this call.
  assert.deepEqual(input.journal.snapshot().at(-1).value, ['one']);
  const aborted = context(),
    controller = new AbortController();
  controller.abort();
  aborted.signal = controller.signal;
  assert.throws(
    () => registry.call({ type: 'one' }, aborted),
    (error) => error.name === 'AbortError',
  );
  assert.equal(aborted.journal.snapshot().at(-1).status, 'cancelled');
  // Aborted calls add no observations and leave the pre-existing one untouched.
  assert.deepEqual(aborted.observations, ['existing']);
});

test('unavailable tools create no receipts; handler errors stop execution and retain their original identity', () => {
  const registry = runtime(),
    failure = new Error('read failed');
  registry.register(tool('denied', { active: () => false }));
  registry.register(
    tool('failed', {
      lifecycle: {
        
        protocol: { keys: () => ['type'] },
        call() {
          throw failure;
        },
      },
    }),
  );
  const input = context();
  assert.throws(() => registry.call({ type: 'denied' }, input));
  // Unavailable tools never begin an invocation, so no receipt is created.
  assert.equal(input.journal.snapshot().length, 0);
  assert.throws(
    () => registry.call({ type: 'failed' }, input),
    (error) => error === failure,
  );
  assert.equal(input.journal.snapshot().at(-1).status, 'error');
});

test('contribution reducers retain nullish fallbacks, falsey accepted values and short-circuit semantics', () => {
  const registry = runtime(),
    calls = [];
  registry.register(
    tool('one', {
      lifecycle: {
        reviewDraft: () => false,
        visibleText: () => '',
        recoveryContext: () => null,
        missingInteractionAllowed: () => {
          calls.push('one');
          return true;
        },
      },
    }),
  );
  registry.register(
    tool('two', {
      lifecycle: {
        reviewDraft: (value) => {
          assert.equal(value, false);
        },
        visibleText: (value) => {
          assert.equal(value, '');
          return null;
        },
        recoveryContext: () => undefined,
        missingInteractionAllowed: () => {
          calls.push('two');
          return false;
        },
      },
    }),
  );
  // Falsy values (false, '', null) are real results; only undefined falls through.
  assert.equal(registry.reviewDraft({}, context()), false);
  assert.equal(registry.visibleText('original', context()), '');
  assert.deepEqual(registry.recoveryContext(context()), [null]);
  assert.equal(registry.missingInteractionAllowed({}, context()), true);
  assert.deepEqual(calls, ['one']);
});

test('intent support contributions retain private receivers and stop at the first explicit rejection', () => {
  const registry = runtime(),
    calls = [];
  class Contribution {
    #blocked = 'blocked';
    supportsGoal(intentId, input) {
      assert.equal(input.observations[0], 'existing');
      calls.push(intentId);
      if (intentId === this.#blocked) return false;
    }
  }
  registry.register({ ...tool('one'), lifecycle: new Contribution() });
  registry.register(
    tool('two', {
      lifecycle: {
        supportsGoal(intentId) {
          calls.push(`two:${intentId}`);
          return true;
        },
      },
    }),
  );
  assert.equal(registry.supportsGoal('inspect', context()), true);
  assert.deepEqual(calls, ['inspect', 'two:inspect']);
  calls.length = 0;
  assert.equal(registry.supportsGoal('blocked', context()), false);
  assert.deepEqual(calls, ['blocked']);
});

test('model projection filters visibility while context/rule contributions retain their declared order', () => {
  const registry = runtime();
  registry.register(
    tool('one', {
      lifecycle: {
        rules: () => [{ order: 2, text: 'later' }],
        modelFields: () => [{ placement: 'environment', order: 2, key: 'shared', value: 2 }],
      },
    }),
  );
  registry.register(
    tool('two', {
      audience: 'runtime',
      active: () => false,
      lifecycle: {
        rules: () => [{ order: 1, text: 'first' }],
        modelFields: () => [{ placement: 'environment', order: 1, key: 'shared', value: 1 }],
      },
    }),
  );
  assert.deepEqual([...registry.modelProtocols(context()).keys()], ['deliver', 'one']);
  assert.deepEqual([...registry.protocols().keys()], ['deliver', 'one', 'two']);
  assert.equal(registry.taskRules(context()), 'first\n\nlater');
  // Later registrations win the same key, so one's value 2 overrides two's value 1.
  assert.deepEqual(registry.modelFields(context(), 'environment'), { shared: 2 });
});

test('model field merging keeps dangerous keys inert instead of replacing the result prototype', () => {
  // A fragment value parsed from untrusted JSON may carry an own __proto__ key.
  const registry = runtime(
    {},
    {
      contextFragment: (tool, field) => ({
        id: tool.id + ':' + field.key,
        sourceId: tool.id,
        trust: 'server',
        lifetime: 'step',
        role: 'user',
        maxChars: 1000,
        value: JSON.parse(
          '{"__proto__":{"injected":true},"' +
            field.key +
            '":' +
            JSON.stringify(field.value) +
            '}',
        ),
      }),
    },
  );
  registry.register(
    tool('one', {
      lifecycle: {
        modelFields: () => [{ placement: 'environment', order: 1, key: 'safe', value: 'ok' }],
      },
    }),
  );
  const merged = registry.modelFields(context(), 'environment');
  assert.equal(Object.getPrototypeOf(merged), Object.prototype);
  assert.equal(merged.safe, 'ok');
  assert.equal(merged.injected, undefined);
  assert.deepEqual(Object.keys(merged).sort(), ['__proto__', 'safe']);
});

test('normalizer and finalizer keep the application receiver after copying; copies have independent state and sealing', () => {
  const owner = { id: 'original' },
    targetOwner = { id: 'fork' };
  const original = runtime(owner),
    copy = runtime(targetOwner);
  original.register(tool('one'));
  original.registerNormalizer(function (value, suffix) {
    return `${this.id}:${value}:${suffix}`;
  });
  original.registerFinalizer(function (owner, decision) {
    assert.equal(this, owner);
    return `${owner.id}:${decision.text}`;
  });
  original.seal();
  original.copyTo(copy);
  assert.equal(original.normalize('value', 'tail'), 'original:value:tail');
  assert.equal(copy.normalize('value', 'tail'), 'fork:value:tail');
  assert.equal(copy.finish(targetOwner, { text: 'done' }, context()), 'fork:done');
  // The copy rebinds `this` to its own receiver rather than the original owner.
  copy.register(tool('two'));
  assert.equal(original.has('two'), false);
  assert.throws(() => original.register(tool('three')), /sealed/);
});

test('agent catalog derives relationships from active registrations and keeps accepted task projections narrow', () => {
  const registry = runtime();
  registry.register(tool('lookup'));
  const catalog = defineAgentCatalog({
    tools: registry,
    goalIds: () => ['inspect'],
    goals: () => [{ id: 'inspect', delegates: ['deliver'] }],
    scopes: () => [{ id: 'docs', toolIds: ['lookup', 'absent'] }],
    currentTask: (input) => input.intent,
  });
  const result = catalog.modelCatalog({ intent: { goalId: 'inspect', scopeId: 'docs' } });
  assert.deepEqual(result.availableGoals[0].delegates, ['deliver']);
  assert.deepEqual(result.availableGoals[0].scopeIds, ['docs']);
  assert.deepEqual(result.availableScopes[0].toolIds, ['lookup']);
});

test('registration installers preserve conditional order and stop at the original failure', () => {
  const state = { ready: false, calls: [] },
    failure = new Error('installation');
  const installer = defineRegistrationCatalog([
    {
      id: 'first',
      register: (value) => {
        value.ready = true;
        value.calls.push('first');
      },
    },
    {
      id: 'conditional',
      when: (value) => value.ready,
      register: (value) => value.calls.push('conditional'),
    },
    {
      id: 'failed',
      register() {
        throw failure;
      },
    },
    { id: 'later', register: (value) => value.calls.push('later') },
  ]);
  assert.throws(
    () => installer.install(state),
    (error) => error === failure,
  );
  // Installation stops at the first thrown error; later delegates never run.
  assert.deepEqual(state.calls, ['first', 'conditional']);
});

test('composition ownership rejects multiple providers while preserving falsey decline behavior', () => {
  const registry = runtime();
  registry.register(tool('decline', { lifecycle: { composition: () => false } }));
  registry.register(tool('one', { lifecycle: { composition: () => ({ stage: 'body' }) } }));
  assert.deepEqual(registry.composition(context()), { stage: 'body' });
  registry.register(tool('two', { lifecycle: { composition: () => ({ stage: 'other' }) } }));
  // Two composition providers are ambiguous and must be rejected.
  assert.throws(() => registry.composition(context()), /More than one/);
});

test('diagnostic injection remains instance-local even when runtimes share configuration', () => {
  const events = [],
    execution = {};
  const one = runtime({}, { execution }),
    two = runtime({}, { execution });
  one.register(tool('one'));
  two.register(tool('one'));
  one.setDiagnostics({
    child() {
      return this;
    },
    emit: (name) => events.push(name),
  });
  two.invoke({ toolId: 'one', input: {} });
  // Each runtime keeps its own diagnostics even when both share one execution config object.
  assert.deepEqual(events, []);
  one.invoke({ toolId: 'one', input: {} });
  assert.deepEqual(events, ['tool.call', 'tool.result']);
});

test('registration compiles one ordered catalog and rejects invalid predicates before installation', () => {
  const first = {
    id: 'first',
    register(context) {
      context.push('first');
    },
  };
  const next = {
    id: 'next',
    when(context) {
      return context.includes('first');
    },
    register(context) {
      context.push('next');
    },
  };
  const catalog = defineRegistrationCatalog([first, next]);
  const context = [];
  catalog.install(context);
  // Predicates are validated while compiling the catalog, not when installation runs.
  assert.deepEqual(context, catalog.ids());
  assert.throws(
    () => defineRegistrationCatalog([first, { ...next, when: true }]),
    /Invalid registration predicate/,
  );
  assert.throws(() => defineRegistrationCatalog([first, first]), /duplicate catalog id/);
});

// Locks ToolLifecycleRegistry option binding: canonical option methods, registration policy lists
// and error factories are pinned at construction, while live services keep supplying fresh data.
// Covers `ToolLifecycleRegistry`, `createDiagnostics`, `GoalRegistry` and `ScopeRegistry`;
// `node --test` against dist/esm.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiagnostics } from '../dist/esm/index.js';
import { ToolLifecycleRegistry } from '../dist/esm/kits/tools.js';

// Mostly-private option object so the tests can detect receiver rebinding.
class Options {
  #controller;
  #receipts = [];
  #events = [];
  #diagnostics = createDiagnostics({
    output: {
      write: (event) => {
        this.#events.push(event);
      },
    },
  });
  constructor(controller) {
    this.#controller = controller;
  }
  get receipts() {
    return this.#receipts;
  }
  get events() {
    return this.#events;
  }
  get registration() {
    return {
      kinds: ['read'],
      audiences: ['model'],
      effects: ['read'],
      isValidId: (tool) => tool.id === 'read',
      goalExists: (id) => id === 'inspect',
    };
  }
  goalIds() {
    return ['inspect'];
  }
  toolId(decision) {
    return decision.next.type;
  }
  outputs() {
    return [];
  }
  contextFragment() {
    throw new Error('No context fields are registered');
  }
  diagnostics() {
    return this.#diagnostics;
  }
  signal() {
    return this.#controller.signal;
  }
  journal() {
    return {
      beginTool(request) {
        assert.equal(request.toolId, 'read');
        return 'receipt';
      },
      finishTool: (receipt) => {
        this.#receipts.push(receipt);
      },
    };
  }
  checkpoint(context) {
    assert.equal(this.#controller.signal.aborted, false);
    return context.observations.length;
  }
  receipt(context, offset) {
    assert.equal(this.#controller.signal.aborted, false);
    return context.observations.slice(offset);
  }
  receiptError(error) {
    assert.equal(this.#controller.signal.reason, error);
    return error;
  }
}

test('lifecycle invocation ports pin prototype implementations and retain private cancellation, journal and observation state', () => {
  // Same fixture exercised for a clean call and for one cancelled inside the handler.
  for (const mode of ['success', 'cancelled']) {
    const controller = new AbortController(),
      options = new Options(controller);
    const registry = new ToolLifecycleRegistry(options);
    options.signal = options.journal = () => {
      throw new Error('Replaced ports must not change the bound invocation');
    };
    const reason = new Error('stopped');
    registry.register({
      id: 'read',
      kind: 'read',
      description: 'Read',
      audience: 'model',
      effect: 'read',
      goalIds: ['inspect'],
      parseInput: (value) => value,
      parseOutput: (value) => value,
      execute: (value) => value,
      lifecycle: {
        
        protocol: { keys: () => ['type'] },
        call(_value, context, execution) {
          assert.equal(execution.signal, controller.signal);
          context.observations.push('new');
          if (mode === 'cancelled') controller.abort(reason);
        },
      },
    });
    const context = { observations: ['existing'] };
    if (mode === 'cancelled')
      assert.throws(
        () => registry.call({ type: 'read' }, context),
        (error) => error === reason,
      );
    else registry.call({ type: 'read' }, context);
    assert.deepEqual(options.receipts, [
      {
        invocationId: 'receipt',
        // A cancelled call still writes a terminal receipt carrying the abort reason.
        status: mode === 'success' ? 'success' : 'cancelled',
        value: mode === 'success' ? ['new'] : reason,
      },
    ]);
    assert.deepEqual(
      options.events.map((event) => event.type),
      ['tool.call', 'tool.result'],
    );
  }
});

test('lifecycle options pin all canonical methods and registration lists while original services stay live', () => {
  const controller = new AbortController(),
    service = {
      allow: true,
      owner: { id: 'first' },
      goalIds: ['inspect'],
      publicOutput: 'public',
      modelOutput: 'model',
      value: 'first',
      errorCode: 'FIRST',
      invalid: new Error('invalid policy'),
      invalidInvocation: new Error('invalid invocation'),
      unavailable: new Error('unavailable tool'),
      unavailableInvocation: new Error('unavailable invocation'),
      forbidden: new Error('forbidden'),
      failure: new Error('tool failure'),
    };
  class Policy {
    kinds = ['read'];
    audiences = ['model'];
    effects = ['read'];
    tags = ['policy'];
    protocolVersion = 1;
    #service;
    constructor(value) {
      this.#service = value;
    }
    isValidId(tool) {
      return this.#service.allow && !!tool.id;
    }
    goalExists(id) {
      return this.#service.goalIds.includes(id);
    }
    invalidTool() {
      return this.#service.invalid;
    }
    invalidInvocation() {
      return this.#service.invalidInvocation;
    }
  }
  class Errors {
    #service;
    constructor(value) {
      this.#service = value;
    }
    unavailable() {
      return this.#service.unavailable;
    }
    errorCode() {
      return this.#service.errorCode;
    }
  }
  const policy = new Policy(service),
    errors = new Errors(service),
    suppliedExecution = { signal: controller.signal };
  class CompleteOptions extends Options {
    #service;
    constructor() {
      super(controller);
      this.#service = service;
    }
    get registration() {
      return policy;
    }
    get errors() {
      return errors;
    }
    get execution() {
      return suppliedExecution;
    }
    receiver() {
      return this.#service.owner;
    }
    goalIds() {
      return this.#service.goalIds;
    }
    toolId(decision) {
      assert.equal(this.#service.allow, true);
      return decision.next.type;
    }
    outputs() {
      return [[this.#service.publicOutput, { terminal: true, keys: () => ['type'] }]];
    }
    modelOutputs() {
      return [[this.#service.modelOutput, { keys: () => ['type'] }]];
    }
    unavailableInvocation() {
      return this.#service.unavailableInvocation;
    }
    forbidden() {
      return this.#service.forbidden;
    }
    contextFragment(tool, field) {
      return {
        id: tool.id + ':' + field.key,
        sourceId: tool.id,
        trust: 'server',
        lifetime: 'step',
        role: 'user',
        maxChars: 100,
        value: { [field.key]: this.#service.value },
      };
    }
  }
  const options = new CompleteOptions(),
    registry = new ToolLifecycleRegistry(options);
  const replaced = () =>
    assert.fail('source method replacement must not change the bound contract');
  // Every pinned method is replaced after construction; the registry must ignore the replacements.
  for (const key of [
    'receiver',
    'goalIds',
    'invocationId',
    'outputs',
    'modelOutputs',
    'unavailableInvocation',
    'forbidden',
    'contextFragment',
    'diagnostics',
    'signal',
    'journal',
    'checkpoint',
    'receipt',
    'receiptError',
  ])
    options[key] = replaced;
  for (const key of ['isValidId', 'goalExists', 'invalidTool', 'invalidInvocation'])
    policy[key] = replaced;
  errors.unavailable = errors.errorCode = replaced;
  for (const key of ['kinds', 'audiences', 'effects', 'tags']) policy[key].splice(0, 1, 'replaced');
  policy.protocolVersion = 999;
  suppliedExecution.signal = AbortSignal.abort(new Error('replaced execution'));
  for (const key of ['registration', 'errors', 'execution'])
    Object.defineProperty(options, key, { value: {}, configurable: true });
  const tool = {
    id: 'read',
    kind: 'read',
    description: 'Read',
    audience: 'model',
    effect: 'read',
    goalIds: ['inspect'],
    parseInput: (value) => value,
    parseOutput: (value) => value,
    execute: (value) => value,
    lifecycle: {
      
      protocol: { version: 1, keys: () => ['type'] },
      call(_value, context) {
        context.observations.push('new');
      },
      authorize(_decision, context) {
        context.authorized = true;
      },
      modelFields: () => [{ placement: 'environment', order: 1, key: 'state', value: null }],
    },
  };
  registry.register(tool);
  assert.equal(registry.invoke({ toolId: 'read', input: 'value' }).value, 'value');
  const context = { observations: [], authorized: false };
  registry.call({ type: 'read' }, context);
  assert.deepEqual(options.receipts[0].value, ['new']);
  registry.authorize({ next: { type: 'read' } }, context);
  assert.equal(context.authorized, true);
  registry.registerNormalizer(function (value) {
    return this.id + ':' + value;
  });
  service.owner = { id: 'second' };
  service.publicOutput = 'public-next';
  service.modelOutput = 'model-next';
  service.value = 'second';
  assert.equal(registry.normalize('input'), 'second:input');
  assert.deepEqual([...registry.protocols().keys()], ['public-next', 'read']);
  assert.deepEqual([...registry.modelProtocols(context).keys()], ['model-next', 'read']);
  assert.equal(registry.isTerminal({ type: 'public-next' }), true);
  assert.equal(registry.contextFields(context, 'environment')[0].value.state, 'second');
  // Pinning copies method references; it does not freeze the caller's objects.
  assert.equal(Object.isFrozen(options), false);
  assert.equal(Object.isFrozen(policy), false);
  assert.equal(Object.isFrozen(service), false);
  assert.throws(
    () => registry.call({ type: 'absent' }, context),
    (error) => error === service.unavailableInvocation,
  );
  assert.throws(
    () => registry.invoke({ toolId: 'absent', input: null }),
    (error) => error === service.unavailable,
  );
  service.allow = false;
  assert.throws(
    () => registry.register({ ...tool, id: 'blocked' }),
    (error) => error === service.invalid,
  );
  service.allow = true;
  assert.throws(
    () =>
      registry.register({
        ...tool,
        id: 'bad-invocation',
        lifecycle: {
          ...tool.lifecycle,
          
          protocol: { version: 999, keys: () => [] },
        },
      }),
    (error) => error === service.invalidInvocation,
  );
  registry.register({
    ...tool,
    id: 'denied',
    active: () => false,
    lifecycle: { ...tool.lifecycle },
  });
  assert.throws(
    () => registry.call({ type: 'denied' }, context),
    (error) => error === service.forbidden,
  );
  registry.register({
    ...tool,
    id: 'failure',
    lifecycle: undefined,
    execute() {
      throw service.failure;
    },
  });
  service.errorCode = 'SECOND';
  assert.throws(
    () => registry.invoke({ toolId: 'failure', input: null }),
    (error) => error === service.failure,
  );
  assert.equal(registry.events.at(-1).errorCode, 'SECOND');
  registry.register({
    ...tool,
    id: 'all',
    goalIds: 'all',
    lifecycle: undefined,
  });
  service.goalIds = ['later'];
  assert.deepEqual(registry.describe('model').find((item) => item.id === 'all').goalIds, [
    'later',
  ]);
  const reason = new Error('original cancellation');
  controller.abort(reason);
  assert.throws(
    () => registry.invoke({ toolId: 'read', input: null }),
    (error) => error === reason,
  );
});

test('intent and scope canonical policy lists are detached from source mutation', async () => {
  const { GoalRegistry, ScopeRegistry } = await import('@jangts/agent-core/kits/domains');
  const { configureBreakWhile } = await import('@jangts/agent-core');
  const policy = {
    scopeModes: ['required'],
    targetModes: ['forbidden'],
    contextTiers: ['small'],
    actions: ['inspect'],
    delegates: ['read'],
    handoffValues: ['bound'],
    tags: ['intent-policy'],
  };
  const intents = new GoalRegistry(policy),
    scopePolicy = { categories: ['documents'], tags: ['scope-policy'] },
    scopes = new ScopeRegistry(scopePolicy);
  for (const value of Object.values(policy)) value.splice(0, 1, 'replaced');
  scopePolicy.categories.splice(0, 1, 'replaced');
  scopePolicy.tags.splice(0, 1, 'replaced');
  intents.register({
    id: 'inspect',
    description: 'Inspect',
    scopePolicy: 'required',
    targetPolicy: 'forbidden',
    contextTier: 'small',
    planIntent: 'inspect',
    auxiliaryActions: ['inspect'],
    preparedHandoff: 'bound',
    delegates: ['read'],
  });
  scopes.register({ id: 'documents', description: 'Documents', category: 'documents' });
  const events = [];
  // Capture rejection metadata to show policy tags survive list detaching.
  configureBreakWhile({ onBreak: (event) => events.push(event) });
  try {
    assert.throws(
      () => intents.register({ id: '', description: 'Invalid', delegates: ['read'] }),
      /Invalid goal Tool/,
    );
    assert.deepEqual(events.at(-1).tags, ['intent-policy', 'identity']);
    assert.throws(
      () => scopes.register({ id: 'other', description: 'Other', category: 'replaced' }),
      /Invalid scope/,
    );
    assert.deepEqual(events.at(-1).tags, ['scope-policy', 'identity']);
  } finally {
    configureBreakWhile();
  }
});

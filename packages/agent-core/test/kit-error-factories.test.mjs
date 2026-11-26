// Locks Kit registry error factories: private receivers and construction-time method references must
// survive later mutation of the error provider objects.
// Covers `GoalRegistry`, `ScopeRegistry` and `ToolLifecycleRegistry` kits; `node --test`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GoalRegistry, ScopeRegistry } from '@jangts/agent-core/kits/domains';
import { ToolLifecycleRegistry } from '@jangts/agent-core/kits/tools';

// Private state makes accidental receiver rebinding observable through identity checks.
class RegistryErrors {
  #values = {
    invalid: new Error('class invalid'),
    sealed: new Error('class sealed'),
    duplicate: new Error('class duplicate'),
  };
  invalid() {
    return this.#values.invalid;
  }
  sealed() {
    return this.#values.sealed;
  }
  duplicate() {
    return this.#values.duplicate;
  }
  failure(kind) {
    return this.#values[kind];
  }
}

test('intent error factories preserve private receivers and construction-time method references', () => {
  const errors = new RegistryErrors(),
    registry = new GoalRegistry({ errors });
  // Overwriting the instance methods must not affect the factories captured at construction.
  errors.invalid =
    errors.sealed =
    errors.duplicate =
      () => assert.fail('factories must have been bound during construction');
  assert.throws(
    () => registry.register({ id: '', description: 'invalid', delegates: ['read'] }),
    (error) => error === errors.failure('invalid'),
  );
  const definition = { id: 'inspect', description: 'inspect', delegates: ['read'] };
  registry.register(definition);
  assert.throws(
    () => registry.register(definition),
    (error) => error === errors.failure('duplicate'),
  );
  registry.seal();
  assert.throws(
    () => registry.register({ ...definition, id: 'another' }),
    (error) => error === errors.failure('sealed'),
  );
});

test('scope error factories preserve private receivers for validation, duplicate and sealed rejection', () => {
  const errors = new RegistryErrors(),
    registry = new ScopeRegistry({ errors });
  errors.invalid = errors.sealed = () =>
    assert.fail('factories must have been bound during construction');
  assert.throws(
    () => registry.register({ id: '', description: 'invalid', category: 'documents' }),
    (error) => error === errors.failure('invalid'),
  );
  const definition = { id: 'documents', description: 'documents', category: 'documents' };
  registry.register(definition);
  // A duplicate scope registration resolves through the invalid factory, unlike intents.
  assert.throws(
    () => registry.register(definition),
    (error) => error === errors.failure('invalid'),
  );
  registry.seal();
  assert.throws(
    () => registry.register({ ...definition, id: 'another' }),
    (error) => error === errors.failure('sealed'),
  );
});

test('tool registration rejection factories retain their policy receiver', () => {
  class Policy {
    kinds = ['read'];
    audiences = ['model'];
    effects = ['read'];
    #invalid = new Error('class invalid tool');
    #invocation = new Error('class invalid invocation');
    #intent = 'inspect';
    isValidId(tool) {
      return tool.id.endsWith('.read');
    }
    goalExists(id) {
      return id === this.#intent;
    }
    invalidTool() {
      return this.#invalid;
    }
    invalidInvocation() {
      return this.#invocation;
    }
    get failures() {
      return { invalid: this.#invalid, lifecycle: this.#invocation };
    }
  }
  const policy = new Policy(),
    registry = new ToolLifecycleRegistry({
      registration: policy,
      goalIds: () => ['inspect'],
      outputs: () => [],
      
      contextFragment() {
        assert.fail('registration errors do not request model context');
      },
    });
  const tool = {
    id: 'inspect.read',
    kind: 'read',
    description: 'inspect',
    audience: 'model',
    effect: 'read',
    goalIds: ['inspect'],
    parseInput: (value) => value,
    parseOutput: (value) => value,
    execute: (value) => value,
  };
  // Registration checks run in policy order: id shape first, then the invocation contract.
  assert.throws(
    () => registry.register({ ...tool, id: 'invalid' }),
    (error) => error === policy.failures.invalid,
  );
  assert.throws(
    () =>
      registry.register({
        ...tool,
        lifecycle: { protocol: { keys: () => [] } },
      }),
    (error) => error === policy.failures.lifecycle,
  );
  registry.register(tool);
  assert.equal(registry.has(tool.id), true);
});

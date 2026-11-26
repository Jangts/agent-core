/**
 * Locks down runtime registry projections: own and inherited getters are read once at
 * registration, only canonical bound handlers are exposed, and every query view returns
 * the same frozen snapshot that ignores later source mutation. Covers `ToolRegistry`,
 * `GoalRegistry`, `ScopeRegistry` and `ToolLifecycleRegistry`. Runs under node --test
 * against local classes with private state.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ToolRegistry } from '../dist/esm/capabilities/tools.js';
import { AgentCoreEngine } from '../dist/esm/index.js';
import { GoalRegistry, ScopeRegistry } from '../dist/esm/kits/domains/index.js';
import { ToolLifecycleRegistry } from '../dist/esm/kits/tools.js';

test('Core tool queries snapshot own and inherited metadata while exposing only canonical bound handlers', async () => {
  const marker = Symbol('application metadata');
  let metadataReads = 0;
  class Metadata {
    #label = 'original';
    get label() {
      metadataReads++;
      return this.#label;
    }
    setLabel(value) {
      this.#label = value;
    }
  }
  class Tool extends Metadata {
    #factor = 2;
    get id() {
      return 'double';
    }
    get kind() {
      return 'pure';
    }
    get [marker]() {
      return 'symbol metadata';
    }
    helper(value) {
      return value * this.#factor;
    }
    parseInput(value) {
      return value;
    }
    parseOutput(value) {
      return value;
    }
    execute(value) {
      return this.helper(value);
    }
    debugSteps(value, context) {
      const log = context.createSubFlowLogger();
      log.write({ name: 'Result', kind: 'pure', payload: { value: this.helper(value) } });
      return log;
    }
  }
  const source = new Tool(),
    registry = new ToolRegistry().register(source);
  source.setLabel('changed');
  source.execute =
    source.parseInput =
    source.parseOutput =
      () => {
        throw new Error('replacement');
      };
  const registered = registry.require('double');
  assert.equal(registered.label, 'original');
  assert.equal(registered[marker], 'symbol metadata');
  // The inherited getter is evaluated exactly once, when registration snapshots it.
  assert.equal(metadataReads, 1);
  // Implementation helpers are not part of the projected tool contract.
  assert.equal(registered.helper, undefined);
  assert.equal(registered.setLabel, undefined);
  assert.equal(registry.invoke({ toolId: 'double', input: 3 }).value, 6);
  await new AgentCoreEngine({ execution: { observe: { accepts: () => true, event() {} } } }).run(
    (_, context) => {
      assert.deepEqual(registered.debugSteps(3, context).readAll()[0].payload, { value: 6 });
      return { type: 'complete', value: undefined };
    },
  );
  assert.equal(registry.definitions[0], registered);
  assert.equal([...registry.values()][0], registered);
  assert.equal([...registry.entries()][0][1], registered);
  // Every accessor hands back the same frozen projection, so no caller can diverge.
  assert.ok(Object.isFrozen(registered));
});

test('domain Tool and scope queries retain App getter metadata and exact data projections without instance helpers', () => {
  class DomainTool {
    #allowed = 'inspect';
    get id() {
      return 'inspect';
    }
    get description() {
      return 'Inspect';
    }
    get delegates() {
      return ['read'];
    }
    get displayName() {
      return 'Inspection';
    }
    allowed() {
      return this.#allowed;
    }
  }
  class Evidence {
    #id = 'city';
    get kind() {
      return 'knowledge';
    }
    get id() {
      return this.#id;
    }
    get label() {
      return 'City evidence';
    }
    helper() {
      return this.#id;
    }
  }
  class Scope {
    #link = true;
    id = 'city';
    description = 'City';
    category = 'place';
    aliases = ['home'];
    goalIds = ['inspect'];
    toolIds = ['read'];
    evidence = [new Evidence()];
    get extensionLink() {
      return this.#link;
    }
    helper() {
      return this.#link;
    }
    change() {
      this.#link = false;
    }
  }
  const domainTool = new DomainTool(),
    scope = new Scope();
  class DomainToolPolicy {
    get delegates() {
      return ['read'];
    }
    assertDefinition(value) {
      assert.equal(value, domainTool);
      assert.equal(value.allowed(), 'inspect');
    }
  }
  class ScopePolicy {
    get categories() {
      return ['place'];
    }
    assertDefinition(value) {
      assert.equal(value, scope);
      assert.equal(value.helper(), true);
    }
    acceptsGoal(value, id) {
      assert.equal(value, scope);
      return value.helper() && id === 'inspect';
    }
  }
  const domainTools = GoalRegistry.create([domainTool], new DomainToolPolicy());
  const scopes = ScopeRegistry.create([scope], new ScopePolicy());
  assert.throws(
    () =>
      new GoalRegistry(new DomainToolPolicy()).register({
        id: 'inspect',
        description: 'Inspect',
        delegates: ['forbidden'],
      }),
    /Invalid goal Tool definition/,
  );
  assert.throws(
    () => new ScopeRegistry(new ScopePolicy()).register({ ...scope, category: 'forbidden' }),
    /Invalid scope definition/,
  );
  assert.equal(scopes.acceptsGoal('home', 'inspect'), true);
  scope.change();
  scope.toolIds.push('forged');
  // Post-registration mutation of the source (private flag and public array) must not
  // reach either the lookup view or the description view.
  const registered = scopes.require('home'),
    projected = scopes.describe()[0];
  assert.equal(registered.extensionLink, true);
  assert.equal(projected.extensionLink, true);
  assert.deepEqual(registered.toolIds, ['read']);
  assert.equal(registered.helper, undefined);
  assert.equal(projected.helper, undefined);
  assert.equal(registered.evidence[0].kind, 'knowledge');
  assert.equal(registered.evidence[0].id, 'city');
  assert.equal(registered.evidence[0].label, 'City evidence');
  assert.equal(registered.evidence[0].helper, undefined);
  assert.ok(Object.isFrozen(registered.evidence[0]));
  projected.toolIds.push('external');
  assert.deepEqual(registered.toolIds, ['read']);
  assert.equal(domainTools.require('inspect').displayName, 'Inspection');
  assert.equal(domainTools.get('inspect').allowed, undefined);
  assert.equal(domainTools.describe()[0].allowed, undefined);
  assert.deepEqual(domainTools.describe()[0].delegates, ['read']);
});

function lifecycleOptions() {
  return {
    registration: {
      kinds: ['read'],
      audiences: ['model'],
      effects: ['read'],
      goalExists: () => true,
      isValidId(value) {
        return value.identity() === 'read';
      },
    },
    goalIds: () => ['inspect'],
    
    outputs: () => [],
    contextFragment(tool, field) {
      assert.equal(tool.identity(), 'read');
      return {
        id: tool.id + ':' + field.key,
        sourceId: tool.id,
        trust: 'server',
        lifetime: 'step',
        role: 'user',
        value: { [field.key]: field.value },
      };
    },
  };
}

test('lifecycle queries compile nested metadata and preserve canonical private receivers through copying', () => {
  const calls = [],
    protocol = { keys: () => ['type'], assert() {}, metadata: 'protocol' };
  class Lifecycle {
    #prefix = 'lifecycle';
    get protocol() {
      return protocol;
    }
    get label() {
      return this.#prefix;
    }
    helper() {
      return this.#prefix;
    }
    call() {
      calls.push(this.helper());
    }
    authorize() {
      calls.push(this.helper() + ':authorize');
    }
    rules() {
      return [{ order: 1, text: this.helper() }];
    }
    supportsGoal(id) {
      return id === 'inspect';
    }
    modelFields() {
      return [{ placement: 'catalog', order: 1, key: 'extra', value: this.helper() }];
    }
  }
  class Tool {
    #active= true;
    id = 'read';
    kind = 'read';
    description = 'Read';
    audience = 'model';
    effect = 'read';
    goalIds = ['inspect'];
    lifecycle = new Lifecycle();
    get feature() {
      return 'Application metadata';
    }
    identity() {
      return this.id;
    }
    active() {
      return this.#active;
    }
    parseInput(value) {
      return value;
    }
    parseOutput(value) {
      return value;
    }
    execute(value) {
      return value;
    }
  }
  const source = new Tool(),
    registry = new ToolLifecycleRegistry(lifecycleOptions()).register(source);
  source.lifecycle.call =
    source.lifecycle.authorize =
    source.lifecycle.rules =
    source.active=
      () => {
        throw new Error('replacement');
      };
  const copy = new ToolLifecycleRegistry(lifecycleOptions());
  registry.copyTo(copy);
  for (const current of [registry, copy]) {
    const registered = current.require('read');
    assert.equal(registered.identity, undefined);
    assert.equal(registered.feature, 'Application metadata');
    assert.equal(registered.lifecycle.label, 'lifecycle');
    assert.equal(registered.lifecycle.helper, undefined);
    assert.equal(registered.lifecycle.protocol, protocol);
    assert.equal(current.protocols().require('read'), protocol);
    assert.equal(current.supportsGoal('inspect', {}), true);
    assert.equal(current.supportsGoal('blocked', {}), false);
    assert.equal(current.taskRules({}), 'lifecycle');
    assert.deepEqual(current.modelFields({}, 'catalog'), { extra: 'lifecycle' });
    assert.equal(current.describe('model', {}).length, 1);
    current.authorize({ next: { type: 'read' } }, {});
    current.call({ type: 'read' }, {});
    assert.equal(current.invoke({ toolId: 'read', input: 4 }).value, 4);
  }
  assert.deepEqual(calls, [
    'lifecycle:authorize',
    'lifecycle',
    'lifecycle:authorize',
    'lifecycle',
  ]);
  // Two registries, two identical call sequences: copying preserves the canonical private
  // receivers rather than rebinding handlers to the source instance.
});

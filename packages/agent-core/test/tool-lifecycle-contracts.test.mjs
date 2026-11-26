/*
 * Contracts for the App-side tool lifecycle catalog (ToolLifecycleRegistry).
 *
 * The registry is the Kit entry point an App uses to declare its tools and the optional
 * contributions they add to the run. The suite pins the catalog's read-only surface, the
 * folding order of the contribution hooks, the single-handler rules for the normalizer
 * and the finalizer, and the registration-time rejections.
 *
 * Main exports: none. The file only registers `node:test` cases.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ToolLifecycleRegistry } from '../dist/esm/kits/tools.js';

/**
 * Build the registry options shared by the cases.
 *
 * @returns Options describing the registration policy and the protocol providers.
 */
const options = () => ({
  registration: {
    kinds: ['read'],
    // Ids must end with the kind, so the invalid tool id `bad` is rejected.
    isValidId: (t) => t.id.endsWith('.read'),
    audiences: ['model', 'runtime'],
    effects: ['read'],
    goalExists: () => true,
  },
  
  outputs: () => [],
  goalIds: () => ['read'],
  contextFragment: (_tool, field) => ({ value: { [field.key]: field.value } }),
});
/**
 * Build a valid tool definition.
 *
 * @param id - Tool id; must satisfy the registration policy.
 * @param extra - Fields that override the defaults.
 * @returns A tool definition.
 */
const tool = (id = 'a.read', extra = {}) => ({
  id,
  kind: 'read',
  description: id,
  audience: 'model',
  effect: 'read',
  goalIds: ['read'],
  parseInput: (v) => v,
  parseOutput: (v) => v,
  execute: (v) => v,
  ...extra,
});
test('lifecycle catalogs expose their immutable registry and run optional contributions consistently', () => {
  const registry = new ToolLifecycleRegistry(options());
  const calls = [];
  registry.registerAll([
    tool('a.read', {
      debugSteps: () => [{ name: 'read', kind: 'read' }],
      active: () => true,
      lifecycle: {
        projectContext: (value) => ({ ...value, a: 1 }),
        finalize() {
          calls.push('done');
        },
        missingInteractionAllowed: () => false,
        rules: () => [],
        modelFields: () => [],
      },
    }),
    tool('b.read', {
      audience: 'runtime',
      lifecycle: {  protocol: { keys: () => ['type'] }, call() {} },
    }),
  ]);
  assert.equal(registry.definitions.length, 2);
  // Ids keep their registration order.
  assert.deepEqual(registry.ids(), ['a.read', 'b.read']);
  assert.equal([...registry.entries()].length, 2);
  assert.equal(registry.get('missing'), undefined);
  assert.equal(registry.get('a.read').id, 'a.read');
  // The context projection folds over every registered contribution.
  assert.deepEqual(registry.projectContext({ b: 2 }), { b: 2, a: 1 });
  registry.finalize({}, {}, 'done');
  assert.deepEqual(calls, ['done']);
  assert.equal(registry.missingInteractionAllowed({}, {}), false);
  assert.deepEqual(registry.contextFields({}, 'none'), []);
  assert.equal(registry.taskRules({}), '');
  // Without a normalizer the value passes through unchanged.
  assert.equal(registry.normalize('same'), 'same');
  registry.registerNormalizer((value) => value + '!');
  assert.equal(registry.normalize('same'), 'same!');
  // `b.read` has the `runtime` audience, so its protocol is not exposed to the model.
  assert.deepEqual([...registry.modelProtocols({}).keys()], []);
  assert.throws(() => registry.call({ type: 'missing' }, {}), /not registered/);
  assert.throws(() => registry.register(tool()), /Duplicate/);
  assert.throws(
    () => new ToolLifecycleRegistry({ ...options(), goalIds: undefined }),
    /goalIds/,
  );
  const custom = new ToolLifecycleRegistry({
    ...options(),
    registration: {
      ...options().registration,
      invalidTool: () => Error('invalid tool'),
      invalidInvocation: () => Error('invalid invocation'),
    },
  });
  assert.throws(() => custom.register(tool('bad')), /invalid tool/);
  assert.throws(
    () =>
      custom.register(
        tool('good.read', { lifecycle: { protocol: { keys: () => [] } } }),
      ),
    /invalid invocation/,
  );
});

test('registration rejects sealed and missing-handler declarations before model projection', () => {
  const sealed = new ToolLifecycleRegistry(options());
  sealed.seal();
  assert.throws(() => sealed.register(tool('a.read', { description: ' ' })), /sealed/);

  const invalid = new ToolLifecycleRegistry({
    ...options(),
    registration: { ...options().registration, invalidTool: () => Error('invalid tool') },
  });
  const missing = tool('a.read');
  delete missing.parseInput;
  assert.throws(() => invalid.register(missing), /invalid tool/);
});

test('boolean active tools are described without a context while predicate tools still require one', () => {
  const registry = new ToolLifecycleRegistry(options());
  registry.registerAll([
    tool('true.read', { active: true }),
    tool('false.read', { active: false }),
    tool('predicate.read', { active: () => true }),
  ]);
  assert.deepEqual(
    registry.describe('model').map((item) => item.id),
    ['true.read'],
  );
  assert.deepEqual(
    registry.describe('model', {}).map((item) => item.id),
    ['true.read', 'predicate.read'],
  );
});

test('lifecycle dispatch uses the registered tool id for both decision shapes', () => {
  const calls = [];
  const registry = new ToolLifecycleRegistry({
    ...options(),
    contextFragment: (_tool, field) => ({ value: field.value }),
  });
  const declaration = tool('a.read', {
    asIntent() { assert.equal(this, declaration); return true; },
    resolve(input) { assert.equal(this, declaration); return input.selection; },
    lifecycle: {
      protocol: { keys: () => ['type'] },
      call: next => { calls.push(next.type); },
      resume: () => true,
      modelFields: (_context, placement) => [
        { key: 'discard', order: 0, placement, value: ['not a record'] },
        { key: 'keep', order: 1, placement, value: { retained: true } },
      ],
    },
  });
  registry.register(declaration);
  assert.ok(registry.require('a.read').asIntent({}));
  assert.equal(registry.require('a.read').resolve({ selection: 'ready' }, { stageId: 'test' }), 'ready');
  registry.call({ type: 'a.read' }, {});
  assert.deepEqual(calls, ['a.read']);
  assert.equal(registry.resume({ type: 'a.read' }, {}), true);
  assert.equal(registry.resume({ next: { type: 'a.read' } }, {}), true);
  assert.equal(registry.resume({}, {}), false);
  assert.deepEqual(registry.modelFields({}, 'instruction'), { retained: true });
  assert.throws(() => registry.register(tool('legacy.read', { delegate: 'other' })), /use the tool id/);
  assert.throws(() => registry.register(tool('invalid.read', { parseOutput: undefined })), /Invalid registered tool/);
});

test('tools require matching domain membership declarations', () => {
  const base = options();
  assert.throws(() => new ToolLifecycleRegistry({ ...base, registration: { ...base.registration, goalExists: undefined } }),
    /domainToolExists predicate is required/);
  const registry = new ToolLifecycleRegistry(base);
  assert.throws(() => registry.register(tool('unbound.read', { goalIds: undefined })));
  assert.equal(registry.get('unbound.read'), undefined);
});

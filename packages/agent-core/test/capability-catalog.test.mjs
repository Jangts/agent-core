/*
 * Composition contract for `Support.defineCapabilityCatalog` and the visible
 * `ToolRegistry` identity rules.
 *
 * The catalog is the declarative list the model sees, so it must be validated
 * once at registration (duplicate modules and tools, missing tool references in
 * either the required or optional list), be immutable afterwards, and never
 * invoke a business handler while checking references. The last two cases cover
 * two neighbouring guarantees: concurrent invocations of the same tool keep
 * distinct ids in completion order, and a custom module object keeps its
 * prototype and receiver.
 *
 * Runs on `dist/esm` with in-memory definitions; no provider is involved.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Support, ToolRegistry } from '../dist/esm/index.js';

const tool = (id) => ({ id });
const module = (id, tools = []) => ({ id, description: id, tools });

test('composition checks forward/cross-module references without invoking business handlers', () => {
  const source = [module('methods'), module('files', [tool('file.read')])];
  const catalog = Support.defineCapabilityCatalog(source, {
    toolReferences: (entry) =>
      entry.id === 'methods'
        ? [{ id: 'method', requiredToolIds: ['file.read'], optionalToolIds: ['file.read'] }]
        : [],
  });
  // The catalog snapshots the caller's list: removing a module afterwards must not
  // change what was registered.
  source.pop();
  assert.deepEqual(
    catalog.tools.map((t) => t.id),
    ['file.read'],
  );
  assert.equal(catalog.findToolOwner('file.read').id, 'files');
  assert.equal(catalog.findToolOwner('missing'), undefined);
  assert.ok(Object.isFrozen(catalog.definitions));
  assert.ok(Object.isFrozen(catalog.tools));
  // Freezing is shallow, so pushing into a nested tools array is tolerated but the
  // tool must still not become resolvable.
  catalog.definitions[1].tools.push(tool('unregistered'));
  assert.equal(catalog.findToolOwner('unregistered'), undefined);
  assert.deepEqual(
    catalog.tools.map((tool) => tool.id),
    ['file.read'],
  );
});

test('duplicate modules/tools and missing required/optional references fail before registration', () => {
  assert.throws(() => Support.defineCapabilityCatalog([module('x'), module('x')]));
  assert.throws(() =>
    Support.defineCapabilityCatalog([module('x', [tool('a')]), module('y', [tool('a')])]),
  );
  for (const field of ['requiredToolIds', 'optionalToolIds']) {
    assert.throws(
      () =>
        Support.defineCapabilityCatalog([module('x')], {
          toolReferences: () => [{ id: 'skill', requiredToolIds: [], [field]: ['absent'] }],
        }),
      /skill -> absent/,
    );
  }
  Support.validateToolReferences(
    ['runtime-only'],
    [{ id: 'scope', requiredToolIds: ['runtime-only'] }],
  );
});

test('capability tool identities require id while application name metadata stays separate', () => {
  assert.throws(
    () => Support.defineCapabilityCatalog([module('x', [{ name: 'read' }])]),
    /Invalid or duplicate capability tool/,
  );
  const catalog = Support.defineCapabilityCatalog([
    module('x', [{ id: 'read', name: 'Read a file' }]),
  ]);
  assert.equal(catalog.findToolOwner('read').id, 'x');
  assert.equal(catalog.findToolOwner('Read a file'), undefined);
});

test('overlapping calls retain distinct invocation IDs in reverse completion order', async () => {
  const registry = new ToolRegistry();
  const releases = [];
  registry.register({
    id: 'same',
    kind: 'read',
    parseInput: (value) => value,
    execute: () => new Promise((resolve) => releases.push(resolve)),
    parseOutput: (value) => value,
  });
  const first = registry.invokeAsync({ toolId: 'same', input: 'private input' });
  const second = registry.invokeAsync({ toolId: 'same', input: 'private input' });
  // Finish the second call first: receipts follow completion order, not request
  // order, while the two invocation ids stay distinct.
  releases[1]('second');
  const secondResult = await second;
  assert.equal(secondResult.value, 'second');
  releases[0]('first');
  const firstResult = await first;
  assert.equal(firstResult.value, 'first');
  assert.notEqual(firstResult.invocation.invocationId, secondResult.invocation.invocationId);
  assert.deepEqual(
    registry.events.map((event) => event.invocationId),
    [secondResult.invocation.invocationId, firstResult.invocation.invocationId],
  );
  // Receipts are metadata only: the tool input must not be serialized into them.
  assert.ok(!JSON.stringify(registry.events).includes('private input'));
});

test('capability catalogs preserve a custom module receiver and its prototype', () => {
  class CustomModule {
    id = 'custom';
    description = 'Custom implementation';
    tools = [tool('read')];
    #binding = 'bound';
    bind() {
      return this.#binding;
    }
  }
  const custom = new CustomModule();
  const catalog = Support.defineCapabilityCatalog([custom], {
    toolReferences(module) {
      assert.equal(module.bind(), 'bound');
      return [];
    },
  });
  assert.equal(catalog.require('custom'), custom);
  assert.equal(catalog.findToolOwner('read').bind(), 'bound');
});

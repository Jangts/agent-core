import test from 'node:test';
import assert from 'node:assert/strict';
import { DomainToolRegistry, GoalRegistry } from '../dist/esm/kits/domains/registry.js';
import { ScopeRegistry } from '../dist/esm/kits/domains/scopes.js';
import { ToolLifecycleRegistry } from '../dist/esm/kits/tools.js';
import { defineAgentCatalog } from '../dist/esm/kits/domains/catalog.js';

test('domain aliases retain implementation identity and reject conflicting mode inputs', () => {
  assert.equal(DomainToolRegistry, GoalRegistry);
  class Definition {
    id = 'read'; description = 'Read'; delegates = ['read']; scopeMode = 'required'; planningAction = 'read';
    inputSchema = { jsonSchema: { type: 'object' }, parse: v => v };
    #marker = 'ok'; resolve() { return this.#marker; }
  }
  const source = new Definition();
  const registry = new DomainToolRegistry({ assertDefinition(value) { assert.equal(value, source); } }).register(source);
  assert.equal(registry.require('read').resolve({}, { stageId: 'test' }), 'ok');
  assert.equal(registry.describeDomainTools()[0].scopeMode, 'required');
  assert.equal('scopePolicy' in registry.describeDomainTools()[0], false);
  assert.throws(() => new DomainToolRegistry().register({ ...source, scopeMode: 'required', scopePolicy: 'optional' }), /Conflicting/);
});

test('scope canonical membership shares validation and original-source callback semantics', () => {
  const source = { id: 'docs', description: 'Docs', category: 'read', domainToolIds: ['read'] };
  const scopes = new ScopeRegistry({ requireDomainTools: true, acceptsDomainTool(value, id) { assert.equal(value, source); return id === 'read'; } }).register(source);
  assert.equal(scopes.acceptsDomainTool('docs', 'read'), true);
  assert.deepEqual(scopes.describeDomainScopes()[0].domainToolIds, ['read']);
  assert.throws(() => new ScopeRegistry().register({ ...source, goalIds: ['write'] }), /Conflicting/);
});

test('lifecycle canonical references preserve availability and legacy projections', () => {
  const registry = new ToolLifecycleRegistry({
    registration: { kinds: ['read'], isValidId: () => true, audiences: ['model'], effects: ['read'], domainToolExists: id => id === 'read' },
    domainToolIds: () => ['read'], outputs: () => [], contextFragment: (_tool, field) => ({ value: field.value }),
  });
  registry.register({ id: 'docs', kind: 'read', description: 'Read docs', audience: 'model', effect: 'read', domainToolIds: ['read'], parseInput: v => v, parseOutput: v => v, execute: v => v });
  assert.equal(registry.supportsDomainTool, registry.supportsGoal);
  const catalog = defineAgentCatalog({ tools: registry, goalIds: () => ['read'], goals: () => [{ id: 'read', delegates: ['docs'] }], scopes: () => [], currentTask: () => undefined });
  assert.deepEqual(catalog.modelCatalog({}).availableGoalIds, ['read']);
  assert.deepEqual(registry.describe()[0].goalIds, ['read']);
  assert.deepEqual(registry.describeDomainTools()[0].domainToolIds, ['read']);
  assert.equal('goalIds' in registry.describeDomainTools()[0], false);
  assert.throws(() => registry.register({ id: 'other', kind: 'read', description: 'Other', audience: 'model', effect: 'read', domainToolIds: ['read'], goalIds: ['write'] }), /Conflicting/);
});

test('canonical catalog ports keep model-facing goal protocol and canonical host projections separate', () => {
  const catalog = defineAgentCatalog({
    domainToolIds: () => ['read'], domainTools: () => [{ id: 'read', delegates: ['docs'] }], scopes: () => [], currentTask: () => ({ domainToolId: 'read' }),
    executionTools: { values: () => [{ id: 'docs', domainToolIds: ['read'] }], has: () => true, supportsDomainTool: () => true, describe: () => [{ id: 'docs', kind: 'read', description: 'Docs', audience: 'model', effect: 'read', goalIds: ['read'] }] },
  });
  assert.deepEqual(catalog.domainToolIds({}), ['read']);
  assert.deepEqual(catalog.modelCatalog({}).availableGoalIds, ['read']);
  assert.equal(catalog.domainToolCatalog({})[0].id, 'read');
});

test('answer task aliases preserve the compiled frozen assertion boundary', async () => {
  const { defineAnswerReaderCatalog, defineAnswerTaskCatalog } = await import('../dist/esm/kits/answering/tasks.js');
  const metadata = { source: 'docs' };
  const definition = { id: 'docs', description: 'Docs', readerId: 'read', outputId: 'answer', domainToolIds: ['read'], checkIds: [], metadata, inputSchema: { jsonSchema: { type: 'object' }, parse: v => v } };
  const ports = {
    readers: defineAnswerReaderCatalog([{ id: 'read', read: () => 'evidence' }]),
    outputs: { ids: () => ['answer'] }, checks: { ids: () => [] },
    assertDefinition(task) { assert.equal(this, ports); assert.notEqual(task, definition); assert.equal(Object.isFrozen(task), true); assert.notEqual(task.metadata, metadata); assert.deepEqual(task.domainToolIds, ['read']); },
  };
  const catalog = defineAnswerTaskCatalog([definition], ports);
  metadata.source = 'mutated';
  assert.equal(catalog.require('docs').metadata.source, 'docs');
  assert.deepEqual(catalog.describeDomainTasks()[0].domainToolIds, ['read']);
  assert.equal('goalIds' in catalog.describeDomainTasks()[0], false);
  assert.throws(() => defineAnswerTaskCatalog([{ ...definition, goalIds: ['other'] }], ports), /Conflicting/);
  assert.throws(() => defineAnswerTaskCatalog([{ ...definition, domainToolIds: undefined }], ports));

});

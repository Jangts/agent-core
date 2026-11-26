import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defineToolCatalog } from '../dist/esm/support/tools.js';
import { defineModelTools } from '../dist/esm/support/model/capabilities.js';
import { GoalRegistry } from '../dist/esm/kits/domains/registry.js';
import { defineAssociatedCatalog } from '../dist/esm/support/associations.js';
import { createModelTransport } from '../dist/esm/support/model/transports.js';
import { defineAgentCatalog, goalDelegates } from '../dist/esm/kits/domains/catalog.js';
import { defineSchema } from '../dist/esm/support/schema.js';
import { createToolRegistry } from '../dist/esm/capabilities/tool-runtime.js';
import { ModelToolRegistry } from '../dist/esm/capabilities/model.js';
import { toolActive } from '../dist/esm/capabilities/tool-conditions.js';

const stage = { stageId: 'test' };
class Save {
  #enabled = true;
  id = 'save'; kind = 'write'; description = 'Save';
  parses = 0;
  inputSchema = { jsonSchema: { type: 'object' }, parse: value => { this.parses++; return Number(value.amount); } };
  asIntent = { when() { return this.enabled(); } };
  enabled() { return this.#enabled; }
  disable() { this.#enabled = false; }
  authorize() {}
  execute(value) { return value * 2; }
  parseOutput(value) { return value; }
}

test('executable projections preserve receivers and parse business input once at execution', async () => {
  const declaration = new Save();
  const catalog = defineToolCatalog([declaration]);
  const model = defineModelTools([declaration]);
  assert.equal(model.select({ intent: true }, {}).has('save'), true);
  const view = catalog.select({ intent: true }, {});
  assert.equal(view.require('save').inputSchema, catalog.require('save').inputSchema);
  const proposal = view.tools.resolve({ toolId: 'save', input: { amount: '3' } }, stage);
  assert.equal(declaration.parses, 0);
  assert.equal((await view.bind({ app: {} }).invoke(proposal)).value, 6);
  assert.equal(declaration.parses, 1);
  declaration.disable();
  assert.equal(model.select({ intent: true }, {}).has('save'), false);
});

test('selection and bound runtime views recheck activation and retain immutable entries', () => {
  const declaration = new Save();
  declaration.active = app => app.enabled;
  const catalog = defineToolCatalog([declaration, { ...new Save(), id: 'off', active: false, authorize() {}, execute() {}, parseOutput: v => v }]);
  assert.deepEqual(catalog.select(['off']).ids(), []);
  assert.deepEqual(catalog.tools.select(['off']).ids(), []);
  assert.deepEqual(catalog.select([]).ids(), []);
  const app = { enabled: true };
  const selected = catalog.select(['save'], app);
  assert.equal(selected.require('save'), catalog.require('save'));
  const runtime = selected.bind({ app });
  app.enabled = false;
  assert.throws(() => selected.tools.resolve({ toolId: 'save', input: {} }, stage));
  assert.throws(() => runtime.tools.resolve({ toolId: 'save', input: {} }, stage));
});

test('domain and association adapters bind object discovery predicates to their original instance', () => {
  const declaration = new Save();
  const domains = new GoalRegistry().register(declaration);
  assert.equal(domains.select({ intent: true }, {}).has('save'), true);
  const associated = defineAssociatedCatalog([{ id: 'owner', description: 'Owner' }], { toolDefaults: () => declaration });
  assert.equal(associated.tools.select({ intent: true }, {}).has('save'), true);
  declaration.disable();
  assert.equal(domains.select({ intent: true }, {}).has('save'), false);
  assert.equal(associated.tools.select({ intent: true }, {}).has('save'), false);
});

test('session decoding does not masquerade as schema validation or model mapping', () => {
  let parsed = 0;
  const source = defineModelTools([{ id: 'query', description: 'Query', inputSchema: { jsonSchema: { type: 'object' }, parse() { parsed++; throw new Error('Invalid input'); } } }]);
  const response = createModelTransport({ response: 'session', id: 'session', tools: source }).prepare('test').createResponse();
  response.push({ type: 'function-call-delta', index: 0, id: 'a', name: 'query', arguments: '{}' });
  response.push({ type: 'function-call-delta', index: 1, id: 'b', name: 'missing', arguments: '{}' });
  const result = response.finish();
  assert.equal(parsed, 0);
  assert.deepEqual(result.calls[0].input, {});
  assert.equal(result.calls[1].input, undefined);
  assert.equal(result.calls[1].problem, 'unknown-tool');
  assert.throws(() => source.resolve({ toolId: 'query', input: result.calls[0].input }, stage), /Invalid input/);
});

test('custom executable resolvers are rejected rather than silently ignored', () => {
  const declaration = new Save();
  declaration.resolve = () => ({ toolId: 'other', input: {} });
  assert.throws(() => defineToolCatalog([declaration]), /cannot declare resolve/);
  assert.throws(() => defineModelTools([declaration]), /cannot declare resolve/);
});

test('lifecycle adapter preserves private receivers for discovery predicates', async () => {
  const { ToolLifecycleRegistry } = await import('../dist/esm/kits/tools.js');
  const declaration = new Save();
  declaration.audience = 'model'; declaration.effect = 'read'; declaration.goalIds = 'all';
  declaration.parseInput = value => value;
  const registry = new ToolLifecycleRegistry({
    registration: { isValidId: () => true, kinds: ['write'], audiences: ['model'], effects: ['read'], goalExists: () => true },
     outputs: () => [], goalIds: () => [],
    contextFragment: (_tool, field) => ({ value: { [field.key]: field.value } }),
  });
  registry.register(declaration);
  const predicate = registry.require('save').asIntent.when;
  assert.equal(predicate({}), true);
  declaration.disable();
  assert.equal(predicate({}), false);
});

test('one selection combines discovery and explicit continuations without widening activation', () => {
  const first = new Save();
  first.asIntent = 'Start saving';
  const continuation = { ...first, id: 'continue', asIntent: undefined, authorize() {}, execute: v => v, parseOutput: v => v };
  const off = { ...continuation, id: 'off', active: false };
  const catalog = defineToolCatalog([first, continuation, off]);
  const view = catalog.select({ intent: true, include: ['continue', 'off'] }, {});
  assert.deepEqual(view.ids(), ['save', 'continue']);
  assert.equal(view.require('save').description, 'Start saving');
  assert.equal(view.require('continue').description, 'Save');
  assert.equal(catalog.require('save').description, 'Save');
  assert.throws(() => catalog.select({ intent: true, include: ['missing'] }, {}), /not registered/);
});

test('session calls use the existing runtime invocation and retain parsing and permission checks', async () => {
  const declaration = new Save();
  let allowed = true;
  declaration.authorize = () => { if (!allowed) throw new Error('Denied'); };
  const runtime = defineToolCatalog([declaration]).bind({ app: {} });
  const response = createModelTransport({ response: 'session', id: 'session', tools: runtime.tools }).prepare('test').createResponse();
  response.push({ type: 'function-call-delta', index: 0, id: 'a', name: 'save', arguments: '{"amount":"4"}' });
  response.push({ type: 'function-call-delta', index: 1, id: 'b', name: 'hidden', arguments: '{}' });
  const { calls } = response.finish();
  assert.equal((await runtime.invoke(calls[0])).value, 8);
  assert.equal(declaration.parses, 1);
  assert.equal(runtime.events.length, 1);
  await assert.rejects(() => runtime.invoke(calls[1]));
  allowed = false;
  await assert.rejects(() => runtime.invoke(calls[0]), /Denied/);
  assert.equal(runtime.events.at(-1).status, 'error');
});

test('name/input schema projection freezes candidates without parsing business arguments', async () => {
  const { defineSchema } = await import('../dist/esm/support/schema.js');
  const declaration = new Save();
  const catalog = defineToolCatalog([declaration]);
  let envelopeParses = 0;
  const schema = defineSchema({ jsonSchema: { type: 'object', required: ['name','input'], properties: { input: { type: 'object' } } }, tools: catalog.tools, parse(value) { envelopeParses++; return value; } });
  assert.deepEqual(schema.jsonSchema.properties.name.enum, ['save']);
  assert.deepEqual(schema.parse({ name: 'save', input: { amount: '2' } }), { name: 'save', input: { amount: '2' } });
  assert.equal(declaration.parses, 0);
  assert.throws(() => schema.parse({ name: 'hidden', input: {} }));
  assert.equal(envelopeParses, 1);
});

test('session response mode supports an empty candidate set without advertising impossible calls', () => {
  const empty = defineModelTools([]);
  const prepared = createModelTransport({ id: 'empty', response: 'session', tools: empty }).prepare('test');
  assert.equal(prepared.options.functions, undefined);
  const response = prepared.createResponse();
  response.push('Hello');
  assert.deepEqual(response.finish(), { text: 'Hello', calls: [] });
  assert.throws(() => createModelTransport({ id: 'empty', response: 'session', tools: empty, options: { toolChoice: 'required' } }).prepare('test'));
});

test('goal next steps derive from registrations and explicit constraints remain closed', async () => {
  const goals = new GoalRegistry().registerAll([{ id: 'find', description: 'Find', delegates: ['read','final'] }, { id: 'chat', description: 'Chat', delegates: ['final'] }]);
  const catalog = defineAgentCatalog({ goalIds: () => goals.ids(), goals: () => goals.definitions, scopes: () => [], currentTask: () => undefined, tools: {
    values: () => [{ id: 'read', goalIds: ['find'], lifecycle: { call() {} }, active: ctx => ctx.enabled }, { id: 'extra', goalIds: ['find'], lifecycle: { call() {} } }],
    protocols: () => [['read', {}],['extra',{}],['final',{terminal:true}]], has: () => true, supportsGoal: () => true, describe: () => [],
  } });
  assert.deepEqual(catalog.goalDelegates({enabled:true}).get('find'), ['read','final']);
  assert.deepEqual(catalog.goalDelegates({enabled:false}).get('find'), ['final']);
});

test('goal projections preserve demand descriptions and constrain delegates to installed protocols', () => {
  const available = {
    id: 'lookup', description: 'Lookup', delegates: ['run', 'missing'],
    active(app) { assert.equal(this, available); return app.enabled; },
    asIntent(app) { assert.equal(this, available); return app.enabled; },
  };
  const goals = new GoalRegistry().registerAll([
    available,
    { id: 'draft', description: 'Draft', asIntent: 'Draft a note' },
    { id: 'review', description: 'Review', asIntent: { description: 'Review a note', when: () => true } },
  ]);
  assert.deepEqual(goals.select().ids(), ['lookup', 'draft', 'review']);
  assert.deepEqual(goals.select({ intent: true }, { enabled: false }).ids(), ['draft', 'review']);
  const protocols = [['run', {}]];
  const tools = [{ id: 'run', goalIds: 'all' }];
  assert.deepEqual(goalDelegates(goals.definitions, tools, protocols, {}).get('lookup'), ['run']);
  const withoutProtocols = goalDelegates(goals.definitions, [
    { id: 'compose', goalIds: ['draft'], lifecycle: { call() {} } },
    { id: 'project-only', goalIds: 'all' },
  ], undefined, {});
  assert.deepEqual(withoutProtocols.get('draft'), ['compose']);
  assert.deepEqual(withoutProtocols.get('review'), []);
  assert.deepEqual(goals.resolve({ toolId: 'draft', input: { text: 'draft' } }, stage),
    { toolId: 'draft', input: { text: 'draft' } });
  assert.throws(() => goals.get('draft').inputSchema.parse(null), /Tool input must be an object/);
  const catalog = defineAgentCatalog({
    goalIds: () => goals.ids(), goals: () => goals.definitions, scopes: () => [],
    currentTask: () => undefined,
    tools: { values: () => tools, protocols: () => protocols, describe: () => [], has: () => true, supportsGoal: () => true },
  });
  assert.deepEqual(catalog.goalCatalog({ enabled: true }).map(goal => goal.description),
    ['Lookup', 'Draft a note', 'Review a note']);
});

test('schema envelopes apply defaults and describe an empty candidate set as impossible', () => {
  const inputSchema = { jsonSchema: { type: 'object' }, parse(value) { return value; } };
  const tool = { id: 'lookup', description: 'Lookup', inputSchema };
  const envelope = { ...inputSchema, tools: { values: () => [tool] } };
  assert.deepEqual(defineSchema(envelope).jsonSchema.properties, {
    name: { type: 'string', enum: ['lookup'] }, input: { type: 'object' },
  });
  const empty = defineSchema({ ...envelope, tools: { values: () => [] } });
  assert.deepEqual(empty.jsonSchema.not, {});
  assert.deepEqual(empty.jsonSchema.properties.name, { type: 'string' });
  assert.throws(() => empty.parse({ name: 'lookup', input: {} }));
  assert.throws(() => defineSchema({ ...envelope, tools: { values: () => [tool, tool] } }), /Duplicate schema tool ids/);
  assert.throws(() => defineSchema({ ...envelope, jsonSchema: { type: 'string' } }), /requires an object schema/);
});

test('disabled tools reject direct model calls and preserve application unavailability errors', async () => {
  const declaration = new Save();
  declaration.active = false;
  const model = new ModelToolRegistry([{ id: 'save', description: 'Save', inputSchema: declaration.inputSchema, active: false }]);
  assert.throws(() => model.select({ intent: 'yes' }), /Invalid intent selection/);
  assert.throws(() => model.resolve({ toolId: 'save', input: {} }, stage));
  assert.throws(() => toolActive('yes', {}), /Invalid tool active condition/);
  const errors = { unavailable(id) { assert.equal(this, errors); return new Error(`Unavailable: ${id}`); } };
  const runtime = createToolRegistry([declaration], {}, { errors });
  await assert.rejects(runtime.invokeAsync({ toolId: 'save', input: {} }), /Unavailable: save/);
  declaration.active = 'yes';
  assert.throws(() => defineToolCatalog([declaration]), /Invalid tool active condition/);
  declaration.active = true;
  declaration.authorize = undefined;
  assert.throws(() => defineModelTools([declaration]), /Missing executable tool handler/);
});

test('executable tool intent callbacks keep their receiver in both catalog projections', () => {
  const declaration = new Save();
  declaration.asIntent = function (app) { assert.equal(this, declaration); return app.enabled; };
  for (const tools of [defineToolCatalog([declaration]).tools, defineModelTools([declaration])]) {
    assert.equal(tools.select({ intent: true }, { enabled: true }).has('save'), true);
    assert.equal(tools.select({ intent: true }, { enabled: false }).has('save'), false);
    assert.deepEqual(tools.select(['save']).ids(), ['save']);
  }
});

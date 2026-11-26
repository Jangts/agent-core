import test from 'node:test';
import assert from 'node:assert/strict';
import { Support } from '../dist/esm/index.js';
const schema = { jsonSchema: { type: 'object' }, parse: value => value };
const shared = {id:'read',description:'Read a record',inputSchema:schema,resolve:value=>value};

test('owner associations reuse explicit tools without an independent intent identity', () => {
  const catalog=Support.defineAssociatedCatalog([
    {id:'a',description:'A',modelTools:['read']},
    {id:'b',description:'B',modelTools:['read']},
  ],{tools:[shared]});
  assert.deepEqual(catalog.bindings.require('a').toolIds,['read']);
  assert.deepEqual(catalog.bindings.require('b').toolIds,['read']);
  assert.equal(catalog.tools.require('read').description,'Read a record');
  assert.equal(catalog.sources.require('read').sources.length,3);
  assert.equal('intents' in catalog,false);
  assert.equal('sources' in catalog.tools.require('read'),false);
});

test('associated defaults preserve input parsing and the resolver receiver', () => {
  class Handler { #value=4; id='read'; description='Read'; inputSchema=schema; resolve(input){return {...input,value:this.#value};} }
  const handler=new Handler();
  const catalog=Support.defineAssociatedCatalog([{id:'owner',description:'Owner'}],{toolDefaults:()=>handler});
  assert.deepEqual(catalog.tools.resolve({toolId:'read',input:{}},{stageId:'test'}),{value:4});
  assert.deepEqual(catalog.bindings.require('owner').toolIds,['read']);
});

test('associations reject dangling references, duplicate bindings and conflicting model identities', () => {
  assert.throws(()=>Support.defineAssociatedCatalog([{id:'a',description:'A',modelTools:['read']}]),/independent/);
  assert.throws(()=>Support.defineAssociatedCatalog([{id:'a',description:'A',modelTools:['read','read']}],{tools:[shared]}),/Duplicate/);
  assert.throws(()=>Support.defineAssociatedCatalog([{id:'a',description:'A',modelTools:[shared]}],{tools:[shared]}),/Duplicate/);
});

test('associations inherit owner metadata and evaluate declaration or fallback callbacks on their sources', () => {
  const derived = {
    description: undefined,
    inputSchema: schema,
    active() { assert.equal(this, derived); return true; },
    asIntent() { assert.equal(this, derived); return true; },
    resolve(input) { return input; },
  };
  const fallback = {
    inputSchema: schema,
    active() { assert.equal(this, fallback); return true; },
    asIntent() { assert.equal(this, fallback); return true; },
    resolve(input) { return input; },
  };
  const catalog = Support.defineAssociatedCatalog([
    { id: 'without-tools', description: 'Empty' },
    { id: 'fallback', description: 'Fallback' },
    { id: 'derived', description: 'Derived', modelTools: [derived] },
  ], { toolDefaults: owner => owner.id === 'fallback' ? fallback : undefined });
  assert.deepEqual(catalog.bindings.require('without-tools').toolIds, []);
  assert.deepEqual(catalog.tools.select({ intent: true }, {}).ids(), ['fallback', 'derived']);
  assert.equal(catalog.tools.require('derived').description, 'Derived');
  assert.equal(catalog.tools.require('fallback').description, 'Fallback');
  assert.throws(() => Support.defineAssociatedCatalog([
    { id: 'invalid', description: 'Invalid', modelTools: [null] },
  ]), /Invalid tool association/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentCoreEngine, ModelRunner, Support, defineWorkflow } from '../dist/esm/index.js';
import { toolbox, ParseInput, ParseOutput, Authorize, toolPool } from '../dist/esm/support/decorators/index.js';
const echo = {async *stream(messages){yield messages.at(-1).content}};

test('shared top-level calls isolate budgets, traces and journals, including concurrent calls', async () => {
  const events=[];
  const model=new ModelRunner({provider:echo,maxCalls:1,sink:{output:event=>{events.push(event)}}});
  assert.deepEqual((await Promise.all([model.invoke('one'),model.invoke('two')])).map(r=>r.value),['one','two']);
  assert.equal((await model.invoke('three')).value,'three');
  const ends=events.filter(event=>event.type==='model.end');
  assert.equal(ends.length,3);assert.equal(new Set(ends.map(event=>event.runId)).size,3);
  for(const key of ['callCount','lastCall','journal'])assert.throws(()=>model[key],/Bind execution/);
  const a=model.bind({}),b=model.bind({});
  await a.invoke('a');await b.invoke('b');
  assert.equal(a.callCount,1);assert.equal(b.callCount,1);
  assert.notEqual(a.journal.snapshot(),b.journal.snapshot());
  assert.equal(JSON.stringify(a.journal.snapshot()).includes('"b"'),false);
  await assert.rejects(()=>a.invoke('exhausted'));
});

test('binding reuses existing execution and children retain ancestor budgets without resetting it', async () => {
  const model=new ModelRunner({provider:echo,maxCalls:3});const execution={};
  const parent=model.bind(execution);assert.equal(model.bind(execution),parent);
  const child=parent.createChild({id:'child',maxCalls:3,reserveCalls:1,timeoutMs:1000});
  await child.invoke('one');await child.invoke('two');await assert.rejects(()=>child.invoke('reserved'));
  assert.equal(parent.totalCallCount,2);assert.equal(parent.callCount,0);assert.equal(child.journal.snapshot().length,2);
  await parent.invoke('reserved');assert.equal(parent.remainingCalls,0);
  assert.equal(parent.bind({}),parent);await assert.rejects(()=>parent.invoke('no reset'));
  assert.equal(model.bind({}).remainingCalls,3);
  assert.throws(()=>model.createChild({id:'ambiguous',maxCalls:1,timeoutMs:1000}),/Bind execution/);
});

test('cancelling one shared invocation does not cancel another invocation or poison later calls', async () => {
  let entered;const started=new Promise(resolve=>{entered=resolve});
  const model=new ModelRunner({provider:{async *stream(messages){if(messages.at(-1).content==='slow'){entered();await new Promise(()=>{});}yield 'ok';}},maxCalls:1});
  const abort=new AbortController();const pending=model.invoke({input:'slow',signal:abort.signal});
  await started;const reason=new Error('cancel one');abort.abort(reason);
  await assert.rejects(()=>pending,error=>error===reason);
  assert.equal((await model.invoke('fast')).value,'ok');assert.equal(model.bind({}).signal.aborted,false);
});

test('Engine binds a shared subclass once per run, preserving hooks, prepared calls and multi-stage budgets', async () => {
  let constructed=0;
  class Shared extends ModelRunner {
    #calls=0;#prepares=0;
    constructor(){super({provider:echo,maxCalls:2});constructed++;}
    invoke(request){this.#calls++;return super.invoke(request);}
    prepare(request={}){this.#prepares++;return super.prepare(request);}
    counts(){return [this.#calls,this.#prepares];}
  }
  const shared=new Shared();
  const workflow=defineWorkflow({id:'shared-run',nodes:[{id:'ask',description:'ask',run:async(state,context)=>{
    const prepared=context.model.prepare();
    const a=await context.model.invoke({input:state.text,prepared});
    const b=await context.model.invoke({input:a.value+'!'});
    return {answer:b.value};
  },routes:[{complete:state=>state.answer}]}]});
  const engine=new AgentCoreEngine({workflow}).bindModelRuntime(shared);
  assert.deepEqual(await Promise.all([engine.run({text:'one'}),engine.run({text:'two'})]),['one!','two!']);
  assert.equal(await engine.run({text:'three'}),'three!');
  assert.deepEqual(shared.counts(),[6,3]);assert.equal(constructed,1);assert.throws(()=>shared.callCount,/Bind execution/);
  const bound=shared.bind({});
  await assert.rejects(()=>bound.invoke({input:'wrong',execution:{}}),/execution cannot be replaced/);
  assert.throws(()=>bound.prepare({execution:{}}),/execution cannot be replaced/);
});

test('prepared handles preserve ownership and cannot transfer their execution or be replayed', async () => {
  const model=new ModelRunner({provider:echo,maxCalls:1});const execution={};
  const prepared=model.prepare({execution});
  await assert.rejects(()=>model.invoke({input:'wrong',prepared,execution:{}}),/execution cannot be replaced/);
  assert.equal((await model.invoke({input:'right',prepared,execution})).value,'right');
  await assert.rejects(()=>model.invoke({input:'replay',prepared,execution}),/already used/);
  const other=new ModelRunner({provider:echo,maxCalls:1});await assert.rejects(()=>other.invoke({input:'foreign',prepared}),/foreign/);
});

test('bound runners reject a replacement execution at every public entry before spending budget', async () => {
  const execution = {};
  const child = { id: 'child', maxCalls: 1, timeoutMs: 1000 };
  assert.throws(() => new ModelRunner({ provider: echo, maxCalls: 2, execution: [] }), /must be an object/);
  const model = new ModelRunner({ provider: echo, maxCalls: 2 });
  assert.throws(() => model.bind(null), /must be an object/);
  const bound = model.bind(execution);
  assert.throws(() => bound.prepare({ execution: {} }), /cannot be replaced/);
  assert.throws(() => bound.createChild({ ...child, execution: {} }), /cannot be replaced/);
  await assert.rejects(bound.invoke({ input: 'discard', execution: {} }), /cannot be replaced/);
  assert.equal(bound.remainingCalls, 2);
  const prepared = bound.prepare({ execution });
  assert.equal((await bound.invoke({ input: 'bound', execution, prepared })).value, 'bound');
  const nested = bound.createChild({ ...child, execution });
  assert.equal((await nested.invoke('nested')).value, 'nested');
  assert.equal(bound.totalCallCount, 2);
});

test('a shared subclass receives its child execution through the bound wrapper', async () => {
  const execution = {};
  class Parent extends ModelRunner {
    #calls = [];
    createChild(options) { this.#calls.push(options.execution); return super.createChild(options); }
    executions() { return this.#calls; }
  }
  const parent = new Parent({ provider: echo, maxCalls: 1 });
  const bound = parent.bind(execution);
  const child = { id: 'child', maxCalls: 1, timeoutMs: 1000 };
  assert.throws(() => bound.createChild({ ...child, execution: {} }), /cannot be replaced/);
  assert.deepEqual(parent.executions(), []);
  assert.equal((await bound.createChild(child).invoke('ready')).value, 'ready');
  assert.deepEqual(parent.executions(), [execution]);
});

function decorate(decorator,Class){const initializers=[];decorator(Class,{kind:'class',addInitializer(fn){initializers.push(fn)}});for(const init of initializers)init.call(Class)}
function parsers(Class, registrations){const initializers=[];for(const [decorator,name]of registrations)decorator(Class.prototype[name],{kind:'method',static:false,private:false,addInitializer(fn){initializers.push(fn)}});return class extends Class{constructor(){super();for(const init of initializers)init.call(this)}}}

test('toolbox compiles a shared JSON schema once and validates before optional conversion and authorization', async () => {
  let compilations=0,conversions=0,authorizations=0;
  const schema={type:'object',properties:{text:{type:'string'}},required:['text'],additionalProperties:false};
  class Tools {
    inputSchemas={first:schema,second:schema};
    convert(raw){conversions++;return raw.text.toUpperCase();}
    output(raw){return raw;}
    authorize(){authorizations++;}
    first(text){return text;}
    second(input){return input.text;}
  }
  decorate(toolbox({first:{kind:'read',description:'first'},second:{kind:'read',description:'second'}},{ns:'compiled-schema',compile(frozen){
    compilations++;assert.ok(Object.isFrozen(frozen));assert.equal(frozen.properties.text.type,'string');
    return raw=>!!raw&&typeof raw==='object'&&typeof raw.text==='string'&&Object.keys(raw).every(key=>key==='text');
  }}),parsers(Tools,[[ParseInput('first'),'convert'],[ParseOutput('first'),'output'],[ParseOutput('second'),'output'],[Authorize(),'authorize']]));
  const runtime=Support.defineToolCatalog(toolPool.getAll('compiled-schema')).bind({app:undefined});
  schema.properties.text.type='number';
  assert.equal((await runtime.invoke({toolId:'first',input:{text:'hello'}})).value,'HELLO');
  assert.equal((await runtime.invoke({toolId:'second',input:{text:'world'}})).value,'world');
  await assert.rejects(()=>runtime.invoke({toolId:'first',input:{text:42}}),/JSON Schema/);
  assert.equal(compilations,1);assert.equal(conversions,1);assert.equal(authorizations,2);
});

test('compiler errors remain atomic and asynchronous compilers cannot publish tools', () => {
  class Tools {inputSchemas={first:{type:'object'}};first(input){return input;}}
  assert.throws(()=>decorate(toolbox({first:{description:'first'}},{ns:'async-compiler',compile:()=>Promise.resolve(()=>true)}),Tools),/synchronous/);
  assert.deepEqual(toolPool.getAll('async-compiler'),[]);
});


test('a shared Runner binds once for a whole child group and later groups get independent execution', async () => {
  const model=new ModelRunner({provider:echo,maxCalls:2});
  const tasks=['one','two'].map(id=>({id,maxCalls:2,reserveCalls:0,timeoutMs:1000,run:async child=>(await child.invoke(id)).value}));
  assert.deepEqual(await Support.runChildren(model,tasks),['one','two']);
  assert.deepEqual(await Support.runChildren(model,tasks),['one','two']);
  await assert.rejects(()=>Support.runChildren(model,[...tasks,{...tasks[0],id:'third'}]));
  assert.throws(()=>model.totalCallCount,/Bind execution/);
});

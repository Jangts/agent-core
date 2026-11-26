import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentCoreEngine, ModelRunner, Support, defineWorkflow } from '@jangts/agent-core';
import { agent, model, toolbox, ParseInput, ParseOutput, Authorize, agentPool, modelPool, toolPool } from '@jangts/agent-core/support/decorators';
const decorate = (decorator, Class) => { const initializers=[]; decorator(Class,{kind:'class',addInitializer(fn){initializers.push(fn)}}); for(const fn of initializers)fn.call(Class); return Class; };
const schema={jsonSchema:{type:'object'},parse:raw=>raw};
const entry={kind:'read',description:'read'};
function withParsers(Class, ids, {common=true,specific=[]}={}) {
 const initializers=[];
 const registrations=ids.flatMap(id=>[[ParseInput(id),'parseInput'],[ParseOutput(id),'parseOutput']]);
 if(common)registrations.push([Authorize(),'authorize']);
 for(const id of specific)registrations.push([Authorize(id),'specific']);
 for(const [decorator,name]of registrations)decorator(Class.prototype[name],{kind:'method',static:false,private:false,addInitializer(fn){initializers.push(fn)}});
 return class extends Class{constructor(...args){super(...args);for(const init of initializers)init.call(this)}};
}
class ParsingHost { parseInput(value){return value} parseOutput(value){return value} authorize(){} }

test('runtime pools preserve subclass identity, constructor arguments and existing model budgets', async () => {
  let constructions=0;
  class Runner extends ModelRunner { #prefix; constructor(prefix){constructions++;super({provider:{async *stream(){yield prefix}},maxCalls:1});this.#prefix=prefix;} label(){return this.#prefix;} }
  decorate(model('runner',{ns:'live',args:['ready']}),Runner);
  const runner=modelPool.get('runner','live');
  assert.ok(runner instanceof Runner);assert.equal(runner.label(),'ready');assert.equal(constructions,1);
  assert.equal((await runner.invoke({input:'hi'})).value,'ready');
  assert.equal(modelPool.get('runner','live'),runner);
  const bound=runner.bind({});await bound.invoke({input:'hi'});
  await assert.rejects(()=>bound.invoke({input:'hi'}));assert.equal(bound.callCount,1);assert.throws(()=>runner.callCount,/Bind execution/);
  class Agent extends AgentCoreEngine { constructor(){super()} label(){return 'agent'} }
  decorate(agent('agent',{ns:'live'}),Agent);
  const instance=agentPool.get('agent','live');assert.ok(instance instanceof Agent);assert.equal(instance.label(),'agent');
  assert.equal(await instance.run(()=> ({type:'complete',value:'done'})),'done');
  assert.throws(()=>decorate(model('wrong',{ns:'live'}),class { provider={} }),/extending/);
  assert.throws(()=>decorate(agent('wrong',{ns:'live'}),class {}),/extending/);
  assert.equal(modelPool.get('wrong','live'),undefined);
});

test('runtime decorators reject wrong targets, argument lists and competing instance identities', () => {
  const ns = 'invalid-runtime-decoration';
  class Runtime extends AgentCoreEngine {}
  assert.throws(() => agent('runtime', { ns })(Runtime, { kind: 'method' }), /standard class decorator/);
  assert.throws(() => decorate(agent('runtime', { ns, args: 'invalid' }), Runtime), /args must be an array/);
  assert.throws(() => decorate(agent('runtime', { ns }), class extends Runtime { id = 'own'; }),
    /Decoration supplies id/);
  assert.throws(() => ParseInput(' '), /Parser tool id must be nonempty/);
  assert.deepEqual(agentPool.getAll(ns), []);
});

test('toolbox shares private memory and applies common authorization before an additional tool check', async () => {
  const checks=[];let constructions=0;
  class Tools extends ParsingHost {
    #count=0; constructor(){super();constructions++;}
    inputSchemas={ first:{type:'object'}, second:{type:'object'} };
    specific(){checks.push('specific')}
    authorize(input,context){checks.push('common');if(!context.app.allowed)throw Error('denied');}
    first(){return ++this.#count;} second(){return this.first();}
  }
  decorate(toolbox({first:entry,second:entry},{ns:['box','box-copy']}),withParsers(Tools,['first','second'],{specific:['second']}));
  assert.equal(constructions,1);assert.equal(toolPool.get('first','box'),toolPool.get('first','box-copy'));
  const catalog=Support.defineToolCatalog(toolPool.getAll('box'));
  const allowed=catalog.bind({app:{allowed:true}});
  assert.equal((await allowed.invoke({toolId:'first',input:{}})).value,1);
  assert.equal((await allowed.invoke({toolId:'second',input:{}})).value,2);
  assert.deepEqual(checks,['common','common','specific']);
  await assert.rejects(()=>catalog.bind({app:{allowed:false}}).invoke({toolId:'second',input:{}}),/denied/);
  assert.deepEqual(checks,['common','common','specific','common']);
});

test('toolbox rejects incomplete definitions and namespace collisions atomically', () => {
  class Invalid extends ParsingHost { inputSchemas={first:{type:'object'},missing:{type:'object'}};authorize(){} first(){return 1;} }
  assert.throws(()=>decorate(toolbox({first:entry,missing:entry},{ns:'invalid-box'}),withParsers(Invalid,['first','missing'])),/Missing toolbox method/);
  assert.deepEqual(toolPool.getAll('invalid-box'),[]);
  class Existing extends ParsingHost { inputSchemas={second:{type:'object'}};authorize(){} second(){} }
  decorate(toolbox({second:entry},{ns:'occupied-box'}),withParsers(Existing,['second']));
  class Conflicting extends ParsingHost { inputSchemas={first:{type:'object'},second:{type:'object'}};authorize(){} first(){} second(){} }
  assert.throws(()=>decorate(toolbox({first:entry,second:entry},{ns:['empty-box','occupied-box']}),withParsers(Conflicting,['first','second'])),/Duplicate/);
  assert.deepEqual(toolPool.getAll('empty-box'),[]);assert.equal(toolPool.get('first','occupied-box'),undefined);
  class NoAuthorization extends ParsingHost { inputSchemas={first:{type:'object'}}; first(){} }
  assert.throws(()=>decorate(toolbox({first:entry},{ns:'no-auth'}),withParsers(NoAuthorization,['first'],{common:false})),/authorization/);
});

test('a pooled Engine keeps a bound request execution guard and can run again after completion', async () => {
  let release;const gate=new Promise(resolve=>{release=resolve});
  const workflow=defineWorkflow({id:'guarded',nodes:[{id:'wait',description:'wait',run:async(state)=>{if(state.wait)await gate},routes:[{complete:state=>state.value}]}]});
  class SharedAgent extends AgentCoreEngine { constructor(){super({workflow})} }
  decorate(agent('shared',{ns:'lifetime'}),SharedAgent);
  const instance=agentPool.get('shared','lifetime');
  instance.bindModelRuntime(new ModelRunner({provider:{async *stream(){yield 'unused'}},maxCalls:1,execution:{}}));
  const first=instance.run({wait:true,value:'first'});
  await assert.rejects(()=>instance.run({value:'second'}),/active|concurrent|running/i);
  release();assert.equal(await first,'first');
  assert.equal(await instance.run({value:'third'}),'third');
});

test('parser hooks validate actual inputs and outputs, and reject duplicate or orphan targets', async () => {
  class Checked extends ParsingHost {
    #prefix='checked:';
    inputSchemas={read:{type:'object'}};
    parseInput(raw){if(!raw||typeof raw.text!=='string')throw Error('bad input');return raw.text;}
    parseOutput(raw){if(typeof raw!=='string')throw Error('bad output');return this.#prefix+raw;}
    read(input){return input==='bad-result'?42:input;}
  }
  decorate(toolbox({read:entry},{ns:'checked-box'}),withParsers(Checked,['read']));
  const runtime=Support.defineToolCatalog(toolPool.getAll('checked-box')).bind({app:undefined});
  assert.equal((await runtime.invoke({toolId:'read',input:{text:'ok'}})).value,'checked:ok');
  await assert.rejects(()=>runtime.invoke({toolId:'read',input:{text:42}}),/bad input/);
  await assert.rejects(()=>runtime.invoke({toolId:'read',input:{text:'bad-result'}}),/bad output/);
  assert.throws(()=>decorate(toolbox({read:entry},{ns:'duplicate-parser'}),withParsers(Checked,['read','read'])),/Duplicate input parser/);
  assert.deepEqual(toolPool.getAll('duplicate-parser'),[]);
  assert.throws(()=>decorate(toolbox({read:entry},{ns:'orphan-parser'}),withParsers(Checked,['other'])),/Unknown toolbox parser target/);
  assert.deepEqual(toolPool.getAll('orphan-parser'),[]);
  assert.throws(()=>ParseInput('read')(()=>{}, {kind:'method',static:true}),/public instance/);
});

test('async common authorization completes before a specific check and execution', async () => {
  const order=[];
  class AsyncAuth extends ParsingHost {
    inputSchemas={read:{type:'object'}};
    async authorize(){order.push('start');await Promise.resolve();order.push('common');}
    specific(){order.push('specific');}
    read(){order.push('execute');return true;}
  }
  decorate(toolbox({read:entry},{ns:'async-authorize'}),withParsers(AsyncAuth,['read'],{specific:['read']}));
  await Support.defineToolCatalog(toolPool.getAll('async-authorize')).bind({app:undefined}).invoke({toolId:'read',input:{}});
  assert.deepEqual(order,['start','common','specific','execute']);
});

test('asynchronous input/output parsers are rejected by the original boundaries', async () => {
  class BadInput extends ParsingHost { inputSchemas={read:{type:'object'}}; async parseInput(raw){return raw;} read(){throw Error('must not execute');} }
  decorate(toolbox({read:entry},{ns:'async-input'}),withParsers(BadInput,['read']));
  await assert.rejects(()=>Support.defineToolCatalog(toolPool.getAll('async-input')).bind({app:undefined}).invoke({toolId:'read',input:{}}),/synchronous|Promise|async/i);
  class BadOutput extends ParsingHost { inputSchemas={read:{type:'object'}}; async parseOutput(raw){return raw;} read(){return true;} }
  decorate(toolbox({read:entry},{ns:'async-output'}),withParsers(BadOutput,['read']));
  await assert.rejects(()=>Support.defineToolCatalog(toolPool.getAll('async-output')).bind({app:undefined}).invoke({toolId:'read',input:{}}),/synchronous|Promise|async/i);
});

test('model-only toolboxes preserve intent discovery and synchronous parser/resolve boundaries', () => {
  class Mapper extends ParsingHost {
    #prefix='mapped:';
    inputSchemas={choose:{type:'object'}};
    parseInput(raw){if(typeof raw.text!=='string')throw Error('bad input');return raw.text;}
    parseOutput(raw){return this.#prefix+raw;}
    choose(value){return value;}
  }
  decorate(toolbox({choose:{description:'choose',asIntent:true}},{ns:'model-box'}),withParsers(Mapper,['choose'],{common:false}));
  const catalog=Support.defineModelTools(toolPool.getAll('model-box')).select({intent:true},{});
  assert.equal(catalog.resolve({toolId:'choose',input:{text:'ok'}},{stageId:'test'}),'mapped:ok');
  class AsyncMapper extends Mapper { async choose(value){return value;} }
  decorate(toolbox({choose:{description:'choose'}},{ns:'async-model-box'}),withParsers(AsyncMapper,['choose'],{common:false}));
  assert.throws(()=>Support.defineModelTools(toolPool.getAll('async-model-box')).resolve({toolId:'choose',input:{text:'ok'}},{stageId:'test'}),/synchronous/);
});

test('toolbox validates class semantics, declaration options and host schemas before registration', () => {
  class Host {
    inputSchemas = { read: { type: 'object' } };
    read() { return 'ok'; }
  }
  assert.throws(() => toolbox({ read: entry })(Host, { kind: 'method' }), /class decorator/);
  const ns = 'invalid-toolbox-options';
  for (const [entries, options, expected] of [
    [{}, {}, /nonempty tool options/],
    [{ read: entry }, { args: 'value' }, /args must be an array/],
    [{ read: entry }, { compile: true }, /compile must be a function/],
    [{ read: entry }, { error: () => new Error() }, /requires a compiler/],
    [{ read: { ...entry, execute() {} } }, {}, /host-owned field/],
    [{ read: entry }, {}, /Missing @ParseInput or schema compiler/],
  ]) {
    assert.throws(() => decorate(toolbox(entries, { ns, ...options }), Host), expected);
  }
  for (const [inputSchemas, expected] of [
    [undefined, /requires inputSchemas/],
    [{}, /Missing toolbox JSON Schema: read/],
    [{ read: { type: 'object' }, orphan: {} }, /Unknown toolbox schema target: orphan/],
  ]) {
    assert.throws(() => decorate(toolbox({ read: entry }, { ns }), class extends Host {
      inputSchemas = inputSchemas;
    }), expected);
  }
  assert.deepEqual(toolPool.getAll(ns), []);
});

test('toolbox rejects missing execution output parsers and model-only execution authorization', () => {
  class Host extends ParsingHost {
    inputSchemas = { read: { type: 'object' } };
    read() { return 'ok'; }
    specific() {}
  }
  const ns = 'invalid-toolbox-hooks';
  const initializers = [];
  Authorize()(Host.prototype.authorize, {
    kind: 'method', static: false, private: false, addInitializer: fn => initializers.push(fn),
  });
  class WithoutOutput extends Host {
    constructor() {
      super();
      for (const init of initializers) init.call(this);
    }
  }
  assert.throws(
    () => decorate(toolbox({ read: entry }, { ns, compile: () => () => true }), WithoutOutput),
    /Missing @ParseOutput: read/,
  );
  assert.throws(
    () => decorate(toolbox({ read: { description: 'read' } }, { ns }),
      withParsers(Host, ['read'], { common: false, specific: ['read'] })),
    /cannot declare execution authorization/,
  );
  assert.deepEqual(toolPool.getAll(ns), []);
});

test('toolbox keeps constructor receiver and returns unparsed model-only results', () => {
  class Host {
    #label;
    inputSchemas = { read: { type: 'object' } };
    constructor(label) { this.#label = label; }
    read() { return this.#label; }
    isAvailable() { return this.#label === 'ready'; }
  }
  const ns = 'raw-model-toolbox';
  const rejected = new Error('invalid model arguments');
  decorate(toolbox(
    { read: { description: 'read', active: Host.prototype.isAvailable } },
    {
      ns, args: ['ready'],
      compile: () => input => input.blocked !== true,
      error: () => rejected,
    },
  ), Host);
  const tools = Support.defineModelTools(toolPool.getAll(ns)).select({}, {});
  assert.equal(tools.resolve({ toolId: 'read', input: {} }, { stageId: 'test' }), 'ready');
  assert.throws(() => tools.resolve({ toolId: 'read', input: { blocked: true } }, { stageId: 'test' }),
    error => error === rejected);
});

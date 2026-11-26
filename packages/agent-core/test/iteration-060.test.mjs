import test from 'node:test';
import assert from 'node:assert/strict';
import { ModelRunner, Support } from '../dist/esm/index.js';
import { toolbox, Authorize, ParseOutput, toolPool } from '../dist/esm/support/decorators/index.js';
import { retrievalQueryKey } from '../dist/esm/kits/retrieval.js';
function register(Class, hooks, ns) {
 const methods=[];for(const [decorator,name]of hooks)decorator(Class.prototype[name],{kind:'method',static:false,private:false,addInitializer(fn){methods.push(fn)}});
 class Host extends Class {constructor(){super();for(const fn of methods)fn.call(this)}}
 const initializers=[];toolbox({act:{description:'act',kind:'write'}},{ns,compile:()=>()=>true})(Host,{kind:'class',addInitializer(fn){initializers.push(fn)}});for(const fn of initializers)fn.call(Host);
 return Support.defineToolCatalog(toolPool.getAll(ns)).bind({app:{}});
}
test('public authorization assertions are checked individually before any later check or effect', async()=>{
 for(const asyncHook of [false,true])for(const rejected of [false,true,null]){
  let effects=0,checks=0;
  class Tools{inputSchemas={act:{type:'object'}};common(){return asyncHook?Promise.resolve(rejected):rejected}own(){checks++}out(x){return x}act(){effects++}}
  const runtime=register(Tools,[[Authorize(),'common'],[Authorize('act'),'own'],[ParseOutput('act'),'out']],`060-auth-${asyncHook}-${rejected}`);
  await assert.rejects(runtime.invoke({toolId:'act',input:{}}),/void/);assert.equal(effects,0);assert.equal(checks,0);
 }
});
test('cancelled common authorization cannot enter its additional check when it completes late',async()=>{
 let complete,entered;const gate=new Promise(resolve=>{complete=resolve}),started=new Promise(resolve=>{entered=resolve});let checks=0,effects=0;
 class Tools{inputSchemas={act:{type:'object'}};async common(){entered();await gate}own(){checks++}out(x){return x}act(){effects++}}
 const runtime=register(Tools,[[Authorize(),'common'],[Authorize('act'),'own'],[ParseOutput('act'),'out']],'060-cancel');
 const controller=new AbortController();const pending=runtime.invoke({toolId:'act',input:{},signal:controller.signal});await started;controller.abort();await assert.rejects(pending);complete();await new Promise(resolve=>setImmediate(resolve));assert.equal(checks,0);assert.equal(effects,0);
});
test('shared subclass execution state is explicit and isolated across interleaved requests',async()=>{
 const observations=[];let constructed=0;
 class Runner extends ModelRunner{
  #hits=0;
  constructor(){super({provider:{async *stream(messages){await Promise.resolve();yield messages.at(-1).content}},maxCalls:2});constructed++}
  async invoke(request){this.#hits++;const current=this.bind(request.execution);const result=await super.invoke(request);observations.push({input:request.input,count:current.callCount,remaining:current.remainingCalls,journal:current.journal.snapshot().length,signal:current.signal});return result}
  hits(){return this.#hits}
 }
 const runner=new Runner(),a=new AbortController(),b=new AbortController();const left=runner.bind({signal:a.signal}),right=runner.bind({signal:b.signal});
 await Promise.all([left.invoke('left'),right.invoke('right')]);await left.invoke('left2');
 assert.deepEqual(observations.map(o=>[o.input,o.count,o.remaining,o.journal]),[['left',1,1,1],['right',1,1,1],['left2',2,0,2]]);
 a.abort();assert.equal(left.signal.aborted,true);assert.equal(right.signal.aborted,false);await right.invoke('right2');assert.equal(constructed,1);assert.equal(runner.hits(),4);
 for(const key of ['callCount','remainingCalls','totalCallCount','lastCall','journal','signal'])assert.throws(()=>runner[key],/Bind execution/);
});
test('query keys preserve JSON identity and reject values that would silently lose conditions',()=>{
 assert.equal(retrievalQueryKey({b:[1],a:2}),retrievalQueryKey({a:2,b:[1]}));assert.notEqual(retrievalQueryKey([1,2]),retrievalQueryKey([2,1]));
 const cycle={};cycle.self=cycle;
 for(const value of [{date:new Date()}, {a:undefined},{a:()=>{}},{a:Symbol()},{a:NaN},{a:Infinity},[,,],cycle,new Map(),{[Symbol()]:1}])assert.throws(()=>retrievalQueryKey(value),/serialized/);
});
test('rejected asynchronous token counters are consumed at measure and invoke boundaries',async()=>{
 const unhandled=[];const listener=error=>unhandled.push(error);process.on('unhandledRejection',listener);
 try{
 let calls=0;const model=new ModelRunner({provider:{async *stream(){calls++;yield 'ok'}},execution:{},tokenBudget:{counterId:'counter',contextWindowTokens:5000,countTokens:async()=>{throw new Error('counter rejected')}}});
 assert.throws(()=>model.prepare().measure('hi'),/synchronous/);await assert.rejects(model.invoke('hi'),/synchronous/);await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,0);assert.equal(model.callCount,0);assert.deepEqual(unhandled,[]);
 }finally{process.removeListener('unhandledRejection',listener)}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { ModelRunner, getErrorInfo } from '../dist/esm/index.js';

function provider(events) {
  return { capabilities: { completion: true, modalities: ['image'] }, async *stream() { throw Error('legacy path'); }, async *streamEvents() { yield* events; } };
}
test('Runner routes lifecycle events without changing the string result', async () => {
  const usage = {promptTokens: 1, completionTokens: 2, totalTokens: 3};
  const runner = new ModelRunner({provider: provider(['hello', {type:'usage',usage}, {type:'completion',status:'completed'}]), execution: {}});
  assert.equal((await runner.invoke('test')).value, 'hello');
  assert.deepEqual(runner.lastCall.usage, usage);
});
test('full-event provider cannot commit an unterminated or refused result', async () => {
  for (const events of [['partial'], ['partial',{type:'completion',status:'refused'}]]) {
    const runner = new ModelRunner({provider: provider(events), execution:{}});
    await assert.rejects(runner.invoke('test'));
    assert.equal(runner.journal.snapshot().length, 0);
  }
});
test('content after completion is rejected', async () => {
  await assert.rejects(new ModelRunner({provider:provider([{type:'completion',status:'completed'},'late'])}).invoke('test'));
});
test('legacy object providers retain finite stream behavior', async () => {
  assert.equal((await new ModelRunner({provider:{async *stream(){yield 'old';}}}).invoke('test')).value,'old');
});
test('bound lifecycle actions share the ordinary generation budget', async () => {
  const runner = new ModelRunner({provider:{async *stream(){yield 'old';}},maxCalls:2,execution:{}});
  await runner.runOperation(async () => 'submitted',{calls:2});
  await assert.rejects(runner.invoke('test'));
  assert.equal(runner.totalCallCount,2);
  assert.equal(await runner.runOperation(async()=> 'read',{calls:0}),'read');
});
test('batch charge is atomic when capacity is insufficient', async () => {
  const runner = new ModelRunner({provider:{async *stream(){}},maxCalls:2,execution:{}});
  let called=false;
  await assert.rejects(runner.runOperation(async()=>{called=true;},{calls:3}));
  assert.equal(called,false); assert.equal(runner.totalCallCount,0);
});
test('typed media is rejected before generation when capability is absent', async () => {
  let called=false;
  const runner=new ModelRunner({provider:{async *stream(){called=true;yield 'bad';}},execution:{}});
  await assert.rejects(runner.invoke({input:[{role:'user',content:'',parts:[{type:'audio',url:'https://invalid.test/a'}]}]}));
  assert.equal(called,false);assert.equal(runner.totalCallCount,0);
});

test('public Runner and factory preserve scoped signed state across a tool session', async () => {
  const { createModelProvider } = await import('../dist/esm/support/model/provider-factory.js');
  const { createModelTransport } = await import('../dist/esm/support/model/index.js');
  const { defineToolCatalog } = await import('../dist/esm/support/tools.js');
  const catalog = defineToolCatalog([{id:'lookup',kind:'read',description:'Lookup',inputSchema:{jsonSchema:{type:'object',properties:{}},parse:x=>x},authorize(){},execute:()=>({ok:true}),parseOutput:x=>x}]);
  const bodies=[];let state;
  const p=createModelProvider({protocol:'messages',baseUrl:'https://model.invalid/v1',apiKey:'fixture',model:'test',scope:'owner:1',stream:false,request:async(url,init)=>{
    bodies.push(JSON.parse(init.body));
    return Response.json(bodies.length===1?{content:[{type:'thinking',thinking:'private',signature:'signed'},{type:'tool_use',id:'t',name:'lookup',input:{}}],stop_reason:'tool_use'}:{content:[{type:'text',text:'done'}],stop_reason:'end_turn'});
  }});
  const transport=createModelTransport({id:'session',response:'session',tools:catalog.tools});
  const runner=new ModelRunner({provider:p,transports:[transport],maxCalls:2,execution:{}});
  const first=await runner.invoke({input:'lookup',transport,modelOptions:{onContinuation:x=>state=x}});
  assert.equal(first.value.calls[0].name,'lookup');assert.ok(state);
  const second=await runner.invoke({input:[{role:'user',content:'lookup'},{role:'assistant',content:'',toolCalls:[{id:'t',name:'lookup',arguments:'{}'}]},{role:'tool',content:'answer',toolCallId:'t'}],transport,modelOptions:{continuation:state}});
  assert.equal(second.value.text,'done');assert.equal(bodies[1].messages[1].content[0].signature,'signed');
  assert.doesNotMatch(JSON.stringify(runner.journal.snapshot()),/private|signed/);
});
test('cancelled lifecycle work retains its gate until settled and permits bounded cleanup', async () => {
  const abort=new AbortController();let resolveWork,started;
  const start=new Promise(r=>started=r);
  const runner=new ModelRunner({provider:{async *stream(){yield 'x';}},execution:{signal:abort.signal},maxCalls:2});
  const pending=runner.runOperation(async()=>{started();return await new Promise(r=>resolveWork=r);},{calls:1});
  await start;abort.abort();await assert.rejects(pending);
  assert.equal(await runner.runOperation(async()=> 'cancel-sent',{cleanup:true,calls:0}),'cancel-sent');
  await assert.rejects(runner.runOperation(async()=> 'bad',{cleanup:true,calls:1}));
  resolveWork('late');await Promise.resolve();await Promise.resolve();
  assert.equal(runner.totalCallCount,1);
});

test('request-local abort keeps issued work gated until it actually settles', async () => {
  const abort = new AbortController();
  let finish, started;
  const beginning = new Promise(resolve => started = resolve);
  const runner = new ModelRunner({provider:{async *stream(){yield 'text';}}, execution:{}, maxCalls:3});
  const operation = runner.runOperation(async () => {started();return new Promise(resolve => finish = resolve);}, {signal:abort.signal,calls:1});
  await beginning;abort.abort();await assert.rejects(operation);
  let secondStarted=false;
  await assert.rejects(runner.runOperation(async()=>{secondStarted=true;}, {calls:1}), /active call/);
  assert.equal(secondStarted,false);assert.equal(runner.totalCallCount,1);
  finish('settled');
  // The promise adoption chain may take several microtasks to propagate settlement.
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(await runner.runOperation(async()=> 'next',{calls:1}),'next');
  assert.equal(runner.totalCallCount,2);
});

test('token counter receives detached ordered parts and output schema with its receiver', async () => {
  let received;
  const p={capabilities:{completion:true,jsonSchema:true},async *stream(){},async *streamEvents(messages,context){received={messages,options:context.options};yield 'ok';yield {type:'completion',status:'completed'};}};
  const budget={counterId:'fixture',contextWindowTokens:1000,countTokens(input){assert.equal(this.counterId,'fixture');assert.equal(input.messages[0].parts[0].text,'actual');assert.equal(input.outputSchema.properties.answer.type,'string');input.messages[0].parts[0].text='tampered';input.outputSchema.properties.answer.type='number';return 3;}};
  const runner=new ModelRunner({provider:p,execution:{},maxOutputTokens:16,tokenBudget:budget});
  const schema={type:'object',properties:{answer:{type:'string'}}};
  assert.equal((await runner.invoke({input:[{role:'user',content:'',parts:[{type:'text',text:'actual'}]}],modelOptions:{outputSchema:schema}})).value,'ok');
  assert.equal(received.messages[0].parts[0].text,'actual');
  assert.equal(received.options.outputSchema.properties.answer.type,'string');
  assert.equal(Object.isFrozen(schema),false);
});

test('cleanup cannot reenter ordinary model generation or reserve generation calls', async () => {
  let generated=false;
  const runner=new ModelRunner({provider:{async *stream(){generated=true;yield 'bad';}},execution:{},maxCalls:2});
  await runner.runOperation(async()=>{
    await assert.rejects(runner.invoke('bad'),/cleanup/);
    await assert.rejects(runner.runOperation(async()=>{}, {calls:1}),/Cleanup/);
  },{cleanup:true,calls:0});
  assert.equal(generated,false);assert.equal(runner.totalCallCount,0);
});

test('lifecycle diagnostics use existing execution scope and only opaque metadata', async () => {
  const events=[];
  const runner=new ModelRunner({provider:{async *stream(){}},maxCalls:2,execution:{observe:{event:event=>events.push(event)}}});
  await runner.runOperation(async()=>({secret:'raw-payload'}), {action:'submit',operationId:'owner:private-handle',calls:1});
  await runner.runOperation(async()=> 'read', {action:'query',operationId:'owner:private-handle',calls:0});
  const starts=events.filter(event=>event.type==='model.lifecycle.start');
  const ends=events.filter(event=>event.type==='model.lifecycle.end');
  assert.equal(starts.length,2);assert.equal(ends.length,2);
  assert.equal(starts[0].runId,starts[1].runId);
  assert.equal(starts[0].payload.operationRef,starts[1].payload.operationRef);
  assert.match(starts[0].payload.operationRef,/^[a-f0-9]{64}$/);
  assert.equal(starts[0].payload.invocationId,ends[0].payload.invocationId);
  assert.equal(ends[0].payload.status,'success');
  assert.doesNotMatch(JSON.stringify(events),/raw-payload|private-handle/);
});
test('cancelled lifecycle end is emitted only after issued action settles', async () => {
  const events=[];let started,finish;
  const beginning=new Promise(resolve=>started=resolve);
  const abort=new AbortController();
  const runner=new ModelRunner({provider:{async *stream(){}},execution:{observe:{event:event=>events.push(event)}}});
  const pending=runner.runOperation(async()=>{started();return new Promise(resolve=>finish=resolve);},{signal:abort.signal,action:'submit',calls:1});
  await beginning;abort.abort();await assert.rejects(pending);
  assert.equal(events.filter(e=>e.type==='model.lifecycle.start').length,1);
  assert.equal(events.filter(e=>e.type==='model.lifecycle.end').length,0);
  finish('late');await new Promise(resolve=>setImmediate(resolve));
  const end=events.find(e=>e.type==='model.lifecycle.end');
  assert.equal(end.payload.status,'cancelled');
});

test('failed generations never publish their provisional continuation', async () => {
  const state={version:1,protocol:'fixture',model:'fixture',scope:'owner',data:{state:'new'}};
  for(const tail of [[],[{type:'completion',status:'refused'}]]){
    let calls=0;
    const runner=new ModelRunner({provider:provider([{type:'continuation',continuation:state},'partial',...tail]),execution:{}});
    await assert.rejects(runner.invoke({input:'x',modelOptions:{onContinuation(){calls++;}}}));
    assert.equal(calls,0);
  }
  let calls=0;
  const bad={id:'bad',prepare(){return {options:{onContinuation(){calls++;}},schemaChars:0,createResponse(){return {outputChars:0,push(){},finish(){throw Error('collector rejected');}};}};}};
  const runner=new ModelRunner({provider:provider([{type:'continuation',continuation:state},'value',{type:'completion',status:'completed'}]),transports:[bad]});
  await assert.rejects(runner.invoke({input:'x',transport:bad}),/collector rejected/);assert.equal(calls,0);
  const limited=new ModelRunner({provider:provider([{type:'continuation',continuation:state},'too long',{type:'completion',status:'completed'}]),maxOutputChars:1});
  await assert.rejects(limited.invoke({input:'x',modelOptions:{onContinuation(){calls++;}}}));assert.equal(calls,0);
});
test('successful continuation is published only after collector acceptance', async () => {
  let accepted=false,received;
  const state={version:1,protocol:'fixture',model:'fixture',scope:'owner',data:{state:'accepted'}};
  const transport={id:'accept',prepare(){return {options:{},schemaChars:0,createResponse(){return {outputChars:0,push(){},finish(){accepted=true;return 'ok';}};}};}};
  const runner=new ModelRunner({provider:provider([{type:'continuation',continuation:state},{type:'completion',status:'completed'}]),transports:[transport]});
  assert.equal((await runner.invoke({input:'x',transport,modelOptions:{onContinuation(value){assert.equal(accepted,true);received=value;}}})).value,'ok');
  assert.deepEqual(received,state);
});
test('media and continuation callbacks reject accidental Promise results', async () => {
  const state={version:1,protocol:'fixture',model:'fixture',scope:'owner',data:{}};
  await assert.rejects(new ModelRunner({provider:provider(['ok',{type:'continuation',continuation:state},{type:'completion',status:'completed'}])}).invoke({input:'x',modelOptions:{onContinuation(){return Promise.reject(Error('late'));}}}),/synchronous/);
  await assert.rejects(new ModelRunner({provider:provider([{type:'content',content:{type:'image',url:'data:image/png;base64,a'}},{type:'completion',status:'completed'}])}).invoke({input:'x',modelOptions:{onContent(){return Promise.reject(Error('late'));}}}),/synchronous/);
});
test('a custom throwing diagnostic scope cannot strand lifecycle admission or reject settlement', async () => {
  const scope={identity:{runId:'fixture',spanId:'fixture'},child(){return this;},emit(){throw Error('observer broken');}};
  const runner=new ModelRunner({provider:{async *stream(){}},execution:{diagnostics:scope},maxCalls:2});
  assert.equal(await runner.runOperation(async()=> 'ok',{calls:1}),'ok');
  assert.equal(await runner.runOperation(async()=> 'again',{calls:1}),'again');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(runner.totalCallCount,2);
});

test('full-event routing classifies malformed shapes as MODEL_PROTOCOL before any sink', async () => {
  const { getErrorInfo } = await import('../dist/esm/index.js');
  const shapes=[null,undefined,7,true,[],{}, {type:7}, {type:'unknown'}, {type:'content',content:null},{type:'content',content:[]},{type:'content',content:{type:'text',text:7}},{type:'content',content:{type:'image',url:''}},{type:'content',content:{type:'file',url:'url',mimeType:7}}, {type:'usage',usage:null},{type:'usage',usage:{promptTokens:-1,completionTokens:1,totalTokens:0}}, {type:'completion',status:'bogus'}, {type:'completion',status:'completed',reason:7}, {type:'continuation',continuation:{version:1,protocol:'x',model:'x',scope:'x',data:()=>{}}}, {type:'function-call-delta',index:0,id:7}];
  for (const shape of shapes){
    let observed=false;
    const runner=new ModelRunner({provider:provider([shape]),execution:{}});
    await assert.rejects(runner.invoke({input:'x',modelOptions:{onContent(){observed=true;},onContinuation(){observed=true;}}}),error=>getErrorInfo(error).codes.includes('MODEL_PROTOCOL'));
    assert.equal(observed,false);assert.equal(runner.journal.snapshot().length,0);
  }
});

test('operation-only prototype providers preserve private state across binding and child runners', async () => {
  class Operations { #calls=0; async invoke(){return ++this.#calls;} }
  const provider=new Operations();
  const runner=new ModelRunner({provider,execution:{},maxCalls:3,children:{maxDepth:2}});
  assert.equal(await runner.runOperation(signal=>runner.provider.operations.invoke({}, {signal}),{calls:1}),1);
  const bound=runner.bind();
  assert.equal(await bound.runOperation(signal=>bound.provider.operations.invoke({}, {signal}),{calls:1}),2);
  const child=runner.createChild({id:'operation-child',maxCalls:1,timeoutMs:1000});
  assert.equal(await child.runOperation(signal=>child.provider.operations.invoke({}, {signal}),{calls:1}),3);
  assert.equal(runner.totalCallCount,3);assert.equal(Object.isFrozen(provider),false);
});
test('realtime-only prototype providers do not require a generation stub', async () => {
  class Realtime { #calls=0; async connect(){return ++this.#calls;} }
  const provider=new Realtime();
  const runner=new ModelRunner({provider,execution:{},children:{maxDepth:2}});
  assert.equal(await runner.runOperation(signal=>runner.provider.realtime.connect({signal}),{calls:0}),1);
  const child=runner.bind().createChild({id:'realtime-child',maxCalls:1,timeoutMs:1000});
  assert.equal(await child.runOperation(signal=>child.provider.realtime.connect({signal}),{calls:0}),2);
  assert.equal(runner.totalCallCount,0);assert.equal(Object.isFrozen(provider),false);
});
test('lifecycle-only generation rejects before accounting while malformed ports still reject construction', async () => {
  for(const provider of [{async invoke(){}},{async connect(){}},{operations:{async invoke(){}}},{realtime:{async connect(){}}}]){
    const runner=new ModelRunner({provider,execution:{}});
    assert.throws(()=>runner.prepare(),/generation/);
    await assert.rejects(runner.invoke('unused'),/generation/);
    assert.equal(runner.totalCallCount,0);
    assert.equal(await runner.runOperation(async()=> 'lifecycle',{calls:0}),'lifecycle');
  }
  for(const provider of [{},{stream:7},{invoke:7},{connect:7},{operations:{}},{realtime:{}},{stream:async function*(){},operations:null},{stream:async function*(){},realtime:[]}]) assert.throws(()=>new ModelRunner({provider}));
});

test('normalized typed text and duplicate media or terminal events respect the Runner boundary', async () => {
  const completion = { type: 'completion', status: 'completed' };
  const text = { type: 'content', content: { type: 'text', text: 'answer' } };
  const image = { type: 'content', content: { type: 'image', url: 'https://assets.invalid/image' } };
  const runnerFor = (events) => new ModelRunner({ provider: provider(events), execution: {} });
  assert.equal((await runnerFor([text, completion]).invoke('test')).value, 'answer');
  for (const invalid of [
    [completion, completion], [completion, image], [image, completion],
    [{ type: 'function-call-delta', index: -1 }], [{ type: 'content', content: { type: 'unknown' } }],
    [{ type: 'continuation', continuation: { version: 2 } }],
  ]) {
    const runner = runnerFor(invalid);
    await assert.rejects(runner.invoke('test'), error => getErrorInfo(error).codes.includes('MODEL_PROTOCOL'));
    assert.equal(runner.journal.snapshot().length, 0);
  }
});

test('the model runtime validates custom lifecycle settings before issuing work', async () => {
  const source = { async *stream() {} };
  for (const [patch, error] of [
    [{ provider: { ...source, streamEvents: true } }, /streamEvents must be a function/],
    [{ maxTotalCalls: 0 }, /maxTotalCalls must be/],
  ]) assert.throws(() => new ModelRunner({ provider: source, ...patch }), error);
  const root = new ModelRunner({ provider: source });
  assert.equal(await root.runOperation(async () => 'zero-cost'), 'zero-cost');
  const bound = root.bind({});
  for (const [options, error] of [
    [{ calls: -1 }, /Invalid lifecycle call count/], [{ action: 'unknown' }, /Invalid lifecycle action/],
    [{ operationId: 'x'.repeat(4097) }, /Invalid lifecycle identity/],
  ]) await assert.rejects(bound.runOperation(() => assert.fail('malformed operation ran'), options), error);
  assert.equal(bound.totalCallCount, 0);
});

test('capability preflight rejects unproven completion, disabled tools, unsupported schemas and opaque input', async () => {
  const events = [{ type: 'completion', status: 'completed' }];
  const options = [
    [{ requireCompletion: true }, {}, /does not prove completion/],
    [{ functions: [{ name: 'find', parameters: { type: 'object' } }] }, { tools: false }, /does not support tool calls/],
    [{ outputSchema: { type: 'object' } }, { jsonSchema: false }, /does not support structured output/],
  ];
  for (const [modelOptions, capabilities, error] of options) {
    const adapter = { ...provider(events), capabilities };
    const runner = new ModelRunner({ provider: adapter, execution: {} });
    await assert.rejects(runner.invoke({ input: 'test', modelOptions }), error);
    assert.equal(runner.totalCallCount, 0);
  }
  const tokenBudget = { counterId: 'fixture', contextWindowTokens: 10000, countTokens() { return 1; } };
  const runner = new ModelRunner({ provider: provider(events), execution: {}, tokenBudget });
  const continuation = { version: 1, protocol: 'responses', model: 'm', scope: 's', data: {} };
  await assert.rejects(runner.invoke({ input: 'test', modelOptions: { continuation } }), /Opaque remote context/);
  assert.equal(runner.totalCallCount, 0);
});

test('bound lifecycle work succeeds when correlation is unavailable and releases its gate after errors', async () => {
  const { createDiagnostics } = await import('../dist/esm/index.js');
  const events = [];
  const diagnostics = createDiagnostics({ observe: { event: value => events.push(value) } });
  const runner = new ModelRunner({ provider: { async *stream() {} }, execution: { diagnostics } });
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { randomUUID: globalThis.crypto.randomUUID.bind(globalThis.crypto), subtle: {
    async digest() { throw Error('digest unavailable'); },
  } } });
  try {
    const issue = Error('host work rejected');
    await assert.rejects(runner.runOperation(async () => { throw issue; }, {
      operationId: 'private host operation', action: 'read',
    }), error => error === issue);
    const end = events.findLast(event => event.type === 'model.lifecycle.end');
    assert.equal(end.payload.status, 'error');
    assert.ok(end.payload.errorCode);
    assert.equal(end.payload.operationRef, undefined);
    assert.doesNotMatch(JSON.stringify(events), /private host operation/);
    assert.equal(await runner.runOperation(async () => 'next'), 'next');
  } finally { Object.defineProperty(globalThis, 'crypto', descriptor); }
});

test('observer scope creation failures are best effort for lifecycle operations', async () => {
  let attempted = 0;
  const diagnostics = {
    identity: {}, child() { attempted++; throw Error('observer unavailable'); },
  };
  const runner = new ModelRunner({ provider: { async *stream() {} }, execution: { diagnostics }, maxCalls: 1 });
  assert.equal(await runner.runOperation(async () => 'complete', { calls: 1 }), 'complete');
  assert.equal(attempted, 1);
  assert.equal(runner.totalCallCount, 1);
});

test('typed input capability is checked even with an event-aware provider', async () => {
  let invoked = false;
  const runner = new ModelRunner({
    provider: {
      capabilities: { completion: true, modalities: ['text'] },
      async *streamEvents() { invoked = true; yield 'bad'; },
    },
    execution: {},
  });
  await assert.rejects(runner.invoke({ input: [{
    role: 'user', content: '', parts: [{ type: 'audio', url: 'https://assets.invalid/audio' }],
  }] }), /Provider does not support audio input/);
  assert.equal(invoked, false);
  assert.equal(runner.totalCallCount, 0);
  const legacy = new ModelRunner({ provider: {
    capabilities: { completion: true }, async *stream() { assert.fail('unproven stream ran'); },
  }, execution: {} });
  await assert.rejects(legacy.invoke({ input: 'text', modelOptions: { requireCompletion: true } }), /does not prove completion/);
});

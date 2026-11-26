import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runModelOperation} from '../dist/esm/model/operations.js';
import {createOperationHttpProvider} from '../dist/esm/support/model/lifecycle/http.js';
import {openModelRealtime} from '../dist/esm/model/realtime.js';
const handle={operationId:'o',scope:'user:1',protocol:'responses',itemIds:['a','b']};
const ports=(saved=[],calls=[])=>({authorize(){},reserve:async()=>true,save:async x=>saved.push(x),run:async(work,opt)=>{calls.push(opt.calls);return work(new AbortController().signal);}});
test('accepted submission whose response is lost persists unknown and reserves per item',async()=>{
 const saved=[],calls=[];await assert.rejects(runModelOperation({invoke:async(_request,context)=>{context.markDispatched();throw Error('lost');}},{action:'submit',handle},ports(saved,calls)),/lost/);
 assert.equal(saved[0].status,'unknown');assert.deepEqual(calls,[0,2]);
});
test('duplicate submit never invokes provider',async()=>{
 let invoked=false;await assert.rejects(runModelOperation({invoke:async()=>{invoked=true;}},{action:'submit',handle},{...ports(),reserve:async()=>false}),/already submitted/);assert.equal(invoked,false);
});
test('read is reauthorized and uses zero generation attempts',async()=>{
 const calls=[];const result=await runModelOperation({invoke:async({handle})=>({handle,status:'completed'})},{action:'read',handle:{...handle,remoteId:'r'}},ports([],calls));assert.equal(result.status,'completed');assert.deepEqual(calls,[0,0]);
});
test('Responses background wire forces background and maps accepted identity',async()=>{
 let body;const provider=createOperationHttpProvider({protocol:'responses',baseUrl:'https://example.test/v1',apiKey:'fixture',request:async(url,init)=>{body=JSON.parse(init.body);assert.equal(url,'https://example.test/v1/responses');return new Response(JSON.stringify({id:'r',status:'queued'}));}});
 const r=await provider.invoke({action:'submit',handle,payload:{model:'fixture'}},{signal:new AbortController().signal});assert.equal(body.background,true);assert.equal(r.handle.remoteId,'r');
});
test('realtime tool permission is checked on each send; stale generation is refused',async()=>{
 let allowed=true,sent=0,closed=0;const provider={connect:async()=>({send:async()=>{sent++;},frames:(async function*(){})(),close:async()=>{closed++;}})};
 const s=await openModelRealtime(provider,{run:ports().run,maxFrames:2,maxFrameChars:100,authorize(action){if(action==='tool'&&!allowed)throw Error('revoked');}});
 await s.interrupt({type:'cancel'});await assert.rejects(s.send({},'tool',0),/Stale/);allowed=false;await assert.rejects(s.send({},'tool'),/revoked/);await s.close();assert.equal(sent,1);assert.equal(closed,1);
});

test('local admission failure does not reserve or persist remote unknown',async()=>{
 const saved=[];let reserved=false;
 await assert.rejects(runModelOperation({invoke:async()=>{throw Error('must not invoke');}},{action:'submit',handle},{...ports(saved),reserve:async()=>{reserved=true;return true;},run:async()=>{throw Error('budget');}}),/budget/);
 assert.equal(reserved,false);assert.equal(saved.length,0);
});
test('remote identity changes are rejected',async()=>{
 await assert.rejects(runModelOperation({invoke:async()=>({handle:{...handle,remoteId:'changed',itemIds:['other']},status:'completed'})},{action:'read',handle:{...handle,remoteId:'r'}},ports()),/identity changed/);
});
test('WebSocket fixture opens, transmits, consumes frames and aborts',async()=>{
 const {connectModelWebSocket}=await import('../dist/esm/support/model/lifecycle/realtime.js');
 class Socket extends EventTarget {readyState=0;bufferedAmount=0;sent=[];closed=0;send(x){this.sent.push(x);}close(){this.readyState=3;this.closed++;this.dispatchEvent(new Event('close'));}}
 const socket=new Socket(),controller=new AbortController();
 const promise=connectModelWebSocket('wss://example.test', {signal:controller.signal},{create:()=>socket,maxQueuedFrames:2,maxBufferedBytes:100,maxFrameChars:100});
 socket.readyState=1;socket.dispatchEvent(new Event('open'));const duplex=await promise;
 await duplex.send({type:'x'},controller.signal);assert.equal(socket.sent.length,1);
 socket.dispatchEvent(new MessageEvent('message',{data:'{"type":"done"}'}));const iterator=duplex.frames[Symbol.asyncIterator]();assert.equal((await iterator.next()).value.type,'done');controller.abort();assert.equal((await iterator.next()).done,true);assert.ok(socket.closed>=1);
});

test('portable OpenAI batch uploads compiled items and normalizes output files',async()=>{
 const {createBatchModelProvider}=await import('../dist/esm/support/model/lifecycle/batch.js');const requests=[];
 const provider=createBatchModelProvider({protocol:'openai-batch',baseUrl:'https://example.test/v1',apiKey:'fixture',model:'fixture',request:async(url,init)=>{
  requests.push(url);
  if(url.endsWith('/files'))return new Response(JSON.stringify({id:'f'}));
  if(url.endsWith('/files/out/content'))return new Response(JSON.stringify({custom_id:'a',response:{status_code:200,body:{status:'completed',output:[{type:'message',content:[{type:'output_text',text:'answer'}]}]}}}));
  if(init.method==='POST')return new Response(JSON.stringify({id:'batch',status:'validating'}));
  return new Response(JSON.stringify({id:'batch',status:'completed',output_file_id:'out'}));
 }});
 const h={...handle,protocol:'openai-batch',itemIds:['a']};
 const r=await provider.invoke({action:'submit',handle:h,payload:{items:[{id:'a',messages:[{role:'user',content:'hello'}]}]}},{signal:new AbortController().signal});assert.equal(r.handle.remoteId,'batch');
 const read=await provider.invoke({action:'read',handle:r.handle},{signal:new AbortController().signal});assert.equal(read.value[0].id,'a');assert.equal(read.value[0].value[0],'answer');assert.ok(requests.some(x=>x.endsWith('/files/out/content')));
});
test('protocol realtime correlates IDs across interrupted turns and admits a fresh turn',async()=>{
 const {openProtocolRealtime}=await import('../dist/esm/support/model/lifecycle/session.js');let push,done;const queue=[];let sent=[];
 const frames={async *[Symbol.asyncIterator](){while(true){if(queue.length){const x=queue.shift();if(x===null)return;yield x;}else await new Promise(r=>push=r);}}};
 const emit=x=>{queue.push(x);push?.();};
 const session=await openProtocolRealtime({protocol:'openai-realtime',setup:{},connect:async()=>({send:async frame=>sent.push(frame),frames,close:async()=>emit(null)})},{run:ports().run,maxFrames:20,maxFrameChars:2000,authorize(){}});
 const iterator=session.events()[Symbol.asyncIterator]();await session.text('first');const old=session.generation;emit({type:'response.created',response:{id:'old'}});emit({type:'response.output_text.delta',response_id:'old',delta:'one'});assert.equal((await iterator.next()).value.text,'one');
 await session.interrupt();await session.text('second');emit({type:'response.output_text.delta',response_id:'old',delta:'late'});emit({type:'response.created',response:{id:'new'}});emit({type:'response.output_text.delta',response_id:'new',delta:'two'});const next=await iterator.next();assert.equal(next.value.text,'two');assert.ok(next.value.generation>old);await session.close();
});

test('opening deadline does not terminate a connected session lifetime',async()=>{
 const {connectModelWebSocket}=await import('../dist/esm/support/model/lifecycle/realtime.js');
 class Socket extends EventTarget {readyState=1;bufferedAmount=0;closed=0;send(){}close(){this.closed++;this.dispatchEvent(new Event('close'));}}
 const socket=new Socket(),opening=new AbortController(),lifetime=new AbortController();
 const duplex=await connectModelWebSocket('wss://example.test',{signal:opening.signal,lifetimeSignal:lifetime.signal},{create:()=>socket,maxQueuedFrames:2,maxBufferedBytes:100,maxFrameChars:100});opening.abort();assert.equal(socket.closed,0);lifetime.abort();assert.ok(socket.closed>=1);await duplex.close();
});
test('Gemini batch files use official download endpoint and forced item keys',async()=>{
 const {createBatchModelProvider}=await import('../dist/esm/support/model/lifecycle/batch.js');let download='';
 const provider=createBatchModelProvider({protocol:'gemini-batch',model:'fixture',baseUrl:'https://example.test/v1beta',apiKey:'fixture',request:async url=>{
  if(url.includes('/download/')){download=url;return new Response(JSON.stringify({key:'a',response:{candidates:[{content:{parts:[{text:'answer'}]},finishReason:'STOP'}]}}));}
  return new Response(JSON.stringify({name:'batches/r',metadata:{state:'JOB_STATE_SUCCEEDED'},response:{responsesFile:'files/output'}}));
 }});
 const result=await provider.invoke({action:'read',handle:{...handle,protocol:'gemini-batch',remoteId:'batches/r',itemIds:['a']}},{signal:new AbortController().signal});assert.equal(result.value[0].id,'a');assert.equal(result.value[0].value[0],'answer');assert.equal(download,'https://example.test/download/v1beta/files/output:download?alt=media');
});

test('background factory accepts portable messages and preserves pending without a generated result',async()=>{
 const {createBackgroundModelProvider}=await import('../dist/esm/support/model/lifecycle/background.js');
 for(const protocol of ['responses','interactions']){
  let payload;const provider=createBackgroundModelProvider({protocol,model:'fixture',baseUrl:'https://example.test/v1',apiKey:'fixture',request:async(url,init)=>{payload=JSON.parse(init.body);return new Response(JSON.stringify({id:'r',status:'in_progress'}));}});
  const result=await provider.invoke({action:'submit',handle:{...handle,protocol},payload:{messages:[{role:'user',content:'hello'}]}},{signal:new AbortController().signal});
  assert.equal(payload.background,true);assert.equal(payload.model,'fixture');assert.ok(payload.input);assert.equal(result.status,'running');assert.equal(result.value,undefined);
 }
});
test('background terminal result shares event content and usage, keeps replay outside visible value',async()=>{
 const {createBackgroundModelProvider}=await import('../dist/esm/support/model/lifecycle/background.js');
 const provider=createBackgroundModelProvider({protocol:'responses',model:'fixture',baseUrl:'https://example.test/v1',apiKey:'fixture',request:async()=>new Response(JSON.stringify({id:'r',status:'completed',output:[{type:'message',content:[{type:'output_text',text:'answer'}]}],usage:{input_tokens:2,output_tokens:3,total_tokens:5}}))});
 const result=await provider.invoke({action:'read',handle:{...handle,remoteId:'r'}},{signal:new AbortController().signal});assert.equal(result.status,'completed');assert.deepEqual(result.value,['answer']);assert.equal(result.usage.totalTokens,5);assert.equal(result.continuation.scope,handle.scope);assert.ok(result.continuation.data.replay);
});

test('operation hanging authorization is locally cancelled before reserve, remote invocation or generation charge',async()=>{
 const {ModelRunner}=await import('../dist/esm/model/runner.js');
 const runner=new ModelRunner({provider:{async *stream(){yield 'ok';}},maxCalls:2}).bind({signal:new AbortController().signal});
 const controller=new AbortController();let reserved=0,invoked=0,entered;
 const started=new Promise(resolve=>entered=resolve);
 const pending=runModelOperation({invoke:async()=>{invoked++;throw Error('not expected');}},{action:'submit',handle},{run:runner.runOperation.bind(runner),authorize(){entered();return new Promise(()=>{});},reserve:async()=>{reserved++;return true;},save:async()=>{}},controller.signal);
 await started;controller.abort(Error('cancel authorization'));await assert.rejects(pending,/cancel authorization/);
 assert.equal(reserved,0);assert.equal(invoked,0);assert.equal(runner.remainingCalls,2);
});
test('realtime hanging connect authorization is cancellable without opening transport or consuming generation budget',async()=>{
 const {ModelRunner}=await import('../dist/esm/model/runner.js');
 const runner=new ModelRunner({provider:{async *stream(){yield 'ok';}},maxCalls:2}).bind({signal:new AbortController().signal});
 const controller=new AbortController();let connected=0,entered;const started=new Promise(resolve=>entered=resolve);
 const pending=openModelRealtime({connect:async()=>{connected++;throw Error('not expected');}},{run:runner.runOperation.bind(runner),signal:controller.signal,maxFrames:2,maxFrameChars:100,authorize(){entered();return new Promise(()=>{});}});
 await started;controller.abort(Error('cancel realtime authorization'));await assert.rejects(pending,/cancel realtime authorization/);assert.equal(connected,0);assert.equal(runner.remainingCalls,2);
});
test('realtime hanging send authorization is cancellable and emits no transport frame',async()=>{
 const {ModelRunner}=await import('../dist/esm/model/runner.js');
 const runner=new ModelRunner({provider:{async *stream(){yield 'ok';}},maxCalls:2}).bind({signal:new AbortController().signal});
 const controller=new AbortController();let sent=0,entered;const started=new Promise(resolve=>entered=resolve);
 const session=await openModelRealtime({connect:async()=>({send:async()=>{sent++;},frames:(async function*(){})(),close:async()=>{}})},{run:runner.runOperation.bind(runner),signal:controller.signal,maxFrames:2,maxFrameChars:100,authorize(action){if(action==='input'){entered();return new Promise(()=>{});}}});
 const pending=session.send({type:'input'},'input');await started;controller.abort(Error('cancel send authorization'));await assert.rejects(pending,/cancel send authorization/);assert.equal(sent,0);assert.equal(runner.remainingCalls,2);
});
test('WebRTC injected peer negotiates actual SDP and datachannel lifecycle independently of opening signal',async()=>{
 const {connectModelWebRTC}=await import('../dist/esm/support/model/lifecycle/realtime.js');
 class Channel extends EventTarget {readyState='connecting';bufferedAmount=0;sent=[];closed=0;send(data){this.sent.push(data);}close(){this.readyState='closed';this.closed++;this.dispatchEvent(new Event('close'));}}
 const channel=new Channel(),steps=[];let peerClosed=0;
 const peer={createDataChannel(name){steps.push(['channel',name]);return channel;},async createOffer(){steps.push(['offer']);return {type:'offer',sdp:'offer-sdp'};},async setLocalDescription(value){steps.push(['local',value.sdp]);},async setRemoteDescription(value){steps.push(['remote',value.sdp]);channel.readyState='open';},close(){peerClosed++;}};
 const opening=new AbortController(),lifetime=new AbortController();
 const duplex=await connectModelWebRTC({signal:opening.signal,lifetimeSignal:lifetime.signal},{create:()=>peer,exchange:async offer=>{steps.push(['exchange',offer]);return 'answer-sdp';},maxQueuedFrames:3,maxBufferedBytes:1000,maxFrameChars:1000});
 assert.deepEqual(steps,[['channel','oai-events'],['offer'],['local','offer-sdp'],['exchange','offer-sdp'],['remote','answer-sdp']]);
 await duplex.send({type:'test'},lifetime.signal);assert.deepEqual(JSON.parse(channel.sent[0]),{type:'test'});
 channel.dispatchEvent(new MessageEvent('message',{data:'{"type":"reply"}'}));const iterator=duplex.frames[Symbol.asyncIterator]();assert.equal((await iterator.next()).value.type,'reply');
 opening.abort();assert.equal(peerClosed,0);lifetime.abort();assert.ok(peerClosed>=1);assert.ok(channel.closed>=1);assert.equal((await iterator.next()).done,true);await duplex.close();
});

test('hanging realtime close shares one bounded cleanup promise without consuming generation budget',async()=>{
 const {ModelRunner}=await import('../dist/esm/model/runner.js');
 const runner=new ModelRunner({provider:{async *stream(){yield 'ok';}},maxCalls:2,callTimeoutMs:25}).bind({signal:new AbortController().signal});
 let closingCalls=0;
 const session=await openModelRealtime({connect:async()=>({send:async()=>{},frames:(async function*(){})(),close(){closingCalls++;return new Promise(()=>{});}})},{run:runner.runOperation.bind(runner),maxFrames:2,maxFrameChars:100,authorize(){}});
 const keepAlive=setTimeout(()=>{},1000);
 try{
  const first=session.close(),second=session.close();assert.equal(first,second);
  await assert.rejects(first,/timeout|timed out/i);
  assert.equal(closingCalls,1);assert.equal(runner.remainingCalls,2);
 }finally{clearTimeout(keepAlive);}
});

test('OpenAI realtime tool results auto-continue only after response.done with one charged generation and no synthetic user input',async()=>{
 const {ModelRunner}=await import('../dist/esm/model/runner.js');const {openProtocolRealtime}=await import('../dist/esm/support/model/lifecycle/session.js');
 const runner=new ModelRunner({provider:{async *stream(){yield 'ok';}},maxCalls:3}).bind({signal:new AbortController().signal});
 let wake,creates=0,done=false;const queue=[],sent=[];const emit=frame=>{queue.push(frame);wake?.();};
 const frames={async *[Symbol.asyncIterator](){while(true){if(queue.length){const frame=queue.shift();if(frame===null)return;yield frame;}else await new Promise(resolve=>wake=resolve);}}};
 const session=await openProtocolRealtime({protocol:'openai-realtime',setup:{},connect:async()=>({frames,close:async()=>emit(null),send:async frame=>{
  sent.push(frame);if(frame.type==='response.create'){
   if(++creates===1){emit({type:'response.created',response:{id:'first'}});for(const id of ['one','two'])emit({type:'response.function_call_arguments.done',response_id:'first',call_id:id,name:'lookup',arguments:'{}'});emit({type:'response.done',response:{id:'first',status:'completed'}});done=true;}
   else{assert.equal(done,true);emit({type:'response.created',response:{id:'final'}});emit({type:'response.output_text.delta',response_id:'final',delta:'final answer'});emit({type:'response.done',response:{id:'final',status:'completed'}});}
  }
 }})},{run:runner.runOperation.bind(runner),maxFrames:30,maxFrameChars:2000,authorize(){}});
 await session.text('question');let answer='',toolCount=0;
 for await(const event of session.events()){
  if(event.type==='tool'){await session.tool(event.id,event.name,{ok:true},event.generation);toolCount++;assert.equal(creates,1);}
  if(event.type==='text'){answer+=event.text;break;}
 }
 assert.equal(answer,'final answer');assert.equal(toolCount,2);assert.equal(creates,2);assert.equal(runner.remainingCalls,1);assert.equal(sent.filter(frame=>frame.item?.type==='message').length,1);assert.equal(sent.filter(frame=>frame.item?.type==='function_call_output').length,2);
});
test('tool continuation budget exhaustion emits no new OpenAI response.create',async()=>{
 const {ModelRunner}=await import('../dist/esm/model/runner.js');const {openProtocolRealtime}=await import('../dist/esm/support/model/lifecycle/session.js');
 const runner=new ModelRunner({provider:{async *stream(){yield 'ok';}},maxCalls:1}).bind({signal:new AbortController().signal});
 let wake,creates=0;const queue=[];const emit=frame=>{queue.push(frame);wake?.();};
 const session=await openProtocolRealtime({protocol:'openai-realtime',setup:{},connect:async()=>({frames:{async *[Symbol.asyncIterator](){while(true){if(queue.length){const frame=queue.shift();if(frame===null)return;yield frame;}else await new Promise(resolve=>wake=resolve);}}},close:async()=>emit(null),send:async frame=>{if(frame.type==='response.create'){creates++;emit({type:'response.created',response:{id:'r'}});emit({type:'response.function_call_arguments.done',response_id:'r',call_id:'one',name:'lookup',arguments:'{}'});emit({type:'response.done',response:{id:'r',status:'completed'}});}}})},{run:runner.runOperation.bind(runner),maxFrames:10,maxFrameChars:2000,authorize(){}});
 await session.text('question');const iterator=session.events()[Symbol.asyncIterator]();const tool=(await iterator.next()).value;await session.tool(tool.id,tool.name,{ok:true});await assert.rejects(iterator.next());assert.equal(creates,1);assert.equal(runner.remainingCalls,0);
});
test('Gemini toolResponse batches all calls, charges continuation and receives final text without invented response.create',async()=>{
 const {ModelRunner}=await import('../dist/esm/model/runner.js');const {openProtocolRealtime}=await import('../dist/esm/support/model/lifecycle/session.js');
 const runner=new ModelRunner({provider:{async *stream(){yield 'ok';}},maxCalls:2}).bind({signal:new AbortController().signal});
 let wake;const queue=[],sent=[];const emit=frame=>{queue.push(frame);wake?.();};
 const session=await openProtocolRealtime({protocol:'gemini-live',setup:{},connect:async()=>({frames:{async *[Symbol.asyncIterator](){while(true){if(queue.length){const frame=queue.shift();if(frame===null)return;yield frame;}else await new Promise(resolve=>wake=resolve);}}},close:async()=>emit(null),send:async frame=>{sent.push(frame);if(frame.clientContent)emit({toolCall:{functionCalls:[{id:'a',name:'lookup',args:{}},{id:'b',name:'lookup',args:{}}]}});if(frame.toolResponse){assert.equal(frame.toolResponse.functionResponses.length,2);emit({serverContent:{modelTurn:{parts:[{text:'done'}]},turnComplete:true}});}}})},{run:runner.runOperation.bind(runner),maxFrames:10,maxFrameChars:2000,authorize(){}});
 await session.text('question');let answer='';for await(const event of session.events()){if(event.type==='tool')await session.tool(event.id,event.name,{ok:true});if(event.type==='text'){answer=event.text;break;}}
 assert.equal(answer,'done');assert.equal(runner.remainingCalls,0);assert.equal(sent.filter(frame=>frame.toolResponse).length,1);assert.equal(sent.some(frame=>frame.type==='response.create'),false);
});

test('same tool ID in a later response rejects prior-generation results before continuation',async()=>{
 const {ModelRunner}=await import('../dist/esm/model/runner.js');const {openProtocolRealtime}=await import('../dist/esm/support/model/lifecycle/session.js');
 const runner=new ModelRunner({provider:{async *stream(){yield 'ok';}},maxCalls:3}).bind({signal:new AbortController().signal});let wake,creates=0;const queue=[];const emit=frame=>{queue.push(frame);wake?.();};
 const session=await openProtocolRealtime({protocol:'openai-realtime',setup:{},connect:async()=>({frames:{async *[Symbol.asyncIterator](){while(true){if(queue.length){const frame=queue.shift();if(frame===null)return;yield frame;}else await new Promise(resolve=>wake=resolve);}}},close:async()=>emit(null),send:async frame=>{if(frame.type==='response.create'){creates++;emit({type:'response.created',response:{id:'r'+creates}});emit({type:'response.function_call_arguments.done',response_id:'r'+creates,call_id:'same',name:'lookup',arguments:'{}'});}}})},{run:runner.runOperation.bind(runner),maxFrames:20,maxFrameChars:2000,authorize(){}});
 await session.text('question');const iterator=session.events()[Symbol.asyncIterator]();const first=(await iterator.next()).value;await session.tool('same','lookup',{result:1},first.generation);
 emit({type:'response.done',response:{id:'r1',status:'completed'}});const waiting=(await iterator.next()).value;assert.equal(waiting.type,'tool-wait');const second=(await iterator.next()).value;assert.ok(second.generation>first.generation);
 await assert.rejects(session.tool('same','lookup',{late:true},first.generation),/current generation/);assert.equal(creates,2);await session.close();
});
test('interrupted late tool result never restarts a realtime generation',async()=>{
 const {ModelRunner}=await import('../dist/esm/model/runner.js');const {openProtocolRealtime}=await import('../dist/esm/support/model/lifecycle/session.js');
 const runner=new ModelRunner({provider:{async *stream(){yield 'ok';}},maxCalls:3}).bind({signal:new AbortController().signal});let wake,creates=0;const queue=[];const emit=frame=>{queue.push(frame);wake?.();};
 const session=await openProtocolRealtime({protocol:'openai-realtime',setup:{},connect:async()=>({frames:{async *[Symbol.asyncIterator](){while(true){if(queue.length){const frame=queue.shift();if(frame===null)return;yield frame;}else await new Promise(resolve=>wake=resolve);}}},close:async()=>emit(null),send:async frame=>{if(frame.type==='response.create'){creates++;emit({type:'response.created',response:{id:'r'}});emit({type:'response.function_call_arguments.done',response_id:'r',call_id:'one',name:'lookup',arguments:'{}'});}}})},{run:runner.runOperation.bind(runner),maxFrames:20,maxFrameChars:2000,authorize(){}});
 await session.text('question');const iterator=session.events()[Symbol.asyncIterator]();const proposal=(await iterator.next()).value;await session.interrupt();await assert.rejects(session.tool(proposal.id,proposal.name,{late:true},proposal.generation),/current generation/);assert.equal(creates,1);assert.equal(runner.remainingCalls,2);await session.close();
});

test('Gemini independent toolCall emits one tool-wait and scalar results become native response objects',async()=>{
 const {ModelRunner}=await import('../dist/esm/model/runner.js');const {openProtocolRealtime}=await import('../dist/esm/support/model/lifecycle/session.js');const {realtimeToolResult}=await import('../dist/esm/support/model/lifecycle/realtime.js');
 assert.deepEqual(realtimeToolResult('gemini-live','id','lookup','scalar').toolResponse.functionResponses[0].response,{result:'scalar'});
 const runner=new ModelRunner({provider:{async *stream(){yield 'ok';}},maxCalls:2}).bind({signal:new AbortController().signal});
 let wake;const queue=[],sent=[];const emit=frame=>{queue.push(frame);wake?.();};
 const session=await openProtocolRealtime({protocol:'gemini-live',setup:{},connect:async()=>({frames:{async *[Symbol.asyncIterator](){while(true){if(queue.length){const frame=queue.shift();if(frame===null)return;yield frame;}else await new Promise(resolve=>wake=resolve);}}},close:async()=>emit(null),send:async frame=>{sent.push(frame);if(frame.clientContent)emit({toolCall:{functionCalls:[{id:'a',name:'lookup',args:{}}]}});if(frame.toolResponse){assert.deepEqual(frame.toolResponse.functionResponses[0].response,{result:'scalar'});emit({serverContent:{modelTurn:{parts:[{text:'final'}]},turnComplete:true}});}}})},{run:runner.runOperation.bind(runner),maxFrames:10,maxFrameChars:2000,authorize(){}});
 await session.text('question');const iterator=session.events()[Symbol.asyncIterator]();const stage=(await iterator.next()).value;assert.equal(stage.type,'tool-wait');
 const proposal=(await iterator.next()).value;assert.equal(proposal.type,'tool');await session.tool(proposal.id,proposal.name,'scalar',proposal.generation);
 assert.equal((await iterator.next()).value.type,'text');assert.equal((await iterator.next()).value.type,'completed');assert.equal(sent.filter(frame=>frame.toolResponse).length,1);await session.close();
});

test('a lost local save acknowledgement preserves the confirmed remote result for reconciliation', async () => {
  const { ModelRunner } = await import('../dist/esm/model/runner.js');
  const signal = new AbortController().signal;
  const runner = new ModelRunner({ provider: { async *stream() {} }, maxCalls: 1 }).bind({ signal });
  const identity = { ...handle, itemIds: ['a'] };
  const provider = { async invoke({ handle: reserved }, context) {
    context.markDispatched();
    return { handle: { ...reserved, remoteId: 'confirmed' }, status: 'completed', value: 'finished' };
  } };
  const saves = [];
  const cause = Error('storage acknowledgement lost');
  await assert.rejects(runModelOperation(provider, { action: 'submit', handle: identity }, {
    ...ports(),
    run: runner.runOperation.bind(runner),
    async save(result) {
      saves.push(structuredClone(result));
      throw cause;
    },
  }), (error) => {
    assert.equal(error.code, 'MODEL_OPERATION_SAVE_UNCONFIRMED');
    assert.equal(error.cause, cause);
    assert.deepEqual(error.result, saves[0]);
    return true;
  });
  assert.deepEqual(saves.map(result => result.status), ['completed']);
  assert.equal(saves[0].handle.remoteId, 'confirmed');
  assert.equal(runner.totalCallCount, 1);
});

test('failure to record an uncertain submission keeps both provider and storage errors', async () => {
  const providerError = Error('lost remote connection');
  const storageError = Error('save unavailable');
  await assert.rejects(runModelOperation({ async invoke(_request, context) {
    context.markDispatched();
    throw providerError;
  } }, { action: 'submit', handle }, {
    ...ports(),
    async save(result) {
      assert.equal(result.status, 'unknown');
      throw storageError;
    },
  }), (error) => error instanceof AggregateError &&
    error.errors[0] === providerError && error.errors[1] === storageError);
});

test('rejected realtime text and audio commits leave the admitted turn and its frames intact', async () => {
  const { ModelRunner } = await import('../dist/esm/model/runner.js');
  const { openProtocolRealtime } = await import('../dist/esm/support/model/lifecycle/session.js');
  const signal = new AbortController().signal;
  for (const firstAction of ['text', 'commitAudio']) {
    const runner = new ModelRunner({ provider: { async *stream() {} }, maxCalls: 1 }).bind({ signal });
    const sent = [];
    const session = await openProtocolRealtime({
      protocol: 'openai-realtime', setup: {},
      async connect() {
        return {
          async send(frame) { sent.push(frame.type); },
          async close() {},
          frames: (async function* () {
            yield { type: 'response.created', response: { id: 'first' } };
            yield { type: 'response.output_text.delta', response_id: 'first', delta: 'first answer' };
          })(),
        };
      },
    }, { run: runner.runOperation.bind(runner), maxFrames: 10, maxFrameChars: 2000, authorize() {} });
    await session[firstAction]('first text');
    await assert.rejects(session.text('rejected'), { code: 'BUDGET' });
    await assert.rejects(session.commitAudio(), { code: 'BUDGET' });
    assert.equal(session.generation, 1);
    assert.deepEqual(sent, [
      'session.update',
      firstAction === 'text' ? 'conversation.item.create' : 'input_audio_buffer.commit',
      'response.create',
    ]);
    const events = session.events();
    assert.deepEqual((await events.next()).value, { generation: 1, type: 'text', text: 'first answer' });
    await events.return();
  }
});

test('closing a partially sent realtime turn prevents later sends', async () => {
  const { openProtocolRealtime } = await import('../dist/esm/support/model/lifecycle/session.js');
  let closed = 0;
  const sent = [];
  const session = await openProtocolRealtime({
    protocol: 'openai-realtime', setup: {},
    async connect() {
      return {
        async send(frame) {
          sent.push(frame.type);
          if (frame.type === 'response.create') throw Error('transport failed');
        },
        async close() { closed++; },
        frames: (async function* () {})(),
      };
    },
  }, { run: ports().run, maxFrames: 10, maxFrameChars: 2000, authorize() {} });
  await assert.rejects(session.text('first'), /transport failed/);
  await assert.rejects(session.text('second'), /Stale/);
  await session.close();
  assert.equal(closed, 1);
  assert.deepEqual(sent, ['session.update', 'conversation.item.create', 'response.create']);
});

test('a late realtime interrupt acknowledgement cannot invalidate a newer generation', async () => {
  const gate = Promise.withResolvers(), entered = Promise.withResolvers();
  const session = await openModelRealtime({
    async connect() {
      return {
        async send(frame) {
          if (frame.type !== 'interrupt') return;
          entered.resolve();
          await gate.promise;
        },
        async close() {},
        frames: (async function* () { yield { generation: 1, result: 'new reply' }; })(),
      };
    },
  }, { ...ports(), maxFrames: 10, maxFrameChars: 100, generationOf: frame => frame.generation });
  const old = session.interrupt({ type: 'interrupt' }, () => assert.fail('stale interrupt advanced'));
  await entered.promise;
  assert.equal(await session.generate({ type: 'generate' }, 'input'), 1);
  gate.resolve();
  await old;
  const events = session.events();
  assert.equal((await events.next()).value.frame.result, 'new reply');
  await events.return();
});

const httpBounds = { baseUrl: 'https://example.test/v1', apiKey: 'fixture', model: 'fixture' };

test('a completed batch keeps valid siblings when a result lacks a terminal event', async () => {
  const { createBatchModelProvider } = await import('../dist/esm/support/model/lifecycle/batch.js');
  const choice = { index: 0, message: { role: 'assistant', content: 'answer' } };
  const rows = [
    { custom_id: 'a', response: { status_code: 200, body: { choices: [choice] } } },
    { custom_id: 'b', response: { status_code: 200, body: { choices: [{ ...choice, finish_reason: 'stop' }] } } },
    { custom_id: 'c', response: { status_code: 200, body: { choices: [{ ...choice, finish_reason: 'invalid' }] } } },
  ];
  const provider = createBatchModelProvider({
    ...httpBounds, protocol: 'openai-batch', completionProtocol: 'chat-completions',
    async request(url) {
      return url.includes('/content') ? new Response(rows.map(row => JSON.stringify(row)).join('\n'))
        : Response.json({ id: 'remote', status: 'completed', output_file_id: 'output' });
    },
  });
  const result = await provider.invoke({
    action: 'read', handle: { ...handle, protocol: 'openai-batch', remoteId: 'remote', itemIds: ['a', 'b', 'c'] },
  }, { signal: new AbortController().signal });
  assert.equal(result.status, 'completed');
  assert.deepEqual(result.value[0], { id: 'a', status: 'failed', error: { code: 'BATCH_ITEM_TERMINAL_MISSING' } });
  assert.equal(result.value[1].status, 'completed');
  assert.equal(result.value[1].value[0], 'answer');
  assert.deepEqual(result.value[2], { id: 'c', status: 'failed', error: { code: 'BATCH_ITEM_PROTOCOL' } });
});

test('non-SSE provider and operation JSON cap streamed bytes and cancel oversized bodies', async () => {
  const { createModelProvider } = await import('../dist/esm/support/model/provider-factory.js');
  const { ModelRunner } = await import('../dist/esm/model/runner.js');
  const bytes = new TextEncoder().encode('{"extra":"' + '字'.repeat(50));
  let cancelled = 0;
  const request = async () => new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(bytes.subarray(0, 20));
      controller.enqueue(bytes.subarray(20));
    },
    cancel() { cancelled++; },
  }));
  const signal = new AbortController().signal;
  const provider = createModelProvider({
    ...httpBounds, request, protocol: 'chat-completions', stream: false, maxResponseBytes: 60,
  });
  const model = new ModelRunner({ provider, maxOutputChars: 10 });
  await assert.rejects(model.invoke('test'), { code: 'MODEL_RESPONSE_LIMIT' });
  const operation = createOperationHttpProvider({
    ...httpBounds, request, protocol: 'responses', maxResponseBytes: 60,
  });
  await assert.rejects(operation.invoke({
    action: 'query', handle: { ...handle, remoteId: 'r' },
  }, { signal }), { code: 'MODEL_RESPONSE_LIMIT' });
  assert.equal(cancelled, 2);
  assert.throws(() => createOperationHttpProvider({
    ...httpBounds, request, protocol: 'responses', maxResponseBytes: 60, maxJsonlLineBytes: 61,
  }), /response limits/);
});

test('aborting a pending HTTP body read cancels and releases the stream', async () => {
  const controller = new AbortController();
  const reading = Promise.withResolvers();
  let cancelled = false;
  const body = new ReadableStream({
    pull() { reading.resolve(); return new Promise(() => {}); },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  const operation = createOperationHttpProvider({
    ...httpBounds, protocol: 'responses', request: async () => new Response(body),
  });
  const pending = operation.invoke({
    action: 'query', handle: { ...handle, remoteId: 'r' },
  }, { signal: controller.signal });
  await reading.promise;
  const reason = Error('stop reading');
  controller.abort(reason);
  await assert.rejects(pending, error => error === reason);
  assert.equal(cancelled, true);
  assert.equal(body.locked, false);
});

test('Anthropic batch JSONL applies byte and item bounds across chunks including split UTF-8', async () => {
  const read = (text, options = {}) => {
    const bytes = new TextEncoder().encode(text);
    const operation = createOperationHttpProvider({
      ...httpBounds, protocol: 'anthropic-batch', ...options,
      request: async () => new Response(new ReadableStream({
        start(controller) {
          for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
          controller.close();
        },
      })),
    });
    return operation.invoke({
      action: 'read', handle: { ...handle, protocol: 'anthropic-batch', remoteId: 'r' },
    }, { signal: new AbortController().signal });
  };
  const row = '{"custom_id":"a","text":"你好"}';
  assert.deepEqual((await read('\r\n' + row + '\r\n{"custom_id":"b"}')).value.results, [
    { custom_id: 'a', text: '你好' }, { custom_id: 'b' },
  ]);
  await assert.rejects(read(row, { maxJsonlLineBytes: row.length }), /line byte limit/);
  await assert.rejects(read(row + '\n\n' + row, { maxResponseBytes: row.length + 15 }), /response byte limit/);
  await assert.rejects(read(row + '\n' + row + '\n' + row), /item limit/);
});

test('OpenAI batch output and error files share the reserved item limit', async () => {
  const { createBatchModelProvider } = await import('../dist/esm/support/model/lifecycle/batch.js');
  const provider = createBatchModelProvider({
    ...httpBounds, protocol: 'openai-batch',
    async request(url) {
      if (url.includes('/output/')) return new Response('{"custom_id":"a"}\n{"custom_id":"b"}');
      if (url.includes('/errors/')) return new Response('{"custom_id":"a"}');
      return Response.json({ status: 'completed', output_file_id: 'output', error_file_id: 'errors' });
    },
  });
  await assert.rejects(provider.invoke({
    action: 'read', handle: { ...handle, protocol: 'openai-batch', remoteId: 'r' },
  }, { signal: new AbortController().signal }), { code: 'MODEL_RESPONSE_LIMIT' });
});

test('concurrent realtime turns cannot interleave their protocol frames', async () => {
  const { openProtocolRealtime } = await import('../dist/esm/support/model/lifecycle/session.js');
  const gate = Promise.withResolvers(), entered = Promise.withResolvers();
  const sent = [];
  const session = await openProtocolRealtime({
    protocol: 'openai-realtime', setup: {},
    async connect() {
      return {
        async send(frame) {
          sent.push(frame.type);
          if (frame.type === 'conversation.item.create' && sent.length === 2) {
            entered.resolve();
            await gate.promise;
          }
        },
        async close() {},
        frames: (async function* () {})(),
      };
    },
  }, { run: ports().run, maxFrames: 10, maxFrameChars: 2000, authorize() {} });
  const first = session.text('first');
  await entered.promise;
  await assert.rejects(session.text('overlap'), /send in progress/);
  assert.equal(session.generation, 1);
  gate.resolve();
  await first;
  await session.text('next');
  assert.deepEqual(sent, [
    'session.update', 'conversation.item.create', 'response.create',
    'conversation.item.create', 'response.create',
  ]);
  await session.close();
});

test('Gemini blocks text and audio commit until the interrupted turn is acknowledged', async () => {
  const { openProtocolRealtime } = await import('../dist/esm/support/model/lifecycle/session.js');
  const sent = [];
  const acknowledged = Promise.withResolvers(), nextTurn = Promise.withResolvers();
  const session = await openProtocolRealtime({
    protocol: 'gemini-live', setup: {},
    async connect() {
      return {
        async send(frame) { sent.push(frame); },
        async close() {},
        frames: (async function* () {
          yield { serverContent: { modelTurn: { parts: [{ text: 'late old output' }] } } };
          yield { serverContent: { interrupted: true } };
          acknowledged.resolve();
          await nextTurn.promise;
          yield { serverContent: { modelTurn: { parts: [{ text: 'new answer' }] } } };
        })(),
      };
    },
  }, { run: ports().run, maxFrames: 10, maxFrameChars: 2000, authorize() {} });
  await session.text('first');
  await session.interrupt();
  const generation = session.generation;
  const count = sent.length;
  await assert.rejects(session.text('too early'), /not been acknowledged/);
  await assert.rejects(session.commitAudio(), /not been acknowledged/);
  assert.equal(session.generation, generation);
  assert.equal(sent.length, count);
  const events = session.events();
  const output = events.next();
  await acknowledged.promise;
  await session.commitAudio();
  nextTurn.resolve();
  assert.deepEqual((await output).value, { generation: generation + 1, type: 'text', text: 'new answer' });
  assert.equal(session.generation, generation + 1);
  assert.deepEqual(sent.at(-1), { realtimeInput: { activityEnd: {} } });
  await events.return();
});

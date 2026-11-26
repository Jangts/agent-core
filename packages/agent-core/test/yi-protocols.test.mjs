import test from 'node:test';
import assert from 'node:assert/strict';
import {createModelProvider} from '../dist/esm/support/model/provider-factory.js';
const fixtures={
 'chat-completions':{choices:[{index:0,message:{content:'ok',tool_calls:[{id:'c1',function:{name:'lookup',arguments:'{"q":"x"}'}}]},finish_reason:'tool_calls'}]},
 responses:{status:'completed',output:[{type:'message',content:[{type:'output_text',text:'ok'}]},{type:'function_call',call_id:'c1',name:'lookup',arguments:'{"q":"x"}'}]},
 messages:{content:[{type:'text',text:'ok'},{type:'tool_use',id:'c1',name:'lookup',input:{q:'x'}}],stop_reason:'tool_use'},
 'generate-content':{candidates:[{index:0,content:{parts:[{text:'ok'},{functionCall:{id:'c1',name:'lookup',args:{q:'x'}}}]},finishReason:'STOP'}]},
 interactions:{status:'requires_action',steps:[{type:'model_output',content:[{type:'text',text:'ok'}]},{type:'function_call',id:'c1',name:'lookup',arguments:{q:'x'}}]},
};
for(const [protocol,fixture]of Object.entries(fixtures))test(`${protocol} full text + tool and second result turn`,async()=>{
 const bodies=[];
 const provider=createModelProvider({protocol,baseUrl:'https://model.invalid/v1',apiKey:'fixture',model:'test',stream:false,scope:'user:fixture',request:async(url,init)=>{bodies.push(JSON.parse(init.body));return Response.json(fixture);}});
 let state;
 const options={functions:[{name:'lookup',description:'lookup',parameters:{type:'object',properties:{q:{type:'string'}},required:['q']}}],onContinuation:value=>state=value};
 const first=[];for await(const item of provider.stream([{role:'user',content:'find x'}],{signal:new AbortController().signal,options}))first.push(item);
 assert.equal(first[0],'ok');assert.equal(first[1].name,'lookup');assert.deepEqual(JSON.parse(first[1].arguments),{q:'x'});
 const second=[{role:'user',content:'find x'},{role:'assistant',content:'ok',toolCalls:[{id:'c1',name:'lookup',arguments:'{"q":"x"}'}]},{role:'tool',content:'found',toolCallId:'c1'}];
 for await(const item of provider.stream(second,{signal:new AbortController().signal,options:{...options,continuation:state}})){}
 assert.equal(bodies.length,2);assert.match(JSON.stringify(bodies[1]),/found/);
});
test('SSE fragmented arguments, usage-only frame, terminal, and premature EOF',async()=>{
 const chunks=[{choices:[{index:0,delta:{tool_calls:[{index:0,id:'c',function:{name:'lookup',arguments:'{"q":'}}]}}]},{choices:[{index:0,delta:{tool_calls:[{index:0,function:{arguments:'"x"}'}}]},finish_reason:'tool_calls'}]},{choices:[],usage:{prompt_tokens:3,completion_tokens:2,total_tokens:5}}];
 const make=values=>createModelProvider({protocol:'chat-completions',baseUrl:'https://model.invalid',apiKey:'fixture',model:'test',request:async()=>new Response(values.map(v=>`data: ${JSON.stringify(v)}\n\n`).join(''),{headers:{'content-type':'text/event-stream'}})});
 const events=[];for await(const p of make(chunks).streamEvents([{role:'user',content:'x'}],{signal:new AbortController().signal}))events.push(p);
 assert.equal(events.filter(e=>e.type==='completion').length,1);assert.equal(events.at(-1).usage.totalTokens,5);
 await assert.rejects(async()=>{for await(const p of make(chunks.slice(0,1)).streamEvents([],{signal:new AbortController().signal})){}},/terminal/);
});
test('portable schema rejects loss of constraints before I/O',async()=>{
 let called=false;const p=createModelProvider({protocol:'messages',baseUrl:'https://model.invalid',apiKey:'fixture',model:'test',request:async()=>{called=true;throw new Error('unexpected');}});
 await assert.rejects(async()=>{for await(const x of p.stream([],{signal:new AbortController().signal,options:{functions:[{name:'lookup',description:'',parameters:{type:'object',oneOf:[]}}]}})){}},/lookup.oneOf/);assert.equal(called,false);
});
test('Messages and Interactions compile native schema and required tool selection',async()=>{
 for(const protocol of ['messages','interactions']){
  let body;const p=createModelProvider({protocol,baseUrl:'https://model.invalid',apiKey:'fixture',model:'test',stream:false,request:async(url,init)=>{body=JSON.parse(init.body);return Response.json(fixtures[protocol]);}});
  for await(const x of p.stream([],{signal:new AbortController().signal,options:{outputSchema:{type:'object',properties:{q:{type:'string'}}},functions:[{name:'lookup',description:'',parameters:{type:'object',properties:{}}}],toolChoice:'required'}})){}
  assert.equal(protocol==='messages'?body.output_config.format.type:body.response_format.mime_type,protocol==='messages'?'json_schema':'application/json');
  assert.equal(protocol==='messages'?body.tool_choice.type:body.generation_config.tool_choice,'any');
 }
});
test('signed Messages blocks replay only in matching identity and endpoint',async()=>{
 let state;const bodies=[];
 const p=createModelProvider({protocol:'messages',baseUrl:'https://model.invalid/v1',apiKey:'fixture',model:'test',scope:'owner:1',stream:false,request:async(url,init)=>{bodies.push(JSON.parse(init.body));return Response.json({content:[{type:'thinking',thinking:'private',signature:'signed'},{type:'tool_use',id:'t',name:'lookup',input:{}}],stop_reason:'tool_use'});}});
 for await(const x of p.stream([],{signal:new AbortController().signal,options:{onContinuation:x=>state=x}})){}
 const messages=[{role:'assistant',content:'',toolCalls:[{id:'t',name:'lookup',arguments:'{}'}]},{role:'tool',content:'answer',toolCallId:'t'}];
 for await(const x of p.stream(messages,{signal:new AbortController().signal,options:{continuation:state}})){}
 assert.equal(bodies[1].messages[0].content[0].signature,'signed');
 await assert.rejects(async()=>{for await(const x of p.stream(messages,{signal:new AbortController().signal,options:{continuation:{...state,scope:'owner:2'}}})){}},/scope/);
 await assert.rejects(async()=>{for await(const x of p.stream(messages,{signal:new AbortController().signal,options:{continuation:{...state,data:{...state.data,endpoint:'https://other.invalid'}}}})){}},/continuation/i);
});
import { ProtocolDecoder } from '../dist/esm/support/model/protocols/responses.js';
test('native refusal is single terminal, pause is incomplete, unknown content is rejected',()=>{
 const refusal=new ProtocolDecoder('responses').decode({status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'no'}]}]},true);
 assert.equal(refusal.filter(x=>x.type==='completion').length,1);assert.equal(refusal.at(-1).status,'refused');
 assert.equal(new ProtocolDecoder('messages').decode({content:[],stop_reason:'pause_turn'},true).at(-1).status,'incomplete');
 assert.throws(()=>new ProtocolDecoder('responses').decode({status:'completed',output:[{type:'image_generation_call'}]},true),/Unsupported/);
 assert.throws(()=>new ProtocolDecoder('messages').decode({type:'content_block_start',index:0,content_block:{type:'server_tool_use'}}),/Unsupported/);
 assert.throws(()=>new ProtocolDecoder('responses').decode({type:'response.new_required_event'}),/Unsupported/);
 const decoder=new ProtocolDecoder('chat-completions');decoder.decode({choices:[{delta:{content:'a'},finish_reason:'stop'}]});
 assert.throws(()=>decoder.decode({choices:[{delta:{content:'late'}}]}),/after terminal/);
});
const streams={
 responses:[{type:'response.output_item.added',output_index:0,item:{type:'function_call',call_id:'c1',name:'lookup'}},{type:'response.function_call_arguments.delta',output_index:0,delta:'{"q":"x"}'},{type:'response.output_item.done',output_index:0,item:{type:'function_call',call_id:'c1',name:'lookup',arguments:'{"q":"x"}'}},{type:'response.completed',response:{status:'completed'}}],
 messages:[{type:'content_block_start',index:0,content_block:{type:'thinking',thinking:''}},{type:'content_block_delta',index:0,delta:{type:'thinking_delta',thinking:'private'}},{type:'content_block_delta',index:0,delta:{type:'signature_delta',signature:'signed'}},{type:'content_block_stop',index:0},{type:'content_block_start',index:1,content_block:{type:'tool_use',id:'c1',name:'lookup',input:{}}},{type:'content_block_delta',index:1,delta:{type:'input_json_delta',partial_json:'{"q":"x"}'}},{type:'content_block_stop',index:1},{type:'message_delta',delta:{stop_reason:'tool_use'},usage:{output_tokens:5}},{type:'message_stop'}],
 'generate-content':[{candidates:[{index:0,content:{parts:[{functionCall:{id:'c1',name:'lookup',args:{q:'x'}},thoughtSignature:'signed'}]},finishReason:'STOP'}]}],
 interactions:[{event_type:'step.start',index:0,step:{type:'thought'}},{event_type:'step.delta',index:0,delta:{type:'thought_signature',signature:'signed'}},{event_type:'step.stop',index:0},{event_type:'step.start',index:1,step:{type:'function_call',id:'c1',name:'lookup',arguments:{}}},{event_type:'step.delta',index:1,delta:{type:'arguments_delta',arguments:'{"q":"x"}'}},{event_type:'step.stop',index:1},{event_type:'interaction.completed',interaction:{status:'requires_action'}}],
};
for(const [protocol,frames]of Object.entries(streams))test(`${protocol} official SSE event shapes preserve tool arguments and signed replay`,async()=>{
 const p=createModelProvider({protocol,baseUrl:'https://model.invalid',apiKey:'fixture',model:'test',scope:'owner:1',request:async()=>new Response(frames.map(x=>`data: ${JSON.stringify(x)}\n\n`).join(''),{headers:{'content-type':'text/event-stream'}})});
 const events=[];for await(const e of p.streamEvents([],{signal:new AbortController().signal}))events.push(e);
 const calls=events.filter(x=>x.type==='function-call-delta');assert.equal(calls[0].name,'lookup');assert.equal(calls.map(x=>x.arguments??'').join(''),'{"q":"x"}');
 assert.equal(events.filter(x=>x.type==='completion').length,1);assert.equal(events.find(x=>x.type==='completion').status,'tool-calls');
 const state=events.find(x=>x.type==='continuation');assert.ok(state);if(protocol!=='responses')assert.match(JSON.stringify(state),/signed/);
});
import {prepareModelRequest} from '../dist/esm/support/model/protocols/preparation.js';
test('shared batch/direct preflight enforces constraints and preserves typed tool text',()=>{
 const config={protocol:'generate-content',model:'test',baseUrl:'https://model.invalid',stream:false};
 const request=prepareModelRequest(config,[{role:'assistant',content:'',toolCalls:[{id:'c',name:'lookup',arguments:'{}'}]},{role:'tool',toolCallId:'c',content:'',parts:[{type:'text',text:'actual'}]}]);
 assert.equal(request.contents[1].parts[0].functionResponse.response.result,'actual');
 assert.throws(()=>prepareModelRequest(config,[],{functions:[{name:'lookup',description:'',parameters:{type:'object',oneOf:[]}}]}),/oneOf/);
 assert.throws(()=>prepareModelRequest(config,[],{functions:[{name:'lookup',description:'',parameters:{type:'object'},strict:true}]}),/Strict/);
 assert.throws(()=>prepareModelRequest(config,[{role:'user',content:'',parts:[{type:'unknown',url:'x'}]}]),/modality/);
});
test('legacy stream cannot silently discard generated media',async()=>{
 const p=createModelProvider({protocol:'generate-content',baseUrl:'https://model.invalid',apiKey:'fixture',model:'test',stream:false,request:async()=>Response.json({candidates:[{index:0,content:{parts:[{inlineData:{mimeType:'image/png',data:'AA=='}}]},finishReason:'STOP'}]})});
 await assert.rejects(async()=>{for await(const value of p.stream([],{signal:new AbortController().signal})){}},/content-aware/);
 const events=[];for await(const value of p.streamEvents([],{signal:new AbortController().signal}))events.push(value);
 assert.equal(events[0].type,'content');assert.equal(events[0].content.type,'image');
});
const hostedFixtures={
 responses:{tools:[{type:'web_search'}],response:{status:'completed',output:[{type:'web_search_call',id:'s',status:'completed',action:{type:'search',sources:[{url:'https://source.invalid'}]}},{type:'message',content:[{type:'output_text',text:'answer'}]}]}},
 messages:{tools:[{type:'web_search_20250305',name:'web_search',max_uses:1}],response:{content:[{type:'server_tool_use',id:'s',name:'web_search',input:{query:'x'}},{type:'web_search_tool_result',tool_use_id:'s',content:[{type:'web_search_result',url:'https://source.invalid',encrypted_content:'encrypted'}]},{type:'text',text:'answer'}],stop_reason:'end_turn'}},
 interactions:{tools:[{type:'google_search'}],response:{status:'completed',steps:[{type:'google_search_call',id:'s',arguments:{queries:['x']}},{type:'google_search_result',call_id:'s',result:[{url:'https://source.invalid'}]},{type:'model_output',content:[{type:'text',text:'answer'}]}]}},
};
for(const [protocol,fixture]of Object.entries(hostedFixtures))test(`${protocol} explicitly authorized hosted search stays remote and preserves source/state`,async()=>{
 let authorizations=0,state;const observations=[],bodies=[];
 const p=createModelProvider({protocol,baseUrl:'https://model.invalid',model:'test',apiKey:'fixture',stream:false,scope:'owner:1',hostedTools:fixture.tools,authorizeHostedTools(){authorizations++;},onHostedToolEvent:event=>observations.push(event),request:async(url,init)=>{bodies.push(JSON.parse(init.body));return Response.json(fixture.response);}});
 for(let turn=0;turn<2;turn++){
  const values=[];for await(const v of p.stream([{role:'user',content:'search'}],{signal:new AbortController().signal,options:{onContinuation:v=>state=v}}))values.push(v);
  assert.deepEqual(values,['answer']);
 }
 assert.equal(authorizations,2);assert.deepEqual(bodies[0].tools,fixture.tools);assert.ok(observations.every(x=>x.source==='provider'));assert.match(JSON.stringify(observations),/source.invalid/);assert.ok(state);
 const unconfigured=createModelProvider({protocol,baseUrl:'https://model.invalid',model:'test',apiKey:'fixture',stream:false,request:async()=>Response.json(fixture.response)});
 await assert.rejects(async()=>{for await(const x of unconfigured.stream([],{signal:new AbortController().signal})){}},/Unconfigured/);
});
test('hosted tools require per-request authorization and callback failure never resubmits',async()=>{
 let calls=0;const base={protocol:'responses',baseUrl:'https://model.invalid',model:'test',apiKey:'fixture',stream:false,hostedTools:[{type:'web_search'}],request:async()=>{calls++;return Response.json(hostedFixtures.responses.response);}};
 assert.throws(()=>createModelProvider(base),/authorization/);
 const denied=createModelProvider({...base,authorizeHostedTools:()=>false});
 await assert.rejects(async()=>{for await(const x of denied.stream([],{signal:new AbortController().signal})){}},/denied/);assert.equal(calls,0);
 const failed=createModelProvider({...base,authorizeHostedTools(){},onHostedToolEvent(){throw Error('sink failed');}});
 await assert.rejects(async()=>{for await(const x of failed.stream([],{signal:new AbortController().signal})){}},/sink failed/);assert.equal(calls,1);
});
for(const protocol of ['responses','messages','interactions'])test(`${protocol} SSE hosted search frames never become local tool calls`,async()=>{
 const fixture=hostedFixtures[protocol];let frames;
 if(protocol==='responses')frames=[{type:'response.output_item.added',item:fixture.response.output[0]},{type:'response.web_search_call.searching',item_id:'s'},{type:'response.output_item.done',item:fixture.response.output[0]},{type:'response.output_text.delta',delta:'answer'},{type:'response.completed',response:{status:'completed'}}];
 if(protocol==='messages')frames=[{type:'content_block_start',index:0,content_block:{type:'server_tool_use',id:'s',name:'web_search'}},{type:'content_block_delta',index:0,delta:{type:'input_json_delta',partial_json:'{"query":"x"}'}},{type:'content_block_stop',index:0},{type:'content_block_start',index:1,content_block:fixture.response.content[1]},{type:'content_block_stop',index:1},{type:'content_block_start',index:2,content_block:{type:'text',text:''}},{type:'content_block_delta',index:2,delta:{type:'text_delta',text:'answer'}},{type:'content_block_delta',index:2,delta:{type:'citations_delta',citation:{url:'https://source.invalid'}}},{type:'content_block_stop',index:2},{type:'message_delta',delta:{stop_reason:'end_turn'}}];
 if(protocol==='interactions')frames=[{event_type:'step.start',index:0,step:fixture.response.steps[0]},{event_type:'step.delta',index:0,delta:{type:'google_search_call',arguments:{queries:['x']}}},{event_type:'step.stop',index:0},{event_type:'step.start',index:1,step:fixture.response.steps[1]},{event_type:'step.stop',index:1},{event_type:'step.start',index:2,step:{type:'model_output'}},{event_type:'step.delta',index:2,delta:{type:'text',text:'answer'}},{event_type:'step.stop',index:2},{event_type:'interaction.completed',interaction:{status:'completed'}}];
 const observed=[];const p=createModelProvider({protocol,baseUrl:'https://model.invalid',model:'test',apiKey:'fixture',hostedTools:fixture.tools,authorizeHostedTools(){},onHostedToolEvent:e=>observed.push(e),request:async()=>new Response(frames.map(x=>`data: ${JSON.stringify(x)}\n\n`).join(''),{headers:{'content-type':'text/event-stream'}})});
 const values=[];for await(const x of p.stream([],{signal:new AbortController().signal}))values.push(x);
 assert.deepEqual(values,['answer']);assert.ok(observed.some(x=>x.phase==='completed'));assert.ok(observed.every(x=>x.source==='provider'));
});
test('supplier extension profile snapshots configuration and cannot override Core fields',async()=>{
 const extension={thinking:{type:'disabled'}};let body;
 const p=createModelProvider({protocol:'messages',baseUrl:'https://model.invalid',apiKey:'fixture',model:'test',stream:false,requestBody:extension,request:async(url,init)=>{body=JSON.parse(init.body);return Response.json(fixtures.messages);}});
 extension.thinking.type='enabled';
 for await(const x of p.stream([],{signal:new AbortController().signal})){}
 assert.equal(body.thinking.type,'disabled');
 for(const key of ['model','messages','input','contents','system','stream','tools','tool_choice','max_tokens','max_output_tokens','store','metadata'])assert.throws(()=>createModelProvider({protocol:'responses',baseUrl:'https://model.invalid',apiKey:'fixture',model:'test',requestBody:{[key]:null}}),/cannot override/);
 assert.throws(()=>prepareModelRequest({protocol:'responses',model:'test',baseUrl:'https://model.invalid',requestBody:{output_config:{format:{type:'text'}}}},[]),/only set effort/);
 const merged=prepareModelRequest({protocol:'messages',model:'test',baseUrl:'https://model.invalid',requestBody:{output_config:{effort:'low'}}},[],{outputSchema:{type:'object',properties:{}}});
 assert.equal(merged.output_config.effort,'low');assert.equal(merged.output_config.format.type,'json_schema');
});
for(const streamed of [false,true])test(`Chat private thinking survives all tool-history rounds (${streamed?'SSE':'full'})`,async()=>{
 const bodies=[];let continuation;
 const message={role:'assistant',content:'',reasoning_content:'private thought',tool_calls:[{id:'tool1',type:'function',function:{name:'lookup',arguments:'{}'}}]};
 const provider=createModelProvider({protocol:'chat-completions',baseUrl:'https://model.invalid',apiKey:'fixture',model:'test',scope:'owner:1',stream:streamed,request:async(url,init)=>{
  bodies.push(JSON.parse(init.body));
  return streamed?new Response([{choices:[{index:0,delta:{reasoning_content:'private '}}]},{choices:[{index:0,delta:{reasoning_content:'thought',tool_calls:[{index:0,...message.tool_calls[0]}]}}]},{choices:[{index:0,delta:{},finish_reason:'tool_calls'}]}].map(x=>`data: ${JSON.stringify(x)}\n\n`).join(''),{headers:{'content-type':'text/event-stream'}}):Response.json({choices:[{index:0,message,finish_reason:'tool_calls'}]});
 }});
 const history=[{role:'user',content:'lookup'}];
 for(let round=0;round<3;round++){
  const parts=[];for await(const x of provider.stream(history,{signal:new AbortController().signal,options:{continuation,onContinuation:value=>continuation=value}}))parts.push(x);
  assert.ok(!JSON.stringify(parts).includes('private thought'));
  history.push({role:'assistant',content:'',toolCalls:[{id:'tool1',name:'lookup',arguments:'{}'}]},{role:'tool',toolCallId:'tool1',content:'result'});
 }
 assert.equal(bodies[1].messages[1].reasoning_content,'private thought');
 assert.equal(bodies[2].messages[1].reasoning_content,'private thought');assert.equal(bodies[2].messages[3].reasoning_content,'private thought');
 const bad=structuredClone(history);bad[1].toolCalls[0].name='other';
 await assert.rejects(async()=>{for await(const x of provider.stream(bad,{signal:new AbortController().signal,options:{continuation}})){}},/history mismatch/);
});

test('inline PDF bytes use native file_data fields and preserve mixed content order', async () => {
 for (const protocol of ['responses','chat-completions']) {
  let body;
  const p=createModelProvider({protocol,baseUrl:'https://model.invalid/v1',apiKey:'fixture',model:'test',stream:false,
   request:async(_url,init)=>{body=JSON.parse(init.body);return Response.json(protocol==='responses'?{status:'completed',output:[{type:'message',content:[{type:'output_text',text:'ok'}]}]}:{choices:[{index:0,message:{content:'ok'},finish_reason:'stop'}]});},
  });
  const input=[{role:'user',content:'',parts:[{type:'text',text:'before'},{type:'file',url:'data:application/pdf;base64,JVBERg=='},{type:'text',text:'after'}]}];
  for await (const _ of p.stream(input,{signal:new AbortController().signal})) {}
  const parts=protocol==='responses'?body.input[0].content:body.messages[0].content;
  assert.equal(parts[0].text,'before');assert.equal(parts[2].text,'after');
  const file=protocol==='responses'?parts[1]:parts[1].file;
  assert.equal(file.file_data,'data:application/pdf;base64,JVBERg==');assert.equal(file.filename,'attachment.pdf');
  assert.equal(file.file_url,undefined);
 }
});
for(const protocol of ['responses','messages','generate-content','interactions'])test(`${protocol} anchored state keeps all three signed turns and rejects old history changes before I/O`,async()=>{
 let round=0,state;const bodies=[];
 const provider=createModelProvider({protocol,baseUrl:'https://model.invalid',apiKey:'fixture',model:'test',scope:'owner:1',stream:false,request:async(url,init)=>{
  bodies.push(JSON.parse(init.body));const n=++round,id=`c${n}`,signature=`signature-${n}`;let payload;
  if(protocol==='responses')payload={status:'completed',output:[{type:'reasoning',encrypted_content:signature},{type:'message',content:[{type:'output_text',text:' answer \n'}]},{type:'function_call',call_id:id,name:'lookup',arguments:'{}'}]};
  if(protocol==='messages')payload={stop_reason:'tool_use',content:[{type:'thinking',thinking:'private',signature},{type:'text',text:' answer \n'},{type:'tool_use',id,name:'lookup',input:{}}]};
  if(protocol==='generate-content')payload={candidates:[{index:0,content:{parts:[{thought:true,text:'private',thoughtSignature:signature},{text:' answer \n'},{functionCall:{id,name:'lookup',args:{}}}]},finishReason:'STOP'}]};
  if(protocol==='interactions')payload={status:'requires_action',steps:[{type:'thought',signature},{type:'model_output',content:[{type:'text',text:' answer \n'}]},{type:'function_call',id,name:'lookup',arguments:{}}]};
  return Response.json(payload);
 }});
 const history=[{role:'system',content:'policy'},{role:'user',content:'find'}];
 for(let turn=1;turn<=3;turn++){
  for await(const part of provider.stream(history,{signal:new AbortController().signal,options:{continuation:state,onContinuation:x=>state=x}})){}
  history.push({role:'assistant',content:'answer',toolCalls:[{id:`c${turn}`,name:'lookup',arguments:'{}'}]},{role:'tool',toolCallId:`c${turn}`,content:`result${turn}`});
 }
 assert.match(JSON.stringify(bodies[2]),/signature-1/);assert.match(JSON.stringify(bodies[2]),/signature-2/);
 assert.equal(state.data.turns.length,3);
 for(const index of [0,1,2,3,4]){
  const bad=structuredClone(history);bad[index].content='different';
  await assert.rejects(async()=>{for await(const part of provider.stream(bad,{signal:new AbortController().signal,options:{continuation:state}})){}},/history|anchor/);
 }
 const badCall=structuredClone(history);badCall[2].toolCalls[0].arguments='{"changed":true}';
 await assert.rejects(async()=>{for await(const part of provider.stream(badCall,{signal:new AbortController().signal,options:{continuation:state}})){}},/history|anchor/);
 const old={...state,data:{endpoint:'https://model.invalid',replay:[]}};
 await assert.rejects(async()=>{for await(const part of provider.stream(history,{signal:new AbortController().signal,options:{continuation:old}})){}},/history|anchor/);
 assert.equal(bodies.length,3);
});
test('continuation treats typed text/images shorthand equivalently and bounds private state',async()=>{
 let state,calls=0;
 const provider=createModelProvider({protocol:'generate-content',baseUrl:'https://model.invalid',apiKey:'fixture',model:'test',scope:'owner:1',stream:false,request:async()=>{calls++;return Response.json({candidates:[{index:0,content:{parts:[{text:' answer \n'}]},finishReason:'STOP'}]});}});
 for await(const x of provider.stream([{role:'user',content:'see',images:[{url:'https://image.invalid/a.png'}]}],{signal:new AbortController().signal,options:{onContinuation:x=>state=x}})){}
 const history=[{role:'user',content:'',parts:[{type:'text',text:'see'},{type:'image',url:'https://image.invalid/a.png'}]},{role:'assistant',content:'answer'}];
 for await(const x of provider.stream(history,{signal:new AbortController().signal,options:{continuation:state}})){}
 assert.equal(calls,2);
 const oversized={...state,data:{...state.data,padding:'x'.repeat(1048577)}};
 await assert.rejects(async()=>{for await(const x of provider.stream(history,{signal:new AbortController().signal,options:{continuation:oversized}})){}},/limit/);assert.equal(calls,2);
});
test('explicit endpoint profile only narrows and rejects schema/tools/modalities before I/O',async()=>{
 let calls=0;
 const config={protocol:'messages',baseUrl:'https://model.invalid',apiKey:'fixture',model:'test',stream:false,capabilities:{jsonSchema:false,tools:false,modalities:['text']},request:async()=>{calls++;return Response.json(fixtures.messages);}};
 const p=createModelProvider(config);
 for(const options of [{json:true},{outputSchema:{type:'object'}},{functions:[{name:'lookup',description:'',parameters:{type:'object'}}]}])await assert.rejects(async()=>{for await(const x of p.stream([],{signal:new AbortController().signal,options})){}},/schema|tools/i);
 await assert.rejects(async()=>{for await(const x of p.stream([{role:'user',content:'',images:[{url:'https://image.invalid'}]}],{signal:new AbortController().signal})){}},/modality/);
 assert.equal(calls,0);
 assert.throws(()=>createModelProvider({...config,capabilities:{modalities:['unverified-format']}}),/widen/);
 assert.throws(()=>createModelProvider({...config,capabilities:{verified:true}}),/verification/);
 let body;const chat=createModelProvider({...config,protocol:'chat-completions',request:async(url,init)=>{body=JSON.parse(init.body);return Response.json({choices:[{index:0,message:{content:'{}'},finish_reason:'stop'}]});}});
 for await(const x of chat.stream([],{signal:new AbortController().signal,options:{json:true}})){}
 assert.equal(body.response_format.type,'json_object');
});

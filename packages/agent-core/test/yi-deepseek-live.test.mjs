import test from 'node:test';
import assert from 'node:assert/strict';
import { ModelRunner, Support } from '../dist/esm/index.js';

// Explicit opt-in. This file never discovers or prints local credentials on its own.
const enabled = process.env.YI_DEEPSEEK_LIVE === '1' && !!process.env.YI_DEEPSEEK_API_KEY;
const model = process.env.YI_DEEPSEEK_MODEL || 'deepseek-flash';
const origin = process.env.YI_DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
const protocols = ['chat-completions', 'responses', 'messages'];
const stats = [];
const scenario = process.env.YI_DEEPSEEK_SCENARIO;
function provider(protocol, stream = true) {
  const publicProfile = process.env.YI_DEEPSEEK_PUBLIC_PROFILE !== '0';
  const profile = protocol === 'responses' ? {reasoning:{effort:scenario === 'thinking' ? 'low' : 'none'}} : {thinking:{type:scenario === 'thinking' ? 'enabled' : 'disabled'}, ...(scenario === 'thinking' ? {reasoning_effort:'low'} : {})};
  return Support.createModelProvider({ protocol, model,
    baseUrl: protocol === 'messages' ? `${origin}/anthropic/v1` : origin,
    ...(publicProfile ? {requestBody:profile} : {}),
    apiKey: process.env.YI_DEEPSEEK_API_KEY, scope: 'synthetic:yi-live:reader', stream,
    request: async (url, init) => {
      const body = JSON.parse(init.body);
      // Public requestBody is the default. Explicit legacy mode 0 only reproduces
      // the initial pre-profile fixture; never use this hook to bypass Core limits.
      if (!publicProfile) Object.assign(body, profile);
      const start = Date.now();
      const response = await fetch(url, { ...init, body: JSON.stringify(body) });
      stats.push({ protocol, status: response.status, ms: Date.now() - start });
      return response;
    },
  });
}
function usage(result) {
  if (result.invocation.usage) stats.push({ usage: result.invocation.usage });
}
for (const protocol of protocols) {
  test(`DeepSeek real ${protocol}: SSE text and authorized tool two-turn continuation`, {skip: !enabled || !!scenario && scenario !== protocol}, async () => {
    const execution = {signal: AbortSignal.timeout(60000)};
    const tools = Support.defineToolCatalog([{
      id: 'lookup', kind: 'read', description: 'Return the synthetic inventory for verification.',
      inputSchema: {jsonSchema: {type: 'object', properties: {q:{type:'string'}},required:['q'], additionalProperties: false}, parse(value) { assert.deepEqual(value, {q:'probe'}); return value; }},
      authorize() {}, execute() { return {inventory: 7}; }, parseOutput(value) { assert.deepEqual(value, {inventory: 7}); return value; },
    }]).bind({app: {}, execution});
    const transport = Support.createModelTransport({id: 'session', response: 'session', tools: tools.tools});
    const runner = new ModelRunner({provider: provider(protocol), transports:[transport], maxCalls:3, maxOutputTokens:256, usage:true, callTimeoutMs:60000}).bind(execution);
    if (!scenario) { const hello = await runner.invoke('Reply with exactly OK, no explanation.'); usage(hello); assert.match(hello.value, /OK/); }
    const history=[{role:'user',content:'Call lookup exactly once with argument q set to the literal string probe. After the result, reply with only the inventory number.'}];
    let state;
    const first = await runner.invoke({input:history,transport,modelOptions:{onContinuation(value){state=value;}}}); usage(first);
    assert.equal(first.value.calls.length,1);
    const call=first.value.calls[0];
    const receipt=await tools.invoke(call);
    history.push({role:'assistant',content:first.value.text,toolCalls:[{id:call.id,name:call.name,arguments:call.arguments}]},
      {role:'tool',toolCallId:call.id,content:JSON.stringify(receipt.value)});
    const second=await runner.invoke({input:history,transport,modelOptions:{continuation:state}}); usage(second);
    assert.equal(second.value.calls.length,0); assert.match(second.value.text,/7/);
  });
}
test('DeepSeek real Chat Completions: full HTTP JSON output and local parser', {skip:!enabled || !!scenario}, async()=>{
 const schema={jsonSchema:{type:'object',properties:{ok:{type:'boolean'}},required:['ok'],additionalProperties:false},parse(value){assert.deepEqual(value,{ok:true});return value;}};
 const transport=Support.createJsonTransport({id:'json',outputSchema:schema});
 const runner=new ModelRunner({provider:provider('chat-completions',false),transports:[transport],maxCalls:1,maxOutputTokens:128,callTimeoutMs:60000,usage:true});
 const result=await runner.invoke({input:'Return the JSON object {"ok":true}, no other content.',transport});usage(result);assert.equal(result.value.ok,true);
});
test('DeepSeek real Flash image input: synthetic red PNG', {skip: !enabled || scenario !== 'image'}, async()=> {
 const runner = new ModelRunner({provider:provider('chat-completions'),maxCalls:1,maxOutputTokens:128,callTimeoutMs:60000,usage:true});
 const result = await runner.invoke({input:[{role:'user',content:'',parts:[{type:'text',text:'Name only the dominant color in English.'},{type:'image',url:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAb0lEQVR4nO3PAQkAAAyEwO9feoshgnABdLep8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3IPanc8OLDQitxAAAAAElFTkSuQmCC'}]}]});
 usage(result);assert.match(result.value,/red/i);
});
test('DeepSeek real thinking tool roundtrip through public profile and private continuation', {skip:!enabled || scenario !== 'thinking'}, async()=>{
 assert.notEqual(process.env.YI_DEEPSEEK_PUBLIC_PROFILE,'0');
 const tools=Support.defineModelTools([{id:'lookup',description:'Read synthetic inventory for q.',inputSchema:{jsonSchema:{type:'object',properties:{q:{type:'string'}},required:['q'],additionalProperties:false},parse(value){assert.deepEqual(value,{q:'probe'});return value;}}}]);
 const transport=Support.createModelTransport({id:'thinking-tools',response:'session',tools});
 const runner=new ModelRunner({provider:provider('chat-completions',false),transports:[transport],maxCalls:2,maxOutputTokens:512,callTimeoutMs:60000,usage:true}).bind({signal:AbortSignal.timeout(120000)});
 let state;
 const history=[{role:'user',content:'Call lookup exactly once with q equal to probe. After its result, reply with only the inventory number.'}];
 const first=await runner.invoke({input:history,transport,modelOptions:{onContinuation(value){state=value;}}});usage(first);
 assert.equal(first.value.calls.length,1);const call=first.value.calls[0];assert.deepEqual(JSON.parse(call.arguments),{q:'probe'});
 assert.ok(state);assert.ok(JSON.stringify(state.data).includes('reasoning_content'));
 history.push({role:'assistant',content:first.value.text,toolCalls:[{id:call.id,name:call.name,arguments:call.arguments}]},{role:'tool',content:'{"inventory":7}',toolCallId:call.id});
 const second=await runner.invoke({input:history,transport,modelOptions:{continuation:state}});usage(second);assert.equal(second.value.calls.length,0);assert.match(second.value.text,/7/);
});
test.after(()=>{if(enabled)console.log('DeepSeek synthetic validation metadata:',JSON.stringify({model,requests:stats.filter(x=>x.protocol).length,stats}));});

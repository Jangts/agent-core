// Optional real LangChain integration. Point at an isolated dependency directory to enable.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {AgentCoreEngine,ModelRunner,defineWorkflow,route} from '../dist/esm/index.js';
const directory=process.env.EXTERNAL_AGENT_DEPENDENCIES;
const enabled=!!directory;
let external;
function dependencies(){
  if(external)return external;
  const require=createRequire(resolve(directory,'package.json'));
  external={...require('langchain'),...require('@langchain/core/messages'),...require('@langchain/core/language_models/chat_models'),z:require('zod').z};
  return external;
}
async function scenario(mode){
  const {BaseChatModel,AIMessage,createAgent,createMiddleware,tool,z}=dependencies();
  let entered=0,returned=0,tools=0,hooks=0,release,ready;
  const pending=new Promise(r=>release=r),started=new Promise(r=>ready=r);
  class LocalModel extends BaseChatModel{
    _llmType(){return 'local-contract-probe';}
    bindTools(){return this;}
    async _generate(messages){
      entered++;
      if(entered===1){assert.equal(messages[0].content,'one');returned++;return {generations:[{text:'',message:new AIMessage({content:'',tool_calls:[{id:'call-1',name:'read_receipt',args:{request:'one'}}]})}]};}
      if(mode==='cancel'){ready();await pending;}
      if(mode==='model-failure')throw new Error('LOCAL_MODEL_FAILURE');
      const result=messages.at(-1);
      assert.equal(result._getType(),'tool');
      if(result.status==='error')throw new Error('TOOL_FAILURE_CONFIRMED');
      assert.ok(String(result.content).includes('receipt:one'));
      returned++;
      return {generations:[{text:'',message:new AIMessage(JSON.stringify({answer:'verified',receipt:'receipt:one',identity:'untrusted',budget:999}))}]};
    }
  }
  const model=new LocalModel({});
  const agent=createAgent({model,tools:[tool(async()=>{tools++;if(mode==='tool-failure')throw new Error('TOOL_FAILURE');return 'receipt:one';},{name:'read_receipt',description:'Read a local receipt',schema:z.object({request:z.literal('one')})})],middleware:[createMiddleware({name:'bounded-local-probe',beforeModel(){hooks++;if(hooks>(mode==='limit'?1:2))throw new Error('EXTERNAL_MODEL_LIMIT');}})]});
  const controller=new AbortController();
  const core=new ModelRunner({provider:{async *stream(){throw new Error('Unexpected Core model call');}},maxCalls:1,execution:{signal:controller.signal}});
  const workflow=defineWorkflow({id:'external-contract',nodes:[{id:'external',description:'Map and validate an independently bounded external Agent',async run(state,ctx){
    const result=await agent.invoke({messages:[{role:'user',content:state.request}]},{signal:ctx.signal,recursionLimit:12});
    ctx.signal.throwIfAborted();
    const value=JSON.parse(result.messages.at(-1).content);
    assert.equal(value.answer,'verified');assert.equal(value.receipt,'receipt:one');
    return {answer:value.answer,receipt:value.receipt};
  },routes:[route.deliver('answer')]}]});
  const state={request:'one',identity:'parent-owner',budget:1};
  const engine=new AgentCoreEngine({execution:{signal:controller.signal}}).bindWorkflow(workflow).bindModelRuntime(core);
  const execution=engine.run(state);
  if(mode==='cancel'){await started;controller.abort(new Error('PARENT_CANCELLED'));await assert.rejects(execution,/PARENT_CANCELLED/);release();await new Promise(r=>setImmediate(r));assert.equal(returned,2);}
  else if(mode==='normal')assert.equal(await execution,'verified');
  else await assert.rejects(execution,new RegExp(mode==='limit'?'EXTERNAL_MODEL_LIMIT':mode==='model-failure'?'LOCAL_MODEL_FAILURE':'TOOL_FAILURE_CONFIRMED'));
  assert.equal(core.totalCallCount,0);assert.equal(state.identity,'parent-owner');assert.equal(state.budget,1);assert.equal(tools,1);
  if(mode!=='normal'){assert.equal(state.answer,undefined);assert.equal(state.receipt,undefined);}
  if(mode==='normal'){assert.equal(entered,2);assert.equal(hooks,2);}
  if(mode==='limit')assert.equal(entered,1);
  return {entered,returned,tools,hooks};
}
for(const mode of ['normal','model-failure','tool-failure','cancel','limit'])test('real external Agent: '+mode,{skip:!enabled,timeout:10000},async()=>{await scenario(mode);});

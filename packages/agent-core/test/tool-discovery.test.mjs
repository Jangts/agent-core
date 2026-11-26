import { mkdir } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Support, ModelToolRegistry } from '../dist/esm/index.js';
import { GoalRegistry, ScopeRegistry, defineAgentCatalog } from '../dist/esm/kits/domains/index.js';
const schema={jsonSchema:{type:'object'},parse:value=>value};
const tool=(id,extra={})=>({id,description:'Operational '+id,inputSchema:schema,resolve:value=>value,...extra});

test('all intent shorthands are view-local, condition-aware and independently active',()=>{
 const context={enabled:true};
 const definitions=[tool('plain'),tool('reuse',{asIntent:true}),tool('named',{asIntent:'User wants a note'}),tool('predicate',{asIntent:ctx=>ctx.enabled}),tool('options',{asIntent:{description:'Demand',when:ctx=>ctx.enabled}}),tool('inactive',{asIntent:true,active:false})];
 const catalog=Support.defineModelTools(definitions);
 assert.deepEqual(catalog.select({ intent: true }, context).ids(),['reuse','named','predicate','options']);
 assert.equal(catalog.select({ intent: true }, context).require('named').description,'User wants a note');
 assert.equal(catalog.require('named').description,'Operational named');
 definitions[1].asIntent=false;
 assert.ok(catalog.select({ intent: true }, context).has('reuse'));
 context.enabled=false;
 assert.deepEqual(catalog.select({ intent: true }, context).ids(),['reuse','named']);
 assert.deepEqual(catalog.select(['plain','inactive'],context).ids(),['plain']);

});

test('a tool becoming inactive cannot resolve a previously prepared proposal or execute',async()=>{
 const app={enabled:true}; let calls=0;
 const executable={...tool('save',{resolve:undefined,asIntent:true,active:ctx=>ctx.enabled}),kind:'write',authorize(){},execute(){calls++;return true;},parseOutput:value=>value};
 const catalog=Support.defineToolCatalog([executable]);
 const view=catalog.tools.select({ intent: true }, app);
 const runtime=catalog.bind({app});
 app.enabled=false;
 assert.throws(()=>view.resolve({toolId:'save',input:{}},{stageId:'test'}),error=>error.issues?.some(issue=>issue.message.includes('inactive')));
 await assert.rejects(()=>runtime.invoke({toolId:'save',input:{}}),/inactive/);
 assert.equal(calls,0);
});

test('predicates are synchronous booleans and invalid discovery metadata fails registration',()=>{
 for(const value of [false,' ',{description:' '},{when:true},{delegates:[]},{delegates:['read','read']}]) assert.throws(()=>new ModelToolRegistry([tool('bad',{asIntent:value})]),/Intent|intent|asIntent/);
 for(const extra of [{active:async()=>true,asIntent:true},{asIntent:()=>1},{asIntent:{when:async()=>true}}]) assert.throws(()=>Support.defineModelTools([tool('bad',extra)]).select({ intent: true }, {}),/synchronous|boolean/);
});

test('object asIntent predicates bind to the tool definition like active',()=>{
 const definition=tool('bound',{enabled:true,asIntent:{description:'Bound demand',when(){return this.enabled;}}});
 const catalog=Support.defineModelTools([definition]);
 assert.ok(catalog.select({ intent: true }, {}).has('bound'));
 definition.enabled=false;
 assert.equal(catalog.select({ intent: true }, {}).has('bound'),false);
});

test('agent catalogs filter goals by active and asIntent conditions',()=>{
 const goals=GoalRegistry.create([
  {id:'inactive',description:'Inactive',active:false,asIntent:true},
  {id:'conditional',description:'Conditional',asIntent:{when:()=>false}},
  {id:'enabled',description:'Enabled',asIntent:true},
 ]);
 const catalog=defineAgentCatalog({
  goalIds:()=>goals.ids(),
  goals:ids=>goals.describe(ids),
  scopes:()=>ScopeRegistry.create([]).describe(),
  currentTask:()=>undefined,
  tools:{values:()=>[],has:()=>false,supportsGoal:()=>true,describe:()=>[]},
 });
 assert.deepEqual(catalog.modelCatalog({}).availableGoalIds,['enabled']);
 assert.deepEqual(catalog.goalCatalog({}).map((item)=>item.id),['enabled']);
});

test('domain tools keep policies and validate explicit delegate overrides without intent entities',()=>{
 const registry=new GoalRegistry({delegates:['read','final'],scopeModes:['required'],targetModes:['forbidden']});
 registry.register({...tool('find',{asIntent:{description:'Find notes'}}),scopePolicy:'required',targetPolicy:'forbidden',delegates:['read','final']});
 assert.deepEqual(registry.require('find').delegates,['read','final']);
 assert.equal(registry.select({ intent: true }, {}).require('find').description,'Find notes');
 assert.equal(registry.require('find').scopePolicy,'required');
 assert.throws(()=>registry.register({...tool('bad',{asIntent:true}),scopePolicy:'required',targetPolicy:'forbidden',delegates:['write']}),/Invalid/);
});

test('Intent and WorkflowTool compose on classes and methods in either order, in ESM and CJS',async(t)=>{
 const ts=await import('typescript');
 const {mkdir,mkdtemp,writeFile,rm}=await import('node:fs/promises');
 const {pathToFileURL}=await import('node:url');
 const {createRequire}=await import('node:module');
 const require=createRequire(import.meta.url);
 await mkdir(new URL('../.tmp/', import.meta.url), { recursive: true });
 const directory=await mkdtemp(new URL('../.tmp/intent-decorators-',import.meta.url));
 t.after(()=>rm(directory,{recursive:true,force:true}));
 for(const format of ['esm','cjs']) {
  const source=`
  import {Support} from '@jangts/agent-core';
  import {Intent,WorkflowTool,toolPool} from '@jangts/agent-core/support/decorators';
  const schema={jsonSchema:{type:'object'},parse:(value:unknown)=>value};
  @Intent('Class demand')
  @WorkflowTool('class-${format}',{ns:'intent-${format}'})
  class ClassTool { description='Class operation'; inputSchema=schema; resolve(value:unknown){return value;} }
  @WorkflowTool('reverse-${format}',{ns:'intent-${format}'})
  @Intent()
  class ReverseTool { description='Reverse operation'; inputSchema=schema; resolve(value:unknown){return value;} }
  class Host {
    #value=8;
    @Intent({description:'Method demand',when:(ctx:{enabled:boolean})=>ctx.enabled})
    @WorkflowTool('method-${format}',{ns:'intent-${format}',description:'Method operation',inputSchema:schema})
    resolve(value:unknown){return {value,privateValue:this.#value};}
    @WorkflowTool('method-reverse-${format}',{ns:'intent-${format}',description:'Reverse method',inputSchema:schema})
    @Intent(()=>true)
    reverse(value:unknown){return value;}
  }
  @Intent()
  class Orphan {}
  new Host();
  export const tools=Support.defineModelTools(toolPool.getAll('intent-${format}'));
  `;
  const typedPath=directory+`/fixture.${format==='esm'?'mts':'cts'}`;
  await writeFile(typedPath,source);
  const options={strict:true,target:ts.default.ScriptTarget.ES2023,module:format==='esm'?ts.default.ModuleKind.ES2022:ts.default.ModuleKind.NodeNext,moduleResolution:format==='esm'?ts.default.ModuleResolutionKind.Bundler:ts.default.ModuleResolutionKind.NodeNext,skipLibCheck:true,noEmit:true};
  const diagnostics=ts.default.getPreEmitDiagnostics(ts.default.createProgram([typedPath],options));
  assert.deepEqual(diagnostics.map(d=>ts.default.flattenDiagnosticMessageText(d.messageText,'\n')),[]);
  const path=directory+`/fixture.${format==='esm'?'mjs':'cjs'}`;
  const result=ts.default.transpileModule(source,{compilerOptions:{target:ts.default.ScriptTarget.ES2023,module:format==='esm'?ts.default.ModuleKind.ES2022:ts.default.ModuleKind.CommonJS}});
  await writeFile(path,result.outputText);
  const {tools}=format==='esm'?await import(pathToFileURL(path).href):require(path);
  assert.equal(tools.ids().length,4);
  assert.equal(tools.select({ intent: true }, {enabled:true}).require(`class-${format}`).description,'Class demand');
  assert.equal(tools.select({ intent: true }, {enabled:false}).has(`method-${format}`),false);
  assert.deepEqual(tools.resolve({toolId:`method-${format}`,input:{ok:true}},{stageId:'test'}),{value:{ok:true},privateValue:8});
 }
});

test('executable model projection parses once at the actual execution boundary', async()=>{
 let parsed=0;
 const definitions=[{id:'once',kind:'read',description:'Read',asIntent:true,
  inputSchema:{jsonSchema:{type:'object'},parse(value){parsed++; return {value};}},
  authorize(){},execute(input){return input;},parseOutput:value=>value,
 }];
 const model=Support.defineModelTools(definitions).select({ intent: true }, {});
 const proposal=model.resolve({toolId:'once',input:{raw:true}},{stageId:'test'});
 assert.equal(parsed,0);
 const runtime=Support.defineToolCatalog(definitions).bind({app:{}});
 assert.deepEqual((await runtime.invoke(proposal)).value,{value:{raw:true}});
 assert.equal(parsed,1);
});

test('ESM and CJS Intent decorators share metadata without registering a separate entity', async()=>{
 const {createRequire}=await import('node:module');
 const other=createRequire(import.meta.url)('@jangts/agent-core/support/decorators');
 const {WorkflowTool,toolPool}=await import('@jangts/agent-core/support/decorators');
 const initializers=[];
 class Definition {description='Mixed'; inputSchema=schema; resolve(value){return value;}}
 const context={kind:'class',name:'Definition',addInitializer(fn){initializers.push(fn);}};
 WorkflowTool('mixed-intent',{ns:'mixed-intent'})(Definition,context);
 other.Intent('Shared demand')(Definition,context);
 for(const initialize of initializers) initialize.call(Definition);
 assert.equal(Support.defineModelTools(toolPool.getAll('mixed-intent')).select({ intent: true }, {}).require('mixed-intent').description,'Shared demand');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import { Intent, nodePool, toolPool, node, tool } from '@jangts/agent-core/support/decorators';
import { classDecoration } from '../dist/esm/support/decorators/definition.js';
import { registerDefinitions } from '../dist/esm/support/decorators/pool.js';

const require = createRequire(import.meta.url);
const fixture = new URL('./decorators.fixture.ts', import.meta.url);

test('standard decorator class and host-method fixtures strictly compile and execute in ESM/CJS', async (t) => {
  const input = await readFile(fixture, 'utf8');
  await mkdir(new URL('../.tmp/', import.meta.url), { recursive: true });
  const temp = await mkdtemp(fileURLToPath(new URL('../.tmp/decorators-', import.meta.url)));
  t.after(() => rm(temp, {recursive:true,force:true}));
  for (const [format, module, resolution] of [['esm',ts.ModuleKind.ES2022,ts.ModuleResolutionKind.Bundler],['cjs',ts.ModuleKind.NodeNext,ts.ModuleResolutionKind.NodeNext]]) {
    const file = path.join(temp, format === 'esm' ? 'fixture.mts' : 'fixture.cts');
    const source = input.replaceAll('__FORMAT__', 'fixture-'+format);
    await writeFile(file,source);
    const options = {strict:true,target:ts.ScriptTarget.ES2023,module,moduleResolution:resolution,skipLibCheck:true,noEmit:true};
    const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram([file],options));
    assert.deepEqual(diagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')),[], format);
    const output = ts.transpileModule(source,{compilerOptions:{...options,noEmit:false,module:format==='esm'?ts.ModuleKind.ES2022:ts.ModuleKind.CommonJS}}).outputText;
    const js = path.join(temp,format==='esm'?'fixture.mjs':'fixture.cjs');
    await writeFile(js,output);
    const fixtureModule = format==='esm'?await import(pathToFileURL(js).href):require(js);
    assert.deepEqual(await fixtureModule.verify(),{classResult:'class:ok!',methodResult:'method:ok!',toolResult:'echo:ok!',fragmentResult:'subject:ok',agentResult:'class:ok!',modelResult:'model',constructed:1});
    const other = format==='esm'?require('@jangts/agent-core/support/decorators'):await import('@jangts/agent-core/support/decorators');
    assert.equal(other.nodePool.get('class-node',fixtureModule.ns),nodePool.get('class-node',fixtureModule.ns));
    const local = await import('@jangts/agent-core/support/decorators');
    assert.equal(other.agentPool.get('agent-options',fixtureModule.ns),local.agentPool.get('agent-options',fixtureModule.ns));
    assert.equal(other.modelPool.get('model-options',fixtureModule.ns),local.modelPool.get('model-options',fixtureModule.ns));
    assert.equal(other.nodePool.get('method-node',fixtureModule.ns).run instanceof Function,true);
  }
});

function standardClass(decorator, Class) {
  const initializers=[];
  decorator(Class,{kind:'class',name:Class.name,addInitializer(fn){ initializers.push(fn); }});
  for(const fn of initializers)fn.call(Class);
  return Class;
}
test('roots isolate namespaces, share multi-namespace identity and reject conflicts atomically', () => {
  const ns='root-test';
  const Class = class { description='one'; routes=[{complete:()=>true}]; #value=1; run(){return {value:this.#value}} };
  standardClass(node('one',{ns:[ns,'root-copy',ns]}),Class);
  assert.equal(nodePool.get('one',ns),nodePool.get('one','root-copy'));
  assert.deepEqual(nodePool.get('one',ns).run(),{value:1});
  standardClass(node('one',{ns:'independent'}),class extends Class {});
  assert.notEqual(nodePool.get('one',ns),nodePool.get('one','independent'));
  standardClass(node('two',{ns}),Class);
  assert.deepEqual(nodePool.pick(['two','one'],ns).map(value=>value.id),['two','one']);
  assert.deepEqual(nodePool.getAll(ns).map(value=>value.id),['one','two']);
  assert.equal('ns' in nodePool.get('one',ns),false);
  assert.throws(()=>standardClass(node('one',{ns:['not-published',ns]}),Class),/Duplicate.*root-test/);
  assert.equal(nodePool.get('one','not-published'),undefined);
  assert.deepEqual(nodePool.getAll('not-published'),[]);
  assert.throws(()=>standardClass(node('bad-id'),class {id='bad-id';}),/supplies id/);
  assert.throws(()=>nodePool.pick(['one','one'],ns),/Duplicate/);
  assert.throws(()=>nodePool.pick(['missing'],ns),/Unknown/);
  assert.ok(Object.isFrozen(nodePool.getAll(ns)));
  assert.ok(Object.isFrozen(nodePool.pick(['one'],ns)));
  assert.throws(()=>standardClass(node('empty',{ns:[]}),Class),/nonempty/);
  assert.throws(()=>standardClass(node('empty',{ns:['']}),Class),/nonempty/);
  assert.throws(()=>nodePool.getAll(''),/nonempty/);
  standardClass(node('default-node'),Class);
  assert.equal(nodePool.get('default-node'),nodePool.get('default-node','default'));
  standardClass(tool('default-node'),class {kind='read';description='tool';inputSchema={jsonSchema:{type:'object'},parse:x=>x};authorize(){} execute(){return true;}parseOutput=x=>x;});
  assert.notEqual(toolPool.get('default-node'),nodePool.get('default-node'));
  assert.throws(()=>node('bad')(class {},{}),/standard/);
});

test('method binding preserves the real host and rejects duplicate instances', () => {
  const initializers=[];
  const decorator=node('lookup',{ns:'method-test',description:'read',routes:[{complete:()=>true}]});
  class Host { #value; constructor(value){ this.#value=value; for(const init of initializers)init.call(this); } lookup(){return {value:this.#value};} }
  decorator(Host.prototype.lookup,{kind:'method',static:false,private:false,addInitializer(fn){initializers.push(fn);}});
  const a=new Host('a');
  assert.equal(nodePool.get('lookup','method-test').run().value,'a');
  assert.throws(()=>new Host('b'),/Duplicate/);
  assert.equal(nodePool.get('lookup','method-test').run().value,'a');
  assert.throws(()=>decorator(()=>{}, {kind:'method',static:true}),/instance/);
  assert.throws(()=>standardClass(tool('invalid'),class {kind='read';description='invalid';}),/handler/i);
});

test('legacy decorator compilation is explicitly rejected and internal converters stay private', async () => {
  const file = fileURLToPath(fixture);
  const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram([file], {
    strict:true, target:ts.ScriptTarget.ES2023, module:ts.ModuleKind.NodeNext,
    moduleResolution:ts.ModuleResolutionKind.NodeNext, experimentalDecorators:true, skipLibCheck:true, noEmit:true,
  }));
  assert.ok(diagnostics.some(d=>[1238,1240,1241,1270].includes(d.code)));
  const exposed = await import('@jangts/agent-core/support/decorators');
  for (const name of ['classDecoration','methodDecoration','decorate','withId','DefinitionPool','definitionOf','registerDefinition','definitionKinds','workflow','workflowPool']) assert.equal(name in exposed,false);
  const core = await import('@jangts/agent-core');
  assert.equal('node' in core.Support,false);
});

test('definition decorators reject duplicate metadata and preflight an entire registration group', () => {
  const target = class {};
  assert.throws(() => Intent()(target, { kind: 'field' }), /requires a class or method/);
  Intent()(target, { kind: 'class' });
  assert.throws(() => Intent()(target, { kind: 'class' }), /Duplicate Intent/);
  assert.throws(() => tool('raw-intent', { asIntent: true }), /Use @Intent/);
  assert.throws(() => standardClass(tool('raw-intent'), class { asIntent = true; }), /Use @Intent/);
  assert.throws(() => classDecoration('tool', 'wrong', {}, value => value)(target, { kind: 'method' }),
    /standard class decorator/);
  const ns = 'bulk-validation';
  assert.throws(() => registerDefinitions('tool', [{ id: 'valid' }, { id: '' }], ns),
    /Invalid decorator definition id/);
  assert.throws(() => registerDefinitions('tool', [{ id: 'valid' }, { id: 'valid' }], ns),
    /Duplicate tool definition/);
  assert.deepEqual(toolPool.getAll(ns), []);
});

test('decorator initialization rejects an incompatible registry in its process realm', () => {
  const url = new URL('../dist/esm/support/decorators/pool.js', import.meta.url).href;
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', `
    import assert from 'node:assert/strict';
    globalThis[Symbol.for('@jangts/agent-core/decorator-roots/v3')] = { version: 2 };
    await assert.rejects(import(${JSON.stringify(url)}), /Incompatible decorator root registry/);
  `], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
});

test('route getters organize definitions while predicates use committed state and original private helpers', async () => {
  const {AgentCoreEngine,defineWorkflow}=await import('@jangts/agent-core');
  let reads=0;
  standardClass(node('getter-routes',{ns:'getter-test'}),class {
    description='getter routes';
    #minimum=1;
    get routes(){
      reads++;
      return [
        {when:state=>this._ready(state),complete:state=>state.answer},
        {complete:()=> 'empty'},
      ];
    }
    run(state){return {answer:state.text.trim()};}
    _ready(state){return state.answer.length>=this.#minimum;}
  });
  const engine=new AgentCoreEngine({workflow:defineWorkflow({id:'getter-flow',nodes:nodePool.getAll('getter-test')})});
  const snapshotReads=reads;
  assert.equal(await engine.run({text:' first ',answer:''}),'first');
  assert.equal(await engine.run({text:' ',answer:'stale'}),'empty');
  assert.equal(reads,snapshotReads,'routes are not re-evaluated during each run');
});

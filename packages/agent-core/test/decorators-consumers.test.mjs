import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
test('tree shaking keeps class construction and namespace registration when the result is consumed', async t => {
  await mkdir(path.join(root, '.tmp'), { recursive: true });
  const dir=await mkdtemp(path.join(root,'.tmp/decorator-bundle-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const source=`
import {node,nodePool} from '@jangts/agent-core/support/decorators';

@node('bundled',{ns:'bundle-test'})
class Bundled { description='bundled';routes=[{complete:()=>true}];#value='kept';run(){return this.#value;} }
export const result=nodePool.get('bundled','bundle-test').run();
`;
  const output=await build({stdin:{contents:source,resolveDir:root,loader:'ts'},bundle:true,platform:'node',format:'esm',target:'es2023',write:false,treeShaking:true,minify:true});
  const file=path.join(dir,'bundle.mjs');await writeFile(file,output.outputFiles[0].contents);
  assert.equal((await import(pathToFileURL(file).href)).result,'kept');
});


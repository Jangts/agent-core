import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveSdkResources } from './sdk-resources.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
export async function loadKnowledge() {
  const resources = await resolveSdkResources(project);
  const { loadApplicationKnowledge } = await import(pathToFileURL(resources.knowledgeLoader));
  return loadApplicationKnowledge(new URL('../knowledge/', import.meta.url));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const catalog = await loadKnowledge(), resources = await resolveSdkResources(project);
  console.log(JSON.stringify({ status: catalog.ids().length ? 'valid' : 'empty-awaiting-source', documents: catalog.ids(), tools: resources.tools, docs: resources.docs }, null, 2));
}

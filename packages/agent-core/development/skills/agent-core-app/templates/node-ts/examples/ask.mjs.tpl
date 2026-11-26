import { createApp } from '../dist/app.js';
import { createProvider } from '../dist/model.js';
import { loadKnowledge } from '../scripts/knowledge.mjs';

const question = process.argv.slice(2).join(' ').trim();
if (!question) throw new Error('Pass a question; this example calls your configured model');
const app = createApp({ provider: createProvider(process.env), knowledge: await loadKnowledge(),
  // Local developer example: only the maintained local catalog is selected. A server must bind its actual identity/access check here.
  authorizeRead() {},
});
console.log(JSON.stringify(await app.run(question, { signal: AbortSignal.timeout(60000) }), null, 2));

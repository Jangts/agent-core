/** Independent model and execution declarations, connected through checked Tool IDs. */
import { Support } from '@jangts/agent-core';
import { toolDefinitions, textInput } from './tools.mjs';

export function independentConfiguration() {
  const execution = Support.defineToolCatalog(toolDefinitions());
  const tools = Support.defineModelTools([
    {
      id: 'search_notes',
      description: '按主题检索公开笔记',
      asIntent: '用户希望查找笔记',
      inputSchema: { jsonSchema: textInput('query').jsonSchema, parse: (value) => value },
      resolve: (input) => ({ toolId: 'search_notes', input }),
    },
    {
      id: 'read_note',
      description: '读取已定位笔记的正文',
      inputSchema: { jsonSchema: textInput('noteId').jsonSchema, parse: (value) => value },
      resolve: (input) => ({ toolId: 'read_note', input }),
    },
  ]);
  return { execution, tools };
}

# Getting Started from the Same Contract Set

[Back to home](README.md). Running the examples requires the App to supply the provider, business storage, and authentication configuration.

## One Output Shape, Two Input Forms

```ts
const runner = new ModelRunner({ provider });

const a = await runner.invoke('你好');
const b = await runner.invoke({ input: '你好' });

// 两者都是ModelResult<string>。
console.log(a.value);
console.log(b.value);
console.log(a.invocation.durationMs);
```

The short form is only equivalent to `{ input: '你好' }`. No path returns a string directly, and there is no raw/fullResponse option to switch the return structure. A structured interaction only makes value a parsed object; the outer layer is still a ModelResult.

## Single-Source Tool Declaration, Model Selection, and Real Execution

```ts
import { ModelRunner, Support } from '@jangts/agent-core';
import type { OperationContext } from '@jangts/agent-core';

interface ReadNote { noteId: string }
interface Note { title: string; body: string }
interface App {
  visibleNoteIds: ReadonlySet<string>;
  notes: { read(id: string, signal: AbortSignal): Promise<Note> };
}

const inputSchema = Support.defineSchema<ReadNote>({
  jsonSchema: {
    type: 'object', required: ['noteId'], additionalProperties: false,
    properties: { noteId: { type: 'string', minLength: 1 } },
  },
  parse(value: unknown): ReadNote {
    if (!value || typeof value !== 'object' || !('noteId' in value)
      || typeof value.noteId !== 'string' || !value.noteId.trim()) {
      throw new TypeError('noteId is required');
    }
    return { noteId: value.noteId };
  },
});

const readNote = Support.defineTool({
  id: 'note-read', kind: 'read', description: '读取当前用户可见的笔记。',
  inputSchema,
  authorize(input: ReadNote, context: OperationContext<App>) {
    if (!context.app.visibleNoteIds.has(input.noteId)) throw new Error('Access denied');
  },
  execute(input: ReadNote, context: OperationContext<App>) {
    return context.app.notes.read(input.noteId, context.signal);
  },
  parseOutput(value: unknown): Note {
    if (!value || typeof value !== 'object'
      || !('title' in value) || typeof value.title !== 'string'
      || !('body' in value) || typeof value.body !== 'string') {
      throw new TypeError('Invalid note');
    }
    return { title: value.title, body: value.body };
  },
});

const catalog = Support.defineToolCatalog([readNote]);
const interaction = Support.createModelInteraction({
  id: 'note-selection', tools: catalog.tools,
});
```

A definition does not close over this user, signal, or budget; the same catalog can serve multiple requests. Binding happens only after entering a request:

```ts
const execution = { signal: requestSignal };
const tools = catalog.bind({ app: authenticatedApp, execution });
const runner = new ModelRunner({
  provider, interactions: [interaction] as const, execution, maxCalls: 2,
});

const selected = await runner.invoke({
  stageId: 'choose-note', interaction: 'note-selection',
  input: '读取刚才那份笔记。',
});
const executed = await tools.invoke({
  toolId: selected.value.toolId,
  input: selected.value.input,
});

// 同一外层形状，不同业务值。模型提议不是执行回执。
const proposal = selected.value;
const actualNote = executed.value;
const actualInvocationId = executed.invocation.invocationId;
```

The visible set is trusted server-side context, and real storage must still check ownership and resource lifecycle again. The schema and model selection grant no permission; authorize returning false is not part of the target contract.

## Reading Knowledge with the Collection Methods You Already Know

```ts
import { defineKnowledgeCatalog } from '@jangts/agent-core/kits/knowledge';

const knowledge = defineKnowledgeCatalog([
  { id: 'manual', revision: 'r1', parts: ['已维护的资料。'] },
]);

const optional = knowledge.get('missing'); // undefined
const required = knowledge.require('manual'); // 必须存在
const snapshot = knowledge.read({
  documentId: required.id,
  selection: { mode: 'document' },
});
```

read is a read with an explicit content model and returns a KnowledgeSnapshot; it is not another output mode of model invoke. The same shape is required only for the same method with the same responsibility, so not every scalar, collection, and snapshot is called a Response.

The calls above can be composed into the same Workflow; the model only proposes a structured selection, and the registered implementation performs the actual tool authorization, execution, and result checking.

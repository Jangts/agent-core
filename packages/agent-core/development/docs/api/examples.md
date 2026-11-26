# 从同一套合同入门

[返回首页](README.md)。运行示例需要由 App 提供 provider、业务存储和认证配置。

## 一种输出外形，两种输入写法

```ts
const runner = new ModelRunner({ provider });

const a = await runner.invoke('你好');
const b = await runner.invoke({ input: '你好' });

// 两者都是ModelResult<string>。
console.log(a.value);
console.log(b.value);
console.log(a.invocation.durationMs);
```

短写只等价于`{ input: '你好' }`。没有一条路径直接返回string，也不提供raw/fullResponse选项切换返回结构。结构化传输只让value变成已解析的对象，外层仍是ModelResult。

## 同源工具声明、模型选择与真实执行

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

定义不关闭本次用户、signal或预算；相同目录可以服务多个请求。进入请求后才绑定：

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

可见集合是可信服务端上下文，真实存储还必须再次检查归属与资源生命周期。schema和模型选择不授予权限；authorize返回false不属于目标合同。

## 用学过的集合方法读取资料

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

read是有明确内容模型的读取，返回KnowledgeSnapshot；它不是模型invoke的另一种输出模式。相同方法、相同职责才要求同一外形，不能把所有标量、集合、快照都叫Response。

以上调用可组合到同一 Workflow 中；模型只提出结构化选择，实际工具授权、执行与结果检查由已登记实现完成。

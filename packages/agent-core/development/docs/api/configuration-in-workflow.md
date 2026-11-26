# 从完整代码看懂独立配置与关联配置

ModelTool 是供模型选择和提交参数的接口。ExecutableTool 增加授权、执行和输出校验，LifecycleTool 是可选 Kit 的生命周期扩展。Intent 只是 Tool 的用途标记和专门描述，没有独立 ID 或注册表。下面使用公开的内存笔记与离线 Provider 展示完整流程。

```text
Tool declaration → node selects tools → model proposes name and arguments
→ schema / activation / authorization → execute → validated result
```

## 1. 执行 Tool：参数、授权、处理与结果校验

[tools.mjs](../examples/registration/tools.mjs)

```js
/** Tutorial tools: public in-memory notes only; no application database or network access. */
import { Support } from '@jangts/agent-core';

// The two business inputs differ; the model must use the selected tool's schema.
export function textInput(field) {
  return Support.defineSchema({
    jsonSchema: {
      type: 'object',
      properties: { [field]: { type: 'string', minLength: 1 } },
      required: [field],
      additionalProperties: false,
    },
    parse(value) {
      if (
        !value ||
        typeof value !== 'object' ||
        Array.isArray(value) ||
        Object.keys(value).length !== 1 ||
        typeof value[field] !== 'string' ||
        !value[field].trim()
      ) {
        throw new TypeError(`Expected one nonempty string: ${field}`);
      }
      return { [field]: value[field].trim() };
    },
  });
}

const notes = [{ id: 'n1', title: '咖啡烘焙', body: '烘焙程度可结合豆色和风味判断。' }];

/** Build fresh declarations so manual and associated examples share no mutable request state. */
export function toolDefinitions() {
  return [
    {
      id: 'search_notes',
      asIntent: '用户希望查找笔记',
      kind: 'read',
      description: '按主题检索公开笔记',
      inputSchema: textInput('query'),
      authorize() {}, // This tutorial uses public constants, with no private account data.
      execute({ query }) {
        return notes
          .filter((note) => note.title.includes(query))
          .map(({ id, title }) => ({ id, title }));
      },
      parseOutput(value) {
        if (
          !Array.isArray(value) ||
          value.some((note) => typeof note?.id !== 'string' || typeof note.title !== 'string')
        ) {
          throw new TypeError('Invalid search result');
        }
        return value;
      },
    },
    {
      id: 'read_note',
      kind: 'read',
      description: '读取已定位笔记的正文',
      inputSchema: textInput('noteId'),
      authorize() {},
      execute({ noteId }) {
        const note = notes.find((note) => note.id === noteId);
        if (!note) throw new Error('Note not found');
        return { ...note };
      },
      parseOutput(value) {
        if (!value || typeof value.body !== 'string') {
          throw new TypeError('Invalid note body');
        }
        return value;
      },
    },
  ];
}
```

## 2. 独立配置：分别声明模型接口和执行合同

[independent.mjs](../examples/registration/independent.mjs)

模型声明只生成 `{ toolId, input }` 提议，不直接执行业务。执行目录另行绑定本次请求的应用上下文。

```js
/** Independent model and execution declarations, connected through checked Tool IDs. */
import { Support } from '@jangts/agent-core';
import { toolDefinitions, textInput } from './tools.mjs';

export function independentConfiguration() {
  const execution = Support.defineToolCatalog(toolDefinitions());
  const tools = Support.defineModelTools([
    {
      id: 'search_notes', description: '按主题检索公开笔记', asIntent: '用户希望查找笔记',
      inputSchema: { jsonSchema: textInput('query').jsonSchema, parse: value => value },
      resolve: input => ({ toolId: 'search_notes', input }),
    },
    {
      id: 'read_note', description: '读取已定位笔记的正文',
      inputSchema: { jsonSchema: textInput('noteId').jsonSchema, parse: value => value },
      resolve: input => ({ toolId: 'read_note', input }),
    },
  ]);
  return { execution, tools };
}
```

## 3. 关联配置：一份声明提供模型视图与执行入口

[associated.mjs](../examples/registration/associated.mjs)

目录从同一 Tool 推导名称、描述、Schema 和调用映射，省掉独立写法中的重复声明；授权与执行校验仍走原通道。

```js
/** One executable Tool declaration supplies both model and execution contracts. */
import { Support } from '@jangts/agent-core';
import { toolDefinitions } from './tools.mjs';

export function associatedConfiguration() {
  const execution = Support.defineToolCatalog(toolDefinitions());
  return { execution, tools: execution.tools };
}
```

## 4. 工作流：节点如何装配上下文、调用模型和执行提议

[workflow.mjs](../examples/registration/workflow.mjs)

```js
/** One runtime for both configuration styles; its Provider is a fixed offline fixture. */
import { AgentCoreEngine, Support, defineWorkflow, route } from '@jangts/agent-core';

const context = Support.defineContextFragments(
  [
    {
      id: 'task-policy',
      sourceId: 'tutorial',
      trust: 'instruction',
      lifetime: 'configuration',
      role: 'system',
      maxChars: 500,
      format: () => '按用户需求选择一个已提供的能力并提交参数。操作结果由程序返回。',
    },
    {
      id: 'tool-catalog',
      sourceId: 'tool-registry',
      trust: 'server',
      lifetime: 'step',
      role: 'user',
      maxChars: 6000,
      format: ({ tools }) => ({ tools: [...tools.values()].map(({id, description}) => ({id, description})) }),
    },
    {
      id: 'question',
      sourceId: 'user-message',
      trust: 'user',
      lifetime: 'turn',
      role: 'user',
      maxChars: 1000,
      format: ({ question }) => ({ question }),
    },
  ],
  { maxInputChars: 8000 },
);

/** Stage policy selects candidates; association does not automatically submit every registration. */
export function taskTransport(tools, toolIds = ['search_notes', 'read_note']) {
  return Support.createStageModelInteraction({
    id: 'task',
    tools,
    stages: [{ id: 'choose-operation', toolIds }],
  });
}

const workflow = defineWorkflow({
  id: 'notes-request',
  nodes: [
    {
      id: 'decide',
      description: '组织上下文，让模型提出一次操作',
      async run(state, { model, app }) {
        const input = context.build({
          input: {
            question: state.question,
            tools: app.tools,
          },
        });
        const { value: proposal } = await model.invoke({
          stageId: 'choose-operation',
          interaction: 'task',
          input,
        });
        return { proposal };
      },
      routes: [route.to('execute')],
    },
    {
      id: 'execute',
      description: '经过工具合同执行提议，取得真实结果',
      async run(state, { tools }) {
        const { value: result } = await tools.invoke(state.proposal);
        return { result };
      },
      routes: [route.deliver('result')],
    },
  ],
});

/** The chosen reply is fixture input, not a language-understanding implementation. */
export async function runCase(configuration, question, proposedName, proposedInput) {
  const submitted = [];
  const provider = {
    async *stream(messages, { options }) {
      submitted.push({ messages, functions: options.functions });
      if (!options.functions.some((fn) => fn.name === proposedName)) {
        throw new Error('Fixture attempted an unavailable capability');
      }
      yield {
        type: 'function-call-delta',
        index: 0,
        id: 'offline-call',
        name: proposedName,
        arguments: JSON.stringify(proposedInput),
      };
    },
  };
  const agent = new AgentCoreEngine({
    workflow,
    app: { tools: configuration.tools },
    tools: configuration.execution.bind({ app: {} }),
    model: {
      provider,
      interactions: [taskTransport(configuration.tools, configuration.candidateIds)],
      maxCalls: 1,
    },
  });
  return { result: await agent.run({ question }), submitted };
}
```

## 5. 另一种模型协议：name/input 包装复用同一执行合同

[protocol.mjs](../examples/registration/protocol.mjs)

```js
/** A name/input envelope changes model output format while preserving the same tool proposal. */
import { Support } from '@jangts/agent-core';

export function wrappedConfiguration(configuration) {
  const capability = {
    id: 'tool_request',
    description: '提交工具名称和参数，由程序执行',
    inputSchema: Support.defineSchema({
      jsonSchema: {
        type: 'object',
        required: ['name', 'input'],
        additionalProperties: false,
        properties: {
          name: { type: 'string', enum: configuration.tools.ids() },
          input: { type: 'object' },
        },
        anyOf: configuration.tools.definitions.map((tool) => ({
          properties: {
            name: { const: tool.id },
            input: tool.inputSchema.jsonSchema,
          },
        })),
      },
      parse(value) {
        if (
          !value ||
          typeof value !== 'object' ||
          Array.isArray(value) ||
          Object.keys(value).some((key) => key !== 'name' && key !== 'input') ||
          typeof value.name !== 'string' ||
          !value.input ||
          typeof value.input !== 'object' ||
          Array.isArray(value.input)
        ) {
          throw new TypeError('Expected { name, input }');
        }
        configuration.tools.require(value.name);
        return value;
      },
    }),
    resolve: ({ name, input }) => ({ toolId: name, input }),
  };
  return {
    ...configuration,
    tools: Support.defineModelTools([capability]),
    candidateIds: ['tool_request'],
  };
}
```

## 6. 离线验证：两种配置的模型请求与执行结果相同

[run.mjs](../examples/registration/run.mjs)

```js
/** Run the tutorial offline and check that both configuration styles produce equivalent contracts. */
import assert from 'node:assert/strict';
import { independentConfiguration } from './independent.mjs';
import { associatedConfiguration } from './associated.mjs';
import { runCase, taskTransport } from './workflow.mjs';
import { wrappedConfiguration } from './protocol.mjs';

const separate = independentConfiguration();
const linked = associatedConfiguration();
assert.deepEqual(linked.tools.select({ intent: true }, {}).ids(), separate.tools.select({ intent: true }, {}).ids());
const rawFunctions = (configuration) =>
  taskTransport(configuration.tools).prepare('choose-operation').options.functions;
assert.deepEqual(rawFunctions(linked), rawFunctions(separate));
assert.deepEqual(
  linked.tools.resolve(
    { toolId: 'search_notes', input: { query: ' 咖啡 ' } },
    { stageId: 'choose-operation' },
  ),
  separate.tools.resolve(
    { toolId: 'search_notes', input: { query: ' 咖啡 ' } },
    { stageId: 'choose-operation' },
  ),
);
for (const [question, name, input] of [
  ['帮我找咖啡相关的笔记', 'search_notes', { query: '咖啡' }],
  ['读一下n1这篇笔记', 'read_note', { noteId: 'n1' }],
]) {
  const a = await runCase(separate, question, name, input);
  const b = await runCase(linked, question, name, input);
  assert.deepEqual(a.submitted, b.submitted);
  assert.deepEqual(a.result, b.result);
  console.log(JSON.stringify({ question, result: b.result }));
}
const a = await runCase(wrappedConfiguration(separate), '帮我找咖啡相关的笔记', 'tool_request', {
  name: 'search_notes',
  input: { query: '咖啡' },
});
const b = await runCase(wrappedConfiguration(linked), '帮我找咖啡相关的笔记', 'tool_request', {
  name: 'search_notes',
  input: { query: '咖啡' },
});
assert.deepEqual(a.submitted, b.submitted);
assert.deepEqual(a.result, b.result);
console.log(
  'PASS: discovery, model functions, messages and execution results match.',
);
console.log('PASS: name/input envelope uses the same workflow and execution contract.');
```

## 需求识别用途与激活条件

```ts
const tools = Support.defineModelTools([{
  id: "manage_memo",
  description: "Process a memo draft and check conflicts",
  inputSchema: memoSchema,
  asIntent: {
    description: "The user wants to remember something or set a reminder",
    when: context => context.features.memos,
  },
  active: context => context.services.memos != null,
  resolve: input => input,
}]);
const candidates = tools.select({ intent: true }, context);
const known = tools.select(["manage_memo"], context);
```

`asIntent` 接受 `true`、描述、布尔判断函数或 `{ description?, when? }`。省略不参与需求识别；`active` 省略表示激活。两种选取方式均检查激活条件，专门描述只作用于当前视图。delegates 可选，表示允许集合而不是顺序，由领域注册器校验词汇；不会产生 Intent ID 或跨 Tool 描述聚合。

## 装饰器配置

```ts
@Intent({ description: "Accept memo requests" })
@WorkflowTool("manage_memo", { ns: "assistant" })
class MemoTool {
  description = "Process a memo request";
  inputSchema = memoSchema;
  resolve(input) { return input; }
}
```

装饰器从 `@jangts/agent-core/support/decorators` 导入。`@WorkflowTool` 与 `@WorkflowNode` 一样支持类和公开实例方法。`@Intent` 单独挂在同一目标上，单用不注册；Tool 装饰器及其定义不接收 asIntent。关联不依赖装饰器顺序。

## 运行示例

```sh
node development/docs/examples/registration/run.mjs
```

离线 fixture 验证接线和合同等价，不证明自然语言识别或真实供应商表现。Cafe 保留目标和下一步一次提交的分组协议，goal 指向 DomainTool；Banker 将本轮 Tool 候选投影到 name/input 协议。两端复用相同 Tool 合同，不强求同一种业务工作流。

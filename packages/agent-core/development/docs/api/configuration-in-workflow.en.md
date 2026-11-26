# Independent and associated Tool configuration

ModelTool is the model-facing interface. ExecutableTool adds authorization, execution and output validation. LifecycleTool is the optional Kit lifecycle extension. Intent is Tool metadata, not an independently registered entity. The examples use public in-memory notes and an offline Provider.

```text
Tool declaration → node selects tools → model proposes name and arguments
→ schema / activation / authorization → execute → validated result
```

## 1. Executable Tool declarations

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

## 2. Independent model and execution interfaces

[independent.mjs](../examples/registration/independent.mjs)

Model declarations propose `{ toolId, input }`; they do not execute business handlers.

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

## 3. One declaration supplies both interfaces

[associated.mjs](../examples/registration/associated.mjs)

The catalog derives names, descriptions, schemas and invocation mapping. This avoids re-declaring them. It does not skip authorization or execution validation.

```js
/** One executable Tool declaration supplies both model and execution contracts. */
import { Support } from '@jangts/agent-core';
import { toolDefinitions } from './tools.mjs';

export function associatedConfiguration() {
  const execution = Support.defineToolCatalog(toolDefinitions());
  return { execution, tools: execution.tools };
}
```

## 4. Node, context, interaction and execution

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

## 5. A name/input envelope reuses the same tools

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

## 6. Offline equivalence checks

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

## Demand discovery and activation

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

`asIntent` accepts `true`, a description, a boolean predicate, or `{ description?, when? }`. Omission excludes the tool from discovery; `active` defaults to true. Both selection methods filter activation. Discovery descriptions are view-local. Delegates are an optional allowed set, not a sequence; domain registries validate the vocabulary. No Intent IDs or cross-tool description aggregation are created.

## Decorator configuration

```ts
@Intent({ description: "Accept memo requests" })
@WorkflowTool("manage_memo", { ns: "assistant" })
class MemoTool {
  description = "Process a memo request";
  inputSchema = memoSchema;
  resolve(input) { return input; }
}
```

Import decorators from `@jangts/agent-core/support/decorators`. `@WorkflowTool` supports classes and public instance methods, like `@WorkflowNode`. Use a separate `@Intent` on the same target; it alone registers nothing. Do not pass `asIntent` to the Tool decorator or its definition. Decorator order does not affect the association.

## Run the example

```sh
node development/docs/examples/registration/run.mjs
```

The fixture checks wiring and contract equivalence, not language understanding or real-provider quality. Cafe preserves its grouped goal/next decision protocol; goal identifies a DomainTool. Banker projects current Tool candidates into its name/input protocol. Both use the same Core Tool contracts without forcing identical business workflows.

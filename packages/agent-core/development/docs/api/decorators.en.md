# Decorators and definition pools

Import decorators and readers from `@jangts/agent-core/support/decorators`. Only standard TypeScript decorators are supported; NestJS compilation units using experimentalDecorators cannot use this syntax directly. Original object, define, constructor and bind paths remain available. No runtime dependency, reflection metadata or automatic DI is added.

Class decorators construct a definition once after static initialization and supply id. Classes own their original fields, handlers, private helpers and getters; do not repeat complete options in decorator metadata. Node/tool/fragment definition classes require zero-argument construction. Runtime and toolbox decorators accept explicit constructor args. Agent/model classes construct actual Engine/Runner instances, without invoking a task or model.

## Named class contracts

Import Node, Tool and Fragment from the decorator subpath. These contracts omit the decorator-owned id. Object-shaped contracts support implements; Runner and Agent classes extend their respective runtime bases. Getters, private fields and prototype methods retain their original receiver.

```ts
import { AgentCoreEngine, defineWorkflow } from '@jangts/agent-core';
import { node, nodePool } from '@jangts/agent-core/support/decorators';
import type { Node } from '@jangts/agent-core/support/decorators';
type State = { text: string; answer?: string };
@node<State, string>('greet', { ns: 'chat' })
class Greeting implements Node<State, string> {
  readonly description = 'Greeting';
  readonly routes = [{ complete: (state: Readonly<State>) => state.answer! }];
  #prefix = 'Hello, ';
  run(state: Readonly<State>) { return { answer: this._format(state.text) }; }
  private _format(text: string) { return this.#prefix + text.trim(); }
}
const workflow = defineWorkflow<State, string>({ id: 'greeting', nodes: nodePool.getAll('chat') });
console.log(await new AgentCoreEngine({ workflow }).run({ text: 'visitor' }));
```

## Namespaces and reads

Each kind has one shared reader: nodePool, toolPool, fragmentPool, agentPool and modelPool. Consumers do not create pools or register definitions manually. Every decorator accepts optional `{ ns: string | readonly string[] }`, defaulting to `'default'`.

```ts
nodePool.get('greet', 'chat');
nodePool.getAll('chat');
nodePool.pick(['greet', 'answer'], 'chat');
nodePool.get('greet');    // default namespace
nodePool.getAll();       // only default, not every namespace
nodePool.pick(['greet']);
```

Ids are unique within one kind and namespace. Other namespaces and kinds may reuse an id. Names match exactly, without hierarchy, wildcard or fallback; blank names and empty namespace arrays reject. Repeated namespaces are deduplicated. An array registers the same definition in multiple namespaces without copying or reconstructing it. All destinations are checked before writing; a conflict leaves no partial registration.

get returns undefined on a miss. getAll returns a frozen registration-order snapshot, or an empty array for an unknown namespace. pick takes an id array, preserves caller order and rejects missing or repeated ids; an empty id array returns an empty snapshot. Reads accept original-definition generics, for example `nodePool.get<WorkflowNode<State, string>>('greet', 'chat')`. The generic describes the caller's expected contract, not a runtime type proof.

ns is external registration metadata, excluded from Core options. Returned ids remain unchanged. Combining same-id definitions from different namespaces in one Workflow or ToolRegistry still fails original uniqueness checks. App owns explicit node ordering and routes. Readers expose no constructors, registration, reset, sealing, tags or owner lookups.

## Existing instance methods

```ts
class GreetingService {
  constructor(private readonly prefix: string) {}
  @node<State, string>('reply', {
    ns: 'chat-service', description: 'Use an existing service',
    routes: [{ complete: (state: Readonly<State>) => state.answer! }],
  })
  answer(state: Readonly<State>) { return { answer: this.prefix + state.text }; }
}
const service = new GreetingService('Hello, ');
const definition = nodePool.get('reply', 'chat-service');
```

Standard instance initializers automatically bind and register methods. No registerFrom, manual bind, renamed handler or extra class decorator is needed. Initializers run before instance fields and constructor bodies, so they bind without invoking handlers or reading business fields. Read and execute only after successful host construction. Constructor failures do not roll back completed initializer registrations and must be treated as wiring failures. Pools retain host references; use long-lived services, not request-scoped hosts. A second instance with the same kind, namespace and id rejects without replacing the original binding.

Direct metadata callbacks also bind the host. Nested schema/routes retain their original receiver, and arrow functions retain lexical this. Only public instance methods are supported; static/private methods, top-level function decorator syntax and implicit inheritance merging are unsupported. A class-owned id rejects because its decorator supplies id.

## Original consumers

| Decorator | Class contract | Adapted method | Reader | Original consumer |
| --- | --- | --- | --- | --- |
| node | `Node<State, Result, App>` | run | nodePool | defineWorkflow |
| tool | `Tool<Input, Output, App>` | execute | toolPool | defineTool / defineToolCatalog |
| fragment | `Fragment<Input>` | format | fragmentPool | defineContextFragments |
| agent | extends AgentCoreEngine | None | agentPool | Direct run |
| model | extends ModelRunner | None | modelPool | Direct invoke |

agent/model ids are registration keys, not Core branch, model or transport identities. Original schema, graph, trust, authorization, result, budget and cancellation boundaries remain in force. Nodes are validated in the final graph. No public metadata-plus-free-function adapter is provided; top-level functions belong directly in original options.

## Getter-defined routes

A routes getter may return `when: state => this._ready(state)` and `complete: state => this._reply(state)`. Workflow assembly reads and snapshots the table, potentially reading the getter multiple times. Keep getters pure and independent of request state. After state patches commit, route callbacks receive the latest state and can call private helpers. The getter is not re-evaluated each run; do not store request state on shared nodes.

ESM/CJS module copies share roots within one JavaScript realm. Processes, workers and separate realms do not share roots. Independently evaluated classes registering the same kind, namespace and id reject rather than merge. Explicitly retain definition modules in the bundle: discarded side-effect-only imports cannot guarantee registration. Shared definitions must not retain request identity, signal or budget. Reading is neither execution nor authorization.

## WorkflowTool and Intent

WorkflowTool and WorkflowNode are explicit names for the tool and node decorators. WorkflowTool supports definition classes and public instance methods. A model-only Tool provides inputSchema and resolve; an executable Tool additionally provides kind, authorize, execute and parseOutput. The same pool stores their normalized definitions.

```ts
import { WorkflowTool, Intent, toolPool } from '@jangts/agent-core/support/decorators';
import { Support } from '@jangts/agent-core';

@Intent('The user wants to remember something')
@WorkflowTool('memo', { ns: 'assistant' })
class MemoTool {
  description = 'Accept a memo draft';
  inputSchema = memoSchema;
  resolve(input) { return input; }
}
const candidates = Support.defineModelTools(toolPool.getAll('assistant')).select({ intent: true }, context);
```

Intent accepts no argument, a description, a synchronous boolean predicate, or `{ description?, when? }`. It must decorate the same target as WorkflowTool and has no independent ID. Alone it registers nothing. Either decorator order works. Do not pass asIntent in WorkflowTool options or define it on the decorated class; use the separate Intent decorator. Explicit object configuration continues to support asIntent.

Construct workflows directly with `defineWorkflow({ id, nodes, entryNodeId?, revision?, isResult?, traceSource? })` or `new AgentWorkflow(definition)`, then execute them through an Engine.

## Runner and Agent instances

`@model` requires a subclass of `ModelRunner`; `@agent` requires a subclass of `AgentCoreEngine`. The decorator constructs once after static initialization, injects the registry id and stores the actual instance. Pool reads preserve subclass methods and private fields; do not construct another runner or engine from the result. Optional `args` supplies an explicit constructor argument tuple, without automatic DI.

A Runner constructed without `execution` can be shared: each top-level `invoke` has its own budget, cancellation, journal and call records. The shared host has no implicit current request. Reading callCount, totalCallCount, remainingCalls, lastCall, journal or signal on it throws; read these from bind(execution). For multiple calls, use `runner.bind(execution)`; the same execution object returns the same binding. Passing execution to the constructor also binds its lifetime. Read live counts and journals on that bound instance. Binding an already-bound instance never resets its lifetime or grants budget. Shared `prepare` pins one execution; its handle is single-use and belongs to its original instance. Bind before `createChild`, or pass execution explicitly; children still consume ancestor budgets. Only one call can be active on a binding. Engine binds a shared Runner per run; an existing request binding retains cumulative budget and rejects overlapping runs. Subclass handlers keep their real receiver. Overrides use this.bind(request.execution) to read the same execution state as super calls; custom fields remain shared and request data belongs in parameters or context.

```ts
import { AgentCoreEngine, ModelRunner, defineWorkflow } from '@jangts/agent-core';
import { agent, model, agentPool, modelPool } from '@jangts/agent-core/support/decorators';

const flow = defineWorkflow<{ answer: string }, string>({
  id: 'reply',
  nodes: [{ id: 'done', description: '交付', routes: [{ complete: s => s.answer }] }],
});
@agent('chat', { ns: 'app' })
class ChatAgent extends AgentCoreEngine<string, { answer: string }> {
  constructor() { super({ workflow: flow }); }
}
console.log(await agentPool.get<ChatAgent>('chat', 'app')!.run({ answer: 'hello' }));

@model('main', { ns: 'app', args: ['hello'] })
class MainModel extends ModelRunner {
  constructor(text: string) {
    // Example provider; applications may initialize their own provider here.
    super({ provider: { async *stream() { yield text; } }, maxCalls: 2 });
  }
}
console.log((await modelPool.get<MainModel>('main', 'app')!.invoke({ input: 'hi' })).value);
```

## Shared toolbox instances

`@toolbox({ id: options }, { ns?, args?, compile?, error? })` decorates a class. Options contain description, kind, active and asIntent metadata. Class-owned `inputSchemas[id]` contains only raw JSON Schema; same-named public methods implement handlers. `@ParseInput(id)` and `@ParseOutput(id)` attach public parser methods. Stack decorators to reuse a parser across tools.

`@Authorize()` supplies the shared execution check; `@Authorize(id)` adds a per-tool check. Order: input parsing, common authorization, additional authorization, handler, output parsing. Rejection stops immediately. Executable tools require input validation, an output parser and at least one authorization check. Model-only entries omit kind and optionally use ParseOutput; their synchronous mapping is not an execution authorization boundary and cannot declare per-tool Authorize.

`compile` and `error` reuse the `Support.fromJsonSchema` contract: the App supplies its compiler and error factory. Schemas are copied, frozen and compiled during registration; the same schema object compiles once within a group. Invocation order is schema validation, optional ParseInput conversion or additional checks, authorization, handler, ParseOutput. With compile, ParseInput is optional; without compile, ParseInput must validate untrusted inputs. JSON Schema alone is not validation. Compilation, validation and parsers must be synchronous; Promises are rejected, and failed registration publishes no tools.

```ts
import { Support } from '@jangts/agent-core';
import type { ToolDefinition, OperationContext } from '@jangts/agent-core';
import { toolbox, ParseInput, ParseOutput, Authorize, toolPool } from '@jangts/agent-core/support/decorators';
type Input = { text: string };
type App = { allowed: boolean };
@toolbox({
  search: { description: 'Search', kind: 'read' },
  summarize: { description: 'Summarize', kind: 'read' },
}, { ns: 'knowledge' })
class KnowledgeTools {
  #count = 0;
  inputSchemas = {
    search: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false },
    summarize: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false },
  };
  @ParseInput('search') @ParseInput('summarize')
  parseInput(raw: unknown): Input {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).some(key => key !== 'text') || typeof (raw as Input).text !== 'string') throw new TypeError('Invalid input');
    return raw as Input;
  }
  @ParseOutput('search') @ParseOutput('summarize')
  parseOutput(raw: unknown): string { if (typeof raw !== 'string') throw new TypeError('Invalid output'); return raw; }
  @Authorize()
  checkAccess(_input: Input, context: OperationContext<App>) { if (!context.app.allowed) throw new Error('Denied'); }
  search(input: Input) { return input.text + ':' + ++this.#count; }
  summarize(input: Input) { return this.search(input); }
}
const tools = Support.defineToolCatalog<App>(toolPool.getAll<ToolDefinition<Input, string, App>>('knowledge')).bind({ app: { allowed: true } });
console.log((await tools.invoke({ toolId: 'summarize', input: { text: 'hello' } })).value);
```

All handlers, parsers and authorization methods share the same real host and private fields. `this.otherMethod()` is ordinary composition, without another receipt or automatic authorization; use the normal tool runtime for a separate invocation. Helpers are not implicitly registered. All configuration, schema, methods, parser targets and namespace conflicts are checked before publishing any tool. Missing, duplicate or unknown parser targets reject the whole group. Request identities, signals and budgets stay in the invocation context, not shared fields.

To reuse an existing App compiler, pass `{ ns: 'knowledge', compile: schema => validator.compile(schema) }` as the second argument (validator is App-owned). The example's ParseInput may then contain only business conversion, or be omitted. Multiple inputSchemas entries can reference the same schema object.

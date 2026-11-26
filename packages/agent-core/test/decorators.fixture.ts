import { AgentCoreEngine, defineWorkflow, Support, ModelRunner } from '@jangts/agent-core';
import type {
  WorkflowNode,
  WorkflowContext,
  ToolDefinition,
  OperationContext,
} from '@jangts/agent-core';
import {
  node,
  tool,
  fragment,
  agent,
  model,
  toolbox,
  ParseInput,
  ParseOutput,
  Authorize,
  nodePool,
  toolPool,
  fragmentPool,
  agentPool,
  modelPool,
} from '@jangts/agent-core/support/decorators';
import type { Node, Tool, Fragment } from '@jangts/agent-core/support/decorators';

type State = { value: string; result?: string };
type App = { suffix: string };
const ns = '__FORMAT__';
let constructed = 0;
@node<State, string, App>('class-node', { ns })
class ClassNode implements Node<State, string, App> {
  #prefix = 'class:';
  constructor() {
    constructed++;
  }
  get description() {
    return this.#prefix + 'node';
  }
  readonly routes = [{ complete: (state: Readonly<State>) => state.result! }];
  run(state: Readonly<State>, context: WorkflowContext<App>) {
    return { result: this._format(state.value) + context.app.suffix };
  }
  private _format(value: string) {
    return this.#prefix + value;
  }
}
// Class signature inference does not require a second full options object.
@node('inferred', { ns })
class InferredNode implements Node<State, string, App> {
  readonly description = 'inferred';
  readonly routes = [{ complete: (state: Readonly<State>) => state.value }];
  run(state: Readonly<State>) {
    return { result: state.value };
  }
}

class Host {
  #prefix = 'method:';
  @node<State, string, App>('method-node', {
    ns,
    description: 'adapt lookup',
    routes: [{ complete: (state: Readonly<State>) => state.result! }],
  })
  lookup(state: Readonly<State>, context: WorkflowContext<App>) {
    return { result: this._format(state.value) + context.app.suffix };
  }
  private _format(value: string) {
    return this.#prefix + value;
  }
}
const host = new Host();

type EchoInput = { text: string };

@tool<EchoInput, string, App>('echo', { ns })
class Echo implements Tool<EchoInput, string, App> {
  readonly kind = 'read';
  readonly description = 'echo';
  readonly inputSchema = {
    jsonSchema: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text'],
      additionalProperties: false,
    },
    parse: (input: unknown) => input as EchoInput,
  };
  #prefix = 'echo:';
  authorize(_input: EchoInput, _context: OperationContext<App>): void {}
  execute(input: EchoInput, context: OperationContext<App>) {
    return this.#prefix + input.text + context.app.suffix;
  }
  parseOutput(value: unknown) {
    if (typeof value !== 'string') throw new TypeError('string');
    return value;
  }
}

@fragment<string>('subject', { ns })
class Subject implements Fragment<string> {
  readonly sourceId = 'test';
  readonly trust = 'server' as const;
  readonly lifetime = 'turn' as const;
  readonly maxChars = 100;
  readonly role = 'user' as const;
  #prefix = 'subject:';
  format(value: string) {
    return this.#prefix + value;
  }
}
const wholeWorkflow = defineWorkflow<State, string, App>({
  id: 'whole',
  nodes: nodePool.pick<WorkflowNode<State, string, App>>(['class-node'], ns),
});
@agent('agent-options', { ns })
class AgentConfiguration extends AgentCoreEngine<string, State, App> {
  constructor() {
    super({ workflow: wholeWorkflow, app: { suffix: '!' } });
  }
}
@model('model-options', { ns, args: ['model'] })
class ModelConfiguration extends ModelRunner {
  constructor(text: string) {
    super({
      provider: {
        async *stream() {
          yield text;
        },
      },
      maxCalls: 2,
    });
  }
}
@toolbox(
  {
    search: { kind: 'read', description: 'search' },
    summarize: { kind: 'read', description: 'summarize' },
  },
  {
    ns: ns + '-box',
    compile:
      () =>
      (raw: unknown): raw is EchoInput =>
        !!raw && typeof raw === 'object' && typeof (raw as EchoInput).text === 'string',
  },
)
class SharedTools {
  #seen = 0;
  readonly inputSchemas = { search: { type: 'object' }, summarize: { type: 'object' } };
  @ParseInput('search')
  @ParseInput('summarize')
  parseInput(raw: unknown): EchoInput {
    if (!raw || typeof raw !== 'object' || typeof (raw as EchoInput).text !== 'string')
      throw Error('invalid input');
    return raw as EchoInput;
  }
  @ParseOutput('search')
  @ParseOutput('summarize')
  parseOutput(raw: unknown): string {
    if (typeof raw !== 'string') throw Error('invalid output');
    return raw;
  }
  @Authorize()
  authorize(input: EchoInput, context: OperationContext<App>) {
    if (!context.app.suffix || !input.text) throw Error('denied');
  }
  search(input: EchoInput) {
    return input.text + ':' + ++this.#seen;
  }
  summarize(input: EchoInput) {
    return this.search(input);
  }
}
export async function verify() {
  if (constructed !== 1) throw new Error('class must construct once');
  const classResult = await new AgentCoreEngine<string, State, App>({
    workflow: defineWorkflow({
      id: 'class-flow',
      nodes: nodePool.pick<WorkflowNode<State, string, App>>(['class-node'], ns),
    }),
    app: { suffix: '!' },
  }).run({ value: 'ok' });
  const methodResult = await new AgentCoreEngine<string, State, App>({
    workflow: defineWorkflow({
      id: 'method-flow',
      nodes: nodePool.pick<WorkflowNode<State, string, App>>(['method-node'], ns),
    }),
    app: { suffix: '!' },
  }).run({ value: 'ok' });
  const toolResult = await Support.defineToolCatalog<App>(
    toolPool.getAll<ToolDefinition<EchoInput, string, App>>(ns),
  )
    .bind({ app: { suffix: '!' } })
    .invoke({ toolId: 'echo', input: { text: 'ok' } });
  const fragmentResult = Support.defineContextFragments(
    fragmentPool.getAll<import('@jangts/agent-core/types').ContextFragmentConfig<string>>(ns),
  ).fragments('ok')[0].value;
  const agentResult = await agentPool
    .get<AgentConfiguration>('agent-options', ns)!
    .run({ value: 'ok' });
  const modelResult = (
    await modelPool.get<ModelConfiguration>('model-options', ns)!.invoke({ input: 'ok' })
  ).value;
  const box = Support.defineToolCatalog<App>(
    toolPool.getAll<ToolDefinition<EchoInput, string, App>>(ns + '-box'),
  ).bind({ app: { suffix: '!' } });
  const first = await box.invoke({ toolId: 'search', input: { text: 'memory' } });
  const second = await box.invoke({ toolId: 'summarize', input: { text: 'memory' } });
  if (first.value !== 'memory:1' || second.value !== 'memory:2')
    throw Error('toolbox must share one real host');
  return {
    classResult,
    methodResult,
    toolResult: toolResult.value,
    fragmentResult,
    agentResult,
    modelResult,
    constructed,
  };
}

export { ClassNode, host, ns };

// Deliberately invalid declarations are checked but never instantiated at runtime.
function typeRejections() {
  // @ts-expect-error a node definition class must provide routes and description
  @node<State, string, App>('missing-fields')
  class MissingFields {
    run() {
      return {};
    }
  }
  class BadMethod {
    // @ts-expect-error a host method must accept the original State and context contract
    @node<State, string, App>('bad-method', {
      description: 'bad',
      routes: [{ complete: () => 'bad' }],
    })
    lookup(value: number) {
      return value;
    }
  }
  // @ts-expect-error model classes need a Provider
  @model('missing-provider')
  class MissingProvider {
    maxCalls = 1;
  }
  // @ts-expect-error agent classes must extend the actual Engine
  @agent('missing-app')
  class MissingApp {
    readonly workflow = wholeWorkflow;
  }
  // @ts-expect-error a toolbox schema key requires the corresponding public handler
  @toolbox({ absent: { description: 'missing' } })
  class MissingToolboxMethod {
    inputSchemas = { absent: { type: 'object' } };
  }
  @toolbox(
    { first: { description: 'first' } },
    {
      // @ts-expect-error schema compilers return synchronous boolean validators
      compile:
        async () =>
        (value: unknown): value is object =>
          true,
    },
  )
  class AsyncCompiler {
    inputSchemas = { first: { type: 'object' } };
    first(value: unknown) {
      return value;
    }
  }
  // @ts-expect-error compile must return a predicate, not a string
  @toolbox({ first: { description: 'first' } }, { compile: () => 'invalid' })
  class InvalidCompiler {
    inputSchemas = { first: { type: 'object' } };
    first(value: unknown) {
      return value;
    }
  }
  // @ts-expect-error constructor arguments must match the decorated runtime constructor
  @model('bad-args', { args: [123] })
  class WrongArgs extends ModelRunner {
    constructor(text: string) {
      super({
        provider: {
          async *stream() {
            yield text;
          },
        },
      });
    }
  }
  // @ts-expect-error pool factories are not part of decoration options
  node('explicit-pool', { pool: {} });
  // @ts-expect-error namespaces replace tags
  node('tags', { tags: ['chat'] });
  // @ts-expect-error pick takes an id array, not a variadic string list
  nodePool.pick('class-node');
  // @ts-expect-error getAll takes only a namespace
  nodePool.getAll('chat', 'other');
  // @ts-expect-error no public metadata-plus-free-function conversion overload
  node('free-function', () => ({}));
}

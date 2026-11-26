// 定义装饰器配方：类自动实例化、真实宿主方法绑定及命名空间读取；不新增执行框架。
export default [
  {
    id: 'definition-decorators',
    title: '装饰器：处理类与已有实例方法',
    layer: 'support',
    matches: [
      'node',
      'tool',
      'fragment',
      'agent',
      'model',
      'toolbox',
      'ParseInput',
      'ParseOutput',
      'Authorize',
      'Toolbox',
      'ToolboxEntry',
      'InstanceDecorationOptions',
      'RuntimeDecoration',
      'nodePool',
      'toolPool',
      'fragmentPool',
      'agentPool',
      'modelPool',
      'DefinitionReader',
      'Intent',
      'ClassDecoration',
      'MethodDecoration',
      'DecorationOptions',
      'IdentifiedDefinition',
      'Node',
      'Tool',
      'Fragment',
    ],
    summary: '类装饰代办定义实例化，方法装饰绑定原对象；输出仍走原 define、构造和 bind。',
    details: `仅从 @jangts/agent-core/support/decorators 使用标准装饰器；NestJS 旧版 experimentalDecorators 编译单元不能直接接入。无新增依赖、反射或自动 DI。

id 来自装饰器，类提供其余配置、处理方法与 this._xxx 内部协作。定义类可无参构造，静态初始化后只构造一次；Node、Tool、Fragment 提供具名定义合同。Agent/Model 必须继承 AgentCoreEngine/ModelRunner，构造参数可由 args 显式传入。

每类各一个共享读取池，不创建池、不手动登记。装饰器 ns 接受字符串或字符串数组，默认 default。同类型同命名空间内 id 唯一；不同空间可同名。多个空间共享同一对象，冲突先全部预检。get(id, ns?) 缺失返回 undefined，getAll(ns?) 返回该空间登记顺序快照，pick(ids, ns?) 按指定顺序选取并拒绝重复或缺失 id。

方法装饰自动绑定并在实例初始化钩子中登记，调用方等待宿主构造成功后才读取运行。构造失败不回滚已完成登记，应视为装配失败；共享池不保存请求级宿主，同命名空间同 id 的第二个实例拒绝。没有 registerFrom、手写 bind 或额外类装饰器。

node 映射 run，tool 映射 execute，fragment 映射 format，均回到原接口与校验。agent/model 登记真实运行实例，读取后直接调用 run/invoke，未绑定的 Runner 按调用隔离执行状态，bind(execution) 则共享本次预算；Engine 自动按 run 绑定。共享宿主的执行状态读取会拒绝；覆写方法用 this.bind(request.execution) 读取本次统计、journal 和 signal。请求数据通过参数或 context 传递，自定义字段仍共享。toolbox({id:options}) 声明元信息，类内 inputSchemas 只放 JSON Schema，同名方法提供处理逻辑；compile/error 复用 fromJsonSchema；同组共用 schema 对象只编译一次，校验后再做可选 ParseInput 转换；未提供 compile 时由 ParseInput 校验。ParseOutput 挂输出解析，Authorize() 共享授权，Authorize(id) 追加单项检查。ns 不传给 Core，也不改变 id；合并命名空间中的同名定义仍受原图与工具清单唯一性约束。同一 realm 内 ESM/CJS 共享读取池，独立进程与 Worker 不共享；池不是执行或授权。`,
    examples: [
      {
        title: '类拥有配置与私有辅助方法，不手写 new',
        level: '入门',
        environment: 'TypeScript 标准装饰器',
        ts: `import { AgentCoreEngine, defineWorkflow } from '@jangts/agent-core';
import type { WorkflowNode } from '@jangts/agent-core';
import { node, nodePool } from '@jangts/agent-core/support/decorators';
import type { Node } from '@jangts/agent-core/support/decorators';
type State = { text: string; answer?: string };
@node<State, string>('greet', { ns: 'greeting' })
class Greeting implements Node<State, string> {
  readonly description = '生成问候';
  readonly routes = [{ complete: (state: Readonly<State>) => state.answer! }];
  #prefix = '你好，';
  run(state: Readonly<State>) { return { answer: this._format(state.text) }; }
  private _format(text: string) { return this.#prefix + text.trim(); }
}
const flow = defineWorkflow<State, string>({ id: 'greeting', nodes: nodePool.getAll('greeting') });
console.log(await new AgentCoreEngine({ workflow: flow }).run({ text: '访客' }));`,
      },
      {
        title: '保留服务方法名，自动绑定原对象',
        level: '配置',
        environment: 'TypeScript 标准装饰器',
        ts: `import type { WorkflowNode } from '@jangts/agent-core';
import { node, nodePool } from '@jangts/agent-core/support/decorators';
type State = { text: string; answer?: string };
class GreetingService {
  constructor(private readonly prefix: string) {}
  @node<State, string>('reply', { ns: 'service',
    description: '调用现有服务',
    routes: [{ complete: (state: Readonly<State>) => state.answer! }],
  })
  answer(state: Readonly<State>) { return { answer: this.prefix + state.text }; }
}
const service = new GreetingService('你好，');
const definition = nodePool.get<WorkflowNode<State, string>>('reply', 'service')!;
console.log(definition === nodePool.get('reply', 'service'));`,
      },
      {
        title: '工具类继续使用原授权与结果检查',
        level: '扩展',
        environment: 'TypeScript 标准装饰器',
        ts: `import { Support } from '@jangts/agent-core';
import type { ToolDefinition } from '@jangts/agent-core';
import { tool, toolPool } from '@jangts/agent-core/support/decorators';
import type { Tool } from '@jangts/agent-core/support/decorators';
type Input = { text: string };
@tool<Input, string, undefined>('echo', { ns: 'echo' })
class Echo implements Tool<Input, string, undefined> {
  readonly kind = 'read';
  readonly description = '回显文本';
  readonly inputSchema = {
    jsonSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    parse(value: unknown): Input {
      if (!value || typeof value !== 'object' || !('text' in value) || typeof value.text !== 'string') throw new TypeError('text');
      return { text: value.text };
    },
  };
  authorize(): void {}
  execute(input: Input) { return this._format(input.text); }
  private _format(text: string) { return text.trim(); }
  parseOutput(value: unknown): string {
    if (typeof value !== 'string') throw new TypeError('string');
    return value;
  }
}
const runtime = Support.defineToolCatalog<undefined>(toolPool.getAll<ToolDefinition<Input, string, undefined>>('echo')).bind({ app: undefined });
console.log((await runtime.invoke({ toolId: 'echo', input: { text: 'hello' } })).value);`,
      },
      {
        title: '资料、工作流与真实运行实例',
        level: '扩展',
        environment: 'TypeScript 标准装饰器',
        ts: `import { AgentCoreEngine, ModelRunner, Support, defineWorkflow } from '@jangts/agent-core';
import type { ContextFragmentConfig } from '@jangts/agent-core/types';
import { fragment, agent, model, fragmentPool, agentPool, modelPool } from '@jangts/agent-core/support/decorators';
@fragment<string>('subject')
class Subject {
  readonly sourceId = 'app'; readonly trust = 'server' as const;
  readonly lifetime = 'turn' as const; readonly role = 'user' as const; readonly maxChars = 100;
  format(text: string) { return text; }
}
const builder = Support.defineContextFragments([fragmentPool.get<ContextFragmentConfig<string>>('subject')!]);
console.log(builder.fragments('hello'));
const flow = defineWorkflow<{ answer: string }, string>({
  id: 'flow',
  nodes: [{ id: 'done', description: '交付', routes: [{ complete: (s) => s.answer }] }],
});
@agent('configured')
class Configured extends AgentCoreEngine<string,{answer:string}> { constructor() { super({workflow:flow}); } }
console.log(await agentPool.get<Configured>('configured')!.run({answer:'hello'}));
@model('text-model')
class TextModel extends ModelRunner { constructor() { super({ provider: { async *stream() { yield 'hello'; } }, maxCalls: 1 }); } }
const runner = modelPool.get<TextModel>('text-model')!;
console.log((await runner.invoke({input:'hello'})).value);`,
      },
      { title: '共享宿主与解析、授权方法', level: '扩展', environment: 'TypeScript 标准装饰器', ts: `import { Support } from '@jangts/agent-core';
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
` },
    ],
  },
];
